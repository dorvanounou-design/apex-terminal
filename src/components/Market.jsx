// src/components/Market.jsx — Live Market Overview with real data
import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { T, mono, display, pc, pct, fmt } from "../theme/tokens";
import { fetchLiveIndices, _c } from "../api/finance";
import { Card } from "./ui/Shared";

const CG = "https://api.coingecko.com/api/v3";

// Fetch real Fear & Greed from Alternative.me (free, no key)
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

// Fetch real crypto global data from CoinGecko
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

// Fetch ETH gas from CoinGecko simple price (includes gas estimate via proxy)
async function fetchEthGas() {
  // Use a simple heuristic — no free gas API without key
  // We'll show ETH price change as proxy for network activity
  return null;
}

const MarketMod = () => {
  const [idx, setIdx] = useState([]);
  const [ld, setLd] = useState(true);
  const [fg, setFg] = useState(null);
  const [global, setGlobal] = useState(null);

  useEffect(() => {
    (async () => {
      const [d, fgData, globalData] = await Promise.all([
        fetchLiveIndices(),
        fetchFearGreed(),
        fetchCryptoGlobal(),
      ]);
      setIdx(d);
      setFg(fgData);
      setGlobal(globalData);
      setLd(false);
    })();
  }, []);

  const FG = ({ v, l, classification }) => {
    const c = v >= 75 ? T.g.m : v >= 55 ? '#34d399' : v >= 45 ? T.w.m : v >= 25 ? '#f87171' : T.r.m;
    const lb = classification || (v >= 75 ? "Extreme Greed" : v >= 55 ? "Greed" : v >= 45 ? "Neutral" : v >= 25 ? "Fear" : "Extreme Fear");
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ position: "relative", width: 70, height: 70, margin: "0 auto 6px" }}>
          <svg width={70} height={70} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={35} cy={35} r={28} fill="none" stroke={T.bg.deep} strokeWidth={5} />
            <circle cx={35} cy={35} r={28} fill="none" stroke={c} strokeWidth={5}
              strokeDasharray={`${(v / 100) * 176} 176`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
        </div>
        <div style={{ fontSize: 10, color: c, fontWeight: 600 }}>{lb}</div>
        <div style={{ fontSize: 9, color: T.t.m }}>{l}</div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Globe size={16} color={T.accent} />
        <div>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 600, color: T.t1, lineHeight: 1 }}>Market Overview</div>
          <div style={{ fontFamily: mono, fontSize: 7, color: T.t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>Live data • indices + crypto global</div>
        </div>
      </div>

      {ld ? <div style={{ textAlign: "center", padding: 40, color: T.t.m, fontFamily: mono, fontSize: 10 }}>Loading market data...</div> : <>
        {/* Index tickers */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
          {idx.map(i => (
            <div key={i.n} style={{ minWidth: 120, padding: "8px 12px", borderRadius: 2, background: T.bg.card, border: `1px solid ${T.b1}`, flexShrink: 0 }}>
              <div style={{ fontSize: 8, color: T.t3, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 0.5 }}>{i.n}</div>
              <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: T.t1 }}>
                {i.p >= 1000 ? i.p.toLocaleString("en", { maximumFractionDigits: 0 }) : i.p?.toFixed(2)}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: pc(i.c), marginTop: 2 }}>
                {i.c >= 0 ? "+" : ""}{pct(i.c)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
          {/* Sentiment — REAL data */}
          <Card style={{ padding: 14 }}>
            <div style={{ fontFamily: display, fontSize: 14, color: T.t1, marginBottom: 14 }}>Crypto Sentiment</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {fg ? (
                <FG v={fg.value} l="Fear & Greed Index" classification={fg.classification} />
              ) : (
                <div style={{ fontFamily: mono, fontSize: 10, color: T.t3, padding: 20 }}>Unavailable</div>
              )}
            </div>
            <div style={{ fontFamily: mono, fontSize: 7, color: T.t4, textAlign: 'center', marginTop: 8 }}>
              Source: alternative.me (crypto only)
              <br />Note: CMC uses a different index — values will differ
            </div>
          </Card>

          {/* Crypto Global Stats — REAL data */}
          <Card style={{ padding: 14 }}>
            <div style={{ fontFamily: display, fontSize: 14, color: T.t1, marginBottom: 12 }}>Crypto Global</div>
            {global ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ["Total Market Cap", "$" + fmt(global.totalMcap), T.t1],
                  ["24h Volume", "$" + fmt(global.totalVolume), T.a.blue],
                  ["BTC Dominance", global.btcDominance.toFixed(1) + "%", T.a.cyan],
                  ["ETH Dominance", global.ethDominance.toFixed(1) + "%", '#8b5cf6'],
                  ["MCap 24h Change", (global.mcapChange24h >= 0 ? "+" : "") + global.mcapChange24h.toFixed(2) + "%", pc(global.mcapChange24h)],
                  ["Active Cryptos", global.activeCryptos.toLocaleString(), T.t2],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: '3px 0', borderBottom: `1px solid ${T.b1}10` }}>
                    <span style={{ fontSize: 10, color: T.t3, fontFamily: mono }}>{l}</span>
                    <span style={{ fontSize: 10, fontFamily: mono, color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t3, padding: 20, textAlign: 'center' }}>Unavailable</div>
            )}
            <div style={{ fontFamily: mono, fontSize: 7, color: T.t4, marginTop: 8 }}>
              Source: CoinGecko • Live
            </div>
          </Card>
        </div>
      </>}
    </div>
  );
};

export default MarketMod;
