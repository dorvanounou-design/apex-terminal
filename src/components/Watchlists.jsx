// src/components/Watchlists.jsx
import { useState, useEffect } from "react";
import { Eye, Plus, X } from "lucide-react";
import { T, mono, sans, pc, D, pct } from "../theme/tokens";
import { fetchPrice, isC } from "../api/finance";
import { Card, Badge, Btn } from "./ui/Shared";

const Watchlists = ({ holdings, toast }) => {
  const [lists, setLists] = useState(() => { try { return JSON.parse(localStorage.getItem("dash_wl")) || { "Main": [] }; } catch { return { "Main": [] }; } });
  const [act, setAct] = useState(Object.keys(lists)[0] || "Main");
  const [addTk, setAddTk] = useState(""); const [newL, setNewL] = useState("");
  const [prices, setPrices] = useState({});
  useEffect(() => { localStorage.setItem("dash_wl", JSON.stringify(lists)); }, [lists]);
  useEffect(() => { const tks = lists[act] || []; if (!tks.length) return; (async () => { const ps = {}; await Promise.all(tks.map(async tk => { const p = await fetchPrice(tk); if (p) ps[tk] = p; })); setPrices(prev => ({ ...prev, ...ps })); })(); }, [act, lists]);
  const addTo = () => { if (!addTk) return; const tk = addTk.toUpperCase(); setLists(p => ({ ...p, [act]: [...(p[act] || []).filter(t => t !== tk), tk] })); setAddTk(""); toast(tk + " added to " + act, "success"); };
  const rmFrom = tk => setLists(p => ({ ...p, [act]: (p[act] || []).filter(t => t !== tk) }));
  const createL = () => { if (!newL) return; setLists(p => ({ ...p, [newL]: [] })); setAct(newL); setNewL(""); toast("'" + newL + "' created", "success"); };
  return (
    <div>
      <h2 style={{ fontSize: 18, fontFamily: sans, fontWeight: 600, color: T.t.p, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px" }}><Eye size={18} color={T.a.blue} />Watchlists</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {Object.keys(lists).map(n => <button key={n} onClick={() => setAct(n)} style={{ padding: "5px 12px", borderRadius: 5, border: `1px solid ${act === n ? T.a.blue : T.b.s}`, background: act === n ? T.a.blue + "15" : "transparent", color: act === n ? T.a.blue : T.t.m, cursor: "pointer", fontSize: 11, fontFamily: sans }}>{n} ({(lists[n] || []).length})</button>)}
        <div style={{ display: "flex", gap: 4 }}><input value={newL} onChange={e => setNewL(e.target.value)} placeholder="New list..." style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${T.b.s}`, background: T.bg.deep, color: T.t.p, fontSize: 11, fontFamily: sans, width: 100, outline: "none", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && createL()} /><Btn onClick={createL} style={{ padding: "5px 8px", fontSize: 11 }}><Plus size={12} /></Btn></div>
      </div>
      <Card>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input value={addTk} onChange={e => setAddTk(e.target.value.toUpperCase())} placeholder="Add ticker..." style={{ flex: 1, padding: "8px 12px", background: T.bg.deep, border: `1px solid ${T.b.s}`, borderRadius: 7, color: T.t.p, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && addTo()} />
          <Btn primary onClick={addTo}><Plus size={14} /> Add</Btn>
        </div>
        {(lists[act] || []).length === 0 ? <div style={{ textAlign: "center", padding: 30, color: T.t.m, fontSize: 12 }}>Empty — add tickers above</div> : (lists[act] || []).map(tk => { const p = prices[tk]; const held = holdings.find(x => x.tk === tk); return (
          <div key={tk} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", borderRadius: 7, borderBottom: `1px solid ${T.b.s}08` }} onMouseEnter={e => e.currentTarget.style.background = T.bg.el} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 6, background: isC(tk) ? T.a.cyan + "15" : T.a.blue + "15", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 10, fontWeight: 700, color: isC(tk) ? T.a.cyan : T.a.blue }}>{tk.slice(0, 2)}</div><div><div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: T.t.p }}>{tk}</div>{p && <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m }}>{p.name}</div>}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{p ? <><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: T.t.p }}>{D(p.price)}</span><span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: pc(p.changePct), minWidth: 55, textAlign: "right" }}>{pct(p.changePct)}</span></> : <span style={{ color: T.t.m, fontSize: 11 }}>—</span>}{held && <Badge color={T.a.cyan}>Held</Badge>}<button onClick={() => rmFrom(tk)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t.f, padding: 2 }}><X size={14} /></button></div>
          </div>
        ); })}
      </Card>
    </div>
  );
};

export default Watchlists;
