import mongoose, { Document } from 'mongoose';
/**
 * Trading Behavior Profile Model
 *
 * Tracks individual user's trading patterns for fraud detection
 * Used to identify multi-accounting through similar trading behaviors
 */
export interface ITradingPattern {
    preferredPairs: string[];
    tradingHoursDistribution: number[];
    avgTradeSize: number;
    avgTradeDuration: number;
    avgStopLoss: number;
    avgTakeProfit: number;
    winRate: number;
    profitFactor: number;
    avgTradesPerDay: number;
    maxConcurrentPositions: number;
    riskPerTrade: number;
    scalperScore: number;
    swingScore: number;
    dayTraderScore: number;
}
export interface IRecentTrade {
    tradeId: string;
    pair: string;
    direction: 'buy' | 'sell';
    openTime: Date;
    closeTime?: Date;
    duration?: number;
    lotSize: number;
    pnl?: number;
    pips?: number;
    stopLoss?: number;
    takeProfit?: number;
}
export interface IMirrorTradingSuspect {
    pairedUserId: mongoose.Types.ObjectId;
    detectedAt: Date;
    matchingTrades: number;
    timingCorrelation: number;
    directionCorrelation: number;
    confidence: number;
}
export interface ITradingBehaviorProfile extends Document {
    userId: mongoose.Types.ObjectId;
    lastUpdated: Date;
    totalTradesAnalyzed: number;
    patterns: ITradingPattern;
    behavioralFingerprint: number[];
    recentTradeSequence: IRecentTrade[];
    mirrorTradingSuspects: IMirrorTradingSuspect[];
    competitionEntryTimes: Date[];
    avgTimeToFirstTrade: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const TradingBehaviorProfile: mongoose.Model<any, {}, {}, {}, any, any>;
export default TradingBehaviorProfile;
//# sourceMappingURL=trading-behavior-profile.model.d.ts.map