"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface TradeData {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  openedAt: Date;
  closedAt: Date;
  contestName: string;
  contestType: "competition" | "challenge";
}

interface PositionData {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  openedAt: Date;
  contestName: string;
  contestType: "competition" | "challenge";
}

interface RecentTradesFeedProps {
  trades: TradeData[];
  positions: PositionData[];
}

function formatTimeAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentTradesFeed({
  trades,
  positions,
}: RecentTradesFeedProps) {
  // Combine trades and positions into a unified feed, sorted by time
  const feed = useMemo(() => {
    const items: Array<{
      id: string;
      type: "trade" | "position";
      symbol: string;
      side: "long" | "short";
      pnl: number;
      pnlPct: number;
      time: Date;
      contest: string;
      isOpen: boolean;
      entry: number;
      exit: number;
    }> = [];

    positions.forEach((pos) => {
      items.push({
        id: pos.id,
        type: "position",
        symbol: pos.symbol,
        side: pos.side,
        pnl: pos.unrealizedPnL,
        pnlPct: pos.unrealizedPnLPercentage,
        time: pos.openedAt,
        contest: pos.contestName,
        isOpen: true,
        entry: pos.entryPrice,
        exit: pos.currentPrice,
      });
    });

    trades.slice(0, 10).forEach((trade) => {
      items.push({
        id: trade.id,
        type: "trade",
        symbol: trade.symbol,
        side: trade.side,
        pnl: trade.pnl,
        pnlPct: trade.pnlPercentage,
        time: trade.closedAt,
        contest: trade.contestName,
        isOpen: false,
        entry: trade.entryPrice,
        exit: trade.exitPrice,
      });
    });

    return items.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    ).slice(0, 12);
  }, [trades, positions]);

  if (feed.length === 0) {
    return (
      <motion.div
        className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          ⚡ Recent Activity
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          <Activity className="w-6 h-6 mx-auto mb-2 text-gray-600" />
          No recent activity
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
        ⚡ Recent Activity
      </h3>

      <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
        {feed.map((item, i) => {
          const isProfit = item.pnl >= 0;
          const isLong = item.side === "long";

          return (
            <motion.div
              key={item.id}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-700/20 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Side indicator */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isLong ? "bg-green-500/15" : "bg-red-500/15"
                }`}
              >
                {isLong ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white font-[var(--font-geist-mono)]">
                    {item.symbol}
                  </span>
                  {item.isOpen && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                  <span className="flex-shrink-0">{item.side.toUpperCase()}</span>
                  <span className="flex-shrink-0">•</span>
                  <span className="truncate">{item.contest}</span>
                  <span className="flex-shrink-0">•</span>
                  <span className="flex-shrink-0">{formatTimeAgo(item.time)}</span>
                </div>
              </div>

              {/* PnL */}
              <div className="text-right flex-shrink-0">
                <div
                  className={`text-sm font-bold font-[var(--font-geist-mono)] ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}${item.pnl.toFixed(2)}
                </div>
                <div
                  className={`text-[11px] ${
                    isProfit ? "text-green-500/70" : "text-red-500/70"
                  }`}
                >
                  {isProfit ? "+" : ""}{item.pnlPct.toFixed(1)}%
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
