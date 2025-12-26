import mongoose, { Document } from 'mongoose';
/**
 * Behavioral Similarity Model
 *
 * Stores similarity scores between pairs of users
 * Used to detect multi-accounting through trading behavior patterns
 */
export interface ISimilarityBreakdown {
    pairSimilarity: number;
    timingSimilarity: number;
    sizeSimilarity: number;
    durationSimilarity: number;
    riskSimilarity: number;
    styleScore: number;
    fingerprintDistance: number;
}
export interface IMirrorTradingEvidence {
    tradeId1: string;
    tradeId2: string;
    pair: string;
    timeDelta: number;
    direction1: 'buy' | 'sell';
    direction2: 'buy' | 'sell';
    isOpposite: boolean;
    isSameTime: boolean;
    detectedAt: Date;
}
export interface IBehavioralSimilarity extends Document {
    userId1: mongoose.Types.ObjectId;
    userId2: mongoose.Types.ObjectId;
    similarityScore: number;
    similarityBreakdown: ISimilarityBreakdown;
    mirrorTradingDetected: boolean;
    mirrorTradingScore: number;
    mirrorTradingEvidence: IMirrorTradingEvidence[];
    flaggedForReview: boolean;
    reviewedAt?: Date;
    reviewedBy?: string;
    reviewNotes?: string;
    firstDetected: Date;
    lastCalculated: Date;
    calculationCount: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const BehavioralSimilarity: mongoose.Model<any, {}, {}, {}, any, any>;
export default BehavioralSimilarity;
//# sourceMappingURL=behavioral-similarity.model.d.ts.map