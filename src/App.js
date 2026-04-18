import { useState, useEffect } from "react";

const STORAGE_KEY = "myspendr_expenses_v3";
const BUDGET_KEY = "myspendr_budget_v3";
const CATEGORY_KEY = "myspendr_categories_v3";
const STREAK_KEY = "myspendr_streak_v3";
const THEME_KEY = "myspendr_theme_v3";
const RECURRING_KEY = "myspendr_recurring_v1";
const POT_KEY = "myspendr_pot_v2";

function getTodayIST() {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  return ist.toISOString().split("T")[0];
}
const today = getTodayIST();
const defaultCategories = [
  "Food",
  "Groceries",
  "Travel",
  "Shopping",
  "Bills",
  "Entertainment",
];
const RECUR_FREQ = ["Monthly", "Weekly", "Yearly"];

const defaultPot = {
  usableCash: 0,
  usableBank: 0,
  savings: 0,
  investments: 0,
  gold: 0,
  incomes: [
    { id: 1, label: "Salary", amount: 0, frequency: "Monthly", active: true },
  ],
  extras: [],
};

/* ══════ ICONS ══════ */
function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function FlameIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M12 2C9.17 2 7 4.17 7 7c0 1.57.68 2.97 1.76 3.95C7.65 12.07 7 13.46 7 15c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.54-.65-2.93-1.76-4.05C16.32 9.97 17 8.57 17 7c0-2.83-2.17-5-5-5zm0 16c-1.65 0-3-1.35-3-3 0-.93.42-1.76 1.08-2.33C10.66 13.16 11.31 14 12 14s1.34-.84 1.92-1.33C14.58 13.24 15 14.07 15 15c0 1.65-1.35 3-3 3z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 17 12 21 16 17" />
      <path d="M17 3H7a2 2 0 0 0-2 2v6a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2z" />
      <path d="M5 7H2a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4" />
      <path d="M19 7h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}
function RepeatIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function PotTabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
      <path d="M2 10h20" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  );
}
function TrendingUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function PiggyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 8a7 7 0 0 0-14 0c0 2.5 1.3 4.7 3.3 6L8 20h8l-.3-6A7 7 0 0 0 19 8z" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}
function CashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

/* ══════ GOLD POT SVG BASE ══════ */
function GoldPotSVG({ fillPercent, dark, size = "md" }) {
  const clamp = Math.max(0, Math.min(100, fillPercent));
  const [wave, setWave] = useState(0);
  useEffect(() => {
    let raf;
    let t = 0;
    const tick = () => {
      t += 0.025;
      setWave(Math.sin(t) * 3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lc =
    clamp <= 0
      ? { top: "#6b7280", mid: "#4b5563", shine: "#9ca3af" }
      : clamp <= 20
      ? { top: "#ef4444", mid: "#dc2626", shine: "#fca5a5" }
      : clamp <= 40
      ? { top: "#f97316", mid: "#ea580c", shine: "#fdba74" }
      : clamp <= 60
      ? { top: "#f59e0b", mid: "#d97706", shine: "#fcd34d" }
      : clamp <= 80
      ? { top: "#fbbf24", mid: "#f59e0b", shine: "#fde68a" }
      : { top: "#fcd34d", mid: "#fbbf24", shine: "#fef3c7" };

  const liqH = (clamp / 100) * 68;
  const liqY = 108 - liqH;
  const showSparkles = clamp > 75;
  const potShine = dark ? "#374151" : "#ffffff";
  const dims =
    size === "sm"
      ? { w: 80, h: 96 }
      : size === "lg"
      ? { w: 140, h: 160 }
      : { w: 110, h: 130 };

  return (
    <div style={{ position: "relative", width: dims.w, height: dims.h }}>
      <style>{`
        @keyframes _bob  {0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes _sp   {0%{opacity:0;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(180deg)}100%{opacity:0;transform:scale(0) rotate(360deg)}}
        @keyframes _shim {0%,100%{opacity:0.2}50%{opacity:0.7}}
        @keyframes _pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        .gpbob{animation:_bob 2.2s ease-in-out infinite}
        .gpsp{animation:_sp 1.6s ease-in-out infinite}
        .gpshim{animation:_shim 2s ease-in-out infinite}
        .gppulse{animation:_pulse 2s ease-in-out infinite}
      `}</style>
      <div className="gpbob" style={{ width: "100%", height: "100%" }}>
        {showSparkles &&
          [
            { x: 4, y: 4, d: "0s", s: 8 },
            { x: 68, y: 12, d: "0.5s", s: 6 },
            { x: 38, y: 0, d: "0.9s", s: 7 },
            { x: 8, y: 28, d: "1.2s", s: 5 },
            { x: 66, y: 34, d: "0.3s", s: 6 },
          ].map((sp, i) => (
            <div
              key={i}
              className="gpsp"
              style={{
                position: "absolute",
                left: sp.x * (dims.w / 80),
                top: sp.y * (dims.h / 96),
                animationDelay: sp.d,
                fontSize: sp.s,
                color: "#fbbf24",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              ✦
            </div>
          ))}
        <svg
          viewBox="0 0 120 140"
          width={dims.w}
          height={dims.h}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="gpc3">
              <path d="M28 52 Q24 55 22 65 L20 108 Q20 118 60 118 Q100 118 100 108 L98 65 Q96 55 92 52 Z" />
            </clipPath>
            <linearGradient id="gpbody3" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={dark ? "#374151" : "#e5e7eb"} />
              <stop offset="45%" stopColor={dark ? "#4b5563" : "#f9fafb"} />
              <stop offset="100%" stopColor={dark ? "#1f2937" : "#d1d5db"} />
            </linearGradient>
            <linearGradient id="gpliq3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lc.top} />
              <stop offset="100%" stopColor={lc.mid} />
            </linearGradient>
            <linearGradient id="gprim3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={dark ? "#6b7280" : "#ffffff"} />
              <stop offset="100%" stopColor={dark ? "#374151" : "#d1d5db"} />
            </linearGradient>
          </defs>
          <path
            d="M28 52 Q24 55 22 65 L20 108 Q20 118 60 118 Q100 118 100 108 L98 65 Q96 55 92 52 Z"
            fill="url(#gpbody3)"
            stroke={dark ? "#374151" : "#d1d5db"}
            strokeWidth="1.5"
          />
          {clamp > 0 && (
            <g clipPath="url(#gpc3)">
              <rect
                x="20"
                y={liqY}
                width="80"
                height={liqH + 10}
                fill="url(#gpliq3)"
              />
              <path
                d={`M20 ${liqY} Q${35 + wave} ${liqY - 5} 50 ${liqY} Q${
                  65 - wave
                } ${liqY + 5} 80 ${liqY} Q${90 + wave} ${
                  liqY - 4
                } 100 ${liqY} L100 ${liqY + 10} L20 ${liqY + 10} Z`}
                fill={lc.top}
                opacity="0.85"
              />
              <rect
                className="gpshim"
                x="30"
                y={liqY + 5}
                width="7"
                height={Math.max(0, liqH - 8)}
                rx="3.5"
                fill={lc.shine}
                opacity="0.5"
              />
            </g>
          )}
          <path
            d="M35 58 Q34 72 34 88"
            stroke={potShine}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.2"
          />
          <ellipse
            cx="60"
            cy="52"
            rx="34"
            ry="10"
            fill="url(#gprim3)"
            stroke={dark ? "#4b5563" : "#d1d5db"}
            strokeWidth="1.5"
          />
          <ellipse
            cx="60"
            cy="52"
            rx="27"
            ry="6.5"
            fill={dark ? "#111827" : "#f3f4f6"}
            stroke="none"
            opacity="0.55"
          />
          <path
            d="M22 70 Q9 70 9 81 Q9 92 22 92"
            fill="none"
            stroke={dark ? "#4b5563" : "#d1d5db"}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M98 70 Q111 70 111 81 Q111 92 98 90"
            fill="none"
            stroke={dark ? "#4b5563" : "#d1d5db"}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {clamp > 10 && (
            <g opacity={Math.min(1, clamp / 35)}>
              <ellipse
                cx="46"
                cy={liqY + 2}
                rx="9"
                ry="3"
                fill="#fbbf24"
                stroke="#d97706"
                strokeWidth="0.5"
              />
              <ellipse
                cx="68"
                cy={liqY + 0}
                rx="7.5"
                ry="2.5"
                fill="#fbbf24"
                stroke="#d97706"
                strokeWidth="0.5"
              />
              <ellipse
                cx="57"
                cy={liqY - 2}
                rx="10"
                ry="3.2"
                fill="#fcd34d"
                stroke="#d97706"
                strokeWidth="0.5"
              />
            </g>
          )}
          <ellipse
            cx="60"
            cy="121"
            rx="40"
            ry="5"
            fill={dark ? "#00000050" : "#00000012"}
          />
        </svg>
      </div>
    </div>
  );
}

function UsablePot({ fillPercent, amount, dark, size = "md" }) {
  const clamp = Math.max(0, Math.min(100, fillPercent));
  const amtColor =
    clamp <= 20 ? "#ef4444" : clamp <= 40 ? "#f97316" : "#f59e0b";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <GoldPotSVG fillPercent={fillPercent} dark={dark} size={size} />
      <div
        className="gppulse"
        style={{
          fontSize: size === "sm" ? 22 : 28,
          fontWeight: 800,
          fontFamily: "'DM Mono',monospace",
          color: amtColor,
          letterSpacing: "-1px",
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        ₹{amount < 0 ? "-" : ""}
        {Math.abs(amount).toLocaleString()}
      </div>
    </div>
  );
}

function NetWorthPot({ fillPercent, amount, dark }) {
  const clamp = Math.max(0, Math.min(100, fillPercent));
  const amtColor = clamp <= 20 ? "#ef4444" : "#7c3aed";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <GoldPotSVG fillPercent={fillPercent} dark={dark} size="lg" />
      <div
        className="gppulse"
        style={{
          fontSize: 32,
          fontWeight: 800,
          fontFamily: "'DM Mono',monospace",
          color: amtColor,
          letterSpacing: "-1.5px",
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        ₹{Math.abs(amount).toLocaleString()}
      </div>
    </div>
  );
}

/* ══════ STREAK HELPERS ══════ */
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function loadStreak() {
  try {
    const s = localStorage.getItem(STREAK_KEY);
    return s
      ? JSON.parse(s)
      : { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 };
  } catch {
    return { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 };
  }
}
function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const ist = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    ist.setDate(ist.getDate() - i);
    days.push(ist.toISOString().split("T")[0]);
  }
  return days;
}
function getNextDueDate(startDate, freq) {
  const d = new Date(startDate + "T00:00:00");
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  while (d <= now) {
    if (freq === "Weekly") d.setDate(d.getDate() + 7);
    else if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
    else if (freq === "Yearly") d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split("T")[0];
}
function isDueSoon(nd) {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const diff = Math.ceil((new Date(nd + "T00:00:00") - ist) / 86400000);
  return diff >= 0 && diff <= 3;
}

/* ══════════════════════════════════════
   MAIN APP
══════════════════════════════════════ */
export default function App() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });
  const [expenses, setExpenses] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [budget, setBudget] = useState(() => {
    try {
      const s = localStorage.getItem(BUDGET_KEY);
      return s ? Number(s) : 0;
    } catch {
      return 0;
    }
  });
  const [categories, setCategories] = useState(() => {
    try {
      const s = localStorage.getItem(CATEGORY_KEY);
      return s ? JSON.parse(s) : defaultCategories;
    } catch {
      return defaultCategories;
    }
  });
  const [streak, setStreak] = useState(() => loadStreak());
  const [recurring, setRecurring] = useState(() => {
    try {
      const s = localStorage.getItem(RECURRING_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [pot, setPot] = useState(() => {
    try {
      const s = localStorage.getItem(POT_KEY);
      return s ? JSON.parse(s) : defaultPot;
    } catch {
      return defaultPot;
    }
  });

  /* expense form */
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState(null);
  const [paySource, setPaySource] = useState("bank"); // "bank" | "cash"
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("expenses");

  /* recurring form */
  const [rName, setRName] = useState("");
  const [rAmount, setRAmount] = useState("");
  const [rCategory, setRCategory] = useState("Bills");
  const [rFreq, setRFreq] = useState("Monthly");
  const [rStart, setRStart] = useState(today);
  const [rEditId, setREditId] = useState(null);
  const [showRForm, setShowRForm] = useState(false);

  /* pot */
  const [potSection, setPotSection] = useState("usable");
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incName, setIncName] = useState("");
  const [incAmt, setIncAmt] = useState("");
  const [incFreq, setIncFreq] = useState("Monthly");
  const [incEditId, setIncEditId] = useState(null);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraLabel, setExtraLabel] = useState("");
  const [extraAmt, setExtraAmt] = useState("");
  const [extraDate, setExtraDate] = useState(today);

  /* usable money quick adjust */
  const [adjustMode, setAdjustMode] = useState(null); // null | "add" | "minus"
  const [adjustTarget, setAdjustTarget] = useState("bank"); // "bank" | "cash"
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  /* persist */
  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, budget.toString());
  }, [budget]);
  useEffect(() => {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
  }, [categories]);
  useEffect(() => {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  }, [streak]);
  useEffect(() => {
    localStorage.setItem(RECURRING_KEY, JSON.stringify(recurring));
  }, [recurring]);
  useEffect(() => {
    localStorage.setItem(POT_KEY, JSON.stringify(pot));
  }, [pot]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function logDay(dateStr) {
    setStreak((prev) => {
      if (prev.loggedDates.includes(dateStr)) return prev;
      const newLogged = [...prev.loggedDates, dateStr];
      let newCount = 1;
      if (prev.lastDate) {
        const diff = daysBetween(prev.lastDate, dateStr);
        if (diff === 1) newCount = prev.count + 1;
        else if (diff === 0) return prev;
      }
      return {
        count: newCount,
        lastDate: dateStr,
        loggedDates: newLogged,
        longestStreak: Math.max(prev.longestStreak || 0, newCount),
      };
    });
  }
  const todayLogged = streak.loggedDates.includes(today);
  function formatDate(d) {
    const dt = new Date(d + "T00:00:00");
    const m = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${String(dt.getDate()).padStart(2, "0")}-${
      m[dt.getMonth()]
    }-${String(dt.getFullYear()).slice(-2)}`;
  }

  /* ── DEDUCT from specific source ── */
  function deductFromSource(source, amount, pot) {
    const field = source === "cash" ? "usableCash" : "usableBank";
    return { ...pot, [field]: Math.max(0, (Number(pot[field]) || 0) - amount) };
  }
  function refundToSource(source, amount, pot) {
    const field = source === "cash" ? "usableCash" : "usableBank";
    return { ...pot, [field]: (Number(pot[field]) || 0) + amount };
  }

  /* expense CRUD */
  function resetForm() {
    setAmount("");
    setNote("");
    setDate(today);
    setEditingId(null);
    setPaySource("bank");
  }
  function saveExpense() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    const num = Number(amount);
    if (editingId) {
      const old = expenses.find((e) => e.id === editingId);
      const diff = num - (old ? old.amount : 0);
      setExpenses((p) =>
        p.map((e) =>
          e.id === editingId
            ? { ...e, amount: num, category, note, date, paySource }
            : e
        )
      );
      /* adjust for difference in same source */
      const src = paySource;
      setPot((p) => {
        const field = src === "cash" ? "usableCash" : "usableBank";
        return { ...p, [field]: Math.max(0, (Number(p[field]) || 0) - diff) };
      });
      showToast("Updated!");
    } else {
      setExpenses((p) => [
        ...p,
        { id: Date.now(), amount: num, category, note, date, paySource },
      ]);
      setPot((p) => deductFromSource(paySource, num, p));
      showToast(
        `Expense added · deducted from ${
          paySource === "cash" ? "cash" : "bank"
        }`
      );
    }
    logDay(date);
    resetForm();
  }
  function editExpense(item) {
    setEditingId(item.id);
    setAmount(item.amount);
    setCategory(item.category);
    setNote(item.note);
    setDate(item.date);
    setPaySource(item.paySource || "bank");
  }
  function deleteExpense(id) {
    const exp = expenses.find((e) => e.id === id);
    if (exp)
      setPot((p) => refundToSource(exp.paySource || "bank", exp.amount, p));
    setExpenses((p) => p.filter((e) => e.id !== id));
    showToast("Deleted & refunded to pot.");
  }
  function logNoSpend() {
    if (todayLogged) {
      showToast("Today already logged!");
      return;
    }
    logDay(today);
    showToast("No-spend day logged!");
  }
  function saveBudget() {
    if (!budgetInput) return;
    setBudget(Number(budgetInput));
    setBudgetInput("");
    setEditingBudget(false);
    showToast("Budget updated!");
  }
  function saveCategory() {
    if (!newCatInput.trim() || categories.includes(newCatInput.trim())) return;
    setCategories((p) => [...p, newCatInput.trim()]);
    setNewCatInput("");
    setAddingCat(false);
  }

  /* recurring */
  function resetRForm() {
    setRName("");
    setRAmount("");
    setRCategory("Bills");
    setRFreq("Monthly");
    setRStart(today);
    setREditId(null);
    setShowRForm(false);
  }
  function saveRecurring() {
    if (
      !rName.trim() ||
      !rAmount ||
      isNaN(Number(rAmount)) ||
      Number(rAmount) <= 0
    )
      return;
    const entry = {
      id: rEditId || Date.now(),
      name: rName.trim(),
      amount: Number(rAmount),
      category: rCategory,
      frequency: rFreq,
      startDate: rStart,
      nextDue: getNextDueDate(rStart, rFreq),
      paid: [],
    };
    if (rEditId) {
      setRecurring((p) =>
        p.map((r) => (r.id === rEditId ? { ...entry, paid: r.paid } : r))
      );
      showToast("Updated!");
    } else {
      setRecurring((p) => [...p, entry]);
      showToast("Recurring added!");
    }
    resetRForm();
  }
  function editRecurring(r) {
    setREditId(r.id);
    setRName(r.name);
    setRAmount(r.amount);
    setRCategory(r.category);
    setRFreq(r.frequency);
    setRStart(r.startDate);
    setShowRForm(true);
  }
  function deleteRecurring(id) {
    setRecurring((p) => p.filter((r) => r.id !== id));
    showToast("Removed.");
  }
  function markPaid(r, source = "bank") {
    const pd = today;
    setExpenses((p) => [
      ...p,
      {
        id: Date.now(),
        amount: r.amount,
        category: r.category,
        note: `${r.name} (${r.frequency})`,
        date: pd,
        paySource: source,
      },
    ]);
    setRecurring((p) =>
      p.map((item) =>
        item.id !== r.id
          ? item
          : {
              ...item,
              nextDue: getNextDueDate(pd, item.frequency),
              paid: [...(item.paid || []), pd],
            }
      )
    );
    setPot((p) => deductFromSource(source, r.amount, p));
    logDay(pd);
    showToast(`${r.name} paid from ${source}!`);
  }

  /* pot: usable quick adjust */
  function applyAdjust() {
    const num = Number(adjustAmt);
    if (!num || num <= 0) return;
    const field = adjustTarget === "cash" ? "usableCash" : "usableBank";
    setPot((p) => ({
      ...p,
      [field]:
        adjustMode === "add"
          ? (Number(p[field]) || 0) + num
          : Math.max(0, (Number(p[field]) || 0) - num),
    }));
    showToast(
      `${adjustMode === "add" ? "+" : "-"}₹${num.toLocaleString()} ${
        adjustMode === "add" ? "added to" : "deducted from"
      } ${adjustTarget}`
    );
    setAdjustAmt("");
    setAdjustNote("");
    setAdjustMode(null);
  }

  /* pot: income */
  function resetIncomeForm() {
    setIncName("");
    setIncAmt("");
    setIncFreq("Monthly");
    setIncEditId(null);
    setShowIncomeForm(false);
  }
  function saveIncome() {
    if (
      !incName.trim() ||
      !incAmt ||
      isNaN(Number(incAmt)) ||
      Number(incAmt) <= 0
    )
      return;
    const entry = {
      id: incEditId || Date.now(),
      label: incName.trim(),
      amount: Number(incAmt),
      frequency: incFreq,
      active: true,
    };
    if (incEditId) {
      setPot((p) => ({
        ...p,
        incomes: p.incomes.map((i) => (i.id === incEditId ? entry : i)),
      }));
      showToast("Income updated!");
    } else {
      setPot((p) => ({ ...p, incomes: [...(p.incomes || []), entry] }));
      showToast("Income added!");
    }
    resetIncomeForm();
  }
  function deleteIncome(id) {
    setPot((p) => ({ ...p, incomes: p.incomes.filter((i) => i.id !== id) }));
    showToast("Removed.");
  }
  function editIncome(inc) {
    setIncEditId(inc.id);
    setIncName(inc.label);
    setIncAmt(inc.amount);
    setIncFreq(inc.frequency);
    setShowIncomeForm(true);
  }
  function creditIncome(inc) {
    setPot((p) => ({
      ...p,
      usableBank: (Number(p.usableBank) || 0) + Number(inc.amount),
    }));
    showToast(`₹${Number(inc.amount).toLocaleString()} credited to bank!`);
  }

  /* pot: extras */
  function saveExtra() {
    if (
      !extraLabel.trim() ||
      !extraAmt ||
      isNaN(Number(extraAmt)) ||
      Number(extraAmt) <= 0
    )
      return;
    const entry = {
      id: Date.now(),
      label: extraLabel.trim(),
      amount: Number(extraAmt),
      date: extraDate,
    };
    setPot((p) => ({
      ...p,
      extras: [...(p.extras || []), entry],
      usableBank: (Number(p.usableBank) || 0) + Number(extraAmt),
    }));
    setExtraLabel("");
    setExtraAmt("");
    setExtraDate(today);
    setShowExtraForm(false);
    showToast(`₹${Number(extraAmt).toLocaleString()} added to bank!`);
  }
  function deleteExtra(id) {
    const ex = (pot.extras || []).find((e) => e.id === id);
    if (ex)
      setPot((p) => ({
        ...p,
        extras: p.extras.filter((e) => e.id !== id),
        usableBank: Math.max(0, (Number(p.usableBank) || 0) - ex.amount),
      }));
    showToast("Removed.");
  }
  function updateNetWorth(field, val) {
    setPot((p) => ({ ...p, [field]: Number(val) || 0 }));
  }
  function updateUsable(field, val) {
    setPot((p) => ({ ...p, [field]: Number(val) || 0 }));
  }

  /* computed */
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - spent;
  const percentUsed = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const totals = {};
  expenses.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  const topCategory = Object.keys(totals).sort(
    (a, b) => totals[b] - totals[a]
  )[0];
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const monthlyTotal = expenses
    .filter((e) => new Date(e.date + "T00:00:00").getMonth() === ist.getMonth())
    .reduce((s, e) => s + e.amount, 0);
  const recurringMonthly = recurring.reduce(
    (s, r) =>
      r.frequency === "Monthly"
        ? s + r.amount
        : r.frequency === "Weekly"
        ? s + r.amount * 4
        : r.frequency === "Yearly"
        ? s + Math.round(r.amount / 12)
        : s,
    0
  );
  const dueSoonCount = recurring.filter((r) => isDueSoon(r.nextDue)).length;
  const streakMilestone =
    streak.count >= 30
      ? "30-day legend!"
      : streak.count >= 14
      ? "2-week warrior!"
      : streak.count >= 7
      ? "One week strong!"
      : null;
  const last14 = getLastNDays(14);
  const grouped = {};
  [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((e) => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

  const usableTotal =
    (Number(pot.usableCash) || 0) + (Number(pot.usableBank) || 0);
  const netWorthTotal =
    usableTotal +
    (Number(pot.savings) || 0) +
    (Number(pot.investments) || 0) +
    (Number(pot.gold) || 0);
  const monthlyIncome = (pot.incomes || []).reduce((s, i) => {
    if (!i.active) return s;
    if (i.frequency === "Monthly") return s + i.amount;
    if (i.frequency === "Weekly") return s + i.amount * 4;
    if (i.frequency === "Yearly") return s + Math.round(i.amount / 12);
    return s;
  }, 0);
  const potBase =
    monthlyIncome > 0 ? monthlyIncome : netWorthTotal > 0 ? netWorthTotal : 1;
  const usableFillPct = Math.min(100, (usableTotal / potBase) * 100);
  const nwFillActual =
    netWorthTotal > 0
      ? Math.min(100, (usableTotal / netWorthTotal) * 100 + 20)
      : 0;

  const catStyles = {
    Food: dark
      ? { background: "#450a0a", color: "#fca5a5" }
      : { background: "#fee2e2", color: "#dc2626" },
    Groceries: dark
      ? { background: "#052e16", color: "#86efac" }
      : { background: "#dcfce7", color: "#16a34a" },
    Travel: dark
      ? { background: "#172554", color: "#93c5fd" }
      : { background: "#dbeafe", color: "#2563eb" },
    Shopping: dark
      ? { background: "#2e1065", color: "#c4b5fd" }
      : { background: "#ede9fe", color: "#7c3aed" },
    Bills: dark
      ? { background: "#422006", color: "#fde047" }
      : { background: "#fef9c3", color: "#ca8a04" },
    Entertainment: dark
      ? { background: "#500724", color: "#f9a8d4" }
      : { background: "#fce7f3", color: "#db2777" },
  };
  function getCatStyle(cat) {
    return (
      catStyles[cat] ||
      (dark
        ? { background: "#1f2937", color: "#9ca3af" }
        : { background: "#f3f4f6", color: "#6b7280" })
    );
  }

  const bg = dark ? "#030712" : "#f8fafc",
    cardBg = dark ? "#111827" : "#ffffff",
    border = dark ? "#1f2937" : "#f1f5f9";
  const textMain = dark ? "#f9fafb" : "#111827",
    textMute = dark ? "#6b7280" : "#6b7280";
  const inputBg = dark ? "#1f2937" : "#ffffff",
    inputBorder = dark ? "#374151" : "#e5e7eb",
    subbg = dark ? "#1f2937" : "#f8fafc";

  const cardStyle = {
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  };
  const inputStyle = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: textMain,
    borderRadius: 12,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
  const btnPrimary = {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
  const btnSecondary = {
    background: dark ? "#374151" : "#f3f4f6",
    color: dark ? "#d1d5db" : "#374151",
    border: "none",
    borderRadius: 12,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
  const btnGreen = {
    background: dark ? "#064e3b" : "#d1fae5",
    color: dark ? "#34d399" : "#065f46",
    border: "none",
    borderRadius: 12,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };
  const btnGold = {
    background: dark ? "#422006" : "#fef3c7",
    color: dark ? "#fbbf24" : "#92400e",
    border: "none",
    borderRadius: 12,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };
  const btnDanger = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: textMute,
    padding: 4,
  };

  /* source toggle pill */
  const SourcePill = ({ value, onChange }) => (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: subbg,
        borderRadius: 10,
        padding: 3,
        border: `1px solid ${border}`,
      }}
    >
      {[
        ["bank", "Bank", "#2563eb"],
        ["cash", "Cash", "#16a34a"],
      ].map(([v, label, color]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            background: value === v ? color : "transparent",
            color: value === v ? "#fff" : textMute,
            transition: "all 0.15s",
          }}
        >
          {v === "bank" ? <BankIcon /> : <CashIcon />} {label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: textMain,
        fontFamily: "'DM Sans',sans-serif",
        transition: "background 0.3s",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap"
        rel="stylesheet"
      />
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 999,
            background: "#4f46e5",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.5px",
              }}
            >
              mySpendr
            </h1>
            <p
              style={{ margin: 0, fontSize: 12, color: textMute, marginTop: 2 }}
            >
              Track. Save. Streak.
            </p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            style={{
              ...btnSecondary,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
            <span>{dark ? "Light" : "Dark"}</span>
          </button>
        </div>

        {/* ── USABLE MONEY MINI CARD ── */}
        <div
          style={{
            ...cardStyle,
            background: dark
              ? "linear-gradient(135deg,#111827,#1c1410)"
              : "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: dark ? "1px solid #292117" : "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
            }}
            onClick={() => setTab("pot")}
          >
            <UsablePot
              fillPercent={usableFillPct}
              amount={usableTotal}
              dark={dark}
              size="sm"
            />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#f59e0b",
                  marginBottom: 4,
                }}
              >
                Usable Money
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  fontFamily: "'DM Mono',monospace",
                  color: usableTotal <= 0 ? "#ef4444" : "#f59e0b",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                }}
              >
                ₹{usableTotal.toLocaleString()}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 5,
                  fontSize: 12,
                  color: textMute,
                }}
              >
                <span>
                  Cash ₹{(Number(pot.usableCash) || 0).toLocaleString()}
                </span>
                <span>
                  Bank ₹{(Number(pot.usableBank) || 0).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 5,
                  borderRadius: 99,
                  overflow: "hidden",
                  background: dark ? "#1f2937" : "#fde68a",
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    width: `${usableFillPct}%`,
                    background: "linear-gradient(to right,#f97316,#fbbf24)",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Quick +/- buttons ── */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setAdjustMode(adjustMode === "add" ? null : "add")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                background:
                  adjustMode === "add"
                    ? "#16a34a"
                    : dark
                    ? "#1f2937"
                    : "#f0fdf4",
                color:
                  adjustMode === "add" ? "#fff" : dark ? "#34d399" : "#16a34a",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Money
            </button>
            <button
              onClick={() =>
                setAdjustMode(adjustMode === "minus" ? null : "minus")
              }
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                background:
                  adjustMode === "minus"
                    ? "#dc2626"
                    : dark
                    ? "#1f2937"
                    : "#fff1f2",
                color:
                  adjustMode === "minus"
                    ? "#fff"
                    : dark
                    ? "#f87171"
                    : "#dc2626",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>−</span> Deduct
            </button>
          </div>

          {/* Adjust panel */}
          {adjustMode && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                background: dark ? "#0d1117" : "#f9fafb",
                borderRadius: 12,
                border: `1px solid ${border}`,
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: adjustMode === "add" ? "#16a34a" : "#dc2626",
                }}
              >
                {adjustMode === "add" ? "Add money to" : "Deduct from"} your pot
              </p>
              <SourcePill value={adjustTarget} onChange={setAdjustTarget} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  value={adjustAmt}
                  onChange={(e) => setAdjustAmt(e.target.value)}
                  placeholder="Amount ₹"
                  style={{ ...inputStyle, flex: 1 }}
                  autoFocus
                />
                <button
                  onClick={applyAdjust}
                  style={{
                    ...btnPrimary,
                    padding: "8px 16px",
                    background: adjustMode === "add" ? "#16a34a" : "#dc2626",
                  }}
                >
                  {adjustMode === "add" ? "+" : "-"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* STREAK */}
        <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
          {streak.count > 0 && (
            <div
              style={{
                position: "absolute",
                right: -32,
                top: -32,
                width: 128,
                height: 128,
                background: "rgba(249,115,22,0.08)",
                borderRadius: "50%",
                filter: "blur(24px)",
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: textMute,
                  marginBottom: 4,
                }}
              >
                Current Streak
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <span
                  style={{
                    fontSize: 52,
                    fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    lineHeight: 1,
                  }}
                >
                  {streak.count}
                </span>
                <span
                  style={{ fontSize: 18, color: textMute, marginBottom: 4 }}
                >
                  days
                </span>
              </div>
              {streakMilestone && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 4,
                    color: "#f97316",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <TrophyIcon /> {streakMilestone}
                </div>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: textMute,
                  marginTop: 4,
                }}
              >
                Longest: <strong>{streak.longestStreak || 0} days</strong>
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  background:
                    streak.count > 0
                      ? dark
                        ? "rgba(194,65,12,0.2)"
                        : "#ffedd5"
                      : subbg,
                  color: streak.count > 0 ? "#f97316" : textMute,
                }}
              >
                <FlameIcon size={16} /> {streak.count}
              </div>
              {!todayLogged ? (
                <button
                  onClick={logNoSpend}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "transparent",
                    border: dark ? "1px solid #065f46" : "1px solid #6ee7b7",
                    color: dark ? "#34d399" : "#059669",
                    cursor: "pointer",
                  }}
                >
                  <ShieldIcon /> No-Spend Day
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: dark ? "#34d399" : "#059669",
                  }}
                >
                  <ShieldIcon /> Today logged
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: textMute,
                marginBottom: 8,
              }}
            >
              Last 14 days
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(14,1fr)",
                gap: 4,
              }}
            >
              {last14.map((d) => {
                const lg = streak.loggedDates.includes(d),
                  it = d === today;
                return (
                  <div
                    key={d}
                    title={d}
                    style={{
                      height: 20,
                      borderRadius: 4,
                      background: lg
                        ? "#f97316"
                        : it
                        ? "transparent"
                        : dark
                        ? "#1f2937"
                        : "#f3f4f6",
                      border:
                        it && !lg
                          ? dark
                            ? "1px solid rgba(249,115,22,0.4)"
                            : "1px solid #fdba74"
                          : "none",
                      transition: "background 0.2s",
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: textMute,
                marginTop: 4,
              }}
            >
              <span>14 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* INSIGHTS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {[
            { label: "This Month", value: `₹${monthlyTotal.toLocaleString()}` },
            { label: "Top Category", value: topCategory || "—" },
            { label: "Total Entries", value: expenses.length },
            {
              label: "Remaining",
              value: `₹${remaining.toLocaleString()}`,
              red: remaining < 0,
            },
          ].map(({ label, value, red }) => (
            <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: textMute,
                  marginBottom: 4,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: red ? "#ef4444" : textMain,
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* RECURRING PILL */}
        {recurring.length > 0 && (
          <div
            style={{
              ...cardStyle,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RepeatIcon />
              <div>
                <p style={{ margin: 0, fontSize: 12, color: textMute }}>
                  Recurring / month
                </p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  ₹{recurringMonthly.toLocaleString()}
                </p>
              </div>
            </div>
            {dueSoonCount > 0 && (
              <div
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 99,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {dueSoonCount} due soon
              </div>
            )}
          </div>
        )}

        {/* BUDGET */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              Monthly Budget
            </span>
            <button
              onClick={() => {
                setEditingBudget((e) => !e);
                setBudgetInput(budget || "");
              }}
              style={btnSecondary}
            >
              {editingBudget ? "Cancel" : "Edit"}
            </button>
          </div>
          {editingBudget && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="Enter budget"
                style={inputStyle}
              />
              <button onClick={saveBudget} style={btnPrimary}>
                Save
              </button>
            </div>
          )}
          <div
            style={{
              width: "100%",
              height: 12,
              borderRadius: 99,
              overflow: "hidden",
              background: dark ? "#1f2937" : "#f3f4f6",
            }}
          >
            <div
              style={{
                height: 12,
                borderRadius: 99,
                width: `${percentUsed}%`,
                background:
                  percentUsed >= 90
                    ? "linear-gradient(to right,#ef4444,#f97316)"
                    : "linear-gradient(to right,#6366f1,#8b5cf6)",
                transition: "width 0.5s",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: textMute,
              marginTop: 6,
            }}
          >
            <span>Spent ₹{spent.toLocaleString()}</span>
            <span
              style={{
                color: percentUsed >= 100 ? "#ef4444" : textMute,
                fontWeight: percentUsed >= 100 ? 600 : 400,
              }}
            >
              {percentUsed.toFixed(0)}% of ₹{budget.toLocaleString()}
            </span>
          </div>
        </div>

        {/* TABS */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 12,
            background: subbg,
            borderRadius: 14,
            padding: 4,
            border: `1px solid ${border}`,
          }}
        >
          {["expenses", "recurring", "pot"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: tab === t ? cardBg : "transparent",
                color: tab === t ? textMain : textMute,
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {t === "recurring" ? (
                <>
                  <RepeatIcon />
                  Recurring
                </>
              ) : t === "pot" ? (
                <>
                  <PotTabIcon />
                  My Pot
                </>
              ) : (
                "Expenses"
              )}
            </button>
          ))}
        </div>

        {/* ══ EXPENSES ══ */}
        {tab === "expenses" && (
          <>
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>
                {editingId ? "Edit Expense" : "Add Expense"}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount (₹)"
                  style={inputStyle}
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={inputStyle}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              {/* Pay from source */}
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 12,
                  color: textMute,
                  fontWeight: 500,
                }}
              >
                Pay from
              </p>
              <SourcePill value={paySource} onChange={setPaySource} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={saveExpense}
                  style={{ ...btnPrimary, flex: 1 }}
                >
                  {editingId ? "Update Expense" : "Add Expense"}
                </button>
                {editingId && (
                  <button onClick={resetForm} style={btnSecondary}>
                    Cancel
                  </button>
                )}
                {!addingCat ? (
                  <button
                    onClick={() => setAddingCat(true)}
                    style={{
                      ...btnSecondary,
                      fontSize: 20,
                      padding: "6px 14px",
                    }}
                  >
                    +
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="Category"
                      onKeyDown={(e) => e.key === "Enter" && saveCategory()}
                      style={{ ...inputStyle, width: 110 }}
                    />
                    <button onClick={saveCategory} style={btnPrimary}>
                      Add
                    </button>
                    <button
                      onClick={() => setAddingCat(false)}
                      style={btnSecondary}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {expenses.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
                <p style={{ color: textMute, margin: 0 }}>No expenses yet.</p>
              </div>
            ) : (
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    All Expenses
                  </h2>
                </div>
                {Object.keys(grouped).map((dk) => (
                  <div key={dk}>
                    <div
                      style={{
                        padding: "8px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: textMute,
                        background: subbg,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      {formatDate(dk)}
                    </div>
                    {grouped[dk].map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderBottom: `1px solid ${border}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span
                            style={{
                              ...getCatStyle(item.category),
                              padding: "3px 8px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {item.category}
                          </span>
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 600,
                                }}
                              >
                                ₹{item.amount.toLocaleString()}
                              </p>
                              {/* source badge */}
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 6,
                                  background:
                                    item.paySource === "cash"
                                      ? dark
                                        ? "#052e16"
                                        : "#dcfce7"
                                      : dark
                                      ? "#172554"
                                      : "#dbeafe",
                                  color:
                                    item.paySource === "cash"
                                      ? dark
                                        ? "#86efac"
                                        : "#16a34a"
                                      : dark
                                      ? "#93c5fd"
                                      : "#2563eb",
                                }}
                              >
                                {item.paySource === "cash" ? (
                                  <CashIcon />
                                ) : (
                                  <BankIcon />
                                )}
                                {item.paySource === "cash" ? "Cash" : "Bank"}
                              </span>
                            </div>
                            {item.note && (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: textMute,
                                }}
                              >
                                {item.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <button
                            onClick={() => editExpense(item)}
                            style={btnDanger}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => deleteExpense(item.id)}
                            style={btnDanger}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ RECURRING ══ */}
        {tab === "recurring" && (
          <>
            {showRForm ? (
              <div style={cardStyle}>
                <h2
                  style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}
                >
                  {rEditId ? "Edit Recurring" : "New Recurring Payment"}
                </h2>
                <input
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="Name (e.g. Netflix, Rent)"
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="number"
                    value={rAmount}
                    onChange={(e) => setRAmount(e.target.value)}
                    placeholder="Amount (₹)"
                    style={inputStyle}
                  />
                  <select
                    value={rCategory}
                    onChange={(e) => setRCategory(e.target.value)}
                    style={inputStyle}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <select
                    value={rFreq}
                    onChange={(e) => setRFreq(e.target.value)}
                    style={inputStyle}
                  >
                    {RECUR_FREQ.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={rStart}
                    onChange={(e) => setRStart(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveRecurring}
                    style={{ ...btnPrimary, flex: 1 }}
                  >
                    {rEditId ? "Update" : "Add Recurring"}
                  </button>
                  <button onClick={resetRForm} style={btnSecondary}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRForm(true)}
                style={{
                  ...btnPrimary,
                  width: "100%",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <PlusIcon /> Add Recurring Payment
              </button>
            )}
            {recurring.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
                <p style={{ color: textMute, margin: 0 }}>
                  No recurring payments yet.
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {recurring.map((r, i) => {
                  const soon = isDueSoon(r.nextDue);
                  const paidTM = (r.paid || []).some((d) => {
                    const pd = new Date(d + "T00:00:00");
                    return (
                      pd.getMonth() === ist.getMonth() &&
                      pd.getFullYear() === ist.getFullYear()
                    );
                  });
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: "14px 16px",
                        borderBottom:
                          i < recurring.length - 1
                            ? `1px solid ${border}`
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: 15, fontWeight: 700 }}>
                              {r.name}
                            </span>
                            <span
                              style={{
                                ...getCatStyle(r.category),
                                padding: "2px 8px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {r.category}
                            </span>
                            {soon && !paidTM && (
                              <span
                                style={{
                                  background: "#fef3c7",
                                  color: "#92400e",
                                  borderRadius: 99,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                Due soon
                              </span>
                            )}
                            {paidTM && (
                              <span
                                style={{
                                  background: dark ? "#052e16" : "#d1fae5",
                                  color: dark ? "#34d399" : "#065f46",
                                  borderRadius: 99,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <CheckIcon />
                                Paid
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              fontSize: 12,
                              color: textMute,
                            }}
                          >
                            <span>
                              ₹{r.amount.toLocaleString()} / {r.frequency}
                            </span>
                            <span>Next: {formatDate(r.nextDue)}</span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            marginLeft: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {!paidTM && (
                            <>
                              <button
                                onClick={() => markPaid(r, "bank")}
                                style={{ ...btnGreen, fontSize: 11 }}
                              >
                                <BankIcon /> Bank
                              </button>
                              <button
                                onClick={() => markPaid(r, "cash")}
                                style={{ ...btnGold, fontSize: 11 }}
                              >
                                <CashIcon /> Cash
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => editRecurring(r)}
                            style={btnDanger}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => deleteRecurring(r.id)}
                            style={btnDanger}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ POT TAB ══ */}
        {tab === "pot" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 12,
                background: subbg,
                borderRadius: 12,
                padding: 4,
                border: `1px solid ${border}`,
              }}
            >
              {[
                ["usable", "Usable Money"],
                ["networth", "Net Worth"],
                ["income", "Income"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPotSection(k)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    background: potSection === k ? cardBg : "transparent",
                    color: potSection === k ? textMain : textMute,
                    boxShadow:
                      potSection === k ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* USABLE */}
            {potSection === "usable" && (
              <>
                <div
                  style={{
                    ...cardStyle,
                    background: dark
                      ? "linear-gradient(135deg,#111827,#1c1410)"
                      : "linear-gradient(135deg,#fffbeb,#fef3c7)",
                    border: dark ? "1px solid #292117" : "1px solid #fde68a",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "28px 16px 20px",
                    gap: 12,
                  }}
                >
                  <UsablePot
                    fillPercent={usableFillPct}
                    amount={usableTotal}
                    dark={dark}
                    size="lg"
                  />
                  <div style={{ width: "100%", maxWidth: 280 }}>
                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 99,
                        overflow: "hidden",
                        background: dark ? "#1f2937" : "#fde68a",
                      }}
                    >
                      <div
                        style={{
                          height: 8,
                          borderRadius: 99,
                          width: `${usableFillPct}%`,
                          background:
                            "linear-gradient(to right,#f97316,#fbbf24)",
                          transition: "width 0.7s ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: textMute,
                        marginTop: 5,
                      }}
                    >
                      <span>
                        Cash ₹{(Number(pot.usableCash) || 0).toLocaleString()}
                      </span>
                      <span>
                        Bank ₹{(Number(pot.usableBank) || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 14,
                    }}
                  >
                    <WalletIcon />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Set Balances
                    </span>
                  </div>
                  {[
                    ["usableCash", "Cash in Hand", "#16a34a"],
                    ["usableBank", "Bank Balance", "#2563eb"],
                  ].map(([field, label, color]) => (
                    <div
                      key={field}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: textMain,
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </span>
                      <input
                        type="number"
                        value={pot[field] || ""}
                        onChange={(e) => updateUsable(field, e.target.value)}
                        placeholder="₹0"
                        style={{
                          ...inputStyle,
                          width: 140,
                          textAlign: "right",
                          color,
                          fontWeight: 700,
                        }}
                      />
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: 10,
                      marginTop: 4,
                      borderTop: `1px solid ${border}`,
                    }}
                  >
                    <span style={{ fontSize: 13, color: textMute }}>
                      Total Usable
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#f59e0b",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      ₹{usableTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    ...cardStyle,
                    background: dark ? "#0a1628" : "#f0fdf4",
                    border: dark ? "1px solid #1e3a5f" : "1px solid #bbf7d0",
                  }}
                >
                  <p
                    style={{ margin: "0 0 4px", fontSize: 12, color: textMute }}
                  >
                    After all expenses this month
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "'DM Mono',monospace",
                      color:
                        usableTotal - monthlyTotal >= 0 ? "#16a34a" : "#ef4444",
                    }}
                  >
                    ₹{(usableTotal - monthlyTotal).toLocaleString()}
                  </p>
                  <p
                    style={{ margin: "4px 0 0", fontSize: 11, color: textMute }}
                  >
                    Spent ₹{monthlyTotal.toLocaleString()} this month
                  </p>
                </div>
              </>
            )}

            {/* NET WORTH */}
            {potSection === "networth" && (
              <>
                <div
                  style={{
                    ...cardStyle,
                    background: dark
                      ? "linear-gradient(135deg,#111827,#1a1028)"
                      : "linear-gradient(135deg,#faf5ff,#ede9fe)",
                    border: dark ? "1px solid #2e1065" : "1px solid #ddd6fe",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "28px 16px 20px",
                    gap: 12,
                  }}
                >
                  <NetWorthPot
                    fillPercent={nwFillActual}
                    amount={netWorthTotal}
                    dark={dark}
                  />
                  <div style={{ width: "100%", maxWidth: 280 }}>
                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 99,
                        overflow: "hidden",
                        background: dark ? "#1f2937" : "#ddd6fe",
                      }}
                    >
                      <div
                        style={{
                          height: 8,
                          borderRadius: 99,
                          width: `${nwFillActual}%`,
                          background:
                            "linear-gradient(to right,#7c3aed,#a78bfa)",
                          transition: "width 0.7s ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: textMute,
                        marginTop: 5,
                      }}
                    >
                      <span>Usable ₹{usableTotal.toLocaleString()}</span>
                      <span>Total ₹{netWorthTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 14,
                    }}
                  >
                    <TrendingUpIcon />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Breakdown
                    </span>
                  </div>
                  {[
                    ["usableCash", "Cash in Hand", "#16a34a"],
                    ["usableBank", "Bank Balance", "#2563eb"],
                    ["savings", "Savings / FD", "#7c3aed"],
                    ["investments", "Investments (MF / Stocks)", "#db2777"],
                    ["gold", "Gold / Assets", "#d97706"],
                  ].map(([field, label, color]) => (
                    <div
                      key={field}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: textMain }}>
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color,
                          minWidth: 90,
                          textAlign: "right",
                        }}
                      >
                        ₹{(Number(pot[field]) || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: 10,
                      marginTop: 4,
                      borderTop: `1px solid ${border}`,
                    }}
                  >
                    <span
                      style={{ fontSize: 13, color: textMute, fontWeight: 600 }}
                    >
                      Total Net Worth
                    </span>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#7c3aed",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      ₹{netWorthTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div style={cardStyle}>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Update Savings / Investments / Gold
                  </p>
                  {[
                    ["savings", "Savings / FD"],
                    ["investments", "Investments"],
                    ["gold", "Gold / Assets"],
                  ].map(([field, label]) => (
                    <div
                      key={field}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
                      <input
                        type="number"
                        value={pot[field] || ""}
                        onChange={(e) => updateNetWorth(field, e.target.value)}
                        placeholder="₹0"
                        style={{
                          ...inputStyle,
                          width: 140,
                          textAlign: "right",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* INCOME */}
            {potSection === "income" && (
              <>
                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <RepeatIcon />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Recurring Income
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#16a34a",
                        marginLeft: "auto",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      ₹{monthlyIncome.toLocaleString()}
                      <span
                        style={{
                          fontSize: 11,
                          color: textMute,
                          fontWeight: 400,
                        }}
                      >
                        /mo
                      </span>
                    </span>
                  </div>
                  {(pot.incomes || []).map((inc) => (
                    <div
                      key={inc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                        paddingBottom: 10,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                          {inc.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: textMute }}>
                          ₹{inc.amount.toLocaleString()} / {inc.frequency}
                        </p>
                      </div>
                      <button onClick={() => creditIncome(inc)} style={btnGold}>
                        <ZapIcon /> Credit
                      </button>
                      <button onClick={() => editIncome(inc)} style={btnDanger}>
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => deleteIncome(inc.id)}
                        style={btnDanger}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  {showIncomeForm ? (
                    <div
                      style={{
                        paddingTop: 8,
                        borderTop: `1px solid ${border}`,
                      }}
                    >
                      <input
                        value={incName}
                        onChange={(e) => setIncName(e.target.value)}
                        placeholder="Source (e.g. Salary, Freelance)"
                        style={{ ...inputStyle, marginBottom: 8 }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <input
                          type="number"
                          value={incAmt}
                          onChange={(e) => setIncAmt(e.target.value)}
                          placeholder="Amount ₹"
                          style={inputStyle}
                        />
                        <select
                          value={incFreq}
                          onChange={(e) => setIncFreq(e.target.value)}
                          style={inputStyle}
                        >
                          {RECUR_FREQ.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={saveIncome}
                          style={{ ...btnPrimary, flex: 1 }}
                        >
                          {incEditId ? "Update" : "Add"}
                        </button>
                        <button onClick={resetIncomeForm} style={btnSecondary}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowIncomeForm(true)}
                      style={{
                        ...btnSecondary,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <PlusIcon /> Add Income Source
                    </button>
                  )}
                </div>
                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <PiggyIcon />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Extra Earnings
                    </span>
                    <span
                      style={{ fontSize: 11, color: textMute, marginLeft: 4 }}
                    >
                      one-time
                    </span>
                  </div>
                  {(pot.extras || []).length === 0 && !showExtraForm && (
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: 13,
                        color: textMute,
                      }}
                    >
                      No extra earnings logged yet.
                    </p>
                  )}
                  {(pot.extras || []).map((ex) => (
                    <div
                      key={ex.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        paddingBottom: 8,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                          {ex.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: textMute }}>
                          {formatDate(ex.date)}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#16a34a",
                        }}
                      >
                        +₹{ex.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={() => deleteExtra(ex.id)}
                        style={btnDanger}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  {showExtraForm ? (
                    <div
                      style={{
                        paddingTop: 8,
                        borderTop: `1px solid ${border}`,
                      }}
                    >
                      <input
                        value={extraLabel}
                        onChange={(e) => setExtraLabel(e.target.value)}
                        placeholder="Label (e.g. Bonus, Freelance)"
                        style={{ ...inputStyle, marginBottom: 8 }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <input
                          type="number"
                          value={extraAmt}
                          onChange={(e) => setExtraAmt(e.target.value)}
                          placeholder="Amount ₹"
                          style={inputStyle}
                        />
                        <input
                          type="date"
                          value={extraDate}
                          onChange={(e) => setExtraDate(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={saveExtra}
                          style={{ ...btnPrimary, flex: 1 }}
                        >
                          Add to Pot
                        </button>
                        <button
                          onClick={() => setShowExtraForm(false)}
                          style={btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowExtraForm(true)}
                      style={{
                        ...btnSecondary,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <PlusIcon /> Log Extra Earning
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: textMute,
            marginTop: 24,
          }}
        >
          mySpendr · your money, your streak
        </p>
      </div>
    </div>
  );
}
