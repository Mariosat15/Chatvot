'use client';
// ─── OverviewScene — Premium Live Dashboard ──────────────────────────────────
import React from 'react';
import type { AEvent, PriceMap, CandleData, BubbleTrade } from '../types';
import { CV } from '../constants';
import { fmtEquity, ranked, calcRoi, fmtRoi, timeLeft, getAllPositions } from '../helpers';
import DerbyTrack from '../DerbyTrack';
import Leaderboard from '../Leaderboard';
import BroadcastChart from '../BroadcastChart';
import type { Participant } from '../types';

interface OverviewSceneProps {
  event: AEvent;
  prices: PriceMap;
  prevPrices?: PriceMap;
  previousEquities: Map<string, number>;
  chartSymbol: string;
  chartTf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  /** Dynamic symbols from API */
  availableSymbols?: string[];
  onSymbolChange: (s: string) => void;
  onTfChange: (tf: string) => void;
  onSelectTrader: (p: Participant) => void;
}

const OverviewScene: React.FC<OverviewSceneProps> = ({
  event, previousEquities, chartSymbol, chartTf,
  candles, bubbles, availableSymbols, onSymbolChange, onTfChange, onSelectTrader,
}) => {
  const sorted = ranked(event.participants);
  const leader = sorted[0];
  const positions = getAllPositions(event.participants);
  const tl = timeLeft(event.endDate);

  const statCards = [
    {
      label: 'PRIZE POOL', emoji: '💰',
      value: fmtEquity(event.prizePool),
      color: CV.gold, glow: `${CV.gold}15`,
    },
    {
      label: 'RACERS', emoji: '🏇',
      value: `${event.currentParticipants}`,
      color: CV.blue, glow: `${CV.blue}12`,
    },
    {
      label: 'TIME LEFT', emoji: '⏱️',
      value: tl,
      color: tl === 'Ended' ? CV.red : CV.teal,
      glow: tl === 'Ended' ? `${CV.red}12` : `${CV.teal}12`,
    },
    {
      label: 'ACTIVE TRADES', emoji: '📊',
      value: `${positions.length}`,
      color: CV.purp, glow: `${CV.purp}12`,
    },
    {
      label: 'LEADER', emoji: '👑',
      value: leader ? leader.username.slice(0, 10) : '—',
      sub: leader ? fmtRoi(calcRoi(leader.liveEquity, event.startingCapital)) : '',
      color: CV.gold, glow: `${CV.gold}15`,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top banner stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{
            background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
            borderRadius: 14, padding: '14px 14px',
            border: `1px solid ${CV.glassBorder}`,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 2px 16px rgba(0,0,0,.15)`,
            transition: 'all .2s',
          }}>
            {/* Glow accent */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '60%', height: 1,
              background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)`,
            }} />

            <div style={{
              color: CV.gray, fontSize: 9, marginBottom: 6, letterSpacing: 1, fontWeight: 600,
            }}>
              {s.emoji} {s.label}
            </div>
            <div style={{
              color: s.color, fontSize: 18, fontWeight: 800,
              fontFamily: '"SF Mono", Consolas, monospace',
              textShadow: `0 0 12px ${s.glow}`,
            }}>
              {s.value}
            </div>
            {s.sub && (
              <div style={{
                color: s.color, fontSize: 11, fontWeight: 600, marginTop: 2,
                fontFamily: '"SF Mono", Consolas, monospace', opacity: .8,
              }}>
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main area: Track + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Derby Track */}
          <DerbyTrack
            event={event}
            previousEquities={previousEquities}
            onSelectTrader={onSelectTrader}
          />

          {/* Chart with position markers */}
          <BroadcastChart
            symbol={chartSymbol}
            tf={chartTf}
            candles={candles}
            bubbles={bubbles}
            positions={positions}
            dynamicSymbols={availableSymbols}
            onSymbolChange={onSymbolChange}
            onTfChange={onTfChange}
          />
        </div>

        {/* Leaderboard */}
        <Leaderboard event={event} onSelectTrader={onSelectTrader} />
      </div>
    </div>
  );
};

export default OverviewScene;
