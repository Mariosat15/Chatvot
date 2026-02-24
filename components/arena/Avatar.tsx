'use client';
// ─── Avatar Component ─────────────────────────────────────────────────────────
import React from 'react';
import { AV_GRADS, CV } from './constants';
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

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          background: src ? `url(${src}) center/cover` : `linear-gradient(135deg,${grad})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 700, color: '#fff',
          border: `2px solid ${glow || CV.bd2}`,
          boxShadow: glow ? `0 0 12px ${glow}` : 'none',
          animation: bobbing ? 'avatarBob 1.2s ease-in-out infinite' : undefined,
          overflow: 'hidden',
        }}
      >
        {!src && initials}
      </div>
      {showRank && rank !== undefined && rank <= 3 && (
        <div
          style={{
            position: 'absolute', bottom: -4, right: -4,
            width: size * 0.4, height: size * 0.4,
            borderRadius: '50%',
            background: rank === 1 ? CV.gold : rank === 2 ? '#C0C0C0' : '#CD7F32',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.22, fontWeight: 800, color: '#000',
            border: `2px solid ${CV.bg1}`,
          }}
        >
          {rank}
        </div>
      )}
    </div>
  );
};

export default Avatar;
