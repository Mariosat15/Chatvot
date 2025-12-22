"use strict";
/**
 * Margin Check Job
 *
 * Runs periodically to check all users' margins and liquidate if needed.
 * This is a BACKUP to the client-side real-time checks.
 *
 * Benefits:
 * - Catches users who disconnect before liquidation
 * - Ensures no one escapes margin call
 * - Runs independently of user actions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMarginCheck = runMarginCheck;
const database_1 = require("../config/database");
// Import models directly
const competition_participant_model_1 = __importDefault(require("../../database/models/trading/competition-participant.model"));
const trading_position_model_1 = __importDefault(require("../../database/models/trading/trading-position.model"));
const competition_model_1 = __importDefault(require("../../database/models/trading/competition.model"));
// Import services directly
const real_forex_prices_service_1 = require("../../lib/services/real-forex-prices.service");
const pnl_calculator_service_1 = require("../../lib/services/pnl-calculator.service");
const risk_manager_service_1 = require("../../lib/services/risk-manager.service");
const position_actions_1 = require("../../lib/actions/trading/position.actions");
// Get risk settings dynamically (might not exist)
async function getRiskSettings() {
    try {
        const RiskSettings = (await Promise.resolve().then(() => __importStar(require('../../database/models/trading-risk-settings.model')))).default;
        return await RiskSettings.findOne();
    }
    catch {
        return null;
    }
}
async function runMarginCheck() {
    const result = {
        checkedParticipants: 0,
        liquidatedUsers: 0,
        liquidatedPositions: 0,
        errors: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // Get admin thresholds
        let liquidationThreshold = 50;
        let marginCallThreshold = 100;
        let warningThreshold = 150;
        try {
            const riskSettings = await getRiskSettings();
            if (riskSettings) {
                liquidationThreshold = riskSettings.marginLiquidation ?? 50;
                marginCallThreshold = riskSettings.marginCall ?? 100;
                warningThreshold = riskSettings.marginWarning ?? 150;
            }
        }
        catch {
            // Use defaults
        }
        // Get all active competitions
        const activeCompetitions = await competition_model_1.default.find({ status: 'active' });
        const activeCompetitionIds = activeCompetitions.map(c => c._id);
        // Get all participants with open positions in active competitions
        const participantsWithPositions = await competition_participant_model_1.default.find({
            competitionId: { $in: activeCompetitionIds },
            status: 'active',
            currentOpenPositions: { $gt: 0 },
        });
        if (participantsWithPositions.length === 0) {
            return result;
        }
        // Collect all unique symbols needed
        const allSymbols = new Set();
        const participantPositions = new Map();
        for (const participant of participantsWithPositions) {
            const positions = await trading_position_model_1.default.find({
                participantId: participant._id,
                status: 'open',
            });
            if (positions.length > 0) {
                participantPositions.set(participant._id.toString(), positions);
                positions.forEach(p => allSymbols.add(p.symbol));
            }
        }
        // Fetch current prices for all symbols at once (efficient)
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(Array.from(allSymbols));
        // Check each participant
        for (const participant of participantsWithPositions) {
            result.checkedParticipants++;
            const positions = participantPositions.get(participant._id.toString());
            if (!positions || positions.length === 0)
                continue;
            try {
                // Calculate total unrealized P&L
                let totalUnrealizedPnl = 0;
                for (const position of positions) {
                    const currentPrice = pricesMap.get(position.symbol);
                    if (!currentPrice)
                        continue;
                    const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                    const unrealizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
                    totalUnrealizedPnl += unrealizedPnl;
                }
                // Check margin status
                const marginStatus = (0, risk_manager_service_1.getMarginStatus)(participant.currentCapital, totalUnrealizedPnl, participant.usedMargin, {
                    liquidation: liquidationThreshold,
                    marginCall: marginCallThreshold,
                    warning: warningThreshold,
                });
                // Liquidate if needed
                if (marginStatus.status === 'liquidation') {
                    result.liquidatedUsers++;
                    // Close all positions for this user
                    for (const position of positions) {
                        try {
                            const currentPrice = pricesMap.get(position.symbol);
                            if (!currentPrice)
                                continue;
                            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                            await (0, position_actions_1.closePositionAutomatic)(position._id.toString(), marketPrice, 'margin_call');
                            result.liquidatedPositions++;
                        }
                        catch (posError) {
                            result.errors.push(`Failed to close position ${position._id}: ${posError}`);
                        }
                    }
                    // Send notification (fire and forget)
                    try {
                        const { notificationService } = await Promise.resolve().then(() => __importStar(require('../../lib/services/notification.service')));
                        await notificationService.notifyLiquidation(participant.userId, 'All positions');
                    }
                    catch {
                        // Notification failure is not critical
                    }
                }
            }
            catch (participantError) {
                result.errors.push(`Error processing participant ${participant._id}: ${participantError}`);
            }
        }
        return result;
    }
    catch (error) {
        result.errors.push(`Critical error in margin check: ${error}`);
        return result;
    }
}
exports.default = runMarginCheck;
