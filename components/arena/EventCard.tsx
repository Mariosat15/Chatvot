'use client';
// ─── EventCard — Derby-themed Event Browser Card ──────────────────────────────
import React from 'react';
import type { AEvent } from './types';
import { CV } from './constants';
import { fmt, timeLeft, ranked } from './helpers';
import Avatar from './Avatar';

interface EventCardProps {
  event: AEvent;
  onSelect: (e: AEvent) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event: ev, onSelect }) => {
  const top3 = ranked(ev.participants).slice(0, 3);
  const isLive = ev.status === 'active' || ev.status === 'live';
  const tl = timeLeft(ev.endDate);

  return (
    <div
      onClick={() => onSelect(ev)}
      style={{
        background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
        borderRadius: 16, border: `1px solid ${CV.bd1}`,
        padding: 20, cursor: 'pointer',
        transition: 'transform .2s, box-shadow .2s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px rgba(0,0,0,.4), 0 0 20px ${CV.gold}15`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ color: CV.txt, fontSize: 16, fontWeight: 700 }}>{ev.name}</div>
          <div style={{ color: CV.gray, fontSize: 11, marginTop: 2 }}>
            {ev.type === 'trading_competition' ? '🏇 Derby Race' : '⚔️ Challenge'}
          </div>
        </div>
        {isLive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(15,237,190,.1)', padding: '3px 10px', borderRadius: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CV.teal, animation: 'derbyPulse 1.5s infinite' }} />
            <span style={{ color: CV.teal, fontSize: 11, fontWeight: 700 }}>LIVE</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {[
          { label: 'Prize Pool', value: fmt(ev.prizePool), color: CV.gold },
          { label: 'Racers', value: `${ev.currentParticipants}/${ev.maxParticipants}`, color: CV.blue },
          { label: 'Time Left', value: tl, color: tl === 'Ended' ? CV.red : CV.teal },
        ].map((s, i) => (
          <div key={i}>
            <div style={{ color: CV.gray, fontSize: 10 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Top 3 preview */}
      {top3.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 0 0',
          borderTop: `1px solid ${CV.bd0}`,
        }}>
          {top3.map((p, i) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{['🥇', '🥈', '🥉'][i]}</span>
              <Avatar src={p.profileImage} name={p.username} size={22} />
              <span style={{ color: CV.lgt, fontSize: 11, fontWeight: 500, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.username}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Starting capital badge */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,212,88,.08)', border: `1px solid ${CV.gold}20`,
        padding: '2px 8px', borderRadius: 6,
        color: CV.gold, fontSize: 10, fontWeight: 600,
      }}>
        {fmt(ev.startingCapital)} start
      </div>
    </div>
  );
};

export default EventCard;
