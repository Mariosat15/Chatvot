'use client';
// ─── PodiumScene — Winners / Results Podium ──────────────────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV, RANK_COLORS, RANK_GLOW } from '../constants';
import { ranked, fmt, fmtRoi, fmtPnl, calcRoi, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';

interface PodiumSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const PodiumScene: React.FC<PodiumSceneProps> = ({ event, onSelectTrader }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3, 10);

  // Confetti pieces
  const confettiColors = [CV.gold, CV.teal, CV.blue, CV.purp, CV.oran, CV.red, '#fff'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
      {/* Confetti overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
        {confettiColors.map((color, i) =>
          Array.from({ length: 4 }).map((_, j) => (
            <div key={`${i}-${j}`} style={{
              position: 'absolute',
              left: `${(i * 14 + j * 25) % 100}%`,
              top: -10,
              width: 6 + (j % 3) * 2,
              height: 6 + (j % 3) * 2,
              background: color,
              borderRadius: j % 2 === 0 ? '50%' : '2px',
              animation: `confetti ${3 + j * 0.5}s linear infinite`,
              animationDelay: `${i * 0.3 + j * 0.7}s`,
              opacity: 0.7,
            }} />
          ))
        )}
      </div>

      {/* Podium header */}
      <div style={{
        textAlign: 'center', padding: '24px 0', position: 'relative', zIndex: 2,
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
        <div style={{ color: CV.gold, fontSize: 24, fontWeight: 800, letterSpacing: 3 }}>
          CHARTVOLT DERBY RESULTS
        </div>
        <div style={{ color: CV.gray, fontSize: 13, marginTop: 4 }}>{event.name}</div>
      </div>

      {/* Podium blocks */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        gap: 16, padding: '0 40px', position: 'relative', zIndex: 2,
        minHeight: 320,
      }}>
        {/* 2nd place */}
        {top3[1] && (
          <PodiumBlock
            p={top3[1]} rank={2} startCap={event.startingCapital}
            height={200} onSelect={onSelectTrader}
          />
        )}
        {/* 1st place */}
        {top3[0] && (
          <PodiumBlock
            p={top3[0]} rank={1} startCap={event.startingCapital}
            height={260} onSelect={onSelectTrader}
          />
        )}
        {/* 3rd place */}
        {top3[2] && (
          <PodiumBlock
            p={top3[2]} rank={3} startCap={event.startingCapital}
            height={160} onSelect={onSelectTrader}
          />
        )}
      </div>

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div style={{
          background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
          padding: '12px 0', position: 'relative', zIndex: 2,
        }}>
          <div style={{ padding: '0 16px 10px', borderBottom: `1px solid ${CV.bd0}` }}>
            <span style={{ color: CV.gray, fontWeight: 700, fontSize: 12, letterSpacing: .5 }}>
              FINAL STANDINGS
            </span>
          </div>
          {rest.map((p, i) => {
            const roi = calcRoi(p.liveEquity, event.startingCapital);
            const title = getTraderTitle(p, event.startingCapital);
            return (
              <div
                key={p.userId}
                onClick={() => onSelectTrader(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px', cursor: 'pointer',
                  borderBottom: `1px solid ${CV.bd0}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(91,141,255,.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ color: CV.gray, fontWeight: 700, fontSize: 12, width: 28, textAlign: 'center' }}>
                  #{i + 4}
                </span>
                <Avatar src={p.profileImage} name={p.username} size={28} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{p.username}</span>
                  <span style={{ color: CV.gray, fontSize: 10, marginLeft: 8 }}>{title.emoji} {title.title}</span>
                </div>
                <span style={{ color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
                  {fmtRoi(roi)}
                </span>
                <span style={{ color: CV.gray, fontSize: 11, fontFamily: 'monospace', width: 70, textAlign: 'right' }}>
                  {fmt(p.liveEquity)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Individual podium block */
const PodiumBlock: React.FC<{
  p: Participant; rank: number; startCap: number; height: number;
  onSelect: (p: Participant) => void;
}> = ({ p, rank, startCap, height, onSelect }) => {
  const roi = calcRoi(p.liveEquity, startCap);
  const title = getTraderTitle(p, startCap);
  const color = RANK_COLORS[rank - 1] ?? CV.gray;
  const glow = RANK_GLOW[rank - 1] ?? 'transparent';

  return (
    <div
      onClick={() => onSelect(p)}
      style={{
        width: rank === 1 ? 200 : 170, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'fadeSlideUp .6s ease-out',
        animationDelay: rank === 1 ? '0s' : rank === 2 ? '.2s' : '.4s',
        animationFillMode: 'backwards',
      }}
    >
      {/* Avatar */}
      <div style={{ marginBottom: 8 }}>
        <Avatar
          src={p.profileImage}
          name={p.username}
          size={rank === 1 ? 80 : 64}
          rank={rank}
          showRank
          glow={color}
          bobbing={rank === 1}
        />
      </div>

      <div style={{ color: CV.txt, fontSize: rank === 1 ? 16 : 13, fontWeight: 700, marginBottom: 2 }}>
        {p.username}
      </div>
      <div style={{ color, fontSize: 11, marginBottom: 2 }}>
        {title.emoji} {title.title}
      </div>
      <div style={{ color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700, fontSize: rank === 1 ? 18 : 14, fontFamily: 'monospace' }}>
        {fmtRoi(roi)}
      </div>
      <div style={{ color: CV.gray, fontSize: 11, fontFamily: 'monospace' }}>
        {fmtPnl(p.livePnl)}
      </div>

      {/* Podium column */}
      <div style={{
        width: '100%', height, marginTop: 12, borderRadius: '12px 12px 0 0',
        background: `linear-gradient(180deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}30`,
        borderBottom: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'podiumRise .8s ease-out',
        animationDelay: rank === 1 ? '0s' : rank === 2 ? '.3s' : '.5s',
        animationFillMode: 'backwards',
        boxShadow: `0 -4px 20px ${glow}`,
      }}>
        <span style={{ color, fontSize: rank === 1 ? 48 : 36, fontWeight: 900 }}>
          {rank}
        </span>
      </div>
    </div>
  );
};

export default PodiumScene;
