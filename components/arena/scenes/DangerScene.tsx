'use client';
// ─── DangerScene — Danger Zone / Margin & Drawdown Warnings ──────────────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV } from '../constants';
import { ranked, fmt, fmtRoi, calcRoi, riskLevel, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';

interface DangerSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const DangerScene: React.FC<DangerSceneProps> = ({ event, onSelectTrader }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);

  // Traders in danger: negative ROI or high drawdown
  const inDanger = sorted.filter(p => {
    const roi = calcRoi(p.liveEquity, event.startingCapital);
    return roi < -5 || p.maxDrawdownPercentage > 20 || (p.usedMargin / p.liveEquity) > 0.7;
  });

  // Traders near margin call (>80% used margin)
  const marginAlerts = sorted.filter(p => p.liveEquity > 0 && (p.usedMargin / p.liveEquity) > 0.8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, rgba(255,73,91,.08), ${CV.bg2})`,
        borderRadius: 16, border: `1px solid ${CV.red}30`,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <span style={{ color: CV.red, fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
            DANGER ZONE
          </span>
        </div>
        <div style={{ color: CV.gray, fontSize: 12 }}>
          Traders with significant drawdowns, high margin usage, or negative ROI.
        </div>
      </div>

      {/* Margin Alert Banner */}
      {marginAlerts.length > 0 && (
        <div style={{
          background: `rgba(255,73,91,.06)`, borderRadius: 12,
          border: `1px solid ${CV.red}30`, padding: '12px 16px',
          animation: 'derbyPulse 2s ease-in-out infinite',
        }}>
          <div style={{ color: CV.red, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            🔴 MARGIN ALERT — {marginAlerts.length} trader{marginAlerts.length > 1 ? 's' : ''} near margin call
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {marginAlerts.map(p => {
              const marginPct = p.liveEquity > 0 ? (p.usedMargin / p.liveEquity * 100) : 0;
              return (
                <div
                  key={p.userId}
                  onClick={() => onSelectTrader(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(0,0,0,.3)', padding: '6px 12px', borderRadius: 8,
                    cursor: 'pointer', border: `1px solid ${CV.red}30`,
                  }}
                >
                  <Avatar src={p.profileImage} name={p.username} size={24} glow={CV.red} />
                  <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{p.username}</span>
                  <span style={{ color: CV.red, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                    {marginPct.toFixed(0)}% margin
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger list */}
      <div style={{
        background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${CV.bd0}` }}>
          <span style={{ color: CV.red, fontWeight: 700, fontSize: 13, letterSpacing: .5 }}>
            🚨 AT RISK ({inDanger.length})
          </span>
        </div>

        {inDanger.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: CV.gray }}>
            All racers are in safe territory 🟢
          </div>
        ) : (
          inDanger.map((p, i) => {
            const roi = calcRoi(p.liveEquity, event.startingCapital);
            const risk = riskLevel(p, event.startingCapital);
            const title = getTraderTitle(p, event.startingCapital);
            const marginPct = p.liveEquity > 0 ? (p.usedMargin / p.liveEquity * 100) : 0;
            const rank = sorted.findIndex(s => s.userId === p.userId) + 1;

            return (
              <div
                key={p.userId}
                onClick={() => onSelectTrader(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: `1px solid ${CV.bd0}`,
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,73,91,.02)',
                  animation: marginPct > 80 ? 'slowGlow 2s ease-in-out infinite' : undefined,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,73,91,.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,73,91,.02)'; }}
              >
                <span style={{ color: CV.gray, fontWeight: 700, fontSize: 12, width: 28, textAlign: 'center' }}>
                  #{rank}
                </span>

                <Avatar src={p.profileImage} name={p.username} size={36} glow={CV.red} />

                <div style={{ flex: 1 }}>
                  <div style={{ color: CV.txt, fontSize: 13, fontWeight: 600 }}>{p.username}</div>
                  <div style={{ color: CV.gray, fontSize: 10 }}>{title.emoji} {title.title}</div>
                </div>

                {/* Danger indicators */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: CV.gray, fontSize: 9 }}>ROI</div>
                    <div style={{ color: roi >= 0 ? CV.teal : CV.red, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
                      {fmtRoi(roi)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: CV.gray, fontSize: 9 }}>DD</div>
                    <div style={{ color: CV.red, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
                      {p.maxDrawdownPercentage.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: CV.gray, fontSize: 9 }}>Margin</div>
                    <div style={{ color: marginPct > 80 ? CV.red : marginPct > 50 ? CV.oran : CV.teal, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
                      {marginPct.toFixed(0)}%
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: `${risk.color}15`, color: risk.color,
                  }}>
                    {risk.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DangerScene;
