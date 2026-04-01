// src/components/Scanner.jsx — Full Market Scanner: Stocks (Sector Sniper) + Crypto (Categorized)
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Crosshair, RefreshCw, Zap, Star } from "lucide-react";
import { T, mono, display, pc, D, pct, fmt } from "../theme/tokens";
import { _c, fetchTopMovers, UNIVERSE_CATEGORIES, tickerCategory } from "../api/finance";
import { Card, Badge, TabBar, Morph } from "./ui/Shared";

/* ═══ SECTOR ETFs ═══ */
const SECTOR_ETFS = [
  { sector: 'Technology', sym: 'XLK', tickers: ['AAPL','MSFT','NVDA','AVGO','ADBE','CRM','ORCL','CSCO','AMD','INTC','QCOM','TXN','MU','AMAT','LRCX','KLAC','MRVL','SNPS','CDNS','PANW','FTNT','ZS','NOW','INTU','WDAY','PLTR','CRWD','NET','DDOG','SNOW'] },
  { sector: 'Healthcare', sym: 'XLV', tickers: ['UNH','JNJ','LLY','ABBV','MRK','PFE','BMY','TMO','DHR','ABT','AMGN','GILD','VRTX','REGN','MRNA','BIIB','ISRG','BSX','MDT','SYK','DXCM'] },
  { sector: 'Financials', sym: 'XLF', tickers: ['JPM','BAC','WFC','GS','MS','C','AXP','BLK','SCHW','USB','PNC','CME','ICE','MCO','SPGI','FIS','FISV'] },
  { sector: 'Energy', sym: 'XLE', tickers: ['XOM','CVX','OXY','COP','SLB','HAL','EOG','DVN','MPC','PSX','VLO','FANG','APA','KMI','WMB','ET','OKE','CTRA','EQT'] },
  { sector: 'Consumer Disc.', sym: 'XLY', tickers: ['AMZN','TSLA','HD','TGT','LOW','TJX','ROST','NKE','SBUX','MCD','CMG','LULU','DPZ','YUM','BURL'] },
  { sector: 'Consumer Staples', sym: 'XLP', tickers: ['PG','KO','PEP','COST','WMT','DG','DLTR'] },
  { sector: 'Industrials', sym: 'XLI', tickers: ['CAT','BA','LMT','RTX','NOC','GD','LHX','HII','TDG','AXON','HON','UPS','DE'] },
  { sector: 'Materials', sym: 'XLB', tickers: ['LIN','APD','ECL','SHW','DD','NEM','FCX'] },
  { sector: 'Utilities', sym: 'XLU', tickers: ['NEE','DUK','SO','D','AEP','EXC','SRE'] },
  { sector: 'Real Estate', sym: 'XLRE', tickers: ['AMT','PLD','CCI','EQIX','O','SPG','DLR','PSA'] },
  { sector: 'Communications', sym: 'XLC', tickers: ['META','GOOGL','NFLX','DIS','CMCSA','T','VZ','TMUS'] },
];

/* ═══ CRYPTO CATEGORIES ═══ */
const CRYPTO_CATEGORIES = {
  'Layer 1': { ids: 'bitcoin,ethereum,solana,cardano,avalanche-2,polkadot,near,aptos,sui,tron,cosmos,the-open-network,hedera-hashgraph', tickers: 'BTC,ETH,SOL,ADA,AVAX,DOT,NEAR,APT,SUI,TRX,ATOM,TON,HBAR' },
  'Layer 2': { ids: 'matic-network,optimism,arbitrum,starknet,zksync,immutable-x', tickers: 'MATIC,OP,ARB,STRK,ZK,IMX' },
  'DeFi': { ids: 'uniswap,aave,maker,curve-dao-token,compound-governance-token,lido-dao,rocket-pool,pendle,ethena', tickers: 'UNI,AAVE,MKR,CRV,COMP,LDO,RPL,PENDLE,ENA' },
  'AI / DePin': { ids: 'fetch-ai,render-token,bittensor,the-graph,filecoin,arweave,helium,pyth-network,worldcoin-wld,akash-network', tickers: 'FET,RENDER,TAO,GRT,FIL,AR,HNT,PYTH,WLD,AKT' },
  'Memes': { ids: 'dogecoin,shiba-inu,pepe,dogwifcoin,bonk,floki,popcat,cat-in-a-dogs-world', tickers: 'DOGE,SHIB,PEPE,WIF,BONK,FLOKI,POPCAT,MEW' },
  'Gaming / NFT': { ids: 'axie-infinity,the-sandbox,decentraland,gala,enjincoin,immutable-x', tickers: 'AXS,SAND,MANA,GALA,ENJ,IMX' },
  'Infrastructure': { ids: 'chainlink,internet-computer,quant-network,injective-protocol,sei-network,celestia,thorchain', tickers: 'LINK,ICP,QNT,INJ,SEI,TIA,RUNE' },
  'Mining': { ids: 'kaspa', tickers: 'KAS' },
};

const CG = 'https://api.coingecko.com/api/v3';

/* ═══ FETCH FUNCTIONS ═══ */

async function fetchSectorMomentum() {
  const cached = _c.get('sector_mom');
  if (cached && Date.now() - cached.t < 5 * 60 * 1000) return cached.d;

  const results = [];
  const fetches = SECTOR_ETFS.map(async ({ sector, sym }) => {
    try {
      const r = await fetch(`/yf/v8/finance/chart/${sym}?range=1mo&interval=1d`);
      if (!r.ok) return null;
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res) return null;
      const meta = res.meta;
      const closes = (res.indicators?.quote?.[0]?.close || []).filter(c => c != null);
      if (closes.length < 2) return null;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      return {
        sector, sym, price,
        day1: ((price - prevClose) / prevClose) * 100,
        week1: closes.length >= 5 ? ((price - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : null,
        month1: ((price - closes[0]) / closes[0]) * 100,
      };
    } catch { return null; }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  }
  results.sort((a, b) => (b.month1 || 0) - (a.month1 || 0));
  _c.set('sector_mom', { d: results, t: Date.now() });
  return results;
}

// Fetch stock data for a sector's tickers using v8
async function fetchSectorStocks(tickers) {
  const results = [];
  for (let i = 0; i < tickers.length; i += 6) {
    const batch = tickers.slice(i, i + 6);
    const fetches = batch.map(async (tk) => {
      try {
        const r = await fetch(`/yf/v8/finance/chart/${tk}?range=6mo&interval=1d`);
        if (!r.ok) return null;
        const j = await r.json();
        const res = j?.chart?.result?.[0];
        if (!res) return null;
        const meta = res.meta;
        const closes = (res.indicators?.quote?.[0]?.close || []).filter(c => c != null);
        const volumes = (res.indicators?.quote?.[0]?.volume || []).filter(v => v != null);
        const price = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose || meta.previousClose || price;
        const ch = prev > 0 ? ((price - prev) / prev) * 100 : 0;

        // Quick technical analysis
        const rsi = closes.length > 14 ? calcQuickRSI(closes) : null;
        const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
        const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
        const mom30 = closes.length >= 31 ? ((price - closes[closes.length - 31]) / closes[closes.length - 31]) * 100 : null;
        const avgVol = volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
        const rvol = avgVol && volumes.length > 0 ? volumes[volumes.length - 1] / avgVol : null;

        // Mini APEX score
        let score = 0;
        if (rsi != null) { if (rsi < 30) score += 3; else if (rsi < 40) score += 2; else if (rsi > 70) score -= 2; }
        if (sma20 && sma50 && price > sma20 && sma20 > sma50) score += 2;
        else if (sma20 && sma50 && price < sma20 && sma20 < sma50) score -= 1;
        if (mom30 != null) { if (mom30 > 10) score += 2; else if (mom30 > 3) score += 1; else if (mom30 < -10) score -= 1; }
        if (rvol && rvol > 1.5 && rvol < 3) score += 1;

        let signal = 'HOLD';
        if (score >= 5) signal = 'STRONG BUY';
        else if (score >= 3) signal = 'BUY';
        else if (score <= -2) signal = 'SELL';

        return {
          tk, nm: meta.shortName || meta.symbol || tk, pr: price, ch, tp: 'stock',
          vol: meta.regularMarketVolume || null, mc: null,
          rsi, score: Math.round(score * 10) / 10, signal, mom30, rvol,
          trend: sma20 && sma50 ? (price > sma20 && sma20 > sma50 ? 'UP' : price < sma20 && sma20 < sma50 ? 'DOWN' : 'FLAT') : null,
        };
      } catch { return null; }
    });
    const settled = await Promise.allSettled(fetches);
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
    if (i + 6 < tickers.length) await new Promise(r => setTimeout(r, 150));
  }
  return results;
}

function calcQuickRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
}

// Fetch crypto by category from CoinGecko
async function fetchCryptoCategory(catName, ids) {
  const cacheKey = 'crypto_' + catName;
  const cached = _c.get(cacheKey);
  if (cached && Date.now() - cached.t < 5 * 60 * 1000) return cached.d;

  try {
    const r = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d`);
    if (!r.ok) return [];
    const j = await r.json();
    const results = j.map(c => ({
      tk: c.symbol.toUpperCase(),
      nm: c.name,
      pr: c.current_price,
      ch: c.price_change_percentage_24h || 0,
      ch1h: c.price_change_percentage_1h_in_currency || null,
      ch7d: c.price_change_percentage_7d_in_currency || null,
      vol: c.total_volume,
      mc: c.market_cap,
      img: c.image,
      tp: 'crypto',
      cat: catName,
      rank: c.market_cap_rank,
    }));
    _c.set(cacheKey, { d: results, t: Date.now() });
    return results;
  } catch { return []; }
}

/* ═══ SIGNAL COLORS ═══ */
const sigColor = s => {
  if (s === 'STRONG BUY') return T.g.m;
  if (s === 'BUY') return '#34d399';
  if (s === 'HOLD') return T.w.m;
  if (s === 'SELL') return T.r.m;
  // Micro-cap setup types
  if (s === 'MOMENTUM') return '#3b82f6';
  if (s === 'INSIDER') return '#a78bfa';
  if (s === 'MULTI') return T.accent || '#22d3ee';
  return T.t.m;
};

const momColor = v => {
  if (v == null) return T.t.m;
  if (v > 3) return T.g.m;
  if (v > 0) return '#4ade80';
  if (v > -3) return '#f87171';
  return T.r.m;
};

const scoreColor = s => {
  if (s >= 70) return T.g.m;    // Tier A
  if (s >= 50) return '#34d399'; // Tier B
  if (s >= 30) return T.w.m;    // Tier C
  if (s >= 5) return T.g.m;     // legacy 0-10 scale
  if (s >= 3) return '#34d399';
  if (s >= 0) return T.w.m;
  return T.r.m;
};

const tierColor = t => {
  if (t === 'A') return T.g.m;
  if (t === 'B') return '#facc15';
  if (t === 'C') return T.t.m;
  return T.t.f;
};

/* ═══ SPOTLIGHT PANEL ═══ */
const SpotlightPanel = ({ item, mode }) => {
  if (!item) return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, textAlign: 'center',
    }}>
      <Crosshair size={28} color={T.t.f} style={{ marginBottom: 12, opacity: 0.4 }} />
      <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 4 }}>No selection</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>Click a row to inspect</div>
    </div>
  );

  const isStock = mode === 'Stocks';
  const isMicro = mode === 'Micro-Caps';
  const change = isMicro ? null : item.ch;
  const changeColor = change != null ? pc(change) : T.t.f;

  return (
    <div style={{ padding: '14px 12px', animation: 'slideIn 0.22s cubic-bezier(0.22,1,0.36,1)', fontFamily: mono }}>
      {/* Ticker + Price */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {!isStock && !isMicro && item.img && <img src={item.img} alt="" style={{ width: 20, height: 20, borderRadius: 3 }} />}
          <span
            style={{ fontSize: 20, fontWeight: 800, color: T.t.p, cursor: 'pointer', letterSpacing: 0.5 }}
            title="Click to copy"
            onClick={() => { navigator.clipboard.writeText(isMicro ? item.ticker : item.tk); }}
          >{isMicro ? item.ticker : item.tk}</span>
          {isMicro && item.tier && (
            <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 3, background: tierColor(item.tier) + '20', color: tierColor(item.tier) }}>
              TIER {item.tier}
            </span>
          )}
        </div>
        {!isMicro && <div style={{ fontSize: 9, color: T.t.m, marginBottom: 8 }}>{item.nm}</div>}
        {isMicro && item.sector && <div style={{ fontSize: 9, color: T.t.m, marginBottom: 8 }}>{item.sector} · {item.dataAsOf || '—'}</div>}
        <Morph value={D(isMicro ? item.price : item.pr)} style={{ fontSize: 22, fontWeight: 700, color: T.t.p, lineHeight: 1 }} />
        {change != null && (
          <div style={{ marginTop: 4 }}>
            <Morph value={pct(change)} style={{ fontSize: 13, fontWeight: 600, color: changeColor }} />
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.b.s, margin: '8px 0 12px' }} />

      {isMicro ? (
        <>
          {/* Setup + Net Score */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge color={sigColor(item.setup)} style={{ fontSize: 9 }}>{item.setup}</Badge>
            <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(item.netScore) }}>{item.netScore}</span>
          </div>

          {/* Reliability bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8 }}>Reliability</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: item.reliabilityScore >= 50 ? T.t.s : T.r.m }}>{item.reliabilityScore}/100</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: T.bg.el, overflow: 'hidden' }}>
              <div style={{ width: `${item.reliabilityScore}%`, height: '100%', borderRadius: 3, background: item.reliabilityScore >= 60 ? T.g.m : item.reliabilityScore >= 50 ? '#facc15' : T.r.m, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Sleeves + Penalties Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['Mkt Cap', item.marketCap ? fmt(item.marketCap) : '—', T.t.s],
              ['Volume', item.volume ? fmt(item.volume) : '—', T.a?.blue || '#3b82f6'],
              ['Momentum', item.momentumSleeve != null ? (item.momentumSleeve * 100).toFixed(0) + '%' : '—', item.momentumSleeve > 0.5 ? T.g.m : T.t.m],
              ['Insider', item.insiderSleeve != null ? (item.insiderSleeve * 100).toFixed(0) + '%' : '—', item.insiderSleeve > 0.5 ? '#a78bfa' : T.t.m],
              ['Supply Pen.', item.supplyPenalty != null ? '-' + (item.supplyPenalty * 100).toFixed(0) + '%' : '—', item.supplyPenalty > 0.1 ? T.r.m : T.t.f],
              ['Cost Pen.', item.costPenalty != null ? '-' + (item.costPenalty * 100).toFixed(0) + '%' : '—', item.costPenalty > 0.1 ? T.r.m : T.t.f],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: '6px 8px', background: T.bg.deep, borderRadius: 3, borderLeft: `2px solid ${color}30` }}>
                <div style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Reasons */}
          {item.reasons?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7, color: T.g.m, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Why it scored</div>
              {item.reasons.map((r, ri) => (
                <div key={ri} style={{ fontSize: 9, color: T.t.s, lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${T.g.m}20`, marginBottom: 3 }}>{r}</div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {item.warnings?.length > 0 && (
            <div>
              <div style={{ fontSize: 7, color: T.r.m, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Warnings</div>
              {item.warnings.map((w, wi) => (
                <div key={wi} style={{ fontSize: 9, color: T.r.m + 'cc', lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${T.r.m}20`, marginBottom: 3 }}>{w}</div>
              ))}
            </div>
          )}
        </>
      ) : isStock ? (
        <>
          {/* Signal */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge color={sigColor(item.signal)} style={{ fontSize: 9 }}>{item.signal}</Badge>
            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(item.score) }}>Score {item.score}</span>
          </div>

          {/* Technicals Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['RSI', item.rsi?.toFixed(0) ?? '—', item.rsi != null ? (item.rsi < 30 ? T.g.m : item.rsi > 70 ? T.r.m : T.t.s) : T.t.f],
              ['Trend', item.trend || '—', item.trend === 'UP' ? T.g.m : item.trend === 'DOWN' ? T.r.m : T.t.m],
              ['30d Mom', item.mom30 != null ? pct(item.mom30) : '—', item.mom30 != null ? (item.mom30 > 0 ? T.g.m : T.r.m) : T.t.f],
              ['RVOL', item.rvol != null ? item.rvol.toFixed(1) + 'x' : '—', item.rvol != null ? (item.rvol > 1.5 ? T.g.m : T.t.s) : T.t.f],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: '6px 8px', background: T.bg.deep, borderRadius: 3, borderLeft: `2px solid ${color}30` }}>
                <div style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* RSI Zone */}
          {item.rsi != null && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>RSI Zone</div>
              <div style={{ height: 4, borderRadius: 2, background: T.bg.el, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: `${Math.min(item.rsi, 100)}%`, top: -3,
                  width: 10, height: 10, borderRadius: '50%',
                  background: item.rsi < 30 ? T.g.m : item.rsi > 70 ? T.r.m : T.t.s,
                  border: `2px solid ${T.bg.deep}`, transform: 'translateX(-50%)',
                  transition: 'left 0.3s ease',
                }} />
                {/* Zone markers */}
                <div style={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: 1, background: T.g.m + '30' }} />
                <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 1, background: T.r.m + '30' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 7, color: T.g.m }}>Oversold</span>
                <span style={{ fontSize: 7, color: T.t.f }}>Neutral</span>
                <span style={{ fontSize: 7, color: T.r.m }}>Overbought</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Crypto details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['1h', item.ch1h != null ? pct(item.ch1h) : '—', item.ch1h != null ? pc(item.ch1h) : T.t.f],
              ['7d', item.ch7d != null ? pct(item.ch7d) : '—', item.ch7d != null ? pc(item.ch7d) : T.t.f],
              ['Volume', item.vol ? fmt(item.vol) : '—', T.a.blue],
              ['Mkt Cap', item.mc ? fmt(item.mc) : '—', T.t.s],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: '6px 8px', background: T.bg.deep, borderRadius: 3, borderLeft: `2px solid ${color}30` }}>
                <div style={{ fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {item.rank && (
            <div style={{ marginTop: 10, padding: '6px 8px', background: T.bg.deep, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: T.t.f, textTransform: 'uppercase' }}>CMC Rank</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>#{item.rank}</span>
            </div>
          )}

          {item.cat && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
              <Badge color={T.ion || T.accent2} style={{ fontSize: 8 }}>{item.cat}</Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ═══ MAIN COMPONENT ═══ */
const Scanner = ({ toast }) => {
  const [mode, setMode] = useState("Stocks");
  const [sectors, setSectors] = useState([]);
  const [activeSector, setActiveSector] = useState(null); // null = auto (hottest)
  const [stockData, setStockData] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [cryptoCat, setCryptoCat] = useState('All');
  const [cryptoData, setCryptoData] = useState([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [microCapData, setMicroCapData] = useState([]);
  const [microCapLoading, setMicroCapLoading] = useState(false);
  const [microCapError, setMicroCapError] = useState(null);
  const [microCapFetchedAt, setMicroCapFetchedAt] = useState(null);
  const [microCapCacheTs, setMicroCapCacheTs] = useState(null);
  const [microCapFilter, setMicroCapFilter] = useState('All');
  const [tab, setTab] = useState("All");
  const [spotlight, setSpotlight] = useState(null);
  const [spotIdx, setSpotIdx] = useState(-1);
  const tableRef = useRef(null);

  // Load sector momentum on mount
  useEffect(() => {
    fetchSectorMomentum().then(s => {
      setSectors(s);
      // Auto-select hottest sector
      if (s.length > 0 && !activeSector) setActiveSector(s[0].sector);
    });
  }, []);

  // Load stocks when sector changes
  useEffect(() => {
    if (mode !== 'Stocks' || !activeSector) return;
    const sectorDef = SECTOR_ETFS.find(s => s.sector === activeSector);
    if (!sectorDef) return;

    const cacheKey = 'sector_stocks_' + activeSector;
    const cached = _c.get(cacheKey);
    if (cached && Date.now() - cached.t < 5 * 60 * 1000) {
      setStockData(cached.d);
      return;
    }

    setStockLoading(true);
    fetchSectorStocks(sectorDef.tickers).then(data => {
      data.sort((a, b) => (b.score || 0) - (a.score || 0));
      _c.set(cacheKey, { d: data, t: Date.now() });
      setStockData(data);
      setStockLoading(false);
    });
  }, [activeSector, mode]);

  // Load crypto
  useEffect(() => {
    if (mode !== 'Crypto') return;
    setCryptoLoading(true);

    if (cryptoCat === 'All') {
      // Fetch all categories
      const allIds = Object.values(CRYPTO_CATEGORIES).map(c => c.ids).join(',');
      fetchCryptoCategory('All', allIds).then(data => {
        setCryptoData(data);
        setCryptoLoading(false);
      });
    } else {
      const cat = CRYPTO_CATEGORIES[cryptoCat];
      if (cat) {
        fetchCryptoCategory(cryptoCat, cat.ids).then(data => {
          setCryptoData(data);
          setCryptoLoading(false);
        });
      }
    }
  }, [cryptoCat, mode]);

  // Load micro-cap data
  useEffect(() => {
    if (mode !== 'Micro-Caps') return;
    // Don't refetch if already loaded and less than 1 hour old
    if (microCapData.length > 0 && microCapFetchedAt && Date.now() - microCapFetchedAt < 60 * 60 * 1000) return;

    setMicroCapLoading(true);
    setMicroCapError(null);
    fetch('/data/microcap_cache.json')
      .then(r => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then(data => {
        const rows = Array.isArray(data) ? data : (data.stocks || data.rows || data.data || []);
        const ts = data.scannedAt || data.generated_at || data.timestamp || null;
        setMicroCapData(rows);
        setMicroCapFetchedAt(Date.now());
        setMicroCapCacheTs(ts ? new Date(ts).getTime() : null);
        setMicroCapLoading(false);
      })
      .catch(() => {
        setMicroCapError('not_found');
        setMicroCapData([]);
        setMicroCapLoading(false);
      });
  }, [mode, microCapData.length, microCapFetchedAt]);

  // Top 5 high-conviction picks from current sector
  const top5 = useMemo(() => stockData.filter(s => s.score >= 3).slice(0, 5), [stockData]);

  const filteredStocks = tab === 'All' ? stockData : tab === 'Gainers' ? stockData.filter(s => s.ch > 0) : stockData.filter(s => s.ch < 0);
  const filteredCrypto = tab === 'All' ? cryptoData : tab === 'Gainers' ? cryptoData.filter(s => s.ch > 0) : cryptoData.filter(s => s.ch < 0);

  const filteredMicroCaps = useMemo(() => {
    let rows = microCapData;
    if (microCapFilter === 'Top 20') rows = [...rows].sort((a, b) => (b.netScore || 0) - (a.netScore || 0)).slice(0, 20);
    else if (microCapFilter === 'Tier A') rows = rows.filter(s => s.tier === 'A');
    else if (microCapFilter === '> $5M Cap') rows = rows.filter(s => (s.marketCap || 0) > 5_000_000);
    return rows;
  }, [microCapData, microCapFilter]);

  const microCapStaleHours = useMemo(() => {
    if (!microCapCacheTs) return null;
    const hours = Math.round((Date.now() - microCapCacheTs) / (1000 * 60 * 60));
    return hours > 24 ? hours : null;
  }, [microCapCacheTs]);

  const refresh = () => {
    _c.delete('sector_mom');
    if (activeSector) _c.delete('sector_stocks_' + activeSector);
    Object.keys(CRYPTO_CATEGORIES).forEach(k => _c.delete('crypto_' + k));
    _c.delete('crypto_All');
    fetchSectorMomentum().then(setSectors);
    if (mode === 'Micro-Caps') {
      setMicroCapFetchedAt(null);
      setMicroCapData([]);
      setMicroCapError(null);
    }
    if (mode === 'Stocks' && activeSector) {
      const sectorDef = SECTOR_ETFS.find(s => s.sector === activeSector);
      if (sectorDef) {
        setStockLoading(true);
        fetchSectorStocks(sectorDef.tickers).then(data => {
          data.sort((a, b) => (b.score || 0) - (a.score || 0));
          setStockData(data);
          setStockLoading(false);
        });
      }
    }
  };

  // Clear spotlight when switching modes
  useEffect(() => { setSpotlight(null); setSpotIdx(-1); }, [mode, activeSector, cryptoCat, microCapFilter]);

  // J/K keyboard navigation
  useEffect(() => {
    const list = mode === 'Stocks' ? filteredStocks : mode === 'Micro-Caps' ? filteredMicroCaps : filteredCrypto;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSpotIdx(prev => {
          const next = Math.min(prev + 1, list.length - 1);
          if (list[next]) setSpotlight(list[next]);
          // Scroll row into view
          const rows = tableRef.current?.querySelectorAll('.scanner-row');
          rows?.[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSpotIdx(prev => {
          const next = Math.max(prev - 1, 0);
          if (list[next]) setSpotlight(list[next]);
          const rows = tableRef.current?.querySelectorAll('.scanner-row');
          rows?.[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Escape') {
        setSpotlight(null);
        setSpotIdx(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, filteredStocks, filteredCrypto, filteredMicroCaps]);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 80px)' }}>
      {/* ═══ LEFT: Data Grid (70%) ═══ */}
      <div style={{ flex: '1 1 70%', minWidth: 0, overflow: 'auto', paddingRight: spotlight ? 0 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: T.rad.md,
          background: T.accent + '12', border: `1px solid ${T.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Crosshair size={16} color={T.accent} />
        </div>
        <div>
          <div style={{ fontSize: 34, fontFamily: display, fontWeight: 600, color: T.t.p, lineHeight: 0.88, letterSpacing: '0.04em' }}>Market Scanner</div>
          <div style={{ fontSize: 8, color: T.t.m, fontFamily: mono, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 5 }}>Momentum, crypto, and micro-cap setups</div>
        </div>
      </div>

      {/* Sector Momentum Heatmap — clickable */}
      {sectors.length > 0 && (
        <Card style={{ marginBottom: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 7, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
            SECTOR MOMENTUM — click to scan
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {sectors.map(s => {
              const isActive = activeSector === s.sector;
              return (
                <button key={s.sym} onClick={() => { setActiveSector(s.sector); setMode('Stocks'); }} style={{
                  padding: '4px 6px', borderRadius: 2, cursor: 'pointer',
                  background: isActive ? T.accent + '20' : momColor(s.month1) + '10',
                  border: `1px solid ${isActive ? T.accent : momColor(s.month1) + '30'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 75,
                }}>
                  <span style={{ fontSize: 7, color: isActive ? T.accent : T.t.m, fontFamily: mono, textTransform: 'uppercase', fontWeight: isActive ? 700 : 400 }}>{s.sector}</span>
                  <div style={{ display: 'flex', gap: 6, fontFamily: mono, fontSize: 8 }}>
                    <span style={{ color: momColor(s.day1) }}>{pct(s.day1)}</span>
                    <span style={{ color: momColor(s.week1), fontWeight: 600 }}>{pct(s.week1)}</span>
                    <span style={{ color: momColor(s.month1), fontWeight: 700 }}>{pct(s.month1)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mode + Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <TabBar tabs={["Stocks", "Crypto", "Micro-Caps"]} active={mode} set={setMode} />
          <div style={{ width: 12 }} />
          {mode === 'Crypto' && (
            <TabBar tabs={['All', ...Object.keys(CRYPTO_CATEGORIES)]} active={cryptoCat} set={setCryptoCat} />
          )}
          {mode === 'Stocks' && (
            <TabBar tabs={["All", "Gainers", "Losers"]} active={tab} set={setTab} />
          )}
          {mode === 'Micro-Caps' && (
            <TabBar tabs={['All', 'Top 20', 'Tier A', '> $5M Cap']} active={microCapFilter} set={setMicroCapFilter} />
          )}
        </div>
        <button onClick={refresh} aria-label="Refresh scanner" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 8px', borderRadius: 2, border: `1px solid ${T.b.s}`,
          background: 'transparent', color: T.t.s, cursor: 'pointer',
          fontFamily: mono, fontSize: 8, fontWeight: 600, textTransform: 'uppercase',
        }}>
          <RefreshCw size={9} /> Refresh
        </button>
      </div>

      {/* ═══ STOCKS MODE ═══ */}
      {mode === 'Stocks' && (
        <>
          {/* Top 5 High Conviction */}
          {top5.length > 0 && !stockLoading && (
            <Card style={{ marginBottom: 8, padding: '6px 8px', borderLeft: `2px solid ${T.accent}` }}>
              <div style={{ fontSize: 7, color: T.accent, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
                <Star size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                TOP {top5.length} IN {activeSector?.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {top5.map(s => (
                  <div key={s.tk} style={{
                    padding: '5px 8px', borderRadius: 2, background: T.bg.deep,
                    border: `1px solid ${sigColor(s.signal)}30`,
                    display: 'flex', alignItems: 'center', gap: 8, minWidth: 160,
                  }}>
                    <div>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{s.tk}</span>
                      <span style={{ fontSize: 8, color: T.t.m, marginLeft: 4 }}>{s.nm?.substring(0, 20)}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: sigColor(s.signal) }}>{s.signal}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m }}>Score {s.score}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Stock Table */}
          <Card style={{ padding: 0 }}>
            {stockLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: 'middle' }} />
                Scanning {activeSector}...
              </div>
            ) : filteredStocks.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>No stocks found</div>
            ) : (
              <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.b.s}`, position: 'sticky', top: 0, background: T.bg.card, zIndex: 1 }}>
                      {['#', 'Ticker', 'Price', 'Change', 'Score', 'Signal', 'RSI', 'Trend', '30d Mom', 'RVOL'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Ticker' ? 'left' : 'right', color: T.t.m, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map((s, i) => (
                      <tr key={s.tk} onClick={() => { setSpotlight(s); setSpotIdx(i); }} className="scanner-row" style={{
                        borderBottom: `1px solid ${T.b.s}10`, cursor: 'pointer',
                        background: spotlight?.tk === s.tk ? T.accent + '08' : 'transparent',
                        borderLeft: spotlight?.tk === s.tk ? `2px solid ${T.accent}` : '2px solid transparent',
                        transition: T.tr.ceramic || T.tr.fast,
                      }}>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.f }}>{i + 1}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'left' }}>
                          <span style={{ fontWeight: 700, color: T.t.p }}>{s.tk}</span>
                          <span style={{ fontSize: 8, color: T.t.m, marginLeft: 4 }}>{s.nm?.substring(0, 18)}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{D(s.pr)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: pc(s.ch), fontWeight: 600 }}>{pct(s.ch)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <span style={{ padding: '1px 5px', borderRadius: 1, background: scoreColor(s.score) + '15', color: scoreColor(s.score), fontWeight: 700, fontSize: 9 }}>{s.score}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <Badge color={sigColor(s.signal)} style={{ fontSize: 7 }}>{s.signal}</Badge>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: s.rsi != null ? (s.rsi < 30 ? T.g.m : s.rsi > 70 ? T.r.m : T.t.s) : T.t.f }}>{s.rsi?.toFixed(0) ?? '—'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: s.trend === 'UP' ? T.g.m : s.trend === 'DOWN' ? T.r.m : T.t.m, fontWeight: 600 }}>{s.trend || '—'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: s.mom30 != null ? (s.mom30 > 0 ? T.g.m : T.r.m) : T.t.f }}>{pct(s.mom30)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: s.rvol != null ? (s.rvol > 1.5 ? T.g.m : T.t.s) : T.t.f }}>{s.rvol?.toFixed(1) ?? '—'}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══ CRYPTO MODE ═══ */}
      {mode === 'Crypto' && (
        <Card style={{ padding: 0 }}>
          {cryptoLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>
              <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: 'middle' }} />
              Loading {cryptoCat} crypto...
            </div>
          ) : filteredCrypto.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>No crypto found</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.b.s}`, position: 'sticky', top: 0, background: T.bg.card, zIndex: 1 }}>
                    {['#', 'Asset', 'Price', '24h', '7d', 'Volume', 'Mkt Cap', 'Category'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Asset' ? 'left' : 'right', color: T.t.m, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCrypto.map((c, i) => (
                    <tr key={c.tk + i} onClick={() => { setSpotlight(c); setSpotIdx(i); }} className="scanner-row" style={{
                      borderBottom: `1px solid ${T.b.s}10`, cursor: 'pointer',
                      background: spotlight?.tk === c.tk ? T.accent + '08' : 'transparent',
                      borderLeft: spotlight?.tk === c.tk ? `2px solid ${T.accent}` : '2px solid transparent',
                      transition: T.tr.ceramic || T.tr.fast,
                    }}>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.f }}>{c.rank || i + 1}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {c.img && <img src={c.img} alt="" style={{ width: 14, height: 14, borderRadius: 2 }} />}
                          <span style={{ fontWeight: 700, color: T.t.p }}>{c.tk}</span>
                          <span style={{ fontSize: 8, color: T.t.m }}>{c.nm}</span>
                        </div>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{D(c.pr)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: pc(c.ch), fontWeight: 600 }}>{pct(c.ch)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: c.ch7d != null ? pc(c.ch7d) : T.t.f }}>{c.ch7d != null ? pct(c.ch7d) : '—'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.s }}>{c.vol ? fmt(c.vol) : '—'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.s }}>{c.mc ? fmt(c.mc) : '—'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 7, color: T.t.m, background: T.bg.el, padding: '1px 4px', borderRadius: 1 }}>{c.cat || cryptoCat}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ═══ MICRO-CAPS MODE ═══ */}
      {mode === 'Micro-Caps' && (
        <>
          {/* Stale data warning */}
          {microCapStaleHours && (
            <div style={{ marginBottom: 8, padding: '6px 10px', background: '#facc1520', border: '1px solid #facc1540', borderRadius: 3, fontFamily: mono, fontSize: 9, color: '#facc15', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={10} /> Data is {microCapStaleHours} hours old
            </div>
          )}

          <Card style={{ padding: 0 }}>
            {microCapLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: 'middle' }} />
                Loading micro-caps...
              </div>
            ) : microCapError === 'not_found' ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>
                No micro-cap data. Run <code style={{ background: T.bg.deep, padding: '2px 6px', borderRadius: 2, color: T.t.s }}>node scripts/microcap-scanner.mjs</code> to generate.
              </div>
            ) : filteredMicroCaps.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.t.m, fontFamily: mono, fontSize: 10 }}>No micro-caps match filter</div>
            ) : (
              <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.b.s}`, position: 'sticky', top: 0, background: T.bg.card, zIndex: 1 }}>
                      {['#', 'Ticker', 'Price', 'Tier', 'Net Score', 'Setup', 'Reliability', 'Mkt Cap', 'Volume', 'Sector'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Ticker' || h === 'Sector' ? 'left' : 'right', color: T.t.m, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMicroCaps.map((s, i) => (
                      <tr key={s.ticker} onClick={() => { setSpotlight(s); setSpotIdx(i); }} className="scanner-row" style={{
                        borderBottom: `1px solid ${T.b.s}10`, cursor: 'pointer',
                        background: spotlight?.ticker === s.ticker ? T.accent + '08' : 'transparent',
                        borderLeft: spotlight?.ticker === s.ticker ? `2px solid ${T.accent}` : '2px solid transparent',
                        transition: T.tr.ceramic || T.tr.fast,
                      }}>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.f }}>{i + 1}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'left' }}>
                          <span style={{ fontWeight: 700, color: T.t.p }}>{s.ticker}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{D(s.price)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <span style={{ padding: '1px 6px', borderRadius: 2, background: tierColor(s.tier) + '18', color: tierColor(s.tier), fontWeight: 800, fontSize: 10 }}>{s.tier}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <span style={{ padding: '1px 5px', borderRadius: 1, background: scoreColor(s.netScore) + '15', color: scoreColor(s.netScore), fontWeight: 700, fontSize: 9 }}>{s.netScore}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <Badge color={sigColor(s.setup)} style={{ fontSize: 7 }}>{s.setup}</Badge>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <span style={{ fontSize: 9, color: s.reliabilityScore >= 50 ? T.t.s : T.r.m, fontWeight: 600 }}>{s.reliabilityScore}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.s }}>{s.marketCap ? fmt(s.marketCap) : '—'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: T.t.s }}>{s.volume ? fmt(s.volume) : '—'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'left' }}>
                          <span style={{ fontSize: 7, color: T.t.m, background: T.bg.el, padding: '1px 4px', borderRadius: 1 }}>{s.sector || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(12px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .scanner-row:hover { background: ${T.bg.hover} !important; }
        .scanner-row:hover td:first-child::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: ${T.accent}60; }
      `}</style>
      </div>

      {/* ═══ RIGHT: Spotlight Panel (30%) ═══ */}
      <div style={{
        width: 284, flexShrink: 0,
        borderLeft: `1px solid ${T.b.s}`,
        background: T.fx.panel,
        overflow: 'auto',
        borderRadius: `0 ${T.rad.lg}px ${T.rad.lg}px 0`,
        boxShadow: "inset 1px 0 0 rgba(255,255,255,0.03)",
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: `1px solid ${T.b.s}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 22, color: T.t.p, lineHeight: 0.9 }}>Spotlight</div>
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.16 + 'em', marginTop: 4 }}>Context panel</div>
          </div>
          {spotlight && (
            <button onClick={() => setSpotlight(null)} aria-label="Close spotlight" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: T.t.f, padding: 2,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>&times;</span>
            </button>
          )}
        </div>
        <SpotlightPanel item={spotlight} mode={mode} />
      </div>
    </div>
  );
};

export default Scanner;
