/**
 * Ranking Configuration Service
 * 
 * Centralized configuration for all competition ranking methods.
 * To add a new ranking method:
 * 1. Add it to the RankingMethod type
 * 2. Add its configuration to RANKING_CONFIGS
 * 
 * Everything else (calculation, display, formatting) is handled automatically.
 */

import { Trophy, TrendingUp, DollarSign, Target, Award, Scale, Clock, Zap, BarChart3 } from 'lucide-react';

// All supported ranking methods - add new ones here
export type RankingMethod = 
  | 'pnl' 
  | 'roi' 
  | 'total_capital' 
  | 'win_rate' 
  | 'total_wins' 
  | 'profit_factor'
  // Future methods - easy to add
  | 'sharpe_ratio'
  | 'max_drawdown'
  | 'consistency_score';

export interface ParticipantMetrics {
  userId: string;
  currentCapital: number;
  startingCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  currentRank: number;
  status: string;
  // Extended metrics for new ranking methods
  maxDrawdown?: number;
  sharpeRatio?: number;
  consistencyScore?: number;
  totalVolume?: number;
}

interface RankingConfig {
  // Display
  name: string;              // Short name: "P&L"
  fullName: string;          // Full name: "Highest Profit & Loss"
  description: string;       // How winners are determined
  icon: any;                 // Lucide icon component
  color: string;             // Tailwind color name (emerald, blue, etc.)
  
  // Calculation
  getMetricValue: (participant: ParticipantMetrics) => number;
  higherIsBetter: boolean;   // True for P&L (more is better), false for drawdown (less is better)
  
  // Formatting
  formatValue: (value: number) => string;
  formatShort: (value: number) => string;  // Compact format for tight spaces
  
  // Units/suffix
  unit: string;              // "$", "%", "x", etc.
  suffix?: string;           // "trades", "pts", etc.
}

/**
 * Master configuration for all ranking methods
 * Add new ranking methods here - everything else updates automatically
 */
export const RANKING_CONFIGS: Record<RankingMethod, RankingConfig> = {
  pnl: {
    name: 'P&L',
    fullName: 'Highest P&L',
    description: 'Winner has the most profit/loss',
    icon: DollarSign,
    color: 'emerald',
    getMetricValue: (p) => p.pnl,
    higherIsBetter: true,
    formatValue: (v) => `$${v.toFixed(2)}`,
    formatShort: (v) => {
      const abs = Math.abs(v);
      if (abs >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (abs >= 1000) return `$${(v / 1000).toFixed(1)}K`;
      return `$${v.toFixed(2)}`;
    },
    unit: '$',
  },
  
  roi: {
    name: 'ROI',
    fullName: 'Highest ROI',
    description: 'Winner has the best return on investment',
    icon: TrendingUp,
    color: 'blue',
    getMetricValue: (p) => p.pnlPercentage,
    higherIsBetter: true,
    formatValue: (v) => `${v.toFixed(2)}%`,
    formatShort: (v) => `${v.toFixed(1)}%`,
    unit: '%',
  },
  
  total_capital: {
    name: 'Balance',
    fullName: 'Highest Balance',
    description: 'Winner has the most capital at end',
    icon: DollarSign,
    color: 'yellow',
    getMetricValue: (p) => p.currentCapital,
    higherIsBetter: true,
    formatValue: (v) => `$${v.toFixed(2)}`,
    formatShort: (v) => {
      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
      return `$${v.toFixed(0)}`;
    },
    unit: '$',
  },
  
  win_rate: {
    name: 'Win Rate',
    fullName: 'Highest Win Rate',
    description: 'Winner has the highest percentage of winning trades',
    icon: Target,
    color: 'cyan',
    getMetricValue: (p) => p.winRate,
    higherIsBetter: true,
    formatValue: (v) => `${v.toFixed(1)}%`,
    formatShort: (v) => `${v.toFixed(0)}%`,
    unit: '%',
  },
  
  total_wins: {
    name: 'Wins',
    fullName: 'Most Winning Trades',
    description: 'Winner has the most profitable trades',
    icon: Trophy,
    color: 'orange',
    getMetricValue: (p) => p.winningTrades,
    higherIsBetter: true,
    formatValue: (v) => `${Math.floor(v)} wins`,
    formatShort: (v) => `${Math.floor(v)}`,
    unit: '',
    suffix: 'wins',
  },
  
  profit_factor: {
    name: 'Profit Factor',
    fullName: 'Best Profit Factor',
    description: 'Winner has the best ratio of gross profit to gross loss',
    icon: Scale,
    color: 'purple',
    getMetricValue: (p) => {
      const totalWins = p.winningTrades > 0 ? (p.averageWin * p.winningTrades) : 0;
      const totalLosses = p.losingTrades > 0 ? Math.abs(p.averageLoss * p.losingTrades) : 0;
      return totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
    },
    higherIsBetter: true,
    formatValue: (v) => v > 99 ? '∞' : v.toFixed(2),
    formatShort: (v) => v > 99 ? '∞' : v.toFixed(1),
    unit: 'x',
  },

  // ============ FUTURE RANKING METHODS ============
  // Easy to add - just define the config
  
  sharpe_ratio: {
    name: 'Sharpe',
    fullName: 'Best Sharpe Ratio',
    description: 'Winner has the best risk-adjusted return',
    icon: BarChart3,
    color: 'indigo',
    getMetricValue: (p) => p.sharpeRatio || 0,
    higherIsBetter: true,
    formatValue: (v) => v.toFixed(2),
    formatShort: (v) => v.toFixed(1),
    unit: '',
  },
  
  max_drawdown: {
    name: 'Drawdown',
    fullName: 'Lowest Max Drawdown',
    description: 'Winner has the smallest maximum drawdown',
    icon: TrendingUp,
    color: 'red',
    getMetricValue: (p) => -(p.maxDrawdown || 0), // Negate so lower is "higher" in sorting
    higherIsBetter: true, // After negation, higher is better
    formatValue: (v) => `${Math.abs(v).toFixed(1)}%`,
    formatShort: (v) => `${Math.abs(v).toFixed(0)}%`,
    unit: '%',
  },
  
  consistency_score: {
    name: 'Consistency',
    fullName: 'Most Consistent Trader',
    description: 'Winner has the most consistent daily performance',
    icon: Zap,
    color: 'pink',
    getMetricValue: (p) => p.consistencyScore || 0,
    higherIsBetter: true,
    formatValue: (v) => `${v.toFixed(0)} pts`,
    formatShort: (v) => `${v.toFixed(0)}`,
    unit: 'pts',
  },
};

/**
 * Get ranking configuration for a method
 * Falls back to P&L if method not found
 */
export function getRankingConfig(method: RankingMethod): RankingConfig {
  return RANKING_CONFIGS[method] || RANKING_CONFIGS.pnl;
}

/**
 * Get metric value for a participant based on ranking method
 */
export function getMetricValue(participant: ParticipantMetrics, method: RankingMethod): number {
  const config = getRankingConfig(method);
  return config.getMetricValue(participant);
}

/**
 * Get display name for ranking method
 */
export function getMetricName(method: RankingMethod): string {
  return getRankingConfig(method).name;
}

/**
 * Get full display name for ranking method
 */
export function getMetricFullName(method: RankingMethod): string {
  return getRankingConfig(method).fullName;
}

/**
 * Get description of how winners are determined
 */
export function getMetricDescription(method: RankingMethod): string {
  return getRankingConfig(method).description;
}

/**
 * Format metric value for display
 */
export function formatMetricValue(value: number, method: RankingMethod): string {
  return getRankingConfig(method).formatValue(value);
}

/**
 * Format metric value in short form
 */
export function formatMetricShort(value: number, method: RankingMethod): string {
  return getRankingConfig(method).formatShort(value);
}

/**
 * Get icon component for ranking method
 */
export function getMetricIcon(method: RankingMethod): any {
  return getRankingConfig(method).icon;
}

/**
 * Get color for ranking method
 */
export function getMetricColor(method: RankingMethod): string {
  return getRankingConfig(method).color;
}

/**
 * Sort participants by ranking method
 */
export function sortByRanking(participants: ParticipantMetrics[], method: RankingMethod): ParticipantMetrics[] {
  const config = getRankingConfig(method);
  return [...participants].sort((a, b) => {
    const aValue = config.getMetricValue(a);
    const bValue = config.getMetricValue(b);
    return config.higherIsBetter ? bValue - aValue : aValue - bValue;
  });
}

/**
 * Check if all required ranking methods have valid configs
 */
export function validateRankingConfigs(): boolean {
  const requiredMethods: RankingMethod[] = ['pnl', 'roi', 'total_capital', 'win_rate', 'total_wins', 'profit_factor'];
  return requiredMethods.every(method => {
    const config = RANKING_CONFIGS[method];
    return config && config.name && config.getMetricValue && config.formatValue;
  });
}

