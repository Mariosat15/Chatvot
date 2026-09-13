'use client';
// ─── Ticker — Premium Live Price Marquee with Lucide Icons ──────────────────
import React, { useMemo } from 'react';
import type { PriceMap } from './types';
import { CV, TICKER_SYMS, TICKER_LABELS } from './constants';
import ArenaIcon from './ArenaIcon';

// Reason: Map currency symbols to Lucide icon names for visual flair
const CURRENCY_ICONS: Record<string, string> = {
  EUR: 'Globe', GBP: 'Globe', USD: 'DollarSign', JPY: 'Globe',
  CAD: 'DollarSign', AUD: 'DollarSign', NZD: 'DollarSign', CHF: 'Globe',
  XAU: 'Award', BTC: 'Wallet', ETH: 'Layers',
};

interface TickerProps {
  prices: PriceMap;
  prevPrices?: PriceMap;
  dynamicSymbols?: string[];
}

const toKey = (s: string) => s.replace('/', '');
const toLabel = (s: string) =>
  s.includes('/') ? s : s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;

const Ticker: React.FC<TickerProps> = ({ prices, prevPrices, dynamicSymbols }) => {
  const symbolList = useMemo(() => {
    if (dynamicSymbols && dynamicSymbols.length > 0) {
      return dynamicSymbols.map(s => toKey(s));
    }
    return TICKER_SYMS;
  }, [dynamicSymbols]);

  const items = symbolList.map(sym => {
    const price = prices[sym] || 0;
    const prev = prevPrices?.[sym] || 0;
    const direction = prev > 0 && price !== prev
      ? (price > prev ? 'up' : price < prev ? 'down' : 'flat')
      : 'flat';
    const label = TICKER_LABELS[sym] || toLabel(sym);
    const base = sym.slice(0, 3);
    const icon = CURRENCY_ICONS[base] || 'DollarSign';
    return { sym, price, direction, label, icon };
  });

  const all = [...items, ...items, ...items];

  return (
    <div style={{
      overflow: 'hidden',
      borderBottom: `1px solid ${CV.bd0}`,
      background: `linear-gradient(90deg, ${CV.bg0}, ${CV.bg1}, ${CV.bg0})`,
      height: 40, display: 'flex', alignItems: 'center', position: 'relative',
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
        display: 'flex', gap: 36,
        animation: 'tickerScroll 40s linear infinite',
        whiteSpace: 'nowrap', paddingLeft: 20,
      }}>
        {all.map((item, i) => {
          const isJpy = item.sym.includes('JPY');
          const decimals = isJpy ? 3 : 5;
          const dirColor = item.direction === 'up' ? CV.teal
            : item.direction === 'down' ? CV.red : CV.lgt;

          return (
            <span key={i} style={{
              display: 'inline-flex', gap: 6, alignItems: 'center',
              padding: '4px 14px', borderRadius: 8,
              background: item.direction !== 'flat' ? `${dirColor}08` : 'transparent',
              border: item.direction !== 'flat' ? `1px solid ${dirColor}12` : '1px solid transparent',
              transition: 'all .3s',
            }}>
              <ArenaIcon name={item.icon} size={12} color={CV.gray} />
              <span style={{
                color: CV.gray, fontSize: 11, fontWeight: 700, letterSpacing: .5,
              }}>
                {item.label}
              </span>
              <span style={{
                color: dirColor, fontSize: 13, fontWeight: 700,
                fontFamily: '"SF Mono", "Cascadia Code", Consolas, monospace',
                letterSpacing: .3, transition: 'color .3s, text-shadow .3s',
                textShadow: item.direction === 'up' ? `0 0 8px ${CV.teal}40`
                  : item.direction === 'down' ? `0 0 8px ${CV.red}40` : 'none',
              }}>
                {item.price > 0 ? item.price.toFixed(decimals) : '—'}
              </span>
              {item.direction !== 'flat' && (
                <ArenaIcon
                  name={item.direction === 'up' ? 'ArrowUpRight' : 'ArrowDownRight'}
                  size={12}
                  color={dirColor}
                  style={{
                    animation: item.direction === 'up' ? 'priceUp .5s ease-out' : 'priceDown .5s ease-out',
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default Ticker;
