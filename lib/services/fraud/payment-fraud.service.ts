import PaymentFingerprint, { IPaymentFingerprint } from '@/database/models/fraud/payment-fingerprint.model';
import { SuspicionScoringService } from '@/lib/services/fraud/suspicion-scoring.service';
import { AlertManagerService } from '@/lib/services/fraud/alert-manager.service';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Payment Fraud Detection Service
 * 
 * Detects shared payment methods across multiple accounts
 * Works with ALL payment providers (Stripe, PayPal, custom, etc.)
 * Contributes +30% to fraud score when shared payment detected
 */

export interface PaymentData {
  userId: string;
  paymentProvider: 'stripe' | 'paypal' | 'custom' | string;
  
  // Payment Method Fingerprint
  paymentFingerprint: string; // Unique identifier (card hash, PayPal ID, etc.)
  
  // Card Details (Stripe/Credit Cards)
  cardLast4?: string;
  cardBrand?: string;
  cardCountry?: string;
  cardFunding?: string;
  
  // PayPal Details
  paypalEmail?: string;
  paypalAccountId?: string;
  
  // Other Provider Details
  providerAccountId?: string;
  providerMetadata?: Record<string, any>;
  
  // Transaction Details
  transactionId?: string;
  amount?: number;
  currency?: string;
}

export class PaymentFraudService {
  
  /**
   * Track a payment method and detect if it's shared
   */
  static async trackPaymentFingerprint(paymentData: PaymentData): Promise<{
    fingerprint: IPaymentFingerprint;
    isShared: boolean;
    linkedUsers: string[];
    fraudDetected: boolean;
  }> {
    await connectToDatabase();
    
    console.log(`💳 Tracking payment fingerprint for user ${paymentData.userId}`);
    console.log(`   Provider: ${paymentData.paymentProvider}, Fingerprint: ${paymentData.paymentFingerprint.substring(0, 12)}...`);
    
    // Check if this payment fingerprint already exists
    const existingFingerprints = await PaymentFingerprint.find({
      paymentFingerprint: paymentData.paymentFingerprint,
      paymentProvider: paymentData.paymentProvider
    });
    
    let userFingerprint = existingFingerprints.find(
      fp => fp.userId.toString() === paymentData.userId
    );
    
    const otherUserFingerprints = existingFingerprints.filter(
      fp => fp.userId.toString() !== paymentData.userId
    );
    
    // Create or update user's payment fingerprint
    if (!userFingerprint) {
      userFingerprint = await PaymentFingerprint.create({
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
    } else {
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
          fingerprint.addLinkedUser(new mongoose.Types.ObjectId(otherUserId));
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
  private static async updateFraudScoresForSharedPayment(
    userIds: string[],
    paymentData: PaymentData
  ): Promise<void> {
    console.log(`📊 Updating fraud scores for ${userIds.length} users with shared payment`);
    
    const paymentMethodInfo = paymentData.cardLast4 
      ? `${paymentData.cardBrand} •••• ${paymentData.cardLast4}`
      : `${paymentData.paymentProvider} payment method`;
    
    for (const userId of userIds) {
      await SuspicionScoringService.updateScore(userId, {
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
  private static async createPaymentFraudAlert(
    userIds: string[],
    paymentData: PaymentData
  ): Promise<void> {
    console.log(`🚨 Processing payment fraud alert for ${userIds.length} accounts`);
    
    const paymentMethodInfo = paymentData.cardLast4 
      ? `${paymentData.cardBrand} •••• ${paymentData.cardLast4}`
      : `${paymentData.paymentProvider} payment method`;
    
    // Use AlertManagerService to create or update alert
    await AlertManagerService.createOrUpdateAlert({
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
  static async getPaymentFraudStats(): Promise<{
    totalPaymentFingerprints: number;
    sharedPaymentMethods: number;
    highRiskPayments: number;
    affectedUsers: number;
  }> {
    await connectToDatabase();
    
    const totalPaymentFingerprints = await PaymentFingerprint.countDocuments();
    const sharedPaymentMethods = await PaymentFingerprint.countDocuments({ isShared: true });
    const highRiskPayments = await PaymentFingerprint.countDocuments({ 
      isShared: true, 
      riskScore: { $gte: 50 } 
    });
    
    // Count unique users with shared payments
    const sharedPayments = await PaymentFingerprint.find({ isShared: true });
    const affectedUserIds = new Set<string>();
    sharedPayments.forEach(payment => {
      affectedUserIds.add(payment.userId.toString());
      payment.linkedUserIds.forEach(id => affectedUserIds.add(id.toString()));
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
  static async getSharedPayments(): Promise<IPaymentFingerprint[]> {
    await connectToDatabase();
    
    return PaymentFingerprint.find({ isShared: true })
      .sort({ riskScore: -1, lastUsed: -1 })
      .populate('userId', 'name email')
      .populate('linkedUserIds', 'name email')
      .limit(100);
  }
  
  /**
   * Get payment fingerprints for a user
   */
  static async getUserPaymentFingerprints(userId: string): Promise<IPaymentFingerprint[]> {
    await connectToDatabase();
    
    return PaymentFingerprint.find({ userId })
      .sort({ lastUsed: -1 });
  }
  
  /**
   * Check if a user has shared payment methods
   */
  static async hasSharedPayments(userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const count = await PaymentFingerprint.countDocuments({
      userId,
      isShared: true
    });
    
    return count > 0;
  }
}

