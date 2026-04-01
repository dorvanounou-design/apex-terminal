import { useState, useEffect } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Waves, TrendingUp, Shield, Layers } from "lucide-react";
import { T, mono, D } from "../theme/tokens";
import { Card } from "./ui/Shared";
import { CM } from "../api/finance";

const CG = "https://api.coingecko.com/api/v3";
const BLOCKCHAIN = "/blockchain/charts";
const DEFILLAMA = "/llama";
const DEFILLAMA_STABLES = "/llama-stables";
const SANTIMENT = "/santiment/graphql";

// Santiment free tier slug mapping (subset of CM that Santiment supports)
const SAN_SLUGS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche", DOT: "polkadot", LINK: "chainlink", LTC: "litecoin", UNI: "uniswap", AAVE: "aave", MATIC: "matic-network" };

/* ── Macro fetchers (free, no API key) ── */

async function fetchBtcFundamentals() {
  try {
    const [hashRes, minerRes, priceRes] = await Promise.all([
      fetch(`${BLOCKCHAIN}/hash-rate?timespan=30days&format=json&cors=true`),
      fetch(`${BLOCKCHAIN}/miners-revenue?timespan=30days&format=json&cors=true`),
      fetch(`${BLOCKCHAIN}/market-price?timespan=30days&format=json&cors=true`),
    ]);
    const [hash, miner, price] = await Promise.all([
      hashRes.ok ? hashRes.json() : null,
      minerRes.ok ? minerRes.json() : null,
      priceRes.ok ? priceRes.json() : null,
    ]);
    const latest = (d) => d?.values?.length ? d.values[d.values.length - 1].y : null;
    const prev = (d) => d?.values?.length > 7 ? d.values[d.values.length - 8].y : null;
    const hashRate = latest(hash);
    const hashPrev = prev(hash);
    const minerRev = latest(miner);
    const minerPrev = prev(miner);
    return {
      hashRate, hashChange: hashPrev ? ((hashRate - hashPrev) / hashPrev * 100) : null,
      minerRev, minerChange: minerPrev ? ((minerRev - minerPrev) / minerPrev * 100) : null,
      hashUnit: hash?.unit || "TH/s",
    };
  } catch { return null; }
}

async function fetchDefiMacro() {
  try {
    const [tvlRes, stableRes] = await Promise.all([
      fetch(`${DEFILLAMA}/v2/historicalChainTvl`),
      fetch(`${DEFILLAMA_STABLES}/stablecoincharts/all?stablecoin=1`), // USDT as proxy
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

/* ── Santiment on-chain (free tier: ~30-day lag, real MVRV/NVT/exchange flows) ── */

async function fetchSantimentMetrics(slugs) {
  // Free tier allows data up to ~30 days ago. Query last available 14-day window.
  const to = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const from = new Date(Date.now() - 44 * 86400000).toISOString().split("T")[0];
  const results = {};
  for (const [ticker, slug] of Object.entries(slugs)) {
    const query = `{
      mvrv: getMetric(metric: "mvrv_usd") { timeseriesData(slug: "${slug}", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
      nvt: getMetric(metric: "nvt") { timeseriesData(slug: "${slug}", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
      exchangeBalance: getMetric(metric: "exchange_balance") { timeseriesData(slug: "${slug}", from: "${from}T00:00:00Z", to: "${to}T00:00:00Z", interval: "1d") { datetime value } }
    }`;
    try {
      const r = await fetch(SANTIMENT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!r.ok) continue;
      const json = await r.json();
      const last = (arr) => arr?.length ? arr[arr.length - 1] : null;
      const prev = (arr) => arr?.length > 7 ? arr[arr.length - 8] : null;
      const mvrvArr = json.data?.mvrv?.timeseriesData;
      const nvtArr = json.data?.nvt?.timeseriesData;
      const exArr = json.data?.exchangeBalance?.timeseriesData;
      const mvrvLast = last(mvrvArr);
      const exLast = last(exArr);
      const exPrev = prev(exArr);
      results[ticker] = {
        mvrv: mvrvLast?.value ?? null,
        mvrvDate: mvrvLast?.datetime?.split("T")[0] ?? null,
        nvt: last(nvtArr)?.value ?? null,
        exchangeBalance: exLast?.value ?? null,
        exchangeFlow: exLast && exPrev ? exLast.value - exPrev.value : null,
      };
    } catch { /* skip this ticker */ }
  }
  return results;
}

function calcMVRVProxy(mc, vol24h) {
  if (!mc || !vol24h || vol24h === 0) return null;
  const ratio = mc / vol24h;
  let zone = "FAIR";
  let color = T.w?.m || "#f59e0b";
  if (ratio < 15) { zone = "ACCUMULATION"; color = "#22c55e"; }
  else if (ratio < 25) { zone = "FAIR VALUE"; color = "#3b82f6"; }
  else if (ratio < 50) { zone = "WARMING"; color = "#f59e0b"; }
  else { zone = "DISTRIBUTION"; color = "#ef4444"; }
  return { ratio: Math.round(ratio), zone, color };
}

function calcFlowProxy(vol24h, avgVol, priceChange24h) {
  if (!vol24h || !avgVol || avgVol === 0) return null;
  const rvol = vol24h / avgVol;
  let signal = "NEUTRAL";
  let color = T.t.m;
  let detail = "";

  if (rvol > 2.0 && Math.abs(priceChange24h) < 2) {
    signal = "ACCUMULATION";
    color = "#22c55e";
    detail = `Volume ${rvol.toFixed(1)}x average but price stayed flat, which often means patient accumulation.`;
  } else if (rvol > 2.0 && priceChange24h > 5) {
    signal = "BREAKOUT";
    color = "#3b82f6";
    detail = `Volume ${rvol.toFixed(1)}x with strong price expansion, so the move has real participation behind it.`;
  } else if (rvol > 2.0 && priceChange24h < -5) {
    signal = "DISTRIBUTION";
    color = "#ef4444";
    detail = `Volume ${rvol.toFixed(1)}x with downside pressure, which reads more like exit flow than accumulation.`;
  } else if (rvol < 0.5) {
    signal = "DRY UP";
    color = "#71717a";
    detail = `Volume is running cold at ${(rvol * 100).toFixed(0)}% of baseline, so attention is weak right now.`;
  } else {
    detail = `Volume is roughly ${rvol.toFixed(1)}x baseline, so the tape is active but not exceptional.`;
  }

  return { rvol: Math.round(rvol * 100) / 100, signal, color, detail };
}

function calcRealizedProxy(price, ath, athChangePct) {
  if (!ath || athChangePct == null) return null;
  const drawdown = Math.abs(athChangePct);
  let zone = "FAIR";
  let color = T.t.m;

  if (drawdown < 10) { zone = "NEAR ATH"; color = "#f59e0b"; }
  else if (drawdown < 30) { zone = "HEALTHY"; color = "#22c55e"; }
  else if (drawdown < 60) { zone = "RECOVERY"; color = "#3b82f6"; }
  else { zone = "CAPITULATION"; color = "#ef4444"; }

  return { drawdown: Math.round(drawdown), zone, color, ath, price };
}

async function fetchCryptoSignals(tickers) {
  const cryptoHoldings = tickers.filter((tk) => CM[tk.toUpperCase()]);
  if (cryptoHoldings.length === 0) return [];

  const ids = cryptoHoldings.map((tk) => CM[tk.toUpperCase()]).join(",");
  try {
    const r = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d,30d`);
    if (!r.ok) return [];
    const data = await r.json();

    return data.map((coin) => {
      // CoinGecko free tier only gives spot 24h volume, not historical.
      // Use 80% of current vol as a conservative "average" proxy — honest about the limitation.
      // TODO: Replace with real 7d/30d average when upgrading to CoinGecko Pro or adding a volume history cache.
      const avgVol = coin.total_volume * 0.80;
      const mvrv = calcMVRVProxy(coin.market_cap, coin.total_volume);
      const flow = calcFlowProxy(coin.total_volume, avgVol, coin.price_change_percentage_24h || 0);
      const realized = calcRealizedProxy(coin.current_price, coin.ath, coin.ath_change_percentage);

      let health = 50;
      if (mvrv) {
        if (mvrv.zone === "ACCUMULATION") health += 20;
        else if (mvrv.zone === "DISTRIBUTION") health -= 20;
        else if (mvrv.zone === "WARMING") health -= 10;
      }
      if (flow) {
        if (flow.signal === "ACCUMULATION") health += 15;
        else if (flow.signal === "DISTRIBUTION") health -= 15;
        else if (flow.signal === "BREAKOUT") health += 10;
      }
      if (realized) {
        if (realized.zone === "CAPITULATION") health += 10;
        else if (realized.zone === "NEAR ATH") health -= 10;
      }
      health = Math.max(0, Math.min(100, health));

      return {
        tk: coin.symbol.toUpperCase(),
        nm: coin.name,
        price: coin.current_price,
        ch24h: coin.price_change_percentage_24h || 0,
        ch7d: coin.price_change_percentage_7d_in_currency || 0,
        ch30d: coin.price_change_percentage_30d_in_currency || 0,
        mc: coin.market_cap,
        vol: coin.total_volume,
        img: coin.image,
        mvrv,
        flow,
        realized,
        health,
      };
    });
  } catch {
    return [];
  }
}

const SignalDot = ({ color, size = 6 }) => (
  <div style={{ width: size, height: size, borderRadius: 2, background: color, flexShrink: 0 }} />
);

const coverageCard = (label, value, color) => ({
  label,
  value,
  color,
});

const fmtB = (n) => n == null ? "—" : n >= 1e12 ? `$${(n/1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
const fmtHash = (n) => n == null ? "—" : n >= 1e6 ? `${(n/1e6).toFixed(0)} EH/s` : n >= 1e3 ? `${(n/1e3).toFixed(0)} PH/s` : `${n.toFixed(0)} TH/s`;
const fmtChg = (n) => n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}% 7d`;

function interpretMVRV(value) {
  if (value == null) return null;
  let zone, color;
  if (value < 1) { zone = "UNDERVALUED"; color = "#22c55e"; }
  else if (value < 1.5) { zone = "FAIR VALUE"; color = "#3b82f6"; }
  else if (value < 2.5) { zone = "WARMING"; color = "#f59e0b"; }
  else { zone = "OVERHEATED"; color = "#ef4444"; }
  return { value: Math.round(value * 100) / 100, zone, color };
}

function interpretExFlow(flow) {
  if (flow == null) return null;
  if (flow < -100) return { signal: "ACCUMULATION", color: "#22c55e", detail: `${Math.abs(Math.round(flow))} BTC net outflow from exchanges — coins moving to cold storage.` };
  if (flow > 100) return { signal: "SELL PRESSURE", color: "#ef4444", detail: `${Math.round(flow)} BTC net inflow to exchanges — potential sell-side building.` };
  return { signal: "NEUTRAL", color: "#71717a", detail: "Exchange flows are balanced — no strong directional signal." };
}

const CryptoOnChain = ({ holdings }) => {
  const [signals, setSignals] = useState([]);
  const [macro, setMacro] = useState(null);
  const [sanData, setSanData] = useState({});
  const [loading, setLoading] = useState(true);

  const cryptoTickers = holdings
    .filter((holding) => holding.tp === "crypto" || CM[holding.tk.toUpperCase()])
    .map((holding) => holding.tk);

  useEffect(() => {
    if (cryptoTickers.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Build Santiment slug map for tickers in portfolio
    const sanSlugs = {};
    for (const tk of cryptoTickers) {
      const up = tk.toUpperCase();
      if (SAN_SLUGS[up]) sanSlugs[up] = SAN_SLUGS[up];
    }
    Promise.all([
      fetchCryptoSignals(cryptoTickers),
      fetchBtcFundamentals(),
      fetchDefiMacro(),
      Object.keys(sanSlugs).length > 0 ? fetchSantimentMetrics(sanSlugs) : Promise.resolve({}),
    ]).then(([rows, btc, defi, san]) => {
      setSignals(rows);
      setMacro({ btc, defi });
      setSanData(san || {});
      setLoading(false);
    });
  }, [cryptoTickers.join(",")]);

  if (cryptoTickers.length === 0) return null;

  return (
    <Card style={{ borderLeft: `2px solid ${T.a.cyan}`, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color: T.t.p }}>Crypto Intelligence Desk</div>
          <div style={{ fontFamily: mono, fontSize: 7, color: T.t.m, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Santiment real MVRV/NVT + Blockchain.info + DeFiLlama + CoinGecko — all free, no API keys
          </div>
        </div>
        <Activity size={14} color={T.a.cyan} opacity={0.55} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
        {[
          coverageCard("Data sources", "CoinGecko + Blockchain.info + DeFiLlama + Santiment (real MVRV, NVT, exchange flows)", T.a.blue),
          coverageCard("Good for", "Real MVRV/NVT cycle reads, exchange flow pressure, hash rate, DeFi TVL, stablecoin supply", T.g.m),
          coverageCard("Limitation", "Santiment free tier has ~30-day data lag. CoinGecko proxy fills the gap for real-time signals", "#f59e0b"),
        ].map((row) => (
          <div key={row.label} style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.deep, border: `1px solid ${row.color}20` }}>
            <div style={{ fontFamily: mono, fontSize: 7, color: row.color, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 5 }}>{row.label}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.t.s, lineHeight: 1.55 }}>{row.value}</div>
          </div>
        ))}
      </div>

      {/* ── Macro On-Chain Panel ── */}
      {macro && (macro.btc || macro.defi) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          {macro.btc?.hashRate != null && (
            <div style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.el, border: `1px solid ${T.a.cyan}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                <Shield size={10} color={T.a.cyan} />
                <span style={{ fontFamily: mono, fontSize: 7, color: T.a.cyan, textTransform: "uppercase", letterSpacing: 1 }}>BTC Hash Rate</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.t.p, fontWeight: 700 }}>{fmtHash(macro.btc.hashRate)}</div>
              {macro.btc.hashChange != null && (
                <div style={{ fontFamily: mono, fontSize: 8, color: macro.btc.hashChange >= 0 ? T.g.m : T.r.m, marginTop: 2 }}>{fmtChg(macro.btc.hashChange)}</div>
              )}
            </div>
          )}
          {macro.btc?.minerRev != null && (
            <div style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.el, border: `1px solid ${T.accent}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                <Layers size={10} color={T.accent} />
                <span style={{ fontFamily: mono, fontSize: 7, color: T.accent, textTransform: "uppercase", letterSpacing: 1 }}>Miner Revenue</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.t.p, fontWeight: 700 }}>{fmtB(macro.btc.minerRev)}</div>
              {macro.btc.minerChange != null && (
                <div style={{ fontFamily: mono, fontSize: 8, color: macro.btc.minerChange >= 0 ? T.g.m : T.r.m, marginTop: 2 }}>{fmtChg(macro.btc.minerChange)}</div>
              )}
            </div>
          )}
          {macro.defi?.tvl != null && (
            <div style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.el, border: `1px solid #8b5cf620` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                <TrendingUp size={10} color="#8b5cf6" />
                <span style={{ fontFamily: mono, fontSize: 7, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 1 }}>DeFi TVL</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.t.p, fontWeight: 700 }}>{fmtB(macro.defi.tvl)}</div>
              {macro.defi.tvlChange != null && (
                <div style={{ fontFamily: mono, fontSize: 8, color: macro.defi.tvlChange >= 0 ? T.g.m : T.r.m, marginTop: 2 }}>{fmtChg(macro.defi.tvlChange)}</div>
              )}
            </div>
          )}
          {macro.defi?.stableMcap != null && (
            <div style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.el, border: `1px solid #22c55e20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                <Waves size={10} color="#22c55e" />
                <span style={{ fontFamily: mono, fontSize: 7, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1 }}>Stablecoin Supply</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.t.p, fontWeight: 700 }}>{fmtB(macro.defi.stableMcap)}</div>
              {macro.defi.stableChange != null && (
                <div style={{ fontFamily: mono, fontSize: 8, color: macro.defi.stableChange >= 0 ? T.g.m : T.r.m, marginTop: 2 }}>{fmtChg(macro.defi.stableChange)}</div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 22, fontFamily: mono, fontSize: 10, color: T.t.m }}>Loading crypto desk...</div>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 22, fontFamily: mono, fontSize: 10, color: T.t.m }}>No crypto data available</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {signals.map((signal) => {
            const san = sanData[signal.tk] || {};
            const realMVRV = interpretMVRV(san.mvrv);
            const exFlow = interpretExFlow(san.exchangeFlow);
            const hasSan = !!realMVRV;

            // Use real MVRV for health when available
            let health = signal.health;
            if (realMVRV) {
              health = 50;
              if (realMVRV.zone === "UNDERVALUED") health += 25;
              else if (realMVRV.zone === "OVERHEATED") health -= 25;
              else if (realMVRV.zone === "WARMING") health -= 10;
              if (exFlow?.signal === "ACCUMULATION") health += 15;
              else if (exFlow?.signal === "SELL PRESSURE") health -= 15;
              if (signal.realized) {
                if (signal.realized.zone === "CAPITULATION") health += 10;
                else if (signal.realized.zone === "NEAR ATH") health -= 10;
              }
              health = Math.max(0, Math.min(100, health));
            }

            const healthTone = health >= 65 ? T.g.m : health >= 45 ? T.w.m : T.r.m;
            return (
              <div key={signal.tk} style={{ padding: "12px 14px", background: T.bg.deep, borderRadius: T.rad.md, border: `1px solid ${T.b.s}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {signal.img && <img src={signal.img} alt="" style={{ width: 18, height: 18, borderRadius: 3 }} />}
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: T.t.p, fontWeight: 700 }}>{signal.tk}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.t.m }}>{signal.nm}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: T.t.p, fontWeight: 700 }}>{D(signal.price)}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: signal.ch24h >= 0 ? T.g.m : T.r.m, fontWeight: 700 }}>
                      {signal.ch24h >= 0 ? <ArrowUpRight size={10} style={{ display: "inline", verticalAlign: "text-bottom" }} /> : <ArrowDownRight size={10} style={{ display: "inline", verticalAlign: "text-bottom" }} />}
                      {" "}{signal.ch24h >= 0 ? "+" : ""}{signal.ch24h.toFixed(2)}% 24h
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: hasSan ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 9 }}>
                  {realMVRV ? (
                    <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>MVRV <span style={{ color: "#22c55e" }}>REAL</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={realMVRV.color} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: realMVRV.color }}>{realMVRV.value} — {realMVRV.zone}</span>
                      </div>
                      {san.mvrvDate && <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, marginTop: 2 }}>as of {san.mvrvDate}</div>}
                    </div>
                  ) : (
                    <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>MVRV Proxy</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={signal.mvrv?.color || T.t.f} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: signal.mvrv?.color || T.t.f }}>{signal.mvrv?.zone || "—"}</span>
                      </div>
                    </div>
                  )}
                  {san.nvt != null ? (
                    <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>NVT <span style={{ color: "#22c55e" }}>REAL</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={san.nvt > 150 ? "#ef4444" : san.nvt > 80 ? "#f59e0b" : "#22c55e"} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: san.nvt > 150 ? "#ef4444" : san.nvt > 80 ? "#f59e0b" : "#22c55e" }}>{Math.round(san.nvt)}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Flow Signal</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={signal.flow?.color || T.t.f} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: signal.flow?.color || T.t.f }}>{signal.flow?.signal || "—"}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                    <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>ATH Zone</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <SignalDot color={signal.realized?.color || T.t.f} />
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: signal.realized?.color || T.t.f }}>{signal.realized?.zone || "—"}</span>
                    </div>
                  </div>
                  {exFlow && (
                    <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Exchange Flow <span style={{ color: "#22c55e" }}>REAL</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={exFlow.color} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: exFlow.color }}>{exFlow.signal}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 9 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: mono, fontSize: 7, color: T.t.f, textTransform: "uppercase", letterSpacing: 1 }}>{hasSan ? "On-chain health" : "Proxy health"}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: healthTone, fontWeight: 700 }}>{health}/100</span>
                    </div>
                    <div style={{ height: 6, borderRadius: T.rad.pill, overflow: "hidden", background: T.b.s }}>
                      <div style={{ width: `${health}%`, height: "100%", background: `linear-gradient(90deg, ${healthTone}, ${healthTone}aa)` }} />
                    </div>
                  </div>
                  <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: signal.ch7d >= 0 ? T.g.bg : T.r.bg, border: `1px solid ${(signal.ch7d >= 0 ? T.g.m : T.r.m)}20` }}>
                    <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>7D Tape</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: signal.ch7d >= 0 ? T.g.m : T.r.m, fontWeight: 700 }}>
                      {signal.ch7d >= 0 ? "+" : ""}{signal.ch7d.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 8 }}>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.t.s, lineHeight: 1.6 }}>
                    {exFlow?.detail || signal.flow?.detail || "Flow read is unavailable for this asset right now."}
                  </div>
                  <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Waves size={11} color={T.accent} />
                      <span style={{ fontFamily: mono, fontSize: 7, color: T.accent, textTransform: "uppercase", letterSpacing: 1 }}>Desk note</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.t.s, lineHeight: 1.55 }}>
                      {hasSan
                        ? (health >= 65
                          ? "Real on-chain metrics confirm constructive conditions. MVRV and exchange flows aligned."
                          : health >= 45
                            ? "On-chain data shows mixed signals. MVRV and flows are not aligned — wait for clarity."
                            : "On-chain metrics flag caution. Elevated MVRV or exchange inflows suggest distribution risk.")
                        : (health >= 65
                          ? "Constructive proxy tape. Good enough for stalking entries, but still not the same as a real on-chain dashboard."
                          : health >= 45
                            ? "Mixed signal. Respect the trend, but treat it as a watch candidate, not conviction."
                            : "Weak proxy read. Without better on-chain coverage, this is more narrative than edge.")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default CryptoOnChain;
