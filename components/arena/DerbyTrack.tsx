'use client';
// ─── DerbyTrack — Main Race Visualization ─────────────────────────────────────
// Horizontal track with trader avatars racing based on live equity
import React, { useMemo } from 'react';
import type { Participant, AEvent } from './types';
import { CV, RANK_COLORS } from './constants';
import { raceProgress, calcRoi, fmtRoi, calcMomentum, ranked, getTraderTitle } from './helpers';
import Avatar from './Avatar';

interface DerbyTrackProps {
  event: AEvent;
  previousEquities?: Map<string, number>;
  onSelectTrader?: (p: Participant) => void;
  compact?: boolean;
}

const DerbyTrack: React.FC<DerbyTrackProps> = ({ event, previousEquities, onSelectTrader, compact }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const topN = compact ? sorted.slice(0, 8) : sorted;
  const finalLap = useMemo(() => {
    const ms = new Date(event.endDate).getTime() - Date.now();
    return ms > 0 && ms <= 5 * 60 * 1000;
  }, [event.endDate]);

  return (
    <div style={{
      background: `linear-gradient(180deg, ${CV.bg2} 0%, ${CV.bg1} 100%)`,
      borderRadius: 16, border: `1px solid ${CV.bd1}`,
      padding: '20px 0 16px', overflow: 'hidden',
      animation: finalLap ? 'finalLapBg 1.5s ease-in-out infinite' : undefined,
    }}>
      {/* Track header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 24px 12px', borderBottom: `1px solid ${CV.bd0}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏇</span>
          <span style={{ color: CV.gold, fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>
            CHARTVOLT DERBY
          </span>
          {finalLap && (
            <span style={{
              background: 'rgba(255,73,91,.15)', color: CV.red,
              padding: '2px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              animation: 'derbyPulse 1s ease-in-out infinite',
            }}>
              🏁 FINAL LAP
            </span>
          )}
        </div>
        <span style={{ color: CV.gray, fontSize: 12 }}>
          {event.currentParticipants} RACERS
        </span>
      </div>

      {/* Finish-line markers */}
      <div style={{
        position: 'relative', padding: '8px 24px 0',
        display: 'flex', justifyContent: 'space-between', color: CV.gray, fontSize: 10,
      }}>
        <span>START</span>
        <span style={{ position: 'absolute', left: '25%', transform: 'translateX(-50%)' }}>25%</span>
        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>50%</span>
        <span style={{ position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>75%</span>
        <span style={{ color: CV.gold }}>🏁 FINISH</span>
      </div>

      {/* Lanes */}
      <div style={{ padding: '4px 16px 0' }}>
        {topN.map((p, i) => {
          const progress = raceProgress(p.liveEquity, event.startingCapital);
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const prevEq = previousEquities?.get(p.userId) ?? p.liveEquity;
          const momentum = calcMomentum(p.liveEquity, prevEq);
          const titleObj = getTraderTitle(p, event.startingCapital);

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader?.(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 8px', marginBottom: 2, cursor: 'pointer',
                borderRadius: 10,
                background: i === 0
                  ? 'rgba(255,212,88,.04)'
                  : i < 3 ? 'rgba(91,141,255,.02)' : 'transparent',
                borderLeft: i === 0 ? `3px solid ${CV.gold}` : i < 3 ? `3px solid ${CV.blue}40` : '3px solid transparent',
                transition: 'background .2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(91,141,255,.06)'; }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  i === 0 ? 'rgba(255,212,88,.04)' : i < 3 ? 'rgba(91,141,255,.02)' : 'transparent';
              }}
            >
              {/* Rank */}
              <div style={{
                width: 28, textAlign: 'center',
                color: i < 3 ? (RANK_COLORS[i] ?? CV.gray) : CV.gray,
                fontWeight: 800, fontSize: i < 3 ? 16 : 13,
              }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
              </div>

              {/* Avatar */}
              <Avatar
                src={p.profileImage}
                name={p.username}
                size={36}
                rank={i + 1}
                glow={momentum === 'boost' ? CV.teal : momentum === 'slow' ? CV.red : undefined}
                bobbing={momentum === 'boost'}
              />

              {/* Name + title */}
              <div style={{ width: 100, flexShrink: 0 }}>
                <div style={{ color: CV.txt, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.username}
                </div>
                <div style={{ color: CV.gray, fontSize: 10 }}>
                  {titleObj.emoji} {titleObj.title}
                </div>
              </div>

              {/* Track lane */}
              <div style={{ flex: 1, position: 'relative', height: 28, borderRadius: 6, overflow: 'hidden' }}>
                {/* Track background */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, ${CV.bg3} 0%, ${CV.bg4} 100%)`,
                  borderRadius: 6,
                  border: `1px solid ${CV.bd0}`,
                }} />

                {/* Lane markings */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 58px, ${CV.bd0} 58px, ${CV.bd0} 60px)`,
                  animation: momentum === 'boost' ? 'trackMarkings .5s linear infinite' : undefined,
                  opacity: 0.4,
                }} />

                {/* Progress bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${progress}%`,
                  background: roi >= 0
                    ? `linear-gradient(90deg, rgba(15,237,190,.15), rgba(15,237,190,.3))`
                    : `linear-gradient(90deg, rgba(255,73,91,.1), rgba(255,73,91,.2))`,
                  borderRadius: 6,
                  transition: 'width 1s ease-out',
                }} />

                {/* Neon trail effect on boost */}
                {momentum === 'boost' && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    left: `calc(${progress}% - 60px)`,
                    height: 4, borderRadius: 2,
                    background: `linear-gradient(90deg, transparent, ${CV.teal})`,
                    animation: 'neonTrail .8s ease-out infinite',
                  }} />
                )}

                {/* Avatar on track */}
                <div style={{
                  position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                  left: `${progress}%`,
                  transition: 'left 1s ease-out',
                  animation: momentum === 'boost' ? 'derbyRunFast .3s ease-in-out infinite' : 'derbyRun .8s ease-in-out infinite',
                  zIndex: 2,
                }}>
                  <Avatar
                    src={p.profileImage}
                    name={p.username}
                    size={24}
                    glow={i === 0 ? CV.gold : undefined}
                  />
                </div>

                {/* Dust cloud on boost */}
                {momentum === 'boost' && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    left: `calc(${progress}% - 10px)`,
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'rgba(255,255,255,.3)',
                    animation: 'dustCloud .6s ease-out infinite',
                  }} />
                )}
              </div>

              {/* ROI */}
              <div style={{
                width: 72, textAlign: 'right',
                color: roi >= 0 ? CV.teal : CV.red,
                fontWeight: 700, fontSize: 13,
                fontFamily: 'monospace',
              }}>
                {fmtRoi(roi)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DerbyTrack;
