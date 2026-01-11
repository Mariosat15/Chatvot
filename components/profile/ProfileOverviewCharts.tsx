'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Target, 
  Award, 
  BarChart3, 
  Zap, 
  Swords, 
  Wallet,
  ArrowRight,
  Activity,
  DollarSign,
  Percent,
  Users,
  Crown
} from 'lucide-react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { motion } from 'framer-motion';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProfileOverviewChartsProps {
  combinedStats: any;
  competitionStats: any;
  challengeStats?: any;
  walletData: any;
}

// Animated Ring/Donut Chart Component
function RingChart({ 
  value, 
  maxValue = 100, 
  size = 120, 
  strokeWidth = 10,
  color,
  bgColor = 'rgba(255,255,255,0.1)',
  label,
  sublabel,
  icon,
  delay = 0
}: { 
  value: number; 
  maxValue?: number; 
  size?: number; 
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
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
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          {/* Animated progress ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#gradient-${label.replace(/\s/g, '')})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, delay, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id={`gradient-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className="mb-1">{icon}</div>}
          <motion.span 
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.5 }}
          >
            {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
            {maxValue === 100 && '%'}
          </motion.span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-300">{label}</p>
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
    </div>
  );
}

// Vertical Bar Chart Component
function BarChart({ 
  data, 
  height = 150,
  delay = 0 
}: { 
  data: { label: string; value: number; color: string; maxValue?: number }[];
  height?: number;
  delay?: number;
}) {
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 1);
  
  return (
    <div className="flex items-end justify-around gap-3" style={{ height }}>
      {data.map((item, i) => {
        const barHeight = (item.value / maxVal) * (height - 30);
        return (
          <div key={item.label} className="flex flex-col items-center">
            <motion.div
              className="rounded-t-lg relative overflow-hidden"
              style={{ 
                width: 40,
                background: `linear-gradient(to top, ${item.color}, ${item.color}88)`,
              }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(barHeight, 4) }}
              transition={{ duration: 0.8, delay: delay + (i * 0.1), ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20" />
            </motion.div>
            <motion.span 
              className="text-xs text-gray-400 mt-2 text-center whitespace-nowrap"
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

// Radial Progress Bar Component
function RadialProgress({ 
  value, 
  maxValue = 100, 
  label, 
  color,
  icon,
  size = 80,
  delay = 0
}: {
  value: number;
  maxValue?: number;
  label: string;
  color: string;
  icon?: React.ReactNode;
  size?: number;
  delay?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  return (
    <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3 border border-gray-700/50">
      <div className="relative" style={{ width: size, height: size / 2 }}>
        <svg viewBox="0 0 100 50" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10,50 A 40,40 0 0,1 90,50"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <motion.path
            d="M 10,50 A 40,40 0 0,1 90,50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: percentage / 100 }}
            transition={{ duration: 1.2, delay, ease: "easeOut" }}
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-xl font-bold text-white mt-1">
          {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(2)) : value}
        </p>
      </div>
    </div>
  );
}

// Stat Card with Gradient Border - Consistent glow effect
function GlowStatCard({
  icon,
  label,
  value,
  subvalue,
  trend,
  color,
  delay = 0
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'cyan';
  delay?: number;
}) {
  const colorMap = {
    blue: { gradient: 'from-blue-500 to-cyan-500', border: 'border-blue-500/50', text: 'text-blue-400', shadow: 'rgba(59, 130, 246, 0.3)' },
    green: { gradient: 'from-green-500 to-emerald-500', border: 'border-green-500/50', text: 'text-green-400', shadow: 'rgba(34, 197, 94, 0.3)' },
    red: { gradient: 'from-red-500 to-rose-500', border: 'border-red-500/50', text: 'text-red-400', shadow: 'rgba(239, 68, 68, 0.3)' },
    yellow: { gradient: 'from-yellow-500 to-amber-500', border: 'border-yellow-500/50', text: 'text-yellow-400', shadow: 'rgba(234, 179, 8, 0.3)' },
    purple: { gradient: 'from-purple-500 to-violet-500', border: 'border-purple-500/50', text: 'text-purple-400', shadow: 'rgba(168, 85, 247, 0.3)' },
    orange: { gradient: 'from-orange-500 to-red-500', border: 'border-orange-500/50', text: 'text-orange-400', shadow: 'rgba(249, 115, 22, 0.3)' },
    cyan: { gradient: 'from-cyan-500 to-blue-500', border: 'border-cyan-500/50', text: 'text-cyan-400', shadow: 'rgba(6, 182, 212, 0.3)' },
  };

  const colors = colorMap[color];

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Card with consistent glow */}
      <div 
        className={`relative bg-gray-900/90 backdrop-blur-sm rounded-2xl p-4 border ${colors.border} transition-all duration-300 group-hover:scale-[1.02]`}
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
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          {subvalue && <p className="text-xs text-gray-500 mt-1">{subvalue}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// Mini Donut Chart for Wallet Distribution
function DonutChart({
  data,
  size = 140,
  delay = 0
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  delay?: number;
}) {
  const total = data.reduce((acc, d) => acc + Math.max(d.value, 0), 0) || 1;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  let currentOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Data segments */}
          {data.map((segment, i) => {
            const percentage = segment.value / total;
            const segmentLength = percentage * circumference;
            const offset = currentOffset;
            currentOffset += segmentLength;
            
            return (
              <motion.circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: delay + (i * 0.1) }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-gray-400">Total</span>
          <span className="text-lg font-bold text-white">{total.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((segment, i) => (
          <motion.div 
            key={segment.label} 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: delay + 0.5 + (i * 0.1) }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-xs text-gray-400">{segment.label}</span>
            <span className="text-xs font-medium text-white">{segment.value.toFixed(2)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Horizontal Progress Bar
function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  showValue = true,
  delay = 0
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  showValue?: boolean;
  delay?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        {showValue && <span className="text-white font-medium">{value}</span>}
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(to right, ${color}, ${color}88)` }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function ProfileOverviewCharts({ 
  combinedStats, 
  competitionStats, 
  challengeStats, 
  walletData 
}: ProfileOverviewChartsProps) {
  const { settings, creditsToEUR } = useAppSettings();

  if (!settings) return null;

  // Calculate trading performance data
  const tradingBarData = useMemo(() => [
    { label: 'Wins', value: combinedStats?.winningTrades || 0, color: '#22c55e', maxValue: combinedStats?.totalTrades || 1 },
    { label: 'Losses', value: combinedStats?.losingTrades || 0, color: '#ef4444', maxValue: combinedStats?.totalTrades || 1 },
  ], [combinedStats]);

  // Wallet distribution data
  const walletDistribution = useMemo(() => [
    { label: 'Balance', value: walletData?.currentBalance || 0, color: '#eab308' },
    { label: 'Deposited', value: walletData?.totalDeposited || 0, color: '#3b82f6' },
    { label: 'Won', value: (walletData?.totalWonFromCompetitions || 0) + (walletData?.totalWonFromChallenges || 0), color: '#22c55e' },
    { label: 'Withdrawn', value: walletData?.totalWithdrawn || 0, color: '#6b7280' },
  ], [walletData]);

  const hasActivity = competitionStats?.totalCompetitionsEntered > 0 || challengeStats?.totalChallengesEntered > 0;

  return (
    <div className="space-y-6">
      {/* Hero Stats Row with Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlowStatCard
          icon={<BarChart3 className="w-5 h-5 text-white" />}
          label="Total Trades"
          value={combinedStats?.totalTrades || 0}
          trend={(combinedStats?.totalTrades || 0) > 0 ? 'up' : 'neutral'}
          color="blue"
          delay={0}
        />
        <GlowStatCard
          icon={<Target className="w-5 h-5 text-white" />}
          label="Win Rate"
          value={`${(combinedStats?.winRate || 0).toFixed(1)}%`}
          trend={(combinedStats?.winRate || 0) >= 50 ? 'up' : 'down'}
          color={(combinedStats?.winRate || 0) >= 50 ? 'green' : 'red'}
          delay={0.1}
        />
        <GlowStatCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Total P&L"
          value={`${(combinedStats?.totalPnL || 0) >= 0 ? '+' : ''}${(combinedStats?.totalPnL || 0).toFixed(2)}`}
          trend={(combinedStats?.totalPnL || 0) >= 0 ? 'up' : 'down'}
          color={(combinedStats?.totalPnL || 0) >= 0 ? 'green' : 'red'}
          delay={0.2}
        />
        <GlowStatCard
          icon={<Trophy className="w-5 h-5 text-white" />}
          label="Prizes Won"
          value={`${(combinedStats?.totalPrizesWon || 0).toFixed(settings.credits.decimals)}`}
          subvalue={settings.credits.symbol}
          color="yellow"
          delay={0.3}
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Performance Ring Charts */}
        <motion.div 
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Performance Overview</h3>
          </div>
          <div className="flex flex-wrap justify-around gap-4">
            <RingChart
              value={combinedStats?.winRate || 0}
              maxValue={100}
              size={110}
              color="#22c55e"
              label="Win Rate"
              icon={<Percent className="w-4 h-4 text-green-400" />}
              delay={0.5}
            />
            <RingChart
              value={combinedStats?.profitFactor === 999 ? 100 : Math.min((combinedStats?.profitFactor || 0) * 10, 100)}
              maxValue={100}
              size={110}
              color="#a855f7"
              label="Profit Factor"
              sublabel={combinedStats?.profitFactor === 999 ? '∞' : (combinedStats?.profitFactor || 0).toFixed(2)}
              delay={0.6}
            />
            <RingChart
              value={Math.min(Math.abs(combinedStats?.totalPnLPercentage || 0), 100)}
              maxValue={100}
              size={110}
              color={(combinedStats?.totalPnLPercentage || 0) >= 0 ? '#06b6d4' : '#ef4444'}
              label="ROI"
              sublabel={`${(combinedStats?.totalPnLPercentage || 0) >= 0 ? '+' : ''}${(combinedStats?.totalPnLPercentage || 0).toFixed(2)}%`}
              delay={0.7}
            />
          </div>
        </motion.div>

        {/* Wins vs Losses Bar Chart */}
        <motion.div 
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Trading Results</h3>
          </div>
          <BarChart data={tradingBarData} height={140} delay={0.6} />
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-700/50">
            <div className="text-center">
              <p className="text-xs text-gray-400">Avg Win</p>
              <p className="text-lg font-bold text-green-400">+${(combinedStats?.averageWin || 0).toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Avg Loss</p>
              <p className="text-lg font-bold text-red-400">-${(combinedStats?.averageLoss || 0).toFixed(2)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Wallet Section with Donut Chart */}
      <motion.div 
        className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Wallet Overview</h3>
          </div>
          <Link href="/wallet" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <div className="flex justify-center">
            <DonutChart data={walletDistribution} delay={0.7} />
          </div>
          
          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-yellow-500/20 to-amber-600/10 rounded-xl p-4 border border-yellow-500/30">
              <p className="text-xs text-gray-400 mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-white">
                {(walletData?.currentBalance || 0).toFixed(settings.credits.decimals)}
              </p>
              <p className="text-sm text-yellow-400">{settings.credits.symbol}</p>
              {settings.credits.showEUREquivalent && (
                <p className="text-xs text-gray-500 mt-1">
                  ≈ {settings.currency.symbol}{creditsToEUR(walletData?.currentBalance || 0).toFixed(2)}
                </p>
              )}
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/20">
              <p className="text-xs text-gray-400 mb-1">Total Won</p>
              <p className="text-2xl font-bold text-green-400">
                +{((walletData?.totalWonFromCompetitions || 0) + (walletData?.totalWonFromChallenges || 0)).toFixed(settings.credits.decimals)}
              </p>
              <p className="text-sm text-yellow-400">{settings.credits.symbol}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-blue-500/20">
              <p className="text-xs text-gray-400 mb-1">Deposited</p>
              <p className="text-xl font-bold text-blue-400">
                {(walletData?.totalDeposited || 0).toFixed(settings.credits.decimals)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-600/20">
              <p className="text-xs text-gray-400 mb-1">Withdrawn</p>
              <p className="text-xl font-bold text-gray-400">
                {(walletData?.totalWithdrawn || 0).toFixed(settings.credits.decimals)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Competition & Challenge Stats */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Competition Stats */}
        <motion.div 
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Competitions</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{competitionStats?.competitionsWon || 0}</p>
                  <p className="text-xs text-gray-400">Victories</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-400">
                  {(competitionStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)} {settings.credits.symbol}
                </p>
                <p className="text-xs text-gray-400">Total Prizes</p>
              </div>
            </div>
            
            <HorizontalBar
              label="Entered"
              value={competitionStats?.totalCompetitionsEntered || 0}
              maxValue={Math.max(competitionStats?.totalCompetitionsEntered || 0, 10)}
              color="#3b82f6"
              delay={0.8}
            />
            <HorizontalBar
              label="Podium Finishes"
              value={competitionStats?.podiumFinishes || 0}
              maxValue={competitionStats?.totalCompetitionsEntered || 1}
              color="#a855f7"
              delay={0.9}
            />
            <HorizontalBar
              label="Active"
              value={competitionStats?.totalCompetitionsActive || 0}
              maxValue={Math.max(competitionStats?.totalCompetitionsActive || 0, 5)}
              color="#22c55e"
              delay={1.0}
            />
          </div>
        </motion.div>

        {/* Challenge Stats */}
        <motion.div 
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">1v1 Challenges</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{challengeStats?.totalChallengesWon || 0}</p>
                  <p className="text-xs text-gray-400">Victories</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-400">
                  {(challengeStats?.totalCreditsWon || 0).toFixed(settings.credits.decimals)} {settings.credits.symbol}
                </p>
                <p className="text-xs text-gray-400">Total Won</p>
              </div>
            </div>
            
            <HorizontalBar
              label="Total Challenges"
              value={challengeStats?.totalChallengesEntered || 0}
              maxValue={Math.max(challengeStats?.totalChallengesEntered || 0, 10)}
              color="#f97316"
              delay={1.1}
            />
            <HorizontalBar
              label="Won"
              value={challengeStats?.totalChallengesWon || 0}
              maxValue={challengeStats?.totalChallengesEntered || 1}
              color="#22c55e"
              delay={1.2}
            />
            <HorizontalBar
              label="Lost"
              value={challengeStats?.totalChallengesLost || 0}
              maxValue={challengeStats?.totalChallengesEntered || 1}
              color="#ef4444"
              delay={1.3}
            />
          </div>
        </motion.div>
      </div>

      {/* Empty State */}
      {!hasActivity && (
        <motion.div 
          className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-2xl p-8 text-center border border-gray-700/50"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Ready to Start Trading?</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Join competitions or challenge other traders to start building your trading record and climb the leaderboard!
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/competitions"
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-900 rounded-xl font-semibold transition-all shadow-lg shadow-yellow-500/20"
            >
              Browse Competitions
            </Link>
            <Link
              href="/challenges"
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all"
            >
              Find Challengers
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
