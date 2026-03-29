// src/App.jsx
import { useState, useEffect } from "react";
import { Briefcase, Crosshair, Lightbulb, Shield, Eye, Globe, ChevronLeft, ChevronRight, LayoutGrid, FlaskConical } from "lucide-react";
import { T, mono, sans } from "./theme/tokens";
import { useToasts } from "./hooks/useToasts";
import { Toasts } from "./components/ui/Shared";
import Portfolio from "./components/Portfolio";
import Scanner from "./components/Scanner";
import Recommendations from "./components/Recommendations";
import Heatmap from "./components/Heatmap";
import Watchlists from "./components/Watchlists";
import RiskMod from "./components/Risk";
import MarketMod from "./components/Market";
import Backtester from "./components/Backtester";

const NAV = [
  { id: "portfolio", lb: "Portfolio", ic: Briefcase },
  { id: "scanner", lb: "Scanner", ic: Crosshair },
  { id: "recs", lb: "Signals", ic: Lightbulb },
  { id: "heatmap", lb: "Heatmap", ic: LayoutGrid },
  { id: "watch", lb: "Watchlists", ic: Eye },
  { id: "risk", lb: "Risk", ic: Shield },
  { id: "market", lb: "Market", ic: Globe },
  { id: "backtest", lb: "Backtest", ic: FlaskConical },
];

export default function App() {
  const [mod, setMod] = useState("portfolio");
  const [col, setCol] = useState(false);
  const [holdings, setHoldings] = useState([]);
  const [cash] = useState(15420.50);
  const { toasts, add: toast } = useToasts();

  useEffect(() => { const s = localStorage.getItem("dashboard_holdings"); if (s) { try { setHoldings(JSON.parse(s)); } catch { } } }, []);
  useEffect(() => { localStorage.setItem("dashboard_holdings", JSON.stringify(holdings)); }, [holdings]);

  const render = () => {
    switch (mod) {
      case "portfolio": return <Portfolio holdings={holdings} setHoldings={setHoldings} cash={cash} toast={toast} />;
      case "scanner": return <Scanner toast={toast} />;
      case "recs": return <Recommendations toast={toast} />;
      case "heatmap": return <Heatmap />;
      case "watch": return <Watchlists holdings={holdings} toast={toast} />;
      case "risk": return <RiskMod holdings={holdings} cash={cash} />;
      case "market": return <MarketMod />;
      case "backtest": return <Backtester />;
      default: return <Portfolio holdings={holdings} setHoldings={setHoldings} cash={cash} toast={toast} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: T.bg.base, color: T.t.p, fontFamily: mono }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.b1};border-radius:0}
        input[type="number"]{outline:none}
        input[type="number"]:focus{border-color:${T.accent}!important}
        select{outline:none}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .me{animation:fadeIn 0.15s ease-out}
        @media(max-width:900px){nav{position:fixed!important;z-index:100;height:100vh}}
        @media(max-width:640px){.me table{font-size:9px!important}.me table th,.me table td{padding:4px 4px!important}}
      `}</style>
      <Toasts toasts={toasts} />

      {/* Sidebar — industrial, no gradients */}
      <nav style={{ width: col ? 48 : 160, flexShrink: 0, display: "flex", flexDirection: "column", background: T.bgDeep, borderRight: `1px solid ${T.b1}`, transition: "width 0.15s ease" }}>
        {/* Brand */}
        <div style={{ padding: col ? "12px 8px" : "12px 14px", borderBottom: `1px solid ${T.b1}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 2,
            background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 800, color: '#000' }}>A</span>
          </div>
          {!col && (
            <span style={{ fontSize: 13, fontWeight: 800, color: T.t1, fontFamily: mono, letterSpacing: "0.12em" }}>APEX</span>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: "8px 4px", display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV.map(it => { const a = mod === it.id; return (
            <button key={it.id} onClick={() => setMod(it.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 2,
              border: "none", cursor: "pointer", width: "100%", textAlign: "left",
              background: a ? T.accent + '15' : "transparent",
              color: a ? T.accent : T.t3,
              transition: "all 0.1s ease",
              justifyContent: col ? "center" : "flex-start",
              fontFamily: mono,
            }}>
              <it.ic size={14} style={{ flexShrink: 0 }} />
              {!col && <span style={{ fontSize: 10, fontWeight: a ? 700 : 400, letterSpacing: 0.5 }}>{it.lb}</span>}
            </button>
          ); })}
        </div>

        {/* Collapse */}
        <button onClick={() => setCol(!col)} style={{ padding: 10, border: "none", borderTop: `1px solid ${T.b1}`, background: "transparent", color: T.t4, cursor: "pointer", display: "flex", justifyContent: "center" }}>
          {col ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header — minimal */}
        <header style={{
          height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", borderBottom: `1px solid ${T.b1}`,
          background: T.bgDeep,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: 0, background: T.accent }} />
            <span style={{ fontSize: 9, color: T.t3, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase" }}>APEX TERMINAL</span>
          </div>
          <span style={{ fontSize: 9, color: T.t3, fontFamily: mono }}>{new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </header>

        {/* Module content */}
        <main style={{ flex: 1, overflow: "auto", padding: 14 }}>
          <div key={mod} className="me">{render()}</div>
        </main>
      </div>
    </div>
  );
}
