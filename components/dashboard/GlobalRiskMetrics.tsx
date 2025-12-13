'use client';

import { Shield, AlertTriangle, TrendingUp, TrendingDown, Target, Skull } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import WinPotentialCard from './WinPotentialCard';

interface GlobalRiskMetricsProps {
  competitions: any[];
  overallStats: any;
}

export default function GlobalRiskMetrics({ competitions, overallStats }: GlobalRiskMetricsProps) {
  if (competitions.length === 0) return null;

  // Calculate global risk metrics
  const totalExposure = competitions.reduce((sum, comp) => 
    sum + comp.participation.usedMargin, 0
  );
  
  const totalAvailableCapital = competitions.reduce((sum, comp) => 
    sum + comp.participation.availableCapital, 0
  );
  
  const globalMarginUsage = overallStats.totalCapital > 0 ? 
    (totalExposure / overallStats.totalCapital) * 100 : 0;
  
  const totalUnrealizedPnL = competitions.reduce((sum, comp) => 
    sum + (comp.participation.unrealizedPnl || 0), 0
  );
  
  const totalRealizedPnL = competitions.reduce((sum, comp) => 
    sum + comp.participation.realizedPnl, 0
  );
  
  // Risk score calculation (0-100, higher = more risk)
  const avgCapitalHealth = competitions.reduce((sum, comp) => 
    sum + ((comp.participation.currentCapital / comp.participation.startingCapital) * 100), 0
  ) / competitions.length;
  
  const criticalCompetitions = competitions.filter(comp => 
    (comp.participation.currentCapital / comp.participation.startingCapital) * 100 < 60 ||
    (comp.participation.usedMargin / comp.participation.currentCapital) * 100 > 70
  ).length;
  
  const riskScore = 100 - avgCapitalHealth + (globalMarginUsage * 0.5) + (criticalCompetitions * 10);
  const finalRiskScore = Math.max(0, Math.min(100, riskScore));
  
  // Best and worst performers
  const sortedByPnL = [...competitions].sort((a, b) => 
    b.participation.pnlPercentage - a.participation.pnlPercentage
  );
  const bestPerformer = sortedByPnL[0];
  const worstPerformer = sortedByPnL[sortedByPnL.length - 1];
  
  
  // Risk level
  let riskLevel = 'Low Risk';
  let riskColor = 'text-green-500';
  let riskBg = 'bg-green-500/10';
  let riskBorder = 'border-green-500/30';
  let RiskIcon = Shield;
  
  if (finalRiskScore > 70 || criticalCompetitions > 0) {
    riskLevel = 'High Risk';
    riskColor = 'text-red-500';
    riskBg = 'bg-red-500/10';
    riskBorder = 'border-red-500/30';
    RiskIcon = Skull;
  } else if (finalRiskScore > 50) {
    riskLevel = 'Medium Risk';
    riskColor = 'text-orange-500';
    riskBg = 'bg-orange-500/10';
    riskBorder = 'border-orange-500/30';
    RiskIcon = AlertTriangle;
  } else if (finalRiskScore > 30) {
    riskLevel = 'Moderate';
    riskColor = 'text-yellow-500';
    riskBg = 'bg-yellow-500/10';
    riskBorder = 'border-yellow-500/30';
    RiskIcon = AlertTriangle;
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Target className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Global Risk Overview</h3>
            <p className="text-xs text-gray-400">Aggregate metrics across all {competitions.length} competition{competitions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Win Potential Cards Section */}
      <div className="p-6 border-b border-gray-700">
        <h4 className="text-sm font-bold text-gray-100 mb-4">Win Potential by Competition</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((comp: any) => (
            <WinPotentialCard
              key={comp.competition._id}
              competition={{
                _id: comp.competition._id,
                name: comp.competition.name,
                rankingMethod: comp.competition.rules.rankingMethod,
                prizeDistribution: comp.competition.prizeDistribution,
                minimumTrades: comp.competition.rules.minimumTrades,
              }}
              userParticipation={comp.participation}
              allParticipants={comp.allParticipants || []}
            />
          ))}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Overall Risk Score */}
        <div className={`p-4 rounded-xl border ${riskBg} ${riskBorder}`}>
          <div className="flex items-center gap-2 mb-2">
            <RiskIcon className={`h-4 w-4 ${riskColor}`} />
            <span className="text-xs font-semibold text-gray-400">Overall Risk</span>
          </div>
          <p className={`text-2xl font-bold ${riskColor} mb-1`}>
            {riskLevel}
          </p>
          <p className="text-xs text-gray-500">
            Score: {finalRiskScore.toFixed(0)}/100
          </p>
          {criticalCompetitions > 0 && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCompetitions} critical
            </div>
          )}
        </div>

        {/* Total Exposure */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-400">Total Exposure</span>
          </div>
          <p className="text-2xl font-bold text-blue-400 mb-1">
            {formatCurrency(totalExposure)}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Margin Usage</span>
            <span className={`font-semibold ${
              globalMarginUsage > 70 ? 'text-red-500' : 
              globalMarginUsage > 50 ? 'text-orange-500' : 
              'text-green-500'
            }`}>
              {globalMarginUsage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                globalMarginUsage > 70 ? 'bg-red-500' : 
                globalMarginUsage > 50 ? 'bg-orange-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(globalMarginUsage, 100)}%` }}
            />
          </div>
        </div>

        {/* Unrealized vs Realized P&L */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs font-semibold text-gray-400">Unrealized P&L</span>
          </div>
          <p className={`text-2xl font-bold mb-1 ${
            totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {formatCurrency(totalUnrealizedPnL)}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Realized</span>
            <span className={`font-semibold ${
              totalRealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatCurrency(totalRealizedPnL)}
            </span>
          </div>
        </div>
      </div>

      {/* Best and Worst Performers */}
      <div className="p-6 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best Performer */}
        <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs font-semibold text-green-400">Best Performer</span>
          </div>
          <p className="text-sm font-bold text-gray-200 mb-1">
            {bestPerformer.competition.name}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">ROI</span>
            <span className="text-lg font-bold text-green-500">
              +{bestPerformer.participation.pnlPercentage.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-400">Rank</span>
            <span className="text-yellow-500 font-semibold">
              #{bestPerformer.participation.currentRank}
            </span>
          </div>
        </div>

        {/* Worst Performer */}
        <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs font-semibold text-red-400">Needs Attention</span>
          </div>
          <p className="text-sm font-bold text-gray-200 mb-1">
            {worstPerformer.competition.name}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">ROI</span>
            <span className="text-lg font-bold text-red-500">
              {worstPerformer.participation.pnlPercentage.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-400">Rank</span>
            <span className="text-yellow-500 font-semibold">
              #{worstPerformer.participation.currentRank}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

