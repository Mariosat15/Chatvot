"use strict";
/**
 * Challenges Routes - MIGRATED FROM NEXT.JS
 *
 * This is a heavy route that benefits from:
 * 1. Dedicated process (doesn't block UI rendering)
 * 2. Worker threads for bcrypt (if needed for auth)
 * 3. Better connection pooling
 *
 * Original: app/api/challenges/route.ts
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
const nanoid_1 = require("nanoid");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Timeouts
const DB_TIMEOUT_MS = 3000;
// Helper function for timeout
function withTimeout(promise, ms, name) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)),
    ]);
}
// Get models (lazy load to avoid circular dependencies)
const getModels = async () => {
    // Import models from main app's database folder
    const Challenge = mongoose_1.default.models.Challenge || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/challenge.model')))).default;
    const ChallengeSettings = mongoose_1.default.models.ChallengeSettings || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/challenge-settings.model')))).default;
    const CreditWallet = mongoose_1.default.models.CreditWallet || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading/credit-wallet.model')))).default;
    const UserPresence = mongoose_1.default.models.UserPresence || (await Promise.resolve().then(() => __importStar(require('../../database/models/user-presence.model')))).default;
    const TradingRiskSettings = mongoose_1.default.models.TradingRiskSettings || (await Promise.resolve().then(() => __importStar(require('../../database/models/trading-risk-settings.model')))).default;
    return { Challenge, ChallengeSettings, CreditWallet, UserPresence, TradingRiskSettings };
};
/**
 * GET /api/challenges
 * Get user's challenges
 */
router.get('/', auth_1.authenticateToken, async (req, res) => {
    const startTime = Date.now();
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { Challenge } = await getModels();
        const status = req.query.status;
        const type = req.query.type; // 'sent', 'received', 'all'
        const query = {};
        // Filter by user
        if (type === 'sent') {
            query.challengerId = userId;
        }
        else if (type === 'received') {
            query.challengedId = userId;
        }
        else {
            query.$or = [
                { challengerId: userId },
                { challengedId: userId },
            ];
        }
        // Filter by status
        if (status) {
            query.status = status;
        }
        const challenges = await withTimeout(Challenge.find(query)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
            .exec(), DB_TIMEOUT_MS, 'Challenge.find');
        const duration = Date.now() - startTime;
        if (duration > 500) {
            console.log(`🐢 GET /api/challenges took ${duration}ms`);
        }
        res.json({ challenges });
    }
    catch (error) {
        console.error('Error fetching challenges:', error);
        if (error instanceof Error && error.message.includes('timed out')) {
            res.status(504).json({ error: 'Request timeout - please try again' });
            return;
        }
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});
/**
 * POST /api/challenges
 * Create a new challenge
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();
    try {
        // Check for simulator mode
        const isSimulatorMode = req.headers['x-simulator-mode'] === 'true';
        const simulatorUserId = req.headers['x-simulator-user-id'];
        const isDev = process.env.NODE_ENV === 'development';
        let challengerId;
        let challengerName;
        let challengerEmail;
        const { challengedId, entryFee, duration, startingCapital, assetClasses, rankingMethod, tieBreaker1, tieBreaker2, minimumTrades, } = req.body;
        // VALIDATION: Early check for required fields
        if (!challengedId) {
            res.status(400).json({ error: 'challengedId is required' });
            return;
        }
        if ((isSimulatorMode || simulatorUserId) && isDev) {
            // Simulator mode
            const simUserId = simulatorUserId || req.body.challengerId;
            if (!simUserId) {
                res.status(400).json({ error: 'challengerId required in simulator mode' });
                return;
            }
            challengerId = simUserId;
            challengerName = `SimUser_${challengerId.slice(-6)}`;
            challengerEmail = `simuser_${challengerId.slice(-6)}@test.simulator`;
        }
        else {
            // Normal mode - check auth from request (set by authenticateToken if called)
            const authReq = req;
            if (!authReq.user?.id) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            challengerId = authReq.user.id;
            challengerName = authReq.user.name || 'Unknown';
            challengerEmail = authReq.user.email || '';
        }
        const { Challenge, ChallengeSettings, CreditWallet, UserPresence, TradingRiskSettings } = await getModels();
        // Fetch settings in parallel
        const [settings, tradingRiskSettings] = await withTimeout(Promise.all([
            ChallengeSettings.getSingleton ? ChallengeSettings.getSingleton() : ChallengeSettings.findOne(),
            TradingRiskSettings.getSingleton ? TradingRiskSettings.getSingleton() : TradingRiskSettings.findOne(),
        ]), DB_TIMEOUT_MS, 'Settings fetch');
        const isInSimulatorMode = (isSimulatorMode || simulatorUserId) && isDev;
        if (!isInSimulatorMode) {
            // Validate challenges are enabled
            if (!settings?.challengesEnabled) {
                res.status(400).json({ error: 'Challenges are currently disabled' });
                return;
            }
            // Can't challenge yourself
            if (challengedId === challengerId) {
                res.status(400).json({ error: 'You cannot challenge yourself' });
                return;
            }
            // Validate entry fee
            const actualEntryFee = entryFee ?? settings.minEntryFee;
            if (actualEntryFee < settings.minEntryFee || actualEntryFee > settings.maxEntryFee) {
                res.status(400).json({
                    error: `Entry fee must be between ${settings.minEntryFee} and ${settings.maxEntryFee} credits`
                });
                return;
            }
            // Validate duration
            const actualDuration = duration ?? settings.minDurationMinutes;
            if (actualDuration < settings.minDurationMinutes || actualDuration > settings.maxDurationMinutes) {
                res.status(400).json({
                    error: `Duration must be between ${settings.minDurationMinutes} and ${settings.maxDurationMinutes} minutes`
                });
                return;
            }
            // Batch validation queries
            const cooldownTime = settings.challengeCooldownMinutes > 0
                ? new Date(Date.now() - settings.challengeCooldownMinutes * 60 * 1000)
                : null;
            const [challengerWallet, challengedPresence, pendingChallenges, activeChallenges, recentChallenge,] = await withTimeout(Promise.all([
                CreditWallet.findOne({ userId: challengerId }).lean().exec(),
                UserPresence.findOne({ userId: challengedId }).lean().exec(),
                Challenge.countDocuments({ challengerId, status: 'pending' }),
                Challenge.countDocuments({
                    $or: [{ challengerId }, { challengedId }],
                    status: 'active',
                }),
                cooldownTime
                    ? Challenge.findOne({ challengerId, challengedId, createdAt: { $gte: cooldownTime } }).lean().exec()
                    : Promise.resolve(null),
            ]), DB_TIMEOUT_MS, 'Validation queries');
            // Validate wallet balance
            if (!challengerWallet || challengerWallet.creditBalance < actualEntryFee) {
                res.status(400).json({ error: 'Insufficient credits' });
                return;
            }
            // Check if challenged user is accepting challenges
            if (challengedPresence && challengedPresence.acceptingChallenges === false) {
                res.status(400).json({ error: 'User is not accepting challenges' });
                return;
            }
            // Check limits
            if (pendingChallenges >= settings.maxPendingChallenges) {
                res.status(400).json({ error: `You have too many pending challenges (max: ${settings.maxPendingChallenges})` });
                return;
            }
            if (activeChallenges >= settings.maxActiveChallenges) {
                res.status(400).json({ error: `You have too many active challenges (max: ${settings.maxActiveChallenges})` });
                return;
            }
            if (recentChallenge) {
                res.status(400).json({
                    error: `Please wait ${settings.challengeCooldownMinutes} minutes before challenging this user again`
                });
                return;
            }
        }
        // Calculate prize pool
        const actualEntryFee = entryFee ?? settings?.minEntryFee ?? 10;
        const prizePool = actualEntryFee * 2;
        const platformFeePercentage = settings?.platformFeePercentage ?? 10;
        const platformFeeAmount = Math.floor(prizePool * (platformFeePercentage / 100));
        const winnerPrize = prizePool - platformFeeAmount;
        // Get challenged user name
        let challengedName = `SimUser_${challengedId.slice(-6)}`;
        let challengedEmail = `simuser_${challengedId.slice(-6)}@test.simulator`;
        const slug = `challenge-${(0, nanoid_1.nanoid)(10)}`;
        // Create the challenge
        const challenge = await Challenge.create({
            slug,
            challengerId,
            challengerName,
            challengerEmail,
            challengedId,
            challengedName,
            challengedEmail,
            entryFee: actualEntryFee,
            startingCapital: startingCapital || settings?.defaultStartingCapital || 10000,
            prizePool,
            platformFeePercentage,
            platformFeeAmount,
            winnerPrize,
            acceptDeadline: new Date(Date.now() + (settings?.acceptDeadlineMinutes || 60) * 60 * 1000),
            duration: duration ?? settings?.minDurationMinutes ?? 60,
            status: 'pending',
            assetClasses: assetClasses || settings?.defaultAssetClasses || ['forex'],
            allowedSymbols: [],
            blockedSymbols: [],
            leverage: {
                enabled: (tradingRiskSettings?.maxLeverage || 100) > 1,
                min: tradingRiskSettings?.minLeverage || 1,
                max: tradingRiskSettings?.maxLeverage || 100,
            },
            rules: {
                rankingMethod: rankingMethod || 'pnl',
                tieBreaker1: tieBreaker1 || 'trades_count',
                tieBreaker2: tieBreaker2 || undefined,
                minimumTrades: Math.max(1, minimumTrades || 1),
                disqualifyOnLiquidation: true,
            },
            maxPositionSize: tradingRiskSettings?.maxPositionSize || 100000,
            maxOpenPositions: tradingRiskSettings?.maxOpenPositions || 10,
            allowShortSelling: true,
            marginCallThreshold: 50,
        });
        const duration_ms = Date.now() - startTime;
        if (duration_ms > 300) {
            console.log(`🐢 POST /api/challenges took ${duration_ms}ms`);
        }
        res.status(201).json({
            success: true,
            challenge: {
                _id: challenge._id,
                slug: challenge.slug,
                challengedName: challenge.challengedName,
                entryFee: challenge.entryFee,
                duration: challenge.duration,
                winnerPrize: challenge.winnerPrize,
                acceptDeadline: challenge.acceptDeadline,
                status: challenge.status,
            },
        });
    }
    catch (error) {
        console.error('Error creating challenge:', error);
        if (error instanceof Error && error.message.includes('timed out')) {
            res.status(504).json({ error: 'Request timeout - please try again' });
            return;
        }
        if (error instanceof Error && error.message.includes('duplicate key')) {
            res.status(409).json({ error: 'Challenge already exists - please try again' });
            return;
        }
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});
/**
 * GET /api/challenges/:id
 * Get challenge by ID
 */
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { Challenge } = await getModels();
        const challenge = await Challenge.findById(id).lean();
        if (!challenge) {
            res.status(404).json({ error: 'Challenge not found' });
            return;
        }
        res.json({ challenge });
    }
    catch (error) {
        console.error('Error fetching challenge:', error);
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
});
exports.default = router;
//# sourceMappingURL=challenges.routes.js.map