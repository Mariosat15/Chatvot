'use client';
// ─── TraderCard — Premium Derby Stats Modal ─────────────────────────────────
import React from 'react';
import type { Participant } from './types';
import { CV } from './constants';
import { getTier } from './constants';
import { fmt, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, calcSharpe, riskLevel, getTraderTitle } from './helpers';
import Avatar from './Avatar';

interface TraderCardProps {
  participant: Participant;
  rank: number;
  startCap: number;
  onClose: () => void;
}

const TraderCard: React.FC<TraderCardProps> = ({ participant: p, rank, startCap, onClose }) => {
  const tier = getTier(rank);
  const roi = calcRoi(p.liveEquity, startCap);
  const pf = calcProfitFactor(p.averageWin, p.averageLoss, p.winningTrades, p.losingTrades);
  const sharpe = calcSharpe(roi, pf);
  const risk = riskLevel(p, startCap);
  const titleObj = getTraderTitle(p, startCap);

  const statRow = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${CV.bd0}60` }}>
      <span style={{ color: CV.gray, fontSize: 12 }}>{label}</span>
      <span style={{
        color: color || CV.txt, fontSize: 12, fontWeight: 600,
        fontFamily: '"SF Mono", Consolas, monospace',
      }}>
        {value}
      </span>
    </div>
  );

  // Badge definitions
  const badges: { emoji: string; label: string; color: string }[] = [];
  if (rank <= 3) badges.push({ emoji: '🏆', label: 'Champion', color: CV.gold });
  if (p.winRate > 65) badges.push({ emoji: '🎯', label: 'Sharpshooter', color: CV.teal });
  if (p.maxDrawdownPercentage > 25) badges.push({ emoji: '🔥', label: 'Risk Taker', color: CV.red });
  if (p.totalTrades > 50) badges.push({ emoji: '⚡', label: 'Active Trader', color: CV.blue });
  if (roi > 30) badges.push({ emoji: '🚀', label: 'Rocket', color: CV.oran });
  if (pf > 3) badges.push({ emoji: '💎', label: 'Diamond Hands', color: CV.purp });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2,2,8,.8)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400, maxHeight: '90vh', overflow: 'auto',
          background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
          borderRadius: 22,
          border: `2px solid ${tier.border}`,
          boxShadow: `0 0 50px ${tier.glow}, 0 30px 60px rgba(0,0,0,.6)`,
          animation: 'scaleIn .3s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          background: tier.header,
          padding: '28px 24px 20px', textAlign: 'center',
          borderRadius: '20px 20px 0 0',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(circle at 50% 0%, ${tier.border}15, transparent 70%)`,
          }} />

          {/* Tier tag */}
          <div style={{
            display: 'inline-block', background: tier.tag,
            padding: '4px 14px', borderRadius: 12, marginBottom: 14,
            color: tier.tagColor, fontSize: 11, fontWeight: 700, letterSpacing: .5,
            border: `1px solid ${tier.border}25`,
            position: 'relative',
          }}>
            {tier.tagLabel}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
            <Avatar src={p.profileImage} name={p.username} size={80} rank={rank} showRank glow={tier.border} bobbing />
          </div>

          <div style={{ color: CV.txt, fontSize: 20, fontWeight: 700, position: 'relative' }}>{p.username}</div>
          <div style={{ color: tier.tagColor, fontSize: 12, marginTop: 4, position: 'relative' }}>
            {titleObj.emoji} {titleObj.title}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
              {badges.map((b, i) => (
                <span key={i} style={{
                  background: 'rgba(0,0,0,.3)', color: b.color,
                  padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  border: `1px solid ${b.color}25`,
                  backdropFilter: 'blur(4px)',
                }}>
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ padding: '18px 24px' }}>
          {/* Hero stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Equity', value: fmt(p.liveEquity), color: CV.teal },
              { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
              { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red },
            ].map((s, i) => (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                border: `1px solid ${CV.bd0}`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '50%', height: 1, background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)`,
                }} />
                <div style={{ color: CV.gray, fontSize: 10, marginBottom: 5 }}>{s.label}</div>
                <div style={{
                  color: s.color, fontSize: 17, fontWeight: 700,
                  fontFamily: '"SF Mono", Consolas, monospace',
                  textShadow: `0 0 8px ${s.color}20`,
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Detail stats */}
          {statRow('Rank', `#${rank}`, rank <= 3 ? CV.gold : CV.txt)}
          {statRow('Win Rate', `${p.winRate.toFixed(1)}%`, p.winRate > 50 ? CV.teal : CV.red)}
          {statRow('Total Trades', `${p.totalTrades}`)}
          {statRow('Profit Factor', pf === Infinity ? '∞' : pf.toFixed(2), pf > 1 ? CV.teal : CV.red)}
          {statRow('Sharpe Ratio', sharpe.toFixed(2), sharpe > 1 ? CV.teal : CV.gray)}
          {statRow('Max Drawdown', `${p.maxDrawdownPercentage.toFixed(1)}%`, CV.red)}
          {statRow('Risk Level', risk.label, risk.color)}
          {statRow('Current Leverage', p.usedMargin > 0 ? `${(p.usedMargin / p.liveEquity * 100).toFixed(0)}%` : 'None')}
          {statRow('Open Positions', `${p.currentOpenPositions}`)}
          {statRow('Largest Win', fmt(p.largestWin), CV.teal)}
          {statRow('Largest Loss', fmt(p.largestLoss), CV.red)}

          {/* Open positions */}
          {p.openPositions && p.openPositions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: CV.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: .5 }}>
                OPEN POSITIONS
              </div>
              {p.openPositions.map((pos, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 10px', marginBottom: 4, borderRadius: 10,
                  background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                  border: `1px solid ${CV.bd0}`,
                }}>
                  <div>
                    <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{pos.symbol}</span>
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 700,
                      color: pos.side === 'long' ? CV.teal : CV.red,
                      padding: '1px 6px', borderRadius: 4,
                      background: pos.side === 'long' ? `${CV.teal}12` : `${CV.red}12`,
                    }}>
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <span style={{
                    color: pos.unrealizedPnl >= 0 ? CV.teal : CV.red,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: '"SF Mono", Consolas, monospace',
                  }}>
                    {fmtPnl(pos.unrealizedPnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
              border: `1px solid ${CV.bd2}`,
              color: CV.lgt, padding: '10px 40px', borderRadius: 12,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all .2s',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraderCard;
