# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run preview` — Preview production build
- No test framework configured yet

## Architecture

**APEX Terminal** is a single-page React 18 app (Vite) serving as a behavioral stock/crypto terminal. All state is client-side with localStorage persistence.

### Data Flow

Holdings state (`holdings`, `setHoldings`) lives in `App.jsx` and flows down to modules as props. Shape:
```js
{ tk, nm, qty, avg, cur, ch, tp, entryDate, decision }
```
- `tp`: "stock" or "crypto"
- `decision`: "Thesis" | "Conviction" | "FOMO" | "Boredom" — behavioral tagging per position
- Holdings persist to `localStorage` key `dashboard_holdings`, falling back to `DEFAULT_HOLDINGS` in App.jsx

### Module Routing

App.jsx renders 8 modules via a `mod` state switch: Portfolio, Scanner, Recommendations (Signals), Heatmap, Watchlists, Risk, Market, Backtester. No React Router — just conditional rendering with a sidebar nav.

### API Layer (`src/api/finance.js`)

Unified fetch layer with 5-minute in-memory cache (`Map` with TTL).

- **Stocks**: Yahoo Finance v8 via Vite dev proxy (see below). Primary endpoint: `/yf/v8/finance/chart/{ticker}`. The v8 chart endpoint is the only reliable one — avoid v6/v10 for price data.
- **Crypto**: CoinGecko free API (direct HTTPS). Ticker-to-ID mapping in the `CM` object (100+ entries, e.g. `BITW→"bitcoin"`).
- `fetchPrice(tk)` auto-routes stocks vs crypto via `isC(tk)` / `CM` lookup.
- `analyzeStock()` returns technicals (RSI, SMA, MACD, VCP detection, anomaly flags) with composite rating.
- `APEX_UNIVERSE` — full screener universe (~300 tickers across 11 categories).

### Vite Proxy (vite.config.js)

Three proxies rewrite paths and set `changeOrigin: true`:
- `/yf` → `query1.finance.yahoo.com` (chart/quote)
- `/yf2` → `query2.finance.yahoo.com` (screener/trending)
- `/yfweb` → `finance.yahoo.com`

### Theme System (`src/theme/tokens.js`)

Single `T` export with nested color tokens. Key conventions:
- Fonts: `mono` (JetBrains Mono — tables/data), `display` (Cormorant Garamond — headers), `sans` (DM Sans — UI)
- Accent: amber `#f59e0b`. Backgrounds: near-black `#09090b` → `#27272a`.
- Utilities: `pc(v)` picks green/red by sign, `D(n)` formats dollars, `pct(n)` formats percentages, `fmt(n)` abbreviates large numbers.
- Backward-compat aliases: `T.bg.deep`, `T.a.blue`, `T.t.p`, `T.b.s`, etc.

### Shared UI (`src/components/ui/Shared.jsx`)

Reusable primitives: `Card`, `Metric`, `Badge`, `Spark`, `TabBar`, `Gauge`, `Btn`, `Toasts`. All use theme tokens. Use these instead of creating new base components.

### Portfolio Module Specifics

Portfolio.jsx has collapsible sections (metrics, audit, vintage, holdings, onchain, history) with toggle state. Trade history (20 entries) is hardcoded from broker data. `AddModal` enforces a 3-second "Valuation Friction" delay with DCF-lite check before confirming. `CryptoOnChain` uses CoinGecko market data to proxy MVRV, exchange flow, and ATH zone signals.

## Pending Work

1. **Buy/sell counts in Backtester** — track and display total buys/sells in backtest results
2. **Architecture hardening** — incremental migration toward SimClock, PIT datastore, decision equity curves (keep working app, don't rewrite)

## Git

- Remote: `https://github.com/dorvanounou-design/apex-terminal`
- Local config: `user.email "dor@user.com"`, `user.name "Dor"`
- gh CLI: `C:\Users\Dor\bin\gh.exe`
