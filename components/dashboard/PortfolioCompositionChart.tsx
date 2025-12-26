'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface PortfolioCompositionChartProps {
  positions: Array<{
    symbol: string;
    value: number;
    pnl: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function PortfolioCompositionChart({ positions }: PortfolioCompositionChartProps) {
  const data = positions.map((pos, index) => ({
    name: pos.symbol,
    value: pos.value,
    pnl: pos.pnl,
    color: COLORS[index % COLORS.length]
  }));

  const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-bold text-gray-200 mb-2">
            {payload[0].payload.name}
          </p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-200">
              Value: <span className="text-blue-400">${payload[0].value.toFixed(2)}</span>
            </p>
            <p className="text-sm font-semibold text-gray-200">
              Share: <span className="text-yellow-400">
                {((payload[0].value / totalValue) * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-sm font-semibold text-gray-200">
              P&L: <span className={payload[0].payload.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${payload[0].payload.pnl.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (positions.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <PieChartIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Portfolio Composition</h3>
            <p className="text-xs text-gray-400">Position Distribution</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p className="text-sm">No open positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <PieChartIcon className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-100">Portfolio Composition</h3>
          <p className="text-xs text-gray-400">Position Distribution</p>
        </div>
      </div>
      
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
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                strokeWidth={3}
                stroke="#1f2937"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Position List */}
        <div className="w-full lg:w-1/2">
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
            {positions.map((pos, index) => (
              <div 
                key={`${pos.symbol}-${index}`}
                className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-bold text-gray-200">{pos.symbol}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {((pos.value / totalValue) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Value:</span>
                  <span className="font-semibold text-blue-400">${pos.value.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">P&L:</span>
                  <span className={`font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${pos.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

