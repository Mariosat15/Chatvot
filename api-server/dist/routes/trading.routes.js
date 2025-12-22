"use strict";
/**
 * Trading Routes - MIGRATED FROM NEXT.JS
 *
 * High-frequency trading operations:
 * - Price fetching (real-time)
 * - Position management
 * - TP/SL modifications
 *
 * Original: app/api/trading/*
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
// Cache for market status
let cachedMarketOpen = true;
let cachedMarketStatus = '🟢 Market Open';
let lastMarketCheck = 0;
const MARKET_CHECK_INTERVAL = 30000; // 30 seconds
// Get models (lazy load)
const getModels = async () => {
    const TradingPosition = mongoose_1.default.models.TradingPosition || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/trading-position.model')))).default;
    const TradeHistory = mongoose_1.default.models.TradeHistory || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/trade-history.model')))).default;
    const CompetitionParticipant = mongoose_1.default.models.CompetitionParticipant || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/competition-participant.model')))).default;
    return { TradingPosition, TradeHistory, CompetitionParticipant };
};
// Import price service
const getPriceService = async () => {
    try {
        const { fetchRealForexPrices, isMarketOpenSync } = await Promise.resolve().then(() => __importStar(require('../../lib/services/real-forex-prices.service')));
        return { fetchRealForexPrices, isMarketOpenSync };
    }
    catch (error) {
        console.error('Failed to import price service:', error);
        return null;
    }
};
/**
 * GET /api/trading
 * Trading API info
 */
router.get('/', (req, res) => {
    res.json({
        message: 'Trading API Server',
        version: '1.0',
        routes: [
            'POST /api/trading/prices - Get real-time prices',
            'GET /api/trading/positions - Get open positions',
            'POST /api/trading/positions - Open a position',
            'DELETE /api/trading/positions/:id - Close a position',
            'PATCH /api/trading/tpsl - Modify TP/SL',
        ],
    });
});
/**
 * POST /api/trading/prices
 * Get real-time forex prices
 *
 * This is a high-frequency endpoint that benefits from:
 * - Dedicated server (doesn't block UI)
 * - Redis caching (when enabled)
 */
router.post('/prices', async (req, res) => {
    try {
        const { symbols } = req.body || {};
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            res.json({
                prices: [],
                marketOpen: cachedMarketOpen,
                status: cachedMarketStatus,
                timestamp: Date.now(),
            });
            return;
        }
        const priceService = await getPriceService();
        if (!priceService) {
            // Fallback response
            res.json({
                prices: [],
                marketOpen: true,
                status: '⚠️ Price service unavailable',
                timestamp: Date.now(),
            });
            return;
        }
        // Get prices
        const pricesMap = await priceService.fetchRealForexPrices(symbols);
        const prices = Array.from(pricesMap.values());
        // Update market status cache
        const now = Date.now();
        if (now - lastMarketCheck > MARKET_CHECK_INTERVAL) {
            cachedMarketOpen = priceService.isMarketOpenSync();
            cachedMarketStatus = cachedMarketOpen ? '🟢 Market Open' : '🔴 Market Closed';
            lastMarketCheck = now;
        }
        res.json({
            prices,
            marketOpen: cachedMarketOpen,
            status: cachedMarketStatus,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});
/**
 * GET /api/trading/prices
 * Get market status
 */
router.get('/prices', (req, res) => {
    res.json({
        marketOpen: cachedMarketOpen,
        status: cachedMarketStatus,
        message: 'Use POST /api/trading/prices with { symbols: [...] } to fetch prices',
    });
});
/**
 * GET /api/trading/positions
 * Get user's open positions
 */
router.get('/positions', auth_1.authenticateToken, async (req, res) => {
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
        res.json({ positions });
    }
    catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});
/**
 * GET /api/trading/positions/:id
 * Get single position
 */
router.get('/positions/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { TradingPosition } = await getModels();
        const position = await TradingPosition.findById(id).lean();
        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }
        // Verify ownership
        if (position.userId !== req.user?.id) {
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
 * GET /api/trading/history
 * Get user's trade history
 */
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const competitionId = req.query.competitionId;
        const limit = parseInt(req.query.limit) || 50;
        const { TradeHistory } = await getModels();
        const query = { userId };
        if (competitionId) {
            query.competitionId = competitionId;
        }
        const history = await TradeHistory.find(query)
            .sort({ closedAt: -1 })
            .limit(limit)
            .lean();
        res.json({ history });
    }
    catch (error) {
        console.error('Error fetching trade history:', error);
        res.status(500).json({ error: 'Failed to fetch trade history' });
    }
});
/**
 * GET /api/trading/risk-settings
 * Get trading risk settings
 */
router.get('/risk-settings', async (req, res) => {
    try {
        const TradingRiskSettings = mongoose_1.default.models.TradingRiskSettings ||
            (await Promise.resolve().then(() => __importStar(require('../../database/models/trading-risk-settings.model')))).default;
        const settings = TradingRiskSettings.getSingleton
            ? await TradingRiskSettings.getSingleton()
            : await TradingRiskSettings.findOne();
        res.json({ settings });
    }
    catch (error) {
        console.error('Error fetching risk settings:', error);
        res.status(500).json({ error: 'Failed to fetch risk settings' });
    }
});
/**
 * PATCH /api/trading/tpsl
 * Modify take profit / stop loss
 */
router.patch('/tpsl', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { positionId, takeProfit, stopLoss } = req.body;
        if (!positionId) {
            res.status(400).json({ error: 'positionId is required' });
            return;
        }
        const { TradingPosition } = await getModels();
        const position = await TradingPosition.findById(positionId);
        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }
        // Verify ownership
        if (position.userId !== userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // Update TP/SL
        if (takeProfit !== undefined) {
            position.takeProfit = takeProfit || null;
        }
        if (stopLoss !== undefined) {
            position.stopLoss = stopLoss || null;
        }
        await position.save();
        res.json({
            success: true,
            position: {
                _id: position._id,
                takeProfit: position.takeProfit,
                stopLoss: position.stopLoss,
            },
        });
    }
    catch (error) {
        console.error('Error updating TP/SL:', error);
        res.status(500).json({ error: 'Failed to update TP/SL' });
    }
});
exports.default = router;
//# sourceMappingURL=trading.routes.js.map