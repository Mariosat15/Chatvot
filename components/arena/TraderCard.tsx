'use client';
// ─── TraderCard — Premium Arena Stats Modal ─────────────────────────────────
import React from 'react';
import type { Participant } from './types';
import { CV, getTier } from './constants';
import { fmt, fmtEquity, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, calcSharpe, riskLevel, getTraderTitle } from './helpers';
import Avatar from './Avatar';
import ArenaIcon from './ArenaIcon';

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

  const statRow = (label: string, value: string, color?: string, icon?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${CV.bd0}60` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <ArenaIcon name={icon} size={11} color={CV.gray} />}
        <span style={{ color: CV.gray, fontSize: 12 }}>{label}</span>
      </div>
      <span style={{
        color: color || CV.txt, fontSize: 12, fontWeight: 600,
        fontFamily: '"SF Mono", Consolas, monospace',
      }}>
        {value}
      </span>
    </div>
  );

  // Badge definitions with Lucide icons
  const badges: { icon: string; label: string; color: string }[] = [];
  if (rank <= 3) badges.push({ icon: 'Trophy', label: 'Champion', color: CV.gold });
  if (p.winRate > 65) badges.push({ icon: 'Target', label: 'Sharpshooter', color: CV.teal });
  if (p.maxDrawdownPercentage > 25) badges.push({ icon: 'Flame', label: 'Risk Taker', color: CV.red });
  if (p.totalTrades > 50) badges.push({ icon: 'Zap', label: 'Active Trader', color: CV.blue });
  if (roi > 30) badges.push({ icon: 'Rocket', label: 'Rocket', color: CV.oran });
  if (pf > 3) badges.push({ icon: 'Award', label: 'Diamond Hands', color: CV.purp });

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
          width: 420, maxHeight: '90vh', overflow: 'auto',
          background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
          borderRadius: 22,
          border: `2px solid ${tier.border}`,
          boxShadow: `0 0 50px ${tier.glow}, 0 30px 60px rgba(0,0,0,.6)`,
          animation: 'scaleIn .3s ease-out',
        }}
      >
        {/* Close button (top right) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: `${CV.bg3}CC`, border: `1px solid ${CV.bd1}`,
            color: CV.gray, width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, transition: 'all .2s',
          }}
        >
          <ArenaIcon name="X" size={14} />
        </button>

        {/* Header */}
        <div style={{
          background: tier.header,
          padding: '28px 24px 20px', textAlign: 'center',
          borderRadius: '20px 20px 0 0',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(circle at 50% 0%, ${tier.border}15, transparent 70%)`,
          }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: tier.tag, padding: '4px 14px', borderRadius: 12, marginBottom: 14,
            color: tier.tagColor, fontSize: 11, fontWeight: 700, letterSpacing: .5,
            border: `1px solid ${tier.border}25`, position: 'relative',
          }}>
            <ArenaIcon name="Crown" size={12} color={tier.tagColor} />
            {tier.tagLabel}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
            <Avatar src={p.profileImage} name={p.username} size={80} rank={rank} showRank glow={tier.border} bobbing />
          </div>

          <div style={{ color: CV.txt, fontSize: 20, fontWeight: 700, position: 'relative' }}>{p.username}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: tier.tagColor, fontSize: 12, marginTop: 4, position: 'relative' }}>
            <ArenaIcon name={titleObj.icon} size={14} color={tier.tagColor} />
            {titleObj.title}
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
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <ArenaIcon name={b.icon} size={10} color={b.color} />
                  {b.label}
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
              { label: 'Equity', value: fmtEquity(p.liveEquity), color: CV.teal, icon: 'Wallet' },
              { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red, icon: 'TrendingUp' },
              { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red, icon: 'DollarSign' },
            ].map((s, i) => (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                border: `1px solid ${CV.bd0}`, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '50%', height: 1, background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)`,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, color: CV.gray, fontSize: 10, marginBottom: 5 }}>
                  <ArenaIcon name={s.icon} size={10} color={CV.gray} />
                  {s.label}
                </div>
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
          {statRow('Rank', `#${rank}`, rank <= 3 ? CV.gold : CV.txt, 'Medal')}
          {statRow('Win Rate', `${p.winRate.toFixed(1)}%`, p.winRate > 50 ? CV.teal : CV.red, 'Target')}
          {statRow('Total Trades', `${p.totalTrades}`, undefined, 'BarChart3')}
          {statRow('Profit Factor', pf === Infinity ? '∞' : pf.toFixed(2), pf > 1 ? CV.teal : CV.red, 'Scale')}
          {statRow('Sharpe Ratio', sharpe.toFixed(2), sharpe > 1 ? CV.teal : CV.gray, 'LineChart')}
          {statRow('Max Drawdown', `${p.maxDrawdownPercentage.toFixed(1)}%`, CV.red, 'AlertTriangle')}
          {statRow('Risk Level', risk.label, risk.color, risk.icon)}
          {statRow('Current Leverage', p.usedMargin > 0 ? `${(p.usedMargin / p.liveEquity * 100).toFixed(0)}%` : 'None', undefined, 'Layers')}
          {statRow('Open Positions', `${p.currentOpenPositions}`, undefined, 'Activity')}
          {statRow('Largest Win', fmt(p.largestWin), CV.teal, 'ArrowUpRight')}
          {statRow('Largest Loss', fmt(p.largestLoss), CV.red, 'ArrowDownRight')}

          {/* Open positions */}
          {p.openPositions && p.openPositions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: CV.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: .5 }}>
                <ArenaIcon name="Activity" size={12} color={CV.gray} />
                OPEN POSITIONS
              </div>
              {p.openPositions.map((pos, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 10px', marginBottom: 4, borderRadius: 10,
                  background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                  border: `1px solid ${CV.bd0}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArenaIcon
                      name={pos.side === 'long' ? 'TrendingUp' : 'TrendingDown'}
                      size={12}
                      color={pos.side === 'long' ? CV.teal : CV.red}
                    />
                    <span style={{ color: CV.txt, fontSize: 12, fontWeight: 600 }}>{pos.symbol}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
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

        {/* Close button bottom */}
        <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
              border: `1px solid ${CV.bd2}`, color: CV.lgt,
              padding: '10px 40px', borderRadius: 12,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all .2s', display: 'flex', alignItems: 'center',
              gap: 6, margin: '0 auto',
            }}
          >
            <ArenaIcon name="X" size={12} /> Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraderCard;
