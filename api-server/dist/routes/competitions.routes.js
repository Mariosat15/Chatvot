"use strict";
/**
 * Competitions Routes - MIGRATED FROM NEXT.JS
 *
 * Heavy routes for competition operations:
 * - Listing competitions
 * - Joining competitions (wallet operations)
 * - Leaderboards
 *
 * Original: app/api/competitions/*
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
// Timeouts
const DB_TIMEOUT_MS = 3000;
// Helper function for timeout
function withTimeout(promise, ms, name) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)),
    ]);
}
// Get models - with lazy loading fallback
const getModels = async () => {
    // Try to get from mongoose.models first (pre-loaded)
    if (mongoose_1.default.models.Competition) {
        return {
            Competition: mongoose_1.default.models.Competition,
            CompetitionParticipant: mongoose_1.default.models.CompetitionParticipant,
            CreditWallet: mongoose_1.default.models.CreditWallet,
            WalletTransaction: mongoose_1.default.models.WalletTransaction,
        };
    }
    // Fallback: lazy load models
    console.log('⚠️ Models not pre-loaded, lazy loading...');
    const [CompetitionModule, ParticipantModule, WalletModule, TransactionModule] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/competition.model'))),
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/competition-participant.model'))),
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/credit-wallet.model'))),
        Promise.resolve().then(() => __importStar(require('../../database/models/trading/wallet-transaction.model'))),
    ]);
    return {
        Competition: CompetitionModule.default,
        CompetitionParticipant: ParticipantModule.default,
        CreditWallet: WalletModule.default,
        WalletTransaction: TransactionModule.default,
    };
};
/**
 * GET /api/competitions
 * List all competitions
 */
router.get('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { Competition, CompetitionParticipant } = await getModels();
        // Fetch all non-draft competitions
        const competitions = await withTimeout(Competition.find({ status: { $ne: 'draft' } })
            .sort({ startTime: -1 })
            .lean()
            .exec(), DB_TIMEOUT_MS, 'Competition.find');
        // Get user's participation status if logged in
        let userInCompetitionIds = [];
        if (userId) {
            const participations = await CompetitionParticipant.find({
                userId,
                status: { $in: ['active', 'completed'] }
            }).select('competitionId').lean();
            userInCompetitionIds = participations.map((p) => p.competitionId.toString());
        }
        res.json({
            competitions,
            userInCompetitionIds,
        });
    }
    catch (error) {
        console.error('Error fetching competitions:', error);
        res.status(500).json({ error: 'Failed to fetch competitions' });
    }
});
/**
 * GET /api/competitions/:id
 * Get competition by ID
 */
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { Competition, CompetitionParticipant } = await getModels();
        const competition = await Competition.findById(id).lean();
        if (!competition) {
            res.status(404).json({ error: 'Competition not found' });
            return;
        }
        // Check if user is participating
        let isParticipating = false;
        let participant = null;
        if (req.user?.id) {
            participant = await CompetitionParticipant.findOne({
                competitionId: id,
                userId: req.user.id,
            }).lean();
            isParticipating = !!participant;
        }
        res.json({
            competition,
            isParticipating,
            participant,
        });
    }
    catch (error) {
        console.error('Error fetching competition:', error);
        res.status(500).json({ error: 'Failed to fetch competition' });
    }
});
/**
 * POST /api/competitions/:id/join
 * Join a competition
 */
router.post('/:id/join', async (req, res) => {
    try {
        const { id: competitionId } = req.params;
        // Check for simulator mode
        const isSimulatorMode = req.headers['x-simulator-mode'] === 'true';
        const simulatorUserId = req.headers['x-simulator-user-id'];
        const isDev = process.env.NODE_ENV === 'development';
        let userId;
        let userEmail;
        let userName;
        if ((isSimulatorMode || simulatorUserId) && isDev) {
            // Simulator mode
            const bodyUserId = req.body?.userId;
            const simUserId = simulatorUserId || bodyUserId;
            if (!simUserId) {
                res.status(400).json({ success: false, error: 'userId required in simulator mode' });
                return;
            }
            userId = simUserId;
            userEmail = `simuser_${userId.slice(-6)}@test.simulator`;
            userName = `SimUser_${userId.slice(-6)}`;
        }
        else {
            // Normal mode - require authentication
            const authReq = req;
            if (!authReq.user?.id) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            userId = authReq.user.id;
            userEmail = authReq.user.email || '';
            userName = authReq.user.name || 'Unknown';
        }
        const { Competition, CompetitionParticipant, CreditWallet, WalletTransaction } = await getModels();
        // Check if competition exists and is joinable
        const competition = await Competition.findById(competitionId);
        if (!competition) {
            res.status(404).json({ success: false, error: 'Competition not found' });
            return;
        }
        if (competition.status !== 'upcoming' && competition.status !== 'active') {
            res.status(400).json({ success: false, error: 'Competition is not accepting participants' });
            return;
        }
        if (competition.currentParticipants >= competition.maxParticipants) {
            res.status(400).json({ success: false, error: 'Competition is full' });
            return;
        }
        // Check if already joined
        const existingParticipant = await CompetitionParticipant.findOne({
            competitionId,
            userId,
        });
        if (existingParticipant) {
            res.json({
                success: true,
                message: 'Already joined',
                participantId: existingParticipant._id.toString(),
            });
            return;
        }
        // Check balance first (before starting transaction)
        if (competition.entryFee > 0) {
            const wallet = await CreditWallet.findOne({ userId });
            if (!wallet || wallet.creditBalance < competition.entryFee) {
                res.status(400).json({ success: false, error: 'Insufficient balance' });
                return;
            }
        }
        // Use MongoDB transaction for atomic operations
        // This ensures user doesn't lose money if participant creation fails
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        let participantId;
        try {
            // Deduct entry fee within transaction
            if (competition.entryFee > 0) {
                const wallet = await CreditWallet.findOne({ userId }).session(session);
                if (!wallet) {
                    throw new Error('Wallet not found');
                }
                const balanceBefore = wallet.creditBalance;
                wallet.creditBalance -= competition.entryFee;
                wallet.totalSpentOnCompetitions += competition.entryFee;
                await wallet.save({ session });
                // Record transaction
                const transaction = new WalletTransaction({
                    userId,
                    transactionType: 'competition_entry',
                    amount: -competition.entryFee,
                    balanceBefore,
                    balanceAfter: wallet.creditBalance,
                    currency: 'EUR',
                    exchangeRate: 1,
                    status: 'completed',
                    competitionId,
                    description: `Entry fee for ${competition.name}`,
                    processedAt: new Date(),
                });
                await transaction.save({ session });
            }
            // Create participant within transaction
            const participant = new CompetitionParticipant({
                competitionId,
                userId,
                username: userName,
                email: userEmail,
                startingCapital: competition.startingCapital,
                currentCapital: competition.startingCapital,
                availableCapital: competition.startingCapital,
                usedMargin: 0,
                pnl: 0,
                pnlPercentage: 0,
                realizedPnl: 0,
                unrealizedPnl: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                averageWin: 0,
                averageLoss: 0,
                largestWin: 0,
                largestLoss: 0,
                currentOpenPositions: 0,
                maxDrawdown: 0,
                maxDrawdownPercentage: 0,
                currentRank: 0,
                highestRank: 0,
                status: 'active',
                marginCallWarnings: 0,
                enteredAt: new Date(),
            });
            await participant.save({ session });
            participantId = participant._id.toString();
            // Update competition participant count within transaction
            await Competition.findByIdAndUpdate(competitionId, { $inc: { currentParticipants: 1 } }, { session });
            // Commit transaction - all operations succeed together
            await session.commitTransaction();
        }
        catch (txError) {
            // Rollback transaction - user keeps their money if anything fails
            await session.abortTransaction();
            console.error('Competition join transaction failed:', txError);
            throw txError;
        }
        finally {
            session.endSession();
        }
        res.json({
            success: true,
            participantId,
            competition: {
                name: competition.name,
                startingCapital: competition.startingCapital,
            },
        });
    }
    catch (error) {
        console.error('Competition join error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
/**
 * GET /api/competitions/:id/leaderboard
 * Get competition leaderboard
 */
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const { CompetitionParticipant } = await getModels();
        const leaderboard = await withTimeout(CompetitionParticipant.find({ competitionId: id, status: 'active' })
            .sort({ pnl: -1 })
            .limit(limit)
            .select('userId username pnl pnlPercentage currentCapital totalTrades winRate currentRank')
            .lean()
            .exec(), DB_TIMEOUT_MS, 'Leaderboard fetch');
        res.json({ leaderboard });
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
exports.default = router;
//# sourceMappingURL=competitions.routes.js.map