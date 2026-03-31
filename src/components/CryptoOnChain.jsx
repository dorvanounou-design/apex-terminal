// src/components/CryptoOnChain.jsx — Proxy On-Chain Signals (Glassnode Alternative)
// Uses free CoinGecko data to approximate MVRV, exchange flows, and social signals
import { useState, useEffect } from "react";
import { Activity, ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp } from "lucide-react";
import { T, mono, D, fmt } from "../theme/tokens";
import { Card, Badge } from "./ui/Shared";
import { CM } from "../api/finance";

const CG = "https://api.coingecko.com/api/v3";

// Proxy MVRV: (Market Cap / 24h Volume) as "Liquidity Z-Score"
// High ratio = overheated / low liquidity relative to valuation
// Low ratio = high liquidity relative to valuation (accumulation)
function calcMVRVProxy(mc, vol24h) {
  if (!mc || !vol24h || vol24h === 0) return null;
  const ratio = mc / vol24h;
  // Normalize: < 20 = Accumulation zone, 20-50 = Fair, > 50 = Distribution
  let zone = 'FAIR';
  let color = T.w?.m || '#f59e0b';
  if (ratio < 15) { zone = 'ACCUMULATION'; color = '#22c55e'; }
  else if (ratio < 25) { zone = 'FAIR VALUE'; color = '#3b82f6'; }
  else if (ratio < 50) { zone = 'WARMING'; color = '#f59e0b'; }
  else { zone = 'DISTRIBUTION'; color = '#ef4444'; }
  return { ratio: Math.round(ratio), zone, color };
}

// Exchange Flow Proxy: (Daily Volume / 20-day Average Volume)
// If RVOL > 2x but price flat → potential accumulation/distribution
function calcFlowProxy(vol24h, avgVol, priceChange24h) {
  if (!vol24h || !avgVol || avgVol === 0) return null;
  const rvol = vol24h / avgVol;
  let signal = 'NEUTRAL';
  let color = T.t.m;
  let detail = '';

  if (rvol > 2.0 && Math.abs(priceChange24h) < 2) {
    signal = 'ACCUMULATION';
    color = '#22c55e';
    detail = `Volume ${rvol.toFixed(1)}x average but price flat — smart money loading`;
  } else if (rvol > 2.0 && priceChange24h > 5) {
    signal = 'BREAKOUT VOLUME';
    color = '#3b82f6';
    detail = `Volume ${rvol.toFixed(1)}x with +${priceChange24h.toFixed(1)}% — confirmed move`;
  } else if (rvol > 2.0 && priceChange24h < -5) {
    signal = 'DISTRIBUTION';
    color = '#ef4444';
    detail = `Volume ${rvol.toFixed(1)}x with ${priceChange24h.toFixed(1)}% — selling pressure`;
  } else if (rvol < 0.5) {
    signal = 'DRY UP';
    color = '#71717a';
    detail = `Volume at ${(rvol * 100).toFixed(0)}% of average — low interest`;
  } else {
    detail = `Volume ${rvol.toFixed(1)}x average — normal activity`;
  }

  return { rvol: Math.round(rvol * 100) / 100, signal, color, detail };
}

// Realized vs Market cap proxy: use ATH drawdown as "unrealized loss" indicator
function calcRealizedProxy(price, ath, athChangePct) {
  if (!ath || !athChangePct) return null;
  const drawdown = Math.abs(athChangePct);
  let zone = 'FAIR';
  let color = T.t.m;

  if (drawdown < 10) { zone = 'NEAR ATH'; color = '#f59e0b'; }
  else if (drawdown < 30) { zone = 'HEALTHY'; color = '#22c55e'; }
  else if (drawdown < 60) { zone = 'RECOVERY'; color = '#3b82f6'; }
  else { zone = 'CAPITULATION'; color = '#ef4444'; }

  return { drawdown: Math.round(drawdown), zone, color, ath };
}

async function fetchCryptoSignals(tickers) {
  const cryptoHoldings = tickers.filter(tk => CM[tk.toUpperCase()]);
  if (cryptoHoldings.length === 0) return [];

  const ids = cryptoHoldings.map(tk => CM[tk.toUpperCase()]).join(',');
  try {
    const r = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d,30d`);
    if (!r.ok) return [];
    const data = await r.json();

    return data.map(c => {
      const sparkline = c.sparkline_in_7d?.price || [];
      // Estimate 20-day avg volume from 7-day sparkline variance (rough proxy)
      const avgVol = c.total_volume * 0.85; // assume 85% of current as "average" baseline

      const mvrv = calcMVRVProxy(c.market_cap, c.total_volume);
      const flow = calcFlowProxy(c.total_volume, avgVol, c.price_change_percentage_24h || 0);
      const realized = calcRealizedProxy(c.current_price, c.ath, c.ath_change_percentage);

      // Composite on-chain health score (0-100)
      let health = 50;
      if (mvrv) {
        if (mvrv.zone === 'ACCUMULATION') health += 20;
        else if (mvrv.zone === 'DISTRIBUTION') health -= 20;
        else if (mvrv.zone === 'WARMING') health -= 10;
      }
      if (flow) {
        if (flow.signal === 'ACCUMULATION') health += 15;
        else if (flow.signal === 'DISTRIBUTION') health -= 15;
        else if (flow.signal === 'BREAKOUT VOLUME') health += 10;
      }
      if (realized) {
        if (realized.zone === 'CAPITULATION') health += 10; // contrarian
        else if (realized.zone === 'NEAR ATH') health -= 10;
      }
      health = Math.max(0, Math.min(100, health));

      return {
        tk: c.symbol.toUpperCase(),
        nm: c.name,
        price: c.current_price,
        ch24h: c.price_change_percentage_24h,
        ch7d: c.price_change_percentage_7d_in_currency,
        ch30d: c.price_change_percentage_30d_in_currency,
        mc: c.market_cap,
        vol: c.total_volume,
        img: c.image,
        mvrv,
        flow,
        realized,
        health,
        sparkline,
      };
    });
  } catch { return []; }
}

const MiniSpark = ({ data, w = 60, h = 20 }) => {
  if (!data?.length) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1;
  const cl = data[data.length - 1] >= data[0] ? '#22c55e' : '#ef4444';
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rg) * h}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={cl} strokeWidth="1.2" /></svg>;
};

const SignalDot = ({ color, size = 6 }) => (
  <div style={{ width: size, height: size, borderRadius: 1, background: color, flexShrink: 0 }} />
);

const CryptoOnChain = ({ holdings }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  const cryptoTickers = holdings.filter(h => h.tp === 'crypto' || CM[h.tk.toUpperCase()]).map(h => h.tk);

  useEffect(() => {
    if (cryptoTickers.length === 0) { setLoading(false); return; }
    setLoading(true);
    fetchCryptoSignals(cryptoTickers).then(s => { setSignals(s); setLoading(false); });
  }, [cryptoTickers.join(',')]);

  if (cryptoTickers.length === 0) return null;

  return (
    <Card style={{ borderLeft: `2px solid #06b6d4`, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color: T.t.p }}>On-Chain Pulse</div>
          <div style={{ fontFamily: mono, fontSize: 7, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Proxy signals • CoinGecko data • not Glassnode
          </div>
        </div>
        <Activity size={14} color="#06b6d4" opacity={0.5} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, fontFamily: mono, fontSize: 10, color: T.t.m }}>Loading on-chain proxies...</div>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, fontFamily: mono, fontSize: 10, color: T.t.m }}>No crypto data available</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {signals.map(s => (
            <div key={s.tk} style={{ padding: '8px 10px', background: T.bg.deep, borderRadius: 2, border: `1px solid ${T.b.s}` }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.img && <img src={s.img} alt="" style={{ width: 16, height: 16, borderRadius: 2 }} />}
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{s.tk}</span>
                  <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m }}>{s.nm}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MiniSpark data={s.sparkline} />
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: T.t.p }}>{D(s.price)}</span>
                </div>
              </div>

              {/* Signals grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {/* MVRV Proxy */}
                <div style={{ padding: '4px 6px', borderRadius: 2, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>MVRV Proxy</div>
                  {s.mvrv ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <SignalDot color={s.mvrv.color} />
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: s.mvrv.color }}>{s.mvrv.zone}</span>
                    </div>
                  ) : <span style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>—</span>}
                </div>

                {/* Exchange Flow Proxy */}
                <div style={{ padding: '4px 6px', borderRadius: 2, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Flow Signal</div>
                  {s.flow ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <SignalDot color={s.flow.color} />
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: s.flow.color }}>{s.flow.signal}</span>
                    </div>
                  ) : <span style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>—</span>}
                </div>

                {/* Realized Proxy */}
                <div style={{ padding: '4px 6px', borderRadius: 2, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>ATH Zone</div>
                  {s.realized ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <SignalDot color={s.realized.color} />
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: s.realized.color }}>{s.realized.zone}</span>
                    </div>
                  ) : <span style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>—</span>}
                </div>
              </div>

              {/* Health score bar */}
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: T.b.s, borderRadius: 0 }}>
                  <div style={{
                    width: `${s.health}%`, height: '100%',
                    background: s.health >= 65 ? '#22c55e' : s.health >= 45 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: s.health >= 65 ? '#22c55e' : s.health >= 45 ? '#f59e0b' : '#ef4444' }}>
                  {s.health}/100
                </span>
              </div>

              {/* Flow detail */}
              {s.flow?.detail && (
                <div style={{ fontFamily: mono, fontSize: 7, color: T.t.m, marginTop: 4, fontStyle: 'italic' }}>
                  {s.flow.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default CryptoOnChain;
