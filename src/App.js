import { useState, useEffect, useRef, useMemo } from "react";

const STORAGE_KEY   = "myspendr_expenses_v3";
const BUDGET_KEY    = "myspendr_budget_v3";
const CATEGORY_KEY  = "myspendr_categories_v3";
const STREAK_KEY    = "myspendr_streak_v3";
const THEME_KEY     = "myspendr_theme_v3";
const RECURRING_KEY = "myspendr_recurring_v1";
const POT_KEY       = "myspendr_pot_v3";
const DISMISS_KEY   = "myspendr_dismiss_v1";
const PIN_KEY       = "myspendr_pin_v1";
const NOTIF_KEY     = "myspendr_notif_v1";

function getTodayIST() {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().split("T")[0];
}

const RECUR_FREQ = ["Monthly","Weekly","Yearly"];
const MAX_AMOUNT = 10_000_000;

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
  goldGrams:0,goldRate:0,goldRateUpdatedOn:null,
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
function TrendingUpIcon(){return<svg width="16"height="16"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;}
function PiggyIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M19 8a7 7 0 0 0-14 0c0 2.5 1.3 4.7 3.3 6L8 20h8l-.3-6A7 7 0 0 0 19 8z"/><line x1="12"y1="2"x2="12"y2="4"/><line x1="8"y1="20"x2="16"y2="20"/></svg>;}
function ZapIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;}
function BankIcon(){return<svg width="13"height="13"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><line x1="3"y1="22"x2="21"y2="22"/><line x1="6"y1="18"x2="6"y2="11"/><line x1="10"y1="18"x2="10"y2="11"/><line x1="14"y1="18"x2="14"y2="11"/><line x1="18"y1="18"x2="18"y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;}
function CashIcon(){return<svg width="13"height="13"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><rect x="1"y="4"width="22"height="16"rx="2"/><line x1="1"y1="10"x2="23"y2="10"/></svg>;}
function ChevronLeftIcon(){return<svg width="18"height="18"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;}
function GridIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><rect x="3"y="3"width="7"height="7"/><rect x="14"y="3"width="7"height="7"/><rect x="3"y="14"width="7"height="7"/><rect x="14"y="14"width="7"height="7"/></svg>;}
function BellIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;}
function XIcon(){return<svg width="14"height="14"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><line x1="18"y1="6"x2="6"y2="18"/><line x1="6"y1="6"x2="18"y2="18"/></svg>;}
function AlertIcon(){return<svg width="15"height="15"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><polygon points="10.29 3.86 1.82 18 22.18 18"/><line x1="12"y1="9"x2="12"y2="13"/><line x1="12"y1="17"x2="12.01"y2="17"/></svg>;}

/* ════ GOLD POT SVG ════ */
function MoneyBag({fillPercent,size="md"}){
  const clamp=Math.max(0,Math.min(100,fillPercent));
  const fontSize=size==="sm"?52:size==="lg"?96:72;
  const barColor=clamp<=20?"#ef4444":clamp<=40?"#f97316":clamp<=60?"#f59e0b":"#fbbf24";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      <style>{`@keyframes _bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes _pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}.mbob{animation:_bob 2s ease-in-out infinite}.mpulse{animation:_pulse 2s ease-in-out infinite}`}</style>
      <div className="mbob" style={{fontSize,lineHeight:1,userSelect:"none"}}>💰</div>
      <div style={{width:size==="sm"?60:size==="lg"?100:80,height:5,borderRadius:99,background:"rgba(0,0,0,0.08)",overflow:"hidden"}}>
        <div style={{height:5,borderRadius:99,width:`${clamp}%`,background:barColor,transition:"width 0.6s ease"}}/>
      </div>
    </div>
  );
}
function UsablePot({fillPercent,amount,dark,size="md"}){
  const c=Math.max(0,Math.min(100,fillPercent));
  const col=c<=20?"#ef4444":c<=40?"#f97316":"#f59e0b";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <MoneyBag fillPercent={fillPercent} size={size}/>
      <div className="mpulse" style={{fontSize:size==="sm"?20:26,fontWeight:800,fontFamily:"'DM Mono',monospace",color:col,letterSpacing:"-1px",lineHeight:1,textAlign:"center"}}>
        ₹{amount<0?"-":""}{Math.abs(amount).toLocaleString()}
      </div>
    </div>
  );
}
function NetWorthPot({fillPercent,amount}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <MoneyBag fillPercent={fillPercent} size="lg"/>
      <div className="mpulse" style={{fontSize:30,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#7c3aed",letterSpacing:"-1.5px",lineHeight:1,textAlign:"center"}}>
        ₹{Math.abs(amount).toLocaleString()}
      </div>
    </div>
  );
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

/* ════ REMINDER BANNER ════ */
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
  if(isNaN(d.getTime()))return startDate;
  const now=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  let guard=0;
  while(d<=now && guard++<1000){
    if(freq==="Weekly")d.setDate(d.getDate()+7);
    else if(freq==="Monthly")d.setMonth(d.getMonth()+1);
    else if(freq==="Yearly")d.setFullYear(d.getFullYear()+1);
    else break;
  }
  return d.toISOString().split("T")[0];
}

function daysFromToday(dateStr){
  const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  ist.setHours(0,0,0,0);
  const d=new Date(dateStr+"T00:00:00");
  return Math.round((d-ist)/86400000);
}

/* ════ BIOMETRIC HELPERS ════ */
const BIO_CRED_KEY = "myspendr_bio_cred_v1";

function bufferToBase64(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuffer(b64){
  const bin=atob(b64);
  const buf=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
  return buf.buffer;
}
function saveBioCred(id){try{localStorage.setItem(BIO_CRED_KEY,bufferToBase64(id));}catch{}}
function loadBioCred(){try{const s=localStorage.getItem(BIO_CRED_KEY);return s?base64ToBuffer(s):null;}catch{return null;}}

async function isBiometricAvailable(){
  if(!window.PublicKeyCredential)return false;
  try{return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();}
  catch{return false;}
}

async function registerBiometric(){
  const cred=await navigator.credentials.create({
    publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rp:{name:"mySpendr",id:window.location.hostname||"localhost"},
      user:{
        id:crypto.getRandomValues(new Uint8Array(16)),
        name:"myspendr-user",
        displayName:"mySpendr User",
      },
      pubKeyCredParams:[
        {type:"public-key",alg:-7},
        {type:"public-key",alg:-257},
      ],
      authenticatorSelection:{
        authenticatorAttachment:"platform",
        userVerification:"required",
        residentKey:"preferred",
      },
      timeout:60000,
    },
  });
  saveBioCred(cred.rawId);
  return true;
}

async function verifyBiometric(){
  const credId=loadBioCred();
  if(!credId)throw new Error("no-cred");
  await navigator.credentials.get({
    publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rpId:window.location.hostname||"localhost",
      allowCredentials:[{type:"public-key",id:credId}],
      userVerification:"required",
      timeout:60000,
    },
  });
  return true;
}

/* ════ PIN LOCK ════ */
function PinLock({onUnlock,dark}){
  const savedPin=()=>{try{return localStorage.getItem(PIN_KEY)||"";}catch{return "";}};
  const hasPin=savedPin().length===4;
  const hasCred=!!loadBioCred();

  const[mode,setMode]=useState(hasPin?"enter":"setup");
  const[digits,setDigits]=useState([]);
  const[tempPin,setTempPin]=useState("");
  const[shake,setShake]=useState(false);
  const[bioAvail,setBioAvail]=useState(false);
  const[bioError,setBioError]=useState("");
  const[bioLoading,setBioLoading]=useState(false);
  const[offerBioSetup,setOfferBioSetup]=useState(false);

  useEffect(()=>{isBiometricAvailable().then(setBioAvail);},[]);

  // Auto-trigger verify on enter screen when a credential is already registered
  useEffect(()=>{
    if(mode==="enter"&&bioAvail&&hasCred)tryVerify();
  },[mode,bioAvail]); // eslint-disable-line

  async function tryVerify(){
    setBioError("");setBioLoading(true);
    try{await verifyBiometric();onUnlock();}
    catch(e){
      if(e.message==="no-cred"){setBioError("No biometric registered — use PIN");}
      else if(e.name==="NotAllowedError"){setBioError("");}// silent cancel
      else{setBioError("Biometric failed — use PIN");}
    }finally{setBioLoading(false);}
  }

  async function tryRegister(){
    setBioError("");setBioLoading(true);
    try{
      await registerBiometric();
      setOfferBioSetup(false);
      onUnlock();
    }catch(e){
      // User declined or device error — just unlock anyway, PIN still works
      setOfferBioSetup(false);
      onUnlock();
    }finally{setBioLoading(false);}
  }

  function press(d){
    if(digits.length>=4)return;
    const next=[...digits,d];
    setDigits(next);
    if(next.length===4)setTimeout(()=>submit(next),120);
  }
  function del(){setDigits(p=>p.slice(0,-1));}

  function submit(entered){
    const pin=entered.join("");
    if(mode==="setup"){
      setTempPin(pin);setDigits([]);setMode("confirm");
    } else if(mode==="confirm"){
      if(pin===tempPin){
        try{localStorage.setItem(PIN_KEY,pin);}catch{}
        // After confirming PIN, offer biometric setup if available and not yet registered
        if(bioAvail&&!loadBioCred()){setOfferBioSetup(true);}
        else{onUnlock();}
      } else {
        setShake(true);setDigits([]);
        setTimeout(()=>setShake(false),500);
      }
    } else {
      if(pin===savedPin()){onUnlock();}
      else{setShake(true);setDigits([]);setTimeout(()=>setShake(false),500);}
    }
  }

  const bg=dark?"#030712":"#f8fafc";
  const card=dark?"#111827":"#ffffff";
  const textMain=dark?"#f9fafb":"#111827";
  const textMute=dark?"#6b7280":"#9ca3af";

  /* ── Biometric setup offer screen ── */
  if(offerBioSetup){
    return(
      <div style={{minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
        <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{fontSize:56}}>🔑</div>
          <h1 style={{margin:0,fontSize:22,fontWeight:700,color:textMain,textAlign:"center",letterSpacing:"-0.5px"}}>Enable Face ID / Fingerprint?</h1>
          <p style={{margin:"0 0 24px",fontSize:13,color:textMute,textAlign:"center",lineHeight:1.6}}>Skip the PIN next time and unlock instantly with your device biometrics.</p>
          {bioError&&<p style={{margin:"0 0 8px",fontSize:12,color:"#ef4444",textAlign:"center"}}>{bioError}</p>}
          <button
            onClick={tryRegister}
            disabled={bioLoading}
            style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"#4f46e5",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",opacity:bioLoading?0.7:1}}
          >{bioLoading?"Setting up…":"Enable Biometrics"}</button>
          <button
            onClick={()=>{setOfferBioSetup(false);onUnlock();}}
            style={{background:"none",border:"none",cursor:"pointer",color:textMute,fontSize:13,textDecoration:"underline"}}
          >Skip for now</button>
        </div>
      </div>
    );
  }

  const title=mode==="setup"?"Set a PIN":mode==="confirm"?"Confirm PIN":"Welcome back";
  const subtitle=mode==="setup"?"Choose a 4-digit PIN to secure your data"
    :mode==="confirm"?"Re-enter your PIN to confirm"
    :hasCred?"Unlock with biometrics or enter your PIN"
    :"Enter your PIN to continue";

  return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <div style={{fontSize:48,marginBottom:4}}>🔐</div>
        <h1 style={{margin:0,fontSize:22,fontWeight:700,color:textMain,letterSpacing:"-0.5px"}}>{title}</h1>
        <p style={{margin:"0 0 28px",fontSize:13,color:textMute,textAlign:"center"}}>{subtitle}</p>

        <div style={{display:"flex",gap:14,marginBottom:32,animation:shake?"shake 0.4s ease":"none"}}>
          <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{
              width:14,height:14,borderRadius:"50%",
              background:digits.length>i?"#4f46e5":(dark?"#1f2937":"#e5e7eb"),
              border:`2px solid ${digits.length>i?"#4f46e5":(dark?"#374151":"#d1d5db")}`,
              transition:"background 0.15s,border-color 0.15s",
            }}/>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:"100%",maxWidth:280}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
            k===""
              ?<div key={i}/>
              :<button key={i} onClick={()=>k==="⌫"?del():press(k)}
                style={{
                  height:64,borderRadius:16,border:`1px solid ${dark?"#1f2937":"#e5e7eb"}`,
                  background:k==="⌫"?(dark?"#1f2937":"#f3f4f6"):card,
                  color:textMain,fontSize:k==="⌫"?20:22,fontWeight:600,
                  cursor:"pointer",transition:"background 0.1s",
                  fontFamily:"'DM Mono',monospace",
                }}
              >{k}</button>
          ))}
        </div>

        {/* Biometric button — shown on enter screen whenever device supports it */}
        {mode==="enter"&&bioAvail&&(
          <button
            onClick={tryVerify}
            disabled={bioLoading}
            style={{
              marginTop:20,display:"flex",alignItems:"center",gap:8,
              background:"none",border:`1px solid ${dark?"#374151":"#e5e7eb"}`,
              borderRadius:12,padding:"10px 20px",cursor:"pointer",
              color:dark?"#9ca3af":"#6b7280",fontSize:13,fontWeight:500,
              opacity:bioLoading?0.6:1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839-1.132c.09-.52.138-1.05.138-1.587 0-3.038-1.362-5.762-3.509-7.6"/>
            </svg>
            {bioLoading?"Verifying…":hasCred?"Use Face ID / Fingerprint":"Set up Biometrics"}
          </button>
        )}
        {bioError&&<p style={{margin:"8px 0 0",fontSize:12,color:"#ef4444",textAlign:"center"}}>{bioError}</p>}

        {mode==="setup"&&(
          <button onClick={onUnlock} style={{marginTop:16,background:"none",border:"none",cursor:"pointer",color:textMute,fontSize:12,textDecoration:"underline"}}>Skip for now</button>
        )}
      </div>
    </div>
  );
}

/* ════ NOTIFICATION HELPERS ════ */
async function requestNotifPermission(){
  if(!("Notification" in window))return false;
  if(Notification.permission==="granted")return true;
  const result=await Notification.requestPermission();
  return result==="granted";
}
function scheduleReminderNotifs(recurring,dismissedMap){
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  const today=getTodayIST();
  recurring.forEach(r=>{
    const days=daysFromToday(r.nextDue);
    if(days>3||days<0)return;
    if(dismissedMap[r.id]===today)return;
    try{
      new Notification(`mySpendr: ${r.name}`,{
        body:`₹${r.amount.toLocaleString()} ${days===0?"due today":`due in ${days} day${days===1?"":"s"}`}`,
        icon:"/favicon.ico",
        tag:`myspendr-reminder-${r.id}`,
      });
    }catch{}
  });
}

/* ════ CATEGORY BUBBLES ════ */
function CategoryBubbles({categories,catTotals,getCatStyle,getCatAccent,onSelect,dark,cardBg,border,textMute,subbg}){
  const[open,setOpen]=useState(false);
  const[hovered,setHovered]=useState(null);
  const[animated,setAnimated]=useState(false);
  const totalSpent=Object.values(catTotals).reduce((s,v)=>s+v,0);
  const sorted=useMemo(()=>[...categories].sort((a,b)=>(catTotals[b.name]||0)-(catTotals[a.name]||0)),[categories,catTotals]);

  useEffect(()=>{
    if(open){const t=setTimeout(()=>setAnimated(true),50);return()=>clearTimeout(t);}
    else setAnimated(false);
  },[open]);

  const R=72,SW=24,CX=90,CY=90;
  const circ=2*Math.PI*R;
  const slices=sorted.filter(c=>catTotals[c.name]>0).map(c=>({name:c.name,value:catTotals[c.name],accent:getCatAccent(c.name)}));
  let cumPct=0;
  const segments=slices.map(s=>{
    const pct=s.value/totalSpent;
    const offset=circ*(1-cumPct);
    const dash=animated?circ*pct:0;
    cumPct+=pct;
    return{...s,pct,dash,offset};
  });
  const active=hovered?segments.find(s=>s.name===hovered):null;
  const displayVal=active?active.value:totalSpent;
  const displayLabel=active?active.name:"Total";

  return(
    <div style={{marginBottom:12}}>
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:cardBg,border:`1px solid ${border}`,borderRadius:open?"16px 16px 0 0":16,padding:"10px 14px",cursor:"pointer"}}
      >
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827"}}>Categories</span>
          {totalSpent>0&&<span style={{fontSize:12,color:textMute}}>₹{totalSpent.toLocaleString()} total</span>}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open&&(
        <div style={{background:cardBg,border:`1px solid ${border}`,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"12px 14px 14px"}}>
          {totalSpent>0&&(
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${dark?"#1f2937":"#f3f4f6"}`}}>
              <svg width="180" height="180" viewBox="0 0 180 180" style={{flexShrink:0,overflow:"visible"}}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke={dark?"#1f2937":"#f3f4f6"} strokeWidth={SW}/>
                {segments.map(seg=>(
                  <circle key={seg.name} cx={CX} cy={CY} r={R} fill="none"
                    stroke={seg.accent}
                    strokeWidth={hovered===seg.name?SW+5:SW}
                    strokeDasharray={`${seg.dash} ${circ}`}
                    strokeDashoffset={seg.offset}
                    strokeLinecap="butt"
                    style={{transform:"rotate(-90deg)",transformOrigin:`${CX}px ${CY}px`,transition:"stroke-dasharray 0.6s ease,stroke-width 0.15s",cursor:"pointer"}}
                    onMouseEnter={()=>setHovered(seg.name)}
                    onMouseLeave={()=>setHovered(null)}
                    onClick={()=>{onSelect(seg.name);setOpen(false);}}
                  />
                ))}
                <text x={CX} y={CY-6} textAnchor="middle" style={{fontSize:10,fill:textMute,fontFamily:"DM Sans,sans-serif"}}>{displayLabel}</text>
                <text x={CX} y={CY+12} textAnchor="middle" style={{fontSize:15,fontWeight:700,fill:dark?"#f9fafb":"#111827",fontFamily:"DM Mono,monospace"}}>₹{displayVal.toLocaleString()}</text>
              </svg>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                {segments.map(seg=>(
                  <button key={seg.name}
                    onMouseEnter={()=>setHovered(seg.name)}
                    onMouseLeave={()=>setHovered(null)}
                    onClick={()=>{onSelect(seg.name);setOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:6,background:hovered===seg.name?(dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)"):"transparent",border:"none",borderRadius:8,padding:"3px 6px",cursor:"pointer",width:"100%",textAlign:"left"}}
                  >
                    <div style={{width:8,height:8,borderRadius:"50%",background:seg.accent,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:11,color:dark?"#d1d5db":"#374151",fontWeight:hovered===seg.name?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{seg.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:seg.accent,fontFamily:"'DM Mono',monospace"}}>{Math.round(seg.pct*100)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sorted.map(cat=>{
            const spent=catTotals[cat.name]||0;
            const pct=totalSpent>0?Math.round((spent/totalSpent)*100):0;
            const cs=getCatStyle(cat.name);
            const accent=getCatAccent(cat.name);
            return(
              <button
                key={cat.name}
                onClick={()=>{onSelect(cat.name);setOpen(false);}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 0",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${dark?"#1f2937":"#f3f4f6"}`}}
              >
                <span style={{...cs,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>
                  {cat.name[0]}
                </span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827"}}>{cat.name}</span>
                    <span style={{fontSize:12,fontWeight:700,color:accent,fontFamily:"'DM Mono',monospace"}}>
                      {spent>0?`₹${spent.toLocaleString()}`:"—"}
                    </span>
                  </div>
                  <div style={{width:"100%",height:5,borderRadius:99,background:dark?"#1f2937":"#f3f4f6",overflow:"hidden"}}>
                    <div style={{height:5,borderRadius:99,width:`${pct}%`,background:accent,transition:"width 0.5s ease"}}/>
                  </div>
                </div>
                <span style={{fontSize:11,color:textMute,minWidth:28,textAlign:"right"}}>{pct>0?`${pct}%`:""}</span>
              </button>
            );
          })}
          {sorted.every(c=>!(catTotals[c.name]))&&(
            <p style={{margin:0,fontSize:13,color:textMute,textAlign:"center",padding:"8px 0"}}>No expenses yet across any category.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   MAIN APP
════════════════════════════════════ */
export default function App(){
  const[unlocked,setUnlocked]=useState(false);
  const[notifEnabled,setNotifEnabled]=useState(()=>{
    try{return localStorage.getItem(NOTIF_KEY)==='true';}catch{return false;}
  });

  const [tick, setTick] = useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1), 60000);
    return ()=>clearInterval(id);
  },[]);

  // FIX: removed the exhaustive-deps eslint-disable comment that referenced
  // a plugin not installed. tick is the only dep needed here — getTodayIST()
  // is a pure function with no external deps that ESLint needs to track.
  const today = useMemo(()=>getTodayIST(),[tick]);

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
  const[dismissedMap,setDismissedMap]=useState(()=>{try{const s=localStorage.getItem(DISMISS_KEY);return s?JSON.parse(s):{};}catch{return{};}});

  const[amount,setAmount]=useState("");
  const[selCat,setSelCat]=useState("");
  const[note,setNote]=useState("");
  const[date,setDate]=useState(()=>getTodayIST());
  const[editingId,setEditingId]=useState(null);
  const[paySource,setPaySource]=useState("bank");
  const[budgetInput,setBudgetInput]=useState("");
  const[editingBudget,setEditingBudget]=useState(false);
  const[newCatName,setNewCatName]=useState("");
  const[addingCat,setAddingCat]=useState(false);
  const[toast,setToast]=useState(null);
  const[tab,setTab]=useState("expenses");
  const tabRef=useRef(null);
  const[drillCat,setDrillCat]=useState(null);

  const[rName,setRName]=useState("");
  const[rAmount,setRAmount]=useState("");
  const[rCat,setRCat]=useState("");
  const[rFreq,setRFreq]=useState("Monthly");
  const[rDueDate,setRDueDate]=useState(()=>getTodayIST());
  const[rEditId,setREditId]=useState(null);
  const[showRForm,setShowRForm]=useState(false);

  const[potSection,setPotSection]=useState("usable");
  const[potVisible,setPotVisible]=useState(false);
  const[cashAdj,setCashAdj]=useState("");
  const[cashMode,setCashMode]=useState(null);
  const[bankAdj,setBankAdj]=useState("");
  const[bankMode,setBankMode]=useState(null);
  const[goldRateInput,setGoldRateInput]=useState("");
  const[showGoldRateForm,setShowGoldRateForm]=useState(false);
  const[goldBannerDismissed,setGoldBannerDismissed]=useState(false);
  const[showIncomeForm,setShowIncomeForm]=useState(false);
  const[incName,setIncName]=useState("");
  const[incAmt,setIncAmt]=useState("");
  const[incFreq,setIncFreq]=useState("Monthly");
  const[incEditId,setIncEditId]=useState(null);
  const[showExtraForm,setShowExtraForm]=useState(false);
  const[extraLabel,setExtraLabel]=useState("");
  const[extraAmt,setExtraAmt]=useState("");
  const[extraDate,setExtraDate]=useState(()=>getTodayIST());

  const saveTimer = useRef({});
  function debouncedSave(key, value) {
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(() => {
      try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch {}
    }, 300);
  }

  useEffect(()=>{ debouncedSave(THEME_KEY, dark?"dark":"light"); },[dark]);
  useEffect(()=>{ debouncedSave(STORAGE_KEY, expenses); },[expenses]);
  useEffect(()=>{ debouncedSave(BUDGET_KEY, budget.toString()); },[budget]);
  useEffect(()=>{ debouncedSave(CATEGORY_KEY, categories); },[categories]);
  useEffect(()=>{ debouncedSave(STREAK_KEY, streak); },[streak]);
  useEffect(()=>{ debouncedSave(RECURRING_KEY, recurring); },[recurring]);
  useEffect(()=>{ debouncedSave(POT_KEY, pot); },[pot]);
  useEffect(()=>{ debouncedSave(DISMISS_KEY, dismissedMap); },[dismissedMap]);

  useEffect(()=>{if(!selCat&&categories.length>0)setSelCat(categories[0].name);},[categories,selCat]);
  useEffect(()=>{if(!rCat&&categories.length>0)setRCat(categories[0].name);},[categories,rCat]);

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(null),2500);}

  useEffect(()=>{
    try{localStorage.setItem(NOTIF_KEY,notifEnabled?'true':'false');}catch{}
    if(notifEnabled)scheduleReminderNotifs(recurring,dismissedMap);
  },[notifEnabled,recurring,dismissedMap]);

  async function toggleNotif(){
    if(!notifEnabled){
      const granted=await requestNotifPermission();
      if(granted){setNotifEnabled(true);showToast('Notifications on!');}
      else showToast('Permission denied — enable in browser settings');
    } else {
      setNotifEnabled(false);showToast('Notifications off');
    }
  }

  function resetPin(){
    try{localStorage.removeItem(PIN_KEY);}catch{}
    try{localStorage.removeItem(BIO_CRED_KEY);}catch{}
    setUnlocked(false);
    showToast('PIN & biometrics cleared — set a new PIN on next open');
  }

  function resetBiometric(){
    try{localStorage.removeItem(BIO_CRED_KEY);}catch{}
    showToast('Biometrics removed — will re-register on next PIN setup');
  }

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
  function deductPot(source,amt,p){
    const f=source==="cash"?"usableCash":"usableBank";
    const current=Number(p[f])||0;
    if(current<amt){
      // Allow it but the caller will see the clamped result — showToast can't be called here
      // so we return the negative to signal overdraft; UI clamps display to 0
    }
    return{...p,[f]:Math.max(0,current-amt)};
  }
  function refundPot(source,amt,p){const f=source==="cash"?"usableCash":"usableBank";return{...p,[f]:(Number(p[f])||0)+amt};}
  function quickAdjust(field,mode,val){const num=Number(val)||0;if(num<=0)return;setPot(p=>({...p,[field]:mode==="add"?(Number(p[field])||0)+num:Math.max(0,(Number(p[field])||0)-num)}));showToast(`${mode==="add"?"+":"-"}₹${num.toLocaleString()} ${field==="usableCash"?"cash":"bank"}`);}
  function updateNWField(field,val){const newVal=Number(val)||0;const oldVal=Number(pot[field])||0;const diff=newVal-oldVal;setPot(p=>{const nb=Math.max(0,(Number(p.usableBank)||0)-diff);return{...p,[field]:newVal,usableBank:nb};});}
  function saveGoldRate(){
    const rate=Number(goldRateInput)||0;
    if(rate<=0)return;
    setPot(p=>({...p,goldRate:rate,goldRateUpdatedOn:today}));
    setGoldRateInput("");setShowGoldRateForm(false);setGoldBannerDismissed(true);
    showToast("Gold rate updated!");
  }

  /* ── Expense CRUD ── */
  function resetForm(){setAmount("");setNote("");setDate(today);setEditingId(null);setPaySource("bank");}

  function validateAmount(val) {
    const num = Number(val);
    return Number.isFinite(num) && num > 0 && num <= MAX_AMOUNT;
  }

  function saveExpense(){
    if(!validateAmount(amount))return;
    const num=Number(amount);
    if(editingId){
      const old=expenses.find(e=>e.id===editingId);
      setPot(p=>{
        let updated=refundPot(old.paySource||"bank", old.amount, p);
        updated=deductPot(paySource, num, updated);
        return updated;
      });
      setExpenses(p=>p.map(e=>e.id===editingId?{...e,amount:num,category:selCat,note,date,paySource}:e));
      showToast("Updated!");
    }else{
      const currentBalance=paySource==="cash"?Number(pot.usableCash)||0:Number(pot.usableBank)||0;
      if(num>currentBalance){showToast(`⚠️ Low balance — only ₹${currentBalance.toLocaleString()} in ${paySource}`);}
      setExpenses(p=>[...p,{id:Date.now(),amount:num,category:selCat,note,date,paySource}]);
      setPot(p=>deductPot(paySource,num,p));
      showToast(`Added · deducted from ${paySource}`);
    }
    logDay(date);resetForm();
  }
  function editExpense(item){setEditingId(item.id);setAmount(item.amount);setSelCat(item.category);setNote(item.note);setDate(item.date);setPaySource(item.paySource||"bank");}
  function deleteExpense(id){const exp=expenses.find(e=>e.id===id);if(exp)setPot(p=>refundPot(exp.paySource||"bank",exp.amount,p));setExpenses(p=>p.filter(e=>e.id!==id));showToast("Deleted & refunded.");}
  function logNoSpend(){if(todayLogged){showToast("Already logged!");return;}logDay(today);showToast("No-spend day logged!");}
  function switchTab(t,section){
    setTab(t);
    if(section)setPotSection(section);
    setTimeout(()=>{if(tabRef.current)tabRef.current.scrollIntoView({behavior:"smooth",block:"start"});},50);
  }
  function saveBudget(){if(!budgetInput)return;setBudget(Number(budgetInput));setBudgetInput("");setEditingBudget(false);showToast("Budget updated!");}
  function addCategory(){if(!newCatName.trim()||categories.find(c=>c.name===newCatName.trim()))return;const colorIdx=categories.length%CAT_PALETTE.length;setCategories(p=>[...p,{name:newCatName.trim(),colorIdx}]);setNewCatName("");setAddingCat(false);showToast("Category added!");}

  /* ── Recurring CRUD ── */
  function resetRForm(){setRName("");setRAmount("");setRCat(categories[0]?.name||"");setRFreq("Monthly");setRDueDate(today);setREditId(null);setShowRForm(false);}
  function saveRecurring(){
    if(!rName.trim()||!validateAmount(rAmount))return;
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
    setDismissedMap(prev=>{const n={...prev};delete n[r.id];return n;});
    logDay(pd);showToast(`${r.name} paid from ${source}!`);
  }

  /* ── Reminder logic ── */
  const ist=useMemo(()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"})),[tick]);

  const reminders=useMemo(()=>recurring.filter(r=>{
    const days=daysFromToday(r.nextDue);
    if(days>3)return false;
    const dismissedOn=dismissedMap[r.id];
    if(dismissedOn===today)return false;
    const paidTM=(r.paid||[]).some(d=>{const pd=new Date(d+"T00:00:00");return pd.getMonth()===ist.getMonth()&&pd.getFullYear()===ist.getFullYear();});
    return!paidTM;
  }).map(r=>({
    id:r.id,name:r.name,amount:r.amount,
    daysUntil:daysFromToday(r.nextDue),
    dueDateStr:formatDate(r.nextDue),
    category:r.category,
  })).sort((a,b)=>a.daysUntil-b.daysUntil),[recurring,dismissedMap,today,ist]);

  function dismissReminder(id){setDismissedMap(prev=>({...prev,[id]:today}));}
  function payFromReminder(item,source){const r=recurring.find(x=>x.id===item.id);if(r)markPaid(r,source);}

  /* ── Pot income/extras ── */
  function resetIncomeForm(){setIncName("");setIncAmt("");setIncFreq("Monthly");setIncEditId(null);setShowIncomeForm(false);}
  function saveIncome(){
    if(!incName.trim()||!validateAmount(incAmt))return;
    const entry={id:incEditId||Date.now(),label:incName.trim(),amount:Number(incAmt),frequency:incFreq,active:true};
    if(incEditId){setPot(p=>({...p,incomes:p.incomes.map(i=>i.id===incEditId?entry:i)}));showToast("Updated!");}
    else{setPot(p=>({...p,incomes:[...(p.incomes||[]),entry]}));showToast("Income added!");}
    resetIncomeForm();
  }
  function deleteIncome(id){setPot(p=>({...p,incomes:p.incomes.filter(i=>i.id!==id)}));showToast("Removed.");}
  function editIncome(inc){setIncEditId(inc.id);setIncName(inc.label);setIncAmt(inc.amount);setIncFreq(inc.frequency);setShowIncomeForm(true);}
  function creditIncome(inc){setPot(p=>({...p,usableBank:(Number(p.usableBank)||0)+Number(inc.amount)}));showToast(`₹${Number(inc.amount).toLocaleString()} credited to bank!`);}
  function saveExtra(){
    if(!extraLabel.trim()||!validateAmount(extraAmt))return;
    const entry={id:Date.now(),label:extraLabel.trim(),amount:Number(extraAmt),date:extraDate};
    setPot(p=>({...p,extras:[...(p.extras||[]),entry],usableBank:(Number(p.usableBank)||0)+Number(extraAmt)}));
    setExtraLabel("");setExtraAmt("");setExtraDate(today);setShowExtraForm(false);
    showToast(`₹${Number(extraAmt).toLocaleString()} added to bank!`);
  }
  function deleteExtra(id){const ex=(pot.extras||[]).find(e=>e.id===id);if(ex)setPot(p=>({...p,extras:p.extras.filter(e=>e.id!==id),usableBank:Math.max(0,(Number(p.usableBank)||0)-ex.amount)}));showToast("Removed.");}

  /* ── Computed (memoized) ── */
  const catTotals=useMemo(()=>{
    const t={};expenses.forEach(e=>{t[e.category]=(t[e.category]||0)+e.amount;});return t;
  },[expenses]);

  const {grouped,dailyTotal}=useMemo(()=>{
    const g={},d={};
    [...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
      if(!g[e.date])g[e.date]=[];
      g[e.date].push(e);
      d[e.date]=(d[e.date]||0)+e.amount;
    });
    return{grouped:g,dailyTotal:d};
  },[expenses]);

  const spent=useMemo(()=>expenses.reduce((s,e)=>s+e.amount,0),[expenses]);
  const remaining=budget-spent;
  const percentUsed=budget>0?Math.min((spent/budget)*100,100):0;

  const monthlyTotal=useMemo(()=>expenses.filter(e=>new Date(e.date+"T00:00:00").getMonth()===ist.getMonth()).reduce((s,e)=>s+e.amount,0),[expenses,ist]);
  const recurringMonthly=useMemo(()=>recurring.reduce((s,r)=>r.frequency==="Monthly"?s+r.amount:r.frequency==="Weekly"?s+r.amount*4:r.frequency==="Yearly"?s+Math.round(r.amount/12):s,0),[recurring]);

  const streakMilestone=streak.count>=30?"30-day legend!":streak.count>=14?"2-week warrior!":streak.count>=7?"One week strong!":null;
  const last14=useMemo(()=>getLastNDays(14),[tick]);
  const topCategory=useMemo(()=>Object.keys(catTotals).sort((a,b)=>catTotals[b]-catTotals[a])[0],[catTotals]);

  const goldValue=useMemo(()=>(Number(pot.goldGrams)||0)*(Number(pot.goldRate)||0),[pot.goldGrams,pot.goldRate]);
  const usableTotal=(Number(pot.usableCash)||0)+(Number(pot.usableBank)||0);
  const netWorthTotal=usableTotal+(Number(pot.savings)||0)+(Number(pot.investments)||0)+goldValue;

  const monthlyIncome=useMemo(()=>(pot.incomes||[]).reduce((s,i)=>{
    if(!i.active)return s;
    if(i.frequency==="Monthly")return s+i.amount;
    if(i.frequency==="Weekly")return s+i.amount*4;
    if(i.frequency==="Yearly")return s+Math.round(i.amount/12);
    return s;
  },0),[pot.incomes]);

  const potBase=monthlyIncome>0?monthlyIncome:netWorthTotal>0?netWorthTotal:1;
  const usableFillPct=Math.min(100,(usableTotal/potBase)*100);
  const nwFillActual=netWorthTotal>0?Math.min(100,(usableTotal/netWorthTotal)*100+20):0;

  const showGoldRateBanner=useMemo(()=>{
    if(goldBannerDismissed)return false;
    if(!pot.goldGrams||pot.goldGrams<=0)return false;
    const istNow=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    if(istNow.getDate()!==1)return false;
    if(!pot.goldRateUpdatedOn)return true;
    const updated=new Date(pot.goldRateUpdatedOn+"T00:00:00");
    return!(updated.getMonth()===istNow.getMonth()&&updated.getFullYear()===istNow.getFullYear());
  },[goldBannerDismissed,pot.goldGrams,pot.goldRateUpdatedOn,tick]);

  const extrasThisMonth=useMemo(()=>(pot.extras||[]).filter(e=>{
    const d=new Date(e.date+"T00:00:00");
    return d.getMonth()===ist.getMonth()&&d.getFullYear()===ist.getFullYear();
  }).reduce((s,e)=>s+e.amount,0),[pot.extras,ist]);

  const totalIn = monthlyIncome + extrasThisMonth;
  const totalOut = monthlyTotal;

  /* ── Theme ── */
  const bg=dark?"#030712":"#f8fafc",cardBg=dark?"#111827":"#ffffff",border=dark?"#1f2937":"#f1f5f9";
  const textMain=dark?"#f9fafb":"#111827",textMute=dark?"#6b7280":"#6b7280";
  const inputBg=dark?"#1f2937":"#ffffff",inputBorder=dark?"#374151":"#e5e7eb",subbg=dark?"#1f2937":"#f8fafc";
  const cardStyle=useMemo(()=>({background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:16,marginBottom:12}),[cardBg,border]);
  const inputStyle=useMemo(()=>({background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}),[inputBg,inputBorder,textMain]);
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

  if(!unlocked){
    return <PinLock onUnlock={()=>setUnlocked(true)} dark={dark}/>;
  }

  return(
    <div style={{minHeight:"100vh",background:bg,color:textMain,fontFamily:"'DM Sans',sans-serif",transition:"background 0.3s"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"#4f46e5",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap"}}>{toast}</div>}

      <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><h1 style={{margin:0,fontSize:24,fontWeight:700,letterSpacing:"-0.5px"}}>mySpendr</h1><p style={{margin:0,fontSize:12,color:textMute,marginTop:2}}>Track. Save. Streak.</p></div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button
              onClick={toggleNotif}
              title={notifEnabled?"Notifications on":"Enable notifications"}
              style={{...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center",position:"relative"}}
            >
              <BellIcon/>
              {notifEnabled&&<span style={{position:"absolute",top:6,right:6,width:6,height:6,borderRadius:"50%",background:"#4f46e5"}}/>}
            </button>
            <button
              onClick={resetPin}
              title="Change PIN"
              style={{...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center"}}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button
              onClick={resetBiometric}
              title="Reset biometrics"
              style={{...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center"}}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571"/><path d="M5.477 5.938A9 9 0 0 1 21 12"/><path d="M3 3l18 18"/></svg>
            </button>
            <button onClick={()=>setDark(d=>!d)} style={{...btnSecondary,display:"flex",alignItems:"center",gap:6}}>{dark?<SunIcon/>:<MoonIcon/>}<span>{dark?"Light":"Dark"}</span></button>
          </div>
        </div>

        {/* REMINDER BANNERS */}
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

        {/* GOLD RATE BANNER */}
        {showGoldRateBanner&&(
          <div style={{background:dark?"#422006":"#fffbeb",border:dark?"1px solid #92400e":"1px solid #fde68a",borderRadius:14,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:20}}>🪙</span>
              <div style={{flex:1}}>
                <span style={{fontSize:13,fontWeight:700,color:dark?"#fbbf24":"#92400e"}}>Update Gold Rate</span>
                <p style={{margin:0,fontSize:11,color:dark?"#d97706":"#a16207"}}>It's the 1st — time to update your gold rate for this month</p>
              </div>
              <button onClick={()=>setGoldBannerDismissed(true)} style={{background:"none",border:"none",cursor:"pointer",color:dark?"#6b7280":"#9ca3af",padding:4}}><XIcon/></button>
            </div>
            {showGoldRateForm?(
              <div style={{display:"flex",gap:6}}>
                <input type="number" value={goldRateInput} onChange={e=>setGoldRateInput(e.target.value)} placeholder="₹ per gram (24K)" style={{...inputStyle,flex:1}} autoFocus onKeyDown={e=>e.key==="Enter"&&saveGoldRate()}/>
                <button onClick={saveGoldRate} style={{...btnPrimary,padding:"8px 14px",background:"#d97706"}}>Save</button>
                <button onClick={()=>setShowGoldRateForm(false)} style={{...btnSecondary,padding:"8px 10px"}}>✕</button>
              </div>
            ):(
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowGoldRateForm(true)} style={{background:"#d97706",color:"#fff",border:"none",borderRadius:10,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Update Rate</button>
                <button onClick={()=>setGoldBannerDismissed(true)} style={{...btnSecondary,fontSize:12,padding:"6px 12px"}}>Later</button>
              </div>
            )}
          </div>
        )}

        {/* USABLE POT MINI CARD */}
        <div style={{...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1c1410)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:dark?"1px solid #292117":"1px solid #fde68a",marginBottom:12}}>
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
                  onClick={()=>switchTab("pot","usable")}
                  style={{background:dark?"#422006":"#fef3c7",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:700,color:dark?"#fbbf24":"#92400e",padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:4}}
                >
                  Manage ₹ →
                </button>
              </div>
            </div>
          )}
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
        <div ref={tabRef} style={{display:"flex",gap:4,marginBottom:12,background:subbg,borderRadius:14,padding:4,border:`1px solid ${border}`}}>
          {["expenses","recurring","pot"].map(t=>(
            <button key={t} onClick={()=>switchTab(t)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:tab===t?cardBg:"transparent",color:tab===t?textMain:textMute,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
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
            <CategoryBubbles
              categories={categories}
              catTotals={catTotals}
              getCatStyle={getCatStyle}
              getCatAccent={getCatAccent}
              onSelect={(name)=>setDrillCat(name)}
              dark={dark}
              cardBg={cardBg}
              border={border}
              textMute={textMute}
              subbg={subbg}
            />
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
                  <NetWorthPot fillPercent={nwFillActual}amount={netWorthTotal}/>
                  <div style={{width:"100%",maxWidth:280}}><div style={{width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#ddd6fe"}}><div style={{height:8,borderRadius:99,width:`${nwFillActual}%`,background:"linear-gradient(to right,#7c3aed,#a78bfa)",transition:"width 0.7s ease"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:textMute,marginTop:5}}><span>Usable ₹{usableTotal.toLocaleString()}</span><span>Total ₹{netWorthTotal.toLocaleString()}</span></div></div>
                </div>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}><TrendingUpIcon/><span style={{fontSize:14,fontWeight:700}}>Breakdown</span></div>
                  {[["usableCash","Cash in Hand","#16a34a"],["usableBank","Bank Balance","#2563eb"],["savings","Savings / FD","#7c3aed"],["investments","Investments (MF/Stocks)","#db2777"]].map(([field,label,color])=>(
                    <div key={field}style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:13}}>{label}</span>
                      <span style={{fontSize:13,fontWeight:700,color,minWidth:90,textAlign:"right"}}>₹{(Number(pot[field])||0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:"#d97706",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13}}>Gold</span>
                      {pot.goldGrams>0&&pot.goldRate>0&&(
                        <span style={{fontSize:11,color:textMute,marginLeft:6}}>{pot.goldGrams}g × ₹{(Number(pot.goldRate)||0).toLocaleString()}/g</span>
                      )}
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:"#d97706",minWidth:90,textAlign:"right"}}>₹{goldValue.toLocaleString()}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4,borderTop:`1px solid ${border}`}}><span style={{fontSize:13,color:textMute,fontWeight:600}}>Total Net Worth</span><span style={{fontSize:20,fontWeight:800,color:"#7c3aed",fontFamily:"'DM Mono',monospace"}}>₹{netWorthTotal.toLocaleString()}</span></div>
                </div>
                <div style={cardStyle}>
                  <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700}}>Update Savings / Investments / Gold</p>
                  <p style={{margin:"0 0 12px",fontSize:11,color:textMute}}>Increasing these deducts from your bank balance</p>
                  {[["savings","Savings / FD","#7c3aed"],["investments","Investments","#db2777"]].map(([field,label,color])=>(
                    <div key={field}style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:13}}>{label}</span>
                      <input type="number"value={pot[field]||""}onChange={e=>updateNWField(field,e.target.value)}placeholder="₹0"style={{...inputStyle,width:130,textAlign:"right",fontWeight:700,color}}/>
                    </div>
                  ))}
                  <div style={{paddingTop:10,borderTop:`1px solid ${border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#d97706"}}/>
                      <span style={{fontSize:13,fontWeight:600}}>Gold</span>
                      {pot.goldRateUpdatedOn&&<span style={{fontSize:11,color:textMute,marginLeft:"auto"}}>Rate updated: {formatDate(pot.goldRateUpdatedOn)}</span>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
                      <div>
                        <p style={{margin:"0 0 4px",fontSize:11,color:textMute}}>Weight (grams)</p>
                        <input type="number" value={pot.goldGrams||""} onChange={e=>setPot(p=>({...p,goldGrams:Number(e.target.value)||0}))} placeholder="e.g. 24.5" style={{...inputStyle,textAlign:"right",fontWeight:700,color:"#d97706"}}/>
                      </div>
                      <div>
                        <p style={{margin:"0 0 4px",fontSize:11,color:textMute}}>Rate (₹/gram 24K)</p>
                        <input type="number" value={pot.goldRate||""} onChange={e=>setPot(p=>({...p,goldRate:Number(e.target.value)||0,goldRateUpdatedOn:today}))} placeholder="e.g. 9200" style={{...inputStyle,textAlign:"right",fontWeight:700,color:"#d97706"}}/>
                      </div>
                    </div>
                    {pot.goldGrams>0&&pot.goldRate>0&&(
                      <div style={{background:dark?"#422006":"#fffbeb",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,color:dark?"#d97706":"#92400e"}}>{pot.goldGrams}g × ₹{Number(pot.goldRate).toLocaleString()}</span>
                        <span style={{fontSize:14,fontWeight:800,color:"#d97706",fontFamily:"'DM Mono',monospace"}}>= ₹{goldValue.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
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

        {/* MONTHLY SUMMARY */}
        <div style={{...cardStyle,marginTop:8}}>
          <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>This Month Summary</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:dark?"#052e16":"#f0fdf4",borderRadius:12,padding:"12px 14px",border:dark?"1px solid #065f46":"1px solid #bbf7d0"}}>
              <p style={{margin:0,fontSize:11,color:dark?"#34d399":"#16a34a",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Total In</p>
              <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:dark?"#34d399":"#16a34a",letterSpacing:"-0.5px"}}>₹{totalIn.toLocaleString()}</p>
              <p style={{margin:"3px 0 0",fontSize:11,color:textMute}}>Income + extras</p>
            </div>
            <div style={{background:dark?"#450a0a":"#fff1f2",borderRadius:12,padding:"12px 14px",border:dark?"1px solid #7f1d1d":"1px solid #fca5a5"}}>
              <p style={{margin:0,fontSize:11,color:dark?"#f87171":"#dc2626",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Total Out</p>
              <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:dark?"#f87171":"#dc2626",letterSpacing:"-0.5px"}}>₹{totalOut.toLocaleString()}</p>
              <p style={{margin:"3px 0 0",fontSize:11,color:textMute}}>All expenses</p>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:10,borderTop:`1px solid ${border}`}}>
            <span style={{fontSize:12,color:textMute,fontWeight:500}}>Net this month</span>
            <span style={{fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:totalIn-totalOut>=0?(dark?"#34d399":"#16a34a"):"#ef4444"}}>
              {totalIn-totalOut>=0?"+":""}{(totalIn-totalOut).toLocaleString()}
            </span>
          </div>
        </div>

        <p style={{textAlign:"center",fontSize:12,color:textMute,marginTop:8}}>mySpendr · your money, your streak</p>
      </div>
    </div>
  );
}
