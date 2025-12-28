'use server';

import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import Challenge from '@/database/models/trading/challenge.model';
import TradeHistory from '@/database/models/trading/trade-history.model';

/**
 * Unified User Stats Service
 * 
 * This service provides a SINGLE SOURCE OF TRUTH for all user statistics.
 * Both Dashboard and Profile pages MUST use this service to ensure consistency.
 * 
 * Source of Truth:
 * - Financial stats (balance, prizes, deposits, withdrawals) → CreditWallet model
 * - Trading metrics (trades, PnL, win rate) → CompetitionParticipant + ChallengeParticipant
 * - Participation counts → Participation records
 */

export interface UnifiedUserStats {
  // === FINANCIAL STATS (from CreditWallet - source of truth) ===
  wallet: {
    currentBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    // Competition financials
    totalSpentOnCompetitions: number;
    totalWonFromCompetitions: number;
    netProfitFromCompetitions: number;
    // Challenge financials
    totalSpentOnChallenges: number;
    totalWonFromChallenges: number;
    netProfitFromChallenges: number;
    // Marketplace
    totalSpentOnMarketplace: number;
    // Combined totals
    totalPrizesWon: number; // competitions + challenges
    overallROI: number;
    // Account status
    kycVerified: boolean;
    withdrawalEnabled: boolean;
  };

  // === COMPETITION STATS (from CompetitionParticipant) ===
  competitions: {
    // Counts
    totalEntered: number;
    totalActive: number;
    totalCompleted: number;
    // Performance wins
    totalWon: number; // Rank 1 finishes
    podiumFinishes: number; // Top 3 finishes
    // Aggregate trading metrics
    totalCapitalTraded: number;
    totalPnL: number;
    totalPnLPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    // Best performances
    bestRank: number;
    bestPnL: number;
    bestROI: number;
    bestWinRate: number;
    mostTrades: number;
  };

  // === CHALLENGE STATS (from ChallengeParticipant + Challenge) ===
  challenges: {
    // Counts
    totalEntered: number;
    totalActive: number;
    totalCompleted: number;
    // Results
    totalWon: number;
    totalLost: number;
    totalTied: number;
    challengeWinRate: number;
    // Aggregate trading metrics
    totalPnL: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    tradeWinRate: number;
    // Best performances
    bestPnL: number;
    bestROI: number;
    mostTrades: number;
  };

  // === COMBINED OVERVIEW (for dashboard) ===
  overview: {
    totalCapital: number; // Only from ACTIVE contests
    totalPnL: number;
    totalPnLPercentage: number;
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
    totalPrizesWon: number; // FROM WALLET (source of truth)
  };

  // === STREAKS ===
  streaks: {
    currentWinStreak: number;
    currentLossStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
    tradingDaysThisMonth: number;
    consecutiveProfitableDays: number;
  };
}

/**
 * Get unified user statistics from single sources of truth
 * This should be used by BOTH dashboard and profile pages
 */
export async function getUnifiedUserStats(userId: string): Promise<UnifiedUserStats> {
  await connectToDatabase();

  // Parallel fetch all data from their respective sources of truth
  const [
    wallet,
    competitionParticipations,
    challengeParticipations,
    challenges,
    recentTrades,
  ] = await Promise.all([
    // Financial source of truth
    CreditWallet.findOne({ userId }).lean(),
    // Competition metrics source
    CompetitionParticipant.find({ userId }).lean(),
    // Challenge metrics source
    ChallengeParticipant.find({ userId }).lean(),
    // Challenge status/results
    Challenge.find({ $or: [{ challengerId: userId }, { challengedId: userId }] }).lean(),
    // For streaks calculation
    TradeHistory.find({ userId }).sort({ closedAt: -1 }).limit(500).lean(),
  ]);

  // === BUILD WALLET STATS (Source of Truth for Financials) ===
  const walletStats = buildWalletStats(wallet);

  // === BUILD COMPETITION STATS ===
  const competitionStats = buildCompetitionStats(competitionParticipations as any[]);

  // === BUILD CHALLENGE STATS ===
  const challengeStats = buildChallengeStats(
    userId,
    challengeParticipations as any[],
    challenges as any[]
  );

  // === BUILD OVERVIEW (Combined) ===
  const overview = buildOverview(
    competitionParticipations as any[],
    challengeParticipations as any[],
    walletStats.totalPrizesWon // Use wallet as source of truth for prizes!
  );

  // === CALCULATE STREAKS ===
  const streaks = calculateStreaks(recentTrades as any[]);

  return {
    wallet: walletStats,
    competitions: competitionStats,
    challenges: challengeStats,
    overview,
    streaks,
  };
}

/**
 * Build wallet stats from CreditWallet (financial source of truth)
 */
function buildWalletStats(wallet: any) {
  if (!wallet) {
    return {
      currentBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalSpentOnCompetitions: 0,
      totalWonFromCompetitions: 0,
      netProfitFromCompetitions: 0,
      totalSpentOnChallenges: 0,
      totalWonFromChallenges: 0,
      netProfitFromChallenges: 0,
      totalSpentOnMarketplace: 0,
      totalPrizesWon: 0,
      overallROI: 0,
      kycVerified: false,
      withdrawalEnabled: false,
    };
  }

  const totalWonFromCompetitions = wallet.totalWonFromCompetitions || 0;
  const totalWonFromChallenges = wallet.totalWonFromChallenges || 0;
  const totalSpentOnCompetitions = wallet.totalSpentOnCompetitions || 0;
  const totalSpentOnChallenges = wallet.totalSpentOnChallenges || 0;

  const netProfitFromCompetitions = totalWonFromCompetitions - totalSpentOnCompetitions;
  const netProfitFromChallenges = totalWonFromChallenges - totalSpentOnChallenges;
  const totalSpent = totalSpentOnCompetitions + totalSpentOnChallenges;
  const totalWon = totalWonFromCompetitions + totalWonFromChallenges;

  const overallROI = totalSpent > 0 
    ? ((totalWon - totalSpent) / totalSpent) * 100 
    : 0;

  return {
    currentBalance: wallet.creditBalance || 0,
    totalDeposited: wallet.totalDeposited || 0,
    totalWithdrawn: wallet.totalWithdrawn || 0,
    totalSpentOnCompetitions,
    totalWonFromCompetitions,
    netProfitFromCompetitions,
    totalSpentOnChallenges,
    totalWonFromChallenges,
    netProfitFromChallenges,
    totalSpentOnMarketplace: wallet.totalSpentOnMarketplace || 0,
    totalPrizesWon: totalWon, // This is the SOURCE OF TRUTH for prizes
    overallROI,
    kycVerified: wallet.kycVerified || false,
    withdrawalEnabled: wallet.withdrawalEnabled ?? true,
  };
}

/**
 * Build competition stats from CompetitionParticipant records
 */
function buildCompetitionStats(participations: any[]) {
  const completed = participations.filter(p => p.status === 'completed');
  const active = participations.filter(p => p.status === 'active');

  // Aggregate metrics
  let totalCapitalTraded = 0;
  let totalPnL = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalROI = 0;
  let totalGross = 0;
  let totalLoss = 0;

  // Best performances
  let bestRank = Number.MAX_SAFE_INTEGER;
  let bestPnL = 0;
  let bestROI = 0;
  let bestWinRate = 0;
  let mostTrades = 0;

  // Count wins
  let totalWon = 0;
  let podiumFinishes = 0;

  for (const p of participations) {
    totalCapitalTraded += p.startingCapital || 0;
    totalPnL += p.pnl || 0;
    totalTrades += p.totalTrades || 0;
    winningTrades += p.winningTrades || 0;
    losingTrades += p.losingTrades || 0;
    totalROI += p.pnlPercentage || 0;

    // For profit factor
    if (p.averageWin && p.winningTrades) {
      totalGross += p.averageWin * p.winningTrades;
    }
    if (p.averageLoss && p.losingTrades) {
      totalLoss += Math.abs(p.averageLoss) * p.losingTrades;
    }

    // Best performances
    if (p.currentRank && p.currentRank < bestRank) bestRank = p.currentRank;
    if ((p.pnl || 0) > bestPnL) bestPnL = p.pnl || 0;
    if ((p.pnlPercentage || 0) > bestROI) bestROI = p.pnlPercentage || 0;

    const winRate = p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0;
    if (winRate > bestWinRate) bestWinRate = winRate;
    if ((p.totalTrades || 0) > mostTrades) mostTrades = p.totalTrades || 0;

    // Count wins and podiums
    if (p.currentRank === 1) totalWon++;
    if (p.currentRank && p.currentRank <= 3) podiumFinishes++;
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalGross / totalLoss : (totalGross > 0 ? 9999 : 0);
  const totalPnLPercentage = totalCapitalTraded > 0 ? (totalPnL / totalCapitalTraded) * 100 : 0;

  return {
    totalEntered: participations.length,
    totalActive: active.length,
    totalCompleted: completed.length,
    totalWon,
    podiumFinishes,
    totalCapitalTraded,
    totalPnL,
    totalPnLPercentage,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    bestRank: bestRank === Number.MAX_SAFE_INTEGER ? 0 : bestRank,
    bestPnL,
    bestROI,
    bestWinRate,
    mostTrades,
  };
}

/**
 * Build challenge stats from ChallengeParticipant and Challenge records
 */
function buildChallengeStats(
  userId: string,
  participations: any[],
  challenges: any[]
) {
  const completed = challenges.filter(c => c.status === 'completed');
  const active = challenges.filter(c => c.status === 'active');

  let totalWon = 0;
  let totalLost = 0;
  let totalTied = 0;
  let totalPnL = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let bestPnL = 0;
  let bestROI = 0;
  let mostTrades = 0;

  // Aggregate from participations
  for (const p of participations) {
    totalPnL += p.pnl || 0;
    totalTrades += p.totalTrades || 0;
    winningTrades += p.winningTrades || 0;
    losingTrades += p.losingTrades || 0;

    if ((p.pnl || 0) > bestPnL) bestPnL = p.pnl || 0;
    if ((p.pnlPercentage || 0) > bestROI) bestROI = p.pnlPercentage || 0;
    if ((p.totalTrades || 0) > mostTrades) mostTrades = p.totalTrades || 0;

    if (p.isWinner) totalWon++;
  }

  // Count losses and ties from challenges
  for (const c of completed) {
    if (c.isTie) {
      totalTied++;
    } else if (c.winnerId !== userId && 
               (c.challengerId === userId || c.challengedId === userId)) {
      // If user is a participant but not the winner, they lost
      // Only count if not already counted as winner in participations
      const isChallenger = c.challengerId === userId;
      const isChallenged = c.challengedId === userId;
      if ((isChallenger || isChallenged) && c.winnerId !== userId) {
        totalLost++;
      }
    }
  }

  const tradeWinRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalChallengeGames = totalWon + totalLost;
  const challengeWinRate = totalChallengeGames > 0 ? (totalWon / totalChallengeGames) * 100 : 0;

  return {
    totalEntered: challenges.length,
    totalActive: active.length,
    totalCompleted: completed.length,
    totalWon,
    totalLost,
    totalTied,
    challengeWinRate,
    totalPnL,
    totalTrades,
    winningTrades,
    losingTrades,
    tradeWinRate,
    bestPnL,
    bestROI,
    mostTrades,
  };
}

/**
 * Build combined overview stats (for dashboard)
 */
function buildOverview(
  competitionParticipations: any[],
  challengeParticipations: any[],
  totalPrizesWonFromWallet: number // Use wallet as source of truth!
) {
  const allParticipations = [...competitionParticipations, ...challengeParticipations];
  
  // Count active contests
  const activeCompetitions = competitionParticipations.filter(p => p.status === 'active');
  const activeChallenges = challengeParticipations.filter(p => p.status === 'active');
  
  // Total capital from ACTIVE contests only
  let totalCapital = 0;
  for (const p of [...activeCompetitions, ...activeChallenges]) {
    totalCapital += p.currentCapital || 0;
  }

  // All-time stats from ALL participations
  let totalPnL = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalGrossWins = 0;
  let totalGrossLosses = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalStartingCapital = 0;

  for (const p of allParticipations) {
    totalPnL += p.pnl || 0;
    totalTrades += p.totalTrades || 0;
    winningTrades += p.winningTrades || 0;
    losingTrades += p.losingTrades || 0;
    totalStartingCapital += p.startingCapital || 0;

    if (p.averageWin && p.winningTrades) {
      totalGrossWins += p.averageWin * p.winningTrades;
    }
    if (p.averageLoss && p.losingTrades) {
      totalGrossLosses += Math.abs(p.averageLoss) * p.losingTrades;
    }
    if (p.largestWin && p.largestWin > largestWin) largestWin = p.largestWin;
    if (p.largestLoss && p.largestLoss < largestLoss) largestLoss = p.largestLoss;
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor = totalGrossLosses > 0 
    ? totalGrossWins / totalGrossLosses 
    : (totalGrossWins > 0 ? 999 : 0);
  const averageWin = winningTrades > 0 ? totalGrossWins / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalGrossLosses / losingTrades : 0;
  const totalPnLPercentage = totalStartingCapital > 0 
    ? (totalPnL / totalStartingCapital) * 100 
    : 0;

  return {
    totalCapital,
    totalPnL,
    totalPnLPercentage,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    activeContests: activeCompetitions.length + activeChallenges.length,
    totalPrizesWon: totalPrizesWonFromWallet, // FROM WALLET - SOURCE OF TRUTH
  };
}

/**
 * Calculate trading streaks from trade history
 */
function calculateStreaks(trades: any[]) {
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
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
      if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
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
      .map((t: any) => new Date(t.closedAt).toDateString())
  );

  // Consecutive profitable days
  const dayPnLMap = new Map<string, number>();
  for (const trade of trades) {
    const day = new Date(trade.closedAt).toDateString();
    dayPnLMap.set(day, (dayPnLMap.get(day) || 0) + (trade.realizedPnl || 0));
  }

  let consecutiveProfitableDays = 0;
  const sortedDays = Array.from(dayPnLMap.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

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

