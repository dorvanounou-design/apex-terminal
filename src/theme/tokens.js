// src/theme/tokens.js — APEX Obsidian Design System v3

export const T = {
  // ── Backgrounds (Obsidian depth layers) ──
  bgDeep:   '#06060a',
  bgSurf:   '#0c0c0f',
  bgCard:   '#111116',
  bgEl:     '#1a1a22',

  accent:   '#06d6a0',   // teal — Obsidian primary
  accentDim:'#065f46',
  accent2:  '#00d4ff',   // cyan — secondary accent
  acid:     '#B8FF3D',   // bullish / alert accent
  ion:      '#63E6FF',   // neutral / info accent
  gold:     '#f59e0b',
  goldDim:  '#78350f',

  bull:     '#06d6a0',
  bear:     '#fb7185',
  warn:     '#fbbf24',
  info:     '#00d4ff',

  t1:       '#f0f0f0',
  t2:       '#a1a1aa',
  t3:       '#71717a',
  t4:       '#3f3f46',

  b1:       '#1a1a2e',
  b2:       '#2a2a3e',

  display:  "'JetBrains Mono', monospace",
  sans:     "'DM Sans', system-ui, sans-serif",
  mono:     "'JetBrains Mono', 'Courier New', monospace",

  // ── Nested tokens (Obsidian) ──
  bg: { deep: '#06060a', base: '#0a0a0d', surface: '#0c0c0f', card: '#111116', el: '#1a1a22', hover: '#161620' },
  a:  { blue: '#3b82f6', bg: 'rgba(6,214,160,0.08)', cyan: '#00d4ff', teal: '#06d6a0' },
  g:  { m: '#06d6a0', bg: 'rgba(6,214,160,0.08)' },
  r:  { m: '#fb7185', bg: 'rgba(251,113,133,0.08)' },
  w:  { m: '#fbbf24' },
  t:  { p: '#f0f0f0', s: '#a1a1aa', m: '#71717a', f: '#3f3f46' },
  b:  { s: '#1a1a2e', m: '#2a2a3e' },

  // ── Elevation (L0–L3 Ceramic) ──
  elev: {
    L0: { blur: 8, shadow: '0 1px 3px rgba(0,0,0,0.4)' },
    L1: { blur: 16, shadow: '0 4px 20px rgba(0,0,0,0.5)' },
    L2: { blur: 20, shadow: '0 8px 30px rgba(0,0,0,0.6)' },
    L3: { blur: 24, shadow: '0 12px 40px rgba(0,0,0,0.7)' },
  },

  // ── Shadows (deeper for Obsidian) ──
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.4)',
    md: '0 2px 10px rgba(0,0,0,0.5)',
    lg: '0 4px 20px rgba(0,0,0,0.6)',
    glow: (color) => `0 0 16px ${color}25, 0 0 4px ${color}15`,
  },

  // ── Glow (Ceramic) ──
  glowAccent: '0 0 16px #06d6a025',
  glowAcid:   '0 0 16px #B8FF3D30',
  glowIon:    '0 0 16px #63E6FF30',
  glowBad:    '0 0 16px #FF4D6D30',

  // ── Motion (Ceramic) ──
  motion: {
    duration: '0.28s',
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // ── Transitions ──
  tr: {
    fast: 'all 0.12s ease',
    base: 'all 0.18s ease',
    slow: 'all 0.3s ease',
    ceramic: 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  },

  // ── Radius (Obsidian rounded) ──
  rad: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 100,
  },
};

export const mono = T.mono;
export const sans = T.sans;
export const display = "'JetBrains Mono', monospace"; // Obsidian uses mono everywhere

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
