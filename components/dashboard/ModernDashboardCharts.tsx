'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy, TrendingUp, TrendingDown, Target, Zap, Users, DollarSign,
  BarChart3, Activity, Clock, Calendar, Award, Crown, Medal,
  ArrowUpRight, ArrowDownRight, RefreshCw, ChevronRight, Flame,
  Swords, LineChart, PieChart, Timer, Sparkles, Shield, Eye, Percent
} from 'lucide-react';
import type { ComprehensiveDashboardData } from '@/lib/actions/comprehensive-dashboard.actions';
import WinPotentialCard from './WinPotentialCard';
import MarketHolidaysCard from './MarketHolidaysCard';
import type { RankingMethod } from '@/lib/services/ranking-config.service';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { motion } from 'framer-motion';

interface ModernDashboardProps {
  data: ComprehensiveDashboardData;
}

// Glowing Stat Card with consistent shadow
function GlowStatCard({
  icon,
  label,
  value,
  subvalue,
  trend,
  color,
  delay = 0,
  large = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'emerald';
  delay?: number;
  large?: boolean;
}) {
  const colorMap = {
    blue: { border: 'border-blue-500/50', text: 'text-blue-400', shadow: 'rgba(59, 130, 246, 0.3)', gradient: 'from-blue-500 to-cyan-500' },
    green: { border: 'border-green-500/50', text: 'text-green-400', shadow: 'rgba(34, 197, 94, 0.3)', gradient: 'from-green-500 to-emerald-500' },
    red: { border: 'border-red-500/50', text: 'text-red-400', shadow: 'rgba(239, 68, 68, 0.3)', gradient: 'from-red-500 to-rose-500' },
    yellow: { border: 'border-yellow-500/50', text: 'text-yellow-400', shadow: 'rgba(234, 179, 8, 0.3)', gradient: 'from-yellow-500 to-amber-500' },
    purple: { border: 'border-purple-500/50', text: 'text-purple-400', shadow: 'rgba(168, 85, 247, 0.3)', gradient: 'from-purple-500 to-violet-500' },
    orange: { border: 'border-orange-500/50', text: 'text-orange-400', shadow: 'rgba(249, 115, 22, 0.3)', gradient: 'from-orange-500 to-red-500' },
    cyan: { border: 'border-cyan-500/50', text: 'text-cyan-400', shadow: 'rgba(6, 182, 212, 0.3)', gradient: 'from-cyan-500 to-blue-500' },
    emerald: { border: 'border-emerald-500/50', text: 'text-emerald-400', shadow: 'rgba(16, 185, 129, 0.3)', gradient: 'from-emerald-500 to-green-500' },
  };

  const colors = colorMap[color];

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div 
        className={`relative bg-gray-900/90 backdrop-blur-sm rounded-2xl ${large ? 'p-4 sm:p-5 md:p-6' : 'p-3 sm:p-4'} border ${colors.border} transition-all duration-300 group-hover:scale-[1.02]`}
        style={{
          boxShadow: `0 0 20px ${colors.shadow}, 0 0 40px ${colors.shadow.replace('0.3', '0.15')}`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} bg-opacity-20`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} font-bold ${colors.text} tabular-nums`}>{value}</p>
          {subvalue && <p className="text-xs text-gray-500 mt-1">{subvalue}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// Animated Ring Chart
function RingChart({ 
  value, 
  maxValue = 100, 
  size = 100, 
  strokeWidth = 8,
  color,
  label,
  sublabel,
  delay = 0
}: { 
  value: number; 
  maxValue?: number; 
  size?: number; 
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
  delay?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const offset = circumference - (percentage * circumference);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, delay, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className="text-xl sm:text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.5 }}
          >
            {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
            {maxValue === 100 && '%'}
          </motion.span>
        </div>
      </div>
      <p className="mt-2 text-xs sm:text-sm font-medium text-gray-300">{label}</p>
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
    </div>
  );
}

// Semi-circle Gauge
function GaugeChart({
  value,
  maxValue = 100,
  label,
  color,
  size = 120,
  delay = 0
}: {
  value: number;
  maxValue?: number;
  label: string;
  color: string;
  size?: number;
  delay?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
        <svg viewBox="0 0 100 55" className="w-full h-full">
          <path
            d="M 5,50 A 45,45 0 0,1 95,50"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <motion.path
            d="M 5,50 A 45,45 0 0,1 95,50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: percentage / 100 }}
            transition={{ duration: 1.5, delay, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <motion.span 
            className="text-lg sm:text-xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.5 }}
          >
            {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
          </motion.span>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-400 -mt-1">{label}</p>
    </div>
  );
}

// Animated Bar Chart
function AnimatedBarChart({ 
  data, 
  height = 120,
  delay = 0 
}: { 
  data: { label: string; value: number; color: string }[];
  height?: number;
  delay?: number;
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="flex items-end justify-around gap-2 sm:gap-3" style={{ height }}>
      {data.map((item, i) => {
        const barHeight = (item.value / maxVal) * (height - 40);
        return (
          <div key={item.label} className="flex flex-col items-center flex-1 max-w-16">
            <motion.div
              className="w-full rounded-t-lg relative overflow-hidden"
              style={{ 
                background: `linear-gradient(to top, ${item.color}, ${item.color}88)`,
              }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(barHeight, 4) }}
              transition={{ duration: 0.8, delay: delay + (i * 0.1), ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/20" />
            </motion.div>
            <motion.span 
              className="text-xs text-gray-400 mt-2 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: delay + 0.5 }}
            >
              {item.label}
            </motion.span>
            <motion.span 
              className="text-sm font-bold text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: delay + 0.6 }}
            >
              {item.value}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

// Enhanced Equity Curve
function EnhancedEquityCurve({ data }: { data: { date: string; equity: number; pnl: number }[] }) {
  if (data.length < 2) {
    return <div className="h-40 sm:h-48 flex items-center justify-center text-gray-500">Not enough data</div>;
  }
  
  const min = Math.min(...data.map(d => d.equity));
  const max = Math.max(...data.map(d => d.equity));
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.equity - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  const lastEquity = data[data.length - 1]?.equity || 0;
  const firstEquity = data[0]?.equity || 0;
  const change = lastEquity - firstEquity;
  const isPositive = change >= 0;
  
  return (
    <div className="relative">
      <motion.div 
        className="absolute top-0 right-0 text-right"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          ${lastEquity.toFixed(0)}
        </p>
        <p className={`text-sm tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)} ({((change / (firstEquity || 1)) * 100).toFixed(2)}%)
        </p>
      </motion.div>
      <svg className="w-full h-40 sm:h-48" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0.4" />
            <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <motion.polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#equityGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="0.5"
          filter="url(#glow)"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// Enhanced Daily P&L Bars
function EnhancedDailyPnL({ data }: { data: { date: string; pnl: number; trades: number }[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  const displayData = data.slice(-14);
  
  return (
    <div className="h-32 sm:h-36 flex items-center gap-1">
      {displayData.map((d, i) => {
        const height = (Math.abs(d.pnl) / maxAbs) * 100;
        const isPositive = d.pnl >= 0;
        return (
          <motion.div 
            key={i} 
            className="flex-1 flex flex-col items-center justify-center h-full"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          >
            <div className="h-full flex flex-col justify-center">
              {isPositive ? (
                <div 
                  className="w-full rounded-t bg-gradient-to-t from-green-600 to-green-400 transition-all hover:opacity-80"
                  style={{ height: `${Math.max(height / 2, 2)}%` }}
                />
              ) : (
                <div 
                  className="w-full rounded-b bg-gradient-to-b from-red-600 to-red-400 transition-all hover:opacity-80 mt-auto"
                  style={{ height: `${Math.max(height / 2, 2)}%` }}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Enhanced Donut Chart
function EnhancedDonut({ data }: { data: { wins: number; losses: number; breakeven: number } }) {
  const total = data.wins + data.losses + data.breakeven;
  if (total === 0) {
    return <div className="h-32 flex items-center justify-center text-gray-500">No data</div>;
  }
  
  const winPercent = (data.wins / total) * 100;
  
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <motion.circle 
            cx="50%" cy="50%" r="40%" fill="none" 
            stroke="#22c55e" strokeWidth="10"
            strokeDasharray={`${(data.wins / total) * 251} 251`}
            strokeLinecap="round"
            initial={{ strokeDashoffset: 251 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          <motion.circle 
            cx="50%" cy="50%" r="40%" fill="none" 
            stroke="#ef4444" strokeWidth="10"
            strokeDasharray={`${(data.losses / total) * 251} 251`}
            strokeDashoffset={-(data.wins / total) * 251}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl sm:text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-gray-400">trades</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">{data.wins} Wins ({winPercent.toFixed(0)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-gray-300">{data.losses} Losses</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-sm text-gray-300">{data.breakeven} Breakeven</span>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function ModernDashboardCharts({ data }: ModernDashboardProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { settings, formatCredits } = useAppSettings();

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (absValue >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  // Trading performance data for bar chart
  const tradingBarData = useMemo(() => [
    { label: 'Wins', value: data.overview.winningTrades, color: '#22c55e' },
    { label: 'Losses', value: data.overview.losingTrades, color: '#ef4444' },
    { label: 'Streak', value: data.streaks.currentWinStreak, color: '#f97316' },
    { label: 'Days', value: data.streaks.tradingDaysThisMonth, color: '#3b82f6' },
  ], [data]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.header 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
              <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            Trading Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Welcome back, <span className="text-yellow-400 font-medium">{data.user.name}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-gray-900 font-semibold rounded-xl transition-all shadow-lg shadow-yellow-500/25 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </motion.header>

      {/* Hero Stats Grid with Glow Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 lg:col-span-1">
          <GlowStatCard
            icon={<DollarSign className="w-5 h-5 text-white" />}
            label="Total Capital"
            value={formatCurrency(data.overview.totalCapital)}
            subvalue={`${data.overview.activeContests} active contest${data.overview.activeContests !== 1 ? 's' : ''}`}
            color="emerald"
            large
            delay={0}
          />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <GlowStatCard
            icon={data.overview.totalPnL >= 0 ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
            label="Total P&L"
            value={`${data.overview.totalPnL >= 0 ? '+' : ''}${formatCurrency(data.overview.totalPnL)}`}
            subvalue={formatPercent(data.overview.totalPnLPercentage)}
            trend={data.overview.totalPnL >= 0 ? 'up' : 'down'}
            color={data.overview.totalPnL >= 0 ? 'green' : 'red'}
            large
            delay={0.1}
          />
        </div>
        <GlowStatCard
          icon={<Target className="w-5 h-5 text-white" />}
          label="Win Rate"
          value={`${data.overview.winRate.toFixed(1)}%`}
          trend={data.overview.winRate >= 50 ? 'up' : 'down'}
          color={data.overview.winRate >= 50 ? 'blue' : 'orange'}
          delay={0.2}
        />
        <GlowStatCard
          icon={<Trophy className="w-5 h-5 text-white" />}
          label="Prizes Won"
          value={`${settings?.credits.symbol || '⚡'}${data.overview.totalPrizesWon.toLocaleString()}`}
          color="yellow"
          delay={0.3}
        />
      </section>

      {/* Performance Ring Charts */}
      <motion.section 
        className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <PieChart className="h-5 w-5 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Performance Metrics</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
          <RingChart
            value={data.overview.winRate}
            maxValue={100}
            size={100}
            color="#22c55e"
            label="Win Rate"
            delay={0.5}
          />
          <RingChart
            value={Math.min(data.overview.profitFactor > 99 ? 100 : data.overview.profitFactor * 10, 100)}
            maxValue={100}
            size={100}
            color="#a855f7"
            label="Profit Factor"
            sublabel={data.overview.profitFactor > 99 ? '∞' : data.overview.profitFactor.toFixed(2)}
            delay={0.6}
          />
          <GaugeChart
            value={data.overview.totalTrades}
            maxValue={Math.max(data.overview.totalTrades, 100)}
            label="Total Trades"
            color="#3b82f6"
            size={100}
            delay={0.7}
          />
          <GaugeChart
            value={data.streaks.currentWinStreak}
            maxValue={Math.max(data.streaks.longestWinStreak, 10)}
            label="Win Streak"
            color="#f97316"
            size={100}
            delay={0.8}
          />
          <RingChart
            value={data.streaks.tradingDaysThisMonth}
            maxValue={22}
            size={100}
            color="#06b6d4"
            label="Trading Days"
            sublabel="This month"
            delay={0.9}
          />
          <RingChart
            value={data.streaks.consecutiveProfitableDays}
            maxValue={Math.max(data.streaks.consecutiveProfitableDays, 7)}
            size={100}
            color="#10b981"
            label="Profit Days"
            sublabel="In a row"
            delay={1.0}
          />
        </div>
      </motion.section>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Equity Curve */}
          <motion.section 
            className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="p-4 sm:p-5 border-b border-gray-700/50 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <LineChart className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Equity Curve</h3>
                <p className="text-xs text-gray-400">Last 30 days performance</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <EnhancedEquityCurve data={data.charts.equityCurve} />
            </div>
          </motion.section>

          {/* Daily P&L */}
          <motion.section 
            className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="p-4 sm:p-5 border-b border-gray-700/50 flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Daily P&L</h3>
                <p className="text-xs text-gray-400">Profit/Loss by day</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <EnhancedDailyPnL data={data.charts.dailyPnL} />
            </div>
          </motion.section>

          {/* Trading Analytics */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Win/Loss Donut */}
            <motion.section 
              className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4 sm:p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <PieChart className="h-4 w-4 text-purple-400" />
                </div>
                <h3 className="text-sm font-bold text-white">Win/Loss Distribution</h3>
              </div>
              <EnhancedDonut data={data.charts.winLossDistribution} />
            </motion.section>

            {/* Trading Stats Bar Chart */}
            <motion.section 
              className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4 sm:p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-orange-400" />
                </div>
                <h3 className="text-sm font-bold text-white">Trading Stats</h3>
              </div>
              <AnimatedBarChart data={tradingBarData} height={130} delay={0.9} />
            </motion.section>
          </div>

          {/* Top Symbols */}
          <motion.section 
            className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4 sm:p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Activity className="h-4 w-4 text-cyan-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Top Traded Symbols</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.charts.tradesBySymbol.slice(0, 6).map((item, i) => (
                <motion.div 
                  key={item.symbol} 
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 1 + (i * 0.1) }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-gray-500/20 text-gray-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-800 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="font-semibold text-white">{item.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{item.count} trades</p>
                    <p className={`text-sm font-bold ${item.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* Right Column - Contests & Activity */}
        <div className="space-y-6">
          {/* Competitions */}
          <motion.section 
            className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="p-4 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Competitions</h3>
                  <p className="text-xs text-gray-400">{data.competitions.active.length} active</p>
                </div>
              </div>
              <Link href="/competitions" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                View All <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              {data.competitions.active.length > 0 ? (
                data.competitions.active.map((comp) => (
                  <Link 
                    key={comp.id}
                    href={`/competitions/${comp.id}`}
                    className="block p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white truncate mr-2">{comp.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        comp.currentRank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        comp.currentRank <= 3 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        #{comp.currentRank || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{comp.totalParticipants} traders</span>
                      <span className={`font-bold ${comp.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {comp.pnl >= 0 ? '+' : ''}${comp.pnl.toFixed(2)}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-6">
                  <Trophy className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No active competitions</p>
                  <Link href="/competitions" className="text-xs text-yellow-400 hover:text-yellow-300 mt-2 inline-block">
                    Browse Competitions →
                  </Link>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-yellow-500/20 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{data.competitions.stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">{data.competitions.stats.won}</p>
                <p className="text-xs text-gray-500">Won</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-400">{data.competitions.stats.topThreeFinishes}</p>
                <p className="text-xs text-gray-500">Top 3</p>
              </div>
            </div>
          </motion.section>

          {/* Challenges */}
          <motion.section 
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Swords className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">1v1 Challenges</h3>
                  <p className="text-xs text-gray-400">{data.challenges.active.length} active</p>
                </div>
              </div>
              <Link href="/challenges" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                View All <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              {data.challenges.active.length > 0 ? (
                data.challenges.active.map((challenge) => (
                  <Link 
                    key={challenge.id}
                    href={`/challenges/${challenge.id}`}
                    className="block p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white truncate mr-2">
                        vs {challenge.opponent?.name || 'Opponent'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        challenge.isLeading ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {challenge.isLeading ? '🏆' : '📉'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">${challenge.stakeAmount}</span>
                      <span className={`font-bold ${challenge.userPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {challenge.userPnL >= 0 ? '+' : ''}${challenge.userPnL.toFixed(2)}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-6">
                  <Swords className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No active challenges</p>
                  <Link href="/challenges" className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block">
                    Create Challenge →
                  </Link>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-purple-500/20 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{data.challenges.stats.total}</p>
                <p className="text-xs text-gray-500">Played</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{data.challenges.stats.wins}</p>
                <p className="text-xs text-gray-500">Wins</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{data.challenges.stats.winRate.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Win Rate</p>
              </div>
            </div>
          </motion.section>

          {/* Recent Trades */}
          <motion.section 
            className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <div className="p-4 border-b border-gray-700/50 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Recent Trades</h3>
                <p className="text-xs text-gray-400">Latest closed positions</p>
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {data.recentActivity.trades.slice(0, 5).map((trade, i) => (
                <motion.div 
                  key={trade.id} 
                  className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 + (i * 0.05) }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      trade.side === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {trade.side === 'long' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{trade.symbol}</p>
                      <p className="text-xs text-gray-500 uppercase">{trade.side}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(trade.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
              {data.recentActivity.trades.length === 0 && (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No trades yet</p>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>

      {/* Win Potential Cards */}
      {data.competitions.active.length > 0 && (
        <motion.section 
          className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <div className="p-4 sm:p-5 border-b border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Win Potential</h3>
                <p className="text-xs text-gray-400">Each competition has its own ranking method</p>
              </div>
            </div>
            <Link href="/competitions" className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
              All Competitions <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.competitions.active.map((comp) => (
                <WinPotentialCard
                  key={comp.id}
                  competition={{
                    _id: comp.id,
                    name: comp.name,
                    rankingMethod: comp.rankingMethod as RankingMethod,
                    prizeDistribution: comp.prizeDistribution,
                    minimumTrades: comp.minimumTrades,
                  }}
                  userParticipation={comp.userParticipation}
                  allParticipants={comp.allParticipants}
                />
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Trading Streaks */}
      <motion.section 
        className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4 sm:p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.1 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Trading Streaks</h3>
            <p className="text-xs text-gray-400">Your current performance streaks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StreakCard 
            icon={<Flame className="w-5 h-5" />}
            label="Win Streak" 
            value={data.streaks.currentWinStreak} 
            subtitle={`Best: ${data.streaks.longestWinStreak}`}
            color="green" 
            delay={1.2}
          />
          <StreakCard 
            icon={<TrendingDown className="w-5 h-5" />}
            label="Loss Streak" 
            value={data.streaks.currentLossStreak} 
            subtitle={`Worst: ${data.streaks.longestLossStreak}`}
            color="red" 
            delay={1.3}
          />
          <StreakCard 
            icon={<Calendar className="w-5 h-5" />}
            label="Trading Days" 
            value={data.streaks.tradingDaysThisMonth} 
            subtitle="This month"
            color="blue" 
            delay={1.4}
          />
          <StreakCard 
            icon={<TrendingUp className="w-5 h-5" />}
            label="Profit Days" 
            value={data.streaks.consecutiveProfitableDays} 
            subtitle="In a row"
            color="emerald" 
            delay={1.5}
          />
          <StreakCard 
            icon={<Trophy className="w-5 h-5" />}
            label="Best Rank" 
            value={data.competitions.stats.bestRank > 0 ? `#${data.competitions.stats.bestRank}` : '-'} 
            subtitle="All time"
            color="yellow" 
            delay={1.6}
          />
          <StreakCard 
            icon={<Award className="w-5 h-5" />}
            label="Challenge W/L" 
            value={`${data.challenges.stats.wins}/${data.challenges.stats.losses}`} 
            subtitle={`${data.challenges.stats.winRate.toFixed(0)}% rate`}
            color="purple" 
            delay={1.7}
          />
        </div>
      </motion.section>

      {/* Market Holidays */}
      <MarketHolidaysCard />
    </div>
  );
}

// Streak Card Component
function StreakCard({ icon, label, value, subtitle, color, delay = 0 }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
  delay?: number;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string; shadow: string }> = {
    green: { bg: 'border-green-500/30', icon: 'text-green-400', text: 'text-green-400', shadow: 'rgba(34, 197, 94, 0.2)' },
    red: { bg: 'border-red-500/30', icon: 'text-red-400', text: 'text-red-400', shadow: 'rgba(239, 68, 68, 0.2)' },
    blue: { bg: 'border-blue-500/30', icon: 'text-blue-400', text: 'text-blue-400', shadow: 'rgba(59, 130, 246, 0.2)' },
    emerald: { bg: 'border-emerald-500/30', icon: 'text-emerald-400', text: 'text-emerald-400', shadow: 'rgba(16, 185, 129, 0.2)' },
    yellow: { bg: 'border-yellow-500/30', icon: 'text-yellow-400', text: 'text-yellow-400', shadow: 'rgba(234, 179, 8, 0.2)' },
    purple: { bg: 'border-purple-500/30', icon: 'text-purple-400', text: 'text-purple-400', shadow: 'rgba(168, 85, 247, 0.2)' },
  };
  const c = colorClasses[color] || colorClasses.blue;
  
  return (
    <motion.div 
      className={`bg-gray-800/50 border ${c.bg} rounded-xl p-4 text-center transition-all hover:scale-[1.02]`}
      style={{ boxShadow: `0 0 15px ${c.shadow}` }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className={`${c.icon} mx-auto mb-2`}>{icon}</div>
      <p className={`text-2xl font-black ${c.text} tabular-nums`}>{value}</p>
      <p className="text-xs text-white font-medium mt-1">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
    </motion.div>
  );
}
