'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
type Participant = {
  userId: string; username: string; profileImage: string | null;
  liveEquity: number; livePnl: number; liveRoi: number;
  totalTrades: number; winRate: number; availableCapital: number;
  currentCapital: number; usedMargin: number; currentOpenPositions: number;
  status: string; isDisqualified: boolean; rankValue: number;
  profitFactor: number; rank: number; lastTradeAt: string | null;
  maxDrawdownPercentage: number;
};
type OpenPos = {
  userId: string; username: string; symbol: string; side: string;
  quantity: number; entryPrice: number; unrealizedPnl: number; leverage: number;
};
type ArenaEvent = {
  id: string; type: string; name: string; status: string;
  startTime: string; endTime: string | null; prizePool: number;
  startingCapital: number; currentParticipants: number;
  rankingMethod: string; participants: Participant[]; openPositions: OpenPos[];
};
type Banner = { id: string; text: string; color: string };

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmtPnl = (v: number) => {
  const a = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v >= 0 ? '+' : '-') + '$' + a;
};
const fmtEq = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
const countdown = (end: string | null): string => {
  if (!end) return '--:--';
  const d = new Date(end).getTime() - Date.now();
  if (d <= 0) return '00:00';
  const h = d / 3_600_000; const m = (d % 3_600_000) / 60_000; const s = (d % 60_000) / 1_000;
  return h >= 1 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};
const isClutch = (end: string | null) => {
  if (!end) return false;
  const d = new Date(end).getTime() - Date.now();
  return d > 0 && d < 10 * 60_000;
};
const dangerPct = (p: Participant) =>
  p.currentCapital > 0 ? Math.min((p.usedMargin / p.currentCapital) * 100, 100) : 0;
const getVol = (ps: Participant[]): { label: string; pct: number; color: string } => {
  if (!ps.length) return { label: 'LOW', pct: 18, color: '#10b981' };
  const avg = ps.reduce((a, p) => a + Math.abs(p.livePnl), 0) / ps.length;
  const cap = ps[0]?.currentCapital || 10000;
  const r = (avg / cap) * 100;
  if (r > 2) return { label: 'HIGH', pct: 88, color: '#ef4444' };
  if (r > 0.5) return { label: 'MEDIUM', pct: 52, color: '#f59e0b' };
  return { label: 'LOW', pct: 18, color: '#10b981' };
};
const calcBets = (ps: Participant[]): Array<{ userId: string; pct: number }> => {
  const active = ps.filter(p => !p.isDisqualified);
  if (!active.length) return [];
  const scores = active.map(p => ({
    userId: p.userId,
    s: Math.max(
      (p.liveEquity / (p.currentCapital || 10000)) * 50 +
      (p.winRate / 100) * 25 +
      Math.min(p.profitFactor || 0, 3) * 8 +
      (p.totalTrades > 0 ? 12 : 0), 1,
    ),
  }));
  const total = scores.reduce((a, x) => a + x.s, 0) || 1;
  return scores.map(x => ({ userId: x.userId, pct: Math.round((x.s / total) * 100) }));
};
const playstyle = (p: Participant): string => {
  if (!p.totalTrades) return 'WAITING';
  if (p.totalTrades >= 10) return 'SCALPER';
  if (p.winRate >= 70) return 'SNIPER';
  if (Math.abs(p.livePnl / (p.currentCapital || 10000)) > 0.04) return 'HIGH-RISK';
  return 'SWING';
};
const avatarColor = (name: string) =>
  ['#00d4ff', '#ff6b35', '#7c3aed', '#10b981', '#f59e0b', '#ec4899'][name.charCodeAt(0) % 6];

/* ══════════════════════════════════════════════════════════════
   SVG GAUGE  (stroke-dasharray speedometer, rotate 135°)
══════════════════════════════════════════════════════════════ */
const Gauge = ({ pct, label, color, size = 90 }: { pct: number; label: string; color: string; size?: number }) => {
  const cx = size / 2, cy = size * 0.52, r = size * 0.36;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const fill = arc * Math.min(Math.max(pct / 100, 0), 1);
  const sw = size * 0.085;
  return (
    <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
      <g transform={`rotate(135,${cx},${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0d0d1a" strokeWidth={sw}
          strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
        {fill > 1 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        )}
      </g>
      <text x={cx} y={size * 0.73} textAnchor="middle" fill={color}
        fontSize={size * 0.13} fontWeight="800" fontFamily="var(--font-geist-mono)">{label}</text>
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   SPARKLINE
══════════════════════════════════════════════════════════════ */
const Spark = ({ history, color, w = 100, h = 36 }: { history: number[]; color: string; w?: number; h?: number }) => {
  if (history.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...history), max = Math.max(...history), rng = max - min || 1;
  const p2 = 3;
  const xs = history.map((_, i) => p2 + (i / (history.length - 1)) * (w - p2 * 2));
  const ys = history.map(v => p2 + (1 - (v - min) / rng) * (h - p2 * 2));
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${xs[0].toFixed(1)},${h} ${pts} ${xs[xs.length - 1].toFixed(1)},${h}`;
  const uid = color.replace(/[^a-z0-9]/gi, '').slice(0, 8) + w;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg${uid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   AVATAR
══════════════════════════════════════════════════════════════ */
const Av = ({ p, size = 52, ring }: { p: Participant; size?: number; ring?: string }) => {
  const c = ring || avatarColor(p.username);
  const initials = p.username.slice(0, 2).toUpperCase();
  const inner = p.profileImage
    ? <img src={p.profileImage} alt="" width={size - 6} height={size - 6}
        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: size - 6, height: size - 6, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: `radial-gradient(circle at 32% 32%, ${c}55, ${c}15)`,
        fontFamily: 'var(--font-geist-mono)', fontSize: (size - 6) * 0.36, fontWeight: 700, color: c }}>
        {initials}
      </div>;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', padding: 3, flexShrink: 0,
      background: `conic-gradient(${c}, ${c}44, ${c})`,
      boxShadow: `0 0 ${size * 0.35}px ${c}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {inner}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   DANGER METER (bottom bar of each trader card)
══════════════════════════════════════════════════════════════ */
const DangerMeter = ({ pct, username }: { pct: number; username: string }) => {
  if (pct < 20) return null;
  const color = pct > 70 ? '#ef4444' : pct > 45 ? '#f59e0b' : '#eab308';
  const label = pct > 70 ? '⚠ DANGER ZONE' : '⚡ RISKY';
  const liquidPct = Math.max(0, 100 - pct).toFixed(1);
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${color}44`,
      background: `${color}0a`, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--font-geist-mono)' }}>{label}</span>
        <span style={{ fontSize: 13, color, fontFamily: 'var(--font-geist-mono)', fontWeight: 700 }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 7, background: '#0d0d1a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 1s ease',
          background: pct > 70
            ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
            : `linear-gradient(90deg,${color}88,${color})`,
          boxShadow: pct > 70 ? `0 0 10px #ef444466` : 'none' }} />
      </div>
      {pct > 70 && (
        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>
          % To Liquidation: <strong>{liquidPct}%</strong>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   BATTLE VIEW — 1v1 split screen
══════════════════════════════════════════════════════════════ */
const BattleView = ({
  ev, sparks, clutch,
}: { ev: ArenaEvent; sparks: Record<string, number[]>; clutch: boolean }) => {
  const [a, b] = ev.participants.filter(p => !p.isDisqualified).slice(0, 2);
  if (!a) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#333', fontFamily: 'var(--font-geist-mono)', fontSize: 20, letterSpacing: '0.2em' }}>
      WAITING FOR TRADERS…
    </div>
  );
  const betsArr = calcBets(ev.participants);
  const betA = betsArr.find(x => x.userId === a?.userId)?.pct ?? 50;
  const betB = b ? (betsArr.find(x => x.userId === b.userId)?.pct ?? (100 - betA)) : 0;
  const vol = getVol(ev.participants);

  const Card = ({ p, side, betPct, }: { p: Participant; side: 'left' | 'right'; betPct: number }) => {
    const isL = side === 'left';
    const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
    const history = sparks[p.userId] || [p.liveEquity];
    const dng = dangerPct(p);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 20px',
        background: isL
          ? 'linear-gradient(160deg,#0c1a0c,#050a05)'
          : 'linear-gradient(200deg,#1a0808,#0a0404)',
        borderRadius: isL ? '14px 0 0 14px' : '0 14px 14px 0',
        border: `1px solid ${pnlC}1a`, position: 'relative', overflow: 'hidden',
        boxShadow: `inset 0 0 80px ${pnlC}06` }}>

        {/* Corner glow */}
        <div style={{ position: 'absolute', [isL ? 'left' : 'right']: 0, top: 0, width: 240, height: 240, pointerEvents: 'none',
          background: `radial-gradient(ellipse at ${isL ? '0% 0%' : '100% 0%'},${pnlC}14,transparent 60%)` }} />

        {/* Trader header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          flexDirection: isL ? 'row' : 'row-reverse' }}>
          <div style={{ position: 'relative' }}>
            <Av p={p} size={64} ring={pnlC} />
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14,
              borderRadius: '50%', background: '#00ff88', border: '2px solid #050508',
              boxShadow: '0 0 8px #00ff88aa' }} />
          </div>
          <div style={{ textAlign: isL ? 'left' : 'right' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 22, fontWeight: 900, color: '#fff',
              textShadow: `0 0 15px ${pnlC}55`, letterSpacing: '0.03em' }}>{p.username}</div>
            <div style={{ fontSize: 11, color: pnlC, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
              ▲ {playstyle(p)}
            </div>
          </div>
        </div>

        {/* BIG P&L */}
        <div className="pnl-num" style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 52, fontWeight: 900,
          color: pnlC, lineHeight: 1, textAlign: isL ? 'left' : 'right',
          textShadow: `0 0 30px ${pnlC}99,0 0 60px ${pnlC}44`, letterSpacing: '-0.02em',
          marginBottom: 4 }}>
          {fmtPnl(p.livePnl)}
        </div>
        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: '#555',
          textAlign: isL ? 'left' : 'right', marginBottom: 14 }}>
          Equity: <span style={{ color: '#888' }}>{fmtEq(p.liveEquity)}</span>
          <span style={{ marginLeft: 10, color: p.liveRoi >= 0 ? '#00ff8888' : '#ff336688' }}>
            {p.liveRoi >= 0 ? '+' : ''}{p.liveRoi.toFixed(2)}%
          </span>
        </div>

        {/* Sparkline chart */}
        <div style={{ background: '#080812', borderRadius: 10, padding: 10, marginBottom: 14,
          border: '1px solid #ffffff08', height: 86, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 8 }}>
            <Spark history={history} color={pnlC} w={320} h={70} />
          </div>
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <div key={y} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`,
              height: 1, background: '#ffffff04', pointerEvents: 'none' }} />
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { l: 'TRADES', v: p.totalTrades.toString() },
            { l: 'WIN RATE', v: `${p.winRate.toFixed(0)}%` },
            { l: 'OPEN POS', v: p.currentOpenPositions.toString() },
          ].map(s => (
            <div key={s.l} style={{ background: '#ffffff06', borderRadius: 7, padding: '7px 6px',
              textAlign: 'center', border: '1px solid #ffffff08' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 18, fontWeight: 700, color: '#dde' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Crowd bet bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.12em' }}>CROWD BACKING</span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700, color: pnlC }}>
              {betPct}%
            </span>
          </div>
          <div style={{ height: 7, background: '#0d0d1a', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${betPct}%`, height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg,${pnlC}66,${pnlC})`,
              boxShadow: `0 0 10px ${pnlC}55`, transition: 'width 1.2s ease' }} />
          </div>
        </div>

        <DangerMeter pct={dng} username={p.username} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flex: 1, gap: 0 }}>
      <Card p={a} side="left" betPct={betA} />

      {/* VS divider */}
      <div style={{ width: 88, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(to bottom,transparent,#ff6b3566 30%,#ff6b35 50%,#ff6b3566 70%,transparent)' }} />
        <div style={{ background: '#080812', border: '2px solid #ff6b3555', borderRadius: '50%',
          width: 58, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-geist-mono)', fontSize: 18, fontWeight: 900, color: '#ff6b35',
          zIndex: 1, boxShadow: '0 0 24px #ff6b3544', letterSpacing: '0.05em' }}>
          VS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <Gauge pct={vol.pct} label={vol.label} color={vol.color} size={82} />
          <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.12em', marginTop: -2 }}>VOLATILITY</div>
        </div>
        {/* Live trade counter */}
        <div style={{ background: '#0a0a18', borderRadius: 8, padding: '6px 10px', textAlign: 'center', zIndex: 1,
          border: '1px solid #ffffff0a' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>
            {ev.openPositions.length}
          </div>
          <div style={{ fontSize: 8, color: '#333', letterSpacing: '0.1em' }}>OPEN</div>
        </div>
      </div>

      {b ? <Card p={b} side="right" betPct={betB} /> : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#222', fontFamily: 'var(--font-geist-mono)' }}>
          WAITING FOR OPPONENT
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   CHAMPIONSHIP VIEW — multi-trader leaderboard
══════════════════════════════════════════════════════════════ */
const ChampionshipView = ({
  ev, sparks,
}: { ev: ArenaEvent; sparks: Record<string, number[]> }) => {
  const active = ev.participants.filter(p => !p.isDisqualified && p.totalTrades > 0);
  const betsArr = calcBets(active);
  const maxBet = betsArr.length ? Math.max(...betsArr.map(x => x.pct)) : 0;
  const medals: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
  const rankC: Record<number, string> = { 0: '#ffd700', 1: '#c0c0c0', 2: '#cd7f32' };

  return (
    <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>
      {/* ── Leaderboard ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'auto',
        scrollbarWidth: 'none' }}>
        <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.18em', marginBottom: 6,
          fontFamily: 'var(--font-geist-mono)' }}>LIVE LEADERBOARD</div>

        {active.map((p, i) => {
          const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
          const rc = rankC[i] || '#475569';
          const history = sparks[p.userId] || [p.liveEquity];
          const betPct = betsArr.find(x => x.userId === p.userId)?.pct ?? 0;
          const isTopBet = betPct === maxBet && betPct > 0;
          const dng = dangerPct(p);
          return (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 9,
              background: i === 0 ? 'linear-gradient(135deg,#1a140005,#0a080099)' : '#090912',
              border: i === 0 ? '1px solid #ffd70022' : `1px solid ${dng > 70 ? '#ef444422' : '#ffffff07'}`,
              boxShadow: i === 0 ? '0 0 20px #ffd70008' : dng > 70 ? '0 0 12px #ef444411' : 'none',
              transition: 'all 0.4s ease', animation: dng > 70 ? 'dangerFlash 2s ease-in-out infinite' : 'none' }}>

              {/* Rank */}
              <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                {i < 3
                  ? <span style={{ fontSize: 22 }}>{medals[i]}</span>
                  : <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700, color: rc }}>
                      #{i + 1}
                    </span>}
              </div>

              <Av p={p} size={40} ring={rc} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700,
                  color: i === 0 ? '#ffd700' : '#dde', whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis', textShadow: i === 0 ? '0 0 10px #ffd70055' : 'none' }}>
                  {p.username}
                </div>
                <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.08em' }}>{playstyle(p)}</div>
              </div>

              <Spark history={history} color={pnlC} w={84} h={30} />

              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 88 }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700,
                  color: pnlC, textShadow: `0 0 8px ${pnlC}55` }}>{fmtPnl(p.livePnl)}</div>
                <div style={{ fontSize: 10, color: '#444' }}>
                  {p.winRate.toFixed(0)}% WR · {p.totalTrades}T
                </div>
              </div>

              {isTopBet && (
                <div style={{ flexShrink: 0, padding: '2px 8px',
                  background: '#ffd70018', border: '1px solid #ffd70033',
                  borderRadius: 10, fontSize: 11, color: '#ffd700', fontWeight: 700,
                  fontFamily: 'var(--font-geist-mono)' }}>{betPct}%</div>
              )}
            </div>
          );
        })}

        {/* Awaiting traders */}
        {ev.participants.filter(p => !p.isDisqualified && !p.totalTrades).map(p => (
          <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 9, background: '#06060e',
            border: '1px solid #ffffff04', opacity: 0.4 }}>
            <div style={{ width: 36 }} />
            <Av p={p} size={30} />
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: '#333' }}>{p.username}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2a2a3a', letterSpacing: '0.1em' }}>AWAITING FIRST TRADE</span>
          </div>
        ))}

        {/* Disqualified */}
        {ev.participants.filter(p => p.isDisqualified).map(p => (
          <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 9, background: '#0a0606',
            border: '1px solid #ef444415', opacity: 0.5 }}>
            <div style={{ width: 36, textAlign: 'center', fontSize: 16 }}>💀</div>
            <Av p={p} size={30} />
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: '#333' }}>{p.username}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ef444466', letterSpacing: '0.1em' }}>DISQUALIFIED</span>
          </div>
        ))}
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Crowd betting */}
        <div style={{ background: '#08080f', borderRadius: 10, padding: 14,
          border: '1px solid #ffffff08' }}>
          <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.18em', marginBottom: 12,
            fontFamily: 'var(--font-geist-mono)' }}>CROWD BACKING</div>
          {betsArr.slice(0, 5).map(b => {
            const p = active.find(x => x.userId === b.userId);
            if (!p) return null;
            const pnlC = p.livePnl >= 0 ? '#00ff88' : '#ff3366';
            return (
              <div key={b.userId} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: '#888', fontFamily: 'var(--font-geist-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {p.username}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: pnlC,
                    fontFamily: 'var(--font-geist-mono)' }}>{b.pct}%</span>
                </div>
                <div style={{ height: 5, background: '#0d0d1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 3,
                    background: `linear-gradient(90deg,${pnlC}55,${pnlC})`,
                    boxShadow: `0 0 6px ${pnlC}44`, transition: 'width 1.2s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Open positions */}
        <div style={{ background: '#08080f', borderRadius: 10, padding: 14,
          border: '1px solid #ffffff08', flex: 1, overflow: 'hidden', display: 'flex',
          flexDirection: 'column' }}>
          <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.18em', marginBottom: 10,
            fontFamily: 'var(--font-geist-mono)' }}>OPEN POSITIONS</div>
          <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'none', display: 'flex',
            flexDirection: 'column', gap: 6 }}>
            {ev.openPositions.slice(0, 8).map((pos, i) => {
              const c = pos.side === 'long' ? '#00ff88' : '#ff3366';
              return (
                <div key={i} style={{ padding: '6px 8px', background: '#0d0d1a', borderRadius: 7,
                  border: `1px solid ${c}14` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#666', fontFamily: 'var(--font-geist-mono)' }}>{pos.symbol}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c, letterSpacing: '0.1em' }}>
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
                    {pos.username} · {pos.leverage}x · {pos.quantity}L
                  </div>
                </div>
              );
            })}
            {!ev.openPositions.length && (
              <div style={{ color: '#222', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
                No open positions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   PRICE TICKER
══════════════════════════════════════════════════════════════ */
const Ticker = ({ prices, positions }: { prices: Record<string, any>; positions: OpenPos[] }) => {
  const pairs = Object.entries(prices).slice(0, 10)
    .map(([sym, p]) => `${sym}  ${p.bid?.toFixed(5) ?? '—'} / ${p.ask?.toFixed(5) ?? '—'}`);
  const trades = positions.slice(0, 6)
    .map(p => `${p.username} ${p.side === 'long' ? '▲' : '▼'} ${p.symbol} ${p.leverage}x`);
  const items = [...pairs, ...trades];
  if (!items.length) return null;
  const full = [...items, ...items];
  return (
    <div style={{ height: 34, background: '#07070e', borderTop: '1px solid #ffffff08',
      display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '0 12px', borderRight: '1px solid #ffffff0a', fontSize: 10,
        color: '#00d4ff', letterSpacing: '0.15em', whiteSpace: 'nowrap', flexShrink: 0,
        fontFamily: 'var(--font-geist-mono)' }}>◉ LIVE</div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ticker-move" style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap',
          fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#555' }}>
          {full.map((s, i) => <span key={i} style={{ flexShrink: 0 }}>{s}</span>)}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function StreamPage() {
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>(null);
  const [curIdx, setCurIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [tick, setTick] = useState(0);

  const sparksRef = useRef<Record<string, number[]>>({});
  const prevRankRef = useRef<Record<string, number>>({});
  const prevPnlRef = useRef<Record<string, number>>({});

  const addBanner = useCallback((text: string, color: string) => {
    const b: Banner = { id: `${Date.now()}-${Math.random()}`, text, color };
    setBanners(prev => [...prev.slice(-3), b]);
    setTimeout(() => setBanners(prev => prev.filter(x => x.id !== b.id)), 5500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/competitions', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      const all: ArenaEvent[] = [
        ...(d.competitions || []),
        ...(d.challenges || []),
      ].filter((e: ArenaEvent) => e.status === 'active');

      all.forEach(ev => {
        ev.participants.forEach(p => {
          const k = `${ev.id}:${p.userId}`;
          if (!sparksRef.current[k]) sparksRef.current[k] = [];
          sparksRef.current[k].push(p.liveEquity);
          if (sparksRef.current[k].length > 40) sparksRef.current[k].shift();

          const prevRank = prevRankRef.current[p.userId];
          if (prevRank && p.rank < prevRank && p.rank <= 3)
            addBanner(`🏆 ${p.username} TAKES #${p.rank}!`, '#ffd700');

          const prevPnl = prevPnlRef.current[p.userId];
          if (prevPnl !== undefined) {
            const delta = p.livePnl - prevPnl;
            if (Math.abs(delta) > 100)
              addBanner(`🔥 BIG MOVE: ${p.username} ${delta > 0 ? '+' : ''}$${Math.abs(delta).toFixed(2)}`,
                delta > 0 ? '#00ff88' : '#ff3366');
          }
          prevRankRef.current[p.userId] = p.rank;
          prevPnlRef.current[p.userId] = p.livePnl;
        });
      });

      setEvents(all);
      if (d.prices) setPrices(d.prices);
      if (d.stats) setStats(d.stats);
      setLoading(false);
    } catch { /* silent */ }
  }, [addBanner]);

  // 5-second poll + page visibility pause
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

  // 1-second tick for countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-cycle events
  useEffect(() => {
    if (events.length <= 1) return;
    const iv = setInterval(() => setCurIdx(i => (i + 1) % events.length), 30000);
    return () => clearInterval(iv);
  }, [events.length]);

  const curEv = events[curIdx] || null;
  const clutch = curEv ? isClutch(curEv.endTime) : false;
  const vol = curEv ? getVol(curEv.participants) : { label: 'LOW', pct: 18, color: '#10b981' };
  const isBattle = curEv ? (curEv.type === 'challenge' || curEv.participants.length <= 2) : false;
  const allPositions = events.flatMap(e => e.openPositions);

  // Build sparklines for current event
  const sparks: Record<string, number[]> = {};
  if (curEv) {
    curEv.participants.forEach(p => {
      sparks[p.userId] = sparksRef.current[`${curEv.id}:${p.userId}`] || [p.liveEquity];
    });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{width:100%;height:100%;overflow:hidden;background:#050508}

        @keyframes livePulse{0%,100%{opacity:1;box-shadow:0 0 8px #ef4444}50%{opacity:0.55;box-shadow:0 0 2px #ef4444}}
        @keyframes clutchPulse{0%,100%{opacity:1;text-shadow:0 0 20px #ef444499}50%{opacity:0.8;text-shadow:0 0 40px #ef4444cc}}
        @keyframes dangerFlash{0%,100%{border-color:#ef444422;box-shadow:0 0 20px #ef444408}50%{border-color:#ef444488;box-shadow:0 0 30px #ef444422}}
        @keyframes bannerIn{0%{opacity:0;transform:translateY(-16px) scale(0.95)}15%,85%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-8px)}}
        @keyframes embers{0%{opacity:0.85;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-90px) translateX(15px) scale(0.2)}}
        @keyframes pnlFlash{0%{opacity:0.5;transform:scale(0.97)}60%{opacity:1;transform:scale(1.015)}100%{opacity:1;transform:scale(1)}}
        @keyframes tickerMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes leaderGlow{0%,100%{box-shadow:0 0 12px #ffd70015}50%{box-shadow:0 0 24px #ffd70030}}
        @keyframes clutchBorder{0%,100%{box-shadow:inset 0 0 50px #ef444409,0 0 0 2px #ef444433}50%{box-shadow:inset 0 0 80px #ef444415,0 0 0 3px #ef4444aa}}

        .live-badge{animation:livePulse 1.5s ease-in-out infinite}
        .clutch-timer{animation:clutchPulse 0.7s ease-in-out infinite}
        .pnl-num{animation:pnlFlash 0.5s ease}
        .banner-in{animation:bannerIn 5.5s ease forwards}
        .ticker-move{animation:tickerMove 45s linear infinite}
        .leader-row{animation:leaderGlow 2.5s ease-in-out infinite}
        .clutch-border{animation:clutchBorder 1s ease-in-out infinite}
        ::-webkit-scrollbar{width:0;height:0}
      ` }} />

      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        background: clutch
          ? 'radial-gradient(ellipse at 50% 110%,#1a000514,#050508 55%)'
          : 'radial-gradient(ellipse at 15% 50%,#06020f14,#050508 55%), radial-gradient(ellipse at 85% 50%,#0f020614,#050508 55%)',
        fontFamily: 'var(--font-geist-sans)', color: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>

        {/* ── Ember particles ── */}
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0,
            width: 3 + (i % 3), height: 3 + (i % 3), borderRadius: '50%',
            background: ['#ff6b35', '#ff3366', '#ffd700', '#ff9500'][i % 4],
            left: `${4 + (i * 5.8) % 92}%`,
            bottom: `${(i * 7) % 35}%`,
            opacity: 0,
            animation: `embers ${3.5 + (i % 4) * 0.8}s ease-in ${(i * 0.45) % 3.5}s infinite` }} />
        ))}

        {/* ═══════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════ */}
        <div style={{ height: 68, flexShrink: 0, background: 'linear-gradient(180deg,#0b0b1a,#07070f)',
          borderBottom: '1px solid #ffffff0c', display: 'flex', alignItems: 'center',
          gap: 14, padding: '0 18px', position: 'relative', zIndex: 10 }}>

          {/* LIVE badge */}
          <div className="live-badge" style={{ padding: '4px 11px', borderRadius: 4,
            background: '#ef444418', border: '1px solid #ef4444', fontSize: 11,
            fontWeight: 700, color: '#ef4444', letterSpacing: '0.22em',
            fontFamily: 'var(--font-geist-mono)', flexShrink: 0 }}>● LIVE</div>

          {/* Competition name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 700,
              color: '#dde', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {curEv?.name || 'CHARTVOLT TRADING ARENA'}
            </div>
            <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.12em', marginTop: 1 }}>
              {stats?.activePlayers || 0} TRADERS · {events.length} ACTIVE EVENT{events.length !== 1 ? 'S' : ''}
              {curEv && <span style={{ marginLeft: 8, color: '#2a4' }}>
                {curEv.rankingMethod.toUpperCase()} COMPETITION
              </span>}
            </div>
          </div>

          {/* Volatility gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <Gauge pct={vol.pct} label={vol.label} color={vol.color} size={68} />
            <div style={{ fontSize: 8, color: '#282840', letterSpacing: '0.12em', marginTop: -4 }}>VOLATILITY</div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 36, background: '#ffffff08', flexShrink: 0 }} />

          {/* Countdown */}
          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 110 }}>
            <div className={clutch ? 'clutch-timer' : ''} style={{ fontFamily: 'var(--font-geist-mono)',
              fontSize: clutch ? 34 : 30, fontWeight: 900, lineHeight: 1,
              color: clutch ? '#ef4444' : '#ffd700',
              textShadow: clutch ? '0 0 24px #ef444488' : '0 0 14px #ffd70066' }}>
              {curEv ? countdown(curEv.endTime) : '--:--'}
            </div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', marginTop: 2,
              color: clutch ? '#ef4444aa' : '#444' }}>
              {clutch ? '⚡ CLUTCH TIME' : 'TIME REMAINING'}
            </div>
          </div>

          <div style={{ width: 1, height: 36, background: '#ffffff08', flexShrink: 0 }} />

          {/* Prize pool */}
          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 90 }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 20, fontWeight: 800,
              color: '#ffd700', textShadow: '0 0 12px #ffd70055' }}>
              ${(curEv?.prizePool || stats?.totalPrizePool || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>PRIZE POOL</div>
          </div>

          {/* Open trades */}
          <div style={{ padding: '6px 12px', background: '#0a0a18', borderRadius: 8,
            border: '1px solid #ffffff08', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 18, fontWeight: 700, color: '#00d4ff' }}>
              {stats?.openPositions || 0}
            </div>
            <div style={{ fontSize: 8, color: '#333', letterSpacing: '0.1em' }}>OPEN TRADES</div>
          </div>

          {/* Event dots */}
          {events.length > 1 && (
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {events.map((_, i) => (
                <button key={i} onClick={() => setCurIdx(i)} style={{ width: 7, height: 7,
                  borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                  background: i === curIdx ? '#00d4ff' : '#222',
                  boxShadow: i === curIdx ? '0 0 6px #00d4ff' : 'none' }} />
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            MAIN CONTENT
        ═══════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-geist-mono)', fontSize: 18, color: '#222', letterSpacing: '0.2em' }}>
              LOADING ARENA DATA…
            </div>
          ) : !curEv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 56 }}>🏟️</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 22, color: '#1e1e30', letterSpacing: '0.2em' }}>
                NO ACTIVE EVENTS
              </div>
              <div style={{ fontSize: 13, color: '#161624' }}>Waiting for competitions to begin…</div>
            </div>
          ) : isBattle ? (
            <BattleView ev={curEv} sparks={sparks} clutch={clutch} />
          ) : (
            <ChampionshipView ev={curEv} sparks={sparks} />
          )}
        </div>

        {/* ── Clutch border overlay ── */}
        {clutch && (
          <div className="clutch-border" style={{ position: 'absolute', inset: 0,
            pointerEvents: 'none', zIndex: 50, borderRadius: 0 }} />
        )}
        {clutch && (
          <div style={{ position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
            padding: '5px 22px', background: '#ef444418', border: '1px solid #ef4444aa',
            borderRadius: 5, fontFamily: 'var(--font-geist-mono)', fontSize: 12, fontWeight: 700,
            color: '#ef4444', letterSpacing: '0.22em', zIndex: 55, pointerEvents: 'none',
            boxShadow: '0 0 20px #ef444433' }}>
            ⚡ CLUTCH TIME — FINAL STRETCH
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PRICE TICKER
        ═══════════════════════════════════════════════════════ */}
        <Ticker prices={prices} positions={allPositions} />

        {/* ═══════════════════════════════════════════════════════
            NOTIFICATION BANNERS
        ═══════════════════════════════════════════════════════ */}
        <div style={{ position: 'absolute', top: 76, right: 16, display: 'flex', flexDirection: 'column',
          gap: 8, zIndex: 100, pointerEvents: 'none' }}>
          {banners.map(b => (
            <div key={b.id} className="banner-in" style={{ padding: '10px 18px', borderRadius: 8,
              background: `${b.color}18`, border: `1px solid ${b.color}66`,
              boxShadow: `0 0 24px ${b.color}33`,
              fontFamily: 'var(--font-geist-mono)', fontSize: 14, fontWeight: 700,
              color: b.color, letterSpacing: '0.05em', backdropFilter: 'blur(10px)' }}>
              {b.text}
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
