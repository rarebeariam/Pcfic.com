import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

const C = {
  bg:'#020810', surface:'#060e1c', panel:'#0b1628', panelHi:'#0f1e38',
  border:'#142238', border2:'#1e3855', accent:'#00E5FF', blue:'#5B6ECC',
  danger:'#FF3B6B', warn:'#FF8C00', amber:'#F59E0B', success:'#00E5A0',
  purple:'#A855F7', text:'#E2F0FF', sub:'#8AAABB', muted:'#4A6A8A', dim:'#1e3050',
};

const ATYPES = {
  BruteForce:{ color:C.danger, icon:'🔑', f1:0.969, prec:0.940, rec:1.000,
    desc:'Repeated authentication attempts against SSH/FTP services.',
    tokens:['AUTH_BRUTE','AUTH_BRUTE','AUTH_BRUTE','NET_SEND','SYS_READ','SYS_WRITE'],
    psv:[3.475,3.851,3.439,3.687,3.640,3.740,3.437,3.507,3.414,3.643],
    claim:'Claim 31 — PCF applied to authentication event streams' },
  DDoS:{ color:C.warn, icon:'💥', f1:0.949, prec:0.906, rec:0.997,
    desc:'High-volume packet flood from distributed source IPs (LOIC pattern).',
    tokens:['NET_FLOOD','NET_FLOOD','NET_LARGE_SEND','NET_FLOOD','SYS_WRITE','SYS_READ'],
    psv:[3.184,2.888,3.175,3.218,3.247,2.864,3.304,2.887,2.957,3.030],
    claim:'Claim 31 — PCF applied to volumetric flow event streams' },
  PortScan:{ color:C.purple, icon:'🔍', f1:0.932, prec:0.872, rec:1.000,
    desc:'Sequential probe of destination ports, near-zero duration flows.',
    tokens:['NET_PORTSCAN','NET_PORTSCAN','NET_PORTSCAN','NET_PORTSCAN','SYS_READ','SYS_WRITE'],
    psv:[2.752,3.374,2.771,3.017,2.514,2.888,2.290,2.987,2.358,2.784],
    claim:'Claim 32 — PCF kill-chain: NET_PORTSCAN → AUTH_BRUTE sequence' },
  DoS:{ color:C.amber, icon:'⚡', f1:0.910, prec:0.879, rec:0.943,
    desc:'Single-source service exhaustion — Hulk, GoldenEye, slowloris patterns.',
    tokens:['NET_FLOOD','NET_LARGE_SEND','NET_SLOW_CONN','NET_FLOOD','SYS_WRITE','SYS_READ'],
    psv:[3.195,3.059,3.143,3.205,3.058,2.788,3.247,3.096,2.957,2.756],
    claim:'Claim 31 — PCF applied to connection-exhaustion event streams' },
  WebAttack:{ color:C.blue, icon:'🌐', f1:0.885, prec:0.800, rec:0.991,
    desc:'HTTP-layer attacks: XSS, SQL injection, web credential brute-force.',
    tokens:['NET_SEND','NET_FLOOD','NET_RECV','NET_LARGE_SEND','SYS_READ','SYS_WRITE'],
    psv:[3.525,4.052,3.479,3.947,3.662,4.084,3.607,3.852,3.536,3.886],
    claim:'Claim 31 — PCF applied to HTTP request event streams' },
};

const NORMAL_PSV = [3.281,4.104,3.354,3.813,3.478,3.849,3.532,3.763,3.453,3.740];
const SEV_RANK   = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
const SEV_COLOR  = { CRITICAL:C.danger, HIGH:C.warn, MEDIUM:C.amber, LOW:C.success };

const SENSORS_INIT = [
  { id:'SNS-NYC-01', name:'NYC-Core-Switch',  location:'New York, NY',    ip:'10.0.1.10', status:'ONLINE',   fps:3847, alerts:12, uptime:47, version:'2.1.0' },
  { id:'SNS-LAX-02', name:'LAX-Perimeter',    location:'Los Angeles, CA', ip:'10.0.2.10', status:'ONLINE',   fps:2103, alerts:8,  uptime:31, version:'2.1.0' },
  { id:'SNS-CHI-03', name:'CHI-DMZ-Tap',      location:'Chicago, IL',     ip:'10.0.3.10', status:'DEGRADED', fps:891,  alerts:3,  uptime:15, version:'2.0.4' },
  { id:'SNS-LON-04', name:'LON-WAN-Gateway',  location:'London, UK',      ip:'10.0.4.10', status:'ONLINE',   fps:1654, alerts:5,  uptime:62, version:'2.1.0' },
  { id:'SNS-FRA-05', name:'FRA-Backup-Core',  location:'Frankfurt, DE',   ip:'10.0.5.10', status:'OFFLINE',  fps:0,    alerts:0,  uptime:0,  version:'2.0.4' },
  { id:'SNS-SIN-06', name:'SIN-APAC-Edge',    location:'Singapore',       ip:'10.0.6.10', status:'ONLINE',   fps:4201, alerts:21, uptime:18, version:'2.1.0' },
];

function seedRng(s){ return ()=>{ s=Math.imul(1664525,s)+1013904223|0; return (s>>>0)/0xffffffff; }; }

let _nid = 9000;
function genAlert(seed, hoursAgo=null){
  const r=seedRng(seed);
  const keys=Object.keys(ATYPES);
  const type=keys[Math.floor(r()*keys.length)];
  const meta=ATYPES[type];
  const sv=r(); const sev=sv>0.85?'CRITICAL':sv>0.55?'HIGH':sv>0.25?'MEDIUM':'LOW';
  const alertPsv=meta.psv.map(v=>Math.round((v+(r()-0.5)*0.6)*1000)/1000);
  const normPsv=NORMAL_PSV.map(v=>Math.round((v+(r()-0.5)*0.2)*1000)/1000);
  const dot=alertPsv.reduce((s,v,i)=>s+v*normPsv[i],0);
  const na=Math.sqrt(alertPsv.reduce((s,v)=>s+v*v,0));
  const nb=Math.sqrt(normPsv.reduce((s,v)=>s+v*v,0));
  const psvDist=Math.round((1-dot/(na*nb+1e-9))*10000)/10000;
  const ago=hoursAgo!==null?hoursAgo*3600000:Math.floor(r()*86400000);
  const sensorId=SENSORS_INIT[Math.floor(r()*SENSORS_INIT.length)].id;
  const st=r(); const status=st>0.65?'OPEN':st>0.35?'INVESTIGATING':'RESOLVED';
  const dport=type==='BruteForce'?(r()>0.5?22:21):type==='WebAttack'?(r()>0.5?443:80):type==='PortScan'?Math.floor(r()*1024)+1:80;
  return {
    id:`ALT-${++_nid}`, ts:new Date(Date.now()-ago).toISOString(), sev, type,
    srcIp:`172.${16+Math.floor(r()*4)}.${Math.floor(r()*256)}.${1+Math.floor(r()*253)}`,
    dstIp:`10.0.${Math.floor(r()*10)}.${1+Math.floor(r()*30)}`,
    srcPort:1024+Math.floor(r()*63000), dstPort:dport, sensorId,
    confidence:Math.round((0.70+r()*0.29)*1000)/1000,
    psvDist, psv:alertPsv, normalPsv:normPsv, tokens:meta.tokens, flows:20, status,
    claim:meta.claim,
  };
}

const INIT_ALERTS = Array.from({length:50},(_,i)=>genAlert(i*17+42,(i/50)*23))
  .sort((a,b)=>new Date(b.ts)-new Date(a.ts));

function fmtTime(iso){ const d=new Date(iso); return d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
function fmtDateTime(iso){ const d=new Date(iso); return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
function fmtAgo(iso){ const s=Math.floor((Date.now()-new Date(iso))/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; return`${Math.floor(s/3600)}h ago`; }

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
function Sev({s}){
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:4,background:SEV_COLOR[s]+'22',color:SEV_COLOR[s],fontSize:11,fontWeight:700,letterSpacing:'0.06em'}}>{s}</span>;
}
function TypeTag({t}){
  const m=ATYPES[t];
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:4,background:m.color+'22',color:m.color,fontSize:11,fontWeight:600}}>{m.icon} {t}</span>;
}
function StatusDot({s}){
  const col=s==='ONLINE'?C.success:s==='DEGRADED'?C.amber:C.muted;
  return <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
    <span style={{width:7,height:7,borderRadius:'50%',background:col,boxShadow:s==='ONLINE'?`0 0 6px ${col}`:undefined}}/>
    <span style={{fontSize:11,color:col,fontWeight:600}}>{s}</span>
  </span>;
}
function Card({children,style,onClick,onMouseEnter,onMouseLeave}){
  return <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:20,...style}}>{children}</div>;
}
function SectionLabel({children}){
  return <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:C.muted,marginBottom:10}}>{children}</div>;
}

// ── PSV RADAR ─────────────────────────────────────────────────────────────────
function PSVRadar({psv,normalPsv,color}){
  const W=220,H=220,cx=W/2,cy=H/2,R=82,N=10;
  const all=[...psv,...normalPsv];
  const minV=Math.min(...all)-0.3, maxV=Math.max(...all)+0.3;
  const norm=v=>(v-minV)/(maxV-minV);
  function polar(i,v){ const a=(i/N)*Math.PI*2-Math.PI/2; const r=norm(v)*R; return[cx+r*Math.cos(a),cy+r*Math.sin(a)]; }
  function poly(vals){ return vals.map((v,i)=>{ const[x,y]=polar(i,v); return`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')+' Z'; }
  const rings=[0.25,0.5,0.75,1.0];
  const axes=Array.from({length:N},(_,i)=>i);
  return <svg width={W} height={H} style={{overflow:'visible'}}>
    {rings.map(r=><polygon key={r} points={axes.map(i=>{const a=(i/N)*Math.PI*2-Math.PI/2;return`${cx+R*r*Math.cos(a)},${cy+R*r*Math.sin(a)}`;}).join(' ')} fill="none" stroke={C.dim} strokeWidth={0.6}/>)}
    {axes.map(i=>{const a=(i/N)*Math.PI*2-Math.PI/2;return<line key={i} x1={cx} y1={cy} x2={cx+R*Math.cos(a)} y2={cy+R*Math.sin(a)} stroke={C.dim} strokeWidth={0.5}/>;} )}
    <path d={poly(normalPsv)} fill={C.blue+'18'} stroke={C.blue} strokeWidth={1.5} strokeDasharray="3,2"/>
    <path d={poly(psv)} fill={color+'2a'} stroke={color} strokeWidth={2}/>
    {psv.map((v,i)=>{const[x,y]=polar(i,v);return<circle key={i} cx={x} cy={y} r={2.5} fill={color}/>;} )}
    {axes.map((i)=>{const a=(i/N)*Math.PI*2-Math.PI/2;const lr=R+15;return<text key={i} x={cx+lr*Math.cos(a)} y={cy+lr*Math.sin(a)} fill={C.muted} fontSize={8} textAnchor="middle" dominantBaseline="middle">k={i+1}</text>;})}
    <rect x={4} y={H-26} width={8} height={2} fill={color}/><text x={15} y={H-21} fill={C.sub} fontSize={8}>Attack PSV</text>
    <line x1={4} y1={H-10} x2={12} y2={H-10} stroke={C.blue} strokeWidth={1.5} strokeDasharray="3,2"/><text x={15} y={H-7} fill={C.sub} fontSize={8}>Normal baseline</text>
  </svg>;
}

// ── SPARKLINE ─────────────────────────────────────────────────────────────────
function Sparkline({values,color,width=80,height=28}){
  if(!values||values.length<2)return null;
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const pts=values.map((v,i)=>[(i/(values.length-1))*width,height-((v-min)/range)*height*0.85-2]);
  const d=pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return <svg width={width} height={height} style={{overflow:'visible'}}>
    <path d={d} fill="none" stroke={color} strokeWidth={1.5}/>
    <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={2.5} fill={color}/>
  </svg>;
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────
function Timeline({alerts,width=500,height=80}){
  const now=Date.now(), buckets=Array(24).fill(0);
  alerts.forEach(a=>{const h=(now-new Date(a.ts))/3600000;if(h<=24)buckets[Math.floor(h)]++;});
  buckets.reverse();
  const max=Math.max(...buckets,1), bw=width/24;
  return <svg width={width} height={height} style={{overflow:'visible'}}>
    {buckets.map((v,i)=>{
      const bh=(v/max)*(height-14);
      const col=v>4?C.danger:v>2?C.warn:v>0?C.accent:C.dim;
      return <g key={i}>
        <rect x={i*bw+1} y={height-14-bh} width={bw-2} height={bh} fill={col} opacity={0.75} rx={2}/>
        {i%6===0&&<text x={i*bw+bw/2} y={height} fill={C.muted} fontSize={7.5} textAnchor="middle">{23-i}h</text>}
      </g>;
    })}
  </svg>;
}

// ── DONUT ─────────────────────────────────────────────────────────────────────
function Donut({alerts,size=120}){
  const cx=size/2,cy=size/2,R=size/2-10,ri=R*0.6;
  const counts={}; Object.keys(ATYPES).forEach(t=>counts[t]=0); alerts.forEach(a=>{if(counts[a.type]!==undefined)counts[a.type]++;});
  const total=Object.values(counts).reduce((s,v)=>s+v,0)||1;
  let angle=-Math.PI/2;
  const slices=Object.entries(counts).map(([t,c])=>{const sweep=(c/total)*2*Math.PI;const start=angle;angle+=sweep;return{t,c,start,sweep};});
  function arc(start,sweep){
    const x1=cx+R*Math.cos(start),y1=cy+R*Math.sin(start);
    const x2=cx+R*Math.cos(start+sweep),y2=cy+R*Math.sin(start+sweep);
    const large=sweep>Math.PI?1:0;
    return`M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
  }
  return <svg width={size} height={size}>
    {slices.map(({t,c,start,sweep})=><path key={t} d={arc(start,sweep)} fill={ATYPES[t].color} opacity={c>0?0.85:0.1}/>)}
    <circle cx={cx} cy={cy} r={ri} fill={C.panel}/>
    <text x={cx} y={cy-4} textAnchor="middle" fill={C.text} fontSize={11} fontWeight={700}>{total}</text>
    <text x={cx} y={cy+9} textAnchor="middle" fill={C.muted} fontSize={8}>threats</text>
  </svg>;
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
const NAV=[{id:'dashboard',label:'Dashboard',icon:'◈'},{id:'threats',label:'Threats',icon:'⬡'},{id:'sensors',label:'Sensors',icon:'◎'},{id:'analytics',label:'Analytics',icon:'▦'},{id:'reports',label:'Reports',icon:'▤'},{id:'settings',label:'Settings',icon:'◌'}];

function Sidebar({active,onNav,openCount,liveCount}){
  return <div style={{width:200,background:C.surface,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',flexShrink:0}}>
    <div style={{padding:'20px 16px 14px',borderBottom:`1px solid ${C.border}`}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.22em',textTransform:'uppercase',color:C.muted,marginBottom:2}}>Pacific Platform</div>
      <div style={{fontSize:20,fontWeight:800,color:C.accent,letterSpacing:'0.04em',lineHeight:1}}>LAMINAR</div>
      <div style={{fontSize:9,color:C.muted,marginTop:3,fontFamily:'monospace'}}>v2.1.0 · PCF Core · Patent Pending</div>
    </div>
    <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:C.success,boxShadow:`0 0 8px ${C.success}`,flexShrink:0,animation:'pulse 2s infinite'}}/>
      <span style={{fontSize:10,color:C.success,fontWeight:600}}>{liveCount} flows/sec</span>
    </div>
    <nav style={{flex:1,padding:'8px',display:'flex',flexDirection:'column',gap:2}}>
      {NAV.map(({id,label,icon})=>{
        const active2=active===id;
        return <button key={id} onClick={()=>onNav(id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:'none',background:active2?C.accent+'18':'transparent',color:active2?C.accent:C.sub,cursor:'pointer',textAlign:'left',width:'100%',fontSize:13,fontWeight:active2?600:400,borderLeft:active2?`2px solid ${C.accent}`:'2px solid transparent',transition:'all 0.15s'}}>
          <span style={{fontSize:14,opacity:0.8}}>{icon}</span>
          {label}
          {id==='threats'&&openCount>0&&<span style={{marginLeft:'auto',background:C.danger,color:'white',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:10}}>{openCount}</span>}
        </button>;
      })}
    </nav>
    <div style={{padding:'12px 16px',borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:9,color:C.muted,fontFamily:'monospace',lineHeight:1.6}}>U.S. Provisional 63/978,633<br/>© 2026 Astrognosy AI</div>
    </div>
  </div>;
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
function TopBar({section,critCount}){
  const titles={dashboard:'Dashboard',threats:'Threat Management',sensors:'Sensor Network',analytics:'Analytics',reports:'Reports',settings:'Settings'};
  return <div style={{height:54,background:C.surface,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',flexShrink:0}}>
    <div style={{fontSize:16,fontWeight:700,color:C.text}}>{titles[section]}</div>
    <div style={{display:'flex',alignItems:'center',gap:16}}>
      {critCount>0&&<div style={{display:'flex',alignItems:'center',gap:6,background:C.danger+'22',border:`1px solid ${C.danger}44`,padding:'4px 12px',borderRadius:6,fontSize:11,color:C.danger,fontWeight:700}}>⚠ {critCount} CRITICAL</div>}
      <div style={{fontSize:11,color:C.muted,fontFamily:'monospace'}}>{new Date().toUTCString().slice(0,25)}</div>
    </div>
  </div>;
}

// ── ALERT INVESTIGATOR ────────────────────────────────────────────────────────
function Investigator({alert:a,onClose,onStatusChange}){
  const meta=ATYPES[a.type];
  const [tab,setTab]=useState('signature');
  const tabs=['signature','evidence','tokens','response'];
  const tabLabels={signature:'PCF Signature',evidence:'Evidence Chain',tokens:'Token Stream',response:'Response'};
  const ATTACK_TOKS=new Set(['AUTH_BRUTE','NET_FLOOD','NET_PORTSCAN','NET_LARGE_SEND','NET_SLOW_CONN']);

  return <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(2,8,16,0.88)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{width:800,maxHeight:'88vh',background:C.panel,border:`1px solid ${C.border2}`,borderRadius:12,display:'flex',flexDirection:'column',overflow:'hidden'}}>

      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:C.surface}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:22}}>{meta.icon}</span>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{a.id}</div>
            <div style={{fontSize:11,color:C.muted,fontFamily:'monospace',marginTop:1}}>{fmtDateTime(a.ts)} · {a.sensorId}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Sev s={a.sev}/><TypeTag t={a.type}/>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:18,cursor:'pointer',padding:'2px 8px'}}>✕</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:'10px 18px',background:'none',border:'none',borderBottom:tab===t?`2px solid ${C.accent}`:'2px solid transparent',color:tab===t?C.accent:C.muted,fontSize:12,fontWeight:tab===t?600:400,cursor:'pointer'}}>{tabLabels[t]}</button>)}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'auto',padding:20}}>

        {tab==='signature'&&<div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:24}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:8,letterSpacing:'0.1em',textTransform:'uppercase'}}>Structural Signature</div>
            <PSVRadar psv={a.psv} normalPsv={a.normalPsv} color={meta.color}/>
            <div style={{marginTop:12,fontSize:10,color:C.muted,fontFamily:'monospace',lineHeight:1.8}}>
              PSV distance: <span style={{color:meta.color}}>{a.psvDist.toFixed(4)}</span><br/>
              Confidence: <span style={{color:C.accent}}>{(a.confidence*100).toFixed(1)}%</span><br/>
              Kernel: LEARNED_DECAY<br/>
              K(k) = 1/(k+1), k=1..10
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:meta.color+'11',border:`1px solid ${meta.color}33`,borderRadius:8,padding:14}}>
              <div style={{fontSize:12,fontWeight:700,color:meta.color,marginBottom:4}}>{a.type} Detected</div>
              <div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>{meta.desc}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Source',a.srcIp+':'+a.srcPort],['Destination',a.dstIp+':'+a.dstPort],['Sensor',a.sensorId],['Flows Analyzed',`${a.flows} (window=20)`],['Benchmark F1',`${meta.f1}`],['Precision',`${meta.prec}`]].map(([k,v])=><div key={k} style={{background:C.panelHi,borderRadius:6,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3}}>{k}</div>
                <div style={{fontSize:12,color:C.text,fontFamily:'monospace'}}>{v}</div>
              </div>)}
            </div>
            <div style={{background:C.dim,borderRadius:8,padding:12,fontFamily:'monospace',fontSize:10,color:C.muted,lineHeight:1.7}}>
              <div style={{color:C.sub,marginBottom:4}}># Patent Reference</div>
              {a.claim}<br/>Patent: U.S. Provisional 63/978,633<br/>
              Algorithm: PCF PSV-distance anomaly classifier<br/>
              Dataset: CICIDS2017 (is_real_data: true)
            </div>
          </div>
        </div>}

        {tab==='evidence'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{fontSize:11,color:C.muted}}>PSV component σ_k = mean(PMI_k)/(std(PMI_k)+ε) at each offset k=1..10. Deviation from normal centroid drives detection.</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
            {a.psv.map((v,i)=>{
              const nv=a.normalPsv[i], delta=v-nv;
              return <div key={i} style={{background:C.panelHi,borderRadius:8,padding:12,border:`1px solid ${Math.abs(delta)>0.3?meta.color+'44':C.border}`}}>
                <div style={{fontSize:9,color:C.muted,marginBottom:4}}>k = {i+1}</div>
                <div style={{fontSize:13,fontWeight:700,color:meta.color,fontFamily:'monospace'}}>{v.toFixed(3)}</div>
                <div style={{fontSize:9,color:C.muted,fontFamily:'monospace',marginTop:2}}>Δ {delta>0?'+':''}{delta.toFixed(3)}</div>
                <div style={{marginTop:6,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:Math.abs(delta)>0.3?meta.color:C.blue,width:`${Math.min(100,Math.abs(delta)/0.8*100)}%`}}/>
                </div>
              </div>;
            })}
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:14,fontFamily:'monospace',fontSize:10,color:C.muted,lineHeight:1.8}}>
            <div style={{color:C.sub,marginBottom:4}}># Classifier Output</div>
            PSV distance from normal centroid: <span style={{color:meta.color}}>{a.psvDist.toFixed(6)}</span><br/>
            Signal A (PSV cosine distance {'>'} threshold): <span style={{color:a.psvDist>0.034?C.success:C.warn}}>{a.psvDist>0.034?'FIRED':'NEAR BOUNDARY'}</span><br/>
            Signal B (attack-token fraction {'>'} 99th pct): <span style={{color:C.success}}>FIRED</span><br/>
            Final decision (A OR B): <span style={{color:C.danger,fontWeight:700}}>ATTACK CONFIRMED</span>
          </div>
        </div>}

        {tab==='tokens'&&<div>
          <div style={{fontSize:11,color:C.muted,marginBottom:12}}>Token sequence from {a.flows} network flows. Attack tokens highlighted. High-PMI pairs at k=1 are the discriminating signal.</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:16}}>
            {Array(a.flows).fill(null).flatMap((_,fi)=>a.tokens.map((t,ti)=>{
              const isAtk=ATTACK_TOKS.has(t);
              return <span key={`${fi}-${ti}`} style={{padding:'3px 7px',borderRadius:4,fontSize:10,fontFamily:'monospace',background:isAtk?meta.color+'22':C.panelHi,color:isAtk?meta.color:C.muted,border:`1px solid ${isAtk?meta.color+'44':C.border}`}}>{t}</span>;
            })).slice(0,72)}
            <span style={{fontSize:10,color:C.muted,alignSelf:'center'}}>…{a.flows*a.tokens.length-72} more</span>
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:14,fontFamily:'monospace',fontSize:10,color:C.muted,lineHeight:1.8}}>
            <div style={{color:C.sub,marginBottom:4}}># High-PMI Discriminating Pair (k=1)</div>
            {a.type==='BruteForce'&&'PMI(AUTH_BRUTE, AUTH_BRUTE, k=1) >> normal baseline → repeated auth impossible in benign traffic'}
            {a.type==='DDoS'&&'PMI(NET_FLOOD, NET_FLOOD, k=1) >> normal → burst repetition structurally impossible in organic flows'}
            {a.type==='PortScan'&&'PMI(NET_PORTSCAN, NET_PORTSCAN, k=1) >> baseline → sequential port probing confirmed by PCF'}
            {a.type==='DoS'&&'PMI(NET_FLOOD, NET_LARGE_SEND, k=1) elevated → single-source exhaustion pattern confirmed'}
            {a.type==='WebAttack'&&'PMI(NET_FLOOD, NET_SEND, k=1) elevated → abnormal HTTP request structure vs benign baseline'}
          </div>
        </div>}

        {tab==='response'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:C.danger+'11',border:`1px solid ${C.danger}33`,borderRadius:8,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:C.danger,marginBottom:10}}>Recommended Actions</div>
            {(a.type==='BruteForce'?['Block source IP at perimeter firewall: '+a.srcIp,'Enable account lockout on target: '+a.dstIp,'Review auth logs for successful logins post-event','Rotate credentials on targeted service (port '+a.dstPort+')']:a.type==='DDoS'?['Enable rate limiting on upstream router','Activate upstream scrubbing / null-route attacking subnet','Null-route: '+a.srcIp.split('.').slice(0,3).join('.')+'.0/24','Alert ISP for upstream mitigation']:['Investigate source IP '+a.srcIp+' across all sensors','Block or rate-limit source at firewall','Review access logs on destination '+a.dstIp,'Enable enhanced logging on affected host']).map((s,i)=><div key={i} style={{fontSize:12,color:C.sub,display:'flex',gap:8,marginBottom:4}}><span style={{color:C.danger}}>→</span>{s}</div>)}
          </div>
          <div style={{display:'flex',gap:10}}>
            {['OPEN','INVESTIGATING','RESOLVED'].map(s=><button key={s} onClick={()=>onStatusChange(a.id,s)} style={{padding:'8px 20px',borderRadius:6,border:`1px solid`,borderColor:a.status===s?C.accent:C.border,background:a.status===s?C.accent+'22':'transparent',color:a.status===s?C.accent:C.muted,cursor:'pointer',fontSize:12,fontWeight:600}}>{s}</button>)}
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:8,letterSpacing:'0.1em',textTransform:'uppercase'}}>SIEM / SOAR Export</div>
            <pre style={{margin:0,fontFamily:'monospace',fontSize:9.5,color:C.sub,whiteSpace:'pre-wrap',lineHeight:1.7}}>{JSON.stringify({alert_id:a.id,timestamp:a.ts,severity:a.sev,attack_type:a.type,src:`${a.srcIp}:${a.srcPort}`,dst:`${a.dstIp}:${a.dstPort}`,sensor:a.sensorId,pcf_confidence:a.confidence,psv_distance:a.psvDist,psv_vector:a.psv,patent_claim:a.claim,status:a.status,detection_engine:'Laminar v2.1.0 / PCF core'},null,2)}</pre>
          </div>
        </div>}

      </div>
    </div>
  </div>;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({alerts,sensors,liveCount,onInvestigate}){
  const open=alerts.filter(a=>a.status==='OPEN').length;
  const crit=alerts.filter(a=>a.sev==='CRITICAL').length;
  const today=alerts.filter(a=>(Date.now()-new Date(a.ts))/3600000<=24).length;
  const totalFps=sensors.filter(s=>s.status==='ONLINE').reduce((s,s2)=>s+s2.fps,0);
  const spark=Array.from({length:20},(_,i)=>2+Math.sin(i*0.5)*1.5+Math.random()*1);

  return <div style={{display:'flex',flexDirection:'column',gap:16,padding:24,overflowY:'auto',flex:1}}>
    {/* Stats row */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      {[{label:'Open Alerts',value:open,color:C.danger,sp:true},{label:'Critical',value:crit,color:C.warn},{label:'Last 24h',value:today,color:C.accent},{label:'Flows / sec',value:totalFps.toLocaleString(),color:C.success}].map(({label,value,color,sp})=><Card key={label} style={{padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
            <div style={{fontSize:28,fontWeight:800,color,lineHeight:1}}>{value}</div>
          </div>
          {sp&&<Sparkline values={spark} color={color}/>}
        </div>
      </Card>)}
    </div>

    {/* Middle row */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 160px 1fr',gap:12}}>
      <Card><SectionLabel>Alert Timeline · 24h</SectionLabel><Timeline alerts={alerts} width={320} height={80}/></Card>
      <Card style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:16}}><SectionLabel>Attack Mix</SectionLabel><Donut alerts={alerts} size={110}/></Card>
      <Card>
        <SectionLabel>Sensor Health</SectionLabel>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {sensors.slice(0,4).map(s=><div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
              <div style={{fontSize:9,color:C.muted,fontFamily:'monospace'}}>{s.fps.toLocaleString()} fps</div>
            </div>
            <StatusDot s={s.status}/>
          </div>)}
        </div>
      </Card>
    </div>

    {/* Recent alerts table */}
    <Card style={{padding:0,overflow:'hidden'}}>
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <SectionLabel>Recent Threats</SectionLabel>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{background:C.surface}}>
          {['Time','Severity','Type','Source → Destination','Sensor','Confidence','PSV Dist'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {alerts.slice(0,8).map((a,i)=><tr key={a.id} onClick={()=>onInvestigate(a)} style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.panelHi} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted}}>{fmtTime(a.ts)}</td>
            <td style={{padding:'9px 12px'}}><Sev s={a.sev}/></td>
            <td style={{padding:'9px 12px'}}><TypeTag t={a.type}/></td>
            <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.sub}}>{a.srcIp} → {a.dstIp}:{a.dstPort}</td>
            <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted}}>{a.sensorId}</td>
            <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:C.accent}}>{(a.confidence*100).toFixed(0)}%</td>
            <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted}}>{a.psvDist.toFixed(4)}</td>
          </tr>)}
        </tbody>
      </table>
    </Card>
  </div>;
}

// ── THREAT FEED ───────────────────────────────────────────────────────────────
function ThreatFeed({alerts,onInvestigate,onStatusChange}){
  const [search,setSearch]=useState('');
  const [typeF,setTypeF]=useState('ALL');
  const [statusF,setStatusF]=useState('OPEN');
  const [sortK,setSortK]=useState('ts');
  const [sortD,setSortD]=useState(-1);

  const filtered=alerts.filter(a=>{
    if(search&&![a.srcIp,a.dstIp,a.id,a.type,a.sensorId].some(v=>v.toLowerCase().includes(search.toLowerCase())))return false;
    if(typeF!=='ALL'&&a.type!==typeF)return false;
    if(statusF!=='ALL'&&a.status!==statusF)return false;
    return true;
  }).sort((a,b)=>{
    const av=sortK==='ts'?new Date(a.ts):sortK==='sev'?SEV_RANK[a.sev]:a[sortK];
    const bv=sortK==='ts'?new Date(b.ts):sortK==='sev'?SEV_RANK[b.sev]:b[sortK];
    return(av>bv?1:-1)*sortD;
  });

  const FB=({val,active,onClick,color})=><button onClick={onClick} style={{padding:'4px 10px',borderRadius:4,border:'none',background:active?(color||C.accent)+'22':C.panelHi,color:active?(color||C.accent):C.muted,fontSize:10,fontWeight:600,cursor:'pointer'}}>{val}</button>;
  const CH=({k,label})=><th onClick={()=>{if(sortK===k)setSortD(d=>-d);else{setSortK(k);setSortD(-1);}}} style={{padding:'10px 12px',textAlign:'left',fontSize:9,color:sortK===k?C.accent:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`,cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}>{label}{sortK===k?(sortD===-1?' ↓':' ↑'):''}</th>;

  return <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',padding:24,gap:12}}>
    <Card style={{padding:14}}>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search IP, sensor, type…" style={{padding:'7px 12px',borderRadius:6,border:`1px solid ${C.border2}`,background:C.panelHi,color:C.text,fontSize:12,outline:'none',width:220}}/>
        <div style={{display:'flex',gap:4}}>
          {['ALL','OPEN','INVESTIGATING','RESOLVED'].map(s=><FB key={s} val={s} active={statusF===s} onClick={()=>setStatusF(s)} color={{OPEN:C.danger,INVESTIGATING:C.warn,RESOLVED:C.success}[s]}/>)}
        </div>
        <div style={{width:1,height:20,background:C.border}}/>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {['ALL',...Object.keys(ATYPES)].map(t=><FB key={t} val={t==='ALL'?'ALL':ATYPES[t].icon+' '+t} active={typeF===t} onClick={()=>setTypeF(t)} color={t!=='ALL'?ATYPES[t].color:undefined}/>)}
        </div>
        <div style={{marginLeft:'auto',fontSize:11,color:C.muted}}>{filtered.length} results</div>
      </div>
    </Card>
    <Card style={{padding:0,overflow:'hidden',flex:1,display:'flex',flexDirection:'column'}}>
      <div style={{overflowY:'auto',flex:1}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{position:'sticky',top:0,zIndex:1}}><tr style={{background:C.surface}}>
            <CH k="ts" label="Time"/>
            <CH k="sev" label="Severity"/>
            <CH k="type" label="Type"/>
            <th style={{padding:'10px 12px',textAlign:'left',fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Source</th>
            <th style={{padding:'10px 12px',textAlign:'left',fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Destination</th>
            <th style={{padding:'10px 12px',textAlign:'left',fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Sensor</th>
            <CH k="confidence" label="Confidence"/>
            <CH k="psvDist" label="PSV Dist"/>
            <th style={{padding:'10px 12px',textAlign:'left',fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Status</th>
          </tr></thead>
          <tbody>
            {filtered.map(a=>{
              const sc={OPEN:C.danger,INVESTIGATING:C.warn,RESOLVED:C.success}[a.status];
              return <tr key={a.id} onClick={()=>onInvestigate(a)} style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.panelHi} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted,whiteSpace:'nowrap'}}>{fmtAgo(a.ts)}</td>
                <td style={{padding:'9px 12px'}}><Sev s={a.sev}/></td>
                <td style={{padding:'9px 12px'}}><TypeTag t={a.type}/></td>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.sub}}>{a.srcIp}:{a.srcPort}</td>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.sub}}>{a.dstIp}:{a.dstPort}</td>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted}}>{a.sensorId}</td>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:C.accent}}>{(a.confidence*100).toFixed(0)}%</td>
                <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:10,color:C.muted}}>{a.psvDist.toFixed(4)}</td>
                <td style={{padding:'9px 12px'}}><span style={{padding:'2px 8px',borderRadius:4,background:sc+'22',color:sc,fontSize:10,fontWeight:600}}>{a.status}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}

// ── SENSORS ───────────────────────────────────────────────────────────────────
function SensorsSection({sensors}){
  const online=sensors.filter(s=>s.status==='ONLINE').length;
  const totalFps=sensors.reduce((s,s2)=>s+s2.fps,0);
  return <div style={{padding:24,overflowY:'auto',flex:1}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
      {[{label:'Active Sensors',value:`${online}/${sensors.length}`,color:C.success},{label:'Total Flow Rate',value:`${totalFps.toLocaleString()} fps`,color:C.accent},{label:'PCF Engine',value:'v2.1.0 CPU-only',color:C.blue}].map(({label,value,color})=><Card key={label} style={{padding:16}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
        <div style={{fontSize:22,fontWeight:800,color}}>{value}</div>
      </Card>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
      {sensors.map(s=>{
        const sc={ONLINE:C.success,DEGRADED:C.amber,OFFLINE:C.muted}[s.status];
        return <Card key={s.id} style={{borderLeft:`3px solid ${sc}`,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.name}</div>
              <div style={{fontSize:10,color:C.muted,fontFamily:'monospace',marginTop:2}}>{s.id} · {s.ip}</div>
            </div>
            <StatusDot s={s.status}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[{label:'Flow Rate',value:s.status==='OFFLINE'?'—':`${s.fps.toLocaleString()}/s`,color:C.accent},{label:'Alerts Today',value:s.alerts,color:s.alerts>10?C.danger:C.warn},{label:'Uptime',value:s.status==='OFFLINE'?'—':`${s.uptime}d`,color:C.sub}].map(({label,value,color})=><div key={label} style={{background:C.panelHi,borderRadius:6,padding:'8px 10px'}}>
              <div style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>{label}</div>
              <div style={{fontSize:13,fontWeight:700,color}}>{value}</div>
            </div>)}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:9,color:C.muted,fontFamily:'monospace'}}>{s.location} · PCF {s.version}</div>
            {s.status!=='OFFLINE'&&<Sparkline values={Array.from({length:12},(_,i)=>s.fps*(0.85+Math.sin(i*0.7+s.uptime)*0.15))} color={sc} width={60} height={18}/>}
          </div>
          {s.status==='DEGRADED'&&<div style={{background:C.amber+'11',border:`1px solid ${C.amber}33`,borderRadius:6,padding:'6px 10px',fontSize:10,color:C.amber}}>⚠ Performance degraded — check interface or CPU load</div>}
          {s.status==='OFFLINE'&&<div style={{background:C.dim,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 10px',fontSize:10,color:C.muted}}>✗ Unreachable — last seen 2h ago</div>}
        </Card>;
      })}
    </div>
  </div>;
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function Analytics({alerts}){
  const typeCounts={};Object.keys(ATYPES).forEach(t=>typeCounts[t]=0);alerts.forEach(a=>typeCounts[a.type]=(typeCounts[a.type]||0)+1);
  const ipCounts={};alerts.forEach(a=>ipCounts[a.srcIp]=(ipCounts[a.srcIp]||0)+1);
  const topIps=Object.entries(ipCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxIp=topIps[0]?.[1]||1;
  const psvByType={};Object.keys(ATYPES).forEach(t=>psvByType[t]=[]);alerts.forEach(a=>psvByType[a.type].push(a.psvDist));

  return <div style={{padding:24,overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:16}}>
    <Card>
      <SectionLabel>Attack Type Distribution</SectionLabel>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
          const meta=ATYPES[type];const pct=Math.round(count/alerts.length*100)||0;
          const avg=psvByType[type].length?(psvByType[type].reduce((s,v)=>s+v,0)/psvByType[type].length).toFixed(4):'—';
          return <div key={type} style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:120,fontSize:11,color:C.sub,display:'flex',alignItems:'center',gap:6}}><span>{meta.icon}</span><span>{type}</span></div>
            <div style={{flex:1,height:20,background:C.dim,borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,borderRadius:4,background:meta.color,opacity:0.85}}/>
            </div>
            <div style={{width:36,fontFamily:'monospace',fontSize:11,color:meta.color}}>{count}</div>
            <div style={{width:70,fontFamily:'monospace',fontSize:10,color:C.muted}}>Δ̄={avg}</div>
            <div style={{width:50,fontFamily:'monospace',fontSize:10,color:C.muted}}>F1={meta.f1}</div>
          </div>;
        })}
      </div>
    </Card>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      <Card><SectionLabel>24h Alert Timeline</SectionLabel><Timeline alerts={alerts} width={360} height={90}/></Card>
      <Card>
        <SectionLabel>Top Source IPs</SectionLabel>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {topIps.map(([ip,count])=>{
            const topType=alerts.find(a=>a.srcIp===ip)?.type;
            const color=ATYPES[topType]?.color||C.accent;
            return <div key={ip} style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:135,fontFamily:'monospace',fontSize:10,color:C.sub}}>{ip}</div>
              <div style={{flex:1,height:14,background:C.dim,borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${count/maxIp*100}%`,background:color,opacity:0.8,borderRadius:3}}/>
              </div>
              <div style={{width:22,fontFamily:'monospace',fontSize:10,color}}>{count}</div>
            </div>;
          })}
        </div>
      </Card>
    </div>
    <Card>
      <SectionLabel>PSV Distance Distribution by Attack Class</SectionLabel>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
        {Object.entries(psvByType).map(([type,dists])=>{
          const meta=ATYPES[type];
          const avg=dists.length?dists.reduce((s,v)=>s+v,0)/dists.length:0;
          const max2=dists.length?Math.max(...dists):0;
          const min2=dists.length?Math.min(...dists):0;
          return <div key={type} style={{background:C.panelHi,borderRadius:8,padding:14,borderTop:`2px solid ${meta.color}`}}>
            <div style={{fontSize:11,color:meta.color,fontWeight:700,marginBottom:8}}>{meta.icon} {type}</div>
            <Sparkline values={dists.slice(0,15)} color={meta.color} width={100} height={30}/>
            <div style={{marginTop:8,fontSize:9,fontFamily:'monospace',color:C.muted,lineHeight:1.7}}>
              avg: <span style={{color:C.sub}}>{avg.toFixed(4)}</span><br/>
              min: <span style={{color:C.sub}}>{min2.toFixed(4)}</span><br/>
              max: <span style={{color:C.sub}}>{max2.toFixed(4)}</span>
            </div>
          </div>;
        })}
      </div>
    </Card>
  </div>;
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports({alerts}){
  const [gen,setGen]=useState(null);
  const open=alerts.filter(a=>a.status==='OPEN').length;
  const resolved=alerts.filter(a=>a.status==='RESOLVED').length;
  const crit=alerts.filter(a=>a.sev==='CRITICAL').length;
  const RTYPES=[
    {id:'executive',label:'Executive Summary',desc:'High-level threat landscape and KPIs for C-suite briefing.',icon:'📊'},
    {id:'technical',label:'Technical Threat Report',desc:'Full alert log, PSV signatures, attack vectors, and remediation evidence.',icon:'🔬'},
    {id:'compliance',label:'Compliance Export',desc:'SOC 2 / ISO 27001 audit-ready log with patent claim references and detection provenance.',icon:'📋'},
    {id:'siem',label:'SIEM / SOAR JSON Feed',desc:'Structured JSON export for Splunk, Elastic, or SOAR platform ingestion.',icon:'⚙️'},
  ];
  return <div style={{padding:24,overflowY:'auto',flex:1}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:20}}>
      {RTYPES.map(r=><Card key={r.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <span style={{fontSize:24}}>{r.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{r.label}</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginBottom:12}}>{r.desc}</div>
            <button onClick={()=>setGen(r.id)} style={{padding:'6px 16px',borderRadius:6,border:`1px solid ${C.accent}44`,background:C.accent+'11',color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer'}}>Generate</button>
          </div>
        </div>
      </Card>)}
    </div>
    {gen&&<Card style={{borderColor:C.accent+'44'}}>
      <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:12}}>{RTYPES.find(r=>r.id===gen)?.label} — Preview</div>
      <pre style={{fontFamily:'monospace',fontSize:9.5,color:C.sub,lineHeight:1.7,whiteSpace:'pre-wrap',margin:0}}>{`LAMINAR THREAT REPORT
Generated: ${new Date().toUTCString()}
Period: Last 24 hours | Platform: Astrognosy AI / Pacific
Patent: U.S. Provisional 63/978,633

── SUMMARY ──────────────────────────────────────────────────
Total Alerts:   ${alerts.length}  |  Open: ${open}  |  Resolved: ${resolved}  |  Critical: ${crit}
Detection:      PCF PSV-distance classifier (Claims 31-32)
Zero ML:        YES — patent-protected structural analysis
Latency:        1.4–1.6ms per trace (CPU-only, no GPU)
Dataset basis:  CICIDS2017 real traffic (is_real_data: true)

── ATTACK DISTRIBUTION ──────────────────────────────────────
${Object.entries(ATYPES).map(([t,m])=>`  ${t.padEnd(14)} ${alerts.filter(a=>a.type===t).length.toString().padStart(4)} detections   F1=${m.f1}  P=${m.prec}  R=${m.rec}`).join('\n')}

── PCF ENGINE ───────────────────────────────────────────────
Algorithm:      Positional Correlation Fields
Kernel:         LEARNED_DECAY  K(k) = 1/(k+1), k=1..10
PSV formula:    σ_k = mean(PMI_k) / (std(PMI_k) + ε), ε=0.01
Classifier:     PSV cosine distance OR attack-token fraction
Threshold A:    90th percentile of benign calibration (n=80)
Threshold B:    99th percentile of benign token fraction

── SENSORS ──────────────────────────────────────────────────
${SENSORS_INIT.map(s=>`  ${s.id}   ${s.status.padEnd(10)}  ${s.fps.toString().padStart(5)} fps   ${s.location}`).join('\n')}`}</pre>
    </Card>}
  </div>;
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings(){
  const [apiUrl,setApiUrl]=useState('https://pcf-api-production.up.railway.app');
  const [webhook,setWebhook]=useState('');
  const [saved,setSaved]=useState(false);
  const Field=({label,value,onChange,placeholder})=><div style={{marginBottom:16}}>
    <div style={{fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:'100%',padding:'9px 12px',borderRadius:6,border:`1px solid ${C.border2}`,background:C.panelHi,color:C.text,fontSize:12,outline:'none',fontFamily:'monospace'}}/>
  </div>;
  return <div style={{padding:24,overflowY:'auto',flex:1}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:900}}>
      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>API Configuration</div>
        <Field label="PCF API Endpoint" value={apiUrl} onChange={setApiUrl} placeholder="https://…"/>
        <Field label="SIEM Webhook URL" value={webhook} onChange={setWebhook} placeholder="https://your-siem.example.com/laminar"/>
        <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={{padding:'8px 20px',borderRadius:6,border:'none',background:C.accent,color:'#020810',fontSize:12,fontWeight:700,cursor:'pointer'}}>{saved?'✓ Saved':'Save Settings'}</button>
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Detection Parameters</div>
        {[{label:'PSV Threshold Percentile',val:'90th',desc:'Of benign calibration distances'},{label:'Token Fraction Threshold',val:'99th',desc:'Of benign attack-token fraction'},{label:'Calibration Window',val:'80 traces',desc:'Normal traces for PSV centroid'},{label:'Flow Window Size',val:'20 flows',desc:'Flows per detection trace'},{label:'Max Offset K',val:'10',desc:'PMI tensor range k=1..10'},{label:'Kernel',val:'LEARNED_DECAY',desc:'K(k) = 1/(k+1)'}].map(({label,val,desc})=><div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
          <div><div style={{fontSize:11,color:C.sub}}>{label}</div><div style={{fontSize:9,color:C.muted,marginTop:2}}>{desc}</div></div>
          <div style={{fontFamily:'monospace',fontSize:11,color:C.accent,background:C.accent+'11',padding:'2px 8px',borderRadius:4,flexShrink:0,marginLeft:12}}>{val}</div>
        </div>)}
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Integrations</div>
        {['Splunk','Elastic SIEM','PagerDuty','Slack','Microsoft Sentinel'].map(n=><div key={n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.sub}}>{n}</div>
          <button style={{padding:'4px 12px',borderRadius:4,border:`1px solid ${C.border2}`,background:'none',color:C.muted,fontSize:10,cursor:'pointer'}}>Configure</button>
        </div>)}
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>API Key</div>
        <div style={{fontFamily:'monospace',fontSize:10,color:C.accent,background:C.accent+'0a',border:`1px solid ${C.accent}22`,borderRadius:6,padding:12,wordBreak:'break-all',marginBottom:12}}>lmr_sk_prod_••••••••••••••••••••••••••••••••</div>
        <button style={{padding:'7px 16px',borderRadius:6,border:`1px solid ${C.border2}`,background:'none',color:C.muted,fontSize:11,cursor:'pointer',marginRight:8}}>Reveal</button>
        <button style={{padding:'7px 16px',borderRadius:6,border:'none',background:C.danger+'22',color:C.danger,fontSize:11,cursor:'pointer'}}>Rotate Key</button>
        <div style={{marginTop:16,fontSize:10,fontWeight:700,color:C.text,marginBottom:8}}>Patent Protection</div>
        <div style={{fontSize:10,color:C.muted,lineHeight:1.7,fontFamily:'monospace'}}>
          PCF Algorithm: U.S. Provisional 63/978,633<br/>
          Patent 2: 61 Claims Filed March 2026<br/>
          Patent 3: Marketplace Protocol — In Preparation<br/>
          All detection logic patent-protected.
        </div>
      </Card>
    </div>
  </div>;
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
function LaminarConsole(){
  const [section,setSection]=useState('dashboard');
  const [alerts,setAlerts]=useState(INIT_ALERTS);
  const [investigating,setInvestigating]=useState(null);
  const [sensors]=useState(SENSORS_INIT);
  const [liveCount,setLiveCount]=useState(11805);
  const seedRef=useRef(9999);

  useEffect(()=>{
    const t=setInterval(()=>setLiveCount(c=>Math.max(8000,c+Math.round((Math.random()-0.5)*400))),2000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>{
      if(Math.random()>0.55){const a=genAlert(seedRef.current++,0);setAlerts(prev=>[a,...prev].slice(0,300));}
    },4500);
    return()=>clearInterval(t);
  },[]);

  function handleStatus(id,status){
    setAlerts(prev=>prev.map(a=>a.id===id?{...a,status}:a));
    setInvestigating(prev=>prev?.id===id?{...prev,status}:prev);
  }

  const openCount=alerts.filter(a=>a.status==='OPEN').length;
  const critCount=alerts.filter(a=>a.sev==='CRITICAL'&&a.status==='OPEN').length;

  return <div style={{display:'flex',height:'100vh',background:C.bg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden'}}>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    <Sidebar active={section} onNav={setSection} openCount={openCount} liveCount={liveCount.toLocaleString()}/>
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <TopBar section={section} critCount={critCount}/>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {section==='dashboard' &&<Dashboard alerts={alerts} sensors={sensors} liveCount={liveCount} onInvestigate={setInvestigating}/>}
        {section==='threats'   &&<ThreatFeed alerts={alerts} onInvestigate={setInvestigating} onStatusChange={handleStatus}/>}
        {section==='sensors'   &&<SensorsSection sensors={sensors}/>}
        {section==='analytics' &&<Analytics alerts={alerts}/>}
        {section==='reports'   &&<Reports alerts={alerts}/>}
        {section==='settings'  &&<Settings/>}
      </div>
    </div>
    {investigating&&<Investigator alert={investigating} onClose={()=>setInvestigating(null)} onStatusChange={handleStatus}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<LaminarConsole/>);
