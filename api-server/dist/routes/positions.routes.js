"use strict";
/**
 * Positions Routes - MIGRATED FROM NEXT.JS
 *
 * Position management operations:
 * - Open positions
 * - Close positions
 * - Position details
 *
 * Note: Most position operations are now in trading.routes.ts
 * This file handles simulator-specific bulk operations
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
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get models - with lazy loading fallback
const getModels = async () => {
    // Try to get from mongoose.models first (pre-loaded)
    if (mongoose_1.default.models.TradingPosition) {
        return {
            TradingPosition: mongoose_1.default.models.TradingPosition,
            CompetitionParticipant: mongoose_1.default.models.CompetitionParticipant,
        };
    }
    // Fallback: lazy load models
    console.log('⚠️ Models not pre-loaded, lazy loading...');
    const [PositionModule, ParticipantModule] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/trading-position.model'))),
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/competition-participant.model'))),
    ]);
    return {
        TradingPosition: PositionModule.default,
        CompetitionParticipant: ParticipantModule.default,
    };
};
/**
 * GET /api/positions
 * API info
 */
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { TradingPosition } = await getModels();
        // Count user's positions
        const openCount = await TradingPosition.countDocuments({ userId, status: 'open' });
        res.json({
            message: 'Positions API',
            userId,
            openPositions: openCount,
            routes: [
                'GET /api/positions/open - List open positions',
                'GET /api/positions/:id - Get position details',
            ],
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch position info' });
    }
});
/**
 * GET /api/positions/open
 * Get user's open positions
 */
router.get('/open', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const competitionId = req.query.competitionId;
        const { TradingPosition } = await getModels();
        const query = { userId, status: 'open' };
        if (competitionId) {
            query.competitionId = competitionId;
        }
        const positions = await TradingPosition.find(query)
            .sort({ openedAt: -1 })
            .lean();
        res.json({
            positions,
            count: positions.length,
        });
    }
    catch (error) {
        console.error('Error fetching open positions:', error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});
/**
 * GET /api/positions/:id
 * Get position by ID
 */
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { TradingPosition } = await getModels();
        const position = await TradingPosition.findById(id).lean();
        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }
        // Verify ownership (unless admin or simulator)
        const isSimulator = req.headers['x-simulator-mode'] === 'true';
        if (!isSimulator && position.userId !== req.user?.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        res.json({ position });
    }
    catch (error) {
        console.error('Error fetching position:', error);
        res.status(500).json({ error: 'Failed to fetch position' });
    }
});
/**
 * GET /api/positions/history
 * Get user's trade history (closed positions)
 */
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const TradeHistory = mongoose_1.default.models.TradeHistory ||
            (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/trade-history.model')))).default;
        const competitionId = req.query.competitionId;
        const limit = parseInt(req.query.limit) || 50;
        const query = { userId };
        if (competitionId) {
            query.competitionId = competitionId;
        }
        const history = await TradeHistory.find(query)
            .sort({ closedAt: -1 })
            .limit(limit)
            .lean();
        res.json({
            history,
            count: history.length,
        });
    }
    catch (error) {
        console.error('Error fetching trade history:', error);
        res.status(500).json({ error: 'Failed to fetch trade history' });
    }
});
/**
 * GET /api/positions/stats
 * Get user's trading stats
 */
router.get('/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const competitionId = req.query.competitionId;
        const { CompetitionParticipant } = await getModels();
        if (competitionId) {
            const participant = await CompetitionParticipant.findOne({
                userId,
                competitionId,
            }).lean();
            if (!participant) {
                res.status(404).json({ error: 'Not participating in this competition' });
                return;
            }
            res.json({
                stats: {
                    pnl: participant.pnl,
                    pnlPercentage: participant.pnlPercentage,
                    totalTrades: participant.totalTrades,
                    winningTrades: participant.winningTrades,
                    losingTrades: participant.losingTrades,
                    winRate: participant.winRate,
                    currentCapital: participant.currentCapital,
                    maxDrawdown: participant.maxDrawdown,
                },
            });
        }
        else {
            // Aggregate stats across all competitions
            const participants = await CompetitionParticipant.find({ userId }).lean();
            const aggregated = participants.reduce((acc, p) => ({
                totalPnl: acc.totalPnl + p.pnl,
                totalTrades: acc.totalTrades + p.totalTrades,
                winningTrades: acc.winningTrades + p.winningTrades,
                losingTrades: acc.losingTrades + p.losingTrades,
                competitions: acc.competitions + 1,
            }), { totalPnl: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, competitions: 0 });
            res.json({
                stats: {
                    ...aggregated,
                    winRate: aggregated.totalTrades > 0
                        ? (aggregated.winningTrades / aggregated.totalTrades * 100).toFixed(1)
                        : 0,
                },
            });
        }
    }
    catch (error) {
        console.error('Error fetching trading stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
/**
 * POST /api/positions/tpsl
 * Update TP/SL for a user's position (simulator-friendly)
 */
router.post('/tpsl', async (req, res) => {
    try {
        const isSimulatorMode = req.headers['x-simulator-mode'] === 'true';
        const simulatorUserId = req.headers['x-simulator-user-id'];
        const isDev = process.env.NODE_ENV === 'development';
        let userId;
        if ((isSimulatorMode || simulatorUserId) && isDev) {
            const bodyUserId = req.body?.userId;
            const simUserId = simulatorUserId || bodyUserId;
            if (!simUserId) {
                res.status(400).json({ success: false, error: 'userId required in simulator mode' });
                return;
            }
            userId = simUserId;
        }
        else {
            const authReq = req;
            if (!authReq.user?.id) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            userId = authReq.user.id;
        }
        const { takeProfit, stopLoss, positionId } = req.body;
        const { TradingPosition } = await getModels();
        // Find user's open position
        let query = { userId, status: 'open' };
        if (positionId) {
            query._id = positionId;
        }
        const position = await TradingPosition.findOne(query);
        if (!position) {
            res.status(404).json({ success: false, error: 'No open position found' });
            return;
        }
        // Update TP/SL
        const updates = {};
        if (takeProfit !== undefined)
            updates.takeProfitPrice = takeProfit;
        if (stopLoss !== undefined)
            updates.stopLossPrice = stopLoss;
        await TradingPosition.findByIdAndUpdate(position._id, { $set: updates });
        res.json({
            success: true,
            positionId: position._id,
            updates,
        });
    }
    catch (error) {
        console.error('Error updating TP/SL:', error);
        res.status(500).json({ success: false, error: 'Failed to update TP/SL' });
    }
});
/**
 * POST /api/positions/tpsl-batch
 * Batch update TP/SL for multiple users (simulator)
 */
router.post('/tpsl-batch', async (req, res) => {
    try {
        const isSimulatorMode = req.headers['x-simulator-mode'] === 'true';
        const isDev = process.env.NODE_ENV === 'development';
        if (!isSimulatorMode || !isDev) {
            res.status(403).json({ success: false, error: 'Only available in simulator mode' });
            return;
        }
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates)) {
            res.status(400).json({ success: false, error: 'updates array required' });
            return;
        }
        const { TradingPosition } = await getModels();
        // Use bulkWrite for much better performance (single DB operation instead of N*2)
        const bulkOps = updates.map((update) => {
            const setUpdates = {};
            if (update.takeProfit !== undefined)
                setUpdates.takeProfitPrice = update.takeProfit;
            if (update.stopLoss !== undefined)
                setUpdates.stopLossPrice = update.stopLoss;
            return {
                updateMany: {
                    filter: { userId: update.userId, status: 'open' },
                    update: { $set: setUpdates },
                },
            };
        });
        const bulkResult = await TradingPosition.bulkWrite(bulkOps, { ordered: false });
        // All operations are considered successful (updateMany doesn't fail on no match)
        const results = updates.map((u) => ({ userId: u.userId, success: true }));
        const successCount = results.length;
        res.json({
            success: true,
            results,
            stats: {
                total: updates.length,
                success: successCount,
                failed: updates.length - successCount,
            },
        });
    }
    catch (error) {
        console.error('Error batch updating TP/SL:', error);
        res.status(500).json({ success: false, error: 'Failed to batch update TP/SL' });
    }
});
exports.default = router;
//# sourceMappingURL=positions.routes.js.map