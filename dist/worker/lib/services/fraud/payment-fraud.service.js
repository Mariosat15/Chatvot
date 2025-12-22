"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentFraudService = void 0;
const payment_fingerprint_model_1 = __importDefault(require("@/database/models/fraud/payment-fingerprint.model"));
const suspicion_scoring_service_1 = require("@/lib/services/fraud/suspicion-scoring.service");
const alert_manager_service_1 = require("@/lib/services/fraud/alert-manager.service");
const mongoose_1 = require("@/database/mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
class PaymentFraudService {
    /**
     * Track a payment method and detect if it's shared
     */
    static async trackPaymentFingerprint(paymentData) {
        await (0, mongoose_1.connectToDatabase)();
        console.log(`💳 Tracking payment fingerprint for user ${paymentData.userId}`);
        console.log(`   Provider: ${paymentData.paymentProvider}, Fingerprint: ${paymentData.paymentFingerprint.substring(0, 12)}...`);
        // Check if this payment fingerprint already exists
        const existingFingerprints = await payment_fingerprint_model_1.default.find({
            paymentFingerprint: paymentData.paymentFingerprint,
            paymentProvider: paymentData.paymentProvider
        });
        let userFingerprint = existingFingerprints.find(fp => fp.userId.toString() === paymentData.userId);
        const otherUserFingerprints = existingFingerprints.filter(fp => fp.userId.toString() !== paymentData.userId);
        // Create or update user's payment fingerprint
        if (!userFingerprint) {
            userFingerprint = await payment_fingerprint_model_1.default.create({
                userId: paymentData.userId,
                paymentProvider: paymentData.paymentProvider,
                paymentFingerprint: paymentData.paymentFingerprint,
                cardLast4: paymentData.cardLast4,
                cardBrand: paymentData.cardBrand,
                cardCountry: paymentData.cardCountry,
                cardFunding: paymentData.cardFunding,
                paypalEmail: paymentData.paypalEmail,
                paypalAccountId: paymentData.paypalAccountId,
                providerAccountId: paymentData.providerAccountId,
                providerMetadata: paymentData.providerMetadata,
                linkedUserIds: [],
                isShared: false,
                riskScore: 0,
                timesUsed: 1
            });
            console.log(`✅ Created new payment fingerprint for user ${paymentData.userId}`);
        }
        else {
            // Update existing fingerprint
            userFingerprint.updateUsage();
            await userFingerprint.save();
            console.log(`📊 Updated payment fingerprint for user ${paymentData.userId} (used ${userFingerprint.timesUsed} times)`);
        }
        // FRAUD DETECTION: Check if payment method is shared
        const linkedUserIds = otherUserFingerprints.map(fp => fp.userId.toString());
        const isShared = linkedUserIds.length > 0;
        if (isShared) {
            console.log(`🚨 SHARED PAYMENT DETECTED! ${linkedUserIds.length + 1} accounts using same payment method`);
            // Update all fingerprints with linked users
            const allUserIds = [paymentData.userId, ...linkedUserIds];
            for (const fingerprint of [userFingerprint, ...otherUserFingerprints]) {
                const otherUsers = allUserIds.filter(id => id !== fingerprint.userId.toString());
                for (const otherUserId of otherUsers) {
                    fingerprint.addLinkedUser(new mongoose_2.default.Types.ObjectId(otherUserId));
                }
                await fingerprint.save();
            }
            // Update fraud scores for all involved users
            await this.updateFraudScoresForSharedPayment(allUserIds, paymentData);
            // Create fraud alert
            await this.createPaymentFraudAlert(allUserIds, paymentData);
            return {
                fingerprint: userFingerprint,
                isShared: true,
                linkedUsers: linkedUserIds,
                fraudDetected: true
            };
        }
        return {
            fingerprint: userFingerprint,
            isShared: false,
            linkedUsers: [],
            fraudDetected: false
        };
    }
    /**
     * Update fraud scores for all users sharing a payment method
     */
    static async updateFraudScoresForSharedPayment(userIds, paymentData) {
        console.log(`📊 Updating fraud scores for ${userIds.length} users with shared payment`);
        const paymentMethodInfo = paymentData.cardLast4
            ? `${paymentData.cardBrand} •••• ${paymentData.cardLast4}`
            : `${paymentData.paymentProvider} payment method`;
        for (const userId of userIds) {
            await suspicion_scoring_service_1.SuspicionScoringService.updateScore(userId, {
                method: 'samePayment',
                percentage: 30, // +30% for shared payment
                evidence: `Shared payment method detected: ${paymentMethodInfo} (${userIds.length} accounts)`,
                linkedUserIds: userIds.filter(id => id !== userId)
            });
        }
        console.log(`✅ Updated fraud scores (+30% for ${userIds.length} users)`);
    }
    /**
     * Create or update fraud alert for shared payment method
     */
    static async createPaymentFraudAlert(userIds, paymentData) {
        console.log(`🚨 Processing payment fraud alert for ${userIds.length} accounts`);
        const paymentMethodInfo = paymentData.cardLast4
            ? `${paymentData.cardBrand} •••• ${paymentData.cardLast4}`
            : `${paymentData.paymentProvider} payment method`;
        // Use AlertManagerService to create or update alert
        await alert_manager_service_1.AlertManagerService.createOrUpdateAlert({
            alertType: 'same_payment',
            userIds,
            title: 'Shared Payment Method Detected',
            description: `${userIds.length} accounts are using the same payment method (${paymentMethodInfo})`,
            severity: userIds.length > 2 ? 'high' : 'medium',
            confidence: 0.85,
            evidence: [
                {
                    type: 'payment_fingerprint',
                    description: `Payment method fingerprint match across ${userIds.length} accounts`,
                    data: {
                        paymentProvider: paymentData.paymentProvider,
                        paymentFingerprint: paymentData.paymentFingerprint, // Full fingerprint ID
                        cardLast4: paymentData.cardLast4,
                        cardBrand: paymentData.cardBrand,
                        cardCountry: paymentData.cardCountry,
                        accountsInvolved: userIds.length,
                        connectedAccountIds: userIds // All connected account IDs
                    }
                }
            ]
        });
    }
    /**
     * Get payment fraud statistics
     */
    static async getPaymentFraudStats() {
        await (0, mongoose_1.connectToDatabase)();
        const totalPaymentFingerprints = await payment_fingerprint_model_1.default.countDocuments();
        const sharedPaymentMethods = await payment_fingerprint_model_1.default.countDocuments({ isShared: true });
        const highRiskPayments = await payment_fingerprint_model_1.default.countDocuments({
            isShared: true,
            riskScore: { $gte: 50 }
        });
        // Count unique users with shared payments
        const sharedPayments = await payment_fingerprint_model_1.default.find({ isShared: true });
        const affectedUserIds = new Set();
        sharedPayments.forEach(payment => {
            affectedUserIds.add(payment.userId.toString());
            payment.linkedUserIds.forEach((id) => affectedUserIds.add(id.toString()));
        });
        return {
            totalPaymentFingerprints,
            sharedPaymentMethods,
            highRiskPayments,
            affectedUsers: affectedUserIds.size
        };
    }
    /**
     * Get shared payment methods
     */
    static async getSharedPayments() {
        await (0, mongoose_1.connectToDatabase)();
        return payment_fingerprint_model_1.default.find({ isShared: true })
            .sort({ riskScore: -1, lastUsed: -1 })
            .populate('userId', 'name email')
            .populate('linkedUserIds', 'name email')
            .limit(100);
    }
    /**
     * Get payment fingerprints for a user
     */
    static async getUserPaymentFingerprints(userId) {
        await (0, mongoose_1.connectToDatabase)();
        return payment_fingerprint_model_1.default.find({ userId })
            .sort({ lastUsed: -1 });
    }
    /**
     * Check if a user has shared payment methods
     */
    static async hasSharedPayments(userId) {
        await (0, mongoose_1.connectToDatabase)();
        const count = await payment_fingerprint_model_1.default.countDocuments({
            userId,
            isShared: true
        });
        return count > 0;
    }
}
exports.PaymentFraudService = PaymentFraudService;
