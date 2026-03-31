// src/components/DetailPanel.jsx — Position Detail Slide-In v3 (d3.js)
import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { X, Trash2, Calendar, Tag } from "lucide-react";
import { T, mono, sans, pc, D, fmt, pct } from "../theme/tokens";
import { isC, fetchStockDetail, fetchCryptoDetail, fetchChart } from "../api/finance";
import { Card, Badge, Btn } from "./ui/Shared";

const DECISION_OPTIONS = ['Thesis', 'Conviction', 'FOMO', 'Boredom'];
const DECISION_COLORS = { Thesis: '#3b82f6', Conviction: '#22c55e', FOMO: '#ef4444', Boredom: '#71717a' };

// D3.js 30-day area chart
const D3AreaChart = ({ data, color, loading }) => {
  const svgRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const W = 480, H = 180;
  const m = { t: 12, r: 50, b: 24, l: 8 };
  const iW = W - m.l - m.r, iH = H - m.t - m.b;

  const { xScale, yScale, linePath, areaPath } = useMemo(() => {
    if (!data || data.length === 0) return {};
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)))
      .range([0, iW]);
    const [lo, hi] = d3.extent(data, d => d.price);
    const pad = (hi - lo) * 0.08 || 1;
    const yScale = d3.scaleLinear()
      .domain([lo - pad, hi + pad])
      .range([iH, 0]);
    const line = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);
    const area = d3.area()
      .x(d => xScale(new Date(d.date)))
      .y0(iH)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);
    return { xScale, yScale, linePath: line(data), areaPath: area(data) };
  }, [data, iW, iH]);

  useEffect(() => {
    if (!xAxisRef.current || !yAxisRef.current || !xScale || !yScale) return;
    const xG = d3.select(xAxisRef.current);
    xG.selectAll("*").remove();
    xG.call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%b %d")).tickSize(0).tickPadding(6));
    xG.selectAll("text").attr("fill", T.t.m).attr("font-size", 8).attr("font-family", mono);
    xG.select(".domain").attr("stroke", T.b.s).attr("stroke-opacity", 0.3);

    const yG = d3.select(yAxisRef.current);
    yG.selectAll("*").remove();
    yG.call(d3.axisRight(yScale).ticks(4).tickFormat(d => '$' + d.toFixed(d >= 100 ? 0 : 2)).tickSize(0).tickPadding(4));
    yG.selectAll("text").attr("fill", T.t.m).attr("font-size", 8).attr("font-family", mono);
    yG.select(".domain").remove();
  }, [xScale, yScale]);

  const handleMouse = (e) => {
    if (!svgRef.current || !xScale || !data?.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W - m.l;
    if (mx < 0 || mx > iW) { setTooltip(null); return; }
    const date = xScale.invert(mx);
    const bisect = d3.bisector(d => new Date(d.date)).left;
    const idx = Math.min(bisect(data, date), data.length - 1);
    const d0 = data[Math.max(0, idx - 1)];
    const d1 = data[idx];
    const pt = !d0 ? d1 : Math.abs(new Date(d0.date) - date) < Math.abs(new Date(d1.date) - date) ? d0 : d1;
    setTooltip({ x: xScale(new Date(pt.date)), y: yScale(pt.price), price: pt.price, date: d3.timeFormat("%b %d")(new Date(pt.date)) });
  };

  return (
    <div style={{
      marginBottom: 18, padding: 16,
      background: T.bg.surface, borderRadius: 12, border: `1px solid ${T.b.s}`,
    }}>
      <div style={{ fontSize: 10, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontWeight: 600, fontFamily: mono }}>30-Day Chart</div>
      {data && data.length > 0 && linePath ? (
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouse} onMouseLeave={() => setTooltip(null)}>
          <defs>
            <linearGradient id="dp-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="50%" stopColor={color} stopOpacity="0.06" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <filter id="dpGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g transform={`translate(${m.l},${m.t})`}>
            <g ref={xAxisRef} transform={`translate(0,${iH})`} />
            <g ref={yAxisRef} transform={`translate(${iW},0)`} />
            <path d={areaPath} fill="url(#dp-area-grad)" />
            {/* Glow shadow */}
            <path d={linePath} fill="none" stroke={color} strokeWidth={4} opacity={0.12} filter="url(#dpGlow)" strokeLinecap="round" />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
            {tooltip && (
              <g>
                <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={iH} stroke={color} strokeWidth={0.5} opacity={0.3} />
                <circle cx={tooltip.x} cy={tooltip.y} r={6} fill={color} opacity={0.12} />
                <circle cx={tooltip.x} cy={tooltip.y} r={3.5} fill={color} stroke={T.bg.surface} strokeWidth={2} />
              </g>
            )}
          </g>
          {tooltip && (
            <g transform={`translate(${Math.min(tooltip.x + m.l + 10, W - 90)}, ${Math.max(tooltip.y + m.t - 36, 4)})`}>
              <rect x={0} y={0} width={78} height={32} rx={8} fill={T.bg.card + "f0"} stroke={color + '30'} strokeWidth={0.5} />
              <text x={8} y={13} fill={T.t.m} fontSize={8} fontFamily={mono}>{tooltip.date}</text>
              <text x={8} y={26} fill={color} fontSize={11} fontFamily={mono} fontWeight={700}>${tooltip.price.toFixed(2)}</text>
            </g>
          )}
        </svg>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.t.m, fontFamily: mono, fontSize: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: `2px solid ${T.b.s}`, borderTopColor: color,
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 10px',
          }} />
          Loading chart...
        </div>
      ) : (
        <div style={{ color: '#52525b', fontSize: 11, textAlign: "center", padding: 30, fontFamily: mono }}>Chart unavailable</div>
      )}
    </div>
  );
};

const DetailPanel = ({ holding, onClose, onRemove, onUpdate }) => {
  const [det, setDet] = useState(null);
  const [chart, setChart] = useState([]);
  const [ld, setLd] = useState(true);
  const [editDate, setEditDate] = useState(false);
  const [dateVal, setDateVal] = useState(holding.entryDate || '');
  const [editDecision, setEditDecision] = useState(false);

  useEffect(() => {
    let x = false;
    setLd(true);
    (async () => {
      const [d, c] = await Promise.all([
        isC(holding.tk) ? fetchCryptoDetail(holding.tk) : fetchStockDetail(holding.tk),
        fetchChart(holding.tk, 30),
      ]);
      if (!x) { setDet(d); setChart(c); setLd(false); }
    })();
    return () => { x = true; };
  }, [holding.tk]);

  const val = holding.qty * holding.cur;
  const cost = holding.qty * holding.avg;
  const pnl = val - cost;
  const pnlP = ((holding.cur - holding.avg) / holding.avg) * 100;
  const ic = isC(holding.tk);
  const rec = det?.recommendationKey;
  const tH = det?.targetPriceHigh || det?.targetHighPrice;
  const tL = det?.targetPriceLow || det?.targetLowPrice;
  const tM = det?.targetMeanPrice;
  const aN = det?.numberOfAnalystOpinions;
  const mCap = det?.marketCap || det?.market_data?.market_cap?.usd;
  const pe = det?.trailingPE || det?.forwardPE;
  const eps = det?.epsTrailingTwelveMonths;
  const w52H = det?.fiftyTwoWeekHigh || det?.market_data?.high_24h?.usd;
  const w52L = det?.fiftyTwoWeekLow || det?.market_data?.low_24h?.usd;
  const vol = det?.regularMarketVolume || det?.market_data?.total_volume?.usd;
  const desc = det?.description?.en || det?.longBusinessSummary;
  const rank = det?.market_cap_rank;
  const ath = det?.market_data?.ath?.usd;
  const athCh = det?.market_data?.ath_change_percentage?.usd;
  const rc = r => { if (!r) return T.t.m; const l = r.toLowerCase(); return l.includes("strong buy") || l.includes("strong_buy") ? T.g.m : l.includes("buy") ? "#34d399" : l.includes("hold") ? T.w.m : l.includes("sell") ? T.r.m : T.t.m; };

  const saveDate = () => {
    if (dateVal && onUpdate) { onUpdate(holding.tk, { entryDate: dateVal }); }
    setEditDate(false);
  };

  const saveDecision = (d) => {
    if (onUpdate) { onUpdate(holding.tk, { decision: d }); }
    setEditDecision(false);
  };

  // Chart gradient color
  const chartColor = chart.length > 1 && chart[chart.length - 1].price >= chart[0].price ? T.g.m : T.r.m;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
      zIndex: 1000, display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 540, maxWidth: "95vw", height: "100vh",
        background: T.bg.base, borderLeft: `1px solid ${T.b.m}`,
        overflow: "auto", padding: 28,
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 42, height: 42, borderRadius: T.rad.md,
                background: ic ? T.a.cyan + "15" : T.a.blue + "15",
                border: `1px solid ${ic ? T.a.cyan : T.a.blue}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: mono, fontSize: 14, fontWeight: 700,
                color: ic ? T.a.cyan : T.a.blue,
              }}>{holding.tk.slice(0, 2)}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: mono, color: T.t.p }}>{holding.tk}</div>
                <div style={{ fontSize: 13, color: T.t.m }}>{holding.nm}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: mono, color: T.t.p }}>{D(holding.cur)}</span>
              <span style={{ fontSize: 15, fontFamily: mono, color: pc(holding.ch), fontWeight: 600 }}>{pct(holding.ch)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn danger onClick={() => { onRemove(holding.tk); onClose(); }} aria-label={"Remove " + holding.tk}><Trash2 size={12} /> Remove</Btn>
            <button onClick={onClose} aria-label="Close detail panel" style={{
              padding: 8, borderRadius: T.rad.sm, border: `1px solid ${T.b.s}`,
              background: 'transparent', color: T.t.m, cursor: 'pointer',
            }}><X size={16} /></button>
          </div>
        </div>

        {/* Position card */}
        <Card style={{ marginBottom: 18, borderLeft: `3px solid ${pc(pnl)}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, fontWeight: 500 }}>Your Position</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              ["Qty", holding.qty < 10 ? holding.qty.toFixed(4) : holding.qty, T.t.p],
              ["Avg Cost", D(holding.avg), T.t.p],
              ["Value", D(val), T.t.p],
              ["Cost Basis", D(cost), T.t.s],
              ["P&L", (pnl >= 0 ? "+" : "") + D(pnl), pc(pnl)],
              ["P&L %", pct(pnlP), pc(pnlP)],
            ].map(([l, v, c], i) => (
              <div key={i}>
                <div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
                <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color: c, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Entry date + Decision editing */}
          <div style={{ display: 'flex', gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.b.s}` }}>
            {/* Entry Date */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={9} /> Entry Date
              </div>
              {editDate ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                    style={{
                      flex: 1, padding: '4px 8px', background: T.bg.deep,
                      border: `1px solid ${T.accent}`, borderRadius: T.rad.sm,
                      color: T.t.p, fontFamily: mono, fontSize: 11, outline: 'none',
                    }} />
                  <button onClick={saveDate} style={{
                    padding: '4px 8px', background: T.accent + '15', border: `1px solid ${T.accent}40`,
                    borderRadius: T.rad.sm, cursor: 'pointer', color: T.accent, fontFamily: mono, fontSize: 10,
                  }}>Save</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: holding.entryDate ? T.t.p : T.t.f }}>
                    {holding.entryDate || 'Not set'}
                  </span>
                  <button onClick={() => setEditDate(true)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontSize: 9, fontFamily: mono,
                  }}>edit</button>
                </div>
              )}
            </div>

            {/* Decision Type */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={9} /> Decision Type
              </div>
              {editDecision ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DECISION_OPTIONS.map(d => (
                    <button key={d} onClick={() => saveDecision(d)} style={{
                      padding: '3px 8px', borderRadius: T.rad.sm, cursor: 'pointer',
                      background: DECISION_COLORS[d] + '15',
                      border: `1px solid ${DECISION_COLORS[d]}40`,
                      color: DECISION_COLORS[d], fontFamily: mono, fontSize: 9, fontWeight: 600,
                    }}>{d}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge color={DECISION_COLORS[holding.decision || 'Thesis']}>{holding.decision || 'Thesis'}</Badge>
                  <button onClick={() => setEditDecision(true)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontSize: 9, fontFamily: mono,
                  }}>edit</button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 30-Day Chart (d3.js) */}
        <D3AreaChart data={chart} color={chartColor} loading={ld} />

        {ld ? (
          <div style={{ textAlign: "center", padding: 24, color: T.t.m, fontFamily: mono, fontSize: 10 }}>
            <div style={{ animation: 'pulse 1.5s ease infinite' }}>Loading details...</div>
          </div>
        ) : <>
          {/* Analyst Consensus */}
          {!ic && rec && (
            <Card style={{ marginBottom: 18, borderLeft: `3px solid ${rc(rec)}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, fontWeight: 500 }}>Analyst Consensus</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: rc(rec), textTransform: "uppercase" }}>{rec.replace(/_/g, " ")}</div>
                {aN && <span style={{ fontSize: 12, color: T.t.m }}>({aN} analysts)</span>}
              </div>
              {(tM || tH || tL) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {tL && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>Low</div><div style={{ fontFamily: mono, fontSize: 15, color: T.r.m, marginTop: 2 }}>{D(tL)}</div></div>}
                  {tM && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>Mean</div><div style={{ fontFamily: mono, fontSize: 15, color: T.a.blue, fontWeight: 700, marginTop: 2 }}>{D(tM)}</div></div>}
                  {tH && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>High</div><div style={{ fontFamily: mono, fontSize: 15, color: T.g.m, marginTop: 2 }}>{D(tH)}</div></div>}
                </div>
              )}
              {tM && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: T.rad.sm, background: T.bg.deep }}>
                  <span style={{ fontSize: 12, color: T.t.m }}>Upside: </span>
                  <span style={{ fontSize: 15, fontFamily: mono, fontWeight: 700, color: tM > holding.cur ? T.g.m : T.r.m }}>
                    {pct(((tM - holding.cur) / holding.cur) * 100)}
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* Key Stats */}
          <Card style={{ marginBottom: 18, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, fontWeight: 500 }}>Key Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                mCap && ["Market Cap", "$" + fmt(mCap)],
                vol && ["Volume", fmt(vol)],
                !ic && pe && ["P/E", pe.toFixed(2)],
                !ic && eps && ["EPS", "$" + eps.toFixed(2)],
                w52H && [ic ? "24h High" : "52W High", "$" + fmt(w52H)],
                w52L && [ic ? "24h Low" : "52W Low", "$" + fmt(w52L)],
                ic && rank && ["Rank", "#" + rank],
                ic && ath && ["ATH", "$" + fmt(ath)],
                ic && athCh && ["From ATH", pct(athCh)],
              ].filter(Boolean).map(([k, v], i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "6px 0",
                  borderBottom: `1px solid ${T.b.s}10`,
                }}>
                  <span style={{ fontSize: 12, color: T.t.m }}>{k}</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: T.t.p, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* About */}
          {desc && (
            <Card style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, fontWeight: 500 }}>About</div>
              <div style={{ fontSize: 12, color: T.t.s, lineHeight: 1.7, fontFamily: sans, maxHeight: 160, overflow: "auto" }}>
                {desc.slice(0, 500)}{desc.length > 500 ? "..." : ""}
              </div>
            </Card>
          )}
        </>}
      </div>
    </div>
  );
};

export default DetailPanel;
