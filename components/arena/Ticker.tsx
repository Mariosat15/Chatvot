'use client';
// ─── Ticker — Premium Live Price Marquee ──────────────────────────────────────
import React from 'react';
import type { PriceMap } from './types';
import { CV, TICKER_SYMS, TICKER_LABELS } from './constants';

interface TickerProps {
  prices: PriceMap;
  prevPrices?: PriceMap;
}

const Ticker: React.FC<TickerProps> = ({ prices, prevPrices }) => {
  const items = TICKER_SYMS.map(sym => {
    const price = prices[sym] || 0;
    const prev = prevPrices?.[sym] || 0;
    const direction = price > prev ? 'up' : price < prev ? 'down' : 'flat';
    return { sym, price, direction, label: TICKER_LABELS[sym] || sym };
  });

  // Duplicate 3x for seamless loop
  const all = [...items, ...items, ...items];

  return (
    <div style={{
      overflow: 'hidden',
      borderBottom: `1px solid ${CV.bd0}`,
      background: `linear-gradient(90deg, ${CV.bg0}, ${CV.bg1}, ${CV.bg0})`,
      height: 38,
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* Fade edges */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, zIndex: 2,
        background: `linear-gradient(90deg, ${CV.bg0}, transparent)`,
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, zIndex: 2,
        background: `linear-gradient(270deg, ${CV.bg0}, transparent)`,
      }} />

      <div style={{
        display: 'flex', gap: 40,
        animation: 'tickerScroll 40s linear infinite',
        whiteSpace: 'nowrap',
        paddingLeft: 20,
      }}>
        {all.map((item, i) => {
          const isJpy = item.sym.includes('JPY');
          const isXau = item.sym.includes('XAU');
          const isCrypto = item.sym.includes('BTC') || item.sym.includes('ETH');
          const decimals = isJpy ? 3 : isCrypto ? 2 : isXau ? 2 : 5;

          const dirColor = item.direction === 'up' ? CV.teal
            : item.direction === 'down' ? CV.red
            : CV.lgt;

          const dirArrow = item.direction === 'up' ? '▲'
            : item.direction === 'down' ? '▼'
            : '';

          return (
            <span key={i} style={{
              display: 'inline-flex', gap: 8, alignItems: 'center',
              padding: '4px 12px', borderRadius: 6,
              background: item.direction !== 'flat' ? `${dirColor}08` : 'transparent',
              transition: 'background .3s',
            }}>
              <span style={{
                color: CV.gray, fontSize: 11, fontWeight: 700, letterSpacing: .5,
              }}>
                {item.label}
              </span>
              <span style={{
                color: dirColor,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
                letterSpacing: .3,
                transition: 'color .3s, text-shadow .3s',
                textShadow: item.direction === 'up'
                  ? `0 0 8px ${CV.teal}40`
                  : item.direction === 'down'
                    ? `0 0 8px ${CV.red}40`
                    : 'none',
              }}>
                {item.price > 0 ? item.price.toFixed(decimals) : '—'}
              </span>
              {dirArrow && (
                <span style={{
                  fontSize: 8, color: dirColor, fontWeight: 700,
                  animation: item.direction === 'up' ? 'priceUp .5s ease-out' : 'priceDown .5s ease-out',
                }}>
                  {dirArrow}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default Ticker;
