#!/usr/bin/env node
/**
 * APEX Micro-Cap Scanner — SEC-first + Yahoo Finance + FMP profile
 *
 * Architecture (adapted for FMP free tier):
 *   - Universe: SEC company_tickers_exchange.json (Nasdaq/NYSE only)
 *   - Market cap: FMP /stable/profile (individual calls, 250/day budget)
 *   - Prices/history: Yahoo Finance v8 chart (free, unlimited)
 *   - Insider/filings: SEC per-CIK submissions (free, 1 req/sec)
 *
 * The universe builds incrementally over multiple runs:
 *   Run 1: profiles tickers 0-200 → finds ~30 micro-caps
 *   Run 2: profiles tickers 200-400 → finds more, etc.
 *   After ~7 days the full universe is mapped and cached for 30 days.
 *
 * Usage:
 *   FMP_API_KEY=xxx node scripts/microcap-scanner.mjs
 *   FMP_API_KEY=xxx node scripts/microcap-scanner.mjs --dry-run
 *   FMP_API_KEY=xxx node scripts/microcap-scanner.mjs --top 20
 *   FMP_API_KEY=xxx node scripts/microcap-scanner.mjs --rebuild-universe
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const DATA = resolve(ROOT, "data");
const SEC_DIR = resolve(ROOT, "sec_data", "raw");
const CACHE_FILE = resolve(DATA, "microcap_cache.json");
const LOG_FILE = resolve(DATA, "research_log.csv");
const CIK_CACHE = resolve(DATA, "cik_exchange.json");
const UNIVERSE_FILE = resolve(DATA, "universe.json");
const PROFILE_PROGRESS = resolve(DATA, "profile_progress.json");

const FMP = "https://financialmodelingprep.com/stable";
const FMP_KEY = process.env.FMP_API_KEY ?? "";
const UA = "APEX-TraderCockpit/1.0 (contact: your@email.com)";
const TODAY = new Date().toISOString().slice(0, 10);

const SEC_INTERVAL = 1100;
const FMP_INTERVAL = 400;
const YF_INTERVAL = 250;
const FMP_DAILY_BUDGET = 200; // leave 50 buffer from the 250 limit
const SHORTLIST_SIZE = 60;
const MAX_MCAP = 300_000_000;
const MIN_MCAP = 5_000_000;
const MIN_PRICE = 0.50;

mkdirSync(DATA, { recursive: true });
mkdirSync(SEC_DIR, { recursive: true });

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let top = Infinity, dryRun = false, rebuildUniverse = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--top" && args[i + 1]) top = +args[++i];
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--rebuild-universe") rebuildUniverse = true;
  }
  return { top, dryRun, rebuildUniverse };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, label = "") {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${label}`);
      return await res.json();
    } catch (e) {
      if (attempt === 0) { await sleep(2000); continue; }
      throw e;
    }
  }
}

function isFresh(path, maxAgeMs) {
  return existsSync(path) && (Date.now() - statSync(path).mtimeMs < maxAgeMs);
}

function loadJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// ─── CSV Logger ──────────────────────────────────────────────────────────────

function appendLog(rows) {
  const header = "date,ticker,tier,reliabilityScore,setup,momentumSleeve,insiderSleeve,supplyPenalty,costPenalty,netScore,reasons,warnings,fwdReturn_1d,fwdReturn_5d,fwdReturn_20d";
  if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, header + "\n");
  const lines = rows.map(r =>
    [r.dataAsOf, r.ticker, r.tier, r.reliabilityScore, r.setup,
     r.momentumSleeve, r.insiderSleeve, r.supplyPenalty, r.costPenalty, r.netScore,
     JSON.stringify(r.reasons || []), JSON.stringify(r.warnings || []),
     "", "", ""]
    .map(f => `"${String(f).replace(/"/g, '""')}"`)
    .join(",")
  );
  appendFileSync(LOG_FILE, lines.join("\n") + "\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1A: Universe — incremental build from SEC + FMP profile
// ═══════════════════════════════════════════════════════════════════════════════

/** Download SEC ticker list with exchange info (cached 7 days) */
async function loadExchangeTickers() {
  if (isFresh(CIK_CACHE, 7 * 86400000)) {
    return loadJson(CIK_CACHE);
  }
  console.log("📡 Downloading SEC company_tickers_exchange.json...");
  const raw = await fetchJson("https://www.sec.gov/files/company_tickers_exchange.json", "SEC tickers");
  // Structure: { fields: [...], data: [[cik, name, ticker, exchange], ...] }
  const tickers = raw.data
    .filter(r => (r[3] === "Nasdaq" || r[3] === "NYSE") && /^[A-Z]{1,5}$/.test(r[2]))
    .map(r => ({ cik: String(r[0]), name: r[1], ticker: r[2], exchange: r[3] }));

  saveJson(CIK_CACHE, tickers);
  console.log(`✅ ${tickers.length} tickers on Nasdaq/NYSE`);
  return tickers;
}

/** Deterministic shuffle using a seed (same order each day, different across days) */
function seededShuffle(arr, seed) {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    const j = ((s >>> 0) % (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build micro-cap universe incrementally using FMP profile (200 calls/run) */
async function buildUniverse(forceRebuild = false) {
  const allTickers = await loadExchangeTickers();

  // Load existing universe + progress
  let universe = loadJson(UNIVERSE_FILE) || [];
  let progress = loadJson(PROFILE_PROGRESS) || { checkedTickers: {}, totalChecked: 0, lastRun: null };

  // If universe is fresh (30 days) and we've checked enough tickers, just use it
  const pctChecked = progress.totalChecked / allTickers.length;
  if (!forceRebuild && pctChecked > 0.8 && isFresh(UNIVERSE_FILE, 30 * 86400000)) {
    console.log(`♻  Universe from cache: ${universe.length} micro-caps (${Math.round(pctChecked * 100)}% mapped)`);
    return universe;
  }

  if (forceRebuild) {
    progress = { checkedTickers: {}, totalChecked: 0, lastRun: null };
    universe = [];
    console.log("🔄 Rebuilding universe from scratch...");
  }

  // Shuffle tickers so each run samples across the full market-cap spectrum
  // Use date-based seed so the order is consistent within a day but changes daily
  const daySeed = parseInt(TODAY.replace(/-/g, ""), 10);
  const shuffled = seededShuffle(allTickers, daySeed);

  // Filter to unchecked tickers only
  const unchecked = shuffled.filter(tk => !progress.checkedTickers[tk.ticker]);
  const batch = unchecked.slice(0, FMP_DAILY_BUDGET);

  console.log(`📡 FMP profile: ${batch.length} unchecked tickers (${progress.totalChecked}/${allTickers.length} already done)...`);

  let fmpCalls = 0;
  let newMicroCaps = 0;

  for (let i = 0; i < batch.length; i++) {
    const tk = batch[i];

    try {
      const data = await fetchJson(
        `${FMP}/profile?symbol=${tk.ticker}&apikey=${FMP_KEY}`,
        `profile/${tk.ticker}`
      );
      fmpCalls++;

      const p = Array.isArray(data) ? data[0] : data;
      if (p?.marketCap && p.marketCap >= MIN_MCAP && p.marketCap <= MAX_MCAP && p.price >= MIN_PRICE) {
        universe.push({
          ticker: p.symbol,
          cik: tk.cik,
          name: p.companyName || tk.name,
          marketCap: p.marketCap,
          price: p.price,
          sector: p.sector || null,
          industry: p.industry || null,
          exchange: tk.exchange,
        });
        newMicroCaps++;
      }
      progress.checkedTickers[tk.ticker] = true;
      progress.totalChecked++;
    } catch (e) {
      // FMP daily limit hit — stop early and save progress
      if (e.message.includes("429") || e.message.includes("Limit")) {
        console.log(`  ⚠ FMP limit reached after ${fmpCalls} calls. Saving progress.`);
        break;
      }
      // Other errors — mark as checked to avoid retrying bad tickers
      progress.checkedTickers[tk.ticker] = true;
      progress.totalChecked++;
    }

    if (fmpCalls > 0 && fmpCalls % 50 === 0) {
      console.log(`  ${fmpCalls} calls, ${newMicroCaps} micro-caps found so far...`);
    }
    await sleep(FMP_INTERVAL);
  }

  // Dedupe universe
  const seen = new Set();
  universe = universe.filter(u => {
    if (seen.has(u.ticker)) return false;
    seen.add(u.ticker);
    return true;
  });

  progress.lastRun = TODAY;
  saveJson(UNIVERSE_FILE, universe);
  saveJson(PROFILE_PROGRESS, progress);

  const mappedPct = Math.round((progress.totalChecked / allTickers.length) * 100);
  console.log(`✅ Universe: ${universe.length} micro-caps (${mappedPct}% mapped, +${newMicroCaps} new, ${fmpCalls} FMP calls)`);

  if (progress.totalChecked < allTickers.length) {
    const remaining = allTickers.length - progress.totalChecked;
    const daysLeft = Math.ceil(remaining / FMP_DAILY_BUDGET);
    console.log(`   ℹ  ${remaining} tickers remaining (~${daysLeft} runs to fully map)`);
  }

  return universe;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1B: SEC features — per-CIK submissions + Form 4 counts
// ═══════════════════════════════════════════════════════════════════════════════

function extractSecFeatures(data) {
  const recent = data?.filings?.recent || {};
  const forms = recent.form || [];
  const dates = recent.filingDate || [];

  const cutoff90d = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let form4Count = 0, hasRecent8K = false, hasS3 = false;

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i], date = dates[i] || "";
    if (form === "4" && date >= cutoff90d) form4Count++;
    if (form === "8-K" && date >= cutoff90d) hasRecent8K = true;
    if ((form === "S-3" || form === "S-3/A") && date >= cutoff90d) hasS3 = true;
  }

  const has10K = forms.includes("10-K") || forms.includes("10-K/A");
  const has10Q = forms.includes("10-Q") || forms.includes("10-Q/A");
  const secFilingCoverage = Math.min(1,
    (has10K ? 0.4 : 0) + (has10Q ? 0.2 : 0) + (hasRecent8K ? 0.2 : 0) + (form4Count > 0 ? 0.2 : 0)
  );

  return {
    form4Count,
    hasRecent8K,
    hasS3,
    secFilingCoverage,
    insiderProxy: Math.min(1, form4Count / 5),
    dilutionRisk: hasS3,
  };
}

async function getSecFeatures(universe) {
  const withCik = universe.filter(s => s.cik);
  console.log(`📡 SEC submissions for ${withCik.length} tickers (1 req/sec, cached 24h)...`);

  const results = [];
  for (let i = 0; i < withCik.length; i++) {
    const item = withCik[i];
    const cachePath = resolve(SEC_DIR, `${item.ticker}.json`);

    try {
      let data;
      if (isFresh(cachePath, 86400000)) {
        data = loadJson(cachePath);
      } else {
        const padded = item.cik.padStart(10, "0");
        data = await fetchJson(
          `https://data.sec.gov/submissions/CIK${padded}.json`, `SEC/${item.ticker}`
        );
        saveJson(cachePath, data);
        await sleep(SEC_INTERVAL);
      }
      results.push({ ...item, ...extractSecFeatures(data) });
    } catch (e) {
      console.warn(`  [SEC] skip ${item.ticker}: ${e.message}`);
    }

    if (i > 0 && i % 25 === 0) console.log(`  [SEC] ${i}/${withCik.length}...`);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1C: Yahoo Finance prices (free, no key, works for all tickers)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchYahooChart(ticker) {
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3mo&interval=1d`,
    `YF/${ticker}`
  );
  const res = data?.chart?.result?.[0];
  if (!res) return null;

  const closes = (res.indicators?.quote?.[0]?.close || []).filter(c => c != null);
  const volumes = (res.indicators?.quote?.[0]?.volume || []).filter(v => v != null);
  const price = res.meta?.regularMarketPrice || closes[closes.length - 1] || 0;

  return { price, closes, volumes };
}

async function enrichWithPrices(shortlist) {
  console.log(`📡 Yahoo Finance charts for ${shortlist.length} tickers...`);
  const results = [];

  for (let i = 0; i < shortlist.length; i++) {
    const item = shortlist[i];
    try {
      const yf = await fetchYahooChart(item.ticker);
      if (!yf || yf.closes.length < 5) {
        results.push({ ...item, _noPrice: true });
        continue;
      }

      const closes = yf.closes;
      const volumes = yf.volumes;
      const latest = closes[closes.length - 1];
      const oldest = closes[0];
      const ret63d = oldest > 0 ? ((latest / oldest) - 1) * 100 : 0;

      const recentVols = volumes.slice(-20);
      const avgVol20 = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 1;
      const latestVol = volumes[volumes.length - 1] || 0;
      const rvol20d = avgVol20 > 0 ? latestVol / avgVol20 : 1;

      results.push({
        ...item,
        price: Math.round(yf.price * 100) / 100,
        ret63d,
        rvol20d,
        latestVolume: latestVol,
        _noPrice: false,
      });
    } catch (e) {
      console.warn(`  [YF] skip ${item.ticker}: ${e.message}`);
      results.push({ ...item, _noPrice: true });
    }

    if (i > 0 && i % 20 === 0) console.log(`  [YF] ${i}/${shortlist.length}...`);
    await sleep(YF_INTERVAL);
  }

  return results.filter(r => !r._noPrice);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1D: Scoring — locked brief formulas
// ═══════════════════════════════════════════════════════════════════════════════

function pctRank(val, sorted) {
  if (sorted.length === 0) return 50;
  return (sorted.filter(v => v <= val).length / sorted.length) * 100;
}

function scoreAll(list) {
  const allRet = list.map(s => s.ret63d || 0);
  const allRvol = list.map(s => s.rvol20d || 1);
  const sortedRet = [...allRet].sort((a, b) => a - b);
  const sortedRvol = [...allRvol].sort((a, b) => a - b);

  const rows = [];
  for (const item of list) {
    const momentumSleeve = 0.7 * pctRank(item.ret63d || 0, sortedRet) +
                           0.3 * pctRank(item.rvol20d || 1, sortedRvol);
    const insiderSleeve = (item.insiderProxy || 0) * 100;

    // Supply penalty: implied share count
    const impliedShares = item.price > 0 ? item.marketCap / item.price : 0;
    const supplyPenalty = impliedShares > 200e6 ? 0.15 : impliedShares > 100e6 ? 0.10 : impliedShares > 50e6 ? 0.05 : 0.02;

    // Cost penalty: price level
    const costPenalty = item.price < 1 ? 0.25 : item.price < 2 ? 0.20 : item.price < 3 ? 0.15 : item.price < 5 ? 0.08 : 0.0;

    // Tier
    const cov = item.secFilingCoverage || 0;
    const tier = cov >= 0.7 ? "A" : cov >= 0.4 ? "B" : "C";
    const tierAdj = tier === "A" ? 5 : tier === "C" ? -8 : 0;

    // Reliability: 40*sec + 25*insider + 20*freshness + 15*completeness
    const reliabilityScore = Math.round(Math.min(100, Math.max(0,
      40 * cov + 25 * (item.insiderProxy || 0) + 20 * 1.0 + 15 * (item.ret63d !== 0 ? 0.9 : 0.5)
    )));

    // Net score: 0.65 * max + 0.35 * min - penalties + tierAdj
    const maxS = Math.max(momentumSleeve, insiderSleeve);
    const minS = Math.min(momentumSleeve, insiderSleeve);
    const netScore = Math.round(Math.max(0, Math.min(100,
      0.65 * maxS + 0.35 * minS - supplyPenalty * 100 - costPenalty * 100 + tierAdj
    )));

    const setup = momentumSleeve > insiderSleeve + 15 ? "MOMENTUM" :
                  insiderSleeve > momentumSleeve + 15 ? "INSIDER" : "MULTI";

    // Reasons (ticker-specific)
    const reasons = [];
    if (pctRank(item.ret63d || 0, sortedRet) >= 75) reasons.push(`63d return top-quartile (+${item.ret63d.toFixed(1)}%)`);
    else if (item.ret63d > 0) reasons.push(`Positive 63d momentum (+${item.ret63d.toFixed(1)}%)`);
    if (item.rvol20d > 1.5) reasons.push(`Relative volume ${item.rvol20d.toFixed(1)}x 20d average`);
    if (item.form4Count >= 3) reasons.push(`${item.form4Count} Form 4 filings in 90 days`);
    else if (item.form4Count > 0) reasons.push(`${item.form4Count} insider transaction(s) on file`);
    if (item.hasRecent8K) reasons.push("Recent 8-K material event");
    if (cov >= 0.7) reasons.push("Strong SEC filing coverage");
    if (reasons.length === 0) reasons.push("Passed micro-cap screening filters");

    // Warnings
    const warnings = [];
    if (reliabilityScore < 50) warnings.push("ReliabilityScore below 50 — treat as speculative");
    if (item.price < 3) warnings.push("Under $3 — elevated cost penalty");
    if (supplyPenalty >= 0.10) warnings.push("High share count — dilution risk");
    if (item.dilutionRisk) warnings.push("S-3 shelf registration on file");
    if ((item.form4Count || 0) === 0) warnings.push("No insider transactions in 90 days");
    if (item.ret63d < -20) warnings.push(`Negative 63d momentum (${item.ret63d.toFixed(1)}%)`);

    rows.push({
      ticker: item.ticker,
      dataAsOf: TODAY,
      setup,
      price: item.price,
      marketCap: item.marketCap,
      volume: item.latestVolume || 0,
      netScore,
      reliabilityScore,
      tier,
      momentumSleeve: Math.round(momentumSleeve) / 100,
      insiderSleeve: Math.round(insiderSleeve) / 100,
      supplyPenalty: Math.round(supplyPenalty * 100) / 100,
      costPenalty: Math.round(costPenalty * 100) / 100,
      reasons,
      warnings,
      sector: item.sector || null,
    });
  }

  rows.sort((a, b) => b.netScore - a.netScore);
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════════

function printSummary(rows) {
  console.log("\n── Top Results ──");
  console.log("Rank │ Ticker   │ Tier │ Score │ Setup     │ Reliab │ Price    │ Mkt Cap");
  console.log("─────┼──────────┼──────┼───────┼───────────┼────────┼──────────┼─────────");
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i];
    console.log(
      `${String(i + 1).padStart(4)} │ ${r.ticker.padEnd(8)} │  ${r.tier}   │ ${String(r.netScore).padStart(5)} │ ${r.setup.padEnd(9)} │ ${String(r.reliabilityScore).padStart(5)}  │ $${String(r.price).padStart(7)} │ ${(r.marketCap / 1e6).toFixed(1)}M`
    );
  }
  const tc = { A: 0, B: 0, C: 0 };
  rows.forEach(r => tc[r.tier] = (tc[r.tier] || 0) + 1);
  console.log(`\nTiers: ${tc.A} A / ${tc.B} B / ${tc.C} C`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const { top, dryRun, rebuildUniverse } = parseArgs();

  if (!FMP_KEY) {
    console.error("❌ FMP_API_KEY not set.\n   Run: FMP_API_KEY=xxx node scripts/microcap-scanner.mjs");
    process.exit(1);
  }

  console.log(`🚀 APEX Micro-Cap Scanner — ${TODAY}\n`);

  // ── 1A: Universe (incremental) ──
  const universe = await buildUniverse(rebuildUniverse);

  if (universe.length === 0) {
    console.log("\n⚠  Universe is empty — run the scanner daily to build it incrementally.");
    console.log("   Each run profiles ~200 tickers. Full mapping takes ~35 runs.");
    return;
  }

  if (dryRun) {
    console.log(`\n── Dry run: ${universe.length} micro-caps ──`);
    universe.slice(0, 30).forEach((s, i) =>
      console.log(`  ${i + 1}. ${s.ticker} — ${s.name} ($${(s.marketCap / 1e6).toFixed(1)}M) [${s.sector || "?"}]`)
    );
    return;
  }

  // ── 1B: SEC features ──
  const withSec = await getSecFeatures(universe);
  console.log(`✅ SEC: ${withSec.length} tickers with filing data\n`);

  // ── Shortlist by SEC coverage ──
  const shortlist = withSec
    .sort((a, b) => b.secFilingCoverage - a.secFilingCoverage)
    .slice(0, SHORTLIST_SIZE);
  console.log(`📋 Shortlist: ${shortlist.length} tickers (by SEC coverage)\n`);

  // ── 1C: Yahoo Finance prices ──
  const enriched = await enrichWithPrices(shortlist);
  console.log(`✅ Priced: ${enriched.length} tickers with Yahoo data\n`);

  if (enriched.length === 0) {
    console.log("⚠  No tickers with price data — check Yahoo Finance access.");
    return;
  }

  // ── 1D: Score ──
  let scored = scoreAll(enriched);
  if (top < Infinity) scored = scored.slice(0, top);

  // ── Output ──
  const output = {
    scannedAt: new Date().toISOString(),
    totalScanned: scored.length,
    stocks: scored,
  };

  saveJson(CACHE_FILE, output);
  appendLog(scored);
  printSummary(scored);

  console.log(`\n✅ Wrote ${scored.length} rows to ${CACHE_FILE}`);
}

main().catch(err => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
