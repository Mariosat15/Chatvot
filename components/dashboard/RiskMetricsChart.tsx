'use client';

import { AlertTriangle, Shield, TrendingDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';

interface RiskMetricsChartProps {
  currentCapital: number;
  startingCapital: number;
  usedMargin: number;
  availableCapital: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  marginCallWarnings: number;
}

export default function RiskMetricsChart({
  currentCapital,
  startingCapital,
  usedMargin,
  availableCapital,
  maxDrawdown,
  maxDrawdownPercentage,
  marginCallWarnings
}: RiskMetricsChartProps) {
  const marginUsagePercentage = (usedMargin / currentCapital) * 100;
  const capitalUsagePercentage = (usedMargin / availableCapital) * 100;
  const capitalHealthPercentage = (currentCapital / startingCapital) * 100;
  
  // Risk levels
  const isHighRisk = marginUsagePercentage > 70 || maxDrawdownPercentage > 20;
  const isMediumRisk = marginUsagePercentage > 50 || maxDrawdownPercentage > 10;

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${
          isHighRisk ? 'bg-red-500/10' : isMediumRisk ? 'bg-orange-500/10' : 'bg-green-500/10'
        }`}>
          <Shield className={`h-5 w-5 ${
            isHighRisk ? 'text-red-500' : isMediumRisk ? 'text-orange-500' : 'text-green-500'
          }`} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-100">Risk Metrics</h3>
          <p className="text-xs text-gray-400">Capital & Margin Management</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Capital Health */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-300">Capital Health</p>
              <p className="text-xs text-gray-500">Current vs Starting Capital</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${
                capitalHealthPercentage >= 100 ? 'text-green-500' : 
                capitalHealthPercentage >= 90 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {capitalHealthPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400">
                {formatCurrency(currentCapital)} / {formatCurrency(startingCapital)}
              </p>
            </div>
          </div>
          <Progress 
            value={Math.min(capitalHealthPercentage, 100)} 
            className="h-3"
          />
        </div>

        {/* Margin Usage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-300">Margin Usage</p>
              <p className="text-xs text-gray-500">Used / Total Capital</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${
                marginUsagePercentage > 70 ? 'text-red-500' : 
                marginUsagePercentage > 50 ? 'text-orange-500' : 'text-blue-500'
              }`}>
                {marginUsagePercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400">
                {formatCurrency(usedMargin)} used
              </p>
            </div>
          </div>
          <Progress 
            value={marginUsagePercentage} 
            className="h-3"
          />
          {marginUsagePercentage > 70 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
              <AlertTriangle className="h-3 w-3" />
              <span>High margin usage - consider reducing positions</span>
            </div>
          )}
        </div>

        {/* Max Drawdown */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-300">Maximum Drawdown</p>
              <p className="text-xs text-gray-500">Largest Capital Decline</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-red-500">
                {maxDrawdownPercentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-400">
                {formatCurrency(maxDrawdown)} loss
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-3 rounded-lg border text-center ${
              maxDrawdownPercentage < 5 
                ? 'bg-green-500/10 border-green-500/30' 
                : maxDrawdownPercentage < 15 
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-xs text-gray-400 mb-1">Risk Level</p>
              <p className={`text-sm font-bold ${
                maxDrawdownPercentage < 5 ? 'text-green-500' : 
                maxDrawdownPercentage < 15 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {maxDrawdownPercentage < 5 ? 'Low' : 
                 maxDrawdownPercentage < 15 ? 'Medium' : 'High'}
              </p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 text-center">
              <p className="text-xs text-gray-400 mb-1">Available</p>
              <p className="text-sm font-bold text-blue-500">
                {formatCurrency(availableCapital)}
              </p>
            </div>
            <div className={`p-3 rounded-lg border text-center ${
              marginCallWarnings === 0 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-xs text-gray-400 mb-1">Warnings</p>
              <p className={`text-sm font-bold ${
                marginCallWarnings === 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {marginCallWarnings}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Summary */}
        <div className={`p-4 rounded-xl border ${
          isHighRisk 
            ? 'bg-red-500/10 border-red-500/30' 
            : isMediumRisk 
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {isHighRisk ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-bold text-red-400">High Risk Alert</p>
                  <p className="text-xs text-gray-400">
                    Consider reducing exposure or tightening stop losses
                  </p>
                </div>
              </>
            ) : isMediumRisk ? (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-bold text-orange-400">Moderate Risk</p>
                  <p className="text-xs text-gray-400">
                    Monitor positions closely and manage risk carefully
                  </p>
                </div>
              </>
            ) : (
              <>
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-400">Healthy Risk Profile</p>
                  <p className="text-xs text-gray-400">
                    Risk levels are within acceptable ranges
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

