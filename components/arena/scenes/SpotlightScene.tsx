'use client';
// ─── SpotlightScene — Premium Trader Focus ───────────────────────────────────
import React, { useState, useMemo } from 'react';
import type { AEvent, CandleData, BubbleTrade } from '../types';
import { CV, getTier } from '../constants';
import { ranked, fmtEquity, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, riskLevel, getTraderTitle, calcSharpe, getAllPositions } from '../helpers';
import Avatar from '../Avatar';
import BroadcastChart from '../BroadcastChart';

interface SpotlightSceneProps {
  event: AEvent;
  chartSymbol: string;
  chartTf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  availableSymbols?: string[];
  onSymbolChange: (s: string) => void;
  onTfChange: (tf: string) => void;
}

const mono = '"SF Mono", Consolas, "Courier New", monospace';

const SpotlightScene: React.FC<SpotlightSceneProps> = ({
  event, chartSymbol, chartTf, candles, bubbles, availableSymbols, onSymbolChange, onTfChange,
}) => {
  const sorted = useMemo(() => ranked(event.participants), [event.participants]);
  const [idx, setIdx] = useState(0);
  const p = sorted[idx];
  if (!p) return <div style={{ color: CV.gray, padding: 40, textAlign: 'center' }}>No participants</div>;

  const rank = idx + 1;
  const roi = calcRoi(p.liveEquity, event.startingCapital);
  const pf = calcProfitFactor(p.averageWin, p.averageLoss, p.winningTrades, p.losingTrades);
  const tier = getTier(rank);
  const risk = riskLevel(p, event.startingCapital);
  const title = getTraderTitle(p, event.startingCapital);
  const sharpe = calcSharpe(roi, pf);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left: Spotlight card */}
      <div style={{ width: 380, flexShrink: 0 }}>
        <div style={{
          background: `linear-gradient(180deg, ${CV.bg2}, ${CV.bg1})`,
          borderRadius: 18,
          border: `2px solid ${tier.border}`,
          boxShadow: `0 0 40px ${tier.glow}, 0 20px 40px rgba(0,0,0,.5)`,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: tier.header,
            padding: '24px 20px 18px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Radial glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 0%, ${tier.border}12, transparent 70%)`,
            }} />

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
              <button
                onClick={() => setIdx(Math.max(0, idx - 1))}
                style={{
                  background: 'rgba(0,0,0,.4)', border: `1px solid ${CV.bd2}`, color: CV.lgt,
                  borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  backdropFilter: 'blur(4px)', transition: 'all .2s',
                }}
              >
                ← Prev
              </button>
              <span style={{ color: CV.gray, fontSize: 12, fontWeight: 600, lineHeight: '26px' }}>
                #{rank} of {sorted.length}
              </span>
              <button
                onClick={() => setIdx(Math.min(sorted.length - 1, idx + 1))}
                style={{
                  background: 'rgba(0,0,0,.4)', border: `1px solid ${CV.bd2}`, color: CV.lgt,
                  borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  backdropFilter: 'blur(4px)', transition: 'all .2s',
                }}
              >
                Next →
              </button>
            </div>

            {/* Tier */}
            <div style={{
              display: 'inline-block', background: tier.tag, color: tier.tagColor,
              padding: '4px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              border: `1px solid ${tier.border}20`, marginBottom: 12, position: 'relative',
            }}>
              {tier.tagLabel}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, position: 'relative' }}>
              <Avatar src={p.profileImage} name={p.username} size={80} rank={rank} showRank glow={tier.border} bobbing />
            </div>

            <div style={{ color: CV.txt, fontSize: 22, fontWeight: 700, position: 'relative' }}>{p.username}</div>
            <div style={{ color: tier.tagColor, fontSize: 13, marginTop: 4, position: 'relative' }}>
              {title.emoji} {title.title}
            </div>
          </div>

          {/* Stats body */}
          <div style={{ padding: '16px 20px' }}>
            {/* Hero grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'EQUITY', value: fmtEquity(p.liveEquity), color: CV.teal },
                { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
                { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red },
              ].map((s, i) => (
                <div key={i} style={{
                  background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                  borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                  border: `1px solid ${CV.bd0}`, position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)`,
                  }} />
                  <div style={{ color: CV.gray, fontSize: 9, marginBottom: 4, letterSpacing: .5 }}>{s.label}</div>
                  <div style={{
                    color: s.color, fontSize: 16, fontWeight: 700, fontFamily: mono,
                    textShadow: `0 0 6px ${s.color}15`,
                  }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Detail rows */}
            {[
              { label: 'Win Rate', value: `${p.winRate.toFixed(1)}%`, color: p.winRate > 50 ? CV.teal : CV.red },
              { label: 'Trades', value: `${p.totalTrades}` },
              { label: 'Profit Factor', value: pf === Infinity ? '∞' : pf.toFixed(2), color: pf > 1 ? CV.teal : CV.red },
              { label: 'Sharpe Ratio', value: sharpe.toFixed(2), color: sharpe > 1 ? CV.teal : CV.gray },
              { label: 'Max Drawdown', value: `${p.maxDrawdownPercentage.toFixed(1)}%`, color: CV.red },
              { label: 'Risk Level', value: risk.label, color: risk.color },
              { label: 'Open Positions', value: `${p.currentOpenPositions}` },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: `1px solid ${CV.bd0}50`,
              }}>
                <span style={{ color: CV.gray, fontSize: 11 }}>{s.label}</span>
                <span style={{ color: s.color || CV.txt, fontSize: 11, fontWeight: 600, fontFamily: mono }}>{s.value}</span>
              </div>
            ))}

            {/* Open positions */}
            {p.openPositions && p.openPositions.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: CV.gray, fontSize: 10, fontWeight: 600, marginBottom: 6, letterSpacing: .5 }}>
                  OPEN POSITIONS
                </div>
                {p.openPositions.map((pos, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 10px', marginBottom: 3, borderRadius: 8,
                    background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                    border: `1px solid ${CV.bd0}`,
                  }}>
                    <span style={{ color: CV.txt, fontSize: 11 }}>
                      {pos.symbol}{' '}
                      <span style={{
                        color: pos.side === 'long' ? CV.teal : CV.red, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 4, fontSize: 9,
                        background: pos.side === 'long' ? `${CV.teal}12` : `${CV.red}12`,
                      }}>
                        {pos.side.toUpperCase()}
                      </span>
                    </span>
                    <span style={{ color: pos.unrealizedPnl >= 0 ? CV.teal : CV.red, fontSize: 11, fontWeight: 600, fontFamily: mono }}>
                      {fmtPnl(pos.unrealizedPnl)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Chart with position markers */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BroadcastChart
          symbol={chartSymbol}
          tf={chartTf}
          candles={candles}
          bubbles={bubbles}
          positions={getAllPositions(event.participants)}
          dynamicSymbols={availableSymbols}
          onSymbolChange={onSymbolChange}
          onTfChange={onTfChange}
        />
      </div>
    </div>
  );
};

export default SpotlightScene;
