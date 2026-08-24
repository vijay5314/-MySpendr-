/* eslint-disable no-inner-declarations */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";


// ════════════════════════════════════════════════════════════════════════════
// STORAGE - safe localStorage wrapper (never throws)
// ════════════════════════════════════════════════════════════════════════════
const KEYS = {
  EXPENSES:   "myspendr_expenses_v3",
  BUDGET:     "myspendr_budget_v3",
  CATEGORIES: "myspendr_categories_v3",
  STREAK:     "myspendr_streak_v3",
  THEME:      "myspendr_theme_v3",
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
  SHIELD:     "myspendr_shield_v1",
  BANKS:      "myspendr_banks_v1",
  AVATAR:     "myspendr_avatar_v1",
  FRIENDS:    "myspendr_friends_v1",
  SPLITS:     "myspendr_splits_v1",
  THEME_STYLE:"myspendr_theme_style_v1",
  SIMPLE:     "myspendr_simple_v1",
  PRIVACY:    "myspendr_privacy_v1",
};

// ════════════════════════════════════════════════════════════════════════════
// POKÉMON STARTER SYSTEM
// ════════════════════════════════════════════════════════════════════════════
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
function storageRemove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { console.warn(`[storage] remove failed for "${key}":`, e.message); }
}

// FIX: ids were generated with Date.now(), which collides whenever two records
// are created inside the same millisecond (paying two reminders back-to-back,
// bulk-adding rows). Collided ids make edit/delete hit the wrong record.
let _uidCounter = 0;
function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  _uidCounter += 1;
  return `${Date.now().toString(36)}-${_uidCounter.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

// ════════════════════════════════════════════════════════════════════════════
// SCHEMA SANITIZERS
// ════════════════════════════════════════════════════════════════════════════
// FIX: storageGet only guarded against malformed JSON, never against data
// written by an older version with a different shape. Reading a legacy record
// and then calling e.g. `streak.loggedDates.includes(...)` threw during render
// and white-screened the app permanently, because the bad data stayed on disk.
// Every read now passes through a sanitizer that guarantees the expected shape.
const RECUR_FREQ_SAFE = ["Monthly", "Weekly", "Yearly"];

// ── CARD CHROME ─────────────────────────────────────────────────────────────
// Retro cards share one visual language: thick ink outline, hard offset
// shadow, square corners. Derived in one place so a card looks the same
// wherever it is rendered.
const RETRO_SHADOW = "4px 4px 0px 0px rgba(14,28,84,1)";
function cardChrome(isRetro, border) {
  return {
    width:  isRetro ? "2.5px" : "1px",
    border: `${isRetro ? "2.5px" : "1px"} solid ${border}`,
    shadow: isRetro ? RETRO_SHADOW : "none",
    radius: isRetro ? 0 : 16,
  };
}

function asArray(v)  { return Array.isArray(v) ? v : []; }
function asObject(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function asNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function asFreq(v)   { return RECUR_FREQ_SAFE.includes(v) ? v : "Monthly"; }

function sanitizeStreak(raw) {
  const o = asObject(raw);
  const dates = asArray(o.loggedDates).filter(d => typeof d === "string");
  return {
    count: Math.max(0, asNumber(o.count, 0)),
    lastDate: typeof o.lastDate === "string" ? o.lastDate : null,
    loggedDates: [...new Set(dates)].sort(),
    longestStreak: Math.max(0, asNumber(o.longestStreak, 0)),
  };
}
function sanitizeExpenses(raw) {
  return asArray(raw)
    .filter(e => e && typeof e === "object" && typeof e.date === "string")
    .map(e => ({
      ...e,
      id: e.id != null ? e.id : uid(),
      amount: Math.max(0, asNumber(e.amount, 0)),
      category: typeof e.category === "string" ? e.category : "Others",
      note: typeof e.note === "string" ? e.note : "",
      paySource: typeof e.paySource === "string" ? e.paySource : "bank",
    }));
}
function sanitizeBanks(raw) {
  const list = asArray(raw)
    .filter(b => b && typeof b === "object" && b.id != null)
    .map(b => ({
      id: b.id,
      name: typeof b.name === "string" && b.name.trim() ? b.name : "Bank",
      balance: Math.max(0, asNumber(b.balance, 0)),
      isDefault: !!b.isDefault,
    }));
  if (list.length === 0) return [{ id: 1, name: "Primary Bank", balance: 0, isDefault: true }];
  if (!list.some(b => b.isDefault)) list[0] = { ...list[0], isDefault: true };
  return list;
}
function sanitizePot(raw, defaults) {
  const o = asObject(raw);
  return {
    ...defaults, ...o,
    usableCash:  Math.max(0, asNumber(o.usableCash, 0)),
    savings:     Math.max(0, asNumber(o.savings, 0)),
    investments: Math.max(0, asNumber(o.investments, 0)),
    goldGrams:   Math.max(0, asNumber(o.goldGrams, 0)),
    goldRate:    Math.max(0, asNumber(o.goldRate, 0)),
    incomes: asArray(o.incomes).filter(i => i && typeof i === "object").map(i => ({
      id: i.id != null ? i.id : uid(),
      label: typeof i.label === "string" ? i.label : "Income",
      amount: Math.max(0, asNumber(i.amount, 0)),
      frequency: asFreq(i.frequency),
      active: i.active !== false,
    })),
    extras: asArray(o.extras)
      .filter(e => e && typeof e === "object" && typeof e.date === "string")
      .map(e => ({ ...e, id: e.id != null ? e.id : uid(), amount: Math.max(0, asNumber(e.amount, 0)) })),
  };
}
function sanitizeEmis(raw) {
  return asArray(raw).filter(l => l && typeof l === "object").map(l => ({
    ...l,
    id: l.id != null ? l.id : uid(),
    name: typeof l.name === "string" ? l.name : "Loan",
    principal: Math.max(0, asNumber(l.principal, 0)),
    rate: Math.max(0, asNumber(l.rate, 0)),
    tenure: Math.max(1, Math.round(asNumber(l.tenure, 1))),
    emi: Math.max(0, asNumber(l.emi, 0)),
    dueDay: Math.max(1, Math.min(28, Math.round(asNumber(l.dueDay, 5)))),
    paidMonths: [...new Set(asArray(l.paidMonths).filter(m => typeof m === "string"))],
  }));
}
function sanitizeRecurring(raw) {
  return asArray(raw).filter(r => r && typeof r === "object").map(r => ({
    ...r,
    id: r.id != null ? r.id : uid(),
    name: typeof r.name === "string" ? r.name : "Bill",
    amount: Math.max(0, asNumber(r.amount, 0)),
    frequency: asFreq(r.frequency),
    paid: asArray(r.paid).filter(d => typeof d === "string"),
  }));
}
function sanitizeCategories(raw, paletteLen) {
  let list = asArray(raw);
  if (list.length > 0 && typeof list[0] === "string") {
    list = list.map((name, i) => ({ name, colorIdx: i % paletteLen }));
  }
  const seen = new Set();
  return list
    .filter(c => c && typeof c === "object" && typeof c.name === "string" && c.name.trim())
    .map((c, i) => ({
      name: c.name,
      colorIdx: Number.isFinite(Number(c.colorIdx)) ? Number(c.colorIdx) : i % paletteLen,
      excludeFromBudget: !!c.excludeFromBudget,
    }))
    .filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}
function sanitizeGoals(raw) {
  return asArray(raw).filter(g => g && typeof g === "object").map(g => ({
    ...g,
    id: g.id != null ? g.id : uid(),
    name: typeof g.name === "string" ? g.name : "Goal",
    target: Math.max(0, asNumber(g.target, 0)),
    // `saved` is money actually set aside for this specific goal. Goals created
    // before this existed measured progress against the shared savings pot, so
    // they start from zero.
    saved: Math.max(0, asNumber(g.saved, 0)),
    contributions: asArray(g.contributions)
      .filter(c => c && typeof c === "object" && typeof c.date === "string")
      .map(c => ({
        id: c.id != null ? c.id : uid(),
        amount: asNumber(c.amount, 0),
        date: c.date,
        source: typeof c.source === "string" ? c.source : "bank",
      }))
      .slice(-50),
  }));
}

// Total money parked across every goal. Savings can never drop below this
// without releasing a goal first.
function totalAllocated(goals) {
  return asArray(goals).reduce((sum, g) => sum + (Number(g.saved) || 0), 0);
}

// How much to put aside per week/month to land a dated goal on time.
function goalPacing(goal, todayStr) {
  const remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  if (!goal.deadline || remaining === 0) return null;
  const days = Math.round((new Date(goal.deadline + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
  if (days <= 0) return { days, overdue: true, remaining, perWeek: remaining, perMonth: remaining };
  return {
    days,
    overdue: false,
    remaining,
    perWeek: Math.ceil(remaining / Math.max(1, days / 7)),
    perMonth: Math.ceil(remaining / Math.max(1, days / 30)),
  };
}

const _saveTimers = {};

function storageSetDebounced(key, value, delay = 300) {
  clearTimeout(_saveTimers[key]);
  _saveTimers[key] = setTimeout(() => storageSet(key, value), delay);
}

// ════════════════════════════════════════════════════════════════════════════
// DATE UTILS - all IST-aware
// ════════════════════════════════════════════════════════════════════════════
const TZ = "Asia/Kolkata";
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// FIX: the old version did `new Date(new Date().toLocaleString(...))`. That
// round-trips through a locale string whose exact format is not stable across
// ICU versions - ICU 72 switched the AM/PM separator to U+202F, which broke
// `new Date(...)` parsing in several browsers - and it silently discarded
// milliseconds. formatToParts produces the same wall-clock shift with no
// string parsing at all.
const _istFmt = (() => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return null; }
})();

function nowIST() {
  if (!_istFmt) return new Date();
  const p = {};
  for (const { type, value } of _istFmt.formatToParts(new Date())) p[type] = value;
  return new Date(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second), 0
  );
}

// Format a Date's local fields as YYYY-MM-DD.
// FIX: several call sites used `d.toISOString().slice(0,10)` / `.slice(0,7)`,
// which converts to UTC first. For a user in IST (UTC+5:30), local midnight is
// 18:30 the *previous* day in UTC, so day-1 dates silently landed in the
// previous month. Every date key now goes through these helpers.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function ym(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function getTodayIST() { return ymd(nowIST()); }
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
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function daysFromToday(dateStr) {
  const ist = nowIST(); ist.setHours(0,0,0,0);
  return Math.round((new Date(dateStr + "T00:00:00") - ist) / 86400000);
}
function getLastNDays(n) {
  const ist = nowIST();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ist);
    d.setDate(d.getDate() - (n - 1 - i));
    return ymd(d);
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
  return ymd(d);
}
function isInCurrentMonth(dateStr) {
  const ist = nowIST();
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === ist.getFullYear() && d.getMonth() === ist.getMonth();
}

// ════════════════════════════════════════════════════════════════════════════
// STREAK - fixed: past-date logging no longer resets streak
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_STREAK = { count: 0, lastDate: null, loggedDates: [], longestStreak: 0 };

function updateStreak(prev, dateStr) {
  const prevDates = Array.isArray(prev.loggedDates) ? prev.loggedDates : [];
  if (prevDates.includes(dateStr)) return prev;              // idempotent
  // FIX: the old cap was `[...loggedDates, dateStr].slice(-90)`, which trims by
  // *insertion* order. Backfilling an old date appended it to the end, so the
  // cap could drop the most recent days instead of the oldest ones.
  const loggedDates = [...new Set([...prevDates, dateStr])].sort().slice(-90);

  if (!prev.lastDate) {
    return { count: 1, lastDate: dateStr, loggedDates, longestStreak: 1 };
  }

  const diff = daysBetween(prev.lastDate, dateStr);

  if (diff < 0) {
    // Past date - record it but DON'T move lastDate forward.
    // FIX: backfilling a missed day used to leave `count` untouched, so
    // repairing a gap did nothing. Recompute the unbroken run ending at
    // lastDate instead.
    const set = new Set(loggedDates);
    const cursor = new Date(prev.lastDate + "T00:00:00");
    let run = 0;
    while (run < 90 && set.has(ymd(cursor))) { run++; cursor.setDate(cursor.getDate() - 1); }
    const count = Math.max(prev.count || 0, run);
    return { ...prev, loggedDates, count, longestStreak: Math.max(prev.longestStreak || 0, count) };
  }
  if (diff === 0) return prev;  // Same day - idempotent (already handled above)

  const count = diff === 1 ? prev.count + 1 : 1;
  const longestStreak = Math.max(prev.longestStreak || 0, count);
  return { count, lastDate: dateStr, loggedDates, longestStreak };
}

// ════════════════════════════════════════════════════════════════════════════
// FINANCE UTILS
// ════════════════════════════════════════════════════════════════════════════
const MAX_AMOUNT = 10000000;
const MAX_TENURE = 600;

function isValidAmount(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT;
}
function calcEMI(principal, annualRate, tenureMonths) {
  // FIX: tenure 0 divided by zero and non-numeric input produced NaN/Infinity,
  // which then poisoned every total that touched it.
  const p = Number(principal), rate = Number(annualRate), t = Math.floor(Number(tenureMonths));
  if (!Number.isFinite(p) || !Number.isFinite(rate) || !Number.isFinite(t) || t <= 0 || p <= 0) return 0;
  if (rate === 0) return p / t;
  const r = rate / 12 / 100;
  const pow = Math.pow(1 + r, t);
  if (!Number.isFinite(pow) || pow === 1) return p / t;
  return (p * r * pow) / (pow - 1);
}
function buildAmortization(principal, annualRate, tenureMonths) {
  const t = Math.max(0, Math.min(Math.floor(Number(tenureMonths)) || 0, MAX_TENURE));
  if (t === 0 || !(Number(principal) > 0)) return [];
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
  const n = Number(amount) || 0;
  // FIX: a month is 52/12 weeks, not 4. The old `* 4` under-counted every
  // weekly recurring bill by 7.7% in all projections.
  if (frequency === "Weekly") return Math.round(n * 52 / 12);
  if (frequency === "Yearly") return Math.round(n / 12);
  return n;
}

// FIX: budget now uses only current-month spending, excluding gift/transfer categories
function computeMonthlyTotal(expenses, excludedCategories = []) {
  return expenses
    .filter(e => isInCurrentMonth(e.date) && !excludedCategories.includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
}

// ── STREAK RANK ─────────────────────────────────────────────────────────────
// The per-scene rank ladders (space / marina / F1 / volcano / DBZ) went away
// with the scene picker. One neutral ladder now.
function getStreakRank(count) {
  if (count === 0) return { title: "Not started", color: "#6b7280" };
  if (count < 7)   return { title: "Starting out", color: "#3b82f6" };
  if (count < 14)  return { title: "Building",     color: "#06b6d4" };
  if (count < 30)  return { title: "Consistent",   color: "#8b5cf6" };
  if (count < 60)  return { title: "On a roll",    color: "#f59e0b" };
  if (count < 100) return { title: "Dedicated",    color: "#ef4444" };
  return              { title: "Unstoppable",      color: "#ec4899" };
}

// ── STREAK CARD ─────────────────────────────────────────────────────────────
// Replaces the old PlanetHopperGame: a ~2,900-line animated canvas scene with
// planets, yachts, volcanoes and a DBZ backdrop, plus ~4.6 MB of inlined
// images. This is a plain card that follows the app's existing retro/normal
// styling and shows the same information: streak count, rank, the last 14
// days, and the log / freeze actions.
function StreakCard({ streak, todayLogged, last14, freezeData, dark, isRetro, accent, cardBg, border, textMain, textMute, subbg, cardStyle, onLog, onFreeze }) {
  const rank = getStreakRank(streak.count);
  const longest = Math.max(streak.longestStreak || 0, streak.count || 0);
  const logged = new Set(streak.loggedDates || []);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div style={{ ...cardStyle, padding: 18, marginBottom: 0 }}>
      {/* Count + rank */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: textMute }}>
            Logging streak
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: "'DM Mono',monospace", color: textMain, letterSpacing: "-1.5px" }}>
              {streak.count}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: textMute }}>
              {streak.count === 1 ? "day" : "days"}
            </span>
          </div>
          <span style={{
            display: "inline-block", marginTop: 8, padding: "3px 10px",
            borderRadius: isRetro ? 0 : 999,
            border: isRetro ? `2px solid ${RETRO_THEME.border}` : `1px solid ${rank.color}55`,
            background: isRetro ? RETRO_THEME.subbg : `${rank.color}18`,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            color: isRetro ? RETRO_THEME.textMain : rank.color,
          }}>
            {rank.title}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: textMute, fontWeight: 500 }}>Best</p>
          <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: textMain }}>
            {longest}
          </p>
        </div>
      </div>

      {/* Last 14 days */}
      <div style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, color: textMute, fontWeight: 500 }}>Last 14 days</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(14,1fr)", gap: 4 }}>
          {last14.map(d => {
            const on = logged.has(d);
            const isToday = d === last14[last14.length - 1];
            const dow = new Date(d + "T00:00:00").getDay();
            return (
              <div key={d} title={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{
                  width: "100%", aspectRatio: "1 / 1",
                  borderRadius: isRetro ? 0 : 5,
                  background: on ? accent : (isRetro ? "#ffffff" : subbg),
                  border: isRetro
                    ? `2px solid ${RETRO_THEME.border}`
                    : isToday ? `1.5px solid ${accent}` : `1px solid ${border}`,
                }}/>
                <span style={{ fontSize: 8, color: textMute, lineHeight: 1 }}>{dayLabels[dow]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onLog} disabled={todayLogged}
          style={{
            flex: 1, padding: "11px 14px",
            borderRadius: isRetro ? 0 : 12,
            border: isRetro ? `2.5px solid ${RETRO_THEME.border}` : "none",
            background: todayLogged ? (isRetro ? RETRO_THEME.subbg : subbg) : accent,
            color: todayLogged ? textMute : (isRetro ? RETRO_THEME.border : "#fff"),
            fontSize: 14, fontWeight: isRetro ? 800 : 700,
            cursor: todayLogged ? "default" : "pointer",
            boxShadow: isRetro && !todayLogged ? "3px 3px 0px 0px rgba(14,28,84,1)" : "none",
          }}>
          {todayLogged ? "Logged today ✓" : "Log a no-spend day"}
        </button>
        <button onClick={onFreeze} disabled={freezeData.available <= 0 || todayLogged}
          title={`${freezeData.available} freeze token${freezeData.available !== 1 ? "s" : ""} available`}
          style={{
            padding: "11px 14px",
            borderRadius: isRetro ? 0 : 12,
            border: isRetro ? `2.5px solid ${RETRO_THEME.border}` : `1px solid ${border}`,
            background: isRetro ? "#ffffff" : subbg,
            color: freezeData.available > 0 && !todayLogged ? textMain : textMute,
            fontSize: 13, fontWeight: isRetro ? 800 : 600,
            cursor: freezeData.available > 0 && !todayLogged ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
          🛡️ <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{freezeData.available}/{freezeData.earned}</span>
        </button>
      </div>
    </div>
  );
}

// Freeze token - 1 earned per 7 days elapsed in the month
// On month boundary reset: usedThisMonth resets to 0, re-earn starts fresh
function getFreezeData(shieldState) {
  const ist = nowIST();
  const currentMonth = `${ist.getFullYear()}-${String(ist.getMonth()+1).padStart(2,"0")}`;
  const dayOfMonth = ist.getDate(); // 1-based
  // Tokens earned = floor of (dayOfMonth-1)/7  → 1 at day 7, 2 at day 14, 3 at day 21, 4 at day 28
  const earned = Math.floor((dayOfMonth - 1) / 7);
  // Reset if we're in a new month
  const usedThisMonth = shieldState.lastResetMonth === currentMonth ? (shieldState.usedThisMonth || 0) : 0;
  const available = Math.max(0, earned - usedThisMonth);
  return { earned, usedThisMonth, available, currentMonth };
}

// ── EMI DUE DATE REMINDERS ────────────────────────────────────────────────
// Returns reminder objects (same shape as recurring reminders) for loans
// whose next due date is within 3 days (or overdue).
function getEmiNextDueDate(loan, today) {
  // FIX: this used `d.toISOString().slice(0,7)` to build the month key, but
  // toISOString converts to UTC first. For an IST user with dueDay = 1, local
  // midnight on the 1st is 18:30 on the last day of the *previous* month in
  // UTC, so the key came out one month early and never matched the keys
  // written by payEmi (which uses `today.slice(0,7)`). Paid EMIs kept showing
  // as unpaid forever. ym() reads the local fields directly.
  // FIX: `today` was accepted but ignored, so this drifted out of sync with
  // the rest of the app on a midnight rollover.
  const base = today ? new Date(today + "T00:00:00") : nowIST();
  base.setHours(0, 0, 0, 0);
  const dd = Math.max(1, Math.min(28, Number(loan.dueDay) || 5));
  const d = new Date(base.getFullYear(), base.getMonth(), dd);
  if ((loan.paidMonths || []).includes(ym(d))) {
    // This month is settled - next instalment is next month
    d.setMonth(d.getMonth() + 1);
  }
  // Otherwise leave it: if the due day has already passed it is overdue,
  // and an overdue instalment should keep showing until it is paid.
  return ymd(d);
}
function getEmiReminders(emis, today, dismissedMap) {
  return emis
    .map(loan => {
      const remaining = Number(loan.tenure) - (loan.paidMonths || []).length;
      if (!(remaining > 0)) return null;                       // fully paid off
      const dueDateStr_raw = getEmiNextDueDate(loan, today);
      const days = daysFromToday(dueDateStr_raw);
      if (days > 3) return null;                               // not due soon
      if (dismissedMap && dismissedMap[`emi-${loan.id}`] === today) return null;
      return {
        id: `emi-${loan.id}`,
        name: `${loan.name} EMI`,
        amount: loan.emi,
        daysUntil: days,
        dueDateStr: formatDate(dueDateStr_raw),
        category: "Bills",
        isEmi: true,
        loanId: loan.id,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil);
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
// FIX: the old bank branch of these helpers wrote `pot.usableBank`, but
// `usableTotal` is computed from the `banks` array - nothing ever reads
// `pot.usableBank`. Bank movement is handled exclusively by deductBank /
// refundBank now, so these are cash-only and the dead field is gone.
function deductPot(pot, source, amount) {
  if (source !== "cash") return pot;
  return { ...pot, usableCash: Math.max(0, (Number(pot.usableCash)||0) - (Number(amount)||0)) };
}
function refundPot(pot, source, amount) {
  if (source !== "cash") return pot;
  return { ...pot, usableCash: (Number(pot.usableCash)||0) + (Number(amount)||0) };
}
// Resolve which bank object is active given paySource and banks list
function resolveBank(paySource, banks) {
  if (!paySource || paySource === "cash") return null;
  const id = paySource.startsWith("bank:") ? paySource.slice(5) : null;
  if (!id) return banks[0] || null;
  return banks.find(b => String(b.id) === id) || banks[0] || null;
}
// FIX: these used to map over `banks` and, if the id in paySource no longer
// existed (its account had been deleted), silently match nothing - the expense
// was recorded but no balance ever moved, and refunds vanished. They now fall
// back to the default account so money is never lost.
function bankIndexFor(banks, paySource) {
  if (!paySource || paySource === "cash") return -1;
  const id = paySource.startsWith("bank:") ? paySource.slice(5) : null;
  let idx = id ? banks.findIndex(b => String(b.id) === id) : -1;
  if (idx === -1) idx = banks.findIndex(b => b.isDefault);
  if (idx === -1 && banks.length > 0) idx = 0;
  return idx;
}
function applyToBank(banks, paySource, delta, clampAtZero) {
  const idx = bankIndexFor(banks, paySource);
  if (idx === -1) return banks;
  return banks.map((b, i) => {
    if (i !== idx) return b;
    const next = (Number(b.balance)||0) + delta;
    return { ...b, balance: clampAtZero ? Math.max(0, next) : next };
  });
}
function deductBank(banks, paySource, amount) {
  return applyToBank(banks, paySource, -(Number(amount)||0), true);
}
function refundBank(banks, paySource, amount) {
  return applyToBank(banks, paySource, (Number(amount)||0), false);
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
// The 20-hue accent palette and the scene picker were removed along with the
// canvas streak game. The accent is now derived from the retro / normal theme
// toggle alone - "Sky" was the app's default hue, so it stays as the classic
// accent.
const ACCENT_CLASSIC = { light: "#0369a1", dark: "#38bdf8" };
// Optional full theme (background + surfaces + accent) — matches the reference
// icon: white/cream base, bold
// retro-ink outlines, teal chrome bars, orange as the primary accent, yellow
// as a secondary highlight.
const RETRO_THEME = {
  bg:          "#f4f1e6",
  cardBg:      "#ffffff",
  border:      "#0e1c54",
  textMain:    "#0e1c54",
  textMute:    "#5b6690",
  inputBg:     "#ffffff",
  inputBorder: "#0e1c54",
  subbg:       "#eef0fa",
  teal:        "#5cc9c6",
  orange:      "#f2a25e",
  yellow:      "#f6da6e",
};
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
// Category colours used only when the Retro theme is active — light tints in
// the teal/orange/yellow/retro family so chips stay on-palette on the white cards.
const RETRO_CAT_PALETTE = [
  { bg:"#e0f5f3", text:"#0f7a72" },
  { bg:"#fdebd8", text:"#c2680f" },
  { bg:"#fdf3d0", text:"#9c7a12" },
  { bg:"#e5e9f7", text:"#1c2f6e" },
  { bg:"#daf3ef", text:"#127a6e" },
  { bg:"#ffe4cf", text:"#c2450f" },
  { bg:"#fff2c4", text:"#8a6b1f" },
  { bg:"#dff0f7", text:"#0e7490" },
  { bg:"#e1f7ea", text:"#0f7a4a" },
  { bg:"#ffe3da", text:"#c2451f" },
  { bg:"#e8eaf8", text:"#33418a" },
  { bg:"#f7f0dc", text:"#8a6b1f" },
];
const DEFAULT_CATEGORIES = [
  {name:"Food",colorIdx:0},{name:"Groceries",colorIdx:1},{name:"Travel",colorIdx:2},
  {name:"Shopping",colorIdx:3},{name:"Bills",colorIdx:4},{name:"Entertainment",colorIdx:5},
  {name:"Others",colorIdx:6},
];
const DEFAULT_POT = {
  usableCash:0,usableBank:0,savings:0,investments:0,gold:0,
  goldGrams:0,goldRate:0,goldRateUpdatedOn:null,
  incomes:[{id:1,label:"Salary",amount:0,frequency:"Monthly",active:true}],
  extras:[],
};
const RECUR_FREQ = ["Monthly","Weekly","Yearly"];
const AVATAR_COLORS = ["#4f46e5","#7c3aed","#db2777","#059669","#d97706","#dc2626","#0891b2"];
const RETRO_AVATAR_COLORS = ["#f2a25e","#5cc9c6","#f6da6e","#7ec9e8","#f28b6b","#8fd9c4","#e0c088"];
const AVATAR_OPTIONS = [
  { id:"initials", label:"Initials", emoji:null },
  { id:"😊", label:"😊", emoji:"😊" },
  { id:"😎", label:"😎", emoji:"😎" },
  { id:"🤑", label:"🤑", emoji:"🤑" },
  { id:"🦁", label:"🦁", emoji:"🦁" },
  { id:"🐯", label:"🐯", emoji:"🐯" },
  { id:"🦊", label:"🦊", emoji:"🦊" },
  { id:"🐼", label:"🐼", emoji:"🐼" },
  { id:"🐸", label:"🐸", emoji:"🐸" },
  { id:"🦄", label:"🦄", emoji:"🦄" },
  { id:"🐲", label:"🐲", emoji:"🐲" },
  { id:"🚀", label:"🚀", emoji:"🚀" },
  { id:"⚡", label:"⚡", emoji:"⚡" },
  { id:"🔥", label:"🔥", emoji:"🔥" },
  { id:"💎", label:"💎", emoji:"💎" },
  { id:"👑", label:"👑", emoji:"👑" },
  { id:"🎯", label:"🎯", emoji:"🎯" },
  { id:"🏎️", label:"🏎️", emoji:"🏎️" },
];

function avatarColor(name, retro) {
  const palette = retro ? RETRO_AVATAR_COLORS : AVATAR_COLORS;
  if (!name) return palette[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
  return palette[h];
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
function haptic(pattern = 10) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); }
  catch { /* vibration unsupported or blocked by the platform - not fatal */ }
}

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
// ════════════════════════════════════════════════════════════════════════════
// PIN HASHING + LOCKOUT
// ════════════════════════════════════════════════════════════════════════════
// FIX: the PIN used to be stored as plain text ("1234") in localStorage, and
// there was no limit on attempts - a 4-digit code with unlimited guesses at
// ~120ms each is trivially scriptable. It is now stored as a salted SHA-256
// digest, and failed attempts trigger an escalating lockout.
// (This still cannot protect data from someone with devtools access, since
// localStorage is readable regardless. It raises the bar for a shared or lost
// device, which is the realistic threat here.)
const PIN_LOCK_KEY = "myspendr_pin_lock_v1";
const PIN_MAX_ATTEMPTS = 5;

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToB64(digest);
}
async function setPin(pin) {
  const salt = bufToB64(crypto.getRandomValues(new Uint8Array(16)));
  storageSet(KEYS.PIN, { v: 2, salt, hash: await hashPin(pin, salt) });
  storageRemove(PIN_LOCK_KEY);
}
async function verifyPin(pin) {
  const stored = storageGet(KEYS.PIN, null);
  if (!stored) return false;
  // Legacy plain-text PIN from an older build - accept once, then upgrade.
  if (typeof stored === "string") {
    if (stored !== pin) return false;
    await setPin(pin);
    return true;
  }
  if (!stored.salt || !stored.hash) return false;
  const candidate = await hashPin(pin, stored.salt);
  // Constant-time-ish compare; both strings are the same length by construction.
  if (candidate.length !== stored.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}
function hasStoredPin() {
  const s = storageGet(KEYS.PIN, null);
  if (!s) return false;
  return typeof s === "string" ? s.length === 4 : !!(s.salt && s.hash);
}
function getPinLock() {
  const l = storageGet(PIN_LOCK_KEY, { fails: 0, until: 0 });
  return { fails: Number(l.fails) || 0, until: Number(l.until) || 0 };
}
function recordPinFailure() {
  const { fails } = getPinLock();
  const next = fails + 1;
  // 5 free attempts, then 30s, 1m, 2m, 4m... capped at 15 minutes.
  const over = next - PIN_MAX_ATTEMPTS;
  const until = over > 0
    ? Date.now() + Math.min(15 * 60 * 1000, 30 * 1000 * Math.pow(2, over - 1))
    : 0;
  storageSet(PIN_LOCK_KEY, { fails: next, until });
  return { fails: next, until };
}
function clearPinLock() { storageRemove(PIN_LOCK_KEY); }

async function isBiometricAvailable() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try { return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
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
  // FIX: navigator.credentials.create can resolve with null; reading
  // cred.rawId then threw a TypeError instead of surfacing a clean failure.
  if (!cred || !cred.rawId) throw new Error("no-cred");
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
// ════════════════════════════════════════════════════════════════════════════
// ICONS
// ════════════════════════════════════════════════════════════════════════════
const SunIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const EyeIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.94 4.24M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
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
const UsersIcon  = ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
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

function ConfettiBurst({ active, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: canvas.width / 2, y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 14,
      color: ["#f97316","#fbbf24","#34d399","#818cf8","#f472b6","#60a5fa"][Math.floor(Math.random()*6)],
      size: 6 + Math.random() * 8, life: 1, decay: 0.012 + Math.random()*0.01,
    }));
    let rafId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life -= p.decay;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (particles.some(p => p.life > 0)) rafId = requestAnimationFrame(draw);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); onDone?.(); }
    }
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [active]);
  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position:"fixed",inset:0,zIndex:9999,pointerEvents:"none" }}/>;
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

function SourcePill({ value, onChange, dark, subbg, border, textMute, banks, isRetro }) {
  const { border: cardBorder } = cardChrome(isRetro, border);
  const bankList = (banks||[]).length > 0 ? banks : [{ id:"bank", name:"Bank", isDefault:true }];
  const options = [
    ...bankList.map(b => ({ v:`bank:${b.id}`, label:b.name, color:"#2563eb", icon:<BankIcon/> })),
    { v:"cash", label:"Cash", color:"#16a34a", icon:<CashIcon/> },
  ];
  const normalised = value === "bank"
    ? `bank:${(bankList.find(b=>b.isDefault)||bankList[0]).id}`
    : value;
  return (
    <div style={{ display:"flex",gap:3,background:subbg,borderRadius:10,padding:3,border:cardBorder,flexWrap:"wrap" }}>
      {options.map(({ v, label, color, icon }) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ flex:"1 1 auto",display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
            background:normalised===v?color:"transparent",color:normalised===v?"#fff":textMute,transition:"all 0.15s",minWidth:64 }}>
          {icon}{label}
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
// CATEGORY HELPERS - extracted so they're not recomputed inside render
// ════════════════════════════════════════════════════════════════════════════
function useCategoryHelpers(categories, dark, retro) {
  const getCatObj = useCallback((name) =>
    categories.find(c => c.name === name) || { name, colorIdx: 0 },
  [categories]);

  const getCatStyle = useCallback((name) => {
    const cat = getCatObj(name);
    if (retro) { const p = RETRO_CAT_PALETTE[cat.colorIdx % RETRO_CAT_PALETTE.length]; return { background:p.bg, color:p.text }; }
    const p = CAT_PALETTE[cat.colorIdx % CAT_PALETTE.length];
    return dark ? { background: p.darkBg, color: p.darkText } : { background: p.bg, color: p.text };
  }, [getCatObj, dark, retro]);

  const getCatAccent = useCallback((name) => {
    const cat = getCatObj(name);
    if (retro) { return RETRO_CAT_PALETTE[cat.colorIdx % RETRO_CAT_PALETTE.length].text; }
    const p = CAT_PALETTE[cat.colorIdx % CAT_PALETTE.length];
    return dark ? p.darkText : p.text;
  }, [getCatObj, dark, retro]);

  return { getCatStyle, getCatAccent };
}

// ════════════════════════════════════════════════════════════════════════════
// PIN LOCK
// ════════════════════════════════════════════════════════════════════════════
function PinLock({ onUnlock, dark, accent, isRetro, userName }) {
  const safeAccent = accent || (isRetro ? RETRO_THEME.orange : "#4f46e5");
  const hasPin = hasStoredPin();
  const hasCred = !!loadBioCred();
  const [mode, setMode] = useState(hasPin ? "enter" : "setup");
  const [digits, setDigits] = useState([]);
  const [tempPin, setTempPin] = useState("");
  const [shake, setShake] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [bioError, setBioError] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [offerBioSetup, setOfferBioSetup] = useState(false);
  const [lockUntil, setLockUntil] = useState(() => getPinLock().until);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const didAttemptBio = useRef(false);
  // FIX: the auto-submit setTimeout was never cleared, so unmounting mid-entry
  // fired a state update on a dead component.
  const submitTimer = useRef(null);
  const shakeTimer = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
    clearTimeout(submitTimer.current);
    clearTimeout(shakeTimer.current);
  }, []);

  const lockedOut = lockUntil > nowTs;
  const lockSecondsLeft = lockedOut ? Math.ceil((lockUntil - nowTs) / 1000) : 0;

  // Tick only while a lockout is actually counting down.
  useEffect(() => {
    if (!lockedOut) return;
    const t = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedOut]);

  useEffect(() => { isBiometricAvailable().then(v => { if (alive.current) setBioAvail(v); }); }, []);
  useEffect(() => {
    if (mode === "enter" && bioAvail && hasCred && !didAttemptBio.current) {
      didAttemptBio.current = true; tryVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bioAvail, hasCred]);

  async function tryVerify() {
    setBioError(""); setBioLoading(true);
    try { await verifyBiometric(); onUnlock(); }
    catch (e) {
      if (e.message === "no-cred") setBioError("No biometric registered - use PIN");
      else if (e.name === "NotAllowedError") setBioError("");
      else setBioError("Biometric failed - use PIN");
    } finally { setBioLoading(false); }
  }
  async function tryRegister() {
    setBioError(""); setBioLoading(true);
    try { await registerBiometric(); setOfferBioSetup(false); onUnlock(); }
    catch { setOfferBioSetup(false); onUnlock(); }
    finally { setBioLoading(false); }
  }
  function press(d) {
    if (lockedOut || digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      clearTimeout(submitTimer.current);
      submitTimer.current = setTimeout(() => submit(next), 120);
    }
  }
  function del() { setDigits(p => p.slice(0, -1)); }
  function reject() {
    if (!alive.current) return;
    setShake(true); setDigits([]);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => { if (alive.current) setShake(false); }, 500);
  }
  async function submit(entered) {
    const pin = entered.join("");
    if (mode === "setup") { setTempPin(pin); setDigits([]); setMode("confirm"); return; }
    if (mode === "confirm") {
      if (pin !== tempPin) { setBioError("PINs didn't match - start again"); setTempPin(""); setMode("setup"); reject(); return; }
      // FIX: was storageSet(KEYS.PIN, pin) - plain text on disk.
      await setPin(pin);
      if (!alive.current) return;
      setBioError("");
      if (bioAvail && !loadBioCred()) setOfferBioSetup(true);
      else onUnlock();
      return;
    }
    if (lockedOut) return;
    const ok = await verifyPin(pin);
    if (!alive.current) return;
    if (ok) { clearPinLock(); setLockUntil(0); setBioError(""); onUnlock(); return; }
    const { fails, until } = recordPinFailure();
    setLockUntil(until); setNowTs(Date.now());
    const left = PIN_MAX_ATTEMPTS - fails;
    setBioError(until > Date.now() ? "" : left > 0 && left <= 2 ? `${left} attempt${left === 1 ? "" : "s"} left` : "");
    reject();
  }

  const bg       = isRetro ? RETRO_THEME.bg       : dark ? "#030712" : "#f8fafc";
  const card     = isRetro ? RETRO_THEME.cardBg   : dark ? "#111827" : "#ffffff";
  const textMain = isRetro ? RETRO_THEME.textMain : dark ? "#f9fafb" : "#111827";
  const textMute = isRetro ? RETRO_THEME.textMute : dark ? "#6b7280" : "#9ca3af";
  const inkBorder = isRetro ? RETRO_THEME.border : (dark ? "#1f2937" : "#e5e7eb");

  if (offerBioSetup) return (
    <div className={isRetro?"retro-sharp":undefined} style={{ minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&family=Racing+Sans+One&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      {isRetro && <style>{`.retro-sharp, .retro-sharp *, .retro-sharp *::before, .retro-sharp *::after { border-radius:0 !important; } .retro-sharp { font-family:'Space Grotesk','DM Sans',sans-serif !important; } .retro-sharp [style*="monospace"] { font-family:'Space Mono',monospace !important; }`}</style>}
      <div style={{ width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
        <div style={{ fontSize:56 }}>🔑</div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:isRetro?800:700,color:textMain,textAlign:"center",letterSpacing:"-0.5px" }}>Enable Face ID / Fingerprint?</h1>
        <p style={{ margin:"0 0 24px",fontSize:13,color:textMute,textAlign:"center",lineHeight:1.6 }}>Skip the PIN next time and unlock instantly with your device biometrics.</p>
        {bioError && <p style={{ margin:"0 0 8px",fontSize:12,color:"#ef4444",textAlign:"center" }}>{bioError}</p>}
        <button onClick={tryRegister} disabled={bioLoading} style={{ width:"100%",padding:14,border:isRetro?`2.5px solid ${RETRO_THEME.border}`:"none",background:safeAccent,color:isRetro?RETRO_THEME.border:"#fff",fontSize:15,fontWeight:isRetro?800:700,cursor:"pointer",opacity:bioLoading?0.7:1,boxShadow:isRetro?"3px 3px 0px 0px rgba(14,28,84,1)":"none" }}>
          {bioLoading ? "Setting up…" : "Enable Biometrics"}
        </button>
        <button onClick={() => { setOfferBioSetup(false); onUnlock(); }} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,fontSize:13,textDecoration:"underline" }}>Skip for now</button>
      </div>
    </div>
  );

  const firstName = (userName||"").trim().split(" ")[0];
  const title = mode === "setup" ? "Set a PIN" : mode === "confirm" ? "Confirm PIN" : firstName ? `Welcome back, ${firstName}` : "Welcome back";
  const subtitle = mode === "setup" ? "Choose a 4-digit PIN to secure your data"
    : mode === "confirm" ? "Re-enter your PIN to confirm"
    : hasCred ? "Unlock with biometrics or enter your PIN"
    : "Enter your PIN to continue";
  const padDisabled = lockedOut;

  return (
    <div className={isRetro?"retro-sharp":undefined} style={{ minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&family=Racing+Sans+One&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        ${isRetro ? `.retro-sharp, .retro-sharp *, .retro-sharp *::before, .retro-sharp *::after { border-radius:0 !important; } .retro-sharp { font-family:'Space Grotesk','DM Sans',sans-serif !important; } .retro-sharp [style*="monospace"] { font-family:'Space Mono',monospace !important; }` : ``}
      `}</style>
      <div style={{ width:"100%",maxWidth:320,display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
        <div style={{ fontSize:48,marginBottom:4 }}>🔐</div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:isRetro?800:700,color:textMain,letterSpacing:"-0.5px",textAlign:"center" }}>{title}</h1>
        <p style={{ margin:"0 0 28px",fontSize:13,color:textMute,textAlign:"center" }}>{subtitle}</p>
        {lockedOut && (
          <p style={{ margin:"-20px 0 20px",fontSize:13,fontWeight:600,color:"#ef4444",textAlign:"center" }}>
            Too many attempts — try again in {lockSecondsLeft}s
          </p>
        )}
        <div style={{ display:"flex",gap:14,marginBottom:32,animation:shake?"shake 0.4s ease":"none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width:14,height:14,background:digits.length>i?safeAccent:(isRetro?RETRO_THEME.cardBg:dark?"#1f2937":"#e5e7eb"),border:isRetro?`2px solid ${RETRO_THEME.border}`:`2px solid ${digits.length>i?safeAccent:(dark?"#374151":"#d1d5db")}`,transition:"background 0.15s" }} />
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:"100%",maxWidth:280 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
            k === "" ? <div key={i}/> :
            <button key={i} onClick={() => k==="⌫" ? del() : press(k)} disabled={padDisabled}
              style={{ height:64,opacity:padDisabled?0.4:1,border:isRetro?`2px solid ${RETRO_THEME.border}`:`1px solid ${inkBorder}`,background:k==="⌫"?(isRetro?RETRO_THEME.subbg:dark?"#1f2937":"#f3f4f6"):card,color:textMain,fontSize:k==="⌫"?20:22,fontWeight:isRetro?800:600,cursor:"pointer",fontFamily:"'DM Mono',monospace",boxShadow:isRetro?"2px 2px 0px 0px rgba(14,28,84,0.35)":"none" }}>
              {k}
            </button>
          ))}
        </div>
        {mode === "enter" && bioAvail && (
          <button onClick={tryVerify} disabled={bioLoading}
            style={{ marginTop:20,display:"flex",alignItems:"center",gap:8,background:isRetro?"#ffffff":"none",border:isRetro?`2px solid ${RETRO_THEME.border}`:`1px solid ${dark?"#374151":"#e5e7eb"}`,padding:"10px 20px",cursor:"pointer",color:isRetro?RETRO_THEME.textMain:dark?"#9ca3af":"#6b7280",fontSize:13,fontWeight:isRetro?700:500,opacity:bioLoading?0.6:1 }}>
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
function CategoryBubbles({ categories, catTotals, getCatStyle, getCatAccent, onSelect, dark, cardBg, border, textMute, open, setOpen, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
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
        style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:cardBg,border:cardBorder,borderRadius:R_card===0?0:(open?"16px 16px 0 0":16),boxShadow:open?"none":cardShadow,padding:"10px 14px",cursor:"pointer" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827" }}>Categories</span>
          {totalSpent>0 && <span style={{ fontSize:12,color:textMute }}>₹{totalSpent.toLocaleString()} total</span>}
        </div>
        <div style={{ transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s" }}>
          <ChevDown color={textMute}/>
        </div>
      </button>
      {open && (
        <div style={{ background:cardBg,border:cardBorder,borderTop:"none",borderRadius:R_card===0?0:"0 0 16px 16px",padding:"12px 14px 14px",boxShadow:cardShadow }}>
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
                    onClick={() => { onSelect(seg.name); }}
                  />
                ))}
                <text x={CX} y={CY-6} textAnchor="middle" style={{ fontSize:10,fill:textMute,fontFamily:"DM Sans,sans-serif" }}>{displayLabel}</text>
                <text x={CX} y={CY+12} textAnchor="middle" style={{ fontSize:15,fontWeight:700,fill:dark?"#f9fafb":"#111827",fontFamily:"DM Mono,monospace" }}>₹{displayVal.toLocaleString()}</text>
              </svg>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6 }}>
                {segments.map(seg => (
                  <button key={seg.name} onMouseEnter={() => setHovered(seg.name)} onMouseLeave={() => setHovered(null)}
                    onClick={() => { onSelect(seg.name); }}
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
              <button key={cat.name} onClick={() => { onSelect(cat.name); }}
                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 0",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${dark?"#1f2937":"#f3f4f6"}` }}>
                <span style={{ ...cs,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0 }}>{cat.name[0]}</span>
                <div style={{ flex:1,textAlign:"left" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontSize:13,fontWeight:600,color:dark?"#f9fafb":"#111827" }}>{cat.name}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:acc,fontFamily:"'DM Mono',monospace" }}>{spent>0?`₹${spent.toLocaleString()}`:"-"}</span>
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
function SpendingTrendChart({ data, dark, cardBg, border, textMute, textMain, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
  const max = Math.max(...data.map(d => d.total), 1);
  const H=90, BAR_W=32, GAP=8;
  const total6 = data.reduce((s,d) => s+d.total, 0);
  const nonZero = data.filter(d => d.total>0).length;
  const avg6 = nonZero > 0 ? Math.round(total6/nonZero) : 0;
  const current = data[data.length-1]?.total || 0;
  const prev = data[data.length-2]?.total || 0;
  const trend = prev > 0 ? Math.round(((current-prev)/prev)*100) : 0;

  return (
    <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:"14px 16px",marginBottom:12,boxShadow:cardShadow }}>
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
function ExpenseDateList({ grouped, dailyTotal, today, dark, cardBg, border, subbg, textMute, getCatStyle, editExpense, deleteExpense, setDrillCat, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
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
    <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,overflow:"hidden",boxShadow:cardShadow }}>
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
                <span style={{ fontSize:12,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444",background:dark?"rgba(239,68,68,0.1)":"#fff1f2",padding:"1px 8px",borderRadius:99 }}>-₹{daySpend.toLocaleString()}</span>
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
function VoiceLogger({ categories, onAdd, dark, cardBg, border, textMute, textMain, inputBg, inputBorder, accent, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
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
    <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:16,marginBottom:12,boxShadow:cardShadow }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <MicIcon size={18}/><span style={{ fontSize:14,fontWeight:700,color:textMain }}>Voice Log</span>
        <span style={{ fontSize:11,color:textMute,marginLeft:"auto" }}>Say amount + category + note</span>
      </div>
      {!supported && <p style={{ margin:0,fontSize:13,color:"#ef4444" }}>Not supported - use Chrome on Android/iOS</p>}
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
              <p style={{ margin:"0 0 6px",fontSize:12,color:textMute,fontWeight:600 }}>Detected - confirm to add:</p>
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
                <button onClick={reset} style={{ padding:"10px 14px",borderRadius:12,border:cardBorder,background:"none",color:textMute,cursor:"pointer" }}>✕</button>
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
function ReceiptScanner({ categories, onAdd, dark, cardBg, border, textMute, textMain, inputBg, inputBorder, accent, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
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
    <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:16,marginBottom:12,boxShadow:cardShadow }}>
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
          <p style={{ margin:"4px 0 0",fontSize:11,color:textMute }}>This may take 5-10 seconds</p>
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
          {!parsed.amount && <p style={{ margin:"0 0 8px",fontSize:12,color:"#f97316" }}>⚠️ No amount detected - enter manually above</p>}
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={() => { if (parsed?.amount) onAdd(parsed); }} disabled={!parsed.amount}
              style={{ flex:1,padding:"10px",borderRadius:12,border:"none",background:parsed.amount?"#16a34a":"#9ca3af",color:"#fff",fontSize:14,fontWeight:700,cursor:parsed.amount?"pointer":"not-allowed" }}>✓ Add Expense</button>
            <button onClick={reset} style={{ padding:"10px 14px",borderRadius:12,border:cardBorder,background:"none",color:textMute,cursor:"pointer" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EMI TAB
// ════════════════════════════════════════════════════════════════════════════
function EmiTab({ dark, cardBg, border, textMute, textMain, subbg, inputBg, inputBorder, setExpenses, setPot, showToast, today, logDay, accent, emis: emisProp, setEmis: setEmisProp, banks, setBanks, mny, isRetro }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
  const safeAccent = accent || "#4f46e5";
  // FIX: this component used to keep its own copy of the EMI list, seeded from
  // storage, as a fallback - and both it and App persisted to KEYS.EMI on every
  // change. App always passes the props, so the local copy was dead weight and
  // a second writer to the same key. Owned by App now, full stop.
  const emis = emisProp || [];
  const setEmis = setEmisProp;
  const [showForm, setShowForm] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dueDay, setDueDay] = useState("5"); // day-of-month EMI is due

  // Persistence lives in App - see the KEYS.EMI effect there.

  const inputStyle = { background:inputBg,border:`1px solid ${inputBorder}`,color:textMain,borderRadius:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };
  const btnPrimary = { background:safeAccent,color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer" };
  const btnSecondary = { background:dark?"#374151":"#f3f4f6",color:dark?"#d1d5db":"#374151",border:"none",borderRadius:12,padding:"8px 12px",fontSize:13,fontWeight:500,cursor:"pointer" };
  const btnDanger = { background:"none",border:"none",cursor:"pointer",color:textMute,padding:4 };

  function resetForm() { setLoanName(""); setPrincipal(""); setRate(""); setTenure(""); setStartDate(today); setDueDay("5"); setEditId(null); setShowForm(false); }

  function saveEmi() {
    // FIX: the old checks were `p <= 0` / `t <= 0`, which pass for NaN and
    // Infinity (both comparisons are false), and MAX_AMOUNT was never enforced
    // here even though isValidAmount existed for exactly this.
    const p = Number(principal), r = Number(rate), t = Math.floor(Number(tenure));
    if (!loanName.trim()) { showToast("Give the loan a name."); return; }
    if (!isValidAmount(p)) { showToast("Enter a principal between 1 and 1,00,00,000."); return; }
    if (!Number.isFinite(r) || r < 0 || r > 100) { showToast("Enter a rate between 0 and 100%."); return; }
    if (!Number.isFinite(t) || t <= 0 || t > MAX_TENURE) { showToast(`Enter a tenure between 1 and ${MAX_TENURE} months.`); return; }
    const emi = Math.round(calcEMI(p, r, t));
    if (!(emi > 0)) { showToast("Couldn't compute an EMI from those numbers."); return; }
    const dd = Math.max(1,Math.min(28,Number(dueDay)||5));
    const entry = { id:editId||uid(), name:loanName.trim(), principal:p, rate:r, tenure:t, emi, startDate, dueDay:dd, paidMonths:editId?(emis.find(e=>e.id===editId)?.paidMonths||[]):[] };
    if (editId) { setEmis(prev => prev.map(e => e.id===editId?entry:e)); showToast("EMI updated!"); }
    else { setEmis(prev => [...prev, entry]); showToast("EMI loan added!"); }
    resetForm();
  }
  function deleteEmi(id) { setEmis(prev => prev.filter(e => e.id!==id)); showToast("Loan removed."); }
  // FIX: this was a divergent second copy of the EMI payment logic - it had no
  // tenure guard and, unlike the reminder path, couldn't pay from cash, so the
  // same action behaved differently depending on which button you pressed.
  function payEmi(loan, source = "bank") {
    const monthKey = today.slice(0,7);
    if ((loan.paidMonths||[]).includes(monthKey)) { showToast("Already paid this month!"); return; }
    if ((loan.paidMonths||[]).length >= Number(loan.tenure)) { showToast("This loan is already fully repaid."); return; }
    const def = (banks||[]).find(b=>b.isDefault) || (banks||[])[0];
    const src = source === "cash" ? "cash" : (def ? `bank:${def.id}` : "cash");
    setEmis(prev => prev.map(e => e.id!==loan.id?e:{ ...e, paidMonths:[...(e.paidMonths||[]),monthKey] }));
    setExpenses(prev => [...prev, { id:uid(), amount:loan.emi, category:"Bills", note:`${loan.name} EMI`, date:today, paySource:src }]);
    if (src === "cash") { if (setPot) setPot(p => deductPot(p, "cash", loan.emi)); }
    else if (setBanks) setBanks(b => deductBank(b, src, loan.emi));
    logDay(today);
    showToast(`₹${loan.emi.toLocaleString()} EMI logged!`);
  }
  function editEmi(loan) { setEditId(loan.id); setLoanName(loan.name); setPrincipal(loan.principal); setRate(loan.rate); setTenure(loan.tenure); setStartDate(loan.startDate); setDueDay(String(loan.dueDay||5)); setShowForm(true); }

  const totalEmi = emis.reduce((s,e) => s+e.emi, 0);

  return (
    <div style={{ paddingBottom:20 }}>
      {emis.length>0 && (
        <div style={{ background:dark?"linear-gradient(135deg,#172554,#1e1b4b)":"linear-gradient(135deg,#eff6ff,#eef2ff)",border:dark?"1px solid #1e3a8a":"1px solid #bfdbfe",borderRadius:16,padding:16,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:dark?"#93c5fd":"#2563eb" }}>Total EMI / Month</p>
            <p className={mny} style={{ margin:"4px 0 0",fontSize:28,fontWeight:800,fontFamily:"monospace",color:dark?"#93c5fd":"#1d4ed8",letterSpacing:"-1px" }}>₹{totalEmi.toLocaleString()}</p>
          </div>
          <div style={{ fontSize:36 }}>🏦</div>
        </div>
      )}
      {!showForm
        ? <button onClick={() => setShowForm(true)} style={{ ...btnPrimary,width:"100%",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PlusIcon/> Add Loan / EMI</button>
        : <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:16,marginBottom:12,boxShadow:cardShadow }}>
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
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
              <div>
                <p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Due day of month</p>
                <input type="number" inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="5" min="1" max="28" style={inputStyle}/>
                <p style={{ margin:"3px 0 0",fontSize:10,color:textMute }}>Reminder 3 days before</p>
              </div>
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
        <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:40,textAlign:"center",boxShadow:cardShadow }}>
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
          <div key={loan.id} style={{ background:cardBg,border:cardBorder,borderRadius:R_card,marginBottom:10,overflow:"hidden",boxShadow:cardShadow }}>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div>
                  <p style={{ margin:0,fontSize:15,fontWeight:700,color:textMain }}>{loan.name}</p>
                  <p className={mny} style={{ margin:"2px 0 0",fontSize:12,color:textMute }}>₹{loan.principal.toLocaleString()} · {loan.rate}% · {loan.tenure}mo</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p className={mny} style={{ margin:0,fontSize:20,fontWeight:800,color:safeAccent,fontFamily:"monospace" }}>₹{loan.emi.toLocaleString()}<span style={{ fontSize:11,color:textMute,fontWeight:400 }}>/mo</span></p>
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
                <p className={mny} style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{paidPct}% complete · ₹{Math.round(loan.emi*remaining).toLocaleString()} outstanding</p>
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
                      // FIX: was toISOString().slice(0,7), which shifts to UTC
                      // and lands day-1 dates in the previous month for IST.
                      const mk = ym(mKey);
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
function SavingsGoals({ goals, dark, cardBg, border, textMute, textMain, subbg, inputBg, inputBorder, today,
  showGoalForm, setShowGoalForm, goalName, setGoalName, goalTarget, setGoalTarget,
  goalDeadline, setGoalDeadline, goalEditId, setGoalEditId, saveGoal, deleteGoal, editGoal, accent, isRetro,
  banks, usableCash, unallocatedSavings, allocatedToGoals,
  goalFundId, goalFundAmt, setGoalFundAmt, goalFundMode, goalFundSource, setGoalFundSource,
  openGoalFunder, fundGoal, unfundGoal, mny }) {
  const { border: cardBorder, shadow: cardShadow, radius: R_card } = cardChrome(isRetro, border);
  const safeAccent = accent || "#4f46e5";
  const inputStyle = { background:inputBg,border:isRetro?`2.5px solid ${inputBorder}`:`1px solid ${inputBorder}`,color:textMain,borderRadius:isRetro?0:12,padding:"8px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box" };
  const btnPrimary = { background:safeAccent,color:isRetro?RETRO_THEME.border:"#fff",border:isRetro?`2.5px solid ${RETRO_THEME.border}`:"none",borderRadius:isRetro?0:12,padding:"10px 16px",fontSize:14,fontWeight:isRetro?800:600,cursor:"pointer" };
  const btnSecondary = { background:isRetro?"#ffffff":(dark?"#374151":"#f3f4f6"),color:isRetro?RETRO_THEME.textMain:(dark?"#d1d5db":"#374151"),border:isRetro?`2px solid ${RETRO_THEME.border}`:"none",borderRadius:isRetro?0:12,padding:"8px 12px",fontSize:13,fontWeight:isRetro?700:500,cursor:"pointer" };

  const cash = Number(usableCash) || 0;
  const sources = [
    ...(banks || []).map(b => ({ id:`bank:${b.id}`, label:b.name, balance:Number(b.balance)||0 })),
    { id:"cash", label:"Cash", balance:cash },
  ];

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
        <p style={{ margin:0,fontSize:14,fontWeight:700,color:textMain }}>Savings Goals</p>
        {!showGoalForm && (
          <button onClick={() => setShowGoalForm(true)} style={{ ...btnSecondary,fontSize:12,padding:"5px 12px",display:"flex",alignItems:"center",gap:4 }}>
            <PlusIcon/>New
          </button>
        )}
      </div>
      <p className={mny} style={{ margin:"0 0 10px",fontSize:11,color:textMute }}>
        ₹{allocatedToGoals.toLocaleString()} set aside · ₹{unallocatedSavings.toLocaleString()} savings unallocated
      </p>

      {showGoalForm && (
        <div style={{ background:cardBg,border:cardBorder,borderRadius:R_card,padding:14,marginBottom:12,boxShadow:cardShadow }}>
          <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Goal name (e.g. Goa trip, new laptop)" style={{ ...inputStyle,marginBottom:8 }}/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Target (₹)</p><input type="number" inputMode="decimal" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="35000" style={inputStyle}/></div>
            <div><p style={{ margin:"0 0 4px",fontSize:11,color:textMute }}>Need it by (optional)</p><input type="date" value={goalDeadline} min={today} onChange={e => setGoalDeadline(e.target.value)} style={inputStyle}/></div>
          </div>
          <p style={{ margin:"0 0 10px",fontSize:11,color:textMute }}>Add a date and we&rsquo;ll work out what to put aside each week.</p>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={saveGoal} style={{ ...btnPrimary,flex:1 }}>{goalEditId?"Update":"Add Goal"}</button>
            <button onClick={() => { setShowGoalForm(false); setGoalName(""); setGoalTarget(""); setGoalDeadline(""); setGoalEditId(null); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {goals.length===0 && !showGoalForm && (
        <div style={{ background:cardBg,border:isRetro?cardBorder:`1px dashed ${border}`,borderRadius:R_card,padding:"20px 16px",textAlign:"center",boxShadow:cardShadow }}>
          <p style={{ margin:0,fontSize:22 }}>🎯</p>
          <p style={{ margin:"6px 0 2px",fontSize:13,fontWeight:600,color:textMain }}>No goals yet</p>
          <p style={{ margin:0,fontSize:12,color:textMute }}>Planning a trip? Set a target and put money aside for it.</p>
        </div>
      )}

      {goals.map(g => {
        const saved = Number(g.saved) || 0;
        const target = Number(g.target) || 0;
        const pct = target > 0 ? Math.min(100, Math.round((saved/target)*100)) : 0;
        const reached = saved >= target && target > 0;
        const needed = Math.max(0, target - saved);
        const pace = goalPacing(g, today);
        const isOpen = goalFundId === g.id;
        const adding = goalFundMode === "add";

        return (
          <div key={g.id} style={{ background:cardBg,border:isRetro?cardBorder:`1px solid ${reached?(dark?"#065f46":"#bbf7d0"):border}`,borderRadius:R_card,padding:14,marginBottom:10,boxShadow:cardShadow }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                  <p style={{ margin:0,fontSize:14,fontWeight:700,color:textMain }}>{g.name}</p>
                  {reached && <span style={{ fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:isRetro?0:99,background:dark?"#052e16":"#dcfce7",color:dark?"#34d399":"#065f46" }}>✓ Funded</span>}
                </div>
                <p className={mny} style={{ margin:"2px 0 0",fontSize:12,color:textMute }}>₹{saved.toLocaleString()} of ₹{target.toLocaleString()} set aside</p>
              </div>
              <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                <button onClick={() => editGoal(g)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,padding:3 }}><EditIcon/></button>
                <button onClick={() => deleteGoal(g.id)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,padding:3 }}><TrashIcon/></button>
              </div>
            </div>

            <div style={{ width:"100%",height:8,borderRadius:isRetro?0:99,background:isRetro?"#ffffff":(dark?"#1f2937":"#f3f4f6"),overflow:"hidden",marginBottom:6,border:isRetro?`2px solid ${RETRO_THEME.border}`:"none" }}>
              <div style={{ height:"100%",borderRadius:isRetro?0:99,width:`${pct}%`,background:reached?"linear-gradient(to right,#059669,#34d399)":safeAccent,transition:"width 0.6s ease" }}/>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",gap:8,fontSize:11,color:textMute,flexWrap:"wrap" }}>
              <span style={{ fontWeight:700,color:reached?(dark?"#34d399":"#059669"):safeAccent }}>{pct}%</span>
              {!reached && <span className={mny}>₹{needed.toLocaleString()} to go</span>}
              {pace && !reached && (
                <span style={{ color:pace.overdue||pace.days<=7?"#f97316":textMute }}>
                  {pace.overdue ? "Past the date" : `${pace.days}d left`}
                </span>
              )}
            </div>

            {/* Pacing hint - the point of a dated short-term goal */}
            {pace && !reached && !pace.overdue && (
              <p className={mny} style={{ margin:"8px 0 0",fontSize:11,color:textMute,background:subbg,borderRadius:isRetro?0:8,padding:"6px 9px",border:isRetro?`2px solid ${RETRO_THEME.border}`:"none" }}>
                Put aside <strong style={{ color:textMain }}>₹{pace.perWeek.toLocaleString()}/week</strong>
                {pace.days >= 45 ? <> or <strong style={{ color:textMain }}>₹{pace.perMonth.toLocaleString()}/month</strong></> : null} to make it.
              </p>
            )}

            {/* Actions */}
            <div style={{ display:"flex",gap:6,marginTop:10 }}>
              <button onClick={() => openGoalFunder(g.id,"add")} disabled={reached}
                style={{ ...btnPrimary,flex:1,padding:"8px 12px",fontSize:13,opacity:reached?0.5:1,cursor:reached?"default":"pointer" }}>
                {isOpen && adding ? "Close" : "Set money aside"}
              </button>
              {saved > 0 && (
                <button onClick={() => openGoalFunder(g.id,"withdraw")} style={{ ...btnSecondary,padding:"8px 12px",fontSize:13 }}>
                  {isOpen && !adding ? "Close" : "Take out"}
                </button>
              )}
            </div>

            {isOpen && (
              <div style={{ marginTop:10,paddingTop:10,borderTop:`1px solid ${border}` }}>
                <p style={{ margin:"0 0 6px",fontSize:11,fontWeight:600,color:textMute }}>
                  {adding ? "Take from" : "Return to"}
                </p>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                  {sources.map(src => {
                    const active = goalFundSource === src.id;
                    return (
                      <button key={src.id} onClick={() => setGoalFundSource(src.id)}
                        style={{ padding:"6px 10px",borderRadius:isRetro?0:99,fontSize:12,fontWeight:active?700:500,cursor:"pointer",
                          background:active?safeAccent:(isRetro?"#ffffff":subbg),
                          color:active?(isRetro?RETRO_THEME.border:"#fff"):textMute,
                          border:isRetro?`2px solid ${RETRO_THEME.border}`:`1px solid ${active?safeAccent:border}` }}>
                        {src.label}
                        {adding && <span className={mny} style={{ opacity:0.75,marginLeft:5 }}>₹{src.balance.toLocaleString()}</span>}
                      </button>
                    );
                  })}
                </div>

                {adding && needed > 0 && (
                  <div style={{ display:"flex",gap:6,marginBottom:8,flexWrap:"wrap" }}>
                    {[500, 1000, 5000].filter(v => v <= needed).concat(needed).map((v, i) => (
                      <button key={`${v}-${i}`} onClick={() => setGoalFundAmt(String(v))}
                        style={{ ...btnSecondary,padding:"5px 10px",fontSize:12 }}>
                        {v === needed && i > 0 ? `All ₹${v.toLocaleString()}` : `₹${v.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display:"flex",gap:8 }}>
                  <input type="number" inputMode="decimal" value={goalFundAmt} autoFocus
                    onChange={e => setGoalFundAmt(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter") (adding ? fundGoal : unfundGoal)(g.id, goalFundAmt, goalFundSource); }}
                    placeholder={adding ? `Up to ₹${needed.toLocaleString()}` : `Up to ₹${saved.toLocaleString()}`}
                    style={{ ...inputStyle,flex:1 }}/>
                  <button onClick={() => (adding ? fundGoal : unfundGoal)(g.id, goalFundAmt, goalFundSource)} style={btnPrimary}>
                    {adding ? "Set aside" : "Take out"}
                  </button>
                </div>
                <p style={{ margin:"6px 0 0",fontSize:10,color:textMute }}>
                  {adding
                    ? "Moves money out of the account and into savings, earmarked for this goal. Net worth doesn't change."
                    : "Returns the money to spendable balance."}
                </p>
              </div>
            )}
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
    // FIX: schedule() returned the new timer id but the recursive call inside
    // discarded it, so cleanup only ever cancelled the very first timeout -
    // every rollover after that leaked a timer that kept calling setToday.
    let timer = null;
    function schedule() {
      const ms = msUntilMidnightIST();
      timer = setTimeout(() => { setToday(getTodayIST()); schedule(); }, ms + 500);
    }
    schedule();
    return () => clearTimeout(timer);
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
  const [themeStyle, setThemeStyle] = useState(() => storageGet(KEYS.THEME_STYLE, "classic")); // "classic" | "retro"
  const isRetro = themeStyle === "retro";
  const accent = isRetro ? RETRO_THEME.orange : (dark ? ACCENT_CLASSIC.dark : ACCENT_CLASSIC.light);

  useEffect(() => { storageSetDebounced(KEYS.THEME, dark?"dark":"light"); }, [dark]);
  useEffect(() => { storageSet(KEYS.THEME_STYLE, themeStyle); }, [themeStyle]);
  useEffect(() => { if (isRetro && dark) setDark(false); }, [isRetro, dark]);

  // ── Simple mode ───────────────────────────────────────────────────────────
  const [simpleMode, setSimpleMode] = useState(() => storageGet(KEYS.SIMPLE, false));
  useEffect(() => { storageSet(KEYS.SIMPLE, simpleMode); }, [simpleMode]);
  useEffect(() => { if (simpleMode) setPotSection("usable"); }, [simpleMode]);
  // Simple mode is a single page - make sure we aren't left stranded on a tab
  // that is no longer reachable when it gets switched on.
  useEffect(() => { if (simpleMode) { setTab("home"); setDrillCat(null); } }, [simpleMode]);

  // ── Privacy mode (hide balance/net worth/cash figures) ─────────────────────
  const [hideAmounts, setHideAmounts] = useState(() => storageGet(KEYS.PRIVACY, false));
  useEffect(() => { storageSet(KEYS.PRIVACY, hideAmounts); }, [hideAmounts]);
  const mny = hideAmounts ? "mny-mask" : undefined;

  // ── Core data ─────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState(() => sanitizeExpenses(storageGet(KEYS.EXPENSES, [])));
  // FIX: budget stored as number, not string
  const [budget, setBudget] = useState(() => Math.max(0, asNumber(storageGet(KEYS.BUDGET, 0), 0)));
  const [categories, setCategories] = useState(() => {
    let p = sanitizeCategories(storageGet(KEYS.CATEGORIES, DEFAULT_CATEGORIES), CAT_PALETTE.length);
    if (p.length === 0) p = sanitizeCategories(DEFAULT_CATEGORIES, CAT_PALETTE.length);
    // Ensure an "Others" catch-all always exists (needed for category deletion)
    if (!p.find(c => c.name==="Others")) p = [...p, { name:"Others", colorIdx: p.length%CAT_PALETTE.length, excludeFromBudget:false }];
    return p;
  });
  const [streak, setStreak] = useState(() => sanitizeStreak(storageGet(KEYS.STREAK, EMPTY_STREAK)));
  const [recurring, setRecurring] = useState(() => sanitizeRecurring(storageGet(KEYS.RECURRING, [])));
  const [pot, setPot] = useState(() => sanitizePot(storageGet(KEYS.POT, DEFAULT_POT), DEFAULT_POT));
  const [banks, setBanks] = useState(() => sanitizeBanks(storageGet(KEYS.BANKS, null)));
  const [dismissedMap, setDismissedMap] = useState(() => asObject(storageGet(KEYS.DISMISS, {})));
  const [notifEnabled, setNotifEnabled] = useState(() => storageGet(KEYS.NOTIF, false));
  const [userName, setUserName] = useState(() => storageGet(KEYS.USER, ""));
  const [avatarId, setAvatarId] = useState(() => storageGet(KEYS.AVATAR, "initials"));
  const [notifLog, setNotifLog] = useState(() => asArray(storageGet(KEYS.NOTIF_LOG, [])));
  const [goals, setGoals] = useState(() => sanitizeGoals(storageGet(KEYS.GOALS, [])));
  // Streak freeze state
  const [shieldState, setShieldState] = useState(() => {
    const s = asObject(storageGet(KEYS.SHIELD, null));
    return {
      usedThisMonth: Math.max(0, asNumber(s.usedThisMonth, 0)),
      lastResetMonth: typeof s.lastResetMonth === "string" ? s.lastResetMonth : "",
      usedDates: asArray(s.usedDates).filter(d => typeof d === "string"),
    };
  });

  // Persist all core data
  useEffect(() => { storageSetDebounced(KEYS.EXPENSES, expenses); }, [expenses]);
  useEffect(() => { storageSetDebounced(KEYS.BUDGET, budget); }, [budget]);
  useEffect(() => { storageSetDebounced(KEYS.CATEGORIES, categories); }, [categories]);
  useEffect(() => { storageSetDebounced(KEYS.STREAK, streak); }, [streak]);
  useEffect(() => { storageSetDebounced(KEYS.RECURRING, recurring); }, [recurring]);
  useEffect(() => { storageSetDebounced(KEYS.POT, pot); }, [pot]);
  useEffect(() => { storageSetDebounced(KEYS.BANKS, banks); }, [banks]);
  useEffect(() => { storageSetDebounced(KEYS.DISMISS, dismissedMap); }, [dismissedMap]);
  useEffect(() => { storageSet(KEYS.NOTIF, notifEnabled); }, [notifEnabled]);
  useEffect(() => { storageSet(KEYS.USER, userName); }, [userName]);
  useEffect(() => { storageSet(KEYS.AVATAR, avatarId); }, [avatarId]);
  useEffect(() => { storageSetDebounced(KEYS.NOTIF_LOG, notifLog); }, [notifLog]);
  useEffect(() => { storageSetDebounced(KEYS.GOALS, goals); }, [goals]);
  useEffect(() => { storageSet(KEYS.SHIELD, shieldState); }, [shieldState]);

  // ── Form state (Add Expense) ──────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [amountShake, setAmountShake] = useState(false);
  const [selCat, setSelCat] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => getTodayIST());
  const [editingId, setEditingId] = useState(null);
  // FIX: `date` was seeded once at mount and never refreshed, so if the app was
  // left open across midnight every new expense silently got yesterday's date.
  const prevTodayRef = useRef(today);
  useEffect(() => {
    if (prevTodayRef.current !== today) {
      // only move the field if the user hadn't deliberately back-dated it
      setDate(d => (d === prevTodayRef.current ? today : d));
      prevTodayRef.current = today;
    }
  }, [today]);
  // FIX: this used to re-read KEYS.BANKS from storage independently of the
  // `banks` state, so the two could disagree. Derive it from state instead.
  const [paySource, setPaySource] = useState(() => {
    const def = banks.find(b => b.isDefault) || banks[0];
    return def ? `bank:${def.id}` : "cash";
  });
  const [showBankManager, setShowBankManager] = useState(false);
  const [bankFormName, setBankFormName] = useState("");
  const [bankFormBalance, setBankFormBalance] = useState("");
  const [bankEditId, setBankEditId] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [catDeleteConfirm, setCatDeleteConfirm] = useState(null);
  const newCatInputRef = useRef(null);

  // ── Split with Friends (kept separate from Expenses) ────────────────────
  const [friends, setFriends] = useState(() => asArray(storageGet(KEYS.FRIENDS, [])).filter(f => f && typeof f.name === "string"));
  const [splits, setSplits] = useState(() => asArray(storageGet(KEYS.SPLITS, [])).filter(s => s && typeof s === "object"));
  useEffect(() => { storageSetDebounced(KEYS.FRIENDS, friends); }, [friends]);
  useEffect(() => { storageSetDebounced(KEYS.SPLITS, splits); }, [splits]);
  const newFriendInputRef = useRef(null);
  const [splitTitle, setSplitTitle] = useState("");
  const [splitIncludeMe, setSplitIncludeMe] = useState(false);
  const [splitSelectedIds, setSplitSelectedIds] = useState([]);
  const [splitPaidMap, setSplitPaidMap] = useState({}); // id -> paid amount string
  const [splitMode, setSplitMode] = useState("equal"); // "equal" | "shares"
  const [splitShareMap, setSplitShareMap] = useState({}); // id -> custom owed-share string (shares mode only)
  const [splitResult, setSplitResult] = useState(null); // computed settlement for last saved/preview split
  const [friendDeleteConfirm, setFriendDeleteConfirm] = useState(null);
  const [splitDeleteConfirm, setSplitDeleteConfirm] = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("home");
  const [billsSubTab, setBillsSubTab] = useState("recurring"); // "recurring" | "loans"
  const [drillCat, setDrillCat] = useState(null);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  // EMI state (also owned by EmiTab - we mirror here for notifications)
  const [emis, setEmis] = useState(() => sanitizeEmis(storageGet(KEYS.EMI, [])));
  useEffect(() => { storageSetDebounced(KEYS.EMI, emis); }, [emis]);

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
  // Which goal has its "set money aside" panel open, and the pending amount.
  const [goalFundId, setGoalFundId] = useState(null);
  const [goalFundAmt, setGoalFundAmt] = useState("");
  const [goalFundMode, setGoalFundMode] = useState("add"); // "add" | "withdraw"
  const [goalFundSource, setGoalFundSource] = useState("bank");

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
  const { getCatStyle, getCatAccent } = useCategoryHelpers(categories, dark, isRetro);

  // ── Streak helpers ────────────────────────────────────────────────────────
  const todayLogged = streak.loggedDates.includes(today);
  function logDay(dateStr) {
    setStreak(prev => updateStreak(prev, dateStr));
  }
  function logNoSpend() {
    if (todayLogged) { showToast("Already logged!"); return; }
    logDay(today); showToast("No-spend day logged! 🚀");
  }

  // ── Streak freeze system ───────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const freezeData = useMemo(() => getFreezeData(shieldState), [shieldState, today]);

  function activateFreeze() {
    if (freezeData.available <= 0) { showToast("No freeze tokens - earn one every 7 days 🛡️"); return; }
    if (todayLogged) { showToast("Already logged today - no freeze needed!"); return; }
    const { currentMonth } = freezeData;
    // Reset usedThisMonth if new month, then increment
    const usedThisMonth = shieldState.lastResetMonth === currentMonth ? (shieldState.usedThisMonth || 0) : 0;
    const usedDates = [...(shieldState.usedDates || []), today];
    setShieldState({ usedThisMonth: usedThisMonth + 1, lastResetMonth: currentMonth, usedDates });
    // Log today to protect streak
    setStreak(prev => updateStreak(prev, today));
    showToast(`🛡️ Freeze used! Streak protected. ${freezeData.available - 1} left this month.`);
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
    const set = new Set(expenses.filter(e => typeof e.date === "string").map(e => e.date.slice(0,7)));
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

  // FIX: monthly total now uses only current-month expenses, excluding gift/transfer categories
  const excludedCats = useMemo(() => categories.filter(c => c.excludeFromBudget).map(c => c.name), [categories]);
  // `today` looks unused to eslint, but computeMonthlyTotal calls
  // isInCurrentMonth() -> nowIST() internally, so `today` is what re-runs this
  // at the midnight rollover. Same applies to the memos below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthlyTotal = useMemo(() => computeMonthlyTotal(expenses, excludedCats), [expenses, excludedCats, today]);

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

  const allocatedToGoals = useMemo(() => totalAllocated(goals), [goals]);
  const unallocatedSavings = Math.max(0, (Number(pot.savings)||0) - allocatedToGoals);

  const goldValue = useMemo(() => (Number(pot.goldGrams)||0)*(Number(pot.goldRate)||0), [pot.goldGrams, pot.goldRate]);
  const totalBankBalance = banks.reduce((s,b) => s+(Number(b.balance)||0), 0);
  const usableTotal = (Number(pot.usableCash)||0) + totalBankBalance;
  const netWorthTotal = usableTotal + (Number(pot.savings)||0) + (Number(pot.investments)||0) + goldValue;

  const extrasThisMonth = useMemo(() =>
    (pot.extras||[]).filter(e => isInCurrentMonth(e.date)).reduce((s,e) => s+e.amount, 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [pot.extras, today]);

  const totalIn = monthlyIncome + extrasThisMonth;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const daysElapsed = useMemo(() => Math.max(1, nowIST().getDate()), [today]);
  const dailyAvg = daysElapsed > 0 ? Math.round(monthlyTotal/daysElapsed) : 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trendData = useMemo(() => buildTrendData(expenses), [expenses, today]);
  // topCategory uses all-time totals, not the period-filtered catTotals
  const allTimeCatTotals = useMemo(() =>
    expenses.reduce((acc,e) => { acc[e.category]=(acc[e.category]||0)+e.amount; return acc; }, {}),
  [expenses]);
  const topCategory = useMemo(() =>
    Object.keys(allTimeCatTotals).sort((a,b) => allTimeCatTotals[b]-allTimeCatTotals[a])[0],
  [allTimeCatTotals]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const last14 = useMemo(() => getLastNDays(14), [today]);

  // Simple mode shows only today's spending, so it needs its own slice.
  const todaysExpenses = useMemo(
    () => expenses.filter(e => e.date === today).slice().reverse(),
    [expenses, today]
  );
  const todaysTotal = useMemo(
    () => todaysExpenses.reduce((sum, e) => sum + e.amount, 0),
    [todaysExpenses]
  );

  const potBase = monthlyIncome > 0 ? monthlyIncome : netWorthTotal > 0 ? netWorthTotal : 1;
  const usableFillPct = Math.min(100, (usableTotal/potBase)*100);
  const nwFillActual = netWorthTotal > 0 ? Math.min(100, (usableTotal/netWorthTotal)*100+20) : 0;

  // ── Reminders ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const istNow = useMemo(() => nowIST(), [today]);
  const reminders = useMemo(() => {
    const recurringReminders = recurring
      .filter(r => {
        const days = daysFromToday(r.nextDue);
        if (days > 3) return false;   // remind up to 3 days before (matches EMI window)
        if (dismissedMap[r.id] === today) return false;
        const paidTM = (r.paid||[]).some(d => {
          const pd = new Date(d+"T00:00:00");
          return pd.getMonth()===istNow.getMonth() && pd.getFullYear()===istNow.getFullYear();
        });
        return !paidTM;
      })
      .map(r => ({ id:r.id, name:r.name, amount:r.amount, daysUntil:daysFromToday(r.nextDue), dueDateStr:formatDate(r.nextDue), category:r.category }));
    const emiReminders = getEmiReminders(emis, today, dismissedMap);
    return [...recurringReminders, ...emiReminders].sort((a, b) => a.daysUntil - b.daysUntil);
  },
  [recurring, emis, dismissedMap, today, istNow]);

  function dismissReminder(id) { setDismissedMap(p => ({ ...p, [id]: today })); }

  // ── Notifications - fire once per day on due day ──────────────────────────
  const recurringRef = useRef(recurring);
  const dismissedMapRef = useRef(dismissedMap);
  const emisRef = useRef(emis);                                  // FIX: keep emis fresh in ref
  useEffect(() => { recurringRef.current = recurring; }, [recurring]);
  useEffect(() => { dismissedMapRef.current = dismissedMap; }, [dismissedMap]);
  useEffect(() => { emisRef.current = emis; }, [emis]);          // FIX: sync emis ref
  useEffect(() => {
    if (!notifEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today2 = getTodayIST();
    // Guard so notifications only fire once per calendar day.
    // FIX: these per-day keys were written forever and never cleaned up, so
    // localStorage grew by one dead key every single day. Prune on the way in.
    const firedPrefix = "myspendr_notif_fired_";
    const firedKey = firedPrefix + today2;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(firedPrefix) && k !== firedKey) localStorage.removeItem(k);
      }
    } catch { /* storage unavailable - not fatal */ }
    if (localStorage.getItem(firedKey)) return;

    const istNow2 = nowIST();
    const fired = [];
    // FIX: the recurring list was fed in raw, so a bill already paid this month
    // still produced a notification. Apply the same paid-this-month filter the
    // on-screen reminders use.
    const dueRecurring = recurringRef.current.filter(r => {
      const paidThisMonth = (r.paid || []).some(d => {
        const pd = new Date(d + "T00:00:00");
        return pd.getMonth() === istNow2.getMonth() && pd.getFullYear() === istNow2.getFullYear();
      });
      return !paidThisMonth;
    });

    [...dueRecurring, ...getEmiReminders(emisRef.current, today2, dismissedMapRef.current)].forEach(r => {
      const days = r.nextDue !== undefined ? daysFromToday(r.nextDue) : r.daysUntil;
      if (days === undefined || days > 3 || days < 0) return;
      if (dismissedMapRef.current && dismissedMapRef.current[r.id] === today2) return;
      const dueLabel = days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due in ${days} days`;
      const body = `₹${(r.amount||0).toLocaleString()} ${dueLabel}`;
      try {
        new Notification(`mySpendr: ${r.name}`, {
          body, icon: "/favicon.ico",
          tag: `myspendr-reminder-${r.id}-${today2}`,
        });
        fired.push({ id: uid(), name: r.name, body, date: today2, ts: Date.now() });
      } catch (e) { console.warn("[notif] failed:", e.message); }
    });

    // Only claim the day once something actually went out.
    if (fired.length > 0) {
      localStorage.setItem(firedKey, "1");
      // FIX: setNotifLog was never called anywhere, so the in-app notification
      // history was permanently empty.
      setNotifLog(prev => [...fired, ...prev].slice(0, 50));
    }
  }, [notifEnabled, today]);

  async function toggleNotif() {
    if (!notifEnabled) {
      const granted = await requestNotifPermission();
      if (granted) { setNotifEnabled(true); showToast("Notifications on!"); }
      else showToast("Permission denied - enable in browser settings");
    } else { setNotifEnabled(false); showToast("Notifications off"); }
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────────
  function resetExpenseForm() {
    setAmount(""); setNote(""); setDate(today); setEditingId(null);
    const def = banks.find(b=>b.isDefault) || banks[0];
    setPaySource(def ? `bank:${def.id}` : "bank:1");
  }

  // ── Bank CRUD ─────────────────────────────────────────────────────────────
  function saveBank() {
    if (!bankFormName.trim()) return;
    if (bankEditId) {
      // FIX: `Number(bankFormBalance) || bk.balance` meant a balance of 0 was
      // falsy and silently kept the old value - you could never zero an account.
      setBanks(b => b.map(bk => {
        if (bk.id !== bankEditId) return bk;
        const raw = String(bankFormBalance).trim();
        const parsed = Number(raw);
        const balance = raw !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : bk.balance;
        return { ...bk, name: bankFormName.trim(), balance };
      }));
      showToast("Bank updated!");
    } else {
      const newId = uid();
      const isFirst = banks.length === 0;
      const raw = String(bankFormBalance).trim();
      const parsed = Number(raw);
      setBanks(b => [...b, {
        id: newId,
        name: bankFormName.trim(),
        balance: raw !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
        isDefault: isFirst,
      }]);
      showToast("Bank added!");
    }
    setBankFormName(""); setBankFormBalance(""); setBankEditId(null);
  }
  // FIX: deleting a bank used to leave three kinds of orphan behind -
  //   1. its balance simply vanished from net worth,
  //   2. every past expense still pointed at `bank:<deletedId>`, so editing or
  //      deleting one refunded into nothing and the money was lost,
  //   3. `paySource` could still name the dead account, so the next expense
  //      was recorded but no balance ever moved.
  // The balance is now swept into the surviving default account and every
  // reference is repointed at it.
  function deleteBank(id) {
    if (banks.length <= 1) { showToast("At least one bank required"); return; }
    const removed = banks.find(bk => bk.id === id);
    if (!removed) return;
    const survivors = banks.filter(bk => bk.id !== id);
    const heirIdx = Math.max(0, survivors.findIndex(bk => bk.isDefault));
    const heir = survivors[heirIdx];

    setBanks(survivors.map((bk, i) => i === heirIdx
      ? { ...bk, isDefault: true, balance: (Number(bk.balance)||0) + (Number(removed.balance)||0) }
      : bk));
    setExpenses(prev => prev.map(e =>
      e.paySource === `bank:${id}` ? { ...e, paySource: `bank:${heir.id}` } : e));
    setPaySource(prev => (prev === `bank:${id}` ? `bank:${heir.id}` : prev));

    const moved = Number(removed.balance) || 0;
    showToast(moved > 0
      ? `Removed — ₹${moved.toLocaleString()} moved to ${heir.name}`
      : "Bank removed.");
  }
  function setDefaultBank(id) {
    setBanks(b => b.map(bk => ({ ...bk, isDefault: bk.id===id })));
    showToast("Default bank updated!");
  }
  function adjustBankBalanceDirect(id, dir, val) {
    const num = Number(val)||0;
    if (num <= 0) return;
    setBanks(b => b.map(bk => bk.id===id ? { ...bk, balance: dir==="add" ? (Number(bk.balance)||0)+num : Math.max(0,(Number(bk.balance)||0)-num) } : bk));
    showToast(`${dir==="add"?"+":"-"}₹${num.toLocaleString()} · ${banks.find(b=>b.id===id)?.name||"bank"}`);
  }
  // Total bank balance = sum of all bank accounts (declared above near usableTotal)

  function saveExpense() {
    if (!isValidAmount(amount)) {
      setAmountShake(true); setTimeout(() => setAmountShake(false), 500); return;
    }
    const num = Number(amount);
    if (editingId) {
      // FIX: `old` was dereferenced without a null check, unlike deleteExpense.
      const old = expenses.find(e => e.id===editingId);
      if (!old) { showToast("That expense no longer exists."); resetExpenseForm(); return; }
      // Refund old source, then deduct the new one (exactly once each)
      if (old.paySource === "cash") setPot(p => refundPot(p, "cash", old.amount));
      else setBanks(b => refundBank(b, old.paySource||"bank", old.amount));
      if (paySource === "cash") setPot(p => deductPot(p, "cash", num));
      else setBanks(b => deductBank(b, paySource, num));
      setExpenses(p => p.map(e => e.id===editingId ? { ...e, amount:num, category:selCat, note, date, paySource } : e));
      showToast("Updated!");
      // FIX: editing used to call logDay(date), which meant changing an old
      // expense's date silently credited a brand-new streak day.
    } else {
      const srcName = paySource === "cash" ? "cash" : (resolveBank(paySource, banks)?.name || "bank");
      const currentBal = paySource === "cash"
        ? (Number(pot.usableCash)||0)
        : (Number(resolveBank(paySource, banks)?.balance)||0);
      if (paySource === "cash") setPot(p => deductPot(p,"cash",num));
      else setBanks(b => deductBank(b, paySource, num));
      setExpenses(p => [...p, { id:uid(), amount:num, category:selCat, note, date, paySource }]);
      // FIX: the low-balance warning used to be its own showToast() call
      // immediately overwritten by the success toast, so it was never visible.
      showToast(num > currentBal
        ? `Added · ⚠️ only ₹${currentBal.toLocaleString()} was in ${srcName}`
        : `Added · deducted from ${srcName}`);
      logDay(date);
    }
    setTab("home");
    resetExpenseForm();
  }

  function editExpense(item) { setEditingId(item.id); setAmount(String(item.amount)); setSelCat(item.category); setNote(item.note); setDate(item.date); setPaySource(item.paySource||"bank"); }

  function deleteExpense(id) {
    const exp = expenses.find(e => e.id===id);
    if (exp) {
      if (exp.paySource === "cash") {
        setPot(p => refundPot(p, "cash", exp.amount));
      } else {
        setBanks(b => refundBank(b, exp.paySource||"bank", exp.amount));
      }
    }
    setExpenses(p => p.filter(e => e.id!==id));
    showToast("Deleted & refunded.");
  }

  // FIX: both of these skipped isValidAmount, so a mis-parsed voice/OCR figure
  // above MAX_AMOUNT went straight in. They also hardcoded the default bank
  // and ignored the pay source the user had selected.
  function quickAddExpense({ amount, category, note }, label) {
    if (!isValidAmount(amount)) { showToast("Couldn't read a valid amount."); return; }
    const cat = categories.find(c => c.name===category)?.name || categories[0]?.name || "Others";
    const num = Number(amount);
    const src = paySource || (banks.find(b=>b.isDefault) || banks[0] ? `bank:${(banks.find(b=>b.isDefault)||banks[0]).id}` : "cash");
    setExpenses(p => [...p, { id:uid(), amount:num, category:cat, note:note||"", date:today, paySource:src }]);
    if (src === "cash") setPot(p => deductPot(p, "cash", num));
    else setBanks(b => deductBank(b, src, num));
    logDay(today); showToast(`${label} expense added!`); setTab("expenses");
  }
  function handleVoiceAdd(payload)   { quickAddExpense(payload, "Voice"); }
  function handleReceiptAdd(payload) { quickAddExpense(payload, "Receipt"); }

  // ── Recurring CRUD ────────────────────────────────────────────────────────
  function resetRForm() { setRName(""); setRAmount(""); setRCat(categories[0]?.name||""); setRFreq("Monthly"); setRDueDate(today); setREditId(null); setShowRForm(false); }
  function saveRecurring() {
    if (!rName.trim() || !isValidAmount(rAmount)) return;
    const nextDue = getNextDueDate(rDueDate, rFreq);
    const entry = { id:rEditId||uid(), name:rName.trim(), amount:Number(rAmount), category:rCat, frequency:rFreq, dueDate:rDueDate, nextDue, paid:[] };
    if (rEditId) { setRecurring(p => p.map(r => r.id===rEditId ? { ...entry, paid:r.paid } : r)); showToast("Updated!"); }
    else { setRecurring(p => [...p, entry]); showToast("Recurring added!"); }
    resetRForm();
  }
  function editRecurring(r) { setREditId(r.id); setRName(r.name); setRAmount(r.amount); setRCat(r.category); setRFreq(r.frequency); setRDueDate(r.dueDate||r.startDate||today); setShowRForm(true); }
  function deleteRecurring(id) { setRecurring(p => p.filter(r => r.id!==id)); showToast("Removed."); }
  function markPaid(r, source="bank") {
    const pd = today;
    // FIX: markPaid had no already-paid guard (unlike payEmi), so paying the
    // same bill from the reminder banner and again from the list double-logged
    // the expense and deducted twice.
    if ((r.paid||[]).includes(pd)) { showToast("Already paid today!"); return; }
    const def = banks.find(b=>b.isDefault) || banks[0];
    const src = source === "cash" ? "cash" : (def ? `bank:${def.id}` : "cash");
    // FIX: nextDue used to be recomputed from *today*, so paying a 1st-of-month
    // bill on the 3rd moved it to the 3rd, then the 5th, and so on - the due
    // date drifted forward a little every cycle. Advance from the scheduled
    // date instead so the cadence stays anchored.
    const anchor = r.nextDue || r.dueDate || pd;
    const nextDue = getNextDueDate(anchor, r.frequency);
    setExpenses(p => [...p, { id:uid(), amount:r.amount, category:r.category, note:`${r.name} (${r.frequency})`, date:pd, paySource:src }]);
    setRecurring(p => p.map(item => item.id!==r.id ? item : { ...item, nextDue, paid:[...(item.paid||[]),pd] }));
    if (src === "cash") setPot(p => deductPot(p, "cash", r.amount));
    else setBanks(b => deductBank(b, src, r.amount));
    setDismissedMap(prev => { const n={...prev}; delete n[r.id]; return n; });
    logDay(pd); showToast(`${r.name} paid from ${source}!`);
  }
  function payFromReminder(item, source) {
    if (item.isEmi) {
      // Pay the EMI loan directly
      const loan = emis.find(e => e.id === item.loanId);
      if (!loan) return;
      const monthKey = today.slice(0,7);
      if ((loan.paidMonths||[]).includes(monthKey)) { showToast("Already paid this month!"); return; }
      // FIX: no tenure guard - a fully repaid loan could keep taking payments.
      if ((loan.paidMonths||[]).length >= Number(loan.tenure)) { showToast("This loan is already fully repaid."); return; }
      const def = banks.find(b=>b.isDefault) || banks[0];
      const src = source === "cash" ? "cash" : (def ? `bank:${def.id}` : "cash");
      setEmis(prev => prev.map(e => e.id!==loan.id?e:{ ...e, paidMonths:[...(e.paidMonths||[]),monthKey] }));
      setExpenses(prev => [...prev, { id:uid(), amount:loan.emi, category:"Bills", note:`${loan.name} EMI`, date:today, paySource:src }]);
      if (src === "cash") setPot(p => deductPot(p, "cash", loan.emi));
      else setBanks(b => deductBank(b, src, loan.emi));
      logDay(today); showToast(`₹${loan.emi.toLocaleString()} EMI paid!`);
      return;
    }
    const r = recurring.find(x => x.id===item.id); if (r) markPaid(r, source);
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  function saveBudget() {
    const raw = String(budgetInput).trim();
    if (raw === "") return;
    const n = Number(raw);
    // FIX: no validation - a non-numeric entry set budget to NaN, which made
    // "remaining" render as NaN everywhere.
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) { showToast("Enter a budget between 0 and 1,00,00,000."); return; }
    setBudget(n); setBudgetInput(""); setEditingBudget(false); showToast("Budget updated!");
  }

  // ── Categories ────────────────────────────────────────────────────────────
  // NOTE: this input is intentionally uncontrolled (via ref, not React state).
  // Making it a controlled input caused a bug on mobile (most visible in portrait
  // mode) where every keystroke re-rendered the field and reset the cursor to the
  // start, so each new letter got inserted before the previous ones — the text
  // effectively came out reversed. Reading the value from the DOM on submit
  // avoids re-rendering on every keystroke entirely, so the browser handles the
  // cursor natively and typing behaves normally.
  function addCategory() {
    const name = (newCatInputRef.current?.value || "").trim();
    if (!name || categories.find(c => c.name===name)) { showToast("Name is empty or already exists."); return; }
    setCategories(p => [...p, { name, colorIdx: p.length % CAT_PALETTE.length, excludeFromBudget: false }]);
    if (newCatInputRef.current) newCatInputRef.current.value = "";
    setAddingCat(false); showToast("Category added!");
  }

  function toggleCatBudgetExclusion(catName) {
    setCategories(p => p.map(c => c.name===catName ? { ...c, excludeFromBudget: !c.excludeFromBudget } : c));
  }

  // Remove a category. Its expenses are reassigned to "Others" (auto-created if
  // missing) and the original category name is recorded in each expense's note
  // by default, so nothing about where the spend used to be categorized is lost.
  function deleteCategory(catName) {
    if (catName === "Others") { showToast("The Others category can't be removed."); return; }
    if (categories.length <= 1) { showToast("You need at least one category."); return; }
    setCategories(prev => {
      const rest = prev.filter(c => c.name !== catName);
      const hasOthers = rest.some(c => c.name === "Others");
      return hasOthers ? rest : [...rest, { name:"Others", colorIdx: rest.length % CAT_PALETTE.length, excludeFromBudget:false }];
    });
    setExpenses(prev => prev.map(e => {
      if (e.category !== catName) return e;
      const tag = `(was: ${catName})`;
      return { ...e, category:"Others", note: e.note ? `${e.note} ${tag}` : tag };
    }));
    if (selCat === catName) setSelCat("Others");
    // FIX: only selCat was repointed, so the recurring form kept a dangling
    // reference to the deleted category.
    if (rCat === catName) setRCat("Others");
    setRecurring(prev => prev.map(r => r.category === catName ? { ...r, category: "Others" } : r));
    setCatDeleteConfirm(null);
    showToast(`"${catName}" removed — its expenses moved to Others`);
  }

  // ── Friends & Splitting ──────────────────────────────────────────────────
  // Deliberately its own data (friends/splits), never written into `expenses` —
  // splitting a bill with friends should never affect the budget/expense totals
  // unless the person explicitly logs their own share as a real expense.
  function addFriend() {
    const name = (newFriendInputRef.current?.value || "").trim();
    if (!name) return;
    if (friends.find(f => f.name.toLowerCase()===name.toLowerCase())) { showToast("That friend is already added."); return; }
    setFriends(p => [...p, { id:uid(), name }]);
    if (newFriendInputRef.current) newFriendInputRef.current.value = "";
    showToast(`${name} added!`);
  }
  function deleteFriend(id) {
    setFriends(p => p.filter(f => f.id!==id));
    setSplitSelectedIds(p => p.filter(x => x!==id));
    setSplitPaidMap(p => { const n = { ...p }; delete n[id]; return n; });
    setFriendDeleteConfirm(null);
    showToast("Friend removed.");
  }
  function toggleSplitParticipant(id) {
    setSplitSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }
  function setSplitPaid(id, val) {
    setSplitPaidMap(prev => ({ ...prev, [id]: val }));
  }
  function setSplitShare(id, val) {
    setSplitShareMap(prev => ({ ...prev, [id]: val }));
  }
  function toggleSplitIncludeMe() {
    setSplitIncludeMe(v => {
      const next = !v;
      setSplitSelectedIds(prev => next ? [...new Set([...prev, "me"])] : prev.filter(x=>x!=="me"));
      return next;
    });
  }
  function buildSplitEntries() {
    return splitSelectedIds.map(id => {
      if (id === "me") return { id:"me", name: userName ? userName : "Me", paid: Number(splitPaidMap.me)||0, shares: splitShareMap.me };
      const f = friends.find(x=>x.id===id);
      return f ? { id:f.id, name:f.name, paid: Number(splitPaidMap[f.id])||0, shares: splitShareMap[f.id] } : null;
    }).filter(Boolean);
  }
  // Equal-split settlement by default: everyone owes an equal portion of the
  // pooled total. In "shares" mode, each participant is assigned a number of
  // shares (e.g. B=2 shares, C=1 share, A=1 share → 4 shares total) and owes
  // (their shares ÷ total shares) × total paid — a blank share box defaults to 1.
  function computeSettlement(entries, mode = "equal") {
    const total = entries.reduce((s,e) => s + (Number(e.paid)||0), 0);
    const equalShare = entries.length ? total / entries.length : 0;
    const useShares = mode === "shares";
    const shareCount = e => { const n = Number(e.shares); return n > 0 ? n : 1; };
    const totalShares = useShares ? entries.reduce((s,e) => s + shareCount(e), 0) : 0;
    const perShare = useShares && totalShares ? total / totalShares : 0;
    const balances = entries.map(e => {
      const owed = useShares ? shareCount(e) * perShare : equalShare;
      return { id:e.id, name:e.name, paid:Number(e.paid)||0, shares: useShares ? shareCount(e) : null, owed, balance: Math.round(((Number(e.paid)||0) - owed) * 100) / 100 };
    });
    const debtors = balances.filter(b => b.balance < -0.005).map(b => ({ ...b })).sort((a,b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 0.005).map(b => ({ ...b })).sort((a,b) => b.balance - a.balance);
    const transactions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const amt = Math.round(Math.min(-d.balance, c.balance) * 100) / 100;
      if (amt > 0.005) transactions.push({ from:d.name, to:c.name, amount:amt });
      d.balance = Math.round((d.balance + amt) * 100) / 100;
      c.balance = Math.round((c.balance - amt) * 100) / 100;
      if (Math.abs(d.balance) < 0.01) i++;
      if (Math.abs(c.balance) < 0.01) j++;
    }
    return { total, share: equalShare, totalShares, perShare, mode, balances, transactions };
  }
  function previewSplit() {
    const entries = buildSplitEntries();
    if (entries.length < 2) { showToast("Pick at least 2 people to split between."); return; }
    setSplitResult(computeSettlement(entries, splitMode));
  }
  function saveSplit() {
    const entries = buildSplitEntries();
    if (entries.length < 2) { showToast("Pick at least 2 people to split between."); return; }
    const result = computeSettlement(entries, splitMode);
    const record = { id:uid(), title: splitTitle.trim() || "Split", date: today, entries, includeMe: splitIncludeMe, mode: splitMode, total: result.total, transactions: result.transactions };
    setSplits(prev => [record, ...prev]);
    setSplitResult(result);
    showToast("Split saved!");
  }
  function resetSplitForm() {
    setSplitTitle(""); setSplitIncludeMe(false); setSplitSelectedIds([]); setSplitPaidMap({}); setSplitShareMap({}); setSplitMode("equal"); setSplitResult(null);
  }
  function deleteSplit(id) {
    setSplits(prev => prev.filter(s => s.id!==id));
    setSplitDeleteConfirm(null);
    showToast("Split deleted.");
  }

  // ── Pot helpers ───────────────────────────────────────────────────────────
  // Cash-in-hand adjustments. Bank balances are adjusted through
  // adjustBankBalanceDirect, which targets a specific account.
  function quickAdjust(field, mode, val) {
    const num = Number(val)||0;
    if (!(num > 0) || !mode) return;
    setPot(p => ({ ...p, [field]: mode==="add" ? (Number(p[field])||0)+num : Math.max(0,(Number(p[field])||0)-num) }));
    showToast(`${mode==="add"?"+":"-"}₹${num.toLocaleString()} cash`);
  }
  // FIX: this used to subtract the delta from `pot.usableBank` - a field that
  // nothing reads, because `usableTotal` is derived from the `banks` array.
  // The net effect was that moving ₹50,000 into Savings *added* ₹50,000 to net
  // worth instead of transferring it. The delta now moves through the real
  // default bank account, and the transfer is capped at what's actually there.
  function updateNWField(field, val) {
    const newVal = Math.max(0, Number(val)||0);
    // Savings underpins the goal allocations - letting it drop below the
    // committed total would make goals claim money that no longer exists.
    if (field === "savings" && newVal < allocatedToGoals) {
      showToast(`₹${allocatedToGoals.toLocaleString()} is committed to goals — release a goal first.`);
      return;
    }
    const diff = newVal - (Number(pot[field])||0);
    if (diff === 0) { setPot(p => ({ ...p, [field]: newVal })); return; }
    const def = banks.find(b=>b.isDefault) || banks[0];
    if (!def) { setPot(p => ({ ...p, [field]: newVal })); return; }
    const available = Number(def.balance)||0;
    if (diff > 0 && diff > available) {
      showToast(`Only ₹${available.toLocaleString()} available in ${def.name}`);
      return;
    }
    setPot(p => ({ ...p, [field]: newVal }));
    setBanks(b => b.map(bk => bk.id===def.id
      ? { ...bk, balance: Math.max(0, (Number(bk.balance)||0) - diff) }
      : bk));
  }

  // ── Income / extras ───────────────────────────────────────────────────────
  function resetIncomeForm() { setIncName(""); setIncAmt(""); setIncFreq("Monthly"); setIncEditId(null); setShowIncomeForm(false); }
  function saveIncome() {
    if (!incName.trim() || !isValidAmount(incAmt)) return;
    const num = Number(incAmt);
    const def = banks.find(b=>b.isDefault) || banks[0];
    if (incEditId) {
      const existing = (pot.incomes||[]).find(i => i.id===incEditId);
      // FIX: the entry hardcoded `active: true`, so editing a paused income
      // silently un-paused it.
      const entry = { id:incEditId, label:incName.trim(), amount:num, frequency:incFreq, active: existing ? existing.active !== false : true };
      setPot(p => ({ ...p, incomes:(p.incomes||[]).map(i => i.id===incEditId?entry:i) }));
      // FIX: adding an income credited the bank but editing the amount didn't,
      // so the two drifted apart. Apply the difference.
      const delta = num - (Number(existing?.amount)||0);
      if (def && delta !== 0) {
        setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:Math.max(0,(Number(bk.balance)||0)+delta) } : bk));
      }
      showToast("Updated!");
    } else {
      const entry = { id:uid(), label:incName.trim(), amount:num, frequency:incFreq, active:true };
      setPot(p => ({ ...p, incomes:[...(p.incomes||[]),entry] }));
      // Credit the income to the default bank (net worth follows automatically)
      if (def) {
        setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:(Number(bk.balance)||0)+num } : bk));
        showToast(`₹${num.toLocaleString()} income credited to ${def.name}!`);
      } else {
        showToast("Income added!");
      }
    }
    resetIncomeForm();
  }
  // FIX: adding an income credited the bank, but deleting one left the money
  // behind - the opposite of how extras already behaved.
  function deleteIncome(id) {
    const inc = (pot.incomes||[]).find(i => i.id===id);
    setPot(p => ({ ...p, incomes:(p.incomes||[]).filter(i => i.id!==id) }));
    const def = banks.find(b=>b.isDefault) || banks[0];
    if (inc && def) {
      setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:Math.max(0,(Number(bk.balance)||0)-(Number(inc.amount)||0)) } : bk));
    }
    showToast("Removed.");
  }
  function editIncome(inc) { setIncEditId(inc.id); setIncName(inc.label); setIncAmt(inc.amount); setIncFreq(inc.frequency); setShowIncomeForm(true); }
  // FIX: this had no guard at all, so the button could be tapped repeatedly to
  // credit the same salary over and over. One credit per income per month.
  function creditIncome(inc) {
    const monthKey = today.slice(0,7);
    if ((inc.creditedMonths||[]).includes(monthKey)) { showToast("Already credited this month!"); return; }
    const def = banks.find(b=>b.isDefault) || banks[0];
    if (!def) { showToast("Add a bank account first."); return; }
    setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:(Number(bk.balance)||0)+(Number(inc.amount)||0) } : bk));
    setPot(p => ({ ...p, incomes:(p.incomes||[]).map(i => i.id!==inc.id ? i : { ...i, creditedMonths:[...(i.creditedMonths||[]), monthKey] }) }));
    showToast(`₹${Number(inc.amount).toLocaleString()} credited to ${def.name}!`);
  }
  function saveExtra() {
    if (!extraLabel.trim() || !isValidAmount(extraAmt)) return;
    const entry = { id:uid(), label:extraLabel.trim(), amount:Number(extraAmt), date:extraDate };
    const def = banks.find(b=>b.isDefault) || banks[0];
    setPot(p => ({ ...p, extras:[...(p.extras||[]),entry] }));
    if (def) setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:(Number(bk.balance)||0)+Number(extraAmt) } : bk));
    setExtraLabel(""); setExtraAmt(""); setExtraDate(today); setShowExtraForm(false);
    showToast(`₹${Number(extraAmt).toLocaleString()} added to ${def?.name||"bank"}!`);
  }
  function deleteExtra(id) {
    const ex = (pot.extras||[]).find(e => e.id===id);
    if (ex) {
      const def = banks.find(b=>b.isDefault) || banks[0];
      setPot(p => ({ ...p, extras:p.extras.filter(e => e.id!==id) }));
      if (def) setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:Math.max(0,(Number(bk.balance)||0)-ex.amount) } : bk));
    }
    showToast("Removed.");
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  function saveGoal() {
    if (!goalName.trim()) { showToast("Give the goal a name."); return; }
    if (!isValidAmount(goalTarget)) { showToast("Enter a target between 1 and 1,00,00,000."); return; }
    if (goalDeadline && goalDeadline < today) { showToast("Pick a deadline in the future."); return; }
    const entry = { id:goalEditId||uid(), name:goalName.trim(), target:Number(goalTarget), deadline:goalDeadline||null, createdOn:today };
    // FIX: editing a goal used to overwrite createdOn with today, resetting the
    // "saving since" date every time you touched it.
    if (goalEditId) {
      // Preserve everything the edit form doesn't own - money already set aside
      // must survive a rename or a change of target.
      setGoals(p => p.map(g => g.id===goalEditId
        ? { ...g, ...entry, createdOn: g.createdOn || today, saved: Number(g.saved)||0, contributions: g.contributions || [] }
        : g));
      showToast("Goal updated!");
    } else {
      setGoals(p => [...p, { ...entry, saved:0, contributions:[] }]);
      showToast("Goal added!");
    }
    setGoalName(""); setGoalTarget(""); setGoalDeadline(""); setGoalEditId(null); setShowGoalForm(false);
  }

  // Deleting a goal must hand its money back rather than silently destroying
  // it - the funds are real, they were moved out of a bank account.
  function deleteGoal(id) {
    const g = goals.find(x => x.id===id);
    const parked = Number(g?.saved) || 0;
    if (parked > 0) {
      const def = banks.find(b => b.isDefault) || banks[0];
      setPot(p => ({ ...p, savings: Math.max(0, (Number(p.savings)||0) - parked) }));
      if (def) setBanks(b => b.map(bk => bk.id===def.id ? { ...bk, balance:(Number(bk.balance)||0)+parked } : bk));
      showToast(`Goal removed — ₹${parked.toLocaleString()} returned to ${def?.name || "your bank"}`);
    } else {
      showToast("Goal removed.");
    }
    setGoals(p => p.filter(x => x.id!==id));
    if (goalFundId===id) { setGoalFundId(null); setGoalFundAmt(""); }
  }

  function editGoal(g) { setGoalEditId(g.id); setGoalName(g.name); setGoalTarget(g.target); setGoalDeadline(g.deadline||""); setShowGoalForm(true); }

  // ── Setting money aside ───────────────────────────────────────────────────
  // A contribution is a real transfer: money leaves a bank account (or cash in
  // hand) and lands in savings, earmarked against one goal. Net worth is
  // unchanged, which is the point - it's the same money in a different pocket.
  function fundGoal(goalId, rawAmount, source) {
    const g = goals.find(x => x.id===goalId);
    if (!g) return;
    if (!isValidAmount(rawAmount)) { showToast("Enter an amount between 1 and 1,00,00,000."); return; }
    const wanted = Number(rawAmount);
    const room = Math.max(0, (Number(g.target)||0) - (Number(g.saved)||0));
    if (room === 0) { showToast("This goal is already fully funded."); return; }
    const fromCash = source === "cash";
    const available = fromCash
      ? (Number(pot.usableCash)||0)
      : (Number(resolveBank(source, banks)?.balance)||0);
    const srcName = fromCash ? "cash" : (resolveBank(source, banks)?.name || "your bank");
    if (available <= 0) { showToast(`No money available in ${srcName}.`); return; }

    // Never overshoot the target, and never spend more than is actually there.
    const amt = Math.min(wanted, room, available);

    setPot(p => ({
      ...p,
      usableCash: fromCash ? Math.max(0, (Number(p.usableCash)||0) - amt) : p.usableCash,
      savings: (Number(p.savings)||0) + amt,
    }));
    if (!fromCash) setBanks(b => deductBank(b, source, amt));
    setGoals(prev => prev.map(x => x.id!==goalId ? x : {
      ...x,
      saved: (Number(x.saved)||0) + amt,
      contributions: [...(x.contributions||[]), { id:uid(), amount:amt, date:today, source }].slice(-50),
    }));

    const hit = (Number(g.saved)||0) + amt >= (Number(g.target)||0);
    const trimmed = amt < wanted;
    showToast(hit
      ? `🎯 ${g.name} fully funded!`
      : `₹${amt.toLocaleString()} set aside${trimmed ? ` (capped by ${srcName})` : ""}`);
    setGoalFundAmt("");
  }

  // Pull money back out of a goal and return it to a bank or to cash.
  function unfundGoal(goalId, rawAmount, dest) {
    const g = goals.find(x => x.id===goalId);
    if (!g) return;
    const parked = Number(g.saved)||0;
    if (parked <= 0) { showToast("Nothing set aside for this goal yet."); return; }
    if (!isValidAmount(rawAmount)) { showToast("Enter an amount between 1 and 1,00,00,000."); return; }
    const amt = Math.min(Number(rawAmount), parked);
    const toCash = dest === "cash";

    setGoals(prev => prev.map(x => x.id!==goalId ? x : {
      ...x,
      saved: Math.max(0, (Number(x.saved)||0) - amt),
      contributions: [...(x.contributions||[]), { id:uid(), amount:-amt, date:today, source:dest }].slice(-50),
    }));
    setPot(p => ({
      ...p,
      usableCash: toCash ? (Number(p.usableCash)||0) + amt : p.usableCash,
      savings: Math.max(0, (Number(p.savings)||0) - amt),
    }));
    if (!toCash) setBanks(b => refundBank(b, dest, amt));

    showToast(`₹${amt.toLocaleString()} moved back to ${toCash ? "cash" : (resolveBank(dest, banks)?.name || "your bank")}`);
    setGoalFundAmt("");
  }

  function openGoalFunder(goalId, mode) {
    setGoalFundId(prev => (prev===goalId && goalFundMode===mode ? null : goalId));
    setGoalFundMode(mode);
    setGoalFundAmt("");
    const def = banks.find(b => b.isDefault) || banks[0];
    setGoalFundSource(def ? `bank:${def.id}` : "cash");
  }

  // ── PIN / biometrics ──────────────────────────────────────────────────────
  function resetPin() { storageRemove(KEYS.PIN); storageRemove(KEYS.BIO_CRED); setUnlocked(false); showToast("PIN cleared - set a new one on next open"); }
  function resetBiometric() { storageRemove(KEYS.BIO_CRED); showToast("Biometrics removed"); }

  // ── Name ──────────────────────────────────────────────────────────────────
  function saveName() { const n = nameInput.trim(); if (!n) return; setUserName(n); setEditingName(false); setNameInput(""); showToast("Name saved!"); }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg       = isRetro ? RETRO_THEME.bg       : dark ? "#030712" : "#f8fafc";
  const cardBg   = isRetro ? RETRO_THEME.cardBg   : dark ? "#111827" : "#ffffff";
  const border   = isRetro ? RETRO_THEME.border   : dark ? "#1f2937" : "#f1f5f9";
  const textMain = isRetro ? RETRO_THEME.textMain : dark ? "#f9fafb" : "#111827";
  const textMute = isRetro ? RETRO_THEME.textMute : dark ? "#6b7280" : "#6b7280";
  const inputBg  = isRetro ? RETRO_THEME.inputBg  : dark ? "#1f2937" : "#ffffff";
  const inputBorder = isRetro ? RETRO_THEME.inputBorder : dark ? "#374151" : "#e5e7eb";
  const subbg    = isRetro ? RETRO_THEME.subbg    : dark ? "#1f2937" : "#f8fafc";
  const R = isRetro ? { card:0, input:0, btn:0 } : { card:16, input:12, btn:12 }; // true sharp rectangles in Retro theme

  // Retro cards are a single visual language: thick ink outline + hard offset
  // shadow, no rounding. Every card in the app now shares these three tokens
  // instead of hand-rolling `1px solid ${border}` at each call site.
  const cardBorderW = isRetro ? "2.5px" : "1px";
  const cardBorder  = `${cardBorderW} solid ${border}`;
  const cardShadow  = isRetro ? "4px 4px 0px 0px rgba(14,28,84,1)" : "none";
  // Same treatment with a caller-supplied border colour (used by the accent-
  // tinted cards, which previously hardcoded their own 1px border).
  const tintBorder  = (c) => `${cardBorderW} solid ${c}`;
  const cardStyle  = { background:cardBg, border:cardBorder, borderRadius:R.card, padding:16, marginBottom:12, boxShadow:cardShadow };
  const inputStyle = { background:inputBg, border:isRetro?`2.5px solid ${inputBorder}`:`1px solid ${inputBorder}`, color:textMain, borderRadius:R.input, padding:"10px 12px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box" };
  const btnPrimary   = { background:accent, color:isRetro?RETRO_THEME.border:"#fff", border:isRetro?`2.5px solid ${RETRO_THEME.border}`:"none", borderRadius:R.btn, padding:"10px 16px", fontSize:14, fontWeight:800, cursor:"pointer" };
  const btnSecondary = { background:isRetro?"#ffffff":(dark?"#374151":"#f3f4f6"), color:isRetro?RETRO_THEME.textMain:(dark?"#d1d5db":"#374151"), border:isRetro?`2.5px solid ${RETRO_THEME.border}`:"none", borderRadius:R.btn, padding:"8px 12px", fontSize:13, fontWeight:isRetro?700:500, cursor:"pointer" };
  const btnGreen  = { background:isRetro?"#e1f7ea":(dark?"#064e3b":"#d1fae5"), color:isRetro?"#0f7a4a":(dark?"#34d399":"#065f46"), border:isRetro?"2.5px solid #0f7a4a":"none", borderRadius:R.btn, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 };
  const btnDanger = { background:"none", border:"none", cursor:"pointer", color:textMute, padding:4 };

  // ── Inject CSS custom property for accent ─────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  // ── LOCK SCREEN ───────────────────────────────────────────────────────────
  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} dark={dark} accent={accent} isRetro={isRetro} userName={userName}/>;

  // ── CATEGORY DRILL-DOWN ───────────────────────────────────────────────────
  if (drillCat) {
    // Drill-down respects the active period filter
    const catExpenses = [...periodExpenses].filter(e => e.category===drillCat).sort((a,b) => new Date(b.date)-new Date(a.date));
    const catTotal = catExpenses.reduce((s,e) => s+e.amount, 0);
    const periodLabel = viewDay !== "all" ? formatDate(viewDay) : (() => { const [yr,mo] = viewMonth.split("-"); return MONTH_LABELS[Number(mo)-1]+" "+yr; })();
    const catAccent = getCatAccent(drillCat);
    return (
      <ErrorBoundary dark={dark}>
        <div className={isRetro?"retro-sharp":undefined} style={{ minHeight:"100vh", background:bg, color:textMain, fontFamily:"'DM Sans',sans-serif" }}>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&family=Racing+Sans+One&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
          <style>{`@keyframes tabFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.tabContent{animation:tabFade 0.15s ease}.mny-mask{filter:blur(7px);user-select:none;}${isRetro ? `.retro-sharp, .retro-sharp *, .retro-sharp *::before, .retro-sharp *::after { border-radius:0 !important; } .retro-sharp { font-family:'Space Grotesk','DM Sans',sans-serif !important; } .retro-sharp [style*="monospace"] { font-family:'Space Mono',monospace !important; }` : ``}`}</style>
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
      <div className={isRetro?"retro-sharp":undefined} style={{ minHeight:"100vh", background:bg, color:textMain, fontFamily:"'DM Sans',sans-serif", transition:"background 0.3s" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&family=Racing+Sans+One&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
        <style>{`
          @keyframes tabFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
          @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
          .tabContent{animation:tabFade 0.15s ease}
          input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:1}
          input[type=number]{-moz-appearance:textfield}
          .mny-mask{filter:blur(7px);user-select:none;transition:filter 0.15s ease;}
          ${isRetro ? `.retro-sharp { font-family:'Space Grotesk','DM Sans',sans-serif !important; }` : ``}
          ${isRetro ? `.retro-sharp [style*="monospace"]{ font-family:'Space Mono',monospace !important; }` : ``}
          ${isRetro ? `.retro-display{ font-family:'Racing Sans One',cursive !important; }` : ``}
          ${isRetro ? `.retro-sharp, .retro-sharp *, .retro-sharp *::before, .retro-sharp *::after { border-radius:0 !important; }` : ``}
        `}</style>

        <Toast msg={toast}/>

        <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 16px" }} key={tab} className="tabContent">

          {/* ── HEADER ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => { haptic(8); setShowSettings(true); }}
                style={{ width:40,height:40,borderRadius:isRetro?0:"50%",background:avatarColor(userName,isRetro),border:isRetro?`2px solid ${RETRO_THEME.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:isRetro?"none":"0 2px 8px rgba(0,0,0,0.15)" }}>
                {avatarId && avatarId !== "initials"
                  ? <span style={{ fontSize:22,lineHeight:1 }}>{avatarId}</span>
                  : <span style={{ fontSize:15,fontWeight:800,color:isRetro?RETRO_THEME.border:"#fff",letterSpacing:"-0.5px" }}>{getInitials(userName)}</span>
                }
              </button>
              <div>
                <h1 className={isRetro?"retro-display":undefined} style={{ margin:0,fontSize:isRetro?21:18,fontWeight:700,letterSpacing:"-0.3px",color:textMain }}>{tab==="home"?getGreeting(userName):"mySpendr"}</h1>
                <p style={{ margin:0,fontSize:11,color:textMute,marginTop:1 }}>{simpleMode?"Simple mode · tap avatar for settings":tab==="home"?(userName?"":"Tap avatar to set your name"):"Track. Save. Streak."}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {!simpleMode && (
              <button onClick={() => { haptic(8); setTab("split"); }} title="Split"
                style={{ ...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center",position:"relative",color:tab==="split"?accent:btnSecondary.color,border:tab==="split"&&isRetro?`2.5px solid ${accent}`:btnSecondary.border }}>
                <UsersIcon size={18}/>
              </button>
              )}
              <button onClick={() => { haptic(8); setShowNotifPanel(true); }} title="Notifications"
                style={{ ...btnSecondary,padding:"8px 10px",display:"flex",alignItems:"center",position:"relative" }}>
                <BellIcon/>
                {reminders.length>0 && <span style={{ position:"absolute",top:5,right:5,width:8,height:8,borderRadius:"50%",background:"#ef4444",border:`2px solid ${cardBg}` }}/>}
              </button>
              <button onClick={() => { if (isRetro) return; haptic(8); setDark(d => !d); }}
                style={{ ...btnSecondary, padding:"8px 10px", display:"flex", alignItems:"center", opacity:isRetro?0.5:1, cursor:isRetro?"not-allowed":"pointer" }}>
                {dark?<SunIcon/>:<MoonIcon/>}
              </button>
              <button onClick={() => { haptic(8); setHideAmounts(h => !h); }} title={hideAmounts?"Show amounts":"Hide amounts"}
                style={{ ...btnSecondary, padding:"8px 10px", display:"flex", alignItems:"center", color:hideAmounts?accent:btnSecondary.color, border:hideAmounts&&isRetro?`2.5px solid ${accent}`:btnSecondary.border }}>
                {hideAmounts?<EyeOffIcon/>:<EyeIcon/>}
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SIMPLE MODE - one page, nothing but log-and-view
              Budget left → add an expense → today's expenses. No tabs, no nav,
              no charts, no net worth. Settings stays reachable via the avatar
              so simple mode can always be switched back off.
          ════════════════════════════════════════════════════════════════ */}
          {simpleMode && (
            <>
              {/* Budget left */}
              <div style={cardStyle}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:budget>0?10:0 }}>
                  <span style={{ fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>
                    {budget>0 ? "Budget left" : "Spent this month"}
                  </span>
                  <button onClick={() => { setEditingBudget(e => !e); setBudgetInput(budget||""); }}
                    style={{ ...btnSecondary,padding:"5px 10px",fontSize:12 }}>
                    {editingBudget ? "Cancel" : budget>0 ? "Edit" : "Set budget"}
                  </button>
                </div>

                {editingBudget ? (
                  <div style={{ display:"flex",gap:8 }}>
                    <input type="number" inputMode="decimal" value={budgetInput}
                      onChange={e => setBudgetInput(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") saveBudget(); }}
                      placeholder="Monthly budget" autoFocus style={{ ...inputStyle,flex:1 }}/>
                    <button onClick={saveBudget} style={btnPrimary}>Save</button>
                  </div>
                ) : budget>0 ? (
                  <>
                    <p className={mny} style={{ margin:0,fontSize:34,fontWeight:800,fontFamily:"'DM Mono',monospace",letterSpacing:"-1px",
                      color:remaining<0?"#ef4444":"#16a34a" }}>
                      {remaining<0 ? "-" : ""}₹{Math.abs(remaining).toLocaleString()}
                    </p>
                    <div style={{ height:10,background:subbg,borderRadius:isRetro?0:99,overflow:"hidden",marginTop:10,
                      border:isRetro?cardBorder:"none" }}>
                      <div style={{ width:`${percentUsed}%`,height:"100%",
                        background:percentUsed>=90?"#ef4444":percentUsed>=75?"#f59e0b":accent,transition:"width 0.3s" }}/>
                    </div>
                    <p className={mny} style={{ margin:"8px 0 0",fontSize:12,color:textMute }}>
                      ₹{monthlyTotal.toLocaleString()} of ₹{budget.toLocaleString()} spent
                      {remaining<0 ? " · over budget" : ""}
                    </p>
                  </>
                ) : (
                  <p className={mny} style={{ margin:0,fontSize:34,fontWeight:800,fontFamily:"'DM Mono',monospace",letterSpacing:"-1px",color:textMain }}>
                    ₹{monthlyTotal.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Add an expense */}
              <div style={cardStyle}>
                <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600,color:textMain }}>
                  {editingId ? "Edit expense" : "Add an expense"}
                </h2>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Amount (₹)</label>
                    <input type="number" inputMode="decimal" value={amount}
                      onChange={e => { const v=e.target.value; if(v===""||Number(v)>=0&&Number(v)<=MAX_AMOUNT) setAmount(v); }}
                      onKeyDown={e => { if(e.key==="Enter") saveExpense(); }}
                      placeholder="0" min="0" max={MAX_AMOUNT} autoFocus
                      style={{ ...inputStyle,animation:amountShake?"shake 0.4s ease":"none",
                        outline:amountShake?"2px solid #ef4444":"none",fontSize:18,fontWeight:700,fontFamily:"'DM Mono',monospace" }}/>
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Category</label>
                    <select value={selCat} onChange={e => setSelCat(e.target.value)} style={inputStyle}>
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Note (optional)</label>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="What was this for?"
                    onKeyDown={e => { if(e.key==="Enter") saveExpense(); }} style={inputStyle}/>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:6 }}>Pay from</label>
                  <SourcePill value={paySource} onChange={setPaySource} dark={dark} subbg={subbg} border={border} textMute={textMute} banks={banks} isRetro={isRetro}/>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={() => { haptic([10,20,10]); saveExpense(); }} style={{ ...btnPrimary,flex:1,padding:"12px 16px",fontSize:15 }}>
                    {editingId ? "Update" : "Add expense"}
                  </button>
                  {editingId && <button onClick={resetExpenseForm} style={btnSecondary}>Cancel</button>}
                </div>
              </div>

              {/* Today's expenses */}
              <div style={cardStyle}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10 }}>
                  <h2 style={{ margin:0,fontSize:14,fontWeight:600,color:textMain }}>Today</h2>
                  <span className={mny} style={{ fontSize:15,fontWeight:800,fontFamily:"'DM Mono',monospace",color:textMain }}>
                    ₹{todaysTotal.toLocaleString()}
                  </span>
                </div>
                {todaysExpenses.length===0 ? (
                  <p style={{ margin:0,fontSize:13,color:textMute,textAlign:"center",padding:"18px 0" }}>
                    Nothing logged yet today.
                  </p>
                ) : (
                  <div>
                    {todaysExpenses.map((item, i) => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",
                        borderTop:i===0?"none":`1px solid ${border}` }}>
                        <span style={{ ...getCatStyle(item.category),padding:"3px 9px",borderRadius:isRetro?0:99,fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>
                          {item.category}
                        </span>
                        <span style={{ fontSize:13,color:textMute,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          {item.note || "-"}
                        </span>
                        <span className={mny} style={{ fontSize:14,fontWeight:700,fontFamily:"'DM Mono',monospace",color:textMain }}>
                          ₹{item.amount.toLocaleString()}
                        </span>
                        <button onClick={() => editExpense(item)} style={btnDanger} title="Edit"><EditIcon/></button>
                        <button onClick={() => { haptic(12); deleteExpense(item.id); }} style={btnDanger} title="Delete"><TrashIcon/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              HOME TAB
          ════════════════════════════════════════════════════════════════ */}
          {!simpleMode && tab==="home" && (
            <>
              {/* ── STREAK CARD ── */}
              {!simpleMode && (
              <StreakCard
                streak={streak}
                todayLogged={todayLogged}
                last14={last14}
                freezeData={freezeData}
                dark={dark}
                isRetro={isRetro}
                accent={accent}
                cardBg={cardBg}
                border={border}
                textMain={textMain}
                textMute={textMute}
                subbg={subbg}
                cardStyle={cardStyle}
                onLog={() => { haptic([10,50,10]); logNoSpend(); }}
                onFreeze={() => { haptic([10,30,10]); activateFreeze(); }}
              />
              )}

              <div style={{ height:12 }}/>

              {/* Stats grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div style={{ background:cardBg,border:cardBorder,borderRadius:R.card,padding:"14px 16px",boxShadow:cardShadow }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Spent this month</p>
                  <p className={mny} style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:percentUsed>=90?"#ef4444":textMain,letterSpacing:"-0.5px" }}>₹{monthlyTotal.toLocaleString()}</p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{daysElapsed} days so far</p>
                </div>
                <div style={{ background:cardBg,border:cardBorder,borderRadius:R.card,padding:"14px 16px",boxShadow:cardShadow }}>
                  {/* FIX: shows budget remaining (monthly) or net income-expenses */}
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>{budget>0?"Budget left":"Net this month"}</p>
                  <p className={mny} style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:(budget>0?remaining:totalIn-monthlyTotal)<0?"#ef4444":"#16a34a",letterSpacing:"-0.5px" }}>
                    {budget>0
                      ? (remaining>=0?"+":"")+"₹"+Math.abs(remaining).toLocaleString()
                      : ((totalIn-monthlyTotal)>=0?"+":"")+"₹"+Math.abs(totalIn-monthlyTotal).toLocaleString()
                    }
                  </p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>{budget>0?(remaining>=0?"available":"over budget"):"income - expenses"}</p>
                </div>
                {!simpleMode && (
                <div onClick={() => { if(topCategory){haptic(8);setDrillCat(topCategory);} }}
                  style={{ background:cardBg,border:tintBorder(topCategory?(dark?"#374151":"#e0e7ff"):border),borderRadius:16,padding:"14px 16px",cursor:topCategory?"pointer":"default" }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Top category</p>
                  {topCategory
                    ? <><p style={{ margin:0,fontSize:16,fontWeight:700,color:textMain,display:"flex",alignItems:"center",gap:4 }}>
                          <span style={{ ...getCatStyle(topCategory),padding:"2px 8px",borderRadius:99,fontSize:12 }}>{topCategory}</span>
                        </p>
                        <p style={{ margin:"5px 0 0",fontSize:11,color:textMute }}>₹{(allTimeCatTotals[topCategory]||0).toLocaleString()} · tap →</p>
                      </>
                    : <p style={{ margin:0,fontSize:16,fontWeight:700,color:textMute }}>-</p>
                  }
                </div>
                )}
                {!simpleMode && (
                <div style={{ background:cardBg,border:cardBorder,borderRadius:R.card,padding:"14px 16px",boxShadow:cardShadow }}>
                  <p style={{ margin:0,fontSize:11,color:textMute,fontWeight:500,marginBottom:4 }}>Daily avg</p>
                  <p style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:textMain }}>₹{dailyAvg.toLocaleString()}</p>
                  <p style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>this month</p>
                </div>
                )}
              </div>

              {!simpleMode && expenses.length>0 && <SpendingTrendChart data={trendData} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} isRetro={isRetro}/>}

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
                    <span>₹{spent.toLocaleString()} this month{excludedCats.length>0?" (excl. "+excludedCats.join(", ")+")":""}</span>
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
                  <div style={{ background:cardBg,border:cardBorder,borderRadius:16,overflow:"hidden",marginBottom:12 }}>
                    <div style={{ padding:"12px 16px",borderBottom:`1px solid ${border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ fontSize:13,fontWeight:700,color:textMain }}>Today's spends</span>
                      <span style={{ fontSize:13,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#ef4444" }}>-₹{todayTotal.toLocaleString()}</span>
                    </div>
                    {todayItems.slice(0,5).map((item,i) => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<Math.min(todayItems.length,5)-1?`1px solid ${border}`:"none" }}>
                        <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,...getCatStyle(item.category),whiteSpace:"nowrap" }}>{item.category}</span>
                        <span style={{ flex:1,fontSize:12,color:textMute,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.note||"-"}</span>
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
          {!simpleMode && tab==="expenses" && (
            <>
              {/* ── Period selector card ── */}
              <div style={{ background:cardBg,border:cardBorder,borderRadius:16,padding:"12px 14px",marginBottom:12 }}>
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
                  {/* Day - always show, disable when no data */}
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
                      -₹{periodExpenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Category donut - scoped to selected period */}
              <CategoryBubbles categories={categories} catTotals={catTotals} getCatStyle={getCatStyle} getCatAccent={getCatAccent} onSelect={name => { setDrillCat(name); }} dark={dark} cardBg={cardBg} border={border} textMute={textMute} open={catDropdownOpen} setOpen={setCatDropdownOpen}/>

              {/* Expense list - scoped to selected period */}
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
              POT TAB
          ════════════════════════════════════════════════════════════════ */}
          {!simpleMode && tab==="pot" && (
            <>
              {!simpleMode && (
              <div style={{ display:"flex",gap:4,marginBottom:12,background:subbg,borderRadius:12,padding:4,border:cardBorder }}>
                {[["usable","Usable"],["networth","Net Worth"],["goals","Goals"],["income","Income"]].map(([k,label]) => (
                  <button key={k} onClick={() => setPotSection(k)}
                    style={{ flex:1,padding:"7px 0",borderRadius:isRetro?0:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:potSection===k?cardBg:"transparent",color:potSection===k?textMain:textMute,boxShadow:potSection===k?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.2s" }}>
                    {label}
                  </button>
                ))}
              </div>
              )}

              {potSection==="usable" && (
                <>
                  <div style={{ ...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1c1410)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:dark?"1px solid #292117":"1px solid #fde68a",display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10 }}>
                    <MoneyBag fillPercent={usableFillPct} size="lg"/>
                    <p className={`mpulse${mny?" "+mny:""}`} style={{ fontSize:26,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal<=0?"#ef4444":"#f59e0b",letterSpacing:"-1.5px",margin:0 }}>
                      ₹{usableTotal.toLocaleString()}
                    </p>
                    <div style={{ width:"100%",maxWidth:280 }}><div style={{ width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#fde68a" }}><div style={{ height:8,borderRadius:99,width:`${usableFillPct}%`,background:"linear-gradient(to right,#f97316,#fbbf24)",transition:"width 0.7s ease" }}/></div></div>
                  </div>
                  {/* Cash row */}
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:cashMode?10:0 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#16a34a" }}/>
                      <span style={{ flex:1,fontSize:14,fontWeight:600 }}>Cash in Hand</span>
                      <span className={mny} style={{ fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#16a34a" }}>₹{(Number(pot.usableCash)||0).toLocaleString()}</span>
                      <div style={{ display:"flex",gap:4 }}>
                        <button onClick={() => setCashMode(cashMode==="add"?null:"add")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:cashMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1 }}>+</button>
                        <button onClick={() => setCashMode(cashMode==="minus"?null:"minus")} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:cashMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:cashMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1 }}>-</button>
                      </div>
                    </div>
                    {cashMode && (
                      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                        <input type="number" inputMode="decimal" value={cashAdj} onChange={e => setCashAdj(e.target.value)} placeholder={`₹ to ${cashMode}`} style={{ ...inputStyle,flex:1 }} autoFocus
                          onKeyDown={e => { if(e.key==="Enter"){quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null);} }}/>
                        <button onClick={() => { quickAdjust("usableCash",cashMode,cashAdj);setCashAdj("");setCashMode(null); }} style={{ ...btnPrimary,padding:"8px 14px",background:cashMode==="add"?"#16a34a":"#dc2626" }}>{cashMode==="add"?"+":"-"}</button>
                        <button onClick={() => { setCashMode(null);setCashAdj(""); }} style={{ ...btnSecondary,padding:"8px 10px" }}>✕</button>
                      </div>
                    )}
                  </div>
                  {/* Per-bank balance cards + Bank Manager */}
                  {banks.map(bk => {
                    const bkMode = bankMode && bankMode.id===bk.id ? bankMode.dir : null;
                    return (
                      <div key={bk.id} style={{ ...cardStyle,border:bk.isDefault?tintBorder(dark?"#1e3a8a":"#bfdbfe"):cardStyle.border }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:bkMode?10:0 }}>
                          <div style={{ width:10,height:10,borderRadius:"50%",background:"#2563eb",flexShrink:0 }}/>
                          <div style={{ flex:1,minWidth:0 }}>
                            <span style={{ fontSize:14,fontWeight:700,color:dark?"#f9fafb":"#111827" }}>{bk.name}</span>
                            {bk.isDefault && <span style={{ marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,background:dark?"#172554":"#dbeafe",color:dark?"#93c5fd":"#1d4ed8" }}>DEFAULT</span>}
                          </div>
                          <span className={mny} style={{ fontSize:18,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#2563eb" }}>₹{(Number(bk.balance)||0).toLocaleString()}</span>
                          <div style={{ display:"flex",gap:4 }}>
                            <button onClick={() => setBankMode(bkMode==="add"?null:{id:bk.id,dir:"add"})} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bkMode==="add"?"#16a34a":(dark?"#1f2937":"#f0fdf4"),color:bkMode==="add"?"#fff":(dark?"#34d399":"#16a34a"),lineHeight:1 }}>+</button>
                            <button onClick={() => setBankMode(bkMode==="minus"?null:{id:bk.id,dir:"minus"})} style={{ width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,background:bkMode==="minus"?"#dc2626":(dark?"#1f2937":"#fff1f2"),color:bkMode==="minus"?"#fff":(dark?"#f87171":"#dc2626"),lineHeight:1 }}>-</button>
                          </div>
                        </div>
                        {bkMode && (
                          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                            <input type="number" inputMode="decimal" value={bankAdj} onChange={e => setBankAdj(e.target.value)} placeholder={`₹ to ${bkMode}`} style={{ ...inputStyle,flex:1 }} autoFocus
                              onKeyDown={e => { if(e.key==="Enter"){ adjustBankBalanceDirect(bk.id,bkMode,bankAdj);setBankAdj("");setBankMode(null); } }}/>
                            <button onClick={() => { adjustBankBalanceDirect(bk.id,bkMode,bankAdj);setBankAdj("");setBankMode(null); }} style={{ ...btnPrimary,padding:"8px 14px",background:bkMode==="add"?"#16a34a":"#dc2626" }}>{bkMode==="add"?"+":"-"}</button>
                            <button onClick={() => { setBankMode(null);setBankAdj(""); }} style={{ ...btnSecondary,padding:"8px 10px" }}>✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Bank Manager */}
                  <div style={{ ...cardStyle,marginBottom:12 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                      <BankIcon/>
                      <span style={{ fontSize:13,fontWeight:700,color:textMain }}>Manage Banks</span>
                      <button onClick={() => { setBankEditId(null);setBankFormName("");setBankFormBalance(""); setShowBankManager(s=>!s); }}
                        style={{ marginLeft:"auto",...btnSecondary,padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:4 }}>
                        {showBankManager?"Done":<><PlusIcon/>Add Bank</>}
                      </button>
                    </div>
                    {showBankManager && (
                      <div style={{ marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${border}` }}>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                          <input value={bankFormName} onChange={e => setBankFormName(e.target.value)} placeholder="Bank name" style={inputStyle}/>
                          <input type="number" inputMode="decimal" value={bankFormBalance} onChange={e => setBankFormBalance(e.target.value)} placeholder="Balance ₹" style={inputStyle}/>
                        </div>
                        <div style={{ display:"flex",gap:8 }}>
                          <button onClick={saveBank} style={{ ...btnPrimary,flex:1 }}>{bankEditId?"Update":"Add Bank"}</button>
                          {bankEditId && <button onClick={() => { setBankEditId(null);setBankFormName("");setBankFormBalance(""); }} style={btnSecondary}>Cancel</button>}
                        </div>
                      </div>
                    )}
                    {banks.map((bk,i) => (
                      <div key={bk.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<banks.length-1?`1px solid ${border}`:"none" }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <span style={{ fontSize:13,fontWeight:600,color:textMain }}>{bk.name}</span>
                          {bk.isDefault && <span style={{ marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,background:dark?"#172554":"#dbeafe",color:dark?"#93c5fd":"#1d4ed8" }}>DEFAULT</span>}
                          <p className={mny} style={{ margin:"2px 0 0",fontSize:12,fontFamily:"'DM Mono',monospace",color:"#2563eb" }}>₹{(Number(bk.balance)||0).toLocaleString()}</p>
                        </div>
                        <div style={{ display:"flex",gap:5,flexShrink:0 }}>
                          {!bk.isDefault && (
                            <button onClick={() => { setDefaultBank(bk.id); }} title="Set as default"
                              style={{ padding:"4px 8px",borderRadius:8,border:`1px solid ${dark?"#374151":"#e5e7eb"}`,background:"none",cursor:"pointer",fontSize:11,color:textMute,fontWeight:600 }}>★ Default</button>
                          )}
                          <button onClick={() => { setBankEditId(bk.id);setBankFormName(bk.name);setBankFormBalance(bk.balance||"");setShowBankManager(true); }} style={{ ...btnDanger,padding:4 }}><EditIcon/></button>
                          <button onClick={() => deleteBank(bk.id)} style={{ ...btnDanger,padding:4 }}><TrashIcon/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center" }}><span style={{ fontSize:13,color:textMute }}>Total Usable</span><span className={mny} style={{ fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"'DM Mono',monospace" }}>₹{usableTotal.toLocaleString()}</span></div>
                  <div style={{ ...cardStyle,background:dark?"#0a1628":"#f0fdf4",border:tintBorder(dark?"#1e3a5f":"#bbf7d0") }}>
                    <p style={{ margin:"0 0 4px",fontSize:12,color:textMute }}>After all expenses this month</p>
                    <p className={mny} style={{ margin:0,fontSize:22,fontWeight:800,fontFamily:"'DM Mono',monospace",color:usableTotal-monthlyTotal>=0?"#16a34a":"#ef4444" }}>₹{(usableTotal-monthlyTotal).toLocaleString()}</p>
                    <p style={{ margin:"4px 0 0",fontSize:11,color:textMute }}>Spent ₹{monthlyTotal.toLocaleString()} this month</p>
                  </div>
                </>
              )}

              {potSection==="networth" && (
                <>
                  <div style={{ ...cardStyle,background:dark?"linear-gradient(135deg,#111827,#1a1028)":"linear-gradient(135deg,#faf5ff,#ede9fe)",border:tintBorder(dark?"#2e1065":"#ddd6fe"),display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 16px",gap:10 }}>
                    <MoneyBag fillPercent={nwFillActual} size="lg"/>
                    <p className={`mpulse${mny?" "+mny:""}`} style={{ fontSize:30,fontWeight:800,fontFamily:"'DM Mono',monospace",color:"#7c3aed",letterSpacing:"-1.5px",margin:0 }}>₹{Math.abs(netWorthTotal).toLocaleString()}</p>
                    <div style={{ width:"100%",maxWidth:280 }}><div style={{ width:"100%",height:8,borderRadius:99,overflow:"hidden",background:dark?"#1f2937":"#ddd6fe" }}><div style={{ height:8,borderRadius:99,width:`${nwFillActual}%`,background:"linear-gradient(to right,#7c3aed,#a78bfa)",transition:"width 0.7s ease" }}/></div></div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}><TrendIcon/><span style={{ fontSize:14,fontWeight:700 }}>Breakdown</span></div>
                    {[["usableCash","Cash in Hand","#16a34a"],["savings","Savings / FD","#7c3aed"],["investments","Investments","#db2777"]].map(([field,label,color]) => (
                      <div key={field} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                        <div style={{ width:10,height:10,borderRadius:"50%",background:color,flexShrink:0 }}/>
                        <span style={{ flex:1,fontSize:13 }}>{label}</span>
                        <span className={mny} style={{ fontSize:13,fontWeight:700,color,minWidth:90,textAlign:"right" }}>₹{(Number(pot[field])||0).toLocaleString()}</span>
                      </div>
                    ))}
                    {allocatedToGoals > 0 && (
                      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingLeft:20 }}>
                        <span style={{ flex:1,fontSize:11,color:textMute }}>↳ committed to goals</span>
                        <span className={mny} style={{ fontSize:11,fontWeight:600,color:textMute,minWidth:90,textAlign:"right" }}>₹{allocatedToGoals.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#2563eb",flexShrink:0 }}/>
                      <span style={{ flex:1,fontSize:13 }}>Bank Balance</span>
                      <span className={mny} style={{ fontSize:13,fontWeight:700,color:"#2563eb",minWidth:90,textAlign:"right" }}>₹{totalBankBalance.toLocaleString()}</span>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:"#d97706",flexShrink:0 }}/>
                      <div style={{ flex:1 }}><span style={{ fontSize:13 }}>Gold</span>{pot.goldGrams>0&&pot.goldRate>0&&<span className={mny} style={{ fontSize:11,color:textMute,marginLeft:6 }}>{pot.goldGrams}g × ₹{Number(pot.goldRate).toLocaleString()}/g</span>}</div>
                      <span className={mny} style={{ fontSize:13,fontWeight:700,color:"#d97706",minWidth:90,textAlign:"right" }}>₹{goldValue.toLocaleString()}</span>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4,borderTop:`1px solid ${border}` }}><span style={{ fontSize:13,color:textMute,fontWeight:600 }}>Total Net Worth</span><span className={mny} style={{ fontSize:20,fontWeight:800,color:"#7c3aed",fontFamily:"'DM Mono',monospace" }}>₹{netWorthTotal.toLocaleString()}</span></div>
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
                          <span className={mny} style={{ fontSize:12,color:dark?"#d97706":"#92400e" }}>{pot.goldGrams}g × ₹{Number(pot.goldRate).toLocaleString()}</span>
                          <span className={mny} style={{ fontSize:14,fontWeight:800,color:"#d97706",fontFamily:"'DM Mono',monospace" }}>= ₹{goldValue.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {potSection==="goals" && (
                <>
                  {/* Short-term goals: a trip, a gadget, a deposit. Money is
                      genuinely moved out of spendable balance into savings and
                      earmarked, so the "usable" figure reflects what's really
                      free to spend. */}
                  <div style={{ ...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <p style={{ margin:0,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>Set aside for goals</p>
                      <p className={mny} style={{ margin:"4px 0 0",fontSize:26,fontWeight:800,fontFamily:"'DM Mono',monospace",color:accent,letterSpacing:"-1px" }}>
                        ₹{allocatedToGoals.toLocaleString()}
                      </p>
                      <p className={mny} style={{ margin:"3px 0 0",fontSize:11,color:textMute }}>
                        across {goals.length} goal{goals.length===1?"":"s"} · ₹{unallocatedSavings.toLocaleString()} savings free
                      </p>
                    </div>
                    <div style={{ fontSize:34 }}>🎯</div>
                  </div>
                  <SavingsGoals goals={goals} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} subbg={subbg} inputBg={inputBg} inputBorder={inputBorder} today={today} isRetro={isRetro}
                    showGoalForm={showGoalForm} setShowGoalForm={setShowGoalForm} goalName={goalName} setGoalName={setGoalName} goalTarget={goalTarget} setGoalTarget={setGoalTarget}
                    goalDeadline={goalDeadline} setGoalDeadline={setGoalDeadline} goalEditId={goalEditId} setGoalEditId={setGoalEditId}
                    saveGoal={saveGoal} deleteGoal={deleteGoal} editGoal={editGoal} accent={accent}
                    banks={banks} usableCash={Number(pot.usableCash)||0} unallocatedSavings={unallocatedSavings} allocatedToGoals={allocatedToGoals}
                    goalFundId={goalFundId} goalFundAmt={goalFundAmt} setGoalFundAmt={setGoalFundAmt}
                    goalFundMode={goalFundMode} goalFundSource={goalFundSource} setGoalFundSource={setGoalFundSource}
                    openGoalFunder={openGoalFunder} fundGoal={fundGoal} unfundGoal={unfundGoal} mny={mny}/>
                </>
              )}

              {potSection==="income" && (
                <>
                  <div style={cardStyle}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:12 }}><RepeatIcon/><span style={{ fontSize:14,fontWeight:700 }}>Recurring Income</span><span className={mny} style={{ fontSize:16,fontWeight:700,color:"#16a34a",marginLeft:"auto",fontFamily:"'DM Mono',monospace" }}>₹{monthlyIncome.toLocaleString()}<span style={{ fontSize:11,color:textMute,fontWeight:400 }}>/mo</span></span></div>
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
          {!simpleMode && tab==="scanvoice" && (
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
                  <SourcePill value={paySource} onChange={setPaySource} dark={dark} subbg={subbg} border={border} textMute={textMute} banks={banks} isRetro={isRetro}/>
                </div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <button onClick={() => { haptic([10,20,10]); saveExpense(); }} style={{ ...btnPrimary,flex:1 }}>{editingId?"Update":"Add Expense"}</button>
                  {editingId && <button onClick={resetExpenseForm} style={btnSecondary}>Cancel</button>}
                  {!addingCat
                    ? <button onClick={() => setAddingCat(true)} style={{ ...btnSecondary,padding:"8px 12px",display:"flex",alignItems:"center",gap:4 }}><GridIcon/>+ Cat</button>
                    : <div style={{ display:"flex",gap:4,flex:1 }}>
                        <input ref={newCatInputRef} defaultValue="" placeholder="Category name" onKeyDown={e => e.key==="Enter"&&addCategory()} style={{ ...inputStyle,flex:1 }} autoFocus/>
                        <button onClick={addCategory} style={btnPrimary}>Add</button>
                        <button onClick={() => { if(newCatInputRef.current) newCatInputRef.current.value=""; setAddingCat(false); }} style={btnSecondary}>✕</button>
                      </div>
                  }
                </div>
              </div>

              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ flex:1,height:1,background:border }}/><span style={{ fontSize:11,fontWeight:600,color:textMute,textTransform:"uppercase",letterSpacing:"0.08em" }}>or use</span><div style={{ flex:1,height:1,background:border }}/>
              </div>

              {/* Category budget exclusion manager */}
              {excludedCats.length > 0 && (
                <div style={{ background:dark?"rgba(99,102,241,0.07)":"rgba(99,102,241,0.05)",border:`1px solid ${dark?"rgba(99,102,241,0.2)":"rgba(99,102,241,0.15)"}`,borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:12 }}>🎁</span>
                  <span style={{ fontSize:12,color:dark?"#818cf8":"#4f46e5",fontWeight:500,flex:1 }}>
                    <strong>{excludedCats.join(", ")}</strong> excluded from budget
                  </span>
                </div>
              )}
              <div style={{ background:cardBg,border:cardBorder,borderRadius:R.card,padding:14,marginBottom:12,boxShadow:cardShadow }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                  <GridIcon/>
                  <span style={{ fontSize:13,fontWeight:700,color:textMain }}>Manage Categories</span>
                  <span style={{ fontSize:11,color:textMute,marginLeft:4 }}>toggle budget exclusion</span>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {categories.map(cat => {
                    const cs = getCatStyle(cat.name);
                    const excluded = !!cat.excludeFromBudget;
                    const confirming = catDeleteConfirm === cat.name;
                    const isOthers = cat.name === "Others";
                    return (
                      <div key={cat.name} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:10,background:dark?"#1f2937":"#f8fafc",border:`1px solid ${excluded?(dark?"rgba(99,102,241,0.3)":"rgba(99,102,241,0.2)"):border}` }}>
                        <span style={{ ...cs,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600,flex:1,display:"flex",alignItems:"center",gap:4 }}>
                          {cat.name} {excluded && <span style={{ fontSize:10,opacity:0.8 }}>🎁</span>}
                        </span>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ fontSize:11,color:excluded?(dark?"#818cf8":"#4f46e5"):textMute,fontWeight:excluded?600:400 }}>
                            {excluded?"gift/transfer":"expense"}
                          </span>
                          <button onClick={() => { haptic(6); toggleCatBudgetExclusion(cat.name); showToast(excluded?`${cat.name} back in budget`:`${cat.name} excluded from budget`); }}
                            style={{ width:36,height:20,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:excluded?(dark?"#6366f1":"#4f46e5"):(dark?"#374151":"#e5e7eb"),transition:"background 0.2s",flexShrink:0 }}>
                            <div style={{ position:"absolute",top:2,left:excluded?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
                          </button>
                          {!isOthers && (
                            confirming
                              ? <button onClick={() => { haptic([10,20,10]); deleteCategory(cat.name); }}
                                  style={{ background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>Confirm?</button>
                              : <button onClick={() => { haptic(6); setCatDeleteConfirm(cat.name); }} title="Remove category"
                                  style={{ background:"none",border:"none",cursor:"pointer",color:textMute,display:"flex",alignItems:"center",padding:2,flexShrink:0 }}><TrashIcon/></button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <VoiceLogger categories={categories} onAdd={handleVoiceAdd} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} inputBg={inputBg} inputBorder={inputBorder} accent={accent}/>
              <ReceiptScanner categories={categories} onAdd={handleReceiptAdd} dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} inputBg={inputBg} inputBorder={inputBorder} accent={accent}/>

              {/* ── NO-SPEND DAY BACK-FILL ── */}
              {(() => {
                // Show last 7 days that weren't logged (excluding today if already logged)
                const last7 = getLastNDays(7);
                const missedDays = last7.filter(d => d !== today && !streak.loggedDates.includes(d));
                if (missedDays.length === 0) return null;
                return (
                  <div style={{ background:dark?"linear-gradient(135deg,#0a120a,#0d1f0d)":"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:dark?"1px solid rgba(52,211,153,0.2)":"1px solid #86efac",borderRadius:16,padding:"14px 16px",marginTop:4,marginBottom:12 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                      <span style={{ fontSize:16 }}>🌿</span>
                      <div>
                        <p style={{ margin:0,fontSize:13,fontWeight:700,color:dark?"#34d399":"#065f46" }}>No-Spend Day - Back Fill</p>
                        <p style={{ margin:0,fontSize:11,color:dark?"rgba(52,211,153,0.6)":"#16a34a" }}>Log a day you forgot to record</p>
                      </div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {missedDays.slice(0,5).map(d => {
                        return (
                          <button key={d} onClick={() => { haptic([10,30,10]); logDay(d); showToast(`No-spend day logged for ${formatDate(d)} 🌿`); }}
                            style={{ display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"9px 12px",borderRadius:10,border:dark?"1px solid rgba(52,211,153,0.25)":"1px solid #86efac",background:dark?"rgba(52,211,153,0.07)":"rgba(255,255,255,0.7)",cursor:"pointer",transition:"all 0.15s" }}>
                            <span style={{ fontSize:13,fontWeight:600,color:dark?"#6ee7b7":"#065f46" }}>{formatDate(d)}</span>
                            <span style={{ fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99,background:dark?"rgba(52,211,153,0.18)":"#d1fae5",color:dark?"#34d399":"#059669",display:"flex",alignItems:"center",gap:4 }}>
                              <span>🌿</span> Log no-spend
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              BILLS & LOANS TAB
          ════════════════════════════════════════════════════════════════ */}
          {!simpleMode && tab==="bills" && (
            <>
              {/* Sub-tab switcher */}
              <div style={{ display:"flex",background:subbg,borderRadius:14,padding:4,marginBottom:16,border:cardBorder }}>
                {[["recurring","🔁 Bills & Recurring"],["loans","🏦 Loans & EMIs"]].map(([id,label]) => (
                  <button key={id} onClick={() => setBillsSubTab(id)}
                    style={{ flex:1,padding:"8px 6px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                      background:billsSubTab===id ? (dark?"#1e293b":"#fff") : "transparent",
                      color:billsSubTab===id ? (id==="recurring"?accent:"#0ea5e9") : textMute,
                      boxShadow:billsSubTab===id?"0 1px 6px rgba(0,0,0,0.10)":"none",
                      transition:"all 0.15s",whiteSpace:"nowrap" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── BILLS & RECURRING sub-tab ── */}
              {billsSubTab==="recurring" && tab==="bills" && (
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
                        <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600 }}>{rEditId?"Edit":"New Bill / Recurring Payment"}</h2>
                        <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Name (e.g. Rent, Netflix, EMI)" style={{ ...inputStyle,marginBottom:8 }}/>
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
                        <p style={{ margin:"0 0 10px",fontSize:11,color:textMute }}>Reminder appears the day before and on the due date each month.</p>
                        <div style={{ display:"flex",gap:8 }}><button onClick={saveRecurring} style={{ ...btnPrimary,flex:1 }}>{rEditId?"Update":"Add"}</button><button onClick={resetRForm} style={btnSecondary}>Cancel</button></div>
                      </div>
                    : <button onClick={() => setShowRForm(true)} style={{ ...btnPrimary,width:"100%",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PlusIcon/>Add Bill / Recurring</button>
                  }
                  {recurring.length===0
                    ? <div style={{ ...cardStyle,textAlign:"center",padding:40 }}>
                        <p style={{ fontSize:28,marginBottom:8 }}>📋</p>
                        <p style={{ color:textMute,margin:0,fontWeight:600 }}>No bills yet</p>
                        <p style={{ color:textMute,fontSize:12,margin:"4px 0 0" }}>Add rent, subscriptions, utility bills here.</p>
                      </div>
                    : <div style={{ background:cardBg,border:cardBorder,borderRadius:R.card,overflow:"hidden",boxShadow:cardShadow }}>
                        {recurring.map((r,i) => {
                          const days = daysFromToday(r.nextDue);
                          const paidTM = (r.paid||[]).some(d => { const pd=new Date(d+"T00:00:00"); return pd.getMonth()===istNow.getMonth()&&pd.getFullYear()===istNow.getFullYear(); });
                          const isOverdue=days<0, isDueToday=days===0, dueSoon=days===1&&!paidTM;
                          return (
                            <div key={r.id} style={{ padding:"14px 16px",borderBottom:i<recurring.length-1?`1px solid ${border}`:"none" }}>
                              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                                    <span style={{ fontSize:15,fontWeight:700 }}>{r.name}</span>
                                    <span style={{ ...getCatStyle(r.category),padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600 }}>{r.category}</span>
                                    {isOverdue&&!paidTM&&<span style={{ background:"#fef2f2",color:"#dc2626",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700,border:"1px solid #fca5a5" }}>{Math.abs(days)}d overdue</span>}
                                    {isDueToday&&!paidTM&&<span style={{ background:"#fff7ed",color:"#ea580c",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700 }}>Due today</span>}
                                    {dueSoon&&<span style={{ background:"#fffbeb",color:"#ca8a04",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600 }}>Due tomorrow</span>}
                                    {paidTM&&<span style={{ background:dark?"#052e16":"#d1fae5",color:dark?"#34d399":"#065f46",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:3 }}><CheckIcon/>Paid</span>}
                                  </div>
                                  <div style={{ display:"flex",gap:16,fontSize:12,color:textMute }}><span>₹{r.amount.toLocaleString()} / {r.frequency}</span><span>Next: {formatDate(r.nextDue)}</span></div>
                                </div>
                                <div style={{ display:"flex",gap:6,alignItems:"center",marginLeft:8,flexWrap:"wrap",justifyContent:"flex-end" }}>
                                  {!paidTM && (
                                    <div style={{ display:"flex",gap:3,background:subbg,borderRadius:10,padding:3,border:cardBorder }}>
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

              {/* ── LOANS & EMIs sub-tab ── */}
              {billsSubTab==="loans" && tab==="bills" && (
                <EmiTab dark={dark} cardBg={cardBg} border={border} textMute={textMute} textMain={textMain} subbg={subbg} inputBg={inputBg} inputBorder={inputBorder}
                  setExpenses={setExpenses} setPot={setPot} showToast={showToast} today={today} logDay={logDay} accent={accent}
                  emis={emis} setEmis={setEmis} banks={banks} setBanks={setBanks} mny={mny}/>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SPLIT WITH FRIENDS TAB — kept separate from Expenses
          ════════════════════════════════════════════════════════════════ */}
          {!simpleMode && tab==="split" && (
            <>
              <div style={cardStyle}>
                <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600 }}>Friends</h2>
                <div style={{ display:"flex",gap:6,marginBottom:friends.length?12:0 }}>
                  <input ref={newFriendInputRef} defaultValue="" placeholder="Friend's name" onKeyDown={e => e.key==="Enter"&&addFriend()} style={{ ...inputStyle,flex:1 }}/>
                  <button onClick={addFriend} style={btnPrimary}>Add</button>
                </div>
                {friends.length>0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                    {friends.map(f => {
                      const confirming = friendDeleteConfirm===f.id;
                      return (
                        <div key={f.id} style={{ display:"flex",alignItems:"center",gap:6,background:subbg,border:cardBorder,borderRadius:99,padding:"6px 10px" }}>
                          <span style={{ fontSize:12,fontWeight:600,color:textMain }}>{f.name}</span>
                          {confirming
                            ? <button onClick={() => deleteFriend(f.id)} style={{ background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"2px 6px",fontSize:10,fontWeight:700,cursor:"pointer" }}>Confirm?</button>
                            : <button onClick={() => setFriendDeleteConfirm(f.id)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,display:"flex",alignItems:"center",padding:0 }}><XIcon/></button>
                          }
                        </div>
                      );
                    })}
                  </div>
                )}
                {friends.length===0 && <p style={{ margin:0,fontSize:12,color:textMute }}>Add friends here to start splitting bills with them. This never affects your expense totals.</p>}
              </div>

              <div style={cardStyle}>
                <h2 style={{ margin:"0 0 4px",fontSize:14,fontWeight:600 }}>New Split</h2>
                <p style={{ margin:"0 0 12px",fontSize:11,color:textMute }}>Kept separate from your Expenses — nothing here is added to your budget unless you log it yourself.</p>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Title (optional)</label>
                  <input value={splitTitle} onChange={e => setSplitTitle(e.target.value)} placeholder="e.g. Goa trip, Dinner" style={inputStyle}/>
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:textMute,marginBottom:4 }}>Split type</label>
                  <div style={{ display:"flex",gap:8 }}>
                    {[{id:"equal",label:"Equal split"},{id:"shares",label:"By shares"}].map(m => {
                      const active = splitMode===m.id;
                      return (
                        <button key={m.id} onClick={() => setSplitMode(m.id)}
                          style={{ flex:1,padding:"8px 10px",borderRadius:10,border:`1.5px solid ${active?accent:border}`,background:active?(dark?`${accent}22`:`${accent}11`):subbg,color:active?accent:textMute,fontSize:12,fontWeight:700,cursor:"pointer" }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  {splitMode==="shares" && <p style={{ margin:"6px 0 0",fontSize:11,color:textMute }}>Give each person a number of shares — e.g. B=2, C=1, A=1. Whoever has more shares owes more of the total. Leave blank for 1 share.</p>}
                </div>

                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"8px 10px",background:subbg,borderRadius:10,border:cardBorder }}>
                  <span style={{ fontSize:13,color:textMain }}>Include my own expenses in this split</span>
                  <button onClick={toggleSplitIncludeMe} style={{ width:40,height:22,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:splitIncludeMe?accent:(dark?"#374151":"#e5e7eb"),flexShrink:0 }}>
                    <div style={{ position:"absolute",top:2,left:splitIncludeMe?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
                  </button>
                </div>

                {friends.length===0
                  ? <p style={{ margin:0,fontSize:12,color:textMute }}>Add at least one friend above to create a split.</p>
                  : (
                    <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:12 }}>
                      {splitMode==="shares" && (
                        <div style={{ display:"flex",gap:8,paddingLeft:28 }}>
                          <span style={{ flex:1 }}/>
                          <span style={{ width:110,fontSize:10,fontWeight:700,color:textMute,textTransform:"uppercase",letterSpacing:"0.04em" }}>Paid</span>
                          <span style={{ width:80,fontSize:10,fontWeight:700,color:textMute,textTransform:"uppercase",letterSpacing:"0.04em" }}>Shares</span>
                        </div>
                      )}
                      {splitIncludeMe && (
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ flex:1,fontSize:13,color:textMain,fontWeight:600 }}>{userName||"Me"}</span>
                          <input type="number" inputMode="decimal" value={splitPaidMap.me||""} onChange={e => setSplitPaidMap(p => ({ ...p,me:e.target.value }))} placeholder="₹ paid" style={{ ...inputStyle,width:110 }}/>
                          {splitMode==="shares" && <input type="number" inputMode="decimal" value={splitShareMap.me||""} onChange={e => setSplitShare("me",e.target.value)} placeholder="1" style={{ ...inputStyle,width:80,textAlign:"center" }}/>}
                        </div>
                      )}
                      {friends.map(f => {
                        const checked = splitSelectedIds.includes(f.id);
                        return (
                          <div key={f.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                            <button onClick={() => toggleSplitParticipant(f.id)} style={{ width:20,height:20,borderRadius:6,border:`1.5px solid ${checked?accent:border}`,background:checked?accent:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff" }}>
                              {checked && <CheckIcon/>}
                            </button>
                            <span style={{ flex:1,fontSize:13,color:textMain }}>{f.name}</span>
                            {checked && <input type="number" inputMode="decimal" value={splitPaidMap[f.id]||""} onChange={e => setSplitPaid(f.id,e.target.value)} placeholder="₹ paid" style={{ ...inputStyle,width:110 }}/>}
                            {checked && splitMode==="shares" && <input type="number" inputMode="decimal" value={splitShareMap[f.id]||""} onChange={e => setSplitShare(f.id,e.target.value)} placeholder="1" style={{ ...inputStyle,width:80,textAlign:"center" }}/>}
                          </div>
                        );
                      })}
                      {splitMode==="shares" && splitSelectedIds.length>0 && (() => {
                        const entries = buildSplitEntries();
                        const totalShares = entries.reduce((s,e) => s + (Number(e.shares)>0?Number(e.shares):1), 0);
                        const paidTotal = entries.reduce((s,e)=>s+(Number(e.paid)||0),0);
                        const perShare = totalShares ? paidTotal/totalShares : 0;
                        return (
                          <p style={{ margin:0,fontSize:11,color:textMute }}>
                            {totalShares} shares total · ₹{perShare.toLocaleString(undefined,{maximumFractionDigits:2})} per share
                          </p>
                        );
                      })()}
                    </div>
                  )
                }

                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={previewSplit} style={{ ...btnSecondary,flex:1 }}>Preview</button>
                  <button onClick={saveSplit} style={{ ...btnPrimary,flex:1 }}>Save Split</button>
                </div>
              </div>

              {splitResult && (
                <div style={cardStyle}>
                  <h2 style={{ margin:"0 0 10px",fontSize:14,fontWeight:600 }}>Settlement</h2>
                  <p style={{ margin:"0 0 10px",fontSize:12,color:textMute }}>
                    Total ₹{splitResult.total.toLocaleString()} split {splitResult.balances.length} ways
                    {/* FIX: compared against "unequal", but the mode the UI
                        actually sets is "shares" - so a shares split was
                        labelled with the equal-split "₹X each" text. */}
                    {splitResult.mode==="shares" ? " · custom shares" : ` · ₹${Math.round(splitResult.share).toLocaleString()} each`}
                  </p>
                  {splitResult.transactions.length===0
                    ? <p style={{ margin:0,fontSize:13,color:textMain }}>Everyone's already even — nobody owes anything 🎉</p>
                    : (
                      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        {splitResult.transactions.map((t,i) => (
                          <div key={i} style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:subbg,borderRadius:10,border:cardBorder,fontSize:13 }}>
                            <strong style={{ color:textMain }}>{t.from}</strong>
                            <span style={{ color:textMute }}>owes</span>
                            <strong style={{ color:textMain }}>{t.to}</strong>
                            <span style={{ marginLeft:"auto",fontWeight:700,color:accent }}>₹{t.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  <button onClick={resetSplitForm} style={{ ...btnSecondary,marginTop:10,width:"100%" }}>New split</button>
                </div>
              )}

              {splits.length>0 && (
                <div style={cardStyle}>
                  <h2 style={{ margin:"0 0 12px",fontSize:14,fontWeight:600 }}>Past Splits</h2>
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {splits.map(s => {
                      const confirming = splitDeleteConfirm===s.id;
                      return (
                        <div key={s.id} style={{ padding:"10px 12px",background:subbg,borderRadius:12,border:cardBorder }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                            <span style={{ flex:1,fontSize:13,fontWeight:700,color:textMain }}>{s.title}</span>
                            <span style={{ fontSize:11,color:textMute }}>{formatDate(s.date)}</span>
                            {confirming
                              ? <button onClick={() => deleteSplit(s.id)} style={{ background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer" }}>Confirm?</button>
                              : <button onClick={() => setSplitDeleteConfirm(s.id)} style={{ background:"none",border:"none",cursor:"pointer",color:textMute,display:"flex",alignItems:"center",padding:0 }}><TrashIcon/></button>
                            }
                          </div>
                          <p style={{ margin:"0 0 6px",fontSize:11,color:textMute }}>₹{s.total.toLocaleString()} between {s.entries.map(e=>e.name).join(", ")}</p>
                          {s.transactions.length===0
                            ? <p style={{ margin:0,fontSize:12,color:textMain }}>Settled — nobody owed anything.</p>
                            : s.transactions.map((t,i) => (
                              <p key={i} style={{ margin:0,fontSize:12,color:textMain }}>{t.from} → {t.to}: <strong>₹{t.amount.toLocaleString()}</strong></p>
                            ))
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

        </div>{/* /maxWidth */}

        {/* ════════════════════════════════════════════════════════════════
            NOTIFICATION PANEL
        ════════════════════════════════════════════════════════════════ */}
        {showNotifPanel && (
          <>
            <div onClick={() => setShowNotifPanel(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,backdropFilter:"blur(2px)" }}/>
            <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:201,background:cardBg,borderRadius:isRetro?"0":"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)" }}>
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",flexShrink:0 }}><div style={{ width:36,height:4,borderRadius:99,background:dark?"#374151":"#e5e7eb" }}/></div>
              <div style={{ padding:"0 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
                <p style={{ margin:0,fontSize:16,fontWeight:700,color:textMain }}>Notifications</p>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <button onClick={() => { haptic(8); toggleNotif(); }}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:99,border:cardBorder,background:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:notifEnabled?(dark?"#818cf8":"#4f46e5"):textMute }}>
                    <BellIcon/>{notifEnabled?"On":"Off"}
                  </button>
                </div>
              </div>
              <div style={{ overflowY:"auto",flex:1,padding:"0 20px 20px" }}>
                {reminders.length>0 && (
                  <div style={{ marginBottom:16 }}>
                    <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:textMute }}>Due soon</p>
                    {reminders.map(item => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:dark?"#1f2937":"#f8fafc",borderRadius:12,marginBottom:6,border:cardBorder }}>
                        <div style={{ fontSize:18,flexShrink:0 }}>{item.daysUntil<0?"⚠️":item.daysUntil===0?"🔔":"⏰"}</div>
                        <div style={{ flex:1 }}>
                          <p style={{ margin:0,fontSize:13,fontWeight:700,color:item.daysUntil<0?"#ef4444":item.daysUntil===0?"#f97316":"#f59e0b" }}>{item.name}</p>
                          <p style={{ margin:"1px 0 0",fontSize:11,color:textMute }}>₹{item.amount.toLocaleString()} · {item.daysUntil<0?`${Math.abs(item.daysUntil)}d overdue`:item.daysUntil===0?"due today":item.daysUntil===1?"due tomorrow":`due in ${item.daysUntil} days`}</p>
                        </div>
                        <button onClick={() => { haptic([10,30,10]); payFromReminder(item,"bank"); setShowNotifPanel(false); }} style={{ background:dark?"#064e3b":"#d1fae5",color:dark?"#34d399":"#065f46",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}>Pay</button>
                        <button onClick={() => { haptic(5); dismissReminder(item.id); }} style={{ background:"none",border:cardBorder,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:textMute,display:"flex",alignItems:"center" }}><XIcon/></button>
                      </div>
                    ))}
                  </div>
                )}
                {reminders.length===0 && (
                  <div style={{ textAlign:"center",padding:"40px 0" }}>
                    <p style={{ fontSize:28,marginBottom:8 }}>🔕</p>
                    <p style={{ margin:0,fontSize:13,fontWeight:600,color:textMain }}>All clear</p>
                    <p style={{ margin:"4px 0 0",fontSize:12,color:textMute }}>No payments due today or tomorrow</p>
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
            <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:201,background:cardBg,borderRadius:isRetro?"0":"20px 20px 0 0",padding:"0 0 env(safe-area-inset-bottom,20px)",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column",maxHeight:"88vh" }}>
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",flexShrink:0 }}><div style={{ width:36,height:4,borderRadius:99,background:dark?"#374151":"#e5e7eb" }}/></div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px 8px",flexShrink:0 }}>
                <p style={{ margin:0,fontSize:16,fontWeight:700,color:textMain }}>Settings</p>
                <button onClick={() => setShowSettings(false)} style={{ background:"none",border:cardBorder,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,color:textMute,fontWeight:600 }}>✕ Close</button>
              </div>
              <div style={{ padding:"0 20px 16px",overflowY:"auto",WebkitOverflowScrolling:"touch" }}>

                {/* Dark mode toggle */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>{dark?<MoonIcon/>:<SunIcon/>}<span style={{ fontSize:14,color:textMain }}>Dark mode</span></div>
                  <button onClick={() => setDark(d => !d)} disabled={isRetro} style={{ width:44,height:24,borderRadius:99,border:"none",cursor:isRetro?"not-allowed":"pointer",position:"relative",background:dark?"#4f46e5":"#e5e7eb",transition:"background 0.2s",opacity:isRetro?0.5:1 }}>
                    <div style={{ position:"absolute",top:2,left:dark?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </button>
                </div>

                {/* Retro theme toggle — optional full palette (white/retro-ink outline + teal/orange/yellow) */}
                <div style={{ padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:18,height:18,borderRadius:0,background:"#ffffff",border:`2.5px solid ${RETRO_THEME.border}`,flexShrink:0 }}/>
                      <span style={{ fontSize:14,color:textMain }}>Retro theme</span>
                    </div>
                    <button onClick={() => { const next = !isRetro; setThemeStyle(next?"retro":"classic"); if (next) setDark(false); haptic(6); }}
                      style={{ width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:isRetro?RETRO_THEME.orange:(dark?"#374151":"#e5e7eb"),transition:"background 0.2s" }}>
                      <div style={{ position:"absolute",top:2,left:isRetro?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                    </button>
                  </div>
                  <p style={{ margin:"6px 0 0",fontSize:11,color:textMute }}>A bold white &amp; retro-outline palette with teal, orange &amp; yellow accents — replaces your accent color choice while on.</p>
                </div>

                {/* Profile / Avatar */}
                <div style={{ padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:editingName?8:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:36,height:36,borderRadius:isRetro?0:"50%",background:avatarColor(userName,isRetro),border:isRetro?`2px solid ${RETRO_THEME.border}`:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        {avatarId && avatarId !== "initials"
                          ? <span style={{ fontSize:20,lineHeight:1 }}>{avatarId}</span>
                          : <span style={{ fontSize:13,fontWeight:800,color:isRetro?RETRO_THEME.border:"#fff" }}>{getInitials(userName)}</span>
                        }
                      </div>
                      <div><p style={{ margin:0,fontSize:14,color:textMain }}>{userName||"Set your name"}</p><p style={{ margin:0,fontSize:11,color:textMute }}>Tap to edit</p></div>
                    </div>
                    <button onClick={() => { setEditingName(e => !e); setNameInput(userName); }} style={btnSecondary}>{editingName?"Cancel":"Edit"}</button>
                  </div>
                  {editingName && (
                    <>
                      <div style={{ display:"flex",gap:6,marginBottom:10 }}>
                        <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name" onKeyDown={e => e.key==="Enter"&&saveName()}
                          style={{ flex:1,background:dark?"#1f2937":"#f8fafc",border:`1px solid ${dark?"#374151":"#e5e7eb"}`,color:textMain,borderRadius:10,padding:"7px 12px",fontSize:13,outline:"none" }} autoFocus/>
                        <button onClick={saveName} style={{ background:accent,color:"#fff",border:"none",borderRadius:10,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer" }}>Save</button>
                      </div>
                      <p style={{ margin:"0 0 8px",fontSize:12,fontWeight:600,color:textMute }}>Profile picture</p>
                      <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6 }}>
                        {AVATAR_OPTIONS.map(av => {
                          const isActive = avatarId === av.id;
                          return (
                            <button key={av.id} onClick={() => { haptic(6); setAvatarId(av.id); }}
                              style={{ height:44,borderRadius:12,border:isActive?`2px solid ${accent}`:`1px solid ${border}`,background:isActive?(dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)"):"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>
                              {av.emoji
                                ? <span style={{ fontSize:22,lineHeight:1 }}>{av.emoji}</span>
                                : <div style={{ width:26,height:26,borderRadius:isRetro?0:"50%",background:avatarColor(userName,isRetro),border:isRetro?`2px solid ${RETRO_THEME.border}`:"none",display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ fontSize:10,fontWeight:800,color:isRetro?RETRO_THEME.border:"#fff" }}>{getInitials(userName)||"A"}</span></div>
                              }
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

{/* The Scene (F1 / DBZ) and Colour pickers lived here. Both were removed
                    along with the canvas streak game - the Retro toggle above is
                    now the only appearance option. */}

                {/* Simple mode */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <div><span style={{ fontSize:14,color:textMain }}>Simple mode</span><p style={{ margin:0,fontSize:11,color:textMute }}>One page: budget left, add an expense, today\u2019s expenses. Nothing else essentials</p></div>
                  </div>
                  <button onClick={() => { haptic(6); setSimpleMode(s => !s); }} style={{ width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:simpleMode?"#4f46e5":"#e5e7eb",transition:"background 0.2s" }}>
                    <div style={{ position:"absolute",top:2,left:simpleMode?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </button>
                </div>

                {/* Notifications */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <BellIcon/>
                    <div><span style={{ fontSize:14,color:textMain }}>Notifications</span><p style={{ margin:0,fontSize:11,color:textMute }}>Reminder the day before and on due date</p></div>
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
            BOTTOM NAV - hidden in simple mode, which is a single page
        ════════════════════════════════════════════════════════════════ */}
        {!simpleMode && (
        <div style={{ position:"fixed",bottom:0,left:0,right:0,background:isRetro?"rgba(244,241,230,0.96)":dark?"rgba(3,7,18,0.92)":"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:isRetro?`3px solid ${RETRO_THEME.border}`:`1px solid ${border}`,boxShadow:isRetro?"0 -3px 0px 0px rgba(14,28,84,0.06)":"none",display:"flex",alignItems:"stretch",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
          {[
            { id:"home",      label:"Home",    icon:<HomeIcon size={22}/> },
            { id:"expenses",  label:"Expenses",icon:<ListIcon size={22}/> },
            { id:"scanvoice", label:"Add",     icon:<div style={{ width:52,height:52,borderRadius:isRetro?0:"50%",background:isRetro?RETRO_THEME.orange:`linear-gradient(135deg,${ACCENT_CLASSIC.light},${ACCENT_CLASSIC.dark})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isRetro?"3px 3px 0px 0px rgba(14,28,84,1)":"0 4px 16px rgba(79,70,229,0.4)",marginTop:-20,border:isRetro?`2.5px solid ${RETRO_THEME.border}`:`3px solid ${dark?"#030712":"#fff"}` }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={isRetro?RETRO_THEME.border:"white"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div> },
            { id:"bills",       label:"Bills & Loans",   icon:<EmiIcon size={22}/> },
            { id:"pot",       label:"My Pot",  icon:<WalletIcon size={22}/> },
          ].map(({ id, label, icon }) => {
            const active = tab===id;
            const isScan = id==="scanvoice";
            return (
              <button key={id} onClick={() => { haptic(6); setTab(id); }}
                style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:isScan?0:3,
                  padding:isScan?"0 0 4px":"8px 4px 8px",
                  margin:isRetro&&!isScan?"6px 3px":0,
                  background:isRetro&&active&&!isScan?"rgba(242,162,94,0.28)":"none",
                  border:isRetro&&active&&!isScan?`2px solid ${RETRO_THEME.border}`:"none",
                  cursor:"pointer",color:active&&!isScan?accent:(isRetro?RETRO_THEME.textMute:textMute),
                  transition:"color 0.15s, background 0.15s",minWidth:0,position:"relative" }}>
                {icon}
                {!isScan && <span style={{ fontSize:10,fontWeight:active?800:isRetro?600:500,whiteSpace:"nowrap",letterSpacing:isRetro?"0.02em":0 }}>{label}</span>}
                {active&&!isScan && (isRetro
                  ? null
                  : <div style={{ position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:20,height:2,borderRadius:99,background:accent }}/>
                )}
              </button>
            );
          })}
        </div>
        )}
        {/* Nav spacer - only needed when the nav is actually on screen */}
        {!simpleMode && <div style={{ height:72 }}/>}
      </div>
    </ErrorBoundary>
  );
}
