'use client';
// ─── RaceScene — Full-screen race visualization ───────────────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV, TRADER_COLORS } from '../constants';
import { ranked, calcRoi, fmtRoi, fmt, raceProgress, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';

interface RaceSceneProps {
  event: AEvent;
  previousEquities: Map<string, number>;
  onSelectTrader: (p: Participant) => void;
}

/** SVG Race line chart (equity race lines) */
const RaceLineChart: React.FC<{ participants: Participant[]; startCap: number }> = ({ participants, startCap }) => {
  const W = 600, H = 200;
  const sorted = ranked(participants).slice(0, 8);
  // Build fake history from current equity (in production, replace with real snapshot history)
  const points = sorted.map((p, ci) => {
    const roi = calcRoi(p.liveEquity, startCap);
    // Simulate a path from 0 to current ROI
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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      {/* Zero line */}
      <line x1={0} y1={mapY(0)} x2={W} y2={mapY(0)} stroke={CV.bd1} strokeWidth={1} strokeDasharray="4,4" />
      {/* Lines */}
      {points.map((line, i) => (
        <polyline
          key={i}
          points={line.pts.map(p => `${p.x},${mapY(p.y)}`).join(' ')}
          fill="none" stroke={line.color} strokeWidth={2} opacity={0.8}
        />
      ))}
      {/* End labels */}
      {points.map((line, i) => {
        const last = line.pts[line.pts.length - 1];
        if (!last) return null;
        return (
          <text key={i} x={W - 4} y={mapY(last.y) - 4} fill={line.color} fontSize={9} textAnchor="end">
            {line.name.slice(0, 8)}
          </text>
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
        background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: CV.gold, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
            🏇 EQUITY RACE
          </span>
          <span style={{ color: CV.gray, fontSize: 11 }}>{event.name}</span>
        </div>
        <RaceLineChart participants={event.participants} startCap={event.startingCapital} />
      </div>

      {/* Full race lanes (expanded) */}
      <div style={{
        background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
        padding: '16px 0',
      }}>
        <div style={{ padding: '0 20px 12px', borderBottom: `1px solid ${CV.bd0}` }}>
          <span style={{ color: CV.gold, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
            🏁 RACE POSITIONS
          </span>
        </div>
        {sorted.map((p, i) => {
          const progress = raceProgress(p.liveEquity, event.startingCapital);
          const roi = calcRoi(p.liveEquity, event.startingCapital);
          const title = getTraderTitle(p, event.startingCapital);

          return (
            <div
              key={p.userId}
              onClick={() => onSelectTrader(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${CV.bd0}`,
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(91,141,255,.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
                size={40}
                rank={i + 1}
                showRank
                glow={i === 0 ? CV.gold : undefined}
                bobbing={i === 0}
              />

              <div style={{ width: 100 }}>
                <div style={{ color: CV.txt, fontSize: 13, fontWeight: 600 }}>{p.username}</div>
                <div style={{ color: CV.gray, fontSize: 10 }}>{title.emoji} {title.title}</div>
              </div>

              {/* Track */}
              <div style={{ flex: 1, height: 20, position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: CV.bg3, borderRadius: 4 }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${progress}%`, borderRadius: 4,
                  background: `linear-gradient(90deg, ${TRADER_COLORS[i % TRADER_COLORS.length]}30, ${TRADER_COLORS[i % TRADER_COLORS.length]}60)`,
                  transition: 'width 1s ease-out',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)',
                  left: `${progress}%`, transition: 'left 1s ease-out',
                  animation: 'derbyRun .6s ease-in-out infinite',
                }}>
                  <Avatar src={p.profileImage} name={p.username} size={18} />
                </div>
              </div>

              <div style={{ width: 70, textAlign: 'right' }}>
                <div style={{ color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                  {fmtRoi(roi)}
                </div>
                <div style={{ color: CV.gray, fontSize: 10, fontFamily: 'monospace' }}>{fmt(p.liveEquity)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RaceScene;
