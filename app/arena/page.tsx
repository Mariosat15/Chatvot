'use client';
/**
 * /arena — Chartvolt Live Trading Arena
 * Casino-quality competition display — publicly accessible, no auth required.
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

// ─── Constants ────────────────────────────────────────────────────────────────

const AV_GRADS = [
  '#1a1a2e,#2979ff', '#2d1b69,#11998e', '#1a0a2e,#7c3aed',
  '#0d2818,#1b4332', '#3b0a0a,#5c1a1a', '#0c1445,#1a237e', '#2a1a00,#4a3000',
];
const TICKER_SYMS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'AUDUSD'];
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const RANK_GLOW   = ['rgba(255,215,0,.22)', 'rgba(192,192,192,.12)', 'rgba(205,127,50,.1)'];
const BAR_FILLS   = [
  'linear-gradient(90deg,rgba(255,215,0,.75),rgba(255,215,0,.25))',
  'linear-gradient(90deg,rgba(192,192,192,.55),rgba(192,192,192,.18))',
  'linear-gradient(90deg,rgba(205,127,50,.5),rgba(205,127,50,.16))',
  'linear-gradient(90deg,rgba(0,245,255,.45),rgba(0,245,255,.14))',
  'linear-gradient(90deg,rgba(41,121,255,.38),rgba(41,121,255,.11))',
  'linear-gradient(90deg,rgba(224,64,251,.32),rgba(224,64,251,.09))',
  'linear-gradient(90deg,rgba(0,230,118,.3),rgba(0,230,118,.08))',
  'linear-gradient(90deg,rgba(255,109,0,.28),rgba(255,109,0,.07))',
  'linear-gradient(90deg,rgba(255,23,68,.22),rgba(255,23,68,.06))',
  'linear-gradient(90deg,rgba(124,58,237,.2),rgba(124,58,237,.05))',
];
const WR_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32', '#00f5ff', '#2979ff', '#e040fb', '#00e676'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avColor = (u: string) => {
  let h = 0;
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg,${AV_GRADS[h % AV_GRADS.length]})`;
};
const ini = (u: string) => (u || '?').split(/[\s_-]+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
const pad = (n: number) => String(n).padStart(2, '0');
const fmtMs = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
const fmtAbs = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1000 ? `$${(a / 1000).toFixed(1)}K` : `$${a.toFixed(0)}`; };
const fmtC    = (v: number) => (v < 0 ? '-' : '') + fmtAbs(v);
const fmtPnl  = (v: number) => (v >= 0 ? '+' : '') + fmtC(v);
const fmtPrize = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v || 0}`;
const tAgo = (d: string) => { const df = Date.now() - new Date(d).getTime(); if (df < 60000) return 'now'; if (df < 3600000) return `${Math.floor(df / 60000)}m`; return `${Math.floor(df / 3600000)}h`; };

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
const rmLabel = (rm: string) => ({ roi: 'ROI %', win_rate: 'Win Rate', total_capital: 'Total Equity', equity: 'Total Equity' }[rm] ?? 'PnL');

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
    fontSize: Math.round(sz * 0.38), fontWeight: 700, fontFamily: "'Rajdhani',sans-serif",
    ...(ring ? { outline: `2px solid ${ring}`, outlineOffset: 2, boxShadow: `0 0 12px ${ring}55` } : {}),
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

function RacerRow({ p, ev, idx, onClick }: { p: Participant; ev: AEvent; idx: number; onClick: () => void }) {
  const rm       = ev.rankingMethod || 'pnl';
  const prog     = calcRaceProgress(p, rm, ev.participants);
  const noTrades = p.totalTrades === 0 && !p.isDisqualified;
  const isLeader = idx === 0 && !noTrades && !p.isDisqualified;
  const rkColor  = idx < 3 ? RANK_COLORS[idx] : '#44485a';
  const barFill  = noTrades ? 'rgba(255,255,255,.04)' : (BAR_FILLS[idx] || BAR_FILLS[BAR_FILLS.length - 1]);
  const pnlColor = p.livePnl >= 0 ? '#00e676' : '#ff1744';

  return (
    <div
      onClick={onClick}
      className="rcrow"
      style={{
        display: 'grid', gridTemplateColumns: '38px 195px 1fr 145px',
        alignItems: 'center', gap: 10, height: 66, borderRadius: 11, padding: '0 14px',
        background: noTrades ? 'rgba(5,5,15,.4)'
          : idx === 0 ? 'linear-gradient(90deg,rgba(255,215,0,.07),rgba(6,6,18,0) 60%)'
          : idx === 1 ? 'linear-gradient(90deg,rgba(192,192,192,.04),rgba(6,6,18,0) 60%)'
          : idx === 2 ? 'linear-gradient(90deg,rgba(205,127,50,.04),rgba(6,6,18,0) 60%)'
          : 'rgba(10,10,28,.7)',
        border: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '2a' : 'rgba(255,255,255,.05)'}`,
        boxShadow: isLeader ? `0 0 32px ${RANK_GLOW[0]}, inset 0 1px 0 rgba(255,215,0,.07)`
          : idx < 3 ? `0 0 16px ${RANK_GLOW[idx]}` : 'none',
        opacity: p.isDisqualified ? 0.28 : noTrades ? 0.55 : 1,
        cursor: 'pointer', transition: 'transform .15s ease', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Rank */}
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 17, fontWeight: 900, textAlign: 'center',
        color: rkColor, textShadow: idx < 3 ? `0 0 18px ${RANK_COLORS[idx]}99` : 'none',
      }}>{p.rank}</div>

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isLeader && (
            <div style={{
              position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
              fontSize: 13, filter: 'drop-shadow(0 0 5px gold)', zIndex: 10,
            }}>👑</div>
          )}
          <Av u={p.username} img={p.profileImage} sz={42} ring={idx < 3 ? RANK_COLORS[idx] : undefined} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700,
            color: noTrades ? '#3a3a55' : '#eef0f6',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{p.username}</div>
          <div style={{
            fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2,
            color: p.isDisqualified ? '#ff1744aa' : noTrades ? '#2a2a45' : '#44485a',
          }}>
            {p.isDisqualified ? '⚡ LIQUIDATED'
              : noTrades ? '── AWAITING FIRST TRADE'
              : `${p.totalTrades} trade${p.totalTrades !== 1 ? 's' : ''}${p.currentOpenPositions > 0 ? ` · ${p.currentOpenPositions} open` : ''}`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'relative', height: 30,
        background: 'rgba(255,255,255,.025)', borderRadius: 15, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.035)',
      }}>
        <div style={{
          position: 'absolute', top: 1, bottom: 1, left: 1, borderRadius: 14,
          width: `${prog}%`, background: barFill, minWidth: 36,
          transition: 'width 1.8s cubic-bezier(.4,0,.2,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 36,
        }}>
          {!noTrades && (
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: 'rgba(255,255,255,.88)', textShadow: '0 1px 4px rgba(0,0,0,.95)',
              whiteSpace: 'nowrap', position: 'relative', zIndex: 3,
            }}>{raceLabel(p, rm)}</span>
          )}
          {!noTrades && (
            <div style={{
              position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid rgba(255,255,255,.22)', boxShadow: '0 0 8px rgba(0,0,0,.7)', zIndex: 4,
            }}>
              <Av u={p.username} img={p.profileImage} sz={28} />
            </div>
          )}
        </div>
        {/* Leader shimmer */}
        {isLeader && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg,transparent 20%,rgba(255,215,0,.07) 50%,transparent 80%)',
            animation: 'shim 2.6s linear infinite', pointerEvents: 'none', zIndex: 2,
          }} />
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700,
          color: noTrades ? '#44485a' : pnlColor,
          textShadow: (!noTrades && p.livePnl !== 0) ? `0 0 14px ${pnlColor}55` : 'none',
        }}>
          {noTrades ? '—' : fmtPnl(p.livePnl)}
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: '#8892a4', fontWeight: 600 }}>
          {noTrades ? 'No trades yet'
            : `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(1)}% · ${p.winRate.toFixed(0)}% WR`}
        </div>
      </div>
    </div>
  );
}

// ─── Trader Modal ─────────────────────────────────────────────────────────────

function TraderModal({ p, ev, onClose }: { p: Participant; ev: AEvent; onClose: () => void }) {
  const myPos = ev.openPositions.filter(pos => pos.userId === p.userId);
  const Cell = ({ v, l, c }: { v: string; l: string; c?: string }) => (
    <div style={{
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)',
      borderRadius: 9, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700, color: c || '#eef0f6', marginBottom: 3 }}>{v}</div>
      <div style={{ fontSize: 8, color: '#44485a', letterSpacing: 2, textTransform: 'uppercase' }}>{l}</div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 500,
        backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#0d0d22', border: '1px solid rgba(0,245,255,.18)', borderRadius: 16,
        width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none',
        boxShadow: '0 0 60px rgba(0,245,255,.1),0 20px 80px rgba(0,0,0,.75)',
        animation: 'mopen .3s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 18px 14px' }}>
          <Av u={p.username} img={p.profileImage} sz={64}
            ring={p.rank <= 3 ? RANK_COLORS[p.rank - 1] : 'rgba(0,245,255,.4)'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 700 }}>{p.username}</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: 2, marginTop: 2,
              color: p.rank === 1 ? '#ffd700' : p.rank === 2 ? '#c0c0c0' : p.rank === 3 ? '#cd7f32' : '#00f5ff',
            }}>
              {p.rank === 1 ? '🥇 1ST PLACE' : p.rank === 2 ? '🥈 2ND PLACE' : p.rank === 3 ? '🥉 3RD PLACE' : `RANK #${p.rank}`}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
              fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase', padding: '2px 9px', borderRadius: 4,
              color: p.isDisqualified ? '#ff1744' : '#00e676',
              background: p.isDisqualified ? 'rgba(255,23,68,.1)' : 'rgba(0,230,118,.1)',
              border: `1px solid ${p.isDisqualified ? 'rgba(255,23,68,.2)' : 'rgba(0,230,118,.2)'}`,
            }}>
              {p.isDisqualified ? 'LIQUIDATED' : 'ACTIVE'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,.1)', color: '#44485a',
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Color bar */}
        <div style={{ height: 3, background: p.livePnl >= 0 ? 'linear-gradient(90deg,#00e676,#00f5ff)' : 'linear-gradient(90deg,#ff1744,#ff6d00)', marginBottom: 14 }} />

        {/* Primary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 18px 14px' }}>
          <Cell v={p.totalTrades > 0 ? fmtPnl(p.livePnl) : '—'} l="Live PnL" c={p.livePnl >= 0 ? '#00e676' : '#ff1744'} />
          <Cell v={fmtC(p.liveEquity)} l="Live Equity" c="#00f5ff" />
          <Cell v={p.totalTrades > 0 ? `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(2)}%` : '—'} l="ROI" c={p.liveRoi >= 0 ? '#00e676' : '#ff1744'} />
          <Cell v={p.totalTrades > 0 ? `${p.winRate.toFixed(1)}%` : '—'} l="Win Rate" c="#e040fb" />
        </div>

        {/* Secondary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px 14px' }}>
          <Cell v={String(p.totalTrades)} l="Total Trades" />
          <Cell v={String(p.winningTrades)} l="Wins" c="#00e676" />
          <Cell v={String(p.losingTrades)} l="Losses" c="#ff1744" />
          <Cell v={p.averageWin > 0 ? fmtC(p.averageWin) : '—'} l="Avg Win" c="#00e676" />
          <Cell v={p.averageLoss > 0 ? fmtC(p.averageLoss) : '—'} l="Avg Loss" c="#ff1744" />
          <Cell v={p.profitFactor > 0 ? p.profitFactor.toFixed(2) : '—'} l="Profit Factor" c="#ffd700" />
          <Cell v={p.largestWin > 0 ? fmtC(p.largestWin) : '—'} l="Largest Win" c="#00e676" />
          <Cell v={p.largestLoss > 0 ? fmtC(p.largestLoss) : '—'} l="Largest Loss" c="#ff1744" />
          <Cell v={`${p.maxDrawdownPercentage.toFixed(1)}%`} l="Max Drawdown" c="#ff6d00" />
        </div>

        {/* Open positions */}
        {myPos.length > 0 && (
          <>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 600, color: '#44485a', letterSpacing: 3, textTransform: 'uppercase', padding: '0 18px 8px' }}>
              Open Positions ({myPos.length})
            </div>
            <div style={{ padding: '0 18px', marginBottom: 16 }}>
              {myPos.map((pos, i) => {
                const isL = pos.side === 'long';
                const dec = (pos.symbol || '').includes('JPY') || (pos.symbol || '').includes('XAU') ? 2 : 4;
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '70px 50px 85px 80px 1fr',
                    gap: 6, alignItems: 'center', padding: '6px 8px',
                    borderBottom: '1px solid rgba(255,255,255,.03)',
                  }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: '#00f5ff' }}>{(pos.symbol || '').replace('/', '')}</div>
                    <span style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3, letterSpacing: 1,
                      color: isL ? '#00e676' : '#ff1744',
                      background: isL ? 'rgba(0,230,118,.1)' : 'rgba(255,23,68,.1)',
                      border: `1px solid ${isL ? 'rgba(0,230,118,.2)' : 'rgba(255,23,68,.2)'}`,
                    }}>{isL ? 'BUY' : 'SELL'}</span>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#44485a' }}>{pos.entryPrice.toFixed(dec)}</div>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: pos.unrealizedPnl >= 0 ? '#00e676' : '#ff1744' }}>{fmtPnl(pos.unrealizedPnl)}</div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#44485a' }}>{tAgo(pos.openedAt)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.94)', zIndex: 600,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .5s ease',
    }}>
      {/* Confetti */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 55 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: -12, left: `${(i * 1.85) % 100}%`,
            width: i % 3 === 0 ? 6 : 4, height: i % 3 === 0 ? 6 : 4,
            background: ['#ffd700', '#00f5ff', '#e040fb', '#00e676', '#ff6d00', '#fff'][i % 6],
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            animation: `fall ${2.5 + (i % 5) * 0.5}s ${(i % 7) * 0.4}s linear infinite`,
          }} />
        ))}
      </div>

      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 6,
        background: 'linear-gradient(90deg,#ffd700,#ff6d00,#ffd700)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        marginBottom: 6,
      }}>🏆 FINAL RESULTS</div>
      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: '#8892a4', letterSpacing: 2, marginBottom: 40 }}>{ev.name}</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
        {order.map((wi, si) => {
          const winner = w[wi];
          if (!winner) return null;
          const col = RANK_COLORS[wi] || '#44485a';
          const prizeEntry = ev.prizeDistribution.find(d => d.rank === wi + 1);
          const prizeAmt = prizeEntry ? Math.floor((ev.prizePool || 0) * prizeEntry.percentage / 100) : 0;
          return (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 22 }}>{medals[si]}</div>
              <Av u={winner.username} img={winner.profileImage} sz={si === 1 ? 80 : 60} ring={col} />
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, color: '#eef0f6' }}>{winner.username}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, color: winner.livePnl >= 0 ? '#00e676' : '#ff1744' }}>{fmtPnl(winner.livePnl)}</div>
              {prizeAmt > 0 && <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: col, fontWeight: 600 }}>Prize: {fmtPrize(prizeAmt)}</div>}
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                width: si === 1 ? 100 : 80, height: heights[si],
                background: `linear-gradient(180deg,${col}2e,${col}0a)`,
                border: `1px solid ${col}33`, borderRadius: '8px 8px 0 0',
              }}>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: si === 1 ? 28 : 20,
                  fontWeight: 900, color: col, paddingBottom: 8, textShadow: `0 0 18px ${col}`,
                }}>
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
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2,
          textTransform: 'uppercase', padding: '8px 24px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#8892a4',
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
  const canClick = ev.status === 'active' || ev.status === 'completed';

  return (
    <div
      className="ev-card"
      onClick={() => canClick && onEnter(ev.id)}
      style={{
        background: 'rgba(10,10,28,.82)', borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${ev.status === 'active' ? 'rgba(255,23,68,.1)' : 'rgba(255,255,255,.06)'}`,
        cursor: canClick ? 'pointer' : 'default',
        boxShadow: ev.status === 'active' ? '0 0 30px rgba(255,23,68,.05)' : 'none',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ height: 4, background: ev.status === 'active' ? 'linear-gradient(90deg,#ff1744,#ff6d00)' : ev.status === 'upcoming' ? (isComp ? 'linear-gradient(90deg,#e040fb,#7c3aed)' : 'linear-gradient(90deg,#ffd700,#ff6d00)') : 'linear-gradient(90deg,#2a2a3a,#1a1a2a)' }} />
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
            color: isComp ? '#00f5ff' : '#ffd700',
            background: isComp ? 'rgba(0,245,255,.08)' : 'rgba(255,215,0,.07)',
            border: `1px solid ${isComp ? 'rgba(0,245,255,.15)' : 'rgba(255,215,0,.15)'}`,
          }}>{isComp ? 'Competition' : 'Challenge'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: ev.status === 'active' ? '#ff1744' : ev.status === 'upcoming' ? '#00f5ff' : '#44485a' }}>
            {ev.status === 'active' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff1744', boxShadow: '0 0 6px #ff1744', animation: 'blink 1s infinite' }} />}
            {ev.status === 'active' ? 'LIVE' : ev.status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
          </div>
        </div>

        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, color: '#eef0f6', marginBottom: 4, lineHeight: 1.2 }}>{ev.name}</div>
        <div style={{ fontSize: 10, color: '#44485a', lineHeight: 1.4, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
          {([
            [fmtPrize(ev.prizePool), 'Prize', '#ffd700'],
            [`${ev.currentParticipants}/${ev.maxParticipants || '∞'}`, 'Players', '#00f5ff'],
            [td, tl, ev.status === 'active' ? '#ff1744' : '#8892a4'],
          ] as [string, string, string][]).map(([v, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '6px 3px', background: 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,.03)' }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, color: c, marginBottom: 1 }}>{v}</div>
              <div style={{ fontSize: 7, color: '#44485a', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {parts.slice(0, 4).map((p, i) => (
              <div key={p.userId} style={{ marginLeft: i === 0 ? 0 : -5, zIndex: 10 - i, position: 'relative' }}>
                <Av u={p.username} img={p.profileImage} sz={24} ring="rgba(255,255,255,.12)" />
              </div>
            ))}
            {(ev.currentParticipants || 0) > 4 && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', marginLeft: -5, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rajdhani',sans-serif", fontSize: 8, fontWeight: 700, color: '#8892a4' }}>+{ev.currentParticipants - 4}</div>
            )}
          </div>
          {ev.status === 'active' ? (
            <button
              onClick={e => { e.stopPropagation(); onEnter(ev.id); }}
              className="ebtn"
              style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(0,245,255,.3)', background: 'rgba(0,245,255,.07)', color: '#00f5ff', transition: 'all .2s' }}
            >Watch Live</button>
          ) : winner ? (
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: '#ffd700' }}>🏆 {winner.username}</span>
          ) : null}
        </div>

        {winner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,215,0,.04)', borderTop: '1px solid rgba(255,215,0,.1)', marginTop: 10, fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#ffd700' }}>
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
        <span style={{ color: '#00f5ff', fontWeight: 700 }}>{sym}</span>
        <span style={{ color: dir === 1 ? '#00e676' : dir === -1 ? '#ff1744' : '#8892a4' }}>
          {dir === 1 ? '▲' : dir === -1 ? '▼' : ''} {p.mid.toFixed(dec)}
        </span>
        {p.bid && p.ask && (
          <span style={{ color: '#2a2a3a', fontSize: 9 }}>
            sp:{((p.ask - p.bid) * Math.pow(10, dec)).toFixed(1)}
          </span>
        )}
      </span>
    );
  }).filter(Boolean);

  if (!chunks.length) {
    return (
      <div style={{ background: 'rgba(0,245,255,.03)', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '5px 16px', fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#2a2a3a', letterSpacing: 1, flexShrink: 0 }}>
        CHARTVOLT ARENA — Market data initialising…
      </div>
    );
  }
  return (
    <div style={{ background: 'rgba(0,245,255,.03)', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '4px 0', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'inline-flex', gap: 38, animation: 'tickS 38s linear infinite', fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 500, color: '#8892a4', paddingLeft: 20 }}>
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
  const [selTrader,  setSelTrader]  = useState<{ p: Participant; ev: AEvent } | null>(null);
  const [showPodium, setShowPodium] = useState(false);

  const curEvRef = useRef<AEvent | null>(null);
  curEvRef.current = curEv;

  // ── Styles injection ──
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'cv-arena-css';
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
      @keyframes blink  { 0%,100%{opacity:1}50%{opacity:.3} }
      @keyframes shim   { 0%{transform:translateX(-200%)}100%{transform:translateX(200%)} }
      @keyframes tickS  { 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
      @keyframes fadeIn { from{opacity:0}to{opacity:1} }
      @keyframes mopen  { from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)} }
      @keyframes fall   { 0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
      .rcrow:hover      { transform:translateX(2px); }
      .ev-card:hover    { transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 22px rgba(0,245,255,.07)!important;border-color:rgba(0,245,255,.14)!important; }
      .tab-on           { color:#00f5ff!important;background:rgba(0,245,255,.1)!important;border-color:rgba(0,245,255,.2)!important; }
      .chip-on          { color:#00f5ff!important;border-color:rgba(0,245,255,.35)!important;background:rgba(0,245,255,.07)!important; }
      .nav-on           { color:#00f5ff!important;border-color:rgba(0,245,255,.2)!important;background:rgba(0,245,255,.1)!important; }
      .ebtn:hover       { background:rgba(0,245,255,.14)!important; }
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

  // ── Countdown timer ──
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
      const r = await fetch('/api/dashboard/competitions', { cache: 'no-store' });
      if (!r.ok) return;
      const d: DashData = await r.json();
      const all: AEvent[] = [
        ...(d.competitions || []).map(c => ({ ...c, _et: 'competition' })),
        ...(d.challenges   || []).map(c => ({ ...c, _et: 'challenge' })),
      ].sort((a, b) => {
        const o: Record<string, number> = { active: 0, upcoming: 1, completed: 2 };
        const as = o[a.status] ?? 3, bs = o[b.status] ?? 3;
        return as !== bs ? as - bs : new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setEvents(all);
      if (d.prices && Object.keys(d.prices).length) setPrices(d.prices);
      if (d.stats) setStats(d.stats);
      const cur = curEvRef.current;
      if (cur) { const up = all.find(e => e.id === cur.id); if (up) setCurEv(up); }
      setLoading(false);
    } catch { /* silent fail — keep existing data */ }
  }, []);

  // ── Polling ──
  useEffect(() => {
    fetchD();
    const ms = view === 'live' ? 5000 : 10000;
    const iv = setInterval(fetchD, ms);
    return () => clearInterval(iv);
  }, [view, fetchD]);

  // ── Computed ──
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
      total:  p.reduce((s, x) => s + (x.totalTrades || 0), 0),
      avgWR:  p.length ? p.reduce((s, x) => s + (x.winRate || 0), 0) / p.length : 0,
      totalOP: p.reduce((s, x) => s + (x.currentOpenPositions || 0), 0),
      maxDD:  p.length ? Math.max(...p.map(x => x.maxDrawdownPercentage || 0)) : 0,
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

  function enterEv(id: string) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    setCurEv(ev); setView('live'); setTab('race');
    if (ev.status === 'completed' && ev.winners?.length) setShowPodium(true);
  }

  // ── Shared styles ──
  const S = {
    root: { background: '#060612', minHeight: '100vh', color: '#e8eaf0', fontFamily: "'Inter',sans-serif", overflow: 'hidden' } as React.CSSProperties,
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', height: 60, background: 'linear-gradient(180deg,rgba(10,10,30,.98),rgba(5,5,15,.95))', borderBottom: '1px solid rgba(255,255,255,.05)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(14px)', boxShadow: '0 1px 0 0 rgba(0,245,255,.1)' } as React.CSSProperties,
  };

  const tabBtn = (t: string, active: boolean) => ({
    fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase' as const, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
    border: `1px solid ${active ? 'rgba(0,245,255,.2)' : 'transparent'}`,
    background: active ? 'rgba(0,245,255,.1)' : 'none',
    color: active ? '#00f5ff' : '#44485a', transition: 'all .2s',
  });

  const chipBtn = (f: string) => ({
    fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1,
    textTransform: 'uppercase' as const, padding: '5px 13px', borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${filter === f ? 'rgba(0,245,255,.35)' : 'rgba(255,255,255,.07)'}`,
    background: filter === f ? 'rgba(0,245,255,.07)' : 'none',
    color: filter === f ? '#00f5ff' : '#44485a', transition: 'all .2s',
  });

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.022) 2px,rgba(0,0,0,.022) 4px)' }} />

      {/* ── HEADER ── */}
      <header style={S.header}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#00f5ff,#e040fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 900, color: '#fff', boxShadow: '0 0 22px rgba(0,245,255,.35)' }}>CV</div>
          <div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 3, background: 'linear-gradient(90deg,#00f5ff,#fff 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>CHARTVOLT</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: '#e040fb', letterSpacing: 5, textTransform: 'uppercase', marginTop: -1 }}>Trading Arena</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {(['lobby', 'Browse Events'] as const), (['live', 'Live View'] as const)}
          {([['lobby', 'Browse Events'], ['live', 'Live View']] as [string, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => { if (v === 'live' && !curEv) return; setView(v as 'lobby' | 'live'); }}
              className={view === v ? 'nav-on' : ''}
              style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', border: '1px solid transparent', background: 'none', color: view === v ? '#00f5ff' : '#44485a', opacity: v === 'live' && !curEv ? 0.4 : 1, transition: 'all .2s' }}
            >{l}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: '#8892a4', letterSpacing: 1 }}>{clock}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 700, color: '#ff1744', letterSpacing: 2, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 20, border: '1px solid rgba(255,23,68,.3)', background: 'rgba(255,23,68,.07)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff1744', boxShadow: '0 0 8px #ff1744', animation: 'blink 1s infinite' }} />
            LIVE
          </div>
        </div>
      </header>

      {/* ══════════ LOBBY ══════════ */}
      {view === 'lobby' && (
        <div style={{ padding: '20px 24px 80px', maxWidth: 1700, margin: '0 auto' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', padding: '26px 0 18px' }}>
            <h1 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: 4, background: 'linear-gradient(90deg,#00f5ff,#ffd700,#e040fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>
              Trading Arena
            </h1>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: '#8892a4', letterSpacing: 1 }}>
              Live competitions — real traders, real equity, live signals.
            </p>
          </div>

          {/* Lobby stats */}
          {stats && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '14px 0 22px', flexWrap: 'wrap' }}>
              {([
                [stats.liveNow, 'Live Now', '#ff1744'],
                [stats.upcoming, 'Starting Soon', '#00f5ff'],
                [fmtPrize(stats.totalPrizePool), 'Total Prizes', '#ffd700'],
                [stats.activePlayers, 'Active Traders', '#00e676'],
                [stats.openPositions, 'Open Positions', '#ff6d00'],
              ] as [string | number, string, string][]).map(([v, l, c]) => (
                <div key={l} style={{ textAlign: 'center', padding: '10px 20px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, minWidth: 90 }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 8, color: '#44485a', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['competition', 'Competitions'], ['challenge', 'Challenges'], ['active', 'Live'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} style={chipBtn(f)}>{l}</button>
            ))}
          </div>

          {/* Events */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: '#44485a', letterSpacing: 2 }}>Loading competitions…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 42, opacity: .4 }}>🏁</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#8892a4', letterSpacing: 3, marginTop: 12 }}>No Events Found</div>
            </div>
          ) : (
            Object.entries({
              active:    filtered.filter(e => e.status === 'active'),
              upcoming:  filtered.filter(e => e.status === 'upcoming'),
              completed: filtered.filter(e => e.status === 'completed'),
            }).filter(([, items]) => items.length > 0).map(([st, items]) => (
              <div key={st}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 10px' }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 600, color: '#8892a4', letterSpacing: 4, textTransform: 'uppercase' }}>
                    {st === 'active' ? '🔴 Live Now' : st === 'upcoming' ? '🔜 Starting Soon' : '✅ Completed'}
                  </div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#44485a' }}>{items.length} event{items.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                  {items.map(ev => <EventCard key={ev.id} ev={ev} onEnter={enterEv} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════ LIVE VIEW ══════════ */}
      {view === 'live' && curEv && (
        <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Top event bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px', background: 'rgba(8,8,22,.94)', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
            <button onClick={() => { setView('lobby'); setCurEv(null); setShowPodium(false); }} style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 1, color: '#8892a4', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 10px', borderRadius: 6 }}>← Lobby</button>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, color: '#ffd700', letterSpacing: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏆 {curEv.name.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {curEv.status === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 700, color: '#ff1744', letterSpacing: 2, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,23,68,.3)', background: 'rgba(255,23,68,.07)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff1744', boxShadow: '0 0 6px #ff1744', animation: 'blink 1s infinite' }} />LIVE
                </div>
              )}
              <div style={{ padding: '3px 12px', borderRadius: 6, textAlign: 'center', background: 'rgba(255,215,0,.07)', border: '1px solid rgba(255,215,0,.18)' }}>
                <div style={{ fontSize: 6, color: '#b8860b', letterSpacing: 2, textTransform: 'uppercase' }}>Prize Pool</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,.35)' }}>{fmtPrize(curEv.prizePool)}</div>
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, color: '#00f5ff', textShadow: '0 0 18px rgba(0,245,255,.35)', letterSpacing: 2, minWidth: 80, textAlign: 'right' }}>{timer}</div>
            </div>
          </div>

          {/* Ticker */}
          <Ticker prices={prices} events={events} />

          {/* Ranking method label */}
          <div style={{ background: 'rgba(0,245,255,.025)', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '3px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, color: '#44485a', letterSpacing: 3, textTransform: 'uppercase' }}>Ranking by</span>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 700, color: '#00f5ff', letterSpacing: 1 }}>{rmLabel(curEv.rankingMethod || 'pnl')}</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'Orbitron',sans-serif", fontSize: 7, color: '#2a2a3a', letterSpacing: 2 }}>
              {curEv.participants.length} TRADERS · {curEv.openPositions.length} OPEN POS
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 16px', background: 'rgba(6,6,18,.94)', borderBottom: '1px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
            {([['race', '🏁 Race'], ['board', '📊 Leaderboard'], ['trades', '⚡ Open Trades']] as [string, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t as 'race' | 'board' | 'trades')} style={tabBtn(t, tab === t)}>{l}</button>
            ))}
          </div>

          {/* Content + Sidebar */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 275px', overflow: 'hidden' }}>

            {/* ── Left panel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* RACE */}
              {tab === 'race' && (
                <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', scrollbarWidth: 'none' }}>
                  {curEv.participants.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <div style={{ fontSize: 40, opacity: .4 }}>👥</div>
                      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#8892a4', letterSpacing: 3 }}>No Participants Yet</div>
                    </div>
                  ) : curEv.participants.map((p, i) => (
                    <RacerRow key={p.userId} p={p} ev={curEv} idx={i} onClick={() => setSelTrader({ p, ev: curEv })} />
                  ))}
                </div>
              )}

              {/* LEADERBOARD */}
              {tab === 'board' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', scrollbarWidth: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 70px 70px', gap: 8, padding: '6px 10px', marginBottom: 4 }}>
                    {['#', 'Trader', 'Equity', 'PnL', 'ROI', 'WR'].map((h, hi) => (
                      <div key={h} style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 600, color: '#44485a', letterSpacing: 2, textTransform: 'uppercase', textAlign: hi === 0 ? 'center' : hi === 1 ? 'left' : 'right' }}>{h}</div>
                    ))}
                  </div>
                  {curEv.participants.map((p, i) => {
                    const noT = p.totalTrades === 0 && !p.isDisqualified;
                    const rkColor = i < 3 ? RANK_COLORS[i] : '#44485a';
                    return (
                      <div key={p.userId} onClick={() => setSelTrader({ p, ev: curEv })} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 70px 70px', gap: 8, alignItems: 'center', padding: '7px 10px', background: i === 0 ? 'rgba(255,215,0,.03)' : 'rgba(10,10,28,.65)', border: `1px solid ${i < 3 ? RANK_COLORS[i] + '1e' : 'rgba(255,255,255,.04)'}`, borderRadius: 8, marginBottom: 4, cursor: 'pointer', opacity: noT ? .55 : p.isDisqualified ? .28 : 1 }}>
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 800, color: rkColor, textAlign: 'center', textShadow: i < 3 ? `0 0 10px ${rkColor}88` : 'none' }}>{p.rank}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Av u={p.username} img={p.profileImage} sz={28} ring={i < 3 ? RANK_COLORS[i] : undefined} />
                          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 600, color: noT ? '#3a3a55' : '#eef0f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
                        </div>
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: '#00f5ff', textAlign: 'right' }}>{fmtC(p.liveEquity)}</div>
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: p.livePnl >= 0 ? '#00e676' : '#ff1744', textAlign: 'right' }}>{noT ? '—' : fmtPnl(p.livePnl)}</div>
                        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: p.liveRoi >= 0 ? '#00e676' : '#ff1744', textAlign: 'right' }}>{noT ? '—' : `${p.liveRoi >= 0 ? '+' : ''}${p.liveRoi.toFixed(1)}%`}</div>
                        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: '#e040fb', textAlign: 'right' }}>{noT ? '—' : `${p.winRate.toFixed(0)}%`}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* OPEN TRADES */}
              {tab === 'trades' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', scrollbarWidth: 'none' }}>
                  {curEv.openPositions.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <div style={{ fontSize: 40, opacity: .4 }}>📭</div>
                      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#8892a4', letterSpacing: 3 }}>No Open Trades</div>
                    </div>
                  ) : curEv.openPositions.map((t, i) => {
                    const isL = t.side === 'long';
                    const dec = (t.symbol || '').includes('JPY') || (t.symbol || '').includes('XAU') ? 2 : 4;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'rgba(10,10,28,.7)', border: '1px solid rgba(255,255,255,.04)', borderRadius: 8, marginBottom: 4 }}>
                        <Av u={t.username} img={t.profileImage} sz={28} />
                        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600, color: '#8892a4', minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.username}</div>
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, color: '#00f5ff', minWidth: 66 }}>{(t.symbol || '').replace('/', '')}</div>
                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, letterSpacing: 1, color: isL ? '#00e676' : '#ff1744', background: isL ? 'rgba(0,230,118,.1)' : 'rgba(255,23,68,.1)', border: `1px solid ${isL ? 'rgba(0,230,118,.2)' : 'rgba(255,23,68,.2)'}` }}>{isL ? 'BUY' : 'SELL'}</span>
                        <div style={{ fontSize: 9, color: '#44485a', flex: 1 }}>
                          <div>Entry: {t.entryPrice.toFixed(dec)}</div>
                          <div>Now:&nbsp; {t.currentPrice.toFixed(dec)}</div>
                        </div>
                        {t.leverage > 1 && <div style={{ fontSize: 9, color: '#44485a', minWidth: 24 }}>{t.leverage}x</div>}
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: t.unrealizedPnl >= 0 ? '#00e676' : '#ff1744', textAlign: 'right', minWidth: 64 }}>{fmtPnl(t.unrealizedPnl)}</div>
                        <div style={{ fontSize: 9, color: '#44485a', minWidth: 28 }}>{tAgo(t.openedAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SIDEBAR ── */}
            <div style={{ background: 'rgba(8,8,22,.92)', borderLeft: '1px solid rgba(255,255,255,.04)', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' }}>

              {/* Arena Stats */}
              {sideStats && curEv && (
                <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 600, color: '#44485a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Arena Stats</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {([
                      [sideStats.total || '—', 'Trades', '#00f5ff'],
                      [curEv.currentParticipants || curEv.participants.length || '—', 'Players', '#00e676'],
                      [fmtPrize(curEv.prizePool), 'Prize', '#ffd700'],
                      [Math.round(sideStats.avgWR) + '%', 'Avg WR', '#e040fb'],
                      [sideStats.totalOP || '—', 'Open Pos', '#ff6d00'],
                      [sideStats.maxDD.toFixed(1) + '%', 'Max DD', '#ff1744'],
                    ] as [string | number, string, string][]).map(([v, l, c]) => (
                      <div key={l} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.04)', borderRadius: 7, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, color: c, marginBottom: 1 }}>{v}</div>
                        <div style={{ fontSize: 7, color: '#44485a', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win Probability */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 600, color: '#44485a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Win Probability ⚡</div>
                {winProbs.length === 0 ? (
                  <div style={{ fontSize: 9, color: '#2a2a45' }}>No active traders</div>
                ) : winProbs.map((p, i) => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <div style={{ width: 60, fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, color: '#8892a4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.04)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${p.prob}%`, background: WR_COLORS[i] || WR_COLORS[WR_COLORS.length - 1], transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ width: 28, fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 600, textAlign: 'right', color: WR_COLORS[i] || WR_COLORS[WR_COLORS.length - 1] }}>{p.prob}%</div>
                  </div>
                ))}
              </div>

              {/* Live Activity */}
              <div style={{ padding: '10px 12px', flex: 1 }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 600, color: '#44485a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9 }}>Live Activity</div>
                {curEv.openPositions.length === 0 ? (
                  <div style={{ fontSize: 9, color: '#2a2a45' }}>No open positions</div>
                ) : curEv.openPositions.slice(0, 12).map((pos, i) => {
                  const isL = pos.side === 'long';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.025)' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: isL ? 'rgba(0,230,118,.12)' : 'rgba(255,23,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                        {isL ? '📈' : '📉'}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: '#8892a4', lineHeight: 1.3 }}>
                          <span style={{ color: '#eef0f6', fontWeight: 600 }}>{pos.username}</span>{' '}
                          {isL ? 'LONG' : 'SHORT'}{' '}
                          <span style={{ color: '#00f5ff' }}>{(pos.symbol || '').replace('/', '')}</span>{' '}
                          <span style={{ color: pos.unrealizedPnl >= 0 ? '#00e676' : '#ff1744' }}>{fmtPnl(pos.unrealizedPnl)}</span>
                        </div>
                        <div style={{ fontSize: 8, color: '#44485a', marginTop: 1 }}>{tAgo(pos.openedAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trader Modal */}
      {selTrader && <TraderModal p={selTrader.p} ev={selTrader.ev} onClose={() => setSelTrader(null)} />}

      {/* Winners Podium */}
      {showPodium && curEv && curEv.winners && curEv.winners.length > 0 && (
        <Podium ev={curEv} onClose={() => setShowPodium(false)} />
      )}

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 26, background: 'rgba(5,5,15,.97)', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: '#44485a', zIndex: 100 }}>
        <span>CHARTVOLT TRADING ARENA · Equity refreshes every 5s · No-trade participants shown at bottom</span>
        <span>chartvolt.com/arena · {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
