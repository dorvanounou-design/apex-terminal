// src/components/VintageChart.jsx — Obsidian-style Inception Performance (d3.js)
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { T, mono, display, pc, pct } from "../theme/tokens";

const BENCH = {
  '^GSPC': { label: 'S&P 500', color: '#4ade80', dash: '6,4' },
  'BTC-USD': { label: 'Bitcoin', color: '#f59e0b', dash: '8,4' },
};

// Obsidian palette — cyan/teal dominant with harmonized accents
const SERIES_COLORS = [
  '#06d6a0', // mint/teal
  '#00d4ff', // cyan
  '#818cf8', // indigo
  '#fb7185', // rose
  '#fbbf24', // amber
  '#34d399', // emerald
  '#a78bfa', // violet
  '#f472b6', // pink
  '#2dd4bf', // teal
];

const DECISION_COLORS = {
  'Thesis':     '#06d6a0',
  'Conviction': '#00d4ff',
  'FOMO':       '#fb7185',
  'Boredom':    '#71717a',
};

async function fetchDailyChart(ticker, range = '1y') {
  try {
    const r = await fetch(`/yf/v8/finance/chart/${ticker}?range=${range}&interval=1d`);
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) return null;
    const ts = res.timestamp || [];
    const closes = res.indicators?.quote?.[0]?.close || [];
    return ts.map((t, i) => ({
      date: new Date(t * 1000),
      ts: t * 1000,
      price: closes[i],
    })).filter(d => d.price != null);
  } catch { return null; }
}

const RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: 'ALL', months: 0 },
];

const VintageChart = ({ holdings }) => {
  const [chartData, setChartData] = useState({});
  const [benchData, setBenchData] = useState({});
  const [benchToggles, setBenchToggles] = useState({ '^GSPC': true, 'BTC-USD': false });
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [crosshair, setCrosshair] = useState(null);
  const [rangeIdx, setRangeIdx] = useState(3); // default 1Y
  const svgRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);

  const firstEntry = useMemo(() => {
    const dates = holdings.filter(h => h.entryDate).map(h => new Date(h.entryDate).getTime());
    return dates.length > 0 ? Math.min(...dates) : Date.now() - 365 * 86400000;
  }, [holdings]);

  useEffect(() => {
    if (!holdings.length) return;
    setLoading(true);
    const fetchAll = async () => {
      const results = {};
      let colorIdx = 0;
      for (const h of holdings) {
        if (!h.entryDate) continue;
        const data = await fetchDailyChart(h.tk, '2y');
        if (data) {
          const entryTs = new Date(h.entryDate).getTime();
          const filtered = data.filter(d => d.ts >= entryTs - 86400000);
          if (filtered.length > 1) {
            const basePrice = filtered[0].price;
            const decColor = DECISION_COLORS[h.decision || 'Thesis'];
            results[h.tk] = {
              data: filtered.map(d => ({ ...d, pct: ((d.price - basePrice) / basePrice) * 100 })),
              entryDate: h.entryDate, entryPrice: h.avg || basePrice,
              decision: h.decision || 'Thesis',
              color: decColor || SERIES_COLORS[colorIdx % SERIES_COLORS.length],
            };
            colorIdx++;
          }
        }
      }
      setChartData(results);
      const benchResults = {};
      for (const [sym, cfg] of Object.entries(BENCH)) {
        const data = await fetchDailyChart(sym, '2y');
        if (data) {
          const filtered = data.filter(d => d.ts >= firstEntry - 86400000);
          if (filtered.length > 1) {
            const basePrice = filtered[0].price;
            benchResults[sym] = { data: filtered.map(d => ({ ...d, pct: ((d.price - basePrice) / basePrice) * 100 })), ...cfg };
          }
        }
      }
      setBenchData(benchResults);
      setLoading(false);
    };
    fetchAll();
  }, [holdings, firstEntry]);

  // Dimensions — compact
  const W = 820, H = 260;
  const margin = { t: 12, r: 74, b: 24, l: 44 };
  const plotW = W - margin.l - margin.r;
  const plotH = H - margin.t - margin.b;

  // Filter by range
  const rangeFilter = useMemo(() => {
    const r = RANGES[rangeIdx];
    if (r.months === 0) return 0; // ALL
    const cutoff = Date.now() - r.months * 30 * 86400000;
    return cutoff;
  }, [rangeIdx]);

  const allSeries = useMemo(() => {
    const series = [];
    Object.entries(chartData).forEach(([tk, d]) => {
      const pts = rangeFilter ? d.data.filter(p => p.ts >= rangeFilter) : d.data;
      if (pts.length > 1) series.push({ tk, points: pts, color: d.color, decision: d.decision, dash: null, isBench: false });
    });
    Object.entries(benchData).forEach(([sym, d]) => {
      if (benchToggles[sym]) {
        const pts = rangeFilter ? d.data.filter(p => p.ts >= rangeFilter) : d.data;
        if (pts.length > 1) series.push({ tk: d.label, points: pts, color: d.color, decision: null, dash: d.dash, isBench: true });
      }
    });
    return series;
  }, [chartData, benchData, benchToggles, rangeFilter]);

  // d3 scales
  const { xScale, yScale } = useMemo(() => {
    let mnT = Infinity, mxT = -Infinity, mnP = 0, mxP = 0;
    for (const s of allSeries) {
      for (const p of s.points) {
        if (p.ts < mnT) mnT = p.ts;
        if (p.ts > mxT) mxT = p.ts;
        if (p.pct < mnP) mnP = p.pct;
        if (p.pct > mxP) mxP = p.pct;
      }
    }
    const range = mxP - mnP || 10;
    mnP -= range * 0.06;
    mxP += range * 0.06;

    const xScale = d3.scaleTime()
      .domain([new Date(isFinite(mnT) ? mnT : Date.now() - 86400000 * 365), new Date(isFinite(mxT) ? mxT : Date.now())])
      .range([0, plotW]);

    const yScale = d3.scaleLinear()
      .domain([mnP, mxP])
      .range([plotH, 0])
      .nice();

    return { xScale, yScale };
  }, [allSeries, plotW, plotH]);

  // Render d3 axes — ultra minimal Obsidian style
  useEffect(() => {
    if (!xAxisRef.current || !yAxisRef.current || allSeries.length === 0) return;

    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat("%b '%y"))
      .tickSize(0)
      .tickPadding(10);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => (d > 0 ? '+' : '') + d.toFixed(0) + '%')
      .tickSize(0)
      .tickPadding(8);

    const xG = d3.select(xAxisRef.current);
    xG.selectAll("*").remove();
    xG.call(xAxis);
    xG.selectAll("text").attr("fill", T.t.m).attr("font-size", 9).attr("font-family", mono);
    xG.select(".domain").remove();

    const yG = d3.select(yAxisRef.current);
    yG.selectAll("*").remove();
    yG.call(yAxis);
    yG.selectAll("text").attr("fill", T.t.m).attr("font-size", 9).attr("font-family", mono);
    yG.select(".domain").remove();
  }, [xScale, yScale, allSeries, plotW, plotH]);

  // d3 line + area generators with smooth curve
  const lineGen = useMemo(() =>
    d3.line()
      .x(d => xScale(new Date(d.ts)))
      .y(d => yScale(d.pct))
      .curve(d3.curveMonotoneX),
    [xScale, yScale]
  );

  const areaGen = useMemo(() =>
    d3.area()
      .x(d => xScale(new Date(d.ts)))
      .y0(plotH)
      .y1(d => yScale(d.pct))
      .curve(d3.curveMonotoneX),
    [xScale, yScale, plotH]
  );

  const paths = useMemo(() => {
    return allSeries.map(s => ({
      ...s,
      linePath: lineGen(s.points),
      areaPath: !s.isBench ? areaGen(s.points) : null,
    }));
  }, [allSeries, lineGen, areaGen]);

  const latestValues = useMemo(() => {
    return allSeries.map(s => {
      const last = s.points[s.points.length - 1];
      return { tk: s.tk, pct: last?.pct || 0, color: s.color, decision: s.decision, isBench: s.isBench };
    }).sort((a, b) => b.pct - a.pct);
  }, [allSeries]);

  // Crosshair
  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W - margin.l;
    if (mouseX < 0 || mouseX > plotW) { setCrosshair(null); return; }

    const dateAtX = xScale.invert(mouseX);
    const tsAtX = dateAtX.getTime();
    const values = [];

    for (const s of allSeries) {
      const bisect = d3.bisector(d => d.ts).left;
      const idx = bisect(s.points, tsAtX);
      const d0 = s.points[idx - 1];
      const d1 = s.points[idx];
      if (!d0 && !d1) continue;
      const closest = !d0 ? d1 : !d1 ? d0 : (tsAtX - d0.ts > d1.ts - tsAtX ? d1 : d0);
      values.push({
        tk: s.tk, pct: closest.pct, color: s.color,
        date: d3.timeFormat("%b %d, %Y")(new Date(closest.ts)),
        isBench: s.isBench,
      });
    }
    setCrosshair({ x: mouseX, values });
  }, [allSeries, xScale, plotW]);

  // Y grid lines (very subtle)
  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  if (!holdings.some(h => h.entryDate)) {
    return (
      <div style={{
        background: T.bg.surface, borderRadius: T.rad.lg, padding: '28px 24px',
        border: `1px solid ${T.b.s}`,
      }}>
        <div style={{ fontFamily: mono, fontSize: 14, color: T.t.p, fontWeight: 600, marginBottom: 6 }}>Vintage Growth</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, padding: '20px 0' }}>
          Add entry dates to your positions to see inception-relative performance.
        </div>
      </div>
    );
  }

  const pill = (active) => ({
    padding: '5px 12px', borderRadius: T.rad.xl, cursor: 'pointer',
    border: 'none',
    background: active ? T.accent + '20' : 'transparent',
    color: active ? T.accent : T.t.m,
    fontFamily: mono, fontSize: 10, fontWeight: 600,
    transition: 'all 0.15s ease',
    letterSpacing: 0.3,
  });

  return (
    <div style={{
      background: T.bg.surface,
      borderRadius: T.rad.md,
      padding: '14px 16px 12px',
      border: `1px solid ${T.b.s}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 6, height: 24, borderRadius: 3,
            background: `linear-gradient(180deg, ${T.accent}, ${T.accent2})`,
          }} />
          <div>
            <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: T.t.p, letterSpacing: 0.3 }}>
              VINTAGE GROWTH
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 1 }}>
              Inception-relative performance
            </div>
          </div>
        </div>

        {/* Range pills */}
        <div style={{
          display: 'flex', gap: 2, background: '#111116', borderRadius: 22,
          padding: 3, border: '1px solid #1a1a2e',
        }}>
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} style={pill(rangeIdx === i)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Benchmark toggles + indicators */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(BENCH).map(([sym, cfg]) => (
          <button key={sym} onClick={() => setBenchToggles(p => ({ ...p, [sym]: !p[sym] }))}
            style={{
              padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
              border: `1px solid ${benchToggles[sym] ? cfg.color + '40' : '#1a1a2e'}`,
              background: benchToggles[sym] ? cfg.color + '10' : '#111116',
              color: benchToggles[sym] ? cfg.color : '#52525b',
              fontFamily: mono, fontSize: 9, fontWeight: 600,
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <svg width={8} height={8}><circle cx={4} cy={4} r={3} fill={benchToggles[sym] ? cfg.color : '#3f3f46'} /></svg>
            {cfg.label}
          </button>
        ))}
        {/* Legend items inline */}
        {Object.entries(DECISION_COLORS).map(([type, color]) => {
          const count = holdings.filter(h => (h.decision || 'Thesis') === type && h.entryDate).length;
          if (count === 0) return null;
          return (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 16,
              background: '#111116', border: '1px solid #1a1a2e',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}40` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: '#71717a', fontWeight: 500 }}>
                {type} ({count})
              </span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#52525b', fontFamily: mono, fontSize: 11,
          background: '#0a0a0d', borderRadius: 12, border: '1px solid #1a1a2e',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid #1a1a2e', borderTopColor: '#06d6a0',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          Loading vintage data...
        </div>
      ) : allSeries.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#52525b', fontFamily: mono, fontSize: 11,
          background: '#0a0a0d', borderRadius: 12, border: '1px solid #1a1a2e',
        }}>
          No chart data available
        </div>
      ) : (
        <div style={{
          background: '#0a0a0d', borderRadius: 12, padding: '8px 4px 0',
          border: '1px solid #1a1a2e',
        }}>
          <svg
            ref={svgRef}
            width="100%" viewBox={`0 0 ${W} ${H}`}
            style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCrosshair(null)}
          >
            <defs>
              {/* Gradient fills per series — deeper, more vivid */}
              {paths.filter(p => !p.isBench).map((s, i) => (
                <linearGradient key={`grad-${s.tk}`} id={`vg-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                  <stop offset="50%" stopColor={s.color} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
              {/* Line glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowSoft">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(${margin.l},${margin.t})`}>
              {/* Subtle horizontal grid lines */}
              {yTicks.map(v => (
                <line key={v} x1={0} y1={yScale(v)} x2={plotW} y2={yScale(v)}
                  stroke="#1a1a2e" strokeWidth={0.5} />
              ))}

              {/* Zero line — slightly brighter */}
              <line x1={0} y1={yScale(0)} x2={plotW} y2={yScale(0)}
                stroke="#2a2a3e" strokeWidth={1} />

              {/* Axes */}
              <g ref={xAxisRef} transform={`translate(0,${plotH})`} />
              <g ref={yAxisRef} />

              {/* Area fills — glowing gradient under curves */}
              {paths.filter(p => !p.isBench && p.areaPath).map((s, i) => (
                <path key={`area-${s.tk}`} d={s.areaPath} fill={`url(#vg-area-${i})`}
                  opacity={hovered && hovered !== s.tk ? 0.05 : 0.8}
                  style={{ transition: 'opacity 0.3s ease' }} />
              ))}

              {/* Series lines — smooth curves */}
              {paths.map(s => (
                <g key={s.tk}>
                  {/* Subtle glow */}
                  {!s.isBench && (
                    <path d={s.linePath} fill="none" stroke={s.color} strokeWidth={2.5}
                      opacity={hovered && hovered !== s.tk ? 0 : 0.1}
                      strokeLinejoin="round" strokeLinecap="round" filter="url(#glowSoft)"
                      style={{ transition: 'opacity 0.3s' }} />
                  )}
                  {/* Main line */}
                  <path d={s.linePath} fill="none" stroke={s.color}
                    strokeWidth={s.isBench ? 1 : 1.4}
                    strokeDasharray={s.dash || 'none'}
                    opacity={hovered && hovered !== s.tk ? 0.1 : 1}
                    strokeLinejoin="round" strokeLinecap="round"
                    style={{ transition: 'opacity 0.3s ease' }} />
                  {/* Spawn dot */}
                  {!s.isBench && s.points.length > 0 && (() => {
                    const cx = xScale(new Date(s.points[0].ts));
                    const cy = yScale(s.points[0].pct);
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={s.color} opacity={0.15} />
                        <circle cx={cx} cy={cy} r={1.8} fill={s.color} stroke="#0c0c0f" strokeWidth={1} />
                      </g>
                    );
                  })()}
                  {/* End dot */}
                  {s.points.length > 1 && (() => {
                    const last = s.points[s.points.length - 1];
                    const cx = xScale(new Date(last.ts));
                    const cy = yScale(last.pct);
                    return <circle cx={cx} cy={cy} r={2} fill={s.color} stroke="#0c0c0f" strokeWidth={1} />;
                  })()}
                </g>
              ))}

              {/* Crosshair */}
              {crosshair && (
                <g>
                  <line x1={crosshair.x} y1={0} x2={crosshair.x} y2={plotH}
                    stroke="#06d6a0" strokeWidth={0.5} opacity={0.3} />
                  {crosshair.values.map(v => {
                    const cy = yScale(v.pct);
                    return <circle key={v.tk} cx={crosshair.x} cy={cy} r={2.5} fill={v.color} stroke="#0c0c0f" strokeWidth={1} />;
                  })}
                </g>
              )}
            </g>

            {/* End labels — right side, anti-overlap */}
            {(() => {
              const labelH = 14;
              const placed = [];
              return latestValues.map((v, i) => {
                let rawY = margin.t + yScale(v.pct);
                // Push labels apart so they don't overlap
                for (const py of placed) {
                  if (Math.abs(rawY - py) < labelH) rawY = py + labelH;
                }
                const y = Math.max(margin.t + 6, Math.min(margin.t + plotH - 6, rawY));
                placed.push(y);
                return (
                  <g key={v.tk}
                    onMouseEnter={() => setHovered(v.tk)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}>
                    <rect x={W - margin.r + 6} y={y - 6} width={64} height={13} rx={6}
                      fill={hovered === v.tk ? v.color + '18' : '#111116'}
                      stroke={v.color + '25'} strokeWidth={0.5} />
                    <text x={W - margin.r + 10} y={y + 3}
                      fill={v.color} fontSize={7} fontFamily={mono} fontWeight={600}>
                      {v.tk.length > 4 ? v.tk.slice(0, 4) : v.tk}
                    </text>
                    <text x={W - margin.r + 66} y={y + 3}
                      fill={v.pct >= 0 ? '#06d6a0' : '#fb7185'} fontSize={7} fontFamily={mono} fontWeight={600}
                      textAnchor="end">
                      {v.pct >= 0 ? '+' : ''}{v.pct.toFixed(0)}%
                    </text>
                  </g>
                );
              });
            })()}
          </svg>
        </div>
      )}

      {/* Crosshair tooltip — floating glass card */}
      {crosshair && crosshair.values.length > 0 && (
        <div style={{
          display: 'flex', gap: 14, padding: '8px 14px', marginTop: 8,
          background: '#111116', borderRadius: 12, border: '1px solid #1a1a2e',
          flexWrap: 'wrap', alignItems: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: '#52525b', fontWeight: 500 }}>
            {crosshair.values[0]?.date}
          </span>
          {crosshair.values.map(v => (
            <span key={v.tk} style={{
              fontFamily: mono, fontSize: 10, fontWeight: 700,
              color: v.color,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
              {v.tk} {v.pct >= 0 ? '+' : ''}{v.pct.toFixed(1)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default VintageChart;
