import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ════════════════════════════════════════════════════════════════════════════
// STORAGE — safe localStorage wrapper (never throws)
// ════════════════════════════════════════════════════════════════════════════
const KEYS = {
  EXPENSES:   "myspendr_expenses_v3",
  BUDGET:     "myspendr_budget_v3",
  CATEGORIES: "myspendr_categories_v3",
  STREAK:     "myspendr_streak_v3",
  THEME:      "myspendr_theme_v3",
  ACCENT:     "myspendr_accent_v1",
  RECURRING:  "myspendr_recurring_v1",
  POT:        "myspendr_pot_v3",
  DISMISS:    "myspendr_dismiss_v1",
  PIN:        "myspendr_pin_v1",
  NOTIF:      "myspendr_notif_v1",
  EMI:        "myspendr_emi_v1",
  USER:       "myspendr_user_v1",
  NOTIF_LOG:  "myspendr_notif_log_v1",
  GOALS:      "myspendr_goals_v1",
  BIO_CRED:   "myspendr_bio_cred_v1",
};

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn(`[storage] write failed for "${key}":`, e.message); }
}
function storageRemove(key) { try { localStorage.removeItem(key); } catch {} }

const _saveTimers = {};
function storageSetDebounced(key, value, delay = 300) {
  clearTimeout(_saveTimers[key]);
  _saveTimers[key] = setTimeout(() => storageSet(key, value), delay);
}

// ════════════════════════════════════════════════════════════════════════════
// DATE UTILS — all IST-aware
// ════════════════════════════════════════════════════════════════════════════
const TZ = "Asia/Kolkata";
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function nowIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function getTodayIST() {
  return nowIST().toISOString().split("T")[0];
}
function msUntilMidnightIST() {
  const ist = nowIST();
  const next = new Date(ist);
  next.setHours(24, 0, 0, 0);
  return next - ist;
}
function formatDate(d) {
  const dt = new Date(d + "T00:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTH_LABELS[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
}
// Positive = b is after a
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}
function daysFromToday(dateStr) {
  const ist = nowIST(); ist.setHours(0,0,0,0);
  return Math.round((new Date(dateStr + "T00:00:00") - ist) / 86_400_000);
}
function getLastNDays(n) {
  const ist = nowIST();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ist);
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split("T")[0];
  });
}
function getNextDueDate(startDate, freq) {
  const d = new Date(startDate + "T00:00:00");
  if (isNaN(d.getTime())) return startDate;
  const now = nowIST(); now.setHours(0,0,0,0);
  let guard = 0;
  while (d <= now && guard++ < 1000) {
    if (freq === "Weekly")       d.setDate(d.getDate() + 7);
    else if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
    else if (freq === "Yearly")  d.setFullYear(d.getFullYear() + 1);
    else break;
  }
  return d.toISOString().split("T")[0];
}
function isInCurrentMonth(dateStr) {
  const ist = nowIST();
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === ist.getFullYear() && d.getMonth() === ist.getMonth();
}

// ════════════════════════════════════════════════════════════════════════════
// STREAK — fixed: past-date logging no longer resets streak
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_STREAK = { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 };

function updateStreak(prev, dateStr) {
  if (prev.loggedDates.includes(dateStr)) return prev;       // idempotent
  const loggedDates = [...prev.loggedDates, dateStr];

  if (!prev.lastDate) {
    return { count: 1, lastDate: dateStr, loggedDates, longestStreak: 1 };
  }

  const diff = daysBetween(prev.lastDate, dateStr);

  if (diff < 0) {
    // Past date — record it but DON'T touch count or lastDate
    return { ...prev, loggedDates };
  }
  if (diff === 0) return prev;  // Same day — idempotent (already handled above)

  const count = diff === 1 ? prev.count + 1 : 1;
  const longestStreak = Math.max(prev.longestStreak || 0, count);
  return { count, lastDate: dateStr, loggedDates, longestStreak };
}

// ════════════════════════════════════════════════════════════════════════════
// FINANCE UTILS
// ════════════════════════════════════════════════════════════════════════════
const MAX_AMOUNT = 10_000_000;
const MAX_TENURE = 600;

function isValidAmount(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT;
}
function calcEMI(principal, annualRate, tenureMonths) {
  if (annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}
function buildAmortization(principal, annualRate, tenureMonths) {
  const t = Math.min(tenureMonths, MAX_TENURE);
  const emi = calcEMI(principal, annualRate, t);
  let balance = principal;
  return Array.from({ length: t }, (_, i) => {
    const interest = annualRate === 0 ? 0 : balance * (annualRate / 12 / 100);
    const principalPart = emi - interest;
    balance = Math.max(0, balance - principalPart);
    return {
      month: i + 1,
      emi: Math.round(emi),
      interest: Math.round(interest),
      principal: Math.round(principalPart),
      balance: Math.round(balance),
    };
  });
}
function toMonthlyAmount(amount, frequency) {
  if (frequency === "Weekly") return amount * 4;
  if (frequency === "Yearly") return Math.round(amount / 12);
  return amount;
}

// FIX: budget now uses only current-month spending
function computeMonthlyTotal(expenses) {
  return expenses
    .filter(e => isInCurrentMonth(e.date))
    .reduce((s, e) => s + e.amount, 0);
}

function groupByDate(expenses) {
  const grouped = {}, dailyTotal = {};
  [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
      dailyTotal[e.date] = (dailyTotal[e.date] || 0) + e.amount;
    });
  return { grouped, dailyTotal };
}
function deductPot(pot, source, amount) {
  const f = source === "cash" ? "usableCash" : "usableBank";
  return { ...pot, [f]: Math.max(0, (Number(pot[f]) || 0) - amount) };
}
function refundPot(pot, source, amount) {
  const f = source === "cash" ? "usableCash" : "usableBank";
  return { ...pot, [f]: (Number(pot[f]) || 0) + amount };
}
function buildTrendData(expenses) {
  const now = nowIST();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const yr = d.getFullYear(), mo = d.getMonth();
    const total = expenses
      .filter(e => { const ed = new Date(e.date + "T00:00:00"); return ed.getFullYear() === yr && ed.getMonth() === mo; })
      .reduce((s, e) => s + e.amount, 0);
    return { label: MONTH_LABELS[mo], total, isCurrent: i === 5 };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
const ACCENTS = [
  { id: "indigo",  label: "Indigo",  light: "#4f46e5", dark: "#818cf8" },
  { id: "violet",  label: "Violet",  light: "#7c3aed", dark: "#a78bfa" },
  { id: "rose",    label: "Rose",    light: "#e11d48", dark: "#fb7185" },
  { id: "emerald", label: "Emerald", light: "#059669", dark: "#34d399" },
  { id: "amber",   label: "Amber",   light: "#d97706", dark: "#fbbf24" },
  { id: "sky",     label: "Sky",     light: "#0284c7", dark: "#38bdf8" },
  { id: "slate",   label: "Slate",   light: "#475569", dark: "#94a3b8" },
];
const CAT_PALETTE = [
  { bg:"#fee2e2",text:"#dc2626",darkBg:"#450a0a",darkText:"#fca5a5" },
  { bg:"#dcfce7",text:"#16a34a",darkBg:"#052e16",darkText:"#86efac" },
  { bg:"#dbeafe",text:"#2563eb",darkBg:"#172554",darkText:"#93c5fd" },
  { bg:"#ede9fe",text:"#7c3aed",darkBg:"#2e1065",darkText:"#c4b5fd" },
  { bg:"#fef9c3",text:"#ca8a04",darkBg:"#422006",darkText:"#fde047" },
  { bg:"#fce7f3",text:"#db2777",darkBg:"#500724",darkText:"#f9a8d4" },
  { bg:"#ffedd5",text:"#ea580c",darkBg:"#431407",darkText:"#fdba74" },
  { bg:"#cffafe",text:"#0891b2",darkBg:"#083344",darkText:"#67e8f9" },
  { bg:"#d1fae5",text:"#059669",darkBg:"#022c22",darkText:"#6ee7b7" },
  { bg:"#fdf2f8",text:"#a21caf",darkBg:"#4a044e",darkText:"#f0abfc" },
  { bg:"#fff7ed",text:"#c2410c",darkBg:"#431407",darkText:"#fb923c" },
  { bg:"#f0fdf4",text:"#15803d",darkBg:"#052e16",darkText:"#4ade80" },
];
const DEFAULT_CATEGORIES = [
  {name:"Food",colorIdx:0},{name:"Groceries",colorIdx:1},{name:"Travel",colorIdx:2},
  {name:"Shopping",colorIdx:3},{name:"Bills",colorIdx:4},{name:"Entertainment",colorIdx:5},
];
const DEFAULT_POT = {
  usableCash:0,usableBank:0,savings:0,investments:0,gold:0,
  goldGrams:0,goldRate:0,goldRateUpdatedOn:null,
  incomes:[{id:1,label:"Salary",amount:0,frequency:"Monthly",active:true}],
  extras:[],
};
const RECUR_FREQ = ["Monthly","Weekly","Yearly"];
const AVATAR_COLORS = ["#4f46e5","#7c3aed","#db2777","#059669","#d97706","#dc2626","#0891b2"];

function avatarColor(name) {
  if (!name) return "#4f46e5";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(" ").slice(0,2).map(w => w[0].toUpperCase()).join("");
}
function getGreeting(name) {
  const h = nowIST().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}!` : `${part}!`;
}
function haptic(pattern = 10) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {} }

// ════════════════════════════════════════════════════════════════════════════
// BIOMETRIC HELPERS
// ════════════════════════════════════════════════════════════════════════════
function bufToB64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64ToBuf(b64) {
  const bin = atob(b64); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function saveBioCred(id) { storageSet(KEYS.BIO_CRED, bufToB64(id)); }
function loadBioCred() {
  const s = storageGet(KEYS.BIO_CRED, null);
  return s ? b64ToBuf(s) : null;
}
async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}
async function registerBiometric() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "mySpendr", id: window.location.hostname || "localhost" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "myspendr-user", displayName: "mySpendr User" },
      pubKeyCredParams: [{ type:"public-key",alg:-7 },{ type:"public-key",alg:-257 }],
      authenticatorSelection: { authenticatorAttachment:"platform",userVerification:"required",residentKey:"preferred" },
      timeout: 60000,
    },
  });
  saveBioCred(cred.rawId);
  return true;
}
async function verifyBiometric() {
  const credId = loadBioCred();
  if (!credId) throw new Error("no-cred");
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname || "localhost",
      allowCredentials: [{ type:"public-key", id: credId }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS
// ════════════════════════════════════════════════════════════════════════════
async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}
function scheduleReminderNotifs(recurring, dismissedMap) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = getTodayIST();
  recurring.forEach(r => {
    const days = daysFromToday(r.nextDue);
    if (days > 3 || days < 0 || dismissedMap[r.id] === today) return;
    try {
      new Notification(`mySpendr: ${r.name}`, {
        body: `₹${r.amount.toLocaleString()} ${days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`}`,
        icon: "/favicon.ico",
        tag: `myspendr-reminder-${r.id}`,
      });
    } catch {}
  });
}

// ════════════════════════════════════════════════════════════════════════════
// ICONS
// ════════════════════════════════════════════════════════════════════════════
const Icon = ({ d, size = 16, stroke = "currentColor", sw = 2, fill = "none", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const SunIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const FlameIcon  = ({ size=16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9.17 2 7 4.17 7 7c0 1.57.68 2.97 1.76 3.95C7.65 12.07 7 13.46 7 15c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.54-.65-2.93-1.76-4.05C16.32 9.97 17 8.57 17 7c0-2.83-2.17-5-5-5zm0 16c-1.65 0-3-1.35-3-3 0-.93.42-1.76 1.08-2.33C10.66 13.16 11.31 14 12 14s1.34-.84 1.92-1.33C14.58 13.24 15 14.07 15 15c0 1.65-1.35 3-3 3z"/></svg>;
const ShieldIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const TrophyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><path d="M17 3H7a2 2 0 0 0-2 2v6a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2z"/><path d="M5 7H2a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4"/><path d="M19 7h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4"/></svg>;
const EditIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const RepeatIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const PlusIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const CheckIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const TrendIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const PiggyIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 8a7 7 0 0 0-14 0c0 2.5 1.3 4.7 3.3 6L8 20h8l-.3-6A7 7 0 0 0 19 8z"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="8" y1="20" x2="16" y2="20"/></svg>;
const ZapIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const BankIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;
const CashIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const ChevronL   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const GridIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
const BellIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const XIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const HomeIcon   = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const ListIcon   = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const WalletIcon = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h2v-4z"/></svg>;
const EmiIcon    = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="7" y1="15" x2="7" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/></svg>;
const MicIcon    = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const CameraIcon = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const ChevDown   = ({ color }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

// ════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ════════════════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      const { dark } = this.props;
      return (
        <div style={{ minHeight: "100vh", background: dark ? "#030712" : "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: "0 0 8px", color: dark ? "#f9fafb" : "#111827", fontSize: 20, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed",top:"env(safe-area-inset-top,16px)",left:"50%",transform:"translateX(-50%)",zIndex:999,background:"var(--accent)",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap",pointerEvents:"none" }}>
      {msg}
    </div>
  );
}

function MoneyBag({ fillPercent, size = "md" }) {
  const clamp = Math.max(0, Math.min(100, fillPercent));
  const fontSize = size === "sm" ? 52 : size === "lg" ? 96 : 72;
  const barColor = clamp <= 20 ? "#ef4444" : clamp <= 40 ? "#f97316" : clamp <= 60 ? "#f59e0b" : "#fbbf24";
  const barW = size === "sm" ? 60 : size === "lg" ? 100 : 80;
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
      <style>{`@keyframes _bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes _pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}.mbob{animation:_bob 2s ease-in-out infinite}.mpulse{animation:_pulse 2s ease-in-out infinite}`}</style>
      <div className="mbob" style={{ fontSize, lineHeight:1, userSelect:"none" }}>💰</div>
      <div style={{ width:barW,height:5,borderRadius:99,background:"rgba(0,0,0,0.08)",overflow:"hidden" }}>
        <div style={{ height:5,borderRadius:99,width:`${clamp}%`,background:barColor,transition:"width 0.6s ease" }} />
      </div>
    </div>
  );
}

function SourcePill({ value, onChange, dark, subbg, border, textMute }) {
  return (
    <div style={{ display:"flex",gap:3,background:subbg,borderRadius:10,padding:3,border:`1px solid ${border}` }}>
      {[["bank","Bank","#2563eb"],["cash","Cash","#16a34a"]].map(([v,label,color]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:value===v?color:"transparent",color:value===v?"#fff":textMute,transition:"all 0.15s" }}>
          {v==="bank" ? <BankIcon/> : <CashIcon/>}{label}
        </button>
      ))}
    </div>
  );
}

function SwipeableRow({ onDelete, children, border, dark, cardBg }) {
  const startX = useRef(null);
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const THRESHOLD = 80, REVEAL = 72;

  function handleTouchStart(e) { startX.current = e.touches[0].clientX; }
  function handleTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffset(Math.max(dx, -REVEAL - 8));
    else if (offset < 0) setOffset(Math.min(0, offset + (dx * 0.3)));
  }
  function handleTouchEnd() {
    if (offset < -THRESHOLD) {
      haptic([10,40,10]); setDeleting(true);
      setTimeout(() => onDelete(), 280);
    } else { setOffset(0); }
    startX.current = null;
  }
  return (
    <div style={{ position:"relative",overflow:"hidden",opacity:deleting?0:1,transition:deleting?"opacity 0.25s":"none" }}>
      <div style={{ position:"absolute",right:0,top:0,bottom:0,width:REVEAL,background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2 }}>
        <TrashIcon/><span style={{ fontSize:9,fontWeight:700,color:"#fff",letterSpacing:"0.05em" }}>DELETE</span>
      </div>
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{ transform:`translateX(${offset}px)`,transition:offset===0&&!deleting?"transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)":"none",background:cardBg||"inherit",position:"relative",zIndex:1 }}>
        {children}
      </div>
    </div>
  );
}

function ReminderBanner({ item, onDismiss, onPay, dark }) {
  const isOverdue = item.daysUntil < 0, isDueToday = item.daysUntil === 0;
  const startX = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  function handleTouchStart(e) { startX.current = e.touches[0].clientX; }
  function handleTouchMove(e) { if (startX.current !== null) setOffset(e.touches[0].clientX - startX.current); }
  function handleTouchEnd() {
    if (Math.abs(offset) > 80) { setDismissed(true); setTimeout(() => onDismiss(item.id), 250); }
    else setOffset(0);
    startX.current = null;
  }
  const bg = isOverdue?(dark?"#450a0a":"#fef2f2"):isDueToday?(dark?"#431407":"#fff7ed"):(dark?"#422006":"#fffbeb");
  const borderC = isOverdue?(dark?"#7f1d1d":"#fca5a5"):isDueToday?(dark?"#92400e":"#fed7aa"):(dark?"#92400e":"#fde68a");
  const accent = isOverdue?"#ef4444":isDueToday?"#f97316":"#f59e0b";
  const label = isOverdue?`${Math.abs(item.daysUntil)}d overdue`:isDueToday?"Due today":`Due in ${item.daysUntil}d`;
  return (
    <div style={{ overflow:"hidden",marginBottom:8,opacity:dismissed?0:1,transition:"opacity 0.2s" }}>
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{ background:bg,border:`1px solid ${borderC}`,borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,transform:`translateX(${offset}px)`,transition:offset===0?"transform 0.3s":"none",cursor:"grab",userSelect:"none" }}>
        <div style={{ fontSize:20,flexShrink:0 }}>{isOverdue?"⚠️":isDueToday?"🔔":"⏰"}</div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
            <span style={{ fontSize:14,fontWeight:700,color:accent }}>{item.name}</span>
            <span style={{ fontSize:11,fontWeight:600,padding:"1px 7px",borderRadius:99,background:accent,color:"#fff" }}>{label}</span>
          </div>
          <div style={{ fontSize:12,color:dark?"#9ca3af":"#6b7280" }}>₹{item.amount.toLocaleString()} · due {item.dueDateStr}</div>
        </div>
        <div style={{ display:"flex",gap:6,flexShrink:0 }}>
          <button onClick={() => onPay(item,"bank")} style={{ background:dark?"#064e3b":"#d1fae5",color:dark?"#34d399":"#065f46",border:"none",borderRadius:9,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:3 }}><BankIcon/>Pay</button>
          <button onClick={() => onDismiss(item.id)} style={{ background:"none",border:`1px solid ${borderC}`,borderRadius:9,padding:"5px 8px",cursor:"pointer",color:dark?"#6b7280":"#9ca3af",display:"flex",alignItems:"center" }}><XIcon/></button>
        </div>
      </div>
      <div style={{ textAlign:"center",fontSize:10,color:dark?"#4b5563":"#d1d5db",marginTop:3 }}>← swipe to dismiss</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORY HELPERS — extracted so they're not recomputed inside render
// ════════════════════════════════════════════════════════════════════════════
function useCategoryHelpers(categories, dark) {
  const getCatObj = useCallback((name) =>
    categories.find(c => c.name === name) || { name, colorIdx: 0 },
  [categories]);

  const getCatStyle = useCallback((name) => {
    const cat = getCatObj(name);
    const p = CAT_PALETTE[cat.colorIdx % CAT_PALETTE.length];
    return dark ? { background: p.darkBg, color: p.darkText } : { background: p.bg, color: p.text };
  }, [getCatObj, dark]);

  const getCatAccent = useCallback((name) => {
    const cat = getCatObj(name);
    const p = CAT_PALETTE[cat.colorIdx % CAT_PALETTE.length];
    return dark ? p.darkText : p.text;
  }, [getCatObj, dark]);

  return { getCatStyle, getCatAccent };
}

// ════════════════════════════════════════════════════════════════════════════
// PIN LOCK
// ════════════════════════════════════════════════════════════════════════════
function PinLock({ onUnlock, dark, accent }) {
  const safeAccent = accent || "#4f46e5";
  const savedPin = () => storageGet(KEYS.PIN, "");
  const hasPin = savedPin().length === 4;
  const hasCred = !!loadBioCred();
  const [mode, setMode] = useState(hasPin ? "enter" : "setup");
  const [digits, setDigits] = useState([]);
  const [tempPin, setTempPin] = useState("");
  const [shake, setShake] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [bioError, setBioError] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [offerBioSetup, setOfferBioSetup] = useState(false);
  const didAttemptBio = useRef(false);

  useEffect(() => { isBiometricAvailable().then(setBioAvail); }, []);
  useEffect(() => {
    if (mode === "enter" && bioAvail && hasCred && !didAttemptBio.current) {
      didAttemptBio.current = true; tryVerify();
    }
  }, [mode, bioAvail]);

  async function tryVerify() {
    setBioError(""); setBioLoading(true);
    try { await verifyBiometric(); onUnlock(); }
    catch (e) {
      if (e.message === "no-cred") setBioError("No biometric registered — use PIN");
      else if (e.name === "NotAllowedError") setBioError("");
      else setBioError("Biometric failed — use PIN");
    } finally { setBioLoading(false); }
  }
  async function tryRegister() {
    setBioError(""); setBioLoading(true);
    try { await registerBiometric(); setOfferBioSetup(false); onUnlock(); }
    catch { setOfferBioSetup(false); onUnlock(); }
    finally { setBioLoading(false); }
  }
  function press(d) {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  }
  function del() { setDigits(p => p.slice(0, -1)); }
  function submit(entered) {
    const pin = entered.join("");
    if (mode === "setup") { setTempPin(pin); setDigits([]); setMode("confirm"); }
    else if (mode === "confirm") {
      if (pin === tempPin) {
        storageSet(KEYS.PIN, pin);
        if (bioAvail && !loadBioCred()) setOfferBioSetup(true);
        else onUnlock();
      } else { setShake(true); setDigits([]); setTimeout(() => setShake(false), 500); }
    } else {
      if (pin === savedPin()) onUnlock();
      else { setShake(true); setDigits([]); setTimeout(() => setShake(false), 500); }
    }
  }

  const bg = dark ? "#030712" : "#f8fafc";
  const card = dark ? "#111827" : "#ffffff";
  const textMain = dark ? "#f9fafb" : "#111827";
  const textMute = dark ? "#6b7280" : "#9ca3af";

  if (offerBioSetup) return (
    <div style={{ minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
      <div style={{ width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
        <div style={{ fontSize:56 }}>🔑</div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:700,color:textMain,textAlign:"center",letterSpacing:"-0.5px" }}>Enable Face ID / Fingerprint?</h1>
        <p style={{ margin:"0 0 24px",fontSize:13,color:textMute,textAlign:"center",lineHeight:1.6 }}>Skip the PIN next time and unlock instantly with your device biometrics.</p>
        {bioError && <p style={{ margin:"0 0 8px",fontSize:12,color:"#ef4444",textAlign:"center" }}>{bioError}</p>}
        <button onClick={tryRegister} disabled={bioLoading} style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:safeAccent,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",opacity:bioLoading?0.7:1 }}>
          {bioLoading ? "Setting up…" : "Enable Biometrics"}
        </button>
        <button onClick={() => { setOfferBioSetup(false); onUnlock(); }} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,fontSize:13,textDecoration:"underline" }}>Skip for now</button>
      </div>
    </div>
  );

  const title = mode === "setup" ? "Set a PIN" : mode === "confirm" ? "Confirm PIN" : "Welcome back";
  const subtitle = mode === "setup" ? "Choose a 4-digit PIN to secure your data"
    : mode === "confirm" ? "Re-enter your PIN to confirm"
    : hasCred ? "Unlock with biometrics or enter your PIN"
    : "Enter your PIN to continue";

  return (
    <div style={{ minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
      <div style={{ width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
        <div style={{ fontSize:48,marginBottom:4 }}>🔐</div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:700,color:textMain,letterSpacing:"-0.5px" }}>{title}</h1>
        <p style={{ margin:"0 0 28px",fontSize:13,color:textMute,textAlign:"center" }}>{subtitle}</p>
        <div style={{ display:"flex",gap:14,marginBottom:32,animation:shake?"shake 0.4s ease":"none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width:14,height:14,borderRadius:"50%",background:digits.length>i?safeAccent:(dark?"#1f2937":"#e5e7eb"),border:`2px solid ${digits.length>i?safeAccent:(dark?"#374151":"#d1d5db")}`,transition:"background 0.15s" }} />
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:"100%",maxWidth:280 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
            k === "" ? <div key={i}/> :
            <button key={i} onClick={() => k==="⌫" ? del() : press(k)}
              style={{ height:64,borderRadius:16,border:`1px solid ${dark?"#1f2937":"#e5e7eb"}`,background:k==="⌫"?(dark?"#1f2937":"#f3f4f6"):card,color:textMain,fontSize:k==="⌫"?20:22,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace" }}>
              {k}
            </button>
          ))}
        </div>
        {mode === "enter" && bioAvail && (
          <button onClick={tryVerify} disabled={bioLoading}
            style={{ marginTop:20,display:"flex",alignItems:"center",gap:8,background:"none",border:`1px solid ${dark?"#374151":"#e5e7eb"}`,borderRadius:12,padding:"10px 20px",cursor:"pointer",color:dark?"#9ca3af":"#6b7280",fontSize:13,fontWeight:500,opacity:bioLoading?0.6:1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839-1.132c.09-.52.138-1.05.138-1.587 0-3.038-1.362-5.762-3.509-7.6"/>
            </svg>
            {bioLoading ? "Verifying…" : hasCred ? "Use Face ID / Fingerprint" : "Set up Biometrics"}
          </button>
        )}
        {bioError && <p style={{ margin:"8px 0 0",fontSize:12,color:"#ef4444",textAlign:"center" }}>{bioError}</p>}
        {mode === "setup" && (
          <button onClick={onUnlock} style={{ marginTop:16,background:"none",border:"none",cursor:"pointer",color:textMute,fontSize:12,textDecoration:"underline" }}>Skip for now</button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORY BUBBLES (donut chart)
// ════════════════════════════════════════════════════════════════════════════
function CategoryBubbles({ categories, catTotals, getCatStyle, getCatAccent, onSelect, dark, cardBg, border, textMute }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [animated, setAnimated] = useState(false);
  const totalSpent = useMemo(() => Object.values(catTotals).reduce((s,v) => s+v, 0), [catTotals]);
  const sorted = useMemo(() => [...categories].sort((a,b) => (catTotals[b.name]||0)-(catTotals[a.name]||0)), [categories, catTotals]);

  useEffect(() => {
    if (open) { const t = setTimeout(() => setAnimated(true), 50); return () => clearTimeout(t); }
    else setAnimated(false);
  }, [open]);

  const R=72, SW=24, CX=90, CY=90, circ=2*Math.PI*R;
  const slices = sorted.filter(c => catTotals[c.name]>0).map(c => ({ name:c.name, value:catTotals[c.name], accent:getCatAccent(c.name) }));
  let cumPct = 0;
  const segments = slices.map(s => {
    const pct = s.value / totalSpent;
    const offset = circ * (1 - cumPct);
    const dash = animated ? circ * pct : 0;
    cumPct += pct;
    return { ...s, pct, dash, offset };
  });
  const active = hovered ? segments.find(s => s.name===hovered) : null;
  const displayVal = active ? active.value : totalSpent;
  const displayLabel = active ? active.name : "Total";

  return (
    <div style={{ marginBottom:12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:cardBg,border:`1px solid ${border}`,borderRadius:open?"16px 16px 0 0":16,padding:"10px 14px",cursor:"pointer" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827" }}>Categories</span>
          {totalSpent>0 && <span style={{ fontSize:12,color:textMute }}>₹{totalSpent.toLocaleString()} total</span>}
        </div>
        <div style={{ transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s" }}>
          <ChevDown color={textMute}/>
        </div>
      </button>
      {open && (
        <div style={{ background:cardBg,border:`1px solid ${border}`,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"12px 14px 14px" }}>
          {totalSpent > 0 && (
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${dark?"#1f2937":"#f3f4f6"}` }}>
              <svg width="180" height="180" viewBox="0 0 180 180" style={{ flexShrink:0,overflow:"visible" }}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke={dark?"#1f2937":"#f3f4f6"} strokeWidth={SW}/>
                {segments.map(seg => (
                  <circle key={seg.name} cx={CX} cy={CY} r={R} fill="none" stroke={seg.accent}
                    strokeWidth={hovered===seg.name?SW+5:SW}
                    strokeDasharray={`${seg.dash} ${circ}`}
                    strokeDashoffset={seg.offset}
                    strokeLinecap="butt"
                    style={{ transform:"rotate(-90deg)",transformOrigin:`${CX}px ${CY}px`,transition:"stroke-dasharray 0.6s ease,stroke-width 0.15s",cursor:"pointer" }}
                    onMouseEnter={() => setHovered(seg.name)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => { onSelect(seg.name); setOpen(false); }}
                  />
                ))}
                <text x={CX} y={CY-6} textAnchor="middle" style={{ fontSize:10,fill:textMute,fontFamily:"DM Sans,sans-serif" }}>{displayLabel}</text>
                <text x={CX} y={CY+12} textAnchor="middle" style={{ fontSize:15,fontWeight:700,fill:dark?"#f9fafb":"#111827",fontFamily:"DM Mono,monospace" }}>₹{displayVal.toLocaleString()}</text>
              </svg>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6 }}>
                {segments.map(seg => (
                  <button key={seg.name} onMouseEnter={() => setHovered(seg.name)} onMouseLeave={() => setHovered(null)}
                    onClick={() => { onSelect(seg.name); setOpen(false); }}
                    style={{ display:"flex",alignItems:"center",gap:6,background:hovered===seg.name?(dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)"):"transparent",border:"none",borderRadius:8,padding:"3px 6px",cursor:"pointer",width:"100%",textAlign:"left" }}>
                    <div style={{ width:8,height:8,borderRadius:"50%",background:seg.accent,flexShrink:0 }}/>
                    <span style={{ flex:1,fontSize:11,color:dark?"#d1d5db":"#374151",fontWeight:hovered===seg.name?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{seg.name}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:seg.accent,fontFamily:"'DM Mono',monospace" }}>{Math.round(seg.pct*100)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sorted.map(cat => {
            const spent = catTotals[cat.name] || 0;
            const pct = totalSpent > 0 ? Math.round((spent/totalSpent)*100) : 0;
            const cs = getCatStyle(cat.name);
            const acc = getCatAccent(cat.name);
            return (
              <button key={cat.name} onClick={() => { onSelect(cat.name); setOpen(false); }}
                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 0",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${dark?"#1f2937":"#f3f4f6"}` }}>
                <span style={{ ...cs,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0 }}>{cat.name[0]}</span>
                <div style={{ flex:1,textAlign:"left" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827" }}>{cat.name}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:acc,fontFamily:"'DM Mono',monospace" }}>{spent>0?`₹${spent.toLocaleString()}`:"—"}</span>
                  </div>
                  <div style={{ width:"100%",height:5,borderRadius:99,background:dark?"#1f2937":"#f3f4f6",overflow:"hidden" }}>
                    <div style={{ height:5,borderRadius:99,width:`${pct}%`,background:acc,transition:"width 0.5s ease" }}/>
                  </div>
                </div>
                <span style={{ fontSize:11,color:textMute,minWidth:28,textAlign:"right" }}>{pct>0?`${pct}%`:""}</span>
              </button>
            );
          })}
          {sorted.every(c => !catTotals[c.name]) && (
            <p style={{ margin:0,fontSize:13,color:textMute,textAlign:"center",padding:"8px 0" }}>No expenses yet across any category.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SPENDING TREND CHART
// ════════════════════════════════════════════════════════════════════════════
function SpendingTrendChart({ data, dark, cardBg, border, textMute, textMain }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const H=90, BAR_W=32, GAP=8;
  const total6 = data.reduce((s,d) => s+d.total, 0);
  const nonZero = data.filter(d => d.total>0).length;
  const avg6 = nonZero > 0 ? Math.round(total6/nonZero) : 0;
  const current = data[data.length-1]?.total || 0;
  const prev = data[data.length-2]?.total || 0;
  const trend = prev > 0 ? Math.round(((current-prev)/prev)*100) : 0;

  return (
    <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"14px 16px",marginBottom:12 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
        <div>
          <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>6-Month Trend</p>
          <p style={{ margin:"3px 0 0",fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:textMain }}>₹{current.toLocaleString()}</p>
        </div>
        <div style={{ textAlign:"right" }}>
          {prev > 0 && (
            <span style={{ fontSize:12,fontWeight:700,padding:"3px 8px",borderRadius:99,background:trend>0?(dark?"#450a0a":"#fff1f2"):(dark?"#052e16":"#dcfce7"),color:trend>0?"#ef4444":"#16a34a" }}>
              {trend>0?"+":""}{trend}% vs last month
            </span>
          )}
          <p style={{ margin:"4px 0 0",fontSize:11,color:textMute }}>Avg ₹{avg6.toLocaleString()}/mo</p>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${(BAR_W+GAP)*6-GAP+40} ${H+28}`} style={{ overflow:"visible" }}>
        {data.map((d,i) => {
          const x = i*(BAR_W+GAP);
          const barH = max>0?Math.max(4,Math.round((d.total/max)*(H-10))):4;
          const y = H-barH;
          const isActive = d.isCurrent;
          const col = isActive?(dark?"#818cf8":"#4f46e5"):(dark?"#374151":"#e5e7eb");
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={col} style={{ transition:"height 0.5s,y 0.5s" }}/>
              {isActive && d.total>0 && (
                <text x={x+BAR_W/2} y={y-5} textAnchor="middle" style={{ fontSize:9,fill:dark?"#818cf8":"#4f46e5",fontFamily:"DM Mono,monospace",fontWeight:700 }}>
                  ₹{d.total>=1000?Math.round(d.total/1000)+"k":d.total}
                </text>
              )}
              <text x={x+BAR_W/2} y={H+14} textAnchor="middle" style={{ fontSize:10,fill:isActive?(dark?"#f9fafb":"#111827"):textMute,fontWeight:isActive?700:400,fontFamily:"DM Sans,sans-serif" }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXPENSE DATE LIST
// ════════════════════════════════════════════════════════════════════════════
function ExpenseDateList({ grouped, dailyTotal, today, dark, cardBg, border, subbg, textMute, getCatStyle, editExpense, deleteExpense, setDrillCat }) {
  const sortedDates = useMemo(() => Object.keys(grouped).sort((a,b) => new Date(b)-new Date(a)), [grouped]);
  const [openDates, setOpenDates] = useState(() => {
    const init = {};
    sortedDates.forEach(d => { init[d] = d===today; });
    return init;
  });

  // Keep openDates in sync as new dates appear, always open today
  useEffect(() => {
    setOpenDates(prev => {
      const next = { ...prev };
      sortedDates.forEach(d => { if (!(d in next)) next[d] = false; });
      if (!next[today]) next[today] = true;
      return next;
    });
  }, [sortedDates.join(","), today]);

  function toggle(dk) { if (dk === today) return; setOpenDates(p => ({ ...p, [dk]: !p[dk] })); }

  const btnDanger = { background:"none",border:"none",cursor:"pointer",color:textMute,padding:4 };

  return (
    <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,overflow:"hidden" }}>
      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${border}` }}>
        <h2 style={{ margin:0,fontSize:14,fontWeight:600 }}>All Expenses</h2>
      </div>
      {sortedDates.map((dk, idx) => {
        const daySpend = dailyTotal[dk] || 0;
        const isToday = dk===today;
        const isOpen = openDates[dk];
        const items = grouped[dk];
        const isLast = idx === sortedDates.length-1;
        return (
          <div key={dk} style={{ borderBottom:!isLast||isOpen?`1px solid ${border}`:"none" }}>
            <div onClick={() => toggle(dk)}
              style={{ padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:isToday?(dark?"rgba(79,70,229,0.08)":"rgba(79,70,229,0.04)"):subbg,cursor:isToday?"default":"pointer",userSelect:"none",borderBottom:isOpen?`1px solid ${border}`:"none" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                {isToday && <span style={{ fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,background:"#4f46e5",color:"#fff",letterSpacing:"0.05em" }}>TODAY</span>}
                <span style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:isToday?(dark?"#818cf8":"#4f46e5"):textMute }}>{formatDate(dk)}</span>
                <span style={{ fontSize:11,color:textMute }}>{items.length} item{items.length!==1?"s":""}</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:12,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444",background:dark?"rgba(239,68,68,0.1)":"#fff1f2",padding:"1px 8px",borderRadius:99 }}>−₹{daySpend.toLocaleString()}</span>
                {!isToday && (
                  <div style={{ transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",flexShrink:0 }}>
                    <ChevDown color={textMute}/>
                  </div>
                )}
              </div>
            </div>
            {isOpen && items.map((item, i) => (
              <SwipeableRow key={item.id} onDelete={() => deleteExpense(item.id)} border={border} dark={dark} cardBg={cardBg}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:i<items.length-1?`1px solid ${border}`:"none" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ ...getCatStyle(item.category),padding:"3px 9px",borderRadius:99,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" }}
                      onClick={() => setDrillCat(item.category)}>{item.category}</span>
                    <div>
                      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <p style={{ margin:0,fontSize:14,fontWeight:700 }}>₹{item.amount.toLocaleString()}</p>
                        <span style={{ display:"flex",alignItems:"center",gap:2,fontSize:10,fontWeight:600,padding:"1px 5px",borderRadius:6,
                          background:item.paySource==="cash"?(dark?"#052e16":"#dcfce7"):(dark?"#172554":"#dbeafe"),
                          color:item.paySource==="cash"?(dark?"#86efac":"#16a34a"):(dark?"#93c5fd":"#2563eb") }}>
                          {item.paySource==="cash"?<CashIcon/>:<BankIcon/>}
                          {item.paySource==="cash"?"Cash":"Bank"}
                        </span>
                      </div>
                      {item.note && <p style={{ margin:0,fontSize:12,color:textMute }}>{item.note}</p>}
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:10 }}>
                    <button onClick={() => { haptic(5); editExpense(item); }} style={btnDanger}><EditIcon/></button>
                    <button onClick={() => { haptic([10,40,10]); deleteExpense(item.id); }} style={btnDanger}><TrashIcon/></button>
                  </div>
                </div>
              </SwipeableRow>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VOICE LOGGER
// ════════════════════════════════════════════════════════════════════════════
function VoiceLogger({ categories, onAdd, dark, cardBg, border, textMute, textMain, inputBg, inputBorder, accent }) {
  const safeAccent = accent || "#4f46e5";
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [supported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recRef = useRef(null);

  function parseVoice(text) {
    const t = text.toLowerCase();
    const amtMatch = t.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g,"")) : null;
    const catNames = categories.map(c => c.name.toLowerCase());
    let category = categories[0]?.name || "";
    for (const c of catNames) {
      if (t.includes(c)) { category = categories.find(x => x.name.toLowerCase()===c)?.name || category; break; }
    }
    const note = text.replace(/[₹\d,.]+/g,"").replace(new RegExp(category,"i"),"").trim().replace(/\s+/g," ").slice(0,60) || "";
    return { amount, category, note };
  }

  function start() {
    if (!supported) { setError("Voice not supported in this browser. Try Chrome."); return; }
    setError(""); setTranscript(""); setParsed(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-IN"; rec.interimResults = true; rec.maxAlternatives = 1;
    recRef.current = rec;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length-1].isFinal) { setParsed(parseVoice(t)); setListening(false); }
    };
    rec.onerror = (e) => { setError("Mic error: " + e.error); setListening(false); };
    rec.onend = () => setListening(false);
    rec.start(); setListening(true);
  }
  function stop() { recRef.current?.stop(); setListening(false); }
  function confirm() { if (parsed?.amount) onAdd(parsed); }
  function reset() { setTranscript(""); setParsed(null); setError(""); }

  const inputStyle = { background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:16,marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <MicIcon size={18}/><span style={{ fontSize:14,fontWeight:700,color:textMain }}>Voice Log</span>
        <span style={{ fontSize:11,color:textMute,marginLeft:"auto" }}>Say amount + category + note</span>
      </div>
      {!supported && <p style={{ margin:0,fontSize:13,color:"#ef4444" }}>Not supported — use Chrome on Android/iOS</p>}
      {supported && (
        <>
          <button onClick={listening?stop:start}
            style={{ width:"100%",padding:"14px",borderRadius:14,border:"none",cursor:"pointer",background:listening?"#ef4444":safeAccent,color:"#fff",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:listening?"0 0 0 4px rgba(239,68,68,0.25)":"none",transition:"all 0.2s" }}>
            <MicIcon size={18}/>{listening?"Stop Listening":"Tap to Speak"}
          </button>
          {listening && <div style={{ textAlign:"center",fontSize:12,color:safeAccent,marginTop:8,fontWeight:500 }}>🎙 Listening… speak now</div>}
          {transcript && <div style={{ marginTop:10,padding:"10px 12px",background:dark?"#1f2937":"#f8fafc",borderRadius:10,fontSize:13,color:textMute,fontStyle:"italic" }}>"{transcript}"</div>}
          {error && <p style={{ margin:"8px 0 0",fontSize:12,color:"#ef4444" }}>{error}</p>}
          {parsed?.amount && (
            <div style={{ marginTop:12,padding:"12px",background:dark?"#052e16":"#f0fdf4",borderRadius:12,border:dark?"1px solid #065f46":"1px solid #bbf7d0" }}>
              <p style={{ margin:"0 0 6px",fontSize:12,color:textMute,fontWeight:600 }}>Detected — confirm to add:</p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                <div><p style={{ margin:"0 0 3px",fontSize:11,color:textMute }}>Amount</p><p style={{ margin:0,fontSize:18,fontWeight:800,color:"#16a34a",fontFamily:"monospace" }}>₹{parsed.amount.toLocaleString()}</p></div>
                <div><p style={{ margin:"0 0 3px",fontSize:11,color:textMute }}>Category</p>
                  <select value={parsed.category} onChange={e => setParsed(p => ({ ...p, category:e.target.value }))} style={{ ...inputStyle,padding:"4px 8px",fontSize:13 }}>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              {parsed.note && <p style={{ margin:"0 0 8px",fontSize:12,color:textMute }}>Note: {parsed.note}</p>}
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={confirm} style={{ flex:1,padding:"10px",borderRadius:12,border:"none",background:"#16a34a",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer" }}>✓ Add Expense</button>
                <button onClick={reset} style={{ padding:"10px 14px",borderRadius:12,border:`1px solid ${border}`,background:"none",color:textMute,cursor:"pointer" }}>✕</button>
              </div>
            </div>
          )}
          {parsed && !parsed.amount && <p style={{ margin:"8px 0 0",fontSize:12,color:"#ef4444" }}>Couldn't detect an amount. Try: "450 food lunch"</p>}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RECEIPT SCANNER
// ════════════════════════════════════════════════════════════════════════════
function ReceiptScanner({ categories, onAdd, dark, cardBg, border, textMute, textMain, inputBg, inputBorder, accent }) {
  const safeAccent = accent || "#4f46e5";
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function parseReceiptText(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const amounts = [];
    lines.forEach(l => {
      const m = l.match(/[\d,]+\.?\d{0,2}/g);
      if (m) m.forEach(n => { const v = parseFloat(n.replace(/,/g,"")); if (v>0&&v<MAX_AMOUNT) amounts.push(v); });
    });
    amounts.sort((a,b) => b-a);
    const amount = amounts[0] || null;
    const lower = text.toLowerCase();
    let category = categories[0]?.name || "Food";
    const hints = [
      ["food","restaurant","cafe","swiggy","zomato","hotel","dhaba","mess","biryani","pizza","burger"],
      ["grocery","supermarket","mart","bigbasket","blinkit","zepto","kirana","vegetables","fruits"],
      ["travel","uber","ola","rapido","auto","bus","train","metro","flight","fuel","petrol"],
      ["shopping","amazon","flipkart","myntra","cloth","shoes","mall"],
      ["bill","electricity","water","gas","internet","mobile","recharge","insurance"],
      ["entertainment","movie","pvr","inox","netflix","spotify","gaming"],
    ];
    const catNames = ["Food","Groceries","Travel","Shopping","Bills","Entertainment"];
    for (let i = 0; i < hints.length; i++) {
      if (hints[i].some(k => lower.includes(k))) {
        const match = categories.find(c => c.name===catNames[i]) || categories.find(c => c.name.toLowerCase()===catNames[i].toLowerCase());
        if (match) { category = match.name; break; }
      }
    }
    const note = lines.find(l => !/^[\d\s.,:₹Rs/-]+$/.test(l) && l.length>2 && l.length<50) || "";
    return { amount, category, note };
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(""); setParsed(null);
    setPreview(URL.createObjectURL(file));
    setScanning(true); setProgress("Loading OCR engine…");
    try {
      if (!window.Tesseract) {
        await new Promise((res,rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.onload = res; s.onerror = () => rej(new Error("Failed to load Tesseract"));
          document.head.appendChild(s);
        });
      }
      setProgress("Reading receipt…");
      const result = await window.Tesseract.recognize(file, "eng", {
        logger: m => { if (m.status==="recognizing text") setProgress(`Scanning… ${Math.round(m.progress*100)}%`); }
      });
      setParsed(parseReceiptText(result.data.text));
      setProgress("");
    } catch (err) {
      setError("OCR failed: " + err.message);
      setProgress("");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function reset() { setPreview(null); setParsed(null); setError(""); setProgress(""); }

  const inputStyle = { background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:16,marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <CameraIcon size={18}/><span style={{ fontSize:14,fontWeight:700,color:textMain }}>Receipt Scanner</span>
        <span style={{ fontSize:11,color:textMute,marginLeft:"auto" }}>OCR · fully local</span>
      </div>
      {!preview && (
        <button onClick={() => fileRef.current?.click()}
          style={{ width:"100%",padding:"20px",borderRadius:14,border:`2px dashed ${border}`,background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,color:textMute }}>
          <CameraIcon size={32}/>
          <span style={{ fontSize:14,fontWeight:600,color:textMute }}>Take Photo or Upload</span>
          <span style={{ fontSize:12 }}>Tap to open camera / gallery</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display:"none" }}/>
      {preview && (
        <div style={{ position:"relative",marginBottom:12 }}>
          <img src={preview} alt="receipt" style={{ width:"100%",borderRadius:12,maxHeight:200,objectFit:"cover" }}/>
          <button onClick={reset} style={{ position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",border:"none",borderRadius:99,padding:"4px 8px",color:"#fff",cursor:"pointer",fontSize:12 }}>✕ Clear</button>
        </div>
      )}
      {scanning && (
        <div style={{ textAlign:"center",padding:"16px 0" }}>
          <div style={{ fontSize:24,marginBottom:6 }}>🔍</div>
          <p style={{ margin:0,fontSize:13,color:safeAccent,fontWeight:600 }}>{progress||"Processing…"}</p>
          <p style={{ margin:"4px 0 0",fontSize:11,color:textMute }}>This may take 5–10 seconds</p>
        </div>
      )}
      {error && <p style={{ margin:"8px 0",fontSize:12,color:"#ef4444" }}>{error}</p>}
      {parsed && (
        <div style={{ padding:"12px",background:dark?"#052e16":"#f0fdf4",borderRadius:12,border:dark?"1px solid #065f46":"1px solid #bbf7d0" }}>
          <p style={{ margin:"0 0 8px",fontSize:12,color:textMute,fontWeight:600 }}>Detected from receipt:</p>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div>
              <p style={{ margin:"0 0 3px",fontSize:11,color:textMute }}>Amount</p>
              <input type="number" inputMode="decimal" value={parsed.amount||""} onChange={e => setParsed(p => ({ ...p,amount:Number(e.target.value) }))} style={{ ...inputStyle,fontWeight:700,color:"#16a34a" }}/>
            </div>
            <div>
              <p style={{ margin:"0 0 3px",fontSize:11,color:textMute }}>Category</p>
              <select value={parsed.category} onChange={e => setParsed(p => ({ ...p,category:e.target.value }))} style={inputStyle}>
                {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <p style={{ margin:"0 0 3px",fontSize:11,color:textMute }}>Note</p>
            <input value={parsed.note||""} onChange={e => setParsed(p => ({ ...p,note:e.target.value }))} placeholder="Add note" style={inputStyle}/>
          </div>
          {!parsed.amount && <p style={{ margin:"0 0 8px",fontSize:12,color:"#f97316" }}>⚠️ No amount detected — enter manually above</p>}
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={() => { if (parsed?.amount) onAdd(parsed); }} disabled={!parsed.amount}
              style={{ flex:1,padding:"10px",borderRadius:12,border:"none",background:parsed.amount?"#16a34a":"#9ca3af",color:"#fff",fontSize:14,fontWeight:700,cursor:parsed.amount?"pointer":"not-allowed" }}>✓ Add Expense</button>
            <button onClick={reset} style={{ padding:"10px 14px",borderRadius:12,border:`1px solid ${border}`,background:"none",color:textMute,cursor:"pointer" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EMI TAB
// ════════════════════════════════════════════════════════════════════════════
function EmiTab({ dark, cardBg, border, textMute, textMain, subbg, inputBg, inputBorder, setExpenses, setPot, showToast, today, logDay, accent }) {
  const safeAccent = accent || "#4f46e5";
  const [emis, setEmis] = useState(() => storageGet(KEYS.EMI, []));
  const [showForm, setShowForm] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { storageSetDebounced(KEYS.EMI, emis); }, [emis]);

  const inputStyle = { background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };
  const btnPrimary = { background:safeAccent,color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer" };
  const btnSecondary = { background:dark?"#374151":"#f3f4f6",color:dark?"#d1d5db":"#374151",border:"none",borderRadius:12,padding:"8px 12px",fontSize:13,fontWeight:500,cursor:"pointer" };
  const btnDanger = { background:"none",border:"none",cursor:"pointer",color:textMute,padding:4 };

  function resetForm() { setLoanName(""); setPrincipal(""); setRate(""); setTenure(""); setStartDate(today); setEditId(null); setShowForm(false); }

  function saveEmi() {
    const p = Number(principal), r = Number(rate), t = Math.min(Number(tenure), MAX_TENURE);
    if (!loanName.trim() || p <= 0 || r < 0 || t <= 0) return;
    const emi = Math.round(calcEMI(p, r, t));
    const entry = { id:editId||Date.now(), name:loanName.trim(), principal:p, rate:r, tenure:t, emi, startDate, paidMonths:editId?(emis.find(e=>e.id===editId)?.paidMonths||[]):[] };
    if (editId) { setEmis(prev => prev.map(e => e.id===editId?entry:e)); showToast("EMI updated!"); }
    else { setEmis(prev => [...prev, entry]); showToast("EMI loan added!"); }
    resetForm();
  }
  function deleteEmi(id) { setEmis(prev => prev.filter(e => e.id!==id)); showToast("Loan removed."); }
  function payEmi(loan) {
    const monthKey = today.slice(0,7);
    if ((loan.paidMonths||[]).includes(monthKey)) { showToast("Already paid this month!"); return; }
    setEmis(prev => prev.map(e => e.id!==loan.id?e:{ ...e, paidMonths:[...(e.paidMonths||[]),monthKey] }));
    setExpenses(prev => [...prev, { id:Date.now(), amount:loan.emi, category:"Bills", note:`${loan.name} EMI`, date:today, paySource:"bank" }]);
    setPot(p => deductPot(p, "bank", loan.emi));
    logDay(today);
    showToast(`₹${loan.emi.toLocaleString()} EMI logged!`);
  }
  function editEmi(loan) { setEditId(loan.id); setLoanName(loan.name); setPrincipal(loan.principal); setRate(loan.rate); setTenure(loan.tenure); setStartDate(loan.startDate); setShowForm(true); }

  const totalEmi = emis.reduce((s,e) => s+e.emi, 0);

  return (
    <div style={{ paddingBottom:20 }}>
      {emis.length>0 && (
        <div style={{ background:dark?"linear-gradient(135deg,#172554,#1e1b4b)":"linear-gradient(135deg,#eff6ff,#eef2ff)",border:dark?"1px solid #1e3a8a":"1px solid #bfdbfe",borderRadius:16,padding:16,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:dark?"#93c5fd":"#2563eb" }}>Total EMI / Month</p>
            <p style={{ margin:"4px 0 0",fontSize:28,fontWeight:800,fontFamily:"monospace",color:dark?"#93c5fd":"#1d4ed8",letterSpacing:"-1px" }}>₹{totalEmi.toLocaleString()}</p>
          </div>
          <div style={{ fontSize:36 }}>🏦</div>
        </div>
      )}
      {!showForm
        ? <button onClick={() => setShowForm(true)} style={{ ...btnPrimary,width:"100%",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PlusIcon/> Add Loan / EMI</button>
        : <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:16,marginBottom:12 }}>
            <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:700,color:textMain }}>{editId?"Edit Loan":"New Loan / EMI"}</h2>
            <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Loan name (e.g. Home Loan)" style={{ ...inputStyle,marginBottom:8 }}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
              <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Principal (₹)</p><input type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="500000" style={inputStyle}/></div>
              <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Annual Rate (%)</p><input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="8.5" style={inputStyle}/></div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
              <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Tenure (months, max 600)</p><input type="number" inputMode="numeric" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="60" max="600" style={inputStyle}/></div>
              <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Start date</p><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle}/></div>
            </div>
            {principal>0 && rate>=0 && tenure>0 && (
              <div style={{ background:dark?"#1f2937":"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:8 }}>
                <p style={{ margin:0,fontSize:12,color:textMute }}>Monthly EMI</p>
                <p style={{ margin:"2px 0 0",fontSize:22,fontWeight:800,color:safeAccent,fontFamily:"monospace" }}>₹{Math.round(calcEMI(Number(principal),Number(rate),Math.min(Number(tenure),MAX_TENURE))).toLocaleString()}</p>
                <p style={{ margin:"2px 0 0",fontSize:11,color:textMute }}>Total payable: ₹{Math.round(calcEMI(Number(principal),Number(rate),Math.min(Number(tenure),MAX_TENURE))*Math.min(Number(tenure),MAX_TENURE)).toLocaleString()}</p>
              </div>
            )}
            <div style={{ display:"flex",gap:8 }}><button onClick={saveEmi} style={{ ...btnPrimary,flex:1 }}>{editId?"Update":"Add Loan"}</button><button onClick={resetForm} style={btnSecondary}>Cancel</button></div>
          </div>
      }
      {emis.length===0 && !showForm && (
        <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:40,textAlign:"center" }}>
          <div style={{ fontSize:40,marginBottom:8 }}>🏦</div>
          <p style={{ margin:0,fontSize:14,fontWeight:600,color:textMain }}>No loans tracked yet</p>
          <p style={{ margin:"4px 0 0",fontSize:12,color:textMute }}>Add home loan, car loan, personal loan EMIs</p>
        </div>
      )}
      {emis.map(loan => {
        const monthKey = today.slice(0,7);
        const paidThisMonth = (loan.paidMonths||[]).includes(monthKey);
        const paidCount = (loan.paidMonths||[]).length;
        const remaining = loan.tenure - paidCount;
        const paidPct = Math.round((paidCount/loan.tenure)*100);
        const isExpanded = expandedId === loan.id;
        const amortization = isExpanded ? buildAmortization(loan.principal, loan.rate, loan.tenure) : [];
        return (
          <div key={loan.id} style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,marginBottom:10,overflow:"hidden" }}>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div>
                  <p style={{ margin:0,fontSize:15,fontWeight:700,color:textMain }}>{loan.name}</p>
                  <p style={{ margin:"2px 0 0",fontSize:12,color:textMute }}>₹{loan.principal.toLocaleString()} · {loan.rate}% · {loan.tenure}mo</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ margin:0,fontSize:20,fontWeight:800,color:safeAccent,fontFamily:"monospace" }}>₹{loan.emi.toLocaleString()}<span style={{ fontSize:11,color:textMute,fontWeight:400 }}>/mo</span></p>
                  {paidThisMonth && <span style={{ fontSize:11,color:"#16a34a",fontWeight:600 }}>✓ Paid this month</span>}
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:textMute,marginBottom:4 }}>
                  <span>{paidCount} paid</span><span>{remaining} remaining</span>
                </div>
                <div style={{ height:6,borderRadius:99,background:dark?"#1f2937":"#f3f4f6",overflow:"hidden" }}>
                  <div style={{ height:6,borderRadius:99,width:`${paidPct}%`,background:"linear-gradient(to right,#6366f1,#8b5cf6)",transition:"width 0.5s" }}/>
                </div>
                <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{paidPct}% complete · ₹{Math.round(loan.emi*remaining).toLocaleString()} outstanding</p>
              </div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {!paidThisMonth && <button onClick={() => payEmi(loan)} style={{ ...btnPrimary,fontSize:12,padding:"6px 14px",background:"#16a34a" }}>Pay ₹{loan.emi.toLocaleString()} Now</button>}
                <button onClick={() => setExpandedId(isExpanded?null:loan.id)} style={{ ...btnSecondary,fontSize:12,padding:"6px 12px" }}>{isExpanded?"Hide":"View"} Schedule</button>
                <button onClick={() => editEmi(loan)} style={btnDanger}><EditIcon/></button>
                <button onClick={() => deleteEmi(loan.id)} style={btnDanger}><TrashIcon/></button>
              </div>
            </div>
            {isExpanded && (
              <div style={{ borderTop:`1px solid ${border}`,overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                  <thead>
                    <tr style={{ background:dark?"#1f2937":"#f8fafc" }}>
                      {["Mo","EMI","Principal","Interest","Balance"].map(h => (
                        <th key={h} style={{ padding:"6px 10px",textAlign:"right",fontWeight:600,color:textMute,whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {amortization.slice(0,24).map(row => {
                      const mKey = new Date(loan.startDate + "T00:00:00");
                      mKey.setMonth(mKey.getMonth() + row.month - 1);
                      const mk = mKey.toISOString().slice(0,7);
                      const paid = (loan.paidMonths||[]).includes(mk);
                      return (
                        <tr key={row.month} style={{ borderTop:`1px solid ${border}`,background:paid?(dark?"rgba(22,163,74,0.08)":"rgba(22,163,74,0.05)"):"transparent" }}>
                          <td style={{ padding:"5px 10px",color:paid?"#16a34a":textMute,fontWeight:paid?700:400 }}>{row.month}{paid?" ✓":""}</td>
                          <td style={{ padding:"5px 10px",textAlign:"right",fontFamily:"monospace",color:textMain }}>₹{row.emi.toLocaleString()}</td>
                          <td style={{ padding:"5px 10px",textAlign:"right",fontFamily:"monospace",color:safeAccent }}>₹{row.principal.toLocaleString()}</td>
                          <td style={{ padding:"5px 10px",textAlign:"right",fontFamily:"monospace",color:"#ef4444" }}>₹{row.interest.toLocaleString()}</td>
                          <td style={{ padding:"5px 10px",textAlign:"right",fontFamily:"monospace",color:textMute }}>₹{row.balance.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {amortization.length>24 && <tr><td colSpan={5} style={{ padding:"6px 10px",textAlign:"center",color:textMute,fontSize:11 }}>Showing first 24 of {amortization.length} months</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SAVINGS GOALS
// ════════════════════════════════════════════════════════════════════════════
function SavingsGoals({ goals, savings, dark, cardBg, border, textMute, textMain, inputBg, inputBorder, today,
  showGoalForm, setShowGoalForm, goalName, setGoalName, goalTarget, setGoalTarget,
  goalDeadline, setGoalDeadline, goalEditId, setGoalEditId, saveGoal, deleteGoal, editGoal, accent }) {
  const safeAccent = accent || "#4f46e5";
  const inputStyle = { background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };
  const btnPrimary = { background:safeAccent,color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer" };
  const btnSecondary = { background:dark?"#374151":"#f3f4f6",color:dark?"#d1d5db":"#374151",border:"none",borderRadius:12,padding:"8px 12px",fontSize:13,fontWeight:500,cursor:"pointer" };

  function daysLeft(deadline) {
    if (!deadline) return null;
    const ist = nowIST(); ist.setHours(0,0,0,0);
    return Math.round((new Date(deadline+"T00:00:00") - ist) / 86_400_000);
  }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <p style={{ margin:0,fontSize:14,fontWeight:700,color:textMain }}>Savings Goals</p>
        {!showGoalForm && (
          <button onClick={() => setShowGoalForm(true)} style={{ ...btnSecondary,fontSize:12,padding:"5px 12px",display:"flex",alignItems:"center",gap:4 }}>
            <PlusIcon/>New
          </button>
        )}
      </div>
      {showGoalForm && (
        <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:14,marginBottom:12 }}>
          <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Goal name (e.g. Emergency Fund)" style={{ ...inputStyle,marginBottom:8 }}/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Target (₹)</p><input type="number" inputMode="decimal" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="50000" style={inputStyle}/></div>
            <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Deadline (optional)</p><input type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} style={inputStyle}/></div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={saveGoal} style={{ ...btnPrimary,flex:1 }}>{goalEditId?"Update":"Add Goal"}</button>
            <button onClick={() => { setShowGoalForm(false); setGoalName(""); setGoalTarget(""); setGoalDeadline(""); setGoalEditId(null); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}
      {goals.length===0 && !showGoalForm && (
        <div style={{ background:cardBg,border:`1px dashed ${border}`,borderRadius:16,padding:"20px 16px",textAlign:"center" }}>
          <p style={{ margin:0,fontSize:22 }}>🎯</p>
          <p style={{ margin:"6px 0 2px",fontSize:13,fontWeight:600,color:textMain }}>No goals yet</p>
          <p style={{ margin:0,fontSize:12,color:textMute }}>Set a target for emergency fund, travel, gadgets…</p>
        </div>
      )}
      {goals.map(g => {
        const pct = Math.min(100, Math.round((savings/g.target)*100));
        const dl = daysLeft(g.deadline);
        const reached = savings >= g.target;
        const needed = Math.max(0, g.target - savings);
        return (
          <div key={g.id} style={{ background:cardBg,border:`1px solid ${reached?(dark?"#065f46":"#bbf7d0"):border}`,borderRadius:16,padding:14,marginBottom:10 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <p style={{ margin:0,fontSize:14,fontWeight:700,color:textMain }}>{g.name}</p>
                  {reached && <span style={{ fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:99,background:dark?"#052e16":"#dcfce7",color:dark?"#34d399":"#065f46" }}>✓ Reached!</span>}
                </div>
                <p style={{ margin:"2px 0 0",fontSize:12,color:textMute }}>₹{savings.toLocaleString()} of ₹{g.target.toLocaleString()}</p>
              </div>
              <div style={{ display:"flex",gap:6 }}>
                <button onClick={() => editGoal(g)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,padding:3 }}><EditIcon/></button>
                <button onClick={() => deleteGoal(g.id)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,padding:3 }}><TrashIcon/></button>
              </div>
            </div>
            <div style={{ width:"100%",height:8,borderRadius:99,background:dark?"#1f2937":"#f3f4f6",overflow:"hidden",marginBottom:6 }}>
              <div style={{ height:8,borderRadius:99,width:`${pct}%`,background:reached?"linear-gradient(to right,#059669,#34d399)":"linear-gradient(to right,#4f46e5,#8b5cf6)",transition:"width 0.6s ease" }}/>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:textMute }}>
              <span style={{ fontWeight:700,color:reached?(dark?"#34d399":"#059669"):(dark?"#818cf8":"#4f46e5") }}>{pct}%</span>
              {!reached && <span>₹{needed.toLocaleString()} to go</span>}
              {dl!==null && !reached && <span style={{ color:dl<=7?"#f97316":textMute }}>{dl>0?`${dl}d left`:dl===0?"Due today":"Overdue"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(false);

  // ── Today / clock ─────────────────────────────────────────────────────────
  const [today, setToday] = useState(() => getTodayIST());
  useEffect(() => {
    function schedule() {
      const ms = msUntilMidnightIST();
      return setTimeout(() => { setToday(getTodayIST()); schedule(); }, ms + 500);
    }
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Re-lock after 3 min in background
  const hiddenAt = useRef(null);
  useEffect(() => {
    function onVis() {
      if (document.hidden) { hiddenAt.current = Date.now(); }
      else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > 3*60*1000) setUnlocked(false);
        hiddenAt.current = null;
        setToday(getTodayIST());
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ── Theme / accent ────────────────────────────────────────────────────────
  const [dark, setDark] = useState(() => storageGet(KEYS.THEME, "light") === "dark");
  const [accentId, setAccentId] = useState(() => storageGet(KEYS.ACCENT, "indigo"));
  const accentObj = ACCENTS.find(a => a.id===accentId) || ACCENTS[0];
  const accent = dark ? accentObj.dark : accentObj.light;

  useEffect(() => { storageSetDebounced(KEYS.THEME, dark?"dark":"light"); }, [dark]);
  useEffect(() => { storageSet(KEYS.ACCENT, accentId); }, [accentId]);

  // ── Core data ─────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState(() => storageGet(KEYS.EXPENSES, []));
  // FIX: budget stored as number, not string
  const [budget, setBudget] = useState(() => {
    const v = storageGet(KEYS.BUDGET, 0);
    return typeof v === "string" ? Number(v) : v;
  });
  const [categories, setCategories] = useState(() => {
    const p = storageGet(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    // Migrate old string-array format
    if (p.length>0 && typeof p[0]==="string") return p.map((name,i) => ({ name, colorIdx: i%CAT_PALETTE.length }));
    return p;
  });
  const [streak, setStreak] = useState(() => storageGet(KEYS.STREAK, EMPTY_STREAK));
  const [recurring, setRecurring] = useState(() => storageGet(KEYS.RECURRING, []));
  const [pot, setPot] = useState(() => storageGet(KEYS.POT, DEFAULT_POT));
  const [dismissedMap, setDismissedMap] = useState(() => storageGet(KEYS.DISMISS, {}));
  const [notifEnabled, setNotifEnabled] = useState(() => storageGet(KEYS.NOTIF, false));
  const [userName, setUserName] = useState(() => storageGet(KEYS.USER, ""));
  const [notifLog, setNotifLog] = useState(() => storageGet(KEYS.NOTIF_LOG, []));
  const [goals, setGoals] = useState(() => storageGet(KEYS.GOALS, []));

  // Persist all core data
  useEffect(() => { storageSetDebounced(KEYS.EXPENSES, expenses); }, [expenses]);
  useEffect(() => { storageSetDebounced(KEYS.BUDGET, budget); }, [budget]);
  useEffect(() => { storageSetDebounced(KEYS.CATEGORIES, categories); }, [categories]);
  useEffect(() => { storageSetDebounced(KEYS.STREAK, streak); }, [streak]);
  useEffect(() => { storageSetDebounced(KEYS.RECURRING, recurring); }, [recurring]);
  useEffect(() => { storageSetDebounced(KEYS.POT, pot); }, [pot]);
  useEffect(() => { storageSetDebounced(KEYS.DISMISS, dismissedMap); }, [dismissedMap]);
  useEffect(() => { storageSet(KEYS.NOTIF, notifEnabled); }, [notifEnabled]);
  useEffect(() => { storageSet(KEYS.USER, userName); }, [userName]);
  useEffect(() => { storageSetDebounced(KEYS.NOTIF_LOG, notifLog); }, [notifLog]);
  useEffect(() => { storageSetDebounced(KEYS.GOALS, goals); }, [goals]);

  // ── Form state (Add Expense) ──────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [amountShake, setAmountShake] = useState(false);
  const [selCat, setSelCat] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => getTodayIST());
  const [editingId, setEditingId] = useState(null);
  const [paySource, setPaySource] = useState("bank");
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("home");
  const [drillCat, setDrillCat] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // ── Recurring form ────────────────────────────────────────────────────────
  const [rName, setRName] = useState("");
  const [rAmount, setRAmount] = useState("");
  const [rCat, setRCat] = useState("");
  const [rFreq, setRFreq] = useState("Monthly");
  const [rDueDate, setRDueDate] = useState(() => getTodayIST());
  const [rEditId, setREditId] = useState(null);
  const [showRForm, setShowRForm] = useState(false);

  // ── Pot / income form ─────────────────────────────────────────────────────
  const [potSection, setPotSection] = useState("usable");
  const [cashAdj, setCashAdj] = useState(""); const [cashMode, setCashMode] = useState(null);
  const [bankAdj, setBankAdj] = useState(""); const [bankMode, setBankMode] = useState(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incName, setIncName] = useState(""); const [incAmt, setIncAmt] = useState(""); const [incFreq, setIncFreq] = useState("Monthly"); const [incEditId, setIncEditId] = useState(null);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraLabel, setExtraLabel] = useState(""); const [extraAmt, setExtraAmt] = useState(""); const [extraDate, setExtraDate] = useState(() => getTodayIST());

  // ── Goals form ────────────────────────────────────────────────────────────
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState(""); const [goalTarget, setGoalTarget] = useState(""); const [goalDeadline, setGoalDeadline] = useState(""); const [goalEditId, setGoalEditId] = useState(null);

  // ── Seed defaults ─────────────────────────────────────────────────────────
  useEffect(() => { if (!selCat && categories.length>0) setSelCat(categories[0].name); }, [categories]);
  useEffect(() => { if (!rCat && categories.length>0) setRCat(categories[0].name); }, [categories]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const toastTimer = useRef(null);
  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  // ── Category helpers ──────────────────────────────────────────────────────
  const { getCatStyle, getCatAccent } = useCategoryHelpers(categories, dark);

  // ── Streak helpers ────────────────────────────────────────────────────────
  const todayLogged = streak.loggedDates.includes(today);
  function logDay(dateStr) {
    setStreak(prev => updateStreak(prev, dateStr));
  }
  function logNoSpend() {
    if (todayLogged) { showToast("Already logged!"); return; }
    logDay(today); showToast("No-spend day logged! 🛡️");
  }

  // ── Period selector state (Expenses tab) ─────────────────────────────────
  // Compute currentYM inline so useState initializer can use it directly
  const currentYM = (() => {
    const d = nowIST();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  })();

  const [viewMonth, setViewMonth] = useState(() => {
    const d = nowIST();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const [viewDay,   setViewDay]   = useState("all");

  // Reset day when month changes
  useEffect(() => { setViewDay("all"); }, [viewMonth]);

  // All distinct "YYYY-MM" months that have expenses, newest first
  const availableMonths = useMemo(() => {
    const set = new Set(expenses.map(e => e.date.slice(0,7)));
    // Always include current month even if empty
    set.add(currentYM);
    return [...set].sort((a,b) => b.localeCompare(a));
  }, [expenses, currentYM]);

  // Expenses filtered to selected month
  const monthExpenses = useMemo(() => {
    if (viewMonth === "all") return expenses;
    return expenses.filter(e => e.date.startsWith(viewMonth));
  }, [expenses, viewMonth]);

  // Expenses filtered to selected month + optional day
  const periodExpenses = useMemo(() => {
    if (viewDay === "all") return monthExpenses;
    return monthExpenses.filter(e => e.date === viewDay);
  }, [monthExpenses, viewDay]);

  // All distinct days in the selected month that have expenses
  const availableDays = useMemo(() => {
    const set = new Set(monthExpenses.map(e => e.date));
    return [...set].sort((a,b) => b.localeCompare(a));
  }, [monthExpenses]);

  // ── Derived / memoised ────────────────────────────────────────────────────
  // catTotals scoped to the selected period
  const catTotals = useMemo(() =>
    periodExpenses.reduce((acc,e) => { acc[e.category]=(acc[e.category]||0)+e.amount; return acc; }, {}),
  [periodExpenses]);

  const { grouped, dailyTotal } = useMemo(() => groupByDate(periodExpenses), [periodExpenses]);

  // FIX: monthly total now uses only current-month expenses
  const monthlyTotal = useMemo(() => computeMonthlyTotal(expenses), [expenses, today]);

  // FIX: budget bar compares against monthly spend, not all-time
  const spent = monthlyTotal;
  const remaining = budget - spent;
  const percentUsed = budget > 0 ? Math.min((spent/budget)*100, 100) : 0;

  const recurringMonthly = useMemo(() =>
    recurring.reduce((s,r) => s + toMonthlyAmount(r.amount, r.frequency), 0),
  [recurring]);

  const monthlyIncome = useMemo(() =>
    (pot.incomes||[]).filter(i => i.active).reduce((s,i) => s + toMonthlyAmount(i.amount, i.frequency), 0),
  [pot.incomes]);

  const goldValue = useMemo(() => (Number(pot.goldGrams)||0)*(Number(pot.goldRate)||0), [pot.goldGrams, pot.goldRate]);
  const usableTotal = (Number(pot.usableCash)||0) + (Number(pot.usableBank)||0);
  const netWorthTotal = usableTotal + (Number(pot.savings)||0) + (Number(pot.investments)||0) + goldValue;

  const extrasThisMonth = useMemo(() =>
    (pot.extras||[]).filter(e => isInCurrentMonth(e.date)).reduce((s,e) => s+e.amount, 0),
  [pot.extras, today]);

  const totalIn = monthlyIncome + extrasThisMonth;
  const daysElapsed = useMemo(() => Math.max(1, nowIST().getDate()), [today]);
  const dailyAvg = daysElapsed > 0 ? Math.round(monthlyTotal/daysElapsed) : 0;

  const trendData = useMemo(() => buildTrendData(expenses), [expenses, today]);
  // topCategory uses all-time totals, not the period-filtered catTotals
  const allTimeCatTotals = useMemo(() =>
    expenses.reduce((acc,e) => { acc[e.category]=(acc[e.category]||0)+e.amount; return acc; }, {}),
  [expenses]);
  const topCategory = useMemo(() =>
    Object.keys(allTimeCatTotals).sort((a,b) => allTimeCatTotals[b]-allTimeCatTotals[a])[0],
  [allTimeCatTotals]);

  const streakMilestone = streak.count>=30?"30-day legend! 🏆":streak.count>=14?"2-week warrior!":streak.count>=7?"One week strong!":null;
  const last14 = useMemo(() => getLastNDays(14), [today]);

  const potBase = monthlyIncome > 0 ? monthlyIncome : netWorthTotal > 0 ? netWorthTotal : 1;
  const usableFillPct = Math.min(100, (usableTotal/potBase)*100);
  const nwFillActual = netWorthTotal > 0 ? Math.min(100, (usableTotal/netWorthTotal)*100+20) : 0;

  // ── Reminders ─────────────────────────────────────────────────────────────
  const istNow = useMemo(() => nowIST(), [today]);
  const reminders = useMemo(() =>
    recurring
      .filter(r => {
        const days = daysFromToday(r.nextDue);
        if (days > 3) return false;
        if (dismissedMap[r.id] === today) return false;
        const paidTM = (r.paid||[]).some(d => {
          const pd = new Date(d+"T00:00:00");
          return pd.getMonth()===istNow.getMonth() && pd.getFullYear()===istNow.getFullYear();
        });
        return !paidTM;
      })
      .map(r => ({ id:r.id, name:r.name, amount:r.amount, daysUntil:daysFromToday(r.nextDue), dueDateStr:formatDate(r.nextDue), category:r.category }))
      .sort((a,b) => a.daysUntil-b.daysUntil),
  [recurring, dismissedMap, today, istNow]);

  function dismissReminder(id) { setDismissedMap(p => ({ ...p, [id]: today })); }

  // Log reminders to notif history
  useEffect(() => {
    if (reminders.length===0) return;
    setNotifLog(prev => {
      let changed = false;
      const next = [...prev];
      reminders.forEach(r => {
        const key = `${r.id}-${today}`;
        if (!prev.some(n => n.key===key)) {
          next.unshift({ key, id:r.id, name:r.name, amount:r.amount, daysUntil:r.daysUntil, dueDateStr:r.dueDateStr, ts:Date.now() });
          changed = true;
        }
      });
      return changed ? next.slice(0,50) : prev;
    });
  }, [today, reminders.length]);

  // ── Notifications ─────────────────────────────────────────────────────────
  const recurringRef = useRef(recurring);
  const dismissedMapRef = useRef(dismissedMap);
  useEffect(() => { recurringRef.current = recurring; }, [recurring]);
  useEffect(() => { dismissedMapRef.current = dismissedMap; }, [dismissedMap]);
  useEffect(() => {
    if (notifEnabled) scheduleReminderNotifs(recurringRef.current, dismissedMapRef.current);
  }, [notifEnabled]);

  async function toggleNotif() {
    if (!notifEnabled) {
      const granted = await requestNotifPermission();
      if (granted) { setNotifEnabled(true); showToast("Notifications on!"); }
      else showToast("Permission denied — enable in browser settings");
    } else { setNotifEnabled(false); showToast("Notifications off"); }
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────────
  function resetExpenseForm() { setAmount(""); setNote(""); setDate(today); setEditingId(null); setPaySource("bank"); }

  function saveExpense() {
    if (!isValidAmount(amount) || Number(amount) <= 0) {
      setAmountShake(true); setTimeout(() => setAmountShake(false), 500); return;
    }
    const num = Number(amount);
    if (editingId) {
      const old = expenses.find(e => e.id===editingId);
      setPot(p => { let u = refundPot(p, old.paySource||"bank", old.amount); return deductPot(u, paySource, num); });
      setExpenses(p => p.map(e => e.id===editingId ? { ...e, amount:num, category:selCat, note, date, paySource } : e));
      showToast("Updated!");
    } else {
      const currentBal = paySource==="cash" ? Number(pot.usableCash)||0 : Number(pot.usableBank)||0;
      if (num > currentBal) showToast(`⚠️ Low balance — only ₹${currentBal.toLocaleString()} in ${paySource}`);
      setExpenses(p => [...p, { id:Date.now(), amount:num, category:selCat, note, date, paySource }]);
      setPot(p => deductPot(p, paySource, num));
      showToast(`Added · deducted from ${paySource}`);
    }
    logDay(date);
    resetExpenseForm();
  }

  function editExpense(item) { setEditingId(item.id); setAmount(String(item.amount)); setSelCat(item.category); setNote(item.note); setDate(item.date); setPaySource(item.paySource||"bank"); }

  function deleteExpense(id) {
    const exp = expenses.find(e => e.id===id);
    if (exp) setPot(p => refundPot(p, exp.paySource||"bank", exp.amount));
    setExpenses(p => p.filter(e => e.id!==id));
    showToast("Deleted & refunded.");
  }

  function handleVoiceAdd({ amount, category, note }) {
    if (!amount || amount<=0) return;
    const cat = categories.find(c => c.name===category)?.name || categories[0]?.name || "";
    setExpenses(p => [...p, { id:Date.now(), amount:Number(amount), category:cat, note:note||"", date:today, paySource:"bank" }]);
    setPot(p => deductPot(p, "bank", Number(amount)));
    logDay(today); showToast("Voice expense added!"); setTab("expenses");
  }
  function handleReceiptAdd({ amount, category, note }) {
    if (!amount || amount<=0) return;
    const cat = categories.find(c => c.name===category)?.name || categories[0]?.name || "";
    setExpenses(p => [...p, { id:Date.now(), amount:Number(amount), category:cat, note:note||"", date:today, paySource:"bank" }]);
    setPot(p => deductPot(p, "bank", Number(amount)));
    logDay(today); showToast("Receipt expense added!"); setTab("expenses");
  }

  // ── Recurring CRUD ────────────────────────────────────────────────────────
  function resetRForm() { setRName(""); setRAmount(""); setRCat(categories[0]?.name||""); setRFreq("Monthly"); setRDueDate(today); setREditId(null); setShowRForm(false); }
  function saveRecurring() {
    if (!rName.trim() || !isValidAmount(rAmount)) return;
    const nextDue = getNextDueDate(rDueDate, rFreq);
    const entry = { id:rEditId||Date.now(), name:rName.trim(), amount:Number(rAmount), category:rCat, frequency:rFreq, dueDate:rDueDate, nextDue, paid:[] };
    if (rEditId) { setRecurring(p => p.map(r => r.id===rEditId ? { ...entry, paid:r.paid } : r)); showToast("Updated!"); }
    else { setRecurring(p => [...p, entry]); showToast("Recurring added!"); }
    resetRForm();
  }
  function editRecurring(r) { setREditId(r.id); setRName(r.name); setRAmount(r.amount); setRCat(r.category); setRFreq(r.frequency); setRDueDate(r.dueDate||r.startDate||today); setShowRForm(true); }
  function deleteRecurring(id) { setRecurring(p => p.filter(r => r.id!==id)); showToast("Removed."); }
  function markPaid(r, source="bank") {
    const pd = today;
    setExpenses(p => [...p, { id:Date.now(), amount:r.amount, category:r.category, note:`${r.name} (${r.frequency})`, date:pd, paySource:source }]);
    const nextDue = getNextDueDate(pd, r.frequency);
    setRecurring(p => p.map(item => item.id!==r.id ? item : { ...item, nextDue, paid:[...(item.paid||[]),pd] }));
    setPot(p => deductPot(p, source, r.amount));
    setDismissedMap(prev => { const n={...prev}; delete n[r.id]; return n; });
    logDay(pd); showToast(`${r.name} paid from ${source}!`);
  }
  function payFromReminder(item, source) { const r = recurring.find(x => x.id===item.id); if (r) markPaid(r, source); }

  // ── Budget ────────────────────────────────────────────────────────────────
  function saveBudget() {
    if (!budgetInput) return;
    setBudget(Number(budgetInput)); setBudgetInput(""); setEditingBudget(false); showToast("Budget updated!");
  }

  // ── Categories ────────────────────────────────────────────────────────────
  function addCategory() {
    const name = newCatName.trim();
    if (!name || categories.find(c => c.name===name)) { showToast("Name is empty or already exists."); return; }
    setCategories(p => [...p, { name, colorIdx: p.length % CAT_PALETTE.length }]);
    setNewCatName(""); setAddingCat(false); showToast("Category added!");
  }

  // ── Pot helpers ───────────────────────────────────────────────────────────
  function quickAdjust(field, mode, val) {
    const num = Number(val)||0;
    if (num<=0) return;
    setPot(p => ({ ...p, [field]: mode==="add" ? (Number(p[field])||0)+num : Math.max(0,(Number(p[field])||0)-num) }));
    showToast(`${mode==="add"?"+":"-"}₹${num.toLocaleString()} ${field==="usableCash"?"cash":"bank"}`);
  }
  function updateNWField(field, val) {
    const newVal = Number(val)||0;
    const diff = newVal - (Number(pot[field])||0);
    setPot(p => ({ ...p, [field]:newVal, usableBank:Math.max(0,(Number(p.usableBank)||0)-diff) }));
  }

  // ── Income / extras ───────────────────────────────────────────────────────
  function resetIncomeForm() { setIncName(""); setIncAmt(""); setIncFreq("Monthly"); setIncEditId(null); setShowIncomeForm(false); }
  function saveIncome() {
    if (!incName.trim() || !isValidAmount(incAmt)) return;
    const entry = { id:incEditId||Date.now(), label:incName.trim(), amount:Number(incAmt), frequency:incFreq, active:true };
    if (incEditId) { setPot(p => ({ ...p, incomes:p.incomes.map(i => i.id===incEditId?entry:i) })); showToast("Updated!"); }
    else { setPot(p => ({ ...p, incomes:[...(p.incomes||[]),entry] })); showToast("Income added!"); }
    resetIncomeForm();
  }
  function deleteIncome(id) { setPot(p => ({ ...p, incomes:p.incomes.filter(i => i.id!==id) })); showToast("Removed."); }
  function editIncome(inc) { setIncEditId(inc.id); setIncName(inc.label); setIncAmt(inc.amount); setIncFreq(inc.frequency); setShowIncomeForm(true); }
  function creditIncome(inc) { setPot(p => ({ ...p, usableBank:(Number(p.usableBank)||0)+Number(inc.amount) })); showToast(`₹${Number(inc.amount).toLocaleString()} credited to bank!`); }
  function saveExtra() {
    if (!extraLabel.trim() || !isValidAmount(extraAmt)) return;
    const entry = { id:Date.now(), label:extraLabel.trim(), amount:Number(extraAmt), date:extraDate };
    setPot(p => ({ ...p, extras:[...(p.extras||[]),entry], usableBank:(Number(p.usableBank)||0)+Number(extraAmt) }));
    setExtraLabel(""); setExtraAmt(""); setExtraDate(today); setShowExtraForm(false);
    showToast(`₹${Number(extraAmt).toLocaleString()} added to bank!`);
  }
  function deleteExtra(id) {
    const ex = (pot.extras||[]).find(e => e.id===id);
    if (ex) setPot(p => ({ ...p, extras:p.extras.filter(e => e.id!==id), usableBank:Math.max(0,(Number(p.usableBank)||0)-ex.amount) }));
    showToast("Removed.");
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  function saveGoal() {
    if (!goalName.trim() || !goalTarget || Number(goalTarget)<=0) return;
    const entry = { id:goalEditId||Date.now(), name:goalName.trim(), target:Number(goalTarget), deadline:goalDeadline||null, createdOn:today };
    if (goalEditId) { setGoals(p => p.map(g => g.id===goalEditId?entry:g)); showToast("Goal updated!"); }
    else { setGoals(p => [...p,entry]); showToast("Goal added!"); }
    setGoalName(""); setGoalTarget(""); setGoalDeadline(""); setGoalEditId(null); setShowGoalForm(false);
  }
  function deleteGoal(id) { setGoals(p => p.filter(g => g.id!==id)); showToast("Goal removed."); }
  function editGoal(g) { setGoalEditId(g.id); setGoalName(g.name); setGoalTarget(g.target); setGoalDeadline(g.deadline||""); setShowGoalForm(true); }

  // ── PIN / biometrics ──────────────────────────────────────────────────────
  function resetPin() { storageRemove(KEYS.PIN); storageRemove(KEYS.BIO_CRED); setUnlocked(false); showToast("PIN cleared — set a new one on next open"); }
  function resetBiometric() { storageRemove(KEYS.BIO_CRED); showToast("Biometrics removed"); }

  // ── Name ──────────────────────────────────────────────────────────────────
  function saveName() { const n = nameInput.trim(); if (!n) return; setUserName(n); setEditingName(false); setNameInput(""); showToast("Name saved!"); }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg       = dark ? "#030712" : "#f8fafc";
  const cardBg   = dark ? "#111827" : "#ffffff";
  const border   = dark ? "#1f2937" : "#f1f5f9";
  const textMain = dark ? "#f9fafb" : "#111827";
  const textMute = dark ? "#6b7280" : "#6b7280";
  const inputBg  = dark ? "#1f2937" : "#ffffff";
  const inputBorder = dark ? "#374151" : "#e5e7eb";
  const subbg    = dark ? "#1f2937" : "#f8fafc";
  const cardStyle  = { background:cardBg, border:`1px solid ${border}`, borderRadius:16, padding:16, marginBottom:12 };
  const inputStyle = { background:inputBg, border:`1px solid ${inputBorder}`, color:textMain, borderRadius:12, padding:"10px 12px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box" };
  const btnPrimary   = { background:accent, color:"#fff", border:"none", borderRadius:12, padding:"10px 16px", fontSize:14, fontWeight:600, cursor:"pointer" };
  const btnSecondary = { background:dark?"#374151":"#f3f4f6", color:dark?"#d1d5db":"#374151", border:"none", borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:500, cursor:"pointer" };
  const btnGreen  = { background:dark?"#064e3b":"#d1fae5", color:dark?"#34d399":"#065f46", border:"none", borderRadius:12, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 };
  const btnDanger = { background:"none", border:"none", cursor:"pointer", color:textMute, padding:4 };

  // ── Inject CSS custom property for accent ─────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  // ── LOCK SCREEN ───────────────────────────────────────────────────────────
  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} dark={dark} accent={accent}/>;

  // ── CATEGORY DRILL-DOWN ───────────────────────────────────────────────────
  if (drillCat) {
    // Drill-down respects the active period filter
    const catExpenses = [...periodExpenses].filter(e => e.category===drillCat).sort((a,b) => new Date(b.date)-new Date(a.date));
    const catTotal = catExpenses.reduce((s,e) => s+e.amount, 0);
    const periodLabel = viewDay !== "all" ? formatDate(viewDay) : (() => { const [yr,mo] = viewMonth.split("-"); return MONTH_LABELS[Number(mo)-1]+" "+yr; })();
    const catAccent = getCatAccent(drillCat);
    return (
      <ErrorBoundary dark={dark}>
        <div style={{ minHeight:"100vh", background:bg, color:textMain, fontFamily:"'DM Sans',sans-serif" }}>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
          <style>{`@keyframes tabFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.tabContent{animation:tabFade 0.15s ease}`}</style>
          <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 16px" }} className="tabContent">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <button onClick={() => setDrillCat(null)} style={{ ...btnSecondary, display:"flex", alignItems:"center", padding:"6px 10px" }}><ChevronL/></button>
              <span style={{ ...getCatStyle(drillCat), padding:"4px 12px", borderRadius:99, fontSize:13, fontWeight:700 }}>{drillCat}</span>
              <span style={{ fontSize:20, fontWeight:800, fontFamily:"'DM Mono',monospace", color:catAccent, marginLeft:"auto" }}>₹{catTotal.toLocaleString()}</span>
            </div>
            {/* Period label */}
            <div style={{ marginBottom:12,padding:"6px 12px",background:dark?"rgba(79,70,229,0.08)":"rgba(79,70,229,0.05)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontSize:11,color:dark?"#818cf8":"#4f46e5",fontWeight:600 }}>{periodLabel}</span>
              <span style={{ fontSize:11,color:textMute }}>{catExpenses.length} expense{catExpenses.length!==1?"s":""} · ₹{catTotal.toLocaleString()}</span>
            </div>
            {catExpenses.length===0
              ? <div style={{ ...cardStyle, textAlign:"center", padding:40 }}><p style={{ color:textMute, margin:0 }}>No expenses in {drillCat} for this period.</p></div>
              : catExpenses.map(item => (
                  <div key={item.id} style={{ ...cardStyle, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ margin:0, fontSize:14, fontWeight:700, color:catAccent }}>₹{item.amount.toLocaleString()}</p>
                      {item.note && <p style={{ margin:"2px 0 0", fontSize:12, color:textMute }}>{item.note}</p>}
                      <div style={{ display:"flex", gap:8, marginTop:4, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:textMute }}>{formatDate(item.date)}</span>
                        <span style={{ display:"flex",alignItems:"center",gap:2,fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:6,
                          background:item.paySource==="cash"?(dark?"#052e16":"#dcfce7"):(dark?"#172554":"#dbeafe"),
                          color:item.paySource==="cash"?(dark?"#86efac":"#16a34a"):(dark?"#93c5fd":"#2563eb") }}>
                          {item.paySource==="cash"?<CashIcon/>:<BankIcon/>}{item.paySource==="cash"?"Cash":"Bank"}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => { setDrillCat(null); editExpense(item); setTab("scanvoice"); }} style={btnDanger}><EditIcon/></button>
                      <button onClick={() => deleteExpense(item.id)} style={btnDanger}><TrashIcon/></button>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <ErrorBoundary dark={dark}>
      <div style={{ minHeight:"100vh", background:bg, color:textMain, fontFamily:"'DM Sans',sans-serif", transition:"background 0.3s" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
        <style>{`
          @keyframes tabFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
          .tabContent{animation:tabFade 0.15s ease}
          input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:1}
          input[type=number]{-moz-appearance:textfield}
        `}</style>

        <Toast msg={toast}/>

        <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 16px" }} key={tab} className="tabContent">

          {/* ── HEADER ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => { haptic(8); setShowSettings(true); }}
                style={{ width:40,height:40,borderRadius:"50%",background:avatarColor(userName),border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
                <span style={{ fontSize:15,fontWeight:800,color:"#fff",letterSpacing:"-0.5px" }}>{getInitials(userName)}</span>
              </button>
              <div>
                <h1 style={{ margin:0,fontSize:18,fontWeight:700,letterSpacing:"-0.3px",color:textMain }}>{tab==="home"?getGreeting(userName):"mySpendr"}</h1>
                <p style={{ margin:0,fontSize:11,color:textMute,marginTop:1 }}>{tab==="home"?(userName?"":"Tap avatar to set your name"):"Track. Save. Streak."}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <button onClick={() => { haptic(8); setShowNotifPanel(true); }} title="Notifications"
                style={{ ...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center",position:"relative" }}>
                <BellIcon/>
                {reminders.length>0 && <span style={{ position:"absolute",top:5,right:5,width:8,height:8,borderRadius:"50%",background:"#ef4444",border:`2px solid ${cardBg}` }}/>}
              </button>
              <button onClick={() => { haptic(8); setDark(d => !d); }}
                style={{ ...btnSecondary, padding:"8px 10px", display:"flex", alignItems:"center" }}>
                {dark?<SunIcon/>:<MoonIcon/>}
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              HOME TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="home" && (
            <>
              {/* Streak card */}
              <div style={{ ...cardStyle, position:"relative", overflow:"hidden" }}>
                {streak.count>0 && <div style={{ position:"absolute",right:-32,top:-32,width:128,height:128,background:"rgba(249,115,22,0.08)",borderRadius:"50%",filter:"blur(24px)",pointerEvents:"none" }}/>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:textMute,marginBottom:4 }}>Streak</p>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                      <span style={{ fontSize:52,fontWeight:700,fontFamily:"'DM Mono',monospace",lineHeight:1 }}>{streak.count}</span>
                      <span style={{ fontSize:18,color:textMute,marginBottom:4 }}>days</span>
                    </div>
                    {streakMilestone && <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:4,color:"#f97316",fontSize:12,fontWeight:600 }}><TrophyIcon/>{streakMilestone}</div>}
                    <p style={{ margin:"3px 0 0",fontSize:12,color:textMute }}>Best: <strong>{streak.longestStreak||0} days</strong></p>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:12,fontSize:13,fontWeight:600,background:streak.count>0?(dark?"rgba(194,65,12,0.2)":"#ffedd5"):subbg,color:streak.count>0?"#f97316":textMute }}>
                      <FlameIcon size={16}/>{streak.count}
                    </div>
                    {!todayLogged
                      ? <button onClick={() => { haptic([10,50,10]); logNoSpend(); }}
                          style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:12,fontSize:12,fontWeight:600,background:"transparent",border:dark?"1px solid #065f46":"1px solid #6ee7b7",color:dark?"#34d399":"#059669",cursor:"pointer" }}>
                          <ShieldIcon/>No-Spend Day
                        </button>
                      : <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:500,color:dark?"#34d399":"#059669" }}><ShieldIcon/>Today logged</div>
                    }
                  </div>
                </div>
                <div style={{ marginTop:14 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(14,1fr)", gap:4 }}>
                    {last14.map(d => {
                      const lg = streak.loggedDates.includes(d), it = d===today;
                      return <div key={d} title={d} style={{ height:18,borderRadius:4,background:lg?"#f97316":it?"transparent":(dark?"#1f2937":"#f3f4f6"),border:it&&!lg?(dark?"1px solid rgba(249,115,22,0.4)":"1px solid #fdba74"):"none",transition:"background 0.2s" }}/>;
                    })}
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:textMute,marginTop:4 }}>
                    <span>14 days ago</span><span>Today</span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"14px 16px" }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Spent this month</p>
                  <p style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:percentUsed>=90?"#ef4444":textMain,letterSpacing:"-0.5px" }}>₹{monthlyTotal.toLocaleString()}</p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{daysElapsed} days so far</p>
                </div>
                <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"14px 16px" }}>
                  {/* FIX: shows budget remaining (monthly) or net income-expenses */}
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>{budget>0?"Budget left":"Net this month"}</p>
                  <p style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:(budget>0?remaining:totalIn-monthlyTotal)<0?"#ef4444":"#16a34a",letterSpacing:"-0.5px" }}>
                    {budget>0
                      ? (remaining>=0?"+":"")+"₹"+Math.abs(remaining).toLocaleString()
                      : ((totalIn-monthlyTotal)>=0?"+":"")+"₹"+Math.abs(totalIn-monthlyTotal).toLocaleString()
                    }
                  </p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{budget>0?(remaining>=0?"available":"over budget"):"income − expenses"}</p>
                </div>
                <div onClick={() => { if(topCategory){haptic(8);setDrillCat(topCategory);} }}
                  style={{ background:cardBg,border:`1px solid ${topCategory?(dark?"#374151":"#e0e7ff"):border}`,borderRadius:16,padding:"14px 16px",cursor:topCategory?"pointer":"default" }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Top category</p>
                  {topCategory
                    ? <><p style={{ margin:0,fontSize:16,fontWeight:700,color:textMain,display:"flex",alignItems:"center",gap:4 }}>
                          <span style={{ ...getCatStyle(topCategory),padding:"2px 8px",borderRadius:99,fontSize:12 }}>{topCategory}</span>
                        </p>
                        <p style={{ margin:"5px 0 0",fontSize:11,color:textMute }}>₹{(allTimeCatTotals[topCategory]||0).toLocaleString()} · tap →</p>
                      </>
                    : <p style={{ margin:0,fontSize:16,fontWeight:700,color:textMute }}>—</p>
                  }
                </div>
                <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"14px 16px" }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Daily avg</p>
                  <p style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:textMain }}>₹{dailyAvg.toLocaleString()}</p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>this month</p>
                </div>
              </div>

              {expenses.length>0 && <SpendingTrendChart data={trendData} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain}/>}

              {/* Budget bar */}
              {budget>0 && (
                <div style={{ ...cardStyle, marginBottom:12 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                    <span style={{ fontSize:13,fontWeight:600,color:textMain }}>Monthly Budget</span>
                    <button onClick={() => { setEditingBudget(e => !e); setBudgetInput(budget||""); }} style={btnSecondary}>{editingBudget?"Cancel":"Edit"}</button>
                  </div>
                  {editingBudget && (
                    <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                      <input type="number" inputMode="decimal" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="Enter budget" style={inputStyle}/>
                      <button onClick={saveBudget} style={btnPrimary}>Save</button>
                    </div>
                  )}
                  <div style={{ width:"100%",height:10,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#f3f4f6" }}>
                    <div style={{ height:10,borderRadius:99,width:`${percentUsed}%`,background:percentUsed>=90?"linear-gradient(to right,#ef4444,#f97316)":"linear-gradient(to right,#6366f1,#8b5cf6)",transition:"width 0.5s" }}/>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:textMute,marginTop:5 }}>
                    {/* FIX: label now clearly says "this month" */}
                    <span>₹{spent.toLocaleString()} this month</span>
                    <span style={{ color:percentUsed>=100?"#ef4444":textMute,fontWeight:percentUsed>=100?600:400 }}>{percentUsed.toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {!budget && (
                <button onClick={() => { setEditingBudget(true); setBudgetInput(""); }}
                  style={{ ...cardStyle,width:"100%",border:`1px dashed ${border}`,background:"none",cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:textMute,fontSize:13,padding:"14px 16px" }}>
                  <PlusIcon/>Set a monthly budget
                </button>
              )}

              {/* Today's spends */}
              {(() => {
                const todayItems = grouped[today] || [];
                if (todayItems.length===0) return (
                  <div style={{ ...cardStyle,textAlign:"center",padding:"20px 16px" }}>
                    <p style={{ margin:0,fontSize:13,fontWeight:600,color:textMain }}>Nothing spent today</p>
                    <p style={{ margin:"4px 0 12px",fontSize:12,color:textMute }}>Tap below to log your first spend</p>
                    <button onClick={() => setTab("scanvoice")}
                      style={{ background:accent,color:"#fff",border:"none",borderRadius:12,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
                      <PlusIcon/>Log a spend
                    </button>
                  </div>
                );
                const todayTotal = dailyTotal[today]||0;
                return (
                  <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,overflow:"hidden",marginBottom:12 }}>
                    <div style={{ padding:"12px 16px",borderBottom:`1px solid ${border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ fontSize:13,fontWeight:700,color:textMain }}>Today's spends</span>
                      <span style={{ fontSize:13,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444" }}>−₹{todayTotal.toLocaleString()}</span>
                    </div>
                    {todayItems.slice(0,5).map((item,i) => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<Math.min(todayItems.length,5)-1?`1px solid ${border}`:"none" }}>
                        <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,...getCatStyle(item.category),whiteSpace:"nowrap" }}>{item.category}</span>
                        <span style={{ flex:1,fontSize:12,color:textMute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.note||"—"}</span>
                        <span style={{ fontSize:13,fontWeight:700,color:textMain,fontFamily:"'DM Mono',monospace",flexShrink:0 }}>₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {todayItems.length>5 && (
                      <button onClick={() => setTab("expenses")} style={{ width:"100%",padding:"10px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:dark?"#818cf8":"#4f46e5",fontWeight:600,borderTop:`1px solid ${border}` }}>
                        +{todayItems.length-5} more · View all →
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Reminders */}
              {reminders.length>0 && (
                <div style={{ marginBottom:4 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:5,marginBottom:8 }}>
                    <BellIcon/><span style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>Upcoming payments</span>
                  </div>
                  {reminders.map(item => (
                    <ReminderBanner key={item.id} item={item} onDismiss={dismissReminder} onPay={payFromReminder} dark={dark}/>
                  ))}
                </div>
              )}

              <p style={{ textAlign:"center",fontSize:11,color:textMute,marginTop:12,marginBottom:4 }}>mySpendr · your money, your streak</p>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              EXPENSES TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="expenses" && (
            <>
              {/* ── Period selector card ── */}
              <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"12px 14px",marginBottom:12 }}>
                {/* Row 1: Month + Day dropdowns */}
                <div style={{ display:"flex",gap:8,marginBottom:periodExpenses.length>0?10:0 }}>
                  {/* Month */}
                  <div style={{ flex:"0 0 56%" }}>
                    <label style={{ display:"block",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute,marginBottom:5 }}>📅 Month</label>
                    <select
                      value={viewMonth}
                      onChange={e => setViewMonth(e.target.value)}
                      style={{ background:dark?"#1f2937":"#f8fafc",border:`1px solid ${viewMonth!==currentYM?(dark?"#818cf8":"#6366f1"):inputBorder}`,color:textMain,borderRadius:10,padding:"8px 10px",fontSize:13,fontWeight:600,outline:"none",width:"100%",cursor:"pointer",boxSizing:"border-box" }}
                    >
                      {availableMonths.map(ym => {
                        const [yr, mo] = ym.split("-");
                        const label = `${MONTH_LABELS[Number(mo)-1]} ${yr}`;
                        const isCur = ym === currentYM;
                        return <option key={ym} value={ym}>{isCur ? `★ ${label}` : label}</option>;
                      })}
                    </select>
                  </div>
                  {/* Day — always show, disable when no data */}
                  <div style={{ flex:1 }}>
                    <label style={{ display:"block",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute,marginBottom:5 }}>📆 Day</label>
                    <select
                      value={viewDay}
                      onChange={e => setViewDay(e.target.value)}
                      disabled={availableDays.length===0}
                      style={{ background:dark?"#1f2937":"#f8fafc",border:`1px solid ${viewDay!=="all"?(dark?"#818cf8":"#6366f1"):inputBorder}`,color:availableDays.length===0?textMute:textMain,borderRadius:10,padding:"8px 10px",fontSize:13,fontWeight:600,outline:"none",width:"100%",cursor:availableDays.length===0?"not-allowed":"pointer",opacity:availableDays.length===0?0.5:1,boxSizing:"border-box" }}
                    >
                      <option value="all">All days</option>
                      {availableDays.map(d => (
                        <option key={d} value={d}>{formatDate(d)}{d===today?" ★":""}</option>
                      ))}
                    </select>
                  </div>
                  {/* Back-to-current button */}
                  {viewMonth !== currentYM && (
                    <div style={{ display:"flex",flexDirection:"column",justifyContent:"flex-end" }}>
                      <button
                        onClick={() => { setViewMonth(currentYM); setViewDay("all"); }}
                        title="Back to current month"
                        style={{ background:dark?"rgba(129,140,248,0.15)":"rgba(99,102,241,0.1)",border:`1px solid ${dark?"rgba(129,140,248,0.3)":"rgba(99,102,241,0.25)"}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",fontSize:12,color:dark?"#818cf8":"#4f46e5",fontWeight:700,whiteSpace:"nowrap" }}
                      >
                        Now
                      </button>
                    </div>
                  )}
                </div>
                {/* Row 2: Summary strip */}
                {periodExpenses.length > 0 && (
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:dark?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.04)",border:`1px solid ${dark?"rgba(239,68,68,0.15)":"rgba(239,68,68,0.1)"}`,borderRadius:8,padding:"7px 12px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:12,fontWeight:700,color:dark?"#f9fafb":"#111827" }}>
                        {viewDay !== "all"
                          ? formatDate(viewDay)
                          : (() => { const [yr,mo] = viewMonth.split("-"); return `${MONTH_LABELS[Number(mo)-1]} ${yr}`; })()
                        }
                      </span>
                      <span style={{ fontSize:11,color:textMute }}>· {periodExpenses.length} item{periodExpenses.length!==1?"s":""}</span>
                    </div>
                    <span style={{ fontSize:14,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444",letterSpacing:"-0.5px" }}>
                      −₹{periodExpenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Category donut — scoped to selected period */}
              <CategoryBubbles categories={categories} catTotals={catTotals} getCatStyle={getCatStyle} getCatAccent={getCatAccent} onSelect={name => setDrillCat(name)} dark={dark} cardBg={cardBg} border={border} textMute={textMute}/>

              {/* Expense list — scoped to selected period */}
              {periodExpenses.length===0
                ? <div style={{ ...cardStyle,textAlign:"center",padding:40 }}>
                    <p style={{ fontSize:24,margin:"0 0 8px" }}>🧾</p>
                    <p style={{ color:textMain,margin:0,fontSize:14,fontWeight:600 }}>
                      {expenses.length===0 ? "No expenses yet" : "No expenses for this period"}
                    </p>
                    <p style={{ color:textMute,margin:"4px 0 0",fontSize:12 }}>
                      {expenses.length===0 ? "Tap + to log your first expense" : "Try a different month or day above"}
                    </p>
                  </div>
                : <ExpenseDateList grouped={grouped} dailyTotal={dailyTotal} today={today} dark={dark} cardBg={cardBg} border={border} subbg={subbg} textMute={textMute} getCatStyle={getCatStyle}
                    editExpense={item => { editExpense(item); setTab("scanvoice"); }}
                    deleteExpense={deleteExpense} setDrillCat={setDrillCat}/>
              }
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              RECURRING TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="recurring" && (
            <>
              {recurring.length>0 && !showRForm && (
                <div style={{ background:dark?"linear-gradient(135deg,#172554,#1e1b4b)":"linear-gradient(135deg,#eff6ff,#eef2ff)",border:dark?"1px solid #1e3a8a":"1px solid #bfdbfe",borderRadius:16,padding:"14px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:dark?"#93c5fd":"#2563eb" }}>Monthly commitment</p>
                    <p style={{ margin:"3px 0 0",fontSize:24,fontWeight:800,fontFamily:"'DM Mono',monospace",color:dark?"#93c5fd":"#1d4ed8",letterSpacing:"-1px" }}>₹{recurringMonthly.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ margin:0,fontSize:11,color:dark?"#93c5fd":"#3b82f6" }}>{recurring.length} active</p>
                    {reminders.length>0 && <p style={{ margin:"3px 0 0",fontSize:11,fontWeight:700,color:"#f97316" }}>{reminders.length} due soon</p>}
                  </div>
                </div>
              )}
              {showRForm
                ? <div style={cardStyle}>
                    <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600 }}>{rEditId?"Edit":"New Recurring Payment"}</h2>
                    <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Name (e.g. Rent, Netflix)" style={{ ...inputStyle,marginBottom:8 }}/>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                      <input type="number" inputMode="decimal" value={rAmount} onChange={e => setRAmount(e.target.value)} placeholder="Amount ₹" style={inputStyle}/>
                      <select value={rCat} onChange={e => setRCat(e.target.value)} style={inputStyle}>{categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                      <select value={rFreq} onChange={e => setRFreq(e.target.value)} style={inputStyle}>{RECUR_FREQ.map(f => <option key={f}>{f}</option>)}</select>
                      <div>
                        <p style={{ margin:"0 0 4px",fontSize:11,color:textMute,fontWeight:500 }}>Due date</p>
                        <input type="date" value={rDueDate} onChange={e => setRDueDate(e.target.value)} style={inputStyle}/>
                      </div>
                    </div>
                    <p style={{ margin:"0 0 10px",fontSize:11,color:textMute }}>Reminders appear 3 days before due and repeat daily until paid.</p>
                    <div style={{ display:"flex",gap:8 }}><button onClick={saveRecurring} style={{ ...btnPrimary,flex:1 }}>{rEditId?"Update":"Add"}</button><button onClick={resetRForm} style={btnSecondary}>Cancel</button></div>
                  </div>
                : <button onClick={() => setShowRForm(true)} style={{ ...btnPrimary,width:"100%",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PlusIcon/>Add Recurring Payment</button>
              }
              {recurring.length===0
                ? <div style={{ ...cardStyle,textAlign:"center",padding:40 }}><p style={{ color:textMute,margin:0 }}>No recurring payments yet.</p><p style={{ color:textMute,fontSize:12,margin:"4px 0 0" }}>Add rent, subscriptions, bills here.</p></div>
                : <div style={{ background:cardBg,border:`1px solid ${border}`,borderRadius:16,overflow:"hidden" }}>
                    {recurring.map((r,i) => {
                      const days = daysFromToday(r.nextDue);
                      const isOverdue=days<0, isDueToday=days===0, dueSoon=days<=3&&days>=0;
                      const paidTM = (r.paid||[]).some(d => { const pd=new Date(d+"T00:00:00"); return pd.getMonth()===istNow.getMonth()&&pd.getFullYear()===istNow.getFullYear(); });
                      return (
                        <div key={r.id} style={{ padding:"14px 16px",borderBottom:i<recurring.length-1?`1px solid ${border}`:"none" }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                                <span style={{ fontSize:15,fontWeight:700 }}>{r.name}</span>
                                <span style={{ ...getCatStyle(r.category),padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600 }}>{r.category}</span>
                                {isOverdue&&!paidTM&&<span style={{ background:"#fef2f2",color:"#dc2626",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700,border:"1px solid #fca5a5" }}>{Math.abs(days)}d overdue</span>}
                                {isDueToday&&!paidTM&&<span style={{ background:"#fff7ed",color:"#ea580c",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700 }}>Due today</span>}
                                {dueSoon&&!isDueToday&&!paidTM&&<span style={{ background:"#fffbeb",color:"#ca8a04",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600 }}>Due in {days}d</span>}
                                {paidTM&&<span style={{ background:dark?"#052e16":"#d1fae5",color:dark?"#34d399":"#065f46",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:3 }}><CheckIcon/>Paid</span>}
                              </div>
                              <div style={{ display:"flex",gap:16,fontSize:12,color:textMute }}><span>₹{r.amount.toLocaleString()} / {r.frequency}</span><span>Next: {formatDate(r.nextDue)}</span></div>
                            </div>
                            <div style={{ display:"flex",gap:6,alignItems:"center",marginLeft:8,flexWrap:"wrap",justifyContent:"flex-end" }}>
                              {!paidTM && (
                                <div style={{ display:"flex",gap:3,background:subbg,borderRadius:10,padding:3,border:`1px solid ${border}` }}>
                                  <button onClick={() => { haptic([10,30,10]); markPaid(r,"bank"); }} style={{ display:"flex",alignItems:"center",gap:3,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"#2563eb",color:"#fff" }}><BankIcon/>Bank</button>
                                  <button onClick={() => { haptic([10,30,10]); markPaid(r,"cash"); }} style={{ display:"flex",alignItems:"center",gap:3,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"#16a34a",color:"#fff" }}><CashIcon/>Cash</button>
                                </div>
                              )}
                              <button onClick={() => editRecurring(r)} style={btnDanger}><EditIcon/></button>
                              <button onClick={() => deleteRecurring(r.id)} style={btnDanger}><TrashIcon/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              POT TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="pot" && (
            <>
              <div style={{ display:"flex",gap:4,marginBottom:12,background:subbg,borderRadius:12,padding:4,border:`1px solid ${border}` }}>
                {[["usable","Usable"],["networth","Net Worth"],["income","Income"]].map(([k,label]) => (
                  <button key={k} onClick={() => setPotSection(k)}
                    style={{ flex:1,padding:"7px 0",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:potSection===k?cardBg:"transparent",color:potSection===k?textMain:textMute,boxShadow:potSection===k?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.2s" }}>
                    {label}
                  </button>
                ))}
              </div>

              {potSection==="usable" && (
                <>
                  <div style={{ ...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1c1410)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:dark?"1px solid #292117":"1px solid #fde68a",display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10 }}>
                    <MoneyBag fillPercent={usableFillPct} size="lg"/>
                    <p className="mpulse" style={{ fontSize:26,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal<=0?"#ef4444":"#f59e0b",letterSpacing:"-1.5px",margin:0 }}>
                      ₹{usableTotal.toLocaleString()}
                    </p>
                    <div style={{ width:"100%",maxWidth:280 }}><div style={{ width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#fde68a" }}><div style={{ height:8,borderRadius:99,width:`${usableFillPct}%`,background:"linear-gradient(to right,#f97316,#fbbf24)",transition:"width 0.7s ease" }}/></div></div>
                  </div>
                  {/* Cash row */}
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:cashMode?10:0 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#16a34a" }}/>
                      <span style={{ flex:1,fontSize:14,fontWeight:600 }}>Cash in Hand</span>
                      <span style={{ fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#16a34a" }}>₹{(Number(pot.usableCash)||0).toLocaleString()}</span>
                      <div style={{ display:"flex",gap:4 }}>
                        <button onClick={() => setCashMode(cashMode==="add"?null:"add")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:cashMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1 }}>+</button>
                        <button onClick={() => setCashMode(cashMode==="minus"?null:"minus")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:cashMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1 }}>−</button>
                      </div>
                    </div>
                    {cashMode && (
                      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                        <input type="number" inputMode="decimal" value={cashAdj} onChange={e => setCashAdj(e.target.value)} placeholder={`₹ to ${cashMode}`} style={{ ...inputStyle,flex:1 }} autoFocus
                          onKeyDown={e => { if(e.key==="Enter"){quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null);} }}/>
                        <button onClick={() => { quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null); }} style={{ ...btnPrimary,padding:"8px 14px",background:cashMode==="add"?"#16a34a":"#dc2626" }}>{cashMode==="add"?"+":"−"}</button>
                        <button onClick={() => { setCashMode(null);setCashAdj(""); }} style={{ ...btnSecondary,padding:"8px 10px" }}>✕</button>
                      </div>
                    )}
                  </div>
                  {/* Bank row */}
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:bankMode?10:0 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#2563eb" }}/>
                      <span style={{ flex:1,fontSize:14,fontWeight:600 }}>Bank Balance</span>
                      <span style={{ fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#2563eb" }}>₹{(Number(pot.usableBank)||0).toLocaleString()}</span>
                      <div style={{ display:"flex",gap:4 }}>
                        <button onClick={() => setBankMode(bankMode==="add"?null:"add")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bankMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:bankMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1 }}>+</button>
                        <button onClick={() => setBankMode(bankMode==="minus"?null:"minus")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bankMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:bankMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1 }}>−</button>
                      </div>
                    </div>
                    {bankMode && (
                      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                        <input type="number" inputMode="decimal" value={bankAdj} onChange={e => setBankAdj(e.target.value)} placeholder={`₹ to ${bankMode}`} style={{ ...inputStyle,flex:1 }} autoFocus
                          onKeyDown={e => { if(e.key==="Enter"){quickAdjust("usableBank",bankMode,bankAdj);setBankAdj("");setBankMode(null);} }}/>
                        <button onClick={() => { quickAdjust("usableBank",bankMode,bankAdj);setBankAdj("");setBankMode(null); }} style={{ ...btnPrimary,padding:"8px 14px",background:bankMode==="add"?"#16a34a":"#dc2626" }}>{bankMode==="add"?"+":"−"}</button>
                        <button onClick={() => { setBankMode(null);setBankAdj(""); }} style={{ ...btnSecondary,padding:"8px 10px" }}>✕</button>
                      </div>
                    )}
                  </div>
                  <div style={{ ...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center" }}><span style={{ fontSize:13,color:textMute }}>Total Usable</span><span style={{ fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"'DM Mono',monospace" }}>₹{usableTotal.toLocaleString()}</span></div>
                  <div style={{ ...cardStyle,background:dark?"#0a1628":"#f0fdf4",border:dark?"1px solid #1e3a5f":"1px solid #bbf7d0" }}>
                    <p style={{ margin:"0 0 4px",fontSize:12,color:textMute }}>After all expenses this month</p>
                    <p style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal-monthlyTotal>=0?"#16a34a":"#ef4444" }}>₹{(usableTotal-monthlyTotal).toLocaleString()}</p>
                    <p style={{ margin:"4px 0 0",fontSize:11,color:textMute }}>Spent ₹{monthlyTotal.toLocaleString()} this month</p>
                  </div>
                </>
              )}

              {potSection==="networth" && (
                <>
                  <div style={{ ...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1a1028)":"linear-gradient(135deg,#faf5ff,#ede9fe)",border:dark?"1px solid #2e1065":"1px solid #ddd6fe",display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10 }}>
                    <MoneyBag fillPercent={nwFillActual} size="lg"/>
                    <p className="mpulse" style={{ fontSize:30,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#7c3aed",letterSpacing:"-1.5px",margin:0 }}>₹{Math.abs(netWorthTotal).toLocaleString()}</p>
                    <div style={{ width:"100%",maxWidth:280 }}><div style={{ width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#ddd6fe" }}><div style={{ height:8,borderRadius:99,width:`${nwFillActual}%`,background:"linear-gradient(to right,#7c3aed,#a78bfa)",transition:"width 0.7s ease" }}/></div></div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}><TrendIcon/><span style={{ fontSize:14,fontWeight:700 }}>Breakdown</span></div>
                    {[["usableCash","Cash in Hand","#16a34a"],["usableBank","Bank Balance","#2563eb"],["savings","Savings / FD","#7c3aed"],["investments","Investments","#db2777"]].map(([field,label,color]) => (
                      <div key={field} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                        <div style={{ width:10,height:10,borderRadius:"50%",background:color,flexShrink:0 }}/>
                        <span style={{ flex:1,fontSize:13 }}>{label}</span>
                        <span style={{ fontSize:13,fontWeight:700,color,minWidth:90,textAlign:"right" }}>₹{(Number(pot[field])||0).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#d97706",flexShrink:0 }}/>
                      <div style={{ flex:1 }}><span style={{ fontSize:13 }}>Gold</span>{pot.goldGrams>0&&pot.goldRate>0&&<span style={{ fontSize:11,color:textMute,marginLeft:6 }}>{pot.goldGrams}g × ₹{Number(pot.goldRate).toLocaleString()}/g</span>}</div>
                      <span style={{ fontSize:13,fontWeight:700,color:"#d97706",minWidth:90,textAlign:"right" }}>₹{goldValue.toLocaleString()}</span>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4,borderTop:`1px solid ${border}` }}><span style={{ fontSize:13,color:textMute,fontWeight:600 }}>Total Net Worth</span><span style={{ fontSize:20,fontWeight:800,color:"#7c3aed",fontFamily:"'DM Mono',monospace" }}>₹{netWorthTotal.toLocaleString()}</span></div>
                  </div>
                  <div style={cardStyle}>
                    <p style={{ margin:"0 0 4px",fontSize:13,fontWeight:700 }}>Update Savings / Investments / Gold</p>
                    <p style={{ margin:"0 0 12px",fontSize:11,color:textMute }}>Increasing these deducts from your bank balance</p>
                    {[["savings","Savings / FD","#7c3aed"],["investments","Investments","#db2777"]].map(([field,label,color]) => (
                      <div key={field} style={{ display:"flex",gap:8,alignItems:"center",marginBottom:10 }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
                        <span style={{ flex:1,fontSize:13 }}>{label}</span>
                        <input type="number" inputMode="decimal" value={pot[field]||""} onChange={e => updateNWField(field,e.target.value)} placeholder="₹0" style={{ ...inputStyle,width:130,textAlign:"right",fontWeight:700,color }}/>
                      </div>
                    ))}
                    <div style={{ paddingTop:10,borderTop:`1px solid ${border}` }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:"#d97706" }}/>
                        <span style={{ fontSize:13,fontWeight:600 }}>Gold</span>
                        {pot.goldRateUpdatedOn && <span style={{ fontSize:11,color:textMute,marginLeft:"auto" }}>Rate updated: {formatDate(pot.goldRateUpdatedOn)}</span>}
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6 }}>
                        <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Weight (grams)</p><input type="number" inputMode="decimal" value={pot.goldGrams||""} onChange={e => setPot(p => ({ ...p,goldGrams:Number(e.target.value)||0 }))} placeholder="e.g. 24.5" style={{ ...inputStyle,textAlign:"right",fontWeight:700,color:"#d97706" }}/></div>
                        <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Rate (₹/gram 24K)</p><input type="number" inputMode="decimal" value={pot.goldRate||""} onChange={e => setPot(p => ({ ...p,goldRate:Number(e.target.value)||0,goldRateUpdatedOn:today }))} placeholder="e.g. 9200" style={{ ...inputStyle,textAlign:"right",fontWeight:700,color:"#d97706" }}/></div>
                      </div>
                      {pot.goldGrams>0&&pot.goldRate>0&&(
                        <div style={{ background:dark?"#422006":"#fffbeb",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                          <span style={{ fontSize:12,color:dark?"#d97706":"#92400e" }}>{pot.goldGrams}g × ₹{Number(pot.goldRate).toLocaleString()}</span>
                          <span style={{ fontSize:14,fontWeight:800,color:"#d97706",fontFamily:"'DM Mono',monospace" }}>= ₹{goldValue.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <SavingsGoals goals={goals} savings={Number(pot.savings)||0} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} subbg={subbg} inputBg={inputBg} inputBorder={inputBorder} today={today}
                    showGoalForm={showGoalForm} setShowGoalForm={setShowGoalForm} goalName={goalName} setGoalName={setGoalName} goalTarget={goalTarget} setGoalTarget={setGoalTarget}
                    goalDeadline={goalDeadline} setGoalDeadline={setGoalDeadline} goalEditId={goalEditId} setGoalEditId={setGoalEditId}
                    saveGoal={saveGoal} deleteGoal={deleteGoal} editGoal={editGoal} accent={accent}/>
                </>
              )}

              {potSection==="income" && (
                <>
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:12 }}><RepeatIcon/><span style={{ fontSize:14,fontWeight:700 }}>Recurring Income</span><span style={{ fontSize:16,fontWeight:700,color:"#16a34a",marginLeft:"auto",fontFamily:"'DM Mono',monospace" }}>₹{monthlyIncome.toLocaleString()}<span style={{ fontSize:11,color:textMute,fontWeight:400 }}>/mo</span></span></div>
                    {(pot.incomes||[]).map(inc => (
                      <div key={inc.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${border}` }}>
                        <div style={{ flex:1 }}><p style={{ margin:0,fontSize:14,fontWeight:600 }}>{inc.label}</p><p style={{ margin:0,fontSize:12,color:textMute }}>₹{inc.amount.toLocaleString()} / {inc.frequency}</p></div>
                        <button onClick={() => creditIncome(inc)} style={btnGreen}><ZapIcon/>Credit</button>
                        <button onClick={() => editIncome(inc)} style={btnDanger}><EditIcon/></button>
                        <button onClick={() => deleteIncome(inc.id)} style={btnDanger}><TrashIcon/></button>
                      </div>
                    ))}
                    {showIncomeForm
                      ? <div style={{ paddingTop:8,borderTop:`1px solid ${border}` }}>
                          <input value={incName} onChange={e => setIncName(e.target.value)} placeholder="Source (e.g. Salary)" style={{ ...inputStyle,marginBottom:8 }}/>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                            <input type="number" inputMode="decimal" value={incAmt} onChange={e => setIncAmt(e.target.value)} placeholder="Amount ₹" style={inputStyle}/>
                            <select value={incFreq} onChange={e => setIncFreq(e.target.value)} style={inputStyle}>{RECUR_FREQ.map(f => <option key={f}>{f}</option>)}</select>
                          </div>
                          <div style={{ display:"flex",gap:8 }}><button onClick={saveIncome} style={{ ...btnPrimary,flex:1 }}>{incEditId?"Update":"Add"}</button><button onClick={resetIncomeForm} style={btnSecondary}>Cancel</button></div>
                        </div>
                      : <button onClick={() => setShowIncomeForm(true)} style={{ ...btnSecondary,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4 }}><PlusIcon/>Add Income Source</button>
                    }
                  </div>
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:12 }}><PiggyIcon/><span style={{ fontSize:14,fontWeight:700 }}>Extra Earnings</span><span style={{ fontSize:11,color:textMute,marginLeft:4 }}>one-time</span></div>
                    {(pot.extras||[]).length===0&&!showExtraForm&&<p style={{ margin:"0 0 8px",fontSize:13,color:textMute }}>No extra earnings logged yet.</p>}
                    {(pot.extras||[]).map(ex => (
                      <div key={ex.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${border}` }}>
                        <div style={{ flex:1 }}><p style={{ margin:0,fontSize:13,fontWeight:600 }}>{ex.label}</p><p style={{ margin:0,fontSize:11,color:textMute }}>{formatDate(ex.date)}</p></div>
                        <span style={{ fontSize:14,fontWeight:700,color:"#16a34a" }}>+₹{ex.amount.toLocaleString()}</span>
                        <button onClick={() => deleteExtra(ex.id)} style={btnDanger}><TrashIcon/></button>
                      </div>
                    ))}
                    {showExtraForm
                      ? <div style={{ paddingTop:8,borderTop:`1px solid ${border}` }}>
                          <input value={extraLabel} onChange={e => setExtraLabel(e.target.value)} placeholder="Label (e.g. Bonus, Freelance)" style={{ ...inputStyle,marginBottom:8 }}/>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                            <input type="number" inputMode="decimal" value={extraAmt} onChange={e => setExtraAmt(e.target.value)} placeholder="Amount ₹" style={inputStyle}/>
                            <input type="date" value={extraDate} onChange={e => setExtraDate(e.target.value)} style={inputStyle}/>
                          </div>
                          <div style={{ display:"flex",gap:8 }}><button onClick={saveExtra} style={{ ...btnPrimary,flex:1 }}>Add to Pot</button><button onClick={() => setShowExtraForm(false)} style={btnSecondary}>Cancel</button></div>
                        </div>
                      : <button onClick={() => setShowExtraForm(true)} style={{ ...btnSecondary,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PlusIcon/>Log Extra Earning</button>
                    }
                  </div>
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ADD / SCAN / VOICE TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="scanvoice" && (
            <>
              <div style={cardStyle}>
                <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600 }}>{editingId?"Edit Expense":"Add Expense"}</h2>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Amount (₹)</label>
                    <input type="number" inputMode="decimal" value={amount}
                      onChange={e => { const v=e.target.value; if(v===""||Number(v)>=0&&Number(v)<=MAX_AMOUNT) setAmount(v); }}
                      onKeyDown={e => { if(e.key==="Enter") saveExpense(); }}
                      placeholder="0" min="0" max={MAX_AMOUNT}
                      style={{ ...inputStyle,animation:amountShake?"shake 0.4s ease":"none",outline:amountShake?`2px solid #ef4444`:`1px solid ${amount&&Number(amount)>0?accent:inputBorder}`,fontSize:18,fontWeight:700,fontFamily:"'DM Mono',monospace",color:amount&&Number(amount)>0?(dark?"#f9fafb":"#111827"):textMute }}
                    />
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Category</label>
                    <select value={selCat} onChange={e => setSelCat(e.target.value)} style={inputStyle}>
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Note (optional)</label>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="What was this for?" style={inputStyle}
                    onKeyDown={e => { if(e.key==="Enter") saveExpense(); }}/>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:6 }}>Pay from</label>
                  <SourcePill value={paySource} onChange={setPaySource} dark={dark} subbg={subbg} border={border} textMute={textMute}/>
                </div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <button onClick={() => { haptic([10,20,10]); saveExpense(); }} style={{ ...btnPrimary,flex:1 }}>{editingId?"Update":"Add Expense"}</button>
                  {editingId && <button onClick={resetExpenseForm} style={btnSecondary}>Cancel</button>}
                  {!addingCat
                    ? <button onClick={() => setAddingCat(true)} style={{ ...btnSecondary,padding:"8px 12px",display:"flex",alignItems:"center",gap:4 }}><GridIcon/>+ Cat</button>
                    : <div style={{ display:"flex",gap:4,flex:1 }}>
                        <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" onKeyDown={e => e.key==="Enter"&&addCategory()} style={{ ...inputStyle,flex:1 }}/>
                        <button onClick={addCategory} style={btnPrimary}>Add</button>
                        <button onClick={() => setAddingCat(false)} style={btnSecondary}>✕</button>
                      </div>
                  }
                </div>
              </div>

              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ flex:1,height:1,background:border }}/><span style={{ fontSize:11,fontWeight:600,color:textMute,textTransform:"uppercase",letterSpacing:"0.08em" }}>or use</span><div style={{ flex:1,height:1,background:border }}/>
              </div>

              <VoiceLogger categories={categories} onAdd={handleVoiceAdd} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} inputBg={inputBg} inputBorder={inputBorder} accent={accent}/>
              <ReceiptScanner categories={categories} onAdd={handleReceiptAdd} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} inputBg={inputBg} inputBorder={inputBorder} accent={accent}/>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              EMI TAB
          ════════════════════════════════════════════════════════════════ */}
          {tab==="emi" && (
            <>
              <p style={{ margin:"0 0 14px",fontSize:18,fontWeight:700,color:textMain }}>Loans</p>
              <EmiTab dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} subbg={subbg} inputBg={inputBg} inputBorder={inputBorder}
                setExpenses={setExpenses} setPot={setPot} showToast={showToast} today={today} logDay={logDay} accent={accent}/>
            </>
          )}

        </div>{/* /maxWidth */}

        {/* ════════════════════════════════════════════════════════════════
            NOTIFICATION PANEL
        ════════════════════════════════════════════════════════════════ */}
        {showNotifPanel && (
          <>
            <div onClick={() => setShowNotifPanel(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,backdropFilter:"blur(2px)" }}/>
            <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:201,background:cardBg,borderRadius:"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)" }}>
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",flexShrink:0 }}><div style={{ width:36,height:4,borderRadius:99,background:dark?"#374151":"#e5e7eb" }}/></div>
              <div style={{ padding:"0 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
                <p style={{ margin:0,fontSize:16,fontWeight:700,color:textMain }}>Notifications</p>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  {notifLog.length>0 && <button onClick={() => { haptic(5); setNotifLog([]); }} style={{ fontSize:11,color:textMute,background:"none",border:"none",cursor:"pointer",fontWeight:500 }}>Clear all</button>}
                  <button onClick={() => { haptic(8); toggleNotif(); }}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:99,border:`1px solid ${border}`,background:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:notifEnabled?(dark?"#818cf8":"#4f46e5"):textMute }}>
                    <BellIcon/>{notifEnabled?"On":"Off"}
                  </button>
                </div>
              </div>
              <div style={{ overflowY:"auto",flex:1,padding:"0 20px 20px" }}>
                {reminders.length>0 && (
                  <div style={{ marginBottom:16 }}>
                    <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>Due soon</p>
                    {reminders.map(item => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:dark?"#1f2937":"#f8fafc",borderRadius:12,marginBottom:6,border:`1px solid ${border}` }}>
                        <div style={{ fontSize:18,flexShrink:0 }}>{item.daysUntil<0?"⚠️":item.daysUntil===0?"🔔":"⏰"}</div>
                        <div style={{ flex:1 }}>
                          <p style={{ margin:0,fontSize:13,fontWeight:700,color:item.daysUntil<0?"#ef4444":item.daysUntil===0?"#f97316":"#f59e0b" }}>{item.name}</p>
                          <p style={{ margin:"1px 0 0",fontSize:11,color:textMute }}>₹{item.amount.toLocaleString()} · {item.daysUntil<0?`${Math.abs(item.daysUntil)}d overdue`:item.daysUntil===0?"due today":`due in ${item.daysUntil}d`}</p>
                        </div>
                        <button onClick={() => { haptic([10,30,10]); payFromReminder(item,"bank"); setShowNotifPanel(false); }} style={{ background:dark?"#064e3b":"#d1fae5",color:dark?"#34d399":"#065f46",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}>Pay</button>
                        <button onClick={() => { haptic(5); dismissReminder(item.id); }} style={{ background:"none",border:`1px solid ${border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:textMute,display:"flex",alignItems:"center" }}><XIcon/></button>
                      </div>
                    ))}
                  </div>
                )}
                {notifLog.length>0 && (
                  <div>
                    <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>History</p>
                    {notifLog.map(n => (
                      <div key={n.key} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:`1px solid ${border}` }}>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:dark?"#374151":"#d1d5db",flexShrink:0 }}/>
                        <div style={{ flex:1 }}><p style={{ margin:0,fontSize:12,fontWeight:600,color:textMain }}>{n.name}</p><p style={{ margin:"1px 0 0",fontSize:11,color:textMute }}>₹{n.amount.toLocaleString()} · {n.dueDateStr}</p></div>
                      </div>
                    ))}
                  </div>
                )}
                {reminders.length===0&&notifLog.length===0 && (
                  <div style={{ textAlign:"center",padding:"40px 0" }}>
                    <p style={{ fontSize:28,marginBottom:8 }}>🔕</p>
                    <p style={{ margin:0,fontSize:13,fontWeight:600,color:textMain }}>All clear</p>
                    <p style={{ margin:"4px 0 0",fontSize:12,color:textMute }}>No upcoming payments</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SETTINGS SHEET
        ════════════════════════════════════════════════════════════════ */}
        {showSettings && (
          <>
            <div onClick={() => setShowSettings(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,backdropFilter:"blur(2px)" }}/>
            <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:201,background:cardBg,borderRadius:"20px 20px 0 0",padding:"0 0 env(safe-area-inset-bottom,20px)",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)" }}>
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}><div style={{ width:36,height:4,borderRadius:99,background:dark?"#374151":"#e5e7eb" }}/></div>
              <div style={{ padding:"8px 20px 16px" }}>
                <p style={{ margin:"0 0 16px",fontSize:16,fontWeight:700,color:textMain }}>Settings</p>

                {/* Dark mode toggle */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>{dark?<MoonIcon/>:<SunIcon/>}<span style={{ fontSize:14,color:textMain }}>Dark mode</span></div>
                  <button onClick={() => setDark(d => !d)} style={{ width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:dark?"#4f46e5":"#e5e7eb",transition:"background 0.2s" }}>
                    <div style={{ position:"absolute",top:2,left:dark?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </button>
                </div>

                {/* Name edit */}
                <div style={{ padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:editingName?8:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:28,height:28,borderRadius:"50%",background:avatarColor(userName),display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ fontSize:11,fontWeight:800,color:"#fff" }}>{getInitials(userName)}</span></div>
                      <div><p style={{ margin:0,fontSize:14,color:textMain }}>{userName||"Set your name"}</p><p style={{ margin:0,fontSize:11,color:textMute }}>Shown in greeting</p></div>
                    </div>
                    <button onClick={() => { setEditingName(e => !e); setNameInput(userName); }} style={btnSecondary}>{editingName?"Cancel":"Edit"}</button>
                  </div>
                  {editingName && (
                    <div style={{ display:"flex",gap:6 }}>
                      <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name" onKeyDown={e => e.key==="Enter"&&saveName()}
                        style={{ flex:1,background:dark?"#1f2937":"#f8fafc",border:`1px solid ${dark?"#374151":"#e5e7eb"}`,color:textMain,borderRadius:10,padding:"7px 12px",fontSize:13,outline:"none" }} autoFocus/>
                      <button onClick={saveName} style={{ background:accent,color:"#fff",border:"none",borderRadius:10,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer" }}>Save</button>
                    </div>
                  )}
                </div>

                {/* Accent colours */}
                <div style={{ padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <p style={{ margin:"0 0 10px",fontSize:14,color:textMain }}>Accent colour</p>
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    {ACCENTS.map(a => (
                      <button key={a.id} onClick={() => { haptic(6); setAccentId(a.id); }}
                        style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:4 }}>
                        <div style={{ width:28,height:28,borderRadius:"50%",background:dark?a.dark:a.light,border:accentId===a.id?`3px solid ${textMain}`:"3px solid transparent",boxSizing:"border-box",transition:"border 0.15s" }}/>
                        <span style={{ fontSize:9,color:accentId===a.id?textMain:textMute,fontWeight:accentId===a.id?700:400 }}>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <BellIcon/>
                    <div><span style={{ fontSize:14,color:textMain }}>Notifications</span><p style={{ margin:0,fontSize:11,color:textMute }}>Bill reminders 3 days before due</p></div>
                  </div>
                  <button onClick={toggleNotif} style={{ width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:notifEnabled?"#4f46e5":"#e5e7eb",transition:"background 0.2s" }}>
                    <div style={{ position:"absolute",top:2,left:notifEnabled?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </button>
                </div>

                {/* Change PIN */}
                <button onClick={() => { resetPin(); setShowSettings(false); }}
                  style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 0",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${border}` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <div style={{ flex:1,textAlign:"left" }}><p style={{ margin:0,fontSize:14,color:textMain }}>Change PIN</p><p style={{ margin:0,fontSize:11,color:textMute }}>Clears current PIN and biometrics</p></div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {/* Reset biometrics */}
                <button onClick={() => { resetBiometric(); setShowSettings(false); }}
                  style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 0",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${border}` }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571"/><path d="M5.477 5.938A9 9 0 0 1 21 12"/><path d="M3 3l18 18"/></svg>
                  <div style={{ flex:1,textAlign:"left" }}><p style={{ margin:0,fontSize:14,color:textMain }}>Reset biometrics</p><p style={{ margin:0,fontSize:11,color:textMute }}>Re-register Face ID / fingerprint</p></div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <p style={{ margin:"16px 0 0",fontSize:11,color:textMute,textAlign:"center" }}>mySpendr v3.0 · your money, your streak</p>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            BOTTOM NAV
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ position:"fixed",bottom:0,left:0,right:0,background:dark?"rgba(3,7,18,0.92)":"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:`1px solid ${border}`,display:"flex",alignItems:"stretch",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
          {[
            { id:"home",      label:"Home",    icon:<HomeIcon size={22}/> },
            { id:"expenses",  label:"Expenses",icon:<ListIcon size={22}/> },
            { id:"scanvoice", label:"Add",     icon:<div style={{ width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${accentObj.light},${accentObj.dark})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(79,70,229,0.4)",marginTop:-20,border:`3px solid ${dark?"#030712":"#fff"}` }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div> },
            { id:"emi",       label:"Loans",   icon:<EmiIcon size={22}/> },
            { id:"pot",       label:"My Pot",  icon:<WalletIcon size={22}/> },
          ].map(({ id, label, icon }) => {
            const active = tab===id;
            const isScan = id==="scanvoice";
            return (
              <button key={id} onClick={() => { haptic(6); setTab(id); }}
                style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:isScan?0:3,padding:isScan?"0 0 4px":"10px 0 8px",background:"none",border:"none",cursor:"pointer",color:active&&!isScan?accent:textMute,transition:"color 0.15s",minWidth:0,position:"relative" }}>
                {icon}
                {!isScan && <span style={{ fontSize:10,fontWeight:active?700:500,whiteSpace:"nowrap" }}>{label}</span>}
                {active&&!isScan && <div style={{ position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:20,height:2,borderRadius:99,background:accent }}/>}
              </button>
            );
          })}
        </div>
        <div style={{ height:72 }}/>
      </div>
    </ErrorBoundary>
  );
}
