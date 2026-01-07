import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Unified Fraud Alert Manager
 * 
 * Handles creating or updating fraud alerts with multiple detection methods
 * Ensures all fraud findings are included in alert details
 * 
 * KEY BEHAVIORS:
 * 1. Alerts elevated to "investigating" are removed from active alerts tab
 * 2. When admin takes action (ban/suspend/dismiss), alert moves to "resolved" or "dismissed"
 * 3. When user is unbanned/unsuspended, old alerts stay resolved (don't reappear)
 * 4. If user commits NEW fraud AFTER investigation is cleared, a NEW alert is created
 * 5. Competition-specific alerts - separate alerts per competition
 * 
 * IMPORTANT: The system tracks `investigationClearedAt` to determine if fraud 
 * activity is NEW (detected after user was cleared) or OLD (part of original case)
 */

export interface AlertEvidence {
  type: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface CreateOrUpdateAlertParams {
  alertType: string;
  userIds: string[];
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: AlertEvidence[];
  competitionId?: string; // Optional - for competition-specific alerts
}

export class AlertManagerService {
  
  /**
   * Create new alert OR update existing alert with additional evidence
   * 
   * IMPORTANT:
   * - If alert was dismissed/resolved, don't create new one for same issue
   * - Competition alerts are tracked per competition (not globally per user)
   * - Only pending/investigating alerts can be updated
   */
  static async createOrUpdateAlert(params: CreateOrUpdateAlertParams): Promise<void> {
    await connectToDatabase();
    
    const {
      alertType,
      userIds,
      title,
      description,
      severity,
      confidence,
      evidence,
      competitionId
    } = params;

    console.log(`🔍 [ALERT] ========== NEW FRAUD DETECTION ==========`);
    console.log(`   User IDs: ${JSON.stringify(userIds)}`);
    console.log(`   Alert type: ${alertType}`);
    console.log(`   Title: ${title}`);
    if (competitionId) {
      console.log(`   Competition ID: ${competitionId}`);
    }

    // Convert userIds to strings for query (schema stores strings, not ObjectIds)
    const userIdStrings = userIds.map(id => id.toString());
    console.log(`   User ID strings: ${userIdStrings.join(', ')}`);

    // Build the query to find existing alerts for these users
    // NOTE: suspiciousUserIds and primaryUserId are stored as STRINGS in the schema
    const userQuery = {
      $or: [
        { suspiciousUserIds: { $in: userIdStrings } },
        { primaryUserId: { $in: userIdStrings } }
      ]
    };

    // ALWAYS check if there's a resolved/dismissed alert with the SAME alert type
    // (to prevent recreating dismissed alerts of the same type)
    // IMPORTANT: If the user was CLEARED (investigationClearedAt is set) and this is NEW fraud
    // activity (detected AFTER clearance), we SHOULD create a new alert
    // NOTE: We check `alertType` field directly, NOT `evidence.type` (which is the evidence category)
    const alertTypeCheck = competitionId 
      ? { alertType, competitionId }
      : { alertType };

    const resolvedAlertOfSameType = await FraudAlert.findOne({
      ...userQuery,
      ...alertTypeCheck,
      status: { $in: ['dismissed', 'resolved'] }
    }).sort({ resolvedAt: -1 }); // Get most recent resolution

    let shouldBlockNewAlert = false;
    
    if (resolvedAlertOfSameType) {
      console.log(`⏭️ [ALERT] Found resolved/dismissed alert with same evidence type`);
      console.log(`   Previous alert ID: ${resolvedAlertOfSameType._id}`);
      console.log(`   Status: ${resolvedAlertOfSameType.status}`);
      console.log(`   Resolved at: ${resolvedAlertOfSameType.resolvedAt}`);
      console.log(`   Investigation cleared at: ${resolvedAlertOfSameType.investigationClearedAt || 'Not set'}`);
      
      // Check if user was CLEARED (unbanned/unsuspended) after this investigation
      // If investigationClearedAt is set, it means the user was unbanned/unsuspended
      // In that case, NEW fraud activity should create a NEW alert
      if (resolvedAlertOfSameType.investigationClearedAt) {
        const clearanceDate = new Date(resolvedAlertOfSameType.investigationClearedAt);
        console.log(`   ✅ User was CLEARED on: ${clearanceDate.toISOString()}`);
        console.log(`   → NEW fraud activity after clearance will create a NEW alert`);
        shouldBlockNewAlert = false; // Allow new alert since user was cleared
      } else {
        // User was NOT cleared (still banned/suspended or alert was just dismissed)
        // Don't create new alert for the same type of fraud
        console.log(`   ⚠️ User was NOT cleared - blocking new alert of same type`);
        shouldBlockNewAlert = true;
      }
      
      console.log(`   Continuing to check for active alerts...`);
    } else {
      console.log(`   No resolved/dismissed alert found with this evidence type - continuing`);
    }

    // ALWAYS find ANY existing ACTIVE alert for these users (regardless of type)
    // This ensures ALL detections for same users are MERGED into ONE alert
    // Check both pending AND investigating status
    console.log(`   Searching for active alerts with status: pending OR investigating`);
    
    const existingAlert = await FraudAlert.findOne({
      ...userQuery,
      status: { $in: ['pending', 'investigating'] }
    }).sort({ updatedAt: -1 }); // Get most recently updated if multiple
    
    if (existingAlert) {
      console.log(`\n   ✅✅✅ EXISTING ACTIVE ALERT FOUND ✅✅✅`);
      console.log(`      Alert ID: ${existingAlert._id}`);
      console.log(`      Status: ${existingAlert.status.toUpperCase()}`);
      console.log(`      Current evidence count: ${existingAlert.evidence?.length || 0}`);
      console.log(`      Current title: ${existingAlert.title}`);
      
      if (existingAlert.status === 'investigating') {
        console.log(`\n   🔍🔍🔍 THIS ALERT IS IN INVESTIGATION CENTER 🔍🔍🔍`);
        console.log(`   New fraud will be MERGED into this investigation!`);
      }
    } else {
      console.log(`\n   ❌ No active alert found for these users`);
      // Debug: Log all alerts for these users to see what's happening
      const allAlertsForUsers = await FraudAlert.find(userQuery).select('_id status alertType title').lean();
      if (allAlertsForUsers.length > 0) {
        console.log(`   📊 All alerts for these users:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allAlertsForUsers.forEach((a: any, i: number) => {
          console.log(`      ${i + 1}. ID: ${a._id}, Status: ${a.status}, Type: ${a.alertType}`);
        });
      } else {
        console.log(`   📊 No alerts exist for these users yet`);
      }
    }

    // If we have an existing active alert, ALWAYS merge into it
    if (existingAlert) {
      console.log(`\n📝 [ALERT] ⬇️⬇️⬇️ MERGING NEW FRAUD INTO ${existingAlert.status.toUpperCase()} ALERT ⬇️⬇️⬇️`);
      await this.updateExistingAlert(existingAlert, alertType, evidence, severity, confidence, userIds, competitionId);
      return;
    }

    // If the same evidence type was already dismissed AND user was NOT cleared, don't create new alert
    if (resolvedAlertOfSameType && shouldBlockNewAlert) {
      console.log(`⏭️ [ALERT] No active alert exists and this type was dismissed (user NOT cleared) - NOT creating`);
      return;
    }

    // No existing alert found - create new one
    // Either: (1) no previous alert, OR (2) user was cleared and this is NEW fraud
    if (resolvedAlertOfSameType && !shouldBlockNewAlert) {
      console.log(`🆕 [ALERT] User was CLEARED - creating NEW alert for NEW fraud activity`);
    } else {
      console.log(`🆕 [ALERT] Creating NEW alert for these users`);
    }
    await this.createNewAlert(params);
  }

  /**
   * Update an existing alert with new evidence
   * ALWAYS adds new evidence with timestamps - allows tracking multiple detections
   * ALL detections for same users are MERGED into ONE alert
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async updateExistingAlert(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingAlert: any,
    alertType: string,
    evidence: AlertEvidence[],
    severity: 'low' | 'medium' | 'high' | 'critical',
    confidence: number,
    userIds: string[],
    competitionId?: string
  ): Promise<void> {
    console.log(`📝 [ALERT] ========== MERGING NEW EVIDENCE ==========`);
    console.log(`   Alert ID: ${existingAlert._id}`);
    console.log(`   Alert Status: ${existingAlert.status}`);
    console.log(`   Original Type: ${existingAlert.alertType}`);
    console.log(`   New Evidence Type: ${alertType}`);
    console.log(`   Evidence items to add: ${evidence.length}`);
    
    // Add timestamp and competitionId to each new evidence item
    const timestampedEvidence = evidence.map(e => ({
      ...e,
      detectedAt: new Date(),
      data: {
        ...e.data,
        detectedAt: new Date().toISOString(),
        ...(competitionId && { competitionId })
      }
    }));
    
    // Check if this EXACT evidence already exists (same type + same key data)
    const isDuplicateEvidence = (newEvidence: AlertEvidence): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return existingAlert.evidence.some((existing: any) => {
        if (existing.type !== newEvidence.type) return false;
        
        // For different types, check different unique identifiers
        switch (newEvidence.type) {
          case 'coordinated_entry':
            return existing.data?.competitionId === newEvidence.data?.competitionId;
          case 'mirror_trading':
            // Allow multiple mirror trading detections (they may have different trade matches)
            return false;
          case 'trading_similarity':
            // Allow multiple similarity detections (scores may change)
            return false;
          case 'payment_fingerprint':
            return existing.data?.paymentFingerprint === newEvidence.data?.paymentFingerprint;
          case 'device_fingerprint':
          case 'ip_browser_match':
            return existing.data?.fingerprintId === newEvidence.data?.fingerprintId;
          default:
            // For unknown types, check if description matches
            return existing.description === newEvidence.description;
        }
      });
    };
    
    // Filter out duplicate evidence
    const newUniqueEvidence = timestampedEvidence.filter(e => !isDuplicateEvidence(e));
    
    if (newUniqueEvidence.length === 0) {
      console.log(`⏭️ [ALERT] All evidence already exists, skipping update`);
      return;
    }
    
    console.log(`   Adding ${newUniqueEvidence.length} new evidence items`);
    
    // Add new evidence to existing alert
    existingAlert.evidence.push(...newUniqueEvidence);
    
    // Update title and description to reflect multiple detection methods
    const detectionMethods = new Set<string>();
    detectionMethods.add(existingAlert.alertType);
    detectionMethods.add(alertType);
    
    // Also add any detection methods from evidence types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingAlert.evidence.forEach((e: any) => {
      if (e.type.includes('device') || e.type.includes('fingerprint')) detectionMethods.add('same_device');
      if (e.type.includes('payment')) detectionMethods.add('same_payment');
      if (e.type.includes('ip')) detectionMethods.add('same_ip');
      if (e.type.includes('mirror')) detectionMethods.add('mirror_trading');
      if (e.type.includes('similarity')) detectionMethods.add('trading_similarity');
      if (e.type.includes('coordinated')) detectionMethods.add('coordinated_entry');
      if (e.type.includes('rapid')) detectionMethods.add('rapid_creation');
      if (e.type.includes('vpn') || e.type.includes('proxy') || e.type.includes('tor')) detectionMethods.add('vpn_usage');
    });
    
    const methodCount = detectionMethods.size;
    const methodNames = Array.from(detectionMethods)
      .map(m => m.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      .join(', ');
    
    // Update title to show multiple methods and evidence count
    existingAlert.title = `Multiple Fraud Indicators (${methodCount} methods, ${existingAlert.evidence.length} detections)`;
    existingAlert.description = `${userIds.length} accounts flagged for: ${methodNames}`;
    
    // Upgrade severity if new detection is higher
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    if (severityLevels[severity] > severityLevels[existingAlert.severity as keyof typeof severityLevels]) {
      console.log(`⬆️ [ALERT] Upgrading severity: ${existingAlert.severity} → ${severity}`);
      existingAlert.severity = severity;
    }
    
    // Update confidence (use highest confidence)
    if (confidence > existingAlert.confidence) {
      existingAlert.confidence = confidence;
    }
    
    try {
      await existingAlert.save();
      
      console.log(`✅ [ALERT] ========== MERGE SUCCESSFUL ==========`);
      console.log(`   Alert ID: ${existingAlert._id}`);
      console.log(`   New Title: ${existingAlert.title}`);
      console.log(`   Detection Methods: ${methodNames}`);
      console.log(`   Total Evidence: ${existingAlert.evidence.length} items`);
      console.log(`   Severity: ${existingAlert.severity}`);
      console.log(`   Status: ${existingAlert.status}`);
    } catch (saveError) {
      console.error(`❌ [ALERT] FAILED to save merged alert:`, saveError);
      throw saveError;
    }
  }

  /**
   * Create a new alert
   */
  private static async createNewAlert(params: CreateOrUpdateAlertParams): Promise<void> {
    const {
      alertType,
      userIds,
      title,
      description,
      severity,
      confidence,
      evidence,
      competitionId
    } = params;

    console.log(`🆕 [ALERT] Creating new ${alertType} alert`);
    
    // Add competitionId to evidence data if provided
    const enhancedEvidence = evidence.map(e => ({
      ...e,
      data: {
        ...e.data,
        ...(competitionId && { competitionId })
      }
    }));
    
    await FraudAlert.create({
      alertType,
      severity,
      status: 'pending',
      primaryUserId: new mongoose.Types.ObjectId(userIds[0]),
      suspiciousUserIds: userIds.map(id => new mongoose.Types.ObjectId(id)),
      confidence,
      title,
      description,
      evidence: enhancedEvidence,
      autoGenerated: true,
      notificationSent: false,
      ...(competitionId && { competitionId }) // Store at alert level too
    });
    
    console.log(`✅ [ALERT] Created new ${alertType} alert for ${userIds.length} accounts`);
    if (competitionId) {
      console.log(`   Competition: ${competitionId}`);
    }
  }
  
  /**
   * Check if alert can be created for these users
   * Returns false if there's already a resolved/dismissed alert
   */
  static async canCreateAlert(
    userIds: string[], 
    alertType: string,
    competitionId?: string
  ): Promise<boolean> {
    await connectToDatabase();
    
    const userQuery = {
      $or: [
        { suspiciousUserIds: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { primaryUserId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    };

    // For competition alerts, check competition-specific
    if (competitionId) {
      const existingAlert = await FraudAlert.findOne({
        ...userQuery,
        alertType,
        competitionId, // Use direct field, not evidence.data
        status: { $in: ['dismissed', 'resolved'] }
      });
      return !existingAlert;
    }

    // For other alerts, check globally
    const existingAlert = await FraudAlert.findOne({
      ...userQuery,
      alertType,
      status: { $in: ['dismissed', 'resolved'] }
    });
    
    return !existingAlert;
  }

  /**
   * Helper: Format detection method name for display
   */
  private static formatMethodName(method: string): string {
    return method
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Helper: Get severity level as number for comparison
   */
  private static getSeverityLevel(severity: string): number {
    const levels: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    return levels[severity] || 1;
  }
}

