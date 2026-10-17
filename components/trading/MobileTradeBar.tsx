"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from "lucide-react";


interface MobileTradeBarProps {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  children: React.ReactNode;
}

/**
 * Sticky bottom bar for mobile trading.
 * Shows current symbol price + spread, and expands to reveal the order form.
 * Only visible below xl breakpoint (desktop has the sidebar).
 */
export function MobileTradeBar({
  symbol,
  bid,
  ask,
  spread,
  children,
}: MobileTradeBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="xl:hidden fixed bottom-16 left-0 right-0 z-40">
      {/* Expandable order form */}
      {expanded && (
        <div className="bg-dark-200 border-t border-dark-400 shadow-2xl max-h-[70vh] overflow-y-auto p-4">
          {children}
        </div>
      )}

      {/* Sticky price bar */}
      <div
        className="bg-dark-100 border-t border-dark-400 px-4 py-2.5 flex items-center justify-between shadow-lg cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-white">{symbol}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <TrendingDown className="size-3 text-red-400" />
              <span className="text-xs font-mono text-red-400">
                {bid.toFixed(5)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="size-3 text-green-400" />
              <span className="text-xs font-mono text-green-400">
                {ask.toFixed(5)}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-dark-600">
            Spread: {spread.toFixed(1)} pips
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary font-medium">
            {expanded ? "Close" : "Trade"}
          </span>
          {expanded ? (
            <ChevronDown className="size-4 text-primary" />
          ) : (
            <ChevronUp className="size-4 text-primary" />
          )}
        </div>
      </div>
    </div>
  );
}
