'use client';
// ─── Avatar — Premium Derby Racer Avatar ──────────────────────────────────────
import React from 'react';
import { AV_GRADS, CV, RANK_COLORS } from './constants';
import { hashStr } from './helpers';

interface AvatarProps {
  src: string | null;
  name: string;
  size?: number;
  rank?: number;
  showRank?: boolean;
  glow?: string;
  bobbing?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 42, rank, showRank = false, glow, bobbing = false }) => {
  const grad = AV_GRADS[hashStr(name) % AV_GRADS.length];
  const initials = name.slice(0, 2).toUpperCase();
  const isTop3 = rank !== undefined && rank <= 3;
  const ringColor = isTop3 ? (RANK_COLORS[rank - 1] ?? CV.bd2) : (glow || CV.bd2);

  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
    }}>
      {/* Outer glow ring for top 3 */}
      {isTop3 && size >= 30 && (
        <div style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, ${ringColor}, transparent 30%, ${ringColor} 60%, transparent 90%, ${ringColor})`,
          animation: 'avatarRing 4s linear infinite',
          opacity: .5,
        }} />
      )}

      {/* Avatar circle */}
      <div
        style={{
          position: 'relative',
          width: size, height: size, borderRadius: '50%',
          background: src ? `url(${src}) center/cover no-repeat` : `linear-gradient(135deg,${grad})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(size * 0.35, 10), fontWeight: 700, color: '#fff',
          border: `2px solid ${ringColor}`,
          boxShadow: glow
            ? `0 0 ${size * 0.35}px ${glow}60, inset 0 0 ${size * 0.15}px ${glow}20`
            : isTop3
              ? `0 0 ${size * 0.3}px ${ringColor}40`
              : `0 2px 8px rgba(0,0,0,.3)`,
          animation: bobbing ? 'avatarBob 1.2s ease-in-out infinite' : undefined,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {!src && <span style={{ textShadow: '0 1px 3px rgba(0,0,0,.4)' }}>{initials}</span>}
      </div>

      {/* Rank badge */}
      {showRank && rank !== undefined && rank <= 3 && size >= 24 && (
        <div
          style={{
            position: 'absolute', bottom: -3, right: -3,
            width: Math.max(size * 0.38, 16), height: Math.max(size * 0.38, 16),
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${RANK_COLORS[rank - 1] ?? CV.gray}, ${RANK_COLORS[rank - 1] ?? CV.gray}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.max(size * 0.2, 9), fontWeight: 900, color: '#000',
            border: `2px solid ${CV.bg1}`,
            boxShadow: `0 2px 6px rgba(0,0,0,.4), 0 0 8px ${RANK_COLORS[rank - 1] ?? CV.gray}40`,
            zIndex: 2,
          }}
        >
          {rank}
        </div>
      )}
    </div>
  );
};

export default Avatar;
