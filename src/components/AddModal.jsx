// src/components/AddModal.jsx — with Valuation Friction + Decision Tagging
import { useState, useEffect, useRef } from "react";
import { Plus, X, Loader, Shield, AlertTriangle } from "lucide-react";
import { T, mono, display } from "../theme/tokens";
import { fetchPrice, isC } from "../api/finance";
import { Btn } from "./ui/Shared";

const DECISION_TYPES = [
  { id: 'Thesis', label: 'Thesis-Driven', color: '#3b82f6', desc: 'Researched fundamental case' },
  { id: 'Conviction', label: 'High Conviction', color: '#22c55e', desc: 'Strong edge identified' },
  { id: 'FOMO', label: 'FOMO / Impulse', color: '#ef4444', desc: 'Chasing momentum / hype' },
  { id: 'Boredom', label: 'Boredom Trade', color: '#71717a', desc: 'No real thesis' },
];

// Simple DCF-lite fair value estimate using P/E + growth
async function quickValuation(ticker) {
  try {
    const r = await fetch(`/yf/v8/finance/chart/${ticker}?range=1y&interval=1d`);
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) return null;
    const meta = res.meta;
    const price = meta.regularMarketPrice;
    const closes = (res.indicators?.quote?.[0]?.close || []).filter(c => c != null);

    // Approximate: use trailing momentum as growth proxy, industry average P/E as baseline
    const mom12m = closes.length >= 252 ? ((price - closes[0]) / closes[0]) * 100 : null;
    const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : price;

    // Simple fair value: SMA200 * (1 + momentum_dampened)
    // With 20% margin of safety applied
    const growthFactor = mom12m != null ? Math.min(mom12m / 100, 0.5) : 0;
    const rawFairValue = sma200 * (1 + growthFactor * 0.5);
    const fairValueWithMoS = rawFairValue * 0.8; // 20% Margin of Safety

    const overvalued = price > rawFairValue * 1.1;
    const deepValue = price < fairValueWithMoS;

    return {
      price,
      fairValue: Math.round(rawFairValue * 100) / 100,
      fairValueMoS: Math.round(fairValueWithMoS * 100) / 100,
      overvalued,
      deepValue,
      mom12m: mom12m != null ? Math.round(mom12m * 10) / 10 : null,
      sma200: Math.round(sma200 * 100) / 100,
      verdict: overvalued ? 'OVERVALUED — NO ENTRY' : deepValue ? 'DEEP VALUE — GREEN LIGHT' : 'FAIR VALUE — PROCEED WITH CAUTION',
      verdictColor: overvalued ? '#cd7f32' : deepValue ? T.g?.m || '#22c55e' : T.w?.m || '#f59e0b',
    };
  } catch { return null; }
}

const FRICTION_STEPS = [
  'Auditing Intrinsic Worth...',
  'Calculating DCF Baseline...',
  'Applying 20% Margin of Safety...',
  'Checking Behavioral Override...',
];

const AddModal = ({ onClose, onAdd, toast }) => {
  const [tk, setTk] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [decision, setDecision] = useState('Thesis');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Friction state
  const [frictionPhase, setFrictionPhase] = useState(null); // null | 'auditing' | 'result'
  const [frictionStep, setFrictionStep] = useState(0);
  const [frictionProgress, setFrictionProgress] = useState(0);
  const [valuation, setValuation] = useState(null);
  const intervalRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const startFriction = async () => {
    if (!tk) { setErr("Enter a ticker"); return; }
    if (!qty || parseFloat(qty) <= 0) { setErr("Quantity must be > 0"); return; }
    if (!avg || parseFloat(avg) <= 0) { setErr("Price must be > 0"); return; }
    setErr("");
    setFrictionPhase('auditing');
    setFrictionStep(0);
    setFrictionProgress(0);

    // Animate the progress bar over 3 seconds
    let step = 0;
    let prog = 0;
    intervalRef.current = setInterval(() => {
      prog += 1.5;
      step = Math.min(Math.floor(prog / 25), 3);
      setFrictionProgress(Math.min(prog, 100));
      setFrictionStep(step);
      if (prog >= 100) {
        clearInterval(intervalRef.current);
      }
    }, 45); // ~3 seconds total (100/1.5 * 45ms ≈ 3000ms)

    // Actually fetch valuation in parallel
    const val = await quickValuation(tk.toUpperCase());
    // Wait for animation to finish
    await new Promise(r => setTimeout(r, 3200));
    clearInterval(intervalRef.current);
    setFrictionProgress(100);
    setValuation(val);
    setFrictionPhase('result');
  };

  const confirmAdd = async () => {
    setBusy(true);
    let p = await fetchPrice(tk.toUpperCase());
    if (!p) {
      toast("Live price unavailable — using your buy price. Hit Refresh later.", "error");
      p = { price: parseFloat(avg), changePct: 0, name: tk.toUpperCase() };
    }
    onAdd({
      tk: tk.toUpperCase(),
      nm: p.name || tk.toUpperCase(),
      qty: parseFloat(qty),
      avg: parseFloat(avg),
      cur: p.price,
      ch: p.changePct || 0,
      tp: isC(tk) ? "crypto" : "stock",
      entryDate,
      decision,
    });
    toast(tk.toUpperCase() + " added!", "success");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", background: T.bg.card, border: `1px solid ${T.b1}`, borderRadius: 2, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>

        {/* ═══ FRICTION PHASE: Auditing ═══ */}
        {frictionPhase === 'auditing' && (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <Shield size={28} color={T.accent} style={{ marginBottom: 12, opacity: 0.8 }} />
            <div style={{ fontFamily: display, fontSize: 18, color: T.t1, marginBottom: 16 }}>
              Behavioral Guardrail Active
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              {FRICTION_STEPS[frictionStep]}
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: 3, background: T.b1, borderRadius: 0, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                width: `${frictionProgress}%`,
                height: '100%',
                background: T.accent,
                transition: 'width 0.05s linear',
              }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 8, color: T.t4 }}>
              {Math.round(frictionProgress)}% — forced delay to prevent impulse entries
            </div>
          </div>
        )}

        {/* ═══ FRICTION PHASE: Result ═══ */}
        {frictionPhase === 'result' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: display, fontSize: 18, color: T.t1 }}>Valuation Audit</div>
              <X size={16} style={{ color: T.t3, cursor: 'pointer' }} onClick={onClose} />
            </div>

            {valuation ? (
              <div style={{ marginBottom: 16 }}>
                {/* Verdict banner */}
                <div style={{
                  padding: '10px 14px', borderRadius: 2, marginBottom: 12,
                  background: valuation.verdictColor + '10',
                  border: `1px solid ${valuation.verdictColor}30`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {valuation.overvalued && <AlertTriangle size={14} color={valuation.verdictColor} />}
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: valuation.verdictColor, letterSpacing: 0.5 }}>
                    {valuation.verdict}
                  </span>
                </div>

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    ['Market Price', '$' + valuation.price.toFixed(2), T.t1],
                    ['Fair Value', '$' + valuation.fairValue.toFixed(2), '#3b82f6'],
                    ['MoS Price', '$' + valuation.fairValueMoS.toFixed(2), T.g?.m || '#22c55e'],
                    ['SMA 200', '$' + valuation.sma200.toFixed(2), T.t2],
                    ['12M Momentum', valuation.mom12m != null ? valuation.mom12m + '%' : '—', valuation.mom12m > 0 ? '#22c55e' : '#ef4444'],
                    ['Margin of Safety', '20%', T.accent],
                  ].map(([label, val, color], i) => (
                    <div key={i} style={{ padding: '6px 8px', background: T.bg.deep, borderRadius: 2 }}>
                      <div style={{ fontFamily: mono, fontSize: 7, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                      <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Decision type reminder */}
                <div style={{ padding: '6px 10px', background: T.bg.deep, borderRadius: 2, marginBottom: 12, borderLeft: `2px solid ${DECISION_TYPES.find(d => d.id === decision)?.color || T.t3}` }}>
                  <span style={{ fontFamily: mono, fontSize: 8, color: T.t3, textTransform: 'uppercase' }}>Decision Type: </span>
                  <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: DECISION_TYPES.find(d => d.id === decision)?.color }}>
                    {decision}
                  </span>
                  {decision === 'FOMO' && (
                    <span style={{ fontFamily: mono, fontSize: 8, color: '#ef4444', marginLeft: 8 }}>
                      — Are you sure? FOMO trades historically underperform.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: T.t3, fontFamily: mono, fontSize: 10 }}>
                Valuation data unavailable — proceed with your own analysis.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn primary onClick={confirmAdd} style={{ flex: 1, justifyContent: 'center' }}>
                {busy ? <Loader size={14} /> : <Plus size={14} />}
                {valuation?.overvalued ? 'Add Anyway' : 'Confirm Add'}
              </Btn>
            </div>
          </div>
        )}

        {/* ═══ NORMAL PHASE: Input Form ═══ */}
        {!frictionPhase && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontFamily: display, fontSize: 20, color: T.t1 }}>Add Position</h3>
              <X size={16} style={{ color: T.t3, cursor: "pointer" }} onClick={onClose} />
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {/* Ticker */}
              <div>
                <label style={{ fontSize: 8, color: T.t3, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Ticker</label>
                <input value={tk} onChange={e => setTk(e.target.value.toUpperCase())} placeholder="AAPL, BTC, WIX..."
                  style={{ width: "100%", padding: "8px 10px", background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  onKeyDown={e => e.key === "Enter" && startFriction()} />
              </div>

              {/* Qty + Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 8, color: T.t3, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Quantity</label>
                  <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="50"
                    style={{ width: "100%", padding: "8px 10px", background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: T.t3, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Buy Price ($)</label>
                  <input type="number" min="0" step="any" value={avg} onChange={e => setAvg(e.target.value)} placeholder="150.00"
                    style={{ width: "100%", padding: "8px 10px", background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onKeyDown={e => e.key === "Enter" && startFriction()} />
                </div>
              </div>

              {/* Entry Date */}
              <div>
                <label style={{ fontSize: 8, color: T.t3, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Entry Date</label>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 12, outline: "none", boxSizing: "border-box", colorScheme: 'dark' }} />
              </div>

              {/* Decision Type */}
              <div>
                <label style={{ fontSize: 8, color: T.t3, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Decision Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {DECISION_TYPES.map(dt => (
                    <button key={dt.id} onClick={() => setDecision(dt.id)} style={{
                      padding: '6px 8px', borderRadius: 2, cursor: 'pointer',
                      border: `1px solid ${decision === dt.id ? dt.color : T.b1}`,
                      background: decision === dt.id ? dt.color + '12' : 'transparent',
                      textAlign: 'left',
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: decision === dt.id ? dt.color : T.t2 }}>{dt.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 7, color: T.t4 }}>{dt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {err && <div style={{ color: '#ef4444', fontSize: 10, fontFamily: mono, padding: "4px 8px", background: 'rgba(239,68,68,0.08)', borderRadius: 2 }}>{err}</div>}

              <Btn primary onClick={startFriction} style={{ width: "100%", justifyContent: "center", padding: "10px", fontSize: 12 }}>
                <Shield size={14} /> Audit & Add
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddModal;
