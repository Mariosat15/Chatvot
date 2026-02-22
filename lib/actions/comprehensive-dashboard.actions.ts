"use server";

import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import {
  ForexSymbol,
  calculateUnrealizedPnL,
} from "@/lib/services/pnl-calculator.service";
import { getUserLevel } from "@/lib/services/xp-level.service";
import { calculateXPProgress } from "@/lib/services/xp-config.service";
import { getUserGlobalRank } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import UserBadge from "@/database/models/user-badge.model";
import BadgeConfig from "@/database/models/badge-config.model";

/**
 * Comprehensive Dashboard Data
 * Includes all competitions, challenges, performance metrics, and analytics
 */
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
    };
  };

  // Performance Charts Data
  charts: {
    walletBalanceHistory: { date: string; balance: number; change: number }[];
    equityCurve: { date: string; equity: number; pnl: number }[];
    dailyPnL: { date: string; pnl: number; trades: number }[];
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
}

interface CompetitionData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  prizePool: number;
  entryFee: number;
  currentRank: number;
  totalParticipants: number;
  pnl: number;
  pnlPercentage: number;
  currentCapital: number;
  startingCapital: number;
  totalTrades: number;
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

interface ChallengeData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  opponent: {
    name: string;
    pnl: number;
    pnlPercentage: number;
  } | null;
  userPnL: number;
  userPnLPercentage: number;
  isLeading: boolean;
  isWinner?: boolean;
  prizeWon?: number;
}

interface TradeData {
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

interface PositionData {
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

/**
 * Get comprehensive dashboard data for the authenticated user
 *
 * SOURCE OF TRUTH:
 * - Financial stats (totalPrizesWon) → CreditWallet model (line ~472)
 * - Trading metrics (trades, PnL, win rate) → CompetitionParticipant + ChallengeParticipant records
 * - Live capital → Only from ACTIVE contest participations (not wallet balance)
 *
 * IMPORTANT: totalPrizesWon MUST come from wallet to match profile page!
 * See lib/services/unified-user-stats.service.ts for the canonical definition.
 */
export async function getComprehensiveDashboardData(): Promise<ComprehensiveDashboardData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  await connectToDatabase();

  // Fetch user-scoped data first (no load-all)
  // PERF: .select() on every query to fetch only fields used by dashboard
  const participantSelect = "competitionId challengeId userId username currentCapital startingCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate averageWin averageLoss currentRank status unrealizedPnl currentOpenPositions prizeWon isWinner prizeReceived createdAt";
  const tradeSelect = "symbol side entryPrice exitPrice quantity realizedPnl isWinner openedAt closedAt competitionId challengeId";
  const challengeSelect = "_id challengerId challengedId name status startTime endTime stakeAmount challengerUsername challengedUsername";

  const [
    competitionParticipations,
    challengeParticipations,
    allChallenges,
    allTrades,
    wallet,
    walletTransactions,
  ] = await Promise.all([
    CompetitionParticipant.find({ userId }).select(participantSelect).sort({ createdAt: -1 }).limit(200).lean(),
    ChallengeParticipant.find({ userId }).select(participantSelect).sort({ createdAt: -1 }).limit(200).lean(),
    Challenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
    }).select(challengeSelect).sort({ createdAt: -1 }).limit(100).lean(),
    TradeHistory.find({ userId }).select(tradeSelect).sort({ closedAt: -1 }).limit(100).lean(),
    CreditWallet.findOne({ userId }).select("creditBalance totalWonFromCompetitions totalWonFromChallenges").lean(),
    WalletTransaction.find({ userId, status: "completed" })
      .select("createdAt balanceAfter amount")
      .sort({ createdAt: 1 })
      .limit(1000)
      .lean(),
  ]);

  const userCompIds = [
    ...new Set(
      (competitionParticipations as any[])
        .map((p: any) => p.competitionId)
        .filter(Boolean),
    ),
  ];
  const competitionSelect = "_id name status startTime endTime prizePool prizePoolCredits entryFee entryFeeCredits currentParticipants startingCapital rules prizeDistribution";
  const allCompetitions =
    userCompIds.length > 0
      ? await Competition.find({ _id: { $in: userCompIds } }).select(competitionSelect).lean()
      : [];

  // Process competitions
  const competitionsMap = new Map(
    allCompetitions.map((c: any) => [c._id.toString(), c]),
  );

  const processedCompetitions = {
    active: [] as CompetitionData[],
    upcoming: [] as CompetitionData[],
    completed: [] as CompetitionData[],
    stats: {
      total: competitionParticipations.length,
      won: 0,
      topThreeFinishes: 0,
      averageRank: 0,
      bestRank: Infinity,
    },
  };

  let totalRankSum = 0;
  let rankedCount = 0;

  // Pre-fetch all participants for active competitions (needed for Win Potential card)
  const activeCompetitionIds = allCompetitions
    .filter((c: any) => c.status === "active")
    .map((c: any) => c._id);

  const allActiveParticipants = await CompetitionParticipant.find({
    competitionId: { $in: activeCompetitionIds },
  })
    .select("userId competitionId pnl currentCapital startingCapital currentRank totalTrades winningTrades losingTrades status")
    .limit(10000)
    .lean();

  // Group participants by competition
  const participantsByCompetition = new Map<string, any[]>();
  for (const p of allActiveParticipants as any[]) {
    const compId = p.competitionId?.toString();
    if (!participantsByCompetition.has(compId)) {
      participantsByCompetition.set(compId, []);
    }
    participantsByCompetition.get(compId)!.push(p);
  }

  for (const participation of competitionParticipations as any[]) {
    const competition = competitionsMap.get(
      participation.competitionId?.toString(),
    );
    if (!competition) continue;

    // Get all participants for this competition (for win potential calculation)
    const competitionParticipants =
      participantsByCompetition.get(competition._id.toString()) || [];

    // Map participants to the format needed by WinPotentialCard
    const mappedParticipants = competitionParticipants.map((p: any) => ({
      userId: p.userId?.toString() || "",
      currentCapital: p.currentCapital || 0,
      startingCapital:
        p.startingCapital || competition.startingCapital || 10000,
      pnl: p.pnl || 0,
      pnlPercentage: p.pnlPercentage || 0,
      totalTrades: p.totalTrades || 0,
      winningTrades: p.winningTrades || 0,
      losingTrades: p.losingTrades || 0,
      winRate:
        p.totalTrades > 0 ? ((p.winningTrades || 0) / p.totalTrades) * 100 : 0,
      averageWin: p.averageWin || 0,
      averageLoss: p.averageLoss || 0,
      currentRank: p.currentRank || 0,
      status: p.status || "active",
    }));

    const compData: CompetitionData = {
      id: competition._id.toString(),
      name: competition.name,
      status: competition.status,
      startTime: competition.startTime,
      endTime: competition.endTime,
      prizePool: competition.prizePool || competition.prizePoolCredits || 0,
      entryFee: competition.entryFee || competition.entryFeeCredits || 0,
      currentRank: participation.currentRank || 0,
      totalParticipants: competition.currentParticipants || 0,
      pnl: participation.pnl || 0,
      pnlPercentage: participation.pnlPercentage || 0,
      currentCapital: participation.currentCapital || 0,
      startingCapital:
        participation.startingCapital || competition.startingCapital || 10000,
      totalTrades: participation.totalTrades || 0,
      winRate: participation.winRate || 0,
      openPositions: participation.currentOpenPositions || 0,
      prizeWon: participation.prizeWon,
      // Win Potential Card data
      rankingMethod: competition.rules?.rankingMethod || "pnl",
      prizeDistribution: competition.prizeDistribution || [],
      minimumTrades: competition.rules?.minimumTrades || 0,
      userParticipation: {
        userId: userId,
        currentCapital: participation.currentCapital || 0,
        startingCapital:
          participation.startingCapital || competition.startingCapital || 10000,
        pnl: participation.pnl || 0,
        pnlPercentage: participation.pnlPercentage || 0,
        totalTrades: participation.totalTrades || 0,
        winningTrades: participation.winningTrades || 0,
        losingTrades: participation.losingTrades || 0,
        winRate:
          participation.totalTrades > 0
            ? ((participation.winningTrades || 0) / participation.totalTrades) *
              100
            : 0,
        averageWin: participation.averageWin || 0,
        averageLoss: participation.averageLoss || 0,
        currentRank: participation.currentRank || 0,
        status: participation.status || "active",
      },
      allParticipants: mappedParticipants,
    };

    if (competition.status === "active") {
      processedCompetitions.active.push(compData);
    } else if (competition.status === "upcoming") {
      processedCompetitions.upcoming.push(compData);
    } else if (competition.status === "completed") {
      processedCompetitions.completed.push(compData);

      if (participation.currentRank === 1) processedCompetitions.stats.won++;
      if (participation.currentRank <= 3)
        processedCompetitions.stats.topThreeFinishes++;
    }

    if (participation.currentRank > 0) {
      totalRankSum += participation.currentRank;
      rankedCount++;
      if (participation.currentRank < processedCompetitions.stats.bestRank) {
        processedCompetitions.stats.bestRank = participation.currentRank;
      }
    }
  }

  processedCompetitions.stats.averageRank =
    rankedCount > 0 ? totalRankSum / rankedCount : 0;
  if (processedCompetitions.stats.bestRank === Infinity)
    processedCompetitions.stats.bestRank = 0;

  // Process challenges
  const processedChallenges = {
    active: [] as ChallengeData[],
    pending: [] as ChallengeData[],
    completed: [] as ChallengeData[],
    stats: {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalStaked: 0,
      totalWon: 0,
    },
  };

  for (const challenge of allChallenges as any[]) {
    const userParticipation = (challengeParticipations as any[]).find(
      (p: any) => p.challengeId?.toString() === challenge._id.toString(),
    );

    if (!userParticipation) continue;

    const isChallenger = challenge.challengerId === userId;
    const opponentParticipation = (challengeParticipations as any[]).find(
      (p: any) =>
        p.challengeId?.toString() === challenge._id.toString() &&
        p.userId !== userId,
    );

    const challengeData: ChallengeData = {
      id: challenge._id.toString(),
      name:
        challenge.name ||
        `Challenge vs ${isChallenger ? challenge.challengedUsername : challenge.challengerUsername}`,
      status: challenge.status,
      startTime: challenge.startTime,
      endTime: challenge.endTime,
      stakeAmount: challenge.stakeAmount || 0,
      opponent: opponentParticipation
        ? {
            name: opponentParticipation.username,
            pnl: opponentParticipation.pnl || 0,
            pnlPercentage: opponentParticipation.pnlPercentage || 0,
          }
        : null,
      userPnL: userParticipation.pnl || 0,
      userPnLPercentage: userParticipation.pnlPercentage || 0,
      isLeading: opponentParticipation
        ? (userParticipation.pnl || 0) > (opponentParticipation.pnl || 0)
        : true,
      isWinner: userParticipation.isWinner,
      prizeWon: userParticipation.prizeReceived,
    };

    processedChallenges.stats.total++;
    processedChallenges.stats.totalStaked += challenge.stakeAmount || 0;

    if (challenge.status === "active") {
      processedChallenges.active.push(challengeData);
    } else if (challenge.status === "pending") {
      processedChallenges.pending.push(challengeData);
    } else if (challenge.status === "completed") {
      processedChallenges.completed.push(challengeData);
      if (userParticipation.isWinner) {
        processedChallenges.stats.wins++;
        processedChallenges.stats.totalWon +=
          userParticipation.prizeReceived || 0;
      } else {
        processedChallenges.stats.losses++;
      }
    }
  }

  const totalChallengeGames =
    processedChallenges.stats.wins + processedChallenges.stats.losses;
  processedChallenges.stats.winRate =
    totalChallengeGames > 0
      ? (processedChallenges.stats.wins / totalChallengeGames) * 100
      : 0;

  // Calculate overview stats
  // ONLY count capital from ACTIVE competitions/challenges for "Live Balance"
  const activeCompetitionIdsSet = new Set(
    allCompetitions
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString()),
  );

  const activeChallengeIdsSet = new Set(
    allChallenges
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString()),
  );

  // Filter to only active participations for capital calculation
  const activeCompParticipations = (competitionParticipations as any[]).filter(
    (p: any) => activeCompetitionIdsSet.has(p.competitionId?.toString()),
  );
  const activeChallengeParticipations = (
    challengeParticipations as any[]
  ).filter((p: any) => activeChallengeIdsSet.has(p.challengeId?.toString()));

  // For total stats, use all participations
  const allParticipations = [
    ...competitionParticipations,
    ...challengeParticipations,
  ] as any[];
  // For live capital, use only active participations
  const activeParticipations = [
    ...activeCompParticipations,
    ...activeChallengeParticipations,
  ];

  // Live capital = only from active contests
  let totalCapital = 0;
  for (const p of activeParticipations) {
    totalCapital += p.currentCapital || 0;
  }

  // SINGLE SOURCE OF TRUTH: Get stats from TradeHistory collection
  // This ensures consistency between Dashboard, Profile, and Admin Panel
  const [tradeStats] = await TradeHistory.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: ["$isWinner", 1, 0] } },
        losingTrades: { $sum: { $cond: ["$isWinner", 0, 1] } },
        totalPnL: { $sum: "$realizedPnl" },
        grossWins: {
          $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        grossLosses: {
          $sum: {
            $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0],
          },
        },
        largestWin: {
          $max: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        largestLoss: {
          $min: { $cond: [{ $lt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
      },
    },
  ]);

  const stats = tradeStats || {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    grossWins: 0,
    grossLosses: 0,
    largestWin: 0,
    largestLoss: 0,
  };

  const totalTrades = stats.totalTrades;
  const winningTrades = stats.winningTrades;
  const losingTrades = stats.losingTrades;
  const totalPnL = stats.totalPnL;
  const totalGrossWins = stats.grossWins;
  const totalGrossLosses = stats.grossLosses;
  const largestWin = stats.largestWin || 0;
  const largestLoss = stats.largestLoss || 0;

  // Calculate unrealized PnL from participation records (this is still valid)
  let unrealizedPnL = 0;
  let realizedPnL = stats.totalPnL;
  for (const p of allParticipations) {
    unrealizedPnL += p.unrealizedPnl || 0;
  }

  // IMPORTANT: Use wallet as SOURCE OF TRUTH for prizes won (not participation records)
  // This ensures consistency with the profile page which also uses wallet data
  const walletData = wallet as any;
  const totalPrizesWon =
    (walletData?.totalWonFromCompetitions || 0) +
    (walletData?.totalWonFromChallenges || 0);

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor =
    totalGrossLosses > 0
      ? totalGrossWins / totalGrossLosses
      : totalGrossWins > 0
        ? 999
        : 0;
  const averageWin = winningTrades > 0 ? totalGrossWins / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalGrossLosses / losingTrades : 0;

  // Build chart data including wallet balance history
  const currentWalletBalance = walletData?.creditBalance || 0;
  const charts = await buildChartData(
    userId,
    allTrades as any[],
    walletTransactions as any[],
    currentWalletBalance,
  );

  // Get recent trades and positions
  const recentTrades: TradeData[] = (allTrades as any[])
    .slice(0, 20)
    .map((t: any) => ({
      id: t._id.toString(),
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      pnl: t.realizedPnl || 0,
      pnlPercentage:
        t.entryPrice > 0
          ? ((t.exitPrice - t.entryPrice) / t.entryPrice) *
            100 *
            (t.side === "long" ? 1 : -1)
          : 0,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      contestName: t.competitionId ? "Competition" : "Challenge",
      contestType: t.competitionId ? "competition" : "challenge",
    }));

  const openPositions = await TradingPosition.find({
    userId,
    status: "open",
  }).select("_id symbol side entryPrice quantity marginUsed openedAt competitionId challengeId").lean();
  const uniqueSymbols = [
    ...new Set((openPositions as any[]).map((p: any) => p.symbol).filter(Boolean)),
  ] as ForexSymbol[];
  const pricesMap =
    uniqueSymbols.length > 0
      ? await fetchRealForexPrices(uniqueSymbols)
      : new Map<ForexSymbol, { bid: number; ask: number }>();
  const positionsWithPrices: PositionData[] = (openPositions as any[]).map(
    (pos: any) => {
      const price = pricesMap.get(pos.symbol as ForexSymbol);
      const currentPrice = price
        ? pos.side === "long"
          ? price.bid
          : price.ask
        : pos.entryPrice;
      const unrealizedPnL = calculateUnrealizedPnL(
        pos.side,
        pos.entryPrice,
        currentPrice,
        pos.quantity,
        pos.symbol,
      );
      return {
        id: pos._id.toString(),
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        currentPrice,
        quantity: pos.quantity,
        unrealizedPnL,
        unrealizedPnLPercentage:
          pos.marginUsed > 0 ? (unrealizedPnL / pos.marginUsed) * 100 : 0,
        openedAt: pos.openedAt,
        contestName: pos.competitionId ? "Competition" : "Challenge",
        contestType: pos.competitionId ? "competition" : "challenge",
      };
    },
  );

  // Calculate streaks
  const streaks = calculateStreaks(allTrades as any[]);

  // Calculate starting capital for percentage
  const totalStartingCapital = allParticipations.reduce(
    (sum, p) => sum + (p.startingCapital || 10000),
    0,
  );
  const totalPnLPercentage =
    totalStartingCapital > 0 ? (totalPnL / totalStartingCapital) * 100 : 0;

  // Fetch player profile data (XP, level, badges, rank) in parallel
  const [userLevelData, xpProgress, rankData, earnedBadges] = await Promise.all([
    getUserLevel(userId).catch(() => ({
      currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader",
      currentIcon: "⚔️", currentColor: "#9ca3af", totalBadgesEarned: 0,
    })),
    calculateXPProgress(0).then(async (fallback) => {
      // Reason: We need the user's actual XP to calculate progress, but getUserLevel
      // is already fetching it. Use the result after it resolves.
      return fallback;
    }).catch(() => ({
      currentLevel: { level: 1, title: "Novice Trader", minXP: 0, icon: "⚔️", color: "#9ca3af", description: "" },
      nextLevel: null, progressPercent: 0, xpToNext: 100,
    })),
    getUserGlobalRank(userId).catch(() => ({ rank: 0, totalUsers: 0, percentile: 0 })),
    UserBadge.find({ userId }).sort({ earnedAt: -1 }).limit(5).lean().catch(() => []),
  ]);

  // Recalculate XP progress with actual user XP
  const actualXPProgress = await calculateXPProgress(
    (userLevelData as any).currentXP || 0
  ).catch(() => ({
    currentLevel: { level: 1, title: "Novice Trader", minXP: 0, icon: "⚔️", color: "#9ca3af", description: "" },
    nextLevel: null, progressPercent: 0, xpToNext: 100,
  }));

  // Fetch badge details for earned badges
  const badgeIds = (earnedBadges as any[]).map((b: any) => b.badgeId);
  const badgeConfigs = badgeIds.length > 0
    ? await BadgeConfig.find({ id: { $in: badgeIds }, isActive: true }).lean().catch(() => [])
    : [];
  const badgeConfigMap = new Map((badgeConfigs as any[]).map((b: any) => [b.id, b]));

  const recentBadges = (earnedBadges as any[]).map((ub: any) => {
    const config = badgeConfigMap.get(ub.badgeId);
    return {
      id: ub.badgeId,
      name: config?.name || ub.badgeId,
      icon: config?.icon || "🏅",
      rarity: config?.rarity || "common",
      earnedAt: ub.earnedAt,
    };
  });

  return {
    user: {
      id: userId,
      name: session.user.name || "Trader",
      email: session.user.email || "",
    },
    overview: {
      totalCapital,
      totalPnL,
      totalPnLPercentage,
      unrealizedPnL,
      realizedPnL,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      activeContests:
        processedCompetitions.active.length + processedChallenges.active.length,
      totalPrizesWon,
    },
    competitions: processedCompetitions,
    challenges: processedChallenges,
    charts,
    recentActivity: {
      trades: recentTrades,
      positions: positionsWithPrices,
    },
    streaks,
    player: {
      level: (userLevelData as any).currentLevel || 1,
      currentXP: (userLevelData as any).currentXP || 0,
      xpToNextLevel: actualXPProgress.xpToNext,
      progressPercent: actualXPProgress.progressPercent,
      title: (userLevelData as any).currentTitle || "Novice Trader",
      titleColor: (userLevelData as any).currentColor || "#9ca3af",
      titleIcon: (userLevelData as any).currentIcon || "⚔️",
      globalRank: rankData.rank,
      totalUsers: rankData.totalUsers,
      recentBadges,
      totalBadges: (userLevelData as any).totalBadgesEarned || 0,
    },
  };
}

async function buildChartData(
  userId: string,
  allTrades: any[],
  walletTransactions: any[],
  currentBalance: number,
) {
  const now = new Date();

  // Wallet Balance History - from transactions
  const walletBalanceHistory: {
    date: string;
    balance: number;
    change: number;
  }[] = [];

  // Build daily balance from transactions over last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Create a map of daily balances
  const dailyBalances = new Map<string, { balance: number; change: number }>();

  // Initialize with transactions
  for (const tx of walletTransactions) {
    const txDate = new Date(tx.createdAt);
    const dateStr = txDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Store the latest balance for each day
    dailyBalances.set(dateStr, {
      balance: tx.balanceAfter || 0,
      change: tx.amount || 0,
    });
  }

  // Build 30-day history
  let lastKnownBalance = 0;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (dailyBalances.has(dateStr)) {
      const dayData = dailyBalances.get(dateStr)!;
      lastKnownBalance = dayData.balance;
      walletBalanceHistory.push({
        date: dateStr,
        balance: dayData.balance,
        change: dayData.change,
      });
    } else {
      // No transactions this day, use last known balance
      walletBalanceHistory.push({
        date: dateStr,
        balance: lastKnownBalance,
        change: 0,
      });
    }
  }

  // If no history, just show current balance flat
  if (
    walletBalanceHistory.length === 0 ||
    walletBalanceHistory.every((d) => d.balance === 0)
  ) {
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      walletBalanceHistory.push({
        date: dateStr,
        balance: currentBalance,
        change: 0,
      });
    }
  }

  // PERF: Single-pass trade analysis replaces 7+ separate iterations
  // Pre-build date keys for 30-day lookup
  const dayPnLMap = new Map<string, { pnl: number; trades: number }>();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    dayPnLMap.set(dateStr, { pnl: 0, trades: 0 });
  }

  // Accumulators for all chart data
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  const symbolMap = new Map<string, { count: number; pnl: number }>();
  const hourMap = new Map<number, { count: number; pnl: number }>();
  for (let i = 0; i < 24; i++) hourMap.set(i, { count: 0, pnl: 0 });
  const monthMap = new Map<string, { pnl: number; trades: number; wins: number }>();

  // Single pass over all trades
  for (const trade of allTrades) {
    const pnl = trade.realizedPnl || 0;
    const closedAt = new Date(trade.closedAt);

    // Win/Loss distribution
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    else breakeven++;

    // Daily P&L (30-day window)
    const dayKey = closedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const dayEntry = dayPnLMap.get(dayKey);
    if (dayEntry) {
      dayEntry.pnl += pnl;
      dayEntry.trades++;
    }

    // Trades by symbol
    const symEntry = symbolMap.get(trade.symbol);
    if (symEntry) {
      symEntry.count++;
      symEntry.pnl += pnl;
    } else {
      symbolMap.set(trade.symbol, { count: 1, pnl });
    }

    // Trades by hour
    const hour = closedAt.getHours();
    const hourEntry = hourMap.get(hour)!;
    hourEntry.count++;
    hourEntry.pnl += pnl;

    // Monthly performance
    const monthKey = closedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
    const monthEntry = monthMap.get(monthKey);
    if (monthEntry) {
      monthEntry.pnl += pnl;
      monthEntry.trades++;
      if (pnl > 0) monthEntry.wins++;
    } else {
      monthMap.set(monthKey, { pnl, trades: 1, wins: pnl > 0 ? 1 : 0 });
    }
  }

  // Build daily P&L array from pre-built map (preserves 30-day order)
  const dailyPnL: { date: string; pnl: number; trades: number }[] = [];
  for (const [date, data] of dayPnLMap) {
    dailyPnL.push({ date, ...data });
  }

  // Equity curve (cumulative) - based on trading performance
  const equityCurve: { date: string; equity: number; pnl: number }[] = [];
  let cumulativeEquity = 10000; // Starting capital assumption
  for (const day of dailyPnL) {
    cumulativeEquity += day.pnl;
    equityCurve.push({
      date: day.date,
      equity: cumulativeEquity,
      pnl: day.pnl,
    });
  }

  // Sort and limit derived arrays
  const tradesBySymbol = Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const tradesByHour = Array.from(hourMap.entries()).map(([hour, data]) => ({
    hour,
    ...data,
  }));

  const monthlyPerformance = Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))
    .slice(-6);

  return {
    walletBalanceHistory,
    equityCurve,
    dailyPnL,
    winLossDistribution: { wins, losses, breakeven },
    tradesBySymbol,
    tradesByHour,
    monthlyPerformance,
  };
}

function calculateStreaks(trades: any[]) {
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime(),
  );

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  for (const trade of sortedTrades) {
    const pnl = trade.realizedPnl || 0;
    if (pnl > 0) {
      tempWinStreak++;
      tempLossStreak = 0;
      if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
    } else if (pnl < 0) {
      tempLossStreak++;
      tempWinStreak = 0;
      if (tempLossStreak > longestLossStreak)
        longestLossStreak = tempLossStreak;
    }
  }

  // Current streak from the end
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    const pnl = sortedTrades[i].realizedPnl || 0;
    if (pnl > 0 && currentLossStreak === 0) {
      currentWinStreak++;
    } else if (pnl < 0 && currentWinStreak === 0) {
      currentLossStreak++;
    } else {
      break;
    }
  }

  // Trading days this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tradingDays = new Set(
    trades
      .filter((t: any) => new Date(t.closedAt) >= startOfMonth)
      .map((t: any) => new Date(t.closedAt).toDateString()),
  );

  // Consecutive profitable days
  const dayPnLMap = new Map<string, number>();
  for (const trade of trades) {
    const day = new Date(trade.closedAt).toDateString();
    dayPnLMap.set(day, (dayPnLMap.get(day) || 0) + (trade.realizedPnl || 0));
  }

  let consecutiveProfitableDays = 0;
  const sortedDays = Array.from(dayPnLMap.entries()).sort(
    (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
  );

  for (const [, pnl] of sortedDays) {
    if (pnl > 0) consecutiveProfitableDays++;
    else break;
  }

  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak,
    tradingDaysThisMonth: tradingDays.size,
    consecutiveProfitableDays,
  };
}
