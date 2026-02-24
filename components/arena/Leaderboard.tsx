'use client';
// ─── Leaderboard — Right Side Panel ──────────────────────────────────────────
import React from 'react';
import type { Participant, AEvent } from './types';
import { CV, RANK_COLORS } from './constants';
import { fmt, fmtRoi, calcRoi, ranked, riskLevel, getTraderTitle } from './helpers';
import Avatar from './Avatar';

interface LeaderboardProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ event, onSelectTrader }) => {
  const sorted = ranked(event.participants);

  return (
    <div style={{
      background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
      overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${CV.bd0}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: CV.gold, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
          🏆 LEADERBOARD
        </span>
        <span style={{ color: CV.gray, fontSize: 11 }}>
          {sorted.length} racers
        </span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
        {sorted.map((p, i) => {
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const risk = riskLevel(p, event.startingCapital);
          const title = getTraderTitle(p, event.startingCapital);

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', cursor: 'pointer',
                borderBottom: `1px solid ${CV.bd0}`,
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `rgba(91,141,255,.05)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Rank */}
              <div style={{
                width: 24, textAlign: 'center',
                color: i < 3 ? (RANK_COLORS[i] ?? CV.gray) : CV.gray,
                fontWeight: 700, fontSize: 12,
              }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </div>

              <Avatar src={p.profileImage} name={p.username} size={30} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: CV.txt, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.username}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ color: CV.gray, fontSize: 9 }}>{title.emoji} {title.title}</span>
                  <span style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 4,
                    background: `${risk.color}15`, color: risk.color,
                  }}>
                    {risk.label}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: roi >= 0 ? CV.teal : CV.red,
                  fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                }}>
                  {fmtRoi(roi)}
                </div>
                <div style={{ color: CV.gray, fontSize: 10, fontFamily: 'monospace' }}>
                  {fmt(p.liveEquity)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
