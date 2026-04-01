// src/components/Market.jsx — Live Market Overview v2
import { useState, useEffect } from "react";
import { Globe, TrendingUp, TrendingDown, ShieldAlert, Waves } from "lucide-react";
import { T, mono, display, pc, pct, fmt, D } from "../theme/tokens";
import { fetchLiveIndices, _c } from "../api/finance";
import { Card } from "./ui/Shared";

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

  const sentimentTone = (value, classification) => {
    if (value >= 75) return { color: T.g.m, label: classification || "Extreme Greed", action: "Momentum is hot. Great for leaders, dangerous for late entries." };
    if (value >= 55) return { color: "#34d399", label: classification || "Greed", action: "Risk appetite is healthy. Buy strength, but keep discipline." };
    if (value >= 45) return { color: T.w.m, label: classification || "Neutral", action: "Tape is balanced. Focus on stock-specific edges." };
    if (value >= 25) return { color: "#f87171", label: classification || "Fear", action: "Selective buying works better than broad chasing." };
    return { color: T.r.m, label: classification || "Extreme Fear", action: "Good for watchlists and staged entries, not blind aggression." };
  };

  const sentiment = fg ? sentimentTone(fg.value, fg.classification) : null;

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
          <div style={{ fontFamily: display, fontSize: 34, fontWeight: 600, color: T.t.p, lineHeight: 0.9, letterSpacing: '0.04em' }}>Market Overview</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.8, marginTop: 5 }}>Live data • indices + crypto global</div>
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
            <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, marginBottom: 14, fontWeight: 600 }}>Market Pulse</div>
            {fg && sentiment ? (
              <>
                <div style={{
                  padding: '12px 14px', borderRadius: T.rad.md, background: sentiment.color + '10',
                  border: `1px solid ${sentiment.color}2a`, marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: sentiment.color, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 5 }}>Sentiment regime</div>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: sentiment.color }}>{sentiment.label}</div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: sentiment.color }}>{fg.value}</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.t.s, lineHeight: 1.6, marginTop: 8 }}>{sentiment.action}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 10 }}>
                  {[
                    { label: 'Fear', min: 0, max: 24, color: T.r.m },
                    { label: 'Risk-off', min: 25, max: 44, color: '#f87171' },
                    { label: 'Neutral', min: 45, max: 54, color: T.w.m },
                    { label: 'Risk-on', min: 55, max: 74, color: '#34d399' },
                    { label: 'Heat', min: 75, max: 100, color: T.g.m },
                  ].map((band) => {
                    const active = fg.value >= band.min && fg.value <= band.max;
                    return (
                      <div key={band.label} style={{
                        padding: '6px 4px',
                        borderRadius: T.rad.sm,
                        background: active ? band.color + '16' : T.bg.deep,
                        border: `1px solid ${active ? band.color + '30' : T.b.s}`,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontFamily: mono, fontSize: 8, color: active ? band.color : T.t.f, fontWeight: 700 }}>{band.label}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m, padding: 24 }}>Unavailable</div>
            )}
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, marginTop: 4 }}>
              Source: alternative.me. Useful sentiment context, not trade-level crypto flow data.
            </div>
          </Card>

          {/* Crypto Global Stats */}
          <Card style={{ padding: 18 }}>
            <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, marginBottom: 14, fontWeight: 600 }}>Crypto Desk</div>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                  <div style={{ padding: '8px 9px', borderRadius: T.rad.sm, background: '#f7931a10', border: '1px solid #f7931a22' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: '#f7931a', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>BTC dominance</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: '#f7931a' }}>{global.btcDominance.toFixed(1)}%</div>
                  </div>
                  <div style={{ padding: '8px 9px', borderRadius: T.rad.sm, background: '#627eea10', border: '1px solid #627eea22' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: '#627eea', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>ETH dominance</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: '#627eea' }}>{global.ethDominance.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m, padding: 24, textAlign: 'center' }}>Unavailable</div>
            )}
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, marginTop: 10 }}>
              Source: CoinGecko. Good for market structure, not enough for true Glassnode-style on-chain intelligence.
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldAlert size={15} color={T.w.m} />
              <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, fontWeight: 600 }}>Crypto Data Coverage</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Current', 'CoinGecko + Alternative.me', T.a.blue],
                ['Good for', 'Price, market cap, volume, dominance, sentiment', T.g.m],
                ['Missing', 'Exchange balances, SOPR, MVRV, whale flows, entity-level on-chain signals', T.r.m],
              ].map(([label, value, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingBottom: 6, borderBottom: `1px solid ${T.b.s}10` }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.t.m }}>{label}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color, fontWeight: 600, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: T.rad.md,
              background: T.bg.deep, border: `1px solid ${T.b.s}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <Waves size={13} color={T.accent} />
                <span style={{ fontFamily: mono, fontSize: 9, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Why it feels thin</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t.s, lineHeight: 1.6 }}>
                Glassnode-style data is not in the app because that level of on-chain data comes from a dedicated keyed provider, not from the free market feeds this dashboard currently uses.
              </div>
            </div>
          </Card>
        </div>
      </>}
    </div>
  );
};

export default MarketMod;
