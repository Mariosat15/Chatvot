'use client';

import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface RecentClosedTradesProps {
  trades: any[];
  competitionName: string;
}

export default function RecentClosedTrades({ trades, competitionName }: RecentClosedTradesProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
        <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No closed trades yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50">
        <p className="text-sm font-semibold text-gray-300">Recent Closed Trades</p>
        <p className="text-xs text-gray-500">{competitionName}</p>
      </div>
      
      <div className="max-h-64 overflow-y-auto scrollbar-hide">
        <div className="divide-y divide-gray-700/50">
          {trades.map((trade, index) => {
            const isWinner = trade.realizedPnl >= 0;
            
            return (
              <div 
                key={index}
                className="px-4 py-3 hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-200">{trade.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      trade.side === 'long'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {trade.side.toUpperCase()}
                    </span>
                    {isWinner ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <span className={`text-sm font-bold ${
                    isWinner ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatCurrency(trade.realizedPnl)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Entry: {trade.entryPrice.toFixed(5)}</span>
                  <span>Exit: {trade.exitPrice.toFixed(5)}</span>
                  <span className={isWinner ? 'text-green-500' : 'text-red-500'}>
                    {trade.realizedPnlPercentage >= 0 ? '+' : ''}{trade.realizedPnlPercentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

