'use client';
// ─── Ticker — Scrolling Price Marquee ─────────────────────────────────────────
import React from 'react';
import type { PriceMap } from './types';
import { CV, TICKER_SYMS } from './constants';

interface TickerProps {
  prices: PriceMap;
}

const Ticker: React.FC<TickerProps> = ({ prices }) => {
  const items = TICKER_SYMS.map(sym => ({
    sym, price: prices[sym] || 0,
  }));

  // Duplicate for seamless loop
  const all = [...items, ...items];

  return (
    <div style={{
      overflow: 'hidden', borderBottom: `1px solid ${CV.bd0}`,
      background: CV.bg0, height: 32, display: 'flex', alignItems: 'center',
    }}>
      <div style={{
        display: 'flex', gap: 32,
        animation: 'tickerScroll 30s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {all.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: CV.gray, fontSize: 11, fontWeight: 600 }}>{item.sym}</span>
            <span style={{ color: CV.teal, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
              {item.price > 0 ? item.price.toFixed(item.sym.includes('JPY') ? 3 : 5) : '—'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default Ticker;
