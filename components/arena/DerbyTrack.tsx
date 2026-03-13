'use client';
// ─── DerbyTrack — Premium Neon Race Visualization ─────────────────────────────
// Horizontal track with trader avatars racing based on live equity
import React, { useMemo } from 'react';
import type { Participant, AEvent } from './types';
import { CV } from './constants';
import { raceProgress, calcRoi, fmtRoi, fmtEquity, calcMomentum, ranked, getTraderTitle } from './helpers';
import Avatar from './Avatar';
import ArenaIcon from './ArenaIcon';

const MEDAL_COLORS = [CV.gold, '#C0C0C0', '#CD7F32'] as const;

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
      borderRadius: 18,
      border: `1px solid ${finalLap ? CV.red + '50' : CV.glassBorder}`,
      padding: '20px 0 12px', overflow: 'hidden',
      animation: finalLap ? 'finalLapBg 1.5s ease-in-out infinite' : undefined,
      boxShadow: finalLap
        ? `0 0 30px ${CV.red}15, inset 0 0 60px ${CV.red}05`
        : `0 4px 24px rgba(0,0,0,.2)`,
      position: 'relative',
    }}>
      {/* Background gradient orb */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 300, height: 200,
        background: `radial-gradient(ellipse at 80% 0%, ${CV.gold}05, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Track header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 24px 14px', borderBottom: `1px solid ${CV.bd0}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${CV.gold}18, ${CV.oran}18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${CV.gold}25`,
          }}>
            <ArenaIcon name="Gauge" size={18} color={CV.gold} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: CV.gold, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
              ARENA TRACK
            </span>
            {finalLap && (
              <span style={{
                background: `${CV.red}18`, color: CV.red,
                padding: '2px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                animation: 'derbyPulse 1s ease-in-out infinite',
                border: `1px solid ${CV.red}30`,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <ArenaIcon name="AlertTriangle" size={11} color={CV.red} /> FINAL LAP
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: CV.teal,
            animation: 'livePulse 1.5s ease-out infinite',
          }} />
          <span style={{ color: CV.gray, fontSize: 11, fontWeight: 600 }}>
            {event.currentParticipants} TRADERS
          </span>
        </div>
      </div>

      {/* Finish-line markers */}
      <div style={{
        position: 'relative', padding: '10px 24px 4px',
        display: 'flex', justifyContent: 'space-between',
      }}>
        {['START', '25%', '50%', '75%'].map((label, i) => (
          <span key={label} style={{
            position: i === 0 ? 'relative' : 'absolute',
            left: i === 0 ? undefined : `${i * 25}%`,
            transform: i === 0 ? undefined : 'translateX(-50%)',
            color: CV.gray, fontSize: 9, fontWeight: 600, letterSpacing: .5, opacity: .6,
          }}>
            {label}
          </span>
        ))}
        <span style={{
          color: CV.gold, fontSize: 9, fontWeight: 700, letterSpacing: .5,
          textShadow: `0 0 8px ${CV.gold}30`,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <ArenaIcon name="Target" size={10} color={CV.gold} /> FINISH
        </span>
      </div>

      {/* Lanes */}
      <div style={{ padding: '2px 16px 0' }}>
        {topN.map((p, i) => {
          const progress = raceProgress(p.liveEquity, event.startingCapital);
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const prevEq = previousEquities?.get(p.userId) ?? p.liveEquity;
          const momentum = calcMomentum(p.liveEquity, prevEq);
          const titleObj = getTraderTitle(p, event.startingCapital);
          const isLeader = i === 0;

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader?.(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 8px', marginBottom: 1, cursor: 'pointer',
                borderRadius: 10,
                background: isLeader
                  ? `linear-gradient(90deg, ${CV.gold}06, transparent)`
                  : i < 3 ? `linear-gradient(90deg, ${CV.blue}03, transparent)` : 'transparent',
                borderLeft: isLeader
                  ? `3px solid ${CV.gold}`
                  : i < 3 ? `3px solid ${CV.blue}40` : '3px solid transparent',
                transition: 'all .2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `linear-gradient(90deg, ${CV.blue}08, transparent)`; }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  isLeader ? `linear-gradient(90deg, ${CV.gold}06, transparent)` : i < 3 ? `linear-gradient(90deg, ${CV.blue}03, transparent)` : 'transparent';
              }}
            >
              {/* Rank */}
              <div style={{
                width: 28, textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i < 3 ? (
                  <ArenaIcon name="Medal" size={16} color={MEDAL_COLORS[i]} />
                ) : (
                  <span style={{ color: CV.gray, fontWeight: 800, fontSize: 12 }}>#{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar
                src={p.profileImage} name={p.username} size={34}
                rank={i + 1}
                glow={momentum === 'boost' ? CV.teal : momentum === 'slow' ? CV.red : undefined}
                bobbing={momentum === 'boost'}
              />

              {/* Name + title */}
              <div style={{ width: 90, flexShrink: 0 }}>
                <div style={{
                  color: CV.txt, fontSize: 12, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.username}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: CV.gray, fontSize: 9 }}>
                  <ArenaIcon name={titleObj.icon} size={9} color={CV.gray} />
                  {titleObj.title}
                </div>
              </div>

              {/* Track lane */}
              <div style={{ flex: 1, position: 'relative', height: 32, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, ${CV.bg3}, ${CV.bg4})`,
                  borderRadius: 8, border: `1px solid ${CV.bd0}`,
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 58px, ${CV.bd0}80 58px, ${CV.bd0}80 60px)`,
                  animation: momentum === 'boost' ? 'trackMarkings .4s linear infinite' : undefined,
                  opacity: 0.3,
                }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${progress}%`,
                  background: roi >= 0
                    ? `linear-gradient(90deg, ${CV.teal}08, ${CV.teal}20, ${CV.teal}35)`
                    : `linear-gradient(90deg, ${CV.red}05, ${CV.red}15, ${CV.red}25)`,
                  borderRadius: 8, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                }} />
                {momentum === 'boost' && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    left: `calc(${progress}% - 70px)`,
                    height: 3, borderRadius: 2,
                    background: `linear-gradient(90deg, transparent, ${CV.teal}80, ${CV.teal})`,
                    boxShadow: `0 0 12px ${CV.teal}60`,
                    animation: 'neonTrail .6s ease-out infinite',
                  }} />
                )}
                {momentum === 'slow' && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `${CV.red}06`, borderRadius: 8,
                    animation: 'derbyPulse 1s ease-in-out infinite',
                  }} />
                )}
                <div style={{
                  position: 'absolute', top: '50%', left: `${progress}%`,
                  transition: 'left 1.2s cubic-bezier(.4,0,.2,1)',
                  animation: momentum === 'boost' ? 'derbyRunFast .3s ease-in-out infinite' : 'derbyRun .8s ease-in-out infinite',
                  zIndex: 2,
                  filter: momentum === 'boost' ? `drop-shadow(0 0 6px ${CV.teal}80)` : 'none',
                }}>
                  <Avatar src={p.profileImage} name={p.username} size={22} glow={isLeader ? CV.gold : undefined} />
                </div>
                {momentum === 'boost' && (
                  <>
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                      left: `calc(${progress}% - 12px)`,
                      width: 6, height: 6, borderRadius: '50%',
                      background: `${CV.teal}40`,
                      animation: 'dustCloud .5s ease-out infinite',
                    }} />
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-30%)',
                      left: `calc(${progress}% - 8px)`,
                      width: 4, height: 4, borderRadius: '50%',
                      background: `${CV.teal}30`,
                      animation: 'dustCloud .5s ease-out .1s infinite',
                    }} />
                  </>
                )}
              </div>

              {/* Live equity + ROI */}
              <div style={{ width: 85, textAlign: 'right' }}>
                <div style={{
                  color: roi >= 0 ? CV.teal : CV.red,
                  fontWeight: 700, fontSize: 13,
                  fontFamily: '"SF Mono", Consolas, monospace',
                  textShadow: roi >= 5 ? `0 0 8px ${CV.teal}30` : roi < -5 ? `0 0 8px ${CV.red}30` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
                }}>
                  {fmtRoi(roi)}
                  <ArenaIcon name={roi >= 0 ? 'TrendingUp' : 'TrendingDown'} size={10} color={roi >= 0 ? CV.teal : CV.red} />
                </div>
                <div style={{
                  color: CV.gray, fontSize: 10,
                  fontFamily: '"SF Mono", Consolas, monospace',
                }}>
                  {fmtEquity(p.liveEquity)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DerbyTrack;
