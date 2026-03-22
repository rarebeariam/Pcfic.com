import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

const C = {
  bg:'#020810', surface:'#060e1c', panel:'#0b1628', panelHi:'#0f1e38',
  border:'#142238', border2:'#1e3855', accent:'#00E5FF', blue:'#5B6ECC',
  danger:'#FF3B6B', warn:'#FF8C00', amber:'#F59E0B', success:'#00E5A0',
  purple:'#A855F7', text:'#E2F0FF', sub:'#8AAABB', muted:'#4A6A8A', dim:'#1e3050',
};

const FTYPES = {
  InnerRace: {
    color: '#FF3B6B', icon: '⚙', f1: 0.911, prec: 0.891, rec: 0.932,
    desc: 'Inner race bearing fault — sharp kurtosis spikes from ball-race impact repetition at characteristic defect frequency.',
    tokens: ['VIB_ZONE_C','VIB_KURTOSIS_HIGH','VIB_ZONE_C','TEMP_ELEVATED','VIB_KURTOSIS_HIGH','CURRENT_ELEVATED'],
    psv: [3.812,4.221,3.654,4.108,3.891,4.312,3.723,4.089,3.945,4.187],
    signals: { a:true, b:true, c:true },
    sensor: { vib_rms:5.5, kurtosis:8.5, rpm:1750, temp:71.0, current:19.5 }
  },
  OuterRace: {
    color: '#FF8C00', icon: '◎', f1: 0.819, prec: 0.801, rec: 0.838,
    desc: 'Outer race bearing fault — moderate kurtosis elevation with structural PSV deviation from normal bearing signature.',
    tokens: ['VIB_ZONE_C','TEMP_ELEVATED','VIB_ZONE_B','CURRENT_NORMAL','VIB_KURTOSIS_HIGH','VIB_ZONE_C'],
    psv: [3.521,3.889,3.412,3.754,3.634,3.921,3.478,3.812,3.567,3.743],
    signals: { a:true, b:false, c:true },
    sensor: { vib_rms:4.8, kurtosis:6.2, rpm:1750, temp:69.0, current:19.2 }
  },
  BallFault: {
    color: '#A855F7', icon: '●', f1: 0.758, prec: 0.741, rec: 0.776,
    desc: 'Ball element fault — subtle structural deviation detectable only through Signal A PSV cosine distance. Hardest fault class.',
    tokens: ['VIB_ZONE_B','VIB_ZONE_A','TEMP_NORMAL','VIB_ZONE_B','CURRENT_NORMAL','VIB_ZONE_A'],
    psv: [3.234,3.512,3.187,3.445,3.312,3.578,3.198,3.489,3.267,3.421],
    signals: { a:true, b:false, c:false },
    sensor: { vib_rms:3.8, kurtosis:4.8, rpm:1750, temp:67.5, current:18.8 }
  }
};

const NORMAL_PSV = [2.891,3.124,2.934,3.087,2.956,3.201,2.912,3.098,2.878,3.143];
const NORMAL_SENSOR = { vib_rms:1.75, kurtosis:3.0, rpm:1750, temp:65.0, current:18.0 };

const EQUIPMENT_INIT = [
  { id:'EQ-MTR-01', name:'Main Drive Motor',    location:'Bay A - Floor 1', type:'Motor',      status:'ONLINE',   sps:1200, faults:3,  uptime:847,  version:'1.4.2' },
  { id:'EQ-PMP-02', name:'Coolant Pump A',      location:'Bay A - Floor 2', type:'Pump',       status:'ONLINE',   sps:840,  faults:1,  uptime:423,  version:'1.4.2' },
  { id:'EQ-CMP-03', name:'Air Compressor Unit', location:'Bay B - Floor 1', type:'Compressor', status:'DEGRADED', sps:320,  faults:7,  uptime:156,  version:'1.3.1' },
  { id:'EQ-MTR-04', name:'Conveyor Drive',      location:'Bay B - Floor 2', type:'Motor',      status:'ONLINE',   sps:960,  faults:0,  uptime:1204, version:'1.4.2' },
  { id:'EQ-FAN-05', name:'Exhaust Fan Bank',    location:'Roof Plant',      type:'Fan',        status:'OFFLINE',  sps:0,    faults:0,  uptime:0,    version:'1.3.1' },
  { id:'EQ-PMP-06', name:'Hydraulic Pump B',    location:'Bay C - Floor 1', type:'Pump',       status:'ONLINE',   sps:720,  faults:2,  uptime:612,  version:'1.4.2' },
];

function seedRng(s){ return ()=>{ s=Math.imul(1664525,s)+1013904223|0; return (s>>>0)/0xffffffff; }; }

let _fid = 5000;
function genFault(seed, hoursAgo=null) {
  const r = seedRng(seed);
  const keys = Object.keys(FTYPES);
  const type = keys[Math.floor(r() * keys.length)];
  const meta = FTYPES[type];
  const sv = r();
  const sev = sv > 0.85 ? 'CRITICAL' : sv > 0.55 ? 'HIGH' : sv > 0.25 ? 'MEDIUM' : 'WARNING';
  const faultPsv = meta.psv.map(v => Math.round((v + (r()-0.5)*0.5)*1000)/1000);
  const normPsv = NORMAL_PSV.map(v => Math.round((v + (r()-0.5)*0.15)*1000)/1000);
  const dot = faultPsv.reduce((s,v,i) => s + v*normPsv[i], 0);
  const na = Math.sqrt(faultPsv.reduce((s,v) => s+v*v, 0));
  const nb = Math.sqrt(normPsv.reduce((s,v) => s+v*v, 0));
  const psvDist = Math.round((1 - dot/(na*nb+1e-9))*10000)/10000;
  const ago = hoursAgo !== null ? hoursAgo*3600000 : Math.floor(r()*86400000);
  const eqId = EQUIPMENT_INIT[Math.floor(r() * EQUIPMENT_INIT.length)].id;
  const st = r();
  const status = st > 0.65 ? 'OPEN' : st > 0.35 ? 'INVESTIGATING' : 'RESOLVED';
  const sensor = {
    vib_rms: Math.round((meta.sensor.vib_rms + (r()-0.5)*0.8)*100)/100,
    kurtosis: Math.round((meta.sensor.kurtosis + (r()-0.5)*1.2)*100)/100,
    rpm: Math.round(meta.sensor.rpm + (r()-0.5)*30),
    temp: Math.round((meta.sensor.temp + (r()-0.5)*2)*10)/10,
    current: Math.round((meta.sensor.current + (r()-0.5)*0.4)*10)/10,
  };
  const confidence = Math.round((0.72 + r()*0.26)*1000)/1000;
  return {
    id: `FLT-${++_fid}`, ts: new Date(Date.now()-ago).toISOString(),
    sev, type, eqId, status, psvDist, faultPsv, normPsv,
    tokens: meta.tokens, confidence, sensor,
    signals: meta.signals,
    windows: 20,
  };
}

const INIT_FAULTS = Array.from({length:12}, (_,i) => genFault(i*19+37, (i/12)*24))
  .sort((a,b) => new Date(b.ts) - new Date(a.ts));

// ── Primitives ──────────────────────────────────────────────────────────────

function Sev({s}) {
  const map = {
    CRITICAL: { bg:'#3a0a14', color:C.danger, border:C.danger },
    HIGH:     { bg:'#2a1800', color:C.warn,   border:C.warn },
    MEDIUM:   { bg:'#2a1a00', color:C.amber,  border:C.amber },
    WARNING:  { bg:'#0a2218', color:C.success, border:C.success },
  };
  const m = map[s] || map.WARNING;
  return (
    <span style={{
      background:m.bg, color:m.color, border:`1px solid ${m.border}22`,
      borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700,
      letterSpacing:'0.05em', fontFamily:'monospace'
    }}>{s}</span>
  );
}

function FaultTag({t}) {
  const meta = FTYPES[t];
  if (!meta) return <span style={{color:C.muted,fontSize:12}}>{t}</span>;
  return (
    <span style={{
      background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}33`,
      borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600,
      display:'inline-flex', alignItems:'center', gap:4
    }}>
      <span>{meta.icon}</span> {t}
    </span>
  );
}

function StatusDot({s}) {
  const map = {
    ONLINE:   { color:C.success, glow:C.success },
    DEGRADED: { color:C.amber,   glow:C.amber },
    OFFLINE:  { color:C.muted,   glow:'transparent' },
  };
  const m = map[s] || map.OFFLINE;
  return (
    <span style={{
      display:'inline-block', width:8, height:8, borderRadius:'50%',
      background:m.color,
      boxShadow: s !== 'OFFLINE' ? `0 0 6px 2px ${m.glow}66` : 'none',
    }} />
  );
}

function Card({children, style, onClick}) {
  return (
    <div
      onClick={onClick}
      style={{
        background:C.panel, border:`1px solid ${C.border}`, borderRadius:10,
        padding:20, ...style,
        cursor: onClick ? 'pointer' : undefined,
        transition:'border-color 0.15s',
      }}
      onMouseEnter={onClick ? e => e.currentTarget.style.borderColor = C.border2 : undefined}
      onMouseLeave={onClick ? e => e.currentTarget.style.borderColor = C.border : undefined}
    >
      {children}
    </div>
  );
}

function SectionLabel({children}) {
  return (
    <div style={{color:C.muted, fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10}}>
      {children}
    </div>
  );
}

// ── PSV Radar ────────────────────────────────────────────────────────────────

function PSVRadar({psv, normalPsv, color}) {
  const size = 220;
  const cx = size/2, cy = size/2;
  const R = 88;
  const n = 10;
  const rings = [0.25, 0.5, 0.75, 1.0];
  const maxVal = 5.5;

  function polarPoint(i, val) {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const r = (val / maxVal) * R;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function polyPoints(vals) {
    return vals.map((v,i) => polarPoint(i, v).join(',')).join(' ');
  }

  function ringPoints(frac) {
    return Array.from({length:n}, (_,i) => polarPoint(i, frac*maxVal).join(',')).join(' ');
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <svg width={size} height={size} style={{overflow:'visible'}}>
        {/* Grid rings */}
        {rings.map(f => (
          <polygon key={f} points={ringPoints(f)}
            fill="none" stroke={C.border2} strokeWidth={0.7} opacity={0.6} />
        ))}
        {/* Axes */}
        {Array.from({length:n}, (_,i) => {
          const [x,y] = polarPoint(i, maxVal);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.border2} strokeWidth={0.5} opacity={0.5} />;
        })}
        {/* Normal baseline polygon */}
        <polygon points={polyPoints(normalPsv)}
          fill={`${C.blue}18`} stroke={C.blue} strokeWidth={1.2}
          strokeDasharray="4,3" opacity={0.85} />
        {/* Fault PSV polygon */}
        <polygon points={polyPoints(psv)}
          fill={`${color}20`} stroke={color} strokeWidth={1.8} opacity={0.95} />
        {/* Fault vertex dots */}
        {psv.map((v,i) => {
          const [x,y] = polarPoint(i, v);
          return <circle key={i} cx={x} cy={y} r={3} fill={color} opacity={0.9} />;
        })}
        {/* Axis labels */}
        {Array.from({length:n}, (_,i) => {
          const [x,y] = polarPoint(i, maxVal * 1.22);
          return (
            <text key={i} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill={C.muted} fontFamily="monospace">
              k={i+1}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{display:'flex',gap:16,fontSize:10,color:C.sub}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{display:'inline-block',width:16,height:2,background:color,borderRadius:1}} />
          Fault PSV
        </span>
        <span style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{display:'inline-block',width:16,height:2,background:C.blue,borderRadius:1,opacity:0.85}} />
          Normal baseline
        </span>
      </div>
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({values, color, width=80, height=28}) {
  if (!values || values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = (i / (values.length-1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ── SensorChart ──────────────────────────────────────────────────────────────

function SensorChart({history, width=320, height=60}) {
  if (!history || history.length < 2) return <svg width={width} height={height} />;
  const pad = 4;
  const w = width - pad*2;
  const h = height - pad*2;
  const vMax = 8, vMin = 0;
  const kMax = 12, kMin = 0;
  const normalVib = NORMAL_SENSOR.vib_rms;
  const normalKur = NORMAL_SENSOR.kurtosis;
  const normY = h - ((normalVib - vMin)/(vMax - vMin)) * h + pad;

  function ptsFor(key, mn, mx) {
    return history.map((d,i) => {
      const x = pad + (i/(history.length-1)) * w;
      const y = pad + h - ((d[key] - mn)/(mx - mn)) * h;
      return `${x},${y}`;
    }).join(' ');
  }

  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      {/* threshold line */}
      <line x1={pad} y1={normY} x2={pad+w} y2={normY}
        stroke={C.border2} strokeWidth={1} strokeDasharray="4,3" />
      <polyline points={ptsFor('vib_rms', vMin, vMax)}
        fill="none" stroke={C.accent} strokeWidth={1.5} opacity={0.9} />
      <polyline points={ptsFor('kurtosis', kMin, kMax)}
        fill="none" stroke={C.warn} strokeWidth={1.2} opacity={0.7} />
    </svg>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({faults, width=320, height=80}) {
  const bins = 24;
  const counts = new Array(bins).fill(0);
  const now = Date.now();
  faults.forEach(f => {
    const hoursAgo = (now - new Date(f.ts).getTime()) / 3600000;
    const bin = Math.min(bins-1, Math.floor(hoursAgo));
    if (bin >= 0 && bin < bins) counts[bins-1-bin]++;
  });
  const max = Math.max(...counts, 1);
  const bw = (width - 20) / bins;
  const bh = height - 24;
  return (
    <svg width={width} height={height}>
      {counts.map((c,i) => {
        const barH = (c/max)*bh;
        const x = 10 + i*bw;
        const color = c === 0 ? C.border : c >= max*0.75 ? C.danger : c >= max*0.4 ? C.warn : C.accent;
        return (
          <rect key={i} x={x+1} y={bh-barH+4} width={bw-2} height={barH}
            fill={color} opacity={0.75} rx={1} />
        );
      })}
      <text x={10} y={height-2} fontSize={9} fill={C.muted} fontFamily="monospace">24h ago</text>
      <text x={width-10} y={height-2} fontSize={9} fill={C.muted} textAnchor="end" fontFamily="monospace">now</text>
    </svg>
  );
}

// ── Donut ────────────────────────────────────────────────────────────────────

function Donut({faults, size=120}) {
  const counts = {InnerRace:0, OuterRace:0, BallFault:0};
  faults.forEach(f => { if (counts[f.type] !== undefined) counts[f.type]++; });
  const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
  const r = size/2 - 10, cx = size/2, cy = size/2, stroke = 22;
  const circum = 2*Math.PI*r;
  let offset = 0;
  const slices = Object.entries(counts).map(([type, cnt]) => {
    const frac = cnt/total;
    const dash = frac * circum;
    const slice = { type, cnt, frac, dash, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      {slices.map(({type,dash,offset:off}) => (
        <circle key={type} cx={cx} cy={cy} r={r} fill="none"
          stroke={FTYPES[type].color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circum-dash}`}
          strokeDashoffset={-off + circum/4}
          opacity={0.85}
        />
      ))}
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
        fontSize={18} fontWeight={700} fill={C.text}>{faults.length}</text>
      <text x={cx} y={cy+16} textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fill={C.muted} fontFamily="monospace">FAULTS</text>
    </svg>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({active, onNav, openCount, liveCount}) {
  const navItems = [
    { id:'dashboard', label:'Dashboard', icon:'⬡' },
    { id:'faults',    label:'Faults',    icon:'⚠', badge: openCount },
    { id:'equipment', label:'Equipment', icon:'⚙' },
    { id:'analytics', label:'Analytics', icon:'◈' },
    { id:'reports',   label:'Reports',   icon:'▤' },
    { id:'settings',  label:'Settings',  icon:'◉' },
  ];
  return (
    <div style={{
      width:200, background:C.surface, borderRight:`1px solid ${C.border}`,
      display:'flex', flexDirection:'column', flexShrink:0,
    }}>
      {/* Wordmark */}
      <div style={{padding:'22px 20px 18px', borderBottom:`1px solid ${C.border}`}}>
        <div style={{color:C.accent, fontSize:18, fontWeight:800, letterSpacing:'0.12em'}}>STRATUM</div>
        <div style={{color:C.muted, fontSize:10, marginTop:2, letterSpacing:'0.05em'}}>Industrial Anomaly</div>
      </div>
      {/* Live indicator */}
      <div style={{padding:'10px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:6}}>
        <span style={{
          width:6, height:6, borderRadius:'50%', background:C.success, flexShrink:0,
          boxShadow:`0 0 5px 2px ${C.success}66`,
          animation:'pulse 2s infinite',
        }} />
        <span style={{fontSize:10, color:C.sub, fontFamily:'monospace'}}>{liveCount} sps</span>
      </div>
      {/* Nav */}
      <nav style={{flex:1, padding:'12px 0'}}>
        {navItems.map(item => (
          <div key={item.id}
            onClick={() => onNav(item.id)}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'9px 20px', cursor:'pointer',
              background: active===item.id ? C.panelHi : 'transparent',
              borderLeft: `2px solid ${active===item.id ? C.accent : 'transparent'}`,
              color: active===item.id ? C.text : C.sub,
              fontSize:13, fontWeight: active===item.id ? 600 : 400,
              transition:'all 0.12s',
            }}
          >
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:14}}>{item.icon}</span>
              {item.label}
            </span>
            {item.badge > 0 && (
              <span style={{
                background:C.danger, color:'#fff', fontSize:10, fontWeight:700,
                borderRadius:10, padding:'1px 6px', minWidth:18, textAlign:'center',
              }}>{item.badge}</span>
            )}
          </div>
        ))}
      </nav>
      {/* Footer */}
      <div style={{padding:'14px 20px', borderTop:`1px solid ${C.border}`, fontSize:10, color:C.muted}}>
        <div style={{marginBottom:2}}>PCF Engine v1.4.2</div>
        <div>CWRU Benchmark Live</div>
      </div>
    </div>
  );
}

// ── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({section, critCount}) {
  const labels = {
    dashboard:'Dashboard', faults:'Fault Log', equipment:'Equipment Registry',
    analytics:'Analytics & Benchmarks', reports:'Reports', settings:'Settings'
  };
  return (
    <div style={{
      height:52, background:C.surface, borderBottom:`1px solid ${C.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 24px', flexShrink:0,
    }}>
      <div style={{fontSize:15, fontWeight:600, color:C.text}}>{labels[section]}</div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{
          background:`${C.success}18`, color:C.success, border:`1px solid ${C.success}44`,
          borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700,
          display:'flex', alignItems:'center', gap:5,
        }}>
          <span style={{width:6,height:6,borderRadius:'50%',background:C.success,display:'inline-block', boxShadow:`0 0 4px ${C.success}`}} />
          CWRU BENCHMARK LIVE
        </div>
        {critCount > 0 && (
          <div style={{
            background:`${C.danger}22`, color:C.danger, border:`1px solid ${C.danger}55`,
            borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700,
          }}>
            {critCount} CRITICAL
          </div>
        )}
      </div>
    </div>
  );
}

// ── FaultInvestigator Modal ──────────────────────────────────────────────────

function FaultInvestigator({fault, onClose, onStatusChange}) {
  const [tab, setTab] = useState('pcf');
  const meta = FTYPES[fault.type];

  const tabs = [
    {id:'pcf', label:'PCF Signature'},
    {id:'evidence', label:'Evidence Chain'},
    {id:'tokens', label:'Token Stream'},
    {id:'response', label:'Response'},
  ];

  const pmiDesc = {
    InnerRace: 'PMI(VIB_KURTOSIS_HIGH, VIB_KURTOSIS_HIGH, k=1) >> baseline → periodic impact at defect frequency confirmed',
    OuterRace: 'PMI(VIB_ZONE_C, TEMP_ELEVATED, k=1) elevated → sustained vibration with thermal signature confirmed',
    BallFault: 'PMI(VIB_ZONE_B, VIB_ZONE_A, k=1) near-boundary → subtle load variation from ball element defect',
  };

  const actions = {
    InnerRace: ['Schedule immediate bearing replacement','Reduce load by 30% until service','Increase vibration monitoring to 1-minute intervals','Log fault ID for CMMS work order'],
    OuterRace: ['Schedule bearing inspection within 48h','Monitor kurtosis trend — threshold 7.0','Check lubrication schedule compliance','Flag for next planned maintenance window'],
    BallFault: ['Monitor with increased sampling (5-minute intervals)','Schedule bearing inspection within 1 week','Verify load balance across bearing assembly','Document for trend analysis'],
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(2,8,16,0.82)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, backdropFilter:'blur(4px)',
    }} onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:C.panel, border:`1px solid ${C.border2}`, borderRadius:14,
        width:'min(900px,95vw)', maxHeight:'88vh', display:'flex', flexDirection:'column',
        overflow:'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          padding:'16px 24px', borderBottom:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:11,fontFamily:'monospace',color:C.muted}}>{fault.id}</span>
            <Sev s={fault.sev} />
            <FaultTag t={fault.type} />
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', color:C.sub, fontSize:18,
            cursor:'pointer', padding:'0 4px', lineHeight:1,
          }}>✕</button>
        </div>
        {/* Tabs */}
        <div style={{
          display:'flex', borderBottom:`1px solid ${C.border}`,
          flexShrink:0, background:C.surface,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 22px', background:'transparent', border:'none',
              borderBottom: tab===t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              color: tab===t.id ? C.accent : C.sub,
              fontSize:12, fontWeight: tab===t.id ? 700 : 400,
              cursor:'pointer', letterSpacing:'0.04em',
            }}>{t.label}</button>
          ))}
        </div>
        {/* Tab content */}
        <div style={{flex:1, overflow:'auto', padding:24}}>

          {/* PCF Signature */}
          {tab==='pcf' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div>
                <SectionLabel>PSV Radar — Structural Signature</SectionLabel>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                  <PSVRadar psv={fault.faultPsv} normalPsv={fault.normPsv} color={meta.color} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%'}}>
                    <div style={{background:C.panelHi,borderRadius:8,padding:'10px 14px'}}>
                      <div style={{color:C.muted,fontSize:10,marginBottom:3}}>PSV COSINE DIST</div>
                      <div style={{color:meta.color,fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{fault.psvDist.toFixed(4)}</div>
                    </div>
                    <div style={{background:C.panelHi,borderRadius:8,padding:'10px 14px'}}>
                      <div style={{color:C.muted,fontSize:10,marginBottom:3}}>CONFIDENCE</div>
                      <div style={{color:C.accent,fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{(fault.confidence*100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{background:C.surface,borderRadius:8,padding:'10px 14px',width:'100%',fontSize:11,color:C.sub,fontFamily:'monospace'}}>
                    Kernel: LEARNED_DECAY · K(k)=1/(k+1) · k=1..10<br/>
                    σ_k = mean(PMI_k) / (std(PMI_k) + 0.01)
                  </div>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <SectionLabel>Fault Description</SectionLabel>
                  <div style={{background:C.panelHi,borderRadius:8,padding:14,fontSize:12,color:C.sub,lineHeight:1.6,borderLeft:`3px solid ${meta.color}`}}>
                    {meta.desc}
                  </div>
                </div>
                <div>
                  <SectionLabel>Sensor Readings</SectionLabel>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {[
                      {k:'vib_rms', label:'VIB RMS', unit:'g', norm:NORMAL_SENSOR.vib_rms},
                      {k:'kurtosis', label:'KURTOSIS', unit:'', norm:NORMAL_SENSOR.kurtosis},
                      {k:'rpm', label:'RPM', unit:'', norm:NORMAL_SENSOR.rpm},
                      {k:'temp', label:'TEMP', unit:'°C', norm:NORMAL_SENSOR.temp},
                      {k:'current', label:'CURRENT', unit:'A', norm:NORMAL_SENSOR.current},
                    ].map(({k,label,unit,norm}) => {
                      const val = fault.sensor[k];
                      const elevated = val > norm * 1.05;
                      return (
                        <div key={k} style={{background:C.surface,borderRadius:6,padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:10,color:C.muted}}>{label}</span>
                          <span style={{fontSize:12,fontFamily:'monospace',fontWeight:600,color:elevated?C.warn:C.success}}>
                            {val}{unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <SectionLabel>Signal Firing</SectionLabel>
                  <div style={{display:'flex',gap:8}}>
                    {[
                      {id:'a', label:'A: Structural', desc:'PSV cosine dist > 90th pct'},
                      {id:'b', label:'B: Token', desc:'Attack-token fraction > 99th pct'},
                      {id:'c', label:'C: Kurtosis', desc:'Kurtosis > 95th pct'},
                    ].map(sig => {
                      const fired = fault.signals[sig.id];
                      return (
                        <div key={sig.id} style={{
                          flex:1, background: fired ? `${C.success}18` : C.surface,
                          border:`1px solid ${fired ? C.success+'44' : C.border}`,
                          borderRadius:8, padding:'8px 10px',
                        }}>
                          <div style={{fontSize:10,fontWeight:700,color:fired?C.success:C.muted,marginBottom:3}}>{sig.label}</div>
                          <div style={{fontSize:9,color:C.muted}}>{sig.desc}</div>
                          <div style={{fontSize:11,fontWeight:700,color:fired?C.success:C.muted,marginTop:4}}>{fired?'FIRED':'—'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Evidence Chain */}
          {tab==='evidence' && (
            <div>
              <SectionLabel>PSV Component Analysis (k=1..10)</SectionLabel>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:16}}>
                {fault.faultPsv.map((fv, i) => {
                  const nv = fault.normPsv[i];
                  const delta = fv - nv;
                  const maxDelta = 2.0;
                  const barW = Math.min(100, Math.abs(delta)/maxDelta*100);
                  return (
                    <div key={i} style={{background:C.surface,borderRadius:8,padding:'10px 12px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:11}}>
                        <span style={{color:C.muted,fontFamily:'monospace'}}>k={i+1}</span>
                        <div style={{display:'flex',gap:10}}>
                          <span style={{color:meta.color,fontFamily:'monospace'}}>{fv.toFixed(3)}</span>
                          <span style={{color:C.sub,fontFamily:'monospace'}}>{nv.toFixed(3)}</span>
                          <span style={{color:delta>0?C.danger:C.success,fontFamily:'monospace'}}>
                            {delta>0?'+':''}{delta.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      <div style={{background:C.border,borderRadius:2,height:4,overflow:'hidden'}}>
                        <div style={{
                          height:'100%', width:`${barW}%`,
                          background:delta>0?meta.color:C.success,
                          borderRadius:2, transition:'width 0.3s',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <SectionLabel>Classifier Output</SectionLabel>
              <div style={{background:C.surface,borderRadius:8,padding:14,fontFamily:'monospace',fontSize:12}}>
                {[
                  {key:'a', label:'Signal A (PSV Cosine Dist)', desc:`${fault.psvDist.toFixed(4)} > 90th pct threshold`},
                  {key:'b', label:'Signal B (Token Density)', desc:'Attack-token fraction computed across 20 windows'},
                  {key:'c', label:'Signal C (Kurtosis Gate)', desc:`kurtosis=${fault.sensor.kurtosis} vs 95th pct threshold`},
                ].map(sig => (
                  <div key={sig.key} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,padding:'6px 8px',background:C.panelHi,borderRadius:6}}>
                    <span style={{
                      width:60, fontSize:10, fontWeight:700, textAlign:'center', borderRadius:4, padding:'2px 0',
                      background:fault.signals[sig.key]?`${C.success}22`:C.border,
                      color:fault.signals[sig.key]?C.success:C.muted,
                    }}>{fault.signals[sig.key]?'FIRED':'SILENT'}</span>
                    <div>
                      <div style={{color:C.text,fontSize:11}}>{sig.label}</div>
                      <div style={{color:C.muted,fontSize:10}}>{sig.desc}</div>
                    </div>
                  </div>
                ))}
                <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,color:C.accent,fontSize:12,fontWeight:700}}>
                  DECISION: ANOMALY DETECTED (dual-signal OR gate satisfied)
                </div>
              </div>
            </div>
          )}

          {/* Token Stream */}
          {tab==='tokens' && (
            <div>
              <SectionLabel>Token Sequence</SectionLabel>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:20,padding:14,background:C.surface,borderRadius:8}}>
                {fault.tokens.map((tok,i) => {
                  const isFault = tok.includes('ZONE_C') || tok.includes('KURTOSIS_HIGH') || tok.includes('ELEVATED') || tok.includes('ZONE_B');
                  return (
                    <span key={i} style={{
                      background: isFault ? `${meta.color}22` : C.panelHi,
                      color: isFault ? meta.color : C.sub,
                      border: `1px solid ${isFault ? meta.color+'44' : C.border}`,
                      borderRadius:4, padding:'4px 10px', fontSize:11, fontFamily:'monospace',
                      fontWeight: isFault ? 700 : 400,
                    }}>{tok}</span>
                  );
                })}
              </div>
              <SectionLabel>High-PMI Discriminating Pair</SectionLabel>
              <div style={{background:C.surface,borderRadius:8,padding:14,borderLeft:`3px solid ${meta.color}`,fontFamily:'monospace',fontSize:12,color:C.sub,lineHeight:1.7}}>
                {pmiDesc[fault.type]}
              </div>
              <div style={{marginTop:16}}>
                <SectionLabel>PMI Formula</SectionLabel>
                <div style={{background:C.surface,borderRadius:8,padding:14,fontFamily:'monospace',fontSize:11,color:C.muted}}>
                  σ_k = mean(PMI_k) / (std(PMI_k) + ε)<br/>
                  PMI_k(t1,t2) = log[ P(t1,t2,k) / (P(t1)·P(t2)) ]<br/>
                  Kernel K(k) = 1/(k+1), k = 1..10<br/>
                  ε = 0.01
                </div>
              </div>
            </div>
          )}

          {/* Response */}
          {tab==='response' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div>
                <SectionLabel>Recommended Actions</SectionLabel>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                  {(actions[fault.type]||[]).map((action,i) => (
                    <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'8px 10px',background:C.surface,borderRadius:6,fontSize:12,color:C.sub}}>
                      <span style={{color:C.accent,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                      {action}
                    </div>
                  ))}
                </div>
                <SectionLabel>Status</SectionLabel>
                <div style={{display:'flex',gap:8}}>
                  {['OPEN','INVESTIGATING','RESOLVED'].map(s => (
                    <button key={s} onClick={() => onStatusChange(fault.id, s)} style={{
                      flex:1, padding:'8px 0', borderRadius:6, cursor:'pointer',
                      fontSize:11, fontWeight:700, letterSpacing:'0.05em',
                      background: fault.status===s
                        ? (s==='OPEN'?C.danger : s==='INVESTIGATING'?C.amber : C.success)
                        : C.surface,
                      color: fault.status===s ? '#fff' : C.muted,
                      border: `1px solid ${fault.status===s
                        ? (s==='OPEN'?C.danger : s==='INVESTIGATING'?C.amber : C.success)
                        : C.border}`,
                    }}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel>CMMS Export</SectionLabel>
                <pre style={{
                  background:C.surface, borderRadius:8, padding:14,
                  fontSize:10, fontFamily:'monospace', color:C.sub,
                  overflow:'auto', maxHeight:300, lineHeight:1.5,
                }}>
{JSON.stringify({
  fault_id: fault.id,
  timestamp: fault.ts,
  severity: fault.sev,
  fault_type: fault.type,
  equipment_id: fault.eqId,
  status: fault.status,
  pcf_psv_distance: fault.psvDist,
  confidence: fault.confidence,
  signals_fired: fault.signals,
  sensor: fault.sensor,
  windows_analyzed: fault.windows,
  engine: 'PCF v1.4.2',
}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({faults, equipment, sensorHistory, totalSps, onInvestigate}) {
  const openCount = faults.filter(f=>f.status==='OPEN').length;
  const critCount = faults.filter(f=>f.sev==='CRITICAL').length;
  const last24h = faults.filter(f=>(Date.now()-new Date(f.ts).getTime())<86400000).length;
  const spsHistory = equipment
    .filter(e=>e.status==='ONLINE')
    .map(e=>e.sps);
  const recent = faults.slice(0,8);

  return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:20}}>
      {/* Stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        {[
          {label:'Open Faults', value:openCount, color:C.danger, sub:'active'},
          {label:'Critical', value:critCount, color:C.warn, sub:'need attention'},
          {label:'Last 24h', value:last24h, color:C.accent, sub:'total faults'},
          {label:'Samples/sec', value:totalSps.toLocaleString(), color:C.success, sub:'across online eq', sparkVals:spsHistory},
        ].map(card => (
          <Card key={card.label}>
            <SectionLabel>{card.label}</SectionLabel>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
              <div style={{fontSize:28,fontWeight:800,color:card.color,fontFamily:'monospace'}}>{card.value}</div>
              {card.sparkVals && <Sparkline values={card.sparkVals} color={card.color} />}
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{card.sub}</div>
          </Card>
        ))}
      </div>

      {/* Middle row */}
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 1fr',gap:14}}>
        <Card>
          <SectionLabel>24h Fault Timeline</SectionLabel>
          <Timeline faults={faults} width={300} height={80} />
          <div style={{marginTop:10}}>
            <SectionLabel>Live Sensor Feed</SectionLabel>
            <SensorChart history={sensorHistory} width={300} height={60} />
            <div style={{display:'flex',gap:12,marginTop:4,fontSize:10,color:C.muted}}>
              <span style={{color:C.accent}}>— vib_rms</span>
              <span style={{color:C.warn}}>— kurtosis</span>
              <span style={{borderTop:`1px dashed ${C.border2}`,width:16,display:'inline-block',verticalAlign:'middle'}} /> normal
            </div>
          </div>
        </Card>
        <Card>
          <SectionLabel>Fault Type Mix</SectionLabel>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <Donut faults={faults} size={120} />
            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:4}}>
              {Object.entries(FTYPES).map(([type,meta]) => {
                const cnt = faults.filter(f=>f.type===type).length;
                return (
                  <div key={type} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11}}>
                    <span style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:meta.color,display:'inline-block'}} />
                      <span style={{color:C.sub}}>{type}</span>
                    </span>
                    <span style={{color:meta.color,fontFamily:'monospace',fontWeight:700}}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
        <Card>
          <SectionLabel>Equipment Health</SectionLabel>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {equipment.slice(0,4).map(eq => (
              <div key={eq.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <StatusDot s={eq.status} />
                  <div>
                    <div style={{fontSize:12,color:C.text}}>{eq.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{eq.sps.toLocaleString()} sps</div>
                  </div>
                </div>
                {eq.faults > 0 && (
                  <span style={{
                    background:`${C.danger}22`,color:C.danger,
                    fontSize:10,fontWeight:700,borderRadius:4,padding:'2px 6px',
                  }}>{eq.faults}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent faults table */}
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}>
          <SectionLabel>Recent Faults</SectionLabel>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:C.surface}}>
                {['Time','Severity','Type','Equipment','VIB RMS','Confidence','PSV Dist','Status'].map(h=>(
                  <th key={h} style={{padding:'8px 14px',textAlign:'left',color:C.muted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(f=>(
                <tr key={f.id} onClick={()=>onInvestigate(f)}
                  style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.panelHi}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <td style={{padding:'9px 14px',color:C.muted,fontFamily:'monospace',fontSize:10}}>{new Date(f.ts).toLocaleTimeString()}</td>
                  <td style={{padding:'9px 14px'}}><Sev s={f.sev} /></td>
                  <td style={{padding:'9px 14px'}}><FaultTag t={f.type} /></td>
                  <td style={{padding:'9px 14px',color:C.sub,fontFamily:'monospace',fontSize:11}}>{f.eqId}</td>
                  <td style={{padding:'9px 14px',color:C.accent,fontFamily:'monospace'}}>{f.sensor.vib_rms}g</td>
                  <td style={{padding:'9px 14px',color:C.text,fontFamily:'monospace'}}>{(f.confidence*100).toFixed(1)}%</td>
                  <td style={{padding:'9px 14px',color:FTYPES[f.type]?.color,fontFamily:'monospace'}}>{f.psvDist.toFixed(4)}</td>
                  <td style={{padding:'9px 14px'}}>
                    <span style={{
                      fontSize:10,fontFamily:'monospace',fontWeight:700,
                      color:f.status==='OPEN'?C.danger:f.status==='INVESTIGATING'?C.amber:C.success,
                    }}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Faults View ───────────────────────────────────────────────────────────────

function FaultsView({faults, onInvestigate}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtered = faults.filter(f =>
    (statusFilter==='ALL' || f.status===statusFilter) &&
    (typeFilter==='ALL' || f.type===typeFilter)
  );

  return (
    <div style={{padding:24}}>
      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {['ALL','OPEN','INVESTIGATING','RESOLVED'].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} style={{
            padding:'5px 14px', borderRadius:6, border:`1px solid ${statusFilter===s?C.accent:C.border}`,
            background: statusFilter===s ? `${C.accent}18` : 'transparent',
            color: statusFilter===s ? C.accent : C.sub,
            fontSize:11, fontWeight:700, cursor:'pointer',
          }}>{s}</button>
        ))}
        <div style={{width:1,background:C.border,margin:'0 4px'}} />
        {['ALL',...Object.keys(FTYPES)].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)} style={{
            padding:'5px 14px', borderRadius:6,
            border:`1px solid ${typeFilter===t?(FTYPES[t]?.color||C.accent):C.border}`,
            background: typeFilter===t ? `${FTYPES[t]?.color||C.accent}18` : 'transparent',
            color: typeFilter===t ? (FTYPES[t]?.color||C.accent) : C.sub,
            fontSize:11, fontWeight:700, cursor:'pointer',
          }}>{t}</button>
        ))}
      </div>

      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:C.surface}}>
                {['ID','Time','Severity','Type','Equipment','Kurtosis','Confidence','PSV Dist','Status'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',color:C.muted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f=>(
                <tr key={f.id} onClick={()=>onInvestigate(f)}
                  style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.panelHi}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <td style={{padding:'9px 14px',color:C.muted,fontFamily:'monospace',fontSize:10}}>{f.id}</td>
                  <td style={{padding:'9px 14px',color:C.muted,fontFamily:'monospace',fontSize:10}}>{new Date(f.ts).toLocaleTimeString()}</td>
                  <td style={{padding:'9px 14px'}}><Sev s={f.sev} /></td>
                  <td style={{padding:'9px 14px'}}><FaultTag t={f.type} /></td>
                  <td style={{padding:'9px 14px',color:C.sub,fontFamily:'monospace',fontSize:11}}>{f.eqId}</td>
                  <td style={{padding:'9px 14px',color:C.warn,fontFamily:'monospace'}}>{f.sensor.kurtosis}</td>
                  <td style={{padding:'9px 14px',color:C.text,fontFamily:'monospace'}}>{(f.confidence*100).toFixed(1)}%</td>
                  <td style={{padding:'9px 14px',color:FTYPES[f.type]?.color,fontFamily:'monospace'}}>{f.psvDist.toFixed(4)}</td>
                  <td style={{padding:'9px 14px'}}>
                    <span style={{
                      fontSize:10,fontFamily:'monospace',fontWeight:700,
                      color:f.status==='OPEN'?C.danger:f.status==='INVESTIGATING'?C.amber:C.success,
                    }}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Equipment View ────────────────────────────────────────────────────────────

function EquipmentView({equipment, faults}) {
  return (
    <div style={{padding:24}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
        {equipment.map(eq=>{
          const eqFaults = faults.filter(f=>f.eqId===eq.id);
          const openFaults = eqFaults.filter(f=>f.status==='OPEN').length;
          return (
            <Card key={eq.id}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <StatusDot s={eq.status} />
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{eq.name}</span>
                  </div>
                  <div style={{fontSize:11,color:C.muted}}>{eq.type} · {eq.location}</div>
                </div>
                {openFaults > 0 && (
                  <span style={{
                    background:`${C.danger}22`,color:C.danger,border:`1px solid ${C.danger}44`,
                    fontSize:11,fontWeight:700,borderRadius:6,padding:'3px 8px',
                  }}>{openFaults} open</span>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {[
                  {label:'STATUS', value:eq.status, color:eq.status==='ONLINE'?C.success:eq.status==='DEGRADED'?C.amber:C.muted},
                  {label:'SPS', value:eq.sps.toLocaleString(), color:C.accent},
                  {label:'FAULTS', value:eq.faults, color:eq.faults>0?C.danger:C.success},
                  {label:'UPTIME', value:`${eq.uptime}h`, color:C.sub},
                ].map(item=>(
                  <div key={item.label} style={{background:C.surface,borderRadius:6,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:3}}>{item.label}</div>
                    <div style={{fontSize:13,fontWeight:700,fontFamily:'monospace',color:item.color}}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:10,color:C.muted}}>ID: {eq.id}</span>
                <span style={{fontSize:10,color:C.muted,fontFamily:'monospace'}}>v{eq.version}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────

function AnalyticsView() {
  const benchmarks = [
    {type:'Inner Race', f1:0.911, prec:0.891, rec:0.932, color:FTYPES.InnerRace.color},
    {type:'Outer Race', f1:0.819, prec:0.801, rec:0.838, color:FTYPES.OuterRace.color},
    {type:'Ball Fault', f1:0.758, prec:0.741, rec:0.776, color:FTYPES.BallFault.color},
    {type:'Overall',    f1:0.832, prec:null,  rec:null,  color:C.accent, bold:true},
  ];

  return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:20}}>
      {/* CWRU Benchmark */}
      <Card>
        <SectionLabel>CWRU Bearing Dataset — Benchmark Results</SectionLabel>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:C.surface}}>
                {['Fault Type','F1 Score','','Precision','Recall'].map((h,i)=>(
                  <th key={i} style={{padding:'10px 16px',textAlign:i===2?'left':'left',color:C.muted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmarks.map(b=>(
                <tr key={b.type} style={{borderBottom:`1px solid ${C.border}`,fontWeight:b.bold?800:400}}>
                  <td style={{padding:'12px 16px',color:b.color,fontWeight:b.bold?800:600}}>
                    {!b.bold && <span style={{marginRight:8}}>{Object.values(FTYPES).find(f=>f.f1===b.f1)?.icon}</span>}
                    {b.type}
                  </td>
                  <td style={{padding:'12px 16px',fontFamily:'monospace',color:b.color,fontWeight:700}}>{b.f1.toFixed(3)}</td>
                  <td style={{padding:'12px 16px',width:180}}>
                    <div style={{background:C.border,borderRadius:3,height:8,overflow:'hidden'}}>
                      <div style={{
                        height:'100%', width:`${b.f1*100}%`,
                        background: b.f1>=0.85 ? C.success : C.blue,
                        borderRadius:3,
                      }} />
                    </div>
                  </td>
                  <td style={{padding:'12px 16px',fontFamily:'monospace',color:C.sub}}>{b.prec!=null?b.prec.toFixed(3):'—'}</td>
                  <td style={{padding:'12px 16px',fontFamily:'monospace',color:C.sub}}>{b.rec!=null?b.rec.toFixed(3):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Signal effectiveness */}
      <Card>
        <SectionLabel>Signal Effectiveness by Fault Class</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {id:'a', label:'Signal A — Structural', desc:'PSV cosine distance > 90th percentile. Detects all fault classes.', fires:['InnerRace','OuterRace','BallFault'], color:C.accent},
            {id:'b', label:'Signal B — Token Density', desc:'Attack-token fraction > 99th percentile. Strong indicator for severe faults.', fires:['InnerRace'], color:C.warn},
            {id:'c', label:'Signal C — Kurtosis', desc:'Kurtosis > 95th percentile. Confirms impact-type faults.', fires:['InnerRace','OuterRace'], color:C.purple},
          ].map(sig=>(
            <div key={sig.id} style={{background:C.surface,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:700,color:sig.color,marginBottom:6}}>{sig.label}</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10,lineHeight:1.5}}>{sig.desc}</div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {Object.keys(FTYPES).map(type=>{
                  const fires = sig.fires.includes(type);
                  return (
                    <div key={type} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',background:C.panelHi,borderRadius:4}}>
                      <span style={{fontSize:10,color:C.sub}}>{type}</span>
                      <span style={{fontSize:10,fontWeight:700,color:fires?sig.color:C.muted}}>{fires?'FIRES':'—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* PSV Overlay radar */}
      <Card>
        <SectionLabel>PSV Signature Overlay — All Fault Classes vs Normal</SectionLabel>
        <div style={{display:'flex',justifyContent:'center',gap:40,flexWrap:'wrap'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            {/* Combined SVG radar showing all 3 */}
            {(() => {
              const size=260, cx=130, cy=130, R=100, n=10, maxVal=5.5;
              const rings=[0.25,0.5,0.75,1.0];
              function pt(i,v){
                const a=(Math.PI*2*i/n)-Math.PI/2;
                const r=(v/maxVal)*R;
                return [cx+r*Math.cos(a), cy+r*Math.sin(a)];
              }
              function poly(vals){ return vals.map((v,i)=>pt(i,v).join(',')).join(' '); }
              function ringPts(f){ return Array.from({length:n},(_,i)=>pt(i,f*maxVal).join(',')).join(' '); }
              return (
                <svg width={size} height={size}>
                  {rings.map(f=>(
                    <polygon key={f} points={ringPts(f)} fill="none" stroke={C.border2} strokeWidth={0.7} opacity={0.6} />
                  ))}
                  {Array.from({length:n},(_,i)=>{
                    const [x,y]=pt(i,maxVal);
                    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.border2} strokeWidth={0.5} opacity={0.5} />;
                  })}
                  {/* Normal */}
                  <polygon points={poly(NORMAL_PSV)} fill={`${C.blue}15`} stroke={C.blue} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.9} />
                  {/* All 3 fault types */}
                  {Object.entries(FTYPES).map(([type,meta])=>(
                    <polygon key={type} points={poly(meta.psv)} fill={`${meta.color}12`} stroke={meta.color} strokeWidth={1.5} opacity={0.85} />
                  ))}
                  {Array.from({length:n},(_,i)=>{
                    const [x,y]=pt(i,maxVal*1.2);
                    return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={C.muted} fontFamily="monospace">k={i+1}</text>;
                  })}
                </svg>
              );
            })()}
            <div style={{display:'flex',gap:16,fontSize:10,color:C.sub,flexWrap:'wrap',justifyContent:'center'}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:16,height:2,background:C.blue,display:'inline-block'}} />Normal
              </span>
              {Object.entries(FTYPES).map(([t,m])=>(
                <span key={t} style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{width:16,height:2,background:m.color,display:'inline-block'}} />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Reports View ──────────────────────────────────────────────────────────────

function ReportsView({faults}) {
  const open = faults.filter(f=>f.status==='OPEN').length;
  const inv  = faults.filter(f=>f.status==='INVESTIGATING').length;
  const res  = faults.filter(f=>f.status==='RESOLVED').length;
  return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:14}}>
      <Card>
        <SectionLabel>Fault Status Summary</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {label:'Open',          value:open, color:C.danger},
            {label:'Investigating', value:inv,  color:C.amber},
            {label:'Resolved',      value:res,  color:C.success},
          ].map(item=>(
            <div key={item.label} style={{background:C.surface,borderRadius:8,padding:16,textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:800,fontFamily:'monospace',color:item.color}}>{item.value}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{item.label}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionLabel>Fault Type Distribution</SectionLabel>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {Object.entries(FTYPES).map(([type,meta])=>{
            const cnt = faults.filter(f=>f.type===type).length;
            const pct = faults.length > 0 ? (cnt/faults.length)*100 : 0;
            return (
              <div key={type}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                  <span style={{color:meta.color}}>{meta.icon} {type}</span>
                  <span style={{color:C.sub,fontFamily:'monospace'}}>{cnt} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{background:C.border,borderRadius:3,height:6}}>
                  <div style={{height:'100%',width:`${pct}%`,background:meta.color,borderRadius:3}} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>Engine Info</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,fontSize:12,color:C.sub}}>
          {[
            ['Engine','PCF v1.4.2'],['Kernel','LEARNED_DECAY K(k)=1/(k+1)'],
            ['Classifier','Dual-signal OR (A,B,C)'],['Dataset','CWRU Bearing'],
            ['Overall F1','0.832'],['Windows Analyzed','20 per fault'],
          ].map(([k,v])=>(
            <div key={k} style={{background:C.surface,borderRadius:6,padding:'8px 12px'}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{k}</div>
              <div style={{fontFamily:'monospace',color:C.accent}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Settings View ─────────────────────────────────────────────────────────────

function SettingsView() {
  return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:14}}>
      <Card>
        <SectionLabel>Engine Configuration</SectionLabel>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[
            {label:'PCF Kernel',          value:'LEARNED_DECAY'},
            {label:'Lag Window',          value:'k = 1..10'},
            {label:'Signal A Threshold',  value:'PSV dist > 90th pct'},
            {label:'Signal B Threshold',  value:'Token fraction > 99th pct'},
            {label:'Signal C Threshold',  value:'Kurtosis > 95th pct'},
            {label:'Classifier Mode',     value:'Dual-signal OR'},
            {label:'Max Faults (buffer)', value:'100'},
            {label:'Sim Interval',        value:'3500ms'},
          ].map(({label,value})=>(
            <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:C.surface,borderRadius:6}}>
              <span style={{fontSize:12,color:C.sub}}>{label}</span>
              <span style={{fontSize:12,fontFamily:'monospace',color:C.accent}}>{value}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionLabel>Equipment Registry</SectionLabel>
        <div style={{fontSize:12,color:C.muted,marginBottom:8}}>6 equipment units registered</div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {EQUIPMENT_INIT.map(eq=>(
            <div key={eq.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:C.surface,borderRadius:6}}>
              <StatusDot s={eq.status} />
              <span style={{flex:1,fontSize:11,color:C.text}}>{eq.name}</span>
              <span style={{fontSize:10,color:C.muted,fontFamily:'monospace'}}>{eq.id}</span>
              <span style={{fontSize:10,color:C.muted,fontFamily:'monospace'}}>v{eq.version}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────

function App() {
  const [section, setSection] = useState('dashboard');
  const [faults, setFaults] = useState(INIT_FAULTS);
  const [equipment, setEquipment] = useState(EQUIPMENT_INIT);
  const [selected, setSelected] = useState(null);
  const [sensorHistory, setSensorHistory] = useState(
    Array.from({length:30}, () => ({
      vib_rms: 1.75 + (Math.random()-0.5)*0.3,
      kurtosis: 3.0 + (Math.random()-0.5)*0.4,
    }))
  );

  // Fault simulation loop
  useEffect(() => {
    let seed = Date.now();
    const interval = setInterval(() => {
      seed += 137;
      const newFault = genFault(seed, 0);
      setFaults(prev => [newFault, ...prev].slice(0, 100));
      setEquipment(prev => prev.map(eq =>
        eq.id === newFault.eqId ? {...eq, faults: eq.faults+1} : eq
      ));
      setEquipment(prev => prev.map(eq =>
        eq.status === 'ONLINE' ? {...eq, sps: Math.max(100, eq.sps + Math.floor((Math.random()-0.5)*80))} : eq
      ));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Sensor history loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorHistory(prev => {
        const next = [...prev.slice(1), {
          vib_rms: NORMAL_SENSOR.vib_rms + (Math.random()-0.5)*0.4,
          kurtosis: NORMAL_SENSOR.kurtosis + (Math.random()-0.5)*0.6,
        }];
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const openCount = faults.filter(f => f.status === 'OPEN').length;
  const critCount = faults.filter(f => f.sev === 'CRITICAL').length;
  const totalSps = equipment.filter(e => e.status === 'ONLINE').reduce((s,e) => s+e.sps, 0);

  function handleStatusChange(id, status) {
    setFaults(prev => prev.map(f => f.id === id ? {...f, status} : f));
    setSelected(prev => prev && prev.id === id ? {...prev, status} : prev);
  }

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:C.bg,color:C.text,fontFamily:'system-ui,sans-serif'}}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:${C.surface}; }
        ::-webkit-scrollbar-thumb { background:${C.border2}; border-radius:3px; }
        * { box-sizing:border-box; }
      `}</style>
      <Sidebar active={section} onNav={setSection} openCount={openCount} liveCount={totalSps.toLocaleString()} />
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <TopBar section={section} critCount={critCount} />
        <div style={{flex:1,overflow:'auto'}}>
          {section==='dashboard'  && <Dashboard faults={faults} equipment={equipment} sensorHistory={sensorHistory} totalSps={totalSps} onInvestigate={setSelected} />}
          {section==='faults'     && <FaultsView faults={faults} onInvestigate={setSelected} />}
          {section==='equipment'  && <EquipmentView equipment={equipment} faults={faults} />}
          {section==='analytics'  && <AnalyticsView />}
          {section==='reports'    && <ReportsView faults={faults} />}
          {section==='settings'   && <SettingsView />}
        </div>
      </div>
      {selected && (
        <FaultInvestigator
          fault={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
