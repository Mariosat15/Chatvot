'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ════════════════════════════════════════════════════════════════════
   CSS  —  all animations + fire background live here
════════════════════════════════════════════════════════════════════ */
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden}

  @keyframes livePulse{0%,100%{opacity:1;box-shadow:0 0 10px #ef4444}50%{opacity:0.4;box-shadow:0 0 3px #ef4444}}
  @keyframes vsFlicker{0%,100%{text-shadow:0 0 20px #ff6b35,0 0 40px #ff6b3544}50%{text-shadow:0 0 40px #ff6b35,0 0 80px #ff6b35,0 0 120px #ff330044}}
  @keyframes clutchPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.85;transform:scale(1.04)}}
  @keyframes dangerFlash{0%,100%{box-shadow:inset 0 0 80px rgba(239,68,68,.18),0 0 0 3px rgba(239,68,68,.5)}50%{box-shadow:inset 0 0 160px rgba(239,68,68,.38),0 0 0 5px rgba(239,68,68,1)}}
  @keyframes dangerTxt{0%,100%{text-shadow:0 0 30px #ef4444;opacity:1}50%{text-shadow:0 0 70px #ef4444,0 0 120px #ef444455;opacity:.85}}
  @keyframes winnerGlow{0%,100%{text-shadow:0 0 40px #ffd700,0 0 80px #ffd70066}50%{text-shadow:0 0 80px #ffd700,0 0 160px #ffd700aa,0 0 220px #ffd70033}}
  @keyframes bannerIn{0%{opacity:0;transform:translateX(80px) scale(.9)}12%,85%{opacity:1;transform:translateX(0) scale(1)}100%{opacity:0;transform:translateX(30px)}}
  @keyframes embers{0%{opacity:.9;transform:translateY(0) translateX(0) scale(1)}100%{opacity:0;transform:translateY(-120px) translateX(var(--etx,12px)) scale(.1)}}
  @keyframes confettiFall{0%{opacity:1;transform:translateY(-10px) rotate(0deg) translateX(0)}100%{opacity:.1;transform:translateY(105vh) rotate(var(--cr,360deg)) translateX(var(--ctx,0px))}}
  @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes pnlPop{0%{transform:scale(.92);opacity:.7}55%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
  @keyframes fireGlow{0%,100%{box-shadow:0 0 18px rgba(255,107,53,.7),0 0 36px rgba(255,107,53,.3)}50%{box-shadow:0 0 34px rgba(255,107,53,1),0 0 68px rgba(255,107,53,.5)}}
  @keyframes leaderGlow{0%,100%{filter:drop-shadow(0 0 8px #ffd700)}50%{filter:drop-shadow(0 0 20px #ffd700) drop-shadow(0 0 38px #ff6b3544)}}
  @keyframes screenShake{0%,100%{transform:translate(0)}20%{transform:translate(-5px,3px)}40%{transform:translate(4px,-3px)}60%{transform:translate(-3px,4px)}80%{transform:translate(3px,-2px)}}
  @keyframes sparkle{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
  @keyframes borderPulse{0%,100%{border-color:rgba(239,68,68,.4)}50%{border-color:rgba(239,68,68,1)}}

  .live{animation:livePulse 1.5s ease-in-out infinite}
  .vs-txt{animation:vsFlicker 2s ease-in-out infinite}
  .clutch{animation:clutchPulse .65s ease-in-out infinite}
  .dng{animation:dangerFlash .55s ease-in-out infinite}
  .dng-txt{animation:dangerTxt .7s ease-in-out infinite}
  .winner{animation:winnerGlow 1.5s ease-in-out infinite}
  .banner{animation:bannerIn 6.5s ease forwards}
  .pnl{animation:pnlPop .45s ease}
  .fire-sep{animation:fireGlow 1.8s ease-in-out infinite}
  .leader{animation:leaderGlow 2.5s ease-in-out infinite}
  .ticker{animation:tickerScroll 55s linear infinite}
  ::-webkit-scrollbar{width:0;height:0}
`;

/* ════════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════════ */
type P = {
  userId: string; username: string; profileImage: string | null;
  liveEquity: number; livePnl: number; liveRoi: number;
  totalTrades: number; winRate: number; availableCapital: number;
  currentCapital: number; usedMargin: number; currentOpenPositions: number;
  status: string; isDisqualified: boolean; rankValue: number;
  profitFactor: number; rank: number; lastTradeAt: string | null;
  maxDrawdownPercentage: number;
};
type Pos = {
  userId: string; username: string; symbol: string; side: string;
  quantity: number; entryPrice: number; unrealizedPnl: number; leverage: number;
};
type Ev = {
  id: string; type: string; name: string; status: string;
  startTime: string; endTime: string | null; prizePool: number;
  startingCapital: number; currentParticipants: number;
  rankingMethod: string; participants: P[]; openPositions: Pos[];
};
type Banner = { id: string; text: string; color: string; icon: string };

/* ════════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════════ */
const fmtP = (v: number) =>
  (v >= 0 ? '+' : '-') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtE = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
const timer = (end: string | null) => {
  if (!end) return '--:--';
  const d = new Date(end).getTime() - Date.now();
  if (d <= 0) return '00:00';
  const h = d / 3_600_000, m = (d % 3_600_000) / 60_000, s = (d % 60_000) / 1_000;
  return h >= 1 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};
const isClutch = (end: string | null) => {
  if (!end) return false;
  const d = new Date(end).getTime() - Date.now();
  return d > 0 && d < 600_000; // last 10 min
};
const dngPct = (p: P) => p.currentCapital > 0 ? Math.min((p.usedMargin / p.currentCapital) * 100, 100) : 0;
const calcVol = (ps: P[]) => {
  if (!ps.length) return { label: 'LOW', pct: 18, col: '#10b981' };
  const avg = ps.reduce((a, p) => a + Math.abs(p.livePnl), 0) / ps.length;
  const r = (avg / (ps[0]?.currentCapital || 10000)) * 100;
  return r > 2 ? { label: 'HIGH', pct: 88, col: '#ef4444' }
    : r > 0.5 ? { label: 'MEDIUM', pct: 52, col: '#f59e0b' }
    : { label: 'LOW', pct: 18, col: '#10b981' };
};
const calcBets = (ps: P[]) => {
  const a = ps.filter(x => !x.isDisqualified);
  if (!a.length) return [] as Array<{ userId: string; pct: number }>;
  const sc = a.map(p => ({
    userId: p.userId,
    s: Math.max((p.liveEquity / (p.currentCapital || 10000)) * 50
      + (p.winRate / 100) * 28 + Math.min(p.profitFactor || 0, 3) * 10
      + (p.totalTrades > 0 ? 12 : 0), 1),
  }));
  const t = sc.reduce((x, s) => x + s.s, 0) || 1;
  return sc.map(s => ({ userId: s.userId, pct: Math.round((s.s / t) * 100) }));
};
const traderStyle = (p: P) => {
  if (!p.totalTrades) return 'WAITING';
  if (p.totalTrades >= 10) return 'SCALPER';
  if (p.winRate >= 70) return 'SNIPER';
  if (Math.abs(p.livePnl / (p.currentCapital || 10000)) > 0.04) return 'HIGH-RISK';
  return 'SWING';
};
const riskBadge = (p: P) => {
  const d = dngPct(p);
  if (d > 75) return { label: '⚠ DANGER', col: '#ef4444' };
  if (d > 45) return { label: '⚡ RISKY', col: '#f59e0b' };
  if (p.winRate >= 65) return { label: '⚖ SNIPER', col: '#00d4ff' };
  return { label: '● STABLE', col: '#475569' };
};
const avatarColor = (n: string) =>
  ['#00d4ff', '#ff6b35', '#7c3aed', '#10b981', '#f59e0b', '#ec4899'][n.charCodeAt(0) % 6];

/* ════════════════════════════════════════════════════════════════════
   EQUITY LINE CHART  (SVG area chart — real live equity data)
════════════════════════════════════════════════════════════════════ */
const EquityLine = ({
  history, w = 300, h = 140,
}: { history: number[]; w?: number; h?: number }) => {
  // Need at least 2 points; pad with the first value if shorter
  const data = history.length < 2
    ? [history[0] ?? 10000, history[0] ?? 10000]
    : history;

  const minV = Math.min(...data), maxV = Math.max(...data);
  const range = maxV - minV || data[0] * 0.002 || 1; // avoid zero range
  const PT = 10, PB = 22, PL = 4, PR = 44;
  const cw = w - PL - PR, ch = h - PT - PB;
  const sx = (i: number) => PL + (i / (data.length - 1)) * cw;
  const sy = (v: number) => PT + (1 - (v - minV) / range) * ch;

  const first = data[0], last = data[data.length - 1];
  const isPos = last >= first;
  const col = isPos ? '#00ff88' : '#ff3366';
  const pct = ((last - first) / (first || 1)) * 100;
  const uid = `el${w}${h}${col.slice(1, 4)}`;

  // Build SVG path points
  const pts = data.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  // Area polygon: line + close along bottom
  const area = `${PL},${PT + ch} ${pts} ${sx(data.length - 1)},${PT + ch}`;

  // 5-point moving average for smooth overlay
  const ma: number[] = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 4), i + 1);
    return slice.reduce((a, v) => a + v, 0) / slice.length;
  });
  const maPts = ma.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.35" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={PL} x2={w - PR} y1={PT + f * ch} y2={PT + f * ch}
          stroke="#ffffff08" strokeWidth="1" />
      ))}

      {/* Area fill */}
      <polygon points={area} fill={`url(#${uid})`} />

      {/* Main equity line */}
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${col}99)` }} />

      {/* 5-MA smooth overlay */}
      <polyline points={maPts} fill="none" stroke={col} strokeWidth="1"
        strokeLinejoin="round" opacity="0.35" strokeDasharray="4 3" />

      {/* Right axis labels */}
      {[0, 0.5, 1].map(f => {
        const price = minV + (1 - f) * range;
        return (
          <text key={f} x={w - PR + 5} y={PT + f * ch + 3.5}
            fill="#3a3a5a" fontSize="7.5" fontFamily="var(--font-geist-mono)">
            {price.toFixed(0)}
          </text>
        );
      })}

      {/* Current-price dashed line */}
      <line x1={PL} x2={w - PR} y1={sy(last)} y2={sy(last)}
        stroke={col} strokeWidth="1" strokeDasharray="5 3" opacity="0.45" />
      {/* Current price label on right */}
      <rect x={w - PR + 2} y={sy(last) - 8} width={PR - 3} height={13} rx="3"
        fill={col} opacity="0.15" />
      <text x={w - PR + 4} y={sy(last) + 2.5} fill={col}
        fontSize="8" fontFamily="var(--font-geist-mono)" fontWeight="700">
        {last.toFixed(0)}
      </text>

      {/* % change label bottom-left */}
      <text x={PL + 3} y={h - 5} fill={col}
        fontSize="10" fontFamily="var(--font-geist-mono)" fontWeight="700">
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </text>

      {/* Dot at current position */}
      <circle cx={sx(data.length - 1)} cy={sy(last)} r="4" fill={col}
        style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════════════
   SVG SPEEDOMETER GAUGE
════════════════════════════════════════════════════════════════════ */
const Gauge = ({
  pct, label, col, size = 90,
}: { pct: number; label: string; col: string; size?: number }) => {
  const cx = size / 2, cy = size * 0.52, r = size * 0.36;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const fill = arc * Math.min(Math.max(pct / 100, 0), 1);
  const sw = size * 0.085;
  return (
    <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
      <g transform={`rotate(135,${cx},${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0c0c1e" strokeWidth={sw}
          strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
        {fill > 1 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={sw}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
        )}
      </g>
      <text x={cx} y={size * 0.73} textAnchor="middle" fill={col}
        fontSize={size * 0.14} fontWeight="900" fontFamily="var(--font-geist-mono)">
        {label}
      </text>
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════════════
   AVATAR
════════════════════════════════════════════════════════════════════ */
const Av = ({ p, size = 56, ring }: { p: P; size?: number; ring?: string }) => {
  const c = ring || avatarColor(p.username);
  const init = p.username.slice(0, 2).toUpperCase();
  const inner = p.profileImage
    ? <img src={p.profileImage} alt="" width={size - 6} height={size - 6}
        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    : <div style={{
        width: size - 6, height: size - 6, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle at 32% 32%, ${c}55, ${c}18)`,
        fontFamily: 'var(--font-geist-mono)', fontSize: (size - 6) * 0.36, fontWeight: 700, color: c,
      }}>{init}</div>;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', padding: 3, flexShrink: 0,
      background: `conic-gradient(${c} 0%, ${c}44 50%, ${c} 100%)`,
      boxShadow: `0 0 ${size * 0.4}px ${c}77`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{inner}</div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   MINI SPARKLINE
════════════════════════════════════════════════════════════════════ */
const Spark = ({ hist, col, w = 90, h = 30 }: { hist: number[]; col: string; w?: number; h?: number }) => {
  if (hist.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...hist), mx = Math.max(...hist), rng = mx - mn || 1;
  const P = 2;
  const pts = hist.map((v, i) =>
    `${P + (i / (hist.length - 1)) * (w - P * 2)},${P + (1 - (v - mn) / rng) * (h - P * 2)}`).join(' ');
  const uid = col.replace(/[^a-z0-9]/gi, '').slice(0, 6) + w;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.4" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`2,${h} ${pts} ${w - 2},${h}`} fill={`url(#sg${uid})`} />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2.2"
        strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${col})` }} />
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════════════
   DANGER METER
════════════════════════════════════════════════════════════════════ */
const DangerMeter = ({ p }: { p: P }) => {
  const d = dngPct(p);
  if (d < 20) return null;
  const col = d > 70 ? '#ef4444' : d > 45 ? '#f59e0b' : '#eab308';
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, marginTop: 6,
      background: d > 70 ? '#1a020280' : '#14100080',
      border: `1px solid ${col}44`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: col,
          fontFamily: 'var(--font-geist-mono)' }}>
          {d > 70 ? '⚠ DANGER ZONE' : '⚡ RISKY LEVERAGE'}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, color: col, fontWeight: 700 }}>
          {d.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 9, background: '#0a0a16', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${d}%`, height: '100%', borderRadius: 5, transition: 'width 1s ease',
          background: d > 70 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : `linear-gradient(90deg,${col}77,${col})`,
          boxShadow: d > 70 ? '0 0 12px #ef444466' : 'none',
        }} />
      </div>
      {d > 70 && (
        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 5 }}>
          % To Liquidation: <strong>{(100 - d).toFixed(1)}%</strong> · <strong>HIGH</strong>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   TRADER CARD — used in Battle View
════════════════════════════════════════════════════════════════════ */
const TraderCard = ({
  p, side, betPct, sparks, positions,
}: { p: P; side: 'left' | 'right'; betPct: number; sparks: number[]; positions: Pos[] }) => {
  const isL = side === 'left';
  const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
  const myPos = positions.filter(x => x.userId === p.userId)[0];

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px',
      background: isL
        ? 'radial-gradient(ellipse at 0% 0%,#0a1a0a,#05080508 65%), #060c06'
        : 'radial-gradient(ellipse at 100% 0%,#1a0808,#08040608 65%), #0c0608',
      position: 'relative', overflow: 'hidden',
      borderTop: `2px solid ${pnlC}1a`,
      borderLeft: isL ? `2px solid ${pnlC}1a` : 'none',
      borderRight: isL ? 'none' : `2px solid ${pnlC}1a`,
      borderBottom: `2px solid ${pnlC}1a`,
      borderRadius: isL ? '12px 0 0 12px' : '0 12px 12px 12px',
    }}>
      {/* Corner radial glow */}
      <div style={{
        position: 'absolute', [isL ? 'left' : 'right']: 0, top: 0,
        width: 300, height: 300, pointerEvents: 'none',
        background: `radial-gradient(ellipse at ${isL ? '0% 0%' : '100% 0%'},${pnlC}16,transparent 55%)`,
      }} />

      {/* — Header row — */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        flexDirection: isL ? 'row' : 'row-reverse',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Av p={p} size={70} ring={pnlC} />
          <div style={{
            position: 'absolute', bottom: 3, right: 3, width: 14, height: 14,
            borderRadius: '50%', background: '#00ff88', border: '2px solid #060c06',
            boxShadow: '0 0 8px #00ff88bb',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: isL ? 'left' : 'right' }}>
          <div style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: 24, fontWeight: 900, color: '#fff',
            letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textShadow: `0 0 16px ${pnlC}55`,
          }}>{p.username}</div>
          <div style={{ fontSize: 11, color: pnlC, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
            ▲ {traderStyle(p)}
          </div>
          {myPos && (
            <div style={{ fontSize: 10, color: '#555', marginTop: 2, fontFamily: 'var(--font-geist-mono)' }}>
              {myPos.side.toUpperCase()} {myPos.symbol} · {myPos.leverage}x
            </div>
          )}
        </div>
      </div>

      {/* — GIANT P&L — */}
      <div className="pnl" style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: 60, fontWeight: 900, lineHeight: 1,
        color: pnlC, textAlign: isL ? 'left' : 'right', letterSpacing: '-0.025em',
        textShadow: `0 0 30px ${pnlC}cc, 0 0 60px ${pnlC}55`,
        marginBottom: 3,
      }}>{fmtP(p.livePnl)}</div>

      <div style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: '#555',
        textAlign: isL ? 'left' : 'right', marginBottom: 10,
      }}>
        Equity: <span style={{ color: '#777' }}>{fmtE(p.liveEquity)}</span>
        <span style={{ marginLeft: 8, color: p.liveRoi >= 0 ? '#00ff8866' : '#ff336666' }}>
          {p.liveRoi >= 0 ? '+' : ''}{p.liveRoi.toFixed(2)}%
        </span>
      </div>

      {/* — Candlestick chart — */}
      <div style={{
        background: '#050510', borderRadius: 9, overflow: 'hidden',
        border: '1px solid #ffffff08', marginBottom: 10, flexShrink: 0,
      }}>
        <EquityLine history={sparks} w={330} h={152} />
      </div>

      {/* — Stats row — */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
        {[
          { l: 'TRADES', v: p.totalTrades.toString() },
          { l: 'WIN RATE', v: `${p.winRate.toFixed(0)}%` },
          { l: 'OPEN', v: p.currentOpenPositions.toString() },
        ].map(s => (
          <div key={s.l} style={{
            background: '#0a0a18', borderRadius: 7, padding: '6px 4px',
            textAlign: 'center', border: '1px solid #ffffff08',
          }}>
            <div style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 17, fontWeight: 700, color: '#dde',
            }}>{s.v}</div>
            <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.1em' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* — Crowd backing — */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#333', letterSpacing: '0.12em' }}>CROWD BACKING</span>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700, color: pnlC }}>
            {betPct}%
          </span>
        </div>
        <div style={{ height: 8, background: '#0a0a18', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${betPct}%`, height: '100%', borderRadius: 4, transition: 'width 1.4s ease',
            background: `linear-gradient(90deg,${pnlC}55,${pnlC})`,
            boxShadow: `0 0 10px ${pnlC}55`,
          }} />
        </div>
      </div>

      <DangerMeter p={p} />
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   BATTLE VIEW  (1v1 or challenge)
════════════════════════════════════════════════════════════════════ */
const BattleView = ({ ev, sparks }: { ev: Ev; sparks: Record<string, number[]> }) => {
  const active = ev.participants.filter(p => !p.isDisqualified);
  const [a, b] = active;
  if (!a) return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#111', fontFamily: 'var(--font-geist-mono)', fontSize: 20, letterSpacing: '0.2em',
    }}>WAITING FOR TRADERS…</div>
  );
  const betsArr = calcBets(active);
  const betA = betsArr.find(x => x.userId === a.userId)?.pct ?? 50;
  const betB = b ? (betsArr.find(x => x.userId === b.userId)?.pct ?? (100 - betA)) : 50;
  const vv = calcVol(active);

  return (
    <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
      <TraderCard p={a} side="left" betPct={betA}
        sparks={sparks[a.userId] || [a.liveEquity]} positions={ev.openPositions} />

      {/* — Fire separator + VS — */}
      <div className="fire-sep" style={{
        width: 4, flexShrink: 0, position: 'relative',
        background: 'linear-gradient(to bottom, transparent, #ff6b35 18%, #ff9500 50%, #ff6b35 82%, transparent)',
      }}>
        {/* VS badge */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 5,
        }}>
          <div style={{
            width: 66, height: 66, borderRadius: '50%', background: '#080812',
            border: '2px solid #ff6b3555', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 28px #ff6b3544',
          }}>
            <span className="vs-txt" style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 20, fontWeight: 900, color: '#ff6b35',
            }}>VS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Gauge pct={vv.pct} label={vv.label} col={vv.col} size={82} />
            <div style={{ fontSize: 8, color: '#222', letterSpacing: '0.12em', marginTop: -4 }}>VOLATILITY</div>
          </div>
          <div style={{
            background: '#08080e', borderRadius: 8, padding: '6px 10px', textAlign: 'center',
            border: '1px solid #ffffff08',
          }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>
              {ev.openPositions.length}
            </div>
            <div style={{ fontSize: 8, color: '#222', letterSpacing: '0.1em' }}>OPEN</div>
          </div>
        </div>
        {/* Fire sparks */}
        {[18, 33, 50, 67, 82].map((top, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: `${top}%`,
            width: 5, height: 5, borderRadius: '50%', transform: 'translateX(-50%)',
            background: i % 2 === 0 ? '#ffd700' : '#ff6b35',
            boxShadow: `0 0 6px ${i % 2 === 0 ? '#ffd700' : '#ff6b35'}`,
            animation: `embers ${2.2 + i * 0.3}s ease-in ${i * 0.42}s infinite`,
            ['--etx' as any]: `${(i % 2 === 0 ? -14 : 14) * (1 + i % 2)}px`,
          }} />
        ))}
      </div>

      {b ? (
        <TraderCard p={b} side="right" betPct={betB}
          sparks={sparks[b.userId] || [b.liveEquity]} positions={ev.openPositions} />
      ) : (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#111', fontFamily: 'var(--font-geist-mono)',
        }}>WAITING FOR OPPONENT</div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   GRID VIEW  (3–8 traders — one card per trader with full chart)
════════════════════════════════════════════════════════════════════ */
const GridView = ({ ev, sparks }: { ev: Ev; sparks: Record<string, number[]> }) => {
  const traders = ev.participants.filter(p => !p.isDisqualified).slice(0, 8);
  const medals: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
  const rc: Record<number, string> = { 0: '#ffd700', 1: '#c0c0c0', 2: '#cd7f32' };

  return (
    <div style={{
      flex: 1, display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gridTemplateRows: `repeat(${Math.ceil(traders.length / 2)},1fr)`,
      gap: 8, overflow: 'hidden',
    }}>
      {traders.map((p, i) => {
        const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
        const d = dngPct(p);
        const rank = rc[i] || '#475569';
        const hist = sparks[p.userId] || [p.liveEquity];
        const myPos = ev.openPositions.filter(x => x.userId === p.userId)[0];
        const rb = riskBadge(p);
        return (
          <div key={p.userId} style={{
            display: 'flex', flexDirection: 'column', padding: '10px 12px',
            background: '#07070f',
            borderRadius: 9,
            border: i === 0 ? '1px solid #ffd70033' : d > 70 ? '1px solid #ef444433' : '1px solid #ff6b3518',
            boxShadow: i === 0 ? '0 0 24px #ffd70010' : d > 70 ? '0 0 18px #ef444414' : 'none',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Top info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: i < 3 ? 18 : 13,
                color: rank, flexShrink: 0 }}>
                {i < 3 ? medals[i] : `#${i + 1}`}
              </span>
              <Av p={p} size={36} ring={rank} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: 13, fontWeight: 700,
                  color: i === 0 ? '#ffd700' : '#dde',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  textShadow: i === 0 ? '0 0 8px #ffd70044' : 'none',
                }}>{p.username}</div>
                <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.08em' }}>{traderStyle(p)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: 19, fontWeight: 800,
                  color: pnlC, textShadow: `0 0 10px ${pnlC}66`, lineHeight: 1,
                }}>{fmtP(p.livePnl)}</div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>{p.winRate.toFixed(0)}% WR</div>
              </div>
            </div>

            {/* Chart */}
            <div style={{
              background: '#050510', borderRadius: 7, overflow: 'hidden',
              border: '1px solid #ffffff06', flex: 1, minHeight: 0,
            }}>
              <EquityLine history={hist} w={320} h={106} />
            </div>

            {/* Bottom badges */}
            <div style={{ display: 'flex', gap: 5, marginTop: 6, alignItems: 'center' }}>
              {myPos && (
                <div style={{
                  padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                  fontFamily: 'var(--font-geist-mono)',
                  background: myPos.side === 'long' ? '#00ff8812' : '#ff336612',
                  border: `1px solid ${myPos.side === 'long' ? '#00ff8830' : '#ff336630'}`,
                  color: myPos.side === 'long' ? '#00ff88' : '#ff3366',
                }}>
                  {myPos.side.toUpperCase()} {myPos.symbol} · {myPos.leverage}x
                </div>
              )}
              <div style={{
                marginLeft: 'auto', padding: '2px 7px', borderRadius: 5, fontSize: 9,
                background: `${rb.col}12`, border: `1px solid ${rb.col}30`, color: rb.col,
                letterSpacing: '0.08em',
              }}>{rb.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   CHAMPIONSHIP VIEW  (9+ traders)
════════════════════════════════════════════════════════════════════ */
const ChampionshipView = ({ ev, sparks }: { ev: Ev; sparks: Record<string, number[]> }) => {
  const traders = ev.participants.filter(p => !p.isDisqualified && p.totalTrades > 0);
  const betsArr = calcBets(traders);
  const medals: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
  const rc: Record<number, string> = { 0: '#ffd700', 1: '#c0c0c0', 2: '#cd7f32' };
  const winners = traders.filter(p => p.livePnl >= 0).length;
  const total = traders.length || 1;

  return (
    <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
      {/* — Leaderboard — */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          fontSize: 10, color: '#ff6b35', letterSpacing: '0.2em', marginBottom: 8,
          fontFamily: 'var(--font-geist-mono)', textShadow: '0 0 8px #ff6b3544',
        }}>⚡ LIVE LEADERBOARD</div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {traders.map((p, i) => {
            const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
            const hist = sparks[p.userId] || [p.liveEquity];
            const d = dngPct(p);
            return (
              <div key={p.userId}
                className={i === 0 ? 'leader' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
                  borderRadius: 9,
                  background: i === 0 ? '#0d0b0010' : '#070710',
                  border: i === 0 ? '1px solid #ffd70033' : d > 70 ? '1px solid #ef444422' : '1px solid #ffffff06',
                  transition: 'all 0.5s ease',
                }}>
                <div style={{ width: 34, textAlign: 'center', flexShrink: 0 }}>
                  {i < 3
                    ? <span style={{ fontSize: 20 }}>{medals[i]}</span>
                    : <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: rc[i] || '#475569' }}>
                        #{i + 1}
                      </span>}
                </div>
                <Av p={p} size={38} ring={rc[i] || '#475569'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700,
                    color: i === 0 ? '#ffd700' : '#dde',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textShadow: i === 0 ? '0 0 8px #ffd70044' : 'none',
                  }}>{p.username}</div>
                  <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.08em' }}>{traderStyle(p)}</div>
                </div>
                <Spark hist={hist} col={pnlC} w={82} h={28} />
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 94 }}>
                  <div style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700,
                    color: pnlC, textShadow: `0 0 8px ${pnlC}55`,
                  }}>{fmtP(p.livePnl)}</div>
                  <div style={{ fontSize: 9, color: '#444' }}>{p.winRate.toFixed(0)}% WR · {p.totalTrades}T</div>
                </div>
              </div>
            );
          })}
          {/* Awaiting */}
          {ev.participants.filter(p => !p.isDisqualified && !p.totalTrades).map(p => (
            <div key={p.userId} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px',
              borderRadius: 9, background: '#050509', border: '1px solid #ffffff04', opacity: 0.35,
            }}>
              <div style={{ width: 34 }} />
              <Av p={p} size={30} />
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: '#222' }}>{p.username}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#1a1a28', letterSpacing: '0.1em' }}>
                AWAITING TRADE
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* — Right panel — */}
      <div style={{ width: 225, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Winners vs Losers */}
        <div style={{ background: '#07070f', borderRadius: 10, padding: 14, border: '1px solid #ff6b3518' }}>
          <div style={{ fontSize: 10, color: '#ff6b35', letterSpacing: '0.18em', marginBottom: 10,
            fontFamily: 'var(--font-geist-mono)' }}>WINNERS vs LOSERS</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 30, fontWeight: 900, color: '#00ff88',
              textShadow: '0 0 16px #00ff8866' }}>{Math.round((winners / total) * 100)}%</span>
            <span style={{ color: '#222', fontSize: 14 }}>vs</span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 30, fontWeight: 900, color: '#ff3366',
              textShadow: '0 0 16px #ff336666' }}>{Math.round(((total - winners) / total) * 100)}%</span>
          </div>
          <div style={{ height: 9, background: '#0a0a18', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(winners / total) * 100}%`, height: '100%',
              background: 'linear-gradient(90deg,#00ff8855,#00ff88)', borderRadius: 5, transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* Crowd backing */}
        <div style={{ background: '#07070f', borderRadius: 10, padding: 14, border: '1px solid #ffffff08', flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.18em', marginBottom: 12,
            fontFamily: 'var(--font-geist-mono)' }}>CROWD BACKING</div>
          {betsArr.slice(0, 6).map(b => {
            const p = traders.find(x => x.userId === b.userId);
            if (!p) return null;
            const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
            return (
              <div key={b.userId} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#777', fontFamily: 'var(--font-geist-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 116 }}>
                    {p.username}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: pnlC,
                    fontFamily: 'var(--font-geist-mono)' }}>{b.pct}%</span>
                </div>
                <div style={{ height: 5, background: '#0d0d1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${b.pct}%`, height: '100%',
                    background: `linear-gradient(90deg,${pnlC}44,${pnlC})`,
                    borderRadius: 3, transition: 'width 1.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Open positions */}
        <div style={{ background: '#07070f', borderRadius: 10, padding: 12, border: '1px solid #ffffff07',
          maxHeight: 150, overflow: 'auto' }}>
          <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.18em', marginBottom: 8,
            fontFamily: 'var(--font-geist-mono)' }}>OPEN POSITIONS</div>
          {ev.openPositions.slice(0, 6).map((pos, i) => {
            const c = pos.side === 'long' ? '#00ff88' : '#ff3366';
            return (
              <div key={i} style={{ padding: '5px 7px', background: '#0a0a16', borderRadius: 6,
                border: `1px solid ${c}14`, marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#666', fontFamily: 'var(--font-geist-mono)' }}>{pos.symbol}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{pos.side.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 9, color: '#444' }}>{pos.username} · {pos.leverage}x</div>
              </div>
            );
          })}
          {!ev.openPositions.length && (
            <div style={{ color: '#181828', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              No open positions
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   CONFETTI  (CSS-only, 64 pieces)
════════════════════════════════════════════════════════════════════ */
const Confetti = ({ active }: { active: boolean }) => {
  if (!active) return null;
  const cols = ['#ffd700', '#00ff88', '#ff6b35', '#00d4ff', '#ff3366', '#7c3aed', '#f59e0b'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 400, overflow: 'hidden' }}>
      {Array.from({ length: 64 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: '-12px',
          left: `${(i * 1.57) % 100}%`,
          width: 6 + (i % 5), height: 6 + (i % 5),
          background: cols[i % cols.length],
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          boxShadow: `0 0 4px ${cols[i % cols.length]}`,
          opacity: 1,
          animation: `confettiFall ${3 + (i % 4) * 0.6}s ease-in ${(i * 0.055) % 2.5}s forwards`,
          ['--cr' as any]: `${(i * 37 - 180) % 720}deg`,
          ['--ctx' as any]: `${((i * 13) % 200) - 100}px`,
        }} />
      ))}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   BOTTOM STATS BAR
════════════════════════════════════════════════════════════════════ */
const StatsBar = ({ ev, stats }: { ev: Ev | null; stats: any }) => {
  const traders = ev?.participants.filter(p => !p.isDisqualified) ?? [];
  const winners = traders.filter(p => p.livePnl >= 0).length;
  const total = traders.length || 1;
  const totalTrades = traders.reduce((a, p) => a + p.totalTrades, 0);
  return (
    <div style={{
      height: 44, background: 'linear-gradient(180deg,#090910,#060609)',
      borderTop: '1px solid #ff6b3518',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 10, color: '#ff6b35', letterSpacing: '0.15em', fontWeight: 700 }}>⚡ BETS</span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 16, fontWeight: 700, color: '#ffd700',
          textShadow: '0 0 10px #ffd70055' }}>
          ${(stats?.totalPrizePool || ev?.prizePool || 0).toLocaleString()}
        </span>
      </div>
      <div style={{ width: 1, height: 26, background: '#ffffff08', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#333', letterSpacing: '0.12em' }}>TOTAL TRADES</span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: '#00d4ff' }}>
          {totalTrades}
        </span>
      </div>
      <div style={{ width: 1, height: 26, background: '#ffffff08', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, fontWeight: 700, color: '#00ff88',
          textShadow: '0 0 8px #00ff8855' }}>
          {Math.round((winners / total) * 100)}% WIN
        </span>
        <span style={{ color: '#222', fontSize: 12 }}>▸</span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, fontWeight: 700, color: '#ff3366',
          textShadow: '0 0 8px #ff336655' }}>
          {Math.round(((total - winners) / total) * 100)}% LOSS
        </span>
      </div>
      <div style={{ flex: 1, height: 5, background: '#0a0a18', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${(winners / total) * 100}%`, height: '100%',
          background: 'linear-gradient(90deg,#00ff8855,#00ff88)',
          borderRadius: 3, transition: 'width 1s ease',
        }} />
      </div>
      <div style={{ width: 1, height: 26, background: '#ffffff08', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>OPEN</span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
          {stats?.openPositions ?? 0}
        </span>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   PRICE TICKER + COMMENTATOR
════════════════════════════════════════════════════════════════════ */
const Ticker = ({
  prices, positions, comment,
}: { prices: Record<string, any>; positions: Pos[]; comment: string }) => {
  const pairs = Object.entries(prices).slice(0, 14)
    .map(([sym, p]) => `${sym}  ${(p.bid ?? 0).toFixed(5)} / ${(p.ask ?? 0).toFixed(5)}`);
  const trades = positions.slice(0, 6)
    .map(p => `${p.username} ${p.side === 'long' ? '▲' : '▼'} ${p.symbol} ${p.leverage}x`);
  const items = [...pairs, ...trades];
  const doubled = [...items, ...items];

  return (
    <div style={{
      height: 36, background: '#05050c', borderTop: '1px solid #ffffff07',
      display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        padding: '0 12px', borderRight: '1px solid #ffffff08', fontSize: 10,
        color: '#00d4ff', letterSpacing: '0.15em', whiteSpace: 'nowrap', flexShrink: 0,
        fontFamily: 'var(--font-geist-mono)',
      }}>◉ LIVE</div>
      {comment && (
        <div style={{
          padding: '0 14px', borderRight: '1px solid #ffffff08', fontSize: 11,
          color: '#ffd700', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 420,
          overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-geist-mono)',
          textShadow: '0 0 8px #ffd70044',
        }}>🎙 {comment}</div>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ticker" style={{
          display: 'flex', gap: 50, whiteSpace: 'nowrap',
          fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#444',
        }}>
          {doubled.map((s, i) => <span key={i} style={{ flexShrink: 0 }}>{s}</span>)}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════ */
export default function StreamPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>(null);
  const [curIdx, setCurIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [comment, setComment] = useState('');
  const [confetti, setConfetti] = useState(false);
  const [dangerActive, setDangerActive] = useState(false);
  const [muted, setMuted] = useState(true);
  const [, setTick] = useState(0);

  const sparksRef = useRef<Record<string, number[]>>({});
  const prevRankRef = useRef<Record<string, number>>({});
  const prevPnlRef = useRef<Record<string, number>>({});
  const prevTradesRef = useRef<Record<string, number>>({});

  // ── Sound system (Web Audio API, no external files) ──────────────
  const tone = useCallback((freq: number, dur = 0.3, type: OscillatorType = 'sine', vol = 0.07) => {
    if (muted || typeof window === 'undefined') return;
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch { /* silently ignore AudioContext errors */ }
  }, [muted]);

  const addBanner = useCallback((text: string, color: string, icon: string) => {
    const b: Banner = { id: `${Date.now()}-${Math.random()}`, text, color, icon };
    setBanners(prev => [...prev.slice(-3), b]);
    setTimeout(() => setBanners(prev => prev.filter(x => x.id !== b.id)), 7000);
  }, []);

  // ── Data fetch ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/competitions', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();

      const all: Ev[] = [
        ...(d.competitions || []),
        ...(d.challenges || []),
      ].filter((e: Ev) => e.status === 'active');

      // Update sparklines
      all.forEach(ev => {
        ev.participants.forEach(p => {
          const k = `${ev.id}:${p.userId}`;
          if (!sparksRef.current[k]) sparksRef.current[k] = [];
          sparksRef.current[k].push(p.liveEquity);
          if (sparksRef.current[k].length > 40) sparksRef.current[k].shift();
        });
      });

      // Detect events → commentary + banners
      let latestComment = '';
      let anyDanger = false;

      all.forEach(ev => {
        ev.participants.forEach(p => {
          const prevRank = prevRankRef.current[p.userId];
          const prevPnl = prevPnlRef.current[p.userId];
          const d = p.currentCapital > 0 ? (p.usedMargin / p.currentCapital) * 100 : 0;

          // Danger
          if (d > 75) {
            anyDanger = true;
            latestComment = `⚠ ${p.username} approaching liquidation — ${d.toFixed(0)}% margin used!`;
            tone(440, 0.3, 'sawtooth', 0.05);
          }

          // New leader
          if (prevRank && p.rank < prevRank && p.rank === 1) {
            addBanner(`🏆 ${p.username} TAKES THE LEAD!`, '#ffd700', '🏆');
            latestComment = `🏆 ${p.username} overtakes to #1!`;
            tone(880, 0.15); setTimeout(() => tone(1108, 0.15), 160); setTimeout(() => tone(1320, 0.3), 320);
            setConfetti(true); setTimeout(() => setConfetti(false), 5000);
          } else if (prevRank && p.rank < prevRank && p.rank <= 3) {
            addBanner(`🏅 ${p.username} OVERTAKES TO #${p.rank}!`, '#ffd700', '🏅');
            tone(660, 0.3, 'triangle');
          }

          // Big move
          if (prevPnl !== undefined) {
            const delta = p.livePnl - prevPnl;
            if (Math.abs(delta) > 50) {
              addBanner(
                `${delta > 0 ? '🔥' : '💥'} ${p.username} ${delta > 0 ? '+' : '-'}$${Math.abs(delta).toFixed(2)}`,
                delta > 0 ? '#00ff88' : '#ff3366',
                delta > 0 ? '🔥' : '💥',
              );
              latestComment = `${p.username} just ${delta > 0 ? 'gained' : 'lost'} $${Math.abs(delta).toFixed(2)} in one swing!`;
              tone(delta > 0 ? 660 : 220, 0.5, 'triangle');
            }
          }

          // New trade
          const prevT = prevTradesRef.current[p.userId];
          if (prevT !== undefined && p.totalTrades > prevT) {
            const myPos = ev.openPositions.find(x => x.userId === p.userId);
            if (myPos) latestComment = `${p.username} just entered a ${myPos.leverage}x ${myPos.side.toUpperCase()} on ${myPos.symbol}!`;
          }

          prevRankRef.current[p.userId] = p.rank;
          prevPnlRef.current[p.userId] = p.livePnl;
          prevTradesRef.current[p.userId] = p.totalTrades;
        });
      });

      setDangerActive(anyDanger);
      if (latestComment) setComment(latestComment);
      setEvents(all);
      if (d.prices) setPrices(d.prices);
      if (d.stats) setStats(d.stats);
      setLoading(false);
    } catch { /* silent */ }
  }, [addBanner, tone]);

  // 5-second poll + visibility pause
  useEffect(() => {
    fetchData();
    let iv: ReturnType<typeof setInterval> | null = setInterval(fetchData, 5000);
    const onVis = () => {
      if (document.hidden) { if (iv) { clearInterval(iv); iv = null; } }
      else { fetchData(); iv = setInterval(fetchData, 5000); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (iv) clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchData]);

  // 1-second timer tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-cycle events every 30 s
  useEffect(() => {
    if (events.length <= 1) return;
    const iv = setInterval(() => setCurIdx(i => (i + 1) % events.length), 30000);
    return () => clearInterval(iv);
  }, [events.length]);

  const curEv = events[curIdx] ?? null;
  const clutch = curEv ? isClutch(curEv.endTime) : false;
  const vv = curEv ? calcVol(curEv.participants) : { label: 'LOW', pct: 18, col: '#10b981' };
  const allPositions = events.flatMap(e => e.openPositions);
  const numActive = curEv?.participants.filter(p => !p.isDisqualified).length ?? 0;
  // Challenges → 1v1 Battle View regardless of count
  // Competitions → Grid for ≤8 active traders, Championship for 9+
  const isBattle = !curEv || curEv.type === 'challenge';
  const isGrid = !isBattle && numActive <= 8;

  // Build sparks map for current event
  const sparks: Record<string, number[]> = {};
  curEv?.participants.forEach(p => {
    sparks[p.userId] = sparksRef.current[`${curEv.id}:${p.userId}`] || [p.liveEquity];
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        background: `
          radial-gradient(ellipse at 0% 100%, rgba(255,85,0,.42) 0%, transparent 30%),
          radial-gradient(ellipse at 100% 100%, rgba(220,20,40,.36) 0%, transparent 30%),
          radial-gradient(ellipse at 50% 108%, rgba(170,45,0,.26) 0%, transparent 25%),
          radial-gradient(ellipse at 0% 0%, rgba(35,8,0,.55) 0%, transparent 28%),
          radial-gradient(ellipse at 100% 0%, rgba(55,0,18,.45) 0%, transparent 28%),
          #04040a`,
        fontFamily: 'var(--font-geist-sans)', color: '#e2e8f0',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* — Fire ember particles — */}
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', pointerEvents: 'none', zIndex: 0,
            width: 2 + (i % 4), height: 2 + (i % 4), borderRadius: '50%',
            background: ['#ff6b35', '#ff3366', '#ffd700', '#ff9500', '#ff4500', '#ff2222'][i % 6],
            left: `${3 + (i * 3.4) % 94}%`,
            bottom: `${(i * 5.7) % 30}%`,
            opacity: 0,
            animation: `embers ${3.2 + (i % 5) * 0.65}s ease-in ${(i * 0.36) % 3.8}s infinite`,
            ['--etx' as any]: `${(i % 2 === 0 ? -16 : 16) * (1 + i % 3)}px`,
          }} />
        ))}

        {/* ═══════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════ */}
        <div style={{
          height: 72, flexShrink: 0, zIndex: 10, position: 'relative',
          background: 'linear-gradient(180deg,#0d0c1e 0%,#09090f 100%)',
          borderBottom: '1px solid rgba(255,107,53,.18)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        }}>
          {/* LIVE badge */}
          <div className="live" style={{
            padding: '4px 12px', borderRadius: 4, flexShrink: 0,
            background: '#ef444418', border: '1px solid #ef4444',
            fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: '0.22em',
            fontFamily: 'var(--font-geist-mono)',
          }}>● LIVE</div>

          {/* Name + sub */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700,
              color: '#ccd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{curEv?.name || 'CHARTVOLT TRADING ARENA'}</div>
            <div style={{ fontSize: 10, color: '#2a2a44', letterSpacing: '0.12em', marginTop: 1 }}>
              {stats?.activePlayers || 0} TRADERS · {events.length} EVENT{events.length !== 1 ? 'S' : ''}
              {curEv && <span style={{ marginLeft: 8, color: '#ff6b3555' }}>{curEv.rankingMethod.toUpperCase()}</span>}
            </div>
          </div>

          {/* Volatility gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <Gauge pct={vv.pct} label={vv.label} col={vv.col} size={68} />
            <div style={{ fontSize: 8, color: '#1a1a30', letterSpacing: '0.12em', marginTop: -4 }}>VOLATILITY</div>
          </div>

          <div style={{ width: 1, height: 42, background: '#ffffff08', flexShrink: 0 }} />

          {/* TIMER */}
          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 128 }}>
            <div className={clutch ? 'clutch' : ''} style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: clutch ? 38 : 33, fontWeight: 900, lineHeight: 1,
              color: clutch ? '#ef4444' : '#ffd700',
              textShadow: clutch ? '0 0 28px #ef4444aa' : '0 0 16px #ffd70077',
            }}>{curEv ? timer(curEv.endTime) : '--:--'}</div>
            <div style={{ fontSize: 9, color: clutch ? '#ef4444aa' : '#333', letterSpacing: '0.15em', marginTop: 2 }}>
              {clutch ? '⚡ CLUTCH TIME' : 'TIME REMAINING'}
            </div>
          </div>

          <div style={{ width: 1, height: 42, background: '#ffffff08', flexShrink: 0 }} />

          {/* Prize pool */}
          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 88 }}>
            <div style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 22, fontWeight: 800,
              color: '#ffd700', textShadow: '0 0 14px #ffd70066',
            }}>${(curEv?.prizePool || stats?.totalPrizePool || 0).toLocaleString()}</div>
            <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>PRIZE POOL</div>
          </div>

          {/* Heat gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <Gauge
              pct={dangerActive ? 90 : Math.min((stats?.openPositions ?? 0) * 10, 80)}
              label={dangerActive ? 'HIGH' : 'NORMAL'}
              col={dangerActive ? '#ef4444' : '#00d4ff'}
              size={68}
            />
            <div style={{ fontSize: 8, color: '#1a1a30', letterSpacing: '0.12em', marginTop: -4 }}>HEAT</div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
            <button onClick={() => setMuted(m => !m)} style={{
              padding: '3px 8px', background: 'transparent', border: '1px solid #ffffff14',
              borderRadius: 4, color: muted ? '#2a2a3a' : '#00d4ff', cursor: 'pointer',
              fontSize: 11, fontFamily: 'var(--font-geist-mono)',
            }}>{muted ? '🔇' : '🔊'}</button>
            {events.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {events.map((_, i) => (
                  <button key={i} onClick={() => setCurIdx(i)} style={{
                    width: 7, height: 7, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                    background: i === curIdx ? '#ff6b35' : '#1a1a28',
                    boxShadow: i === curIdx ? '0 0 6px #ff6b35' : 'none',
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            MAIN CONTENT
        ═══════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          {loading ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-geist-mono)', fontSize: 20, color: '#111', letterSpacing: '0.2em',
            }}>LOADING ARENA DATA…</div>
          ) : !curEv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 62 }}>🏟️</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 22, color: '#111', letterSpacing: '0.22em' }}>
                NO ACTIVE EVENTS
              </div>
            </div>
          ) : isBattle ? (
            <BattleView ev={curEv} sparks={sparks} />
          ) : isGrid ? (
            <GridView ev={curEv} sparks={sparks} />
          ) : (
            <ChampionshipView ev={curEv} sparks={sparks} />
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            STATS BAR + TICKER
        ═══════════════════════════════════════════════════════════ */}
        <StatsBar ev={curEv} stats={stats} />
        <Ticker prices={prices} positions={allPositions} comment={comment} />

        {/* ═══════════════════════════════════════════════════════════
            CLUTCH MODE EFFECTS
        ═══════════════════════════════════════════════════════════ */}
        {clutch && (
          <div className="dng" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50,
            border: '4px solid rgba(239,68,68,.7)',
          }} />
        )}
        {clutch && (
          <div style={{
            position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
            padding: '5px 24px', background: '#ef444418', border: '1px solid #ef4444aa',
            borderRadius: 5, fontFamily: 'var(--font-geist-mono)', fontSize: 12, fontWeight: 700,
            color: '#ef4444', letterSpacing: '0.22em', zIndex: 55, pointerEvents: 'none',
            boxShadow: '0 0 22px #ef444433',
          }}>⚡ CLUTCH TIME — FINAL STRETCH</div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            DANGER ZONE OVERLAY
        ═══════════════════════════════════════════════════════════ */}
        {dangerActive && (
          <div className="dng" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60,
            border: '5px solid rgba(239,68,68,.85)',
          }}>
            <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center' }}>
              <div className="dng-txt" style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: 52, fontWeight: 900,
                color: '#ef4444', letterSpacing: '0.14em', display: 'inline-block',
                background: 'rgba(4,4,10,.88)', padding: '6px 34px', borderRadius: 10,
                boxShadow: '0 0 40px #ef444433',
              }}>⚠ DANGER ZONE</div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            NOTIFICATION BANNERS
        ═══════════════════════════════════════════════════════════ */}
        <div style={{
          position: 'absolute', top: 80, right: 14,
          display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200, pointerEvents: 'none',
        }}>
          {banners.map(b => (
            <div key={b.id} className="banner" style={{
              padding: '10px 18px', borderRadius: 9,
              background: `${b.color}18`, border: `1px solid ${b.color}66`,
              boxShadow: `0 0 26px ${b.color}33, inset 0 0 20px ${b.color}09`,
              fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700,
              color: b.color, letterSpacing: '0.05em', backdropFilter: 'blur(10px)',
            }}>{b.icon} {b.text}</div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            CONFETTI (fires on new leader)
        ═══════════════════════════════════════════════════════════ */}
        <Confetti active={confetti} />

      </div>
    </>
  );
}
