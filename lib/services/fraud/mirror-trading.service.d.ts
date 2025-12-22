import { IRecentTrade } from '@/database/models/fraud/trading-behavior-profile.model';
import { IMirrorTradingEvidence } from '@/database/models/fraud/behavioral-similarity.model';
/**
 * Mirror Trading Detection Service
 *
 * Detects coordinated or mirrored trading between accounts
 * Flags accounts that trade the same or opposite positions in sync
 */
interface MirrorTradingResult {
    detected: boolean;
    score: number;
    matchingTrades: number;
    timingCorrelation: number;
    directionCorrelation: number;
    evidence: IMirrorTradingEvidence[];
}
export declare class MirrorTradingService {
    private static readonly SYNC_WINDOW_SECONDS;
    private static readonly MIN_MATCHING_TRADES;
    private static readonly DETECTION_THRESHOLD;
    /**
     * Detect mirror trading between two users
     */
    static detectMirrorTrading(userId1: string, userId2: string): Promise<MirrorTradingResult>;
    /**
     * Analyze trade sequences for synchronization patterns
     */
    static analyzeTradeSequence(trades1: IRecentTrade[], trades2: IRecentTrade[]): {
        score: number;
        matchingTrades: number;
        timingCorrelation: number;
        directionCorrelation: number;
        evidence: IMirrorTradingEvidence[];
    };
    /**
     * Find opposite direction trades (hedging across accounts)
     */
    static findOppositeDirectionTrades(userId1: string, userId2: string): Promise<IMirrorTradingEvidence[]>;
    /**
     * Calculate timing correlation between trade sequences
     */
    static calculateTimingCorrelation(trades1: IRecentTrade[], trades2: IRecentTrade[]): number;
    /**
     * Add mirror trading suspect to profile
     */
    private static addMirrorTradingSuspect;
    /**
     * Update behavioral similarity with mirror trading data
     */
    private static updateBehavioralSimilarity;
    /**
     * Run real-time check when a trade is executed
     * Compares against all users who traded the same pair recently
     */
    static checkRealTimeMirrorTrading(userId: string, trade: IRecentTrade): Promise<void>;
    /**
     * Get all mirror trading pairs
     */
    static getAllMirrorTradingPairs(): Promise<{
        userId1: string;
        userId2: string;
        score: number;
        matchingTrades: number;
        directionPattern: string;
        detectedAt: Date;
    }[]>;
}
export {};
//# sourceMappingURL=mirror-trading.service.d.ts.map