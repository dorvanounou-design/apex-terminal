// src/App.jsx — APEX Obsidian Shell
import { useState, useEffect, useRef, useCallback } from "react";
import { Briefcase, Crosshair, Lightbulb, Shield, Eye, Globe, ChevronLeft, ChevronRight, FlaskConical, Search } from "lucide-react";
import { T, mono, sans, display } from "./theme/tokens";
import { useToasts } from "./hooks/useToasts";
import { Toasts, ErrorBoundary } from "./components/ui/Shared";
import Portfolio from "./components/Portfolio";
import Scanner from "./components/Scanner";
import Recommendations from "./components/Recommendations";
import Watchlists from "./components/Watchlists";
import RiskMod from "./components/Risk";
import MarketMod from "./components/Market";
import Backtester from "./components/Backtester";

const NAV = [
  { id: "portfolio", lb: "Portfolio", ic: Briefcase },
  { id: "scanner", lb: "Scanner", ic: Crosshair },
  { id: "recs", lb: "Signals", ic: Lightbulb },
  { id: "watch", lb: "Watchlists", ic: Eye },
  { id: "risk", lb: "Risk", ic: Shield },
  { id: "market", lb: "Market", ic: Globe },
  { id: "backtest", lb: "Backtest", ic: FlaskConical },
];

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function App() {
  const [mod, setMod] = useState("portfolio");
  const [col, setCol] = useState(false);
  const DEFAULT_HOLDINGS = [
    { tk: "BITW", nm: "Bitwise 10 Crypto Index Fund", qty: 6, avg: 27.00, cur: 43.35, ch: -3.39, tp: "stock", entryDate: "2024-06-15", decision: "Thesis" },
    { tk: "CMTL", nm: "Comtech Telecom", qty: 26, avg: 3.56, cur: 3.10, ch: -7.74, tp: "stock", entryDate: "2025-08-01", decision: "Thesis" },
    { tk: "CZOOF", nm: "CZO Resources", qty: 5, avg: 7.86, cur: 0.0005, ch: 0, tp: "stock", entryDate: "2024-01-15", decision: "FOMO" },
    { tk: "HMY", nm: "Harmony Gold", qty: 1, avg: 4.00, cur: 14.34, ch: 2.87, tp: "stock", entryDate: "2023-09-01", decision: "Thesis" },
    { tk: "METV", nm: "Roundhill Ball Metaverse", qty: 40, avg: 16.06, cur: 15.23, ch: -2.06, tp: "stock", entryDate: "2025-10-01", decision: "Conviction" },
    { tk: "RBLX", nm: "Roblox Corp", qty: 5, avg: 59.85, cur: 52.31, ch: -2.86, tp: "stock", entryDate: "2025-11-01", decision: "Conviction" },
    { tk: "SMH", nm: "VanEck Semiconductor", qty: 1, avg: 244.15, cur: 374.25, ch: -1.73, tp: "stock", entryDate: "2024-03-01", decision: "Thesis" },
    { tk: "VWO", nm: "Vanguard Emerging Mkts", qty: 1, avg: 52.08, cur: 52.49, ch: -0.68, tp: "stock", entryDate: "2025-12-01", decision: "Boredom" },
    { tk: "WULF", nm: "TeraWulf Inc", qty: 25, avg: 2.17, cur: 14.89, ch: -3.00, tp: "stock", entryDate: "2023-06-01", decision: "Thesis" },
  ];
  const [holdings, setHoldings] = useState([]);
  const [cash, setCash] = useState(() => {
    const saved = localStorage.getItem("dashboard_cash");
    return saved ? parseFloat(saved) : 577.65;
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const cmdRef = useRef(null);
  const { toasts, add: toast } = useToasts();
  const clock = useClock();

  useEffect(() => { const s = localStorage.getItem("dashboard_holdings"); if (s) { try { const parsed = JSON.parse(s); setHoldings(parsed.length > 0 ? parsed : DEFAULT_HOLDINGS); } catch { setHoldings(DEFAULT_HOLDINGS); } } else { setHoldings(DEFAULT_HOLDINGS); } }, []);
  useEffect(() => { localStorage.setItem("dashboard_holdings", JSON.stringify(holdings)); }, [holdings]);
  useEffect(() => { localStorage.setItem("dashboard_cash", cash.toString()); }, [cash]);

  // Global keyboard shortcuts: Ctrl+K (palette), Cmd+1-8 (modules), Esc (close)
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+K or Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
        setCmdQuery('');
        return;
      }
      // Escape — close palette
      if (e.key === 'Escape' && cmdOpen) {
        setCmdOpen(false);
        return;
      }
      // Cmd/Ctrl + 1-8 — module switching
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (NAV[idx]) setMod(NAV[idx].id);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen]);

  // Focus command input when opened
  useEffect(() => {
    if (cmdOpen) setTimeout(() => cmdRef.current?.focus(), 50);
  }, [cmdOpen]);

  // Command palette results
  const cmdResults = cmdQuery.trim()
    ? NAV.filter(n => n.lb.toLowerCase().includes(cmdQuery.toLowerCase()))
    : NAV;

  const render = () => {
    switch (mod) {
      case "portfolio": return <Portfolio holdings={holdings} setHoldings={setHoldings} cash={cash} setCash={setCash} toast={toast} />;
      case "scanner": return <Scanner toast={toast} />;
      case "recs": return <Recommendations toast={toast} />;
      case "watch": return <Watchlists holdings={holdings} toast={toast} />;
      case "risk": return <RiskMod holdings={holdings} cash={cash} />;
      case "market": return <MarketMod />;
      case "backtest": return <Backtester />;
      default: return <Portfolio holdings={holdings} setHoldings={setHoldings} cash={cash} setCash={setCash} toast={toast} />;
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: T.fx.shell, color: T.t.p, fontFamily: sans }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg.base};color:${T.t.p};font-family:${sans}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.b1};border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:${T.b2}}
        input,select,textarea{outline:none}
        input:focus,select:focus,textarea:focus{border-color:${T.accent}!important;box-shadow:0 0 0 1px ${T.accent}25}
        button:focus-visible{outline:1px solid ${T.accent};outline-offset:2px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes shellFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-14px,0)}}
        .me{animation:fadeIn 0.2s ease-out}
        @media(max-width:900px){nav{position:fixed!important;z-index:100;height:100vh}}
        @media(max-width:640px){.me table{font-size:9px!important}.me table th,.me table td{padding:4px 4px!important}}
      `}</style>
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(180deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "140px 140px",
        maskImage: "linear-gradient(180deg, rgba(0,0,0,0.45), transparent 88%)",
        opacity: 0.2,
      }} />
      <div style={{
        position: "absolute",
        top: -120,
        right: -80,
        width: 360,
        height: 360,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,230,255,0.18), transparent 62%)",
        filter: "blur(24px)",
        pointerEvents: "none",
        animation: "shellFloat 12s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        bottom: -160,
        left: -110,
        width: 420,
        height: 420,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,214,160,0.14), transparent 62%)",
        filter: "blur(34px)",
        pointerEvents: "none",
        animation: "shellFloat 16s ease-in-out infinite reverse",
      }} />
      <Toasts toasts={toasts} />

      {/* Command Palette (Ctrl+K) */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '18vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 420, background: T.bg.card, border: `1px solid ${T.b.s}`,
              borderRadius: T.rad.lg, overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.b.s}` }}>
              <Search size={14} color={T.t.m} />
              <input
                ref={cmdRef}
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                placeholder="Navigate to..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && cmdResults.length > 0) {
                    setMod(cmdResults[0].id);
                    setCmdOpen(false);
                  }
                }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: mono, fontSize: 13, color: T.t.p,
                }}
              />
              <kbd style={{
                padding: '2px 6px', borderRadius: 3, background: T.bg.el,
                fontFamily: mono, fontSize: 9, color: T.t.f, border: `1px solid ${T.b.s}`,
              }}>ESC</kbd>
            </div>
            {/* Results */}
            <div style={{ padding: '6px 0', maxHeight: 300, overflow: 'auto' }}>
              {cmdResults.map((n, i) => (
                <button key={n.id} onClick={() => { setMod(n.id); setCmdOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: i === 0 && cmdQuery ? T.accent + '10' : 'transparent',
                  color: i === 0 && cmdQuery ? T.accent : T.t.s,
                  fontFamily: mono, fontSize: 12, transition: T.tr.fast,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.bg.hover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = i === 0 && cmdQuery ? T.accent + '10' : 'transparent'; }}
                >
                  <n.ic size={14} style={{ opacity: 0.6 }} />
                  <span style={{ fontWeight: mod === n.id ? 700 : 400 }}>{n.lb}</span>
                  {mod === n.id && <span style={{ fontSize: 8, color: T.accent, marginLeft: 'auto' }}>active</span>}
                  <kbd style={{
                    marginLeft: 'auto', padding: '1px 5px', borderRadius: 3, background: T.bg.el,
                    fontFamily: mono, fontSize: 8, color: T.t.f, border: `1px solid ${T.b.s}`,
                  }}>⌘{NAV.indexOf(n) + 1}</kbd>
                </button>
              ))}
            </div>
            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${T.b.s}`, display: 'flex', gap: 12 }}>
              {[['↑↓', 'Navigate'], ['↵', 'Open'], ['esc', 'Close']].map(([k, l]) => (
                <span key={k} style={{ fontSize: 9, fontFamily: mono, color: T.t.f }}>
                  <kbd style={{ padding: '1px 4px', borderRadius: 2, background: T.bg.el, marginRight: 3, border: `1px solid ${T.b.s}` }}>{k}</kbd>{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar — Obsidian dark */}
      <nav style={{
        width: col ? 58 : 194, flexShrink: 0, display: "flex", flexDirection: "column",
        background: T.fx.panel, borderRight: `1px solid ${T.b.s}`,
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.02)",
        backdropFilter: "blur(18px)",
        transition: "width 0.25s ease",
      }}>
        {/* Brand */}
        <div style={{
          padding: col ? "18px 13px" : "18px 18px",
          borderBottom: `1px solid ${T.b.s}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: T.rad.md,
            background: `linear-gradient(135deg, ${T.acid}, ${T.accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: `${T.shadow.glow(T.accent2)}, inset 0 1px 0 rgba(255,255,255,0.28)`,
          }}>
            <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: '#06060a' }}>A</span>
          </div>
          {!col && (
            <div>
              <span style={{ fontSize: 23, fontWeight: 600, color: T.t.p, fontFamily: display, letterSpacing: "0.08em", lineHeight: 0.9 }}>APEX</span>
              <div style={{ fontSize: 7, color: T.t.f, letterSpacing: '0.28em', fontFamily: mono, marginTop: 3 }}>TRADER COCKPIT</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(it => { const a = mod === it.id; return (
            <button key={it.id} onClick={() => setMod(it.id)} aria-label={it.lb} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
              borderRadius: T.rad.sm, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
              background: a ? `linear-gradient(90deg, ${T.accent}18, ${T.accent}08)` : "transparent",
              color: a ? T.accent : T.t.m,
              transition: T.tr.fast,
              justifyContent: col ? "center" : "flex-start",
              fontFamily: mono, position: 'relative',
            }}
              onMouseEnter={e => { if (!a) e.currentTarget.style.background = T.bg.hover; e.currentTarget.style.color = a ? T.accent : T.t.s; }}
              onMouseLeave={e => { e.currentTarget.style.background = a ? T.accent + '10' : 'transparent'; e.currentTarget.style.color = a ? T.accent : T.t.m; }}
            >
              {a && <div style={{
                position: 'absolute', left: 0, top: '22%', bottom: '22%', width: 3,
                background: T.accent, borderRadius: '0 3px 3px 0',
                boxShadow: `0 0 8px ${T.accent}40`,
              }} />}
              <it.ic size={15} style={{ flexShrink: 0 }} />
              {!col && <span style={{ fontSize: 11, fontWeight: a ? 700 : 400, letterSpacing: 0.3 }}>{it.lb}</span>}
            </button>
          ); })}
        </div>

        {/* Collapse */}
        <button onClick={() => setCol(!col)} aria-label={col ? "Expand sidebar" : "Collapse sidebar"} style={{
          padding: 12, border: "none", borderTop: `1px solid ${T.b.s}`,
          background: "transparent", color: T.t.f, cursor: "pointer",
          display: "flex", justifyContent: "center", transition: T.tr.fast,
        }}
          onMouseEnter={e => e.currentTarget.style.color = T.t.m}
          onMouseLeave={e => e.currentTarget.style.color = T.t.f}
        >
          {col ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header bar */}
        <header style={{
          height: 54, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 22px", borderBottom: `1px solid ${T.b.s}`,
          background: "linear-gradient(180deg, rgba(8,10,16,0.94), rgba(8,10,16,0.86))",
          backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.acid, boxShadow: `0 0 12px ${T.acid}80`, animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontSize: 10, color: T.t.m, fontFamily: mono, letterSpacing: "0.18em", textTransform: "uppercase" }}>APEX TERMINAL</span>
            <span style={{
              fontSize: 8, color: T.accent2, fontFamily: mono, fontWeight: 600,
              padding: '3px 7px', borderRadius: T.rad.pill, background: T.accent2 + '12',
              border: `1px solid ${T.accent2}24`,
            }}>LIVE SHELL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: T.rad.pill,
              border: `1px solid ${T.b.s}`, background: T.bg.panel,
            }}>
              <span style={{ fontSize: 8, color: T.t.f, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Mode</span>
              <span style={{ fontSize: 10, color: T.t.p, fontFamily: mono, fontWeight: 700 }}>{NAV.find(n => n.id === mod)?.lb}</span>
            </div>
            <span style={{ fontSize: 10, color: T.t.f, fontFamily: mono }}>
              {clock.toLocaleDateString("en", { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span style={{ fontSize: 11, color: T.t.s, fontFamily: mono, fontWeight: 600, letterSpacing: '0.04em' }}>
              {clock.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </header>

        {/* Module content */}
        <main style={{ flex: 1, overflow: "auto", padding: 22 }}>
          <ErrorBoundary>
            <div key={mod} className="me">{render()}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
