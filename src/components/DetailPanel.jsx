// src/components/DetailPanel.jsx
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { X, Trash2 } from "lucide-react";
import { T, mono, sans, pc, D, fmt, pct } from "../theme/tokens";
import { isC, fetchStockDetail, fetchCryptoDetail, fetchChart } from "../api/finance";
import { Card, CTip } from "./ui/Shared";

const DetailPanel = ({ holding, onClose, onRemove }) => {
  const [det, setDet] = useState(null); const [chart, setChart] = useState([]); const [ld, setLd] = useState(true);
  useEffect(() => { let x = false; setLd(true); (async () => { const [d, c] = await Promise.all([isC(holding.tk) ? fetchCryptoDetail(holding.tk) : fetchStockDetail(holding.tk), fetchChart(holding.tk, 30)]); if (!x) { setDet(d); setChart(c); setLd(false); } })(); return () => { x = true; }; }, [holding.tk]);

  const val = holding.qty * holding.cur, cost = holding.qty * holding.avg, pnl = val - cost, pnlP = ((holding.cur - holding.avg) / holding.avg) * 100;
  const ic = isC(holding.tk);
  const rec = det?.recommendationKey; const tH = det?.targetPriceHigh || det?.targetHighPrice; const tL = det?.targetPriceLow || det?.targetLowPrice; const tM = det?.targetMeanPrice; const aN = det?.numberOfAnalystOpinions;
  const mCap = det?.marketCap || det?.market_data?.market_cap?.usd; const pe = det?.trailingPE || det?.forwardPE; const eps = det?.epsTrailingTwelveMonths;
  const w52H = det?.fiftyTwoWeekHigh || det?.market_data?.high_24h?.usd; const w52L = det?.fiftyTwoWeekLow || det?.market_data?.low_24h?.usd;
  const vol = det?.regularMarketVolume || det?.market_data?.total_volume?.usd; const desc = det?.description?.en || det?.longBusinessSummary;
  const rank = det?.market_cap_rank; const ath = det?.market_data?.ath?.usd; const athCh = det?.market_data?.ath_change_percentage?.usd;
  const rc = r => { if (!r) return T.t.m; const l = r.toLowerCase(); return l.includes("strong buy") || l.includes("strong_buy") ? T.g.m : l.includes("buy") ? "#34d399" : l.includes("hold") ? T.w.m : l.includes("sell") ? T.r.m : T.t.m; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: "95vw", height: "100vh", background: T.bg.base, borderLeft: `1px solid ${T.b.m}`, overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ic ? T.a.cyan + "20" : T.a.blue + "20", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 13, fontWeight: 700, color: ic ? T.a.cyan : T.a.blue }}>{holding.tk.slice(0, 2)}</div>
              <div><div style={{ fontSize: 22, fontWeight: 700, fontFamily: sans, color: T.t.p }}>{holding.tk}</div><div style={{ fontSize: 13, color: T.t.m }}>{holding.nm}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: mono, color: T.t.p }}>{D(holding.cur)}</span>
              <span style={{ fontSize: 15, fontFamily: mono, color: pc(holding.ch) }}>{pct(holding.ch)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onRemove(holding.tk); onClose(); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.r.m}33`, background: T.r.bg, color: T.r.m, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: sans }}><Trash2 size={12} />Remove</button>
            <X size={20} style={{ color: T.t.m, cursor: "pointer" }} onClick={onClose} />
          </div>
        </div>

        <Card style={{ marginBottom: 16, borderLeft: `3px solid ${pc(pnl)}` }}>
          <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Your Position</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["Qty", holding.qty < 10 ? holding.qty.toFixed(4) : holding.qty, T.t.p], ["Avg Cost", D(holding.avg), T.t.p], ["Value", D(val), T.t.p], ["Cost Basis", D(cost), T.t.s], ["P&L", (pnl >= 0 ? "+" : "") + D(pnl), pc(pnl)], ["P&L %", pct(pnlP), pc(pnlP)]].map(([l, v, c], i) => <div key={i}><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>{l}</div><div style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: c }}>{v}</div></div>)}
          </div>
        </Card>

        <Card style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>30-Day Chart</div>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke={T.b.s} opacity={0.2} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: T.t.m }} interval={Math.floor(chart.length / 6)} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: T.t.m }} orientation="right" /><Tooltip content={CTip} /><Area type="monotone" dataKey="price" stroke={T.a.blue} fill={T.a.blue + "15"} strokeWidth={2} dot={false} name="Price" /></AreaChart></ResponsiveContainer>
          ) : ld ? <div style={{ textAlign: "center", padding: 30, color: T.t.m }}>Loading chart...</div> : <div style={{ color: T.t.m, fontSize: 12, textAlign: "center", padding: 20 }}>Chart unavailable</div>}
        </Card>

        {ld ? <div style={{ textAlign: "center", padding: 20, color: T.t.m }}>Loading details...</div> : <>
          {!ic && rec && (<Card style={{ marginBottom: 16, borderLeft: `3px solid ${rc(rec)}` }}>
            <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Analyst Consensus</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><div style={{ fontSize: 20, fontWeight: 700, fontFamily: sans, color: rc(rec), textTransform: "uppercase" }}>{rec.replace(/_/g, " ")}</div>{aN && <span style={{ fontSize: 12, color: T.t.m }}>({aN} analysts)</span>}</div>
            {(tM || tH || tL) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{tL && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>Low</div><div style={{ fontFamily: mono, fontSize: 14, color: T.r.m }}>{D(tL)}</div></div>}{tM && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>Mean</div><div style={{ fontFamily: mono, fontSize: 14, color: T.a.blue, fontWeight: 700 }}>{D(tM)}</div></div>}{tH && <div><div style={{ fontSize: 9, color: T.t.f, textTransform: "uppercase" }}>High</div><div style={{ fontFamily: mono, fontSize: 14, color: T.g.m }}>{D(tH)}</div></div>}</div>}
            {tM && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: T.bg.deep }}><span style={{ fontSize: 12, color: T.t.m }}>Upside: </span><span style={{ fontSize: 14, fontFamily: mono, fontWeight: 700, color: tM > holding.cur ? T.g.m : T.r.m }}>{pct(((tM - holding.cur) / holding.cur) * 100)}</span></div>}
          </Card>)}

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Key Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[mCap && ["Market Cap", "$" + fmt(mCap)], vol && ["Volume", fmt(vol)], !ic && pe && ["P/E", pe.toFixed(2)], !ic && eps && ["EPS", "$" + eps.toFixed(2)], w52H && [ic ? "24h High" : "52W High", "$" + fmt(w52H)], w52L && [ic ? "24h Low" : "52W Low", "$" + fmt(w52L)], ic && rank && ["Rank", "#" + rank], ic && ath && ["ATH", "$" + fmt(ath)], ic && athCh && ["From ATH", pct(athCh)]].filter(Boolean).map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.b.s}08` }}><span style={{ fontSize: 12, color: T.t.m }}>{k}</span><span style={{ fontSize: 12, fontFamily: mono, color: T.t.p, fontWeight: 600 }}>{v}</span></div>
              ))}
            </div>
          </Card>

          {desc && <Card><div style={{ fontSize: 11, color: T.t.m, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>About</div><div style={{ fontSize: 12, color: T.t.s, lineHeight: 1.6, fontFamily: sans, maxHeight: 140, overflow: "auto" }}>{desc.slice(0, 500)}{desc.length > 500 ? "..." : ""}</div></Card>}
        </>}
      </div>
    </div>
  );
};

export default DetailPanel;
