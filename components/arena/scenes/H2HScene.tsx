'use client';
// ─── H2HScene — Premium Head-to-Head Derby Duel ─────────────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV, getTier } from '../constants';
import { ranked, fmtEquity, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, riskLevel, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';
import ArenaIcon from '../ArenaIcon';

interface H2HSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const mono = '"SF Mono", Consolas, "Courier New", monospace';

/** Single trader column for H2H */
const TraderColumn: React.FC<{ p: Participant; rank: number; startCap: number; side: 'left' | 'right'; accent: string }> = ({
  p, rank, startCap, side, accent,
}) => {
  const roi = calcRoi(p.liveEquity, startCap);
  const tier = getTier(rank);
  const pf = calcProfitFactor(p.averageWin, p.averageLoss, p.winningTrades, p.losingTrades);
  const risk = riskLevel(p, startCap);
  const title = getTraderTitle(p, startCap);
  const align = side === 'left' ? 'flex-end' : 'flex-start';
  const txtAlign = side === 'left' ? ('right' as const) : ('left' as const);

  const stats = [
    { label: 'Equity', value: fmtEquity(p.liveEquity), color: CV.teal },
    { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
    { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red },
    { label: 'Win Rate', value: `${p.winRate.toFixed(1)}%`, color: p.winRate > 50 ? CV.teal : CV.red },
    { label: 'Trades', value: `${p.totalTrades}`, color: CV.txt },
    { label: 'P.Factor', value: pf === Infinity ? '∞' : pf.toFixed(2), color: pf > 1 ? CV.teal : CV.red },
    { label: 'Max DD', value: `${p.maxDrawdownPercentage.toFixed(1)}%`, color: CV.red },
    { label: 'Risk', value: risk.label, color: risk.color },
  ];

  return (
    <div style={{
      flex: 1, textAlign: txtAlign,
      animation: side === 'left' ? 'slideInFromLeft .5s ease-out' : 'slideInFromRight .5s ease-out',
    }}>
      {/* Avatar area */}
      <div style={{
        display: 'flex', justifyContent: align, marginBottom: 10,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          [side === 'left' ? 'right' : 'left']: 20,
          top: '50%', transform: 'translateY(-50%)',
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}15, transparent)`,
          filter: 'blur(20px)', pointerEvents: 'none',
        }} />
        <Avatar src={p.profileImage} name={p.username} size={72} rank={rank} showRank glow={tier.border} bobbing />
      </div>

      <div style={{ color: CV.txt, fontSize: 20, fontWeight: 700, textShadow: `0 0 20px ${accent}15` }}>
        {p.username}
      </div>
      <div style={{ color: accent, fontSize: 12, marginTop: 2, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: align, gap: 4 }}>
        <ArenaIcon name={title.icon} size={12} color={accent} /> {title.title}
      </div>

      {/* Tier badge */}
      <div style={{
        display: 'inline-block', background: tier.tag, color: tier.tagColor,
        padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, marginTop: 6,
        border: `1px solid ${tier.border}20`,
      }}>
        {tier.tagLabel}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
            gap: 10, padding: '6px 0', borderBottom: `1px solid ${CV.bd0}40`,
          }}>
            {side === 'left' && (
              <span style={{ color: s.color, fontSize: 13, fontWeight: 600, fontFamily: mono }}>{s.value}</span>
            )}
            <span style={{ color: CV.gray, fontSize: 12 }}>{s.label}</span>
            {side === 'right' && (
              <span style={{ color: s.color, fontSize: 13, fontWeight: 600, fontFamily: mono }}>{s.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Open positions mini list */}
      {p.openPositions && p.openPositions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5, marginBottom: 6, fontWeight: 600 }}>
            POSITIONS
          </div>
          {p.openPositions.slice(0, 3).map((pos, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start', gap: 6,
              padding: '3px 0', fontSize: 10,
            }}>
              <span style={{ color: CV.lgt }}>{pos.symbol}</span>
              <span style={{ color: pos.side === 'long' ? CV.teal : CV.red, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                <ArenaIcon name={pos.side === 'long' ? 'ArrowUp' : 'ArrowDown'} size={10} color={pos.side === 'long' ? CV.teal : CV.red} />
              </span>
              <span style={{ color: pos.unrealizedPnl >= 0 ? CV.teal : CV.red, fontFamily: mono, fontWeight: 600 }}>
                {fmtPnl(pos.unrealizedPnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const H2HScene: React.FC<H2HSceneProps> = ({ event }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const a = sorted[0];
  const b = sorted[1];

  if (!a || !b) {
    return (
      <div style={{
        color: CV.gray, textAlign: 'center', padding: 60,
        background: CV.bg2, borderRadius: 18, border: `1px solid ${CV.bd1}`,
      }}>
        Need at least 2 racers for Head-to-Head
      </div>
    );
  }

  const aRoi = calcRoi(a.liveEquity, event.startingCapital);
  const bRoi = calcRoi(b.liveEquity, event.startingCapital);
  const aAbs = Math.abs(aRoi);
  const bAbs = Math.abs(bRoi);
  const total = aAbs + bAbs || 1;
  const aPct = Math.max(15, Math.min(85, (aAbs / total) * 100));
  const leader = aRoi >= bRoi ? 'left' : 'right';

  return (
    <div style={{
      background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
      borderRadius: 18,
      border: `1px solid ${CV.bd2}`,
      padding: 32, overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(90deg, ${CV.teal}06, transparent 30%, transparent 70%, ${CV.red}06)`,
      }} />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
        <span style={{
          color: CV.gold, fontSize: 20, fontWeight: 800, letterSpacing: 3,
          textShadow: `0 0 20px ${CV.gold}20`,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <ArenaIcon name="Swords" size={22} color={CV.gold} /> HEAD TO HEAD
        </span>
      </div>

      {/* Tug of war bar */}
      <div style={{ marginBottom: 28, position: 'relative' }}>
        <div style={{
          height: 10, borderRadius: 5, overflow: 'hidden',
          background: CV.bg3, display: 'flex',
          boxShadow: `inset 0 0 10px rgba(0,0,0,.4)`,
        }}>
          <div style={{
            width: `${leader === 'left' ? aPct : 100 - aPct}%`,
            background: `linear-gradient(90deg, ${CV.teal}, ${CV.blue})`,
            borderRadius: '5px 0 0 5px',
            transition: 'width 1.5s ease-out',
            boxShadow: `0 0 12px ${CV.teal}40`,
          }} />
          <div style={{
            flex: 1,
            background: `linear-gradient(90deg, ${CV.oran}, ${CV.red})`,
            borderRadius: '0 5px 5px 0',
            boxShadow: `0 0 12px ${CV.red}40`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ color: CV.teal, fontSize: 12, fontWeight: 700 }}>
            {a.username} ({fmtRoi(aRoi)})
          </span>
          <span style={{ color: CV.red, fontSize: 12, fontWeight: 700 }}>
            {b.username} ({fmtRoi(bRoi)})
          </span>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', position: 'relative' }}>
        <TraderColumn p={a} rank={1} startCap={event.startingCapital} side="left" accent={CV.teal} />

        {/* VS divider */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          paddingTop: 20, flexShrink: 0,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `linear-gradient(135deg, ${CV.gold}18, ${CV.red}18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${CV.gold}`,
            fontSize: 18, fontWeight: 900, color: CV.gold,
            boxShadow: `0 0 25px ${CV.gold}20`,
            animation: 'glowPulse 3s ease-in-out infinite',
          }}>
            VS
          </div>
          <div style={{
            width: 2, height: 220,
            background: `linear-gradient(180deg, ${CV.gold}40, ${CV.gold}10, transparent)`,
          }} />
        </div>

        <TraderColumn p={b} rank={2} startCap={event.startingCapital} side="right" accent={CV.red} />
      </div>
    </div>
  );
};

export default H2HScene;
