"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimilarityDetectionService = void 0;
const trading_behavior_profile_model_1 = __importDefault(require("@/database/models/fraud/trading-behavior-profile.model"));
const behavioral_similarity_model_1 = __importDefault(require("@/database/models/fraud/behavioral-similarity.model"));
const suspicion_scoring_service_1 = require("@/lib/services/fraud/suspicion-scoring.service");
const alert_manager_service_1 = require("@/lib/services/fraud/alert-manager.service");
const mongoose_1 = require("@/database/mongoose");
/**
 * Similarity Detection Service
 *
 * Compares trading behavior profiles to detect multi-accounting
 * Uses cosine similarity and pattern matching
 */
class SimilarityDetectionService {
    /**
     * Calculate cosine similarity between two vectors
     */
    static cosineSimilarity(vector1, vector2) {
        if (vector1.length !== vector2.length)
            return 0;
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
            magnitude1 += vector1[i] * vector1[i];
            magnitude2 += vector2[i] * vector2[i];
        }
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        if (magnitude1 === 0 || magnitude2 === 0)
            return 0;
        return dotProduct / (magnitude1 * magnitude2);
    }
    /**
     * Calculate Jaccard similarity for sets
     */
    static jaccardSimilarity(set1, set2) {
        const intersection = set1.filter(x => set2.includes(x));
        const union = [...new Set([...set1, ...set2])];
        if (union.length === 0)
            return 0;
        return intersection.length / union.length;
    }
    /**
     * Calculate normalized difference (0 = same, 1 = very different)
     */
    static normalizedDifference(val1, val2, maxDiff) {
        const diff = Math.abs(val1 - val2);
        return 1 - Math.min(1, diff / maxDiff);
    }
    /**
     * Calculate similarity between two profiles
     */
    static async calculateSimilarity(userId1, userId2) {
        await (0, mongoose_1.connectToDatabase)();
        console.log(`🔍 Calculating similarity between ${userId1.substring(0, 8)}... and ${userId2.substring(0, 8)}...`);
        // Get profiles
        const profile1 = await trading_behavior_profile_model_1.default.findOne({ userId: userId1 });
        const profile2 = await trading_behavior_profile_model_1.default.findOne({ userId: userId2 });
        if (!profile1 || !profile2) {
            throw new Error('One or both profiles not found');
        }
        // Calculate detailed breakdown
        const breakdown = this.compareTradingPatterns(profile1, profile2);
        // Calculate overall similarity score
        const overallScore = this.calculateOverallScore(breakdown);
        // Find or create similarity record
        const [sortedId1, sortedId2] = [userId1, userId2].sort();
        let similarity = await behavioral_similarity_model_1.default.findOne({
            userId1: sortedId1,
            userId2: sortedId2
        });
        if (!similarity) {
            similarity = new behavioral_similarity_model_1.default({
                userId1: sortedId1,
                userId2: sortedId2,
                firstDetected: new Date()
            });
        }
        // Update similarity record
        similarity.similarityScore = overallScore;
        similarity.similarityBreakdown = breakdown;
        similarity.lastCalculated = new Date();
        similarity.calculationCount += 1;
        // Flag for review if high similarity
        if (overallScore >= this.HIGH_SIMILARITY_THRESHOLD && !similarity.flaggedForReview) {
            similarity.flaggedForReview = true;
            console.log(`🚨 HIGH SIMILARITY DETECTED: ${overallScore.toFixed(2)} between ${userId1} and ${userId2}`);
            // Update suspicion scores
            await suspicion_scoring_service_1.SuspicionScoringService.updateScore(userId1, {
                method: 'tradingSimilarity',
                percentage: 30,
                evidence: `High trading similarity (${(overallScore * 100).toFixed(0)}%) with user ${userId2.substring(0, 12)}...`,
                linkedUserIds: [userId2],
                confidence: overallScore
            });
            await suspicion_scoring_service_1.SuspicionScoringService.updateScore(userId2, {
                method: 'tradingSimilarity',
                percentage: 30,
                evidence: `High trading similarity (${(overallScore * 100).toFixed(0)}%) with user ${userId1.substring(0, 12)}...`,
                linkedUserIds: [userId1],
                confidence: overallScore
            });
            // Create fraud alert
            await alert_manager_service_1.AlertManagerService.createOrUpdateAlert({
                alertType: 'suspicious_behavior',
                userIds: [userId1, userId2],
                title: 'High Trading Similarity Detected',
                description: `Two accounts have ${(overallScore * 100).toFixed(0)}% similar trading patterns`,
                severity: overallScore >= 0.9 ? 'high' : 'medium',
                confidence: overallScore,
                evidence: [{
                        type: 'trading_similarity',
                        description: 'Trading behavior patterns match across accounts',
                        data: {
                            similarityScore: (overallScore * 100).toFixed(1) + '%',
                            pairSimilarity: (breakdown.pairSimilarity * 100).toFixed(1) + '%',
                            timingSimilarity: (breakdown.timingSimilarity * 100).toFixed(1) + '%',
                            sizeSimilarity: (breakdown.sizeSimilarity * 100).toFixed(1) + '%',
                            styleSimilarity: (breakdown.styleScore * 100).toFixed(1) + '%',
                            connectedAccountIds: [userId1, userId2]
                        }
                    }]
            });
        }
        await similarity.save();
        console.log(`✅ Similarity calculated: ${(overallScore * 100).toFixed(1)}%`);
        return similarity;
    }
    /**
     * Compare trading patterns between two profiles
     */
    static compareTradingPatterns(profile1, profile2) {
        const p1 = profile1.patterns;
        const p2 = profile2.patterns;
        // Pair similarity (Jaccard)
        const pairSimilarity = this.jaccardSimilarity(p1.preferredPairs || [], p2.preferredPairs || []);
        // Timing similarity (cosine of hour distribution)
        const timingSimilarity = this.cosineSimilarity(p1.tradingHoursDistribution || Array(24).fill(0), p2.tradingHoursDistribution || Array(24).fill(0));
        // Size similarity (normalized difference)
        const sizeSimilarity = this.normalizedDifference(p1.avgTradeSize || 0, p2.avgTradeSize || 0, 10 // max difference of 10 lots
        );
        // Duration similarity
        const durationSimilarity = this.normalizedDifference(p1.avgTradeDuration || 0, p2.avgTradeDuration || 0, 480 // max difference of 8 hours
        );
        // Risk management similarity
        const slSimilarity = this.normalizedDifference(p1.avgStopLoss || 0, p2.avgStopLoss || 0, 50 // max difference of 50 pips
        );
        const tpSimilarity = this.normalizedDifference(p1.avgTakeProfit || 0, p2.avgTakeProfit || 0, 100 // max difference of 100 pips
        );
        const riskSimilarity = (slSimilarity + tpSimilarity) / 2;
        // Trading style similarity
        const styleScore = 1 - Math.sqrt(Math.pow((p1.scalperScore || 0) - (p2.scalperScore || 0), 2) +
            Math.pow((p1.dayTraderScore || 0) - (p2.dayTraderScore || 0), 2) +
            Math.pow((p1.swingScore || 0) - (p2.swingScore || 0), 2)) / Math.sqrt(3);
        // Behavioral fingerprint distance
        const fingerprintDistance = this.cosineSimilarity(profile1.behavioralFingerprint || Array(32).fill(0), profile2.behavioralFingerprint || Array(32).fill(0));
        return {
            pairSimilarity,
            timingSimilarity,
            sizeSimilarity,
            durationSimilarity,
            riskSimilarity,
            styleScore: Math.max(0, styleScore),
            fingerprintDistance
        };
    }
    /**
     * Calculate overall similarity score from breakdown
     */
    static calculateOverallScore(breakdown) {
        // Weighted average
        const weights = {
            pairSimilarity: 0.15,
            timingSimilarity: 0.15,
            sizeSimilarity: 0.15,
            durationSimilarity: 0.10,
            riskSimilarity: 0.10,
            styleScore: 0.15,
            fingerprintDistance: 0.20
        };
        let score = 0;
        score += breakdown.pairSimilarity * weights.pairSimilarity;
        score += breakdown.timingSimilarity * weights.timingSimilarity;
        score += breakdown.sizeSimilarity * weights.sizeSimilarity;
        score += breakdown.durationSimilarity * weights.durationSimilarity;
        score += breakdown.riskSimilarity * weights.riskSimilarity;
        score += breakdown.styleScore * weights.styleScore;
        score += breakdown.fingerprintDistance * weights.fingerprintDistance;
        return Math.min(1, Math.max(0, score));
    }
    /**
     * Find all high-similarity account pairs
     */
    static async detectHighSimilarity(threshold = 0.7) {
        await (0, mongoose_1.connectToDatabase)();
        return behavioral_similarity_model_1.default.find({
            similarityScore: { $gte: threshold }
        }).sort({ similarityScore: -1 });
    }
    /**
     * Run similarity analysis for all active profiles
     */
    static async runFullAnalysis() {
        await (0, mongoose_1.connectToDatabase)();
        console.log('🔄 Starting full similarity analysis...');
        // Get all profiles with sufficient data
        const profiles = await trading_behavior_profile_model_1.default.find({
            totalTradesAnalyzed: { $gte: 5 }
        });
        console.log(`📊 Found ${profiles.length} profiles to analyze`);
        let pairsCompared = 0;
        let highSimilarityPairs = 0;
        // Compare all pairs
        for (let i = 0; i < profiles.length; i++) {
            for (let j = i + 1; j < profiles.length; j++) {
                try {
                    const similarity = await this.calculateSimilarity(profiles[i].userId.toString(), profiles[j].userId.toString());
                    pairsCompared++;
                    if (similarity.similarityScore >= this.SIMILARITY_THRESHOLD) {
                        highSimilarityPairs++;
                    }
                    // Log progress every 100 pairs
                    if (pairsCompared % 100 === 0) {
                        console.log(`   Compared ${pairsCompared} pairs...`);
                    }
                }
                catch (error) {
                    console.error(`Error comparing ${profiles[i].userId} and ${profiles[j].userId}:`, error);
                }
            }
        }
        console.log(`✅ Analysis complete: ${pairsCompared} pairs compared, ${highSimilarityPairs} high similarity pairs found`);
        return {
            profilesAnalyzed: profiles.length,
            pairsCompared,
            highSimilarityPairs
        };
    }
    /**
     * Get similarity matrix for visualization
     */
    static async getSimilarityMatrix(userIds) {
        await (0, mongoose_1.connectToDatabase)();
        const matrix = [];
        for (let i = 0; i < userIds.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < userIds.length; j++) {
                if (i === j) {
                    matrix[i][j] = 1; // Self-similarity is 1
                }
                else if (j < i) {
                    matrix[i][j] = matrix[j][i]; // Symmetric
                }
                else {
                    const [sortedId1, sortedId2] = [userIds[i], userIds[j]].sort();
                    const similarity = await behavioral_similarity_model_1.default.findOne({
                        userId1: sortedId1,
                        userId2: sortedId2
                    });
                    matrix[i][j] = similarity?.similarityScore || 0;
                }
            }
        }
        return matrix;
    }
}
exports.SimilarityDetectionService = SimilarityDetectionService;
// Threshold for flagging accounts as suspicious (lowered for testing)
SimilarityDetectionService.SIMILARITY_THRESHOLD = 0.5;
SimilarityDetectionService.HIGH_SIMILARITY_THRESHOLD = 0.7;
