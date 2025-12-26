import { ITradingBehaviorProfile } from '@/database/models/fraud/trading-behavior-profile.model';
/**
 * Behavioral Analysis Service
 *
 * Analyzes and tracks user trading patterns for fraud detection
 * Creates behavioral fingerprints for similarity comparison
 */
interface TradeData {
    tradeId: string;
    pair: string;
    direction: 'buy' | 'sell';
    openTime: Date;
    closeTime?: Date;
    lotSize: number;
    pnl?: number;
    pips?: number;
    stopLoss?: number;
    takeProfit?: number;
    entryPrice?: number;
    exitPrice?: number;
}
export declare class BehavioralAnalysisService {
    /**
     * Get or create trading behavior profile for a user
     */
    static getOrCreateProfile(userId: string): Promise<ITradingBehaviorProfile>;
    /**
     * Update profile when a trade is closed
     */
    static updateProfileOnTrade(userId: string, trade: TradeData): Promise<void>;
    /**
     * Recalculate trading patterns from recent trades
     */
    private static recalculatePatterns;
    /**
     * Calculate scalper score (short duration trades, many trades)
     */
    private static calculateScalperScore;
    /**
     * Calculate day trader score (closes within same day)
     */
    private static calculateDayTraderScore;
    /**
     * Calculate swing trader score (holds for days)
     */
    private static calculateSwingScore;
    /**
     * Generate behavioral fingerprint (32-dimension vector)
     */
    private static generateBehavioralFingerprint;
    /**
     * Get preferred trading pairs for a user
     */
    static getPreferredPairs(userId: string): Promise<string[]>;
    /**
     * Get trading hours distribution for a user
     */
    static getTradingHours(userId: string): Promise<number[]>;
    /**
     * Get average trade statistics
     */
    static getAverageTradeStats(userId: string): Promise<{
        avgSize: number;
        avgDuration: number;
        avgStopLoss: number;
        avgTakeProfit: number;
        winRate: number;
        profitFactor: number;
        tradesPerDay: number;
    }>;
    /**
     * Get trading style classification
     */
    static getTradingStyle(userId: string): Promise<{
        primaryStyle: 'scalper' | 'dayTrader' | 'swing' | 'unknown';
        scalperScore: number;
        dayTraderScore: number;
        swingScore: number;
    }>;
    /**
     * Get all profiles for similarity analysis
     */
    static getAllProfiles(): Promise<ITradingBehaviorProfile[]>;
    /**
     * Get profile summary for admin display
     */
    static getProfileSummary(userId: string): Promise<{
        userId: string;
        totalTrades: number;
        preferredPairs: string[];
        tradingStyle: string;
        winRate: number;
        avgDuration: string;
        riskLevel: string;
        lastUpdated: Date;
    }>;
    /**
     * Record competition entry for coordination detection
     */
    static recordCompetitionEntry(userId: string): Promise<void>;
}
export {};
//# sourceMappingURL=behavioral-analysis.service.d.ts.map