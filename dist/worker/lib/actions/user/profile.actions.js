'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserCompetitionStats = getUserCompetitionStats;
exports.getUserChallengeStats = getUserChallengeStats;
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const auth_1 = require("@/lib/better-auth/auth");
const mongoose_1 = require("@/database/mongoose");
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const competition_model_1 = __importDefault(require("@/database/models/trading/competition.model"));
const challenge_model_1 = __importDefault(require("@/database/models/trading/challenge.model"));
const challenge_participant_model_1 = __importDefault(require("@/database/models/trading/challenge-participant.model"));
const credit_wallet_model_1 = __importDefault(require("@/database/models/trading/credit-wallet.model"));
/**
 * Get comprehensive competition stats for a user
 */
async function getUserCompetitionStats(userId) {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        const targetUserId = userId || session.user.id;
        await (0, mongoose_1.connectToDatabase)();
        // Get all participations
        const participations = await competition_participant_model_1.default.find({ userId: targetUserId })
            .sort({ createdAt: -1 })
            .lean();
        // Get wallet for prize info
        const wallet = await credit_wallet_model_1.default.findOne({ userId: targetUserId }).lean();
        // Calculate overall stats
        const completedParticipations = participations.filter((p) => p.status === 'completed');
        const activeParticipations = participations.filter((p) => p.status === 'active');
        // Aggregate performance metrics
        let totalCapitalTraded = 0;
        let totalPnl = 0;
        let totalTrades = 0;
        let totalWinningTrades = 0;
        let totalLosingTrades = 0;
        let totalRoi = 0;
        let totalGross = 0;
        let totalLoss = 0;
        // Best performances
        let bestRank = Number.MAX_SAFE_INTEGER;
        let bestPnl = 0;
        let bestRoi = 0;
        let bestWinRate = 0;
        let mostTrades = 0;
        // Count wins and podiums
        let competitionsWon = 0;
        let podiumFinishes = 0;
        participations.forEach((p) => {
            totalCapitalTraded += p.startingCapital || 0;
            totalPnl += p.pnl || 0;
            totalTrades += p.totalTrades || 0;
            totalWinningTrades += p.winningTrades || 0;
            totalLosingTrades += p.losingTrades || 0;
            totalRoi += p.pnlPercentage || 0;
            // For profit factor
            if (p.averageWin && p.winningTrades)
                totalGross += p.averageWin * p.winningTrades;
            if (p.averageLoss && p.losingTrades)
                totalLoss += Math.abs(p.averageLoss) * p.losingTrades;
            // Best performances (include active competitions)
            if (p.currentRank && p.currentRank < bestRank)
                bestRank = p.currentRank;
            if ((p.pnl || 0) > bestPnl)
                bestPnl = p.pnl || 0;
            if ((p.pnlPercentage || 0) > bestRoi)
                bestRoi = p.pnlPercentage || 0;
            const winRate = p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0;
            if (winRate > bestWinRate)
                bestWinRate = winRate;
            if (p.totalTrades > mostTrades)
                mostTrades = p.totalTrades;
            // Count wins and podiums
            if (p.currentRank === 1)
                competitionsWon++;
            if (p.currentRank && p.currentRank <= 3)
                podiumFinishes++;
        });
        const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
        const averageRoi = participations.length > 0 ? totalRoi / participations.length : 0;
        const profitFactor = totalLoss > 0 ? totalGross / totalLoss : totalWinningTrades > 0 ? 9999 : 0;
        const totalPnlPercentage = totalCapitalTraded > 0 ? (totalPnl / totalCapitalTraded) * 100 : 0;
        // Get recent competitions with details (show both active and completed)
        const recentParticipations = participations.slice(0, 10);
        const recentCompetitionIds = recentParticipations.map((p) => p.competitionId);
        const competitions = await competition_model_1.default.find({ _id: { $in: recentCompetitionIds } }).lean();
        const competitionMap = new Map(competitions.map((c) => [c._id.toString(), c]));
        const recentCompetitions = recentParticipations.map((p) => {
            const competition = competitionMap.get(p.competitionId.toString());
            const winRate = p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0;
            // Find prize amount from leaderboard (only for completed)
            let prizeAmount = 0;
            if (competition?.status === 'completed' && competition.finalLeaderboard) {
                const leaderboardEntry = competition.finalLeaderboard.find((entry) => entry.userId === targetUserId);
                if (leaderboardEntry)
                    prizeAmount = leaderboardEntry.prizeAmount || 0;
            }
            return {
                competitionId: p.competitionId,
                competitionName: competition?.name || 'Unknown Competition',
                rank: p.currentRank || 0,
                pnl: p.pnl || 0,
                pnlPercentage: p.pnlPercentage || 0,
                totalTrades: p.totalTrades || 0,
                winRate,
                status: competition?.status || p.status, // Use competition status, fallback to participant status
                prizeAmount,
                startedAt: competition?.startTime || p.createdAt,
                endedAt: competition?.endTime || p.updatedAt,
            };
        });
        return {
            totalCompetitionsEntered: participations.length,
            totalCompetitionsCompleted: completedParticipations.length,
            totalCompetitionsActive: activeParticipations.length,
            totalCapitalTraded,
            totalPnl,
            totalPnlPercentage,
            totalTrades,
            totalWinningTrades,
            totalLosingTrades,
            overallWinRate,
            averageRoi,
            profitFactor,
            bestRank: bestRank === Number.MAX_SAFE_INTEGER ? 0 : bestRank,
            bestPnl,
            bestRoi,
            bestWinRate,
            mostTrades,
            totalPrizesWon: wallet?.totalWonFromCompetitions || 0,
            totalCreditsWon: wallet?.totalWonFromCompetitions || 0,
            competitionsWon,
            podiumFinishes,
            recentCompetitions,
        };
    }
    catch (error) {
        console.error('Error getting user competition stats:', error);
        throw new Error('Failed to get competition stats');
    }
}
/**
 * Get comprehensive challenge stats for a user
 */
async function getUserChallengeStats(userId) {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        const targetUserId = userId || session.user.id;
        await (0, mongoose_1.connectToDatabase)();
        // Get all challenges where user is a participant
        const challenges = await challenge_model_1.default.find({
            $or: [
                { challengerId: targetUserId },
                { challengedId: targetUserId },
            ],
        })
            .sort({ createdAt: -1 })
            .lean();
        // Get all participations
        const participations = await challenge_participant_model_1.default.find({ userId: targetUserId })
            .sort({ createdAt: -1 })
            .lean();
        // Get wallet for prize info
        const wallet = await credit_wallet_model_1.default.findOne({ userId: targetUserId }).lean();
        // Calculate stats
        const completedChallenges = challenges.filter((c) => c.status === 'completed');
        const activeChallenges = challenges.filter((c) => c.status === 'active');
        let totalChallengesWon = 0;
        let totalChallengesLost = 0;
        let totalChallengesTied = 0;
        let totalPnl = 0;
        let totalTrades = 0;
        let totalWinningTrades = 0;
        let bestPnl = 0;
        let bestRoi = 0;
        let mostTrades = 0;
        let totalPrizeAmount = 0;
        // Aggregate from participations
        participations.forEach((p) => {
            totalPnl += p.pnl || 0;
            totalTrades += p.totalTrades || 0;
            totalWinningTrades += p.winningTrades || 0;
            if ((p.pnl || 0) > bestPnl)
                bestPnl = p.pnl || 0;
            if ((p.pnlPercentage || 0) > bestRoi)
                bestRoi = p.pnlPercentage || 0;
            if ((p.totalTrades || 0) > mostTrades)
                mostTrades = p.totalTrades || 0;
            if (p.prizeReceived)
                totalPrizeAmount += p.prizeReceived;
            if (p.isWinner)
                totalChallengesWon++;
        });
        // Count wins/losses from challenges
        completedChallenges.forEach((c) => {
            if (c.isTie) {
                totalChallengesTied++;
            }
            else if (c.winnerId === targetUserId) {
                // Already counted in participations
            }
            else if (c.loserId === targetUserId) {
                totalChallengesLost++;
            }
        });
        // If we didn't get wins from participations, use wallet data
        if (totalPrizeAmount === 0) {
            totalPrizeAmount = wallet?.totalWonFromChallenges || 0;
        }
        const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
        // Build recent challenges
        const recentChallenges = challenges.slice(0, 10).map((c) => {
            const isChallenger = c.challengerId === targetUserId;
            const opponentName = isChallenger ? c.challengedName : c.challengerName;
            const myStats = isChallenger ? c.challengerFinalStats : c.challengedFinalStats;
            const isWinner = c.winnerId === targetUserId;
            return {
                challengeId: c._id.toString(),
                opponentName,
                entryFee: c.entryFee,
                winnerPrize: c.winnerPrize,
                pnl: myStats?.pnl || 0,
                pnlPercentage: myStats?.pnlPercentage || 0,
                totalTrades: myStats?.totalTrades || 0,
                winRate: myStats?.winRate || 0,
                status: c.status,
                isWinner,
                prizeAmount: isWinner ? c.winnerPrize : 0,
                startTime: c.startTime || c.createdAt,
                endTime: c.endTime || c.updatedAt,
            };
        });
        return {
            totalChallengesEntered: challenges.length,
            totalChallengesCompleted: completedChallenges.length,
            totalChallengesActive: activeChallenges.length,
            totalChallengesWon,
            totalChallengesLost,
            totalChallengesTied,
            totalPnl,
            totalTrades,
            overallWinRate,
            bestPnl,
            bestRoi,
            mostTrades,
            totalCreditsWon: wallet?.totalWonFromChallenges || totalPrizeAmount,
            totalCreditsSpent: wallet?.totalSpentOnChallenges || 0,
            recentChallenges,
        };
    }
    catch (error) {
        console.error('Error getting user challenge stats:', error);
        throw new Error('Failed to get challenge stats');
    }
}
