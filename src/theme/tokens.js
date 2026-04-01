// src/theme/tokens.js -- APEX Obsidian Design System v4

export const T = {
  bgDeep: '#06060a',
  bgSurf: '#0d1017',
  bgCard: '#121723',
  bgEl: '#1b2231',

  accent: '#06d6a0',
  accentDim: '#065f46',
  accent2: '#63E6FF',
  acid: '#B8FF3D',
  ion: '#63E6FF',
  gold: '#f59e0b',
  goldDim: '#92400e',

  bull: '#06d6a0',
  bear: '#FF4D6D',
  warn: '#fbbf24',
  info: '#63E6FF',

  t1: '#F5F7FB',
  t2: '#AAB4C6',
  t3: '#758198',
  t4: '#475166',

  b1: '#1f2635',
  b2: '#2d3850',

  display: "'Cormorant Garamond', Georgia, serif",
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",

  bg: {
    deep: '#06060a',
    base: '#090C13',
    surface: '#0D1017',
    card: '#121723',
    el: '#1B2231',
    panel: '#0B0E15',
    hover: '#182032',
  },
  a: { blue: '#5EA1FF', bg: 'rgba(6,214,160,0.08)', cyan: '#63E6FF', teal: '#06d6a0' },
  g: { m: '#06d6a0', bg: 'rgba(6,214,160,0.08)' },
  r: { m: '#FF4D6D', bg: 'rgba(255,77,109,0.08)' },
  w: { m: '#fbbf24' },
  t: { p: '#F5F7FB', s: '#AAB4C6', m: '#758198', f: '#475166' },
  b: { s: '#1f2635', m: '#2d3850' },

  elev: {
    L0: { blur: 8, shadow: '0 1px 3px rgba(0,0,0,0.35)' },
    L1: { blur: 16, shadow: '0 12px 28px rgba(0,0,0,0.36)' },
    L2: { blur: 20, shadow: '0 18px 44px rgba(0,0,0,0.45)' },
    L3: { blur: 24, shadow: '0 24px 60px rgba(0,0,0,0.58)' },
  },

  shadow: {
    sm: '0 8px 20px rgba(0,0,0,0.22)',
    md: '0 16px 36px rgba(0,0,0,0.34)',
    lg: '0 26px 64px rgba(0,0,0,0.46)',
    glow: (color) => `0 0 20px ${color}1f, 0 0 48px ${color}14`,
  },

  glowAccent: '0 0 18px #06d6a030',
  glowAcid: '0 0 18px #B8FF3D30',
  glowIon: '0 0 18px #63E6FF30',
  glowBad: '0 0 18px #FF4D6D30',

  motion: {
    duration: '0.28s',
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  tr: {
    fast: 'all 0.12s ease',
    base: 'all 0.18s ease',
    slow: 'all 0.3s ease',
    ceramic: 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  },

  rad: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 100,
  },

  fx: {
    shell: `
      radial-gradient(circle at 18% 18%, rgba(99,230,255,0.12), transparent 34%),
      radial-gradient(circle at 82% 0%, rgba(6,214,160,0.10), transparent 28%),
      radial-gradient(circle at 50% 100%, rgba(245,158,11,0.08), transparent 36%),
      linear-gradient(180deg, #090C13 0%, #07090F 52%, #06070B 100%)
    `,
    card: `
      linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 22%),
      linear-gradient(180deg, #121723 0%, #101521 100%)
    `,
    panel: `
      linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0) 26%),
      linear-gradient(180deg, #0E131D 0%, #0A0E16 100%)
    `,
  },
};

export const mono = T.mono;
export const sans = T.sans;
export const display = T.display;

export const pc = (v) => (v >= 0 ? T.bull : T.bear);

export const fmt = (n) => {
  if (n == null || isNaN(n)) return "\u2014";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
};

export const D = (n) => "$" + fmt(n);
export const pct = (n) => (n == null || isNaN(n) ? "\u2014" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");
