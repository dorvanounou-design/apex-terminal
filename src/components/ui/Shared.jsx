// src/components/ui/Shared.jsx — APEX Obsidian UI Kit v3
import * as d3 from "d3";
import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Bell, Check } from "lucide-react";
import { T, mono, sans, pc } from "../../theme/tokens";

/**
 * Morph — Animated number/text transition with vertical slide + fade.
 * Usage: <Morph value="$42.50" style={{ fontSize: 20 }} />
 * When `value` changes, the old value slides up and fades out while
 * the new value slides in from below. Pure CSS, no dependencies.
 */
export const Morph = ({ value, style = {}, duration = 280 }) => {
  const [display, setDisplay] = useState(value);
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplay(value);
        setAnimating(false);
        prevRef.current = value;
      }, duration / 2);
      return () => clearTimeout(timer);
    }
  }, [value, duration]);

  return (
    <span style={{
      display: 'inline-block', overflow: 'hidden', position: 'relative',
      transition: `all ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      ...style,
    }}>
      <span style={{
        display: 'inline-block',
        transform: animating ? 'translateY(-8px)' : 'translateY(0)',
        opacity: animating ? 0 : 1,
        transition: `all ${duration / 2}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {display}
      </span>
    </span>
  );
};

export const Card = ({ children, style = {}, onClick, glow }) => (
  <div onClick={onClick} style={{
    background: T.bg.card,
    border: `1px solid ${T.b.s}`,
    borderRadius: T.rad.md,
    padding: 16,
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    boxShadow: glow ? T.shadow.glow(glow) : T.shadow.sm,
    transition: T.tr.base,
    ...style,
  }}>{children}</div>
);

/**
 * DriftCard — Card with micro-tilt on hover (Ceramic Constitution §6).
 * Uses CSS perspective + transform for GPU-accelerated tilt effect.
 * Includes ceramic top edge highlight and hover-lift.
 */
export const DriftCard = ({ children, style = {}, onClick, glow, intensity = 1 }) => {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMove = (e) => {
    if (!ref.current || intensity === 0) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    // Clamp tilt to ±6deg
    setTilt({ rx: -y * 6 * intensity, ry: x * 6 * intensity });
  };

  const handleLeave = () => {
    setTilt({ rx: 0, ry: 0 });
    setHovering(false);
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleLeave}
      style={{
        perspective: 600,
        willChange: 'transform',
      }}
    >
      <div style={{
        background: T.bg.card,
        border: `1px solid ${T.b.s}`,
        borderRadius: T.rad.md,
        padding: 16,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: hovering
          ? (glow ? T.shadow.glow(glow) : T.elev?.L3?.shadow || T.shadow.md)
          : (glow ? T.shadow.glow(glow) : T.shadow.sm),
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${hovering ? -3 : 0}px)`,
        transition: `transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease`,
        // Ceramic top edge
        borderTop: hovering ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${T.b.s}`,
        ...style,
      }}>{children}</div>
    </div>
  );
};

export const Metric = ({ label, value, sub, subC, icon: I, bc }) => (
  <DriftCard style={{ borderLeft: `3px solid ${bc || T.accent}`, borderRadius: 0, padding: '14px 16px' }} intensity={0.6}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ color: T.t.m, fontSize: 9, fontFamily: mono, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
        <div style={{ color: T.t.p, fontSize: 20, fontFamily: mono, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ color: subC || T.t.s, fontSize: 11, fontFamily: mono, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
      {I && <div style={{
        width: 32, height: 32, borderRadius: T.rad.sm,
        background: (bc || T.accent) + '10',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><I size={16} style={{ color: bc || T.accent, opacity: 0.7 }} /></div>}
    </div>
  </DriftCard>
);

export const Badge = ({ children, color = T.accent, style = {} }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: T.rad.pill,
    fontSize: 10, fontFamily: mono, fontWeight: 600,
    color, background: color + "10",
    border: `1px solid ${color}20`,
    textTransform: "uppercase", letterSpacing: 0.5,
    ...style,
  }}>{children}</span>
);

export const Spark = ({ data, w = 70, h = 24 }) => {
  if (!data?.length) return null;
  const vals = data.map(d => d.price || d.y || 0);
  const cl = vals[vals.length - 1] >= vals[0] ? T.g.m : T.r.m;
  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  const xScale = d3.scaleLinear().domain([0, vals.length - 1]).range([0, w]);
  const yScale = d3.scaleLinear().domain(d3.extent(vals)).range([h - 2, 2]);

  const line = d3.line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d))
    .curve(d3.curveMonotoneX);

  const area = d3.area()
    .x((_, i) => xScale(i))
    .y0(h)
    .y1(d => yScale(d))
    .curve(d3.curveMonotoneX);

  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cl} stopOpacity="0.25" />
          <stop offset="100%" stopColor={cl} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area(vals)} fill={`url(#${gradId})`} />
      <path d={line(vals)} fill="none" stroke={cl} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const TabBar = ({ tabs, active, set }) => (
  <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.b.s}`, flexWrap: "wrap" }}>
    {tabs.map(t => <button key={t} onClick={() => set(t)} style={{
      padding: "8px 16px", border: "none", cursor: "pointer",
      fontFamily: mono, fontSize: 10, fontWeight: active === t ? 700 : 400,
      background: "transparent",
      color: active === t ? T.accent : T.t.m,
      borderBottom: active === t ? `2px solid ${T.accent}` : '2px solid transparent',
      textTransform: "uppercase", letterSpacing: 0.8,
      transition: T.tr.fast,
    }}>{t}</button>)}
  </div>
);

export const Gauge = ({ v }) => {
  const c = v >= 80 ? T.g.m : v >= 60 ? T.w.m : T.r.m;
  return (
    <div style={{ position: "relative", width: 44, height: 44 }}>
      <svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={22} cy={22} r={17} fill="none" stroke={T.bg.el} strokeWidth={3} />
        <circle cx={22} cy={22} r={17} fill="none" stroke={c} strokeWidth={3}
          strokeDasharray={`${(v / 100) * 107} 107`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 11, fontWeight: 700, color: c }}>{v}%</div>
    </div>
  );
};

export const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.bg.card + 'f5', backdropFilter: 'blur(12px)',
      border: `1px solid ${T.b.s}`, borderRadius: T.rad.sm,
      padding: "8px 12px", fontFamily: mono, fontSize: 10,
      boxShadow: T.shadow.md,
    }}>
      <div style={{ color: T.t.m, marginBottom: 3, fontSize: 9 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || T.t.p, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}
        </div>
      ))}
    </div>
  );
};

export const StrBar = ({ v, mx = 10 }) => {
  const p = (v / mx) * 100;
  const c = p >= 80 ? T.g.m : p >= 50 ? T.w.m : T.r.m;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 50, height: 4, borderRadius: T.rad.pill, background: T.bg.el, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: "100%", background: c, borderRadius: T.rad.pill, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontFamily: mono, fontSize: 10, color: c, fontWeight: 600 }}>{v}/{mx}</span>
    </div>
  );
};

export const Btn = ({ children, onClick, primary, danger, style = {} }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 5,
    padding: "7px 14px", borderRadius: T.rad.sm,
    border: primary ? "none" : danger ? `1px solid ${T.r.m}30` : `1px solid ${T.b.s}`,
    background: primary ? T.accent : danger ? T.r.m + '10' : T.bg.card,
    color: primary ? "#06060a" : danger ? T.r.m : T.t.s,
    cursor: "pointer", fontSize: 11, fontFamily: mono, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.5,
    transition: T.tr.fast,
    ...style,
  }}>{children}</button>
);

export const Toasts = ({ toasts }) => (
  <div style={{ position: "fixed", top: 14, right: 14, zIndex: 2000, display: "flex", flexDirection: "column", gap: 6 }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        padding: "10px 16px", borderRadius: T.rad.md, fontFamily: mono, fontSize: 11, color: "#fff",
        background: t.type === "error" ? T.r.m : t.type === "success" ? T.g.m : T.accent,
        display: "flex", alignItems: "center", gap: 8, maxWidth: 340,
        border: `1px solid ${t.type === "error" ? T.r.m : t.type === "success" ? T.g.m : T.accent}`,
        boxShadow: T.shadow.lg,
        animation: 'toastIn 0.2s ease-out',
      }}>
        {t.type === "error" ? <AlertTriangle size={13} /> : t.type === "success" ? <Check size={13} /> : <Bell size={13} />}
        {t.msg}
      </div>
    ))}
  </div>
);

// ErrorBoundary
import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, textAlign: 'center',
          background: T.bg.card, borderRadius: T.rad.lg,
          border: `1px solid ${T.r.m}20`, margin: 20,
        }}>
          <AlertTriangle size={32} color={T.r.m} style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: mono, fontSize: 14, color: T.t.p, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: T.t.m, marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: T.rad.sm,
              border: `1px solid ${T.accent}30`, background: T.accent + '10',
              color: T.accent, cursor: 'pointer', fontFamily: mono, fontSize: 11, fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
