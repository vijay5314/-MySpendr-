import { useState, useEffect, useRef } from "react";

const STORAGE_KEY   = "myspendr_expenses_v3";
const BUDGET_KEY    = "myspendr_budget_v3";
const CATEGORY_KEY  = "myspendr_categories_v3";
const STREAK_KEY    = "myspendr_streak_v3";
const THEME_KEY     = "myspendr_theme_v3";
const RECURRING_KEY = "myspendr_recurring_v1";
const POT_KEY       = "myspendr_pot_v3";
const DISMISS_KEY   = "myspendr_dismiss_v1";

function getTodayIST() {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().split("T")[0];
}
const today = getTodayIST();
const RECUR_FREQ = ["Monthly","Weekly","Yearly"];

const CAT_PALETTE = [
  {bg:"#fee2e2",text:"#dc2626",darkBg:"#450a0a",darkText:"#fca5a5"},
  {bg:"#dcfce7",text:"#16a34a",darkBg:"#052e16",darkText:"#86efac"},
  {bg:"#dbeafe",text:"#2563eb",darkBg:"#172554",darkText:"#93c5fd"},
  {bg:"#ede9fe",text:"#7c3aed",darkBg:"#2e1065",darkText:"#c4b5fd"},
  {bg:"#fef9c3",text:"#ca8a04",darkBg:"#422006",darkText:"#fde047"},
  {bg:"#fce7f3",text:"#db2777",darkBg:"#500724",darkText:"#f9a8d4"},
  {bg:"#ffedd5",text:"#ea580c",darkBg:"#431407",darkText:"#fdba74"},
  {bg:"#cffafe",text:"#0891b2",darkBg:"#083344",darkText:"#67e8f9"},
  {bg:"#d1fae5",text:"#059669",darkBg:"#022c22",darkText:"#6ee7b7"},
  {bg:"#fdf2f8",text:"#a21caf",darkBg:"#4a044e",darkText:"#f0abfc"},
  {bg:"#fff7ed",text:"#c2410c",darkBg:"#431407",darkText:"#fb923c"},
  {bg:"#f0fdf4",text:"#15803d",darkBg:"#052e16",darkText:"#4ade80"},
];

const defaultCategories = [
  {name:"Food",colorIdx:0},{name:"Groceries",colorIdx:1},{name:"Travel",colorIdx:2},
  {name:"Shopping",colorIdx:3},{name:"Bills",colorIdx:4},{name:"Entertainment",colorIdx:5},
];

const defaultPot = {
  usableCash:0,usableBank:0,savings:0,investments:0,gold:0,
  incomes:[{id:1,label:"Salary",amount:0,frequency:"Monthly",active:true}],
  extras:[],
};

/* ════ ICONS ════ */
function SunIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><circle cx="12"cy="12"r="5"/><line x1="12"y1="1"x2="12"y2="3"/><line x1="12"y1="21"x2="12"y2="23"/><line x1="4.22"y1="4.22"x2="5.64"y2="5.64"/><line x1="18.36"y1="18.36"x2="19.78"y2="19.78"/><line x1="1"y1="12"x2="3"y2="12"/><line x1="21"y1="12"x2="23"y2="12"/><line x1="4.22"y1="19.78"x2="5.64"y2="18.36"/><line x1="18.36"y1="5.64"x2="19.78"y2="4.22"/></svg>;}
function MoonIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;}
function FlameIcon({size=16}){return<svg width={size}height={size}viewBox="0 0 24 24"fill="currentColor"stroke="none"><path d="M12 2C9.17 2 7 4.17 7 7c0 1.57.68 2.97 1.76 3.95C7.65 12.07 7 13.46 7 15c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.54-.65-2.93-1.76-4.05C16.32 9.97 17 8.57 17 7c0-2.83-2.17-5-5-5zm0 16c-1.65 0-3-1.35-3-3 0-.93.42-1.76 1.08-2.33C10.66 13.16 11.31 14 12 14s1.34-.84 1.92-1.33C14.58 13.24 15 14.07 15 15c0 1.65-1.35 3-3 3z"/></svg>;}
function ShieldIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;}
function TrophyIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><path d="M17 3H7a2 2 0 0 0-2 2v6a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2z"/><path d="M5 7H2a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4"/><path d="M19 7h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4"/></svg>;}
function EditIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;}
function TrashIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;}
function RepeatIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;}
function PlusIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><line x1="12"y1="5"x2="12"y2="19"/><line x1="5"y1="12"x2="19"y2="12"/></svg>;}
function CheckIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;}
function PotTabIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z"/><path d="M2 10h20"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;}
function WalletIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><circle cx="18"cy="12"r="2"/></svg>;}
function TrendingUpIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;}
function PiggyIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M19 8a7 7 0 0 0-14 0c0 2.5 1.3 4.7 3.3 6L8 20h8l-.3-6A7 7 0 0 0 19 8z"/><line x1="12"y1="2"x2="12"y2="4"/><line x1="8"y1="20"x2="16"y2="20"/></svg>;}
function ZapIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;}
function BankIcon(){return<svg width="13"height="13"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><line x1="3"y1="22"x2="21"y2="22"/><line x1="6"y1="18"x2="6"y2="11"/><line x1="10"y1="18"x2="10"y2="11"/><line x1="14"y1="18"x2="14"y2="11"/><line x1="18"y1="18"x2="18"y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;}
function CashIcon(){return<svg width="13"height="13"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><rect x="1"y="4"width="22"height="16"rx="2"/><line x1="1"y1="10"x2="23"y2="10"/></svg>;}
function ChevronLeftIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;}
function GridIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><rect x="3"y="3"width="7"height="7"/><rect x="14"y="3"width="7"height="7"/><rect x="3"y="14"width="7"height="7"/><rect x="14"y="14"width="7"height="7"/></svg>;}
function BellIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;}
function XIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><line x1="18"y1="6"x2="6"y2="18"/><line x1="6"y1="6"x2="18"y2="18"/></svg>;}
function AlertIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><triangle points="10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12"y1="9"x2="12"y2="13"/><line x1="12"y1="17"x2="12.01"y2="17"/></svg>;}

/* ════ GOLD POT SVG ════ */
function GoldPotSVG({fillPercent,dark,size="md"}){
  const clamp=Math.max(0,Math.min(100,fillPercent));
  const[wave,setWave]=useState(0);
  useEffect(()=>{let raf;let t=0;const tick=()=>{t+=0.025;setWave(Math.sin(t)*3);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[]);
  const lc=clamp<=0?{top:"#6b7280",mid:"#4b5563",shine:"#9ca3af"}:clamp<=20?{top:"#ef4444",mid:"#dc2626",shine:"#fca5a5"}:clamp<=40?{top:"#f97316",mid:"#ea580c",shine:"#fdba74"}:clamp<=60?{top:"#f59e0b",mid:"#d97706",shine:"#fcd34d"}:clamp<=80?{top:"#fbbf24",mid:"#f59e0b",shine:"#fde68a"}:{top:"#fcd34d",mid:"#fbbf24",shine:"#fef3c7"};
  const liqH=(clamp/100)*68,liqY=108-liqH;
  const showSparkles=clamp>75;
  const dims=size==="sm"?{w:80,h:96}:size==="lg"?{w:140,h:160}:{w:110,h:130};
  const potShine=dark?"#374151":"#ffffff";
  return(
    <div style={{position:"relative",width:dims.w,height:dims.h}}>
      <style>{`@keyframes _bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes _sp{0%{opacity:0;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(180deg)}100%{opacity:0;transform:scale(0) rotate(360deg)}}@keyframes _shim{0%,100%{opacity:0.2}50%{opacity:0.7}}@keyframes _pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}.gpbob{animation:_bob 2.2s ease-in-out infinite}.gpsp{animation:_sp 1.6s ease-in-out infinite}.gpshim{animation:_shim 2s ease-in-out infinite}.gppulse{animation:_pulse 2s ease-in-out infinite}`}</style>
      <div className="gpbob" style={{width:"100%",height:"100%"}}>
        {showSparkles&&[{x:4,y:4,d:"0s",s:8},{x:68,y:12,d:"0.5s",s:6},{x:38,y:0,d:"0.9s",s:7},{x:8,y:28,d:"1.2s",s:5},{x:66,y:34,d:"0.3s",s:6}].map((sp,i)=>(
          <div key={i} className="gpsp" style={{position:"absolute",left:sp.x*(dims.w/80),top:sp.y*(dims.h/96),animationDelay:sp.d,fontSize:sp.s,color:"#fbbf24",zIndex:10,pointerEvents:"none"}}>✦</div>
        ))}
        <svg viewBox="0 0 120 140" width={dims.w} height={dims.h}>
          <defs>
            <clipPath id="gpclip"><path d="M28 52 Q24 55 22 65 L20 108 Q20 118 60 118 Q100 118 100 108 L98 65 Q96 55 92 52 Z"/></clipPath>
            <linearGradient id="gpbd" x1="0"y1="0"x2="1"y2="0"><stop offset="0%"stopColor={dark?"#374151":"#e5e7eb"}/><stop offset="45%"stopColor={dark?"#4b5563":"#f9fafb"}/><stop offset="100%"stopColor={dark?"#1f2937":"#d1d5db"}/></linearGradient>
            <linearGradient id="gplq" x1="0"y1="0"x2="0"y2="1"><stop offset="0%"stopColor={lc.top}/><stop offset="100%"stopColor={lc.mid}/></linearGradient>
            <linearGradient id="gprm" x1="0"y1="0"x2="0"y2="1"><stop offset="0%"stopColor={dark?"#6b7280":"#ffffff"}/><stop offset="100%"stopColor={dark?"#374151":"#d1d5db"}/></linearGradient>
          </defs>
          <path d="M28 52 Q24 55 22 65 L20 108 Q20 118 60 118 Q100 118 100 108 L98 65 Q96 55 92 52 Z" fill="url(#gpbd)" stroke={dark?"#374151":"#d1d5db"} strokeWidth="1.5"/>
          {clamp>0&&<g clipPath="url(#gpclip)"><rect x="20"y={liqY}width="80"height={liqH+10}fill="url(#gplq)"/><path d={`M20 ${liqY} Q${35+wave} ${liqY-5} 50 ${liqY} Q${65-wave} ${liqY+5} 80 ${liqY} Q${90+wave} ${liqY-4} 100 ${liqY} L100 ${liqY+10} L20 ${liqY+10} Z`}fill={lc.top}opacity="0.85"/><rect className="gpshim"x="30"y={liqY+5}width="7"height={Math.max(0,liqH-8)}rx="3.5"fill={lc.shine}opacity="0.5"/></g>}
          <path d="M35 58 Q34 72 34 88" stroke={potShine} strokeWidth="4" strokeLinecap="round" opacity="0.2"/>
          <ellipse cx="60"cy="52"rx="34"ry="10"fill="url(#gprm)"stroke={dark?"#4b5563":"#d1d5db"}strokeWidth="1.5"/>
          <ellipse cx="60"cy="52"rx="27"ry="6.5"fill={dark?"#111827":"#f3f4f6"}stroke="none"opacity="0.55"/>
          <path d="M22 70 Q9 70 9 81 Q9 92 22 92" fill="none" stroke={dark?"#4b5563":"#d1d5db"} strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M98 70 Q111 70 111 81 Q111 92 98 90" fill="none" stroke={dark?"#4b5563":"#d1d5db"} strokeWidth="5.5" strokeLinecap="round"/>
          {clamp>10&&<g opacity={Math.min(1,clamp/35)}><ellipse cx="46"cy={liqY+2}rx="9"ry="3"fill="#fbbf24"stroke="#d97706"strokeWidth="0.5"/><ellipse cx="68"cy={liqY+0}rx="7.5"ry="2.5"fill="#fbbf24"stroke="#d97706"strokeWidth="0.5"/><ellipse cx="57"cy={liqY-2}rx="10"ry="3.2"fill="#fcd34d"stroke="#d97706"strokeWidth="0.5"/></g>}
          <ellipse cx="60"cy="121"rx="40"ry="5"fill={dark?"#00000050":"#00000012"}/>
        </svg>
      </div>
    </div>
  );
}
function UsablePot({fillPercent,amount,dark,size="md"}){
  const c=Math.max(0,Math.min(100,fillPercent));
  const col=c<=20?"#ef4444":c<=40?"#f97316":"#f59e0b";
  return<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><GoldPotSVG fillPercent={fillPercent}dark={dark}size={size}/><div className="gppulse"style={{fontSize:size==="sm"?22:28,fontWeight:800,fontFamily:"'DM Mono',monospace",color:col,letterSpacing:"-1px",lineHeight:1,textAlign:"center"}}>₹{amount<0?"-":""}{Math.abs(amount).toLocaleString()}</div></div>;
}
function NetWorthPot({fillPercent,amount,dark}){
  return<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><GoldPotSVG fillPercent={fillPercent}dark={dark}size="lg"/><div className="gppulse"style={{fontSize:32,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#7c3aed",letterSpacing:"-1.5px",lineHeight:1,textAlign:"center"}}>₹{Math.abs(amount).toLocaleString()}</div></div>;
}

/* ════ SOURCE PILL ════ */
function SourcePill({value,onChange,dark,subbg,border,textMute}){
  return(
    <div style={{display:"flex",gap:3,background:subbg,borderRadius:10,padding:3,border:`1px solid ${border}`}}>
      {[["bank","Bank","#2563eb"],["cash","Cash","#16a34a"]].map(([v,label,color])=>(
        <button key={v} onClick={()=>onChange(v)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:value===v?color:"transparent",color:value===v?"#fff":textMute,transition:"all 0.15s"}}>
          {v==="bank"?<BankIcon/>:<CashIcon/>}{label}
        </button>
      ))}
    </div>
  );
}

/* ════ REMINDER BANNER (swipeable) ════ */
function ReminderBanner({item,onDismiss,onPay,dark}){
  const isOverdue=item.daysUntil<0;
  const isDueToday=item.daysUntil===0;
  const startX=useRef(null);
  const [offset,setOffset]=useState(0);
  const [dismissed,setDismissed]=useState(false);

  function handleTouchStart(e){startX.current=e.touches[0].clientX;}
  function handleTouchMove(e){
    if(startX.current===null)return;
    const dx=e.touches[0].clientX-startX.current;
    if(Math.abs(dx)>10)setOffset(dx);
  }
  function handleTouchEnd(){
    if(Math.abs(offset)>80){
      setDismissed(true);
      setTimeout(()=>onDismiss(item.id),250);
    }else{setOffset(0);}
    startX.current=null;
  }

  const bg=isOverdue?(dark?"#450a0a":"#fef2f2"):isDueToday?(dark?"#431407":"#fff7ed"):(dark?"#422006":"#fffbeb");
  const borderC=isOverdue?(dark?"#7f1d1d":"#fca5a5"):isDueToday?(dark?"#92400e":"#fed7aa"):(dark?"#92400e":"#fde68a");
  const accent=isOverdue?"#ef4444":isDueToday?"#f97316":"#f59e0b";
  const label=isOverdue?`${Math.abs(item.daysUntil)}d overdue`:isDueToday?"Due today":`Due in ${item.daysUntil}d`;

  return(
    <div style={{overflow:"hidden",marginBottom:8,opacity:dismissed?0:1,transition:"opacity 0.2s"}}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{background:bg,border:`1px solid ${borderC}`,borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,transform:`translateX(${offset}px)`,transition:offset===0?"transform 0.3s":"none",cursor:"grab",userSelect:"none"}}
      >
        <div style={{fontSize:20,flexShrink:0}}>{isOverdue?"⚠️":isDueToday?"🔔":"⏰"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <span style={{fontSize:14,fontWeight:700,color:accent}}>{item.name}</span>
            <span style={{fontSize:11,fontWeight:600,padding:"1px 7px",borderRadius:99,background:accent,color:"#fff"}}>{label}</span>
          </div>
          <div style={{fontSize:12,color:dark?"#9ca3af":"#6b7280"}}>₹{item.amount.toLocaleString()} · due {item.dueDateStr}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>onPay(item,"bank")} style={{background:dark?"#064e3b":"#d1fae5",color:dark?"#34d399":"#065f46",border:"none",borderRadius:9,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><BankIcon/>Pay</button>
          <button onClick={()=>onDismiss(item.id)} style={{background:"none",border:`1px solid ${borderC}`,borderRadius:9,padding:"5px 8px",cursor:"pointer",color:dark?"#6b7280":"#9ca3af",display:"flex",alignItems:"center"}}><XIcon/></button>
        </div>
      </div>
      <div style={{textAlign:"center",fontSize:10,color:dark?"#4b5563":"#d1d5db",marginTop:3}}>← swipe to dismiss</div>
    </div>
  );
}

/* ════ STREAK HELPERS ════ */
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}
function loadStreak(){try{const s=localStorage.getItem(STREAK_KEY);return s?JSON.parse(s):{count:0,lastDate:null,loggedDates:[],longestStreak:0};}catch{return{count:0,lastDate:null,loggedDates:[],longestStreak:0};}}
function getLastNDays(n){const days=[];for(let i=n-1;i>=0;i--){const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));ist.setDate(ist.getDate()-i);days.push(ist.toISOString().split("T")[0]);}return days;}

/* ════ RECURRING DUE DATE HELPERS ════ */
function getNextDueDate(startDate,freq){
  const d=new Date(startDate+"T00:00:00");
  const now=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  while(d<=now){
    if(freq==="Weekly")d.setDate(d.getDate()+7);
    else if(freq==="Monthly")d.setMonth(d.getMonth()+1);
    else if(freq==="Yearly")d.setFullYear(d.getFullYear()+1);
  }
  return d.toISOString().split("T")[0];
}

/* days from today to a date (negative = overdue) */
function daysFromToday(dateStr){
  const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  ist.setHours(0,0,0,0);
  const d=new Date(dateStr+"T00:00:00");
  return Math.round((d-ist)/86400000);
}

/* ════════════════════════════════════
   MAIN APP
════════════════════════════════════ */
export default function App(){
  const[dark,setDark]=useState(()=>{try{return localStorage.getItem(THEME_KEY)==="dark";}catch{return false;}});
  const[expenses,setExpenses]=useState(()=>{try{const s=localStorage.getItem(STORAGE_KEY);return s?JSON.parse(s):[];}catch{return[];}});
  const[budget,setBudget]=useState(()=>{try{const s=localStorage.getItem(BUDGET_KEY);return s?Number(s):0;}catch{return 0;}});
  const[categories,setCategories]=useState(()=>{
    try{
      const s=localStorage.getItem(CATEGORY_KEY);
      if(!s)return defaultCategories;
      const p=JSON.parse(s);
      if(p.length>0&&typeof p[0]==="string")return p.map((name,i)=>({name,colorIdx:i%CAT_PALETTE.length}));
      return p;
    }catch{return defaultCategories;}
  });
  const[streak,setStreak]=useState(()=>loadStreak());
  const[recurring,setRecurring]=useState(()=>{try{const s=localStorage.getItem(RECURRING_KEY);return s?JSON.parse(s):[];}catch{return[];}});
  const[pot,setPot]=useState(()=>{try{const s=localStorage.getItem(POT_KEY);return s?JSON.parse(s):defaultPot;}catch{return defaultPot;}});
  /* dismiss store: {[recurringId]: "YYYY-MM-DD"} — date it was dismissed */
  const[dismissedMap,setDismissedMap]=useState(()=>{try{const s=localStorage.getItem(DISMISS_KEY);return s?JSON.parse(s):{};}catch{return{};}});

  const[amount,setAmount]=useState("");
  const[selCat,setSelCat]=useState("");
  const[note,setNote]=useState("");
  const[date,setDate]=useState(today);
  const[editingId,setEditingId]=useState(null);
  const[paySource,setPaySource]=useState("bank");
  const[budgetInput,setBudgetInput]=useState("");
  const[editingBudget,setEditingBudget]=useState(false);
  const[newCatName,setNewCatName]=useState("");
  const[addingCat,setAddingCat]=useState(false);
  const[toast,setToast]=useState(null);
  const[tab,setTab]=useState("expenses");
  const[drillCat,setDrillCat]=useState(null);

  const[rName,setRName]=useState("");
  const[rAmount,setRAmount]=useState("");
  const[rCat,setRCat]=useState("");
  const[rFreq,setRFreq]=useState("Monthly");
  const[rDueDate,setRDueDate]=useState(today); // specific due date
  const[rEditId,setREditId]=useState(null);
  const[showRForm,setShowRForm]=useState(false);

  const[potSection,setPotSection]=useState("usable");
  const[potVisible,setPotVisible]=useState(false);
  const[cashAdj,setCashAdj]=useState("");
  const[cashMode,setCashMode]=useState(null);
  const[bankAdj,setBankAdj]=useState("");
  const[bankMode,setBankMode]=useState(null);
  const[showIncomeForm,setShowIncomeForm]=useState(false);
  const[incName,setIncName]=useState("");
  const[incAmt,setIncAmt]=useState("");
  const[incFreq,setIncFreq]=useState("Monthly");
  const[incEditId,setIncEditId]=useState(null);
  const[showExtraForm,setShowExtraForm]=useState(false);
  const[extraLabel,setExtraLabel]=useState("");
  const[extraAmt,setExtraAmt]=useState("");
  const[extraDate,setExtraDate]=useState(today);

  useEffect(()=>{localStorage.setItem(THEME_KEY,dark?"dark":"light");},[dark]);
  useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses));},[expenses]);
  useEffect(()=>{localStorage.setItem(BUDGET_KEY,budget.toString());},[budget]);
  useEffect(()=>{localStorage.setItem(CATEGORY_KEY,JSON.stringify(categories));},[categories]);
  useEffect(()=>{localStorage.setItem(STREAK_KEY,JSON.stringify(streak));},[streak]);
  useEffect(()=>{localStorage.setItem(RECURRING_KEY,JSON.stringify(recurring));},[recurring]);
  useEffect(()=>{localStorage.setItem(POT_KEY,JSON.stringify(pot));},[pot]);
  useEffect(()=>{localStorage.setItem(DISMISS_KEY,JSON.stringify(dismissedMap));},[dismissedMap]);

  useEffect(()=>{if(!selCat&&categories.length>0)setSelCat(categories[0].name);},[categories]);
  useEffect(()=>{if(!rCat&&categories.length>0)setRCat(categories[0].name);},[categories]);

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(null),2500);}

  /* ── Category helpers ── */
  function getCatObj(name){return categories.find(c=>c.name===name)||{name,colorIdx:0};}
  function getCatStyle(name){const cat=getCatObj(name);const p=CAT_PALETTE[cat.colorIdx%CAT_PALETTE.length];return dark?{background:p.darkBg,color:p.darkText}:{background:p.bg,color:p.text};}
  function getCatAccent(name){const cat=getCatObj(name);const p=CAT_PALETTE[cat.colorIdx%CAT_PALETTE.length];return dark?p.darkText:p.text;}

  /* ── Streak ── */
  function logDay(dateStr){
    setStreak(prev=>{
      if(prev.loggedDates.includes(dateStr))return prev;
      const nl=[...prev.loggedDates,dateStr];let nc=1;
      if(prev.lastDate){const d=daysBetween(prev.lastDate,dateStr);if(d===1)nc=prev.count+1;else if(d===0)return prev;}
      return{count:nc,lastDate:dateStr,loggedDates:nl,longestStreak:Math.max(prev.longestStreak||0,nc)};
    });
  }
  const todayLogged=streak.loggedDates.includes(today);
  function formatDate(d){const dt=new Date(d+"T00:00:00");const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return`${String(dt.getDate()).padStart(2,"0")}-${m[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;}

  /* ── Pot helpers ── */
  function deductPot(source,amount,p){const f=source==="cash"?"usableCash":"usableBank";return{...p,[f]:Math.max(0,(Number(p[f])||0)-amount)};}
  function refundPot(source,amount,p){const f=source==="cash"?"usableCash":"usableBank";return{...p,[f]:(Number(p[f])||0)+amount};}
  function quickAdjust(field,mode,val){const num=Number(val)||0;if(num<=0)return;setPot(p=>({...p,[field]:mode==="add"?(Number(p[field])||0)+num:Math.max(0,(Number(p[field])||0)-num)}));showToast(`${mode==="add"?"+":"-"}₹${num.toLocaleString()} ${field==="usableCash"?"cash":"bank"}`);}
  function updateNWField(field,val){const newVal=Number(val)||0;const oldVal=Number(pot[field])||0;const diff=newVal-oldVal;setPot(p=>{const nb=Math.max(0,(Number(p.usableBank)||0)-diff);return{...p,[field]:newVal,usableBank:nb};});}
  function setUsableField(field,val){setPot(p=>({...p,[field]:Number(val)||0}));}

  /* ── Expense CRUD ── */
  function resetForm(){setAmount("");setNote("");setDate(today);setEditingId(null);setPaySource("bank");}
  function saveExpense(){
    if(!amount||isNaN(Number(amount))||Number(amount)<=0)return;
    const num=Number(amount);
    if(editingId){
      const old=expenses.find(e=>e.id===editingId);
      const diff=num-(old?old.amount:0);
      setExpenses(p=>p.map(e=>e.id===editingId?{...e,amount:num,category:selCat,note,date,paySource}:e));
      const f=paySource==="cash"?"usableCash":"usableBank";
      setPot(p=>({...p,[f]:Math.max(0,(Number(p[f])||0)-diff)}));
      showToast("Updated!");
    }else{
      setExpenses(p=>[...p,{id:Date.now(),amount:num,category:selCat,note,date,paySource}]);
      setPot(p=>deductPot(paySource,num,p));
      showToast(`Added · deducted from ${paySource}`);
    }
    logDay(date);resetForm();
  }
  function editExpense(item){setEditingId(item.id);setAmount(item.amount);setSelCat(item.category);setNote(item.note);setDate(item.date);setPaySource(item.paySource||"bank");}
  function deleteExpense(id){const exp=expenses.find(e=>e.id===id);if(exp)setPot(p=>refundPot(exp.paySource||"bank",exp.amount,p));setExpenses(p=>p.filter(e=>e.id!==id));showToast("Deleted & refunded.");}
  function logNoSpend(){if(todayLogged){showToast("Already logged!");return;}logDay(today);showToast("No-spend day logged!");}
  function saveBudget(){if(!budgetInput)return;setBudget(Number(budgetInput));setBudgetInput("");setEditingBudget(false);showToast("Budget updated!");}
  function addCategory(){if(!newCatName.trim()||categories.find(c=>c.name===newCatName.trim()))return;const colorIdx=categories.length%CAT_PALETTE.length;setCategories(p=>[...p,{name:newCatName.trim(),colorIdx}]);setNewCatName("");setAddingCat(false);showToast("Category added!");}

  /* ── Recurring CRUD ── */
  function resetRForm(){setRName("");setRAmount("");setRCat(categories[0]?.name||"");setRFreq("Monthly");setRDueDate(today);setREditId(null);setShowRForm(false);}
  function saveRecurring(){
    if(!rName.trim()||!rAmount||isNaN(Number(rAmount))||Number(rAmount)<=0)return;
    // nextDue is the user-specified due date, advanced if already past
    const nextDue=getNextDueDate(rDueDate,rFreq);
    const entry={id:rEditId||Date.now(),name:rName.trim(),amount:Number(rAmount),category:rCat,frequency:rFreq,dueDate:rDueDate,nextDue,paid:[]};
    if(rEditId){setRecurring(p=>p.map(r=>r.id===rEditId?{...entry,paid:r.paid}:r));showToast("Updated!");}
    else{setRecurring(p=>[...p,entry]);showToast("Recurring added!");}
    resetRForm();
  }
  function editRecurring(r){setREditId(r.id);setRName(r.name);setRAmount(r.amount);setRCat(r.category);setRFreq(r.frequency);setRDueDate(r.dueDate||r.startDate||today);setShowRForm(true);}
  function deleteRecurring(id){setRecurring(p=>p.filter(r=>r.id!==id));showToast("Removed.");}
  function markPaid(r,source="bank"){
    const pd=today;
    setExpenses(p=>[...p,{id:Date.now(),amount:r.amount,category:r.category,note:`${r.name} (${r.frequency})`,date:pd,paySource:source}]);
    const nextDue=getNextDueDate(pd,r.frequency);
    setRecurring(p=>p.map(item=>item.id!==r.id?item:{...item,nextDue,paid:[...(item.paid||[]),pd]}));
    setPot(p=>deductPot(source,r.amount,p));
    // clear dismiss so reminder goes away
    setDismissedMap(prev=>{const n={...prev};delete n[r.id];return n;});
    logDay(pd);showToast(`${r.name} paid from ${source}!`);
  }

  /* ── Reminder logic ── */
  const reminders=recurring.filter(r=>{
    const days=daysFromToday(r.nextDue);
    // show if overdue OR due within 3 days
    if(days>3)return false;
    // check if dismissed today
    const dismissedOn=dismissedMap[r.id];
    if(dismissedOn===today)return false;
    // check if paid this month
    const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    const paidTM=(r.paid||[]).some(d=>{const pd=new Date(d+"T00:00:00");return pd.getMonth()===ist.getMonth()&&pd.getFullYear()===ist.getFullYear();});
    return!paidTM;
  }).map(r=>({
    id:r.id,name:r.name,amount:r.amount,
    daysUntil:daysFromToday(r.nextDue),
    dueDateStr:formatDate(r.nextDue),
    category:r.category,
  })).sort((a,b)=>a.daysUntil-b.daysUntil); // overdue first

  function dismissReminder(id){setDismissedMap(prev=>({...prev,[id]:today}));}
  function payFromReminder(item,source){const r=recurring.find(x=>x.id===item.id);if(r)markPaid(r,source);}

  /* ── Pot income/extras ── */
  function resetIncomeForm(){setIncName("");setIncAmt("");setIncFreq("Monthly");setIncEditId(null);setShowIncomeForm(false);}
  function saveIncome(){if(!incName.trim()||!incAmt||Number(incAmt)<=0)return;const entry={id:incEditId||Date.now(),label:incName.trim(),amount:Number(incAmt),frequency:incFreq,active:true};if(incEditId){setPot(p=>({...p,incomes:p.incomes.map(i=>i.id===incEditId?entry:i)}));showToast("Updated!");}else{setPot(p=>({...p,incomes:[...(p.incomes||[]),entry]}));showToast("Income added!");}resetIncomeForm();}
  function deleteIncome(id){setPot(p=>({...p,incomes:p.incomes.filter(i=>i.id!==id)}));showToast("Removed.");}
  function editIncome(inc){setIncEditId(inc.id);setIncName(inc.label);setIncAmt(inc.amount);setIncFreq(inc.frequency);setShowIncomeForm(true);}
  function creditIncome(inc){setPot(p=>({...p,usableBank:(Number(p.usableBank)||0)+Number(inc.amount)}));showToast(`₹${Number(inc.amount).toLocaleString()} credited to bank!`);}
  function saveExtra(){if(!extraLabel.trim()||!extraAmt||Number(extraAmt)<=0)return;const entry={id:Date.now(),label:extraLabel.trim(),amount:Number(extraAmt),date:extraDate};setPot(p=>({...p,extras:[...(p.extras||[]),entry],usableBank:(Number(p.usableBank)||0)+Number(extraAmt)}));setExtraLabel("");setExtraAmt("");setExtraDate(today);setShowExtraForm(false);showToast(`₹${Number(extraAmt).toLocaleString()} added to bank!`);}
  function deleteExtra(id){const ex=(pot.extras||[]).find(e=>e.id===id);if(ex)setPot(p=>({...p,extras:p.extras.filter(e=>e.id!==id),usableBank:Math.max(0,(Number(p.usableBank)||0)-ex.amount)}));showToast("Removed.");}

  /* ── Computed ── */
  const spent=expenses.reduce((s,e)=>s+e.amount,0);
  const remaining=budget-spent;
  const percentUsed=budget>0?Math.min((spent/budget)*100,100):0;
  const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const monthlyTotal=expenses.filter(e=>new Date(e.date+"T00:00:00").getMonth()===ist.getMonth()).reduce((s,e)=>s+e.amount,0);
  const recurringMonthly=recurring.reduce((s,r)=>r.frequency==="Monthly"?s+r.amount:r.frequency==="Weekly"?s+r.amount*4:r.frequency==="Yearly"?s+Math.round(r.amount/12):s,0);
  const streakMilestone=streak.count>=30?"30-day legend!":streak.count>=14?"2-week warrior!":streak.count>=7?"One week strong!":null;
  const last14=getLastNDays(14);
  const catTotals={};expenses.forEach(e=>{catTotals[e.category]=(catTotals[e.category]||0)+e.amount;});
  const topCategory=Object.keys(catTotals).sort((a,b)=>catTotals[b]-catTotals[a])[0];
  const grouped={};[...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{if(!grouped[e.date])grouped[e.date]=[];grouped[e.date].push(e);});
  const dailyTotal={};expenses.forEach(e=>{dailyTotal[e.date]=(dailyTotal[e.date]||0)+e.amount;});
  const usableTotal=(Number(pot.usableCash)||0)+(Number(pot.usableBank)||0);
  const netWorthTotal=usableTotal+(Number(pot.savings)||0)+(Number(pot.investments)||0)+(Number(pot.gold)||0);
  const monthlyIncome=(pot.incomes||[]).reduce((s,i)=>{if(!i.active)return s;if(i.frequency==="Monthly")return s+i.amount;if(i.frequency==="Weekly")return s+i.amount*4;if(i.frequency==="Yearly")return s+Math.round(i.amount/12);return s;},0);
  const potBase=monthlyIncome>0?monthlyIncome:netWorthTotal>0?netWorthTotal:1;
  const usableFillPct=Math.min(100,(usableTotal/potBase)*100);
  const nwFillActual=netWorthTotal>0?Math.min(100,(usableTotal/netWorthTotal)*100+20):0;

  /* ── Theme ── */
  const bg=dark?"#030712":"#f8fafc",cardBg=dark?"#111827":"#ffffff",border=dark?"#1f2937":"#f1f5f9";
  const textMain=dark?"#f9fafb":"#111827",textMute=dark?"#6b7280":"#6b7280";
  const inputBg=dark?"#1f2937":"#ffffff",inputBorder=dark?"#374151":"#e5e7eb",subbg=dark?"#1f2937":"#f8fafc";
  const cardStyle={background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:16,marginBottom:12};
  const inputStyle={background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"};
  const btnPrimary={background:"#4f46e5",color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer"};
  const btnSecondary={background:dark?"#374151":"#f3f4f6",color:dark?"#d1d5db":"#374151",border:"none",borderRadius:12,padding:"8px 12px",fontSize:13,fontWeight:500,cursor:"pointer"};
  const btnGreen={background:dark?"#064e3b":"#d1fae5",color:dark?"#34d399":"#065f46",border:"none",borderRadius:12,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4};
  const btnGold={background:dark?"#422006":"#fef3c7",color:dark?"#fbbf24":"#92400e",border:"none",borderRadius:12,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4};
  const btnDanger={background:"none",border:"none",cursor:"pointer",color:textMute,padding:4};

  /* ── Category drill-down ── */
  if(drillCat){
    const catExpenses=[...expenses].filter(e=>e.category===drillCat).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const catTotal=catExpenses.reduce((s,e)=>s+e.amount,0);
    const accent=getCatAccent(drillCat);
    return(
      <div style={{minHeight:"100vh",background:bg,color:textMain,fontFamily:"'DM Sans',sans-serif"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
        <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>setDrillCat(null)} style={{...btnSecondary,display:"flex",alignItems:"center",padding:"6px 10px"}}><ChevronLeftIcon/></button>
            <span style={{...getCatStyle(drillCat),padding:"4px 12px",borderRadius:99,fontSize:13,fontWeight:700}}>{drillCat}</span>
            <span style={{fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:accent,marginLeft:"auto"}}>₹{catTotal.toLocaleString()}</span>
          </div>
          {catExpenses.length===0
            ?<div style={{...cardStyle,textAlign:"center",padding:40}}><p style={{color:textMute,margin:0}}>No expenses in {drillCat} yet.</p></div>
            :catExpenses.map(item=>(
              <div key={item.id} style={{...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:0,fontSize:14,fontWeight:700,color:accent}}>₹{item.amount.toLocaleString()}</p>
                  {item.note&&<p style={{margin:"2px 0 0",fontSize:12,color:textMute}}>{item.note}</p>}
                  <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                    <span style={{fontSize:11,color:textMute}}>{formatDate(item.date)}</span>
                    <span style={{display:"flex",alignItems:"center",gap:2,fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:6,background:item.paySource==="cash"?(dark?"#052e16":"#dcfce7"):(dark?"#172554":"#dbeafe"),color:item.paySource==="cash"?(dark?"#86efac":"#16a34a"):(dark?"#93c5fd":"#2563eb")}}>
                      {item.paySource==="cash"?<CashIcon/>:<BankIcon/>}{item.paySource==="cash"?"Cash":"Bank"}
                    </span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setDrillCat(null);editExpense(item);setTab("expenses");}} style={btnDanger}><EditIcon/></button>
                  <button onClick={()=>deleteExpense(item.id)} style={btnDanger}><TrashIcon/></button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:bg,color:textMain,fontFamily:"'DM Sans',sans-serif",transition:"background 0.3s"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"#4f46e5",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap"}}>{toast}</div>}

      <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><h1 style={{margin:0,fontSize:24,fontWeight:700,letterSpacing:"-0.5px"}}>mySpendr</h1><p style={{margin:0,fontSize:12,color:textMute,marginTop:2}}>Track. Save. Streak.</p></div>
          <button onClick={()=>setDark(d=>!d)} style={{...btnSecondary,display:"flex",alignItems:"center",gap:6}}>{dark?<SunIcon/>:<MoonIcon/>}<span>{dark?"Light":"Dark"}</span></button>
        </div>

        {/* ══ REMINDER BANNERS ══ */}
        {reminders.length>0&&(
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
              <BellIcon/><span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute}}>Upcoming Payments</span>
            </div>
            {reminders.map(item=>(
              <ReminderBanner key={item.id} item={item} onDismiss={dismissReminder} onPay={payFromReminder} dark={dark}/>
            ))}
          </div>
        )}

        {/* USABLE POT MINI CARD */}
        <div style={{...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1c1410)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:dark?"1px solid #292117":"1px solid #fde68a",marginBottom:12}}>
          {/* top row: label + eye toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:potVisible?10:0}}>
            <span style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:"#f59e0b"}}>Usable Money</span>
            <button
              onClick={()=>setPotVisible(v=>!v)}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:dark?"#fbbf24":"#d97706",display:"flex",alignItems:"center",gap:4,padding:"2px 6px",borderRadius:8}}
            >
              {potVisible?(
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ):(
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
              {potVisible?"Hide":"Reveal"}
            </button>
          </div>

          {/* hidden state */}
          {!potVisible&&(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:80,height:96,display:"flex",alignItems:"center",justifyContent:"center",background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",borderRadius:12}}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dark?"#4b5563":"#d1d5db"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <p style={{margin:0,fontSize:15,color:dark?"#4b5563":"#d1d5db",fontWeight:600}}>Balance hidden</p>
                <p style={{margin:"3px 0 0",fontSize:12,color:dark?"#374151":"#e5e7eb"}}>Tap Reveal to view</p>
              </div>
            </div>
          )}

          {/* revealed state */}
          {potVisible&&(
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <UsablePot fillPercent={usableFillPct} amount={usableTotal} dark={dark} size="sm"/>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:26,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal<=0?"#ef4444":"#f59e0b",letterSpacing:"-1px",lineHeight:1}}>₹{usableTotal.toLocaleString()}</p>
                <div style={{display:"flex",gap:14,marginTop:5,fontSize:12,color:textMute}}>
                  <span>Cash ₹{(Number(pot.usableCash)||0).toLocaleString()}</span>
                  <span>Bank ₹{(Number(pot.usableBank)||0).toLocaleString()}</span>
                </div>
                <div style={{width:"100%",height:5,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#fde68a",marginTop:8}}>
                  <div style={{height:5,borderRadius:99,width:`${usableFillPct}%`,background:"linear-gradient(to right,#f97316,#fbbf24)",transition:"width 0.6s ease"}}/>
                </div>
                <p style={{margin:"4px 0 6px",fontSize:11,color:textMute}}>Net worth ₹{netWorthTotal.toLocaleString()}</p>
                <button
                  onClick={()=>{
                    setTab("pot");
                    setPotSection("usable");
                    window.scrollTo({top:0,behavior:"smooth"});
                  }}
                  style={{background:dark?"#422006":"#fef3c7",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:700,color:dark?"#fbbf24":"#92400e",padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:4}}
                >
                  Manage ₹ →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CATEGORY PILLS */}
        <div style={{marginBottom:12}}>
          <p style={{margin:"0 0 7px",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute}}>Tap a category to see expenses</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {categories.map(cat=>{
              const total=catTotals[cat.name]||0;
              return(
                <button key={cat.name} onClick={()=>setDrillCat(cat.name)} style={{...getCatStyle(cat.name),border:"none",borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  {cat.name}{total>0&&<span style={{opacity:0.75,fontSize:11}}>₹{total.toLocaleString()}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* STREAK */}
        <div style={{...cardStyle,position:"relative",overflow:"hidden"}}>
          {streak.count>0&&<div style={{position:"absolute",right:-32,top:-32,width:128,height:128,background:"rgba(249,115,22,0.08)",borderRadius:"50%",filter:"blur(24px)",pointerEvents:"none"}}/>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <p style={{margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:textMute,marginBottom:4}}>Current Streak</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:8}}><span style={{fontSize:52,fontWeight:700,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{streak.count}</span><span style={{fontSize:18,color:textMute,marginBottom:4}}>days</span></div>
              {streakMilestone&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:4,color:"#f97316",fontSize:12,fontWeight:600}}><TrophyIcon/>{streakMilestone}</div>}
              <p style={{margin:0,fontSize:12,color:textMute,marginTop:4}}>Longest: <strong>{streak.longestStreak||0} days</strong></p>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:12,fontSize:13,fontWeight:600,background:streak.count>0?(dark?"rgba(194,65,12,0.2)":"#ffedd5"):subbg,color:streak.count>0?"#f97316":textMute}}><FlameIcon size={16}/>{streak.count}</div>
              {!todayLogged
                ?<button onClick={logNoSpend} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:12,fontSize:12,fontWeight:600,background:"transparent",border:dark?"1px solid #065f46":"1px solid #6ee7b7",color:dark?"#34d399":"#059669",cursor:"pointer"}}><ShieldIcon/>No-Spend Day</button>
                :<div style={{display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:500,color:dark?"#34d399":"#059669"}}><ShieldIcon/>Today logged</div>
              }
            </div>
          </div>
          <div style={{marginTop:16}}>
            <p style={{margin:0,fontSize:12,color:textMute,marginBottom:8}}>Last 14 days</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(14,1fr)",gap:4}}>
              {last14.map(d=>{const lg=streak.loggedDates.includes(d),it=d===today;return<div key={d}title={d}style={{height:20,borderRadius:4,background:lg?"#f97316":it?"transparent":(dark?"#1f2937":"#f3f4f6"),border:it&&!lg?(dark?"1px solid rgba(249,115,22,0.4)":"1px solid #fdba74"):"none",transition:"background 0.2s"}}/>;})}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:textMute,marginTop:4}}><span>14 days ago</span><span>Today</span></div>
          </div>
        </div>

        {/* INSIGHTS */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {[{label:"This Month",value:`₹${monthlyTotal.toLocaleString()}`},{label:"Top Category",value:topCategory||"—"},{label:"Total Entries",value:expenses.length},{label:"Remaining",value:`₹${remaining.toLocaleString()}`,red:remaining<0}].map(({label,value,red})=>(
            <div key={label} style={{...cardStyle,marginBottom:0}}><p style={{margin:0,fontSize:11,color:textMute,marginBottom:4}}>{label}</p><p style={{margin:0,fontSize:20,fontWeight:700,color:red?"#ef4444":textMain}}>{value}</p></div>
          ))}
        </div>

        {/* RECURRING PILL */}
        {recurring.length>0&&(
          <div style={{...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><RepeatIcon/><div><p style={{margin:0,fontSize:12,color:textMute}}>Recurring/month</p><p style={{margin:0,fontSize:18,fontWeight:700}}>₹{recurringMonthly.toLocaleString()}</p></div></div>
            {reminders.length>0&&<div style={{background:"#fef3c7",color:"#92400e",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:600}}>{reminders.length} reminder{reminders.length>1?"s":""}</div>}
          </div>
        )}

        {/* BUDGET */}
        <div style={cardStyle}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:14,fontWeight:500}}>Monthly Budget</span>
            <button onClick={()=>{setEditingBudget(e=>!e);setBudgetInput(budget||"");}}style={btnSecondary}>{editingBudget?"Cancel":"Edit"}</button>
          </div>
          {editingBudget&&<div style={{display:"flex",gap:8,marginBottom:12}}><input type="number"value={budgetInput}onChange={e=>setBudgetInput(e.target.value)}placeholder="Enter budget"style={inputStyle}/><button onClick={saveBudget}style={btnPrimary}>Save</button></div>}
          <div style={{width:"100%",height:12,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#f3f4f6"}}><div style={{height:12,borderRadius:99,width:`${percentUsed}%`,background:percentUsed>=90?"linear-gradient(to right,#ef4444,#f97316)":"linear-gradient(to right,#6366f1,#8b5cf6)",transition:"width 0.5s"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:textMute,marginTop:6}}><span>Spent ₹{spent.toLocaleString()}</span><span style={{color:percentUsed>=100?"#ef4444":textMute,fontWeight:percentUsed>=100?600:400}}>{percentUsed.toFixed(0)}% of ₹{budget.toLocaleString()}</span></div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:4,marginBottom:12,background:subbg,borderRadius:14,padding:4,border:`1px solid ${border}`}}>
          {["expenses","recurring","pot"].map(t=>(
            <button key={t}onClick={()=>{setTab(t);window.scrollTo({top:0,behavior:"smooth"});}}style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:tab===t?cardBg:"transparent",color:tab===t?textMain:textMute,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              {t==="recurring"?<><RepeatIcon/>Recurring</>:t==="pot"?<><PotTabIcon/>My Pot</>:"Expenses"}
            </button>
          ))}
        </div>

        {/* ══ EXPENSES ══ */}
        {tab==="expenses"&&(
          <>
            <div style={cardStyle}>
              <h2 style={{margin:"0 0 12px",fontSize:14,fontWeight:600}}>{editingId?"Edit Expense":"Add Expense"}</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <input type="number"value={amount}onChange={e=>setAmount(e.target.value)}placeholder="Amount (₹)"style={inputStyle}/>
                <select value={selCat}onChange={e=>setSelCat(e.target.value)}style={inputStyle}>{categories.map(c=><option key={c.name}value={c.name}>{c.name}</option>)}</select>
              </div>
              <input type="date"value={date}onChange={e=>setDate(e.target.value)}style={{...inputStyle,marginBottom:8}}/>
              <input value={note}onChange={e=>setNote(e.target.value)}placeholder="Note (optional)"style={{...inputStyle,marginBottom:10}}/>
              <p style={{margin:"0 0 6px",fontSize:12,color:textMute,fontWeight:500}}>Pay from</p>
              <SourcePill value={paySource}onChange={setPaySource}dark={dark}subbg={subbg}border={border}textMute={textMute}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={saveExpense}style={{...btnPrimary,flex:1}}>{editingId?"Update":"Add Expense"}</button>
                {editingId&&<button onClick={resetForm}style={btnSecondary}>Cancel</button>}
                {!addingCat
                  ?<button onClick={()=>setAddingCat(true)}style={{...btnSecondary,padding:"8px 12px",display:"flex",alignItems:"center",gap:4}}><GridIcon/>Cat</button>
                  :<div style={{display:"flex",gap:4}}><input value={newCatName}onChange={e=>setNewCatName(e.target.value)}placeholder="Name"onKeyDown={e=>e.key==="Enter"&&addCategory()}style={{...inputStyle,width:100}}/><button onClick={addCategory}style={btnPrimary}>Add</button><button onClick={()=>setAddingCat(false)}style={btnSecondary}>✕</button></div>
                }
              </div>
            </div>
            {expenses.length===0
              ?<div style={{...cardStyle,textAlign:"center",padding:40}}><p style={{color:textMute,margin:0}}>No expenses yet.</p></div>
              :<div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${border}`}}><h2 style={{margin:0,fontSize:14,fontWeight:600}}>All Expenses</h2></div>
                {Object.keys(grouped).map(dk=>{
                  const daySpend=dailyTotal[dk]||0;
                  return(
                    <div key={dk}>
                      <div style={{padding:"6px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:subbg,borderBottom:`1px solid ${border}`}}>
                        <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute}}>{formatDate(dk)}</span>
                        <span style={{fontSize:12,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444",background:dark?"rgba(239,68,68,0.1)":"#fff1f2",padding:"1px 8px",borderRadius:99}}>−₹{daySpend.toLocaleString()}</span>
                      </div>
                      {grouped[dk].map(item=>(
                        <div key={item.id}style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:`1px solid ${border}`}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{...getCatStyle(item.category),padding:"3px 9px",borderRadius:99,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}onClick={()=>setDrillCat(item.category)}>{item.category}</span>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <p style={{margin:0,fontSize:14,fontWeight:700}}>₹{item.amount.toLocaleString()}</p>
                                <span style={{display:"flex",alignItems:"center",gap:2,fontSize:10,fontWeight:600,padding:"1px 5px",borderRadius:6,background:item.paySource==="cash"?(dark?"#052e16":"#dcfce7"):(dark?"#172554":"#dbeafe"),color:item.paySource==="cash"?(dark?"#86efac":"#16a34a"):(dark?"#93c5fd":"#2563eb")}}>
                                  {item.paySource==="cash"?<CashIcon/>:<BankIcon/>}{item.paySource==="cash"?"Cash":"Bank"}
                                </span>
                              </div>
                              {item.note&&<p style={{margin:0,fontSize:12,color:textMute}}>{item.note}</p>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:10}}>
                            <button onClick={()=>editExpense(item)}style={btnDanger}><EditIcon/></button>
                            <button onClick={()=>deleteExpense(item.id)}style={btnDanger}><TrashIcon/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            }
          </>
        )}

        {/* ══ RECURRING ══ */}
        {tab==="recurring"&&(
          <>
            {showRForm
              ?<div style={cardStyle}>
                <h2 style={{margin:"0 0 12px",fontSize:14,fontWeight:600}}>{rEditId?"Edit":"New Recurring Payment"}</h2>
                <input value={rName}onChange={e=>setRName(e.target.value)}placeholder="Name (e.g. Rent, Netflix)"style={{...inputStyle,marginBottom:8}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input type="number"value={rAmount}onChange={e=>setRAmount(e.target.value)}placeholder="Amount ₹"style={inputStyle}/>
                  <select value={rCat}onChange={e=>setRCat(e.target.value)}style={inputStyle}>{categories.map(c=><option key={c.name}value={c.name}>{c.name}</option>)}</select>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <select value={rFreq}onChange={e=>setRFreq(e.target.value)}style={inputStyle}>{RECUR_FREQ.map(f=><option key={f}>{f}</option>)}</select>
                  <div>
                    <p style={{margin:"0 0 4px",fontSize:11,color:textMute,fontWeight:500}}>Due date</p>
                    <input type="date"value={rDueDate}onChange={e=>setRDueDate(e.target.value)}style={inputStyle}/>
                  </div>
                </div>
                <p style={{margin:"0 0 10px",fontSize:11,color:textMute}}>Reminders will appear 3 days before and repeat daily until paid or overdue.</p>
                <div style={{display:"flex",gap:8}}><button onClick={saveRecurring}style={{...btnPrimary,flex:1}}>{rEditId?"Update":"Add"}</button><button onClick={resetRForm}style={btnSecondary}>Cancel</button></div>
              </div>
              :<button onClick={()=>setShowRForm(true)}style={{...btnPrimary,width:"100%",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><PlusIcon/>Add Recurring Payment</button>
            }
            {recurring.length===0
              ?<div style={{...cardStyle,textAlign:"center",padding:40}}><p style={{color:textMute,margin:0}}>No recurring payments yet.</p><p style={{color:textMute,fontSize:12,margin:"4px 0 0"}}>Add rent, subscriptions, bills here.</p></div>
              :<div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,overflow:"hidden"}}>
                {recurring.map((r,i)=>{
                  const days=daysFromToday(r.nextDue);
                  const isOverdue=days<0;
                  const isDueToday=days===0;
                  const dueSoon=days<=3&&days>=0;
                  const paidTM=(r.paid||[]).some(d=>{const pd=new Date(d+"T00:00:00");return pd.getMonth()===ist.getMonth()&&pd.getFullYear()===ist.getFullYear();});
                  return(
                    <div key={r.id}style={{padding:"14px 16px",borderBottom:i<recurring.length-1?`1px solid ${border}`:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                            <span style={{fontSize:15,fontWeight:700}}>{r.name}</span>
                            <span style={{...getCatStyle(r.category),padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600}}>{r.category}</span>
                            {isOverdue&&!paidTM&&<span style={{background:"#fef2f2",color:"#dc2626",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700,border:"1px solid #fca5a5"}}>{Math.abs(days)}d overdue</span>}
                            {isDueToday&&!paidTM&&!isOverdue&&<span style={{background:"#fff7ed",color:"#ea580c",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700}}>Due today</span>}
                            {dueSoon&&!isDueToday&&!paidTM&&<span style={{background:"#fffbeb",color:"#ca8a04",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600}}>Due in {days}d</span>}
                            {paidTM&&<span style={{background:dark?"#052e16":"#d1fae5",color:dark?"#34d399":"#065f46",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:3}}><CheckIcon/>Paid</span>}
                          </div>
                          <div style={{display:"flex",gap:16,fontSize:12,color:textMute}}><span>₹{r.amount.toLocaleString()} / {r.frequency}</span><span>Next: {formatDate(r.nextDue)}</span></div>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                          {!paidTM&&<><button onClick={()=>markPaid(r,"bank")}style={{...btnGreen,fontSize:11}}><BankIcon/>Bank</button><button onClick={()=>markPaid(r,"cash")}style={{...btnGold,fontSize:11}}><CashIcon/>Cash</button></>}
                          <button onClick={()=>editRecurring(r)}style={btnDanger}><EditIcon/></button>
                          <button onClick={()=>deleteRecurring(r.id)}style={btnDanger}><TrashIcon/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </>
        )}

        {/* ══ POT TAB ══ */}
        {tab==="pot"&&(
          <>
            <div style={{display:"flex",gap:4,marginBottom:12,background:subbg,borderRadius:12,padding:4,border:`1px solid ${border}`}}>
              {[["usable","Usable Money"],["networth","Net Worth"],["income","Income"]].map(([k,label])=>(
                <button key={k}onClick={()=>setPotSection(k)}style={{flex:1,padding:"7px 0",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:potSection===k?cardBg:"transparent",color:potSection===k?textMain:textMute,boxShadow:potSection===k?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.2s"}}>{label}</button>
              ))}
            </div>

            {/* USABLE */}
            {potSection==="usable"&&(
              <>
                <div style={{...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1c1410)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:dark?"1px solid #292117":"1px solid #fde68a",display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10}}>
                  <UsablePot fillPercent={usableFillPct}amount={usableTotal}dark={dark}size="lg"/>
                  <div style={{width:"100%",maxWidth:280}}><div style={{width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#fde68a"}}><div style={{height:8,borderRadius:99,width:`${usableFillPct}%`,background:"linear-gradient(to right,#f97316,#fbbf24)",transition:"width 0.7s ease"}}/></div></div>
                </div>
                {/* Cash in Hand row */}
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:cashMode?10:0}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:"#16a34a"}}/>
                    <span style={{flex:1,fontSize:14,fontWeight:600}}>Cash in Hand</span>
                    <span style={{fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#16a34a"}}><span style={{fontSize:12,color:textMute}}>₹</span>{(Number(pot.usableCash)||0).toLocaleString()}</span>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setCashMode(cashMode==="add"?null:"add")} style={{width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:cashMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1}}>+</button>
                      <button onClick={()=>setCashMode(cashMode==="minus"?null:"minus")} style={{width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:cashMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1}}>−</button>
                    </div>
                  </div>
                  {cashMode&&(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input type="number" value={cashAdj} onChange={e=>setCashAdj(e.target.value)} placeholder={`₹ to ${cashMode}`} style={{...inputStyle,flex:1}} autoFocus onKeyDown={e=>{if(e.key==="Enter"){quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null);}}}/>
                      <button onClick={()=>{quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null);}} style={{...btnPrimary,padding:"8px 14px",background:cashMode==="add"?"#16a34a":"#dc2626"}}>{cashMode==="add"?"+":"−"}</button>
                      <button onClick={()=>{setCashMode(null);setCashAdj("");}} style={{...btnSecondary,padding:"8px 10px"}}>✕</button>
                    </div>
                  )}
                </div>
                {/* Bank Balance row */}
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:bankMode?10:0}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:"#2563eb"}}/>
                    <span style={{flex:1,fontSize:14,fontWeight:600}}>Bank Balance</span>
                    <span style={{fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#2563eb"}}><span style={{fontSize:12,color:textMute}}>₹</span>{(Number(pot.usableBank)||0).toLocaleString()}</span>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setBankMode(bankMode==="add"?null:"add")} style={{width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bankMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:bankMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1}}>+</button>
                      <button onClick={()=>setBankMode(bankMode==="minus"?null:"minus")} style={{width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bankMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:bankMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1}}>−</button>
                    </div>
                  </div>
                  {bankMode&&(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input type="number" value={bankAdj} onChange={e=>setBankAdj(e.target.value)} placeholder={`₹ to ${bankMode}`} style={{...inputStyle,flex:1}} autoFocus onKeyDown={e=>{if(e.key==="Enter"){quickAdjust("usableBank",bankMode,bankAdj);setBankAdj("");setBankMode(null);}}}/>
                      <button onClick={()=>{quickAdjust("usableBank",bankMode,bankAdj);setBankAdj("");setBankMode(null);}} style={{...btnPrimary,padding:"8px 14px",background:bankMode==="add"?"#16a34a":"#dc2626"}}>{bankMode==="add"?"+":"−"}</button>
                      <button onClick={()=>{setBankMode(null);setBankAdj("");}} style={{...btnSecondary,padding:"8px 10px"}}>✕</button>
                    </div>
                  )}
                </div>
                <div style={{...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:textMute}}>Total Usable</span><span style={{fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"'DM Mono',monospace"}}>₹{usableTotal.toLocaleString()}</span></div>
                <div style={{...cardStyle,background:dark?"#0a1628":"#f0fdf4",border:dark?"1px solid #1e3a5f":"1px solid #bbf7d0"}}>
                  <p style={{margin:"0 0 4px",fontSize:12,color:textMute}}>After all expenses this month</p>
                  <p style={{margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal-monthlyTotal>=0?"#16a34a":"#ef4444"}}>₹{(usableTotal-monthlyTotal).toLocaleString()}</p>
                  <p style={{margin:"4px 0 0",fontSize:11,color:textMute}}>Spent ₹{monthlyTotal.toLocaleString()} this month</p>
                </div>
              </>
            )}

            {/* NET WORTH */}
            {potSection==="networth"&&(
              <>
                <div style={{...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1a1028)":"linear-gradient(135deg,#faf5ff,#ede9fe)",border:dark?"1px solid #2e1065":"1px solid #ddd6fe",display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10}}>
                  <NetWorthPot fillPercent={nwFillActual}amount={netWorthTotal}dark={dark}/>
                  <div style={{width:"100%",maxWidth:280}}><div style={{width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#ddd6fe"}}><div style={{height:8,borderRadius:99,width:`${nwFillActual}%`,background:"linear-gradient(to right,#7c3aed,#a78bfa)",transition:"width 0.7s ease"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:textMute,marginTop:5}}><span>Usable ₹{usableTotal.toLocaleString()}</span><span>Total ₹{netWorthTotal.toLocaleString()}</span></div></div>
                </div>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}><TrendingUpIcon/><span style={{fontSize:14,fontWeight:700}}>Breakdown</span></div>
                  {[["usableCash","Cash in Hand","#16a34a"],["usableBank","Bank Balance","#2563eb"],["savings","Savings / FD","#7c3aed"],["investments","Investments (MF/Stocks)","#db2777"],["gold","Gold / Assets","#d97706"]].map(([field,label,color])=>(
                    <div key={field}style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:13}}>{label}</span>
                      <span style={{fontSize:13,fontWeight:700,color,minWidth:90,textAlign:"right"}}>₹{(Number(pot[field])||0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4,borderTop:`1px solid ${border}`}}><span style={{fontSize:13,color:textMute,fontWeight:600}}>Total Net Worth</span><span style={{fontSize:20,fontWeight:800,color:"#7c3aed",fontFamily:"'DM Mono',monospace"}}>₹{netWorthTotal.toLocaleString()}</span></div>
                </div>
                <div style={cardStyle}>
                  <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700}}>Update Savings / Investments / Gold</p>
                  <p style={{margin:"0 0 12px",fontSize:11,color:textMute}}>Increasing these deducts from your bank balance</p>
                  {[["savings","Savings / FD","#7c3aed"],["investments","Investments","#db2777"],["gold","Gold / Assets","#d97706"]].map(([field,label,color])=>(
                    <div key={field}style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:13}}>{label}</span>
                      <input type="number"value={pot[field]||""}onChange={e=>updateNWField(field,e.target.value)}placeholder="₹0"style={{...inputStyle,width:130,textAlign:"right",fontWeight:700,color}}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* INCOME */}
            {potSection==="income"&&(
              <>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}><RepeatIcon/><span style={{fontSize:14,fontWeight:700}}>Recurring Income</span><span style={{fontSize:16,fontWeight:700,color:"#16a34a",marginLeft:"auto",fontFamily:"'DM Mono',monospace"}}>₹{monthlyIncome.toLocaleString()}<span style={{fontSize:11,color:textMute,fontWeight:400}}>/mo</span></span></div>
                  {(pot.incomes||[]).map(inc=>(
                    <div key={inc.id}style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${border}`}}>
                      <div style={{flex:1}}><p style={{margin:0,fontSize:14,fontWeight:600}}>{inc.label}</p><p style={{margin:0,fontSize:12,color:textMute}}>₹{inc.amount.toLocaleString()} / {inc.frequency}</p></div>
                      <button onClick={()=>creditIncome(inc)}style={btnGold}><ZapIcon/>Credit</button>
                      <button onClick={()=>editIncome(inc)}style={btnDanger}><EditIcon/></button>
                      <button onClick={()=>deleteIncome(inc.id)}style={btnDanger}><TrashIcon/></button>
                    </div>
                  ))}
                  {showIncomeForm
                    ?<div style={{paddingTop:8,borderTop:`1px solid ${border}`}}>
                      <input value={incName}onChange={e=>setIncName(e.target.value)}placeholder="Source (e.g. Salary)"style={{...inputStyle,marginBottom:8}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <input type="number"value={incAmt}onChange={e=>setIncAmt(e.target.value)}placeholder="Amount ₹"style={inputStyle}/>
                        <select value={incFreq}onChange={e=>setIncFreq(e.target.value)}style={inputStyle}>{RECUR_FREQ.map(f=><option key={f}>{f}</option>)}</select>
                      </div>
                      <div style={{display:"flex",gap:8}}><button onClick={saveIncome}style={{...btnPrimary,flex:1}}>{incEditId?"Update":"Add"}</button><button onClick={resetIncomeForm}style={btnSecondary}>Cancel</button></div>
                    </div>
                    :<button onClick={()=>setShowIncomeForm(true)}style={{...btnSecondary,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4}}><PlusIcon/>Add Income Source</button>
                  }
                </div>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}><PiggyIcon/><span style={{fontSize:14,fontWeight:700}}>Extra Earnings</span><span style={{fontSize:11,color:textMute,marginLeft:4}}>one-time</span></div>
                  {(pot.extras||[]).length===0&&!showExtraForm&&<p style={{margin:"0 0 8px",fontSize:13,color:textMute}}>No extra earnings logged yet.</p>}
                  {(pot.extras||[]).map(ex=>(
                    <div key={ex.id}style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${border}`}}>
                      <div style={{flex:1}}><p style={{margin:0,fontSize:13,fontWeight:600}}>{ex.label}</p><p style={{margin:0,fontSize:11,color:textMute}}>{formatDate(ex.date)}</p></div>
                      <span style={{fontSize:14,fontWeight:700,color:"#16a34a"}}>+₹{ex.amount.toLocaleString()}</span>
                      <button onClick={()=>deleteExtra(ex.id)}style={btnDanger}><TrashIcon/></button>
                    </div>
                  ))}
                  {showExtraForm
                    ?<div style={{paddingTop:8,borderTop:`1px solid ${border}`}}>
                      <input value={extraLabel}onChange={e=>setExtraLabel(e.target.value)}placeholder="Label (e.g. Bonus, Freelance)"style={{...inputStyle,marginBottom:8}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <input type="number"value={extraAmt}onChange={e=>setExtraAmt(e.target.value)}placeholder="Amount ₹"style={inputStyle}/>
                        <input type="date"value={extraDate}onChange={e=>setExtraDate(e.target.value)}style={inputStyle}/>
                      </div>
                      <div style={{display:"flex",gap:8}}><button onClick={saveExtra}style={{...btnPrimary,flex:1}}>Add to Pot</button><button onClick={()=>setShowExtraForm(false)}style={btnSecondary}>Cancel</button></div>
                    </div>
                    :<button onClick={()=>setShowExtraForm(true)}style={{...btnSecondary,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><PlusIcon/>Log Extra Earning</button>
                  }
                </div>
              </>
            )}
          </>
        )}

        <p style={{textAlign:"center",fontSize:12,color:textMute,marginTop:24}}>mySpendr · your money, your streak</p>
      </div>
    </div>
  );
}
