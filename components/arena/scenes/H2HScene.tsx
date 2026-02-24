'use client';
// ─── H2HScene — Head-to-Head Challenge View ──────────────────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV } from '../constants';
import { ranked, fmt, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, riskLevel, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';
import { getTier } from '../constants';

interface H2HSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

/** Single trader column for H2H */
const TraderColumn: React.FC<{ p: Participant; rank: number; startCap: number; side: 'left' | 'right' }> = ({
  p, rank, startCap, side,
}) => {
  const roi = calcRoi(p.liveEquity, startCap);
  const tier = getTier(rank);
  const pf = calcProfitFactor(p.averageWin, p.averageLoss, p.winningTrades, p.losingTrades);
  const risk = riskLevel(p, startCap);
  const title = getTraderTitle(p, startCap);
  const align = side === 'left' ? 'flex-end' : 'flex-start';
  const txtAlign = side === 'left' ? ('right' as const) : ('left' as const);

  return (
    <div style={{ flex: 1, textAlign: txtAlign }}>
      <div style={{ display: 'flex', justifyContent: align, marginBottom: 8 }}>
        <Avatar src={p.profileImage} name={p.username} size={72} rank={rank} showRank glow={tier.border} bobbing />
      </div>
      <div style={{ color: CV.txt, fontSize: 20, fontWeight: 700 }}>{p.username}</div>
      <div style={{ color: tier.tagColor, fontSize: 12, marginTop: 2 }}>
        {title.emoji} {title.title}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 16 }}>
        {[
          { label: 'Equity', value: fmt(p.liveEquity), color: CV.teal },
          { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
          { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red },
          { label: 'Win Rate', value: `${p.winRate.toFixed(1)}%`, color: p.winRate > 50 ? CV.teal : CV.red },
          { label: 'Trades', value: `${p.totalTrades}`, color: CV.txt },
          { label: 'Profit Factor', value: pf === Infinity ? '∞' : pf.toFixed(2), color: pf > 1 ? CV.teal : CV.red },
          { label: 'Max DD', value: `${p.maxDrawdownPercentage.toFixed(1)}%`, color: CV.red },
          { label: 'Risk', value: risk.label, color: risk.color },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
            gap: 10, padding: '5px 0', borderBottom: `1px solid ${CV.bd0}`,
          }}>
            {side === 'left' && <span style={{ color: s.color || CV.txt, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{s.value}</span>}
            <span style={{ color: CV.gray, fontSize: 12 }}>{s.label}</span>
            {side === 'right' && <span style={{ color: s.color || CV.txt, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{s.value}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const H2HScene: React.FC<H2HSceneProps> = ({ event }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const a = sorted[0];
  const b = sorted[1];

  if (!a || !b) {
    return (
      <div style={{ color: CV.gray, textAlign: 'center', padding: 60 }}>
        Need at least 2 racers for Head-to-Head
      </div>
    );
  }

  const aRoi = calcRoi(a.liveEquity, event.startingCapital);
  const bRoi = calcRoi(b.liveEquity, event.startingCapital);
  const total = Math.abs(aRoi) + Math.abs(bRoi) || 1;
  const aPct = (Math.abs(aRoi) / total) * 100;

  return (
    <div style={{
      background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
      padding: 32, overflow: 'hidden',
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span style={{ color: CV.gold, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
          ⚔️ HEAD TO HEAD
        </span>
      </div>

      {/* Tug of war bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          height: 8, borderRadius: 4, overflow: 'hidden',
          background: CV.bg3, display: 'flex',
        }}>
          <div style={{
            width: `${aRoi >= 0 ? Math.max(aPct, 10) : 10}%`,
            background: `linear-gradient(90deg, ${CV.teal}, ${CV.blue})`,
            borderRadius: '4px 0 0 4px',
            transition: 'width 1s ease-out',
          }} />
          <div style={{
            flex: 1,
            background: `linear-gradient(90deg, ${CV.red}, ${CV.oran})`,
            borderRadius: '0 4px 4px 0',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: CV.teal, fontSize: 11, fontWeight: 600 }}>{a.username}</span>
          <span style={{ color: CV.red, fontSize: 11, fontWeight: 600 }}>{b.username}</span>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <TraderColumn p={a} rank={1} startCap={event.startingCapital} side="left" />

        {/* VS divider */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 30,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${CV.gold}30, ${CV.red}30)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${CV.gold}`,
            fontSize: 20, fontWeight: 900, color: CV.gold,
          }}>
            VS
          </div>
          <div style={{ width: 1, height: 200, background: `linear-gradient(180deg, ${CV.gold}40, transparent)` }} />
        </div>

        <TraderColumn p={b} rank={2} startCap={event.startingCapital} side="right" />
      </div>
    </div>
  );
};

export default H2HScene;
