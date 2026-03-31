// src/components/Recommendations.jsx — APEX Live Technical Screener v2
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, RefreshCw, ChevronDown, ChevronUp, TrendingUp, Plus, X, Activity, Target, BarChart3, Zap, AlertTriangle, Star, Flame } from "lucide-react";
import { T, mono, sans, pc, fmt, D, pct } from "../theme/tokens";
import { Card, Badge, TabBar, Morph } from "./ui/Shared";
import { fetchApexScreener, fetchSingleAnalysis, UNIVERSE_CATEGORIES } from "../api/finance";

/* ═══ HELPERS ═══ */
const ratingColor = r => {
  if (r === 'STRONG BUY') return T.g.m;
  if (r === 'BUY') return '#34d399';
  if (r === 'HOLD') return T.w.m;
  if (r === 'SELL') return '#f87171';
  if (r === 'STRONG SELL') return T.r.m;
  return T.t.m;
};

const scoreColor = s => {
  if (s >= 6) return T.g.m;
  if (s >= 3) return '#34d399';
  if (s >= 0) return T.w.m;
  if (s >= -2) return T.t.m;
  return T.r.m;
};

const rsiColor = v => {
  if (v == null) return T.t.m;
  if (v < 30) return T.g.m;
  if (v < 45) return '#34d399';
  if (v > 70) return T.r.m;
  if (v > 60) return '#f87171';
  return T.t.s;
};

const rsiZone = v => {
  if (v == null) return '';
  if (v < 30) return 'OVERSOLD';
  if (v < 40) return 'LOW';
  if (v > 70) return 'OVERBOUGHT';
  if (v > 60) return 'HIGH';
  return '';
};

const trendLabel = (price, sma20, sma50) => {
  if (sma20 == null || sma50 == null) return { text: '—', color: T.t.m };
  if (price > sma20 && sma20 > sma50) return { text: '▲ UP', color: T.g.m };
  if (price > sma50 && price < sma20) return { text: '↻ PULL', color: '#ca8a04' };
  if (price < sma20 && sma20 < sma50) return { text: '▼ DOWN', color: T.r.m };
  if (price < sma20 && sma20 > sma50) return { text: '⚠ WEAK', color: '#f87171' };
  return { text: '— FLAT', color: T.t.m };
};

const vcpBadge = (vcp) => {
  if (!vcp) return null;
  if (vcp.vcpScore >= 80) return { label: vcp.pattern, color: T.g.m };
  if (vcp.vcpScore >= 60) return { label: vcp.pattern, color: '#ca8a04' };
  return null;
};

/* ═══ GENERATE FULL ANALYSIS ═══ */
const generateFullAnalysis = (s) => {
  const reasons = [];

  // 1. RSI Analysis
  if (s.rsi != null) {
    if (s.rsi < 30) {
      reasons.push({ type: 'bull', icon: '📉', title: 'RSI Oversold', detail: `RSI at ${s.rsi.toFixed(1)} — deeply oversold territory (<30). Historically, this signals a high probability of a mean-reversion bounce. Sellers are exhausted and buying pressure typically follows.` });
    } else if (s.rsi < 40) {
      reasons.push({ type: 'bull', icon: '📊', title: 'RSI Approaching Oversold', detail: `RSI at ${s.rsi.toFixed(1)} — nearing oversold levels. The stock is under accumulation pressure. A dip below 30 would confirm a strong buy signal.` });
    } else if (s.rsi > 70) {
      reasons.push({ type: 'bear', icon: '⚠️', title: 'RSI Overbought', detail: `RSI at ${s.rsi.toFixed(1)} — overbought zone (>70). The stock has rallied hard and is due for a pullback or consolidation. New entries carry elevated risk.` });
    } else if (s.rsi > 60) {
      reasons.push({ type: 'neutral', icon: '📈', title: 'RSI Elevated', detail: `RSI at ${s.rsi.toFixed(1)} — above midline but not yet overbought. Momentum is positive. Watch for a push above 70 as a potential distribution signal.` });
    } else {
      reasons.push({ type: 'neutral', icon: '⚖️', title: 'RSI Neutral', detail: `RSI at ${s.rsi.toFixed(1)} — neutral zone (40-60). Neither oversold nor overbought. Price is in equilibrium.` });
    }
  }

  // 2. Moving Average Trend
  if (s.sma20 != null && s.sma50 != null) {
    const aboveSma20 = s.price > s.sma20;
    const aboveSma50 = s.price > s.sma50;
    const sma20AboveSma50 = s.sma20 > s.sma50;

    if (aboveSma20 && sma20AboveSma50) {
      reasons.push({ type: 'bull', icon: '🔺', title: 'Strong Uptrend', detail: `Price ($${s.price.toFixed(2)}) > SMA20 ($${s.sma20.toFixed(2)}) > SMA50 ($${s.sma50.toFixed(2)}). Textbook uptrend structure. Trend-following longs are supported.` });
    } else if (aboveSma50 && !aboveSma20) {
      reasons.push({ type: 'neutral', icon: '↻', title: 'Pullback in Uptrend', detail: `Price dipped below SMA20 ($${s.sma20.toFixed(2)}) but holds above SMA50 ($${s.sma50.toFixed(2)}). Normal pullback — often a buying opportunity if SMA50 holds.` });
    } else if (!aboveSma20 && !sma20AboveSma50) {
      reasons.push({ type: 'bear', icon: '🔻', title: 'Downtrend', detail: `Price < SMA20 < SMA50. Full bearish alignment. Avoid new longs until price reclaims the 20-day MA.` });
    } else if (!aboveSma20 && sma20AboveSma50) {
      reasons.push({ type: 'bear', icon: '⚠️', title: 'Weakening Trend', detail: `Price fell below SMA20 while SMA20 is still above SMA50. Early warning of trend deterioration.` });
    }
  }

  // 3. 52-Week Position
  if (s.w52Position != null) {
    if (s.w52Position < 20) {
      reasons.push({ type: 'bull', icon: '💎', title: 'Deep Value Zone', detail: `Bottom 20% of 52-week range (${s.w52Position.toFixed(0)}%). ${Math.abs(s.distFromHigh).toFixed(1)}% below 52W high. Deep-value entry for quality names.` });
    } else if (s.w52Position < 35) {
      reasons.push({ type: 'bull', icon: '🏷️', title: 'Value Territory', detail: `Lower third of 52-week range (${s.w52Position.toFixed(0)}%). Discounted ${Math.abs(s.distFromHigh).toFixed(1)}% from highs.` });
    } else if (s.w52Position > 90) {
      reasons.push({ type: 'bear', icon: '🔝', title: 'Near 52-Week High', detail: `At ${s.w52Position.toFixed(0)}% of range — near the top. Risk/reward unfavorable for new entries.` });
    }
  }

  // 4. Momentum
  if (s.mom30d != null) {
    if (s.mom30d > 15) {
      reasons.push({ type: 'bull', icon: '🚀', title: 'Strong 30d Momentum', detail: `Up ${s.mom30d.toFixed(1)}% over 30 days. Exceptional momentum — institutions accumulating.` });
    } else if (s.mom30d > 5) {
      reasons.push({ type: 'bull', icon: '📈', title: 'Positive 30d Momentum', detail: `Up ${s.mom30d.toFixed(1)}% over 30 days. Healthy, sustainable upside.` });
    } else if (s.mom30d < -15) {
      reasons.push({ type: 'bear', icon: '💥', title: 'Sharp 30d Decline', detail: `Down ${Math.abs(s.mom30d).toFixed(1)}% over 30 days. Significant selling pressure. Wait for stabilization.` });
    } else if (s.mom30d < -5) {
      reasons.push({ type: 'bear', icon: '📉', title: 'Negative 30d Momentum', detail: `Down ${Math.abs(s.mom30d).toFixed(1)}% over 30 days. Sellers in control.` });
    }
  }

  // 5. Momentum divergence
  if (s.mom30d != null && s.mom90d != null) {
    if (s.mom30d > 0 && s.mom90d < -10) {
      reasons.push({ type: 'bull', icon: '🔄', title: 'Momentum Reversal', detail: `30d: +${s.mom30d.toFixed(1)}% vs 90d: ${s.mom90d.toFixed(1)}%. Recovering from decline — early trend reversal signal.` });
    } else if (s.mom30d < 0 && s.mom90d > 10) {
      reasons.push({ type: 'bear', icon: '🔄', title: 'Momentum Fading', detail: `30d: ${s.mom30d.toFixed(1)}% despite 90d: +${s.mom90d.toFixed(1)}%. Longer-term move losing steam.` });
    }
  }

  // 6. Volume
  if (s.volRatio != null) {
    if (s.volRatio > 2.0) {
      reasons.push({ type: 'neutral', icon: '📢', title: 'High Volume', detail: `Volume ${s.volRatio.toFixed(1)}x 20-day avg. Institutional activity — confirms conviction.` });
    } else if (s.volRatio < 0.4) {
      reasons.push({ type: 'neutral', icon: '🔇', title: 'Low Volume', detail: `Volume only ${s.volRatio.toFixed(1)}x avg. Moves on low volume lack conviction.` });
    }
  }

  // 7. MACD
  if (s.macd != null) {
    if (s.macd > 0 && s.mom30d > 0) {
      reasons.push({ type: 'bull', icon: '✅', title: 'MACD Bullish', detail: `MACD at ${s.macd.toFixed(2)} — above zero confirming bullish momentum.` });
    } else if (s.macd < 0 && s.mom30d < 0) {
      reasons.push({ type: 'bear', icon: '❌', title: 'MACD Bearish', detail: `MACD at ${s.macd.toFixed(2)} — below zero confirming bearish pressure.` });
    }
  }

  // 8. VCP (Minervini Volatility Contraction Pattern)
  if (s.vcp && s.vcp.vcpScore >= 50) {
    const v = s.vcp;
    if (v.vcpScore >= 80) {
      reasons.push({ type: 'bull', icon: '🎯', title: `VCP: ${v.pattern}`, detail: `Minervini VCP score ${v.vcpScore}/100. ${v.contractions} contractions detected, ${v.narrowing} narrowing. Trend template ${v.ttPassed}/${v.ttTotal} passed. Volume dry-up: ${v.volDryUp}x avg. State: ${v.state}. ${v.pivotDist.toFixed(1)}% from pivot.` });
    } else if (v.vcpScore >= 60) {
      reasons.push({ type: 'neutral', icon: '🔍', title: `VCP Developing (${v.vcpScore})`, detail: `Potential VCP forming. ${v.contractions} contractions, ${v.narrowing} narrowing. Trend template ${v.ttPassed}/${v.ttTotal}. Needs more tightening or better volume dry-up before breakout.` });
    }
  }

  // 9. Relative Strength
  if (s.rsRating != null) {
    if (s.rsRating >= 90) {
      reasons.push({ type: 'bull', icon: '💪', title: `RS Rating ${s.rsRating}`, detail: `Outperforming S&P 500 by ${s.rs30d?.toFixed(1)}% over 30 days. Top-tier relative strength — institutional favorites.` });
    } else if (s.rsRating >= 75) {
      reasons.push({ type: 'bull', icon: '📊', title: `RS Rating ${s.rsRating}`, detail: `Outperforming S&P by ${s.rs30d?.toFixed(1)}% (30d). Above-average relative strength.` });
    } else if (s.rsRating <= 20) {
      reasons.push({ type: 'bear', icon: '🐌', title: `RS Rating ${s.rsRating}`, detail: `Underperforming S&P by ${Math.abs(s.rs30d || 0).toFixed(1)}% (30d). Weak relative strength — laggard.` });
    }
  }

  // 10. Earnings Gap
  if (s.earningsGap) {
    const eg = s.earningsGap;
    const dir = eg.gapDirection === 'up' ? 'gap up' : 'gap down';
    reasons.push({
      type: eg.grade === 'A' || eg.grade === 'B' ? 'bull' : eg.grade === 'D' ? 'bear' : 'neutral',
      icon: eg.grade === 'A' ? '🏆' : eg.grade === 'B' ? '📊' : '📋',
      title: `Earnings Gap: Grade ${eg.grade}`,
      detail: `${Math.abs(eg.gapSize)}% ${dir} detected. Composite score: ${eg.composite}/100. Pre-gap trend: ${eg.factors.trendScore}, Volume: ${eg.factors.volScore}, MA200: ${eg.factors.ma200Score}. ${eg.grade === 'A' ? 'Strong post-earnings setup — high conviction continuation.' : eg.grade === 'B' ? 'Good setup — monitor for follow-through.' : 'Weak setup — gap may fill.'}`,
    });
  }

  // 11. Manipulation / Anomaly flags
  if (s.riskFlags && s.riskFlags.length > 0) {
    for (const f of s.riskFlags) {
      reasons.push({
        type: 'bear',
        icon: f.severity === 'high' ? '🚨' : f.severity === 'medium' ? '⚠️' : '👁️',
        title: f.label,
        detail: f.detail,
      });
    }
  }

  return reasons;
};

const riskBadge = (score) => {
  if (score >= 6) return { label: 'SUSPECT', color: T.r.m };
  if (score >= 3) return { label: 'UNUSUAL', color: T.w.m };
  return { label: 'CLEAN', color: T.g.m };
};

const TABS = ['Top 20', 'All', 'Strong Buy', 'VCP', 'Value', 'Momentum', 'Clean Only', 'Tel Aviv', 'Discovered'];

const filterStocks = (stocks, tab) => {
  switch (tab) {
    case 'Top 20': return stocks.slice(0, 20);
    case 'Strong Buy': return stocks.filter(s => s.analystRating === 'STRONG BUY');
    case 'VCP': return stocks.filter(s => s.vcp && s.vcp.vcpScore >= 60).sort((a, b) => (b.vcp?.vcpScore || 0) - (a.vcp?.vcpScore || 0));
    case 'Value': return stocks.filter(s => s.w52Position != null && s.w52Position < 40 && s.rsi != null && s.rsi < 50);
    case 'Momentum': return stocks.filter(s => s.mom30d != null && s.mom30d > 5 && s.price > (s.sma20 || 0));
    case 'Clean Only': return stocks.filter(s => (s.riskScore || 0) < 3);
    case 'Tel Aviv': return stocks.filter(s => s.category === 'Tel Aviv 125');
    case 'Discovered': return stocks.filter(s => s._discovered);
    default: return stocks;
  }
};

/* ═══ SKELETON ROW ═══ */
const SkeletonRow = ({ i }) => (
  <tr style={{ background: i % 2 === 0 ? T.bg.card : T.bg.surface }}>
    {Array.from({ length: 9 }).map((_, j) => (
      <td key={j} style={{ padding: '8px 6px' }}>
        <div style={{ height: 12, borderRadius: 3, background: T.bg.el, width: j === 2 ? '80%' : '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </td>
    ))}
  </tr>
);

/* ═══ EXPANDED DETAIL CARD ═══ */
const DetailCard = ({ s }) => {
  const reasons = generateFullAnalysis(s);
  const bullCount = reasons.filter(r => r.type === 'bull').length;
  const bearCount = reasons.filter(r => r.type === 'bear').length;

  const mb = { background: T.bg.deep, borderRadius: 5, padding: '6px 8px' };
  const ml = { fontSize: 8, fontFamily: mono, color: T.t.m, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 };
  const mv = { fontFamily: mono, fontSize: 12, fontWeight: 600 };

  return (
    <tr><td colSpan={9} style={{ padding: 0 }}>
      <div style={{ padding: '12px 14px', background: T.bg.surface, borderTop: `1px solid ${T.b.s}`, animation: 'slideDown 0.25s ease-out' }}>

        {/* Quick metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginBottom: 10 }}>
          <div style={mb}><div style={ml}>RSI (14)</div><div style={{ ...mv, color: rsiColor(s.rsi) }}>{s.rsi?.toFixed(1) ?? '—'}</div></div>
          <div style={mb}><div style={ml}>SMA 20</div><div style={{ ...mv, color: s.sma20 && s.price > s.sma20 ? T.g.m : T.r.m }}>${s.sma20?.toFixed(2) ?? '—'}</div></div>
          <div style={mb}><div style={ml}>SMA 50</div><div style={{ ...mv, color: s.sma50 && s.price > s.sma50 ? T.g.m : T.r.m }}>${s.sma50?.toFixed(2) ?? '—'}</div></div>
          <div style={mb}><div style={ml}>MACD</div><div style={{ ...mv, color: s.macd > 0 ? T.g.m : T.r.m }}>{s.macd?.toFixed(2) ?? '—'}</div></div>
          <div style={mb}><div style={ml}>RVOL</div><div style={{ ...mv, color: s.volRatio > 1.5 ? T.g.m : T.t.p }}>{s.volRatio?.toFixed(2) ?? '—'}x</div></div>
          <div style={mb}><div style={ml}>30d Mom</div><div style={{ ...mv, color: s.mom30d > 0 ? T.g.m : T.r.m }}>{s.mom30d != null ? (s.mom30d > 0 ? '+' : '') + s.mom30d.toFixed(1) + '%' : '—'}</div></div>
          <div style={mb}><div style={ml}>RS Rating</div><div style={{ ...mv, color: (s.rsRating || 0) >= 75 ? T.g.m : (s.rsRating || 0) <= 30 ? T.r.m : T.t.p }}>{s.rsRating ?? '—'}</div></div>
          {s.vcp && s.vcp.vcpScore >= 50 && (
            <div style={mb}><div style={ml}>VCP</div><div style={{ ...mv, color: s.vcp.vcpScore >= 80 ? T.g.m : '#ca8a04' }}>{s.vcp.vcpScore} <span style={{ fontSize: 8, opacity: 0.7 }}>{s.vcp.state}</span></div></div>
          )}
          {s.earningsGap && (
            <div style={mb}><div style={ml}>Earnings</div><div style={{ ...mv, color: s.earningsGap.grade <= 'B' ? T.g.m : T.t.p }}>Grade {s.earningsGap.grade} <span style={{ fontSize: 8, opacity: 0.7 }}>{s.earningsGap.gapSize > 0 ? '+' : ''}{s.earningsGap.gapSize}%</span></div></div>
          )}
        </div>

        {/* 52-Week Range Bar */}
        <div style={{ ...mb, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>52W Range</span>
          <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m }}>${s.fiftyTwoWeekLow?.toFixed(2)}</span>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: T.bg.el, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, width: `${s.w52Position || 50}%`, background: `linear-gradient(90deg, ${T.g.m}, ${s.w52Position > 70 ? '#f87171' : T.a.blue})` }} />
            <div style={{ position: 'absolute', left: `${s.w52Position || 50}%`, top: -3, width: 11, height: 11, borderRadius: '50%', background: T.t.p, border: `2px solid ${T.bg.deep}`, transform: 'translateX(-50%)' }} />
          </div>
          <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m }}>${s.fiftyTwoWeekHigh?.toFixed(2)}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.a.blue, fontWeight: 600, whiteSpace: 'nowrap' }}>{(s.w52Position || 0).toFixed(0)}%</span>
        </div>

        {/* Verdict summary */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ padding: '4px 10px', borderRadius: 5, background: T.g.bg, border: `1px solid ${T.g.m}44`, fontFamily: mono, fontSize: 11, color: T.g.m, fontWeight: 600 }}>
            {bullCount} Bullish
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 5, background: T.r.bg, border: `1px solid ${T.r.m}44`, fontFamily: mono, fontSize: 11, color: T.r.m, fontWeight: 600 }}>
            {bearCount} Bearish
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 5, background: T.a.bg, border: `1px solid ${T.a.blue}44`, fontFamily: mono, fontSize: 11, color: T.a.blue, fontWeight: 600 }}>
            {reasons.length - bullCount - bearCount} Neutral
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 11, color: T.t.m, display: 'flex', alignItems: 'center', gap: 6 }}>
            APEX <span style={{ color: scoreColor(s.apexScore), fontWeight: 700, fontSize: 13 }}>{s.apexScore.toFixed(1)}</span>
          </div>
        </div>

        {/* Detailed reasons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 5 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: 5,
              background: r.type === 'bull' ? 'rgba(16,185,129,0.06)' : r.type === 'bear' ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
              border: `1px solid ${r.type === 'bull' ? T.g.m : r.type === 'bear' ? T.r.m : T.a.blue}22`,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: mono, fontSize: 11, fontWeight: 700, marginBottom: 1,
                  color: r.type === 'bull' ? T.g.m : r.type === 'bear' ? T.r.m : T.a.blue,
                }}>{r.title}</div>
                <div style={{ fontFamily: sans, fontSize: 10, color: T.t.s, lineHeight: 1.45 }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </td></tr>
  );
};

/* ═══ SPOTLIGHT PANEL ═══ */
const RecsSpotlight = ({ item }) => {
  if (!item) return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, textAlign: 'center',
    }}>
      <Target size={28} color={T.t.f} style={{ marginBottom: 12, opacity: 0.4 }} />
      <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 4 }}>No selection</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>Click a row to inspect</div>
    </div>
  );

  const s = item;
  const trend = trendLabel(s.price, s.sma20, s.sma50);
  const reasons = generateFullAnalysis(s);
  const bullCount = reasons.filter(r => r.type === 'bull').length;
  const bearCount = reasons.filter(r => r.type === 'bear').length;

  return (
    <div style={{ padding: '14px 12px', animation: 'slideIn 0.22s cubic-bezier(0.22,1,0.36,1)', fontFamily: mono, overflowY: 'auto' }}>
      {/* Ticker + Price */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{ fontSize: 20, fontWeight: 800, color: T.t.p, cursor: 'pointer', letterSpacing: 0.5 }}
          title="Click to copy"
          onClick={() => navigator.clipboard.writeText(s.ticker)}
        >{s.ticker}</span>
        <div style={{ fontSize: 9, color: T.t.m, marginTop: 1, marginBottom: 6 }}>{s.name}</div>
        <Morph value={D(s.price)} style={{ fontSize: 22, fontWeight: 700, color: T.t.p, lineHeight: 1 }} />
        <div style={{ marginTop: 3 }}>
          <Morph value={s.changePct != null ? pct(s.changePct) : ''} style={{ fontSize: 13, fontWeight: 600, color: pc(s.changePct) }} />
        </div>
      </div>

      {/* Signal + Score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Badge color={ratingColor(s.analystRating)} style={{ fontSize: 9 }}>{s.analystRating}</Badge>
        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s.apexScore) }}>APEX {s.apexScore.toFixed(1)}</span>
      </div>

      <div style={{ height: 1, background: T.b.s, margin: '0 0 10px' }} />

      {/* Technicals Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
        {[
          ['RSI', s.rsi?.toFixed(0) ?? '—', rsiColor(s.rsi)],
          ['Trend', trend.text, trend.color],
          ['30d Mom', s.mom30d != null ? pct(s.mom30d) : '—', s.mom30d != null ? pc(s.mom30d) : T.t.f],
          ['RVOL', s.volRatio?.toFixed(1) + 'x' || '—', s.volRatio > 1.5 ? T.g.m : T.t.s],
          ['52W Pos', s.w52Position != null ? s.w52Position.toFixed(0) + '%' : '—', s.w52Position < 30 ? T.g.m : s.w52Position > 80 ? T.r.m : T.t.s],
          ['Risk', (() => { const rb = riskBadge(s.riskScore || 0); return rb.label; })(), (() => { const rb = riskBadge(s.riskScore || 0); return rb.color; })()],
        ].map(([label, val, color]) => (
          <div key={label} style={{ padding: '5px 7px', background: T.bg.deep, borderRadius: 3, borderLeft: `2px solid ${color}30` }}>
            <div style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Bull / Bear count */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, background: T.g.bg, textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.g.m }}>{bullCount}</span>
          <span style={{ fontSize: 8, color: T.g.m, marginLeft: 3 }}>Bull</span>
        </div>
        <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, background: T.r.bg, textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.r.m }}>{bearCount}</span>
          <span style={{ fontSize: 8, color: T.r.m, marginLeft: 3 }}>Bear</span>
        </div>
      </div>

      <div style={{ height: 1, background: T.b.s, margin: '0 0 8px' }} />

      {/* Why it Matched — condensed reasons */}
      <div style={{ fontSize: 8, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Why it matched</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reasons.slice(0, 5).map((r, i) => (
          <div key={i} style={{
            padding: '5px 7px', borderRadius: 3,
            background: r.type === 'bull' ? 'rgba(16,185,129,0.06)' : r.type === 'bear' ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
            borderLeft: `2px solid ${r.type === 'bull' ? T.g.m : r.type === 'bear' ? T.r.m : T.a.blue}40`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: r.type === 'bull' ? T.g.m : r.type === 'bear' ? T.r.m : T.a.blue, marginBottom: 1 }}>
              {r.icon} {r.title}
            </div>
            <div style={{ fontFamily: sans, fontSize: 8, color: T.t.s, lineHeight: 1.4 }}>{r.detail}</div>
          </div>
        ))}
        {reasons.length > 5 && (
          <div style={{ fontSize: 8, color: T.t.f, textAlign: 'center', padding: 3 }}>+{reasons.length - 5} more signals</div>
        )}
      </div>
    </div>
  );
};

/* ═══ MAIN COMPONENT ═══ */
const Recommendations = ({ holdings, toast }) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tab, setTab] = useState('Top 20');
  const [expanded, setExpanded] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  const [spotIdx, setSpotIdx] = useState(-1);
  const tableRef = useRef(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [addTicker, setAddTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [customTickers, setCustomTickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apex_custom_tickers') || '[]'); } catch { return []; }
  });
  const mountRef = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApexScreener((done, total) => {
        if (mountRef.current) setProgress({ done, total });
      });
      // Also fetch any custom tickers
      if (customTickers.length > 0) {
        const customs = await Promise.allSettled(customTickers.map(tk => fetchSingleAnalysis(tk)));
        const existing = new Set(data.map(s => s.ticker));
        for (const r of customs) {
          if (r.status === 'fulfilled' && r.value && !existing.has(r.value.ticker)) {
            r.value._custom = true;
            data.push(r.value);
          }
        }
        data.sort((a, b) => b.apexScore - a.apexScore);
      }
      if (mountRef.current) {
        setStocks(data);
        setRefreshedAt(new Date());
      }
    } catch (e) {
      console.error("Screener error:", e);
      if (mountRef.current) setError("Failed to fetch screener data.");
    } finally {
      if (mountRef.current) setLoading(false);
    }
  }, [customTickers]);

  useEffect(() => {
    mountRef.current = true;
    loadData();
    return () => { mountRef.current = false; };
  }, [loadData]);

  const handleAddTicker = async () => {
    const tk = addTicker.trim().toUpperCase();
    if (!tk || customTickers.includes(tk) || stocks.some(s => s.ticker === tk)) {
      setAddTicker('');
      return;
    }
    setAdding(true);
    try {
      const result = await fetchSingleAnalysis(tk);
      if (result) {
        result._custom = true;
        const updated = [...customTickers, tk];
        setCustomTickers(updated);
        localStorage.setItem('apex_custom_tickers', JSON.stringify(updated));
        setStocks(prev => [...prev, result].sort((a, b) => b.apexScore - a.apexScore));
        setAddTicker('');
        toast?.({ type: 'success', msg: `${tk} added — Score: ${result.apexScore.toFixed(1)} (${result.analystRating})` });
      } else {
        toast?.({ type: 'error', msg: `Could not find data for "${tk}"` });
      }
    } catch {
      toast?.({ type: 'error', msg: `Failed to analyze ${tk}` });
    } finally {
      setAdding(false);
    }
  };

  const removeCustom = (tk) => {
    const updated = customTickers.filter(t => t !== tk);
    setCustomTickers(updated);
    localStorage.setItem('apex_custom_tickers', JSON.stringify(updated));
    setStocks(prev => prev.filter(s => s.ticker !== tk));
  };

  const filtered = filterStocks(stocks, tab).filter(s => {
    if (!search) return true;
    const q = search.toUpperCase();
    return s.ticker.includes(q) || s.name.toUpperCase().includes(q);
  });

  // J/K keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSpotIdx(prev => {
          const next = Math.min(prev + 1, filtered.length - 1);
          if (filtered[next]) { setSpotlight(filtered[next]); setExpanded(filtered[next].ticker); }
          const rows = tableRef.current?.querySelectorAll('.apex-row');
          rows?.[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSpotIdx(prev => {
          const next = Math.max(prev - 1, 0);
          if (filtered[next]) { setSpotlight(filtered[next]); setExpanded(filtered[next].ticker); }
          const rows = tableRef.current?.querySelectorAll('.apex-row');
          rows?.[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Escape') {
        setSpotlight(null); setSpotIdx(-1); setExpanded(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered]);

  const timeSince = refreshedAt ? Math.round((Date.now() - refreshedAt.getTime()) / 60000) : null;

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 80px)' }}>
      {/* ═══ LEFT: Data Grid (70%) ═══ */}
      <div style={{ flex: '1 1 70%', minWidth: 0, overflow: 'auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes fadeInRow { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1200px; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(12px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .apex-row:hover { background: ${T.bg.el} !important; }
        .apex-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .apex-table th { position: sticky; top: 0; z-index: 2; }
        .apex-table td, .apex-table th { padding: 6px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color={T.accent} />
          <h2 style={{ fontSize: 14, fontFamily: mono, fontWeight: 700, color: T.t.p, margin: 0 }}>APEX Screener</h2>
          <Badge color={T.accent}>{stocks.length}</Badge>
          {stocks.some(s => s._discovered) && <Badge color={T.gold}>{stocks.filter(s => s._discovered).length} new</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Add custom ticker */}
          <form onSubmit={e => { e.preventDefault(); handleAddTicker(); }} style={{ display: 'flex', gap: 3 }}>
            <input
              value={addTicker}
              onChange={e => setAddTicker(e.target.value.toUpperCase())}
              placeholder="+ ticker"
              maxLength={8}
              style={{
                padding: '4px 7px', borderRadius: 4, border: `1px solid ${T.b.s}`,
                background: T.bg.deep, color: T.t.p, fontFamily: mono, fontSize: 10,
                outline: 'none', width: 75,
              }}
            />
            <button type="submit" disabled={adding || !addTicker.trim()} aria-label="Add ticker to screener" title={!addTicker.trim() ? "Enter a ticker symbol first" : adding ? "Adding..." : "Add ticker"} style={{
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '4px 7px', borderRadius: 4, border: `1px solid ${T.accent}44`,
              background: T.accentDim, color: T.accent, cursor: 'pointer',
              fontFamily: mono, fontSize: 10, fontWeight: 600, opacity: adding ? 0.5 : 1,
            }}>
              <Plus size={10} />{adding ? '...' : 'Add'}
            </button>
          </form>

          {refreshedAt && (
            <span style={{ fontSize: 9, fontFamily: mono, color: T.t.m }}>
              {timeSince <= 0 ? 'now' : `${timeSince}m`}
            </span>
          )}
          <button onClick={loadData} disabled={loading} aria-label="Refresh screener" style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.b.s}`,
            background: 'transparent', color: T.t.s, cursor: 'pointer',
            fontFamily: mono, fontSize: 10, opacity: loading ? 0.5 : 1,
          }}>
            <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <TabBar tabs={TABS} active={tab} set={setTab} />
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: T.t.m }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter..."
            style={{
              padding: '4px 7px 4px 24px', borderRadius: 4, border: `1px solid ${T.b.s}`,
              background: T.bg.deep, color: T.t.p, fontFamily: mono, fontSize: 10,
              outline: 'none', width: 100,
            }}
          />
        </div>
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
        <div ref={tableRef}>
        <table className="apex-table">
          <thead>
            <tr style={{ background: T.bg.deep, borderBottom: `1px solid ${T.b.s}` }}>
              {['#', 'Ticker', 'Company', 'Price', 'Score', 'Signal', 'RSI', 'Risk', 'Trend'].map((h, i) => (
                <th key={h} style={{
                  padding: '6px 6px', textAlign: 'left',
                  fontSize: 8, fontFamily: mono, fontWeight: 600, color: T.t.m,
                  textTransform: 'uppercase', letterSpacing: 0.7, background: T.bg.deep,
                  width: i === 0 ? 24 : i === 1 ? 58 : i === 2 ? 'auto' : i === 3 ? 95 : i === 4 ? 46 : i === 5 ? 70 : i === 6 ? 45 : i === 7 ? 50 : 52,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && stocks.length === 0 && <>
              <tr><td colSpan={9} style={{ padding: '10px 14px', background: T.bg.deep }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RefreshCw size={12} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.t.m }}>Scanning {progress.done}/{progress.total} tickers...</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.bg.el }}>
                    <div style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', borderRadius: 2, background: T.accent, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </td></tr>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}
            </>}

            {error && !loading && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: T.r.m, fontFamily: mono, fontSize: 12 }}>
                {error} <button onClick={loadData} style={{ marginLeft: 6, padding: '3px 10px', borderRadius: 4, border: `1px solid ${T.r.m}`, background: T.r.bg, color: T.r.m, cursor: 'pointer', fontSize: 11 }}>Retry</button>
              </td></tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 12 }}>No stocks match.</td></tr>
            )}

            {filtered.map((s, i) => {
              const isExp = expanded === s.ticker;
              const trend = trendLabel(s.price, s.sma20, s.sma50);
              const vb = vcpBadge(s.vcp);
              return [
                <tr
                  key={s.ticker}
                  className="apex-row"
                  onClick={() => { setExpanded(isExp ? null : s.ticker); setSpotlight(s); setSpotIdx(i); }}
                  style={{
                    background: spotlight?.ticker === s.ticker ? T.accent + '08' : isExp ? T.bg.el : (i % 2 === 0 ? T.bg.card : T.bg.surface),
                    cursor: 'pointer', transition: 'background 0.12s',
                    borderLeft: spotlight?.ticker === s.ticker ? `2px solid ${T.accent}` : '2px solid transparent',
                    animation: `fadeInRow 0.2s ease-out ${Math.min(i * 0.015, 0.3)}s both`,
                    borderBottom: `1px solid ${T.b.s}`,
                  }}
                >
                  <td style={{ fontFamily: mono, fontSize: 10, color: T.t.m }}>{i + 1}</td>
                  <td style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>
                    {s._discovered && <Flame size={9} color={T.gold} style={{ marginRight: 2, verticalAlign: 'middle' }} />}
                    {s.ticker}
                    {s._custom && (
                      <span onClick={e => { e.stopPropagation(); removeCustom(s.ticker); }} title="Remove"
                        style={{ marginLeft: 3, cursor: 'pointer', color: T.t.m, fontSize: 9, verticalAlign: 'middle' }}>✕</span>
                    )}
                  </td>
                  <td style={{ fontFamily: sans, fontSize: 10, color: T.t.s, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                    {vb && <span style={{ marginLeft: 4, fontSize: 8, color: vb.color, fontFamily: mono, fontWeight: 600 }}>{vb.label}</span>}
                  </td>
                  <td>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.t.p }}>{D(s.price)}</span>
                    <span style={{ fontFamily: mono, fontSize: 9, marginLeft: 3, color: pc(s.changePct) }}>{s.changePct != null ? pct(s.changePct) : ''}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '1px 6px', borderRadius: 8,
                      background: scoreColor(s.apexScore) + '18', border: `1px solid ${scoreColor(s.apexScore)}44`,
                      fontFamily: mono, fontSize: 10, fontWeight: 700, color: scoreColor(s.apexScore),
                    }}>{s.apexScore.toFixed(1)}</span>
                  </td>
                  <td><Badge color={ratingColor(s.analystRating)} style={{ fontSize: 8 }}>{s.analystRating}</Badge></td>
                  <td>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: rsiColor(s.rsi) }}>
                      {s.rsi != null ? s.rsi.toFixed(0) : '—'}
                    </span>
                    {s.rsi != null && rsiZone(s.rsi) && (
                      <span style={{ fontSize: 7, marginLeft: 2, color: rsiColor(s.rsi), opacity: 0.7 }}>{rsiZone(s.rsi)}</span>
                    )}
                  </td>
                  <td>
                    {(() => { const rb = riskBadge(s.riskScore || 0); return (
                      <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: rb.color }}>{rb.label}</span>
                    ); })()}
                  </td>
                  <td>
                    <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: trend.color }}>{trend.text}</span>
                    {isExp ? <ChevronUp size={10} color={T.t.m} style={{ marginLeft: 2, verticalAlign: 'middle' }} /> : <ChevronDown size={10} color={T.t.m} style={{ marginLeft: 2, verticalAlign: 'middle' }} />}
                  </td>
                </tr>,
                isExp && <DetailCard key={s.ticker + '_d'} s={s} />,
              ];
            })}
          </tbody>
        </table>
        </div>
      </Card>
      </div>

      {/* ═══ RIGHT: Spotlight Panel (30%) ═══ */}
      <div style={{
        width: 270, flexShrink: 0,
        borderLeft: `1px solid ${T.b.s}`,
        background: T.bg.card,
        overflow: 'auto',
        borderRadius: `0 ${T.rad.md}px ${T.rad.md}px 0`,
      }}>
        <div style={{
          padding: '10px 12px', borderBottom: `1px solid ${T.b.s}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: 'uppercase', letterSpacing: 1 }}>Spotlight</span>
          {spotlight && (
            <button onClick={() => setSpotlight(null)} aria-label="Close spotlight" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: T.t.f, padding: 2,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>&times;</span>
            </button>
          )}
        </div>
        <RecsSpotlight item={spotlight} />
      </div>
    </div>
  );
};

export default Recommendations;
