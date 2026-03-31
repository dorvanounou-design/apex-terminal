// src/components/Market.jsx — Live Market Overview v2
import { useState, useEffect } from "react";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import { T, mono, pc, pct, fmt, D } from "../theme/tokens";
import { fetchLiveIndices, _c } from "../api/finance";
import { Card, Badge } from "./ui/Shared";

const CG = "https://api.coingecko.com/api/v3";

async function fetchFearGreed() {
  const cached = _c.get('fear_greed');
  if (cached && Date.now() - cached.t < 10 * 60 * 1000) return cached.d;
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!r.ok) return null;
    const j = await r.json();
    const d = j?.data?.[0];
    if (!d) return null;
    const result = { value: parseInt(d.value), classification: d.value_classification };
    _c.set('fear_greed', { d: result, t: Date.now() });
    return result;
  } catch { return null; }
}

async function fetchCryptoGlobal() {
  const cached = _c.get('crypto_global');
  if (cached && Date.now() - cached.t < 10 * 60 * 1000) return cached.d;
  try {
    const r = await fetch(`${CG}/global`);
    if (!r.ok) return null;
    const j = await r.json();
    const d = j?.data;
    if (!d) return null;
    const result = {
      totalMcap: d.total_market_cap?.usd || 0,
      btcDominance: d.market_cap_percentage?.btc || 0,
      ethDominance: d.market_cap_percentage?.eth || 0,
      totalVolume: d.total_volume?.usd || 0,
      activeCryptos: d.active_cryptocurrencies || 0,
      mcapChange24h: d.market_cap_change_percentage_24h_usd || 0,
    };
    _c.set('crypto_global', { d: result, t: Date.now() });
    return result;
  } catch { return null; }
}

const MarketMod = () => {
  const [idx, setIdx] = useState([]);
  const [ld, setLd] = useState(true);
  const [fg, setFg] = useState(null);
  const [global, setGlobal] = useState(null);

  useEffect(() => {
    (async () => {
      const [d, fgData, globalData] = await Promise.all([
        fetchLiveIndices(), fetchFearGreed(), fetchCryptoGlobal(),
      ]);
      setIdx(d); setFg(fgData); setGlobal(globalData); setLd(false);
    })();
  }, []);

  // Semicircle Fear & Greed gauge
  const FearGreedGauge = ({ value, classification }) => {
    const c = value >= 75 ? T.g.m : value >= 55 ? '#34d399' : value >= 45 ? T.w.m : value >= 25 ? '#f87171' : T.r.m;
    const label = classification || (value >= 75 ? "Extreme Greed" : value >= 55 ? "Greed" : value >= 45 ? "Neutral" : value >= 25 ? "Fear" : "Extreme Fear");
    const angle = (value / 100) * 180;
    const rad = 50;
    const cx = 60, cy = 58;
    // Arc endpoint
    const endAngle = Math.PI - (angle * Math.PI / 180);
    const endX = cx + rad * Math.cos(endAngle);
    const endY = cy - rad * Math.sin(endAngle);
    const largeArc = angle > 90 ? 1 : 0;

    return (
      <div style={{ textAlign: "center" }}>
        <svg width={120} height={76} viewBox="0 0 120 76">
          {/* Background arc */}
          <path d={`M ${cx - rad} ${cy} A ${rad} ${rad} 0 0 1 ${cx + rad} ${cy}`}
            fill="none" stroke={T.bg.deep} strokeWidth={8} strokeLinecap="round" />
          {/* Value arc */}
          <path d={`M ${cx - rad} ${cy} A ${rad} ${rad} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={c} strokeWidth={8} strokeLinecap="round"
            style={{ transition: 'all 0.6s ease' }} />
          {/* Needle dot */}
          <circle cx={endX} cy={endY} r={4} fill={c} stroke={T.bg.deep} strokeWidth={2} />
          {/* Labels */}
          <text x={cx - rad - 4} y={cy + 12} textAnchor="start" fill={T.t.f} fontSize={7} fontFamily="JetBrains Mono">0</text>
          <text x={cx + rad + 4} y={cy + 12} textAnchor="end" fill={T.t.f} fontSize={7} fontFamily="JetBrains Mono">100</text>
          {/* Center value */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill={c} fontSize={24} fontFamily="JetBrains Mono" fontWeight={700}>{value}</text>
        </svg>
        <div style={{ fontSize: 12, color: c, fontWeight: 700, marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: 9, color: T.t.m, marginTop: 2 }}>Fear & Greed Index</div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: T.rad.md,
          background: T.accent + '12', border: `1px solid ${T.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Globe size={18} color={T.accent} />
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 600, color: T.t.p, lineHeight: 1 }}>Market Overview</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>Live data &bull; indices + crypto global</div>
        </div>
      </div>

      {ld ? (
        <div style={{ textAlign: "center", padding: 50, color: T.t.m, fontFamily: mono, fontSize: 10 }}>
          <div style={{ animation: 'pulse 1.5s ease infinite' }}>Loading market data...</div>
        </div>
      ) : <>
        {/* Index tickers — horizontal scroll */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 6 }}>
          {idx.map(i => (
            <Card key={i.n} style={{
              minWidth: 140, padding: "10px 14px", flexShrink: 0,
              borderLeft: `3px solid ${i.c >= 0 ? T.g.m : T.r.m}20`,
            }}>
              <div style={{ fontSize: 9, color: T.t.m, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{i.n}</div>
              <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: T.t.p }}>
                {fmt(i.p)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                {i.c >= 0 ? <TrendingUp size={10} color={T.g.m} /> : <TrendingDown size={10} color={T.r.m} />}
                <span style={{ fontFamily: mono, fontSize: 12, color: pc(i.c), fontWeight: 600 }}>
                  {pct(i.c)}
                </span>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          {/* Sentiment */}
          <Card style={{ padding: 18 }}>
            <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, marginBottom: 16, fontWeight: 600 }}>Crypto Sentiment</div>
            <div style={{ display: "flex", justifyContent: "center", padding: '8px 0' }}>
              {fg ? (
                <FearGreedGauge value={fg.value} classification={fg.classification} />
              ) : (
                <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m, padding: 24 }}>Unavailable</div>
              )}
            </div>
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textAlign: 'center', marginTop: 12 }}>
              Source: alternative.me (crypto only)
            </div>
          </Card>

          {/* Crypto Global Stats */}
          <Card style={{ padding: 18 }}>
            <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, marginBottom: 14, fontWeight: 600 }}>Crypto Global</div>
            {global ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ["Total Market Cap", D(global.totalMcap), T.t.p],
                  ["24h Volume", D(global.totalVolume), T.a.blue],
                  ["BTC Dominance", pct(global.btcDominance).replace('+', ''), '#f7931a'],
                  ["ETH Dominance", pct(global.ethDominance).replace('+', ''), '#627eea'],
                  ["MCap 24h", pct(global.mcapChange24h), pc(global.mcapChange24h)],
                  ["Active Cryptos", global.activeCryptos.toLocaleString(), T.t.s],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${T.b.s}10` }}>
                    <span style={{ fontSize: 11, color: T.t.m, fontFamily: mono }}>{l}</span>
                    <span style={{ fontSize: 11, fontFamily: mono, color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                {/* Dominance bar */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ height: 6, borderRadius: 3, background: T.bg.deep, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${global.btcDominance}%`, height: '100%', background: '#f7931a', transition: 'width 0.5s' }} />
                    <div style={{ width: `${global.ethDominance}%`, height: '100%', background: '#627eea', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 8, color: '#f7931a', fontFamily: mono }}>BTC {global.btcDominance.toFixed(0)}%</span>
                    <span style={{ fontSize: 8, color: '#627eea', fontFamily: mono }}>ETH {global.ethDominance.toFixed(0)}%</span>
                    <span style={{ fontSize: 8, color: T.t.m, fontFamily: mono }}>Other {(100 - global.btcDominance - global.ethDominance).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m, padding: 24, textAlign: 'center' }}>Unavailable</div>
            )}
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, marginTop: 10 }}>
              Source: CoinGecko &bull; Live
            </div>
          </Card>
        </div>
      </>}
    </div>
  );
};

export default MarketMod;
