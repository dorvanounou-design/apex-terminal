// src/components/Portfolio.jsx — "Truth Serum" Portfolio Module
import { useState, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Briefcase, TrendingUp, Star, AlertTriangle, DollarSign, RefreshCw, Plus, Loader, Upload } from "lucide-react";
import { T, mono, display, pc, D, pct } from "../theme/tokens";
import { fetchPrice } from "../api/finance";
import { Card, Metric, Badge, TabBar, Btn } from "./ui/Shared";
import AddModal from "./AddModal";
import DetailPanel from "./DetailPanel";
import VintageChart from "./VintageChart";
import CryptoOnChain from "./CryptoOnChain";
import ImportModal from "./ImportModal";

const DECISION_COLORS = {
  'Thesis': '#3b82f6',
  'Conviction': '#22c55e',
  'FOMO': '#ef4444',
  'Boredom': '#71717a',
};

const Portfolio = ({ holdings, setHoldings, cash, toast }) => {
  const [filt, setFilt] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rfsh, setRfsh] = useState(false);

  const refresh = useCallback(async () => {
    setRfsh(true); toast("Refreshing prices...", "info");
    const up = await Promise.all(holdings.map(async h => {
      const p = await fetchPrice(h.tk);
      return p ? { ...h, cur: p.price, ch: p.changePct || 0, nm: p.name || h.nm } : h;
    }));
    setHoldings(up); setRfsh(false); toast("Prices updated", "success");
  }, [holdings, setHoldings, toast]);

  const data = useMemo(() => {
    let d = filt === "All" ? holdings : filt === "Stocks" ? holdings.filter(h => h.tp === "stock") : holdings.filter(h => h.tp === "crypto");
    return d.map(h => ({
      ...h,
      val: (h.qty || 0) * (h.cur || 0),
      cost: (h.qty || 0) * (h.avg || 0),
      pnl: (h.qty || 0) * (h.cur || 0) - (h.qty || 0) * (h.avg || 0),
      pp: h.avg ? ((h.cur - h.avg) / h.avg) * 100 : 0,
    }));
  }, [filt, holdings]);

  const TV = data.reduce((s, h) => s + h.val, 0);
  const TC = data.reduce((s, h) => s + h.cost, 0);
  const PV = TV + cash;
  const tPnl = TV - TC;
  const tPnlP = TC > 0 ? (tPnl / TC) * 100 : 0;
  const best = data.length ? data.reduce((a, b) => a.pp > b.pp ? a : b) : null;
  const worst = data.length ? data.reduce((a, b) => a.pp < b.pp ? a : b) : null;

  // Decision stats
  const decisionStats = useMemo(() => {
    const stats = {};
    for (const h of data) {
      const d = h.decision || 'Thesis';
      if (!stats[d]) stats[d] = { count: 0, totalPnl: 0 };
      stats[d].count++;
      stats[d].totalPnl += h.pnl;
    }
    return stats;
  }, [data]);

  const pie = [
    { n: "Stocks", v: holdings.filter(h => h.tp === "stock").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.blue },
    { n: "Crypto", v: holdings.filter(h => h.tp === "crypto").reduce((s, h) => s + h.qty * h.cur, 0), c: T.a.cyan },
    { n: "Cash", v: cash, c: T.t.f },
  ].filter(p => p.v > 0);

  const handleAdd = nw => {
    setHoldings(prev => {
      const i = prev.findIndex(h => h.tk === nw.tk);
      if (i >= 0) {
        const o = prev[i];
        const tq = o.qty + nw.qty;
        const na = (o.qty * o.avg + nw.qty * nw.avg) / tq;
        const u = [...prev];
        u[i] = { ...o, qty: tq, avg: +na.toFixed(2), cur: nw.cur, ch: nw.ch, entryDate: nw.entryDate || o.entryDate, decision: nw.decision || o.decision };
        return u;
      }
      return [...prev, nw];
    });
  };
  const remove = tk => { setHoldings(p => p.filter(h => h.tk !== tk)); toast(tk + " removed", "info"); };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Briefcase size={16} color={T.accent} />
          <div>
            <div style={{ fontFamily: display, fontSize: 22, fontWeight: 600, color: T.t1, lineHeight: 1 }}>Portfolio Audit</div>
            <div style={{ fontFamily: mono, fontSize: 7, color: T.t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>Truth Serum Mode</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn onClick={refresh}>{rfsh ? <Loader size={12} /> : <RefreshCw size={12} />} Refresh</Btn>
          <Btn primary onClick={() => setShowAdd(true)}><Plus size={12} /> Add</Btn>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 12 }}>
        <Metric label="Portfolio Value" value={D(PV)} sub={pct(tPnlP) + " all time"} subC={pc(tPnl)} icon={DollarSign} bc={T.a.blue} />
        <Metric label="Total P&L" value={(tPnl >= 0 ? "+" : "") + D(tPnl)} subC={pc(tPnl)} icon={TrendingUp} bc={pc(tPnl)} />
        {best && <Metric label="Best" value={best.tk} sub={pct(best.pp)} subC={T.g.m} icon={Star} bc={T.g.m} />}
        {worst && <Metric label="Worst" value={worst.tk} sub={pct(worst.pp)} subC={T.r.m} icon={AlertTriangle} bc={T.r.m} />}
      </div>

      {/* Decision Type Audit — behavioral feedback */}
      {Object.keys(decisionStats).length > 0 && data.length > 0 && (
        <Card style={{ marginBottom: 12, padding: '8px 12px', borderLeft: `2px solid ${T.accent}` }}>
          <div style={{ fontFamily: display, fontSize: 14, color: T.t1, marginBottom: 6 }}>Behavioral Audit</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(decisionStats).map(([type, stat]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: T.bg.deep, borderRadius: 2, border: `1px solid ${DECISION_COLORS[type] || T.b1}20` }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: DECISION_COLORS[type] || T.t3 }} />
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: DECISION_COLORS[type] || T.t3 }}>{type}</div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: T.t3 }}>
                    {stat.count} pos • <span style={{ color: pc(stat.totalPnl) }}>{stat.totalPnl >= 0 ? '+' : ''}{D(stat.totalPnl)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Vintage Chart */}
      <div style={{ marginBottom: 12 }}>
        <VintageChart holdings={holdings} />
      </div>

      {/* Main grid: Allocation + Table */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,220px) 1fr", gap: 10, marginBottom: 12 }}>
        <Card>
          <div style={{ color: T.t.m, fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: mono }}>Allocation</div>
          {pie.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart><Pie data={pie} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="v" stroke="none">
                {pie.map((e, i) => <Cell key={i} fill={e.c} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: "center", color: T.t.m, padding: 30, fontSize: 11 }}>Add positions</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {pie.map(p => (
              <div key={p.n} style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: p.c }} />
                  <span style={{ color: T.t.s, fontSize: 10, fontFamily: mono }}>{p.n}</span>
                </div>
                <span style={{ color: T.t.p, fontSize: 10, fontFamily: mono }}>{PV > 0 ? ((p.v / PV) * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <TabBar tabs={["All", "Stocks", "Crypto"]} active={filt} set={setFilt} />
            <span style={{ color: T.t.m, fontSize: 10, fontFamily: mono }}>{data.length} positions</span>
          </div>
          {data.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: T.t.m }}>
              <div style={{ fontSize: 12, marginBottom: 8, fontFamily: display }}>No positions yet</div>
              <Btn primary onClick={() => setShowAdd(true)} style={{ margin: "0 auto" }}><Plus size={12} /> Add first</Btn>
            </div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 340, border: `1px solid ${T.b.s}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                <thead>
                  <tr style={{ background: T.bg.deep }}>
                    {["Asset", "Type", "Qty", "Avg", "Price", "24h", "P&L", "P&L%", "Value"].map(h => (
                      <th key={h} style={{
                        padding: "6px 8px", textAlign: h === "Asset" || h === "Type" ? "left" : "right",
                        color: T.t.m, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.8,
                        fontWeight: 400, borderBottom: `1px solid ${T.b.s}`, whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const dec = r.decision || 'Thesis';
                    const decColor = DECISION_COLORS[dec] || T.t3;
                    return (
                      <tr key={i} onClick={() => setSelected(r)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.b.s}08` }}
                        onMouseEnter={e => e.currentTarget.style.background = T.bg.el}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: 2,
                              background: r.tp === "crypto" ? T.a.cyan + "20" : T.a.blue + "20",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 7, fontWeight: 700, color: r.tp === "crypto" ? T.a.cyan : T.a.blue,
                            }}>{r.tk.slice(0, 2)}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 10 }}>{r.tk}</div>
                              <div style={{ fontSize: 7, color: T.t.m }}>{r.nm}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "left" }}>
                          <span style={{
                            fontSize: 7, padding: '1px 4px', borderRadius: 1,
                            color: decColor, background: decColor + '12',
                            border: `1px solid ${decColor}25`, fontWeight: 600,
                          }}>{dec}</span>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 10 }}>{r.qty < 10 ? r.qty.toFixed(4) : r.qty}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{D(r.avg)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{D(r.cur)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: pc(r.ch) }}>{pct(r.ch)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: pc(r.pnl), fontWeight: 600 }}>{D(r.pnl)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}><Badge color={pc(r.pp)}>{pct(r.pp)}</Badge></td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{D(r.val)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* On-Chain Pulse for crypto holdings */}
      <CryptoOnChain holdings={holdings} />

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} toast={toast} />}
      {selected && <DetailPanel holding={selected} onClose={() => setSelected(null)} onRemove={remove} />}
    </div>
  );
};

export default Portfolio;
