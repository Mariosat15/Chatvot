'use client';
// ─── Ticker — Premium Live Price Marquee with Dynamic Symbols ────────────────
import React, { useMemo } from 'react';
import type { PriceMap } from './types';
import { CV, TICKER_SYMS, TICKER_LABELS } from './constants';

interface TickerProps {
  prices: PriceMap;
  prevPrices?: PriceMap;
  /** Dynamic symbols from API — overrides TICKER_SYMS when available */
  dynamicSymbols?: string[];
}

// Reason: Convert slash format "EUR/USD" to compact "EURUSD" for internal keys
const toKey = (s: string) => s.replace('/', '');
// Reason: Convert compact "EURUSD" to display "EUR/USD"
const toLabel = (s: string) =>
  s.includes('/') ? s : s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;

const Ticker: React.FC<TickerProps> = ({ prices, prevPrices, dynamicSymbols }) => {
  // Reason: Use dynamic symbols from API if available, otherwise use hardcoded fallback.
  // This ensures the ticker shows all admin-enabled pairs.
  const symbolList = useMemo(() => {
    if (dynamicSymbols && dynamicSymbols.length > 0) {
      return dynamicSymbols.map(s => toKey(s));
    }
    return TICKER_SYMS;
  }, [dynamicSymbols]);

  const items = symbolList.map(sym => {
    const price = prices[sym] || 0;
    const prev = prevPrices?.[sym] || 0;
    // Reason: Only show direction if we actually have a different previous price
    const direction = prev > 0 && price !== prev
      ? (price > prev ? 'up' : price < prev ? 'down' : 'flat')
      : 'flat';
    const label = TICKER_LABELS[sym] || toLabel(sym);
    return { sym, price, direction, label };
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
          // Reason: 5 decimals for standard pairs, 3 for JPY crosses
          const decimals = isJpy ? 3 : 5;

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
