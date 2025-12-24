/**
 * Win Probability Service
 * 
 * Sophisticated win probability calculation based on:
 * - Position within prize ranks
 * - Gap to leader and next positions
 * - Relative performance vs field
 * - Security margin from losing position
 * - Total participants (competition density)
 * 
 * Uses ranking-config.service.ts for all ranking method logic.
 */

import {
  type RankingMethod,
  type ParticipantMetrics,
  getRankingConfig,
  getMetricValue,
  sortByRanking,
} from './ranking-config.service';

// Re-export for convenience
export { RankingMethod, ParticipantMetrics };
export { getMetricName, formatMetricValue, getMetricFullName, getMetricDescription, getMetricIcon, getMetricColor } from './ranking-config.service';

interface CompetitionData {
  rankingMethod: RankingMethod;
  prizeDistribution: { rank: number; percentage: number }[];
  totalParticipants: number;
  minimumTrades: number;
}

interface WinProbabilityResult {
  currentRank: number;
  totalWinners: number;
  winningRanks: number[];
  isInWinningPosition: boolean;
  distanceToWinning: number | null;
  distanceFromLosing: number | null;
  probabilityScore: number; // 0-100
  status: 'winning' | 'close' | 'far' | 'disqualified';
  message: string;
  metricValue: number;
  topCompetitorMetric: number;
  meetsMinimumTrades: boolean;
  // Detailed breakdown
  breakdown: {
    positionScore: number;    // Score from rank position (0-40)
    gapScore: number;         // Score from gap to leader (0-25)
    performanceScore: number; // Score vs field average (0-20)
    securityScore: number;    // Buffer from losing position (0-15)
  };
  gapToLeader: number;
  gapToNextRank: number | null;
  percentOfLeader: number;
  // Ranking method info
  rankingMethod: RankingMethod;
  rankingConfig: {
    name: string;
    fullName: string;
    description: string;
    color: string;
    higherIsBetter: boolean;
  };
}

/**
 * Calculate win probability for a participant
 * 
 * Score Breakdown (0-100):
 * - Position Score (0-40): Based on rank within prize positions
 * - Gap Score (0-25): How close to the leader
 * - Performance Score (0-20): Performance vs field average
 * - Security Score (0-15): Buffer from dropping out of prizes
 */
export function calculateWinProbability(
  userParticipant: ParticipantMetrics,
  allParticipants: ParticipantMetrics[],
  competition: CompetitionData
): WinProbabilityResult {
  const config = getRankingConfig(competition.rankingMethod);
  
  // Check if user meets minimum trades requirement
  const meetsMinimumTrades = userParticipant.totalTrades >= competition.minimumTrades;
  
  // Filter active participants
  const activeParticipants = allParticipants.filter(p => p.status === 'active');
  
  // Get all metrics for analysis
  const metrics = activeParticipants.map(p => ({
    userId: p.userId,
    metric: getMetricValue(p, competition.rankingMethod),
    totalTrades: p.totalTrades,
  }));

  // Sort by metric using ranking config
  const sortedParticipants = sortByRanking(activeParticipants, competition.rankingMethod);
  const sortedMetrics = sortedParticipants.map(p => ({
    userId: p.userId,
    metric: getMetricValue(p, competition.rankingMethod),
  }));
  
  // Get user's metric value
  const userMetric = getMetricValue(userParticipant, competition.rankingMethod);
  
  // Find user's actual rank
  const currentRank = sortedMetrics.findIndex(p => p.userId === userParticipant.userId) + 1;
  
  // Determine winning ranks from prize distribution
  const winningRanks = competition.prizeDistribution.map(p => p.rank).sort((a, b) => a - b);
  const totalWinners = winningRanks.length;
  const lastWinningRank = Math.max(...winningRanks, 1);

  // Get key metrics
  const topMetric = sortedMetrics.length > 0 ? sortedMetrics[0].metric : 0;
  const lastWinnerMetric = sortedMetrics.length >= lastWinningRank ? 
    sortedMetrics[lastWinningRank - 1].metric : topMetric;
  const firstLoserMetric = sortedMetrics.length > lastWinningRank ? 
    sortedMetrics[lastWinningRank].metric : null;
  const nextRankMetric = currentRank > 1 && sortedMetrics.length >= currentRank - 1 ?
    sortedMetrics[currentRank - 2].metric : null;

  // Calculate average metric of the field
  const avgMetric = metrics.length > 0 ? 
    metrics.reduce((sum, m) => sum + m.metric, 0) / metrics.length : 0;

  // Check if user is in winning position
  const isInWinningPosition = currentRank > 0 && currentRank <= lastWinningRank && meetsMinimumTrades;

  // Calculate gaps (account for higherIsBetter)
  const gapToLeader = config.higherIsBetter 
    ? userMetric - topMetric  // Negative if behind
    : topMetric - userMetric; // Positive if behind (for metrics where lower is better)
    
  const gapToNextRank = nextRankMetric !== null 
    ? (config.higherIsBetter ? userMetric - nextRankMetric : nextRankMetric - userMetric)
    : null;
  
  // Distance calculations
  let distanceToWinning: number | null = null;
  let distanceFromLosing: number | null = null;
  
  if (currentRank > 0 && !isInWinningPosition) {
    distanceToWinning = config.higherIsBetter 
      ? lastWinnerMetric - userMetric 
      : userMetric - lastWinnerMetric;
  }
  
  if (isInWinningPosition && firstLoserMetric !== null) {
    distanceFromLosing = config.higherIsBetter 
      ? userMetric - firstLoserMetric 
      : firstLoserMetric - userMetric;
  }

  // Calculate percent of leader (handle edge cases)
  let percentOfLeader = 100;
  if (topMetric !== 0 && config.higherIsBetter) {
    if (topMetric > 0 && userMetric >= 0) {
      percentOfLeader = (userMetric / topMetric) * 100;
    } else if (topMetric < 0 && userMetric < 0) {
      // Both negative: closer to 0 is better
      percentOfLeader = (topMetric / userMetric) * 100;
    } else if (topMetric < 0 && userMetric >= 0) {
      // User is positive, leader is negative: user is better
      percentOfLeader = 150;
    } else {
      // User is negative, leader is positive: user is behind
      percentOfLeader = Math.max(0, 50 + (userMetric / Math.abs(topMetric)) * 50);
    }
  } else if (topMetric !== 0 && !config.higherIsBetter) {
    // For metrics where lower is better (like max drawdown)
    if (topMetric > 0 && userMetric > 0) {
      percentOfLeader = (topMetric / userMetric) * 100; // Lower is better, so invert
    }
  }

  // Initialize scores
  let positionScore = 0;
  let gapScore = 0;
  let performanceScore = 0;
  let securityScore = 0;
  let probabilityScore = 0;
  let status: 'winning' | 'close' | 'far' | 'disqualified' = 'far';
  let message = '';

  // Handle disqualified/invalid states
  if (!meetsMinimumTrades) {
    status = 'disqualified';
    message = `Need ${competition.minimumTrades - userParticipant.totalTrades} more trade${competition.minimumTrades - userParticipant.totalTrades !== 1 ? 's' : ''} to qualify`;
    probabilityScore = 0;
  } else if (userParticipant.status !== 'active') {
    status = 'disqualified';
    message = 'Disqualified from competition';
    probabilityScore = 0;
  } else if (currentRank === 0 || activeParticipants.length === 0) {
    status = 'far';
    message = 'Not currently ranked';
    probabilityScore = 0;
  } else {
    const totalActive = activeParticipants.length;
    
    // ============ POSITION SCORE (0-40) ============
    if (isInWinningPosition) {
      const positionRange = lastWinningRank > 1 ? lastWinningRank - 1 : 1;
      const positionFraction = (lastWinningRank - currentRank) / positionRange;
      positionScore = 25 + (positionFraction * 15); // 25-40 range
    } else {
      const ranksFromPrize = currentRank - lastWinningRank;
      const maxDistance = Math.max(totalActive - lastWinningRank, 1);
      const distanceFraction = Math.min(ranksFromPrize / maxDistance, 1);
      positionScore = Math.max(0, 20 - (distanceFraction * 20)); // 0-20 range
    }

    // ============ GAP SCORE (0-25) ============
    if (currentRank === 1) {
      gapScore = 25;
    } else if (percentOfLeader >= 100) {
      gapScore = 25;
    } else if (percentOfLeader >= 95) {
      gapScore = 22 + ((percentOfLeader - 95) / 5) * 3;
    } else if (percentOfLeader >= 80) {
      gapScore = 15 + ((percentOfLeader - 80) / 15) * 7;
    } else if (percentOfLeader >= 50) {
      gapScore = 5 + ((percentOfLeader - 50) / 30) * 10;
    } else if (percentOfLeader >= 0) {
      gapScore = (percentOfLeader / 50) * 5;
    } else {
      gapScore = 0;
    }

    // ============ PERFORMANCE SCORE (0-20) ============
    if (avgMetric !== 0) {
      let relativePerformance: number;
      if (config.higherIsBetter) {
        if (avgMetric > 0) {
          relativePerformance = userMetric / avgMetric;
        } else {
          relativePerformance = avgMetric / Math.min(userMetric, -0.001);
        }
      } else {
        // For metrics where lower is better
        if (avgMetric > 0 && userMetric > 0) {
          relativePerformance = avgMetric / userMetric;
        } else {
          relativePerformance = 1;
        }
      }
      
      if (relativePerformance >= 2) {
        performanceScore = 20;
      } else if (relativePerformance >= 1.5) {
        performanceScore = 15 + ((relativePerformance - 1.5) / 0.5) * 5;
      } else if (relativePerformance >= 1) {
        performanceScore = 10 + ((relativePerformance - 1) / 0.5) * 5;
      } else if (relativePerformance >= 0.5) {
        performanceScore = 5 + ((relativePerformance - 0.5) / 0.5) * 5;
      } else {
        performanceScore = Math.max(0, relativePerformance * 10);
      }
    } else {
      performanceScore = 10;
    }

    // ============ SECURITY SCORE (0-15) ============
    if (isInWinningPosition && distanceFromLosing !== null && firstLoserMetric !== null) {
      const cushionPercent = Math.abs(userMetric) > 0 ? 
        (Math.abs(distanceFromLosing) / Math.abs(userMetric)) * 100 : 
        distanceFromLosing > 0 ? 100 : 0;
      
      if (cushionPercent >= 50) {
        securityScore = 15;
      } else if (cushionPercent >= 20) {
        securityScore = 10 + ((cushionPercent - 20) / 30) * 5;
      } else if (cushionPercent >= 5) {
        securityScore = 5 + ((cushionPercent - 5) / 15) * 5;
      } else {
        securityScore = (cushionPercent / 5) * 5;
      }
    } else if (isInWinningPosition) {
      securityScore = activeParticipants.length === 1 ? 15 : 7;
    } else {
      securityScore = 0;
    }

    // ============ TOTAL SCORE ============
    probabilityScore = Math.round(positionScore + gapScore + performanceScore + securityScore);
    probabilityScore = Math.max(0, Math.min(100, probabilityScore));

    // ============ STATUS & MESSAGE ============
    if (isInWinningPosition) {
      status = 'winning';
      const rankSuffix = currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th';
      
      if (currentRank === 1) {
        message = `Leading in ${config.name}! 👑`;
      } else {
        message = `${currentRank}${rankSuffix} by ${config.name} - winning! 🏆`;
      }
    } else {
      const ranksFromPrize = currentRank - lastWinningRank;
      
      if (ranksFromPrize <= 2) {
        status = 'close';
        message = `Just ${ranksFromPrize} rank${ranksFromPrize > 1 ? 's' : ''} from prizes! 🔥`;
      } else if (ranksFromPrize <= 5) {
        status = 'close';
        message = `${ranksFromPrize} ranks away - keep pushing! 💪`;
      } else if (currentRank <= Math.ceil(totalActive * 0.5)) {
        status = 'far';
        message = `Top ${Math.round((currentRank / totalActive) * 100)}% - climb higher! 📈`;
      } else {
        status = 'far';
        message = `Rank ${currentRank}/${totalActive} - time to rally! 🎯`;
      }
    }
  }

  return {
    currentRank,
    totalWinners,
    winningRanks,
    isInWinningPosition,
    distanceToWinning,
    distanceFromLosing,
    probabilityScore,
    status,
    message,
    metricValue: userMetric,
    topCompetitorMetric: topMetric,
    meetsMinimumTrades,
    breakdown: {
      positionScore: Math.round(positionScore),
      gapScore: Math.round(gapScore),
      performanceScore: Math.round(performanceScore),
      securityScore: Math.round(securityScore),
    },
    gapToLeader,
    gapToNextRank,
    percentOfLeader: Math.round(percentOfLeader),
    // Include ranking method info
    rankingMethod: competition.rankingMethod,
    rankingConfig: {
      name: config.name,
      fullName: config.fullName,
      description: config.description,
      color: config.color,
      higherIsBetter: config.higherIsBetter,
    },
  };
}
