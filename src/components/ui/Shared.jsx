// src/components/ui/Shared.jsx — Industrial UI Kit
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, Bell, Check } from "lucide-react";
import { T, mono, sans, pc } from "../../theme/tokens";

export const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: T.bg.card, border: `1px solid ${T.b.s}`, borderRadius: 2, padding: 12, overflow: "hidden", cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>
);

export const Metric = ({ label, value, sub, subC, icon: I, bc }) => (
  <Card style={{ borderLeft: `2px solid ${bc || T.accent}`, borderRadius: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ color: T.t.m, fontSize: 9, fontFamily: mono, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
        <div style={{ color: T.t.p, fontSize: 18, fontFamily: mono, fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ color: subC || T.t.s, fontSize: 11, fontFamily: mono, marginTop: 2 }}>{sub}</div>}
      </div>
      {I && <I size={16} style={{ color: bc || T.accent, opacity: 0.4 }} />}
    </div>
  </Card>
);

export const Badge = ({ children, color = T.accent, style = {} }) => (
  <span style={{ display: "inline-flex", padding: "1px 6px", borderRadius: 1, fontSize: 10, fontFamily: mono, fontWeight: 600, color, background: color + "15", border: `1px solid ${color}30`, textTransform: "uppercase", letterSpacing: 0.5, ...style }}>{children}</span>
);

export const Spark = ({ data, w = 70, h = 24 }) => {
  if (!data?.length) return null;
  const vals = data.map(d => d.price || d.y || 0);
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const cl = vals[vals.length - 1] >= vals[0] ? T.g.m : T.r.m;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - mn) / rg) * h}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={cl} strokeWidth="1.5" /></svg>;
};

export const TabBar = ({ tabs, active, set }) => (
  <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.b.s}`, flexWrap: "wrap" }}>
    {tabs.map(t => <button key={t} onClick={() => set(t)} style={{
      padding: "6px 12px", border: "none", cursor: "pointer",
      fontFamily: mono, fontSize: 10, fontWeight: active === t ? 700 : 400,
      background: "transparent",
      color: active === t ? T.accent : T.t.m,
      borderBottom: active === t ? `2px solid ${T.accent}` : '2px solid transparent',
      textTransform: "uppercase", letterSpacing: 0.8,
    }}>{t}</button>)}
  </div>
);

export const Gauge = ({ v }) => { const c = v >= 80 ? T.g.m : v >= 60 ? T.w.m : T.r.m; return (<div style={{ position: "relative", width: 44, height: 44 }}><svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}><circle cx={22} cy={22} r={17} fill="none" stroke={T.bg.deep} strokeWidth={3} /><circle cx={22} cy={22} r={17} fill="none" stroke={c} strokeWidth={3} strokeDasharray={`${(v / 100) * 107} 107`} strokeLinecap="butt" /></svg><div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 11, fontWeight: 700, color: c }}>{v}%</div></div>); };

export const CTip = ({ active, payload, label }) => { if (!active || !payload?.length) return null; return (<div style={{ background: T.bg.el, border: `1px solid ${T.b.m}`, borderRadius: 2, padding: "6px 10px", fontFamily: mono, fontSize: 10 }}><div style={{ color: T.t.m, marginBottom: 2 }}>{label}</div>{payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}</div>)}</div>); };

export const StrBar = ({ v, mx = 10 }) => { const p = (v / mx) * 100; const c = p >= 80 ? T.g.m : p >= 50 ? T.w.m : T.r.m; return (<div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 50, height: 4, borderRadius: 0, background: T.bg.deep }}><div style={{ width: `${p}%`, height: "100%", background: c }} /></div><span style={{ fontFamily: mono, fontSize: 10, color: c, fontWeight: 600 }}>{v}/{mx}</span></div>); };

export const Btn = ({ children, onClick, primary, style = {} }) => (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 2, border: primary ? "none" : `1px solid ${T.b.s}`, background: primary ? T.accent : "transparent", color: primary ? "#000" : T.t.s, cursor: "pointer", fontSize: 11, fontFamily: mono, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, ...style }}>{children}</button>);

export const Toasts = ({ toasts }) => (
  <div style={{ position: "fixed", top: 12, right: 12, zIndex: 2000, display: "flex", flexDirection: "column", gap: 6 }}>
    {toasts.map(t => (
      <div key={t.id} style={{ padding: "8px 14px", borderRadius: 2, fontFamily: mono, fontSize: 11, color: "#fff", background: t.type === "error" ? T.r.m : t.type === "success" ? T.g.m : T.accent, display: "flex", alignItems: "center", gap: 6, maxWidth: 320, border: `1px solid ${t.type === "error" ? T.r.m : t.type === "success" ? T.g.m : T.accent}` }}>
        {t.type === "error" ? <AlertTriangle size={12} /> : t.type === "success" ? <Check size={12} /> : <Bell size={12} />}
        {t.msg}
      </div>
    ))}
  </div>
);
