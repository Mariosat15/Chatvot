"use strict";
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
exports.SuspicionScoringService = void 0;
const suspicion_score_model_1 = __importDefault(require("@/database/models/fraud/suspicion-score.model"));
const fraud_alert_model_1 = __importDefault(require("@/database/models/fraud/fraud-alert.model"));
const user_restriction_model_1 = __importDefault(require("@/database/models/user-restriction.model"));
const fraud_settings_model_1 = __importStar(require("@/database/models/fraud/fraud-settings.model"));
const mongoose_1 = require("@/database/mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const fraud_history_service_1 = require("./fraud-history.service");
const user_lookup_1 = require("@/lib/utils/user-lookup");
class SuspicionScoringService {
    /**
     * Get or create suspicion score for a user
     */
    static async getOrCreateScore(userId) {
        await (0, mongoose_1.connectToDatabase)();
        let score = await suspicion_score_model_1.default.findOne({ userId });
        if (!score) {
            score = await suspicion_score_model_1.default.create({
                userId,
                totalScore: 0,
                riskLevel: 'low',
                scoreBreakdown: {},
                linkedAccounts: [],
                scoreHistory: []
            });
            console.log(`✅ Created new suspicion score for user ${userId}`);
        }
        return score;
    }
    /**
     * Update fraud detection score for a user
     */
    static async updateScore(userId, update) {
        await (0, mongoose_1.connectToDatabase)();
        const score = await this.getOrCreateScore(userId);
        const oldScore = score.totalScore;
        const oldRiskLevel = score.riskLevel;
        // Add percentage using model method
        score.addPercentage(update.method, update.percentage, update.evidence);
        // Add linked accounts if provided
        if (update.linkedUserIds && update.linkedUserIds.length > 0) {
            for (const linkedUserId of update.linkedUserIds) {
                if (linkedUserId !== userId) {
                    score.addLinkedAccount(new mongoose_2.default.Types.ObjectId(linkedUserId), update.method, update.confidence || 0.85);
                }
            }
        }
        await score.save();
        console.log(`📊 Updated suspicion score for user ${userId}:`);
        console.log(`   Method: ${update.method}`);
        console.log(`   Percentage Added: +${update.percentage}%`);
        console.log(`   Old Score: ${oldScore} → New Score: ${score.totalScore}`);
        console.log(`   Risk Level: ${oldRiskLevel} → ${score.riskLevel}`);
        // Check if crossed threshold
        if (oldRiskLevel !== score.riskLevel) {
            console.log(`⚠️ RISK LEVEL CHANGED: ${oldRiskLevel} → ${score.riskLevel}`);
            // Check if auto-suspend is enabled in fraud settings before auto-restricting
            if ((score.riskLevel === 'critical' || score.riskLevel === 'high') && !score.autoRestrictedAt) {
                await this.checkAndAutoRestrictUser(userId, score);
            }
        }
        return score;
    }
    /**
     * Update scores for multiple users (e.g., all linked accounts)
     */
    static async updateScoresForMultipleUsers(userIds, update, linkedUserIds) {
        const scores = [];
        for (const userId of userIds) {
            const score = await this.updateScore(userId, {
                ...update,
                linkedUserIds: linkedUserIds.filter(id => id !== userId)
            });
            scores.push(score);
        }
        return scores;
    }
    /**
     * Device Match Detection (+40%)
     */
    static async scoreDeviceMatch(userIds, fingerprintId, deviceInfo) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'deviceMatch',
            percentage: this.PERCENTAGE_VALUES.deviceMatch,
            evidence: `Same device detected (${deviceInfo}) - Fingerprint: ${fingerprintId.substring(0, 12)}...`
        }, userIds);
    }
    /**
     * IP Match Detection (+30%)
     */
    static async scoreIPMatch(userIds, ipAddress) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'ipMatch',
            percentage: this.PERCENTAGE_VALUES.ipMatch,
            evidence: `Same IP address detected: ${ipAddress}`
        }, userIds);
    }
    /**
     * IP + Browser Match Detection (+35%)
     */
    static async scoreIPBrowserMatch(userIds, ipAddress, browser) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'ipBrowserMatch',
            percentage: this.PERCENTAGE_VALUES.ipBrowserMatch,
            evidence: `Same IP (${ipAddress}) and browser (${browser}) detected`
        }, userIds);
    }
    /**
     * Timezone + Language Match Detection (+10%)
     */
    static async scoreTimezoneLanguage(userIds, timezone, language) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'timezoneLanguage',
            percentage: this.PERCENTAGE_VALUES.timezoneLanguage,
            evidence: `Same timezone (${timezone}) and language (${language})`
        }, userIds);
    }
    /**
     * Calculate score for same payment method
     */
    static async scorePaymentMatch(userIds, paymentProvider, paymentFingerprint) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'samePayment',
            percentage: this.PERCENTAGE_VALUES.samePayment,
            evidence: `Same payment method detected (${paymentProvider}) - Fingerprint: ${paymentFingerprint.substring(0, 12)}...`
        }, userIds);
    }
    /**
     * Calculate score for rapid account creation
     */
    static async scoreRapidCreation(userIds, timeWindowMinutes) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'rapidCreation',
            percentage: this.PERCENTAGE_VALUES.rapidCreation,
            evidence: `Multiple accounts created within ${timeWindowMinutes} minutes`
        }, userIds);
    }
    /**
     * Calculate score for coordinated competition entry
     */
    static async scoreCoordinatedEntry(userIds, competitionId, timeWindowMinutes) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'coordinatedEntry',
            percentage: this.PERCENTAGE_VALUES.coordinatedEntry,
            evidence: `Coordinated competition entry within ${timeWindowMinutes} minutes (Competition: ${competitionId.substring(0, 12)}...)`
        }, userIds);
    }
    /**
     * Calculate score for trading similarity
     */
    static async scoreTradingSimilarity(userId1, userId2, similarityPercentage) {
        const evidence = `${similarityPercentage}% trading pattern similarity detected`;
        await Promise.all([
            this.updateScore(userId1, {
                method: 'tradingSimilarity',
                percentage: this.PERCENTAGE_VALUES.tradingSimilarity,
                evidence,
                linkedUserIds: [userId2]
            }),
            this.updateScore(userId2, {
                method: 'tradingSimilarity',
                percentage: this.PERCENTAGE_VALUES.tradingSimilarity,
                evidence,
                linkedUserIds: [userId1]
            })
        ]);
    }
    /**
     * Calculate score for mirror trading
     */
    static async scoreMirrorTrading(userId1, userId2, matchRate) {
        const evidence = `Mirror trading detected (${Math.round(matchRate * 100)}% opposite trades)`;
        await Promise.all([
            this.updateScore(userId1, {
                method: 'mirrorTrading',
                percentage: this.PERCENTAGE_VALUES.mirrorTrading,
                evidence,
                linkedUserIds: [userId2]
            }),
            this.updateScore(userId2, {
                method: 'mirrorTrading',
                percentage: this.PERCENTAGE_VALUES.mirrorTrading,
                evidence,
                linkedUserIds: [userId1]
            })
        ]);
    }
    /**
     * Calculate score for same city/location
     */
    static async scoreSameCity(userIds, city, distanceKm) {
        await this.updateScoresForMultipleUsers(userIds, {
            method: 'sameCity',
            percentage: this.PERCENTAGE_VALUES.sameCity,
            evidence: `Accounts within ${distanceKm}km (${city})`
        }, userIds);
    }
    /**
     * Calculate score for unusual device switching
     */
    static async scoreDeviceSwitching(userId, deviceCount, timeWindowHours) {
        await this.updateScore(userId, {
            method: 'deviceSwitching',
            percentage: this.PERCENTAGE_VALUES.deviceSwitching,
            evidence: `Used ${deviceCount} different devices within ${timeWindowHours} hours`
        });
    }
    /**
     * Get suspicion score for a user (plain object, no methods)
     */
    static async getScore(userId) {
        await (0, mongoose_1.connectToDatabase)();
        return await suspicion_score_model_1.default.findOne({ userId }).lean();
    }
    /**
     * Get all high-risk users (plain objects, no methods)
     */
    static async getHighRiskUsers() {
        await (0, mongoose_1.connectToDatabase)();
        return await suspicion_score_model_1.default.find({
            riskLevel: { $in: ['high', 'critical'] }
        }).sort({ totalScore: -1 }).lean();
    }
    /**
     * Get users by risk level (plain objects, no methods)
     */
    static async getUsersByRiskLevel(level) {
        await (0, mongoose_1.connectToDatabase)();
        return await suspicion_score_model_1.default.find({ riskLevel: level }).sort({ totalScore: -1 }).lean();
    }
    /**
     * Reset score for a user
     */
    static async resetScore(userId) {
        await (0, mongoose_1.connectToDatabase)();
        const score = await this.getOrCreateScore(userId);
        score.resetScore();
        await score.save();
        console.log(`🔄 Reset suspicion score for user ${userId}`);
        return score;
    }
    /**
     * Get fraud settings (singleton pattern)
     */
    static async getFraudSettings() {
        await (0, mongoose_1.connectToDatabase)();
        let settings = await fraud_settings_model_1.default.findOne();
        if (!settings) {
            // Create default settings if none exist
            settings = await fraud_settings_model_1.default.create(fraud_settings_model_1.DEFAULT_FRAUD_SETTINGS);
        }
        return settings;
    }
    /**
     * Check fraud settings and auto-restrict user if enabled
     * This respects admin settings - no auto-restriction unless explicitly enabled
     */
    static async checkAndAutoRestrictUser(userId, score) {
        try {
            // Get fraud settings to check if auto-suspend is enabled
            const settings = await this.getFraudSettings();
            // ⚠️ IMPORTANT: Only auto-restrict if admin has explicitly enabled it
            if (!settings.autoSuspendEnabled) {
                console.log(`⏭️ Auto-suspend is DISABLED in admin settings. User ${userId} NOT auto-restricted.`);
                console.log(`   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`);
                console.log(`   To enable auto-suspension, admin must enable it in Fraud Settings.`);
                return;
            }
            // Check if score meets auto-suspend threshold
            if (score.totalScore < settings.autoSuspendThreshold) {
                console.log(`⏭️ User ${userId} score (${score.totalScore}) below auto-suspend threshold (${settings.autoSuspendThreshold}). Not auto-restricting.`);
                return;
            }
            // Check if already restricted
            const existingRestriction = await user_restriction_model_1.default.findOne({
                userId,
                isActive: true
            });
            if (existingRestriction) {
                console.log(`⏭️ User ${userId} already restricted, skipping auto-restriction`);
                return;
            }
            // Auto-suspend enabled and threshold met - create restriction
            console.log(`🚨 AUTO-SUSPEND ENABLED: Restricting user ${userId}`);
            console.log(`   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`);
            await user_restriction_model_1.default.create({
                userId,
                restrictionType: 'suspended',
                reason: 'automated_fraud_detection',
                customReason: `Automatically suspended: Suspicion score (${score.totalScore}%) exceeded auto-suspend threshold (${settings.autoSuspendThreshold}%). Admin has enabled auto-suspension in fraud settings.`,
                canTrade: false,
                canEnterCompetitions: false,
                canDeposit: false,
                canWithdraw: false,
                restrictedBy: 'SYSTEM', // System restriction
                relatedFraudAlertId: null,
                relatedUserIds: score.linkedAccounts.map(acc => acc.userId),
                isActive: true,
                suspensionEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
            // Update score
            score.autoRestrictedAt = new Date();
            score.autoRestrictionReason = `Auto-suspended: Score ${score.totalScore}% exceeded threshold ${settings.autoSuspendThreshold}%`;
            await score.save();
            // Create fraud alert for admin review
            const alert = await fraud_alert_model_1.default.create({
                alertType: 'high_risk_device',
                severity: 'critical',
                status: 'investigating',
                primaryUserId: userId,
                suspiciousUserIds: [userId, ...score.linkedAccounts.map(acc => acc.userId.toString())],
                confidence: 0.95,
                title: 'AUTO-SUSPENSION: Score Threshold Exceeded',
                description: `User automatically suspended. Score: ${score.totalScore}% exceeded threshold: ${settings.autoSuspendThreshold}%. Admin review required.`,
                evidence: [
                    {
                        type: 'suspicion_score',
                        description: 'Auto-suspension triggered by admin-configured threshold',
                        data: {
                            totalScore: score.totalScore,
                            riskLevel: score.riskLevel,
                            autoSuspendEnabled: true,
                            autoSuspendThreshold: settings.autoSuspendThreshold,
                            breakdown: score.scoreBreakdown,
                            linkedAccounts: score.linkedAccounts.length,
                            autoRestricted: true,
                            message: 'Admin has enabled auto-suspension in Fraud Settings'
                        }
                    }
                ]
            });
            // Log to fraud history
            const user = await (0, user_lookup_1.getUserById)(userId);
            if (user) {
                await fraud_history_service_1.FraudHistoryService.logAutoAction({
                    userId,
                    email: user.email,
                    name: user.name,
                }, `Auto-suspended: Score ${score.totalScore}% exceeded threshold ${settings.autoSuspendThreshold}%`, `User automatically suspended by system. Suspicion score (${score.totalScore}%) exceeded the admin-configured auto-suspend threshold (${settings.autoSuspendThreshold}%). ` +
                    `Risk level: ${score.riskLevel}. Linked accounts: ${score.linkedAccounts.length}. ` +
                    `Suspension duration: 7 days. Admin review required.`, 'critical', { accountStatus: 'active', suspicionScore: score.totalScore }, { accountStatus: 'suspended', suspicionScore: score.totalScore });
            }
            console.log(`🚨 AUTO-SUSPENDED user ${userId} - Score: ${score.totalScore}%/${settings.autoSuspendThreshold}% threshold`);
        }
        catch (error) {
            console.error(`❌ Failed to check/auto-restrict user ${userId}:`, error);
        }
    }
    /**
     * Get score statistics
     */
    static async getStatistics() {
        await (0, mongoose_1.connectToDatabase)();
        const scores = await suspicion_score_model_1.default.find().lean();
        return {
            total: scores.length,
            low: scores.filter(s => s.riskLevel === 'low').length,
            medium: scores.filter(s => s.riskLevel === 'medium').length,
            high: scores.filter(s => s.riskLevel === 'high').length,
            critical: scores.filter(s => s.riskLevel === 'critical').length,
            averageScore: scores.length > 0
                ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
                : 0
        };
    }
}
exports.SuspicionScoringService = SuspicionScoringService;
/**
 * Percentage values for each detection method (0-100%)
 * Each method contributes up to this percentage to the overall score
 */
SuspicionScoringService.PERCENTAGE_VALUES = {
    deviceMatch: 40, // 40% for same device detection
    ipMatch: 30, // 30% for same IP address
    ipBrowserMatch: 35, // 35% for same IP + Browser
    sameCity: 15, // 15% for same geographic location
    samePayment: 30, // 30% for same payment method
    rapidCreation: 20, // 20% for rapid account creation
    coordinatedEntry: 25, // 25% for coordinated competition entry
    tradingSimilarity: 30, // 30% for similar trading patterns
    mirrorTrading: 35, // 35% for mirror trading detection
    timezoneLanguage: 10, // 10% for same timezone + language
    deviceSwitching: 15 // 15% for unusual device switching
};
/**
 * Risk thresholds
 */
SuspicionScoringService.THRESHOLDS = {
    medium: 30,
    high: 50,
    critical: 70
};
exports.default = SuspicionScoringService;
