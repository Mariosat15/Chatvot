"use client";

import { useState } from "react";
import { usePrices } from "@/contexts/PriceProvider";
import { closePosition } from "@/lib/actions/trading/position.actions";
import { ForexSymbol } from "@/lib/services/pnl-calculator.service";
import { cn } from "@/lib/utils";
import {
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Position {
  _id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  takeProfit?: number;
  stopLoss?: number;
  currentPrice: number;
}

interface GameModePositionsProps {
  positions: Position[];
  competitionId: string;
}

export default function GameModePositions({
  positions,
  competitionId,
}: GameModePositionsProps) {
  const { prices } = usePrices();
  const [closingId, setClosingId] = useState<string | null>(null);

  const handleClose = async (positionId: string, symbol: string) => {
    setClosingId(positionId);
    try {
      // Get current price for locked execution
      const currentPrice = prices.get(symbol as ForexSymbol);
      const lockedPrice = currentPrice
        ? {
            bid: currentPrice.bid,
            ask: currentPrice.ask,
            timestamp: Date.now(),
          }
        : undefined;

      const result = await closePosition(positionId, lockedPrice);
      if (result.success) {
        toast.success("✅ Position Closed!", {
          description: result.message || "Position closed successfully!",
        });
      } else {
        toast.error("❌ Failed to close!", {
          description:
            (result as { error?: string }).error ||
            result.message ||
            "Unknown error",
        });
      }
    } catch (error) {
      toast.error("❌ Error!", {
        description: "Something went wrong.",
      });
    } finally {
      setClosingId(null);
    }
  };

  if (positions.length === 0) {
    return (
      <div className="bg-dark-400/30 rounded-xl p-6 border border-dark-300 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-gray-400 font-medium mb-1">No Open Positions</h3>
        <p className="text-gray-500 text-sm">
          Open a position to start trading!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((position) => {
        const currentPrice = prices.get(position.symbol as ForexSymbol);
        const pnl = currentPrice
          ? position.side === "long"
            ? (currentPrice.bid - position.entryPrice) *
              position.quantity *
              100000
            : (position.entryPrice - currentPrice.ask) *
              position.quantity *
              100000
          : position.unrealizedPnl;
        const isProfit = pnl >= 0;

        return (
          <div
            key={position._id}
            className={cn(
              "rounded-xl p-3 border transition-all",
              position.side === "long"
                ? "bg-gradient-to-r from-green-900/30 to-dark-400/50 border-green-600/30"
                : "bg-gradient-to-r from-red-900/30 to-dark-400/50 border-red-600/30",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {position.side === "long" ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className="text-white font-bold">{position.symbol}</span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded font-bold",
                    position.side === "long"
                      ? "bg-green-500/30 text-green-400"
                      : "bg-red-500/30 text-red-400",
                  )}
                >
                  {position.side === "long" ? "LONG" : "SHORT"}
                </span>
              </div>

              <button
                onClick={() => handleClose(position._id, position.symbol)}
                disabled={closingId === position._id}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
              >
                {closingId === position._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Size</span>
                <div className="text-white font-medium">
                  {position.quantity} lots
                </div>
              </div>
              <div>
                <span className="text-gray-500">Entry</span>
                <div className="text-white font-medium">
                  {position.entryPrice.toFixed(5)}
                </div>
              </div>
              <div>
                <span className="text-gray-500">P&L</span>
                <div
                  className={cn(
                    "font-bold",
                    isProfit ? "text-green-400" : "text-red-400",
                  )}
                >
                  {isProfit ? "+" : ""}${pnl.toFixed(2)}
                </div>
              </div>
            </div>

            {/* TP/SL Indicators */}
            {(position.takeProfit || position.stopLoss) && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-dark-300/50">
                {position.takeProfit && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <Target className="w-3 h-3" />
                    TP: {position.takeProfit.toFixed(5)}
                  </span>
                )}
                {position.stopLoss && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400">
                    <Shield className="w-3 h-3" />
                    SL: {position.stopLoss.toFixed(5)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
