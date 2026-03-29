// src/components/Risk.jsx
import { useState } from "react";
import { Shield } from "lucide-react";
import { T, mono, sans, D } from "../theme/tokens";
import { Card } from "./ui/Shared";

const RiskMod = ({ holdings, cash }) => {
  const [rp, setRp] = useState(2); const [ep, setEp] = useState(180); const [sp, setSp] = useState(172);
  const TV = holdings.reduce((s, h) => s + h.qty * h.cur, 0); const PV = TV + cash;
  const rd = PV * (rp / 100); const sd = Math.abs(ep - sp); const ps = sd > 0 ? Math.floor(rd / sd) : 0; const pv = ps * ep; const pw = PV > 0 ? (pv / PV * 100).toFixed(1) : "0";
  return (
    <div>
      <h2 style={{ fontSize: 18, fontFamily: sans, fontWeight: 600, color: T.t.p, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px" }}><Shield size={18} color={T.a.blue} />Risk & Position Sizer</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 13, color: T.t.p, fontWeight: 600, marginBottom: 14, fontFamily: sans }}>Position Size Calculator</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div><label style={{ fontSize: 10, color: T.t.m, display: "block", marginBottom: 3, textTransform: "uppercase" }}>Account ({D(PV)})</label></div>
            <div><label style={{ fontSize: 10, color: T.t.m, display: "block", marginBottom: 3, textTransform: "uppercase" }}>Risk %</label><div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="range" min={0.5} max={5} step={0.5} value={rp} onChange={e => setRp(+e.target.value)} style={{ flex: 1, accentColor: T.a.blue }} /><span style={{ fontFamily: mono, fontSize: 15, color: T.a.blue, fontWeight: 700, width: 45, textAlign: "right" }}>{rp}%</span></div></div>
            {[["Entry Price", ep, setEp], ["Stop Loss", sp, setSp]].map(([l, v, s]) => <div key={l}><label style={{ fontSize: 10, color: T.t.m, display: "block", marginBottom: 3, textTransform: "uppercase" }}>{l}</label><input type="number" min="0" value={v} onChange={e => s(+e.target.value)} style={{ width: "100%", padding: "7px 10px", background: T.bg.deep, border: `1px solid ${T.b.s}`, borderRadius: 7, color: T.t.p, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" }} /></div>)}
            <div style={{ borderTop: `1px solid ${T.b.s}`, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 9, color: T.t.m, textTransform: "uppercase", marginBottom: 3 }}>Shares</div><div style={{ fontFamily: mono, fontSize: 20, color: T.a.blue, fontWeight: 700 }}>{ps}</div></div>
              <div><div style={{ fontSize: 9, color: T.t.m, textTransform: "uppercase", marginBottom: 3 }}>$ Risk</div><div style={{ fontFamily: mono, fontSize: 20, color: T.r.m, fontWeight: 700 }}>{D(rd)}</div></div>
              <div><div style={{ fontSize: 9, color: T.t.m, textTransform: "uppercase", marginBottom: 3 }}>Position $</div><div style={{ fontFamily: mono, fontSize: 14, color: T.t.p }}>{D(pv)}</div></div>
              <div><div style={{ fontSize: 9, color: T.t.m, textTransform: "uppercase", marginBottom: 3 }}>Weight</div><div style={{ fontFamily: mono, fontSize: 14, color: T.t.p }}>{pw}%</div></div>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: T.t.p, fontWeight: 600, marginBottom: 14, fontFamily: sans }}>Exposure</div>
          {[{ l: "Stocks", v: holdings.filter(h => h.tp === "stock").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.blue }, { l: "Crypto", v: holdings.filter(h => h.tp === "crypto").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.cyan }, { l: "Cash", v: cash, c: T.t.f }].map(it => (
            <div key={it.l} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: T.t.s }}>{it.l}</span><span style={{ fontSize: 12, fontFamily: mono, color: T.t.p }}>{D(it.v)} ({PV > 0 ? (it.v / PV * 100).toFixed(1) : 0}%)</span></div>
              <div style={{ height: 6, borderRadius: 3, background: T.bg.deep }}><div style={{ width: `${PV > 0 ? (it.v / PV) * 100 : 0}%`, height: "100%", borderRadius: 3, background: it.c }} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

export default RiskMod;
