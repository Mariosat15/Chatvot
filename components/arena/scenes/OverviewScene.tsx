'use client';
// ─── OverviewScene — Overall stats, live competitions, prize pools ─────────────
import React from 'react';
import type { AEvent, PriceMap, CandleData, BubbleTrade } from '../types';
import { CV } from '../constants';
import { fmt, ranked, calcRoi, fmtRoi, timeLeft, getAllPositions } from '../helpers';
import DerbyTrack from '../DerbyTrack';
import Leaderboard from '../Leaderboard';
import BroadcastChart from '../BroadcastChart';
import type { Participant } from '../types';

interface OverviewSceneProps {
  event: AEvent;
  prices: PriceMap;
  previousEquities: Map<string, number>;
  chartSymbol: string;
  chartTf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  onSymbolChange: (s: string) => void;
  onTfChange: (tf: string) => void;
  onSelectTrader: (p: Participant) => void;
}

const OverviewScene: React.FC<OverviewSceneProps> = ({
  event, previousEquities, chartSymbol, chartTf,
  candles, bubbles, onSymbolChange, onTfChange, onSelectTrader,
}) => {
  const sorted = ranked(event.participants);
  const leader = sorted[0];
  const positions = getAllPositions(event.participants);
  const tl = timeLeft(event.endDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top banner stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: '🏆 Prize Pool', value: fmt(event.prizePool), color: CV.gold },
          { label: '🏇 Racers', value: `${event.currentParticipants}`, color: CV.blue },
          { label: '⏱️ Time Left', value: tl, color: tl === 'Ended' ? CV.red : CV.teal },
          { label: '📊 Active Trades', value: `${positions.length}`, color: CV.purp },
          { label: '👑 Leader', value: leader ? `${leader.username} (${fmtRoi(calcRoi(leader.liveEquity, event.startingCapital))})` : '—', color: CV.gold },
        ].map((s, i) => (
          <div key={i} style={{
            background: CV.bg2, borderRadius: 12, padding: '14px 16px',
            border: `1px solid ${CV.bd1}`, textAlign: 'center',
          }}>
            <div style={{ color: CV.gray, fontSize: 10, marginBottom: 4, letterSpacing: .5 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main area: Track + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Derby Track */}
          <DerbyTrack
            event={event}
            previousEquities={previousEquities}
            onSelectTrader={onSelectTrader}
          />

          {/* Chart */}
          <BroadcastChart
            symbol={chartSymbol}
            tf={chartTf}
            candles={candles}
            bubbles={bubbles}
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
