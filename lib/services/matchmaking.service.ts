'use server';

import { connectToDatabase } from '@/database/mongoose';
import UserPresence from '@/database/models/user-presence.model';
import { getGlobalLeaderboard, GlobalLeaderboardEntry } from '@/lib/actions/leaderboard/global-leaderboard.actions';

// Trader experience levels based on stats
export type TraderLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';

export interface MatchableTrader {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  
  // Core stats for matching (directly from leaderboard)
  level: TraderLevel;
  winRate: number;
  totalTrades: number;
  totalPnl: number;
  totalPnlPercentage: number;
  profitFactor: number;
  
  // Competition/Challenge history (directly from leaderboard)
  competitionsEntered: number;
  competitionsWon: number;
  challengesEntered: number;
  challengesWon: number;
  
  // Badges (directly from leaderboard)
  totalBadges: number;
  legendaryBadges: number;
  
  // Overall score (directly from leaderboard - ensures consistency!)
  overallScore: number;
  
  // Title (from leaderboard)
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  
  // Online status
  isOnline: boolean;
  acceptingChallenges: boolean;
  
  // Match compatibility score (calculated during matching)
  matchScore?: number;
}

export interface MatchResult {
  trader: MatchableTrader;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Calculate trader experience level based on stats
 */
function calculateTraderLevel(stats: {
  totalTrades: number;
  competitionsEntered: number;
  challengesEntered: number;
  winRate: number;
  totalBadges: number;
}): TraderLevel {
  const { totalTrades, competitionsEntered, challengesEntered, winRate, totalBadges } = stats;
  
  // Experience score based on activity
  const activityScore = 
    (totalTrades * 1) +
    (competitionsEntered * 10) +
    (challengesEntered * 5) +
    (totalBadges * 15);
  
  // Performance modifier
  const performanceModifier = winRate > 60 ? 1.3 : winRate > 50 ? 1.1 : 1.0;
  const adjustedScore = activityScore * performanceModifier;
  
  if (adjustedScore < 50) return 'beginner';
  if (adjustedScore < 200) return 'intermediate';
  if (adjustedScore < 500) return 'advanced';
  if (adjustedScore < 1000) return 'expert';
  return 'master';
}

/**
 * Calculate match compatibility score between two traders
 * Higher score = better match (more evenly matched)
 */
function calculateMatchScore(trader1: MatchableTrader, trader2: MatchableTrader): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let totalScore = 100; // Start with perfect match
  
  // Level matching (40% weight) - same level is best
  const levelOrder: Record<TraderLevel, number> = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3,
    'expert': 4,
    'master': 5,
  };
  const levelDiff = Math.abs(levelOrder[trader1.level] - levelOrder[trader2.level]);
  const levelPenalty = levelDiff * 10; // 10 points per level difference
  totalScore -= levelPenalty;
  
  if (levelDiff === 0) {
    reasons.push(`Same level (${trader1.level})`);
  } else if (levelDiff === 1) {
    reasons.push('Similar experience level');
  }
  
  // Win rate matching (25% weight) - similar win rates
  const winRateDiff = Math.abs(trader1.winRate - trader2.winRate);
  const winRatePenalty = Math.min(25, winRateDiff * 0.5); // Up to 25 point penalty
  totalScore -= winRatePenalty;
  
  if (winRateDiff <= 5) {
    reasons.push('Matching win rates');
  } else if (winRateDiff <= 15) {
    reasons.push('Comparable win rates');
  }
  
  // Trade count matching (15% weight) - similar experience volume
  const tradeRatio = Math.min(trader1.totalTrades, trader2.totalTrades) / 
                     Math.max(trader1.totalTrades, trader2.totalTrades || 1);
  const tradePenalty = (1 - tradeRatio) * 15;
  totalScore -= tradePenalty;
  
  if (tradeRatio > 0.7) {
    reasons.push('Similar trading volume');
  }
  
  // Profit factor matching (10% weight)
  const pfDiff = Math.abs(trader1.profitFactor - trader2.profitFactor);
  const pfPenalty = Math.min(10, pfDiff * 5);
  totalScore -= pfPenalty;
  
  if (pfDiff <= 0.3) {
    reasons.push('Similar profit factor');
  }
  
  // Competition experience (5% weight)
  const compRatio = Math.min(trader1.competitionsEntered, trader2.competitionsEntered) / 
                    Math.max(trader1.competitionsEntered, trader2.competitionsEntered || 1);
  const compPenalty = (1 - compRatio) * 5;
  totalScore -= compPenalty;
  
  // Badge collection (5% weight) - similar achievements
  const badgeRatio = Math.min(trader1.totalBadges, trader2.totalBadges) / 
                     Math.max(trader1.totalBadges, trader2.totalBadges || 1);
  const badgePenalty = (1 - badgeRatio) * 5;
  totalScore -= badgePenalty;
  
  // Bonus for both being online and accepting
  if (trader2.isOnline && trader2.acceptingChallenges) {
    totalScore += 5;
    reasons.push('Online & ready');
  }
  
  return {
    score: Math.max(0, Math.min(100, totalScore)),
    reasons,
  };
}

/**
 * Convert leaderboard entry to matchable trader
 * This ensures the score comes directly from the leaderboard - no recalculation!
 */
function leaderboardEntryToMatchableTrader(
  entry: GlobalLeaderboardEntry,
  presence: { isOnline: boolean; acceptingChallenges: boolean }
): MatchableTrader {
  // Calculate level based on activity
  const level = calculateTraderLevel({
    totalTrades: entry.totalTrades,
    competitionsEntered: entry.competitionsEntered,
    challengesEntered: entry.challengesEntered || 0,
    winRate: entry.winRate,
    totalBadges: entry.totalBadges,
  });
  
  return {
    userId: entry.userId,
    email: entry.email,
    username: entry.username,
    profileImage: entry.profileImage,
    level,
    winRate: entry.winRate,
    totalTrades: entry.totalTrades,
    totalPnl: entry.totalPnl,
    totalPnlPercentage: entry.totalPnlPercentage,
    profitFactor: entry.profitFactor,
    competitionsEntered: entry.competitionsEntered,
    competitionsWon: entry.competitionsWon,
    challengesEntered: entry.challengesEntered || 0,
    challengesWon: entry.challengesWon || 0,
    totalBadges: entry.totalBadges,
    legendaryBadges: entry.legendaryBadges,
    // USE THE LEADERBOARD SCORE DIRECTLY - THIS IS THE KEY CHANGE!
    overallScore: entry.overallScore,
    userTitle: entry.userTitle,
    userTitleIcon: entry.userTitleIcon,
    userTitleColor: entry.userTitleColor,
    isOnline: presence.isOnline,
    acceptingChallenges: presence.acceptingChallenges,
  };
}

/**
 * Get all matchable traders (excluding current user)
 * Now uses leaderboard data directly for consistency!
 */
export async function getMatchableTraders(currentUserId: string): Promise<MatchableTrader[]> {
  await connectToDatabase();
  
  // Get leaderboard data - this has all the pre-calculated stats and scores
  const leaderboardData = await getGlobalLeaderboard();
  
  // Get online status for all users
  const onlineStatuses = await UserPresence.find({}).lean();
  const onlineMap = new Map(onlineStatuses.map(p => [p.userId, p]));
  
  // Convert leaderboard entries to matchable traders
  const traders: MatchableTrader[] = [];
  
  for (const entry of leaderboardData) {
    // Skip current user
    if (entry.userId === currentUserId) continue;
    
    // Get online status
    const presence = onlineMap.get(entry.userId);
    const isOnline = presence?.status === 'online';
    const acceptingChallenges = presence?.acceptingChallenges ?? true;
    
    // Convert to matchable trader using leaderboard data directly
    traders.push(leaderboardEntryToMatchableTrader(entry, { isOnline, acceptingChallenges }));
  }
  
  return traders;
}

/**
 * Find the best match for a trader
 */
export async function findBestMatch(currentUserId: string): Promise<MatchResult | null> {
  await connectToDatabase();
  
  // Get leaderboard data
  const leaderboardData = await getGlobalLeaderboard();
  
  // Find current user in leaderboard
  const currentUserEntry = leaderboardData.find(e => e.userId === currentUserId);
  if (!currentUserEntry) {
    console.error('Current user not found in leaderboard');
    return null;
  }
  
  // Get online statuses
  const onlineStatuses = await UserPresence.find({}).lean();
  const onlineMap = new Map(onlineStatuses.map(p => [p.userId, p]));
  
  // Convert current user
  const currentUserPresence = onlineMap.get(currentUserId);
  const currentUser = leaderboardEntryToMatchableTrader(currentUserEntry, {
    isOnline: currentUserPresence?.status === 'online',
    acceptingChallenges: currentUserPresence?.acceptingChallenges ?? true,
  });
  
  // Get all other traders
  const traders = await getMatchableTraders(currentUserId);
  
  // Filter to only online and accepting challenges
  const availableTraders = traders.filter(t => t.isOnline && t.acceptingChallenges);
  
  if (availableTraders.length === 0) {
    console.log('No online traders, falling back to all traders');
  }
  
  const tradersToMatch = availableTraders.length > 0 ? availableTraders : traders;
  
  if (tradersToMatch.length === 0) {
    return null;
  }
  
  // Calculate match scores
  const matches: MatchResult[] = tradersToMatch.map(trader => {
    const { score, reasons } = calculateMatchScore(currentUser, trader);
    return {
      trader: { ...trader, matchScore: score },
      matchScore: score,
      matchReasons: reasons,
    };
  });
  
  // Sort by match score (highest first)
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  return matches[0] || null;
}

/**
 * Get ranked matches for a trader (for card swiping)
 */
export async function getRankedMatches(
  currentUserId: string,
  limit: number = 50
): Promise<MatchResult[]> {
  await connectToDatabase();
  
  // Get leaderboard data
  const leaderboardData = await getGlobalLeaderboard();
  
  // Find current user in leaderboard
  const currentUserEntry = leaderboardData.find(e => e.userId === currentUserId);
  if (!currentUserEntry) {
    console.error('Current user not found in leaderboard');
    return [];
  }
  
  // Get online statuses
  const onlineStatuses = await UserPresence.find({}).lean();
  const onlineMap = new Map(onlineStatuses.map(p => [p.userId, p]));
  
  // Convert current user
  const currentUserPresence = onlineMap.get(currentUserId);
  const currentUser = leaderboardEntryToMatchableTrader(currentUserEntry, {
    isOnline: currentUserPresence?.status === 'online',
    acceptingChallenges: currentUserPresence?.acceptingChallenges ?? true,
  });
  
  // Get all other traders
  const traders = await getMatchableTraders(currentUserId);
  
  // Calculate match scores for all traders
  const matches: MatchResult[] = traders.map(trader => {
    const { score, reasons } = calculateMatchScore(currentUser, trader);
    return {
      trader: { ...trader, matchScore: score },
      matchScore: score,
      matchReasons: reasons,
    };
  });
  
  // Sort by match score (best matches first)
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  return matches.slice(0, limit);
}

// Note: getLevelInfo is defined in MatchmakingCards.tsx as LEVEL_INFO constant
// since it's a pure helper function that doesn't need server action
