#!/usr/bin/env node
/**
 * Telegram Notification Module for APEX Micro-Cap Scanner
 *
 * Reads data/microcap_cache.json, formats the top N picks as
 * Telegram MarkdownV2, and sends via the Bot API.
 *
 * Usage:
 *   node scripts/telegram-notify.mjs              # send top 10
 *   node scripts/telegram-notify.mjs --top 5      # send top 5
 *   node scripts/telegram-notify.mjs --dry-run    # print only, don't send
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const CACHE_PATH = resolve(PROJECT_ROOT, "data", "microcap_cache.json");

// ---------------------------------------------------------------------------
// CLI arg parsing (zero deps)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  let top = 10;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--top" && args[i + 1]) {
      top = parseInt(args[i + 1], 10);
      if (Number.isNaN(top) || top < 1) {
        console.error("Error: --top must be a positive integer");
        process.exit(1);
      }
      i++; // skip next token
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { top, dryRun };
}

// ---------------------------------------------------------------------------
// MarkdownV2 escaping
// ---------------------------------------------------------------------------
const MD2_SPECIAL = /([_*\[\]()~`>#+\-=|{}.!])/g;

function esc(text) {
  return String(text).replace(MD2_SPECIAL, "\\$1");
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtPrice(n) {
  if (n == null) return "N/A";
  return "$" + Number(n).toFixed(2);
}

function fmtPct(n) {
  if (n == null) return "N/A";
  const sign = n >= 0 ? "+" : "";
  return sign + Number(n).toFixed(1) + "%";
}

function fmtMcap(n) {
  if (n == null) return "N/A";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n;
}

function signalLabel(score) {
  if (score >= 8) return "STRONG BUY";
  if (score >= 6) return "BUY";
  if (score >= 4) return "HOLD";
  if (score >= 2) return "WEAK";
  return "AVOID";
}

// ---------------------------------------------------------------------------
// Load cache
// ---------------------------------------------------------------------------
async function loadCache() {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Cache file not found: ${CACHE_PATH}`);
      console.error("Run the scanner first to generate data/microcap_cache.json");
    } else {
      console.error(`Failed to read cache: ${err.message}`);
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Build Telegram message
// ---------------------------------------------------------------------------
function buildMessage(cache, top) {
  // The cache is expected to have a `stocks` array (sorted by score desc)
  // and optional metadata fields like `scannedAt`, `totalScanned`.
  const stocks = Array.isArray(cache) ? cache : (cache.stocks || cache.results || []);
  const totalScanned = cache.totalScanned || cache.total || stocks.length;
  const scanDate = cache.scannedAt
    ? new Date(cache.scannedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Sort by score descending, take top N
  const sorted = [...stocks]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, top);

  if (sorted.length === 0) {
    console.error("No stocks found in cache");
    process.exit(1);
  }

  const lines = [];

  // Header
  lines.push(`\u{1F3AF} *APEX Micro\\-Cap Scanner*`);
  lines.push(`\u{1F4C5} ${esc(scanDate)} \\| ${esc(totalScanned)} stocks scanned`);
  lines.push("");
  lines.push(`*Top ${esc(top)} Picks:*`);
  lines.push("");

  // Stock entries
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const ticker = s.ticker || s.symbol || s.tk || "???";
    const price = fmtPrice(s.price ?? s.cur);
    const change = fmtPct(s.change ?? s.ch);
    const score = (s.score ?? 0).toFixed(1);
    const signal = signalLabel(s.score ?? 0);
    const mcap = fmtMcap(s.marketCap ?? s.mcap);
    const sector = s.sector || s.category || "N/A";

    lines.push(`${esc(i + 1)}\\. *${esc(ticker)}* \u2014 ${esc(price)} \\(${esc(change)}\\)`);
    lines.push(`      Score: ${esc(score)} \\| Signal: ${esc(signal)}`);
    lines.push(`      MCap: ${esc(mcap)} \\| Sector: ${esc(sector)}`);
    if (i < sorted.length - 1) lines.push("");
  }

  // Summary
  const avgScore = (sorted.reduce((sum, s) => sum + (s.score ?? 0), 0) / sorted.length).toFixed(1);
  const bullish = sorted.filter((s) => (s.score ?? 0) >= 6).length;

  lines.push("");
  lines.push(`Avg score: ${esc(avgScore)} \\| Bullish: ${esc(bullish)}/${esc(sorted.length)}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Send via Telegram Bot API
// ---------------------------------------------------------------------------
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Missing environment variables: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID");
    console.error("Set them in your .env file or export them before running.");
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error(`Telegram API error: ${data.description || "Unknown error"}`);
      console.error(`Error code: ${data.error_code || "N/A"}`);
      if (data.error_code === 400) {
        console.error("Hint: This usually means a MarkdownV2 formatting issue.");
        console.error("Try --dry-run to inspect the message text.");
      }
      return false;
    }

    console.log(`Message sent successfully to chat ${chatId}`);
    return true;
  } catch (err) {
    console.error(`Network error sending to Telegram: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { top, dryRun } = parseArgs(process.argv);
  const cache = await loadCache();
  const message = buildMessage(cache, top);

  if (dryRun) {
    console.log("=== DRY RUN — Message preview ===\n");
    console.log(message);
    console.log("\n=== End preview ===");
    console.log(`\nCharacters: ${message.length}`);
    return;
  }

  await sendTelegram(message);
}

main();
