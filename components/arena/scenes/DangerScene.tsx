'use client';
// ─── DangerScene — Premium Danger Zone / Margin & Drawdown Warnings ─────────
import React, { useMemo } from 'react';
import type { AEvent, Participant } from '../types';
import { CV } from '../constants';
import { ranked, fmt, fmtRoi, calcRoi, riskLevel, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';

interface DangerSceneProps {
  event: AEvent;
  onSelectTrader: (p: Participant) => void;
}

const mono = '"SF Mono", Consolas, "Courier New", monospace';

const DangerScene: React.FC<DangerSceneProps> = ({ event, onSelectTrader }) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);

  // Traders in danger: negative ROI or high drawdown
  const inDanger = sorted.filter(p => {
    const roi = calcRoi(p.liveEquity, event.startingCapital);
    return roi < -5 || p.maxDrawdownPercentage > 20 || (p.usedMargin / p.liveEquity) > 0.7;
  });

  // Near margin call (>80%)
  const marginAlerts = sorted.filter(p => p.liveEquity > 0 && (p.usedMargin / p.liveEquity) > 0.8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, rgba(255,73,91,.06), ${CV.bg2})`,
        borderRadius: 18, border: `1px solid ${CV.red}25`,
        padding: '22px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Animated danger stripe */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `repeating-linear-gradient(90deg, ${CV.red}, ${CV.red} 20px, transparent 20px, transparent 40px)`,
          animation: 'trackMarkings 1s linear infinite',
          opacity: .6,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${CV.red}20, ${CV.oran}10)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${CV.red}30`,
            animation: 'glowPulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
          </div>
          <div>
            <span style={{
              color: CV.red, fontWeight: 700, fontSize: 18, letterSpacing: 1,
              textShadow: `0 0 15px ${CV.red}20`,
            }}>
              DANGER ZONE
            </span>
            <div style={{ color: CV.gray, fontSize: 11, marginTop: 2 }}>
              Traders with significant drawdowns, high margin usage, or negative ROI
            </div>
          </div>
        </div>
      </div>

      {/* Margin Alert Banner */}
      {marginAlerts.length > 0 && (
        <div style={{
          background: `linear-gradient(135deg, ${CV.red}08, ${CV.bg3})`,
          borderRadius: 14, border: `1px solid ${CV.red}25`,
          padding: '14px 18px', animation: 'derbyPulse 2s ease-in-out infinite',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 0%, ${CV.red}08, transparent 60%)`,
          }} />
          <div style={{
            color: CV.red, fontWeight: 700, fontSize: 13, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: CV.red, animation: 'glowPulse 1s ease-in-out infinite',
              boxShadow: `0 0 8px ${CV.red}`,
            }} />
            MARGIN ALERT — {marginAlerts.length} trader{marginAlerts.length > 1 ? 's' : ''} near margin call
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
            {marginAlerts.map(p => {
              const marginPct = p.liveEquity > 0 ? (p.usedMargin / p.liveEquity * 100) : 0;
              return (
                <div
                  key={p.userId}
                  onClick={() => onSelectTrader(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(0,0,0,.35)', padding: '7px 14px', borderRadius: 10,
                    cursor: 'pointer', border: `1px solid ${CV.red}25`,
                    backdropFilter: 'blur(4px)', transition: 'all .2s',
                  }}
                >
                  <Avatar src={p.profileImage} name={p.username} size={24} glow={CV.red} />
                  <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{p.username}</span>
                  <span style={{
                    color: CV.red, fontSize: 11, fontWeight: 700, fontFamily: mono,
                    background: `${CV.red}12`, padding: '2px 6px', borderRadius: 4,
                  }}>
                    {marginPct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger list */}
      <div style={{
        background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
        borderRadius: 18, border: `1px solid ${CV.bd1}`,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${CV.bd0}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: CV.red, fontWeight: 700, fontSize: 14, letterSpacing: .5 }}>
            🚨 AT RISK
          </span>
          <span style={{
            background: `${CV.red}15`, color: CV.red, padding: '2px 10px',
            borderRadius: 10, fontSize: 11, fontWeight: 700,
          }}>
            {inDanger.length}
          </span>
        </div>

        {inDanger.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: CV.teal,
            fontSize: 14, fontWeight: 600,
          }}>
            <span style={{ fontSize: 30, display: 'block', marginBottom: 8 }}>🟢</span>
            All racers are in safe territory
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
                  padding: '14px 18px', cursor: 'pointer',
                  borderBottom: `1px solid ${CV.bd0}50`,
                  background: i % 2 === 0 ? 'transparent' : `${CV.red}03`,
                  animation: marginPct > 80 ? 'slowGlow 2s ease-in-out infinite' : undefined,
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${CV.red}08`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : `${CV.red}03`; }}
              >
                <span style={{
                  color: CV.gray, fontWeight: 700, fontSize: 12,
                  width: 28, textAlign: 'center', flexShrink: 0,
                }}>
                  #{rank}
                </span>

                <Avatar src={p.profileImage} name={p.username} size={38} glow={CV.red} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: CV.txt, fontSize: 13, fontWeight: 600 }}>{p.username}</div>
                  <div style={{ color: CV.gray, fontSize: 10 }}>{title.emoji} {title.title}</div>
                </div>

                {/* Danger indicators */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  {[
                    { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
                    { label: 'DD', value: `${p.maxDrawdownPercentage.toFixed(1)}%`, color: CV.red },
                    { label: 'Margin', value: `${marginPct.toFixed(0)}%`, color: marginPct > 80 ? CV.red : marginPct > 50 ? CV.oran : CV.teal },
                  ].map((ind, j) => (
                    <div key={j} style={{ textAlign: 'center', minWidth: 48 }}>
                      <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .3 }}>{ind.label}</div>
                      <div style={{ color: ind.color, fontWeight: 700, fontSize: 12, fontFamily: mono }}>
                        {ind.value}
                      </div>
                    </div>
                  ))}
                  <span style={{
                    padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: `${risk.color}12`, color: risk.color,
                    border: `1px solid ${risk.color}20`,
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
