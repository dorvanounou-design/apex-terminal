import { useState, useEffect, useMemo, useCallback } from "react";
import { Eye, Plus, X, TrendingUp, TrendingDown, Target, ShieldAlert, Coins, RefreshCw } from "lucide-react";
import { T, mono, sans, display, pc, D, pct, fmt } from "../theme/tokens";
import { fetchPrice, fetchSingleAnalysis, fetchStockDetail, fetchCryptoDetail, fetchChart, isC } from "../api/finance";
import { Card, Badge, Btn, Morph } from "./ui/Shared";

const ratingColor = (rating) => {
  if (rating === "STRONG BUY") return T.g.m;
  if (rating === "BUY") return "#34d399";
  if (rating === "HOLD") return T.w.m;
  if (rating === "SELL") return "#f87171";
  if (rating === "STRONG SELL") return T.r.m;
  return T.t.m;
};

const scoreColor = (score) => {
  if (score >= 6) return T.g.m;
  if (score >= 3) return "#34d399";
  if (score >= 0) return T.w.m;
  if (score >= -2) return T.t.m;
  return T.r.m;
};

const riskBadge = (score) => {
  if (score >= 6) return { label: "Risky", color: T.r.m, bg: T.r.bg };
  if (score >= 3) return { label: "Watch", color: T.w.m, bg: "rgba(251,191,36,0.08)" };
  return { label: "Clean", color: T.g.m, bg: T.g.bg };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const ret = (prices, daysBack) => {
  if (!prices?.length || prices.length <= daysBack) return null;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - daysBack];
  return past > 0 ? ((current - past) / past) * 100 : null;
};

const trendLabel = (price, sma20, sma50) => {
  if (sma20 == null || sma50 == null) return { text: "No trend", color: T.t.m };
  if (price > sma20 && sma20 > sma50) return { text: "Trend up", color: T.g.m };
  if (price > sma50 && price < sma20) return { text: "Pullback", color: T.w.m };
  if (price < sma20 && sma20 < sma50) return { text: "Trend down", color: T.r.m };
  return { text: "Mixed", color: T.t.m };
};

function buildCryptoAnalysis(ticker, priceData, chart, detail) {
  const prices = (chart || []).map((point) => point.price).filter((value) => value != null);
  if (!priceData || prices.length < 25) return null;
  const sma20 = avg(prices.slice(-20));
  const sma50 = avg(prices.slice(-50));
  const mom7d = ret(prices, 7);
  const mom30d = ret(prices, 30);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const range = high - low;
  const pos = range > 0 ? ((priceData.price - low) / range) * 100 : 50;
  let apexScore = 0;
  if (mom30d > 20) apexScore += 3; else if (mom30d > 8) apexScore += 2; else if (mom30d > 0) apexScore += 1;
  else if (mom30d < -18) apexScore -= 3; else if (mom30d < -8) apexScore -= 2; else if (mom30d < 0) apexScore -= 1;
  if (mom7d > 6) apexScore += 1.5; else if (mom7d > 0) apexScore += 0.5; else if (mom7d < -10) apexScore -= 1.5; else if (mom7d < 0) apexScore -= 0.5;
  if (sma20 != null && priceData.price > sma20) apexScore += 1; else apexScore -= 1;
  if (sma20 != null && sma50 != null && sma20 > sma50) apexScore += 1; else if (sma20 != null && sma50 != null) apexScore -= 1;
  if (pos > 85) apexScore -= 1;
  if (pos < 25) apexScore += 1;
  let riskScore = 2;
  if (Math.abs(mom7d || 0) > 12) riskScore += 2;
  if (Math.abs(mom30d || 0) > 35) riskScore += 2;
  if ((detail?.market_cap_rank || 999) > 60) riskScore += 1;
  riskScore = clamp(riskScore, 1, 8);
  let analystRating = "HOLD";
  if (apexScore >= 7) analystRating = "STRONG BUY";
  else if (apexScore >= 4.5) analystRating = "BUY";
  else if (apexScore <= -4.5) analystRating = "STRONG SELL";
  else if (apexScore <= -2.5) analystRating = "SELL";
  const reasons = [];
  if ((mom30d || 0) > 15) reasons.push("30d momentum is strong and still trending higher.");
  if ((mom30d || 0) < -15) reasons.push("30d momentum is still weak, so downside pressure is not finished.");
  if (sma20 != null && priceData.price > sma20) reasons.push("Price is holding above the 20-day average, which keeps the swing trend constructive.");
  if (sma20 != null && priceData.price < sma20) reasons.push("Price is below the 20-day average, so this is still a wait-and-see setup.");
  if ((mom7d || 0) > 5) reasons.push("The last week has fresh upside follow-through.");
  if ((mom7d || 0) < -8) reasons.push("The last week is breaking lower, which weakens the setup.");
  const warnings = [];
  if (riskScore >= 5) warnings.push("Crypto volatility is elevated here, so size should stay smaller.");
  if (pos > 90) warnings.push("It is already stretched near the top of the recent range.");
  if ((detail?.market_cap_rank || 999) > 80) warnings.push("This is not a top-liquidity crypto name, so expect rougher moves.");
  return {
    ticker,
    name: detail?.name || priceData.name || ticker,
    price: priceData.price,
    changePct: priceData.changePct,
    marketCap: detail?.market_data?.market_cap?.usd || priceData.marketCap || null,
    volume: detail?.market_data?.total_volume?.usd || null,
    analystRating,
    apexScore: Math.round(apexScore * 10) / 10,
    sma20, sma50, mom30d, w52Position: pos, riskScore,
    reasons, warnings, isCrypto: true,
  };
}

const buildReasons = (item) => {
  if (!item) return [];
  if (item.reasons?.length) return item.reasons.slice(0, 5);
  const reasons = [];
  if (item.rsi != null) {
    if (item.rsi < 35) reasons.push(`RSI is ${item.rsi.toFixed(0)}, which is close to washed-out territory.`);
    else if (item.rsi > 68) reasons.push(`RSI is ${item.rsi.toFixed(0)}, so the move is getting crowded.`);
    else reasons.push(`RSI is ${item.rsi.toFixed(0)}, which is still balanced.`);
  }
  if (item.price != null && item.sma20 != null && item.sma50 != null) {
    const trend = trendLabel(item.price, item.sma20, item.sma50);
    reasons.push(`${trend.text} because price sits at ${D(item.price)} versus the 20-day and 50-day averages.`);
  }
  if (item.mom30d != null) reasons.push(`30-day momentum is ${pct(item.mom30d)}, giving the setup its current direction.`);
  if (item.volRatio != null) reasons.push(`Relative volume is ${item.volRatio.toFixed(1)}x, which shows how much participation is behind the move.`);
  if (item.vcp?.vcpScore >= 70) reasons.push(`VCP score is ${item.vcp.vcpScore}, so the base is tightening instead of getting noisy.`);
  if (item.earningsGap?.grade) reasons.push(`Earnings gap grade is ${item.earningsGap.grade}, which adds event-driven conviction.`);
  if (item.rsRating >= 75) reasons.push("Relative strength is strong versus the market, so it is acting like a leader.");
  return reasons.slice(0, 5);
};

const buildWarnings = (item) => {
  if (!item) return [];
  if (item.warnings?.length) return item.warnings.slice(0, 4);
  const warnings = [];
  if ((item.riskScore || 0) >= 6) warnings.push("Risk flags are elevated, so this is not clean institutional tape.");
  if (item.rsi != null && item.rsi > 70) warnings.push("It is already overbought, so chasing here has poor timing.");
  if (item.w52Position != null && item.w52Position > 90) warnings.push("It is trading near the top of its yearly range.");
  if (item.riskFlags?.length) warnings.push(...item.riskFlags.map((flag) => flag.label));
  return warnings.slice(0, 4);
};

const buildActionPlan = (item, held) => {
  if (!item) return null;
  if ((item.riskScore || 0) >= 6 || item.analystRating === "STRONG SELL") {
    return held
      ? { label: "Exit or cut hard", color: T.r.m, bg: T.r.bg, detail: "The setup is weak and the risk tape is bad. If you already own it, de-risk instead of hoping." }
      : { label: "Avoid", color: T.r.m, bg: T.r.bg, detail: "There is not enough quality here for a fresh buy. Keep it on the screen only if you want to study it." };
  }
  if (item.analystRating === "STRONG BUY") {
    return held
      ? { label: "Hold and add selectively", color: T.g.m, bg: T.g.bg, detail: "This is one of your better watchlist setups. Hold the position and add only if the trend keeps confirming." }
      : { label: "Start building", color: T.g.m, bg: T.g.bg, detail: "This is actionable now. Start with a starter size and add only if follow-through stays intact." };
  }
  if (item.analystRating === "BUY") {
    return held
      ? { label: "Hold, add on weakness", color: "#34d399", bg: "rgba(52,211,153,0.08)", detail: "The structure is still constructive. Pullbacks into support are the better add spots." }
      : { label: "Starter buy only", color: "#34d399", bg: "rgba(52,211,153,0.08)", detail: "Worth taking seriously, but this is better as a starter entry than a full send." };
  }
  if (item.analystRating === "SELL") {
    return held
      ? { label: "Trim and tighten risk", color: T.w.m, bg: "rgba(251,191,36,0.08)", detail: "Momentum is slipping. Reduce exposure and let the chart prove itself again before giving it more room." }
      : { label: "Do not buy yet", color: T.w.m, bg: "rgba(251,191,36,0.08)", detail: "Keep it on the list, but wait for a real reversal instead of trying to catch it early." };
  }
  return held
    ? { label: "Hold and wait", color: T.a.blue, bg: "rgba(94,161,255,0.08)", detail: "Nothing to do aggressively here. Hold only if your original thesis is still valid." }
    : { label: "Watch only", color: T.a.blue, bg: "rgba(94,161,255,0.08)", detail: "Useful name, but not a clear entry. Let it earn its way from watchlist to trade list." };
};

const Stat = ({ label, value, accent }) => (
  <div style={{ padding: "9px 10px", borderRadius: T.rad.md, background: T.bg.deep, border: `1px solid ${T.b.s}` }}>
    <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 5 }}>{label}</div>
    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: accent || T.t.p }}>{value}</div>
  </div>
);

const Spotlight = ({ ticker, analysis, priceData, held, loading, onRefresh }) => {
  if (!ticker) return <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 22 }}><Target size={28} color={T.t.f} style={{ opacity: 0.4, marginBottom: 12 }} /><div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 4 }}>No ticker selected</div><div style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>Click a watchlist name to get a real action plan.</div></div>;
  if (loading && !analysis) return <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 22 }}><RefreshCw size={24} color={T.accent} style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} /><div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 3 }}>Loading conviction view</div><div style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>Pulling trend, risk, and action context for {ticker}.</div></div>;
  if (!analysis) return <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 22 }}><ShieldAlert size={28} color={T.r.m} style={{ opacity: 0.8, marginBottom: 12 }} /><div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 4 }}>No analysis available</div><div style={{ fontFamily: mono, fontSize: 9, color: T.t.f }}>This ticker does not have enough data yet for a decision view.</div></div>;
  const action = buildActionPlan(analysis, held);
  const reasons = buildReasons(analysis);
  const warnings = buildWarnings(analysis);
  const trend = trendLabel(analysis.price, analysis.sma20, analysis.sma50);
  const risk = riskBadge(analysis.riskScore || 0);
  const primaryPrice = priceData?.price ?? analysis.price;
  const primaryChange = priceData?.changePct ?? analysis.changePct ?? 0;
  return (
    <div style={{ padding: "14px 13px", animation: "slideIn 0.22s ease-out" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, color: T.t.f, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 5 }}>Watchboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: T.rad.md, display: "flex", alignItems: "center", justifyContent: "center", background: analysis.isCrypto ? T.a.cyan + "14" : T.a.blue + "14", border: `1px solid ${(analysis.isCrypto ? T.a.cyan : T.a.blue)}28`, color: analysis.isCrypto ? T.a.cyan : T.a.blue }}>{analysis.isCrypto ? <Coins size={16} /> : <Eye size={16} />}</div>
            <div><div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.t.p, lineHeight: 1 }}>{ticker}</div><div style={{ fontFamily: sans, fontSize: 10, color: T.t.s, maxWidth: 180 }}>{analysis.name}</div></div>
          </div>
        </div>
        <button onClick={() => onRefresh(ticker, true)} aria-label={`Refresh ${ticker} analysis`} style={{ background: "none", border: `1px solid ${T.b.s}`, color: T.t.f, cursor: "pointer", padding: 6, borderRadius: T.rad.sm }}><RefreshCw size={12} /></button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <Morph value={D(primaryPrice)} style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: T.t.p }} />
        <Morph value={pct(primaryChange)} style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: pc(primaryChange) }} />
        {held && <Badge color={T.a.cyan}>Held</Badge>}
      </div>
      <div style={{ padding: "10px 11px", borderRadius: T.rad.md, background: action.bg, border: `1px solid ${action.color}30`, marginBottom: 10 }}>
        <div style={{ fontFamily: mono, fontSize: 8, color: action.color, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 5 }}>What to do</div>
        <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: action.color, marginBottom: 5 }}>{action.label}</div>
        <div style={{ fontFamily: sans, fontSize: 11, color: T.t.s, lineHeight: 1.5 }}>{action.detail}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
        <Stat label="Signal" value={analysis.analystRating} accent={ratingColor(analysis.analystRating)} />
        <Stat label="APEX score" value={analysis.apexScore?.toFixed(1) ?? "-"} accent={scoreColor(analysis.apexScore || 0)} />
        <Stat label="Trend" value={trend.text} accent={trend.color} />
        <Stat label="Risk" value={risk.label} accent={risk.color} />
        <Stat label="30D momentum" value={analysis.mom30d != null ? pct(analysis.mom30d) : "-"} accent={pc(analysis.mom30d || 0)} />
        <Stat label="Liquidity" value={analysis.volRatio != null ? `${analysis.volRatio.toFixed(1)}x` : analysis.volume ? fmt(analysis.volume) : "-"} />
        <Stat label="Market cap" value={analysis.marketCap ? D(analysis.marketCap) : "-"} />
        <Stat label="RSI / range" value={analysis.rsi != null ? analysis.rsi.toFixed(0) : analysis.w52Position != null ? `${analysis.w52Position.toFixed(0)}%` : "-"} accent={analysis.rsi != null ? ratingColor(analysis.analystRating) : T.t.p} />
      </div>
      <div style={{ height: 1, background: T.b.s, margin: "0 0 10px" }} />
      <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>Why this rating</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        {reasons.length ? reasons.map((reason, index) => <div key={index} style={{ padding: "7px 8px", borderRadius: T.rad.sm, background: "rgba(94,161,255,0.06)", borderLeft: `2px solid ${T.a.blue}66` }}><div style={{ fontFamily: sans, fontSize: 10, color: T.t.s, lineHeight: 1.45 }}>{reason}</div></div>) : <div style={{ fontFamily: mono, fontSize: 10, color: T.t.m }}>No explanation available yet.</div>}
      </div>
      {warnings.length > 0 && <>
        <div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>What can go wrong</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {warnings.map((warning, index) => <div key={index} style={{ padding: "7px 8px", borderRadius: T.rad.sm, background: "rgba(255,77,109,0.06)", borderLeft: `2px solid ${T.r.m}66`, display: "flex", gap: 7, alignItems: "flex-start" }}><ShieldAlert size={12} color={T.r.m} style={{ flexShrink: 0, marginTop: 1 }} /><div style={{ fontFamily: sans, fontSize: 10, color: T.t.s, lineHeight: 1.45 }}>{warning}</div></div>)}
        </div>
      </>}
    </div>
  );
};

const Watchlists = ({ holdings, toast }) => {
  const [lists, setLists] = useState(() => { try { return JSON.parse(localStorage.getItem("dash_wl")) || { Main: [] }; } catch { return { Main: [] }; } });
  const [act, setAct] = useState(Object.keys(lists)[0] || "Main");
  const [addTk, setAddTk] = useState("");
  const [newL, setNewL] = useState("");
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState({});
  useEffect(() => { localStorage.setItem("dash_wl", JSON.stringify(lists)); }, [lists]);
  const tickers = useMemo(() => lists[act] || [], [lists, act]);
  useEffect(() => {
    if (!tickers.length) { setSelected(null); return; }
    if (!selected || !tickers.includes(selected)) setSelected(tickers[0]);
  }, [tickers, selected]);
  useEffect(() => {
    if (!tickers.length) return;
    setLoading(true);
    (async () => {
      const snapshot = {};
      await Promise.all(tickers.map(async (ticker) => {
        const price = await fetchPrice(ticker);
        if (price) snapshot[ticker] = price;
      }));
      setPrices((prev) => ({ ...prev, ...snapshot }));
      setLoading(false);
    })();
  }, [tickers]);
  const inspectTicker = useCallback(async (ticker, force = false) => {
    if (!ticker || detailLoading[ticker]) return;
    if (details[ticker] && !force) return;
    setDetailLoading((prev) => ({ ...prev, [ticker]: true }));
    try {
      let next = null;
      if (isC(ticker)) {
        const [priceData, chart, detail] = await Promise.all([fetchPrice(ticker), fetchChart(ticker, 90), fetchCryptoDetail(ticker)]);
        next = buildCryptoAnalysis(ticker, priceData, chart, detail);
      } else {
        const [analysis, meta] = await Promise.all([fetchSingleAnalysis(ticker), fetchStockDetail(ticker)]);
        if (analysis) {
          next = { ...analysis, marketCap: meta?.marketCap || meta?.marketCapRaw || null, volume: meta?.regularMarketVolume || meta?.averageDailyVolume3Month || null };
        } else {
          // Fallback: build a minimal stub so the ticker still renders in the action board
          // Yahoo may not have chart data for newer/niche ETFs
          next = {
            ticker, name: meta?.shortName || meta?.longName || ticker,
            price: meta?.regularMarketPrice || 0,
            changePct: meta?.regularMarketChangePercent || 0,
            signal: 'NO DATA', score: 0,
            rsi: null, sma20: null, sma50: null, trend: null,
            mom30d: null, mom90d: null, rvol: null,
            reasons: ['Yahoo Finance has no chart data for this ticker — analysis unavailable'],
            warnings: ['Price data may be limited or delayed'],
            marketCap: meta?.marketCap || null,
            volume: meta?.regularMarketVolume || null,
            _partial: true,
          };
        }
      }
      if (next) setDetails((prev) => ({ ...prev, [ticker]: next }));
      else toast?.(`Could not load analysis for ${ticker}`, "error");
    } catch {
      toast?.(`Failed to inspect ${ticker}`, "error");
    } finally {
      setDetailLoading((prev) => ({ ...prev, [ticker]: false }));
    }
  }, [detailLoading, details, toast]);
  useEffect(() => { if (selected) inspectTicker(selected); }, [selected, inspectTicker]);
  const addTo = () => {
    if (!addTk) return;
    const ticker = addTk.toUpperCase();
    setLists((prev) => ({ ...prev, [act]: [...(prev[act] || []).filter((item) => item !== ticker), ticker] }));
    setSelected(ticker);
    setAddTk("");
    toast(`${ticker} added to ${act}`, "success");
  };
  const rmFrom = (ticker) => {
    setLists((prev) => ({ ...prev, [act]: (prev[act] || []).filter((item) => item !== ticker) }));
    setDetails((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
    toast(`${ticker} removed`, "info");
  };
  const createL = () => {
    if (!newL || lists[newL]) return;
    setLists((prev) => ({ ...prev, [newL]: [] }));
    setAct(newL);
    setNewL("");
    toast(`'${newL}' created`, "success");
  };
  const deleteList = () => {
    if (Object.keys(lists).length <= 1) return;
    const next = { ...lists };
    delete next[act];
    setLists(next);
    setAct(Object.keys(next)[0]);
    toast(`'${act}' deleted`, "info");
  };
  const selectedAnalysis = selected ? details[selected] : null;
  const selectedPrice = selected ? prices[selected] : null;
  const held = selected ? holdings.find((item) => item.tk === selected) : null;
  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 80px)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes slideIn{from{transform:translateX(14px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ flex: "1 1 68%", minWidth: 0, overflow: "auto", paddingRight: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: T.rad.md, background: T.a.blue + "12", border: `1px solid ${T.a.blue}25`, display: "flex", alignItems: "center", justifyContent: "center" }}><Eye size={18} color={T.a.blue} /></div>
            <div><div style={{ fontSize: 34, fontFamily: display, fontWeight: 600, color: T.t.p, lineHeight: 0.88, letterSpacing: "0.04em" }}>Watchboard</div><div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 5 }}>Click a ticker to get a buy, hold, or avoid plan</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge color={T.a.blue}>{Object.keys(lists).length} lists</Badge>
            <Badge color={T.accent}>{tickers.length} tickers</Badge>
            {selected && selectedAnalysis && <Badge color={ratingColor(selectedAnalysis.analystRating)}>{selectedAnalysis.analystRating}</Badge>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {Object.keys(lists).map((name) => (
            <button key={name} onClick={() => setAct(name)} style={{ padding: "7px 14px", borderRadius: T.rad.sm, border: `1px solid ${act === name ? T.a.blue + "60" : T.b.s}`, background: act === name ? T.a.blue + "12" : "transparent", color: act === name ? T.a.blue : T.t.m, cursor: "pointer", fontSize: 11, fontFamily: mono, fontWeight: act === name ? 700 : 500, transition: T.tr.ceramic }}>
              {name} ({(lists[name] || []).length})
            </button>
          ))}
          <div style={{ display: "flex", gap: 5, marginLeft: 4 }}>
            <input value={newL} onChange={(event) => setNewL(event.target.value)} placeholder="New list" onKeyDown={(event) => event.key === "Enter" && createL()} style={{ padding: "7px 10px", borderRadius: T.rad.sm, border: `1px solid ${T.b.s}`, background: T.bg.deep, color: T.t.p, fontSize: 11, fontFamily: mono, width: 110 }} />
            <Btn onClick={createL} style={{ padding: "7px 10px" }} aria-label="Create new watchlist"><Plus size={12} /></Btn>
          </div>
          {Object.keys(lists).length > 1 && <button onClick={deleteList} aria-label="Delete current watchlist" style={{ padding: "6px 9px", background: "none", border: `1px solid ${T.r.m}30`, borderRadius: T.rad.sm, color: T.r.m, cursor: "pointer", fontSize: 9, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Delete list</button>}
        </div>

        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={addTk} onChange={(event) => setAddTk(event.target.value.toUpperCase())} placeholder="Add ticker (AAPL, BTC, ETH...)" onKeyDown={(event) => event.key === "Enter" && addTo()} style={{ flex: 1, padding: "10px 14px", background: T.bg.deep, border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm, color: T.t.p, fontFamily: mono, fontSize: 13 }} />
            <Btn primary onClick={addTo} title={!addTk ? "Enter a ticker first" : "Add to watchlist"}><Plus size={14} /> Add</Btn>
          </div>
        </Card>

        <Card style={{ padding: 8, minHeight: 280 }}>
          {!tickers.length ? (
            <div style={{ textAlign: "center", padding: 44, color: T.t.m, fontSize: 12, fontFamily: mono }}>Empty watchlist. Add a ticker above and this panel will turn it into a trade idea board.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tickers.map((ticker) => {
                const price = prices[ticker];
                const itemHeld = holdings.find((item) => item.tk === ticker);
                const analysis = details[ticker];
                const trend = analysis ? trendLabel(analysis.price, analysis.sma20, analysis.sma50) : null;
                const isActive = selected === ticker;
                return (
                  <button
                    key={ticker}
                    onClick={() => setSelected(ticker)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 12px", borderRadius: T.rad.md, border: `1px solid ${isActive ? T.accent + "36" : "transparent"}`, background: isActive ? T.accent + "10" : "transparent", cursor: "pointer", transition: T.tr.ceramic, textAlign: "left" }}
                    onMouseEnter={(event) => { if (!isActive) event.currentTarget.style.background = T.bg.hover; }}
                    onMouseLeave={(event) => { if (!isActive) event.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: T.rad.sm, background: isC(ticker) ? T.a.cyan + "12" : T.a.blue + "12", border: `1px solid ${(isC(ticker) ? T.a.cyan : T.a.blue)}20`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 11, fontWeight: 700, color: isC(ticker) ? T.a.cyan : T.a.blue, flexShrink: 0 }}>{ticker.slice(0, 2)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.t.p }}>{ticker}</span>
                          {itemHeld && <Badge color={T.a.cyan} style={{ fontSize: 8 }}>Held</Badge>}
                          {analysis && <Badge color={ratingColor(analysis.analystRating)} style={{ fontSize: 8 }}>{analysis.analystRating}</Badge>}
                        </div>
                        <div style={{ fontFamily: sans, fontSize: 11, color: T.t.m, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{price?.name || analysis?.name || "Loading name..."}</div>
                        {analysis && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}><span style={{ fontFamily: mono, fontSize: 9, color: scoreColor(analysis.apexScore), fontWeight: 700 }}>Score {analysis.apexScore.toFixed(1)}</span>{trend && <span style={{ fontFamily: mono, fontSize: 9, color: trend.color }}>{trend.text}</span>}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        {price ? (
                          <>
                            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.t.p }}>{D(price.price)}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>{price.changePct >= 0 ? <TrendingUp size={10} color={T.g.m} /> : <TrendingDown size={10} color={T.r.m} />}<span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: pc(price.changePct) }}>{pct(price.changePct)}</span></div>
                          </>
                        ) : <span style={{ color: T.t.m, fontSize: 11, fontFamily: mono }}>{loading ? "..." : "-"}</span>}
                      </div>
                      <button onClick={(event) => { event.stopPropagation(); rmFrom(ticker); }} aria-label={`Remove ${ticker}`} style={{ background: "none", border: "none", cursor: "pointer", color: T.t.f, padding: 4, borderRadius: T.rad.sm }}><X size={14} /></button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <div style={{ width: 330, flexShrink: 0, borderLeft: `1px solid ${T.b.s}`, background: T.fx.panel, overflow: "auto", borderRadius: `0 ${T.rad.lg}px ${T.rad.lg}px 0`, boxShadow: "inset 1px 0 0 rgba(255,255,255,0.03)" }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.b.s}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontFamily: display, fontSize: 22, color: T.t.p, lineHeight: 0.9 }}>Action Board</div><div style={{ fontFamily: mono, fontSize: 8, color: T.t.f, textTransform: "uppercase", letterSpacing: "0.16em", marginTop: 4 }}>What to do and why</div></div>
          {selected && selectedAnalysis && <Badge color={ratingColor(selectedAnalysis.analystRating)}>{selectedAnalysis.analystRating}</Badge>}
        </div>
        <Spotlight ticker={selected} analysis={selectedAnalysis} priceData={selectedPrice} held={held} loading={selected ? !!detailLoading[selected] : false} onRefresh={inspectTicker} />
      </div>
    </div>
  );
};

export default Watchlists;
