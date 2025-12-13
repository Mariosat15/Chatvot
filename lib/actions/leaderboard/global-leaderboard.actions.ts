'use server';

import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import UserBadge from '@/database/models/user-badge.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getAllUsers } from '@/lib/utils/user-lookup';

export interface GlobalLeaderboardEntry {
  userId: string;
  email: string; // Primary identifier for traders
  username: string; // Display name (for reference only)
  rank: number;
  isTied?: boolean;
  tiedWith?: string[];
  
  // Title
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  
  // Overall stats
  totalPnl: number;
  totalPnlPercentage: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  
  // Competition stats
  competitionsEntered: number;
  competitionsWon: number;
  podiumFinishes: number;
  
  // Challenge stats
  challengesEntered?: number;
  challengesWon?: number;
  
  // Badges
  totalBadges: number;
  legendaryBadges: number;
  
  // Score (for ranking)
  overallScore: number;
}

/**
 * Get global leaderboard - ranks ALL users (including those without competition/challenge history)
 */
export async function getGlobalLeaderboard(limit: number = 0): Promise<GlobalLeaderboardEntry[]> {
  await connectToDatabase();

  try {
    // First, get ALL users from the database
    const allUsers = await getAllUsers();
    
    // Get all competition participants
    const allCompetitionParticipants = await CompetitionParticipant.find({}).lean();
    
    // Get all challenge participants
    const allChallengeParticipants = await ChallengeParticipant.find({}).lean();
    
    // Group by userId - start with all users (even those with no history)
    // Users are identified by EMAIL (role-based filtering already done in getAllUsers)
    const userStatsMap = new Map<string, {
      userId: string;
      email: string;
      username: string;
      totalPnl: number;
      totalCapital: number;
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      competitionsEntered: number;
      competitionsWon: number;
      podiumFinishes: number;
      challengesEntered: number;
      challengesWon: number;
      grossProfit: number;
      grossLoss: number;
    }>();

    // Initialize all users with zero stats
    // Only traders are returned by getAllUsers (filtered by role field)
    for (const user of allUsers) {
      if (!user.id || !user.email) continue;
      
      userStatsMap.set(user.id, {
        userId: user.id,
        email: user.email, // Primary identifier
        username: user.name || user.email.split('@')[0] || 'Unknown', // Display name
        totalPnl: 0,
        totalCapital: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        competitionsEntered: 0,
        competitionsWon: 0,
        podiumFinishes: 0,
        challengesEntered: 0,
        challengesWon: 0,
        grossProfit: 0,
        grossLoss: 0,
      });
    }

    // Add competition stats
    for (const participant of allCompetitionParticipants) {
      const userId = participant.userId;
      
      // Skip if user is not in our trader list (they might be admin or deleted)
      if (!userStatsMap.has(userId)) {
        // Only add if they have valid data - but since they're from competitions,
        // they should already be in our map if they're traders
        continue;
      }

      const userStats = userStatsMap.get(userId)!;
      userStats.totalPnl += participant.pnl || 0;
      userStats.totalCapital += participant.startingCapital || 0;
      userStats.totalTrades += participant.totalTrades || 0;
      userStats.winningTrades += participant.winningTrades || 0;
      userStats.losingTrades += participant.losingTrades || 0;
      userStats.competitionsEntered += 1;
      
      if (participant.currentRank === 1) {
        userStats.competitionsWon += 1;
      }
      if (participant.currentRank && participant.currentRank <= 3) {
        userStats.podiumFinishes += 1;
      }

      // Calculate profit/loss for profit factor
      const pnl = participant.pnl || 0;
      if (pnl > 0) {
        userStats.grossProfit += pnl;
      } else {
        userStats.grossLoss += Math.abs(pnl);
      }
    }

    // Add challenge stats
    for (const participant of allChallengeParticipants) {
      const userId = participant.userId;
      
      // Skip if user is not in our trader list (they might be admin or deleted)
      if (!userStatsMap.has(userId)) {
        continue;
      }

      const userStats = userStatsMap.get(userId)!;
      userStats.totalPnl += participant.pnl || 0;
      userStats.totalCapital += participant.startingCapital || 0;
      userStats.totalTrades += participant.totalTrades || 0;
      userStats.winningTrades += participant.winningTrades || 0;
      userStats.losingTrades += participant.losingTrades || 0;
      userStats.challengesEntered += 1;
      
      if (participant.isWinner) {
        userStats.challengesWon += 1;
      }

      // Calculate profit/loss for profit factor
      const pnl = participant.pnl || 0;
      if (pnl > 0) {
        userStats.grossProfit += pnl;
      } else {
        userStats.grossLoss += Math.abs(pnl);
      }
    }

    // Get badge counts for each user
    const allUserBadges = await UserBadge.find({}).lean();
    const badgeCounts = new Map<string, { total: number; legendary: number }>();
    
    for (const userBadge of allUserBadges) {
      if (!badgeCounts.has(userBadge.userId)) {
        badgeCounts.set(userBadge.userId, { total: 0, legendary: 0 });
      }
      const counts = badgeCounts.get(userBadge.userId)!;
      counts.total += 1;
      
      // Check if legendary (simplified check - you can import BADGES to check rarity)
      if (userBadge.badgeId.startsWith('legend_')) {
        counts.legendary += 1;
      }
    }

    // Convert to leaderboard entries
    const leaderboardEntries: GlobalLeaderboardEntry[] = [];

    for (const [userId, stats] of userStatsMap.entries()) {
      const winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0;
      const profitFactor = stats.grossLoss > 0 ? stats.grossProfit / stats.grossLoss : 0;
      const totalPnlPercentage = stats.totalCapital > 0 ? (stats.totalPnl / stats.totalCapital) * 100 : 0;

      const badges = badgeCounts.get(userId) || { total: 0, legendary: 0 };

      // Calculate overall score (weighted formula)
      const overallScore = calculateOverallScore({
        totalPnl: stats.totalPnl,
        totalPnlPercentage,
        winRate,
        profitFactor,
        competitionsWon: stats.competitionsWon,
        podiumFinishes: stats.podiumFinishes,
        challengesWon: stats.challengesWon,
        totalBadges: badges.total,
        legendaryBadges: badges.legendary,
      });

      leaderboardEntries.push({
        userId,
        email: stats.email, // Primary identifier for traders
        username: stats.username, // Display name (for reference only)
        rank: 0, // Will be assigned after sorting
        totalPnl: stats.totalPnl,
        totalPnlPercentage,
        totalTrades: stats.totalTrades,
        winRate,
        profitFactor,
        competitionsEntered: stats.competitionsEntered,
        competitionsWon: stats.competitionsWon,
        podiumFinishes: stats.podiumFinishes,
        challengesEntered: stats.challengesEntered,
        challengesWon: stats.challengesWon,
        totalBadges: badges.total,
        legendaryBadges: badges.legendary,
        overallScore,
      });
    }

    // Sort by overall score (descending)
    leaderboardEntries.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks with tie detection
    const epsilon = 0.0001; // For floating point comparison
    for (let i = 0; i < leaderboardEntries.length; i++) {
      const current = leaderboardEntries[i];
      
      if (i === 0) {
        // First entry
        current.rank = 1;
        current.isTied = false;
      } else {
        const previous = leaderboardEntries[i - 1];
        
        // Check if tied with previous (same overall score)
        const isTied = Math.abs(current.overallScore - previous.overallScore) < epsilon;
        
        if (isTied) {
          // Same rank as previous
          current.rank = previous.rank;
          current.isTied = true;
          previous.isTied = true;
          
          // Track who they're tied with
          if (!current.tiedWith) current.tiedWith = [];
          if (!previous.tiedWith) previous.tiedWith = [];
          
          current.tiedWith.push(previous.userId);
          previous.tiedWith.push(current.userId);
          
          // Also link to all previously tied users at this rank
          for (let j = i - 2; j >= 0; j--) {
            if (leaderboardEntries[j].rank === current.rank && leaderboardEntries[j].isTied) {
              if (!leaderboardEntries[j].tiedWith) leaderboardEntries[j].tiedWith = [];
              if (!current.tiedWith.includes(leaderboardEntries[j].userId)) {
                current.tiedWith.push(leaderboardEntries[j].userId);
              }
              if (!leaderboardEntries[j].tiedWith.includes(current.userId)) {
                leaderboardEntries[j].tiedWith.push(current.userId);
              }
            } else {
              break;
            }
          }
        } else {
          // Not tied - rank is position + 1 (accounting for ties)
          current.rank = i + 1;
          current.isTied = false;
        }
      }
    }

    // Get entries (all if limit is 0, otherwise top N)
    const topEntries = limit > 0 ? leaderboardEntries.slice(0, limit) : leaderboardEntries;

    // Fetch titles for all users
    const { getUsersWithTitles } = await import('@/lib/services/xp-level.service');
    const { getTitleByXP } = await import('@/lib/constants/levels');
    
    const userIds = topEntries.map(entry => entry.userId);
    const userLevels = await getUsersWithTitles(userIds);

    // Add title information to each entry
    const entriesWithTitles = topEntries.map(entry => {
      const userLevel = userLevels.get(entry.userId);
      
      // Get title info - always show at least default level
      let titleLevel;
      if (userLevel) {
        titleLevel = getTitleByXP(userLevel.currentXP);
      } else {
        // Default to Novice Trader for users without levels
        titleLevel = getTitleByXP(0);
      }

      return {
        ...entry,
        isTied: entry.isTied,
        tiedWith: entry.tiedWith,
        userTitle: titleLevel.title,
        userTitleIcon: titleLevel.icon,
        userTitleColor: titleLevel.color,
      };
    });

    return entriesWithTitles;
  } catch (error) {
    console.error('Error getting global leaderboard:', error);
    return [];
  }
}

/**
 * Calculate overall score for ranking
 * Weighted formula considering multiple factors
 */
function calculateOverallScore(params: {
  totalPnl: number;
  totalPnlPercentage: number;
  winRate: number;
  profitFactor: number;
  competitionsWon: number;
  podiumFinishes: number;
  challengesWon: number;
  totalBadges: number;
  legendaryBadges: number;
}): number {
  const {
    totalPnl,
    totalPnlPercentage,
    winRate,
    profitFactor,
    competitionsWon,
    podiumFinishes,
    challengesWon,
    totalBadges,
    legendaryBadges,
  } = params;

  // Weighted scoring system
  const score =
    totalPnl * 0.3 + // 30% weight on absolute P&L
    totalPnlPercentage * 5 + // 25% weight on ROI (scaled)
    winRate * 2 + // 20% weight on win rate
    profitFactor * 10 + // 10% weight on profit factor
    competitionsWon * 50 + // 5% weight on competition wins
    podiumFinishes * 20 + // 5% weight on podiums
    challengesWon * 25 + // Weight on challenge wins
    totalBadges * 2 + // 3% weight on badges
    legendaryBadges * 10; // 2% weight on legendary badges

  return Math.max(0, score);
}

/**
 * Get user's global rank
 */
export async function getUserGlobalRank(userId: string): Promise<{
  rank: number;
  totalUsers: number;
  percentile: number;
}> {
  const leaderboard = await getGlobalLeaderboard(999999); // Get all
  const userEntry = leaderboard.find(entry => entry.userId === userId);

  return {
    rank: userEntry?.rank || 0,
    totalUsers: leaderboard.length,
    percentile: userEntry ? ((leaderboard.length - userEntry.rank + 1) / leaderboard.length) * 100 : 0,
  };
}

/**
 * Get current user's leaderboard position
 */
export async function getMyLeaderboardPosition() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }

  const userId = session.user.id;
  return getUserGlobalRank(userId);
}

