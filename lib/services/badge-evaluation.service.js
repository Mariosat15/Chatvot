'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateUserBadges = evaluateUserBadges;
exports.getUserBadges = getUserBadges;
const mongoose_1 = require("@/database/mongoose");
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const trading_position_model_1 = __importDefault(require("@/database/models/trading/trading-position.model"));
const trade_history_model_1 = __importDefault(require("@/database/models/trading/trade-history.model"));
const credit_wallet_model_1 = __importDefault(require("@/database/models/trading/credit-wallet.model"));
const user_badge_model_1 = __importDefault(require("@/database/models/user-badge.model"));
const xp_level_service_1 = require("@/lib/services/xp-level.service");
const badge_config_seed_service_1 = require("@/lib/services/badge-config-seed.service");
/**
 * Evaluate all badges for a user and award new ones
 */
async function evaluateUserBadges(userId) {
    await (0, mongoose_1.connectToDatabase)();
    try {
        console.log(`🔍 [BADGE EVAL] Starting badge evaluation for user ${userId}`);
        // 0. Fetch badges from database
        const badges = await (0, badge_config_seed_service_1.getBadgesFromDB)();
        console.log(`📋 [BADGE EVAL] Loaded ${badges.length} badge definitions from database`);
        // 1. Gather user statistics
        const stats = await gatherUserStats(userId);
        console.log(`📊 [BADGE EVAL] User stats:`, {
            trades: stats.totalTrades,
            competitions: stats.competitionsEntered,
            wins: stats.totalWins,
            deposits: stats.totalDeposited,
            winRate: stats.winRate,
            totalPnl: stats.totalPnl
        });
        // 2. Get currently earned badges
        const existingBadges = await user_badge_model_1.default.find({ userId }).lean();
        const existingBadgeIds = new Set(existingBadges.map(b => b.badgeId));
        console.log(`🏅 [BADGE EVAL] User already has ${existingBadges.length} badges`);
        // 3. Evaluate each badge
        const newlyEarnedBadges = [];
        for (const badge of badges) {
            // Skip if already earned
            if (existingBadgeIds.has(badge.id))
                continue;
            // Check if badge condition is met
            const earned = await checkBadgeCondition(badge, stats);
            if (earned) {
                console.log(`✅ [BADGE EVAL] User earned badge: ${badge.name} (${badge.id})`);
                // Award the badge
                const userBadge = await user_badge_model_1.default.create({
                    userId,
                    badgeId: badge.id,
                    earnedAt: new Date(),
                    progress: 100,
                });
                console.log(`💾 [BADGE EVAL] Badge saved to database:`, userBadge._id);
                // Award XP for the badge
                try {
                    console.log(`⭐ [BADGE EVAL] Awarding XP for badge ${badge.id}...`);
                    const xpResult = await (0, xp_level_service_1.awardXPForBadge)(userId, badge.id);
                    console.log(`✅ [BADGE EVAL] XP awarded: ${xpResult.xpGained} XP (total: ${xpResult.newXP})`);
                }
                catch (error) {
                    console.error(`❌ [BADGE EVAL] Error awarding XP for badge ${badge.id}:`, error);
                }
                // Send notification about badge earned (fire and forget)
                try {
                    const { notificationService } = await import('@/lib/services/notification.service');
                    await notificationService.notifyBadgeEarned(userId, badge.name, badge.description || `You've earned the ${badge.name} badge!`);
                    console.log(`🔔 [BADGE EVAL] Badge notification sent for ${badge.name}`);
                }
                catch (error) {
                    console.error(`❌ [BADGE EVAL] Error sending badge notification:`, error);
                }
                newlyEarnedBadges.push(badge);
            }
        }
        console.log(`🎉 [BADGE EVAL] Evaluation complete: ${newlyEarnedBadges.length} new badges earned`);
        return {
            newBadges: newlyEarnedBadges,
            totalBadges: existingBadges.length + newlyEarnedBadges.length,
        };
    }
    catch (error) {
        console.error('❌ [BADGE EVAL] Error evaluating user badges:', error);
        return { newBadges: [], totalBadges: 0 };
    }
}
/**
 * Gather comprehensive user statistics for badge evaluation
 */
async function gatherUserStats(userId) {
    // Get competition stats
    const participations = await competition_participant_model_1.default.find({ userId }).lean();
    const firstPlaceFinishes = participations.filter(p => p.currentRank === 1).length;
    const podiumFinishes = participations.filter(p => p.currentRank && p.currentRank <= 3).length;
    // Get trading stats
    const allPositions = await trading_position_model_1.default.find({ userId }).lean();
    const closedTrades = await trade_history_model_1.default.find({ userId }).lean();
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const bestSingleTrade = Math.max(...closedTrades.map(t => t.realizedPnl || 0), 0);
    // Calculate win streak
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let tempStreak = 0;
    const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.closedAt || 0).getTime() - new Date(b.closedAt || 0).getTime());
    for (const trade of sortedTrades) {
        if ((trade.realizedPnl || 0) > 0) {
            tempStreak++;
            maxWinStreak = Math.max(maxWinStreak, tempStreak);
        }
        else {
            tempStreak = 0;
        }
    }
    // Current streak from most recent trades
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
        if ((sortedTrades[i].realizedPnl || 0) > 0) {
            currentWinStreak++;
        }
        else {
            break;
        }
    }
    // Profit factor
    const grossProfit = closedTrades
        .filter(t => (t.realizedPnl || 0) > 0)
        .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const grossLoss = Math.abs(closedTrades
        .filter(t => (t.realizedPnl || 0) < 0)
        .reduce((sum, t) => sum + (t.realizedPnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    // Unique pairs
    const uniquePairs = new Set(closedTrades.map(t => t.symbol));
    // ROI calculation
    const totalRoi = participations.reduce((sum, p) => sum + (p.pnlPercentage || 0), 0);
    const averageRoi = participations.length > 0 ? totalRoi / participations.length : 0;
    // Liquidations
    const liquidationCount = participations.filter(p => p.status === 'liquidated').length;
    // SL/TP usage
    const tradesWithSL = allPositions.filter(p => p.stopLoss && p.stopLoss > 0).length;
    const tradesWithTP = allPositions.filter(p => p.takeProfit && p.takeProfit > 0).length;
    const alwaysUsesSL = allPositions.length > 0 && tradesWithSL === allPositions.length;
    const alwaysUsesTP = allPositions.length > 0 && tradesWithTP === allPositions.length;
    // Wallet stats
    const wallet = await credit_wallet_model_1.default.findOne({ userId }).lean();
    const totalDeposited = wallet?.totalDeposited || 0;
    const totalWithdrawn = wallet?.totalWithdrawn || 0;
    // Account age (assuming user created with first participation or wallet)
    const firstParticipation = participations.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const accountCreatedAt = firstParticipation?.createdAt || wallet?.createdAt || new Date();
    const accountAge = Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
    // Calculate trading streaks
    const tradeDates = closedTrades.map(t => {
        const date = new Date(t.closedAt || Date.now());
        return date.toISOString().split('T')[0]; // Get date only
    }).sort();
    const uniqueTradeDays = [...new Set(tradeDates)];
    let consecutiveDays = 0;
    let tempConsecutive = 0;
    for (let i = 0; i < uniqueTradeDays.length; i++) {
        if (i === 0) {
            tempConsecutive = 1;
        }
        else {
            const prevDate = new Date(uniqueTradeDays[i - 1]);
            const currDate = new Date(uniqueTradeDays[i]);
            const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempConsecutive++;
            }
            else {
                tempConsecutive = 1;
            }
        }
        consecutiveDays = Math.max(consecutiveDays, tempConsecutive);
    }
    // Speed metrics
    const tradesDurations = closedTrades.map(t => {
        if (t.openedAt && t.closedAt) {
            return (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) / 1000 / 60; // minutes
        }
        return 0;
    }).filter(d => d > 0);
    const averageTradeDuration = tradesDurations.length > 0
        ? tradesDurations.reduce((a, b) => a + b, 0) / tradesDurations.length
        : 0;
    const tradesUnder1Minute = tradesDurations.filter(d => d < 1).length;
    const tradesUnder5Minutes = tradesDurations.filter(d => d < 5).length;
    const tradesOver1Day = tradesDurations.filter(d => d > 1440).length; // 24 hours
    const tradesOver7Days = tradesDurations.filter(d => d > 10080).length; // 7 days
    // Time of day analysis
    const tradesAtMarketOpen = closedTrades.filter(t => {
        const hour = new Date(t.openedAt || Date.now()).getUTCHours();
        return hour >= 13 && hour <= 14; // 1-2 PM UTC (market open)
    }).length;
    const tradesAtMarketClose = closedTrades.filter(t => {
        const hour = new Date(t.closedAt || Date.now()).getUTCHours();
        return hour >= 20 && hour <= 21; // 8-9 PM UTC (market close)
    }).length;
    // Daily/Weekly/Monthly volumes
    const tradesPerDay = new Map();
    closedTrades.forEach(t => {
        const dateKey = new Date(t.closedAt || Date.now()).toISOString().split('T')[0];
        tradesPerDay.set(dateKey, (tradesPerDay.get(dateKey) || 0) + 1);
    });
    const maxTradesInOneDay = Math.max(...Array.from(tradesPerDay.values()), 0);
    // Competition specific stats
    const comebackWins = participations.filter(p => {
        // Simplified: Won but had negative P&L at some point
        return p.currentRank === 1 && p.realizedPnl > 0 && p.losingTrades > 0;
    }).length;
    const wireToWireWins = participations.filter(p => {
        // Simplified: Won with very high win rate
        return p.currentRank === 1 && p.winRate >= 80;
    }).length;
    const perfectCompetitionTrades = participations.filter(p => {
        // 100% win rate in a competition
        return p.totalTrades >= 5 && p.winRate === 100;
    }).length;
    // Calculate risk metrics
    const losses = closedTrades.filter(t => t.realizedPnl < 0);
    const wins = closedTrades.filter(t => t.realizedPnl > 0);
    const averageLoss = losses.length > 0
        ? Math.abs(losses.reduce((sum, t) => sum + t.realizedPnl, 0) / losses.length)
        : 0;
    const averageWin = wins.length > 0
        ? wins.reduce((sum, t) => sum + t.realizedPnl, 0) / wins.length
        : 0;
    // Sharpe Ratio (simplified: returns / volatility)
    const returns = closedTrades.map(t => t.realizedPnl);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0
        ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        : 0;
    const profitVolatility = Math.sqrt(variance);
    const sharpeRatio = profitVolatility > 0 ? avgReturn / profitVolatility : 0;
    // Position sizing (simplified)
    const averagePositionSize = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => sum + (t.volume || 0), 0) / closedTrades.length
        : 0;
    // Strategy diversity (pairs traded is a proxy)
    const uniqueStrategiesUsed = uniquePairs.size;
    // Consecutive profitable days
    const profitableDays = new Map();
    closedTrades.forEach(t => {
        const dateKey = new Date(t.closedAt || Date.now()).toISOString().split('T')[0];
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
        }
        else {
            const prevDate = new Date(sortedProfitDays[i - 1]);
            const currDate = new Date(sortedProfitDays[i]);
            const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempConsecutiveProfitable++;
            }
            else {
                tempConsecutiveProfitable = 1;
            }
        }
        consecutiveProfitableDays = Math.max(consecutiveProfitableDays, tempConsecutiveProfitable);
    }
    // Calculate global rank (placeholder - will be calculated separately)
    const globalRank = 999999;
    return {
        userId,
        competitionsEntered: participations.length,
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
        maxDrawdown: 0, // Calculate separately if needed
        alwaysUsesSL,
        alwaysUsesTP,
        averageTradesDuration: averageTradeDuration,
        totalDeposited,
        totalWithdrawn,
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
        maxTradesInOneDay,
        maxTradesInOneWeek: 0, // Could calculate if needed
        maxTradesInOneMonth: 0, // Could calculate if needed
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
        globalRank,
    };
}
/**
 * Check if a badge condition is met
 */
async function checkBadgeCondition(badge, stats) {
    const { condition } = badge;
    const { type, value, comparison } = condition;
    switch (type) {
        // Competition badges
        case 'competitions_entered':
            return compareValue(stats.competitionsEntered, value, comparison);
        case 'first_place_finishes':
            return compareValue(stats.firstPlaceFinishes, value, comparison);
        case 'podium_finishes':
            return compareValue(stats.podiumFinishes, value, comparison);
        case 'perfect_competition_win_rate':
            return stats.competitionsEntered >= 3 && stats.firstPlaceFinishes === stats.competitionsEntered;
        // Trading volume
        case 'total_trades':
            return compareValue(stats.totalTrades, value, comparison);
        case 'unique_pairs_traded':
            return compareValue(stats.uniquePairsTraded, value, comparison);
        case 'single_pair_focus':
            // Check if user has 100+ trades on their most traded pair
            return stats.totalTrades >= 100 && stats.uniquePairsTraded <= 3;
        // Profit badges
        case 'winning_trades':
            return compareValue(stats.winningTrades, value, comparison);
        case 'total_pnl_positive':
            return stats.totalPnl > 0;
        case 'total_pnl':
            return compareValue(stats.totalPnl, value, comparison);
        case 'single_trade_profit':
            return compareValue(stats.bestSingleTrade, value, comparison);
        case 'win_streak':
            return compareValue(stats.maxWinStreak, value, comparison);
        case 'average_roi':
            return compareValue(stats.averageRoi, value, comparison);
        case 'profit_factor':
            return compareValue(stats.profitFactor, value, comparison);
        case 'win_rate':
            return compareValue(stats.winRate, value, comparison);
        case 'drawdown_recovery':
            // User recovered from a losing streak to profitability
            return stats.totalPnl > 0 && stats.losingTrades > 0 && stats.maxWinStreak >= 3;
        // Risk badges
        case 'no_liquidations':
            return stats.liquidationCount === 0;
        case 'zero_liquidations_lifetime':
            return stats.liquidationCount === 0 && stats.competitionsEntered >= 5;
        case 'always_uses_sl':
            return stats.alwaysUsesSL && stats.totalTrades >= 10;
        case 'always_uses_tp':
            return stats.alwaysUsesTP && stats.totalTrades >= 10;
        // Social badges
        case 'first_deposit':
            return stats.totalDeposited > 0;
        case 'total_deposited':
            return compareValue(stats.totalDeposited, value, comparison);
        case 'withdrawal_made':
            return stats.totalWithdrawn > 0;
        case 'large_withdrawal':
            return stats.totalWithdrawn >= 500;
        case 'net_profit_lifetime':
            return stats.totalWithdrawn > stats.totalDeposited && stats.totalDeposited > 0;
        case 'platform_age':
            return compareValue(stats.accountAge, value, comparison);
        case 'early_adopter':
            return stats.accountAge >= 30; // Example: 30 days
        // Global rank
        case 'global_rank':
            return compareValue(stats.globalRank, value, comparison);
        // Legendary badges
        case 'undefeated_in_comps':
            return stats.competitionsEntered >= 5 && stats.firstPlaceFinishes === stats.competitionsEntered;
        case 'all_legendary_badges':
            // Check if user has earned at least 8 of the 10 legendary badges
            return stats.competitionsEntered >= 50 && stats.firstPlaceFinishes >= 20 && stats.totalPnl >= 50000;
        // Risk management (advanced)
        case 'max_drawdown':
            return compareValue(stats.maxDrawdown, value, comparison);
        case 'average_leverage_low':
            return stats.totalTrades >= 10 && stats.averagePositionSize <= 1; // Conservative sizing
        case 'average_loss_small':
            return stats.averageLoss > 0 && stats.averageLoss < 50 && stats.totalTrades >= 10;
        case 'risk_discipline':
            return stats.alwaysUsesSL && stats.alwaysUsesTP && stats.liquidationCount === 0 && stats.totalTrades >= 20;
        case 'sharpe_ratio_high':
            return stats.sharpeRatio >= 2 && stats.totalTrades >= 30;
        case 'low_volatility':
            return stats.profitVolatility < 100 && stats.totalTrades >= 30 && stats.winRate >= 55;
        case 'optimal_position_sizing':
            return stats.averagePositionSize > 0 && stats.averagePositionSize <= 2 && stats.liquidationCount === 0 && stats.totalTrades >= 20;
        case 'strategy_diversity':
            return stats.uniqueStrategiesUsed >= 5 && stats.totalTrades >= 50;
        case 'balanced_risk_reward':
            return stats.profitFactor >= 1.5 && stats.winRate >= 45 && stats.winRate <= 60;
        case 'low_return_variance':
            return stats.profitVolatility < 150 && stats.totalTrades >= 40 && stats.winRate >= 50;
        case 'predictable_results':
            return stats.profitVolatility < 100 && stats.totalTrades >= 50 && stats.winRate >= 55;
        case 'exceptional_dd_control':
            return stats.maxDrawdown <= 5 && stats.totalTrades >= 20;
        // Strategy detection (simplified)
        case 'trend_following':
            return stats.totalTrades >= 20 && stats.winRate >= 50;
        case 'counter_trend':
            return stats.totalTrades >= 30 && stats.winRate >= 45;
        case 'breakout_trading':
            return stats.bestSingleTrade >= 300 && stats.totalTrades >= 20;
        case 'range_trading':
            return stats.totalTrades >= 30 && stats.winRate >= 55;
        case 'momentum_trading':
            return stats.maxWinStreak >= 5 && stats.totalTrades >= 25;
        case 'mean_reversion':
            return stats.totalTrades >= 30 && stats.winRate >= 50;
        case 'multiple_strategies':
            return stats.uniquePairsTraded >= 5 && stats.totalTrades >= 100;
        case 'technical_analysis':
            return stats.totalTrades >= 50 && stats.alwaysUsesTP;
        case 'unique_strategy':
            return stats.profitFactor >= 3 && stats.uniquePairsTraded >= 8;
        case 'news_trading':
            return stats.tradesAtMarketOpen >= 10 && stats.totalTrades >= 30;
        case 'versatile':
            return stats.uniquePairsTraded >= 5 && stats.totalTrades >= 100;
        // Speed & Execution badges
        case 'fast_order_execution':
            return stats.totalTrades >= 20 && stats.tradesUnder5Minutes >= 10;
        case 'ultra_fast_execution':
            return stats.tradesUnder1Minute >= 5;
        case 'quick_scalps':
            return stats.tradesUnder5Minutes >= 50;
        case 'closes_all_daily':
            return stats.tradesOver1Day === 0 && stats.totalTrades >= 20;
        case 'swing_trading_style':
            return stats.tradesOver1Day >= 10;
        case 'position_trading_style':
            return stats.tradesOver7Days >= 5;
        case 'precise_entry_timing':
            return stats.winRate >= 70 && stats.totalTrades >= 30;
        case 'ninja_trading':
            return stats.tradesUnder5Minutes >= 20 && stats.winRate >= 60;
        case 'patient_trading':
            return stats.averageTradeDuration >= 60 && stats.winRate >= 55; // 60+ minutes
        case 'trades_at_open':
            return stats.tradesAtMarketOpen >= 20;
        case 'trades_at_close':
            return stats.tradesAtMarketClose >= 20;
        case 'trades_all_hours':
            return stats.totalTrades >= 100 && stats.uniquePairsTraded >= 5;
        // Time-based trading volume
        case 'daily_trade_volume':
            return compareValue(stats.maxTradesInOneDay, value, comparison);
        case 'single_day_trades':
            return compareValue(stats.maxTradesInOneDay, value, comparison);
        case 'weekly_trade_volume':
            return compareValue(stats.maxTradesInOneWeek, value, comparison);
        case 'monthly_trade_volume':
            return compareValue(stats.maxTradesInOneMonth, value, comparison);
        // Consistency badges
        case 'daily_trading_streak':
            return compareValue(stats.consecutiveTradingDays, value, comparison);
        case 'weekly_trading_streak':
            return compareValue(stats.weeklyTradingStreak, value, comparison);
        case 'monthly_trading_streak':
            return compareValue(stats.monthlyTradingStreak, value, comparison);
        case 'consecutive_profitable_days':
            return stats.consecutiveProfitableDays >= (value || 7);
        case 'perfect_attendance':
            return stats.consecutiveTradingDays >= 90 && stats.totalTrades >= 200;
        // Advanced competition badges
        case 'comeback_victory':
            return stats.comebackWins >= 1;
        case 'wire_to_wire_win':
            return stats.wireToWireWins >= 1;
        case 'beat_top_trader':
            return stats.firstPlaceFinishes >= 1 && stats.competitionsEntered >= 5;
        case 'underdog_win':
            return stats.firstPlaceFinishes >= 1 && stats.averageRoi < 50;
        case 'perfect_competition_trades':
            return stats.perfectCompetitionTrades >= 1;
        case 'survived_full_competition':
            return stats.competitionsEntered >= 10 && stats.liquidationCount === 0;
        case 'first_trade_in_comp':
            return stats.totalTrades >= 1 && stats.competitionsEntered >= 1;
        case 'late_night_trader':
            return stats.totalTrades >= 50; // Simplified
        // Legendary badges
        case 'perfect_month':
            return stats.consecutiveTradingDays >= 30 && stats.winRate >= 90 && stats.totalTrades >= 50;
        case 'epic_comeback':
            return stats.comebackWins >= 3 && stats.totalPnl >= 5000;
        case 'perfect_year':
            return stats.consecutiveTradingDays >= 365 && stats.totalPnl > 0 && stats.winRate >= 55;
        case 'hall_of_fame_status':
            return stats.firstPlaceFinishes >= 20 && stats.totalPnl >= 50000 && stats.competitionsEntered >= 50;
        // Default: false for unimplemented conditions
        default:
            return false;
    }
}
/**
 * Helper function to compare values
 */
function compareValue(actual, expected, comparison) {
    if (actual === undefined || expected === undefined || comparison === undefined) {
        return false;
    }
    switch (comparison) {
        case 'gte':
            return actual >= expected;
        case 'lte':
            return actual <= expected;
        case 'eq':
            return actual === expected;
        default:
            return false;
    }
}
/**
 * Get user badges with progress
 */
async function getUserBadges(userId) {
    await (0, mongoose_1.connectToDatabase)();
    // Fetch badges from database (already cleaned of MongoDB fields)
    const badges = await (0, badge_config_seed_service_1.getBadgesFromDB)();
    const earnedBadges = await user_badge_model_1.default.find({ userId }).lean();
    const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));
    // Add earned status to badges
    return badges.map(badge => ({
        ...badge,
        earned: earnedBadgeIds.has(badge.id),
        earnedAt: earnedBadges.find(b => b.badgeId === badge.id)?.earnedAt || null,
    }));
}
