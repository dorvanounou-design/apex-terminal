// src/components/Risk.jsx — Position Sizer & Exposure v2
import { useState } from "react";
import { Shield, Calculator, PieChart } from "lucide-react";
import { T, mono, D } from "../theme/tokens";
import { Card } from "./ui/Shared";

const input = (v, s, label) => (
  <input type="number" min="0" value={v} onChange={e => s(+e.target.value)} style={{
    width: "100%", padding: "8px 12px", background: T.bg.deep,
    border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm,
    color: T.t.p, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box",
    transition: T.tr.fast,
  }} />
);

const RiskMod = ({ holdings, cash }) => {
  const [rp, setRp] = useState(2);
  const [ep, setEp] = useState(180);
  const [sp, setSp] = useState(172);

  const TV = holdings.reduce((s, h) => s + h.qty * h.cur, 0);
  const PV = TV + cash;
  const rd = PV * (rp / 100);
  const sd = Math.abs(ep - sp);
  const ps = sd > 0 ? Math.floor(rd / sd) : 0;
  const pv = ps * ep;
  const pw = PV > 0 ? (pv / PV * 100).toFixed(1) : "0";
  const rr = sd > 0 && ep > sp ? ((ep * 1.1 - ep) / sd).toFixed(1) : "—";

  const exposureData = [
    { l: "Stocks", v: holdings.filter(h => h.tp === "stock").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.blue },
    { l: "Crypto", v: holdings.filter(h => h.tp === "crypto").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.cyan },
    { l: "Cash", v: cash, c: T.t.f },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: T.rad.md,
          background: T.a.blue + '12', border: `1px solid ${T.a.blue}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={18} color={T.a.blue} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontFamily: mono, fontWeight: 700, color: T.t.p, lineHeight: 1 }}>Risk & Position Sizer</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>Account: {D(PV)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        {/* Position Size Calculator */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Calculator size={14} color={T.a.blue} />
            <span style={{ fontSize: 13, color: T.t.p, fontWeight: 600, fontFamily: mono }}>Position Size Calculator</span>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {/* Risk % slider */}
            <div>
              <label style={{ fontSize: 10, color: T.t.m, display: "block", marginBottom: 5, textTransform: "uppercase", fontFamily: mono, letterSpacing: 0.8 }}>Risk %</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={0.5} max={5} step={0.5} value={rp} onChange={e => setRp(+e.target.value)}
                  style={{ flex: 1, accentColor: T.a.blue, height: 4 }} />
                <span style={{ fontFamily: mono, fontSize: 16, color: T.a.blue, fontWeight: 700, width: 48, textAlign: "right" }}>{rp}%</span>
              </div>
            </div>

            {/* Entry / Stop */}
            {[["Entry Price", ep, setEp], ["Stop Loss", sp, setSp]].map(([l, v, s]) => (
              <div key={l}>
                <label style={{ fontSize: 10, color: T.t.m, display: "block", marginBottom: 5, textTransform: "uppercase", fontFamily: mono, letterSpacing: 0.8 }}>{l}</label>
                {input(v, s, l)}
              </div>
            ))}

            {/* Results */}
            <div style={{ borderTop: `1px solid ${T.b.s}`, paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Shares", ps.toString(), T.a.blue, 22],
                ["$ Risk", D(rd), T.r.m, 22],
                ["Position $", D(pv), T.t.p, 15],
                ["Weight", pw + "%", T.t.p, 15],
              ].map(([l, v, c, sz]) => (
                <div key={l}>
                  <div style={{ fontSize: 9, color: T.t.m, textTransform: "uppercase", marginBottom: 3, fontFamily: mono, letterSpacing: 0.5 }}>{l}</div>
                  <div style={{ fontFamily: mono, fontSize: sz, color: c, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Exposure */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <PieChart size={14} color={T.a.blue} />
            <span style={{ fontSize: 13, color: T.t.p, fontWeight: 600, fontFamily: mono }}>Exposure Breakdown</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {exposureData.map(it => {
              const pctVal = PV > 0 ? (it.v / PV * 100) : 0;
              return (
                <div key={it.l}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: it.c }} />
                      <span style={{ fontSize: 12, color: T.t.s, fontFamily: mono }}>{it.l}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 12, fontFamily: mono, color: T.t.p, fontWeight: 600 }}>{D(it.v)}</span>
                      <span style={{ fontSize: 12, fontFamily: mono, color: T.t.m, minWidth: 42, textAlign: 'right' }}>{pctVal.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: T.bg.deep, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pctVal}%`, height: "100%", borderRadius: 3,
                      background: it.c, transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Concentration warning */}
          {exposureData.some(e => PV > 0 && (e.v / PV) > 0.5 && e.l !== 'Cash') && (
            <div style={{
              marginTop: 14, padding: '8px 12px', borderRadius: T.rad.sm,
              background: T.w.m + '10', border: `1px solid ${T.w.m}25`,
              fontFamily: mono, fontSize: 10, color: T.w.m,
            }}>
              High concentration detected — consider diversifying
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RiskMod;
