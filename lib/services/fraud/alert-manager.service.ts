import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import { connectToDatabase } from "@/database/mongoose";
import { SuspicionScoringService } from "./suspicion-scoring.service";
import { ISuspicionScore } from "@/database/models/fraud/suspicion-score.model";

/**
 * Unified Fraud Alert Manager
 *
 * Handles creating or updating fraud alerts with multiple detection methods
 * Ensures all fraud findings are included in alert details
 *
 * KEY BEHAVIORS:
 * 1. Dismissed/resolved alerts stay resolved - won't recreate for same issue
 * 2. Competition-specific alerts - separate alerts per competition
 * 3. New alerts only for NEW suspicious activity
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
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  evidence: AlertEvidence[];
  competitionId?: string; // Optional - for competition-specific alerts
}

export class AlertManagerService {
  /**
   * Maps alert types to SuspicionScore breakdown methods.
   * Reason: When a detection is merged into an alert, we need to propagate
   * reduced scores to ALL users in the alert who were not directly detected.
   */
  private static readonly ALERT_TYPE_TO_SCORE_METHOD: Record<
    string,
    keyof ISuspicionScore["scoreBreakdown"] | null
  > = {
    same_payment: "samePayment",
    mirror_trading: "mirrorTrading",
    trading_similarity: "tradingSimilarity",
    coordinated_entry: "coordinatedEntry",
    same_device: "deviceMatch",
    same_ip: "ipMatch",
    rapid_creation: "rapidCreation",
    vpn_usage: null, // No direct score method
  };

  /**
   * Reduced percentages for linked (indirectly involved) accounts.
   * Reason: Users linked through fraud network but not directly involved
   * in a specific detection should still get a reduced score to reflect
   * the elevated risk from their association.
   * Values are ~50% of the direct detection percentages.
   */
  private static readonly LINKED_SCORE_PERCENTAGES: Record<string, number> = {
    samePayment: 15,
    mirrorTrading: 18,
    tradingSimilarity: 15,
    coordinatedEntry: 13,
    deviceMatch: 20,
    ipMatch: 15,
    ipBrowserMatch: 18,
    rapidCreation: 10,
  };

  /**
   * Create new alert OR update existing alert with additional evidence
   *
   * IMPORTANT:
   * - If alert was dismissed/resolved, don't create new one for same issue
   * - Competition alerts are tracked per competition (not globally per user)
   * - Only pending/investigating alerts can be updated
   */
  static async createOrUpdateAlert(
    params: CreateOrUpdateAlertParams,
  ): Promise<void> {
    await connectToDatabase();

    const {
      alertType,
      userIds,
      title: _title,
      description: _description,
      severity,
      confidence,
      evidence,
      competitionId,
    } = params;

    // console.log(`🔍 [ALERT] ========== NEW FRAUD DETECTION ==========`);
    // console.log(`   User IDs: ${JSON.stringify(userIds)}`);
    // console.log(`   Alert type: ${alertType}`);
    // console.log(`   Title: ${title}`);
    if (competitionId) {
      // console.log(`   Competition ID: ${competitionId}`);
    }

    // Convert userIds to strings for query (schema stores strings, not ObjectIds)
    const userIdStrings = userIds.map((id) => id.toString());
    // console.log(`   User ID strings: ${userIdStrings.join(", ")}`);

    // Build the query to find existing alerts for these users
    // NOTE: suspiciousUserIds and primaryUserId are stored as STRINGS in the schema
    const userQuery = {
      $or: [
        { suspiciousUserIds: { $in: userIdStrings } },
        { primaryUserId: { $in: userIdStrings } },
      ],
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
      status: { $in: ["dismissed", "resolved"] },
    }).sort({ resolvedAt: -1 }); // Get most recent resolution

    let shouldBlockNewAlert = false;

    if (resolvedAlertOfSameType) {
      // console.log(
        // `⏭️ [ALERT] Found resolved/dismissed alert with same alert type`,
      // );
      // console.log(`   Previous alert ID: ${resolvedAlertOfSameType._id}`);
      // console.log(`   Status: ${resolvedAlertOfSameType.status}`);
      // console.log(
        // `   Investigation cleared at: ${resolvedAlertOfSameType.investigationClearedAt || "Not set"}`,
      // );

      // Check if user was CLEARED (unbanned/unsuspended) after this investigation
      // If investigationClearedAt is set, it means the user was unbanned/unsuspended
      // In that case, NEW fraud activity should create a NEW alert
      if (resolvedAlertOfSameType.investigationClearedAt) {
        shouldBlockNewAlert = false; // Allow new alert since user was cleared
      } else {
        // Reason: Check if there's a NEW user in the current detection that was NOT
        // part of the dismissed alert. If a new account (e.g., testuser3) was created
        // and linked to previously-dismissed users (testuser1+testuser2), we must NOT
        // block the alert — the new user needs investigation.
        const dismissedUserIds = new Set<string>([
          ...(resolvedAlertOfSameType.suspiciousUserIds || []).map((id: { toString: () => string }) => id.toString()),
          resolvedAlertOfSameType.primaryUserId?.toString(),
        ].filter(Boolean));

        const hasNewUserNotInDismissed = userIdStrings.some(
          (uid) => !dismissedUserIds.has(uid),
        );

        if (hasNewUserNotInDismissed) {
          shouldBlockNewAlert = false; // New user detected — allow alert
        } else {
          // All current users were in the dismissed alert — block
          shouldBlockNewAlert = true;
        }
      }

      // console.log(`   Continuing to check for active alerts...`);
    } else {
      // console.log(
        // `   No resolved/dismissed alert found with this alert type - continuing`,
      // );
    }

    // ALWAYS find ANY existing ACTIVE alert for these users (regardless of type)
    // This ensures ALL detections for same users are MERGED into ONE alert
    // Check both pending AND investigating status
    // console.log(
      // `   Searching for active alerts with status: pending OR investigating`,
    // );

    const existingAlert = await FraudAlert.findOne({
      ...userQuery,
      status: { $in: ["pending", "investigating"] },
    }).sort({ updatedAt: -1 }); // Get most recently updated if multiple

    if (existingAlert) {
      // console.log(`\n   ✅✅✅ EXISTING ACTIVE ALERT FOUND ✅✅✅`);
      // console.log(`      Alert ID: ${existingAlert._id}`);
      // console.log(`      Status: ${existingAlert.status.toUpperCase()}`);
      // console.log(
        // `      Current evidence count: ${existingAlert.evidence?.length || 0}`,
      // );
      // console.log(`      Current title: ${existingAlert.title}`);

      if (existingAlert.status === "investigating") {
        // console.log(`\n   🔍🔍🔍 THIS ALERT IS IN INVESTIGATION CENTER 🔍🔍🔍`);
        // console.log(`   New fraud will be MERGED into this investigation!`);
      }
    } else {
      // console.log(`\n   ❌ No active alert found for these users`);
      // Debug: Log all alerts for these users to see what's happening
      const allAlertsForUsers = await FraudAlert.find(userQuery)
        .select("_id status alertType title")
        .lean();
      if (allAlertsForUsers.length > 0) {
        // console.log(`   📊 All alerts for these users:`);
        // Debug logging disabled — forEach retained for potential future re-enable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allAlertsForUsers.forEach((_a: any, _i: number) => {
          // console.log(
            // `      ${_i + 1}. ID: ${_a._id}, Status: ${_a.status}, Type: ${_a.alertType}`,
          // );
        });
      } else {
        // console.log(`   📊 No alerts exist for these users yet`);
      }
    }

    // If we have an existing active alert, ALWAYS merge into it
    if (existingAlert) {
      // console.log(
        // `\n📝 [ALERT] ⬇️⬇️⬇️ MERGING NEW FRAUD INTO ${existingAlert.status.toUpperCase()} ALERT ⬇️⬇️⬇️`,
      // );
      await this.updateExistingAlert(
        existingAlert,
        alertType,
        evidence,
        severity,
        confidence,
        userIds,
        competitionId,
      );
      return;
    }

    // If the same alert type was already dismissed AND user was NOT cleared, don't create new alert
    if (shouldBlockNewAlert) {
      // console.log(
        // `⏭️ [ALERT] No active alert exists and this type was dismissed (user NOT cleared) - NOT creating`,
      // );
      return;
    }

    // No existing alert found - create new one
    // (Either no previous alert, or user was cleared after previous dismissal)
    // console.log(`🆕 [ALERT] Creating NEW alert for these users`);
    await this.createNewAlert(params);
  }

  /**
   * Update an existing alert with new evidence
   * ALWAYS adds new evidence with timestamps - allows tracking multiple detections
   * ALL detections for same users are MERGED into ONE alert
   */
   
  private static async updateExistingAlert(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingAlert: any,
    alertType: string,
    evidence: AlertEvidence[],
    severity: "low" | "medium" | "high" | "critical",
    confidence: number,
    userIds: string[],
    competitionId?: string,
  ): Promise<void> {
    // console.log(`📝 [ALERT] ========== MERGING NEW EVIDENCE ==========`);
    // console.log(`   Alert ID: ${existingAlert._id}`);
    // console.log(`   Alert Status: ${existingAlert.status}`);
    // console.log(`   Original Type: ${existingAlert.alertType}`);
    // console.log(`   New Evidence Type: ${alertType}`);
    // console.log(`   Evidence items to add: ${evidence.length}`);

    // Add timestamp and competitionId to each new evidence item
    const timestampedEvidence = evidence.map((e) => ({
      ...e,
      detectedAt: new Date(),
      data: {
        ...e.data,
        detectedAt: new Date().toISOString(),
        ...(competitionId && { competitionId }),
      },
    }));

    // Check if this EXACT evidence already exists (same type + same key data)
    const isDuplicateEvidence = (newEvidence: AlertEvidence): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return existingAlert.evidence.some((existing: any) => {
        if (existing.type !== newEvidence.type) return false;

        // For different types, check different unique identifiers
        switch (newEvidence.type) {
          case "coordinated_entry":
            return (
              existing.data?.competitionId === newEvidence.data?.competitionId
            );
          case "mirror_trading":
            // Allow multiple mirror trading detections (they may have different trade matches)
            return false;
          case "trading_similarity":
            // Allow multiple similarity detections (scores may change)
            return false;
          case "payment_fingerprint":
            return (
              existing.data?.paymentFingerprint ===
              newEvidence.data?.paymentFingerprint
            );
          case "device_fingerprint":
          case "ip_browser_match":
            return (
              existing.data?.fingerprintId === newEvidence.data?.fingerprintId
            );
          default:
            // For unknown types, check if description matches
            return existing.description === newEvidence.description;
        }
      });
    };

    // Filter out duplicate evidence
    const newUniqueEvidence = timestampedEvidence.filter(
      (e) => !isDuplicateEvidence(e),
    );

    // Reason: Even if all evidence is duplicate, we still need to add any NEW user IDs
    // to suspiciousUserIds. Otherwise a new account linked to the same payment/device
    // won't be tracked at the alert level.
    let hasNewUsers = false;
    for (const uid of userIds) {
      const uidStr = uid.toString();
      if (!existingAlert.suspiciousUserIds.includes(uidStr)) {
        existingAlert.suspiciousUserIds.push(uidStr);
        hasNewUsers = true;
      }
    }

    if (newUniqueEvidence.length === 0 && !hasNewUsers) {
      // console.log(`⏭️ [ALERT] All evidence already exists and no new users, skipping update`);
      return;
    }

    if (newUniqueEvidence.length === 0 && hasNewUsers) {
      // Only new users, no new evidence — just save the updated suspiciousUserIds
      await existingAlert.save();
      return;
    }

    // console.log(`   Adding ${newUniqueEvidence.length} new evidence items`);

    // Add new evidence to existing alert
    existingAlert.evidence.push(...newUniqueEvidence);

    // Update title and description to reflect multiple detection methods
    const detectionMethods = new Set<string>();
    detectionMethods.add(existingAlert.alertType);
    detectionMethods.add(alertType);

    // Also add any detection methods from evidence types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingAlert.evidence.forEach((e: any) => {
      if (e.type.includes("device") || e.type.includes("fingerprint"))
        detectionMethods.add("same_device");
      if (e.type.includes("payment")) detectionMethods.add("same_payment");
      if (e.type.includes("ip")) detectionMethods.add("same_ip");
      if (e.type.includes("mirror")) detectionMethods.add("mirror_trading");
      if (e.type.includes("similarity"))
        detectionMethods.add("trading_similarity");
      if (e.type.includes("coordinated"))
        detectionMethods.add("coordinated_entry");
      if (e.type.includes("rapid")) detectionMethods.add("rapid_creation");
      if (
        e.type.includes("vpn") ||
        e.type.includes("proxy") ||
        e.type.includes("tor")
      )
        detectionMethods.add("vpn_usage");
    });

    const methodCount = detectionMethods.size;
    const methodNames = Array.from(detectionMethods)
      .map((m) => m.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()))
      .join(", ");

    // Update title to show multiple methods and evidence count
    // Reason: Use suspiciousUserIds.length (not userIds.length) because suspiciousUserIds
    // now includes ALL accounts ever linked to this alert, not just the current trigger set.
    const totalAccountsInvolved = existingAlert.suspiciousUserIds.length;
    existingAlert.title = `Multiple Fraud Indicators (${methodCount} methods, ${existingAlert.evidence.length} detections)`;
    existingAlert.description = `${totalAccountsInvolved} accounts flagged for: ${methodNames}`;

    // Upgrade severity if new detection is higher
    const severityLevels = new Map<string, number>([
      ["low", 1],
      ["medium", 2],
      ["high", 3],
      ["critical", 4],
    ]);
    if (
      (severityLevels.get(severity) ?? 1) >
      (severityLevels.get(existingAlert.severity) ?? 1)
    ) {
      // console.log(
        // `⬆️ [ALERT] Upgrading severity: ${existingAlert.severity} → ${severity}`,
      // );
      existingAlert.severity = severity;
    }

    // Update confidence (use highest confidence)
    if (confidence > existingAlert.confidence) {
      existingAlert.confidence = confidence;
    }

    // Increment detection count and add to history
    existingAlert.detectionCount = (existingAlert.detectionCount || 0) + 1;
    if (!existingAlert.detectionHistory) {
      existingAlert.detectionHistory = [];
    }

    // Get triggered by user from evidence if available
    const triggeredBy = evidence[0]?.data?.lastActivity?.userId || userIds[0];
    const ipAddress =
      evidence[0]?.data?.lastActivity?.ipAddress ||
      evidence[0]?.data?.primaryDevice?.ipAddress;

    existingAlert.detectionHistory.push({
      timestamp: new Date(),
      triggeredBy: triggeredBy,
      ipAddress: ipAddress,
      details: `${alertType} detection #${existingAlert.detectionCount}`,
    });

    // console.log(
      // `📊 [ALERT] Detection count: ${existingAlert.detectionCount} (history: ${existingAlert.detectionHistory.length} entries)`,
    // );

    try {
      await existingAlert.save();

      // console.log(`✅ [ALERT] ========== MERGE SUCCESSFUL ==========`);
      // console.log(`   Alert ID: ${existingAlert._id}`);
      // console.log(`   New Title: ${existingAlert.title}`);
      // console.log(`   Detection Methods: ${methodNames}`);
      // console.log(`   Total Evidence: ${existingAlert.evidence.length} items`);
      // console.log(`   Detection Count: ${existingAlert.detectionCount}`);
      // console.log(`   Severity: ${existingAlert.severity}`);
      // console.log(`   Status: ${existingAlert.status}`);

      // Reason: Propagate reduced suspicion scores to ALL users in the alert
      // who were NOT directly involved in this specific detection. This ensures
      // that a user linked through payment sharing also gets (reduced) scores
      // for mirror trading, coordinated entry, etc. detected in their network.
      await this.propagateScoresToLinkedUsers(
        existingAlert.suspiciousUserIds,
        userIds,
        alertType,
      );
    } catch (saveError) {
      console.error(`❌ [ALERT] FAILED to save merged alert:`, saveError);
      throw saveError;
    }
  }

  /**
   * Propagate reduced suspicion scores to linked users in an alert.
   *
   * When fraud is detected between users B and C (e.g., mirror trading),
   * user A (who is in the same alert via payment sharing) should also get
   * a reduced score for mirror trading to reflect their network risk.
   */
  private static async propagateScoresToLinkedUsers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allAlertUserIds: any[],
    directUserIds: string[],
    alertType: string,
  ): Promise<void> {
    const alertTypeMap = new Map(Object.entries(this.ALERT_TYPE_TO_SCORE_METHOD));
    const scoreMethod = alertTypeMap.get(alertType);
    if (!scoreMethod) return; // No score method for this alert type

    const percentageMap = new Map(Object.entries(this.LINKED_SCORE_PERCENTAGES));
    const reducedPercentage = percentageMap.get(scoreMethod);
    if (!reducedPercentage) return;

    const directSet = new Set(directUserIds.map((id) => id.toString()));
    const linkedUserIds = allAlertUserIds
      .map((id: { toString: () => string }) => id.toString())
      .filter((uid: string) => !directSet.has(uid));

    if (linkedUserIds.length === 0) return;

    // Reason: Update scores for linked users with a reduced percentage.
    // This is fire-and-forget style — errors are logged but don't block.
    for (const linkedUserId of linkedUserIds) {
      try {
        await SuspicionScoringService.updateScore(linkedUserId, {
          method: scoreMethod,
          percentage: reducedPercentage,
          evidence: `Linked to accounts detected for ${alertType.replace(/_/g, " ")}`,
          linkedUserIds: Array.from(directSet),
        });
      } catch (err) {
        console.error(
          `⚠️ [ALERT] Failed to propagate ${scoreMethod} score to linked user ${linkedUserId}:`,
          err,
        );
      }
    }
  }

  /**
   * Create a new alert
   */
  private static async createNewAlert(
    params: CreateOrUpdateAlertParams,
  ): Promise<void> {
    const {
      alertType,
      userIds,
      title,
      description,
      severity,
      confidence,
      evidence,
      competitionId,
    } = params;

    // console.log(`🆕 [ALERT] Creating new ${alertType} alert`);

    // Count previous alerts for these users (dismissed/resolved)
    const userIdStrings = userIds.map((id) => id.toString());
    const previousAlertCount = await FraudAlert.countDocuments({
      $or: [
        { suspiciousUserIds: { $in: userIdStrings } },
        { primaryUserId: { $in: userIdStrings } },
      ],
      status: { $in: ["dismissed", "resolved"] },
    });

    // console.log(`   Previous alerts for these users: ${previousAlertCount}`);

    // Add competitionId to evidence data if provided
    const enhancedEvidence = evidence.map((e) => ({
      ...e,
      data: {
        ...e.data,
        ...(competitionId && { competitionId }),
      },
    }));

    // Get triggered by user from evidence if available
    const triggeredBy = evidence[0]?.data?.lastActivity?.userId || userIds[0];
    const ipAddress =
      evidence[0]?.data?.lastActivity?.ipAddress ||
      evidence[0]?.data?.primaryDevice?.ipAddress;

    await FraudAlert.create({
      alertType,
      severity,
      status: "pending",
      primaryUserId: userIds[0].toString(),
      suspiciousUserIds: userIdStrings,
      confidence,
      title,
      description,
      evidence: enhancedEvidence,
      autoGenerated: true,
      notificationSent: false,
      detectionCount: 1,
      detectionHistory: [
        {
          timestamp: new Date(),
          triggeredBy: triggeredBy,
          ipAddress: ipAddress,
          details: `Initial ${alertType} detection`,
        },
      ],
      previousAlertCount: previousAlertCount,
      ...(competitionId && { competitionId }),
    });

    // console.log(
      // `✅ [ALERT] Created new ${alertType} alert for ${userIds.length} accounts`,
    // );
    // console.log(
      // `   Detection count: 1, Previous alerts: ${previousAlertCount}`,
    // );
    if (competitionId) {
      // console.log(`   Competition: ${competitionId}`);
    }
  }

  /**
   * Check if alert can be created for these users
   * Returns false if there's already a resolved/dismissed alert
   */
  static async canCreateAlert(
    userIds: string[],
    alertType: string,
    competitionId?: string,
  ): Promise<boolean> {
    await connectToDatabase();

    // Use strings for query (schema stores strings, not ObjectIds)
    const userIdStrings = userIds.map((id) => id.toString());

    const userQuery = {
      $or: [
        { suspiciousUserIds: { $in: userIdStrings } },
        { primaryUserId: { $in: userIdStrings } },
      ],
    };

    // For competition alerts, check competition-specific
    if (competitionId) {
      const existingAlert = await FraudAlert.findOne({
        ...userQuery,
        alertType,
        competitionId, // Use direct field, not evidence.data
        status: { $in: ["dismissed", "resolved"] },
      });
      // Allow new alert if user was cleared
      if (existingAlert?.investigationClearedAt) {
        return true;
      }
      return !existingAlert;
    }

    // For other alerts, check globally
    const existingAlert = await FraudAlert.findOne({
      ...userQuery,
      alertType,
      status: { $in: ["dismissed", "resolved"] },
    });

    // Allow new alert if user was cleared
    if (existingAlert?.investigationClearedAt) {
      return true;
    }

    return !existingAlert;
  }

  /**
   * Helper: Format detection method name for display
   */
  private static formatMethodName(method: string): string {
    return method.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Helper: Get severity level as number for comparison
   */
  private static getSeverityLevel(severity: string): number {
    const levels = new Map<string, number>([
      ["low", 1],
      ["medium", 2],
      ["high", 3],
      ["critical", 4],
    ]);
    return levels.get(severity) ?? 1;
  }
}
