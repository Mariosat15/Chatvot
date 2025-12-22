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
exports.checkUserMargin = void 0;
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
 * Check current user's margin level and auto-liquidate if needed
 * This runs on every price update from the client for real-time monitoring
 */
const checkUserMargin = async (competitionId) => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user) {
            return { liquidated: false, marginLevel: 100 };
        }
        await (0, mongoose_1.connectToDatabase)();
        // Get user's participant record
        const participant = await competition_participant_model_1.default.findOne({
            competitionId,
            userId: session.user.id,
            status: 'active',
        });
        if (!participant || participant.currentOpenPositions === 0) {
            return { liquidated: false, marginLevel: Infinity };
        }
        // Load admin thresholds
        const adminThresholds = await (0, risk_settings_actions_1.getMarginThresholds)();
        const thresholds = {
            liquidation: adminThresholds.LIQUIDATION,
            marginCall: adminThresholds.MARGIN_CALL,
            warning: adminThresholds.WARNING,
        };
        // Get all open positions
        const openPositions = await trading_position_model_1.default.find({
            participantId: participant._id,
            status: 'open',
        });
        if (openPositions.length === 0) {
            return { liquidated: false, marginLevel: Infinity };
        }
        // OPTIMIZATION: Fetch all prices at once (single batch)
        const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))];
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols);
        // Calculate REAL-TIME unrealized P&L
        let totalUnrealizedPnl = 0;
        for (const position of openPositions) {
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            const unrealizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
            totalUnrealizedPnl += unrealizedPnl;
        }
        // Check margin status with real-time P&L
        const marginStatus = (0, risk_manager_service_1.getMarginStatus)(participant.currentCapital, totalUnrealizedPnl, participant.usedMargin, thresholds);
        console.log(`📊 User Margin Check: ${session.user.name} - ${marginStatus.marginLevel.toFixed(2)}% (${marginStatus.status})`);
        // Send margin notifications based on status
        try {
            const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
            if (marginStatus.status === 'warning') {
                await notificationService.notifyMarginWarning(session.user.id, marginStatus.marginLevel);
            }
            else if (marginStatus.status === 'danger') {
                // 'danger' status indicates margin call
                await notificationService.notifyMarginCall(session.user.id, marginStatus.marginLevel);
            }
        }
        catch (notifError) {
            console.error('Error sending margin notification:', notifError);
        }
        // Auto-liquidate if needed
        if (marginStatus.status === 'liquidation') {
            console.log(`🚨 AUTO-LIQUIDATING ${openPositions.length} positions for ${session.user.name}`);
            // Send liquidation notifications
            try {
                const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
                for (const position of openPositions) {
                    await notificationService.notifyLiquidation(session.user.id, position.symbol);
                }
            }
            catch (notifError) {
                console.error('Error sending liquidation notification:', notifError);
            }
            for (const position of openPositions) {
                // Reuse prices from batch (instant!)
                const currentPrice = pricesMap.get(position.symbol);
                if (!currentPrice)
                    continue;
                const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                await (0, position_actions_1.closePositionAutomatic)(position._id.toString(), marketPrice, 'margin_call');
            }
            return {
                liquidated: true,
                marginLevel: marginStatus.marginLevel,
                positionsClosed: openPositions.length,
            };
        }
        return {
            liquidated: false,
            marginLevel: marginStatus.marginLevel,
            status: marginStatus.status,
        };
    }
    catch (error) {
        console.error('Error checking user margin:', error);
        return { liquidated: false, marginLevel: 100, error: true };
    }
};
exports.checkUserMargin = checkUserMargin;
