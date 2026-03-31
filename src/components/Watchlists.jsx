// src/components/Watchlists.jsx — v2
import { useState, useEffect } from "react";
import { Eye, Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { T, mono, pc, D, pct } from "../theme/tokens";
import { fetchPrice, isC } from "../api/finance";
import { Card, Badge, Btn } from "./ui/Shared";

const Watchlists = ({ holdings, toast }) => {
  const [lists, setLists] = useState(() => { try { return JSON.parse(localStorage.getItem("dash_wl")) || { "Main": [] }; } catch { return { "Main": [] }; } });
  const [act, setAct] = useState(Object.keys(lists)[0] || "Main");
  const [addTk, setAddTk] = useState("");
  const [newL, setNewL] = useState("");
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { localStorage.setItem("dash_wl", JSON.stringify(lists)); }, [lists]);

  useEffect(() => {
    const tks = lists[act] || [];
    if (!tks.length) return;
    setLoading(true);
    (async () => {
      const ps = {};
      await Promise.all(tks.map(async tk => { const p = await fetchPrice(tk); if (p) ps[tk] = p; }));
      setPrices(prev => ({ ...prev, ...ps }));
      setLoading(false);
    })();
  }, [act, lists]);

  const addTo = () => {
    if (!addTk) return;
    const tk = addTk.toUpperCase();
    setLists(p => ({ ...p, [act]: [...(p[act] || []).filter(t => t !== tk), tk] }));
    setAddTk("");
    toast(tk + " added to " + act, "success");
  };
  const rmFrom = tk => setLists(p => ({ ...p, [act]: (p[act] || []).filter(t => t !== tk) }));
  const createL = () => {
    if (!newL) return;
    setLists(p => ({ ...p, [newL]: [] }));
    setAct(newL); setNewL("");
    toast("'" + newL + "' created", "success");
  };
  const deleteList = () => {
    if (Object.keys(lists).length <= 1) return;
    const rest = { ...lists };
    delete rest[act];
    setLists(rest);
    setAct(Object.keys(rest)[0]);
    toast("'" + act + "' deleted", "info");
  };

  const tickers = lists[act] || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: T.rad.md,
          background: T.a.blue + '12', border: `1px solid ${T.a.blue}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Eye size={18} color={T.a.blue} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontFamily: mono, fontWeight: 700, color: T.t.p, lineHeight: 1 }}>Watchlists</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: T.t.m, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
            {Object.keys(lists).length} lists &bull; {tickers.length} tickers
          </div>
        </div>
      </div>

      {/* List tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {Object.keys(lists).map(n => (
          <button key={n} onClick={() => setAct(n)} style={{
            padding: "6px 14px", borderRadius: T.rad.sm,
            border: `1px solid ${act === n ? T.a.blue + '60' : T.b.s}`,
            background: act === n ? T.a.blue + "12" : "transparent",
            color: act === n ? T.a.blue : T.t.m,
            cursor: "pointer", fontSize: 11, fontFamily: mono, fontWeight: act === n ? 700 : 400,
            transition: T.tr.fast,
          }}>{n} ({(lists[n] || []).length})</button>
        ))}
        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          <input value={newL} onChange={e => setNewL(e.target.value)} placeholder="New list..."
            onKeyDown={e => e.key === "Enter" && createL()}
            style={{
              padding: "6px 10px", borderRadius: T.rad.sm, border: `1px solid ${T.b.s}`,
              background: T.bg.deep, color: T.t.p, fontSize: 11, fontFamily: mono,
              width: 110, outline: "none", boxSizing: "border-box",
            }} />
          <Btn onClick={createL} style={{ padding: "6px 10px" }} aria-label="Add ticker"><Plus size={12} /></Btn>
        </div>
        {Object.keys(lists).length > 1 && (
          <button onClick={deleteList} aria-label="Delete list" style={{
            padding: '4px 8px', background: 'none', border: `1px solid ${T.r.m}30`,
            borderRadius: T.rad.sm, color: T.r.m, cursor: 'pointer', fontSize: 9, fontFamily: mono,
          }}>Delete list</button>
        )}
      </div>

      <Card style={{ padding: 14 }}>
        {/* Add ticker input */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={addTk} onChange={e => setAddTk(e.target.value.toUpperCase())}
            placeholder="Add ticker (AAPL, BTC, ETH...)"
            onKeyDown={e => e.key === "Enter" && addTo()}
            style={{
              flex: 1, padding: "10px 14px", background: T.bg.deep,
              border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm,
              color: T.t.p, fontFamily: mono, fontSize: 13, outline: "none", boxSizing: "border-box",
            }} />
          <Btn primary onClick={addTo} title={!addTk ? "Enter a ticker first" : "Add to watchlist"}><Plus size={14} /> Add</Btn>
        </div>

        {/* Ticker list */}
        {tickers.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: T.t.m, fontSize: 12, fontFamily: mono }}>
            Empty — add tickers above
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tickers.map(tk => {
              const p = prices[tk];
              const held = holdings.find(x => x.tk === tk);
              return (
                <div key={tk} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: T.rad.sm,
                  transition: T.tr.fast,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: T.rad.sm,
                      background: isC(tk) ? T.a.cyan + "12" : T.a.blue + "12",
                      border: `1px solid ${isC(tk) ? T.a.cyan : T.a.blue}20`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: mono, fontSize: 11, fontWeight: 700,
                      color: isC(tk) ? T.a.cyan : T.a.blue,
                    }}>{tk.slice(0, 2)}</div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: T.t.p }}>{tk}</div>
                      {p && <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m }}>{p.name}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {p ? <>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: T.t.p }}>{D(p.price)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 70, justifyContent: 'flex-end' }}>
                        {p.changePct >= 0 ? <TrendingUp size={10} color={T.g.m} /> : <TrendingDown size={10} color={T.r.m} />}
                        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: pc(p.changePct) }}>
                          {pct(p.changePct)}
                        </span>
                      </div>
                    </> : (
                      <span style={{ color: T.t.m, fontSize: 11, fontFamily: mono }}>
                        {loading ? '...' : '\u2014'}
                      </span>
                    )}
                    {held && <Badge color={T.a.cyan} style={{ fontSize: 8 }}>Held</Badge>}
                    <button onClick={() => rmFrom(tk)} aria-label={"Remove " + tk} style={{
                      background: "none", border: "none", cursor: "pointer", color: T.t.f,
                      padding: 4, borderRadius: T.rad.sm, transition: T.tr.fast,
                    }}><X size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Watchlists;
