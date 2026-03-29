// src/components/Backtester.jsx — APEX Strategy Auditor with Regime Filter
import { useState, useCallback, useRef } from "react";
import { FlaskConical, Play, Square } from "lucide-react";
import { T, mono, sans, pc, fmt, pct } from "../theme/tokens";
import { Card, Badge, TabBar } from "./ui/Shared";

/* ═══ BACKTEST ENGINE ═══ */

async function fetchHistory(tk, range = 'max') {
  try {
    const r = await fetch(`/yf/v8/finance/chart/${tk}?range=${range}&interval=1wk`);
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) return null;
    const ts = res.timestamp || [];
    const cl = res.indicators?.quote?.[0]?.close || [];
    const vol = res.indicators?.quote?.[0]?.volume || [];
    const data = [];
    for (let i = 0; i < ts.length; i++) {
      if (cl[i] != null) data.push({ date: ts[i] * 1000, close: cl[i], volume: vol[i] || 0 });
    }
    return data;
  } catch { return null; }
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
}

function calcSMA(arr, period) {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcApexScoreAtT(closes) {
  if (closes.length < 52) return null;
  const price = closes[closes.length - 1];
  const rsi = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const high52 = Math.max(...closes.slice(-52));
  const low52 = Math.min(...closes.slice(-52));
  const w52Range = high52 - low52;
  const w52Pos = w52Range > 0 ? ((price - low52) / w52Range) * 100 : 50;
  const mom4w = closes.length >= 5 ? ((price - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : null;

  let score = 0;
  if (rsi != null) {
    if (rsi < 30) score += 3;
    else if (rsi < 40) score += 2;
    else if (rsi < 50) score += 1;
    else if (rsi > 70) score -= 2;
    else if (rsi > 60) score -= 0.5;
  }
  if (sma20 != null && sma50 != null) {
    if (price > sma20 && sma20 > sma50) score += 2;
    else if (price > sma50 && price < sma20) score += 0.5;
    else if (price < sma20 && sma20 < sma50) score -= 1;
  }
  if (w52Pos < 30) score += 2;
  else if (w52Pos < 50) score += 1;
  else if (w52Pos > 90) score -= 1;
  if (mom4w != null) {
    if (mom4w > 10) score += 2;
    else if (mom4w > 3) score += 1;
    else if (mom4w < -10) score -= 1;
  }

  return { score: Math.round(score * 10) / 10, rsi, sma20, sma50, w52Pos, mom4w };
}

// Regime filter: check if market index is above its 40-week SMA
function isMarketBullish(benchmarkCloses) {
  if (!benchmarkCloses || benchmarkCloses.length < 40) return true; // default to bullish if no data
  const price = benchmarkCloses[benchmarkCloses.length - 1];
  const sma40 = benchmarkCloses.slice(-40).reduce((a, b) => a + b, 0) / 40;
  return price > sma40;
}

const BENCHMARKS = {
  '^GSPC': { label: 'S&P 500', color: '#6366f1' },
  '^IXIC': { label: 'NASDAQ 100', color: '#06b6d4' },
  'TA125.TA': { label: 'TLV-125', color: '#f97316' },
};

const PERIODS = [
  { label: 'Max (~40yr)', range: 'max' },
  { label: '20 Years', range: 'max', filterYears: 20 },
  { label: '10 Years', range: '10y' },
  { label: '5 Years', range: '5y' },
  { label: '3 Years', range: '3y' },
  { label: '1 Year', range: '1y' },
];

async function runBacktest({ tickers, startCash, stopLossPct, entryThreshold, exitThreshold, benchmarkSyms, period, useRegimeFilter, onProgress, onLog, signal }) {
  const BATCH = 5;
  const tickerData = {};

  onLog?.('Fetching historical data...');

  // 1. Fetch stock data
  for (let i = 0; i < tickers.length; i += BATCH) {
    if (signal?.aborted) throw new Error('Aborted');
    const batch = tickers.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(tk => fetchHistory(tk, period.range)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j].status === 'fulfilled' && results[j].value && results[j].value.length > 52) {
        tickerData[batch[j]] = results[j].value;
      }
    }
    onProgress?.({ phase: 'fetch', done: Math.min(i + BATCH, tickers.length), total: tickers.length });
    if (i + BATCH < tickers.length) await new Promise(r => setTimeout(r, 300));
  }

  const validTickers = Object.keys(tickerData);
  onLog?.(`Got data for ${validTickers.length}/${tickers.length} tickers`);

  // 2. Build timeline
  let allDates = new Set();
  for (const tk of validTickers) {
    for (const d of tickerData[tk]) allDates.add(d.date);
  }
  let timeline = [...allDates].sort((a, b) => a - b);

  // Filter by years if needed
  if (period.filterYears) {
    const cutoff = Date.now() - period.filterYears * 365.25 * 86400000;
    timeline = timeline.filter(d => d >= cutoff);
  }

  onLog?.(`Timeline: ${timeline.length} weeks (${new Date(timeline[0]).getFullYear()} - ${new Date(timeline[timeline.length - 1]).getFullYear()})`);

  // 3. Fetch benchmarks
  const benchmarkData = {};
  onLog?.('Fetching benchmarks...');
  for (const sym of benchmarkSyms) {
    try {
      const bData = await fetchHistory(sym, period.range);
      if (bData) {
        const bMap = {};
        for (const d of bData) bMap[d.date] = d.close;
        benchmarkData[sym] = { map: bMap, closes: bData.map(d => d.close) };
      }
    } catch {}
  }

  // 4. Run simulation
  let cash = startCash;
  const positions = {};
  const equityCurve = [];
  const trades = [];
  const benchmarkCurves = {};
  const benchmarkShares = {};

  for (const sym of benchmarkSyms) {
    benchmarkCurves[sym] = [];
    benchmarkShares[sym] = { shares: 0, started: false };
  }

  const startIdx = Math.max(52, 0);
  const totalWeeks = timeline.length;
  let regimeLog = { bullWeeks: 0, bearWeeks: 0, cashEvents: 0 };

  for (let wi = startIdx; wi < totalWeeks; wi++) {
    if (signal?.aborted) throw new Error('Aborted');
    const weekDate = timeline[wi];

    // Build benchmark curves
    for (const sym of benchmarkSyms) {
      const bPrice = findClosestPrice(benchmarkData[sym]?.map, weekDate);
      if (bPrice && !benchmarkShares[sym].started) {
        benchmarkShares[sym] = { shares: startCash / bPrice, started: true };
      }
      if (bPrice && benchmarkShares[sym].started) {
        benchmarkCurves[sym].push({ date: weekDate, value: benchmarkShares[sym].shares * bPrice });
      }
    }

    // Regime filter: check primary benchmark (first in list) for market health
    let marketBullish = true;
    if (useRegimeFilter && benchmarkSyms.length > 0) {
      const primaryBench = benchmarkData[benchmarkSyms[0]];
      if (primaryBench) {
        const benchClosesUpToNow = primaryBench.closes
          ? primaryBench.closes.slice(0, Math.max(1, wi))
          : null;
        // Use the map to get closes up to current date
        const bCloses = [];
        for (let bi = startIdx; bi <= wi && bi < timeline.length; bi++) {
          const bp = findClosestPrice(primaryBench.map, timeline[bi]);
          if (bp) bCloses.push(bp);
        }
        marketBullish = isMarketBullish(bCloses);
      }
    }

    if (marketBullish) regimeLog.bullWeeks++; else regimeLog.bearWeeks++;

    // Portfolio value
    let portfolioValue = cash;
    for (const [tk, pos] of Object.entries(positions)) {
      const price = findClosestDataPrice(tickerData[tk], weekDate);
      if (price) portfolioValue += pos.shares * price;
    }

    // Score tickers
    const scores = [];
    for (const tk of validTickers) {
      const closesUpToNow = tickerData[tk].filter(d => d.date <= weekDate).map(d => d.close);
      if (closesUpToNow.length < 52) continue;
      const analysis = calcApexScoreAtT(closesUpToNow);
      if (analysis) scores.push({ ticker: tk, ...analysis, price: closesUpToNow[closesUpToNow.length - 1] });
    }

    // Exit: stop loss, sell signal, or regime filter forces exit
    for (const [tk, pos] of Object.entries(positions)) {
      const currentPrice = findClosestDataPrice(tickerData[tk], weekDate);
      if (!currentPrice) continue;
      const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const tkScore = scores.find(s => s.ticker === tk);

      let exitReason = null;
      if (pnlPct <= -stopLossPct) exitReason = 'STOP_LOSS';
      else if (tkScore && tkScore.score <= exitThreshold) exitReason = 'SELL_SIGNAL';
      // Regime filter: only force-exit if stock is also losing money (protect winners)
      else if (!marketBullish && useRegimeFilter && pnlPct < -5) exitReason = 'REGIME_EXIT';

      if (exitReason) {
        const proceeds = pos.shares * currentPrice;
        cash += proceeds;
        trades.push({
          ticker: tk, type: 'SELL', reason: exitReason,
          entryPrice: pos.entryPrice, exitPrice: currentPrice,
          shares: pos.shares, pnl: proceeds - (pos.shares * pos.entryPrice),
          pnlPct, entryDate: pos.entryDate, exitDate: weekDate,
        });
        delete positions[tk];
        if (exitReason === 'REGIME_EXIT') regimeLog.cashEvents++;
      }
    }

    // Entry: only if market is bullish (regime filter)
    if (marketBullish || !useRegimeFilter) {
      const buyable = scores
        .filter(s => s.score >= entryThreshold && !positions[s.ticker])
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const positionSize = portfolioValue * 0.05;
      for (const s of buyable) {
        if (cash < positionSize * 0.5) break;
        const invest = Math.min(cash, positionSize);
        const shares = invest / s.price;
        positions[s.ticker] = { shares, entryPrice: s.price, entryDate: weekDate };
        cash -= invest;
        trades.push({ ticker: s.ticker, type: 'BUY', reason: 'STRONG_BUY', entryPrice: s.price, shares, entryDate: weekDate, score: s.score });
      }
    }

    // Record equity
    let totalEquity = cash;
    for (const [tk, pos] of Object.entries(positions)) {
      const price = findClosestDataPrice(tickerData[tk], weekDate);
      if (price) totalEquity += pos.shares * price;
    }
    equityCurve.push({ date: weekDate, value: totalEquity, positions: Object.keys(positions).length });

    if (wi % 50 === 0) onProgress?.({ phase: 'simulate', done: wi - startIdx, total: totalWeeks - startIdx });
  }

  onProgress?.({ phase: 'simulate', done: totalWeeks - startIdx, total: totalWeeks - startIdx });

  const metrics = calculateMetrics(equityCurve, benchmarkCurves, benchmarkSyms, startCash, trades, regimeLog);
  return { equityCurve, benchmarkCurves, trades, metrics, validTickers: validTickers.length, totalWeeks: totalWeeks - startIdx };
}

function findClosestPrice(priceMap, targetDate) {
  if (!priceMap) return null;
  if (priceMap[targetDate]) return priceMap[targetDate];
  const DAY = 86400000;
  for (let offset = 1; offset <= 7; offset++) {
    if (priceMap[targetDate - offset * DAY]) return priceMap[targetDate - offset * DAY];
    if (priceMap[targetDate + offset * DAY]) return priceMap[targetDate + offset * DAY];
  }
  return null;
}

function findClosestDataPrice(tkData, targetDate) {
  let lo = 0, hi = tkData.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tkData[mid].date <= targetDate) lo = mid;
    else hi = mid - 1;
  }
  return tkData[lo]?.close || null;
}

function calculateMetrics(equityCurve, benchmarkCurves, benchmarkSyms, startCash, trades, regimeLog) {
  if (equityCurve.length < 2) return {};

  const startVal = equityCurve[0].value;
  const endVal = equityCurve[equityCurve.length - 1].value;
  const years = (equityCurve[equityCurve.length - 1].date - equityCurve[0].date) / (365.25 * 86400000);
  const cagr = years > 0 ? (Math.pow(endVal / startVal, 1 / years) - 1) * 100 : 0;

  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value);
  }

  let peak = startVal, maxDD = 0;
  const drawdowns = [];
  for (const pt of equityCurve) {
    if (pt.value > peak) peak = pt.value;
    const dd = ((peak - pt.value) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
    drawdowns.push({ date: pt.date, dd });
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((a, r) => a + (r - avgReturn) ** 2, 0) / returns.length);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(52) : 0;

  const downReturns = returns.filter(r => r < 0);
  const downDev = Math.sqrt(downReturns.reduce((a, r) => a + r ** 2, 0) / (downReturns.length || 1));
  const sortino = downDev > 0 ? (avgReturn / downDev) * Math.sqrt(52) : 0;

  // Benchmark CAGRs
  const benchmarkMetrics = {};
  for (const sym of benchmarkSyms) {
    const bc = benchmarkCurves[sym];
    if (bc && bc.length >= 2) {
      const bYears = (bc[bc.length - 1].date - bc[0].date) / (365.25 * 86400000);
      benchmarkMetrics[sym] = {
        cagr: bYears > 0 ? (Math.pow(bc[bc.length - 1].value / bc[0].value, 1 / bYears) - 1) * 100 : 0,
        totalReturn: ((bc[bc.length - 1].value - bc[0].value) / bc[0].value) * 100,
      };
    }
  }

  // Trade stats
  const closedTrades = trades.filter(t => t.type === 'SELL');
  const winners = closedTrades.filter(t => t.pnl > 0);
  const losers = closedTrades.filter(t => t.pnl <= 0);
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((a, t) => a + t.pnlPct, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((a, t) => a + t.pnlPct, 0) / losers.length : 0;
  const stopLossHits = closedTrades.filter(t => t.reason === 'STOP_LOSS').length;
  const regimeExits = closedTrades.filter(t => t.reason === 'REGIME_EXIT').length;

  // Monthly returns heatmap
  const monthlyReturns = {};
  for (let i = 1; i < equityCurve.length; i++) {
    const d = new Date(equityCurve[i].date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyReturns[key]) monthlyReturns[key] = { start: equityCurve[i - 1].value, end: equityCurve[i].value };
    else monthlyReturns[key].end = equityCurve[i].value;
  }
  const monthlyPnl = Object.entries(monthlyReturns).map(([key, v]) => ({
    month: key, ret: ((v.end - v.start) / v.start) * 100,
  }));

  return {
    startVal, endVal, years: Math.round(years * 10) / 10,
    cagr: Math.round(cagr * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: Math.round(sortino * 100) / 100,
    maxDD: Math.round(maxDD * 100) / 100,
    totalReturn: Math.round(((endVal - startVal) / startVal) * 10000) / 100,
    benchmarkMetrics,
    totalTrades: closedTrades.length,
    winRate: Math.round(winRate * 10) / 10,
    avgWin: Math.round(avgWin * 10) / 10,
    avgLoss: Math.round(avgLoss * 10) / 10,
    stopLossHits, regimeExits,
    drawdowns, monthlyPnl,
    regimeLog,
  };
}

/* ═══ SVG CHARTS ═══ */
const MiniChart = ({ data, benchmarks, benchmarkSyms, width = 700, height = 220 }) => {
  if (!data?.length) return null;
  const allVals = [...data.map(d => d.value)];
  for (const sym of (benchmarkSyms || [])) {
    if (benchmarks?.[sym]) allVals.push(...benchmarks[sym].map(d => d.value));
  }
  const mn = Math.min(...allVals), mx = Math.max(...allVals);
  const rg = mx - mn || 1;
  const pad = { t: 10, b: 20, l: 60, r: 10 };
  const cw = width - pad.l - pad.r;
  const ch = height - pad.t - pad.b;

  const toX = (i, arr) => pad.l + (i / (arr.length - 1)) * cw;
  const toY = v => pad.t + ch - ((v - mn) / rg) * ch;

  const path1 = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data)},${toY(d.value)}`).join(' ');

  const benchPaths = {};
  for (const sym of (benchmarkSyms || [])) {
    if (benchmarks?.[sym]?.length) {
      benchPaths[sym] = benchmarks[sym].map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i, benchmarks[sym])},${toY(d.value)}`).join(' ');
    }
  }

  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const val = mn + (rg * i) / 4;
    yLabels.push({ y: toY(val), label: '$' + (val >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : val >= 1e3 ? (val / 1e3).toFixed(0) + 'K' : val.toFixed(0)) });
  }

  const xLabels = [];
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) {
    xLabels.push({ x: toX(i, data), label: new Date(data[i].date).getFullYear().toString() });
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={pad.l} y1={yl.y} x2={width - pad.r} y2={yl.y} stroke={T.b1} strokeWidth={1} />
          <text x={pad.l - 4} y={yl.y + 3} textAnchor="end" fill={T.t3} fontSize={9} fontFamily={mono}>{yl.label}</text>
        </g>
      ))}
      {/* Benchmark lines */}
      {Object.entries(benchPaths).map(([sym, path]) => (
        <path key={sym} d={path} fill="none" stroke={BENCHMARKS[sym]?.color || T.t4} strokeWidth={1.5} opacity={0.5} />
      ))}
      {/* APEX line */}
      <path d={path1} fill="none" stroke={T.accent} strokeWidth={2} />
      {xLabels.map((xl, i) => (
        <text key={i} x={xl.x} y={height - 4} textAnchor="middle" fill={T.t3} fontSize={9} fontFamily={mono}>{xl.label}</text>
      ))}
      {/* Legend */}
      <rect x={pad.l + 8} y={pad.t + 4} width={8} height={2} fill={T.accent} />
      <text x={pad.l + 20} y={pad.t + 8} fill={T.accent} fontSize={9} fontFamily={mono}>APEX</text>
      {Object.entries(benchPaths).map(([sym], i) => (
        <g key={sym}>
          <rect x={pad.l + 60 + i * 80} y={pad.t + 4} width={8} height={2} fill={BENCHMARKS[sym]?.color || T.t4} />
          <text x={pad.l + 72 + i * 80} y={pad.t + 8} fill={BENCHMARKS[sym]?.color || T.t4} fontSize={9} fontFamily={mono}>{BENCHMARKS[sym]?.label || sym}</text>
        </g>
      ))}
    </svg>
  );
};

const DrawdownChart = ({ data, width = 700, height = 120 }) => {
  if (!data?.length) return null;
  const mx = Math.max(...data.map(d => d.dd));
  const pad = { t: 10, b: 20, l: 60, r: 10 };
  const cw = width - pad.l - pad.r;
  const ch = height - pad.t - pad.b;
  const toX = (i) => pad.l + (i / (data.length - 1)) * cw;
  const toY = v => pad.t + (v / (mx || 1)) * ch;
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.dd)}`).join(' ');
  const fillPath = `${path} L${toX(data.length - 1)},${pad.t} L${pad.l},${pad.t} Z`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <text x={pad.l - 4} y={pad.t + 3} textAnchor="end" fill={T.t3} fontSize={9} fontFamily={mono}>0%</text>
      <text x={pad.l - 4} y={pad.t + ch + 3} textAnchor="end" fill={T.r.m} fontSize={9} fontFamily={mono}>-{mx.toFixed(0)}%</text>
      <line x1={pad.l} y1={pad.t} x2={width - pad.r} y2={pad.t} stroke={T.b1} strokeWidth={1} />
      <path d={fillPath} fill={T.r.m + '15'} />
      <path d={path} fill="none" stroke={T.r.m} strokeWidth={1.5} />
    </svg>
  );
};

const MonthlyHeatmap = ({ data }) => {
  if (!data?.length) return null;
  const years = {};
  for (const d of data) {
    const [yr, mo] = d.month.split('-');
    if (!years[yr]) years[yr] = {};
    years[yr][parseInt(mo)] = d.ret;
  }
  const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const displayYears = Object.keys(years).sort().slice(-15);

  const cellColor = (ret) => {
    if (ret == null) return T.bg.deep;
    if (ret > 8) return '#166534';
    if (ret > 4) return '#15803d';
    if (ret > 1) return '#16a34a40';
    if (ret > -1) return T.bg.el;
    if (ret > -4) return '#dc262640';
    if (ret > -8) return '#b91c1c';
    return '#991b1b';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: mono, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ padding: '3px 6px', color: T.t3, textAlign: 'right' }}></th>
            {monthNames.map(m => <th key={m} style={{ padding: '3px 6px', color: T.t3, fontWeight: 400 }}>{m}</th>)}
            <th style={{ padding: '3px 6px', color: T.t3, fontWeight: 400 }}>YR</th>
          </tr>
        </thead>
        <tbody>
          {displayYears.map(yr => {
            const yrTotal = Object.values(years[yr]).reduce((a, b) => a + b, 0);
            return (
              <tr key={yr}>
                <td style={{ padding: '3px 6px', color: T.t.m, textAlign: 'right', fontWeight: 600 }}>{yr}</td>
                {Array.from({ length: 12 }, (_, i) => {
                  const ret = years[yr][i + 1];
                  return (
                    <td key={i} title={ret != null ? `${ret.toFixed(1)}%` : ''} style={{
                      padding: '3px 6px', textAlign: 'center',
                      background: cellColor(ret),
                      color: ret != null ? (Math.abs(ret) > 1 ? '#fff' : T.t.s) : T.t.f,
                      fontWeight: 500,
                    }}>
                      {ret != null ? (ret > 0 ? '+' : '') + ret.toFixed(1) : ''}
                    </td>
                  );
                })}
                <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, color: yrTotal >= 0 ? T.g.m : T.r.m, borderLeft: `1px solid ${T.b1}` }}>
                  {(yrTotal > 0 ? '+' : '') + yrTotal.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ═══ STOCK UNIVERSE ═══ */
const BACKTEST_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ',
  'UNH', 'PG', 'HD', 'MA', 'XOM', 'BAC', 'COST', 'ABBV', 'KO', 'PEP',
  'AMD', 'INTC', 'QCOM', 'ADBE', 'CRM', 'NFLX', 'ORCL', 'CSCO', 'TXN', 'MU',
  'WMT', 'DIS', 'NKE', 'MCD', 'SBUX', 'GS', 'WFC', 'LMT', 'CAT', 'BA',
];

/* ═══ MAIN COMPONENT ═══ */
export default function Backtester() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState([]);
  const [config, setConfig] = useState({
    startCash: 100000,
    stopLoss: 15,
    entryThreshold: 4,
    exitThreshold: -2,
  });
  const [periodIdx, setPeriodIdx] = useState(0);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(['^GSPC']);
  const [regimeFilter, setRegimeFilter] = useState(false);
  const abortRef = useRef(null);

  const toggleBenchmark = (sym) => {
    setSelectedBenchmarks(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const startBacktest = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setLog([]);
    abortRef.current = new AbortController();

    try {
      const res = await runBacktest({
        tickers: BACKTEST_UNIVERSE,
        startCash: config.startCash,
        stopLossPct: config.stopLoss,
        entryThreshold: config.entryThreshold,
        exitThreshold: config.exitThreshold,
        benchmarkSyms: selectedBenchmarks,
        period: PERIODS[periodIdx],
        useRegimeFilter: regimeFilter,
        onProgress: setProgress,
        onLog: (msg) => setLog(prev => [...prev, msg]),
        signal: abortRef.current.signal,
      });
      setResult(res);
      setLog(prev => [...prev, `Complete: ${res.metrics.years}yr, ${res.metrics.totalTrades} trades, Sharpe ${res.metrics.sharpe}`]);
    } catch (e) {
      if (e.message !== 'Aborted') setLog(prev => [...prev, `Error: ${e.message}`]);
    } finally {
      setRunning(false);
    }
  }, [config, periodIdx, selectedBenchmarks, regimeFilter]);

  const m = result?.metrics;

  const metricBox = (label, value, color) => (
    <div style={{ background: T.bg.deep, padding: '6px 8px', borderLeft: `2px solid ${color || T.accent}` }}>
      <div style={{ fontSize: 7, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: color || T.t.p }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <FlaskConical size={14} color={T.accent} />
        <span style={{ fontSize: 13, fontFamily: mono, fontWeight: 700, color: T.t.p, letterSpacing: 0.5 }}>STRATEGY AUDITOR</span>
      </div>

      {/* Config */}
      <Card style={{ marginBottom: 10, padding: '8px 10px' }}>
        {/* Row 1: Core params */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {[
            { label: 'CAPITAL', key: 'startCash' },
            { label: 'STOP LOSS %', key: 'stopLoss' },
            { label: 'ENTRY ≥', key: 'entryThreshold' },
            { label: 'EXIT ≤', key: 'exitThreshold' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 7, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</label>
              <input
                type="number"
                value={config[f.key]}
                onChange={e => setConfig(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                style={{ width: 72, padding: '3px 5px', borderRadius: 2, border: `1px solid ${T.b1}`, background: T.bg.deep, color: T.t.p, fontFamily: mono, fontSize: 10 }}
              />
            </div>
          ))}
        </div>

        {/* Row 2: Period + Benchmarks + Regime */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Period */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 7, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1 }}>PERIOD</label>
            <select
              value={periodIdx}
              onChange={e => setPeriodIdx(parseInt(e.target.value))}
              style={{ padding: '3px 5px', borderRadius: 2, border: `1px solid ${T.b1}`, background: T.bg.deep, color: T.t.p, fontFamily: mono, fontSize: 10 }}
            >
              {PERIODS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>

          {/* Benchmarks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 7, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1 }}>COMPARE</label>
            {Object.entries(BENCHMARKS).map(([sym, info]) => (
              <button
                key={sym}
                onClick={() => toggleBenchmark(sym)}
                style={{
                  padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${selectedBenchmarks.includes(sym) ? info.color : T.b1}`,
                  background: selectedBenchmarks.includes(sym) ? info.color + '20' : 'transparent',
                  color: selectedBenchmarks.includes(sym) ? info.color : T.t.m,
                  fontFamily: mono, fontSize: 9, fontWeight: 600,
                }}
              >
                {info.label}
              </button>
            ))}
          </div>

          {/* Regime filter */}
          <button
            onClick={() => setRegimeFilter(!regimeFilter)}
            style={{
              padding: '2px 10px', borderRadius: 2, cursor: 'pointer',
              border: `1px solid ${regimeFilter ? T.accent : T.b1}`,
              background: regimeFilter ? T.accent + '20' : 'transparent',
              color: regimeFilter ? T.accent : T.t.m,
              fontFamily: mono, fontSize: 9, fontWeight: 600,
            }}
          >
            REGIME FILTER {regimeFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Row 3: Run button + progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!running ? (
            <button onClick={startBacktest} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 14px', borderRadius: 2, border: 'none',
              background: T.accent, color: '#000', cursor: 'pointer',
              fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              <Play size={11} /> RUN {BACKTEST_UNIVERSE.length} STOCKS &middot; {PERIODS[periodIdx].label}
            </button>
          ) : (
            <button onClick={() => { abortRef.current?.abort(); setRunning(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 14px', borderRadius: 2, border: `1px solid ${T.r.m}`,
              background: 'transparent', color: T.r.m, cursor: 'pointer',
              fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            }}>
              <Square size={11} /> ABORT
            </button>
          )}

          {running && progress && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8, color: T.t.m, fontFamily: mono, textTransform: 'uppercase' }}>
                {progress.phase === 'fetch' ? 'Fetching' : 'Simulating'} {progress.done}/{progress.total}
              </span>
              <div style={{ flex: 1, height: 3, background: T.bg.el }}>
                <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', background: T.accent, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {log.length > 0 && (
          <div style={{ marginTop: 6, maxHeight: 50, overflow: 'auto' }}>
            {log.map((l, i) => <div key={i} style={{ fontSize: 8, color: T.t.m, fontFamily: mono, lineHeight: 1.5 }}>{l}</div>)}
          </div>
        )}
      </Card>

      {/* Results */}
      {m && (
        <>
          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 3, marginBottom: 10 }}>
            {metricBox('CAGR', m.cagr.toFixed(2) + '%', m.cagr > 0 ? T.g.m : T.r.m)}
            {metricBox('Total Return', m.totalReturn.toFixed(1) + '%', m.totalReturn > 0 ? T.g.m : T.r.m)}
            {metricBox('Sharpe', m.sharpe.toFixed(2), m.sharpe > 1 ? T.g.m : m.sharpe > 0.5 ? T.w.m : T.r.m)}
            {metricBox('Sortino', m.sortino.toFixed(2), m.sortino > 1.5 ? T.g.m : m.sortino > 0.7 ? T.w.m : T.r.m)}
            {metricBox('Max DD', '-' + m.maxDD.toFixed(1) + '%', m.maxDD < 20 ? T.g.m : m.maxDD < 40 ? T.w.m : T.r.m)}
            {metricBox('Win Rate', m.winRate.toFixed(1) + '%', m.winRate > 55 ? T.g.m : m.winRate > 45 ? T.w.m : T.r.m)}
            {metricBox('Trades', m.totalTrades.toString(), T.t.p)}
            {metricBox('Stop Losses', m.stopLossHits.toString(), T.r.m)}
            {regimeFilter && metricBox('Regime Exits', (m.regimeExits || 0).toString(), T.w.m)}
            {regimeFilter && metricBox('Bull/Bear Wks', `${m.regimeLog?.bullWeeks || 0}/${m.regimeLog?.bearWeeks || 0}`, T.t.s)}
            {/* Benchmark comparisons */}
            {Object.entries(m.benchmarkMetrics || {}).map(([sym, bm]) => (
              <div key={sym}>
                {metricBox(BENCHMARKS[sym]?.label + ' CAGR', bm.cagr.toFixed(2) + '%', BENCHMARKS[sym]?.color)}
              </div>
            ))}
            {/* Alpha vs each benchmark */}
            {Object.entries(m.benchmarkMetrics || {}).map(([sym, bm]) => {
              const alpha = m.cagr - bm.cagr;
              return (
                <div key={sym + '_alpha'}>
                  {metricBox('Alpha vs ' + (BENCHMARKS[sym]?.label || sym), (alpha > 0 ? '+' : '') + alpha.toFixed(2) + '%', alpha > 0 ? T.g.m : T.r.m)}
                </div>
              );
            })}
          </div>

          {/* Verdict */}
          <Card style={{ marginBottom: 10, padding: '8px 10px', borderLeft: `2px solid ${m.sharpe >= 1 ? T.g.m : m.sharpe >= 0.5 ? T.w.m : T.r.m}` }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.t.p, lineHeight: 1.6 }}>
              <strong style={{ color: m.sharpe >= 1 ? T.g.m : m.sharpe >= 0.5 ? T.w.m : T.r.m }}>
                {m.sharpe >= 2 ? 'EXCEPTIONAL' : m.sharpe >= 1 ? 'SOLID' : m.sharpe >= 0.5 ? 'MEDIOCRE' : 'WEAK'}
              </strong>
              {' — '}Sharpe {m.sharpe.toFixed(2)} over {m.years}yr.
              {Object.entries(m.benchmarkMetrics || {}).map(([sym, bm]) => {
                const alpha = m.cagr - bm.cagr;
                return ` ${alpha >= 0 ? 'Beat' : 'Trailed'} ${BENCHMARKS[sym]?.label} by ${Math.abs(alpha).toFixed(2)}% CAGR.`;
              }).join('')}
              {` ${m.totalTrades} trades, ${m.winRate.toFixed(0)}% win rate.`}
              {m.maxDD > 30 && ` Warning: ${m.maxDD.toFixed(0)}% max drawdown.`}
              {regimeFilter && m.regimeLog && ` Regime filter: ${m.regimeLog.bearWeeks} bear weeks avoided, ${m.regimeExits || 0} forced exits.`}
            </div>
          </Card>

          {/* Equity Curve */}
          <Card style={{ marginBottom: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 8, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Equity Curve {selectedBenchmarks.map(s => 'vs ' + BENCHMARKS[s]?.label).join(' ')}
            </div>
            <MiniChart data={result.equityCurve} benchmarks={result.benchmarkCurves} benchmarkSyms={selectedBenchmarks} />
          </Card>

          {/* Drawdown */}
          {m.drawdowns && (
            <Card style={{ marginBottom: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Drawdown Map</div>
              <DrawdownChart data={m.drawdowns} />
            </Card>
          )}

          {/* Monthly heatmap */}
          {m.monthlyPnl && (
            <Card style={{ marginBottom: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Monthly Returns</div>
              <MonthlyHeatmap data={m.monthlyPnl} />
            </Card>
          )}

          {/* Trades */}
          <Card style={{ padding: '8px 10px' }}>
            <div style={{ fontSize: 8, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Last 30 Trades</div>
            <div style={{ maxHeight: 250, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.b1}` }}>
                    {['Ticker', 'Reason', 'Entry', 'Exit', 'P&L', 'Date'].map(h => (
                      <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.t.m, fontWeight: 400, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.trades.filter(t => t.type === 'SELL').slice(-30).reverse().map((t, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.b1}10` }}>
                      <td style={{ padding: '3px 6px', fontWeight: 600 }}>{t.ticker}</td>
                      <td style={{ padding: '3px 6px', color: t.reason === 'STOP_LOSS' ? T.r.m : t.reason === 'REGIME_EXIT' ? T.w.m : T.t.s }}>{t.reason}</td>
                      <td style={{ padding: '3px 6px' }}>${t.entryPrice?.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px' }}>${t.exitPrice?.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', color: t.pnlPct >= 0 ? T.g.m : T.r.m, fontWeight: 600 }}>{t.pnlPct >= 0 ? '+' : ''}{t.pnlPct?.toFixed(1)}%</td>
                      <td style={{ padding: '3px 6px', color: T.t.m }}>{new Date(t.exitDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!result && !running && (
        <Card style={{ padding: 24, textAlign: 'center' }}>
          <FlaskConical size={24} color={T.t4} style={{ marginBottom: 8 }} />
          <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 4 }}>POINT-IN-TIME STRATEGY AUDIT</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Tests APEX scoring on {BACKTEST_UNIVERSE.length} stocks using only data available at each historical point.
            Entry at score ≥ {config.entryThreshold}, exit at ≤ {config.exitThreshold} or {config.stopLoss}% stop loss.
            {regimeFilter ? ' REGIME FILTER: Goes to cash when primary benchmark drops below 40-week SMA (Minervini method).' : ''}
            {' '}Compare against S&P 500, NASDAQ 100, and TLV-125 simultaneously.
          </div>
        </Card>
      )}
    </div>
  );
}
