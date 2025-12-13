'use client';

import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DailyPnLChartProps {
  data: Array<{
    date: string;
    pnl: number;
    trades: number;
  }>;
}

export default function DailyPnLChart({ data }: DailyPnLChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.trades > 0);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isProfitable = payload[0].value >= 0;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <p className={`text-lg font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(payload[0].value)}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              {payload[0].payload.trades} trade{payload[0].payload.trades !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate stats
  const totalPnL = hasData ? data.reduce((sum, day) => sum + day.pnl, 0) : 0;
  const profitableDays = hasData ? data.filter(day => day.pnl > 0).length : 0;
  const totalDays = hasData ? data.filter(day => day.trades > 0).length : 0;
  const winRate = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Calendar className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Daily P&L Breakdown - All Competitions</h3>
            <p className="text-xs text-gray-400">Combined Last 7 Days Performance</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">Total P&L</p>
            <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(totalPnL)}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-1">Win Days</p>
            <p className="text-lg font-bold text-yellow-500">
              {winRate.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>
      
      {!hasData ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mb-4">
            <Calendar className="h-10 w-10 text-gray-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">No Daily P&L Data Yet</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Your daily profit and loss breakdown will appear here once you close your first trade.
          </p>
          <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50">
            <p className="text-xs text-gray-400 mb-2">Total P&L</p>
            <p className="text-3xl font-bold text-gray-500">$0.00</p>
          </div>
        </div>
      ) : (
        <>
      {/* Main Chart - Area with Line */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPnLPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorPnLNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={2} />
          
          {/* Area under the line */}
          <Area 
            type="monotone"
            dataKey="pnl" 
            stroke={totalPnL >= 0 ? "#10b981" : "#ef4444"}
            strokeWidth={3}
            fill={totalPnL >= 0 ? "url(#colorPnLPositive)" : "url(#colorPnLNegative)"}
            fillOpacity={1}
          />
          
          {/* Line on top for better visibility */}
          <Line 
            type="monotone"
            dataKey="pnl" 
            stroke={totalPnL >= 0 ? "#10b981" : "#ef4444"}
            strokeWidth={3}
            dot={{ 
              fill: totalPnL >= 0 ? "#10b981" : "#ef4444", 
              strokeWidth: 2, 
              r: 4,
              stroke: "#1f2937"
            }}
            activeDot={{ 
              r: 6, 
              strokeWidth: 2,
              stroke: "#1f2937"
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Day-by-day breakdown - Enhanced */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {data.map((day, index) => {
          const isProfit = day.pnl >= 0;
          const hasActivity = day.trades > 0;
          
          return (
            <div 
              key={index}
              className={`relative p-3 rounded-xl border text-center transition-all duration-300 ${
                !hasActivity 
                  ? 'bg-gray-900/30 border-gray-700/30 opacity-50' 
                  : isProfit 
                    ? 'bg-green-500/10 border-green-500/40 hover:border-green-500/60 hover:bg-green-500/20' 
                    : 'bg-red-500/10 border-red-500/40 hover:border-red-500/60 hover:bg-red-500/20'
              }`}
            >
              {/* Day Label */}
              <p className="text-xs font-medium text-gray-400 mb-2">{day.date}</p>
              
              {/* P&L Amount */}
              <p className={`text-base font-bold mb-1 ${
                !hasActivity ? 'text-gray-600' : isProfit ? 'text-green-400' : 'text-red-400'
              }`}>
                {!hasActivity ? '$0.00' : `${day.pnl >= 0 ? '+' : ''}${formatCurrency(day.pnl)}`}
              </p>
              
              {/* Trade Count */}
              <div className={`flex items-center justify-center gap-1 text-xs ${
                hasActivity ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  !hasActivity ? 'bg-gray-600' : isProfit ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span>{day.trades} trade{day.trades !== 1 ? 's' : ''}</span>
              </div>
              
              {/* Top indicator line for profitable days */}
              {hasActivity && isProfit && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-t-xl" />
              )}
              
              {/* Top indicator line for loss days */}
              {hasActivity && !isProfit && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-400 rounded-t-xl" />
              )}
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

