# APEX Trader Cockpit — Session Handoff

**Date:** April 1, 2026
**Status:** Frontend LIVE | Backend scanner structurally complete, needs daily FMP runs to populate universe

## Project Location
`C:\Users\Dor\Desktop\my-dashboard` — Vite React SPA, dev server on port 5173.

---

## What's Done & Verified

### Frontend (100% working, verified in browser)

1. **Micro-Caps tab** — Renders the locked MicroCapRow schema:
   - Table: #, Ticker, Price, Tier (A/B/C badge), Net Score (0-100), Setup (MOMENTUM/INSIDER/MULTI), Reliability, Mkt Cap, Volume, Sector
   - Spotlight panel: tier badge, reliability progress bar, 6-cell sleeve/penalty grid, reasons list, warnings list
   - Filters: All, Top 20, Tier A, > $5M Cap
   - Loader reads `data.stocks` + `scannedAt` from cache JSON

2. **Bug fixes in Codex components:**
   - Portfolio.jsx: P&L% math (extracted `cost = totalVal - totalPnl`)
   - CryptoOnChain.jsx: volume averaging (honest `* 0.80` proxy with TODO comment)
   - Backtester.jsx: benchmark regime filter O(n²) → O(1) via incremental `_cachedCloses`

3. **QLTU fix** — Watchlists.jsx builds a minimal stub when Yahoo has no chart data, instead of dead-end toast

### Backend Scanner (`scripts/microcap-scanner.mjs`)

Structurally complete, tested, runs without errors. The **universe-building step** works correctly but requires multiple daily runs to fully map the ticker space (FMP free tier = 250 calls/day, ~7000 tickers to check).

**Architecture:**
- Universe: SEC `company_tickers_exchange.json` → Nasdaq/NYSE filter (7011 tickers) → shuffle → FMP `/stable/profile` individual calls → filter $5M–$300M market cap
- SEC features: per-CIK `submissions` JSON → Form 4 count in 90 days, filing flags
- Prices: Yahoo Finance v8 chart (free, unlimited, works for all tickers)
- FMP: only used for profile (sector, name, market cap) — not for quotes or history (premium on free plan)

**How to run:**
```bash
# First run — starts building universe (uses ~200 FMP calls)
set FMP_API_KEY=<your-key> && node scripts/microcap-scanner.mjs

# Check progress without using FMP calls
set FMP_API_KEY=<your-key> && node scripts/microcap-scanner.mjs --dry-run

# Force rebuild from scratch
set FMP_API_KEY=<your-key> && node scripts/microcap-scanner.mjs --rebuild-universe
```

The universe builds incrementally: each run checks ~200 new tickers (shuffled randomly across the market-cap spectrum). After ~35 daily runs, the full 7000-ticker space is mapped and cached for 30 days. Micro-caps found on day 1 are immediately scannable.

---

## Key Technical Details

### FMP API Limitations (free plan)
- **Key:** REGENERATE IT — was exposed in chat
- `/stable/profile?symbol=AAPL` — works for ALL tickers (one at a time only)
- `/stable/profile?symbol=AAPL,MSFT` — batch returns empty on free plan
- `/stable/quote`, `/stable/historical-price-eod` — PREMIUM for small caps
- `/stable/screener` — returns empty on free plan
- Old v3 endpoints (`/api/v3/...`) — deprecated ("Legacy Endpoint" error)
- Daily limit: 250 calls

### SEC company_tickers.json Gotcha
The file is keyed by **numeric index** ("0", "1", "2"...), NOT by ticker symbol. You must use `Object.values(raw)` to build a reverse lookup:
```js
const byTicker = {};
for (const entry of Object.values(raw)) {
  byTicker[entry.ticker.toUpperCase()] = entry;
}
```

### CIK Padding
SEC endpoints require 10-digit CIKs: `String(cik).padStart(10, "0")`

### Backend vs Frontend Networking
The Node scanner script runs standalone — it hits `query1.finance.yahoo.com` and `data.sec.gov` directly with `fetch()`. The Vite `/yf/` proxy only exists for the frontend dev server.

### SEC Rate Limiting
1 request per second with a `User-Agent` header containing company name + contact email. The script uses 1100ms intervals.

---

## Locked MicroCapRow Schema

```typescript
interface MicroCapRow {
  ticker: string;
  dataAsOf: string;         // "YYYY-MM-DD"
  setup: "MOMENTUM" | "INSIDER" | "MULTI";
  price: number;
  marketCap: number;
  volume: number;
  netScore: number;         // 0-100, clamped
  reliabilityScore: number; // 0-100
  tier: "A" | "B" | "C";
  momentumSleeve: number;   // 0.0-1.0 (displayed as %)
  insiderSleeve: number;    // 0.0-1.0
  supplyPenalty: number;    // 0.0-1.0 (continuous float, NOT boolean)
  costPenalty: number;      // 0.0-1.0 (continuous float, NOT boolean)
  reasons: string[];
  warnings: string[];
  sector?: string;
}
```

### Cache Output Format
```json
{
  "scannedAt": "2026-04-01T14:30:00Z",
  "totalScanned": 42,
  "stocks": [ ...MicroCapRow[] ]
}
```

---

## Scoring Formulas (Canonical)

**Momentum Sleeve** — both inputs percentile-ranked:
```
0.7 * pctRank(ret_63d) + 0.3 * pctRank(rvol_20d)
```

**Insider Sleeve** — Form 4 density, 5+ filings = max:
```
min(1, form4Count / 5) * 100
```

**Reliability Score:**
```
40 * secFilingCoverage + 25 * insiderProxy + 20 * marketDataFreshness + 15 * featureCompleteness
```

**Net Score** — note the 0.65 multiplier on max (NOT 1.0):
```
0.65 * max(momentumSleeve, insiderSleeve)
+ 0.35 * min(momentumSleeve, insiderSleeve)
- supplyPenalty * 100
- costPenalty * 100
+ tierAdj
```
Where tierAdj: A = +5, B = 0, C = -8. Result clamped 0-100.

**Supply Penalty** (from implied share count):
- > 200M shares: 0.15
- > 100M: 0.10
- > 50M: 0.05
- else: 0.02

**Cost Penalty** (from price level):
- < $1: 0.25
- < $2: 0.20
- < $3: 0.15
- < $5: 0.08
- else: 0.0

---

## Files Modified This Session

| File | Change |
|------|--------|
| `data/microcap_cache.json` | Rewritten to locked schema (11 mock rows) |
| `src/components/Scanner.jsx` | Loader, table, filters, Spotlight — full locked schema |
| `src/components/Portfolio.jsx` | P&L% math fix |
| `src/components/CryptoOnChain.jsx` | Volume averaging fix |
| `src/components/Backtester.jsx` | Benchmark O(n²) → O(1) |
| `src/components/Watchlists.jsx` | QLTU graceful fallback |
| `scripts/microcap-scanner.mjs` | Complete rewrite — SEC-first architecture |

## Git State
Branch: `main`. All changes unstaged. No commits this session.

## Immediate Next Steps
1. **Regenerate FMP API key** (old one exposed in chat)
2. **Run scanner daily** to build universe — `FMP_API_KEY=xxx node scripts/microcap-scanner.mjs`
3. After a few runs with micro-caps found, verify the Micro-Caps tab shows real data
4. Commit all frontend + backend changes
5. Update `.github/workflows/microcap-scan.yml` for the new script
