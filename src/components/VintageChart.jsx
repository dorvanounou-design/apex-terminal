// src/components/VintageChart.jsx — Inception-Relative Performance Chart
// Each holding line "spawns" on its entry date. Benchmarks overlay from first entry.
import { useState, useEffect, useMemo } from "react";
import { T, mono, display, pc, pct } from "../theme/tokens";
import { Card } from "./ui/Shared";

const BENCH = {
  '^GSPC': { label: 'S&P 500', color: '#3b82f6', dash: '4,3' },
  'BTC-USD': { label: 'Bitcoin', color: '#f59e0b', dash: '6,3' },
};

const DECISION_COLORS = {
  'Thesis': '#3b82f6',
  'Conviction': '#22c55e',
  'FOMO': '#ef4444',
  'Boredom': '#71717a',
};

// Fetch daily chart data from Yahoo v8
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
      date: new Date(t * 1000).toISOString().slice(0, 10),
      ts: t * 1000,
      price: closes[i],
    })).filter(d => d.price != null);
  } catch { return null; }
}

const VintageChart = ({ holdings }) => {
  const [chartData, setChartData] = useState({});
  const [benchData, setBenchData] = useState({});
  const [benchToggles, setBenchToggles] = useState({ '^GSPC': true, 'BTC-USD': false });
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  // Find earliest entry date across all holdings
  const firstEntry = useMemo(() => {
    const dates = holdings.filter(h => h.entryDate).map(h => new Date(h.entryDate).getTime());
    return dates.length > 0 ? Math.min(...dates) : Date.now() - 365 * 86400000;
  }, [holdings]);

  // Fetch all holding charts + benchmarks
  useEffect(() => {
    if (!holdings.length) return;
    setLoading(true);

    const fetchAll = async () => {
      const results = {};
      // Fetch each holding
      for (const h of holdings) {
        if (!h.entryDate) continue;
        const data = await fetchDailyChart(h.tk, '2y');
        if (data) {
          const entryTs = new Date(h.entryDate).getTime();
          // Filter to only data from entry date onward
          const filtered = data.filter(d => d.ts >= entryTs - 86400000);
          if (filtered.length > 1) {
            const basePrice = filtered[0].price;
            results[h.tk] = {
              data: filtered.map(d => ({
                ...d,
                pct: ((d.price - basePrice) / basePrice) * 100,
              })),
              entryDate: h.entryDate,
              entryPrice: h.avg || basePrice,
              decision: h.decision || 'Thesis',
              color: DECISION_COLORS[h.decision || 'Thesis'],
            };
          }
        }
      }
      setChartData(results);

      // Fetch benchmarks from first entry date
      const benchResults = {};
      for (const [sym, cfg] of Object.entries(BENCH)) {
        const data = await fetchDailyChart(sym, '2y');
        if (data) {
          const filtered = data.filter(d => d.ts >= firstEntry - 86400000);
          if (filtered.length > 1) {
            const basePrice = filtered[0].price;
            benchResults[sym] = {
              data: filtered.map(d => ({
                ...d,
                pct: ((d.price - basePrice) / basePrice) * 100,
              })),
              ...cfg,
            };
          }
        }
      }
      setBenchData(benchResults);
      setLoading(false);
    };

    fetchAll();
  }, [holdings, firstEntry]);

  // Build SVG
  const svgW = 700, svgH = 280, pad = { t: 20, r: 60, b: 30, l: 50 };
  const plotW = svgW - pad.l - pad.r;
  const plotH = svgH - pad.t - pad.b;

  // Collect all data points for axis scaling
  const allSeries = useMemo(() => {
    const series = [];
    // Holdings
    Object.entries(chartData).forEach(([tk, d]) => {
      series.push({ tk, points: d.data, color: d.color, decision: d.decision, dash: null });
    });
    // Benchmarks
    Object.entries(benchData).forEach(([sym, d]) => {
      if (benchToggles[sym]) {
        series.push({ tk: d.label, points: d.data, color: d.color, decision: null, dash: d.dash });
      }
    });
    return series;
  }, [chartData, benchData, benchToggles]);

  // Axis ranges
  const { minTs, maxTs, minPct, maxPct } = useMemo(() => {
    let mnT = Infinity, mxT = -Infinity, mnP = 0, mxP = 0;
    for (const s of allSeries) {
      for (const p of s.points) {
        if (p.ts < mnT) mnT = p.ts;
        if (p.ts > mxT) mxT = p.ts;
        if (p.pct < mnP) mnP = p.pct;
        if (p.pct > mxP) mxP = p.pct;
      }
    }
    // Add 5% padding
    const range = mxP - mnP || 10;
    return { minTs: mnT, maxTs: mxT, minPct: mnP - range * 0.05, maxPct: mxP + range * 0.05 };
  }, [allSeries]);

  const scaleX = ts => pad.l + ((ts - minTs) / (maxTs - minTs || 1)) * plotW;
  const scaleY = pctVal => pad.t + plotH - ((pctVal - minPct) / (maxPct - minPct || 1)) * plotH;

  // Zero line
  const zeroY = scaleY(0);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const range = maxPct - minPct;
    const step = range > 100 ? 25 : range > 50 ? 10 : range > 20 ? 5 : 2;
    const ticks = [];
    const start = Math.ceil(minPct / step) * step;
    for (let v = start; v <= maxPct; v += step) ticks.push(v);
    return ticks;
  }, [minPct, maxPct]);

  // X-axis ticks (monthly)
  const xTicks = useMemo(() => {
    const ticks = [];
    if (!isFinite(minTs) || !isFinite(maxTs)) return ticks;
    const d = new Date(minTs);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() <= maxTs) {
      ticks.push({ ts: d.getTime(), label: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }) });
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, [minTs, maxTs]);

  // Build polyline paths
  const paths = useMemo(() => {
    return allSeries.map(s => {
      const pts = s.points.map(p => `${scaleX(p.ts)},${scaleY(p.pct)}`).join(' ');
      return { ...s, pts };
    });
  }, [allSeries, minTs, maxTs, minPct, maxPct]);

  // Current values (latest point per series)
  const latestValues = useMemo(() => {
    return allSeries.map(s => {
      const last = s.points[s.points.length - 1];
      return { tk: s.tk, pct: last?.pct || 0, color: s.color, decision: s.decision };
    });
  }, [allSeries]);

  if (!holdings.some(h => h.entryDate)) {
    return (
      <Card style={{ borderLeft: `2px solid ${T.accent}` }}>
        <div style={{ fontFamily: display, fontSize: 18, color: T.t1, marginBottom: 6 }}>Vintage Growth</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: T.t3, padding: '20px 0' }}>
          Add entry dates to your positions to see inception-relative performance.
          <br />Click any position row → set Entry Date.
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: '10px 12px', borderLeft: `2px solid ${T.accent}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 600, color: T.t1, letterSpacing: 0.5 }}>
            Vintage Growth
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Inception-relative • each line spawns at entry
          </div>
        </div>
        {/* Benchmark toggles */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(BENCH).map(([sym, cfg]) => (
            <button key={sym} onClick={() => setBenchToggles(p => ({ ...p, [sym]: !p[sym] }))}
              style={{
                padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${benchToggles[sym] ? cfg.color : T.b1}`,
                background: benchToggles[sym] ? cfg.color + '15' : 'transparent',
                color: benchToggles[sym] ? cfg.color : T.t3,
                fontFamily: mono, fontSize: 8, fontWeight: 600,
              }}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.t3, fontFamily: mono, fontSize: 10 }}>
          Loading vintage data...
        </div>
      ) : allSeries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.t3, fontFamily: mono, fontSize: 10 }}>
          No chart data available for these holdings
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
          {/* Grid lines */}
          {yTicks.map(v => (
            <line key={v} x1={pad.l} y1={scaleY(v)} x2={svgW - pad.r} y2={scaleY(v)}
              stroke={T.b1} strokeWidth={0.5} opacity={0.3} />
          ))}

          {/* Zero line */}
          <line x1={pad.l} y1={zeroY} x2={svgW - pad.r} y2={zeroY}
            stroke={T.t4} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />

          {/* Y labels */}
          {yTicks.map(v => (
            <text key={v} x={pad.l - 6} y={scaleY(v) + 3} textAnchor="end"
              fill={T.t3} fontSize={8} fontFamily="JetBrains Mono">
              {v > 0 ? '+' : ''}{v.toFixed(0)}%
            </text>
          ))}

          {/* X labels */}
          {xTicks.map(t => (
            <text key={t.ts} x={scaleX(t.ts)} y={svgH - 6} textAnchor="middle"
              fill={T.t4} fontSize={7} fontFamily="JetBrains Mono">
              {t.label}
            </text>
          ))}

          {/* Series lines */}
          {paths.map((s, i) => (
            <g key={s.tk}>
              <polyline
                points={s.pts}
                fill="none"
                stroke={s.color}
                strokeWidth={hovered === s.tk ? 2.5 : 1.5}
                strokeDasharray={s.dash || 'none'}
                opacity={hovered && hovered !== s.tk ? 0.25 : 1}
                style={{ transition: 'opacity 0.15s' }}
              />
              {/* Spawn dot — first point of each holding */}
              {!s.dash && s.points.length > 0 && (
                <circle
                  cx={scaleX(s.points[0].ts)}
                  cy={scaleY(s.points[0].pct)}
                  r={3}
                  fill={s.color}
                  stroke={T.bgDeep}
                  strokeWidth={1.5}
                />
              )}
            </g>
          ))}

          {/* End labels — right side */}
          {latestValues.map((v, i) => {
            const y = scaleY(v.pct);
            return (
              <g key={v.tk}
                onMouseEnter={() => setHovered(v.tk)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                <rect x={svgW - pad.r + 4} y={y - 6} width={52} height={12} rx={1}
                  fill={v.color + '15'} stroke={v.color + '40'} strokeWidth={0.5} />
                <text x={svgW - pad.r + 8} y={y + 3}
                  fill={v.color} fontSize={7} fontFamily="JetBrains Mono" fontWeight={600}>
                  {v.tk.length > 5 ? v.tk.slice(0, 5) : v.tk} {v.pct >= 0 ? '+' : ''}{v.pct.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Legend — decision type color coding */}
      {Object.keys(chartData).length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          {Object.entries(DECISION_COLORS).map(([type, color]) => {
            const count = holdings.filter(h => (h.decision || 'Thesis') === type && h.entryDate).length;
            if (count === 0) return null;
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
                <span style={{ fontFamily: mono, fontSize: 7, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {type} ({count})
                </span>
              </div>
            );
          })}
          {Object.entries(BENCH).filter(([sym]) => benchToggles[sym]).map(([sym, cfg]) => (
            <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={12} height={2}><line x1={0} y1={1} x2={12} y2={1} stroke={cfg.color} strokeWidth={2} strokeDasharray={cfg.dash} /></svg>
              <span style={{ fontFamily: mono, fontSize: 7, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default VintageChart;
