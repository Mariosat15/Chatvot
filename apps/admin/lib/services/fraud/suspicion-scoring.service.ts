import SuspicionScore, { ISuspicionScore } from '@/database/models/fraud/suspicion-score.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import UserRestriction from '@/database/models/user-restriction.model';
import FraudSettings, { DEFAULT_FRAUD_SETTINGS } from '@/database/models/fraud/fraud-settings.model';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { FraudHistoryService } from './fraud-history.service';
import { getUserById } from '@/lib/utils/user-lookup';

/**
 * Fraud Detection Scoring Service
 * 
 * Manages cumulative fraud detection scoring system (0-100%)
 * Each method contributes a percentage to the overall score
 */

export interface ScoreUpdate {
  method: keyof ISuspicionScore['scoreBreakdown'];
  percentage: number; // 0-100%
  evidence: string;
  linkedUserIds?: string[];
  confidence?: number;
}

export class SuspicionScoringService {
  
  /**
   * Percentage values for each detection method (0-100%)
   * Each method contributes up to this percentage to the overall score
   */
  private static readonly PERCENTAGE_VALUES = {
    deviceMatch: 40,        // 40% for same device detection
    ipMatch: 30,            // 30% for same IP address
    ipBrowserMatch: 35,     // 35% for same IP + Browser
    sameCity: 15,           // 15% for same geographic location
    samePayment: 30,        // 30% for same payment method
    rapidCreation: 20,      // 20% for rapid account creation
    coordinatedEntry: 25,   // 25% for coordinated competition entry
    tradingSimilarity: 30,  // 30% for similar trading patterns
    mirrorTrading: 35,      // 35% for mirror trading detection
    timezoneLanguage: 10,   // 10% for same timezone + language
    deviceSwitching: 15,    // 15% for unusual device switching
    bruteForce: 35,         // 35% for brute force login attempts
    rateLimitExceeded: 25   // 25% for rate limit violations
  };
  
  /**
   * Risk thresholds
   */
  private static readonly THRESHOLDS = {
    medium: 30,
    high: 50,
    critical: 70
  };
  
  /**
   * Get or create suspicion score for a user
   */
  static async getOrCreateScore(userId: string): Promise<ISuspicionScore> {
    await connectToDatabase();
    
    let score = await SuspicionScore.findOne({ userId });
    
    if (!score) {
      score = await SuspicionScore.create({
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
  static async updateScore(
    userId: string,
    update: ScoreUpdate
  ): Promise<ISuspicionScore> {
    await connectToDatabase();
    
    const score = await this.getOrCreateScore(userId);
    const oldScore = score.totalScore;
    const oldRiskLevel = score.riskLevel;
    
    // Add percentage using model method
    score.addPercentage(update.method, update.percentage, update.evidence);
    
    // Add linked accounts if provided
    if (update.linkedUserIds && update.linkedUserIds.length > 0) {
      for (const linkedUserId of update.linkedUserIds) {
        if (linkedUserId !== userId) {
          score.addLinkedAccount(
            new mongoose.Types.ObjectId(linkedUserId),
            update.method,
            update.confidence || 0.85
          );
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
  static async updateScoresForMultipleUsers(
    userIds: string[],
    update: Omit<ScoreUpdate, 'linkedUserIds'>,
    linkedUserIds: string[]
  ): Promise<ISuspicionScore[]> {
    const scores: ISuspicionScore[] = [];
    
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
  static async scoreDeviceMatch(
    userIds: string[],
    fingerprintId: string,
    deviceInfo: string
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'deviceMatch',
        percentage: this.PERCENTAGE_VALUES.deviceMatch,
        evidence: `Same device detected (${deviceInfo}) - Fingerprint: ${fingerprintId.substring(0, 12)}...`
      },
      userIds
    );
  }
  
  /**
   * IP Match Detection (+30%)
   */
  static async scoreIPMatch(
    userIds: string[],
    ipAddress: string
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'ipMatch',
        percentage: this.PERCENTAGE_VALUES.ipMatch,
        evidence: `Same IP address detected: ${ipAddress}`
      },
      userIds
    );
  }
  
  /**
   * IP + Browser Match Detection (+35%)
   */
  static async scoreIPBrowserMatch(
    userIds: string[],
    ipAddress: string,
    browser: string
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'ipBrowserMatch',
        percentage: this.PERCENTAGE_VALUES.ipBrowserMatch,
        evidence: `Same IP (${ipAddress}) and browser (${browser}) detected`
      },
      userIds
    );
  }
  
  /**
   * Timezone + Language Match Detection (+10%)
   */
  static async scoreTimezoneLanguage(
    userIds: string[],
    timezone: string,
    language: string
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'timezoneLanguage',
        percentage: this.PERCENTAGE_VALUES.timezoneLanguage,
        evidence: `Same timezone (${timezone}) and language (${language})`
      },
      userIds
    );
  }
  
  /**
   * Calculate score for same payment method
   */
  static async scorePaymentMatch(
    userIds: string[],
    paymentProvider: string,
    paymentFingerprint: string
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'samePayment',
        percentage: this.PERCENTAGE_VALUES.samePayment,
        evidence: `Same payment method detected (${paymentProvider}) - Fingerprint: ${paymentFingerprint.substring(0, 12)}...`
      },
      userIds
    );
  }
  
  /**
   * Calculate score for rapid account creation
   */
  static async scoreRapidCreation(
    userIds: string[],
    timeWindowMinutes: number
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'rapidCreation',
        percentage: this.PERCENTAGE_VALUES.rapidCreation,
        evidence: `Multiple accounts created within ${timeWindowMinutes} minutes`
      },
      userIds
    );
  }
  
  /**
   * Calculate score for coordinated competition entry
   */
  static async scoreCoordinatedEntry(
    userIds: string[],
    competitionId: string,
    timeWindowMinutes: number
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'coordinatedEntry',
        percentage: this.PERCENTAGE_VALUES.coordinatedEntry,
        evidence: `Coordinated competition entry within ${timeWindowMinutes} minutes (Competition: ${competitionId.substring(0, 12)}...)`
      },
      userIds
    );
  }
  
  /**
   * Calculate score for trading similarity
   */
  static async scoreTradingSimilarity(
    userId1: string,
    userId2: string,
    similarityPercentage: number
  ): Promise<void> {
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
  static async scoreMirrorTrading(
    userId1: string,
    userId2: string,
    matchRate: number
  ): Promise<void> {
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
  static async scoreSameCity(
    userIds: string[],
    city: string,
    distanceKm: number
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: 'sameCity',
        percentage: this.PERCENTAGE_VALUES.sameCity,
        evidence: `Accounts within ${distanceKm}km (${city})`
      },
      userIds
    );
  }
  
  /**
   * Calculate score for unusual device switching
   */
  static async scoreDeviceSwitching(
    userId: string,
    deviceCount: number,
    timeWindowHours: number
  ): Promise<void> {
    await this.updateScore(userId, {
      method: 'deviceSwitching',
      percentage: this.PERCENTAGE_VALUES.deviceSwitching,
      evidence: `Used ${deviceCount} different devices within ${timeWindowHours} hours`
    });
  }
  
  /**
   * Calculate score for brute force login attempts (+35%)
   */
  static async scoreBruteForce(
    userId: string,
    failedAttempts: number,
    ipAddress: string,
    email?: string
  ): Promise<void> {
    await this.updateScore(userId, {
      method: 'bruteForce',
      percentage: this.PERCENTAGE_VALUES.bruteForce,
      evidence: `Brute force attack: ${failedAttempts} failed login attempts from IP ${ipAddress}${email ? ` for ${email}` : ''}`
    });
  }
  
  /**
   * Calculate score for rate limit violations (+25%)
   */
  static async scoreRateLimitExceeded(
    userId: string,
    limitType: 'registration' | 'login' | 'api',
    attempts: number,
    ipAddress: string
  ): Promise<void> {
    await this.updateScore(userId, {
      method: 'rateLimitExceeded',
      percentage: this.PERCENTAGE_VALUES.rateLimitExceeded,
      evidence: `Rate limit exceeded: ${attempts} ${limitType} attempts from IP ${ipAddress}`
    });
  }
  
  /**
   * Get suspicion score for a user (plain object, no methods)
   */
  static async getScore(userId: string): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'> | null> {
    await connectToDatabase();
    return await SuspicionScore.findOne({ userId }).lean() as any;
  }
  
  /**
   * Get all high-risk users (plain objects, no methods)
   */
  static async getHighRiskUsers(): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'>[]> {
    await connectToDatabase();
    return await SuspicionScore.find({
      riskLevel: { $in: ['high', 'critical'] }
    }).sort({ totalScore: -1 }).lean() as any;
  }
  
  /**
   * Get users by risk level (plain objects, no methods)
   */
  static async getUsersByRiskLevel(level: 'low' | 'medium' | 'high' | 'critical'): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'>[]> {
    await connectToDatabase();
    return await SuspicionScore.find({ riskLevel: level }).sort({ totalScore: -1 }).lean() as any;
  }
  
  /**
   * Reset score for a user
   */
  static async resetScore(userId: string): Promise<ISuspicionScore> {
    await connectToDatabase();
    
    const score = await this.getOrCreateScore(userId);
    score.resetScore();
    await score.save();
    
    console.log(`🔄 Reset suspicion score for user ${userId}`);
    
    return score;
  }
  
  /**
   * Get fraud settings (singleton pattern)
   */
  private static async getFraudSettings() {
    await connectToDatabase();
    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    }
    
    return settings;
  }
  
  /**
   * Check fraud settings and auto-restrict user if enabled
   * This respects admin settings - no auto-restriction unless explicitly enabled
   */
  private static async checkAndAutoRestrictUser(
    userId: string,
    score: ISuspicionScore
  ): Promise<void> {
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
      const existingRestriction = await UserRestriction.findOne({
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
      
      await UserRestriction.create({
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
      const alert = await FraudAlert.create({
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
      const user = await getUserById(userId);
      if (user) {
        await FraudHistoryService.logAutoAction(
          {
            userId,
            email: user.email,
            name: user.name,
          },
          `Auto-suspended: Score ${score.totalScore}% exceeded threshold ${settings.autoSuspendThreshold}%`,
          `User automatically suspended by system. Suspicion score (${score.totalScore}%) exceeded the admin-configured auto-suspend threshold (${settings.autoSuspendThreshold}%). ` +
          `Risk level: ${score.riskLevel}. Linked accounts: ${score.linkedAccounts.length}. ` +
          `Suspension duration: 7 days. Admin review required.`,
          'critical',
          { accountStatus: 'active', suspicionScore: score.totalScore },
          { accountStatus: 'suspended', suspicionScore: score.totalScore }
        );
      }
      
      console.log(`🚨 AUTO-SUSPENDED user ${userId} - Score: ${score.totalScore}%/${settings.autoSuspendThreshold}% threshold`);
    } catch (error) {
      console.error(`❌ Failed to check/auto-restrict user ${userId}:`, error);
    }
  }
  
  /**
   * Get score statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
    averageScore: number;
  }> {
    await connectToDatabase();
    
    const scores = await SuspicionScore.find().lean();
    
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

export default SuspicionScoringService;

