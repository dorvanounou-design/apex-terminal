// src/theme/tokens.js — APEX Industrial Design System

export const T = {
  // ── Backgrounds (near-black, no gradients) ──
  bgDeep:   '#09090b',
  bgSurf:   '#111113',
  bgCard:   '#18181b',
  bgEl:     '#27272a',

  accent:   '#f59e0b',   // amber — tactical, not "startup green"
  accentDim:'#78350f',
  gold:     '#f59e0b',
  goldDim:  '#78350f',

  bull:     '#22c55e',
  bear:     '#ef4444',
  warn:     '#f59e0b',
  info:     '#3b82f6',

  t1:       '#fafafa',
  t2:       '#a1a1aa',
  t3:       '#71717a',
  t4:       '#3f3f46',

  b1:       '#27272a',
  b2:       '#3f3f46',

  display:  "'JetBrains Mono', monospace",
  sans:     "'DM Sans', system-ui, sans-serif",
  mono:     "'JetBrains Mono', 'Courier New', monospace",

  // ── Backward-compatible nested tokens ──
  bg: { deep: '#09090b', base: '#0e0e10', surface: '#111113', card: '#18181b', el: '#27272a' },
  a:  { blue: '#3b82f6', bg: 'rgba(59,130,246,0.1)', cyan: '#06b6d4' },
  g:  { m: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  r:  { m: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  w:  { m: '#f59e0b' },
  t:  { p: '#fafafa', s: '#a1a1aa', m: '#71717a', f: '#3f3f46' },
  b:  { s: '#27272a', m: '#3f3f46' },
};

export const mono = T.mono;
export const sans = T.sans;
export const display = "'Cormorant Garamond', 'Georgia', serif";

export const pc = v => v >= 0 ? T.bull : T.bear;

export const fmt = n => {
  if (n == null || isNaN(n)) return "\u2014";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
};

export const D = n => "$" + fmt(n);
export const pct = n => (n == null || isNaN(n) ? "\u2014" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");
