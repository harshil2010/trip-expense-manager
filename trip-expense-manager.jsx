import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Wallet, TrainFront, Receipt, HandCoins, Users, FileBarChart,
  Plus, X, Pencil, Trash2, Search, Download, ShieldCheck, LogOut, CheckCircle2,
  Clock, Mountain, MapPin, Image as ImageIcon, ChevronDown, ChevronUp, Undo2,
  UserCircle2, Menu
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

/* ============================== CONSTANTS ============================== */

const KEYS = {
  MEMBERS: "tem_members_v1",
  PKG: "tem_package_payments_v1",
  TRAIN: "tem_train_data_v1",
  EXP: "tem_expenses_v1",
  SETTLE: "tem_completed_settlements_v1",
};

const PACKAGE_AMOUNTS = { adult: 11500, child: 7770 };
const ADMIN_PIN = "2026";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CATEGORIES = ["Food", "Hotel", "Transport", "Sightseeing", "Tickets", "Snacks", "Parking", "Fuel", "Shopping", "Emergency", "Miscellaneous"];
const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];
const TRAIN_LEGS = [
  { key: "AD_DEL", label: "Ahmedabad → Delhi" },
  { key: "DEL_AD", label: "Delhi → Ahmedabad" },
];
const ROUTE_STOPS = ["Ahmedabad", "Delhi", "Shimla", "Manali", "Kullu", "Kasol", "Delhi", "Ahmedabad"];

const RAW_NAMES = [
  "Mitul", "Maheshbhai", "Jagrutiben", "Krisha", "grishma", "meena ben", "Harshil", "Nehal",
  "Harsha ben", "Naresh bhai", "Goral", "Anil", "Kanubhai", "Shobhanaben", "Atul Akbari",
  "Harsha Akbari", "Pinal Child", "Jenil", "Deep", "Bhavesh", "Riddhi", "Vaidehi Child",
  "Dipak", "Geeta", "Hil Child", "Paresh", "Diptee", "Ronak", "Renu", "Jayaben", "Yash",
  "Mayur", "Bhanu", "Charmi", "Atul sukhadiya", "Sangi", "Preet", "Vihar Talaviya",
];

function seedMembers() {
  return RAW_NAMES.map((name, i) => {
    const isChild = /child/i.test(name);
    const type = isChild ? "child" : "adult";
    return {
      id: "m" + (i + 1),
      name,
      type,
      packageAmount: PACKAGE_AMOUNTS[type],
      active: true,
    };
  });
}

const COLORS = ["#0f766e", "#f59e0b", "#0ea5e9", "#e11d48", "#8b5cf6", "#16a34a", "#f97316", "#64748b", "#ec4899", "#14b8a6", "#a855f7"];

/* ============================== UTILITIES ============================== */

const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const genId = (p) => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);

async function loadShared(key, fallback) {
  try {
    if (supabase) {
      const { data, error } = await supabase.from("trip_store").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? data.value : fallback;
    }
    if (window.storage && typeof window.storage.get === "function") {
      const r = await window.storage.get(key, true);
      return r && r.value ? JSON.parse(r.value) : fallback;
    }
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveShared(key, value) {
  try {
    if (supabase) {
      const { error } = await supabase.from("trip_store").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return;
    }
    if (window.storage && typeof window.storage.set === "function") {
      await window.storage.set(key, JSON.stringify(value), true);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error("save failed", key, e);
  }
}
async function loadPersonal(key, fallback) {
  try {
    if (window.storage && typeof window.storage.get === "function") {
      const r = await window.storage.get(key, false);
      return r && r.value ? r.value : fallback;
    }
    return window.localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}
async function savePersonal(key, value) {
  try {
    if (window.storage && typeof window.storage.set === "function") {
      await window.storage.set(key, value, false);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    console.error("save failed", key, e);
  }
}

function getShares(expense, members) {
  const allIds = members.map((m) => m.id);
  const participants = expense.participants && expense.participants.length ? expense.participants : allIds;
  const shares = {};
  if (expense.splitType === "custom" && expense.customShares) {
    participants.forEach((id) => (shares[id] = Number(expense.customShares[id]) || 0));
  } else if (expense.splitType === "adultChild") {
    const childWeight = expense.childWeight != null ? expense.childWeight : 0.7;
    let totalWeight = 0;
    participants.forEach((id) => {
      const m = members.find((x) => x.id === id);
      const w = m && m.type === "child" ? childWeight : 1;
      totalWeight += w;
    });
    participants.forEach((id) => {
      const m = members.find((x) => x.id === id);
      const w = m && m.type === "child" ? childWeight : 1;
      shares[id] = totalWeight ? (expense.amount * w) / totalWeight : 0;
    });
  } else {
    const n = participants.length || 1;
    participants.forEach((id) => (shares[id] = expense.amount / n));
  }
  return shares;
}

function computeNetBalances(members, expenses) {
  const bal = {};
  members.forEach((m) => (bal[m.id] = 0));
  expenses.forEach((exp) => {
    const shares = getShares(exp, members);
    bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
    Object.entries(shares).forEach(([id, share]) => {
      bal[id] = (bal[id] || 0) - share;
    });
  });
  return bal;
}

function applySettlements(bal, completed) {
  const adj = { ...bal };
  completed.forEach((s) => {
    adj[s.from] = (adj[s.from] || 0) + s.amount;
    adj[s.to] = (adj[s.to] || 0) - s.amount;
  });
  return adj;
}

function suggestSettlements(balances, members) {
  const eps = 1;
  const creditors = members
    .filter((m) => (balances[m.id] || 0) > eps)
    .map((m) => ({ id: m.id, name: m.name, amt: balances[m.id] }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = members
    .filter((m) => (balances[m.id] || 0) < -eps)
    .map((m) => ({ id: m.id, name: m.name, amt: -balances[m.id] }))
    .sort((a, b) => b.amt - a.amt);
  const txns = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const amt = Math.min(d.amt, c.amt);
    if (amt > eps) {
      txns.push({ id: genId("sg"), from: d.id, fromName: d.name, to: c.id, toName: c.name, amount: Math.round(amt) });
    }
    d.amt -= amt; c.amt -= amt;
    if (d.amt <= eps) i++;
    if (c.amt <= eps) j++;
  }
  return txns;
}

function compressImage(file, maxW = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function exportCSV(filename, rows) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell == null ? "" : cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportXLSX(filename, sheetName, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/* ============================== SMALL UI ATOMS ============================== */

function Heading({ children, className = "" }) {
  return <h2 className={"text-xl sm:text-2xl font-semibold text-slate-800 " + className} style={{ fontFamily: "'Fraunces', serif" }}>{children}</h2>;
}

function Badge({ status }) {
  const map = {
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Partial: "bg-amber-50 text-amber-700 border-amber-200",
    Pending: "bg-rose-50 text-rose-700 border-rose-200",
    "N/A": "bg-slate-50 text-slate-500 border-slate-200",
  };
  return <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border " + (map[status] || map["N/A"])}>{status}</span>;
}

function StatCard({ icon: Icon, label, value, sub, tone = "teal" }) {
  const tones = {
    teal: "bg-teal-700",
    amber: "bg-amber-500",
    slate: "bg-slate-700",
    rose: "bg-rose-600",
    sky: "bg-sky-600",
  };
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={"w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 " + tones[tone]}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-slate-800 truncate" style={{ fontFamily: "'Fraunces', serif" }}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function ProgressBar({ collected, total, tone = "teal" }) {
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const tones = { teal: "bg-teal-600", amber: "bg-amber-500", rose: "bg-rose-500" };
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{inr(collected)} collected</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
        <div className={"h-full rounded-full " + tones[tone]} style={{ width: pct + "%" }} />
      </div>
      <div className="text-xs text-slate-400 mt-1">of {inr(total)} total</div>
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className={"bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto " + (wide ? "sm:max-w-2xl" : "sm:max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-800 text-lg" style={{ fontFamily: "'Fraunces', serif" }}>{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

function EmptyState({ text }) {
  return <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-stone-200 rounded-xl">{text}</div>;
}

/* ============================== TABS ============================== */

function DashboardTab({ totals, members, categoryBreakdown, trainData }) {
  const pkgChartData = [{ name: "Package", Collected: totals.pkgCollected, Pending: totals.pkgPending }];
  const trainChartData = [{ name: "Train", Collected: totals.trainCollected, Pending: totals.trainPending }];
  const adults = members.filter((m) => m.type === "adult").length;
  const children = members.filter((m) => m.type === "child").length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-teal-800 to-teal-700 rounded-2xl p-5 text-white overflow-hidden relative">
        <div className="flex items-center gap-2 mb-4 text-teal-100 text-sm">
          <Mountain size={16} /> <span>Group Trip Itinerary</span>
        </div>
        <div className="flex items-center overflow-x-auto pb-2 gap-1 no-scrollbar">
          {ROUTE_STOPS.map((stop, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center shrink-0 px-2">
                <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white/70 mb-1" />
                <span className="text-xs sm:text-sm whitespace-nowrap font-medium">{stop}</span>
              </div>
              {i < ROUTE_STOPS.length - 1 && <div className="h-[2px] w-6 sm:w-10 bg-white/30 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div><span className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{members.length}</span> <span className="text-teal-100">travelers</span></div>
          <div><span className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{adults}</span> <span className="text-teal-100">adults</span></div>
          <div><span className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{children}</span> <span className="text-teal-100">children</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Wallet} label="Package Amount" value={inr(totals.pkgTotal)} sub={`Pending ${inr(totals.pkgPending)}`} tone="teal" />
        <StatCard icon={TrainFront} label="Train Amount" value={inr(totals.trainTotal)} sub={`Pending ${inr(totals.trainPending)}`} tone="sky" />
        <StatCard icon={Receipt} label="Trip Expenses" value={inr(totals.expenseTotal)} sub="Recorded so far" tone="amber" />
        <StatCard icon={HandCoins} label="Money Collected" value={inr(totals.totalCollected)} sub="Package + Train" tone="slate" />
        <StatCard icon={CheckCircle2} label="Current Balance" value={inr(totals.currentBalance)} sub="Collected − Expenses" tone={totals.currentBalance >= 0 ? "teal" : "rose"} />
        <StatCard icon={Clock} label="Pending Payments" value={inr(totals.pendingPayments)} sub="Package + Train due" tone="rose" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <Heading className="text-base mb-4">Package Payment Progress</Heading>
          <ProgressBar collected={totals.pkgCollected} total={totals.pkgTotal} tone="teal" />
          <Heading className="text-base mt-6 mb-4">Train Payment Progress</Heading>
          <ProgressBar collected={totals.trainCollected} total={totals.trainTotal} tone="amber" />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <Heading className="text-base mb-2">Expenses by Category</Heading>
          {categoryBreakdown.length === 0 ? <EmptyState text="No expenses recorded yet" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <Heading className="text-base mb-4">Package vs Train Collections</Heading>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={[...pkgChartData, ...trainChartData]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => inr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Collected" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pending" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PackagePaymentsTab({ members, pkgPayments, memberStats, isAdmin, onAddPayment, onDeletePayment }) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [modalMember, setModalMember] = useState(null);
  const [form, setForm] = useState({ amount: "", date: todayStr(), method: "Cash", ref: "", notes: "" });

  const filtered = memberStats.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const openModal = (m) => { setModalMember(m); setForm({ amount: "", date: todayStr(), method: "Cash", ref: "", notes: "" }); };
  const submit = () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    onAddPayment({ id: genId("pp"), memberId: modalMember.id, amount: Number(form.amount), date: form.date, method: form.method, ref: form.ref, notes: form.notes });
    setModalMember(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Heading>Package Payments</Heading>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={inputCls + " pl-8"} placeholder="Search member..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-stone-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Package</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <React.Fragment key={m.id}>
                  <tr className="border-t border-stone-100 hover:bg-stone-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{m.name}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{m.type}</td>
                    <td className="px-4 py-3 text-right">{inr(m.pkgAmt)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{inr(m.pkgPaid)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{inr(m.pkgPending)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={m.pkgStatus} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className="text-xs text-slate-500 hover:text-teal-700 mr-3">
                        {expandedId === m.id ? "Hide" : "History"}
                      </button>
                      {isAdmin && <button onClick={() => openModal(m)} className="text-xs font-medium text-teal-700 hover:text-teal-900">+ Payment</button>}
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="bg-stone-50/60 border-t border-stone-100">
                      <td colSpan={7} className="px-4 py-3">
                        {pkgPayments.filter((p) => p.memberId === m.id).length === 0 ? (
                          <div className="text-xs text-slate-400">No payments recorded.</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-slate-400"><tr><th className="text-left py-1">Date</th><th className="text-left py-1">Method</th><th className="text-left py-1">Ref</th><th className="text-left py-1">Notes</th><th className="text-right py-1">Amount</th>{isAdmin && <th></th>}</tr></thead>
                            <tbody>
                              {pkgPayments.filter((p) => p.memberId === m.id).map((p) => (
                                <tr key={p.id} className="border-t border-stone-200/60">
                                  <td className="py-1.5">{fmtDate(p.date)}</td>
                                  <td className="py-1.5">{p.method}</td>
                                  <td className="py-1.5">{p.ref || "—"}</td>
                                  <td className="py-1.5">{p.notes || "—"}</td>
                                  <td className="py-1.5 text-right font-medium">{inr(p.amount)}</td>
                                  {isAdmin && <td className="py-1.5 text-right"><button onClick={() => onDeletePayment(p.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={13} /></button></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modalMember} onClose={() => setModalMember(null)} title={"Add Payment — " + (modalMember ? modalMember.name : "")}>
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Payment Method">
          <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {PAYMENT_METHODS.map((mm) => <option key={mm}>{mm}</option>)}
          </select>
        </Field>
        <Field label="Reference Number"><input className={inputCls} value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></Field>
        <Field label="Notes"><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <button onClick={submit} className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2.5 text-sm font-medium mt-1">Save Payment</button>
      </Modal>
    </div>
  );
}

function TrainPaymentsTab({ members, trainData, isAdmin, onSetTicket, onAddPayment, onDeletePayment }) {
  const [leg, setLeg] = useState(TRAIN_LEGS[0].key);
  const [search, setSearch] = useState("");
  const [ticketModal, setTicketModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [tForm, setTForm] = useState({ price: "", trainNumber: "", date: "", pnr: "", seat: "" });
  const [pForm, setPForm] = useState({ amount: "", date: todayStr(), method: "Cash", ref: "", notes: "" });

  const rows = useMemo(() => members.filter((m) => m.active !== false).filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).map((m) => {
    const ticket = trainData.tickets.find((t) => t.memberId === m.id && t.route === leg);
    const price = ticket ? ticket.price : 0;
    const paid = trainData.payments.filter((p) => p.memberId === m.id && p.route === leg).reduce((s, p) => s + p.amount, 0);
    const pending = Math.max(price - paid, 0);
    const status = !ticket ? "N/A" : paid <= 0 ? "Pending" : pending <= 0 ? "Paid" : "Partial";
    return { member: m, ticket, price, paid, pending, status };
  }), [members, trainData, leg, search]);

  const openTicket = (m, ticket) => {
    setTicketModal(m);
    setTForm(ticket ? { price: ticket.price, trainNumber: ticket.trainNumber, date: ticket.date, pnr: ticket.pnr, seat: ticket.seat } : { price: "", trainNumber: "", date: "", pnr: "", seat: "" });
  };
  const saveTicket = () => {
    if (!tForm.price || Number(tForm.price) <= 0) return;
    onSetTicket({ id: genId("tk"), memberId: ticketModal.id, route: leg, price: Number(tForm.price), trainNumber: tForm.trainNumber, date: tForm.date, pnr: tForm.pnr, seat: tForm.seat });
    setTicketModal(null);
  };
  const submitPayment = () => {
    if (!pForm.amount || Number(pForm.amount) <= 0) return;
    onAddPayment({ id: genId("tp"), memberId: paymentModal.id, route: leg, amount: Number(pForm.amount), date: pForm.date, method: pForm.method, ref: pForm.ref, notes: pForm.notes });
    setPaymentModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Heading>Train Payments</Heading>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={inputCls + " pl-8"} placeholder="Search member..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        {TRAIN_LEGS.map((l) => (
          <button key={l.key} onClick={() => setLeg(l.key)} className={"px-4 py-2 rounded-lg text-sm font-medium border " + (leg === l.key ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-stone-200 hover:border-teal-300")}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-stone-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Train / PNR</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member: m, ticket, price, paid, pending, status }) => (
                <React.Fragment key={m.id}>
                  <tr className="border-t border-stone-100 hover:bg-stone-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{m.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {ticket ? <>{ticket.trainNumber || "—"} · {ticket.pnr || "no PNR"} · Seat {ticket.seat || "—"}<br />{fmtDate(ticket.date)}</> : "No ticket set"}
                    </td>
                    <td className="px-4 py-3 text-right">{inr(price)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{inr(paid)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{inr(pending)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <button onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className="text-xs text-slate-500 hover:text-teal-700">History</button>
                      {isAdmin && <button onClick={() => openTicket(m, ticket)} className="text-xs font-medium text-slate-600 hover:text-slate-900">Ticket</button>}
                      {isAdmin && ticket && <button onClick={() => setPaymentModal(m)} className="text-xs font-medium text-teal-700 hover:text-teal-900">+ Payment</button>}
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="bg-stone-50/60 border-t border-stone-100">
                      <td colSpan={7} className="px-4 py-3">
                        {trainData.payments.filter((p) => p.memberId === m.id && p.route === leg).length === 0 ? (
                          <div className="text-xs text-slate-400">No payments recorded.</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-slate-400"><tr><th className="text-left py-1">Date</th><th className="text-left py-1">Method</th><th className="text-left py-1">Ref</th><th className="text-right py-1">Amount</th>{isAdmin && <th></th>}</tr></thead>
                            <tbody>
                              {trainData.payments.filter((p) => p.memberId === m.id && p.route === leg).map((p) => (
                                <tr key={p.id} className="border-t border-stone-200/60">
                                  <td className="py-1.5">{fmtDate(p.date)}</td>
                                  <td className="py-1.5">{p.method}</td>
                                  <td className="py-1.5">{p.ref || "—"}</td>
                                  <td className="py-1.5 text-right font-medium">{inr(p.amount)}</td>
                                  {isAdmin && <td className="py-1.5 text-right"><button onClick={() => onDeletePayment(p.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={13} /></button></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!ticketModal} onClose={() => setTicketModal(null)} title={"Set Ticket — " + (ticketModal ? ticketModal.name : "")}>
        <Field label="Ticket Price (₹)"><input type="number" className={inputCls} value={tForm.price} onChange={(e) => setTForm({ ...tForm, price: e.target.value })} /></Field>
        <Field label="Train Number"><input className={inputCls} value={tForm.trainNumber} onChange={(e) => setTForm({ ...tForm, trainNumber: e.target.value })} /></Field>
        <Field label="Travel Date"><input type="date" className={inputCls} value={tForm.date} onChange={(e) => setTForm({ ...tForm, date: e.target.value })} /></Field>
        <Field label="PNR"><input className={inputCls} value={tForm.pnr} onChange={(e) => setTForm({ ...tForm, pnr: e.target.value })} /></Field>
        <Field label="Seat / Coach"><input className={inputCls} value={tForm.seat} onChange={(e) => setTForm({ ...tForm, seat: e.target.value })} /></Field>
        <button onClick={saveTicket} className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2.5 text-sm font-medium mt-1">Save Ticket</button>
      </Modal>

      <Modal open={!!paymentModal} onClose={() => setPaymentModal(null)} title={"Add Train Payment — " + (paymentModal ? paymentModal.name : "")}>
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={pForm.date} onChange={(e) => setPForm({ ...pForm, date: e.target.value })} /></Field>
        <Field label="Payment Method">
          <select className={inputCls} value={pForm.method} onChange={(e) => setPForm({ ...pForm, method: e.target.value })}>
            {PAYMENT_METHODS.map((mm) => <option key={mm}>{mm}</option>)}
          </select>
        </Field>
        <Field label="Reference Number"><input className={inputCls} value={pForm.ref} onChange={(e) => setPForm({ ...pForm, ref: e.target.value })} /></Field>
        <Field label="Notes"><textarea className={inputCls} rows={2} value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></Field>
        <button onClick={submitPayment} className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2.5 text-sm font-medium mt-1">Save Payment</button>
      </Modal>
    </div>
  );
}

function ExpenseForm({ members, onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0] ? members[0].id : "");
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [splitType, setSplitType] = useState("equalAll");
  const [selected, setSelected] = useState(members.map((m) => m.id));
  const [customShares, setCustomShares] = useState({});
  const [childWeight, setChildWeight] = useState(0.7);
  const [uploading, setUploading] = useState(false);

  const activeMembers = members.filter((m) => m.active !== false);
  const participants = splitType === "equalAll" ? activeMembers.map((m) => m.id) : selected;

  const toggleSel = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const customTotal = Object.values(customShares).reduce((s, v) => s + (Number(v) || 0), 0);

  const preview = useMemo(() => {
    if (!amount) return {};
    const exp = {
      amount: Number(amount),
      splitType: splitType === "equalAll" || splitType === "equalSelected" ? "equal" : splitType,
      participants,
      customShares,
      childWeight,
    };
    return getShares(exp, members);
  }, [amount, splitType, participants.join(","), customShares, childWeight, members]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await compressImage(file);
      setReceipt(data);
    } catch (err) { console.error(err); }
    setUploading(false);
  };

  const canSave = title && amount && Number(amount) > 0 && paidBy && participants.length > 0 && (splitType !== "custom" || Math.abs(customTotal - Number(amount)) < 1);

  const submit = () => {
    if (!canSave) return;
    onSave({
      id: genId("ex"),
      title, amount: Number(amount), paidBy, date, category, description, receipt,
      splitType: splitType === "equalAll" || splitType === "equalSelected" ? "equal" : splitType,
      participants,
      customShares: splitType === "custom" ? customShares : undefined,
      childWeight: splitType === "adultChild" ? childWeight : undefined,
    });
  };

  return (
    <div>
      <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Manali" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid By">
          <select className={inputCls} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description"><textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Receipt / Photo">
        <input type="file" accept="image/*" onChange={handleFile} className="text-xs" />
        {uploading && <span className="text-xs text-slate-400 ml-2">compressing...</span>}
        {receipt && <img src={receipt} alt="receipt" className="mt-2 h-24 rounded-lg border border-stone-200 object-cover" />}
      </Field>

      <div className="mt-4 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Split Method</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          ["equalAll", "Equal — All members"],
          ["equalSelected", "Equal — Selected members"],
          ["custom", "Custom amounts"],
          ["adultChild", "Adult / Child weighted"],
        ].map(([val, label]) => (
          <button key={val} onClick={() => setSplitType(val)} className={"text-xs px-3 py-2 rounded-lg border text-left " + (splitType === val ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-stone-200 hover:border-teal-300")}>
            {label}
          </button>
        ))}
      </div>

      {splitType === "adultChild" && (
        <Field label={`Child weight relative to adult (1 = same, ${childWeight} = ${Math.round(childWeight * 100)}%)`}>
          <input type="range" min="0" max="1" step="0.05" value={childWeight} onChange={(e) => setChildWeight(Number(e.target.value))} className="w-full" />
        </Field>
      )}

      {(splitType === "equalSelected" || splitType === "custom" || splitType === "adultChild") && (
        <div className="border border-stone-200 rounded-lg p-3 max-h-52 overflow-y-auto mb-3">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleSel(m.id)} />
                <span>{m.name} <span className="text-xs text-slate-400">({m.type})</span></span>
              </label>
              {splitType === "custom" && selected.includes(m.id) && (
                <input type="number" className="w-24 border border-stone-300 rounded px-2 py-1 text-xs" placeholder="₹" value={customShares[m.id] || ""} onChange={(e) => setCustomShares({ ...customShares, [m.id]: e.target.value })} />
              )}
              {splitType !== "custom" && selected.includes(m.id) && amount && (
                <span className="text-xs text-slate-500">{inr(preview[m.id])}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {splitType === "custom" && amount && (
        <div className={"text-xs mb-3 " + (Math.abs(customTotal - Number(amount)) < 1 ? "text-emerald-600" : "text-rose-600")}>
          Allocated {inr(customTotal)} of {inr(amount)} {Math.abs(customTotal - Number(amount)) >= 1 && "— must match total"}
        </div>
      )}

      {splitType === "equalAll" && amount && (
        <div className="text-xs text-slate-500 mb-3">Each of {participants.length} members owes {inr(Number(amount) / (participants.length || 1))}</div>
      )}

      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="flex-1 border border-stone-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium">Cancel</button>
        <button onClick={submit} disabled={!canSave} className="flex-1 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-medium">Save Expense</button>
      </div>
    </div>
  );
}

function ExpensesTab({ members, expenses, isAdmin, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const memberName = (id) => (members.find((m) => m.id === id) || {}).name || "—";

  const filtered = expenses.filter((e) => (catFilter === "All" || e.category === catFilter) && e.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Heading>Trip Expenses</Heading>
        <button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 justify-center">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={inputCls + " pl-8"} placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputCls + " sm:w-48"} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option>All</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? <EmptyState text="No expenses match your filters" /> : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const shares = getShares(e, members);
            const open = expandedId === e.id;
            return (
              <div key={e.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpandedId(open ? null : e.id)}>
                  {e.receipt ? <img src={e.receipt} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-stone-200" /> : (
                    <div className="w-14 h-14 rounded-lg bg-stone-100 flex items-center justify-center text-slate-400 shrink-0"><ImageIcon size={20} /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 truncate">{e.title}</span>
                      <span className="font-semibold text-slate-800 shrink-0">{inr(e.amount)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{e.category} · {fmtDate(e.date)} · Paid by {memberName(e.paidBy)}</div>
                    {e.description && <div className="text-xs text-slate-400 mt-1 truncate">{e.description}</div>}
                  </div>
                  {open ? <ChevronUp size={16} className="text-slate-400 mt-1 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 mt-1 shrink-0" />}
                </div>
                {open && (
                  <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/60">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Split ({e.splitType === "equal" ? "Equal" : e.splitType === "custom" ? "Custom" : "Adult/Child weighted"})</div>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {Object.entries(shares).map(([id, share]) => (
                        <div key={id} className="flex justify-between border-b border-stone-100 py-1">
                          <span className="text-slate-600">{memberName(id)}</span>
                          <span className="font-medium text-slate-700">{inr(share)}</span>
                        </div>
                      ))}
                    </div>
                    {isAdmin && (
                      <button onClick={() => onDelete(e.id)} className="mt-3 text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1"><Trash2 size={13} /> Delete expense</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Trip Expense" wide>
        <ExpenseForm members={members} onCancel={() => setShowForm(false)} onSave={(exp) => { onAdd(exp); setShowForm(false); }} />
      </Modal>
    </div>
  );
}

function SettlementsTab({ members, finalBalances, suggested, completedSettlements, isAdmin, onMarkSettled, onUndoSettlement }) {
  const memberName = (id) => (members.find((m) => m.id === id) || {}).name || "—";
  return (
    <div className="space-y-6">
      <Heading>Settlements</Heading>
      <p className="text-sm text-slate-500 -mt-3">Based only on the Trip Expenses ledger — package and train dues are tracked separately.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {members.map((m) => {
          const bal = finalBalances[m.id] || 0;
          const tone = bal > 1 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : bal < -1 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-500 bg-stone-50 border-stone-200";
          return (
            <div key={m.id} className={"rounded-xl border p-3 flex items-center justify-between " + tone}>
              <span className="text-sm font-medium truncate">{m.name}</span>
              <span className="text-sm font-semibold">{bal > 1 ? "+" : ""}{inr(bal)}</span>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <Heading className="text-base mb-4">Pending Settlements</Heading>
        {suggested.length === 0 ? <EmptyState text="Everyone is settled up 🎉" /> : (
          <div className="space-y-2">
            {suggested.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
                <div className="text-sm">
                  <span className="font-semibold text-slate-800">{s.fromName}</span>
                  <span className="text-slate-400 mx-2">owes</span>
                  <span className="font-semibold text-slate-800">{s.toName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-teal-700">{inr(s.amount)}</span>
                  {isAdmin && <button onClick={() => onMarkSettled(s)} className="text-xs bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg">Mark Settled</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <Heading className="text-base mb-4">Completed Settlements</Heading>
        {completedSettlements.length === 0 ? <EmptyState text="No settlements completed yet" /> : (
          <div className="space-y-2">
            {completedSettlements.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-lg px-4 py-2.5">
                <div className="text-sm flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span className="font-medium text-slate-700">{memberName(s.from)} → {memberName(s.to)}</span>
                  <span className="text-xs text-slate-400">{fmtDate(s.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700">{inr(s.amount)}</span>
                  {isAdmin && <button onClick={() => onUndoSettlement(s.id)} className="text-slate-400 hover:text-rose-600"><Undo2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MembersTab({ members, memberStats, isAdmin, onAdd, onUpdate, onRemove }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // {mode:'add'|'edit', member}
  const [form, setForm] = useState({ name: "", type: "adult", packageAmount: PACKAGE_AMOUNTS.adult });

  const filtered = memberStats.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm({ name: "", type: "adult", packageAmount: PACKAGE_AMOUNTS.adult }); setModal({ mode: "add" }); };
  const openEdit = (m) => { setForm({ name: m.name, type: m.type, packageAmount: m.packageAmount }); setModal({ mode: "edit", member: m }); };

  const submit = () => {
    if (!form.name) return;
    if (modal.mode === "add") {
      onAdd({ id: genId("m"), name: form.name, type: form.type, packageAmount: Number(form.packageAmount), active: true });
    } else {
      onUpdate(modal.member.id, { name: form.name, type: form.type, packageAmount: Number(form.packageAmount) });
    }
    setModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Heading>Members ({members.length})</Heading>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pl-8"} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAdmin && <button onClick={openAdd} className="bg-teal-700 hover:bg-teal-800 text-white rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1 shrink-0"><Plus size={16} /> Add</button>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-stone-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Pkg Paid/Pending</th>
                <th className="text-right px-4 py-3">Train Paid/Pending</th>
                <th className="text-right px-4 py-3">Exp Paid</th>
                <th className="text-right px-4 py-3">Exp Share</th>
                <th className="text-right px-4 py-3">Final Balance</th>
                {isAdmin && <th className="text-right px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{m.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{m.type}</td>
                  <td className="px-4 py-3 text-right"><span className="text-emerald-700">{inr(m.pkgPaid)}</span> / <span className="text-rose-600">{inr(m.pkgPending)}</span></td>
                  <td className="px-4 py-3 text-right"><span className="text-emerald-700">{inr(m.trainPaid)}</span> / <span className="text-rose-600">{inr(m.trainPending)}</span></td>
                  <td className="px-4 py-3 text-right">{inr(m.expPaid)}</td>
                  <td className="px-4 py-3 text-right">{inr(m.expShare)}</td>
                  <td className={"px-4 py-3 text-right font-semibold " + (m.finalBalance > 1 ? "text-emerald-700" : m.finalBalance < -1 ? "text-rose-600" : "text-slate-400")}>
                    {m.finalBalance > 1 ? "+" : ""}{inr(m.finalBalance)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <button onClick={() => openEdit(m)} className="text-slate-500 hover:text-teal-700"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("Remove " + m.name + "? This deletes their payment records too.")) onRemove(m.id); }} className="text-slate-500 hover:text-rose-600"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal && modal.mode === "add" ? "Add Member" : "Edit Member"}>
        <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Type">
          <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, packageAmount: PACKAGE_AMOUNTS[e.target.value] })}>
            <option value="adult">Adult</option>
            <option value="child">Child</option>
          </select>
        </Field>
        <Field label="Package Amount (₹)"><input type="number" className={inputCls} value={form.packageAmount} onChange={(e) => setForm({ ...form, packageAmount: e.target.value })} /></Field>
        <button onClick={submit} className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2.5 text-sm font-medium mt-1">Save</button>
      </Modal>
    </div>
  );
}

function ReportsTab({ members, memberStats, expenses, categoryBreakdown, trainData }) {
  const [section, setSection] = useState("package");

  const pkgRows = [["Name", "Type", "Package Amount", "Paid", "Pending", "Status"], ...memberStats.map((m) => [m.name, m.type, m.pkgAmt, m.pkgPaid, m.pkgPending, m.pkgStatus])];
  const trainRows = [["Name", "Leg", "Price", "Paid", "Pending"]];
  TRAIN_LEGS.forEach((l) => {
    members.forEach((m) => {
      const t = trainData.tickets.find((tk) => tk.memberId === m.id && tk.route === l.key);
      if (!t) return;
      const paid = trainData.payments.filter((p) => p.memberId === m.id && p.route === l.key).reduce((s, p) => s + p.amount, 0);
      trainRows.push([m.name, l.label, t.price, paid, Math.max(t.price - paid, 0)]);
    });
  });
  const expRows = [["Title", "Category", "Amount", "Paid By", "Date"], ...expenses.map((e) => [e.title, e.category, e.amount, (members.find((m) => m.id === e.paidBy) || {}).name || "", e.date])];

  return (
    <div className="space-y-4">
      <Heading>Reports</Heading>
      <div className="flex gap-2 flex-wrap">
        {[["package", "Package"], ["train", "Train"], ["expenses", "Expenses"]].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} className={"px-4 py-2 rounded-lg text-sm font-medium border " + (section === k ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-stone-200")}>{l}</button>
        ))}
      </div>

      {section === "package" && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center">
            <Heading className="text-base">Package Collection Report</Heading>
            <div className="flex gap-2">
              <button onClick={() => exportCSV("package_report.csv", pkgRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> CSV</button>
              <button onClick={() => exportXLSX("package_report.xlsx", "Package", pkgRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> Excel</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={memberStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="pkgPaid" fill="#0f766e" name="Paid" />
              <Bar dataKey="pkgPending" fill="#fbbf24" name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {section === "train" && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center">
            <Heading className="text-base">Train Collection Report</Heading>
            <div className="flex gap-2">
              <button onClick={() => exportCSV("train_report.csv", trainRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> CSV</button>
              <button onClick={() => exportXLSX("train_report.xlsx", "Train", trainRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> Excel</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={memberStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="trainPaid" fill="#0ea5e9" name="Paid" />
              <Bar dataKey="trainPending" fill="#fbbf24" name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {section === "expenses" && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center">
            <Heading className="text-base">Expense Report</Heading>
            <div className="flex gap-2">
              <button onClick={() => exportCSV("expense_report.csv", expRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> CSV</button>
              <button onClick={() => exportXLSX("expense_report.xlsx", "Expenses", expRows)} className="text-xs flex items-center gap-1 border border-stone-300 rounded-lg px-3 py-1.5 text-slate-600"><Download size={13} /> Excel</button>
            </div>
          </div>
          {categoryBreakdown.length === 0 ? <EmptyState text="No expenses recorded yet" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" outerRadius={90}>
                  {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================== APP ============================== */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "package", label: "Package", icon: Wallet },
  { key: "train", label: "Train", icon: TrainFront },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "settlements", label: "Settlements", icon: HandCoins },
  { key: "members", label: "Members", icon: Users },
  { key: "reports", label: "Reports", icon: FileBarChart },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [pkgPayments, setPkgPayments] = useState([]);
  const [trainData, setTrainData] = useState({ tickets: [], payments: [] });
  const [expenses, setExpenses] = useState([]);
  const [completedSettlements, setCompletedSettlements] = useState([]);
  const [role, setRole] = useState("member");
  const [tab, setTab] = useState("dashboard");
  const [showLogin, setShowLogin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [mem, pkg, train, exp, settle, savedRole] = await Promise.all([
        loadShared(KEYS.MEMBERS, null),
        loadShared(KEYS.PKG, []),
        loadShared(KEYS.TRAIN, { tickets: [], payments: [] }),
        loadShared(KEYS.EXP, []),
        loadShared(KEYS.SETTLE, []),
        loadPersonal("tem_role_v1", "member"),
      ]);
      let m = mem;
      if (!m || m.length === 0) {
        m = seedMembers();
        await saveShared(KEYS.MEMBERS, m);
      }
      setMembers(m);
      setPkgPayments(pkg);
      setTrainData(train);
      setExpenses(exp);
      setCompletedSettlements(settle);
      setRole(savedRole === "admin" ? "admin" : "member");
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    const channel = supabase
      .channel("trip-store-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_store" }, (payload) => {
        const key = payload.new?.key;
        const value = payload.new?.value;
        if (!key || value === undefined) return;
        if (key === KEYS.MEMBERS) setMembers(value);
        if (key === KEYS.PKG) setPkgPayments(value);
        if (key === KEYS.TRAIN) setTrainData(value);
        if (key === KEYS.EXP) setExpenses(value);
        if (key === KEYS.SETTLE) setCompletedSettlements(value);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isAdmin = role === "admin";

  /* ---- persistence helpers ---- */
  const persistMembers = useCallback((next) => { setMembers(next); saveShared(KEYS.MEMBERS, next); }, []);
  const persistPkg = useCallback((next) => { setPkgPayments(next); saveShared(KEYS.PKG, next); }, []);
  const persistTrain = useCallback((next) => { setTrainData(next); saveShared(KEYS.TRAIN, next); }, []);
  const persistExp = useCallback((next) => { setExpenses(next); saveShared(KEYS.EXP, next); }, []);
  const persistSettle = useCallback((next) => { setCompletedSettlements(next); saveShared(KEYS.SETTLE, next); }, []);

  /* ---- actions ---- */
  const addPkgPayment = (p) => persistPkg([...pkgPayments, p]);
  const deletePkgPayment = (id) => persistPkg(pkgPayments.filter((p) => p.id !== id));

  const setTicket = (t) => {
    const others = trainData.tickets.filter((tk) => !(tk.memberId === t.memberId && tk.route === t.route));
    persistTrain({ ...trainData, tickets: [...others, t] });
  };
  const addTrainPayment = (p) => persistTrain({ ...trainData, payments: [...trainData.payments, p] });
  const deleteTrainPayment = (id) => persistTrain({ ...trainData, payments: trainData.payments.filter((p) => p.id !== id) });

  const addExpense = (e) => persistExp([...expenses, e]);
  const deleteExpense = (id) => persistExp(expenses.filter((e) => e.id !== id));

  const addMember = (m) => persistMembers([...members, m]);
  const updateMember = (id, patch) => persistMembers(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMember = (id) => {
    persistMembers(members.filter((m) => m.id !== id));
    persistPkg(pkgPayments.filter((p) => p.memberId !== id));
    persistTrain({ tickets: trainData.tickets.filter((t) => t.memberId !== id), payments: trainData.payments.filter((p) => p.memberId !== id) });
    persistExp(expenses.filter((e) => e.paidBy !== id).map((e) => ({ ...e, participants: e.participants ? e.participants.filter((pid) => pid !== id) : e.participants })));
  };

  const markSettled = (s) => persistSettle([...completedSettlements, { id: genId("st"), from: s.from, to: s.to, amount: s.amount, date: todayStr() }]);
  const undoSettlement = (id) => persistSettle(completedSettlements.filter((s) => s.id !== id));

  const doLogin = () => {
    if (pinInput === ADMIN_PIN) {
      setRole("admin"); savePersonal("tem_role_v1", "admin"); setShowLogin(false); setPinInput(""); setPinError(false);
    } else { setPinError(true); }
  };
  const doLogout = () => { setRole("member"); savePersonal("tem_role_v1", "member"); };

  /* ---- derived data ---- */
  const memberStatsBase = useMemo(() => members.map((m) => {
    const pkgAmt = m.packageAmount;
    const pkgPaid = pkgPayments.filter((p) => p.memberId === m.id).reduce((s, p) => s + p.amount, 0);
    const pkgPending = Math.max(pkgAmt - pkgPaid, 0);
    const pkgStatus = pkgPaid <= 0 ? "Pending" : pkgPending <= 0 ? "Paid" : "Partial";

    const tickets = trainData.tickets.filter((t) => t.memberId === m.id);
    const trainAmt = tickets.reduce((s, t) => s + t.price, 0);
    const trainPaid = trainData.payments.filter((p) => p.memberId === m.id).reduce((s, p) => s + p.amount, 0);
    const trainPending = Math.max(trainAmt - trainPaid, 0);
    const trainStatus = trainAmt <= 0 ? "N/A" : trainPaid <= 0 ? "Pending" : trainPending <= 0 ? "Paid" : "Partial";

    const expPaid = expenses.filter((e) => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
    let expShare = 0;
    expenses.forEach((e) => { const sh = getShares(e, members); expShare += sh[m.id] || 0; });

    return { ...m, pkgAmt, pkgPaid, pkgPending, pkgStatus, trainAmt, trainPaid, trainPending, trainStatus, expPaid, expShare };
  }), [members, pkgPayments, trainData, expenses]);

  const netBalances = useMemo(() => computeNetBalances(members, expenses), [members, expenses]);
  const finalBalances = useMemo(() => applySettlements(netBalances, completedSettlements), [netBalances, completedSettlements]);
  const memberStats = useMemo(() => memberStatsBase.map((m) => ({ ...m, finalBalance: finalBalances[m.id] || 0 })), [memberStatsBase, finalBalances]);
  const suggestedSettlements = useMemo(() => suggestSettlements(finalBalances, members), [finalBalances, members]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const totals = useMemo(() => {
    const pkgTotal = members.reduce((s, m) => s + m.packageAmount, 0);
    const pkgCollected = pkgPayments.reduce((s, p) => s + p.amount, 0);
    const pkgPending = Math.max(pkgTotal - pkgCollected, 0);
    const trainTotal = trainData.tickets.reduce((s, t) => s + t.price, 0);
    const trainCollected = trainData.payments.reduce((s, p) => s + p.amount, 0);
    const trainPending = Math.max(trainTotal - trainCollected, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const totalCollected = pkgCollected + trainCollected;
    const currentBalance = totalCollected - expenseTotal;
    const pendingPayments = pkgPending + trainPending;
    return { pkgTotal, pkgCollected, pkgPending, trainTotal, trainCollected, trainPending, expenseTotal, totalCollected, currentBalance, pendingPayments };
  }, [members, pkgPayments, trainData, expenses]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3 text-teal-700">
          <Mountain size={32} className="animate-pulse" />
          <span className="text-sm font-medium">Loading trip data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center text-white"><Mountain size={18} /></div>
            <div>
              <div className="font-bold text-slate-800 leading-tight text-sm sm:text-base" style={{ fontFamily: "'Fraunces', serif" }}>Trip Expense Manager</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1"><MapPin size={10} /> Ahmedabad – Delhi – Shimla – Manali – Kullu – Kasol</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full"><ShieldCheck size={12} /> Admin</span>
                <button onClick={doLogout} className="text-xs font-medium text-slate-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1"><LogOut size={13} /> <span className="hidden sm:inline">Logout</span></button>
              </>
            ) : (
              <>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-full"><UserCircle2 size={12} /> Member view</span>
                <button onClick={() => setShowLogin(true)} className="text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg">Admin Login</button>
              </>
            )}
            <button className="md:hidden text-slate-500 p-1" onClick={() => setMobileNavOpen((v) => !v)}><Menu size={20} /></button>
          </div>
        </div>
        <nav className={"max-w-7xl mx-auto px-4 sm:px-6 border-t border-stone-100 overflow-x-auto no-scrollbar " + (mobileNavOpen ? "block" : "hidden md:block")}>
          <div className="flex gap-1 py-2 min-w-max">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = tab === n.key;
              return (
                <button key={n.key} onClick={() => { setTab(n.key); setMobileNavOpen(false); }}
                  className={"flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap " + (active ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-stone-100")}>
                  <Icon size={15} /> {n.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "dashboard" && <DashboardTab totals={totals} members={members} categoryBreakdown={categoryBreakdown} trainData={trainData} />}
        {tab === "package" && <PackagePaymentsTab members={members} pkgPayments={pkgPayments} memberStats={memberStats} isAdmin={isAdmin} onAddPayment={addPkgPayment} onDeletePayment={deletePkgPayment} />}
        {tab === "train" && <TrainPaymentsTab members={members} trainData={trainData} isAdmin={isAdmin} onSetTicket={setTicket} onAddPayment={addTrainPayment} onDeletePayment={deleteTrainPayment} />}
        {tab === "expenses" && <ExpensesTab members={members} expenses={expenses} isAdmin={isAdmin} onAdd={addExpense} onDelete={deleteExpense} />}
        {tab === "settlements" && <SettlementsTab members={members} finalBalances={finalBalances} suggested={suggestedSettlements} completedSettlements={completedSettlements} isAdmin={isAdmin} onMarkSettled={markSettled} onUndoSettlement={undoSettlement} />}
        {tab === "members" && <MembersTab members={members} memberStats={memberStats} isAdmin={isAdmin} onAdd={addMember} onUpdate={updateMember} onRemove={removeMember} />}
        {tab === "reports" && <ReportsTab members={members} memberStats={memberStats} expenses={expenses} categoryBreakdown={categoryBreakdown} trainData={trainData} />}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">Trip Expense Manager · Data is saved in this browser</footer>

      <Modal open={showLogin} onClose={() => { setShowLogin(false); setPinInput(""); setPinError(false); }} title="Admin Login">
        <p className="text-xs text-slate-500 mb-3">Enter the admin PIN to manage payments, expenses and members.</p>
        <Field label="PIN">
          <input type="password" className={inputCls} value={pinInput} onChange={(e) => { setPinInput(e.target.value); setPinError(false); }} onKeyDown={(e) => e.key === "Enter" && doLogin()} autoFocus />
        </Field>
        {pinError && <div className="text-xs text-rose-600 mb-2">Incorrect PIN, try again.</div>}
        <button onClick={doLogin} className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2.5 text-sm font-medium">Login as Admin</button>
      </Modal>
    </div>
  );
}
