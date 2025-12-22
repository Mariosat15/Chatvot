'use server';
"use strict";
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
exports.backupMarginCheck = exports.executeLiquidation = void 0;
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const mongoose_1 = require("@/database/mongoose");
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const trading_position_model_1 = __importDefault(require("@/database/models/trading/trading-position.model"));
const risk_manager_service_1 = require("@/lib/services/risk-manager.service");
const risk_settings_actions_1 = require("@/lib/actions/trading/risk-settings.actions");
const real_forex_prices_service_1 = require("@/lib/services/real-forex-prices.service");
const pnl_calculator_service_1 = require("@/lib/services/pnl-calculator.service");
const position_actions_1 = require("@/lib/actions/trading/position.actions");
/**
 * Execute liquidation for current user
 * Called when client-side margin calculation detects liquidation threshold breached
 *
 * IMPORTANT: This function VALIDATES on server before closing
 * - Fetches fresh prices from API
 * - Recalculates margin to confirm liquidation is needed
 * - Only closes if server-side calculation also shows liquidation
 *
 * This prevents:
 * - Client-server price desync issues
 * - Malicious liquidation requests
 * - Race conditions
 */
const executeLiquidation = async (competitionId, clientMarginLevel // Client's calculated margin level (for logging)
) => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user) {
            return {
                success: false,
                liquidated: false,
                positionsClosed: 0,
                serverMarginLevel: 100,
                message: 'Not authenticated',
            };
        }
        await (0, mongoose_1.connectToDatabase)();
        // Get user's participant record
        const participant = await competition_participant_model_1.default.findOne({
            competitionId,
            userId: session.user.id,
            status: 'active',
        });
        if (!participant) {
            return {
                success: false,
                liquidated: false,
                positionsClosed: 0,
                serverMarginLevel: 100,
                message: 'Participant not found',
            };
        }
        // Get all open positions
        const openPositions = await trading_position_model_1.default.find({
            participantId: participant._id,
            status: 'open',
        });
        if (openPositions.length === 0) {
            return {
                success: true,
                liquidated: false,
                positionsClosed: 0,
                serverMarginLevel: Infinity,
                message: 'No open positions',
            };
        }
        // Load admin thresholds
        const adminThresholds = await (0, risk_settings_actions_1.getMarginThresholds)();
        const thresholds = {
            liquidation: adminThresholds.LIQUIDATION,
            marginCall: adminThresholds.MARGIN_CALL,
            warning: adminThresholds.WARNING,
        };
        // CRITICAL: Fetch FRESH prices from API (not cached)
        const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))];
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols);
        // SERVER-SIDE VALIDATION: Recalculate margin with fresh prices
        let totalUnrealizedPnl = 0;
        for (const position of openPositions) {
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            const unrealizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
            totalUnrealizedPnl += unrealizedPnl;
        }
        // Calculate server-side margin status
        const marginStatus = (0, risk_manager_service_1.getMarginStatus)(participant.currentCapital, totalUnrealizedPnl, participant.usedMargin, thresholds);
        // VALIDATION: Only liquidate if SERVER confirms liquidation is needed
        if (marginStatus.status !== 'liquidation') {
            return {
                success: true,
                liquidated: false,
                positionsClosed: 0,
                serverMarginLevel: marginStatus.marginLevel,
                message: `Server margin level (${marginStatus.marginLevel.toFixed(2)}%) is above liquidation threshold`,
            };
        }
        // EXECUTE LIQUIDATION
        // Send liquidation notifications
        try {
            const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
            for (const position of openPositions) {
                // Fire and forget - don't block liquidation
                notificationService.notifyLiquidation(session.user.id, position.symbol).catch(() => { });
            }
        }
        catch {
            // Notifications are non-critical
        }
        let closedCount = 0;
        for (const position of openPositions) {
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            try {
                await (0, position_actions_1.closePositionAutomatic)(position._id.toString(), marketPrice, 'margin_call');
                closedCount++;
            }
            catch {
                // Position close failed - continue with others
            }
        }
        return {
            success: true,
            liquidated: true,
            positionsClosed: closedCount,
            serverMarginLevel: marginStatus.marginLevel,
            message: `Liquidated ${closedCount} positions`,
        };
    }
    catch (error) {
        return {
            success: false,
            liquidated: false,
            positionsClosed: 0,
            serverMarginLevel: 100,
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.executeLiquidation = executeLiquidation;
/**
 * Backup margin check - runs periodically as safety net
 * Less aggressive than executeLiquidation, used for catching edge cases
 */
const backupMarginCheck = async (competitionId) => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user) {
            return { needsLiquidation: false, marginLevel: 100 };
        }
        await (0, mongoose_1.connectToDatabase)();
        const participant = await competition_participant_model_1.default.findOne({
            competitionId,
            userId: session.user.id,
            status: 'active',
        });
        if (!participant || participant.currentOpenPositions === 0) {
            return { needsLiquidation: false, marginLevel: Infinity };
        }
        const openPositions = await trading_position_model_1.default.find({
            participantId: participant._id,
            status: 'open',
        });
        if (openPositions.length === 0) {
            return { needsLiquidation: false, marginLevel: Infinity };
        }
        const adminThresholds = await (0, risk_settings_actions_1.getMarginThresholds)();
        const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))];
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols);
        let totalUnrealizedPnl = 0;
        for (const position of openPositions) {
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            totalUnrealizedPnl += (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
        }
        const marginStatus = (0, risk_manager_service_1.getMarginStatus)(participant.currentCapital, totalUnrealizedPnl, participant.usedMargin, {
            liquidation: adminThresholds.LIQUIDATION,
            marginCall: adminThresholds.MARGIN_CALL,
            warning: adminThresholds.WARNING,
        });
        return {
            needsLiquidation: marginStatus.status === 'liquidation',
            marginLevel: marginStatus.marginLevel,
        };
    }
    catch {
        return { needsLiquidation: false, marginLevel: 100 };
    }
};
exports.backupMarginCheck = backupMarginCheck;
