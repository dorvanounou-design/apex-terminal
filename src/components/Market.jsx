// src/components/Market.jsx — Live Market Overview v2
import { useState, useEffect } from "react";
import { Globe, TrendingUp, TrendingDown, ShieldAlert, Waves, Shield, Layers } from "lucide-react";
import { T, mono, display, pc, pct, fmt, D } from "../theme/tokens";
import { fetchLiveIndices, _c } from "../api/finance";
import { Card } from "./ui/Shared";

const CG = "/cg/api/v3";
const BLOCKCHAIN = "/blockchain/charts";
const DEFILLAMA = "/llama";
const DEFILLAMA_STABLES = "/llama-stables";
const SANTIMENT = "/santiment/graphql";

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

/* ── On-Chain Macro Fetchers ── */

async function fetchBtcOnChain() {
  try {
    const [hashRes, minerRes] = await Promise.all([
      fetch(`${BLOCKCHAIN}/hash-rate?timespan=30days&format=json&cors=true`),
      fetch(`${BLOCKCHAIN}/miners-revenue?timespan=30days&format=json&cors=true`),
    ]);
    const [hash, miner] = await Promise.all([
      hashRes.ok ? hashRes.json() : null,
      minerRes.ok ? minerRes.json() : null,
    ]);
    const latest = (d) => d?.values?.length ? d.values[d.values.length - 1].y : null;
    const prev = (d) => d?.values?.length > 7 ? d.values[d.values.length - 8].y : null;
    const hashRate = latest(hash); const hashPrev = prev(hash);
    const minerRev = latest(miner); const minerPrev = prev(miner);
    return {
      hashRate, hashChange: hashPrev ? ((hashRate - hashPrev) / hashPrev * 100) : null,
      minerRev, minerChange: minerPrev ? ((minerRev - minerPrev) / minerPrev * 100) : null,
    };
  } catch { return null; }
}

async function fetchDefiMacro() {
  try {
    const [tvlRes, stableRes] = await Promise.all([
      fetch(`${DEFILLAMA}/v2/historicalChainTvl`),
      fetch(`${DEFILLAMA_STABLES}/stablecoincharts/all?stablecoin=1`),
    ]);
    const tvlData = tvlRes.ok ? await tvlRes.json() : null;
    const stableData = stableRes.ok ? await stableRes.json() : null;
    const tvlNow = tvlData?.length ? tvlData[tvlData.length - 1].tvl : null;
    const tvl7d = tvlData?.length > 7 ? tvlData[tvlData.length - 8].tvl : null;
    const stableNow = stableData?.length ? stableData[stableData.length - 1].totalCirculating?.peggedUSD : null;
    const stable7d = stableData?.length > 7 ? stableData[stableData.length - 8].totalCirculating?.peggedUSD : null;
    return {
      tvl: tvlNow, tvlChange: tvl7d ? ((tvlNow - tvl7d) / tvl7d * 100) : null,
      stableMcap: stableNow, stableChange: stable7d ? ((stableNow - stable7d) / stable7d * 100) : null,
    };
  } catch { return null; }
}

async function fetchSantimentBTC() {
  // Fetch 30-day window ending ~30 days ago (free tier cutoff)
  const to = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const from = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];
  const query = `{
    mvrv: getMetric(metric: "mvrv_usd") { timeseriesData(slug: "bitcoin", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
    nvt: getMetric(metric: "nvt") { timeseriesData(slug: "bitcoin", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
    exBal: getMetric(metric: "exchange_balance") { timeseriesData(slug: "bitcoin", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
  }`;
  try {
    const r = await fetch(SANTIMENT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const arr = (key) => json.data?.[key]?.timeseriesData || [];
    const mvrvArr = arr("mvrv");
    const nvtArr = arr("nvt");
    const exArr = arr("exBal");
    const last = (a) => a.length ? a[a.length - 1] : null;
    const first = (a) => a.length ? a[0] : null;
    const mvrvLast = last(mvrvArr);
    const mvrvFirst = first(mvrvArr);
    const exLast = last(exArr);
    const exFirst = first(exArr);
    return {
      mvrv: mvrvLast?.value, mvrvDate: mvrvLast?.datetime?.split("T")[0],
      mvrvStart: mvrvFirst?.value, mvrvStartDate: mvrvFirst?.datetime?.split("T")[0],
      mvrvTrend: mvrvLast && mvrvFirst ? (mvrvLast.value > mvrvFirst.value ? "RISING" : "FALLING") : null,
      nvt: last(nvtArr)?.value,
      exchangeBalance: exLast?.value,
      exchangeChange: exLast && exFirst ? exLast.value - exFirst.value : null,
    };
  } catch { return null; }
}

function interpretMVRV(value) {
  if (value == null) return null;
  let zone, color;
  if (value < 1) { zone = "UNDERVALUED"; color = "#22c55e"; }
  else if (value < 1.5) { zone = "FAIR VALUE"; color = "#3b82f6"; }
  else if (value < 2.5) { zone = "WARMING"; color = "#f59e0b"; }
  else { zone = "OVERHEATED"; color = "#ef4444"; }
  return { value: Math.round(value * 100) / 100, zone, color };
}

const fmtB = (n) => n == null ? "—" : n >= 1e12 ? `$${(n/1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
const fmtHash = (n) => n == null ? "—" : n >= 1e6 ? `${(n/1e6).toFixed(0)} EH/s` : n >= 1e3 ? `${(n/1e3).toFixed(0)} PH/s` : `${n.toFixed(0)} TH/s`;
const fmtChg = (n) => n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}% 7d`;

const MarketMod = () => {
  const [idx, setIdx] = useState([]);
  const [ld, setLd] = useState(true);
  const [fg, setFg] = useState(null);
  const [global, setGlobal] = useState(null);
  const [onchain, setOnchain] = useState(null);

  useEffect(() => {
    (async () => {
      const [d, fgData, globalData, btcData, defiData, sanData] = await Promise.all([
        fetchLiveIndices(), fetchFearGreed(), fetchCryptoGlobal(),
        fetchBtcOnChain(), fetchDefiMacro(), fetchSantimentBTC(),
      ]);
      setIdx(d); setFg(fgData); setGlobal(globalData);
      setOnchain({ btc: btcData, defi: defiData, san: sanData });
      setLd(false);
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
              Sources: CoinGecko + Blockchain.info + DeFiLlama + Santiment. On-chain MVRV, NVT, exchange flows available in Portfolio On-Chain Pulse.
            </div>
          </Card>

          {/* On-Chain Intelligence Panel */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Shield size={15} color={T.a.cyan} />
              <div style={{ fontFamily: mono, fontSize: 16, color: T.t.p, fontWeight: 600 }}>On-Chain Intelligence</div>
            </div>

            {onchain?.san?.mvrv != null ? (() => {
              const mvrv = interpretMVRV(onchain.san.mvrv);
              const trend = onchain.san.mvrvTrend;
              const trendColor = trend === "RISING" ? "#f59e0b" : "#22c55e";
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ padding: '12px 14px', borderRadius: T.rad.md, background: mvrv.color + '10', border: `1px solid ${mvrv.color}2a`, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>BTC MVRV — Real On-Chain</div>
                        <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: mvrv.color }}>{mvrv.value}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: mvrv.color }}>{mvrv.zone}</div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, marginTop: 2 }}>as of {onchain.san.mvrvDate}</div>
                      </div>
                    </div>
                    {onchain.san.mvrvStart != null && (
                      <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: T.rad.sm, background: T.bg.deep }}>
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>30-Day Trend</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {trend === "RISING" ? <TrendingUp size={12} color={trendColor} /> : <TrendingDown size={12} color={trendColor} />}
                          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: trendColor }}>{trend}</span>
                          <span style={{ fontFamily: mono, fontSize: 9, color: T.t.m }}>
                            {onchain.san.mvrvStart.toFixed(2)} → {onchain.san.mvrv.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 9, color: T.t.s, marginTop: 4, lineHeight: 1.5 }}>
                          {trend === "RISING"
                            ? "MVRV was climbing — market was moving toward overvaluation. Check current price action for continuation."
                            : "MVRV was declining — market was cooling off. Historically a better entry regime for swing positions."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {onchain.san.nvt != null && (
                      <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                        <div style={{ fontFamily: mono, fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>NVT Signal</div>
                        <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: onchain.san.nvt > 150 ? "#ef4444" : onchain.san.nvt > 80 ? "#f59e0b" : "#22c55e" }}>
                          {Math.round(onchain.san.nvt)}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, marginTop: 2 }}>
                          {onchain.san.nvt > 150 ? "Overvalued relative to usage" : onchain.san.nvt > 80 ? "Fair — watch for shift" : "Undervalued by network activity"}
                        </div>
                      </div>
                    )}
                    {onchain.san.exchangeChange != null && (
                      <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                        <div style={{ fontFamily: mono, fontSize: 7, color: T.t.f, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Exchange Flow (30d)</div>
                        <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: onchain.san.exchangeChange > 0 ? "#ef4444" : "#22c55e" }}>
                          {onchain.san.exchangeChange > 0 ? "+" : ""}{Math.round(onchain.san.exchangeChange).toLocaleString()} BTC
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, marginTop: 2 }}>
                          {onchain.san.exchangeChange > 0 ? "Net inflow — sell pressure building" : "Net outflow — accumulation signal"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m, padding: 16, textAlign: 'center', marginBottom: 12 }}>Loading Santiment on-chain data...</div>
            )}

            {/* Network Fundamentals Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {onchain?.btc?.hashRate != null && (
                <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: T.a.cyan, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Hash Rate</div>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{fmtHash(onchain.btc.hashRate)}</div>
                  {onchain.btc.hashChange != null && <div style={{ fontFamily: mono, fontSize: 8, color: onchain.btc.hashChange >= 0 ? T.g.m : T.r.m, marginTop: 1 }}>{fmtChg(onchain.btc.hashChange)}</div>}
                </div>
              )}
              {onchain?.btc?.minerRev != null && (
                <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: T.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Miner Rev</div>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{fmtB(onchain.btc.minerRev)}</div>
                  {onchain.btc.minerChange != null && <div style={{ fontFamily: mono, fontSize: 8, color: onchain.btc.minerChange >= 0 ? T.g.m : T.r.m, marginTop: 1 }}>{fmtChg(onchain.btc.minerChange)}</div>}
                </div>
              )}
              {onchain?.defi?.tvl != null && (
                <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>DeFi TVL</div>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{fmtB(onchain.defi.tvl)}</div>
                  {onchain.defi.tvlChange != null && <div style={{ fontFamily: mono, fontSize: 8, color: onchain.defi.tvlChange >= 0 ? T.g.m : T.r.m, marginTop: 1 }}>{fmtChg(onchain.defi.tvlChange)}</div>}
                </div>
              )}
              {onchain?.defi?.stableMcap != null && (
                <div style={{ padding: '8px 10px', borderRadius: T.rad.sm, background: T.bg.el }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Stablecoin</div>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: T.t.p }}>{fmtB(onchain.defi.stableMcap)}</div>
                  {onchain.defi.stableChange != null && <div style={{ fontFamily: mono, fontSize: 8, color: onchain.defi.stableChange >= 0 ? T.g.m : T.r.m, marginTop: 1 }}>{fmtChg(onchain.defi.stableChange)}</div>}
                </div>
              )}
            </div>

            <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f }}>
              Santiment (~30d lag) + Blockchain.info + DeFiLlama — all free, no API keys
            </div>
          </Card>
        </div>
      </>}
    </div>
  );
};

export default MarketMod;
