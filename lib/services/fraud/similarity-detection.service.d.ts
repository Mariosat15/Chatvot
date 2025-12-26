import { ITradingBehaviorProfile } from '@/database/models/fraud/trading-behavior-profile.model';
import { IBehavioralSimilarity, ISimilarityBreakdown } from '@/database/models/fraud/behavioral-similarity.model';
/**
 * Similarity Detection Service
 *
 * Compares trading behavior profiles to detect multi-accounting
 * Uses cosine similarity and pattern matching
 */
export declare class SimilarityDetectionService {
    private static readonly SIMILARITY_THRESHOLD;
    private static readonly HIGH_SIMILARITY_THRESHOLD;
    /**
     * Calculate cosine similarity between two vectors
     */
    static cosineSimilarity(vector1: number[], vector2: number[]): number;
    /**
     * Calculate Jaccard similarity for sets
     */
    static jaccardSimilarity(set1: string[], set2: string[]): number;
    /**
     * Calculate normalized difference (0 = same, 1 = very different)
     */
    static normalizedDifference(val1: number, val2: number, maxDiff: number): number;
    /**
     * Calculate similarity between two profiles
     */
    static calculateSimilarity(userId1: string, userId2: string): Promise<IBehavioralSimilarity>;
    /**
     * Compare trading patterns between two profiles
     */
    static compareTradingPatterns(profile1: ITradingBehaviorProfile, profile2: ITradingBehaviorProfile): ISimilarityBreakdown;
    /**
     * Calculate overall similarity score from breakdown
     */
    private static calculateOverallScore;
    /**
     * Find all high-similarity account pairs
     */
    static detectHighSimilarity(threshold?: number): Promise<IBehavioralSimilarity[]>;
    /**
     * Run similarity analysis for all active profiles
     */
    static runFullAnalysis(): Promise<{
        profilesAnalyzed: number;
        pairsCompared: number;
        highSimilarityPairs: number;
    }>;
    /**
     * Get similarity matrix for visualization
     */
    static getSimilarityMatrix(userIds: string[]): Promise<number[][]>;
}
//# sourceMappingURL=similarity-detection.service.d.ts.map