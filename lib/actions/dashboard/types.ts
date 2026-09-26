/**
 * Dashboard payload types for getComprehensiveDashboardData.
 * Extracted for R21 so the mega-action can shrink without changing the shape.
 */
import type { PlayerGamePerformanceRow } from "@/lib/services/games/player-game-performance.service";
import type { PlayerGameProfile } from "@/lib/services/games/player-game-stats.service";

export interface ComprehensiveDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
  };

  // Overview Stats
  overview: {
    totalCapital: number;
    totalPnL: number;
    totalPnLPercentage: number;
    unrealizedPnL: number;
    realizedPnL: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    activeContests: number;
    totalPrizesWon: number;
    // Wallet stats for hero bar
    creditBalance: number;
    totalDeposited: number;
    totalSpent: number;
    totalWithdrawn: number;
    roi: number;
    gmEarnings: number;
  };

  // Competitions
  competitions: {
    active: CompetitionData[];
    upcoming: CompetitionData[];
    completed: CompetitionData[];
    stats: {
      total: number;
      won: number;
      topThreeFinishes: number;
      averageRank: number;
      bestRank: number;
      totalCreditsWon: number;
      activeCount: number;
    };
  };

  // Challenges (1v1)
  challenges: {
    active: ChallengeData[];
    pending: ChallengeData[];
    completed: ChallengeData[];
    stats: {
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      totalStaked: number;
      totalWon: number;
      totalCreditsWon: number;
    };
  };

  // Performance Charts Data
  charts: {
    walletBalanceHistory: { date: string; balance: number; change: number }[];
    equityCurve: { date: string; equity: number; pnl: number }[];
    dailyPnL: { date: string; pnl: number; trades: number }[];
    dailyCreditFlow: {
      date: string;
      inflow: number;
      outflow: number;
      net: number;
      transactions: number;
    }[];
    dailyCreditBreakdown: {
      date: string;
      deposits: number;
      wins: number;
      gmEarnings: number;
      refunds: number;
      entries: number;
      withdrawals: number;
      marketplace: number;
      other: number;
    }[];
    // Reason: All-time totals from getUserFinancialSummary() — single source of truth.
    // The dailyCreditBreakdown only covers 30 days, so the chart summary chips
    // must use these all-time values instead of summing the chart range.
    allTimeTotals: {
      deposits: number;
      wins: number;
      entries: number;
      withdrawals: number;
      marketplace: number;
      gmEarnings: number;
      refunds: number;
    };
    winLossDistribution: { wins: number; losses: number; breakeven: number };
    tradesBySymbol: { symbol: string; count: number; pnl: number }[];
    tradesByHour: { hour: number; count: number; pnl: number }[];
    monthlyPerformance: {
      month: string;
      pnl: number;
      trades: number;
      winRate: number;
    }[];
  };

  // Recent Activity
  recentActivity: {
    trades: TradeData[];
    positions: PositionData[];
  };

  // Streaks & Achievements
  streaks: {
    currentWinStreak: number;
    currentLossStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
    tradingDaysThisMonth: number;
    consecutiveProfitableDays: number;
  };

  // Player Profile (XP, Level, Badges, Rank)
  player: {
    level: number;
    currentXP: number;
    xpToNextLevel: number;
    progressPercent: number;
    title: string;
    titleColor: string;
    titleIcon: string;
    globalRank: number;
    totalUsers: number;
    recentBadges: Array<{
      id: string;
      name: string;
      icon: string;
      rarity: string;
      earnedAt: Date;
    }>;
    totalBadges: number;
  };

  // Journey / Milestones
  journey: {
    currentMapName: string;
    currentMapTheme: string;
    completedMilestones: number;
    totalMilestones: number;
    recentMilestones: Array<{
      id: string;
      name: string;
      icon: string;
      xp: number;
      completedAt: Date;
    }>;
  };

  // Account Status — restrictions, fraud alerts, investigations
  accountStatus: {
    // Active restrictions (bans, suspensions)
    restrictions: Array<{
      id: string;
      type: "banned" | "suspended";
      reason: string;
      customReason?: string;
      canTrade: boolean;
      canEnterCompetitions: boolean;
      canDeposit: boolean;
      canWithdraw: boolean;
      restrictedAt: Date;
      expiresAt?: Date;
    }>;
    // Open/investigating fraud alerts involving this user
    fraudAlerts: Array<{
      id: string;
      alertType: string;
      severity: string;
      status: string;
      title: string;
      description: string;
      confidence: number;
      detectedAt: Date;
      /** Unique evidence method types within this alert (e.g. same_device, mirror_trading) */
      evidenceTypes: string[];
    }>;
    // Active account lockouts
    lockouts: Array<{
      id: string;
      reason: string;
      lockedAt: Date;
      lockedUntil?: Date;
    }>;
    // KYC status
    kycStatus: "none" | "pending" | "approved" | "declined" | "resubmission";
    kycDeclineReason?: string;
    // Suspicion score summary
    suspicionScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    // Quick flags for UI
    hasActiveRestriction: boolean;
    hasOpenAlert: boolean;
    isLocked: boolean;
    // Open (non-terminal) chargeback case id, if any. Surfaces a dedicated
    // "Chargeback under review" copy on the user dashboard when present.
    openChargebackCaseId?: string | null;
  };

  /**
   * Ranked provider-game performance (R64 player twin). Empty for pure traders.
   * Trading metrics stay under `overview` / Performance rings — this never replaces them.
   */
  gamePerformance: PlayerGamePerformanceRow[];

  /**
   * Per-game standing from UserGameStats (13 s5 summary cards).
   * Read-only — never recomputed here. Empty perGame when the player has no
   * stored rows yet (Q14 aggregates start at zero).
   */
  gameStanding: PlayerGameProfile;

  /**
   * Whether trading is in the enabled game set. Drives GettingStartedCard so a
   * games-only platform never offers a "place your first trade" step (20 s5).
   * Creation/discovery only — never used to filter stats (R29).
   */
  tradingEnabled: boolean;
}

export interface CompetitionData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  prizePool: number;
  entryFee: number;
  currentRank: number;
  totalParticipants: number;
  // Reason: which game this contest is. Absent means trading (invariant 5), which is what
  // every document written before X1 looks like. The card reads this to decide whether the
  // metric it shows is a profit-and-loss figure or a game score.
  gameType?: string;
  gameKey?: string;
  // Reason: a provider game reports one number and no trading metrics. Undefined and zero
  // are different facts here - undefined means no round of theirs has reported yet, which
  // the card renders as "-" rather than as a score of nothing.
  score?: number;
  pnl: number;
  pnlPercentage: number;
  currentCapital: number;
  startingCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  openPositions: number;
  prizeWon?: number;
  // For Win Potential Card
  rankingMethod: string;
  prizeDistribution: { rank: number; percentage: number }[];
  minimumTrades: number;
  userParticipation: {
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
  };
  allParticipants: Array<{
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
  }>;
}

export interface ChallengeData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  // Reason: rankingMethod determines which metric to display and how to compare "isLeading"
  rankingMethod: string;
  opponent: {
    name: string;
    pnl: number;
    pnlPercentage: number;
    currentCapital?: number;
    winRate?: number;
    winningTrades?: number;
    losingTrades?: number;
    totalTrades?: number;
  } | null;
  userPnL: number;
  userPnLPercentage: number;
  // Additional stats needed for non-PnL ranking methods
  userCurrentCapital?: number;
  userWinRate?: number;
  userWinningTrades?: number;
  userLosingTrades?: number;
  userTotalTrades?: number;
  userStartingCapital?: number;
  isLeading: boolean;
  isWinner?: boolean;
  prizeWon?: number;
}

export interface TradeData {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  openedAt: Date;
  closedAt: Date;
  contestName: string;
  contestType: "competition" | "challenge";
}

export interface PositionData {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  openedAt: Date;
  contestName: string;
  contestType: "competition" | "challenge";
}

