import { useState, useEffect } from "react";

const STORAGE_KEY = "myspendr_expenses_v3";
const BUDGET_KEY = "myspendr_budget_v3";
const CATEGORY_KEY = "myspendr_categories_v3";
const STREAK_KEY = "myspendr_streak_v3";
const THEME_KEY = "myspendr_theme_v3";

const today = new Date().toISOString().split("T")[0];
const defaultCategories = ["Food","Groceries","Travel","Shopping","Bills","Entertainment"];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function FlameIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C9.17 2 7 4.17 7 7c0 1.57.68 2.97 1.76 3.95C7.65 12.07 7 13.46 7 15c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.54-.65-2.93-1.76-4.05C16.32 9.97 17 8.57 17 7c0-2.83-2.17-5-5-5zm0 16c-1.65 0-3-1.35-3-3 0-.93.42-1.76 1.08-2.33C10.66 13.16 11.31 14 12 14s1.34-.84 1.92-1.33C14.58 13.24 15 14.07 15 15c0 1.65-1.35 3-3 3z"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/>
      <path d="M17 3H7a2 2 0 0 0-2 2v6a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2z"/>
      <path d="M5 7H2a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4"/>
      <path d="M19 7h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function loadStreak() {
  try {
    const s = localStorage.getItem(STREAK_KEY);
    return s ? JSON.parse(s) : { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 };
  } catch { return { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 }; }
}

function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

export default function App() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "dark"; } catch { return false; }
  });
  const [expenses, setExpenses] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [budget, setBudget] = useState(() => {
    try { const s = localStorage.getItem(BUDGET_KEY); return s ? Number(s) : 0; } catch { return 0; }
  });
  const [categories, setCategories] = useState(() => {
    try { const s = localStorage.getItem(CATEGORY_KEY); return s ? JSON.parse(s) : defaultCategories; } catch { return defaultCategories; }
  });
  const [streak, setStreak] = useState(() => loadStreak());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem(BUDGET_KEY, budget.toString()); }, [budget]);
  useEffect(() => { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STREAK_KEY, JSON.stringify(streak)); }, [streak]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function logDay(dateStr) {
    setStreak(prev => {
      if (prev.loggedDates.includes(dateStr)) return prev;
      const newLogged = [...prev.loggedDates, dateStr];
      let newCount = 1;
      if (prev.lastDate) {
        const diff = daysBetween(prev.lastDate, dateStr);
        if (diff === 1) newCount = prev.count + 1;
        else if (diff === 0) return prev;
        else newCount = 1;
      }
      const newLongest = Math.max(prev.longestStreak || 0, newCount);
      return { count: newCount, lastDate: dateStr, loggedDates: newLogged, longestStreak: newLongest };
    });
  }

  const todayLogged = streak.loggedDates.includes(today);

  function formatDate(d) {
    const dt = new Date(d + "T00:00:00");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${String(dt.getDate()).padStart(2,"0")}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  }

  function resetForm() { setAmount(""); setNote(""); setDate(today); setEditingId(null); }

  function saveExpense() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    if (editingId) {
      setExpenses(prev => prev.map(e => e.id === editingId ? { ...e, amount: Number(amount), category, note, date } : e));
      showToast("Expense updated!");
    } else {
      setExpenses(prev => [...prev, { id: Date.now(), amount: Number(amount), category, note, date }]);
      showToast("Expense added!");
    }
    logDay(date);
    resetForm();
  }

  function logNoSpend() {
    if (todayLogged) { showToast("Today already logged!"); return; }
    logDay(today);
    showToast("No-spend day logged! Streak continues");
  }

  function editExpense(item) {
    setEditingId(item.id); setAmount(item.amount);
    setCategory(item.category); setNote(item.note); setDate(item.date);
  }

  function deleteExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast("Deleted.");
  }

  function saveBudget() {
    if (!budgetInput) return;
    setBudget(Number(budgetInput)); setBudgetInput(""); setEditingBudget(false);
    showToast("Budget updated!");
  }

  function saveCategory() {
    if (!newCatInput.trim() || categories.includes(newCatInput.trim())) return;
    setCategories(prev => [...prev, newCatInput.trim()]);
    setNewCatInput(""); setAddingCat(false);
  }

  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - spent;
  const percentUsed = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const topCategory = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  const currentMonth = new Date().getMonth();
  const monthlyTotal = expenses.filter(e => new Date(e.date).getMonth() === currentMonth).reduce((s, e) => s + e.amount, 0);
  const streakMilestone = streak.count >= 30 ? "30-day legend!" : streak.count >= 14 ? "2-week warrior!" : streak.count >= 7 ? "One week strong!" : null;
  const last14 = getLastNDays(14);

  const grouped = {};
  [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  const catColorMap = {
    Food: dark ? "#fca5a5 / #450a0a" : "#fee2e2 / #dc2626",
    Groceries: dark ? "#86efac / #052e16" : "#dcfce7 / #16a34a",
    Travel: dark ? "#93c5fd / #172554" : "#dbeafe / #2563eb",
    Shopping: dark ? "#c4b5fd / #2e1065" : "#ede9fe / #7c3aed",
    Bills: dark ? "#fde047 / #422006" : "#fef9c3 / #ca8a04",
    Entertainment: dark ? "#f9a8d4 / #500724" : "#fce7f3 / #db2777",
  };

  // Using inline styles for dark mode category chips since Tailwind CDN can't do dynamic class generation
  const catStyles = {
    Food:          dark ? {background:"#450a0a", color:"#fca5a5"} : {background:"#fee2e2", color:"#dc2626"},
    Groceries:     dark ? {background:"#052e16", color:"#86efac"} : {background:"#dcfce7", color:"#16a34a"},
    Travel:        dark ? {background:"#172554", color:"#93c5fd"} : {background:"#dbeafe", color:"#2563eb"},
    Shopping:      dark ? {background:"#2e1065", color:"#c4b5fd"} : {background:"#ede9fe", color:"#7c3aed"},
    Bills:         dark ? {background:"#422006", color:"#fde047"} : {background:"#fef9c3", color:"#ca8a04"},
    Entertainment: dark ? {background:"#500724", color:"#f9a8d4"} : {background:"#fce7f3", color:"#db2777"},
  };
  function getCatStyle(cat) { return catStyles[cat] || (dark ? {background:"#1f2937",color:"#9ca3af"} : {background:"#f3f4f6",color:"#6b7280"}); }

  // Theme tokens as inline style objects (more reliable than Tailwind dynamic classes in CDN mode)
  const bg       = dark ? "#030712" : "#f8fafc";
  const cardBg   = dark ? "#111827" : "#ffffff";
  const border   = dark ? "#1f2937" : "#f1f5f9";
  const textMain = dark ? "#f9fafb" : "#111827";
  const textMute = dark ? "#6b7280" : "#6b7280";
  const inputBg  = dark ? "#1f2937" : "#ffffff";
  const inputBorder = dark ? "#374151" : "#e5e7eb";
  const subbg    = dark ? "#1f2937" : "#f8fafc";

  const cardStyle = { background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const inputStyle = { background: inputBg, border: `1px solid ${inputBorder}`, color: textMain, borderRadius: 12, padding: "8px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
  const btnPrimary = { background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const btnSecondary = { background: dark ? "#374151" : "#f3f4f6", color: dark ? "#d1d5db" : "#374151", border: "none", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textMain, fontFamily: "'DM Sans', sans-serif", transition: "background 0.3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet" />

      {/* TOAST */}
      {toast && (
        <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:999, background:"#4f46e5", color:"#fff", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:500, boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>

        {/* HEADER */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:700, letterSpacing:"-0.5px" }}>mySpendr</h1>
            <p style={{ margin:0, fontSize:12, color: textMute, marginTop:2 }}>Track. Save. Streak.</p>
          </div>
          <button onClick={() => setDark(d => !d)} style={{ ...btnSecondary, display:"flex", alignItems:"center", gap:6 }}>
            {dark ? <SunIcon /> : <MoonIcon />}
            <span>{dark ? "Light" : "Dark"}</span>
          </button>
        </div>

        {/* STREAK CARD */}
        <div style={{ ...cardStyle, position:"relative", overflow:"hidden" }}>
          {streak.count > 0 && <div style={{ position:"absolute", right:-32, top:-32, width:128, height:128, background:"rgba(249,115,22,0.08)", borderRadius:"50%", filter:"blur(24px)", pointerEvents:"none" }} />}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <p style={{ margin:0, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em", color:textMute, marginBottom:4 }}>Current Streak</p>
              <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                <span style={{ fontSize:52, fontWeight:700, fontFamily:"'DM Mono', monospace", lineHeight:1 }}>{streak.count}</span>
                <span style={{ fontSize:18, color:textMute, marginBottom:4 }}>days</span>
              </div>
              {streakMilestone && (
                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, color:"#f97316", fontSize:12, fontWeight:600 }}>
                  <TrophyIcon /> {streakMilestone}
                </div>
              )}
              <p style={{ margin:0, fontSize:12, color:textMute, marginTop:4 }}>
                Longest: <strong>{streak.longestStreak || 0} days</strong>
              </p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:12, fontSize:13, fontWeight:600, background: streak.count > 0 ? (dark?"rgba(194,65,12,0.2)":"#ffedd5") : subbg, color: streak.count > 0 ? "#f97316" : textMute }}>
                <FlameIcon size={16} /> {streak.count}
              </div>
              {!todayLogged ? (
                <button onClick={logNoSpend} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:12, fontSize:12, fontWeight:600, background:"transparent", border: dark ? "1px solid #065f46" : "1px solid #6ee7b7", color: dark ? "#34d399" : "#059669", cursor:"pointer" }}>
                  <ShieldIcon /> No-Spend Day
                </button>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:500, color: dark ? "#34d399" : "#059669" }}>
                  <ShieldIcon /> Today logged
                </div>
              )}
            </div>
          </div>

          {/* 14-day grid */}
          <div style={{ marginTop:16 }}>
            <p style={{ margin:0, fontSize:12, color:textMute, marginBottom:8 }}>Last 14 days</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(14, 1fr)", gap:4 }}>
              {last14.map(d => {
                const logged = streak.loggedDates.includes(d);
                const isToday = d === today;
                return (
                  <div key={d} title={d} style={{ height:20, borderRadius:4, background: logged ? "#f97316" : isToday ? "transparent" : (dark?"#1f2937":"#f3f4f6"), border: isToday && !logged ? (dark?"1px solid rgba(249,115,22,0.4)":"1px solid #fdba74") : "none", transition:"background 0.2s" }} />
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:textMute, marginTop:4 }}>
              <span>14 days ago</span><span>Today</span>
            </div>
          </div>
        </div>

        {/* INSIGHTS */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          {[
            { label:"This Month", value:`₹${monthlyTotal.toLocaleString()}` },
            { label:"Top Category", value: topCategory || "—" },
            { label:"Total Entries", value: expenses.length },
            { label:"Remaining", value:`₹${remaining.toLocaleString()}`, red: remaining < 0 },
          ].map(({ label, value, red }) => (
            <div key={label} style={{ ...cardStyle, marginBottom:0 }}>
              <p style={{ margin:0, fontSize:11, color:textMute, marginBottom:4 }}>{label}</p>
              <p style={{ margin:0, fontSize:20, fontWeight:700, color: red ? "#ef4444" : textMain }}>{value}</p>
            </div>
          ))}
        </div>

        {/* BUDGET */}
        <div style={cardStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:500 }}>Monthly Budget</span>
            <button onClick={() => { setEditingBudget(e => !e); setBudgetInput(budget||""); }} style={btnSecondary}>
              {editingBudget ? "Cancel" : "Edit"}
            </button>
          </div>
          {editingBudget && (
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="Enter budget" style={inputStyle} />
              <button onClick={saveBudget} style={btnPrimary}>Save</button>
            </div>
          )}
          <div style={{ width:"100%", height:12, borderRadius:99, overflow:"hidden", background: dark?"#1f2937":"#f3f4f6" }}>
            <div style={{ height:12, borderRadius:99, width:`${percentUsed}%`, background: percentUsed >= 90 ? "linear-gradient(to right,#ef4444,#f97316)" : "linear-gradient(to right,#6366f1,#8b5cf6)", transition:"width 0.5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:textMute, marginTop:6 }}>
            <span>Spent ₹{spent.toLocaleString()}</span>
            <span style={{ color: percentUsed >= 100 ? "#ef4444" : textMute, fontWeight: percentUsed >= 100 ? 600 : 400 }}>{percentUsed.toFixed(0)}% of ₹{budget.toLocaleString()}</span>
          </div>
        </div>

        {/* FORM */}
        <div style={cardStyle}>
          <h2 style={{ margin:"0 0 12px", fontSize:14, fontWeight:600 }}>{editingId ? "Edit Expense" : "Add Expense"}</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₹)" style={inputStyle} />
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom:8 }} />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, marginBottom:12 }} />
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={saveExpense} style={{ ...btnPrimary, flex:1 }}>{editingId ? "Update Expense" : "Add Expense"}</button>
            {editingId && <button onClick={resetForm} style={btnSecondary}>Cancel</button>}
            {!addingCat ? (
              <button onClick={() => setAddingCat(true)} style={{ ...btnSecondary, fontSize:20, padding:"6px 14px" }}>+</button>
            ) : (
              <div style={{ display:"flex", gap:4 }}>
                <input value={newCatInput} onChange={e => setNewCatInput(e.target.value)} placeholder="Category" onKeyDown={e => e.key==="Enter" && saveCategory()} style={{ ...inputStyle, width:110 }} />
                <button onClick={saveCategory} style={btnPrimary}>Add</button>
                <button onClick={() => setAddingCat(false)} style={btnSecondary}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* LIST */}
        {expenses.length === 0 ? (
          <div style={{ ...cardStyle, textAlign:"center", padding:40 }}>
            <p style={{ color:textMute, margin:0 }}>No expenses yet. Add one above!</p>
          </div>
        ) : (
          <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:16, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}` }}>
              <h2 style={{ margin:0, fontSize:14, fontWeight:600 }}>All Expenses</h2>
            </div>
            {Object.keys(grouped).map(dateKey => (
              <div key={dateKey}>
                <div style={{ padding:"8px 16px", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:textMute, background:subbg, borderBottom:`1px solid ${border}` }}>
                  {formatDate(dateKey)}
                </div>
                {grouped[dateKey].map(item => (
                  <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${border}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ ...getCatStyle(item.category), padding:"3px 8px", borderRadius:8, fontSize:11, fontWeight:600 }}>{item.category}</span>
                      <div>
                        <p style={{ margin:0, fontSize:14, fontWeight:600 }}>₹{item.amount.toLocaleString()}</p>
                        {item.note && <p style={{ margin:0, fontSize:12, color:textMute }}>{item.note}</p>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:12 }}>
                      <button onClick={() => editExpense(item)} style={{ background:"none", border:"none", cursor:"pointer", color:textMute, padding:4 }} aria-label="Edit"><EditIcon /></button>
                      <button onClick={() => deleteExpense(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:textMute, padding:4 }} aria-label="Delete"><TrashIcon /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign:"center", fontSize:12, color:textMute, marginTop:24 }}>mySpendr · your money, your streak</p>
      </div>
    </div>
  );
}