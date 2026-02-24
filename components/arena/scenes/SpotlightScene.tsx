'use client';
// ─── SpotlightScene — Focus on a single trader ───────────────────────────────
import React, { useState, useMemo } from 'react';
import type { AEvent, Participant, CandleData, BubbleTrade } from '../types';
import { CV } from '../constants';
import { ranked, fmt, fmtRoi, fmtPnl, calcRoi, calcProfitFactor, riskLevel, getTraderTitle } from '../helpers';
import Avatar from '../Avatar';
import BroadcastChart from '../BroadcastChart';
import { getTier } from '../constants';

interface SpotlightSceneProps {
  event: AEvent;
  chartSymbol: string;
  chartTf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  onSymbolChange: (s: string) => void;
  onTfChange: (tf: string) => void;
}

const SpotlightScene: React.FC<SpotlightSceneProps> = ({
  event, chartSymbol, chartTf, candles, bubbles, onSymbolChange, onTfChange,
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

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left: Spotlight card */}
      <div style={{ width: 360, flexShrink: 0 }}>
        <div style={{
          background: tier.header, borderRadius: 16, border: `2px solid ${tier.border}`,
          boxShadow: `0 0 30px ${tier.glow}`, padding: 24, textAlign: 'center',
        }}>
          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              onClick={() => setIdx(Math.max(0, idx - 1))}
              style={{
                background: CV.bg3, border: `1px solid ${CV.bd1}`, color: CV.gray,
                borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
              }}
            >
              ← Prev
            </button>
            <span style={{ color: CV.gray, fontSize: 12 }}>#{rank} of {sorted.length}</span>
            <button
              onClick={() => setIdx(Math.min(sorted.length - 1, idx + 1))}
              style={{
                background: CV.bg3, border: `1px solid ${CV.bd1}`, color: CV.gray,
                borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
              }}
            >
              Next →
            </button>
          </div>

          {/* Tier tag */}
          <div style={{
            display: 'inline-block', background: tier.tag, color: tier.tagColor,
            padding: '3px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, marginBottom: 12,
          }}>
            {tier.tagLabel}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Avatar src={p.profileImage} name={p.username} size={80} rank={rank} showRank glow={tier.border} bobbing />
          </div>

          <div style={{ color: CV.txt, fontSize: 22, fontWeight: 700 }}>{p.username}</div>
          <div style={{ color: tier.tagColor, fontSize: 13, marginTop: 4 }}>
            {title.emoji} {title.title}
          </div>

          {/* Hero stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 18 }}>
            {[
              { label: 'Equity', value: fmt(p.liveEquity), color: CV.teal },
              { label: 'ROI', value: fmtRoi(roi), color: roi >= 0 ? CV.teal : CV.red },
              { label: 'P&L', value: fmtPnl(p.livePnl), color: p.livePnl >= 0 ? CV.teal : CV.red },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,.2)', borderRadius: 10, padding: '10px 6px',
                border: `1px solid ${CV.bd0}`,
              }}>
                <div style={{ color: CV.gray, fontSize: 10, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 17, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Additional stats */}
          <div style={{ marginTop: 14, textAlign: 'left' }}>
            {[
              { label: 'Win Rate', value: `${p.winRate.toFixed(1)}%`, color: p.winRate > 50 ? CV.teal : CV.red },
              { label: 'Trades', value: `${p.totalTrades}` },
              { label: 'Profit Factor', value: pf === Infinity ? '∞' : pf.toFixed(2), color: pf > 1 ? CV.teal : CV.red },
              { label: 'Max DD', value: `${p.maxDrawdownPercentage.toFixed(1)}%`, color: CV.red },
              { label: 'Risk Level', value: risk.label, color: risk.color },
              { label: 'Open Pos', value: `${p.currentOpenPositions}` },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '5px 0',
                borderBottom: `1px solid ${CV.bd0}`,
              }}>
                <span style={{ color: CV.gray, fontSize: 11 }}>{s.label}</span>
                <span style={{ color: s.color || CV.txt, fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Positions */}
          {p.openPositions && p.openPositions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: CV.gray, fontSize: 10, fontWeight: 600, marginBottom: 6, textAlign: 'left', letterSpacing: .5 }}>
                OPEN POSITIONS
              </div>
              {p.openPositions.map((pos, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 8px', marginBottom: 3, borderRadius: 6,
                  background: 'rgba(0,0,0,.2)', border: `1px solid ${CV.bd0}`,
                }}>
                  <span style={{ color: CV.txt, fontSize: 11 }}>
                    {pos.symbol} <span style={{ color: pos.side === 'long' ? CV.teal : CV.red, fontWeight: 700 }}>{pos.side.toUpperCase()}</span>
                  </span>
                  <span style={{ color: pos.unrealizedPnl >= 0 ? CV.teal : CV.red, fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>
                    {fmtPnl(pos.unrealizedPnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Chart + live feed */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BroadcastChart
          symbol={chartSymbol}
          tf={chartTf}
          candles={candles}
          bubbles={bubbles}
          onSymbolChange={onSymbolChange}
          onTfChange={onTfChange}
        />
      </div>
    </div>
  );
};

export default SpotlightScene;
