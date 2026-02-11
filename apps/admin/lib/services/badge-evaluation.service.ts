"use server";

import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import UserBadge from "@/database/models/user-badge.model";
import { Badge } from "@/lib/constants/badges";
import { awardXPForBadge } from "@/lib/services/xp-level.service";
import { getBadgesFromDB } from "@/lib/services/badge-config-seed.service";
import { getUserGlobalRank } from "@/lib/actions/leaderboard/global-leaderboard.actions";

export interface UserStats {
  userId: string;
  // Competition stats
  competitionsEntered: number;
  completedCompetitions: number; // NEW: Competitions with status "completed"
  completedCompetitionsWithTrades: number; // NEW: Completed competitions with 5+ trades
  firstPlaceFinishes: number;
  podiumFinishes: number;
  totalWins: number;

  // Trading volume
  totalTrades: number;
  uniquePairsTraded: number;

  // P&L
  totalPnl: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageRoi: number;
  profitFactor: number;
  bestSingleTrade: number;
  currentWinStreak: number;
  maxWinStreak: number;

  // Risk
  liquidationCount: number;
  maxDrawdown: number;
  alwaysUsesSL: boolean;
  alwaysUsesTP: boolean;

  // Speed
  averageTradesDuration: number;

  // Wallet
  totalDeposited: number;
  totalWithdrawn: number;
  withdrawalCount: number; // Number of completed withdrawals
  kycVerified: boolean;

  // Time
  accountAge: number; // days
  consecutiveTradingDays: number;
  weeklyTradingStreak: number;
  monthlyTradingStreak: number;

  // Speed/Execution
  averageTradeDuration: number; // in minutes
  tradesUnder1Minute: number;
  tradesUnder5Minutes: number;
  tradesOver1Day: number;
  tradesOver7Days: number;
  tradesAtMarketOpen: number;
  tradesAtMarketClose: number;
  tradesAtLateNight: number; // NEW: Trades between 22:00-06:00 UTC

  // Daily/Weekly/Monthly volumes
  maxTradesInOneDay: number;
  maxTradesInOneWeek: number;
  maxTradesInOneMonth: number;

  // Competition specific
  comebackWins: number;
  wireToWireWins: number;
  perfectCompetitionTrades: number;

  // Risk metrics
  averageLoss: number;
  averageWin: number;
  sharpeRatio: number;
  profitVolatility: number;
  averagePositionSize: number;
  uniqueStrategiesUsed: number;
  consecutiveProfitableDays: number;

  // SL/TP trigger counts
  slTriggeredCount: number;
  tpTriggeredCount: number;

  // Global rank
  globalRank: number;
  
  // Additional milestone condition fields
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  top10Finishes: number;
  top50PercentFinishes: number;
  competitionPnl: number;
  currentLevel: number;
  currentXP: number;
  xpEarnedToday: number;
  xpEarnedThisWeek: number;
  totalBadgesEarned: number;
  referralsMade: number;
  referralsActive: number;
  friendsAdded: number;
  messagesSent: number;
  loginStreak: number;
}

/**
 * Evaluate all badges for a user and award new ones
 */
export async function evaluateUserBadges(userId: string): Promise<{
  newBadges: Badge[];
  totalBadges: number;
}> {
  await connectToDatabase();

  try {
    console.log(`🔍 [BADGE EVAL] Starting badge evaluation for user ${userId}`);

    // 0. Fetch badges from database
    const badges = await getBadgesFromDB();
    console.log(
      `📋 [BADGE EVAL] Loaded ${badges.length} badge definitions from database`,
    );

    // 1. Gather user statistics
    const stats = await gatherUserStats(userId);
    console.log(`📊 [BADGE EVAL] User stats:`, {
      trades: stats.totalTrades,
      competitions: stats.competitionsEntered,
      completedCompetitions: stats.completedCompetitions,
      completedCompetitionsWithTrades: stats.completedCompetitionsWithTrades,
      wins: stats.totalWins,
      deposits: stats.totalDeposited,
      winRate: stats.winRate,
      totalPnl: stats.totalPnl,
      liquidations: stats.liquidationCount,
      tradesAtLateNight: stats.tradesAtLateNight,
    });

    // 2. Get currently earned badges
    const existingBadges = await UserBadge.find({ userId }).lean();
    const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));
    console.log(
      `🏅 [BADGE EVAL] User already has ${existingBadges.length} badges`,
    );

    // 2b. Fetch user level for level-gated badge checks
    let userCurrentLevel = 1;
    try {
      const UserLevel = (await import("@/database/models/user-level.model")).default;
      const userLevelDoc = await UserLevel.findOne({ userId }).select("currentLevel").lean();
      userCurrentLevel = (userLevelDoc as any)?.currentLevel || 1;
    } catch { /* default to 1 */ }

    // Default minLevel per rarity for badges that don't specify one
    const RARITY_DEFAULT_MIN_LEVEL: Record<string, number> = {
      common: 0,
      rare: 0,
      epic: 5,
      legendary: 8,
    };

    // 3. Evaluate each badge
    const newlyEarnedBadges: Badge[] = [];

    for (const badge of badges) {
      // Skip if already earned
      if (existingBadgeIds.has(badge.id)) continue;

      // Level-gated check
      const badgeMinLevel = (badge as any).minLevel || RARITY_DEFAULT_MIN_LEVEL[badge.rarity] || 0;
      if (badgeMinLevel > 0 && userCurrentLevel < badgeMinLevel) {
        continue;
      }

      // Check if badge condition is met
      const earned = await checkBadgeCondition(badge as Badge, stats);

      if (earned) {
        console.log(
          `✅ [BADGE EVAL] User earned badge: ${badge.name} (${badge.id})`,
        );

        // Award the badge
        const userBadge = await UserBadge.create({
          userId,
          badgeId: badge.id,
          earnedAt: new Date(),
          progress: 100,
        });
        console.log(`💾 [BADGE EVAL] Badge saved to database:`, userBadge._id);

        // Award XP for the badge
        try {
          console.log(`⭐ [BADGE EVAL] Awarding XP for badge ${badge.id}...`);
          const xpResult = await awardXPForBadge(userId, badge.id);
          console.log(
            `✅ [BADGE EVAL] XP awarded: ${xpResult.xpGained} XP (total: ${xpResult.newXP})`,
          );
        } catch (error) {
          console.error(
            `❌ [BADGE EVAL] Error awarding XP for badge ${badge.id}:`,
            error,
          );
        }

        // Send notification about badge earned (fire and forget)
        try {
          const { notificationService } =
            await import("@/lib/services/notification.service");
          await notificationService.notifyBadgeEarned(
            userId,
            badge.name,
            badge.description || `You've earned the ${badge.name} badge!`,
          );
          console.log(
            `🔔 [BADGE EVAL] Badge notification sent for ${badge.name}`,
          );
        } catch (error) {
          console.error(
            `❌ [BADGE EVAL] Error sending badge notification:`,
            error,
          );
        }

        newlyEarnedBadges.push(badge as Badge);
      }
    }

    console.log(
      `🎉 [BADGE EVAL] Evaluation complete: ${newlyEarnedBadges.length} new badges earned`,
    );

    // IMPORTANT: Ensure UserLevel exists so user appears in leaderboard
    // Even if no badges earned, we create the record for tracking
    try {
      const { ensureUserLevel } =
        await import("@/lib/services/xp-level.service");
      await ensureUserLevel(userId);
    } catch (levelError) {
      console.error("❌ [BADGE EVAL] Error ensuring user level:", levelError);
    }

    // Check and complete journey milestones based on new stats/badges
    try {
      const { checkAndCompleteMilestones } =
        await import("@/lib/services/journey-progress.service");
      const journeyResult = await checkAndCompleteMilestones(userId);
      if (journeyResult.completed.length > 0) {
        console.log(
          `🗺️ [BADGE EVAL] Journey milestones completed: ${journeyResult.completed.join(", ")}`
        );
      }
    } catch (journeyError) {
      console.error("❌ [BADGE EVAL] Error checking journey milestones:", journeyError);
    }

    return {
      newBadges: newlyEarnedBadges,
      totalBadges: existingBadges.length + newlyEarnedBadges.length,
    };
  } catch (error) {
    console.error("❌ [BADGE EVAL] Error evaluating user badges:", error);
    return { newBadges: [], totalBadges: 0 };
  }
}

/**
 * Gather comprehensive user statistics for badge evaluation
 * Exported for use by journey progress service
 */
export async function gatherUserStats(userId: string): Promise<UserStats> {
  // Get competition stats
  const participations = await CompetitionParticipant.find({ userId }).lean();
  const firstPlaceFinishes = participations.filter(
    (p) => p.currentRank === 1,
  ).length;
  const podiumFinishes = participations.filter(
    (p) => p.currentRank && p.currentRank <= 3,
  ).length;

  // NEW: Count completed competitions (status = "completed")
  const completedCompetitions = participations.filter(
    (p) => p.status === "completed",
  ).length;

  // NEW: Count completed competitions with 5+ trades (for realistic survival badges)
  const completedCompetitionsWithTrades = participations.filter(
    (p) => p.status === "completed" && (p.totalTrades || 0) >= 5,
  ).length;

  // Get trading stats
  const allPositions = await TradingPosition.find({ userId }).lean();
  const closedTrades = await TradeHistory.find({ userId }).lean();

  // SL/TP trigger counts
  const slTriggeredCount = closedTrades.filter((t: any) => t.closeReason === "stop_loss").length;
  const tpTriggeredCount = closedTrades.filter((t: any) => t.closeReason === "take_profit").length;

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(
    (t) => (t.realizedPnl || 0) > 0,
  ).length;
  const losingTrades = closedTrades.filter(
    (t) => (t.realizedPnl || 0) < 0,
  ).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl || 0),
    0,
  );
  const bestSingleTrade = Math.max(
    ...closedTrades.map((t) => t.realizedPnl || 0),
    0,
  );

  // Calculate win streak
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let tempStreak = 0;

  const sortedTrades = [...closedTrades].sort(
    (a, b) =>
      new Date(a.closedAt || 0).getTime() - new Date(b.closedAt || 0).getTime(),
  );

  for (const trade of sortedTrades) {
    if ((trade.realizedPnl || 0) > 0) {
      tempStreak++;
      maxWinStreak = Math.max(maxWinStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Current streak from most recent trades
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    if ((sortedTrades[i].realizedPnl || 0) > 0) {
      currentWinStreak++;
    } else {
      break;
    }
  }

  // Profit factor
  const grossProfit = closedTrades
    .filter((t) => (t.realizedPnl || 0) > 0)
    .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const grossLoss = Math.abs(
    closedTrades
      .filter((t) => (t.realizedPnl || 0) < 0)
      .reduce((sum, t) => sum + (t.realizedPnl || 0), 0),
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  // Unique pairs
  const uniquePairs = new Set(closedTrades.map((t) => t.symbol));

  // ROI calculation
  const totalRoi = participations.reduce(
    (sum, p) => sum + (p.pnlPercentage || 0),
    0,
  );
  const averageRoi =
    participations.length > 0 ? totalRoi / participations.length : 0;

  // Liquidations
  const liquidationCount = participations.filter(
    (p) => p.status === "liquidated",
  ).length;

  // SL/TP usage - Only count if user has placed trades
  const tradesWithSL = allPositions.filter(
    (p) => p.stopLoss && p.stopLoss > 0,
  ).length;
  const tradesWithTP = allPositions.filter(
    (p) => p.takeProfit && p.takeProfit > 0,
  ).length;
  const alwaysUsesSL =
    allPositions.length > 0 && tradesWithSL === allPositions.length;
  const alwaysUsesTP =
    allPositions.length > 0 && tradesWithTP === allPositions.length;

  // Wallet stats
  const [wallet, withdrawalCount] = await Promise.all([
    CreditWallet.findOne({ userId }).lean() as Promise<Record<string, unknown> | null>,
    WithdrawalRequest.countDocuments({ userId, status: { $in: ["completed", "paid"] } }),
  ]);
  const totalDeposited = (wallet?.totalDeposited as number) || 0;
  const totalWithdrawn = (wallet?.totalWithdrawn as number) || 0;
  const kycVerified = !!(wallet?.kycVerified || wallet?.kycStatus === "approved");

  // Account age (assuming user created with first participation or wallet)
  const firstParticipation = participations.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )[0];
  const accountCreatedAt =
    firstParticipation?.createdAt || (wallet?.createdAt as Date) || new Date();
  const accountAge = Math.floor(
    (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  // Calculate trading streaks
  const tradeDates = closedTrades
    .map((t) => {
      const date = new Date(t.closedAt || Date.now());
      return date.toISOString().split("T")[0]; // Get date only
    })
    .sort();

  const uniqueTradeDays = [...new Set(tradeDates)];
  let consecutiveDays = 0;
  let tempConsecutive = 0;

  for (let i = 0; i < uniqueTradeDays.length; i++) {
    if (i === 0) {
      tempConsecutive = 1;
    } else {
      const prevDate = new Date(uniqueTradeDays[i - 1]);
      const currDate = new Date(uniqueTradeDays[i]);
      const diffDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        tempConsecutive++;
      } else {
        tempConsecutive = 1;
      }
    }
    consecutiveDays = Math.max(consecutiveDays, tempConsecutive);
  }

  // Speed metrics
  const tradesDurations = closedTrades
    .map((t) => {
      if (t.openedAt && t.closedAt) {
        return (
          (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) /
          1000 /
          60
        ); // minutes
      }
      return 0;
    })
    .filter((d) => d > 0);

  const averageTradeDuration =
    tradesDurations.length > 0
      ? tradesDurations.reduce((a, b) => a + b, 0) / tradesDurations.length
      : 0;

  const tradesUnder1Minute = tradesDurations.filter((d) => d < 1).length;
  const tradesUnder5Minutes = tradesDurations.filter((d) => d < 5).length;
  const tradesOver1Day = tradesDurations.filter((d) => d > 1440).length; // 24 hours
  const tradesOver7Days = tradesDurations.filter((d) => d > 10080).length; // 7 days

  // Time of day analysis
  const tradesAtMarketOpen = closedTrades.filter((t) => {
    const hour = new Date(t.openedAt || Date.now()).getUTCHours();
    return hour >= 13 && hour <= 14; // 1-2 PM UTC (market open)
  }).length;

  const tradesAtMarketClose = closedTrades.filter((t) => {
    const hour = new Date(t.closedAt || Date.now()).getUTCHours();
    return hour >= 20 && hour <= 21; // 8-9 PM UTC (market close)
  }).length;

  // NEW: Trades at late night (22:00-06:00 UTC)
  const tradesAtLateNight = closedTrades.filter((t) => {
    const hour = new Date(t.openedAt || Date.now()).getUTCHours();
    return hour >= 22 || hour < 6; // 22:00-06:00 UTC
  }).length;

  // Daily/Weekly/Monthly volumes
  const tradesPerDay = new Map<string, number>();
  closedTrades.forEach((t) => {
    const dateKey = new Date(t.closedAt || Date.now())
      .toISOString()
      .split("T")[0];
    tradesPerDay.set(dateKey, (tradesPerDay.get(dateKey) || 0) + 1);
  });
  const maxTradesInOneDay = Math.max(...Array.from(tradesPerDay.values()), 0);

  // Weekly volumes
  const tradesPerWeek = new Map<string, number>();
  closedTrades.forEach((t) => {
    const date = new Date(t.closedAt || Date.now());
    // Get ISO week
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7
    );
    const weekKey = `${date.getFullYear()}-W${weekNumber}`;
    tradesPerWeek.set(weekKey, (tradesPerWeek.get(weekKey) || 0) + 1);
  });
  const maxTradesInOneWeek = Math.max(...Array.from(tradesPerWeek.values()), 0);

  // Monthly volumes
  const tradesPerMonth = new Map<string, number>();
  closedTrades.forEach((t) => {
    const date = new Date(t.closedAt || Date.now());
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    tradesPerMonth.set(monthKey, (tradesPerMonth.get(monthKey) || 0) + 1);
  });
  const maxTradesInOneMonth = Math.max(...Array.from(tradesPerMonth.values()), 0);

  // Competition specific stats
  const comebackWins = participations.filter((p) => {
    // Simplified: Won but had negative P&L at some point
    return p.currentRank === 1 && p.realizedPnl > 0 && p.losingTrades > 0;
  }).length;

  const wireToWireWins = participations.filter((p) => {
    // Simplified: Won with very high win rate
    return p.currentRank === 1 && p.winRate >= 80;
  }).length;

  const perfectCompetitionTrades = participations.filter((p) => {
    // 100% win rate in a competition with at least 10 trades
    return p.totalTrades >= 10 && p.winRate === 100;
  }).length;

  // Calculate risk metrics
  const losses = closedTrades.filter((t) => t.realizedPnl < 0);
  const wins = closedTrades.filter((t) => t.realizedPnl > 0);

  const averageLoss =
    losses.length > 0
      ? Math.abs(
          losses.reduce((sum, t) => sum + t.realizedPnl, 0) / losses.length,
        )
      : 0;

  const averageWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + t.realizedPnl, 0) / wins.length
      : 0;

  // Sharpe Ratio (simplified: returns / volatility)
  const returns = closedTrades.map((t) => t.realizedPnl);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const variance =
    returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        returns.length
      : 0;
  const profitVolatility = Math.sqrt(variance);
  const sharpeRatio = profitVolatility > 0 ? avgReturn / profitVolatility : 0;

  // Position sizing (simplified)
  const averagePositionSize =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.volume || 0), 0) /
        closedTrades.length
      : 0;

  // Strategy diversity (pairs traded is a proxy)
  const uniqueStrategiesUsed = uniquePairs.size;

  // Consecutive profitable days
  const profitableDays = new Map<string, number>();
  closedTrades.forEach((t) => {
    const dateKey = new Date(t.closedAt || Date.now())
      .toISOString()
      .split("T")[0];
    const currentPnl = profitableDays.get(dateKey) || 0;
    profitableDays.set(dateKey, currentPnl + t.realizedPnl);
  });

  const sortedProfitDays = Array.from(profitableDays.entries())
    .filter(([_, pnl]) => pnl > 0)
    .map(([date, _]) => date)
    .sort();

  let consecutiveProfitableDays = 0;
  let tempConsecutiveProfitable = 0;

  for (let i = 0; i < sortedProfitDays.length; i++) {
    if (i === 0) {
      tempConsecutiveProfitable = 1;
    } else {
      const prevDate = new Date(sortedProfitDays[i - 1]);
      const currDate = new Date(sortedProfitDays[i]);
      const diffDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        tempConsecutiveProfitable++;
      } else {
        tempConsecutiveProfitable = 1;
      }
    }
    consecutiveProfitableDays = Math.max(
      consecutiveProfitableDays,
      tempConsecutiveProfitable,
    );
  }

  // Global rank from leaderboard (lower = better; 1 = first). Uses cached leaderboard when available.
  let globalRank = 999999;
  try {
    const rankResult = await getUserGlobalRank(userId);
    if (rankResult.rank > 0) globalRank = rankResult.rank;
  } catch (err) {
    console.warn("[gatherUserStats] getUserGlobalRank failed, using fallback rank:", err);
  }

  // Calculate additional placement finishes from participations
  const secondPlaceFinishes = participations.filter(
    (p) => p.currentRank === 2,
  ).length;
  const thirdPlaceFinishes = participations.filter(
    (p) => p.currentRank === 3,
  ).length;
  const top10Finishes = participations.filter(
    (p) => p.currentRank && p.currentRank <= 10,
  ).length;
  const top50PercentFinishes = participations.filter(
    (p) => p.currentRank && p.totalParticipants && p.currentRank <= Math.ceil(p.totalParticipants / 2),
  ).length;
  const competitionPnl = participations.reduce(
    (sum, p) => sum + (p.totalPnl || 0), 0
  );

  // Fetch user level data for XP-based conditions
  let currentLevel = 1;
  let currentXP = 0;
  let totalBadgesEarned = 0;
  try {
    const UserLevel = (await import("@/database/models/user-level.model")).default;
    const userLevel = await UserLevel.findOne({ userId }).lean();
    if (userLevel) {
      currentLevel = (userLevel as any).currentLevel || 1;
      currentXP = (userLevel as any).currentXP || 0;
      totalBadgesEarned = (userLevel as any).totalBadgesEarned || 0;
    }
  } catch (error) {
    // UserLevel may not exist yet
  }

  // Fetch referral stats
  let referralsMade = 0;
  let referralsActive = 0;
  try {
    const UserReferral = (await import("@/database/models/user-referral.model")).default;
    referralsMade = await UserReferral.countDocuments({ gameMasterId: userId });
    referralsActive = await UserReferral.countDocuments({ 
      gameMasterId: userId, 
      isActive: true 
    });
  } catch (error) {
    // Referral model may not exist
  }

  // Max drawdown: largest peak-to-trough decline in cumulative PnL, as % of peak (for badge thresholds like <= 10%)
  let maxDrawdown = 0;
  if (closedTrades.length > 0) {
    const byClose = [...closedTrades].sort(
      (a, b) => new Date(a.closedAt || 0).getTime() - new Date(b.closedAt || 0).getTime()
    );
    let running = 0;
    let peak = 0;
    let maxDrop = 0;
    for (const t of byClose) {
      running += t.realizedPnl || 0;
      peak = Math.max(peak, running);
      const drop = peak - running;
      if (drop > maxDrop) maxDrop = drop;
    }
    if (peak > 0 && maxDrop > 0) {
      maxDrawdown = Math.round((maxDrop / peak) * 100);
    }
  }

  return {
    userId,
    competitionsEntered: participations.length,
    completedCompetitions,
    completedCompetitionsWithTrades,
    firstPlaceFinishes,
    podiumFinishes,
    totalWins: firstPlaceFinishes,
    totalTrades,
    uniquePairsTraded: uniquePairs.size,
    totalPnl,
    winningTrades,
    losingTrades,
    winRate,
    averageRoi,
    profitFactor,
    bestSingleTrade,
    currentWinStreak,
    maxWinStreak,
    liquidationCount,
    maxDrawdown,
    alwaysUsesSL,
    alwaysUsesTP,
    averageTradesDuration: averageTradeDuration,
    totalDeposited,
    totalWithdrawn,
    withdrawalCount,
    kycVerified,
    accountAge,
    consecutiveTradingDays: consecutiveDays,
    weeklyTradingStreak: Math.floor(consecutiveDays / 7),
    monthlyTradingStreak: Math.floor(consecutiveDays / 30),
    averageTradeDuration,
    tradesUnder1Minute,
    tradesUnder5Minutes,
    tradesOver1Day,
    tradesOver7Days,
    tradesAtMarketOpen,
    tradesAtMarketClose,
    tradesAtLateNight,
    maxTradesInOneDay,
    maxTradesInOneWeek,
    maxTradesInOneMonth,
    comebackWins,
    wireToWireWins,
    perfectCompetitionTrades,
    averageLoss,
    averageWin,
    sharpeRatio,
    profitVolatility,
    averagePositionSize,
    uniqueStrategiesUsed,
    consecutiveProfitableDays,
    slTriggeredCount,
    tpTriggeredCount,
    globalRank,
    // Additional milestone condition fields
    secondPlaceFinishes,
    thirdPlaceFinishes,
    top10Finishes,
    top50PercentFinishes,
    competitionPnl,
    currentLevel,
    currentXP,
    xpEarnedToday: 0, // Would need to track this separately
    xpEarnedThisWeek: 0, // Would need to track this separately
    totalBadgesEarned,
    referralsMade,
    referralsActive,
    friendsAdded: 0, // Not implemented yet
    messagesSent: 0, // Not implemented yet
    loginStreak: consecutiveDays, // Use consecutive trading days as proxy
  };
}

/**
 * Check if a badge condition is met
 * NEW: Now properly validates minTrades and minCompletedCompetitions requirements
 */
export async function checkBadgeCondition(
  badge: Badge,
  stats: UserStats,
): Promise<boolean> {
  const { condition } = badge;
  const { type, value, comparison, minTrades, minCompletedCompetitions } = condition;

  // TIER SYSTEM: Rarity-based minimum activity requirements
  // Ensures badges can't be earned without demonstrated trading activity
  // Social/onboarding badges are EXEMPT - they have their own conditions
  const RARITY_MIN_REQUIREMENTS: Record<string, { trades: number; competitions: number }> = {
    common: { trades: 5, competitions: 0 },
    rare: { trades: 25, competitions: 1 },
    epic: { trades: 50, competitions: 3 },
    legendary: { trades: 100, competitions: 5 },
  };

  // Condition types that do NOT require minimum trading activity
  // These are social, onboarding, account-based, and referral badges
  const TRADE_EXEMPT_TYPES = new Set([
    "first_deposit", "has_deposit", "total_deposited", "total_deposits",
    "withdrawal_made", "total_withdrawals", "large_withdrawal",
    "net_profit_lifetime",
    "platform_age", "early_adopter", "account_age", "account_age_days",
    "account_created",
    "kyc_verified", "profile_complete",
    "referrals_made", "referrals_active",
    "friends_added", "login_streak",
    "competitions_entered", // Entry alone shouldn't require trades
    "first_trade", // Onboarding badge for first trade
  ]);

  const isTradeExempt = TRADE_EXEMPT_TYPES.has(type);

  const tierReqs = RARITY_MIN_REQUIREMENTS[badge.rarity] || { trades: 0, competitions: 0 };
  
  // Apply the STRICTER of: badge-specific minTrades OR rarity tier minimum
  // BUT skip rarity tier for trade-exempt badges (only use badge-specific if set)
  const effectiveMinTrades = isTradeExempt
    ? (minTrades || 0)
    : Math.max(minTrades || 0, tierReqs.trades);
  const effectiveMinComps = isTradeExempt
    ? (minCompletedCompetitions || 0)
    : Math.max(minCompletedCompetitions || 0, tierReqs.competitions);

  // CRITICAL: First check minimum requirements before evaluating the condition
  // This prevents "zero-baseline" badges from being awarded to new users
  // Trade-exempt badges skip this check (they validate their own conditions)
  
  // Check minimum trades requirement (uses stricter of badge-specific or tier)
  if (effectiveMinTrades > 0 && stats.totalTrades < effectiveMinTrades) {
    return false;
  }

  // Check minimum completed competitions requirement (uses stricter of badge-specific or tier)
  if (effectiveMinComps > 0 && stats.completedCompetitionsWithTrades < effectiveMinComps) {
    return false;
  }

  switch (type) {
    // Competition badges
    case "competitions_entered":
      return compareValue(stats.competitionsEntered, value, comparison);
    case "first_place_finishes":
      return compareValue(stats.firstPlaceFinishes, value, comparison);
    case "podium_finishes":
      return compareValue(stats.podiumFinishes, value, comparison);
    case "perfect_competition_win_rate":
      // Must have completed at least minCompletedCompetitions (default 3)
      return (
        stats.completedCompetitions >= (minCompletedCompetitions || 3) &&
        stats.firstPlaceFinishes === stats.competitionsEntered
      );

    // Trading volume
    case "total_trades":
      return compareValue(stats.totalTrades, value, comparison);
    case "unique_pairs_traded":
      return compareValue(stats.uniquePairsTraded, value, comparison);
    case "single_pair_focus":
      // Check if user has 100+ trades on their most traded pair
      return stats.totalTrades >= 100 && stats.uniquePairsTraded <= 3;

    // Profit badges
    case "winning_trades":
      return compareValue(stats.winningTrades, value, comparison);
    case "total_pnl_positive":
      // NEW: Require minimum trades before claiming "positive P&L"
      return stats.totalTrades >= (minTrades || 10) && stats.totalPnl > 0;
    case "total_pnl":
      return compareValue(stats.totalPnl, value, comparison);
    case "single_trade_profit":
      return compareValue(stats.bestSingleTrade, value, comparison);
    case "win_streak":
      return compareValue(stats.maxWinStreak, value, comparison);
    case "average_roi":
      return compareValue(stats.averageRoi, value, comparison);
    case "profit_factor":
      return compareValue(stats.profitFactor, value, comparison);
    case "win_rate":
      return compareValue(stats.winRate, value, comparison);
    case "drawdown_recovery":
      // User recovered from a losing streak to profitability
      return (
        stats.totalPnl > 0 && stats.losingTrades > 0 && stats.maxWinStreak >= 3
      );

    // RISK BADGES - CRITICAL FIX: Now require actual activity
    case "no_liquidations":
      // FIXED: Must complete at least 1 competition with 5+ trades to earn "Survivor"
      return (
        stats.completedCompetitionsWithTrades >= (minCompletedCompetitions || 1) &&
        stats.totalTrades >= (minTrades || 5) &&
        stats.liquidationCount === 0
      );
    case "zero_liquidations_lifetime":
      // FIXED: Must complete 10+ competitions with 50+ total trades
      return (
        stats.completedCompetitionsWithTrades >= (minCompletedCompetitions || 10) &&
        stats.totalTrades >= (minTrades || 50) &&
        stats.liquidationCount === 0
      );
    case "always_uses_sl":
      // Must always use SL + have sufficient trades + at least 3 SL actually triggered (proves they work)
      return stats.alwaysUsesSL && stats.totalTrades >= (minTrades || 50) && (stats.slTriggeredCount || 0) >= 3;
    case "always_uses_tp":
      // Must always use TP + have sufficient trades + at least 3 TP actually triggered
      return stats.alwaysUsesTP && stats.totalTrades >= (minTrades || 50) && (stats.tpTriggeredCount || 0) >= 3;

    // Social badges
    case "first_deposit":
      return stats.totalDeposited > 0;
    case "total_deposited":
      return compareValue(stats.totalDeposited, value, comparison);
    case "withdrawal_made":
      return stats.totalWithdrawn > 0;
    case "total_withdrawals":
      return compareValue(stats.withdrawalCount, value, comparison);
    case "large_withdrawal":
      return stats.totalWithdrawn >= 500;
    case "net_profit_lifetime":
      return (
        stats.totalWithdrawn > stats.totalDeposited && stats.totalDeposited > 0
      );
    case "platform_age":
      return compareValue(stats.accountAge, value, comparison);
    case "early_adopter":
      return stats.accountAge >= 30; // Example: 30 days

    // Global rank
    case "global_rank":
      return compareValue(stats.globalRank, value, comparison);

    // Legendary badges
    case "undefeated_in_comps":
      return (
        stats.completedCompetitionsWithTrades >= (minCompletedCompetitions || 10) &&
        stats.firstPlaceFinishes === stats.competitionsEntered
      );
    case "all_legendary_badges":
      // Check if user has earned at least 8 of the 10 legendary badges
      return (
        stats.competitionsEntered >= 50 &&
        stats.firstPlaceFinishes >= 20 &&
        stats.totalPnl >= 50000
      );

    // Risk management (advanced)
    case "max_drawdown":
      // FIXED: Require minimum trades to prevent zero-baseline awards
      // User must have at least 20 trades to claim "controlled risk"
      return stats.totalTrades >= (minTrades || 20) && 
             stats.completedCompetitionsWithTrades >= 1 &&
             compareValue(stats.maxDrawdown, value, comparison);
    case "average_leverage_low":
      return stats.totalTrades >= (minTrades || 20) && stats.averagePositionSize <= 1; // Conservative sizing
    case "average_loss_small":
      return (
        stats.averageLoss > 0 &&
        stats.averageLoss < 50 &&
        stats.totalTrades >= (minTrades || 30)
      );
    case "risk_discipline":
      return (
        stats.alwaysUsesSL &&
        stats.alwaysUsesTP &&
        stats.liquidationCount === 0 &&
        stats.totalTrades >= (minTrades || 50) &&
        stats.completedCompetitionsWithTrades >= (minCompletedCompetitions || 5)
      );
    case "sharpe_ratio_high":
      return stats.sharpeRatio >= 2 && stats.totalTrades >= (minTrades || 50);
    case "low_volatility":
      return (
        stats.profitVolatility < 100 &&
        stats.totalTrades >= (minTrades || 50) &&
        stats.winRate >= 55
      );
    case "optimal_position_sizing":
      return (
        stats.averagePositionSize > 0 &&
        stats.averagePositionSize <= 2 &&
        stats.liquidationCount === 0 &&
        stats.totalTrades >= (minTrades || 30)
      );
    case "strategy_diversity":
      return stats.uniqueStrategiesUsed >= 5 && stats.totalTrades >= (minTrades || 50);
    case "balanced_risk_reward":
      return (
        stats.profitFactor >= 1.5 && stats.winRate >= 45 && stats.winRate <= 60
      );
    case "low_return_variance":
      return (
        stats.profitVolatility < 150 &&
        stats.totalTrades >= (minTrades || 50) &&
        stats.winRate >= 50
      );
    case "predictable_results":
      return (
        stats.profitVolatility < 100 &&
        stats.totalTrades >= (minTrades || 75) &&
        stats.winRate >= 55
      );
    case "exceptional_dd_control":
      // Require completed competitions to prevent zero-baseline
      return stats.maxDrawdown <= 5 && 
             stats.totalTrades >= (minTrades || 50) &&
             stats.completedCompetitionsWithTrades >= 3;
    case "hedging_strategy":
      // Simplified: User has multiple positions and good risk management
      return stats.totalTrades >= (minTrades || 30) && stats.alwaysUsesSL && stats.uniquePairsTraded >= 3;

    // Strategy detection (simplified)
    case "trend_following":
      return stats.totalTrades >= (minTrades || 30) && stats.winRate >= 50;
    case "counter_trend":
      return stats.totalTrades >= (minTrades || 40) && stats.winRate >= 45;
    case "breakout_trading":
      return stats.bestSingleTrade >= 300 && stats.totalTrades >= (minTrades || 30);
    case "range_trading":
      return stats.totalTrades >= (minTrades || 40) && stats.winRate >= 55;
    case "momentum_trading":
      return stats.maxWinStreak >= 5 && stats.totalTrades >= (minTrades || 35);
    case "mean_reversion":
      return stats.totalTrades >= (minTrades || 40) && stats.winRate >= 50;
    case "multiple_strategies":
      return stats.uniquePairsTraded >= 5 && stats.totalTrades >= (minTrades || 100);
    case "technical_analysis":
      return stats.totalTrades >= (minTrades || 50) && stats.alwaysUsesTP;
    case "unique_strategy":
      return stats.profitFactor >= 3 && stats.uniquePairsTraded >= 8;
    case "news_trading":
      return stats.tradesAtMarketOpen >= 10 && stats.totalTrades >= (minTrades || 40);
    case "versatile":
      return stats.uniquePairsTraded >= 5 && stats.totalTrades >= (minTrades || 100);

    // Speed & Execution badges
    case "fast_order_execution":
      return stats.totalTrades >= (minTrades || 20) && stats.tradesUnder5Minutes >= 10;
    case "ultra_fast_execution":
      return stats.tradesUnder1Minute >= 5;
    case "quick_scalps":
      return stats.tradesUnder5Minutes >= (minTrades || 50);
    case "closes_all_daily":
      return stats.tradesOver1Day === 0 && stats.totalTrades >= (minTrades || 30);
    case "swing_trading_style":
      return stats.tradesOver1Day >= (minTrades || 15);
    case "position_trading_style":
      return stats.tradesOver7Days >= (minTrades || 10);
    case "precise_entry_timing":
      return stats.winRate >= 70 && stats.totalTrades >= (minTrades || 40);
    case "ninja_trading":
      return stats.tradesUnder5Minutes >= 20 && stats.winRate >= 60;
    case "patient_trading":
      return stats.averageTradeDuration >= 60 && stats.winRate >= 55; // 60+ minutes
    case "trades_at_open":
      return stats.tradesAtMarketOpen >= (minTrades || 20);
    case "trades_at_close":
      return stats.tradesAtMarketClose >= (minTrades || 20);
    case "trades_all_hours":
      return stats.totalTrades >= (minTrades || 100) && stats.uniquePairsTraded >= 5;

    // Time-based trading volume
    case "daily_trade_volume":
      return compareValue(stats.maxTradesInOneDay, value, comparison);
    case "single_day_trades":
      return compareValue(stats.maxTradesInOneDay, value, comparison);
    case "weekly_trade_volume":
      return compareValue(stats.maxTradesInOneWeek, value, comparison);
    case "monthly_trade_volume":
      return compareValue(stats.maxTradesInOneMonth, value, comparison);

    // Consistency badges
    case "daily_trading_streak":
      return compareValue(stats.consecutiveTradingDays, value, comparison);
    case "weekly_trading_streak":
      return compareValue(stats.weeklyTradingStreak, value, comparison);
    case "monthly_trading_streak":
      return compareValue(stats.monthlyTradingStreak, value, comparison);
    case "consecutive_profitable_days":
      return stats.consecutiveProfitableDays >= (value || 7);
    case "perfect_attendance":
      return stats.consecutiveTradingDays >= 90 && stats.totalTrades >= (minTrades || 200);

    // Advanced competition badges
    case "comeback_victory":
      return stats.comebackWins >= 1;
    case "wire_to_wire_win":
      return stats.wireToWireWins >= 1;
    case "beat_top_trader":
      return stats.firstPlaceFinishes >= 1 && stats.competitionsEntered >= 5;
    case "underdog_win":
      return stats.firstPlaceFinishes >= 1 && stats.averageRoi < 50;
    case "perfect_competition_trades":
      // FIXED: Require 10+ trades in a competition with 100% win rate
      return stats.perfectCompetitionTrades >= 1 && stats.completedCompetitionsWithTrades >= 1;
    case "survived_full_competition":
      // FIXED: Must complete at least 1 competition with 10+ trades
      return (
        stats.completedCompetitionsWithTrades >= (minCompletedCompetitions || 1) &&
        stats.totalTrades >= (minTrades || 10) &&
        stats.liquidationCount === 0
      );
    case "first_trade_in_comp":
      return stats.totalTrades >= 1 && stats.competitionsEntered >= 1;
    
    // FIXED: Late night trader now checks actual late-night trade count
    case "late_night_trader":
      return stats.tradesAtLateNight >= (minTrades || 20);

    // Legendary badges
    case "perfect_month":
      return (
        stats.consecutiveTradingDays >= 30 &&
        stats.winRate >= 90 &&
        stats.totalTrades >= (minTrades || 100)
      );
    case "epic_comeback":
      return stats.comebackWins >= 3 && stats.totalPnl >= 5000;
    case "perfect_year":
      return (
        stats.consecutiveTradingDays >= 365 &&
        stats.totalPnl > 0 &&
        stats.winRate >= 55
      );
    case "hall_of_fame_status":
      return (
        stats.firstPlaceFinishes >= 20 &&
        stats.totalPnl >= 50000 &&
        stats.competitionsEntered >= (minCompletedCompetitions || 50)
      );

    // ============================================
    // MILESTONE CONDITION TYPES - Unified with Journey Map
    // These allow creating badges with same conditions as milestones
    // ============================================
    
    // Account & Setup
    case "account_created":
      return true; // Always true if user exists
    case "has_deposit":
      return stats.totalDeposited > 0;
    case "kyc_verified":
      return stats.kycVerified === true;
    case "profile_complete":
      return stats.totalDeposited > 0; // Has activity = profile complete
    case "total_deposits":
      return compareValue(stats.totalDeposited, value, comparison);
    case "first_trade":
      return stats.totalTrades >= 1;
    case "losing_trades":
      return compareValue(stats.losingTrades, value, comparison);
    
    // Trading Activity - Time Based
    case "trades_today":
      return compareValue(stats.maxTradesInOneDay, value, comparison);
    case "trades_this_week":
      return compareValue(stats.maxTradesInOneWeek, value, comparison);
    case "trades_this_month":
      return compareValue(stats.maxTradesInOneMonth, value, comparison);
    case "different_assets_traded":
      return compareValue(stats.uniquePairsTraded, value, comparison);
    
    // Performance - Additional
    case "max_win_streak":
      return compareValue(stats.maxWinStreak, value, comparison);
    case "best_trade_pnl":
    case "best_single_trade":
      return compareValue(stats.bestSingleTrade, value, comparison);
    case "average_trade_pnl":
    case "average_win":
      return compareValue(stats.averageWin, value, comparison);
    case "risk_reward_ratio":
      const riskReward = stats.averageLoss > 0 ? (stats.averageWin || 0) / stats.averageLoss : 0;
      return compareValue(riskReward, value, comparison);
    
    // Competitions - Additional Placements
    case "competitions_completed":
      return compareValue(stats.completedCompetitions, value, comparison);
    case "second_place_finishes":
      return compareValue(stats.secondPlaceFinishes, value, comparison);
    case "third_place_finishes":
      return compareValue(stats.thirdPlaceFinishes, value, comparison);
    case "top_10_finishes":
      return compareValue(stats.top10Finishes, value, comparison);
    case "top_50_percent_finishes":
      return compareValue(stats.top50PercentFinishes, value, comparison);
    case "competition_pnl":
      return compareValue(stats.competitionPnl, value, comparison);
    
    // Progression & XP
    case "level_reached":
      return compareValue(stats.currentLevel, value, comparison);
    case "xp_threshold":
      return compareValue(stats.currentXP, value, comparison);
    case "xp_earned_today":
      return compareValue(stats.xpEarnedToday, value, comparison);
    case "xp_earned_this_week":
      return compareValue(stats.xpEarnedThisWeek, value, comparison);
    case "total_badges":
      return compareValue(stats.totalBadgesEarned, value, comparison);
    
    // Social & Community
    case "referrals_made":
      return compareValue(stats.referralsMade, value, comparison);
    case "referrals_active":
      return compareValue(stats.referralsActive, value, comparison);
    case "friends_added":
      return compareValue(stats.friendsAdded, value, comparison);
    case "messages_sent":
      return compareValue(stats.messagesSent, value, comparison);
    
    // Risk Management - Additional
    case "stop_loss_used":
      return stats.alwaysUsesSL && stats.totalTrades >= (minTrades || 10);
    case "take_profit_used":
      return stats.alwaysUsesTP && stats.totalTrades >= (minTrades || 10);
    case "max_drawdown_under":
      return stats.totalTrades >= (minTrades || 10) && stats.maxDrawdown <= (value || 50);
    case "position_size_under":
      return stats.totalTrades >= (minTrades || 10) && stats.averagePositionSize <= (value || 10);
    
    // Time-based - Additional
    case "account_age_days":
    case "account_age":
      return compareValue(stats.accountAge, value, comparison);
    case "active_days":
    case "active_trading_days":
      return compareValue(stats.consecutiveTradingDays, value, comparison);
    case "login_streak":
      return compareValue(stats.loginStreak || stats.consecutiveTradingDays, value, comparison);

    // Default: false for unimplemented conditions
    default:
      return false;
  }
}

/**
 * Helper function to compare values.
 * Production-safe: defaults comparison to "gte" when missing (e.g. from DB),
 * and treats NaN as failure so bad stats don't award badges.
 */
function compareValue(
  actual: number | undefined,
  expected: number | undefined,
  comparison: "gte" | "lte" | "eq" | undefined,
): boolean {
  if (actual === undefined || expected === undefined) return false;
  if (Number.isNaN(actual) || Number.isNaN(expected)) return false;

  const comp = comparison ?? "gte";

  switch (comp) {
    case "gte":
      return actual >= expected;
    case "lte":
      return actual <= expected;
    case "eq":
      return actual === expected;
    default:
      return actual >= expected;
  }
}

/**
 * Get user badges with progress
 */
export async function getUserBadges(userId: string) {
  await connectToDatabase();

  // Fetch badges from database (already cleaned of MongoDB fields)
  const badges = await getBadgesFromDB();
  const earnedBadges = await UserBadge.find({ userId }).lean();
  const earnedBadgeIds = new Set(earnedBadges.map((b) => b.badgeId));

  // Add earned status to badges
  return badges.map((badge) => ({
    ...badge,
    earned: earnedBadgeIds.has(badge.id),
    earnedAt:
      earnedBadges.find((b) => b.badgeId === badge.id)?.earnedAt ?? undefined,
  }));
}
