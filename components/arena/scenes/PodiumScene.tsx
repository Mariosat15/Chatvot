'use client';
// ─── PodiumScene — Premium Winners Podium ───────────────────────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV, RANK_COLORS, RANK_GLOW } from '../constants';
import { ranked, fmtEquity, fmtRoi, fmtPnl, calcRoi, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';
import ArenaIcon from '../ArenaIcon';

interface PodiumSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const mono = '"SF Mono", Consolas, "Courier New", monospace';

const PodiumScene: React.FC<PodiumSceneProps> = ({ event, onSelectTrader }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3, 10);

  const confettiColors = [CV.gold, CV.teal, CV.blue, CV.purp, CV.oran, '#fff', CV.neonPink];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Confetti overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
        {confettiColors.map((color, i) =>
          Array.from({ length: 5 }).map((_, j) => (
            <div key={`${i}-${j}`} style={{
              position: 'absolute',
              left: `${(i * 14 + j * 22) % 100}%`,
              top: -12,
              width: 6 + (j % 3) * 3,
              height: 6 + (j % 3) * 3,
              background: color,
              borderRadius: j % 2 === 0 ? '50%' : '2px',
              animation: `confetti ${3 + j * 0.4}s linear infinite`,
              animationDelay: `${i * 0.3 + j * 0.6}s`,
              opacity: 0.75,
              boxShadow: `0 0 4px ${color}60`,
            }} />
          ))
        )}
      </div>

      {/* Background radial spotlight */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${CV.gold}08, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        textAlign: 'center', padding: '28px 0 16px', position: 'relative', zIndex: 2,
      }}>
        <div style={{
          marginBottom: 10,
          filter: 'drop-shadow(0 0 20px rgba(255,212,88,.4))',
          animation: 'avatarBob 2s ease-in-out infinite',
          display: 'flex', justifyContent: 'center',
        }}>
          <ArenaIcon name="Trophy" size={48} color={CV.gold} />
        </div>
        <div style={{
          color: CV.gold, fontSize: 26, fontWeight: 800, letterSpacing: 4,
          textShadow: `0 0 30px ${CV.gold}30, 0 0 60px ${CV.gold}10`,
          animation: 'textShine 3s ease-in-out infinite',
        }}>
          CHARTVOLT ARENA RESULTS
        </div>
        <div style={{ color: CV.lgt, fontSize: 14, marginTop: 6, fontWeight: 500 }}>
          {event.name}
        </div>
      </div>

      {/* Podium blocks */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        gap: 20, padding: '0 40px', position: 'relative', zIndex: 2,
        minHeight: 340,
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
            height={270} onSelect={onSelectTrader}
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

      {/* Rest of standings */}
      {rest.length > 0 && (
        <div style={{
          background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
          borderRadius: 18, border: `1px solid ${CV.bd1}`,
          padding: '12px 0', position: 'relative', zIndex: 2,
          overflow: 'hidden',
        }}>
          {/* Top highlight line */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
            background: `linear-gradient(90deg, transparent, ${CV.blue}30, transparent)`,
          }} />

          <div style={{
            padding: '0 18px 12px', borderBottom: `1px solid ${CV.bd0}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: CV.lgt, fontWeight: 700, fontSize: 13, letterSpacing: .5 }}>
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
                  padding: '10px 18px', cursor: 'pointer',
                  borderBottom: `1px solid ${CV.bd0}40`,
                  transition: 'background .2s',
                  animation: 'fadeSlideUp .4s ease-out backwards',
                  animationDelay: `${i * 0.05}s`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${CV.blue}06`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{
                  color: CV.gray, fontWeight: 700, fontSize: 13,
                  width: 30, textAlign: 'center',
                  background: `${CV.bg3}`, borderRadius: 6, padding: '2px 0',
                }}>
                  #{i + 4}
                </span>
                <Avatar src={p.profileImage} name={p.username} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{p.username}</span>
                  <span style={{ color: CV.gray, fontSize: 10, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ArenaIcon name={title.icon} size={9} color={CV.gray} /> {title.title}
                  </span>
                </div>
                <span style={{
                  color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700,
                  fontSize: 13, fontFamily: mono,
                  textShadow: roi >= 0 ? `0 0 6px ${CV.teal}15` : undefined,
                }}>
                  {fmtRoi(roi)}
                </span>
                <span style={{ color: CV.gray, fontSize: 11, fontFamily: mono, width: 72, textAlign: 'right' }}>
                  {fmtEquity(p.liveEquity)}
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
  const isFirst = rank === 1;

  return (
    <div
      onClick={() => onSelect(p)}
      style={{
        width: isFirst ? 210 : 175, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'fadeSlideUp .6s ease-out backwards',
        animationDelay: isFirst ? '0s' : rank === 2 ? '.2s' : '.4s',
      }}
    >
      {/* Crown for first */}
      {isFirst && (
        <div style={{
          marginBottom: 4,
          animation: 'avatarBob 2.5s ease-in-out infinite',
          filter: `drop-shadow(0 0 10px ${CV.gold}60)`,
          display: 'flex', justifyContent: 'center',
        }}>
          <ArenaIcon name="Crown" size={32} color={CV.gold} />
        </div>
      )}

      {/* Avatar */}
      <div style={{ marginBottom: 8, position: 'relative' }}>
        {/* Background glow ring */}
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}15, transparent)`,
          animation: isFirst ? 'glowPulse 2s ease-in-out infinite' : undefined,
        }} />
        <Avatar
          src={p.profileImage}
          name={p.username}
          size={isFirst ? 84 : 66}
          rank={rank}
          showRank
          glow={color}
          bobbing={isFirst}
        />
      </div>

      <div style={{
        color: CV.txt, fontSize: isFirst ? 17 : 14, fontWeight: 700,
        textShadow: `0 0 15px ${color}20`,
      }}>
        {p.username}
      </div>
      <div style={{ color, fontSize: 11, fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ArenaIcon name={title.icon} size={11} color={color} /> {title.title}
      </div>
      <div style={{
        color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700,
        fontSize: isFirst ? 20 : 15, fontFamily: mono,
        textShadow: `0 0 10px ${roi >= 0 ? CV.teal : CV.red}20`,
      }}>
        {fmtRoi(roi)}
      </div>
      <div style={{ color: CV.gray, fontSize: 11, fontFamily: mono }}>
        {fmtPnl(p.livePnl)}
      </div>

      {/* Podium column */}
      <div style={{
        width: '100%', height, marginTop: 14,
        borderRadius: '14px 14px 0 0',
        background: `linear-gradient(180deg, ${color}18, ${color}05)`,
        border: `1px solid ${color}25`,
        borderBottom: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        animation: 'podiumRise .8s ease-out backwards',
        animationDelay: isFirst ? '0s' : rank === 2 ? '.3s' : '.5s',
        boxShadow: `0 -6px 25px ${glow}, inset 0 1px 0 ${color}20`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Inner glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '80%', height: 1,
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        }} />
        <span style={{
          color, fontSize: isFirst ? 52 : 40, fontWeight: 900,
          textShadow: `0 0 30px ${color}30`,
          opacity: .6,
        }}>
          {rank}
        </span>
        {isFirst && (
          <span style={{ color: CV.gold, fontSize: 10, fontWeight: 700, letterSpacing: 2, opacity: .7 }}>
            CHAMPION
          </span>
        )}
      </div>
    </div>
  );
};

export default PodiumScene;
