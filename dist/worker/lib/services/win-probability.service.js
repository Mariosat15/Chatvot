"use strict";
/**
 * Win Probability Service
 * Calculates probability of winning based on competition type and current standings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetricName = getMetricName;
exports.calculateWinProbability = calculateWinProbability;
exports.formatMetricValue = formatMetricValue;
/**
 * Get the metric value based on ranking method
 */
function getMetricValue(participant, rankingMethod) {
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
function getMetricName(rankingMethod) {
    switch (rankingMethod) {
        case 'pnl':
            return 'Highest P&L';
        case 'roi':
            return 'Highest ROI%';
        case 'total_capital':
            return 'Highest Balance';
        case 'win_rate':
            return 'Highest Win Rate';
        case 'total_wins':
            return 'Most Winning Trades';
        case 'profit_factor':
            return 'Best Profit Factor';
        default:
            return 'Highest P&L';
    }
}
/**
 * Calculate win probability for a participant
 */
function calculateWinProbability(userParticipant, allParticipants, competition) {
    // Check if user meets minimum trades requirement
    const meetsMinimumTrades = userParticipant.totalTrades >= competition.minimumTrades;
    // Filter only active participants who meet requirements
    const eligibleParticipants = allParticipants.filter(p => p.status === 'active' &&
        p.totalTrades >= competition.minimumTrades);
    // Get user's metric value
    const userMetric = getMetricValue(userParticipant, competition.rankingMethod);
    // Sort participants by metric (descending)
    const sortedParticipants = [...eligibleParticipants].sort((a, b) => {
        const aMetric = getMetricValue(a, competition.rankingMethod);
        const bMetric = getMetricValue(b, competition.rankingMethod);
        return bMetric - aMetric;
    });
    // Find user's current rank
    const currentRank = sortedParticipants.findIndex(p => p.userId === userParticipant.userId) + 1;
    // Determine winning ranks from prize distribution
    const winningRanks = competition.prizeDistribution.map(p => p.rank).sort((a, b) => a - b);
    const totalWinners = winningRanks.length;
    const lastWinningRank = Math.max(...winningRanks);
    // Check if user is in winning position
    const isInWinningPosition = currentRank > 0 && currentRank <= lastWinningRank && meetsMinimumTrades;
    // Get top competitor's metric
    const topCompetitorMetric = sortedParticipants.length > 0 ?
        getMetricValue(sortedParticipants[0], competition.rankingMethod) : 0;
    // Calculate distances
    let distanceToWinning = null;
    let distanceFromLosing = null;
    if (currentRank > 0) {
        if (!isInWinningPosition && currentRank <= sortedParticipants.length) {
            // Distance to winning position
            const winningPositionMetric = getMetricValue(sortedParticipants[lastWinningRank - 1], competition.rankingMethod);
            distanceToWinning = winningPositionMetric - userMetric;
        }
        if (isInWinningPosition && currentRank < sortedParticipants.length) {
            // Distance from losing position
            const nextLoserMetric = sortedParticipants[lastWinningRank] ?
                getMetricValue(sortedParticipants[lastWinningRank], competition.rankingMethod) : userMetric;
            distanceFromLosing = userMetric - nextLoserMetric;
        }
    }
    // Calculate probability score (0-100)
    let probabilityScore = 0;
    let status = 'far';
    let message = '';
    if (!meetsMinimumTrades) {
        status = 'disqualified';
        message = `Need ${competition.minimumTrades - userParticipant.totalTrades} more trades to qualify`;
        probabilityScore = 0;
    }
    else if (userParticipant.status !== 'active') {
        status = 'disqualified';
        message = 'Disqualified from competition';
        probabilityScore = 0;
    }
    else if (currentRank === 0) {
        status = 'far';
        message = 'Not currently ranked';
        probabilityScore = 0;
    }
    else if (isInWinningPosition) {
        status = 'winning';
        // Calculate probability score - HIGHER rank = HIGHER score (1st > 2nd > 3rd)
        const maxWinningRank = Math.max(...winningRanks);
        // Base score: 1st=85, 2nd=75, 3rd=65, etc.
        const baseScore = 85 - ((currentRank - 1) * 10);
        // Security bonus based on distance from losing position (0-15 points)
        let securityBonus = 10; // Default bonus
        if (distanceFromLosing !== null && Math.abs(userMetric) > 0) {
            // Calculate how safe the position is
            const relativeDistance = Math.abs(distanceFromLosing) / Math.abs(userMetric);
            securityBonus = Math.min(15, 5 + (relativeDistance * 100));
        }
        // Extra bonus for 1st place
        const firstPlaceBonus = currentRank === 1 ? 5 : 0;
        probabilityScore = Math.min(100, baseScore + securityBonus + firstPlaceBonus);
        const rankSuffix = currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th';
        message = `Currently in ${currentRank}${rankSuffix} place - winning position! 🏆`;
    }
    else {
        // Not winning yet
        const rankDifference = currentRank - lastWinningRank;
        const metricDifference = distanceToWinning || 0;
        // Calculate probability based on how close they are
        if (rankDifference <= 3 && metricDifference < Math.abs(userMetric) * 0.2) {
            status = 'close';
            probabilityScore = 30 + (25 - rankDifference * 5); // 30-55 range
            message = `${rankDifference} rank${rankDifference > 1 ? 's' : ''} away from winning - keep pushing! 💪`;
        }
        else if (rankDifference <= 10) {
            status = 'close';
            probabilityScore = 10 + (20 - rankDifference); // 10-30 range
            message = `${rankDifference} rank${rankDifference > 1 ? 's' : ''} away from prize - stay focused! 📈`;
        }
        else {
            status = 'far';
            probabilityScore = Math.max(1, 10 - rankDifference); // 1-10 range
            message = `Currently rank ${currentRank} - work to climb the leaderboard 🎯`;
        }
    }
    return {
        currentRank,
        totalWinners,
        winningRanks,
        isInWinningPosition,
        distanceToWinning,
        distanceFromLosing,
        probabilityScore: Math.round(probabilityScore),
        status,
        message,
        metricValue: userMetric,
        topCompetitorMetric,
        meetsMinimumTrades,
    };
}
/**
 * Format metric value for display
 */
function formatMetricValue(value, rankingMethod) {
    switch (rankingMethod) {
        case 'pnl':
        case 'total_capital':
            return `$${value.toFixed(2)}`;
        case 'roi':
        case 'win_rate':
            return `${value.toFixed(1)}%`;
        case 'total_wins':
            return `${Math.floor(value)} wins`;
        case 'profit_factor':
            return value > 99 ? '∞' : value.toFixed(2);
        default:
            return `${value.toFixed(2)}`;
    }
}
