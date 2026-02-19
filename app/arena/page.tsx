'use client';
/**
 * /arena — Chartvolt Live Trading Arena
 * Casino-quality competition display — Chartvolt brand identity.
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
interface DashData {
  competitions: AEvent[]; challenges: AEvent[];
  prices: Record<string, { bid: number; ask: number; mid: number }>;
  stats: { liveNow: number; upcoming: number; totalPrizePool: number; activePlayers: number; openPositions: number };
}

// ─── Chartvolt Brand Palette ──────────────────────────────────────────────────

const CV = {
  // Backgrounds
  bg0: '#030305',
  bg1: '#07070d',
  bg2: '#0d0f18',
  bg3: '#131520',
  bg4: '#191c28',
  bg5: '#1e2132',
  // Borders
  bd0: '#191c28',
  bd1: '#252838',
  bd2: '#2e3148',
  bd3: '#3a3e55',
  // Chartvolt Brand Colors
  teal: '#0FEDBE',   // primary accent
  blue: '#5862FF',   // secondary accent
  gold: '#FDD458',   // leader / prizes
  gol2: '#E8BA40',   // darker gold
  red:  '#FF495B',   // live / negative
  oran: '#FF8243',   // 3rd place / warnings
  purp: '#D13BFF',   // premium / top-10
  // Text
  gray: '#9095A1',
  lgt:  '#CCDADC',
  txt:  '#e4e8f0',
  // Semantic
  grn:  '#22c55e',
} as const;

// ─── Derived Constants ────────────────────────────────────────────────────────

const RANK_COLORS = [CV.gold, '#C0C0C0', CV.oran] as const;
const RANK_GLOW   = [
  'rgba(253,212,88,.28)',
  'rgba(192,192,192,.14)',
  'rgba(255,130,67,.16)',
] as const;

const BAR_FILLS = [
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

const AV_GRADS = [
  `#0a0d1e,${CV.blue}`,
  `#050e12,${CV.teal}`,
  `#120618,${CV.purp}`,
  `#081808,${CV.grn}`,
  `#1a0508,${CV.red}`,
  `#0a0a1e,${CV.blue}`,
  `#150c02,${CV.oran}`,
];

// ─── Tier Config (Pokémon-card style) ─────────────────────────────────────────

const TIER_CFG = {
  champion: {
    border: CV.gold,
    header: `linear-gradient(135deg,#1a1200 0%,rgba(253,212,88,.22) 100%)`,
    tag: 'rgba(253,212,88,.15)', tagColor: CV.gold, tagLabel: 'Champion',
    glow: 'rgba(253,212,88,.3)',
  },
  elite: {
    border: CV.purp,
    header: `linear-gradient(135deg,#12081a 0%,rgba(209,59,255,.2) 100%)`,
    tag: 'rgba(209,59,255,.15)', tagColor: CV.purp, tagLabel: 'Elite',
    glow: 'rgba(209,59,255,.25)',
  },
  veteran: {
    border: CV.blue,
    header: `linear-gradient(135deg,#080e22 0%,rgba(88,98,255,.2) 100%)`,
    tag: 'rgba(88,98,255,.15)', tagColor: CV.blue, tagLabel: 'Veteran',
    glow: 'rgba(88,98,255,.22)',
  },
  trader: {
    border: CV.bd3,
    header: `linear-gradient(135deg,${CV.bg2} 0%,${CV.bg3} 100%)`,
    tag: 'rgba(144,149,161,.1)', tagColor: CV.gray, tagLabel: 'Trader',
    glow: 'rgba(0,0,0,0)',
  },
};
const getTier = (rank: number) =>
  rank <= 3 ? TIER_CFG.champion : rank <= 10 ? TIER_CFG.elite : rank <= 50 ? TIER_CFG.veteran : TIER_CFG.trader;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avColor = (u: string) => {
  let h = 0;
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg,${AV_GRADS[h % AV_GRADS.length]})`;
};
const ini       = (u: string) => (u || '?').split(/[\s_-]+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
const pad       = (n: number) => String(n).padStart(2, '0');
const fmtMs     = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
const fmtAbs    = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1000 ? `$${(a / 1000).toFixed(1)}K` : `$${a.toFixed(0)}`; };
const fmtC      = (v: number) => (v < 0 ? '-' : '') + fmtAbs(v);
const fmtPnl    = (v: number) => (v >= 0 ? '+' : '') + fmtC(v);
const fmtPrize  = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v || 0}`;
const tAgo      = (d: string) => { const df = Date.now() - new Date(d).getTime(); if (df < 60000) return 'now'; if (df < 3600000) return `${Math.floor(df / 60000)}m`; return `${Math.floor(df / 3600000)}h`; };

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
const rmLabel   = (rm: string) =>
  ({ roi: 'ROI %', win_rate: 'Win Rate', total_capital: 'Total Equity', equity: 'Total Equity' }[rm] ?? 'PnL');

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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Av({ u, img, sz = 36, ring }: { u: string; img: string | null; sz?: number; ring?: string }) {
  const [err, setErr] = useState(false);
  const bg = avColor(u);
  const base: React.CSSProperties = {
    width: sz, height: sz, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(sz * 0.38), fontWeight: 700, fontFamily: "var(--font-geist-sans),sans-serif",
    ...(ring ? { outline: `2px solid ${ring}`, outlineOffset: 2, boxShadow: `0 0 10px ${ring}66` } : {}),
  };
  if (img && !err) {
    return (
      <div style={{ ...base, background: bg }}>
        <img src={img} onError={() => setErr(true)} alt={u}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      </div>
    );
  }
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
  const rm       = ev.rankingMethod || 'pnl';
  const prog     = calcRaceProgress(p, rm, ev.participants);
  const isLeader = idx === 0;
  const rkColor  = idx < 3 ? RANK_COLORS[idx] : idx < 7 ? CV.blue : CV.gray;
  const barFill  = BAR_FILLS[Math.min(idx, BAR_FILLS.length - 1)];
  const pnlPos   = p.livePnl >= 0;

  return (
    <div
      onClick={onClick}
      className="rcrow"
      style={{
        display: 'flex', alignItems: 'stretch', height: 82, borderRadius: 10, overflow: 'hidden',
        background: idx < 3 ? ROW_BG[idx] : `linear-gradient(100deg,rgba(88,98,255,.03),${CV.bg2} 60%)`,
        border: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '38' : idx < 7 ? CV.bd2 : CV.bd1}`,
        boxShadow: isLeader
          ? `0 0 36px ${RANK_GLOW[0]}, 0 0 0 1px rgba(253,212,88,.07), inset 0 1px 0 rgba(253,212,88,.07)`
          : idx < 3 ? `0 2px 14px ${RANK_GLOW[idx]}`
          : idx < 7 ? `0 1px 5px rgba(88,98,255,.07)` : 'none',
        cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
        position: 'relative',
      }}
    >
      {/* Leader shimmer sweep */}
      {isLeader && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'linear-gradient(100deg,transparent 35%,rgba(253,212,88,.03) 65%,transparent 90%)',
          animation: 'shim 3.2s linear infinite',
        }} />
      )}

      {/* ── Rank badge ── */}
      <div style={{
        width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        background: idx < 3 ? RANK_BG[idx] : `rgba(255,255,255,.012)`,
        borderRight: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '28' : CV.bd0}`,
        position: 'relative', zIndex: 1,
      }}>
        {idx < 3 ? (
          <>
            <div style={{ fontSize: 18, filter: `drop-shadow(0 0 7px ${RANK_COLORS[idx]})` }}>{MEDAL[idx]}</div>
            <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 700, color: RANK_COLORS[idx], letterSpacing: 1 }}>#{p.rank}</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 17, fontWeight: 900, color: rkColor, textShadow: idx < 7 ? `0 0 10px ${CV.blue}88` : 'none', lineHeight: 1 }}>{p.rank}</div>
            <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 6, fontWeight: 600, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase' }}>RANK</div>
          </>
        )}
      </div>

      {/* ── Avatar + name ── */}
      <div style={{
        width: 196, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', overflow: 'hidden', position: 'relative', zIndex: 1,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isLeader && (
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 13, filter: `drop-shadow(0 0 6px ${CV.gold})`, zIndex: 5 }}>👑</div>
          )}
          <Av u={p.username} img={p.profileImage} sz={44} ring={idx < 3 ? RANK_COLORS[idx] : idx < 7 ? CV.blue + '88' : undefined} />
          {(p.currentOpenPositions || 0) > 0 && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%',
              background: CV.oran, border: `2px solid ${CV.bg1}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 900, color: '#fff',
            }}>{p.currentOpenPositions}</div>
          )}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 13, fontWeight: 700, color: CV.lgt,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2,
          }}>{p.username}</div>
          <div style={{
            fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3,
            color: CV.bd3, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ color: isLeader ? CV.gold + 'aa' : CV.bd2 }}>●</span>
            {p.totalTrades} trade{p.totalTrades !== 1 ? 's' : ''}
            {p.currentOpenPositions > 0 && <span style={{ color: CV.oran + 'aa' }}>· {p.currentOpenPositions} OPEN</span>}
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 14px', position: 'relative', zIndex: 1 }}>
        <div style={{
          flex: 1, position: 'relative', height: 34, background: CV.bd0,
          borderRadius: 17, overflow: 'hidden', border: `1px solid ${CV.bd1}`,
        }}>
          <div style={{
            position: 'absolute', top: 1.5, bottom: 1.5, left: 1.5, borderRadius: 15,
            width: `calc(${prog}% - 3px)`, background: barFill, minWidth: 38,
            transition: 'width 2s cubic-bezier(.4,0,.2,1)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 36,
          }}>
            <span style={{
              fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 8, fontWeight: 700,
              color: 'rgba(255,255,255,.88)', textShadow: '0 1px 4px rgba(0,0,0,.9)',
              whiteSpace: 'nowrap', position: 'relative', zIndex: 3,
            }}>{raceLabel(p, rm)}</span>
            <div style={{
              position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 0 8px rgba(0,0,0,.9)', zIndex: 4,
            }}>
              <Av u={p.username} img={p.profileImage} sz={28} />
            </div>
          </div>
          {isLeader && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
              background: `linear-gradient(90deg,transparent 30%,rgba(253,212,88,.07) 58%,transparent 80%)`,
              animation: 'shim 2.4s linear infinite',
            }} />
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{
        width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px', gap: 2,
        borderLeft: `1px solid ${CV.bd0}`, position: 'relative', zIndex: 1,
      }}>
        <div style={{
          fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 14, fontWeight: 700,
          color: CV.teal, textShadow: `0 0 12px ${CV.teal}50`, letterSpacing: .5,
        }}>{fmtC(p.liveEquity)}</div>
        <div style={{
          fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 700,
          color: pnlPos ? CV.grn : CV.red, textShadow: `0 0 8px ${pnlPos ? CV.grn : CV.red}40`,
        }}>{fmtPnl(p.livePnl)}</div>
        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 9, color: CV.bd3, fontWeight: 600, letterSpacing: .5 }}>
          {p.liveRoi >= 0 ? '+' : ''}{p.liveRoi.toFixed(1)}%
          <span style={{ color: CV.bd2, margin: '0 3px' }}>·</span>
          {p.winRate.toFixed(0)}% WR
        </div>
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
      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 700, color: c || CV.lgt, marginBottom: 2 }}>{v}</div>
      <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase' }}>{l}</div>
    </div>
  );

  const AttRow = ({ icon, label, color, children }: { icon: string; label: string; color: string; children: React.ReactNode }) => (
    <div style={{ margin: '0 12px 8px', background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: CV.bg4, borderBottom: `1px solid ${CV.bd0}` }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 700, color, letterSpacing: 3, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ display: 'flex' }}>{children}</div>
    </div>
  );

  const Sep = () => <div style={{ width: 1, background: CV.bd1, flexShrink: 0 }} />;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 500,
        backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', overflowY: 'auto', padding: '24px 16px 40px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 380, animation: 'pokemonReveal .38s cubic-bezier(.34,1.56,.64,1)', perspective: '1000px' }}>

        {/* ── Card ── */}
        <div style={{
          border: `6px solid ${tier.border}`, borderRadius: 20, overflow: 'hidden',
          background: `linear-gradient(135deg,${CV.bg3} 0%,${CV.bg2} 100%)`,
          boxShadow: `0 0 55px ${tier.glow}, 0 0 0 1px rgba(255,255,255,.04), 0 28px 80px rgba(0,0,0,.92)`,
          position: 'relative',
        }}>

          {/* Holo shimmer for top-10 */}
          {p.rank <= 10 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
              background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,.09) 42%,rgba(255,255,255,.05) 46%,transparent 52%)',
              backgroundSize: '200% 200%', animation: 'holoShim 2.8s linear infinite',
            }} />
          )}

          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 10, right: 10, zIndex: 30,
            width: 28, height: 28, borderRadius: '50%',
            background: CV.bg4, border: `1px solid ${CV.bd2}`,
            cursor: 'pointer', color: CV.gray, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>✕</button>

          {/* ── Top bar ── */}
          <div style={{ padding: '12px 14px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{
                fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2,
                padding: '2px 9px', borderRadius: 4,
                background: tier.tag, color: tier.tagColor, border: `1px solid ${tier.border}44`,
              }}>{tier.tagLabel}</span>
              {p.isDisqualified && (
                <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, color: CV.red, letterSpacing: 1 }}>⚡ LIQUIDATED</span>
              )}
              {!p.isDisqualified && p.totalTrades > 0 && (
                <span style={{
                  fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2,
                  padding: '2px 7px', borderRadius: 4, color: CV.grn,
                  background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.22)',
                }}>ACTIVE</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 24, fontWeight: 700, color: CV.lgt, lineHeight: 1 }}>{p.username}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 2 }}>
                <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 9, color: CV.bd3, letterSpacing: 1 }}>RANK</span>
                <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 22, fontWeight: 900, color: tier.tagColor, textShadow: `0 0 16px ${tier.border}66`, lineHeight: 1 }}>#{p.rank}</span>
                {p.rank === 1 && <span style={{ fontSize: 18, lineHeight: 1 }}>🥇</span>}
                {p.rank === 2 && <span style={{ fontSize: 18, lineHeight: 1 }}>🥈</span>}
                {p.rank === 3 && <span style={{ fontSize: 18, lineHeight: 1 }}>🥉</span>}
              </div>
            </div>
          </div>

          {/* ── Avatar frame ── */}
          <div style={{ margin: '0 12px 0', border: `2px solid ${tier.border}`, borderRadius: 12, background: tier.header, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: .1, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.9) 1.5px,transparent 1.5px)', backgroundSize: '18px 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 0 18px', position: 'relative', zIndex: 2 }}>
              <Av u={p.username} img={p.profileImage} sz={96} ring={tier.border} />
            </div>
          </div>

          {/* PnL color bar */}
          <div style={{ height: 3, margin: '10px 12px 8px', borderRadius: 2, background: p.livePnl >= 0 ? `linear-gradient(90deg,${CV.grn},${CV.teal})` : `linear-gradient(90deg,${CV.red},${CV.oran})` }} />

          <AttRow icon="📊" label="Live Trading Stats" color={CV.teal}>
            <SCell v={p.totalTrades > 0 ? fmtPnl(p.livePnl) : '—'} l="Live PnL" c={p.livePnl >= 0 ? CV.grn : CV.red} />
            <Sep />
            <SCell v={fmtC(p.liveEquity)} l="Live Equity" c={CV.teal} />
            <Sep />
            <SCell v={p.totalTrades > 0 ? `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(2)}%` : '—'} l="ROI" c={p.liveRoi >= 0 ? CV.grn : CV.red} />
          </AttRow>

          <AttRow icon="⚔️" label="Battle Record" color={CV.gold}>
            <SCell v={p.totalTrades > 0 ? `${p.winRate.toFixed(1)}%` : '—'} l="Win Rate" c={CV.purp} />
            <Sep />
            <SCell v={`${p.winningTrades}/${p.totalTrades}`} l="W / Trades" c={CV.grn} />
            <Sep />
            <SCell v={p.profitFactor > 0 ? p.profitFactor.toFixed(2) : '—'} l="Prof. Factor" c={CV.gold} />
          </AttRow>

          <AttRow icon="🛡️" label="Risk Metrics" color={CV.oran}>
            <SCell v={`${p.maxDrawdownPercentage.toFixed(1)}%`} l="Max DD" c={CV.oran} />
            <Sep />
            <SCell v={String(p.currentOpenPositions || 0)} l="Open Pos" c={CV.teal} />
            <Sep />
            <SCell v={`${winProb}%`} l="Win Prob" c={winProb >= 60 ? CV.grn : winProb >= 40 ? CV.gold : CV.oran} />
          </AttRow>

          {/* Open Positions */}
          {myPos.length > 0 && (
            <div style={{ margin: '0 12px 8px' }}>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, padding: '0 2px' }}>Open Positions ({myPos.length})</div>
              <div style={{ background: CV.bg3, borderRadius: 8, border: `1px solid ${CV.bd1}`, overflow: 'hidden' }}>
                {myPos.map((pos, i) => {
                  const isL = pos.side === 'long';
                  const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 44px 80px 72px 1fr', gap: 5, alignItems: 'center', padding: '7px 10px', borderBottom: i < myPos.length - 1 ? `1px solid ${CV.bd0}` : 'none' }}>
                      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 10, fontWeight: 700, color: CV.teal }}>{(pos.symbol || '').replace('/', '')}</div>
                      <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 3, letterSpacing: 1, textAlign: 'center', color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.12)' : 'rgba(255,73,91,.1)', border: `1px solid ${isL ? 'rgba(34,197,94,.25)' : 'rgba(255,73,91,.25)'}` }}>{isL ? 'BUY' : 'SELL'}</span>
                      <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, color: CV.bd3 }}>{pos.entryPrice.toFixed(dec)}</div>
                      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 10, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{fmtC(Math.abs(pos.unrealizedPnl))}</div>
                      <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 9, color: CV.bd3 }}>{tAgo(pos.openedAt)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom stats bar */}
          <div style={{ display: 'flex', margin: '0 12px 10px', background: CV.bg3, border: `1px solid ${CV.bd1}`, borderRadius: 8, overflow: 'hidden', textAlign: 'center' }}>
            {([
              [String(p.totalTrades), 'Trades', CV.gold],
              [`$${p.averageWin > 0 ? p.averageWin.toFixed(0) : '—'}`, 'Avg Win', CV.grn],
              [`$${p.averageLoss > 0 ? p.averageLoss.toFixed(0) : '—'}`, 'Avg Loss', CV.red],
            ] as [string, string, string][]).map(([v, l, c], i, arr) => (
              <div key={l} style={{ flex: 1, padding: '8px 4px', borderRight: i < arr.length - 1 ? `1px solid ${CV.bd1}` : 'none' }}>
                <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 10, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 9px' }}>
            <span style={{ fontSize: 7, color: CV.bd1, fontFamily: "var(--font-geist-sans),sans-serif" }}>Chartvolt Trader Card</span>
            <span style={{ fontSize: 7, color: CV.bd1, fontFamily: 'monospace' }}>{(p.userId || '').slice(-8) || 'cv-arena'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Winners Podium ───────────────────────────────────────────────────────────

function Podium({ ev, onClose }: { ev: AEvent; onClose: () => void }) {
  const w = ev.winners || [];
  const order = [1, 0, 2];
  const heights = [80, 114, 68];
  const medals = ['🥈', '🥇', '🥉'];
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.97)', zIndex: 600,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .5s ease',
    }}>
      {/* Confetti */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 55 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: -12, left: `${(i * 1.85) % 100}%`,
            width: i % 3 === 0 ? 6 : 4, height: i % 3 === 0 ? 6 : 4,
            background: [CV.gold, CV.teal, CV.purp, CV.grn, CV.oran, '#fff'][i % 6],
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            animation: `fall ${2.5 + (i % 5) * 0.5}s ${(i % 7) * 0.4}s linear infinite`,
          }} />
        ))}
      </div>

      <div style={{
        fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 6,
        background: `linear-gradient(90deg,${CV.gold},${CV.oran},${CV.gold})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        marginBottom: 6,
      }}>🏆 FINAL RESULTS</div>
      <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 13, color: CV.gray, letterSpacing: 2, marginBottom: 40 }}>{ev.name}</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
        {order.map((wi, si) => {
          const winner = w[wi];
          if (!winner) return null;
          const col = RANK_COLORS[wi] || CV.bd3;
          const prizeEntry = ev.prizeDistribution.find(d => d.rank === wi + 1);
          const prizeAmt = prizeEntry ? Math.floor((ev.prizePool || 0) * prizeEntry.percentage / 100) : 0;
          return (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 22 }}>{medals[si]}</div>
              <Av u={winner.username} img={winner.profileImage} sz={si === 1 ? 80 : 60} ring={col} />
              <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 14, fontWeight: 700, color: CV.lgt }}>{winner.username}</div>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, fontWeight: 700, color: winner.livePnl >= 0 ? CV.grn : CV.red }}>{fmtPnl(winner.livePnl)}</div>
              {prizeAmt > 0 && <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: col, fontWeight: 600 }}>Prize: {fmtPrize(prizeAmt)}</div>}
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                width: si === 1 ? 100 : 80, height: heights[si],
                background: `linear-gradient(180deg,${col}22,${col}08)`,
                border: `1px solid ${col}30`, borderRadius: '8px 8px 0 0',
              }}>
                <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: si === 1 ? 28 : 20, fontWeight: 900, color: col, paddingBottom: 8, textShadow: `0 0 18px ${col}` }}>
                  {wi === 0 ? '1st' : wi === 1 ? '2nd' : '3rd'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        style={{
          fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2,
          textTransform: 'uppercase', padding: '8px 24px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${CV.bd2}`, background: CV.bg3, color: CV.gray,
        }}
      >Close</button>
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
  const topLine = isLiveEv
    ? `linear-gradient(90deg,${CV.red},${CV.oran})`
    : isUpcomingEv
      ? isComp ? `linear-gradient(90deg,${CV.purp},${CV.blue})` : `linear-gradient(90deg,${CV.gold},${CV.oran})`
      : `linear-gradient(90deg,${CV.bd2},${CV.bg3})`;

  return (
    <div
      className="ev-card"
      onClick={() => canClick && onEnter(ev.id)}
      style={{
        background: CV.bg2, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${ev.status === 'active' ? CV.red + '20' : CV.bd1}`,
        cursor: canClick ? 'pointer' : 'default',
        boxShadow: ev.status === 'active' ? `0 0 22px rgba(255,73,91,.05)` : 'none',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Status line */}
      <div style={{ height: 3, background: topLine }} />

      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* Type badge */}
          <span style={{
            fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
            color: isComp ? CV.teal : CV.gold,
            background: isComp ? `rgba(15,237,190,.07)` : `rgba(253,212,88,.07)`,
            border: `1px solid ${isComp ? CV.teal + '22' : CV.gold + '22'}`,
          }}>{isComp ? 'Competition' : 'Challenge'}</span>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: statusColor }}>
            {isLiveEv && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />
            )}
            {isLiveEv ? 'LIVE' : isUpcomingEv ? 'UPCOMING' : 'ENDED'}
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 17, fontWeight: 700, color: CV.lgt, marginBottom: 4, lineHeight: 1.2 }}>{ev.name}</div>
        <div style={{ fontSize: 10, color: CV.bd3, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineClamp: 2 }}>{ev.description}</div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
          {([
            [fmtPrize(ev.prizePool), 'Prize', CV.gold],
            [`${ev.currentParticipants}/${ev.maxParticipants || '∞'}`, 'Players', CV.teal],
            [td, tl, ev.status === 'active' ? CV.red : CV.gray],
          ] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '6px 3px', background: CV.bg3, borderRadius: 6, border: `1px solid ${CV.bd0}` }}>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 700, color: c, marginBottom: 1 }}>{v}</div>
              <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTop: `1px solid ${CV.bd0}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {parts.slice(0, 4).map((p, i) => (
              <div key={p.userId} style={{ marginLeft: i === 0 ? 0 : -5, zIndex: 10 - i, position: 'relative' }}>
                <Av u={p.username} img={p.profileImage} sz={24} ring={CV.bd3} />
              </div>
            ))}
            {(ev.currentParticipants || 0) > 4 && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', marginLeft: -5, background: CV.bg4, border: `1px solid ${CV.bd2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 8, fontWeight: 700, color: CV.gray }}>
                +{ev.currentParticipants - 4}
              </div>
            )}
          </div>
          {ev.status === 'active' ? (
            <button
              onClick={e => { e.stopPropagation(); onEnter(ev.id); }}
              className="ebtn"
              style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${CV.teal}44`, background: `rgba(15,237,190,.08)`, color: CV.teal, transition: 'all .2s' }}
            >Watch Live</button>
          ) : winner ? (
            <span style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, color: CV.gold }}>🏆 {winner.username}</span>
          ) : null}
        </div>

        {winner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: `rgba(253,212,88,.04)`, borderTop: `1px solid rgba(253,212,88,.1)`, marginTop: 10, fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: CV.gold }}>
            🏆 Winner: <strong>{winner.username}</strong> · {fmtPnl(winner.livePnl)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

function Ticker({ prices, events }: { prices: Record<string, { bid: number; ask: number; mid: number }>; events: AEvent[] }) {
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
        <span style={{ color: dir === 1 ? CV.grn : dir === -1 ? CV.red : CV.gray }}>
          {dir === 1 ? '▲' : dir === -1 ? '▼' : ''} {p.mid.toFixed(dec)}
        </span>
        {p.bid && p.ask && (
          <span style={{ color: CV.bd2, fontSize: 9 }}>sp:{((p.ask - p.bid) * Math.pow(10, dec)).toFixed(1)}</span>
        )}
      </span>
    );
  }).filter(Boolean);

  if (!chunks.length) {
    return (
      <div style={{ background: `rgba(15,237,190,.02)`, borderBottom: `1px solid ${CV.bd0}`, padding: '5px 16px', fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: CV.bd3, letterSpacing: 1, flexShrink: 0 }}>
        CHARTVOLT ARENA — Market data initialising…
      </div>
    );
  }
  return (
    <div style={{ background: `rgba(15,237,190,.02)`, borderBottom: `1px solid ${CV.bd0}`, padding: '4px 0', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'inline-flex', gap: 38, animation: 'tickS 38s linear infinite', fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 500, color: CV.gray, paddingLeft: 20 }}>
        {[...chunks, ...chunks]}
      </div>
    </div>
  );
}

// ─── MAIN ARENA PAGE ──────────────────────────────────────────────────────────

export default function ArenaPage() {
  const [events,     setEvents]     = useState<AEvent[]>([]);
  const [prices,     setPrices]     = useState<Record<string, { bid: number; ask: number; mid: number }>>({});
  const [stats,      setStats]      = useState<DashData['stats'] | null>(null);
  const [curEv,      setCurEv]      = useState<AEvent | null>(null);
  const [view,       setView]       = useState<'lobby' | 'live'>('lobby');
  const [tab,        setTab]        = useState<'race' | 'board' | 'trades'>('race');
  const [filter,     setFilter]     = useState('all');
  const [clock,      setClock]      = useState('--:--:--');
  const [timer,      setTimer]      = useState('—');
  const [loading,    setLoading]    = useState(true);
  const [apiError,   setApiError]   = useState<string | null>(null);
  const [selTrader,  setSelTrader]  = useState<{ p: Participant; ev: AEvent } | null>(null);
  const [showPodium, setShowPodium] = useState(false);

  const curEvRef = useRef<AEvent | null>(null);
  curEvRef.current = curEv;

  // ── CSS injection ──
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'cv-arena-css';
    el.textContent = `
      /* Geist Sans + Geist Mono loaded by Next.js layout — no external font import needed */

      * { box-sizing: border-box; }

      @keyframes blink         { 0%,100%{opacity:1}50%{opacity:.3} }
      @keyframes shim          { 0%{transform:translateX(-200%)}100%{transform:translateX(200%)} }
      @keyframes tickS         { 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
      @keyframes fadeIn        { from{opacity:0}to{opacity:1} }
      @keyframes fall          { 0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
      @keyframes pokemonReveal { 0%{opacity:0;transform:scale(.72) rotateY(-18deg) translateY(20px)}60%{transform:scale(1.04) rotateY(3deg) translateY(-4px)}100%{opacity:1;transform:scale(1) rotateY(0deg) translateY(0)} }
      @keyframes holoShim      { 0%{background-position:200% 50%}100%{background-position:-200% 50%} }
      @keyframes pulseRing     { 0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)} }
      @keyframes slideUp       { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }

      .rcrow:hover        { transform:translateX(3px); }
      .rcrow:hover > div  { }
      .ev-card:hover      { transform:translateY(-3px);box-shadow:0 12px 36px rgba(0,0,0,.55),0 0 18px rgba(15,237,190,.06)!important;border-color:rgba(15,237,190,.12)!important; }
      .nav-on             { color:${CV.teal}!important;border-color:${CV.teal}44!important;background:rgba(15,237,190,.08)!important; }
      .tab-on             { color:${CV.teal}!important;background:rgba(15,237,190,.1)!important;border-color:${CV.teal}33!important; }
      .chip-on            { color:${CV.teal}!important;border-color:${CV.teal}44!important;background:rgba(15,237,190,.07)!important; }
      .ebtn:hover         { background:rgba(15,237,190,.14)!important; }

      ::-webkit-scrollbar            { width:4px;height:4px; }
      ::-webkit-scrollbar-track      { background:${CV.bg1}; }
      ::-webkit-scrollbar-thumb      { background:${CV.bd2};border-radius:4px; }
      ::-webkit-scrollbar-thumb:hover{ background:${CV.bd3}; }
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
      const r = await fetch('/api/dashboard/competitions', {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => `HTTP ${r.status}`);
        setApiError(`API returned ${r.status}: ${txt.slice(0, 200)}`);
        setLoading(false);
        return;
      }
      const d: DashData & { error?: string } = await r.json();
      if (d.error) {
        setApiError(`API error: ${d.error}`);
        setLoading(false);
        return;
      }
      setApiError(null);
      const all: AEvent[] = [
        ...(d.competitions || []).map(c => ({ ...c, _et: 'competition' as string })),
        ...(d.challenges   || []).map(c => ({ ...c, _et: 'challenge'   as string })),
      ].sort((a, b) => {
        const o: Record<string, number> = { active: 0, pending: 1, upcoming: 1, accepted: 1, completed: 2 };
        const as = o[a.status] ?? 3, bs = o[b.status] ?? 3;
        return as !== bs ? as - bs : new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setEvents(all);
      if (d.prices && Object.keys(d.prices).length) setPrices(d.prices);
      if (d.stats) setStats(d.stats);
      const cur = curEvRef.current;
      if (cur) { const up = all.find(e => e.id === cur.id); if (up) setCurEv(up); }
      setLoading(false);
    } catch (err) {
      setApiError(`Connection error: ${String(err)}`);
      setLoading(false);
    }
  }, []);

  // ── Polling ──
  useEffect(() => {
    fetchD();
    const ms = view === 'live' ? 5000 : 10000;
    const iv = setInterval(fetchD, ms);
    return () => clearInterval(iv);
  }, [view, fetchD]);

  // ── Derived ──
  const filtered = useMemo(() => {
    let ev = events.slice();
    if (filter === 'competition') ev = ev.filter(e => e._et === 'competition');
    else if (filter === 'challenge') ev = ev.filter(e => e._et === 'challenge');
    else if (filter === 'active') ev = ev.filter(e => e.status === 'active');
    else if (filter === 'upcoming') ev = ev.filter(e => e.status === 'upcoming');
    else if (filter === 'completed') ev = ev.filter(e => e.status === 'completed');
    return ev;
  }, [events, filter]);

  const sideStats = useMemo(() => {
    if (!curEv) return null;
    const p = curEv.participants || [];
    return {
      total:   p.reduce((s, x) => s + (x.totalTrades || 0), 0),
      avgWR:   p.length ? p.reduce((s, x) => s + (x.winRate || 0), 0) / p.length : 0,
      totalOP: p.reduce((s, x) => s + (x.currentOpenPositions || 0), 0),
      maxDD:   p.length ? Math.max(...p.map(x => x.maxDrawdownPercentage || 0)) : 0,
    };
  }, [curEv]);

  const winProbs = useMemo(() => {
    if (!curEv) return [];
    return curEv.participants
      .filter(p => !p.isDisqualified && p.totalTrades > 0)
      .map(p => ({ ...p, prob: calcWinProb(p, curEv) }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 7);
  }, [curEv]);

  const racers      = useMemo(() => (curEv?.participants || []).filter(p => p.totalTrades > 0 && !p.isDisqualified), [curEv]);
  const waiting     = useMemo(() => (curEv?.participants || []).filter(p => p.totalTrades === 0 && !p.isDisqualified), [curEv]);

  function enterEv(id: string) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    setCurEv(ev); setView('live'); setTab('race');
    if (ev.status === 'completed' && ev.winners?.length) setShowPodium(true);
  }

  // ── Button helpers ──
  const navBtn = (v: string, active: boolean, disabled: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2,
    textTransform: 'uppercase', padding: '5px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1px solid transparent`, background: 'none',
    color: active ? CV.teal : disabled ? CV.bd2 : CV.gray,
    opacity: disabled ? 0.4 : 1, transition: 'all .2s',
  });
  const tabBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
    border: `1px solid ${active ? CV.teal + '33' : 'transparent'}`,
    background: active ? `rgba(15,237,190,.1)` : 'none',
    color: active ? CV.teal : CV.bd3, transition: 'all .2s',
  });
  const chipBtn = (f: string): React.CSSProperties => ({
    fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1,
    textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${filter === f ? CV.teal + '44' : CV.bd1}`,
    background: filter === f ? `rgba(15,237,190,.07)` : 'none',
    color: filter === f ? CV.teal : CV.bd3, transition: 'all .2s',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: CV.bg0, minHeight: '100vh', color: CV.txt, fontFamily: "'Inter',sans-serif", overflow: 'hidden' }}>

      {/* Subtle scanlines */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.018) 2px,rgba(0,0,0,.018) 4px)' }} />

      {/* ── HEADER ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 22px', height: 60,
        background: `linear-gradient(180deg,${CV.bg1} 0%,${CV.bg0} 100%)`,
        borderBottom: `1px solid ${CV.bd1}`,
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(14px)',
        boxShadow: `0 1px 0 0 ${CV.teal}18, 0 4px 20px rgba(0,0,0,.4)`,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg,${CV.teal},${CV.blue})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 14, fontWeight: 900, color: '#fff',
            boxShadow: `0 0 22px ${CV.teal}44`,
          }}>CV</div>
          <div>
            <div style={{
              fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 3,
              background: `linear-gradient(90deg,${CV.teal},${CV.lgt} 60%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>CHARTVOLT</div>
            <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 9, color: CV.blue, letterSpacing: 5, textTransform: 'uppercase', marginTop: -1 }}>Trading Arena</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {([['lobby', 'Browse Events'], ['live', 'Live View']] as [string, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => { if (v === 'live' && !curEv) return; setView(v as 'lobby' | 'live'); }}
              className={view === v ? 'nav-on' : ''}
              style={navBtn(v, view === v, v === 'live' && !curEv)}
            >{l}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 11, color: CV.gray, letterSpacing: 1 }}>{clock}</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 700, color: CV.red,
            letterSpacing: 2, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 20,
            border: `1px solid ${CV.red}40`, background: `rgba(255,73,91,.07)`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CV.red, boxShadow: `0 0 8px ${CV.red}`, animation: 'blink 1s infinite' }} />
            LIVE
          </div>
        </div>
      </header>

      {/* ═══════════════════ LOBBY ═══════════════════ */}
      {view === 'lobby' && (
        <div style={{ padding: '20px 24px 80px', maxWidth: 1700, margin: '0 auto' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', padding: '28px 0 20px' }}>
            <h1 style={{
              fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 4,
              background: `linear-gradient(90deg,${CV.teal},${CV.blue},${CV.purp})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              marginBottom: 8,
            }}>Trading Arena</h1>
            <p style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 13, color: CV.gray, letterSpacing: 1 }}>
              Live competitions — real traders, real equity, live signals.
            </p>
          </div>

          {/* Stats row */}
          {stats && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '14px 0 24px', flexWrap: 'wrap' }}>
              {([
                [stats.liveNow,                    'Live Now',       CV.red],
                [stats.upcoming,                   'Starting Soon',  CV.blue],
                [fmtPrize(stats.totalPrizePool),   'Total Prizes',   CV.gold],
                [stats.activePlayers,              'Active Traders', CV.grn],
                [stats.openPositions,              'Open Positions', CV.oran],
              ] as [string | number, string, string][]).map(([v, l, c]) => (
                <div key={l} style={{
                  textAlign: 'center', padding: '10px 22px',
                  background: CV.bg2, border: `1px solid ${CV.bd1}`,
                  borderRadius: 10, minWidth: 88,
                }}>
                  <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 8, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['competition', 'Competitions'], ['challenge', 'Challenges'], ['active', 'Live'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'chip-on' : ''} style={chipBtn(f)}>{l}</button>
            ))}
          </div>

          {/* Events grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 13, color: CV.bd3, letterSpacing: 2 }}>
              Loading competitions…
            </div>
          ) : apiError ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, opacity: .45 }}>⚠️</div>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, color: CV.oran, letterSpacing: 3, marginTop: 14 }}>Connection Error</div>
              <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: CV.bd3, marginTop: 8, letterSpacing: 1, maxWidth: 480, margin: '8px auto 0', wordBreak: 'break-all' }}>{apiError}</div>
              <button
                onClick={() => { setLoading(true); setApiError(null); fetchD(); }}
                style={{ marginTop: 18, fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: '7px 20px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${CV.teal}44`, background: `rgba(15,237,190,.08)`, color: CV.teal }}
              >Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 42, opacity: .35 }}>🏁</div>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, color: CV.gray, letterSpacing: 3, marginTop: 14 }}>No Events Found</div>
              <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: CV.bd3, marginTop: 6, letterSpacing: 1 }}>Try changing the filter or check back later</div>
              <button
                onClick={() => { setLoading(true); fetchD(); }}
                style={{ marginTop: 14, fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 16px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${CV.bd2}`, background: 'none', color: CV.bd3 }}
              >Refresh</button>
            </div>
          ) : (
            Object.entries({
              active:    filtered.filter(e => ['active'].includes(e.status)),
              upcoming:  filtered.filter(e => ['upcoming', 'pending', 'accepted'].includes(e.status)),
              completed: filtered.filter(e => e.status === 'completed'),
            }).filter(([, items]) => items.length > 0).map(([st, items]) => (
              <div key={st}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 10px' }}>
                  <div style={{
                    fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 9, fontWeight: 600,
                    color: st === 'active' ? CV.red : st === 'upcoming' ? CV.blue : CV.gray,
                    letterSpacing: 4, textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    {st === 'active' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />}
                    {st === 'active' ? 'Live Now' : st === 'upcoming' ? 'Starting Soon' : 'Completed'}
                  </div>
                  <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, color: CV.bd3 }}>{items.length} event{items.length > 1 ? 's' : ''}</div>
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
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 20px',
            background: CV.bg1, borderBottom: `1px solid ${CV.bd1}`,
            flexShrink: 0,
          }}>
            <button
              onClick={() => { setView('lobby'); setCurEv(null); setShowPodium(false); }}
              style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 1, color: CV.gray, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 10px', borderRadius: 6 }}
            >← Lobby</button>

            <div style={{
              fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 700, color: CV.gold,
              letterSpacing: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: `0 0 18px ${CV.gold}44`,
            }}>🏆 {curEv.name.toUpperCase()}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {curEv.status === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, fontWeight: 700, color: CV.red, letterSpacing: 2, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, border: `1px solid ${CV.red}33`, background: `rgba(255,73,91,.07)` }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: CV.red, boxShadow: `0 0 6px ${CV.red}`, animation: 'blink 1s infinite' }} />LIVE
                </div>
              )}
              <div style={{ padding: '3px 12px', borderRadius: 6, textAlign: 'center', background: `rgba(253,212,88,.06)`, border: `1px solid ${CV.gold}30` }}>
                <div style={{ fontSize: 6, color: CV.gol2, letterSpacing: 2, textTransform: 'uppercase' }}>Prize Pool</div>
                <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 14, fontWeight: 700, color: CV.gold, textShadow: `0 0 12px ${CV.gold}40` }}>{fmtPrize(curEv.prizePool)}</div>
              </div>
              <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 20, fontWeight: 700, color: CV.teal, textShadow: `0 0 16px ${CV.teal}44`, letterSpacing: 2, minWidth: 80, textAlign: 'right' }}>{timer}</div>
            </div>
          </div>

          {/* Ticker */}
          <Ticker prices={prices} events={events} />

          {/* Ranking label */}
          <div style={{
            background: `rgba(15,237,190,.02)`, borderBottom: `1px solid ${CV.bd0}`,
            padding: '3px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase' }}>Ranking by</span>
            <span style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 700, color: CV.teal, letterSpacing: 1 }}>{rmLabel(curEv.rankingMethod || 'pnl')}</span>
            <span style={{ marginLeft: 'auto', fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, color: CV.bd2, letterSpacing: 2 }}>
              {curEv.participants.length} TRADERS · {curEv.openPositions.length} OPEN POS
            </span>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '5px 16px',
            background: CV.bg1, borderBottom: `1px solid ${CV.bd1}`, flexShrink: 0,
          }}>
            {([['race', '🏁 Race'], ['board', '📊 Leaderboard'], ['trades', '⚡ Open Trades']] as [string, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t as 'race' | 'board' | 'trades')} className={tab === t ? 'tab-on' : ''} style={tabBtn(tab === t)}>{l}</button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 272px', overflow: 'hidden' }}>

            {/* ── Left ── */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* RACE TAB */}
              {tab === 'race' && (
                <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', scrollbarWidth: 'none' }}>
                  {curEv.participants.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <div style={{ fontSize: 40, opacity: .35 }}>👥</div>
                      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, color: CV.gray, letterSpacing: 3 }}>No Participants Yet</div>
                    </div>
                  ) : (
                    <>
                      {racers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '28px 0', fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, color: CV.bd3, letterSpacing: 2 }}>Waiting for first trades…</div>
                      ) : racers.map((p, i) => (
                        <RacerRow key={p.userId} p={p} ev={curEv} idx={i} onClick={() => setSelTrader({ p, ev: curEv })} />
                      ))}

                      {/* Awaiting first trade */}
                      {waiting.length > 0 && (
                        <div style={{ marginTop: 16, borderTop: `1px dashed ${CV.bd1}`, paddingTop: 8 }}>
                          <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, color: CV.bd2, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>Awaiting Entry</span>
                            <span style={{ background: CV.bg3, borderRadius: 10, padding: '1px 7px', color: CV.bd3 }}>{waiting.length}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {waiting.map(p => (
                              <div
                                key={p.userId}
                                onClick={() => setSelTrader({ p, ev: curEv })}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', opacity: .28, cursor: 'pointer', borderRadius: 20, background: CV.bg3, border: `1px solid ${CV.bd0}` }}
                              >
                                <Av u={p.username} img={p.profileImage} sz={20} />
                                <span style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, color: CV.bd3, fontWeight: 600 }}>{p.username}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* LEADERBOARD TAB */}
              {tab === 'board' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', scrollbarWidth: 'none' }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 70px 70px', gap: 8, padding: '6px 10px', marginBottom: 4 }}>
                    {['#', 'Trader', 'Equity', 'PnL', 'ROI', 'WR'].map((h, hi) => (
                      <div key={h} style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 600, color: CV.bd3, letterSpacing: 2, textTransform: 'uppercase', textAlign: hi === 0 ? 'center' : hi === 1 ? 'left' : 'right' }}>{h}</div>
                    ))}
                  </div>
                  {curEv.participants.filter(p => p.totalTrades > 0 || p.isDisqualified).map((p, i) => {
                    const noT = p.totalTrades === 0 && !p.isDisqualified;
                    const rkColor = i < 3 ? RANK_COLORS[i] : CV.gray;
                    return (
                      <div
                        key={p.userId}
                        onClick={() => setSelTrader({ p, ev: curEv })}
                        style={{
                          display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 70px 70px', gap: 8,
                          alignItems: 'center', padding: '7px 10px',
                          background: i === 0 ? `rgba(253,212,88,.03)` : CV.bg2,
                          border: `1px solid ${i < 3 ? RANK_COLORS[i] + '1e' : CV.bd1}`,
                          borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                          opacity: noT ? .55 : p.isDisqualified ? .28 : 1,
                          transition: 'background .15s',
                        }}
                      >
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 800, color: rkColor, textAlign: 'center', textShadow: i < 3 ? `0 0 10px ${rkColor}88` : 'none' }}>{p.rank}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Av u={p.username} img={p.profileImage} sz={28} ring={i < 3 ? RANK_COLORS[i] : undefined} />
                          <span style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 13, fontWeight: 600, color: noT ? CV.bd3 : CV.lgt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
                        </div>
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 11, fontWeight: 700, color: CV.teal, textAlign: 'right' }}>{fmtC(p.liveEquity)}</div>
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 11, fontWeight: 700, color: p.livePnl >= 0 ? CV.grn : CV.red, textAlign: 'right' }}>{noT ? '—' : fmtPnl(p.livePnl)}</div>
                        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 600, color: p.liveRoi >= 0 ? CV.grn : CV.red, textAlign: 'right' }}>{noT ? '—' : `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(1)}%`}</div>
                        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 11, fontWeight: 600, color: CV.purp, textAlign: 'right' }}>{noT ? '—' : `${p.winRate.toFixed(0)}%`}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* OPEN TRADES TAB */}
              {tab === 'trades' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', scrollbarWidth: 'none' }}>
                  {curEv.openPositions.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <div style={{ fontSize: 40, opacity: .35 }}>📭</div>
                      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, color: CV.gray, letterSpacing: 3 }}>No Open Trades</div>
                    </div>
                  ) : curEv.openPositions.map((t, i) => {
                    const isL = t.side === 'long';
                    const dec = (t.symbol || '').includes('JPY') || (t.symbol || '').includes('XAU') ? 2 : 4;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 12px', background: CV.bg2,
                        border: `1px solid ${CV.bd1}`, borderRadius: 8, marginBottom: 4,
                      }}>
                        <Av u={t.username} img={t.profileImage} sz={28} />
                        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 12, fontWeight: 600, color: CV.gray, minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.username}</div>
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 12, fontWeight: 700, color: CV.teal, minWidth: 66 }}>{(t.symbol || '').replace('/', '')}</div>
                        <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, letterSpacing: 1, color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.1)' : 'rgba(255,73,91,.1)', border: `1px solid ${isL ? 'rgba(34,197,94,.2)' : 'rgba(255,73,91,.2)'}` }}>{isL ? 'BUY' : 'SELL'}</span>
                        <div style={{ fontSize: 9, color: CV.bd3, flex: 1 }}>
                          <div>Entry: {t.entryPrice.toFixed(dec)}</div>
                          <div>Now:&nbsp; {t.currentPrice.toFixed(dec)}</div>
                        </div>
                        {t.leverage > 1 && <div style={{ fontSize: 9, color: CV.bd3, minWidth: 24 }}>{t.leverage}x</div>}
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 11, fontWeight: 700, color: t.unrealizedPnl >= 0 ? CV.grn : CV.red, textAlign: 'right', minWidth: 64 }}>{fmtC(Math.abs(t.unrealizedPnl))}</div>
                        <div style={{ fontSize: 9, color: CV.bd3, minWidth: 28 }}>{tAgo(t.openedAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SIDEBAR ── */}
            <div style={{ background: CV.bg1, borderLeft: `1px solid ${CV.bd1}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' }}>

              {/* Arena stats */}
              {sideStats && curEv && (
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${CV.bd0}` }}>
                  <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 600, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Arena Stats</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {([
                      [sideStats.total || '—', 'Trades',    CV.teal],
                      [curEv.currentParticipants || curEv.participants.length || '—', 'Players', CV.grn],
                      [fmtPrize(curEv.prizePool), 'Prize',  CV.gold],
                      [Math.round(sideStats.avgWR) + '%', 'Avg WR',  CV.purp],
                      [sideStats.totalOP || '—', 'Open Pos', CV.oran],
                      [sideStats.maxDD.toFixed(1) + '%', 'Max DD',   CV.red],
                    ] as [string | number, string, string][]).map(([v, l, c]) => (
                      <div key={l} style={{ background: CV.bg2, border: `1px solid ${CV.bd1}`, borderRadius: 7, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 13, fontWeight: 700, color: c, marginBottom: 1 }}>{v}</div>
                        <div style={{ fontSize: 7, color: CV.bd3, letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win Probability */}
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${CV.bd0}` }}>
                <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 600, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Win Probability ⚡</div>
                {winProbs.length === 0 ? (
                  <div style={{ fontSize: 9, color: CV.bd2 }}>No active traders</div>
                ) : winProbs.map((p, i) => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Av u={p.username} img={p.profileImage} sz={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 10, fontWeight: 600, color: CV.lgt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                      <div style={{ height: 3, background: CV.bd0, borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.prob}%`, background: i === 0 ? `linear-gradient(90deg,${CV.teal},${CV.blue})` : `linear-gradient(90deg,${CV.blue},${CV.purp})`, borderRadius: 2, transition: 'width 1.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 10, fontWeight: 700, color: i === 0 ? CV.teal : CV.blue, minWidth: 28, textAlign: 'right' }}>{p.prob}%</div>
                  </div>
                ))}
              </div>

              {/* Recent activity */}
              <div style={{ padding: '10px 12px', flex: 1 }}>
                <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 600, color: CV.bd3, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Recent Activity ⚡</div>
                {(curEv.openPositions || []).slice(0, 8).map((pos, i) => {
                  const isL = pos.side === 'long';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '5px 7px', background: CV.bg2, borderRadius: 7, border: `1px solid ${CV.bd0}` }}>
                      <Av u={pos.username} img={pos.profileImage} sz={20} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-geist-sans),sans-serif", fontSize: 9, color: CV.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.username}</div>
                        <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 9, fontWeight: 700, color: CV.teal }}>{(pos.symbol || '').replace('/', '')}</div>
                      </div>
                      <span style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3, color: isL ? CV.grn : CV.red, background: isL ? 'rgba(34,197,94,.1)' : 'rgba(255,73,91,.1)' }}>{isL ? 'BUY' : 'SELL'}</span>
                      <div style={{ fontFamily: "var(--font-geist-mono),sans-serif", fontSize: 9, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? CV.grn : CV.red }}>{fmtC(Math.abs(pos.unrealizedPnl))}</div>
                    </div>
                  );
                })}
                {(curEv.openPositions || []).length === 0 && (
                  <div style={{ fontSize: 9, color: CV.bd2, textAlign: 'center', padding: '12px 0' }}>No open positions</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Trader Modal ── */}
      {selTrader && (
        <TraderModal p={selTrader.p} ev={selTrader.ev} onClose={() => setSelTrader(null)} />
      )}

      {/* ── Winners Podium ── */}
      {showPodium && curEv && (
        <Podium ev={curEv} onClose={() => setShowPodium(false)} />
      )}
    </div>
  );
}
