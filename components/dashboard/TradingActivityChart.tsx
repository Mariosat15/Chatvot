'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';

interface TradingActivityChartProps {
  data: Array<{
    date: string;
    trades: number;
    volume: number;
  }>;
}

export default function TradingActivityChart({ data }: TradingActivityChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.trades > 0 || d.volume > 0);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-200">
              Trades: <span className="text-purple-400">{payload[0].value}</span>
            </p>
            <p className="text-sm font-semibold text-gray-200">
              Volume: <span className="text-blue-400">${payload[1].value.toFixed(2)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Activity className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-100">Trading Activity</h3>
          <p className="text-xs text-gray-400">Daily Trades & Volume</p>
        </div>
      </div>
      
      {!hasData ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mb-4">
            <Activity className="h-10 w-10 text-gray-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">No Trading Activity</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Your daily trading activity and volume will appear here once you start placing trades.
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/30">
              <p className="text-xs text-gray-400 mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-purple-500">0</p>
            </div>
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
              <p className="text-xs text-gray-400 mb-1">Total Volume</p>
              <p className="text-2xl font-bold text-blue-500">$0</p>
            </div>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af" 
              style={{ fontSize: '12px' }}
              tickLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="#9ca3af" 
              style={{ fontSize: '12px' }}
              tickLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af" 
              style={{ fontSize: '12px' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
            />
            <Bar 
              yAxisId="left"
              dataKey="trades" 
              fill="#a855f7" 
              name="Trades"
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              yAxisId="right"
              dataKey="volume" 
              fill="#3b82f6" 
              name="Volume ($)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

