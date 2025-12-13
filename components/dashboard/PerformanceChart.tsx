'use client';

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PerformanceChartProps {
  data: Array<{
    date: string;
    balance: number;
    equity: number;
    realizedPnL: number;
    unrealizedPnL: number;
  }>;
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-2">{data.date}</p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-200">
              Live Equity: <span className="text-green-400">${data.equity.toFixed(2)}</span>
            </p>
            <p className="text-sm font-semibold text-gray-200">
              Balance: <span className="text-blue-400">${data.balance.toFixed(2)}</span>
            </p>
            <div className="border-t border-gray-700 my-2 pt-1">
              <p className="text-xs text-gray-400">
                Realized: <span className={data.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ${data.realizedPnL.toFixed(2)}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                Unrealized: <span className={data.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ${data.unrealizedPnL.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <TrendingUp className="h-5 w-5 text-blue-500" />
        </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Performance Over Time</h3>
            <p className="text-xs text-gray-400">Balance & Live Equity Tracking</p>
          </div>
      </div>
      
      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-400">Balance</span>
          </div>
          <p className="text-lg font-bold text-blue-400">
            ${data[data.length - 1]?.balance.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-400">Realized P&L only</p>
        </div>
        
        <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-green-400">Live Equity</span>
          </div>
          <p className="text-lg font-bold text-green-400">
            ${data[data.length - 1]?.equity.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-400">Balance + Open Positions</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="#9ca3af" 
            style={{ fontSize: '12px' }}
            tickLine={false}
          />
          <YAxis 
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
          <Area 
            type="monotone" 
            dataKey="balance" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorBalance)" 
            name="Balance (Realized)"
          />
          <Area 
            type="monotone" 
            dataKey="equity" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorEquity)" 
            name="Live Equity"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

