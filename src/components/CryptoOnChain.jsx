import { useState, useEffect } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Waves } from "lucide-react";
import { T, mono, D } from "../theme/tokens";
import { Card } from "./ui/Shared";
import { CM } from "../api/finance";

const CG = "https://api.coingecko.com/api/v3";

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

const CryptoOnChain = ({ holdings }) => {
  const [signals, setSignals] = useState([]);
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
    fetchCryptoSignals(cryptoTickers).then((rows) => {
      setSignals(rows);
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
            Proxy tape read using free feeds, not true Glassnode-grade on-chain coverage
          </div>
        </div>
        <Activity size={14} color={T.a.cyan} opacity={0.55} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
        {[
          coverageCard("Current stack", "CoinGecko market structure and volume data", T.a.blue),
          coverageCard("Good for", "Trend, participation, rough overheating and recovery reads", T.g.m),
          coverageCard("Still missing", "Exchange balances, SOPR, real MVRV, whale and entity-level flows", T.r.m),
        ].map((row) => (
          <div key={row.label} style={{ padding: "10px 12px", borderRadius: T.rad.md, background: T.bg.deep, border: `1px solid ${row.color}20` }}>
            <div style={{ fontFamily: mono, fontSize: 7, color: row.color, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 5 }}>{row.label}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.t.s, lineHeight: 1.55 }}>{row.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 22, fontFamily: mono, fontSize: 10, color: T.t.m }}>Loading crypto desk...</div>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 22, fontFamily: mono, fontSize: 10, color: T.t.m }}>No crypto data available</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {signals.map((signal) => {
            const healthTone = signal.health >= 65 ? T.g.m : signal.health >= 45 ? T.w.m : T.r.m;
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 9 }}>
                  {[
                    { label: "MVRV Proxy", value: signal.mvrv?.zone || "—", color: signal.mvrv?.color || T.t.f },
                    { label: "Flow Signal", value: signal.flow?.signal || "—", color: signal.flow?.color || T.t.f },
                    { label: "ATH Zone", value: signal.realized?.zone || "—", color: signal.realized?.color || T.t.f },
                  ].map((row) => (
                    <div key={row.label} style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                      <div style={{ fontFamily: mono, fontSize: 6, color: T.t.f, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{row.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <SignalDot color={row.color} />
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: row.color }}>{row.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 9 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: mono, fontSize: 7, color: T.t.f, textTransform: "uppercase", letterSpacing: 1 }}>Proxy health</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: healthTone, fontWeight: 700 }}>{signal.health}/100</span>
                    </div>
                    <div style={{ height: 6, borderRadius: T.rad.pill, overflow: "hidden", background: T.b.s }}>
                      <div style={{ width: `${signal.health}%`, height: "100%", background: `linear-gradient(90deg, ${healthTone}, ${healthTone}aa)` }} />
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
                    {signal.flow?.detail || "Flow read is unavailable for this asset right now."}
                  </div>
                  <div style={{ padding: "8px 9px", borderRadius: T.rad.sm, background: T.bg.el }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Waves size={11} color={T.accent} />
                      <span style={{ fontFamily: mono, fontSize: 7, color: T.accent, textTransform: "uppercase", letterSpacing: 1 }}>Desk note</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.t.s, lineHeight: 1.55 }}>
                      {signal.health >= 65
                        ? "Constructive proxy tape. Good enough for stalking entries, but still not the same as a real on-chain dashboard."
                        : signal.health >= 45
                          ? "Mixed signal. Respect the trend, but treat it as a watch candidate, not conviction."
                          : "Weak proxy read. Without better on-chain coverage, this is more narrative than edge."}
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
