'use client';
/**
 * /arena — Chartvolt Live Trading Arena
 * Six broadcast-ready scenes, no betting — Chartvolt brand identity.
 * Accessible at: chartvolt.com/arena
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenPos {
  userId: string; username: string; profileImage: string | null;
  symbol: string; side: 'long' | 'short';
  entryPrice: number; currentPrice: number;
  unrealizedPnl: number; leverage: number; marginUsed: number; openedAt: string;
}
interface Participant {
  userId: string; username: string; profileImage: string | null;
  liveEquity: number; livePnl: number; liveRoi: number;
  realizedPnl: number; unrealizedPnl: number;
  currentCapital: number; availableCapital: number; usedMargin: number;
  totalTrades: number; winningTrades: number; losingTrades: number;
  winRate: number; averageWin: number; averageLoss: number;
  largestWin: number; largestLoss: number;
  maxDrawdownPercentage: number; currentOpenPositions: number;
  status: string; isDisqualified: boolean;
  rankValue: number; profitFactor: number; rank: number;
  lastTradeAt: string | null; enteredAt: string | null;
}
interface AEvent {
  id: string; _et: string; name: string; description: string;
  status: 'active' | 'upcoming' | 'completed';
  startTime: string; endTime: string | null;
  prizePool: number; startingCapital: number;
  currentParticipants: number; maxParticipants: number;
  rankingMethod: string; isPaused: boolean;
  participants: Participant[]; openPositions: OpenPos[];
  winners: Participant[] | null;
  prizeDistribution: Array<{ rank: number; percentage: number }>;
}
type PriceMap = Record<string, { bid: number; ask: number; mid: number }>;
interface DashData {
  competitions: AEvent[]; challenges: AEvent[];
  prices: PriceMap;
  stats: { liveNow: number; upcoming: number; totalPrizePool: number; activePlayers: number; openPositions: number };
}
type SceneKey = 'overview' | 'race' | 'spotlight' | 'h2h' | 'danger' | 'podium';

// ─── Chartvolt Brand Palette ──────────────────────────────────────────────────

const CV = {
  bg0: '#030305', bg1: '#07070d', bg2: '#0d0f18', bg3: '#131520', bg4: '#191c28', bg5: '#1e2132',
  bd0: '#191c28', bd1: '#252838', bd2: '#2e3148', bd3: '#3a3e55',
  teal: '#0FEDBE', blue: '#5862FF', gold: '#FDD458', gol2: '#E8BA40',
  red: '#FF495B', oran: '#FF8243', purp: '#D13BFF',
  gray: '#9095A1', lgt: '#CCDADC', txt: '#e4e8f0', grn: '#22c55e',
} as const;

const RANK_COLORS = [CV.gold, '#C0C0C0', CV.oran] as const;
const RANK_GLOW   = ['rgba(253,212,88,.28)', 'rgba(192,192,192,.14)', 'rgba(255,130,67,.16)'] as const;
const BAR_FILLS   = [
  `linear-gradient(90deg,${CV.gold}ee,${CV.gold}33)`,
  `linear-gradient(90deg,#C0C0C0bb,#C0C0C020)`,
  `linear-gradient(90deg,${CV.oran}cc,${CV.oran}28)`,
  `linear-gradient(90deg,${CV.blue}bb,${CV.blue}28)`,
  `linear-gradient(90deg,${CV.blue}99,${CV.blue}18)`,
  `linear-gradient(90deg,${CV.blue}77,${CV.blue}12)`,
  `linear-gradient(90deg,${CV.teal}66,${CV.teal}10)`,
  `linear-gradient(90deg,${CV.gray}55,${CV.gray}0e)`,
  `linear-gradient(90deg,${CV.gray}44,${CV.gray}0a)`,
  `linear-gradient(90deg,${CV.gray}33,${CV.gray}08)`,
];
const TICKER_SYMS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'AUDUSD'];
const AV_GRADS    = [
  `#0a0d1e,${CV.blue}`, `#050e12,${CV.teal}`, `#120618,${CV.purp}`,
  `#081808,${CV.grn}`,  `#1a0508,${CV.red}`,  `#0a0a1e,${CV.blue}`, `#150c02,${CV.oran}`,
];

const TIER_CFG = {
  champion: { border: CV.gold,  header: `linear-gradient(135deg,#1a1200,rgba(253,212,88,.22))`,  tag: 'rgba(253,212,88,.15)',  tagColor: CV.gold,  tagLabel: 'Champion', glow: 'rgba(253,212,88,.3)'  },
  elite:    { border: CV.purp,  header: `linear-gradient(135deg,#12081a,rgba(209,59,255,.2))`,   tag: 'rgba(209,59,255,.15)', tagColor: CV.purp,  tagLabel: 'Elite',    glow: 'rgba(209,59,255,.25)' },
  veteran:  { border: CV.blue,  header: `linear-gradient(135deg,#080e22,rgba(88,98,255,.2))`,    tag: 'rgba(88,98,255,.15)',  tagColor: CV.blue,  tagLabel: 'Veteran',  glow: 'rgba(88,98,255,.22)'  },
  trader:   { border: CV.bd3,   header: `linear-gradient(135deg,${CV.bg2},${CV.bg3})`,           tag: 'rgba(144,149,161,.1)', tagColor: CV.gray,  tagLabel: 'Trader',   glow: 'rgba(0,0,0,0)'        },
};
const getTier = (rank: number) =>
  rank <= 3 ? TIER_CFG.champion : rank <= 10 ? TIER_CFG.elite : rank <= 50 ? TIER_CFG.veteran : TIER_CFG.trader;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avColor = (u: string) => {
  let h = 0;
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg,${AV_GRADS[h % AV_GRADS.length]})`;
};
const ini      = (u: string) => (u || '?').split(/[\s_-]+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
const pad      = (n: number) => String(n).padStart(2, '0');
const fmtMs    = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
const fmtAbs   = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(1)}K` : `$${a.toFixed(0)}`; };
const fmtC     = (v: number) => (v < 0 ? '-' : '') + fmtAbs(v);
const fmtPnl   = (v: number) => (v >= 0 ? '+' : '') + fmtC(v);
const fmtPrize = (v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v || 0}`;
const tAgo     = (d: string) => { const df = Date.now() - new Date(d).getTime(); if (df < 60000) return 'now'; if (df < 3600000) return `${Math.floor(df/60000)}m`; return `${Math.floor(df/3600000)}h`; };
const rmLabel  = (rm: string) => ({ roi: 'ROI %', win_rate: 'Win Rate', total_capital: 'Total Equity', equity: 'Total Equity' }[rm] ?? 'PnL');

const raceScore = (p: Participant, rm: string) => {
  if (rm === 'roi') return p.liveRoi;
  if (rm === 'win_rate') return p.winRate;
  if (rm === 'total_capital' || rm === 'equity') return p.liveEquity;
  return p.livePnl;
};
const raceLabel = (p: Participant, rm: string) => {
  if (rm === 'roi') return `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(1)}%`;
  if (rm === 'win_rate') return `${p.winRate.toFixed(0)}% WR`;
  if (rm === 'total_capital' || rm === 'equity') return fmtC(p.liveEquity);
  return fmtPnl(p.livePnl);
};

function calcRaceProgress(p: Participant, rm: string, all: Participant[]): number {
  if (p.isDisqualified) return 3;
  if (p.totalTrades === 0) return 5;
  const active = all.filter(a => !a.isDisqualified && a.totalTrades > 0);
  if (!active.length) return 50;
  const scores = active.map(a => raceScore(a, rm));
  const maxS = Math.max(...scores), minS = Math.min(...scores);
  return Math.max(8, Math.min(93, 8 + ((raceScore(p, rm) - minS) / Math.max(maxS - minS, 0.0001)) * 85));
}

function calcWinProb(p: Participant, ev: AEvent): number {
  if (p.isDisqualified || p.totalTrades === 0) return 0;
  const rm = ev.rankingMethod || 'pnl';
  const active = ev.participants.filter(a => !a.isDisqualified && a.totalTrades > 0);
  if (!active.length) return 0;
  const scores = active.map(a => raceScore(a, rm));
  const minS = Math.min(...scores), maxS = Math.max(...scores);
  const eqS  = (raceScore(p, rm) - minS) / Math.max(maxS - minS, 0.0001);
  const wrS  = Math.min(p.winRate / 100, 1);
  const pfS  = Math.min((p.profitFactor || 0) / 3, 1);
  const cush = Math.max(0, Math.min((p.availableCapital || 0) / ev.startingCapital, 1));
  const ddP  = Math.min((p.maxDrawdownPercentage || 0) / 50, 1);
  const expP = Math.min((p.currentOpenPositions || 0) * 0.08, 0.4);
  return Math.max(1, Math.min(99, Math.round((eqS * 0.48 + wrS * 0.22 + pfS * 0.12 + cush * 0.08 - ddP * 0.07 - expP * 0.03) * 100)));
}

// Generate seeded sparkline points (polyline string for SVG)
function genSparkline(seed: string, startCap: number, equity: number, w = 60, h = 24): string {
  let rng = 0;
  for (let i = 0; i < seed.length; i++) rng = (rng * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0xFFFFFFFF; };
  const n = 12;
  const pts: [number, number][] = [[0, startCap]];
  const step = (equity - startCap) / n;
  for (let i = 1; i <= n; i++) {
    const noise = (rand() - 0.5) * Math.max(Math.abs(equity - startCap) * 0.5, 1);
    pts.push([i * (w / n), pts[pts.length - 1][1] + step + noise]);
  }
  pts[pts.length - 1][1] = equity; // Pin end to actual equity
  const minY = Math.min(...pts.map(p => p[1]));
  const maxY = Math.max(...pts.map(p => p[1]));
  const range = maxY - minY || 1;
  return pts.map(([x, y]) => `${x.toFixed(1)},${(h - ((y - minY) / range) * (h - 3) - 1.5).toFixed(1)}`).join(' ');
}

// ─── Candle Generator ─────────────────────────────────────────────────────────

type Candle = { o: number; h: number; l: number; c: number; bull: boolean; vol: number };

// Fallback mids for common symbols — used until live prices arrive
const SYMBOL_FALLBACK: Record<string, number> = {
  EURUSD: 1.0850, GBPUSD: 1.2700, USDJPY: 151.50, XAUUSD: 2320.0,
  BTCUSD: 65000.0, ETHUSD: 3400.0, USDCAD: 1.3600, AUDUSD: 0.6550,
  USDCHF: 0.9050, NZDUSD: 0.6050, GBPJPY: 192.0, EURJPY: 164.5,
};

function generateCandles(symbol: string, mid: number, n = 32): Candle[] {
  // Use live mid if available, otherwise fall back to well-known reference price
  const refMid = mid || SYMBOL_FALLBACK[symbol.replace('/', '')] || 1.0;
  const bucket = Math.floor(Date.now() / 300000); // stable per 5-min bucket
  let rng = bucket;
  const seed = symbol + bucket;
  for (let i = 0; i < seed.length; i++) rng = (rng * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0xFFFFFFFF; };
  const pip = symbol.includes('JPY') ? 0.01 : (symbol.includes('XAU') || refMid > 500) ? 0.5 : 0.0001;
  const vol = pip * 18;
  const cs: Candle[] = [];
  let price = refMid * (1 - 0.004 + rand() * 0.007);
  for (let i = 0; i < n; i++) {
    const o = price;
    const move = (rand() - 0.46) * vol * 2.5;
    const c = i === n - 1 ? refMid : o + move;
    const h = Math.max(o, c) + rand() * vol * 0.9;
    const l = Math.min(o, c) - rand() * vol * 0.9;
    cs.push({ o, h, l, c, bull: c >= o, vol: 0.2 + rand() * 0.8 });
    price = c;
  }
  return cs;
}

// ─── Candlestick Chart SVG ────────────────────────────────────────────────────

function CandleChart({ symbol, priceData, openPositions, leader }: {
  symbol: string;
  priceData: { bid: number; ask: number; mid: number } | null;
  openPositions: OpenPos[];
  leader: Participant | null;
}) {
  const liveMid = priceData?.mid ?? 0;
  // Use live price if available, otherwise fall back to reference price for instant render
  const mid = liveMid || SYMBOL_FALLBACK[symbol.replace('/', '')] || 1.0;
  const isLive = liveMid > 0;
  const dec = symbol.includes('JPY') ? 3 : (symbol.includes('XAU') || mid > 500) ? 2 : 5;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candles = useMemo(() => generateCandles(symbol, liveMid), [symbol, liveMid > 0 ? Math.floor(Date.now() / 300000) : 0]);

  const VW = 730, CH = 300, VOL_H = 55, VH = CH + VOL_H;
  const CW = 14, CG = 8, TW = CW + CG, LM = 50;
  const allH = candles.map(c => c.h), allL = candles.map(c => c.l);
  const pMax = Math.max(...allH) * 1.001, pMin = Math.min(...allL) * 0.999;
  const pRange = pMax - pMin || 1;
  const py = (p: number) => ((pMax - p) / pRange) * CH;
  const maxVol = Math.max(...candles.map(c => c.vol));
  const labels = [0, 1, 2, 3, 4].map(i => pMax - i * pRange / 4);
  const curY = py(mid);
  const leaderPos = leader ? openPositions.find(
    p => p.userId === leader.userId && (p.symbol || '').replace('/', '').toUpperCase() === symbol
  ) : null;

  return (
    <>
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, opacity: isLive ? 1 : 0.45 }}>
      <defs>
        <linearGradient id="cvVolG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00b0ff" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#00b0ff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Grid + Price labels */}
      {labels.map((p, i) => (
        <g key={i}>
          <line x1={LM} y1={py(p)} x2={VW} y2={py(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <text x={2} y={py(p) + 3} fontSize={8} fill="rgba(255,255,255,0.2)" fontFamily="monospace">
            {p.toFixed(dec < 3 ? 2 : 4)}
          </text>
        </g>
      ))}
      {/* Volume bars */}
      {candles.map((c, i) => {
        const x = LM + i * TW;
        const bH = (c.vol / maxVol) * (VOL_H * 0.85);
        return <rect key={i} x={x} y={VH - bH} width={CW} height={bH}
          fill={c.bull ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)'} rx={1} />;
      })}
      {/* Volatility ribbon */}
      <rect x={LM} y={VH - 8} width={VW - LM} height={8} fill="url(#cvVolG)" />
      {/* Candles */}
      {candles.map((c, i) => {
        const x = LM + i * TW, cx = x + CW / 2;
        const color = c.bull ? '#00e676' : '#ff1744';
        const bTop = py(Math.max(c.o, c.c)), bBot = py(Math.min(c.o, c.c));
        const bH = Math.max(1.5, bBot - bTop);
        return (
          <g key={i}>
            <line x1={cx} y1={py(c.h)} x2={cx} y2={py(c.l)} stroke={color} strokeWidth={1} />
            <rect x={x} y={bTop} width={CW} height={bH} fill={color} rx={1} />
          </g>
        );
      })}
      {/* Current price dashed line */}
      <line x1={LM} y1={curY} x2={VW - 52} y2={curY}
        stroke="rgba(0,230,118,0.4)" strokeWidth={1} strokeDasharray="4,4" />
      <rect x={VW - 52} y={curY - 8} width={50} height={16} rx={2} fill="rgba(0,230,118,0.2)" />
      <text x={VW - 50} y={curY + 4} fontSize={8} fill="#00e676" fontWeight={700} fontFamily="monospace">
        {mid.toFixed(dec)}
      </text>
      {/* Leader position overlay */}
      {leaderPos && (
        <>
          <rect x={80} y={CH - 52} width={140} height={28} rx={4}
            fill={leaderPos.side === 'long' ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)'}
            stroke={leaderPos.side === 'long' ? 'rgba(0,230,118,0.4)' : 'rgba(255,23,68,0.4)'} strokeWidth={1} />
          <text x={92} y={CH - 34} fontSize={10} fontWeight={700} fontFamily="sans-serif"
            fill={leaderPos.side === 'long' ? '#00e676' : '#ff1744'}>
            {leaderPos.side === 'long' ? '▲' : '▼'} LEADER {leaderPos.side.toUpperCase()}
          </text>
        </>
      )}
      {/* Open position markers (up to 3) */}
      {openPositions.slice(0, 3).map((pos, i) => {
        const col = pos.side === 'long' ? '#00e676' : '#ff1744';
        const mx = LM + (7 + i * 9) * TW + CW / 2;
        const ey = py(pos.entryPrice);
        if (mx > VW - 60 || ey < 0 || ey > CH) return null;
        return (
          <g key={i}>
            <circle cx={mx} cy={ey} r={5} fill="none" stroke={col} strokeWidth={2} />
            <text x={mx - 8} y={ey - 10} fontSize={8} fill={col} fontFamily="sans-serif">OPEN</text>
          </g>
        );
      })}
    </svg>
    {!isLive && (
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(7,7,13,.82)', border: '1px solid rgba(88,98,255,.25)', borderRadius: 6, padding: '6px 14px', fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, color: '#5862FF', letterSpacing: 2, pointerEvents: 'none' }}>
        CONNECTING…
      </div>
    )}
    </>
  );
}

// ─── Race Line Chart (equity journey SVG) ─────────────────────────────────────

function RaceLineChart({ ev }: { ev: AEvent }) {
  const rm = ev.rankingMethod || 'pnl';
  const sorted = useMemo(() =>
    [...ev.participants].filter(p => p.totalTrades > 0 && !p.isDisqualified)
      .sort((a, b) => raceScore(b, rm) - raceScore(a, rm)),
    [ev, rm]
  );
  const all = ev.participants.filter(p => p.totalTrades > 0);
  if (sorted.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40, opacity: .3 }}>📈</div>
      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 3 }}>No Race Data Yet</div>
    </div>
  );

  const VW = 780, VH = 480, LM = 46, BM = 32, chartW = VW - LM;
  const rois = all.map(p => p.liveRoi ?? 0);
  const maxRoi = Math.max(...rois, 5), minRoi = Math.min(...rois, -3);
  const roiRange = maxRoi - minRoi || 1;
  const ry = (roi: number) => ((maxRoi - roi) / roiRange) * (VH - BM);
  const baseline = ry(0);

  const TOP_COLORS = [
    '#ffd700', '#c0c0c0', '#cd7f32',
    'rgba(0,230,118,0.8)', '#00b0ff', '#d500f9',
    'rgba(255,171,0,0.7)', 'rgba(0,188,212,0.65)', 'rgba(255,23,68,0.55)', 'rgba(180,180,180,0.5)',
  ];

  const getPath = (p: Participant) => {
    let rng = 0;
    const s = p.username + p.userId.slice(-4);
    for (let i = 0; i < s.length; i++) rng = (rng * 31 + s.charCodeAt(i)) >>> 0;
    const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0xFFFFFFFF; };
    const n = 10;
    const pts: [number, number][] = [[0, 0]];
    const step = (p.liveRoi ?? 0) / n;
    for (let i = 1; i < n; i++) {
      const noise = (rand() - 0.5) * Math.abs(p.liveRoi ?? 0) * 0.28;
      pts.push([i, pts[pts.length - 1][1] + step + noise]);
    }
    pts.push([n, p.liveRoi ?? 0]);
    return pts.map(([t, roi]) => `${(LM + (t / n) * chartW).toFixed(1)},${ry(roi).toFixed(1)}`).join(' ');
  };

  // Biggest movers (last-5m simulated)
  const movers = sorted.slice(0, 8).map(p => {
    let rng = 0;
    const s = 'mv' + p.username;
    for (let i = 0; i < s.length; i++) rng = (rng * 31 + s.charCodeAt(i)) >>> 0;
    rng = (rng * 1664525 + 1013904223) >>> 0;
    const pct = ((rng % 200) - 80) / 10; // -8% to +12%
    return { p, pct };
  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: Compact leaderboard + movers */}
      <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${CV.bd1}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid ${CV.bd0}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color: '#555577', letterSpacing: 2, textTransform: 'uppercase' }}>Race Leaders</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {sorted.slice(0, 10).map((p, i) => {
            const rkC = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : CV.gray;
            return (
              <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderBottom: 'rgba(255,255,255,.03) solid 1px', background: i === 0 ? 'rgba(255,215,0,.04)' : i === 1 ? 'rgba(192,192,192,.02)' : i === 2 ? 'rgba(205,127,50,.02)' : 'transparent' }}>
                <div style={{ width: 18, fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, fontWeight: 900, color: rkC, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: TOP_COLORS[i] || CV.gray, flexShrink: 0 }} />
                <Av u={p.username} img={p.profileImage} sz={18} />
                <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: (p.liveRoi ?? 0) >= 0 ? '#00e676' : '#ff1744' }}>
                  {(p.liveRoi ?? 0) >= 0 ? '+' : ''}{(p.liveRoi ?? 0).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${CV.bd1}`, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: '#555577', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>⚡ Biggest Movers</div>
          {movers.map(({ p, pct }) => (
            <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span style={{ color: '#bbb' }}>{p.username}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontWeight: 700, color: pct >= 0 ? '#00e676' : '#ff1744' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}% {pct >= 0 ? '↑' : '↓'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Equity race lines */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: 32, flexShrink: 0, borderBottom: `1px solid ${CV.bd1}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, background: 'rgba(255,255,255,.012)' }}>
          <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 800, color: '#fff' }}>Equity Race</span>
          <span style={{ fontSize: 9, color: '#555577' }}>Base 0% = Start</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 3, color: '#00e676', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)' }}>Top 10 Highlighted</span>
          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 3, color: '#00b0ff', background: 'rgba(0,176,255,.1)', border: '1px solid rgba(0,176,255,.2)' }}>{all.length} Traders</span>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.025) 40px),repeating-linear-gradient(90deg,transparent,transparent 59px,rgba(255,255,255,.015) 60px)' }} />
          <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <filter id="lineGlow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {/* Y-axis labels */}
            {[-1, -0.5, 0, 0.33, 0.67, 1].map(frac => {
              const roi = minRoi + frac * roiRange;
              const y = ry(roi);
              return (
                <g key={frac}>
                  <line x1={LM} y1={y} x2={VW} y2={y} stroke="rgba(255,255,255,.03)" strokeWidth={1} />
                  <text x={2} y={y + 3} fontSize={9} fill="rgba(255,255,255,.2)" fontFamily="monospace">
                    {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                  </text>
                </g>
              );
            })}
            {/* Baseline (0%) */}
            <line x1={LM} y1={baseline} x2={VW} y2={baseline} stroke="rgba(255,255,255,.07)" strokeWidth={1} strokeDasharray="4,4" />
            {/* Time axis labels */}
            {(['START', '30m', '1h', '1.5h', 'NOW'] as const).map((label, i) => (
              <text key={label} x={LM + i * (chartW / 4)} y={VH - 8}
                fontSize={8} fill="rgba(255,255,255,.2)" fontFamily="monospace">{label}</text>
            ))}
            {/* Field lines (faint) */}
            {all.slice(10).map(p => (
              <polyline key={p.userId} points={getPath(p)} fill="none" stroke="rgba(255,255,255,.04)" strokeWidth={1} />
            ))}
            {/* Top 10 colored lines (drawn back-to-front so #1 is on top) */}
            {sorted.slice(0, 10).reverse().map((p, ri) => {
              const idx = sorted.length - 1 - ri;
              const col = TOP_COLORS[idx] ?? 'rgba(255,255,255,.3)';
              const isLeader = idx === 0;
              const path = getPath(p);
              const lastPt = path.split(' ').pop()?.split(',') ?? [`${VW}`, `${VH / 2}`];
              const lx = parseFloat(lastPt[0]), ly = parseFloat(lastPt[1]);
              return (
                <g key={p.userId}>
                  <polyline points={path} fill="none" stroke={col}
                    strokeWidth={isLeader ? 3.5 : idx < 3 ? 2.5 : idx < 5 ? 2 : 1.5}
                    filter={isLeader ? 'url(#lineGlow)' : undefined} />
                  {idx < 5 && (
                    <>
                      <circle cx={lx} cy={ly} r={isLeader ? 5 : 4} fill={col} filter={isLeader ? 'url(#lineGlow)' : undefined} />
                      <text x={lx + 7} y={ly + 3} fontSize={9} fill={col} fontWeight={700} fontFamily="sans-serif">
                        {p.username}{isLeader ? ' 👑' : ''}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {/* Mini pip chart (bottom-right inset) */}
          <div style={{ position: 'absolute', bottom: 20, right: 20, width: 190, height: 110, background: 'rgba(0,0,0,.55)', border: `1px solid ${CV.bd1}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 6, left: 10, fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, fontWeight: 700, color: '#555577', letterSpacing: 1 }}>MARKET CHART</div>
            <svg width="100%" height="100%" viewBox="0 0 190 110" preserveAspectRatio="none">
              <rect width="190" height="110" fill="#06060e" />
              {[15,30,45,60,75,90,105,120,135,150,165,180].map((x, i) => {
                const bull = i % 3 !== 1;
                const o = 40 + Math.sin(i * 0.8) * 20, c = bull ? o - 10 : o + 10;
                return (
                  <g key={x}>
                    <line x1={x} y1={Math.min(o, c) - 8} x2={x} y2={Math.max(o, c) + 8} stroke={bull ? '#00e676' : '#ff1744'} strokeWidth={1} />
                    <rect x={x - 4} y={Math.min(o, c)} width={8} height={Math.max(2, Math.abs(c - o))} fill={bull ? '#00e676' : '#ff1744'} rx={1} />
                  </g>
                );
              })}
              <line x1="0" y1="30" x2="190" y2="30" stroke="rgba(0,230,118,.3)" strokeWidth={1} strokeDasharray="3,3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right: View filters + legend */}
      <div style={{ width: 215, flexShrink: 0, borderLeft: `1px solid ${CV.bd1}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${CV.bd0}` }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color: '#555577', letterSpacing: 2, textTransform: 'uppercase' }}>Highlighted</span>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sorted.slice(0, 5).map((p, i) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 22, height: 3, background: TOP_COLORS[i] || CV.gray, borderRadius: 1.5, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, color: TOP_COLORS[i] || CV.gray, flex: 1 }}>{p.username}{i === 0 ? ' 👑' : ''}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: (p.liveRoi ?? 0) >= 0 ? '#00e676' : '#ff1744' }}>
                {(p.liveRoi ?? 0) >= 0 ? '+' : ''}{(p.liveRoi ?? 0).toFixed(1)}%
              </span>
            </div>
          ))}
          {sorted.length > 5 && <div style={{ fontSize: 9, color: '#555577', paddingTop: 2 }}>+ {sorted.length - 5} more traders (faint)</div>}
        </div>
        <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: `1px solid ${CV.bd1}` }}>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: '#555577', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Field Summary</div>
          {([
            ['Traders Racing', String(sorted.length)],
            ['Avg ROI', `${sorted.length ? (sorted.reduce((s, p) => s + (p.liveRoi ?? 0), 0) / sorted.length).toFixed(1) : '0'}%`],
            ['Leader Edge', sorted.length >= 2 ? `+${((sorted[0]?.liveRoi ?? 0) - (sorted[1]?.liveRoi ?? 0)).toFixed(1)}%` : '—'],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
              <span style={{ color: '#bbb' }}>{l}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', color: '#e0e0e0', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Av({ u, img, sz = 36, ring }: { u: string; img: string | null; sz?: number; ring?: string }) {
  const [err, setErr] = useState(false);
  const bg = avColor(u);
  const base: React.CSSProperties = {
    width: sz, height: sz, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(sz * 0.38), fontWeight: 700, fontFamily: 'var(--font-geist-sans),sans-serif',
    ...(ring ? { outline: `2px solid ${ring}`, outlineOffset: 2, boxShadow: `0 0 10px ${ring}66` } : {}),
  };
  if (img && !err)
    return <div style={{ ...base, background: bg }}><img src={img} onError={() => setErr(true)} alt={u} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /></div>;
  return <div style={{ ...base, background: bg, color: '#fff' }}>{ini(u)}</div>;
}

// ─── Racer Row ────────────────────────────────────────────────────────────────

const MEDAL   = ['🥇', '🥈', '🥉'];
const RANK_BG = [
  `linear-gradient(180deg,rgba(253,212,88,.16) 0%,rgba(253,212,88,.05) 100%)`,
  `linear-gradient(180deg,rgba(192,192,192,.1) 0%,rgba(192,192,192,.03) 100%)`,
  `linear-gradient(180deg,rgba(255,130,67,.12) 0%,rgba(255,130,67,.04) 100%)`,
];
const ROW_BG = [
  `linear-gradient(100deg,rgba(253,212,88,.065) 0%,rgba(253,212,88,.018) 30%,${CV.bg2} 100%)`,
  `linear-gradient(100deg,rgba(192,192,192,.035) 0%,rgba(192,192,192,.01) 30%,${CV.bg2} 100%)`,
  `linear-gradient(100deg,rgba(255,130,67,.045) 0%,rgba(255,130,67,.013) 30%,${CV.bg2} 100%)`,
];

function RacerRow({ p, ev, idx, onClick }: { p: Participant; ev: AEvent; idx: number; onClick: () => void }) {
  const rm = ev.rankingMethod || 'pnl';
  const prog = calcRaceProgress(p, rm, ev.participants);
  const isLeader = idx === 0;
  const rkColor = idx < 3 ? RANK_COLORS[idx] : idx < 7 ? CV.blue : CV.gray;
  const barFill = BAR_FILLS[Math.min(idx, BAR_FILLS.length - 1)];
  const pnlPos  = p.livePnl >= 0;

  return (
    <div onClick={onClick} className="rcrow" style={{
      display: 'flex', alignItems: 'stretch', height: 82, borderRadius: 10, overflow: 'hidden',
      background: idx < 3 ? ROW_BG[idx] : `linear-gradient(100deg,rgba(88,98,255,.03),${CV.bg2} 60%)`,
      border: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '38' : idx < 7 ? CV.bd2 : CV.bd1}`,
      boxShadow: isLeader ? `0 0 36px ${RANK_GLOW[0]},0 0 0 1px rgba(253,212,88,.07)` : idx < 3 ? `0 2px 14px ${RANK_GLOW[idx]}` : idx < 7 ? `0 1px 5px rgba(88,98,255,.07)` : 'none',
      cursor: 'pointer', transition: 'transform .15s', position: 'relative',
    }}>
      {isLeader && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'linear-gradient(100deg,transparent 35%,rgba(253,212,88,.03) 65%,transparent 90%)', animation: 'shim 3.2s linear infinite' }} />}

      {/* Rank badge */}
      <div style={{ width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: idx < 3 ? RANK_BG[idx] : 'rgba(255,255,255,.012)', borderRight: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '28' : CV.bd0}`, position: 'relative', zIndex: 1 }}>
        {idx < 3 ? <>
          <div style={{ fontSize: 18, filter: `drop-shadow(0 0 7px ${RANK_COLORS[idx]})` }}>{MEDAL[idx]}</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color: RANK_COLORS[idx], letterSpacing: 1 }}>#{p.rank}</div>
        </> : <>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 17, fontWeight: 900, color: rkColor, textShadow: idx < 7 ? `0 0 10px ${CV.blue}88` : 'none', lineHeight: 1 }}>{p.rank}</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 6, fontWeight: 600, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase' }}>RANK</div>
        </>}
      </div>

      {/* Avatar + name */}
      <div style={{ width: 196, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isLeader && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 13, filter: `drop-shadow(0 0 6px ${CV.gold})`, zIndex: 5 }}>👑</div>}
          <Av u={p.username} img={p.profileImage} sz={44} ring={idx < 3 ? RANK_COLORS[idx] : idx < 7 ? CV.blue + '88' : undefined} />
          {(p.currentOpenPositions || 0) > 0 && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: CV.oran, border: `2px solid ${CV.bg1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 900, color: '#fff' }}>{p.currentOpenPositions}</div>}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 13, fontWeight: 700, color: CV.lgt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{p.username}</div>
          <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3, color: CV.bd3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: isLeader ? CV.gold + 'aa' : CV.bd2 }}>●</span>
            {p.totalTrades} trade{p.totalTrades !== 1 ? 's' : ''}
            {p.currentOpenPositions > 0 && <span style={{ color: CV.oran + 'aa' }}>· {p.currentOpenPositions} OPEN</span>}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 14px', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, position: 'relative', height: 34, background: CV.bd0, borderRadius: 17, overflow: 'hidden', border: `1px solid ${CV.bd1}` }}>
          <div style={{ position: 'absolute', top: 1.5, bottom: 1.5, left: 1.5, borderRadius: 15, width: `calc(${prog}% - 3px)`, background: barFill, minWidth: 38, transition: 'width 2s cubic-bezier(.4,0,.2,1)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 36 }}>
            <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,.88)', textShadow: '0 1px 4px rgba(0,0,0,.9)', whiteSpace: 'nowrap', position: 'relative', zIndex: 3 }}>{raceLabel(p, rm)}</span>
            <div style={{ position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 0 8px rgba(0,0,0,.9)', zIndex: 4 }}><Av u={p.username} img={p.profileImage} sz={28} /></div>
          </div>
          {isLeader && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, background: `linear-gradient(90deg,transparent 30%,rgba(253,212,88,.07) 58%,transparent 80%)`, animation: 'shim 2.4s linear infinite' }} />}
        </div>
      </div>

      {/* Stats */}
      <div style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px', gap: 2, borderLeft: `1px solid ${CV.bd0}`, position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, fontWeight: 700, color: CV.teal, textShadow: `0 0 12px ${CV.teal}50`, letterSpacing: .5 }}>{fmtC(p.liveEquity)}</div>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: pnlPos ? CV.grn : CV.red, textShadow: `0 0 8px ${pnlPos ? CV.grn : CV.red}40` }}>{fmtPnl(p.livePnl)}</div>
        <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 9, color: CV.bd3, fontWeight: 600, letterSpacing: .5 }}>{p.liveRoi >= 0 ? '+' : ''}{p.liveRoi.toFixed(1)}%<span style={{ color: CV.bd2, margin: '0 3px' }}>·</span>{p.winRate.toFixed(0)}% WR</div>
      </div>
    </div>
  );
}

// ─── Trader Modal (Pokémon Card Style) ───────────────────────────────────────

function TraderModal({ p, ev, onClose }: { p: Participant; ev: AEvent; onClose: () => void }) {
  const myPos   = ev.openPositions.filter(pos => pos.userId === p.userId);
  const tier    = getTier(p.rank);
  const winProb = calcWinProb(p, ev);
  const SCell = ({ v, l, c }: { v: string; l: string; c?: string }) => (
    <div style={{ flex: 1, padding: '9px 4px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: c || CV.lgt, marginBottom: 2 }}>{v}</div>
      <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase' }}>{l}</div>
    </div>
  );
  const AttRow = ({ icon, label, color, children }: { icon: string; label: string; color: string; children: React.ReactNode }) => (
    <div style={{ margin: '0 12px 8px', background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: CV.bg4, borderBottom: `1px solid ${CV.bd0}` }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color, letterSpacing: 3, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ display: 'flex' }}>{children}</div>
    </div>
  );
  const Sep = () => <div style={{ width: 1, background: CV.bd1, flexShrink: 0 }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 500, backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px 40px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 380, animation: 'pokemonReveal .38s cubic-bezier(.34,1.56,.64,1)', perspective: '1000px' }}>
        <div style={{ border: `6px solid ${tier.border}`, borderRadius: 20, overflow: 'hidden', background: `linear-gradient(135deg,${CV.bg3},${CV.bg2})`, boxShadow: `0 0 55px ${tier.glow},0 28px 80px rgba(0,0,0,.92)`, position: 'relative' }}>
          {p.rank <= 10 && <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,.09) 42%,rgba(255,255,255,.05) 46%,transparent 52%)', backgroundSize: '200% 200%', animation: 'holoShim 2.8s linear infinite' }} />}
          <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, zIndex: 30, width: 28, height: 28, borderRadius: '50%', background: CV.bg4, border: `1px solid ${CV.bd2}`, cursor: 'pointer', color: CV.gray, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ padding: '12px 14px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2, padding: '2px 9px', borderRadius: 4, background: tier.tag, color: tier.tagColor, border: `1px solid ${tier.border}44` }}>{tier.tagLabel}</span>
              {p.isDisqualified && <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.red }}>⚡ LIQUIDATED</span>}
              {!p.isDisqualified && p.totalTrades > 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 4, color: CV.grn, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.22)' }}>ACTIVE</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 24, fontWeight: 700, color: CV.lgt }}>{p.username}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 2 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.bd3 }}>RANK</span>
                <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 22, fontWeight: 900, color: tier.tagColor, textShadow: `0 0 16px ${tier.border}66` }}>#{p.rank}</span>
                {p.rank === 1 && <span style={{ fontSize: 18 }}>🥇</span>}
                {p.rank === 2 && <span style={{ fontSize: 18 }}>🥈</span>}
                {p.rank === 3 && <span style={{ fontSize: 18 }}>🥉</span>}
              </div>
            </div>
          </div>
          <div style={{ margin: '0 12px', border: `2px solid ${tier.border}`, borderRadius: 12, background: tier.header, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: .1, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.9) 1.5px,transparent 1.5px)', backgroundSize: '18px 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 0 18px', position: 'relative', zIndex: 2 }}>
              <Av u={p.username} img={p.profileImage} sz={96} ring={tier.border} />
            </div>
          </div>
          <div style={{ height: 3, margin: '10px 12px 8px', borderRadius: 2, background: p.livePnl >= 0 ? `linear-gradient(90deg,${CV.grn},${CV.teal})` : `linear-gradient(90deg,${CV.red},${CV.oran})` }} />
          <AttRow icon="📊" label="Live Trading Stats" color={CV.teal}>
            <SCell v={p.totalTrades > 0 ? fmtPnl(p.livePnl) : '—'} l="Live PnL" c={p.livePnl >= 0 ? CV.grn : CV.red} />
            <Sep /><SCell v={fmtC(p.liveEquity)} l="Live Equity" c={CV.teal} />
            <Sep /><SCell v={p.totalTrades > 0 ? `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(2)}%` : '—'} l="ROI" c={p.liveRoi >= 0 ? CV.grn : CV.red} />
          </AttRow>
          <AttRow icon="⚔️" label="Battle Record" color={CV.gold}>
            <SCell v={p.totalTrades > 0 ? `${p.winRate.toFixed(1)}%` : '—'} l="Win Rate" c={CV.purp} />
            <Sep /><SCell v={`${p.winningTrades}/${p.totalTrades}`} l="W / Trades" c={CV.grn} />
            <Sep /><SCell v={p.profitFactor > 0 ? p.profitFactor.toFixed(2) : '—'} l="Prof. Factor" c={CV.gold} />
          </AttRow>
          <AttRow icon="🛡️" label="Risk Metrics" color={CV.oran}>
            <SCell v={`${p.maxDrawdownPercentage.toFixed(1)}%`} l="Max DD" c={CV.oran} />
            <Sep /><SCell v={String(p.currentOpenPositions || 0)} l="Open Pos" c={CV.teal} />
            <Sep /><SCell v={`${winProb}%`} l="Win Prob" c={winProb >= 60 ? CV.grn : winProb >= 40 ? CV.gold : CV.oran} />
          </AttRow>
          {myPos.length > 0 && (
            <div style={{ margin: '0 12px 8px' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Open Positions ({myPos.length})</div>
              <div style={{ background: CV.bg3, borderRadius: 8, border: `1px solid ${CV.bd1}`, overflow: 'hidden' }}>
                {myPos.map((pos, i) => {
                  const isL = pos.side === 'long';
                  const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 44px 80px 72px 1fr', gap: 5, alignItems: 'center', padding: '7px 10px', borderBottom: i < myPos.length - 1 ? `1px solid ${CV.bd0}` : 'none' }}>
                      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: CV.teal }}>{(pos.symbol || '').replace('/', '')}</div>
                      <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 3, textAlign: 'center', color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.12)' : 'rgba(255,73,91,.1)', border: `1px solid ${isL ? 'rgba(34,197,94,.25)' : 'rgba(255,73,91,.25)'}` }}>{isL ? 'BUY' : 'SELL'}</span>
                      <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, color: CV.bd3 }}>{pos.entryPrice.toFixed(dec)}</div>
                      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{fmtC(Math.abs(pos.unrealizedPnl))}</div>
                      <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 9, color: CV.bd3 }}>{tAgo(pos.openedAt)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', margin: '0 12px 10px', background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 8, overflow: 'hidden', textAlign: 'center' }}>
            {([[String(p.totalTrades), 'Trades', CV.gold], [`$${p.averageWin > 0 ? p.averageWin.toFixed(0) : '—'}`, 'Avg Win', CV.grn], [`$${p.averageLoss > 0 ? p.averageLoss.toFixed(0) : '—'}`, 'Avg Loss', CV.red]] as [string, string, string][]).map(([v, l, c], i, arr) => (
              <div key={l} style={{ flex: 1, padding: '8px 4px', borderRight: i < arr.length - 1 ? `1px solid ${CV.bd1}` : 'none' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 9px' }}>
            <span style={{ fontSize: 7, color: CV.bd1, fontFamily: 'var(--font-geist-sans),sans-serif' }}>Chartvolt Trader Card</span>
            <span style={{ fontSize: 7, color: CV.bd1, fontFamily: 'monospace' }}>{(p.userId || '').slice(-8) || 'cv-arena'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ ev, onEnter }: { ev: AEvent; onEnter: (id: string) => void }) {
  const isComp = ev._et === 'competition';
  const now = Date.now();
  const msL = ev.status === 'active' && ev.endTime ? new Date(ev.endTime).getTime() - now : null;
  const msS = ev.status === 'upcoming' && ev.startTime ? new Date(ev.startTime).getTime() - now : null;
  const td = ev.status === 'active' && msL != null ? fmtMs(msL) : ev.status === 'upcoming' && msS != null ? fmtMs(Math.max(0, msS)) : '—';
  const tl = ev.status === 'active' ? 'Remaining' : ev.status === 'upcoming' ? 'Starts In' : 'Duration';
  const parts = ev.participants || [];
  const winner = ev.status === 'completed' && ev.winners?.[0];
  const isLiveEv = ev.status === 'active';
  const isUpcomingEv = ['upcoming', 'pending', 'accepted'].includes(ev.status);
  const canClick = isLiveEv || ev.status === 'completed';
  const statusColor = isLiveEv ? CV.red : isUpcomingEv ? CV.blue : CV.gray;
  const topLine = isLiveEv ? `linear-gradient(90deg,${CV.red},${CV.oran})` : isUpcomingEv ? isComp ? `linear-gradient(90deg,${CV.purp},${CV.blue})` : `linear-gradient(90deg,${CV.gold},${CV.oran})` : `linear-gradient(90deg,${CV.bd2},${CV.bg3})`;

  return (
    <div className="ev-card" onClick={() => canClick && onEnter(ev.id)} style={{ background: CV.bg2, borderRadius: 12, overflow: 'hidden', border: `1px solid ${ev.status === 'active' ? CV.red + '20' : CV.bd1}`, cursor: canClick ? 'pointer' : 'default', boxShadow: ev.status === 'active' ? `0 0 22px rgba(255,73,91,.05)` : 'none', transition: 'all .25s cubic-bezier(.4,0,.2,1)' }}>
      <div style={{ height: 3, background: topLine }} />
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, color: isComp ? CV.teal : CV.gold, background: isComp ? 'rgba(15,237,190,.07)' : 'rgba(253,212,88,.07)', border: `1px solid ${isComp ? CV.teal + '22' : CV.gold + '22'}` }}>{isComp ? 'Competition' : 'Challenge'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: statusColor }}>
            {isLiveEv && <div style={{ width: 5, height: 5, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />}
            {isLiveEv ? 'LIVE' : isUpcomingEv ? 'UPCOMING' : 'ENDED'}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 17, fontWeight: 700, color: CV.lgt, marginBottom: 4 }}>{ev.name}</div>
        <div style={{ fontSize: 10, color: CV.bd3, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
          {([[fmtPrize(ev.prizePool), 'Prize', CV.gold], [`${ev.currentParticipants}/${ev.maxParticipants || '∞'}`, 'Players', CV.teal], [td, tl, ev.status === 'active' ? CV.red : CV.gray]] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '6px 3px', background: CV.bg3, borderRadius: 6, border: `1px solid ${CV.bd0}` }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: c, marginBottom: 1 }}>{v}</div>
              <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTop: `1px solid ${CV.bd0}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {parts.slice(0, 4).map((p, i) => <div key={p.userId} style={{ marginLeft: i === 0 ? 0 : -5, zIndex: 10 - i, position: 'relative' }}><Av u={p.username} img={p.profileImage} sz={24} ring={CV.bd3} /></div>)}
            {(ev.currentParticipants || 0) > 4 && <div style={{ width: 24, height: 24, borderRadius: '50%', marginLeft: -5, background: CV.bg4, border: `1px solid ${CV.bd2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: CV.gray }}>+{ev.currentParticipants - 4}</div>}
          </div>
          {ev.status === 'active' ? (
            <button onClick={e => { e.stopPropagation(); onEnter(ev.id); }} className="ebtn" style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${CV.teal}44`, background: `rgba(15,237,190,.08)`, color: CV.teal }}>Watch Live</button>
          ) : winner ? <span style={{ fontSize: 10, color: CV.gold }}>🏆 {winner.username}</span> : null}
        </div>
        {winner && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(253,212,88,.04)', borderTop: '1px solid rgba(253,212,88,.1)', marginTop: 10, fontSize: 11, color: CV.gold }}>🏆 Winner: <strong>{winner.username}</strong> · {fmtPnl(winner.livePnl)}</div>}
      </div>
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

function Ticker({ prices, events }: { prices: PriceMap; events: AEvent[] }) {
  const prevRef = useRef<Record<string, number>>({});
  const syms = useMemo(() => {
    const extra = new Set<string>();
    events.filter(e => e.status === 'active').forEach(e => (e.openPositions || []).forEach(p => { if (p.symbol) extra.add(p.symbol.replace('/', '').toUpperCase()); }));
    return [...new Set([...TICKER_SYMS, ...extra])];
  }, [events]);
  const chunks = syms.map(sym => {
    const p = prices[sym];
    if (!p?.mid) return null;
    const prev = prevRef.current[sym];
    const dir = prev === undefined ? 0 : p.mid > prev ? 1 : p.mid < prev ? -1 : 0;
    prevRef.current[sym] = p.mid;
    const dec = (sym.includes('JPY') || sym.includes('XAU') || p.mid > 500) ? 2 : 4;
    return (
      <span key={sym} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: CV.teal, fontWeight: 700 }}>{sym}</span>
        <span style={{ color: dir === 1 ? CV.grn : dir === -1 ? CV.red : CV.gray }}>{dir === 1 ? '▲' : dir === -1 ? '▼' : ''} {p.mid.toFixed(dec)}</span>
        {p.bid && p.ask && <span style={{ color: CV.bd2, fontSize: 9 }}>sp:{((p.ask - p.bid) * Math.pow(10, dec)).toFixed(1)}</span>}
      </span>
    );
  }).filter(Boolean);
  if (!chunks.length)
    return <div style={{ background: 'rgba(15,237,190,.02)', borderBottom: `1px solid ${CV.bd0}`, padding: '5px 16px', fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, color: CV.bd3, flexShrink: 0 }}>CHARTVOLT ARENA — Market data initialising…</div>;
  return (
    <div style={{ background: 'rgba(15,237,190,.02)', borderBottom: `1px solid ${CV.bd0}`, padding: '4px 0', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'inline-flex', gap: 38, animation: 'tickS 38s linear infinite', fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 500, color: CV.gray, paddingLeft: 20 }}>{[...chunks, ...chunks]}</div>
    </div>
  );
}

// ─── Scene 1: Overview ────────────────────────────────────────────────────────

// Seeded rank delta for each trader (stable per 5-min bucket)
function rankDelta(userId: string): number {
  const bucket = Math.floor(Date.now() / 300000);
  let rng = bucket;
  const s = 'rk' + userId;
  for (let i = 0; i < s.length; i++) rng = (rng * 31 + s.charCodeAt(i)) >>> 0;
  rng = (rng * 1664525 + 1013904223) >>> 0;
  return (rng % 5) - 2; // -2 to +2
}

const CHART_SYMS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD', 'USDJPY', 'USDCAD'] as const;

function OverviewScene({ ev, prices, onTrader }: { ev: AEvent; prices: PriceMap; onTrader: (p: Participant) => void }) {
  const rm = ev.rankingMethod || 'pnl';
  const top10 = useMemo(() => [...ev.participants].filter(p => p.totalTrades > 0 && !p.isDisqualified).sort((a, b) => raceScore(b, rm) - raceScore(a, rm)).slice(0, 10), [ev, rm]);
  const leader = top10[0] ?? null;

  // Chart symbol/TF state
  const [chartSym, setChartSym] = useState<string>(CHART_SYMS[0]);
  const [chartTf, setChartTf] = useState<string>('5m');
  const priceData = prices[chartSym] ?? null;
  const mid = priceData?.mid ?? 0;
  const dec = chartSym.includes('JPY') ? 3 : (chartSym.includes('XAU') || mid > 500) ? 2 : 5;

  // Simulated price change vs candle[0].o
  const candles = useMemo(() => generateCandles(chartSym, mid), [chartSym, Math.floor(Date.now() / 300000)]);// eslint-disable-line react-hooks/exhaustive-deps
  const firstOpen = candles[0]?.o ?? mid;
  const chg = mid - firstOpen;
  const chgPct = firstOpen > 0 ? (chg / firstOpen) * 100 : 0;
  const chgPos = chg >= 0;

  // Action feed events (derived from live data)
  const feedEvents = useMemo(() => {
    const evts: Array<{ icon: string; html: React.ReactNode; time: string }> = [];
    if (leader) {
      evts.push({ icon: '👑', html: <><b style={{ color: '#fff' }}>New Leader!</b> {leader.username} leads with {fmtPnl(leader.livePnl)}</>, time: 'just now' });
    }
    const danger = ev.participants.find(p => !p.isDisqualified && p.maxDrawdownPercentage > 20);
    if (danger) {
      evts.push({ icon: '⚠️', html: <><b style={{ color: '#fff' }}>Danger Zone</b> — {danger.username} drawdown {danger.maxDrawdownPercentage.toFixed(0)}%</>, time: '2 min ago' });
    }
    ev.openPositions.slice(0, 5).forEach((pos, i) => {
      const isL = pos.side === 'long';
      evts.push({
        icon: isL ? '📈' : '📉',
        html: <><b style={{ color: '#fff' }}>{pos.username}</b> opened {isL ? 'LONG' : 'SHORT'} <span style={{ color: '#0FEDBE', fontFamily: 'monospace' }}>{(pos.symbol || '').replace('/', '')}</span>{pos.leverage > 1 ? ` ${pos.leverage}×` : ''}</>,
        time: tAgo(pos.openedAt) === 'now' ? 'just now' : tAgo(pos.openedAt) + ' ago',
      });
    });
    if (top10[1]) {
      evts.push({ icon: '🔥', html: <><b style={{ color: '#fff' }}>Big Move</b> — {top10[1].username} {fmtPnl(top10[1].livePnl)}</>, time: '5 min ago' });
    }
    ev.participants.filter(p => p.totalTrades > 3 && p.winRate >= 80).slice(0, 2).forEach(p => {
      evts.push({ icon: '🏆', html: <><b style={{ color: '#fff' }}>{p.username}</b> win streak ×{p.winningTrades}</>, time: '10 min ago' });
    });
    return evts.slice(0, 9);
  }, [ev, leader, top10]);

  // Hot traders (top 3 positive movers)
  const hot3 = useMemo(() => top10.filter(p => p.livePnl > 0).slice(0, 3), [top10]);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* ── Left: Leaderboard (290px) ── */}
      <div style={{ width: 290, flexShrink: 0, borderRight: `1px solid rgba(255,255,255,.07)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid rgba(255,255,255,.07)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color: '#555577', letterSpacing: 3, textTransform: 'uppercase' }}>Live Leaders</span>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, padding: '1px 7px', borderRadius: 3, color: '#ffab00', background: 'rgba(255,171,0,.1)', border: '1px solid rgba(255,171,0,.2)', letterSpacing: 1 }}>TOP 10</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {top10.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: '#555577' }}>No active traders yet</div>
          ) : top10.map((p, i) => {
            const pnlPos = p.livePnl >= 0;
            const rkColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#9095A1';
            const sparkPts = genSparkline(p.username, ev.startingCapital, p.liveEquity, 36, 18);
            const sparkColor = pnlPos ? '#00e676' : '#ff1744';
            const delta = rankDelta(p.userId);
            return (
              <div key={p.userId} onClick={() => onTrader(p)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderBottom: 'rgba(255,255,255,.03) solid 1px', cursor: 'pointer', background: i === 0 ? 'rgba(255,215,0,.04)' : i === 1 ? 'rgba(192,192,192,.02)' : i === 2 ? 'rgba(205,127,50,.02)' : 'transparent' }}>
                {/* Rank */}
                <div style={{ width: 20, fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, fontWeight: 900, color: rkColor, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                {/* Avatar */}
                <Av u={p.username} img={p.profileImage} sz={22} ring={i < 3 ? rkColor : undefined} />
                {/* Name + PnL */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: pnlPos ? '#00e676' : '#ff1744' }}>{fmtPnl(p.livePnl)}</div>
                </div>
                {/* Rank delta */}
                <div style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: delta > 0 ? '#00e676' : delta < 0 ? '#ff1744' : '#555577', minWidth: 18, textAlign: 'center' }}>
                  {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '—'}
                </div>
                {/* Sparkline */}
                <svg width={36} height={18} viewBox="0 0 36 18" style={{ flexShrink: 0 }}>
                  <polyline points={sparkPts} fill="none" stroke={sparkColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center: Candlestick Chart ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chart header */}
        <div style={{ height: 36, borderBottom: `1px solid rgba(255,255,255,.07)`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 9, flexShrink: 0, background: 'rgba(255,255,255,.012)' }}>
          <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 13, fontWeight: 800, color: '#fff' }}>{chartSym.replace('USD', '/USD').replace('XAU/', 'XAU/')}</span>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, color: '#555577' }}>{mid ? mid.toFixed(dec) : '—'}</span>
          {mid > 0 && <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: chgPos ? '#00e676' : '#ff1744' }}>
            {chgPos ? '+' : ''}{chg.toFixed(dec)} ({chgPos ? '+' : ''}{chgPct.toFixed(2)}%)
          </span>}
          <div style={{ flex: 1 }} />
          {/* TF buttons */}
          {(['1m', '5m', '15m', '1h'] as const).map(tf => (
            <button key={tf} onClick={() => setChartTf(tf)} style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, cursor: 'pointer', background: chartTf === tf ? 'rgba(0,176,255,.15)' : 'rgba(255,255,255,.06)', color: chartTf === tf ? '#00b0ff' : '#555577', border: chartTf === tf ? '1px solid rgba(0,176,255,.25)' : '1px solid transparent' }}>{tf}</button>
          ))}
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.07)' }} />
          {/* Symbol buttons */}
          {CHART_SYMS.slice(0, 4).map(sym => (
            <button key={sym} onClick={() => setChartSym(sym)} style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', background: chartSym === sym ? 'rgba(15,237,190,.15)' : 'rgba(255,255,255,.06)', color: chartSym === sym ? '#0FEDBE' : '#555577', border: chartSym === sym ? '1px solid rgba(15,237,190,.25)' : '1px solid transparent' }}>{sym}</button>
          ))}
        </div>
        {/* Chart area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.025) 40px),repeating-linear-gradient(90deg,transparent,transparent 59px,rgba(255,255,255,.015) 60px)' }} />
          <CandleChart symbol={chartSym} priceData={priceData} openPositions={ev.openPositions} leader={leader} />
        </div>
      </div>

      {/* ── Right: Action Feed (260px) ── */}
      <div style={{ width: 260, flexShrink: 0, borderLeft: `1px solid rgba(255,255,255,.07)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid rgba(255,255,255,.07)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, color: '#555577', letterSpacing: 3, textTransform: 'uppercase' }}>Action Feed</span>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {feedEvents.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 12px', borderBottom: 'rgba(255,255,255,.03) solid 1px' }}>
              <div style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{e.icon}</div>
              <div>
                <div style={{ fontSize: 10, lineHeight: 1.45, color: '#bbb' }}>{e.html}</div>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, color: '#555577', marginTop: 2 }}>{e.time}</div>
              </div>
            </div>
          ))}
          {feedEvents.length === 0 && (
            <div style={{ fontSize: 11, color: '#555577', textAlign: 'center', padding: '32px 0' }}>Waiting for activity…</div>
          )}
        </div>
        {/* Hot Traders section */}
        {hot3.length > 0 && (
          <div style={{ padding: '8px 12px 10px', borderTop: `1px solid rgba(255,255,255,.07)`, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: '#555577', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 7 }}>Hot Traders 🔥</div>
            {hot3.map(p => (
              <div key={p.userId} onClick={() => onTrader(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                <Av u={p.username} img={p.profileImage} sz={20} />
                <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, flex: 1, color: '#e0e0e0' }}>{p.username}</span>
                <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: '#00e676' }}>{fmtPnl(p.livePnl)} ↑</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scene 3: Spotlight ───────────────────────────────────────────────────────

function SpotlightScene({ ev, onTrader }: { ev: AEvent; onTrader: (p: Participant) => void }) {
  const rm = ev.rankingMethod || 'pnl';
  const racers = useMemo(() => [...ev.participants].filter(p => p.totalTrades > 0 && !p.isDisqualified).sort((a, b) => raceScore(b, rm) - raceScore(a, rm)), [ev, rm]);
  const leader = racers[0];
  const second = racers[1];
  if (!leader) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40, opacity: .3 }}>🔦</div>
      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 3 }}>No Active Traders</div>
    </div>
  );
  const winProb = calcWinProb(leader, ev);
  const myPos = ev.openPositions.filter(pos => pos.userId === leader.userId);
  const tier = getTier(leader.rank);
  const isUp = leader.livePnl >= 0;
  const gap = second ? leader.liveEquity - second.liveEquity : 0;
  const SW = 500, SH = 100;
  const sparkPts = genSparkline(leader.username, ev.startingCapital, leader.liveEquity, SW, SH);
  const lastPt = sparkPts.split(' ').pop()?.split(',') ?? ['500', '50'];
  const dotY = parseFloat(lastPt[1] ?? '50');
  const avgLev = myPos.length > 0 ? (myPos.reduce((s, p) => s + p.leverage, 0) / myPos.length).toFixed(0) + '×' : '—';

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: Trader Card */}
      <div style={{ width: 258, flexShrink: 0, borderRight: `1px solid ${CV.bd1}`, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', scrollbarWidth: 'none', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, letterSpacing: 2, padding: '2px 8px', borderRadius: 4, background: tier.tag, color: tier.tagColor, border: `1px solid ${tier.border}44` }}>{tier.tagLabel}</span>
          <span style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, color: CV.grn, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', letterSpacing: 1 }}>LEADING</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onTrader(leader)}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 16, filter: `drop-shadow(0 0 6px ${CV.gold})` }}>👑</div>
            <Av u={leader.username} img={leader.profileImage} sz={54} ring={CV.gold} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 17, fontWeight: 700, color: CV.lgt }}>{leader.username}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.gold, letterSpacing: 2 }}>RANK #1 of {ev.participants.length}</div>
          </div>
        </div>
        <div style={{ background: isUp ? 'rgba(34,197,94,.06)' : 'rgba(255,73,91,.06)', border: `1px solid ${isUp ? 'rgba(34,197,94,.2)' : 'rgba(255,73,91,.2)'}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Live P&L</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 26, fontWeight: 900, color: isUp ? CV.grn : CV.red, lineHeight: 1 }}>{fmtPnl(leader.livePnl)}</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: isUp ? CV.grn + 'aa' : CV.red + 'aa', marginTop: 4 }}>{leader.liveRoi >= 0 ? '+' : ''}{leader.liveRoi.toFixed(2)}% ROI</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {([[fmtC(leader.liveEquity), 'Equity', CV.teal], [`${leader.winRate.toFixed(1)}%`, 'Win Rate', CV.purp], [`${leader.totalTrades}`, 'Trades', CV.blue], [leader.profitFactor > 0 ? leader.profitFactor.toFixed(2) : '—', 'Prof. Factor', CV.gold], [`${leader.maxDrawdownPercentage.toFixed(1)}%`, 'Max DD', CV.oran], [`${winProb}%`, 'Win Prob', winProb >= 60 ? CV.grn : winProb >= 40 ? CV.gold : CV.oran]] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 7, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {myPos.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Open Positions ({myPos.length})</div>
            {myPos.slice(0, 3).map((pos, i) => {
              const isL = pos.side === 'long';
              const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: CV.bg3, borderRadius: 7, border: `1px solid ${CV.bd1}`, marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: CV.teal, flex: 1 }}>{(pos.symbol || '').replace('/', '')}</div>
                  <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3, color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.1)' : 'rgba(255,73,91,.1)' }}>{isL ? 'BUY' : 'SELL'}</span>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{pos.unrealizedPnl >= 0 ? '+' : ''}{fmtC(pos.unrealizedPnl)}</div>
                  <div style={{ fontSize: 8, color: CV.bd3 }}>{pos.entryPrice.toFixed(dec)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Center: Equity Chart */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${CV.bd0}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.012)' }}>
          <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 13, fontWeight: 700, color: CV.lgt }}>Equity Curve — {leader.username}</span>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, color: CV.teal }}>{fmtC(leader.liveEquity)}</span>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, color: isUp ? CV.grn : CV.red, fontWeight: 700 }}>{fmtPnl(leader.livePnl)}</span>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.025) 40px),repeating-linear-gradient(90deg,transparent,transparent 59px,rgba(255,255,255,.015) 60px)' }} />
          <svg width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="spotGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? CV.grn : CV.red} stopOpacity={0.28} />
                <stop offset="100%" stopColor={isUp ? CV.grn : CV.red} stopOpacity={0} />
              </linearGradient>
              <filter id="spotGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <polygon points={`0,${SH} ${sparkPts} ${SW},${SH}`} fill="url(#spotGrad)" />
            <line x1="0" y1={SH * 0.92} x2={SW} y2={SH * 0.92} stroke="rgba(255,255,255,.07)" strokeWidth="1" strokeDasharray="5,4" />
            <polyline points={sparkPts} fill="none" stroke={isUp ? CV.grn : CV.red} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#spotGlow)" />
            <circle cx={SW} cy={dotY} r={5} fill={isUp ? CV.grn : CV.red} filter="url(#spotGlow)" />
          </svg>
          <div style={{ position: 'absolute', top: 12, right: 16, background: isUp ? 'rgba(34,197,94,.15)' : 'rgba(255,73,91,.15)', border: `1px solid ${isUp ? 'rgba(34,197,94,.35)' : 'rgba(255,73,91,.35)'}`, borderRadius: 7, padding: '6px 12px', backdropFilter: 'blur(6px)' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 18, fontWeight: 700, color: isUp ? CV.grn : CV.red, lineHeight: 1 }}>{fmtPnl(leader.livePnl)}</div>
            <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1, marginTop: 3 }}>LIVE P&L</div>
          </div>
          <div style={{ position: 'absolute', bottom: 12, left: 16, fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.bd3 }}>Start: {fmtC(ev.startingCapital)}</div>
          <div style={{ position: 'absolute', bottom: 12, right: 16, fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.teal }}>Now: {fmtC(leader.liveEquity)}</div>
        </div>
      </div>
      {/* Right: Vs Field */}
      <div style={{ width: 228, flexShrink: 0, borderLeft: `1px solid ${CV.bd1}`, display: 'flex', flexDirection: 'column', padding: '14px', gap: 14, overflowY: 'auto', scrollbarWidth: 'none', background: 'rgba(255,255,255,.012)' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase' }}>Vs. Field</div>
        {second && (
          <div style={{ background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Lead Over #{second.rank}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 20, fontWeight: 900, color: gap > 0 ? CV.grn : CV.red }}>{gap > 0 ? '+' : ''}{fmtC(gap)}</div>
            <div style={{ fontSize: 9, color: CV.bd3, marginTop: 2 }}>vs {second.username}</div>
          </div>
        )}
        <div style={{ background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Win Probability</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: CV.bg4, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${winProb}%`, background: `linear-gradient(90deg,${CV.teal},${CV.blue})`, borderRadius: 3, transition: 'width 1.5s ease' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, fontWeight: 700, color: winProb >= 60 ? CV.teal : winProb >= 40 ? CV.gold : CV.oran }}>{winProb}%</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 }}>Aggression</div>
          {([['Avg Leverage', avgLev], ['Open Trades', String(leader.currentOpenPositions || 0)], ['Total Trades', String(leader.totalTrades)], ['Largest Win', leader.largestWin > 0 ? fmtC(leader.largestWin) : '—'], ['Largest Loss', leader.largestLoss > 0 ? fmtC(leader.largestLoss) : '—']] as [string, string][]).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5, paddingBottom: 5, borderBottom: `1px solid ${CV.bd0}` }}>
              <span style={{ color: CV.gray }}>{l}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', color: CV.lgt, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        {racers.slice(1, 5).length > 0 && (
          <div>
            <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Other Contenders</div>
            {racers.slice(1, 5).map(p => (
              <div key={p.userId} onClick={() => onTrader(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}>
                <Av u={p.username} img={p.profileImage} sz={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, fontWeight: 600, color: CV.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                  <div style={{ height: 3, background: CV.bg4, borderRadius: 1.5, marginTop: 3 }}>
                    <div style={{ height: '100%', width: `${calcWinProb(p, ev)}%`, background: CV.blue + '99', borderRadius: 1.5, transition: 'width 1.5s ease' }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: p.livePnl >= 0 ? CV.grn : CV.red }}>{fmtPnl(p.livePnl)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scene 4: H2H ─────────────────────────────────────────────────────────────

function H2HScene({ ev, onTrader }: { ev: AEvent; onTrader: (p: Participant) => void }) {
  const rm = ev.rankingMethod || 'pnl';
  const racers = useMemo(() => [...ev.participants].filter(p => p.totalTrades > 0 && !p.isDisqualified).sort((a, b) => raceScore(b, rm) - raceScore(a, rm)), [ev, rm]);
  const p1 = racers[0], p2 = racers[1];
  if (!p1 || !p2) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40, opacity: .3 }}>⚔️</div>
      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 3 }}>{!p1 ? 'No Active Traders' : 'Need 2+ Traders'}</div>
      <div style={{ fontSize: 11, color: CV.bd3 }}>Head-to-head activates once 2 traders are competing</div>
    </div>
  );
  const lead = p1.liveEquity - p2.liveEquity;
  const sp1 = genSparkline(p1.username, ev.startingCapital, p1.liveEquity, 300, 80);
  const sp2 = genSparkline(p2.username, ev.startingCapital, p2.liveEquity, 300, 80);

  const Panel = ({ p, sp, side }: { p: Participant; sp: string; side: 'left' | 'right' }) => {
    const isUp = p.livePnl >= 0;
    const col  = side === 'left' ? CV.gold : '#C0C0C0';
    const myPos = ev.openPositions.filter(pos => pos.userId === p.userId);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: side === 'left' ? 'rgba(253,212,88,.04)' : 'rgba(192,192,192,.02)', borderRight: side === 'left' ? `1px solid ${CV.bd1}` : 'none', padding: '20px 20px 16px', gap: 14, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: side === 'right' ? 'row-reverse' : 'row', cursor: 'pointer' }} onClick={() => onTrader(p)}>
          <div style={{ position: 'relative' }}>
            {side === 'left' && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 14 }}>👑</div>}
            <Av u={p.username} img={p.profileImage} sz={56} ring={col} />
          </div>
          <div style={{ textAlign: side === 'right' ? 'right' : 'left' }}>
            <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 19, fontWeight: 700, color: CV.lgt }}>{p.username}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: col, letterSpacing: 2 }}>RANK #{p.rank}</div>
          </div>
        </div>
        <div style={{ textAlign: side === 'right' ? 'right' : 'left' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 34, fontWeight: 900, color: isUp ? CV.grn : CV.red, lineHeight: 1 }}>{fmtPnl(p.livePnl)}</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, color: CV.teal, marginTop: 5 }}>{fmtC(p.liveEquity)} equity</div>
        </div>
        <div style={{ background: CV.bg3, borderRadius: 8, border: `1px solid ${CV.bd1}`, padding: '10px', overflow: 'hidden' }}>
          <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Equity Curve</div>
          <svg width="100%" height={80} viewBox="0 0 300 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`h2hG${side}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col} stopOpacity={0.25} />
                <stop offset="100%" stopColor={col} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={`0,80 ${sp} 300,80`} fill={`url(#h2hG${side})`} />
            <polyline points={sp} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {([[`${p.winRate.toFixed(0)}%`, 'Win Rate', CV.purp], [`${p.totalTrades}`, 'Trades', CV.blue], [`${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(1)}%`, 'ROI', p.liveRoi >= 0 ? CV.grn : CV.red], [`${p.maxDrawdownPercentage.toFixed(1)}%`, 'Max DD', CV.oran], [p.profitFactor > 0 ? p.profitFactor.toFixed(2) : '—', 'Pr. Factor', CV.gold], [String(p.currentOpenPositions || 0), 'Open Pos', CV.teal]] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ background: CV.bg4, borderRadius: 6, padding: '7px', textAlign: 'center', border: `1px solid ${CV.bd0}` }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {myPos.slice(0, 2).map((pos, i) => {
          const isL = pos.side === 'long';
          const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', background: CV.bg4, borderRadius: 6, border: `1px solid ${CV.bd0}` }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: CV.teal, flex: 1 }}>{(pos.symbol || '').replace('/', '')}</div>
              <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3, color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.1)' : 'rgba(255,73,91,.1)', border: `1px solid ${isL ? 'rgba(34,197,94,.2)' : 'rgba(255,73,91,.2)'}` }}>{isL ? 'LONG' : 'SHORT'}</span>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{pos.unrealizedPnl >= 0 ? '+' : ''}{fmtC(pos.unrealizedPnl)}</div>
              <div style={{ fontSize: 8, color: CV.bd3 }}>{pos.entryPrice.toFixed(dec)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* VS Header */}
      <div style={{ height: 60, flexShrink: 0, borderBottom: `1px solid ${CV.bd1}`, background: `linear-gradient(90deg,rgba(253,212,88,.06),transparent 40%,transparent 60%,rgba(192,192,192,.04))`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Av u={p1.username} img={p1.profileImage} sz={34} ring={CV.gold} />
          <div>
            <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 14, fontWeight: 800, color: CV.lgt }}>{p1.username}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 900, color: p1.livePnl >= 0 ? CV.grn : CV.red }}>{fmtPnl(p1.livePnl)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 130 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 3, color: CV.bd3 }}>LEADS BY</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 18, fontWeight: 900, color: lead >= 0 ? CV.gold : '#C0C0C0' }}>{lead >= 0 ? '+' : ''}{fmtC(lead)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ height: 3, width: 42, background: `linear-gradient(90deg,${CV.gold},${CV.oran})`, borderRadius: 1.5 }} />
            <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.bd3 }}>VS</span>
            <div style={{ height: 3, width: 42, background: 'linear-gradient(90deg,#C0C0C0,#888)', borderRadius: 1.5 }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 14, fontWeight: 800, color: CV.lgt }}>{p2.username}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 900, color: p2.livePnl >= 0 ? CV.grn : CV.red }}>{fmtPnl(p2.livePnl)}</div>
          </div>
          <Av u={p2.username} img={p2.profileImage} sz={34} ring="#C0C0C0" />
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Panel p={p1} sp={sp1} side="left" />
        <Panel p={p2} sp={sp2} side="right" />
      </div>
    </div>
  );
}

// ─── Scene 5: Danger Zone ─────────────────────────────────────────────────────

function DangerScene({ ev, onTrader }: { ev: AEvent; onTrader: (p: Participant) => void }) {
  const atRisk = useMemo(() => ev.participants.filter(p => !p.isDisqualified && (p.maxDrawdownPercentage > 15 || (p.livePnl < 0 && p.currentOpenPositions > 0))).sort((a, b) => b.maxDrawdownPercentage - a.maxDrawdownPercentage), [ev]);
  if (atRisk.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🛡️</div>
      <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, color: CV.grn, letterSpacing: 3 }}>ALL TRADERS SAFE</div>
      <div style={{ fontSize: 11, color: CV.bd3 }}>No traders are currently in the danger zone</div>
    </div>
  );
  const danger = atRisk[0];
  const liqProb = Math.min(95, Math.round((danger.maxDrawdownPercentage / 50) * 100 + (danger.currentOpenPositions * 8)));
  const myPos = ev.openPositions.filter(pos => pos.userId === danger.userId);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(255,73,91,.06) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, border: `2px solid rgba(255,73,91,.4)`, pointerEvents: 'none', zIndex: 10, animation: 'dangerPulse 1.2s ease-in-out infinite' }} />
      {/* Left */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid rgba(255,73,91,.2)`, display: 'flex', flexDirection: 'column', padding: '50px 16px 16px', gap: 12, zIndex: 1, background: 'rgba(255,73,91,.03)', overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, fontWeight: 900, letterSpacing: 4, color: '#fff', background: CV.red, padding: '5px 16px', borderRadius: 4, boxShadow: `0 0 20px ${CV.red}88` }}>⚠️ DANGER ZONE ⚠️</span>
        </div>
        <div style={{ background: 'rgba(255,73,91,.08)', border: `1px solid rgba(255,73,91,.2)`, borderRadius: 10, padding: '12px', cursor: 'pointer' }} onClick={() => onTrader(danger)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Av u={danger.username} img={danger.profileImage} sz={36} ring={CV.red} />
            <div>
              <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 13, fontWeight: 700, color: CV.lgt }}>{danger.username}</div>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.red, letterSpacing: 1 }}>RANK #{danger.rank}</div>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase' }}>Max Drawdown</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, fontWeight: 900, color: CV.red }}>{danger.maxDrawdownPercentage.toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, danger.maxDrawdownPercentage * 2)}%`, background: `linear-gradient(90deg,${CV.grn},${CV.gold},${CV.red})`, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 7, color: CV.grn }}>Safe 0%</span>
              <span style={{ fontSize: 7, color: CV.red, fontWeight: 700 }}>⚠️ Danger 50%+</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {([[fmtPnl(danger.livePnl), 'Live PnL', danger.livePnl >= 0 ? CV.grn : CV.red], [fmtC(danger.liveEquity), 'Equity', CV.teal], [String(danger.currentOpenPositions || 0), 'Open Pos', CV.oran], [String(liqProb) + '%', 'Risk Score', liqProb > 60 ? CV.red : liqProb > 40 ? CV.oran : CV.grn]] as [string, string, string][]).map(([v, l, c]) => (
              <div key={l} style={{ background: CV.bg3, border: 'rgba(255,73,91,.1) solid 1px', borderRadius: 6, padding: '7px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {myPos.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.red, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Risky Positions ({myPos.length})</div>
            {myPos.slice(0, 3).map((pos, i) => {
              const isL = pos.side === 'long';
              const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: 'rgba(255,73,91,.06)', borderRadius: 7, border: 'rgba(255,73,91,.15) solid 1px', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: CV.teal, flex: 1 }}>{(pos.symbol || '').replace('/', '')}</div>
                  <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3, color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.1)' : 'rgba(255,73,91,.1)' }}>{isL ? 'LONG' : 'SHORT'}</span>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 10, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{pos.unrealizedPnl >= 0 ? '+' : ''}{fmtC(pos.unrealizedPnl)}</div>
                  {pos.leverage > 1 && <span style={{ fontSize: 8, color: CV.oran }}>{pos.leverage}×</span>}
                  <span style={{ fontSize: 8, color: CV.bd3 }}>{pos.entryPrice.toFixed(dec)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, padding: '16px', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, fontWeight: 700, color: CV.red, letterSpacing: 3 }}>⚠️ All At-Risk Traders</div>
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {atRisk.map((p, i) => {
            const riskScore = Math.min(100, Math.round(p.maxDrawdownPercentage * 2 + (p.currentOpenPositions * 5)));
            const riskColor = riskScore > 60 ? CV.red : riskScore > 40 ? CV.oran : CV.gold;
            return (
              <div key={p.userId} onClick={() => onTrader(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: i === 0 ? 'rgba(255,73,91,.08)' : CV.bg2, border: `1px solid ${i === 0 ? 'rgba(255,73,91,.25)' : CV.bd1}`, borderRadius: 8, cursor: 'pointer' }}>
                <Av u={p.username} img={p.profileImage} sz={30} ring={i === 0 ? CV.red : undefined} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 12, fontWeight: 600, color: CV.lgt }}>{p.username}</span>
                    <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.bd3 }}>#{p.rank}</span>
                    {i === 0 && <span style={{ fontSize: 8, color: CV.red, fontWeight: 700, letterSpacing: 1 }}>HIGHEST RISK</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: CV.bd0, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${riskScore}%`, background: `linear-gradient(90deg,${CV.grn},${CV.gold},${CV.red})`, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: riskColor, fontWeight: 700 }}>{riskScore}/100</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, fontWeight: 700, color: p.livePnl >= 0 ? CV.grn : CV.red }}>{fmtPnl(p.livePnl)}</div>
                  <div style={{ fontSize: 8, color: CV.oran, marginTop: 2 }}>DD: {p.maxDrawdownPercentage.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Right */}
      <div style={{ width: 228, flexShrink: 0, borderLeft: 'rgba(255,73,91,.2) solid 1px', display: 'flex', flexDirection: 'column', padding: '50px 14px 14px', gap: 12, zIndex: 1, background: 'rgba(255,73,91,.03)', overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.red, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>⚠️ Incident Details</div>
        <div style={{ background: 'rgba(255,73,91,.06)', border: 'rgba(255,73,91,.15) solid 1px', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 8, color: CV.bd3, marginBottom: 3 }}>If Disqualified</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: CV.red }}>Others rank up</div>
          <div style={{ fontSize: 9, color: CV.bd3, marginTop: 3 }}>Per competition rules</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: CV.bd3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Risk Assessment</div>
          {([[`Traders at risk`, String(atRisk.length)], ['Avg drawdown', `${(atRisk.reduce((s, p) => s + p.maxDrawdownPercentage, 0) / atRisk.length).toFixed(1)}%`], ['Open risky pos', String(atRisk.reduce((s, p) => s + p.currentOpenPositions, 0))], ['Combined PnL', fmtPnl(atRisk.reduce((s, p) => s + p.livePnl, 0))]] as [string, string][]).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${CV.bd0}` }}>
              <span style={{ color: CV.gray }}>{l}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', color: CV.oran, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 8, color: CV.bd3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Rank Impact if DQ</div>
          {ev.participants.filter(p => !p.isDisqualified && p.totalTrades > 0 && !atRisk.find(r => r.userId === p.userId)).slice(0, 5).map(p => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <Av u={p.username} img={p.profileImage} sz={20} />
              <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 10, color: CV.gray, flex: 1 }}>{p.username}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, color: CV.grn }}>↑ #{Math.max(1, p.rank - atRisk.length)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Scene 6: Podium ──────────────────────────────────────────────────────────

function PodiumScene({ ev, onTrader }: { ev: AEvent; onTrader: (p: Participant) => void }) {
  const rm = ev.rankingMethod || 'pnl';
  const topTradersFromParticipants = useMemo(() =>
    [...ev.participants].filter(p => p.totalTrades > 0 && !p.isDisqualified).sort((a, b) => raceScore(b, rm) - raceScore(a, rm)).slice(0, 3),
    [ev, rm]
  );
  const winners = (ev.winners && ev.winners.length > 0) ? ev.winners : topTradersFromParticipants;
  const isCompleted = ev.status === 'completed';
  const order = [1, 0, 2];
  const heights = [140, 200, 110];
  const medals = ['🥈', '🥇', '🥉'];
  const cols = [RANK_COLORS[1], RANK_COLORS[0], RANK_COLORS[2]];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', gap: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 35%,rgba(253,212,88,.08) 0%,transparent 60%)', pointerEvents: 'none' }} />
      {isCompleted && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 45 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', top: -12, left: `${(i * 2.3) % 100}%`, width: i % 3 === 0 ? 7 : 4, height: i % 3 === 0 ? 7 : 4, background: [CV.gold, CV.teal, CV.purp, CV.grn, CV.oran, '#fff'][i % 6], borderRadius: i % 2 === 0 ? '50%' : '2px', animation: `fall ${2.4 + (i % 5) * 0.5}s ${(i % 7) * 0.35}s linear infinite` }} />
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: 6, background: `linear-gradient(90deg,${CV.gold},${CV.oran},${CV.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {isCompleted ? '🏆 FINAL RESULTS' : '🏅 CURRENT STANDINGS'}
        </div>
        <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 12, color: CV.gray, letterSpacing: 2, marginTop: 4 }}>{ev.name}</div>
      </div>
      {winners.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, zIndex: 1 }}>
          {order.map((wi, si) => {
            const winner = winners[wi];
            if (!winner) return <div key={wi} style={{ width: 155 }} />;
            const col = cols[si];
            const prizeEntry = ev.prizeDistribution?.find(d => d.rank === wi + 1);
            const prizeAmt = prizeEntry ? Math.floor((ev.prizePool || 0) * prizeEntry.percentage / 100) : 0;
            return (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onTrader(winner)}>
                <div style={{ fontSize: 22 }}>{medals[si]}</div>
                <Av u={winner.username} img={winner.profileImage} sz={si === 1 ? 72 : 54} ring={col} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: si === 1 ? 16 : 13, fontWeight: 700, color: col }}>{winner.username}</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: si === 1 ? 14 : 12, fontWeight: 700, color: winner.livePnl >= 0 ? CV.grn : CV.red, marginTop: 2 }}>{fmtPnl(winner.livePnl)}</div>
                  <div style={{ fontSize: 9, color: CV.bd3, marginTop: 1 }}>{winner.liveRoi >= 0 ? '+' : ''}{winner.liveRoi.toFixed(1)}% ROI</div>
                </div>
                {prizeAmt > 0 && <div style={{ fontSize: 10, color: col, fontWeight: 600 }}>Prize: {fmtPrize(prizeAmt)}</div>}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: si === 1 ? 155 : 125, height: heights[si], background: `linear-gradient(180deg,${col}22,${col}08)`, border: `1px solid ${col}30`, borderRadius: '8px 8px 0 0', paddingTop: 12 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: si === 1 ? 32 : 24, fontWeight: 900, color: col, textShadow: `0 0 18px ${col}` }}>{wi === 0 ? '1st' : wi === 1 ? '2nd' : '3rd'}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: 40, opacity: .3, marginBottom: 12 }}>🏆</div>
          <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 3 }}>{ev.status === 'upcoming' ? 'Competition Not Started' : 'Awaiting First Trades'}</div>
        </div>
      )}
      {winners.length > 0 && (
        <div style={{ display: 'flex', gap: 12, zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {([[fmtPrize(ev.prizePool), 'Prize Pool', CV.gold], [String(ev.currentParticipants || ev.participants.length), 'Traders', CV.teal], [String(ev.participants.reduce((s, p) => s + p.totalTrades, 0)), 'Total Trades', CV.blue], [isCompleted ? 'Ended' : 'Live', 'Status', isCompleted ? CV.gray : CV.red]] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ background: 'rgba(253,212,88,.06)', border: 'rgba(253,212,88,.18) solid 1px', borderRadius: 8, padding: '10px 18px', textAlign: 'center', minWidth: 110 }}>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 16, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN ARENA PAGE ──────────────────────────────────────────────────────────

export default function ArenaPage() {
  const [events,   setEvents]   = useState<AEvent[]>([]);
  const [prices,   setPrices]   = useState<PriceMap>({});
  const [stats,    setStats]    = useState<DashData['stats'] | null>(null);
  const [curEv,    setCurEv]    = useState<AEvent | null>(null);
  const [view,     setView]     = useState<'lobby' | 'live'>('lobby');
  const [scene,    setScene]    = useState<SceneKey>('overview');
  const [filter,   setFilter]   = useState('all');
  const [clock,    setClock]    = useState('--:--:--');
  const [timer,    setTimer]    = useState('—');
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selTrader,setSelTrader]= useState<{ p: Participant; ev: AEvent } | null>(null);

  const curEvRef = useRef<AEvent | null>(null);
  curEvRef.current = curEv;

  // ── CSS injection ──
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'cv-arena-css';
    el.textContent = `
      * { box-sizing: border-box; }
      @keyframes blink         { 0%,100%{opacity:1}50%{opacity:.3} }
      @keyframes shim          { 0%{transform:translateX(-200%)}100%{transform:translateX(200%)} }
      @keyframes tickS         { 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
      @keyframes fadeIn        { from{opacity:0}to{opacity:1} }
      @keyframes fall          { 0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
      @keyframes pokemonReveal { 0%{opacity:0;transform:scale(.72) rotateY(-18deg) translateY(20px)}60%{transform:scale(1.04) rotateY(3deg) translateY(-4px)}100%{opacity:1;transform:scale(1) rotateY(0) translateY(0)} }
      @keyframes holoShim      { 0%{background-position:200% 50%}100%{background-position:-200% 50%} }
      @keyframes dangerPulse   { 0%,100%{box-shadow:inset 0 0 40px rgba(255,73,91,.1);border-color:rgba(255,73,91,.4)}50%{box-shadow:inset 0 0 80px rgba(255,73,91,.22);border-color:rgba(255,73,91,.8)} }
      .rcrow:hover             { transform:translateX(3px); }
      .ev-card:hover           { transform:translateY(-3px);box-shadow:0 12px 36px rgba(0,0,0,.55),0 0 18px rgba(15,237,190,.06)!important;border-color:rgba(15,237,190,.12)!important; }
      .nav-on                  { color:${CV.teal}!important;border-color:${CV.teal}44!important;background:rgba(15,237,190,.08)!important; }
      .scn-on                  { color:${CV.teal}!important;background:rgba(15,237,190,.1)!important;border-color:${CV.teal}33!important; }
      .chip-on                 { color:${CV.teal}!important;border-color:${CV.teal}44!important;background:rgba(15,237,190,.07)!important; }
      .ebtn:hover              { background:rgba(15,237,190,.14)!important; }
      ::-webkit-scrollbar            { width:4px;height:4px; }
      ::-webkit-scrollbar-track      { background:${CV.bg1}; }
      ::-webkit-scrollbar-thumb      { background:${CV.bd2};border-radius:4px; }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // ── UTC clock ──
  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date();
      setClock(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Countdown ──
  useEffect(() => {
    if (!curEv) return;
    const iv = setInterval(() => {
      const now = Date.now();
      if (curEv.status === 'active' && curEv.endTime) {
        setTimer(fmtMs(Math.max(0, new Date(curEv.endTime).getTime() - now)));
      } else if (curEv.status === 'upcoming' && curEv.startTime) {
        const ms = new Date(curEv.startTime).getTime() - now;
        setTimer(ms > 0 ? fmtMs(ms) : 'Starting…');
      } else { setTimer('ENDED'); }
    }, 1000);
    return () => clearInterval(iv);
  }, [curEv]);

  // ── Data fetch ──
  const fetchD = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard/competitions', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok) { const txt = await r.text().catch(() => `HTTP ${r.status}`); setApiError(`API ${r.status}: ${txt.slice(0, 200)}`); setLoading(false); return; }
      const d: DashData & { error?: string } = await r.json();
      if (d.error) { setApiError(`API error: ${d.error}`); setLoading(false); return; }
      setApiError(null);
      const all: AEvent[] = [
        ...(d.competitions || []).map(c => ({ ...c, _et: 'competition' as string })),
        ...(d.challenges || []).map(c => ({ ...c, _et: 'challenge' as string })),
      ].sort((a, b) => {
        const o: Record<string, number> = { active: 0, pending: 1, upcoming: 1, accepted: 1, completed: 2 };
        const as = o[a.status] ?? 3, bs = o[b.status] ?? 3;
        return as !== bs ? as - bs : new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setEvents(all);
      if (d.prices && Object.keys(d.prices).length) {
        // Normalise keys: "EUR/USD" → "EURUSD" so lookups always work without slashes
        const norm: PriceMap = {};
        for (const [k, v] of Object.entries(d.prices)) norm[k.replace('/', '')] = v;
        setPrices(norm);
      }
      if (d.stats) setStats(d.stats);
      const cur = curEvRef.current;
      if (cur) { const up = all.find(e => e.id === cur.id); if (up) setCurEv(up); }
      setLoading(false);
    } catch (err) {
      setApiError(`Connection error: ${String(err)}`);
      setLoading(false);
    }
  }, []);

  // ── Polling — 5 s, paused when tab hidden ──
  useEffect(() => {
    fetchD();
    let iv: ReturnType<typeof setInterval> | null = setInterval(fetchD, 5000);
    const onVis = () => {
      if (document.hidden) { if (iv) { clearInterval(iv); iv = null; } }
      else { fetchD(); iv = setInterval(fetchD, 5000); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (iv) clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchD]);

  // ── Derived ──
  const filtered = useMemo(() => {
    let ev = events.slice();
    if (filter === 'competition') ev = ev.filter(e => e._et === 'competition');
    else if (filter === 'challenge') ev = ev.filter(e => e._et === 'challenge');
    else if (filter === 'active') ev = ev.filter(e => e.status === 'active');
    else if (filter === 'upcoming') ev = ev.filter(e => ['upcoming', 'pending', 'accepted'].includes(e.status));
    else if (filter === 'completed') ev = ev.filter(e => e.status === 'completed');
    return ev;
  }, [events, filter]);

  const racers  = useMemo(() => (curEv?.participants || []).filter(p => p.totalTrades > 0 && !p.isDisqualified), [curEv]);
  const waiting = useMemo(() => (curEv?.participants || []).filter(p => p.totalTrades === 0 && !p.isDisqualified), [curEv]);

  function enterEv(id: string) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    setCurEv(ev); setView('live');
    // Default scene based on event type/status
    if (ev.status === 'completed' && ev.winners?.length) setScene('podium');
    else if (ev._et === 'challenge') setScene('h2h');
    else setScene('overview');
  }

  const navBtn = (v: string, active: boolean, disabled: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: 2,
    textTransform: 'uppercase', padding: '5px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent', background: 'none', color: active ? CV.teal : disabled ? CV.bd2 : CV.gray,
    opacity: disabled ? 0.4 : 1, transition: 'all .2s',
  });
  const sceneBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
    textTransform: 'uppercase', padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
    border: `1px solid ${active ? CV.teal + '33' : 'transparent'}`,
    background: active ? 'rgba(15,237,190,.1)' : 'none',
    color: active ? CV.teal : CV.bd3, transition: 'all .2s',
  });
  const chipBtn = (f: string): React.CSSProperties => ({
    fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 1,
    textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${filter === f ? CV.teal + '44' : CV.bd1}`,
    background: filter === f ? 'rgba(15,237,190,.07)' : 'none',
    color: filter === f ? CV.teal : CV.bd3, transition: 'all .2s',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: CV.bg0, minHeight: '100vh', color: CV.txt, fontFamily: 'var(--font-geist-sans),sans-serif', overflow: 'hidden' }}>
      {/* Subtle scanlines */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.018) 2px,rgba(0,0,0,.018) 4px)' }} />

      {/* ── HEADER ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', height: 60, background: `linear-gradient(180deg,${CV.bg1},${CV.bg0})`, borderBottom: `1px solid ${CV.bd1}`, position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(14px)', boxShadow: `0 1px 0 0 ${CV.teal}18,0 4px 20px rgba(0,0,0,.4)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${CV.teal},${CV.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, fontWeight: 900, color: '#fff', boxShadow: `0 0 22px ${CV.teal}44` }}>CV</div>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: 3, background: `linear-gradient(90deg,${CV.teal},${CV.lgt} 60%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>CHARTVOLT</div>
            <div style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 9, color: CV.blue, letterSpacing: 5, textTransform: 'uppercase', marginTop: -1 }}>Trading Arena</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {([['lobby', 'Browse Events'], ['live', 'Live View']] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => { if (v === 'live' && !curEv) return; setView(v as 'lobby' | 'live'); }} className={view === v ? 'nav-on' : ''} style={navBtn(v, view === v, v === 'live' && !curEv)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 11, color: CV.gray, letterSpacing: 1 }}>{clock}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 700, color: CV.red, letterSpacing: 2, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 20, border: `1px solid ${CV.red}40`, background: 'rgba(255,73,91,.07)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CV.red, boxShadow: `0 0 8px ${CV.red}`, animation: 'blink 1s infinite' }} />LIVE
          </div>
        </div>
      </header>

      {/* ═══════════════════ LOBBY ═══════════════════ */}
      {view === 'lobby' && (
        <div style={{ padding: '20px 24px 80px', maxWidth: 1700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '28px 0 20px' }}>
            <h1 style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: 4, background: `linear-gradient(90deg,${CV.teal},${CV.blue},${CV.purp})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>Trading Arena</h1>
            <p style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 1 }}>Live competitions — real traders, real equity, live signals.</p>
          </div>
          {stats && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '14px 0 24px', flexWrap: 'wrap' }}>
              {([[stats.liveNow, 'Live Now', CV.red], [stats.upcoming, 'Starting Soon', CV.blue], [fmtPrize(stats.totalPrizePool), 'Total Prizes', CV.gold], [stats.activePlayers, 'Active Traders', CV.grn], [stats.openPositions, 'Open Positions', CV.oran]] as [string | number, string, string][]).map(([v, l, c]) => (
                <div key={l} style={{ textAlign: 'center', padding: '10px 22px', background: CV.bg2, border: `1px solid ${CV.bd1}`, borderRadius: 10, minWidth: 88 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['competition', 'Competitions'], ['challenge', 'Challenges'], ['active', 'Live'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'chip-on' : ''} style={chipBtn(f)}>{l}</button>
            ))}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: CV.bd3, letterSpacing: 2 }}>Loading competitions…</div>
          ) : apiError ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, opacity: .45 }}>⚠️</div>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.oran, letterSpacing: 3, marginTop: 14 }}>Connection Error</div>
              <div style={{ fontSize: 11, color: CV.bd3, marginTop: 8, maxWidth: 480, margin: '8px auto 0', wordBreak: 'break-all' }}>{apiError}</div>
              <button onClick={() => { setLoading(true); setApiError(null); fetchD(); }} style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: '7px 20px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${CV.teal}44`, background: `rgba(15,237,190,.08)`, color: CV.teal }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 42, opacity: .35 }}>🏁</div>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 13, color: CV.gray, letterSpacing: 3, marginTop: 14 }}>No Events Found</div>
              <button onClick={() => { setLoading(true); fetchD(); }} style={{ marginTop: 14, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 16px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${CV.bd2}`, background: 'none', color: CV.bd3 }}>Refresh</button>
            </div>
          ) : (
            Object.entries({ active: filtered.filter(e => e.status === 'active'), upcoming: filtered.filter(e => ['upcoming', 'pending', 'accepted'].includes(e.status)), completed: filtered.filter(e => e.status === 'completed') }).filter(([, items]) => items.length > 0).map(([st, items]) => (
              <div key={st}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 10px' }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 9, fontWeight: 600, color: st === 'active' ? CV.red : st === 'upcoming' ? CV.blue : CV.gray, letterSpacing: 4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 7 }}>
                    {st === 'active' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />}
                    {st === 'active' ? 'Live Now' : st === 'upcoming' ? 'Starting Soon' : 'Completed'}
                  </div>
                  <div style={{ fontSize: 11, color: CV.bd3 }}>{items.length} event{items.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 12 }}>
                  {items.map(ev => <EventCard key={ev.id} ev={ev} onEnter={enterEv} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════ LIVE VIEW ═══════════════════ */}
      {view === 'live' && curEv && (
        <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Event top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px', background: CV.bg1, borderBottom: `1px solid ${CV.bd1}`, flexShrink: 0 }}>
            <button onClick={() => { setView('lobby'); setCurEv(null); }} style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: 1, color: CV.gray, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 10px', borderRadius: 6 }}>← Lobby</button>
            <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 12, fontWeight: 700, color: CV.gold, letterSpacing: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: `0 0 18px ${CV.gold}44` }}>🏆 {curEv.name.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {curEv.status === 'active' && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: CV.red, letterSpacing: 2, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, border: `1px solid ${CV.red}33`, background: 'rgba(255,73,91,.07)' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />LIVE</div>}
              <div style={{ padding: '3px 12px', borderRadius: 6, textAlign: 'center', background: 'rgba(253,212,88,.06)', border: `1px solid ${CV.gold}30` }}>
                <div style={{ fontSize: 6, color: CV.gol2, letterSpacing: 2, textTransform: 'uppercase' }}>Prize Pool</div>
                <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 14, fontWeight: 700, color: CV.gold, textShadow: `0 0 12px ${CV.gold}40` }}>{fmtPrize(curEv.prizePool)}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 20, fontWeight: 700, color: CV.teal, textShadow: `0 0 16px ${CV.teal}44`, letterSpacing: 2, minWidth: 80, textAlign: 'right' }}>{timer}</div>
            </div>
          </div>

          {/* Ticker */}
          <Ticker prices={prices} events={events} />

          {/* Info bar */}
          <div style={{ background: 'rgba(15,237,190,.02)', borderBottom: `1px solid ${CV.bd0}`, padding: '3px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase' }}>Ranking by</span>
            <span style={{ fontFamily: 'var(--font-geist-sans),sans-serif', fontSize: 11, fontWeight: 700, color: CV.teal, letterSpacing: 1 }}>{rmLabel(curEv.rankingMethod || 'pnl')}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-geist-mono),sans-serif', fontSize: 7, color: CV.bd2, letterSpacing: 2 }}>
              {curEv.participants.length} TRADERS · {curEv.openPositions.length} OPEN
            </span>
          </div>

          {/* Scene Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 16px', background: CV.bg1, borderBottom: `1px solid ${CV.bd1}`, flexShrink: 0 }}>
            {([
              ['overview',  '📊 Overview'],
              ['race',      '🏁 Race'],
              ['spotlight', '🔦 Spotlight'],
              ['h2h',       '⚔️ Head to Head'],
              ['danger',    '⚠️ Danger Zone'],
              ['podium',    '🏆 Podium'],
            ] as [SceneKey, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setScene(k)} className={scene === k ? 'scn-on' : ''} style={sceneBtn(scene === k)}>{l}</button>
            ))}
          </div>

          {/* Scene Body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── OVERVIEW ── */}
            {scene === 'overview' && <OverviewScene ev={curEv} prices={prices} onTrader={p => setSelTrader({ p, ev: curEv })} />}

            {/* ── RACE ── */}
            {scene === 'race' && <RaceLineChart ev={curEv} />}

            {/* ── SPOTLIGHT ── */}
            {scene === 'spotlight' && <SpotlightScene ev={curEv} onTrader={p => setSelTrader({ p, ev: curEv })} />}

            {/* ── HEAD TO HEAD ── */}
            {scene === 'h2h' && <H2HScene ev={curEv} onTrader={p => setSelTrader({ p, ev: curEv })} />}

            {/* ── DANGER ZONE ── */}
            {scene === 'danger' && <DangerScene ev={curEv} onTrader={p => setSelTrader({ p, ev: curEv })} />}

            {/* ── PODIUM ── */}
            {scene === 'podium' && <PodiumScene ev={curEv} onTrader={p => setSelTrader({ p, ev: curEv })} />}
          </div>
        </div>
      )}

      {/* ── Trader Modal ── */}
      {selTrader && <TraderModal p={selTrader.p} ev={selTrader.ev} onClose={() => setSelTrader(null)} />}
    </div>
  );
}
