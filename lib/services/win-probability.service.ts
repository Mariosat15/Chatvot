/**
 * Win Probability Service
 * 
 * Sophisticated win probability calculation based on:
 * - Position within prize ranks
 * - Gap to leader and next positions
 * - Relative performance vs field
 * - Security margin from losing position
 * - Total participants (competition density)
 */

export type RankingMethod = 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';

interface ParticipantData {
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
}

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
  // New detailed breakdown
  breakdown: {
    positionScore: number;    // Score from rank position (0-40)
    gapScore: number;         // Score from gap to leader (0-25)
    performanceScore: number; // Score vs field average (0-20)
    securityScore: number;    // Buffer from losing position (0-15)
  };
  gapToLeader: number;
  gapToNextRank: number | null;
  percentOfLeader: number;
}

/**
 * Get the metric value based on ranking method
 */
function getMetricValue(participant: ParticipantData, rankingMethod: RankingMethod): number {
  switch (rankingMethod) {
    case 'pnl':
      return participant.pnl;
    case 'roi':
      return participant.pnlPercentage;
    case 'total_capital':
      return participant.currentCapital;
    case 'win_rate':
      return participant.winRate;
    case 'total_wins':
      return participant.winningTrades;
    case 'profit_factor':
      const totalWins = participant.winningTrades > 0 ? 
        (participant.averageWin * participant.winningTrades) : 0;
      const totalLosses = participant.losingTrades > 0 ? 
        Math.abs(participant.averageLoss * participant.losingTrades) : 0;
      return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
    default:
      return participant.pnl;
  }
}

/**
 * Get metric name for display
 */
export function getMetricName(rankingMethod: RankingMethod): string {
  switch (rankingMethod) {
    case 'pnl':
      return 'P&L';
    case 'roi':
      return 'ROI';
    case 'total_capital':
      return 'Balance';
    case 'win_rate':
      return 'Win Rate';
    case 'total_wins':
      return 'Wins';
    case 'profit_factor':
      return 'PF';
    default:
      return 'P&L';
  }
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
  userParticipant: ParticipantData,
  allParticipants: ParticipantData[],
  competition: CompetitionData
): WinProbabilityResult {
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

  // Sort by metric (descending)
  const sortedMetrics = [...metrics].sort((a, b) => b.metric - a.metric);
  
  // Get user's metric value
  const userMetric = getMetricValue(userParticipant, competition.rankingMethod);
  
  // Find user's actual rank (based on metric, not stored rank)
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

  // Calculate gaps
  const gapToLeader = userMetric - topMetric;
  const gapToNextRank = nextRankMetric !== null ? userMetric - nextRankMetric : null;
  
  // Distance calculations
  let distanceToWinning: number | null = null;
  let distanceFromLosing: number | null = null;
  
  if (currentRank > 0 && !isInWinningPosition) {
    distanceToWinning = lastWinnerMetric - userMetric;
  }
  
  if (isInWinningPosition && firstLoserMetric !== null) {
    distanceFromLosing = userMetric - firstLoserMetric;
  }

  // Calculate percent of leader (handle negative values)
  let percentOfLeader = 100;
  if (topMetric !== 0) {
    if (topMetric > 0 && userMetric >= 0) {
      percentOfLeader = (userMetric / topMetric) * 100;
    } else if (topMetric < 0 && userMetric < 0) {
      // Both negative: closer to 0 is better
      percentOfLeader = (topMetric / userMetric) * 100;
    } else if (topMetric < 0 && userMetric >= 0) {
      // User is positive, leader is negative: user is better
      percentOfLeader = 150; // Arbitrary high value
    } else {
      // User is negative, leader is positive: user is behind
      percentOfLeader = Math.max(0, 50 + (userMetric / Math.abs(topMetric)) * 50);
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
    // Based on rank within prize positions
    if (isInWinningPosition) {
      // Linear scale within prize positions
      // 1st place = 40, last winning position = 25
      const positionRange = lastWinningRank > 1 ? lastWinningRank - 1 : 1;
      const positionFraction = (lastWinningRank - currentRank) / positionRange;
      positionScore = 25 + (positionFraction * 15); // 25-40 range
    } else {
      // Outside prize positions: scale down based on how far
      const ranksFromPrize = currentRank - lastWinningRank;
      const maxDistance = Math.max(totalActive - lastWinningRank, 1);
      const distanceFraction = Math.min(ranksFromPrize / maxDistance, 1);
      positionScore = Math.max(0, 20 - (distanceFraction * 20)); // 0-20 range
    }

    // ============ GAP SCORE (0-25) ============
    // How close to the leader's metric
    if (currentRank === 1) {
      gapScore = 25; // Leader gets full points
    } else if (percentOfLeader >= 100) {
      gapScore = 25; // Ahead of or equal to leader (edge case)
    } else if (percentOfLeader >= 95) {
      gapScore = 22 + ((percentOfLeader - 95) / 5) * 3; // 22-25
    } else if (percentOfLeader >= 80) {
      gapScore = 15 + ((percentOfLeader - 80) / 15) * 7; // 15-22
    } else if (percentOfLeader >= 50) {
      gapScore = 5 + ((percentOfLeader - 50) / 30) * 10; // 5-15
    } else if (percentOfLeader >= 0) {
      gapScore = (percentOfLeader / 50) * 5; // 0-5
    } else {
      gapScore = 0; // Negative performance relative to positive leader
    }

    // ============ PERFORMANCE SCORE (0-20) ============
    // Performance vs field average
    if (avgMetric !== 0) {
      let relativePerformance: number;
      if (avgMetric > 0) {
        relativePerformance = userMetric / avgMetric;
      } else {
        // Average is negative, higher (closer to 0 or positive) is better
        relativePerformance = avgMetric / Math.min(userMetric, -0.001);
      }
      
      if (relativePerformance >= 2) {
        performanceScore = 20; // 2x+ average
      } else if (relativePerformance >= 1.5) {
        performanceScore = 15 + ((relativePerformance - 1.5) / 0.5) * 5; // 15-20
      } else if (relativePerformance >= 1) {
        performanceScore = 10 + ((relativePerformance - 1) / 0.5) * 5; // 10-15
      } else if (relativePerformance >= 0.5) {
        performanceScore = 5 + ((relativePerformance - 0.5) / 0.5) * 5; // 5-10
      } else {
        performanceScore = Math.max(0, relativePerformance * 10); // 0-5
      }
    } else {
      // Everyone at 0, give neutral score
      performanceScore = 10;
    }

    // ============ SECURITY SCORE (0-15) ============
    // Buffer from losing/dropping position
    if (isInWinningPosition && distanceFromLosing !== null && firstLoserMetric !== null) {
      // How much cushion do you have?
      const cushionPercent = Math.abs(userMetric) > 0 ? 
        (Math.abs(distanceFromLosing) / Math.abs(userMetric)) * 100 : 
        distanceFromLosing > 0 ? 100 : 0;
      
      if (cushionPercent >= 50) {
        securityScore = 15; // Very safe
      } else if (cushionPercent >= 20) {
        securityScore = 10 + ((cushionPercent - 20) / 30) * 5; // 10-15
      } else if (cushionPercent >= 5) {
        securityScore = 5 + ((cushionPercent - 5) / 15) * 5; // 5-10
      } else {
        securityScore = (cushionPercent / 5) * 5; // 0-5
      }
    } else if (isInWinningPosition) {
      // No one to lose to (only participant or at bottom of winners)
      securityScore = activeParticipants.length === 1 ? 15 : 7;
    } else {
      // Not in winning position - no security
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
        if (gapToNextRank !== null && gapToNextRank > 0) {
          message = `Leading by ${formatMetricValue(gapToNextRank, competition.rankingMethod)}! 👑`;
        } else {
          message = `In 1st place! Keep it up! 👑`;
        }
      } else {
        message = `${currentRank}${rankSuffix} place - winning position! 🏆`;
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
  };
}

/**
 * Format metric value for display
 */
export function formatMetricValue(value: number, rankingMethod: RankingMethod): string {
  switch (rankingMethod) {
    case 'pnl':
    case 'total_capital':
      return `$${value.toFixed(2)}`;
    case 'roi':
    case 'win_rate':
      return `${value.toFixed(1)}%`;
    case 'total_wins':
      return `${Math.floor(value)}`;
    case 'profit_factor':
      return value > 99 ? '∞' : value.toFixed(2);
    default:
      return `${value.toFixed(2)}`;
  }
}
