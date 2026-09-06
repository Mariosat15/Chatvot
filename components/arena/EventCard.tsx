'use client';
// ─── EventCard — Premium Arena Event Browser Card ────────────────────────────
import React from 'react';
import type { AEvent } from './types';
import { CV } from './constants';
import { fmt, timeLeft, ranked } from './helpers';
import Avatar from './Avatar';
import ArenaIcon from './ArenaIcon';

interface EventCardProps {
  event: AEvent;
  onSelect: (e: AEvent) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event: ev, onSelect }) => {
  const top3 = ranked(ev.participants).slice(0, 3);
  const isLive = ev.status === 'active' || ev.status === 'live';
  const isUpcoming = ev.status === 'upcoming' || ev.status === 'pending';
  const tl = timeLeft(ev.endDate);

  return (
    <div
      onClick={() => onSelect(ev)}
      style={{
        background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
        borderRadius: 18,
        border: `1px solid ${isLive ? CV.teal + '25' : CV.glassBorder}`,
        padding: 22, cursor: 'pointer',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
        position: 'relative', overflow: 'hidden',
        boxShadow: isLive ? `0 4px 20px rgba(15,237,190,.08)` : `0 4px 20px rgba(0,0,0,.2)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.01)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 40px rgba(0,0,0,.35), 0 0 24px ${CV.gold}10`;
        (e.currentTarget as HTMLElement).style.borderColor = `${CV.gold}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = isLive ? `0 4px 20px rgba(15,237,190,.08)` : `0 4px 20px rgba(0,0,0,.2)`;
        (e.currentTarget as HTMLElement).style.borderColor = isLive ? `${CV.teal}25` : CV.glassBorder;
      }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120,
        background: `radial-gradient(circle, ${isLive ? CV.teal : CV.gold}06, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ color: CV.txt, fontSize: 16, fontWeight: 700 }}>{ev.name}</div>
          <div style={{ color: CV.gray, fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArenaIcon
              name={ev.type === 'trading_competition' ? 'Trophy' : 'Swords'}
              size={12}
              color={CV.gray}
            />
            {ev.type === 'trading_competition' ? 'Competition' : 'Challenge'}
          </div>
        </div>
        {isLive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: `${CV.teal}10`, padding: '4px 12px', borderRadius: 8,
            border: `1px solid ${CV.teal}20`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: CV.teal,
              animation: 'livePulse 1.5s ease-out infinite',
              boxShadow: `0 0 6px ${CV.teal}`,
            }} />
            <span style={{ color: CV.teal, fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>LIVE</span>
          </div>
        )}
        {isUpcoming && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: `${CV.oran}10`, padding: '4px 10px', borderRadius: 8,
            border: `1px solid ${CV.oran}20`,
          }}>
            <ArenaIcon name="Clock" size={11} color={CV.oran} />
            <span style={{ color: CV.oran, fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>UPCOMING</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Prize Pool', value: fmt(ev.prizePool), color: CV.gold, icon: 'DollarSign' },
          { label: 'Traders', value: `${ev.currentParticipants}/${ev.maxParticipants}`, color: CV.blue, icon: 'Users' },
          { label: 'Time Left', value: tl, color: tl === 'Ended' ? CV.red : CV.teal, icon: 'Timer' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 10,
            background: `${CV.bg4}80`, border: `1px solid ${CV.bd0}`,
            flex: 1, textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              <ArenaIcon name={s.icon} size={10} color={CV.gray} />
              <span style={{ color: CV.gray, fontSize: 9, letterSpacing: .5, fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{
              color: s.color, fontSize: 14, fontWeight: 700,
              fontFamily: '"SF Mono", Consolas, monospace',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Top 3 preview */}
      {top3.length > 0 && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 0 0',
          borderTop: `1px solid ${CV.bd0}`,
        }}>
          {top3.map((p, i) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArenaIcon name="Medal" size={14} color={i === 0 ? CV.gold : i === 1 ? '#C0C0C0' : '#CD7F32'} />
              <Avatar src={p.profileImage} name={p.username} size={22} />
              <span style={{
                color: CV.lgt, fontSize: 11, fontWeight: 500,
                maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.username}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Starting capital badge */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        background: `${CV.gold}08`, border: `1px solid ${CV.gold}18`,
        padding: '3px 10px', borderRadius: 8,
        color: CV.gold, fontSize: 10, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        <ArenaIcon name="Wallet" size={10} color={CV.gold} />
        {fmt(ev.startingCapital)} start
      </div>
    </div>
  );
};

export default EventCard;
