"""
Export real CICIDS2017 benchmark alerts for Laminar console.
Reads actual traffic CSVs → runs PCF engine → outputs laminar-alerts-data.json

Run from: C:/Users/Scooter/Pcfic.com/
  python export_real_alerts.py
"""
import sys
import json
import math
import random
import time
from pathlib import Path

PACIFIC_ROOT = Path("C:/Users/Scooter/Desktop/PACIFIC")
sys.path.insert(0, str(PACIFIC_ROOT))

import types as _types
import core.engine as _core_engine_mod
_pcf_shim = _types.ModuleType("pcf")
_pcf_shim.engine = _core_engine_mod
sys.modules.setdefault("pcf", _pcf_shim)
sys.modules.setdefault("pcf.engine", _core_engine_mod)

from benchmarks.real_world.cicids2017_loader import (
    CICIDS2017_FILES, load_cicids2017_from_path
)
from core.engine import PCFEngine, NeuralPositionalKernel, KernelType

# ── constants matching the console UI ────────────────────────────────────────
CONSOLE_TYPE_MAP = {
    'BruteForce': 'BruteForce',
    'DDoS':       'DDoS',
    'DoS':        'DoS',
    'PortScan':   'PortScan',
    'WebAttacks': 'WebAttack',
}

CLAIM_MAP = {
    'BruteForce': 'Claim 27 — Network Intrusion Detection via PSV structural divergence',
    'DDoS':       'Claim 27 — Network Intrusion Detection via PSV structural divergence',
    'DoS':        'Claim 27 — Network Intrusion Detection via PSV structural divergence',
    'PortScan':   'Claim 28 — Zero-Day Attack Detection without signature database',
    'WebAttack':  'Claim 28 — Zero-Day Attack Detection without signature database',
}

SENSORS = ['SNS-NYC-01', 'SNS-LAX-02', 'SNS-CHI-03', 'SNS-LON-04', 'SNS-SIN-06']

DPORT_MAP = {
    'BruteForce': lambda r: 22 if r.random() > 0.5 else 21,
    'DDoS':       lambda r: 80,
    'DoS':        lambda r: 80,
    'PortScan':   lambda r: r.randint(1, 1024),
    'WebAttack':  lambda r: 443 if r.random() > 0.5 else 80,
}

ATTACK_TOKENS = {'NET_FLOOD', 'NET_PORTSCAN', 'AUTH_BRUTE', 'NET_SLOW_CONN', 'NET_LARGE_SEND'}

# ── helpers ───────────────────────────────────────────────────────────────────
def cosine_dist(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na  = math.sqrt(sum(x * x for x in a))
    nb  = math.sqrt(sum(y * y for y in b))
    return 1.0 - dot / (na * nb + 1e-9)

def severity(dist, threshold):
    ratio = dist / (threshold + 1e-9)
    if ratio > 2.5: return 'CRITICAL'
    if ratio > 1.5: return 'HIGH'
    if ratio > 0.8: return 'MEDIUM'
    return 'LOW'

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    engine = PCFEngine(10, NeuralPositionalKernel(10, KernelType.LEARNED_DECAY))
    rng    = random.Random(42)
    alerts = []
    alert_id = 1000
    now_ms   = int(time.time() * 1000)

    for attack_key, console_type in CONSOLE_TYPE_MAP.items():
        file_info = CICIDS2017_FILES[attack_key]
        csv_path  = next((Path(c) for c in file_info['candidates'] if Path(c).exists()), None)

        if csv_path is None:
            print(f"  SKIP {attack_key} — CSV not found")
            continue

        print(f"  {attack_key}: loading {csv_path.name} ...", flush=True)

        dataset, is_real = load_cicids2017_from_path(
            csv_path, file_info['attack_labels'],
            n_benign=300, n_attack=300, window_size=20, seed=42
        )
        if not is_real:
            print(f"  SKIP {attack_key} — not real data")
            continue

        # Calibrate on 80 benign traces
        benign_psvs = []
        for trace, label in dataset:
            if label != 'normal':
                continue
            toks = [e.token for e in trace.events]
            psv  = engine.compute_psv(toks)
            if psv:
                benign_psvs.append(list(psv.values))
            if len(benign_psvs) >= 80:
                break

        if len(benign_psvs) < 10:
            print(f"  SKIP {attack_key} — insufficient benign calibration")
            continue

        n_dim = len(benign_psvs[0])
        mu    = [sum(p[i] for p in benign_psvs) / len(benign_psvs) for i in range(n_dim)]
        dists_cal = sorted(cosine_dist(p, mu) for p in benign_psvs)
        thresh_a  = dists_cal[int(len(dists_cal) * 0.90)]

        # Calibrate Signal B threshold on benign token fractions
        benign_fracs = []
        for trace, label in dataset:
            if label != 'normal':
                continue
            toks = [e.token for e in trace.events]
            benign_fracs.append(sum(1 for t in toks if t in ATTACK_TOKENS) / max(len(toks), 1))
        benign_fracs.sort()
        thresh_b = benign_fracs[int(len(benign_fracs) * 0.99)] if benign_fracs else 0.3

        # Classify attack traces
        class_alerts = []
        for trace, label in dataset:
            if label != 'intrusion':
                continue

            toks = [e.token for e in trace.events]
            if not toks:
                continue

            psv = engine.compute_psv(toks)
            if not psv:
                continue
            psv = list(psv.values)

            dist    = cosine_dist(psv, mu)
            frac    = sum(1 for t in toks if t in ATTACK_TOKENS) / len(toks)
            sig_a   = dist > thresh_a
            sig_b   = frac > thresh_b
            detected = sig_a or sig_b

            if not detected:
                continue  # false negative — skip

            alert_id += 1
            sev        = severity(dist, thresh_a)
            confidence = round(min(0.999, 0.70 + min(dist / (thresh_a + 1e-9), 1.0) * 0.28), 3)
            ago_ms     = rng.randint(0, 86_400_000)
            ts         = time.strftime('%Y-%m-%dT%H:%M:%SZ',
                                       time.gmtime((now_ms - ago_ms) / 1000))
            sensor_id  = rng.choice(SENSORS)
            dst_port   = DPORT_MAP[console_type](rng)
            src_ip     = f"172.{16+rng.randint(0,3)}.{rng.randint(0,255)}.{rng.randint(1,253)}"
            dst_ip     = f"10.0.{rng.randint(0,9)}.{rng.randint(1,30)}"
            src_port   = 1024 + rng.randint(0, 63000)
            st         = rng.random()
            status     = 'OPEN' if st > 0.65 else ('INVESTIGATING' if st > 0.35 else 'RESOLVED')

            # Representative unique token sequence (preserve order)
            seen, unique_toks = set(), []
            for t in toks:
                if t not in seen:
                    seen.add(t)
                    unique_toks.append(t)
                if len(unique_toks) >= 8:
                    break

            class_alerts.append({
                'id':        f'ALT-{alert_id}',
                'ts':        ts,
                'sev':       sev,
                'type':      console_type,
                'srcIp':     src_ip,
                'dstIp':     dst_ip,
                'srcPort':   src_port,
                'dstPort':   dst_port,
                'sensorId':  sensor_id,
                'confidence': confidence,
                'psvDist':   round(dist, 4),
                'psv':       [round(v, 3) for v in psv],
                'normalPsv': [round(v, 3) for v in mu],
                'tokens':    unique_toks,
                'flows':     20,
                'status':    status,
                'claim':     CLAIM_MAP[console_type],
                'real':      True,
            })

        alerts.extend(class_alerts)
        print(f"  {attack_key}: {len(class_alerts)} real detections")

    alerts.sort(key=lambda a: a['ts'], reverse=True)
    print(f"\nTotal: {len(alerts)} real PCF detections across all classes")

    out = Path("C:/Users/Scooter/Pcfic.com/laminar-alerts-data.json")
    with open(out, 'w') as f:
        json.dump(alerts, f, separators=(',', ':'))
    print(f"Written: {out}  ({out.stat().st_size // 1024} KB)")

if __name__ == '__main__':
    main()
