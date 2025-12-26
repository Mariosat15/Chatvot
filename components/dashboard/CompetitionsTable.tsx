'use client';

import { Trophy, TrendingUp, TrendingDown, Target, Activity, AlertTriangle, Shield, Skull } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CompetitionsTableProps {
  competitions: any[];
}

export default function CompetitionsTable({ competitions }: CompetitionsTableProps) {
  if (competitions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
        <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No active competitions</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-yellow-500/10 rounded-lg">
            <Trophy className="h-4 w-4 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-100">Active Competitions</h3>
            <p className="text-xs text-gray-400">Performance Overview</p>
          </div>
        </div>
      </div>

      {/* Compact Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-400">Competition</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Rank</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Risk</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-400">Capital</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-400">P&L</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">ROI</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Margin</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">DD</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Pos</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Trades</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">Win%</th>
              <th className="px-1 py-2 text-center text-xs font-semibold text-gray-400">PF</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {competitions.map((comp, index) => {
              const isProfitable = comp.participation.pnl >= 0;
              const capitalHealth = (comp.participation.currentCapital / comp.participation.startingCapital) * 100;
              
              // CORRECT margin level calculation (equity / usedMargin * 100)
              // Higher is better: 200%+ = safe, 150% = warning, 100% = margin call, 50% = liquidation
              const equity = comp.participation.currentCapital + (comp.participation.unrealizedPnl || 0);
              const marginLevel = comp.participation.usedMargin > 0 ? 
                (equity / comp.participation.usedMargin) * 100 : Infinity;
              
              // Also calculate margin usage percentage for display
              const marginUsagePercent = comp.participation.currentCapital > 0 ? 
                (comp.participation.usedMargin / comp.participation.currentCapital) * 100 : 0;
              
              // Risk calculation based on ACTUAL margin levels (matching risk-manager.service thresholds)
              // 50% = Liquidation, 100% = Margin Call, 150% = Warning/Safe threshold
              const isLiquidationDanger = marginLevel < 100; // Below margin call = danger (RED)
              const isHighRisk = marginLevel < 150; // Below warning threshold (ORANGE/YELLOW)
              const isMediumRisk = false; // Removed - anything >= 150% is safe
              
              let RiskIcon = Shield;
              let riskColor = 'text-green-500';
              
              if (isLiquidationDanger) {
                RiskIcon = Skull;
                riskColor = 'text-red-500';
              } else if (isHighRisk) {
                RiskIcon = AlertTriangle;
                riskColor = 'text-orange-500';
              } else if (isMediumRisk) {
                RiskIcon = AlertTriangle;
                riskColor = 'text-yellow-500';
              }

              // Profit Factor calculation
              const totalWins = comp.participation.winningTrades > 0 ? 
                (comp.participation.averageWin * comp.participation.winningTrades) : 0;
              const totalLosses = comp.participation.losingTrades > 0 ? 
                Math.abs(comp.participation.averageLoss * comp.participation.losingTrades) : 0;
              const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

              return (
                <tr 
                  key={comp.competition._id} 
                  className={`hover:bg-gray-700/30 transition-colors ${
                    isLiquidationDanger ? 'bg-red-500/5' : ''
                  }`}
                >
                  {/* Competition Name */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isLiquidationDanger ? 'bg-red-500 animate-pulse' : 
                        isHighRisk ? 'bg-orange-500 animate-pulse' : 
                        'bg-green-500'
                      }`} />
                      <div>
                        <p className="text-xs font-semibold text-gray-200">
                          {comp.competition.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.floor((new Date(comp.competition.endTime).getTime() - Date.now()) / (1000 * 60 * 60))}h left
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Rank */}
                  <td className="px-1 py-2 text-center">
                    <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/10">
                      <Trophy className="h-2.5 w-2.5 text-yellow-500" />
                      <span className="text-xs font-bold text-yellow-500">
                        #{comp.participation.currentRank}
                      </span>
                    </div>
                  </td>

                  {/* Risk Status */}
                  <td className="px-1 py-2 text-center">
                    <div className={`inline-flex items-center justify-center ${
                      isLiquidationDanger ? 'animate-pulse' : ''
                    }`}>
                      <RiskIcon className={`h-4 w-4 ${riskColor}`} />
                    </div>
                  </td>

                  {/* Capital */}
                  <td className="px-2 py-2 text-right">
                    <p className="text-xs font-bold text-gray-200">
                      {formatCurrency(comp.participation.currentCapital)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {capitalHealth.toFixed(0)}%
                    </p>
                  </td>

                  {/* P&L */}
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {isProfitable ? (
                        <TrendingUp className="h-2.5 w-2.5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                      )}
                      <span className={`text-xs font-bold ${
                        isProfitable ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {formatCurrency(comp.participation.pnl)}
                      </span>
                    </div>
                  </td>

                  {/* ROI % */}
                  <td className="px-1 py-2 text-center">
                    <span className={`text-xs font-bold ${
                      isProfitable ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {comp.participation.pnlPercentage >= 0 ? '+' : ''}
                      {comp.participation.pnlPercentage.toFixed(1)}%
                    </span>
                  </td>

                  {/* Margin Level (higher is better: 150%+ safe, 100% margin call, 50% liquidation) */}
                  <td className="px-1 py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-xs font-bold ${
                        marginLevel < 100 ? 'text-red-500' : // Below margin call = danger
                        marginLevel < 150 ? 'text-orange-500' : // Below 150% = warning
                        'text-green-500' // 150%+ = safe
                      }`}>
                        {marginLevel === Infinity ? '∞' : marginLevel.toFixed(0)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {marginLevel < 100 ? 'Call' : 
                         marginLevel < 150 ? 'Warn' : 'Safe'}
                      </span>
                    </div>
                  </td>

                  {/* Max Drawdown */}
                  <td className="px-1 py-2 text-center">
                    <span className={`text-xs font-bold ${
                      comp.participation.maxDrawdownPercentage > 20 ? 'text-red-500' :
                      comp.participation.maxDrawdownPercentage > 10 ? 'text-orange-500' :
                      comp.participation.maxDrawdownPercentage > 5 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {comp.participation.maxDrawdownPercentage.toFixed(1)}%
                    </span>
                  </td>

                  {/* Open Positions */}
                  <td className="px-1 py-2 text-center">
                    <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-500/10">
                      <Activity className="h-2.5 w-2.5 text-purple-500" />
                      <span className="text-xs font-semibold text-purple-500">
                        {comp.participation?.currentOpenPositions || comp.openPositionsCount || comp.openPositions?.length || 0}
                      </span>
                    </div>
                  </td>

                  {/* Total Trades */}
                  <td className="px-1 py-2 text-center">
                    <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/10">
                      <Target className="h-2.5 w-2.5 text-blue-500" />
                      <span className="text-xs font-semibold text-blue-500">
                        {comp.participation.totalTrades}
                      </span>
                    </div>
                  </td>

                  {/* Win Rate */}
                  <td className="px-1 py-2 text-center">
                    <span className="text-xs font-semibold text-yellow-500">
                      {comp.participation.winRate.toFixed(0)}%
                    </span>
                  </td>

                  {/* Profit Factor */}
                  <td className="px-1 py-2 text-center">
                    <span className={`text-xs font-bold ${
                      profitFactor >= 2 ? 'text-green-500' :
                      profitFactor >= 1 ? 'text-yellow-500' :
                      profitFactor > 0 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {profitFactor > 99 ? '∞' : profitFactor.toFixed(1)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-2 py-2 text-center">
                    <Link
                      href={`/competitions/${comp.competition._id}/trade`}
                      className="inline-flex items-center px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-xs font-bold rounded transition-colors"
                    >
                      Trade
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
