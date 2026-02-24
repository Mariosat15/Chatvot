'use client';
// ─── Leaderboard — Premium Live Stats Panel ──────────────────────────────────
import React from 'react';
import type { Participant, AEvent } from './types';
import { CV, RANK_COLORS } from './constants';
import { fmt, fmtRoi, fmtPnl, calcRoi, ranked, riskLevel, getTraderTitle } from './helpers';
import Avatar from './Avatar';

interface LeaderboardProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ event, onSelectTrader }) => {
  const sorted = ranked(event.participants);

  return (
    <div style={{
      background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
      borderRadius: 18,
      border: `1px solid ${CV.glassBorder}`,
      overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
      boxShadow: `0 4px 24px rgba(0,0,0,.2)`,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${CV.bd0}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: `linear-gradient(135deg, ${CV.gold}06, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <span style={{ color: CV.gold, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
            LEADERBOARD
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: CV.teal,
            animation: 'livePulse 1.5s ease-out infinite',
          }} />
          <span style={{ color: CV.gray, fontSize: 10, fontWeight: 600 }}>
            {sorted.length} LIVE
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px', borderBottom: `1px solid ${CV.bd0}`,
      }}>
        <span style={{ width: 24, color: CV.gray, fontSize: 8, fontWeight: 600, textAlign: 'center', letterSpacing: .5 }}>#</span>
        <span style={{ flex: 1, color: CV.gray, fontSize: 8, fontWeight: 600, letterSpacing: .5 }}>RACER</span>
        <span style={{ width: 65, color: CV.gray, fontSize: 8, fontWeight: 600, textAlign: 'right', letterSpacing: .5 }}>EQUITY</span>
        <span style={{ width: 55, color: CV.gray, fontSize: 8, fontWeight: 600, textAlign: 'right', letterSpacing: .5 }}>ROI</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2px 0' }}>
        {sorted.map((p, i) => {
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const risk = riskLevel(p, event.startingCapital);
          const title = getTraderTitle(p, event.startingCapital);
          const isLeader = i === 0;

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', cursor: 'pointer',
                borderBottom: `1px solid ${CV.bd0}60`,
                transition: 'all .15s',
                background: isLeader ? `${CV.gold}04` : 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${CV.blue}08`;
                (e.currentTarget as HTMLElement).style.borderLeft = `2px solid ${CV.blue}60`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isLeader ? `${CV.gold}04` : 'transparent';
                (e.currentTarget as HTMLElement).style.borderLeft = 'none';
              }}
            >
              {/* Rank */}
              <div style={{
                width: 24, textAlign: 'center',
                color: i < 3 ? (RANK_COLORS[i] ?? CV.gray) : CV.gray,
                fontWeight: 700, fontSize: 12,
              }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </div>

              <Avatar src={p.profileImage} name={p.username} size={30} rank={i + 1} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: CV.txt, fontSize: 12, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.username}
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ color: CV.gray, fontSize: 9 }}>{title.emoji} {title.title}</span>
                  <span style={{
                    fontSize: 7, padding: '1px 5px', borderRadius: 4,
                    background: `${risk.color}12`, color: risk.color,
                    border: `1px solid ${risk.color}20`,
                    fontWeight: 600,
                  }}>
                    {risk.label}
                  </span>
                </div>
              </div>

              {/* Live stats */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: CV.txt, fontSize: 12, fontWeight: 700,
                  fontFamily: '"SF Mono", Consolas, monospace',
                }}>
                  {fmt(p.liveEquity)}
                </div>
                <div style={{
                  color: roi >= 0 ? CV.teal : CV.red,
                  fontSize: 11, fontWeight: 700,
                  fontFamily: '"SF Mono", Consolas, monospace',
                  textShadow: Math.abs(roi) > 5 ? `0 0 6px ${roi >= 0 ? CV.teal : CV.red}30` : 'none',
                }}>
                  {fmtRoi(roi)}
                </div>
              </div>

              {/* P&L indicator */}
              <div style={{
                width: 4, height: 28, borderRadius: 2, flexShrink: 0,
                background: roi >= 0
                  ? `linear-gradient(180deg, ${CV.teal}, ${CV.teal}40)`
                  : `linear-gradient(180deg, ${CV.red}, ${CV.red}40)`,
                boxShadow: `0 0 4px ${roi >= 0 ? CV.teal : CV.red}30`,
              }} />
            </div>
          );
        })}
      </div>

      {/* Footer with totals */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${CV.bd0}`,
        background: `${CV.bg3}60`,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>TOTAL TRADES</div>
          <div style={{ color: CV.txt, fontSize: 12, fontWeight: 700, fontFamily: '"SF Mono", Consolas, monospace' }}>
            {sorted.reduce((acc, p) => acc + p.totalTrades, 0)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>AVG ROI</div>
          <div style={{
            color: CV.teal, fontSize: 12, fontWeight: 700,
            fontFamily: '"SF Mono", Consolas, monospace',
          }}>
            {sorted.length > 0
              ? fmtRoi(sorted.reduce((acc, p) => acc + calcRoi(p.liveEquity, event.startingCapital), 0) / sorted.length)
              : '0.00%'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>OPEN POS</div>
          <div style={{ color: CV.purp, fontSize: 12, fontWeight: 700, fontFamily: '"SF Mono", Consolas, monospace' }}>
            {sorted.reduce((acc, p) => acc + p.currentOpenPositions, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
