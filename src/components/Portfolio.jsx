// src/components/Portfolio.jsx — "Truth Serum" Portfolio Module v3 (d3.js)
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as d3 from "d3";
import { Briefcase, TrendingUp, Star, AlertTriangle, DollarSign, RefreshCw, Plus, Loader, Upload, ChevronDown, ChevronRight, Eye, EyeOff, Edit3, Check } from "lucide-react";
import { T, mono, pc, D, pct } from "../theme/tokens";
import { fetchPrice } from "../api/finance";
import { Card, Metric, Badge, TabBar, Btn, DriftCard } from "./ui/Shared";
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

const DECISION_ICONS = {
  'Thesis': '🎯',
  'Conviction': '💎',
  'FOMO': '🔥',
  'Boredom': '😐',
};

const Portfolio = ({ holdings, setHoldings, cash, setCash, toast }) => {
  const [filt, setFilt] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rfsh, setRfsh] = useState(false);
  const [editCash, setEditCash] = useState(false);
  const [cashInput, setCashInput] = useState(cash.toString());
  const [sections, setSections] = useState({ metrics: true, audit: true, vintage: true, holdings: true, onchain: true, history: false });
  const allOpen = Object.values(sections).every(Boolean);
  const toggleAll = () => setSections(Object.fromEntries(Object.keys(sections).map(k => [k, !allOpen])));
  const toggle = k => setSections(p => ({ ...p, [k]: !p[k] }));

  // Trade history from broker
  const TRADE_HISTORY = [
    { date: '27/10/2025', action: 'SELL', tk: 'BITW', qty: 20, price: 78.47, pnl: 857.80 },
    { date: '27/10/2025', action: 'SELL', tk: 'WULF', qty: 40, price: 13.76, pnl: 463.60 },
    { date: '27/10/2025', action: 'SELL', tk: 'SMH', qty: 4, price: 359.44, pnl: 461.16 },
    { date: '27/10/2025', action: 'SELL', tk: 'RBLX', qty: 8, price: 130.05, pnl: 561.60 },
    { date: '27/10/2025', action: 'SELL', tk: 'BLOK', qty: 15, price: 72.55, pnl: 300.29 },
    { date: '15/10/2025', action: 'SELL', tk: 'RBLX', qty: 3, price: 140.09, pnl: 240.72 },
    { date: '15/10/2025', action: 'SELL', tk: 'WULF', qty: 30, price: 15.79, pnl: 408.60 },
    { date: '15/12/2025', action: 'SELL', tk: 'BITW', qty: 15, price: 60.88, pnl: 508.20 },
    { date: '12/12/2024', action: 'BUY', tk: 'RBLX', qty: 16, price: 59.85, pnl: 0 },
    { date: '10/12/2024', action: 'SELL', tk: 'SONN', qty: 350, price: 2.03, pnl: -732.18 },
    { date: '09/12/2024', action: 'BUY', tk: 'SONN', qty: 150, price: 3.73, pnl: 0 },
    { date: '09/12/2024', action: 'BUY', tk: 'SONN', qty: 200, price: 4.42, pnl: 0 },
    { date: '09/12/2024', action: 'SELL', tk: 'GOOG', qty: 10, price: 175.82, pnl: -33.76 },
    { date: '30/07/2024', action: 'SELL', tk: 'TAL', qty: 10, price: 10.58, pnl: 44.20 },
    { date: '30/07/2024', action: 'SELL', tk: 'JMIA', qty: 35, price: 12.34, pnl: 85.81 },
    { date: '09/07/2024', action: 'BUY', tk: 'JMIA', qty: 35, price: 9.89, pnl: 0 },
    { date: '20/06/2024', action: 'SELL', tk: 'MGOL', qty: 350, price: 0.74, pnl: -258.55 },
    { date: '20/06/2024', action: 'BUY', tk: 'MGOL', qty: 350, price: 1.48, pnl: 0 },
    { date: '20/06/2024', action: 'SELL', tk: 'CMTL', qty: 140, price: 3.98, pnl: 58.83 },
    { date: '18/06/2024', action: 'BUY', tk: 'CMTL', qty: 166, price: 3.56, pnl: 0 },
  ];

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

  const decisionStats = useMemo(() => {
    const stats = {};
    for (const h of data) {
      const d = h.decision || 'Thesis';
      if (!stats[d]) stats[d] = { count: 0, totalPnl: 0, totalVal: 0 };
      stats[d].count++;
      stats[d].totalPnl += h.pnl;
      stats[d].totalVal += h.val;
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

  const saveCash = () => {
    const v = parseFloat(cashInput);
    if (!isNaN(v) && v >= 0) { setCash(v); setEditCash(false); toast("Cash updated", "success"); }
  };

  const SectionHead = ({ id, label, children }) => (
    <button onClick={() => toggle(id)} aria-label={sections[id] ? `Collapse ${label}` : `Expand ${label}`} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
      cursor: 'pointer', padding: '6px 0', marginBottom: sections[id] ? 8 : 14, width: '100%',
    }}>
      {sections[id] ? <ChevronDown size={11} color={T.t.m} /> : <ChevronRight size={11} color={T.t.m} />}
      <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>{label}</span>
      {children}
    </button>
  );

  const histBuys = TRADE_HISTORY.filter(t => t.action === 'BUY').length;
  const histSells = TRADE_HISTORY.filter(t => t.action === 'SELL').length;
  const histPnl = TRADE_HISTORY.reduce((s, t) => s + t.pnl, 0);

  // D3 Donut Chart component
  const D3Donut = ({ data, total }) => {
    const [hoveredSlice, setHoveredSlice] = useState(null);
    const size = 160, outerR = 65, innerR = 42;

    const arcs = useMemo(() => {
      const pieGen = d3.pie().value(d => d.v).sort(null).padAngle(0.03);
      const arcGen = d3.arc().innerRadius(innerR).outerRadius(outerR).cornerRadius(3);
      const arcHover = d3.arc().innerRadius(innerR - 2).outerRadius(outerR + 4).cornerRadius(3);
      return pieGen(data).map(d => ({
        path: arcGen(d),
        hoverPath: arcHover(d),
        data: d.data,
        centroid: arcGen.centroid(d),
      }));
    }, [data]);

    return (
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', maxHeight: 160 }}>
        <g transform={`translate(${size / 2},${size / 2})`}>
          {arcs.map((a, i) => (
            <path key={i} d={hoveredSlice === i ? a.hoverPath : a.path}
              fill={a.data.c} opacity={hoveredSlice !== null && hoveredSlice !== i ? 0.4 : 1}
              stroke={T.bg.card} strokeWidth={1}
              style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredSlice(i)}
              onMouseLeave={() => setHoveredSlice(null)} />
          ))}
          <text y={-2} textAnchor="middle" fill={T.t.p} fontFamily={mono} fontSize={13} fontWeight={700}>
            {D(total)}
          </text>
          <text y={12} textAnchor="middle" fill={T.t.m} fontFamily={mono} fontSize={7}>
            TOTAL
          </text>
        </g>
        {/* Hover tooltip */}
        {hoveredSlice !== null && arcs[hoveredSlice] && (() => {
          const a = arcs[hoveredSlice];
          const tx = a.centroid[0] * 1.6;
          const ty = a.centroid[1] * 1.6;
          return (
            <g transform={`translate(${size / 2 + tx},${size / 2 + ty})`}>
              <rect x={-30} y={-16} width={60} height={22} rx={3}
                fill={T.bg.card + 'f0'} stroke={a.data.c + '60'} strokeWidth={0.5} />
              <text y={-3} textAnchor="middle" fill={a.data.c} fontFamily={mono} fontSize={8} fontWeight={600}>
                {a.data.n}
              </text>
              <text y={8} textAnchor="middle" fill={T.t.m} fontFamily={mono} fontSize={7}>
                {total > 0 ? ((a.data.v / total) * 100).toFixed(1) : 0}%
              </text>
            </g>
          );
        })()}
      </svg>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: T.rad.md,
            background: T.accent + '12', border: `1px solid ${T.accent}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Briefcase size={18} color={T.accent} />
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 600, color: T.t.p, lineHeight: 1 }}>Portfolio Audit</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>Truth Serum Mode</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: 'wrap' }}>
          <Btn onClick={toggleAll} aria-label={allOpen ? 'Collapse all sections' : 'Expand all sections'}>{allOpen ? <EyeOff size={12} /> : <Eye size={12} />} {allOpen ? 'Collapse' : 'Expand'}</Btn>
          <Btn onClick={refresh} aria-label="Refresh prices">{rfsh ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Refresh</Btn>
          <Btn onClick={() => setShowImport(true)} aria-label="Import portfolio"><Upload size={12} /> Import</Btn>
          <Btn primary onClick={() => setShowAdd(true)} aria-label="Add position"><Plus size={12} /> Add</Btn>
        </div>
      </div>

      {/* Metrics row */}
      <SectionHead id="metrics" label="Overview" />
      {sections.metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
          <Metric label="Portfolio Value" value={D(PV)} sub={pct(tPnlP) + " all time"} subC={pc(tPnl)} icon={DollarSign} bc={T.a.blue} />
          <Metric label="Total P&L" value={(tPnl >= 0 ? "+" : "") + D(tPnl)} subC={pc(tPnl)} icon={TrendingUp} bc={pc(tPnl)} />
          {best && <Metric label="Best" value={best.tk} sub={pct(best.pp)} subC={T.g.m} icon={Star} bc={T.g.m} />}
          {worst && <Metric label="Worst" value={worst.tk} sub={pct(worst.pp)} subC={T.r.m} icon={AlertTriangle} bc={T.r.m} />}
        </div>
      )}

      {/* Decision Type Audit */}
      {Object.keys(decisionStats).length > 0 && data.length > 0 && (<>
        <SectionHead id="audit" label="Behavioral Audit" />
        {sections.audit && (
          <Card style={{ marginBottom: 14, padding: '12px 14px', borderLeft: `3px solid ${T.accent}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {Object.entries(decisionStats).map(([type, stat]) => {
                const color = DECISION_COLORS[type] || T.t.m;
                const pnlPct = stat.totalVal > 0 ? (stat.totalPnl / (stat.totalVal - stat.totalPnl)) * 100 : 0;
                return (
                  <div key={type} style={{
                    padding: '10px 12px', background: T.bg.deep, borderRadius: T.rad.sm,
                    border: `1px solid ${color}20`, position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Progress bar background */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.min(Math.abs(pnlPct), 100)}%`,
                      background: stat.totalPnl >= 0 ? T.g.m + '08' : T.r.m + '08',
                    }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color }}>{type}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m, marginLeft: 'auto' }}>{stat.count} pos</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: pc(stat.totalPnl) }}>
                          {stat.totalPnl >= 0 ? '+' : ''}{D(stat.totalPnl)}
                        </span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: pc(pnlPct) }}>{pct(pnlPct)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </>)}

      {/* Vintage Chart */}
      <SectionHead id="vintage" label="Inception Performance" />
      {sections.vintage && (
        <div style={{ marginBottom: 14 }}>
          <VintageChart holdings={holdings} />
        </div>
      )}

      {/* Main grid: Allocation + Table */}
      <SectionHead id="holdings" label={`Holdings (${data.length})`} />
      {sections.holdings && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,240px) 1fr", gap: 12, marginBottom: 14 }}>
          {/* Allocation card */}
          <Card style={{ padding: '14px 16px' }}>
            <div style={{ color: T.t.m, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, fontFamily: mono, fontWeight: 500 }}>Allocation</div>
            {pie.length > 0 ? (
              <D3Donut data={pie} total={PV} />
            ) : <div style={{ textAlign: "center", color: T.t.m, padding: 30, fontSize: 11 }}>Add positions</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {pie.map(p => (
                <div key={p.n} style={{ display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.c }} />
                    <span style={{ color: T.t.s, fontSize: 11, fontFamily: mono }}>{p.n}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: T.t.p, fontSize: 11, fontFamily: mono, fontWeight: 600 }}>{D(p.v)}</span>
                    <span style={{ color: T.t.m, fontSize: 10, fontFamily: mono, minWidth: 36, textAlign: 'right' }}>{PV > 0 ? ((p.v / PV) * 100).toFixed(1) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Editable cash */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.b.s}` }}>
              {editCash ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: T.t.m, fontFamily: mono }}>$</span>
                  <input type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveCash()}
                    autoFocus
                    style={{
                      flex: 1, padding: '5px 8px', background: T.bg.deep,
                      border: `1px solid ${T.accent}`, borderRadius: T.rad.sm,
                      color: T.t.p, fontFamily: mono, fontSize: 12, outline: 'none',
                    }} />
                  <button onClick={saveCash} aria-label="Save cash" style={{
                    padding: '4px 8px', background: T.accent + '15', border: `1px solid ${T.accent}40`,
                    borderRadius: T.rad.sm, cursor: 'pointer', color: T.accent, display: 'flex',
                  }}><Check size={12} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.t.m, fontFamily: mono }}>Cash Balance</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: mono, fontWeight: 600, color: T.t.p }}>{D(cash)}</span>
                    <button onClick={() => { setCashInput(cash.toString()); setEditCash(true); }}
                      aria-label="Edit cash balance"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t.f, padding: 2 }}>
                      <Edit3 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Holdings table */}
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <TabBar tabs={["All", "Stocks", "Crypto"]} active={filt} set={setFilt} />
              <span style={{ color: T.t.m, fontSize: 10, fontFamily: mono }}>{data.length} positions</span>
            </div>
            {data.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: T.t.m }}>
                <div style={{ fontSize: 13, marginBottom: 10, fontFamily: mono }}>No positions yet</div>
                <Btn primary onClick={() => setShowAdd(true)} style={{ margin: "0 auto" }}><Plus size={12} /> Add first</Btn>
              </div>
            ) : (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 360, border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: T.bg.deep }}>
                      {["Asset", "Type", "Qty", "Avg", "Price", "24h", "P&L", "P&L%", "Value"].map(h => (
                        <th key={h} style={{
                          padding: "7px 8px", textAlign: h === "Asset" || h === "Type" ? "left" : "right",
                          color: T.t.m, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8,
                          fontWeight: 500, borderBottom: `1px solid ${T.b.s}`, whiteSpace: "nowrap",
                          position: 'sticky', top: 0, background: T.bg.deep, zIndex: 1,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => {
                      const dec = r.decision || 'Thesis';
                      const decColor = DECISION_COLORS[dec] || T.t.m;
                      return (
                        <tr key={i} onClick={() => setSelected(r)} style={{
                          cursor: "pointer", borderBottom: `1px solid ${T.b.s}08`,
                          transition: T.tr.fast,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "7px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: T.rad.sm,
                                background: r.tp === "crypto" ? T.a.cyan + "15" : T.a.blue + "15",
                                border: `1px solid ${r.tp === "crypto" ? T.a.cyan : T.a.blue}20`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 8, fontWeight: 700, color: r.tp === "crypto" ? T.a.cyan : T.a.blue,
                              }}>{r.tk.slice(0, 2)}</div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 11 }}>{r.tk}</div>
                                <div style={{ fontSize: 8, color: T.t.m, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nm}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "7px 8px", textAlign: "left" }}>
                            <span style={{
                              fontSize: 8, padding: '2px 6px', borderRadius: T.rad.sm,
                              color: decColor, background: decColor + '10',
                              border: `1px solid ${decColor}20`, fontWeight: 600,
                            }}>{dec}</span>
                          </td>
                          <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 10 }}>{r.qty < 10 ? r.qty.toFixed(4) : r.qty}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>{D(r.avg)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600 }}>{D(r.cur)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: pc(r.ch), fontWeight: 500 }}>{pct(r.ch)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: pc(r.pnl), fontWeight: 600 }}>{D(r.pnl)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right" }}><Badge color={pc(r.pp)}>{pct(r.pp)}</Badge></td>
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600 }}>{D(r.val)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* On-Chain Pulse */}
      <SectionHead id="onchain" label="On-Chain Pulse" />
      {sections.onchain && <CryptoOnChain holdings={holdings} />}

      {/* Trade History */}
      <SectionHead id="history" label={`Trade History (${TRADE_HISTORY.length})`} />
      {sections.history && (
        <Card style={{ padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={T.a.blue}>{histBuys} buys</Badge>
            <Badge color={T.a.cyan}>{histSells} sells</Badge>
            <span style={{ fontFamily: mono, fontSize: 11, color: pc(histPnl), fontWeight: 700 }}>
              Realized: {histPnl >= 0 ? '+' : ''}{D(histPnl)}
            </span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, overflow: 'auto', border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 10 }}>
              <thead>
                <tr style={{ background: T.bg.deep }}>
                  {['Date', 'Action', 'Ticker', 'Qty', 'Price', 'P&L'].map(h => (
                    <th key={h} style={{
                      padding: '6px 10px', textAlign: h === 'Date' || h === 'Action' || h === 'Ticker' ? 'left' : 'right',
                      color: T.t.m, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8,
                      fontWeight: 500, borderBottom: `1px solid ${T.b.s}`,
                      position: 'sticky', top: 0, background: T.bg.deep, zIndex: 1,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRADE_HISTORY.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.b.s}08`, transition: T.tr.fast }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '6px 10px', color: T.t.s }}>{t.date}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{
                        fontSize: 8, padding: '2px 6px', borderRadius: T.rad.sm, fontWeight: 700,
                        color: t.action === 'BUY' ? T.g.m : T.r.m,
                        background: t.action === 'BUY' ? T.g.bg : T.r.bg,
                        border: `1px solid ${t.action === 'BUY' ? T.g.m + '25' : T.r.m + '25'}`,
                      }}>{t.action}</span>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{t.tk}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{t.qty}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{D(t.price)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: t.pnl === 0 ? T.t.m : pc(t.pnl), fontWeight: t.pnl !== 0 ? 600 : 400 }}>
                      {t.pnl === 0 ? '\u2014' : (t.pnl > 0 ? '+' : '') + D(t.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} toast={toast} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleAdd} toast={toast} />}
      {selected && <DetailPanel holding={selected} onClose={() => setSelected(null)} onRemove={remove} onUpdate={(tk, updates) => {
        setHoldings(prev => prev.map(h => h.tk === tk ? { ...h, ...updates } : h));
        setSelected(prev => prev ? { ...prev, ...updates } : prev);
      }} />}
    </div>
  );
};

export default Portfolio;
