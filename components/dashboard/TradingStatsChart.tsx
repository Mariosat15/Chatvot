'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';

interface TradingStatsChartProps {
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalTrades: number;
}

export default function TradingStatsChart({ 
  winningTrades, 
  losingTrades, 
  winRate,
  totalTrades 
}: TradingStatsChartProps) {
  const hasData = totalTrades > 0;
  
  const data = hasData ? [
    { name: 'Winning Trades', value: winningTrades, color: '#10b981' },
    { name: 'Losing Trades', value: losingTrades, color: '#ef4444' },
  ] : [
    { name: 'No Trades Yet', value: 1, color: '#4b5563' },
  ];

  const COLORS = hasData ? ['#10b981', '#ef4444'] : ['#4b5563'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-semibold text-gray-200">
            {payload[0].name}
          </p>
          <p className="text-lg font-bold" style={{ color: payload[0].payload.color }}>
            {payload[0].value} trades
          </p>
          <p className="text-xs text-gray-400">
            {((payload[0].value / totalTrades) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-yellow-500/10 rounded-lg">
          <Target className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-100">Win/Loss Distribution</h3>
          <p className="text-xs text-gray-400">Trade Performance Breakdown</p>
        </div>
      </div>
      
      {!hasData ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mb-4">
            <Target className="h-10 w-10 text-gray-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">No Trading Activity Yet</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Start trading to see your win/loss distribution and performance metrics here.
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Wins</p>
              <p className="text-2xl font-bold text-green-500">0</p>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Losses</p>
              <p className="text-2xl font-bold text-red-500">0</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Chart */}
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${((percent || 0) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  innerRadius={50}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={3}
                  stroke="#1f2937"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div className="w-full lg:w-1/2 space-y-4">
          {/* Win Rate */}
          <div className="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-xl border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Win Rate</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-500">{winRate.toFixed(1)}%</p>
            <div className="mt-2 w-full h-2 bg-gray-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </div>

          {/* Trade Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-gray-400">Wins</span>
              </div>
              <p className="text-xl font-bold text-green-500">{winningTrades}</p>
            </div>
            <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-3 w-3 text-red-500" />
                <span className="text-xs text-gray-400">Losses</span>
              </div>
              <p className="text-xl font-bold text-red-500">{losingTrades}</p>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

