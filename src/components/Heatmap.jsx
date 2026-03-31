// src/components/Heatmap.jsx — APEX Market Heatmap (Treemap)
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { T, mono, sans, fmt, pct } from "../theme/tokens";
import { Badge, TabBar } from "./ui/Shared";
import { fetchApexScreener, UNIVERSE_CATEGORIES } from "../api/finance";

/* ═══ COLOR FUNCTIONS ═══ */
const riskColor = (riskScore) => {
  if (riskScore >= 6) return '#ef4444'; // crimson — high risk
  if (riskScore >= 3) return '#f59e0b'; // amber — medium risk
  return '#10b981'; // emerald — clean
};

const changeColor = (pct) => {
  if (pct > 5) return '#059669';
  if (pct > 2) return '#10b981';
  if (pct > 0) return '#34d399';
  if (pct > -2) return '#f87171';
  if (pct > -5) return '#ef4444';
  return '#dc2626';
};

const changeBg = (pct) => {
  if (pct > 5) return 'rgba(5,150,105,0.7)';
  if (pct > 2) return 'rgba(16,185,129,0.5)';
  if (pct > 0) return 'rgba(52,211,153,0.25)';
  if (pct > -2) return 'rgba(248,113,113,0.25)';
  if (pct > -5) return 'rgba(239,68,68,0.5)';
  return 'rgba(220,38,38,0.7)';
};

/* ═══ TREEMAP LAYOUT (squarified) ═══ */
function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return [];
  const total = items.map(i => i.weight).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const rects = [];
  let remaining = [...items];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;
    const totalRemaining = remaining.map(i => i.weight).reduce((a, b) => a + b, 0);

    // Find best row
    let row = [remaining[0]];
    let rowSum = remaining[0].weight;
    let bestRatio = Infinity;

    for (let i = 1; i < remaining.length; i++) {
      const testRow = [...row, remaining[i]];
      const testSum = rowSum + remaining[i].weight;
      const rowLen = (testSum / totalRemaining) * (isWide ? cw : ch);

      let worstRatio = 0;
      for (const item of testRow) {
        const itemSide = (item.weight / testSum) * side;
        const r = Math.max(rowLen / itemSide, itemSide / rowLen);
        worstRatio = Math.max(worstRatio, r);
      }

      let prevWorst = 0;
      const prevLen = (rowSum / totalRemaining) * (isWide ? cw : ch);
      for (const item of row) {
        const itemSide = (item.weight / rowSum) * side;
        const r = Math.max(prevLen / itemSide, itemSide / prevLen);
        prevWorst = Math.max(prevWorst, r);
      }

      if (worstRatio <= prevWorst) {
        row = testRow;
        rowSum = testSum;
      } else {
        break;
      }
    }

    // Layout this row
    const rowLen = (rowSum / totalRemaining) * (isWide ? cw : ch);
    let offset = 0;
    for (const item of row) {
      const itemSide = (item.weight / rowSum) * side;
      if (isWide) {
        rects.push({ ...item, x: cx, y: cy + offset, w: rowLen, h: itemSide });
      } else {
        rects.push({ ...item, x: cx + offset, y: cy, w: itemSide, h: rowLen });
      }
      offset += itemSide;
    }

    // Remove placed items and shrink bounds
    remaining = remaining.slice(row.length);
    if (isWide) {
      cx += rowLen;
      cw -= rowLen;
    } else {
      cy += rowLen;
      ch -= rowLen;
    }
  }

  return rects;
}

/* ═══ HEATMAP MODES ═══ */
const MODES = ['Performance', 'Risk', 'Volume'];

const Heatmap = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [mode, setMode] = useState('Performance');
  const [category, setCategory] = useState('All');
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApexScreener((done, total) => setProgress({ done, total }));
      setStocks(data);
    } catch (e) {
      console.error("Heatmap load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const categories = ['All', ...Object.keys(UNIVERSE_CATEGORIES)];

  const filtered = useMemo(() => {
    let f = stocks;
    if (category !== 'All') {
      f = f.filter(s => s.category === category);
    }
    return f;
  }, [stocks, category]);

  const rects = useMemo(() => {
    if (!filtered.length) return [];

    const items = filtered.map(s => {
      let weight;
      if (mode === 'Volume') weight = s.volRatio != null ? Math.max(s.volRatio, 0.1) : 0.1;
      else if (mode === 'Risk') weight = Math.max(s.riskScore + 1, 1);
      else weight = Math.max(Math.abs(s.changePct || 0.1), 0.1);
      return { ...s, weight };
    });

    items.sort((a, b) => b.weight - a.weight);
    return squarify(items, 0, 0, dims.w, dims.h);
  }, [filtered, dims, mode]);

  const handleMouseMove = (e, stock) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, stock });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontFamily: mono, fontWeight: 700, color: T.t.p, margin: 0 }}>Market Heatmap</h2>
          <Badge color={T.accent}>{filtered.length}</Badge>
          {loading && <span style={{ fontSize: 10, fontFamily: mono, color: T.t.m }}>
            Loading {progress.done}/{progress.total}...
          </span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TabBar tabs={MODES} active={mode} set={setMode} />
          <button onClick={loadData} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 5, border: `1px solid ${T.b.s}`,
            background: 'transparent', color: T.t.s, cursor: 'pointer', fontFamily: mono, fontSize: 11,
          }} aria-label="Refresh heatmap">
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            padding: '3px 8px', borderRadius: 4, border: `1px solid ${cat === category ? T.accent : T.b.s}`,
            background: cat === category ? T.accentDim : 'transparent',
            color: cat === category ? T.accent : T.t.m,
            cursor: 'pointer', fontFamily: mono, fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap',
          }} aria-label={cat + ' filter'}>{cat}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 9, fontFamily: mono, color: T.t.m }}>
        {mode === 'Performance' && <>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#059669', marginRight: 3 }} />+5%</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#34d399', marginRight: 3 }} />+0-5%</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f87171', marginRight: 3 }} />-0-5%</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#dc2626', marginRight: 3 }} />-5%+</span>
        </>}
        {mode === 'Risk' && <>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 3 }} />Organic (0-2)</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 3 }} />Unusual (3-5)</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ef4444', marginRight: 3 }} />Suspect (6+)</span>
        </>}
        {mode === 'Volume' && <>
          <span>Size = Relative Volume (RVOL). Bigger = more unusual activity</span>
        </>}
      </div>

      {/* Treemap */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', borderRadius: 6, overflow: 'hidden', background: T.bg.deep, border: `1px solid ${T.b.s}`, minHeight: 300 }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {loading && rects.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <RefreshCw size={20} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 12, color: T.t.m }}>
              Scanning {progress.done}/{progress.total} tickers...
            </span>
            <div style={{ width: 200, height: 4, borderRadius: 2, background: T.bg.el }}>
              <div style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', borderRadius: 2, background: T.accent, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {!loading && rects.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.t.m }}>
              No data to display. Try adjusting filters or refreshing.
            </span>
          </div>
        )}

        {rects.map(r => {
          const isHov = hovered === r.ticker;
          let bg, borderCol;
          if (mode === 'Risk') {
            bg = riskColor(r.riskScore) + (isHov ? 'cc' : '88');
            borderCol = riskColor(r.riskScore);
          } else if (mode === 'Volume') {
            bg = changeBg(r.changePct);
            borderCol = r.volRatio > 2 ? '#f59e0b' : T.b.s;
          } else {
            bg = changeBg(r.changePct);
            borderCol = changeColor(r.changePct);
          }

          const showLabel = r.w > 40 && r.h > 30;
          const showPrice = r.w > 60 && r.h > 45;
          const showChange = r.w > 50 && r.h > 55;

          return (
            <div
              key={r.ticker}
              onMouseEnter={() => setHovered(r.ticker)}
              onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              onMouseMove={e => handleMouseMove(e, r)}
              style={{
                position: 'absolute',
                left: r.x, top: r.y, width: r.w, height: r.h,
                background: bg,
                border: `1px solid ${isHov ? '#fff' : borderCol + '44'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'border 0.15s, background 0.15s',
                overflow: 'hidden', padding: 2,
                zIndex: isHov ? 10 : 1,
              }}
            >
              {showLabel && (
                <span style={{ fontFamily: mono, fontSize: r.w > 80 ? 11 : 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)', lineHeight: 1 }}>
                  {r.ticker.replace('.TA', '')}
                </span>
              )}
              {showPrice && (
                <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.8)', lineHeight: 1, marginTop: 1 }}>
                  {r.currency === 'ILA' ? '₪' : '$'}{r.price < 10 ? r.price.toFixed(2) : r.price.toFixed(0)}
                </span>
              )}
              {showChange && (
                <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: '#fff', lineHeight: 1, marginTop: 1 }}>
                  {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                </span>
              )}
              {mode === 'Risk' && r.riskScore >= 3 && r.w > 40 && r.h > 40 && (
                <AlertTriangle size={10} color="#fff" style={{ marginTop: 2, opacity: 0.8 }} />
              )}
            </div>
          );
        })}

        {/* Tooltip */}
        {tooltip && tooltip.stock && (
          <div style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 12, dims.w - 220),
            top: Math.min(tooltip.y + 12, dims.h - 140),
            width: 210, padding: '8px 10px',
            background: T.bg.card + 'f0', backdropFilter: 'blur(8px)',
            border: `1px solid ${T.b.m}`, borderRadius: 6,
            pointerEvents: 'none', zIndex: 100,
          }}>
            <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: T.t.p }}>{tooltip.stock.ticker}</div>
            <div style={{ fontFamily: sans, fontSize: 10, color: T.t.s, marginBottom: 4 }}>{tooltip.stock.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 9 }}>
              <span style={{ color: T.t.m }}>Price</span>
              <span style={{ fontFamily: mono, color: T.t.p }}>{tooltip.stock.currency === 'ILA' ? '₪' : '$'}{fmt(tooltip.stock.price)}</span>
              <span style={{ color: T.t.m }}>Change</span>
              <span style={{ fontFamily: mono, color: tooltip.stock.changePct >= 0 ? T.g.m : T.r.m }}>{pct(tooltip.stock.changePct)}</span>
              <span style={{ color: T.t.m }}>APEX Score</span>
              <span style={{ fontFamily: mono, color: T.accent }}>{tooltip.stock.apexScore?.toFixed(1)}</span>
              <span style={{ color: T.t.m }}>Signal</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: tooltip.stock.analystRating?.includes('BUY') ? T.g.m : tooltip.stock.analystRating?.includes('SELL') ? T.r.m : T.w.m }}>{tooltip.stock.analystRating}</span>
              <span style={{ color: T.t.m }}>RSI</span>
              <span style={{ fontFamily: mono, color: T.t.p }}>{tooltip.stock.rsi?.toFixed(0) ?? '—'}</span>
              <span style={{ color: T.t.m }}>RVOL</span>
              <span style={{ fontFamily: mono, color: tooltip.stock.volRatio > 2 ? T.w.m : T.t.p }}>{tooltip.stock.volRatio?.toFixed(2) ?? '—'}x</span>
              <span style={{ color: T.t.m }}>Risk</span>
              <span style={{ fontFamily: mono, color: riskColor(tooltip.stock.riskScore || 0) }}>{tooltip.stock.riskScore || 0}/10</span>
              <span style={{ color: T.t.m }}>Category</span>
              <span style={{ fontFamily: sans, color: T.t.s, fontSize: 8 }}>{tooltip.stock.category}</span>
            </div>
            {tooltip.stock.riskFlags?.length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${T.b.s}` }}>
                {tooltip.stock.riskFlags.map((f, i) => (
                  <div key={i} style={{ fontSize: 8, color: f.severity === 'high' ? T.r.m : T.w.m, display: 'flex', gap: 3, alignItems: 'center', marginTop: 2 }}>
                    <AlertTriangle size={8} /> {f.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Heatmap;
