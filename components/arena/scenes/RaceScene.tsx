'use client';
// ─── RaceScene — Premium Full-screen Race Visualization ──────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV, TRADER_COLORS } from '../constants';
import { ranked, calcRoi, fmtRoi, fmtEquity, raceProgress, getTraderTitle, calcMomentum } from '../helpers';
import Avatar from '../Avatar';

interface RaceSceneProps {
  event: AEvent;
  previousEquities: Map<string, number>;
  onSelectTrader: (p: Participant) => void;
}

/** SVG Race line chart (equity race lines) */
const RaceLineChart: React.FC<{ participants: Participant[]; startCap: number }> = ({ participants, startCap }) => {
  const W = 700, H = 220;
  const sorted = ranked(participants).slice(0, 8);
  // Build fake history from current equity (in production, replace with real snapshot history)
  const points = sorted.map((p, ci) => {
    const roi = calcRoi(p.liveEquity, startCap);
    const steps = 20;
    const pts: { x: number; y: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const y = roi * t + (Math.sin(t * Math.PI * 4 + ci) * 2);
      pts.push({ x: (s / steps) * W, y });
    }
    return { pts, color: TRADER_COLORS[ci] ?? CV.gray, name: p.username };
  });

  const allY = points.flatMap(p => p.pts.map(pt => pt.y));
  const minY = Math.min(...allY, -5);
  const maxY = Math.max(...allY, 5);
  const rangeY = maxY - minY || 1;
  const mapY = (v: number) => H - 20 - ((v - minY) / rangeY) * (H - 40);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
      <defs>
        {points.map((line, i) => (
          <linearGradient key={`grad-${i}`} id={`lineGrad${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={line.color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={line.color} stopOpacity={0.8} />
          </linearGradient>
        ))}
      </defs>
      {/* Grid lines */}
      {[0, H * 0.25, H * 0.5, H * 0.75].map((y, i) => (
        <line key={i} x1={0} y1={y} x2={W} y2={y} stroke={CV.bd0} strokeWidth={0.5} opacity={0.4} />
      ))}
      {/* Zero line */}
      <line x1={0} y1={mapY(0)} x2={W} y2={mapY(0)} stroke={CV.bd2} strokeWidth={1} strokeDasharray="6,4" opacity={0.6} />
      {/* Lines */}
      {points.map((line, i) => (
        <polyline
          key={i}
          points={line.pts.map(p => `${p.x},${mapY(p.y)}`).join(' ')}
          fill="none" stroke={`url(#lineGrad${i})`} strokeWidth={2.5} strokeLinecap="round"
        />
      ))}
      {/* End dots */}
      {points.map((line, i) => {
        const last = line.pts[line.pts.length - 1];
        if (!last) return null;
        return (
          <g key={`dot-${i}`}>
            <circle cx={W - 2} cy={mapY(last.y)} r={4} fill={line.color} opacity={0.9} />
            <circle cx={W - 2} cy={mapY(last.y)} r={7} fill="none" stroke={line.color} strokeWidth={1} opacity={0.3} />
            <text x={W - 14} y={mapY(last.y) - 8} fill={line.color} fontSize={9} textAnchor="end" fontWeight={600}>
              {line.name.slice(0, 8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const RaceScene: React.FC<RaceSceneProps> = ({ event, previousEquities, onSelectTrader }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Race chart */}
      <div style={{
        background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
        borderRadius: 18, border: `1px solid ${CV.glassBorder}`,
        padding: '18px 22px',
        boxShadow: `0 4px 24px rgba(0,0,0,.2)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <span style={{ color: CV.gold, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
              EQUITY RACE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%', background: CV.teal,
              animation: 'livePulse 1.5s ease-out infinite',
            }} />
            <span style={{ color: CV.gray, fontSize: 11, fontWeight: 600 }}>{event.name}</span>
          </div>
        </div>
        <RaceLineChart participants={event.participants} startCap={event.startingCapital} />
      </div>

      {/* Full race lanes (expanded) */}
      <div style={{
        background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
        borderRadius: 18, border: `1px solid ${CV.glassBorder}`,
        padding: '16px 0',
        boxShadow: `0 4px 24px rgba(0,0,0,.2)`,
      }}>
        <div style={{ padding: '0 20px 14px', borderBottom: `1px solid ${CV.bd0}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏁</span>
            <span style={{ color: CV.gold, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
              RACE POSITIONS
            </span>
          </div>
          <span style={{ color: CV.gray, fontSize: 10 }}>{sorted.length} racers</span>
        </div>
        {sorted.map((p, i) => {
          const progress = raceProgress(p.liveEquity, event.startingCapital);
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const title = getTraderTitle(p, event.startingCapital);
          const prevEq = previousEquities.get(p.userId) ?? p.liveEquity;
          const momentum = calcMomentum(p.liveEquity, prevEq);

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${CV.bd0}60`,
                transition: 'all .15s',
                background: i === 0 ? `${CV.gold}04` : 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${CV.blue}06`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i === 0 ? `${CV.gold}04` : 'transparent'; }}
            >
              <span style={{
                width: 30, textAlign: 'center',
                color: i < 3 ? CV.gold : CV.gray,
                fontWeight: 700, fontSize: 14,
              }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
              </span>

              <Avatar
                src={p.profileImage}
                name={p.username}
                size={38}
                rank={i + 1}
                showRank
                glow={momentum === 'boost' ? CV.teal : i === 0 ? CV.gold : undefined}
                bobbing={i === 0 || momentum === 'boost'}
              />

              <div style={{ width: 90 }}>
                <div style={{ color: CV.txt, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                <div style={{ color: CV.gray, fontSize: 10 }}>{title.emoji} {title.title}</div>
              </div>

              {/* Track */}
              <div style={{ flex: 1, height: 24, position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${CV.bg3}, ${CV.bg4})`, borderRadius: 6, border: `1px solid ${CV.bd0}` }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${progress}%`, borderRadius: 6,
                  background: `linear-gradient(90deg, ${TRADER_COLORS[i % TRADER_COLORS.length]}15, ${TRADER_COLORS[i % TRADER_COLORS.length]}40)`,
                  transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                }} />
                <div style={{
                  position: 'absolute', top: '50%',
                  left: `${progress}%`, transition: 'left 1.2s cubic-bezier(.4,0,.2,1)',
                  animation: momentum === 'boost' ? 'derbyRunFast .3s ease-in-out infinite' : 'derbyRun .6s ease-in-out infinite',
                  filter: momentum === 'boost' ? `drop-shadow(0 0 4px ${CV.teal}80)` : 'none',
                }}>
                  <Avatar src={p.profileImage} name={p.username} size={18} />
                </div>
              </div>

              <div style={{ width: 80, textAlign: 'right' }}>
                <div style={{
                  color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700, fontSize: 13,
                  fontFamily: '"SF Mono", Consolas, monospace',
                  textShadow: Math.abs(roi) > 5 ? `0 0 6px ${roi >= 0 ? CV.teal : CV.red}30` : 'none',
                }}>
                  {fmtRoi(roi)}
                </div>
                <div style={{ color: CV.gray, fontSize: 10, fontFamily: '"SF Mono", Consolas, monospace' }}>{fmtEquity(p.liveEquity)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RaceScene;
