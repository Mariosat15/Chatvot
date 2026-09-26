import SuspicionScore, {
  ISuspicionScore,
} from "@/database/models/fraud/suspicion-score.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import UserRestriction from "@/database/models/user-restriction.model";
import FraudSettings, {
  DEFAULT_FRAUD_SETTINGS,
} from "@/database/models/fraud/fraud-settings.model";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { FraudHistoryService } from "./fraud-history.service";
import { getUserById } from "@/lib/utils/user-lookup";

/**
 * Fraud Detection Scoring Service
 *
 * Manages cumulative fraud detection scoring system (0-100%)
 * Each method contributes a percentage to the overall score
 */

export interface ScoreUpdate {
  method: keyof ISuspicionScore["scoreBreakdown"];
  percentage: number; // 0-100%
  evidence: string;
  linkedUserIds?: string[];
  confidence?: number;
  /**
   * The label stored on each linked account, when it differs from `method`.
   *
   * Reason: the KYC detector has always written the snake_case `kyc_duplicate` here, and
   * the admin UI renders the value raw. Defaulting to `method` would silently relabel it
   * to `kycDuplicate` for new rows only, leaving the same list showing two spellings of
   * one thing. Callers with existing stored data pass their own label.
   */
  matchType?: string;
}

export class SuspicionScoringService {
  /**
   * Percentage values for each detection method (0-100%)
   * Each method contributes up to this percentage to the overall score
   */
  private static readonly PERCENTAGE_VALUES = {
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
    deviceSwitching: 15, // 15% for unusual device switching
    bruteForce: 35, // 35% for brute force login attempts
    rateLimitExceeded: 25, // 25% for rate limit violations
  };

  /**
   * Risk thresholds
   */
  private static readonly THRESHOLDS = {
    medium: 30,
    high: 50,
    critical: 70,
  };

  /**
   * Get or create the suspicion score for a user. Atomic.
   *
   * Mirrors `lib/services/fraud/suspicion-scoring.service.ts`. See that file for the
   * measurement behind this; in short, a read-then-create loses the race against the
   * unique index on `userId` and the losing detector's contribution is silently discarded,
   * which makes the fraud gate under-report exactly when many accounts arrive together.
   */
  static async getOrCreateScore(userId: string): Promise<ISuspicionScore> {
    await connectToDatabase();

    // Reason: `$setOnInsert`, so the zero values are written only on creation and never
    // over an accumulated score. `scoreBreakdown` is deliberately absent - the schema
    // defaults every method, and naming the parent here would insert an empty object,
    // after which `addPercentage` returns silently and every score reads zero forever.
    const created = await SuspicionScore.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          totalScore: 0,
          riskLevel: "low",
          linkedAccounts: [],
          scoreHistory: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return created;
  }

  /**
   * Update fraud detection score for a user
   */
  static async updateScore(
    userId: string,
    update: ScoreUpdate,
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
            update.matchType ?? update.method,
            update.confidence || 0.85,
          );
        }
      }
    }

    await score.save();

    // Reason: `save()` writes only this caller's modified paths, so two detectors using
    // different methods each persist their own breakdown entry while `totalScore` - a
    // whole-document field both computed from a stale copy - is last-write-wins. The
    // document then contradicts its own breakdown and `riskLevel`, derived from the total,
    // lands a band too low, so the account is never auto-restricted. Recomputing
    // server-side from the persisted breakdown is order-independent.
    const reconciled = await this.reconcileTotals(userId);
    const current = reconciled ?? score;

    console.log(`📊 Updated suspicion score for user ${userId}:`);
    console.log(`   Method: ${update.method}`);
    console.log(`   Percentage Added: +${update.percentage}%`);
    console.log(`   Old Score: ${oldScore} → New Score: ${current.totalScore}`);
    console.log(`   Risk Level: ${oldRiskLevel} → ${current.riskLevel}`);

    // Check if crossed threshold
    if (oldRiskLevel !== current.riskLevel) {
      console.log(
        `⚠️ RISK LEVEL CHANGED: ${oldRiskLevel} → ${current.riskLevel}`,
      );
    }

    // Reason: this used to sit inside the risk-level-change branch above, which made
    // auto-suspend almost unreachable at its default setting. The bands are medium 30,
    // high 50, critical 70, while `autoSuspendThreshold` defaults to 90. A score entering
    // "critical" at, say, 72 called the check once and was correctly turned away for being
    // under 90 - and then never called again however high it climbed, because the band no
    // longer changed. So the toggle an admin switched on quietly did nothing unless a
    // single detection jumped the score from below 70 to 90+ in one step.
    //
    // Checking on every change is safe: `checkAndAutoRestrictUser` re-reads the settings,
    // re-tests the threshold and bails if a restriction already exists, and
    // `autoRestrictedAt` stops us reconsidering an account already actioned.
    if (!current.autoRestrictedAt) {
      await this.checkAndAutoRestrictUser(userId, current);
    }

    return current;
  }

  /**
   * Recompute `totalScore` and `riskLevel` from the breakdown already stored on the
   * document, in one atomic server-side update. Mirrors the main app's copy.
   *
   * A pipeline update rather than a read-modify-write, because the sum must be taken from
   * what is IN the document at that moment - that is what makes it order-independent and
   * therefore safe to run concurrently. The thresholds are duplicated from the model's
   * `calculateRiskLevel` because the comparison happens inside MongoDB, where a JavaScript
   * method cannot run; they must be kept in step.
   */
  private static async reconcileTotals(
    userId: string,
  ): Promise<ISuspicionScore | null> {
    // Derived from the schema so a newly declared detection method is counted without
    // anyone having to remember this function exists.
    const methods = Object.keys(SuspicionScore.schema.paths)
      .map((path) => /^scoreBreakdown\.([^.]+)$/.exec(path)?.[1])
      .filter((name): name is string => Boolean(name));

    if (methods.length === 0) return null;

    return SuspicionScore.findOneAndUpdate(
      { userId },
      [
        {
          $set: {
            totalScore: {
              $min: [
                {
                  $add: methods.map((method) => ({
                    $ifNull: [`$scoreBreakdown.${method}.percentage`, 0],
                  })),
                },
                100,
              ],
            },
          },
        },
        {
          // A second stage, because it reads the `totalScore` the first one just produced.
          $set: {
            riskLevel: {
              $switch: {
                branches: [
                  {
                    case: { $gte: ["$totalScore", this.THRESHOLDS.critical] },
                    then: "critical",
                  },
                  {
                    case: { $gte: ["$totalScore", this.THRESHOLDS.high] },
                    then: "high",
                  },
                  {
                    case: { $gte: ["$totalScore", this.THRESHOLDS.medium] },
                    then: "medium",
                  },
                ],
                default: "low",
              },
            },
            lastUpdated: "$$NOW",
          },
        },
      ],
      { new: true },
    );
  }

  /**
   * Update scores for multiple users (e.g., all linked accounts)
   */
  static async updateScoresForMultipleUsers(
    userIds: string[],
    update: Omit<ScoreUpdate, "linkedUserIds">,
    linkedUserIds: string[],
  ): Promise<ISuspicionScore[]> {
    const scores: ISuspicionScore[] = [];

    for (const userId of userIds) {
      const score = await this.updateScore(userId, {
        ...update,
        linkedUserIds: linkedUserIds.filter((id) => id !== userId),
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
    deviceInfo: string,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "deviceMatch",
        percentage: this.PERCENTAGE_VALUES.deviceMatch,
        evidence: `Same device detected (${deviceInfo}) - Fingerprint: ${fingerprintId.substring(0, 12)}...`,
      },
      userIds,
    );
  }

  /**
   * IP Match Detection (+30%)
   */
  static async scoreIPMatch(
    userIds: string[],
    ipAddress: string,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "ipMatch",
        percentage: this.PERCENTAGE_VALUES.ipMatch,
        evidence: `Same IP address detected: ${ipAddress}`,
      },
      userIds,
    );
  }

  /**
   * IP + Browser Match Detection (+35%)
   */
  static async scoreIPBrowserMatch(
    userIds: string[],
    ipAddress: string,
    browser: string,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "ipBrowserMatch",
        percentage: this.PERCENTAGE_VALUES.ipBrowserMatch,
        evidence: `Same IP (${ipAddress}) and browser (${browser}) detected`,
      },
      userIds,
    );
  }

  /**
   * Timezone + Language Match Detection (+10%)
   */
  static async scoreTimezoneLanguage(
    userIds: string[],
    timezone: string,
    language: string,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "timezoneLanguage",
        percentage: this.PERCENTAGE_VALUES.timezoneLanguage,
        evidence: `Same timezone (${timezone}) and language (${language})`,
      },
      userIds,
    );
  }

  /**
   * Calculate score for same payment method
   */
  static async scorePaymentMatch(
    userIds: string[],
    paymentProvider: string,
    paymentFingerprint: string,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "samePayment",
        percentage: this.PERCENTAGE_VALUES.samePayment,
        evidence: `Same payment method detected (${paymentProvider}) - Fingerprint: ${paymentFingerprint.substring(0, 12)}...`,
      },
      userIds,
    );
  }

  /**
   * Calculate score for rapid account creation
   */
  static async scoreRapidCreation(
    userIds: string[],
    timeWindowMinutes: number,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "rapidCreation",
        percentage: this.PERCENTAGE_VALUES.rapidCreation,
        evidence: `Multiple accounts created within ${timeWindowMinutes} minutes`,
      },
      userIds,
    );
  }

  /**
   * Calculate score for coordinated competition entry
   */
  static async scoreCoordinatedEntry(
    userIds: string[],
    competitionId: string,
    timeWindowMinutes: number,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "coordinatedEntry",
        percentage: this.PERCENTAGE_VALUES.coordinatedEntry,
        evidence: `Coordinated competition entry within ${timeWindowMinutes} minutes (Competition: ${competitionId.substring(0, 12)}...)`,
      },
      userIds,
    );
  }

  /**
   * Calculate score for trading similarity
   */
  static async scoreTradingSimilarity(
    userId1: string,
    userId2: string,
    similarityPercentage: number,
  ): Promise<void> {
    const evidence = `${similarityPercentage}% trading pattern similarity detected`;

    await Promise.all([
      this.updateScore(userId1, {
        method: "tradingSimilarity",
        percentage: this.PERCENTAGE_VALUES.tradingSimilarity,
        evidence,
        linkedUserIds: [userId2],
      }),
      this.updateScore(userId2, {
        method: "tradingSimilarity",
        percentage: this.PERCENTAGE_VALUES.tradingSimilarity,
        evidence,
        linkedUserIds: [userId1],
      }),
    ]);
  }

  /**
   * Calculate score for mirror trading
   */
  static async scoreMirrorTrading(
    userId1: string,
    userId2: string,
    matchRate: number,
  ): Promise<void> {
    const evidence = `Mirror trading detected (${Math.round(matchRate * 100)}% opposite trades)`;

    await Promise.all([
      this.updateScore(userId1, {
        method: "mirrorTrading",
        percentage: this.PERCENTAGE_VALUES.mirrorTrading,
        evidence,
        linkedUserIds: [userId2],
      }),
      this.updateScore(userId2, {
        method: "mirrorTrading",
        percentage: this.PERCENTAGE_VALUES.mirrorTrading,
        evidence,
        linkedUserIds: [userId1],
      }),
    ]);
  }

  /**
   * Calculate score for same city/location
   */
  static async scoreSameCity(
    userIds: string[],
    city: string,
    distanceKm: number,
  ): Promise<void> {
    await this.updateScoresForMultipleUsers(
      userIds,
      {
        method: "sameCity",
        percentage: this.PERCENTAGE_VALUES.sameCity,
        evidence: `Accounts within ${distanceKm}km (${city})`,
      },
      userIds,
    );
  }

  /**
   * Calculate score for unusual device switching
   */
  static async scoreDeviceSwitching(
    userId: string,
    deviceCount: number,
    timeWindowHours: number,
  ): Promise<void> {
    await this.updateScore(userId, {
      method: "deviceSwitching",
      percentage: this.PERCENTAGE_VALUES.deviceSwitching,
      evidence: `Used ${deviceCount} different devices within ${timeWindowHours} hours`,
    });
  }

  /**
   * Calculate score for brute force login attempts (+35%)
   */
  static async scoreBruteForce(
    userId: string,
    failedAttempts: number,
    ipAddress: string,
    email?: string,
  ): Promise<void> {
    await this.updateScore(userId, {
      method: "bruteForce",
      percentage: this.PERCENTAGE_VALUES.bruteForce,
      evidence: `Brute force attack: ${failedAttempts} failed login attempts from IP ${ipAddress}${email ? ` for ${email}` : ""}`,
    });
  }

  /**
   * Calculate score for rate limit violations (+25%)
   */
  static async scoreRateLimitExceeded(
    userId: string,
    limitType: "registration" | "login" | "api",
    attempts: number,
    ipAddress: string,
  ): Promise<void> {
    await this.updateScore(userId, {
      method: "rateLimitExceeded",
      percentage: this.PERCENTAGE_VALUES.rateLimitExceeded,
      evidence: `Rate limit exceeded: ${attempts} ${limitType} attempts from IP ${ipAddress}`,
    });
  }

  /**
   * Get suspicion score for a user (plain object, no methods)
   */
  static async getScore(
    userId: string,
  ): Promise<Omit<
    ISuspicionScore,
    | "calculateRiskLevel"
    | "addPercentage"
    | "addPoints"
    | "addLinkedAccount"
    | "resetScore"
  > | null> {
    await connectToDatabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await SuspicionScore.findOne({ userId }).lean()) as any;
  }

  /**
   * Get all high-risk users (plain objects, no methods)
   */
  static async getHighRiskUsers(): Promise<
    Omit<
      ISuspicionScore,
      | "calculateRiskLevel"
      | "addPercentage"
      | "addPoints"
      | "addLinkedAccount"
      | "resetScore"
    >[]
  > {
    await connectToDatabase();
    return (await SuspicionScore.find({
      riskLevel: { $in: ["high", "critical"] },
    })
      .sort({ totalScore: -1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .lean()) as any;
  }

  /**
   * Get users by risk level (plain objects, no methods)
   */
  static async getUsersByRiskLevel(
    level: "low" | "medium" | "high" | "critical",
  ): Promise<
    Omit<
      ISuspicionScore,
      | "calculateRiskLevel"
      | "addPercentage"
      | "addPoints"
      | "addLinkedAccount"
      | "resetScore"
    >[]
  > {
    await connectToDatabase();
    return (await SuspicionScore.find({ riskLevel: level })
      .sort({ totalScore: -1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .lean()) as any;
  }

  /**
   * Reset score for a user
   */
  /**
   * `reason` is recorded in the document's scoreHistory. Pass one - it is the
   * only trace a reset leaves, and it distinguishes a dismissed investigation
   * from an admin clearing a score by hand.
   */
  static async resetScore(
    userId: string,
    reason?: string,
  ): Promise<ISuspicionScore> {
    await connectToDatabase();

    const score = await this.getOrCreateScore(userId);
    score.resetScore(reason);
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
    score: ISuspicionScore,
  ): Promise<void> {
    try {
      // Get fraud settings to check if auto-suspend is enabled
      const settings = await this.getFraudSettings();

      // ⚠️ IMPORTANT: Only auto-restrict if admin has explicitly enabled it
      if (!settings.autoSuspendEnabled) {
        console.log(
          `⏭️ Auto-suspend is DISABLED in admin settings. User ${userId} NOT auto-restricted.`,
        );
        console.log(
          `   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`,
        );
        console.log(
          `   To enable auto-suspension, admin must enable it in Fraud Settings.`,
        );
        return;
      }

      // Check if score meets auto-suspend threshold
      if (score.totalScore < settings.autoSuspendThreshold) {
        console.log(
          `⏭️ User ${userId} score (${score.totalScore}) below auto-suspend threshold (${settings.autoSuspendThreshold}). Not auto-restricting.`,
        );
        return;
      }

      // Check if already restricted
      const existingRestriction = await UserRestriction.findOne({
        userId,
        isActive: true,
      });

      if (existingRestriction) {
        console.log(
          `⏭️ User ${userId} already restricted, skipping auto-restriction`,
        );
        return;
      }

      // Auto-suspend enabled and threshold met - create restriction
      console.log(`🚨 AUTO-SUSPEND ENABLED: Restricting user ${userId}`);
      console.log(
        `   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`,
      );

      await UserRestriction.create({
        userId,
        restrictionType: "suspended",
        reason: "automated_fraud_detection",
        customReason: `Automatically suspended: Suspicion score (${score.totalScore}%) exceeded auto-suspend threshold (${settings.autoSuspendThreshold}%). Admin has enabled auto-suspension in fraud settings.`,
        canTrade: false,
        canEnterCompetitions: false,
        // Reason: added explicitly 2 Sep 2026, mirroring the main app. The schema
        // default now blocks challenges too, but stating it here keeps the intent
        // readable next to its four siblings - an auto-suspension that left paid
        // 1v1 challenges open was the exact hole this closes.
        canEnterChallenges: false,
        canDeposit: false,
        canWithdraw: false,
        restrictedBy: "SYSTEM", // System restriction
        relatedFraudAlertId: null,
        relatedUserIds: score.linkedAccounts.map((acc) => acc.userId),
        isActive: true,
        // Reason: this said `suspensionEndsAt` until 2 Sep 2026 - a field
        // `UserRestriction` does not declare. Mongoose strict mode discarded it
        // silently, leaving `expiresAt` unset, and an unset `expiresAt` means a
        // PERMANENT ban by this model's own definition. So every automatic
        // suspension was permanent while the customReason above, and the fraud
        // history entry below, both told the admin it would lift after 7 days.
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Update score
      score.autoRestrictedAt = new Date();
      score.autoRestrictionReason = `Auto-suspended: Score ${score.totalScore}% exceeded threshold ${settings.autoSuspendThreshold}%`;
      await score.save();

      // Create fraud alert for admin review
      const _alert = await FraudAlert.create({
        alertType: "high_risk_device",
        severity: "critical",
        status: "investigating",
        primaryUserId: userId,
        suspiciousUserIds: [
          userId,
          ...score.linkedAccounts.map((acc) => acc.userId.toString()),
        ],
        confidence: 0.95,
        title: "AUTO-SUSPENSION: Score Threshold Exceeded",
        description: `User automatically suspended. Score: ${score.totalScore}% exceeded threshold: ${settings.autoSuspendThreshold}%. Admin review required.`,
        evidence: [
          {
            type: "suspicion_score",
            description:
              "Auto-suspension triggered by admin-configured threshold",
            data: {
              totalScore: score.totalScore,
              riskLevel: score.riskLevel,
              autoSuspendEnabled: true,
              autoSuspendThreshold: settings.autoSuspendThreshold,
              breakdown: score.scoreBreakdown,
              linkedAccounts: score.linkedAccounts.length,
              autoRestricted: true,
              message: "Admin has enabled auto-suspension in Fraud Settings",
            },
          },
        ],
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
          "critical",
          { accountStatus: "active", suspicionScore: score.totalScore },
          { accountStatus: "suspended", suspicionScore: score.totalScore },
        );
      }

      console.log(
        "🚨 AUTO-SUSPENDED user", userId, "- Score:", score.totalScore, "%/", settings.autoSuspendThreshold, "% threshold"
      );
    } catch (error) {
      console.error("❌ Failed to check/auto-restrict user", userId, ":", error);
    }
  }

  /**
   * Recalculate a user's suspicion score by backfilling from existing fraud alerts.
   *
   * Reason: When alerts are merged with multiple evidence types, older evidence
   * may not have been scored for all linked users. This reads all active alerts
   * for the user and ensures each evidence type is reflected in their score.
   */
  static async recalculateScoresFromAlerts(userId: string): Promise<ISuspicionScore> {
    await connectToDatabase();

    // Reason: Import FraudAlert locally to avoid circular dependency issues
    const FraudAlertModel = (await import("@/database/models/fraud/fraud-alert.model")).default;

    // Find all active/pending/investigating alerts that include this user
    const alerts = await FraudAlertModel.find({
      $or: [
        { suspiciousUserIds: userId },
        { primaryUserId: userId },
      ],
      status: { $in: ["pending", "investigating"] },
    }).lean();

    if (alerts.length === 0) {
      console.log(`📊 [RECALC] No active alerts found for user ${userId}`);
      return this.getOrCreateScore(userId);
    }

    console.log(`📊 [RECALC] Found ${alerts.length} active alerts for user ${userId}`);

    // Maps evidence type strings to score method keys
    const evidenceTypeToMethod = new Map<string, keyof ISuspicionScore["scoreBreakdown"]>([
      ["payment_fingerprint", "samePayment"],
      ["same_payment", "samePayment"],
      ["device_fingerprint", "deviceMatch"],
      ["same_device", "deviceMatch"],
      ["ip_browser_match", "ipBrowserMatch"],
      ["ip_match", "ipMatch"],
      ["same_ip", "ipMatch"],
      ["mirror_trading", "mirrorTrading"],
      ["trading_similarity", "tradingSimilarity"],
      ["coordinated_entry", "coordinatedEntry"],
      ["rapid_creation", "rapidCreation"],
      ["timezone_language", "timezoneLanguage"],
      ["kyc_duplicate", "kycDuplicate"],
      ["device_switching", "deviceSwitching"],
    ]);

    // Reduced percentages for backfill (same as LINKED_SCORE_PERCENTAGES in AlertManagerService)
    const backfillPercentages = new Map<string, number>([
      ["samePayment", 15],
      ["mirrorTrading", 18],
      ["tradingSimilarity", 15],
      ["coordinatedEntry", 13],
      ["deviceMatch", 20],
      ["ipMatch", 15],
      ["ipBrowserMatch", 18],
      ["rapidCreation", 10],
      ["timezoneLanguage", 5],
      ["deviceSwitching", 5],
      ["kycDuplicate", 15],
    ]);

    // Get current score to check which methods already have scores
    const currentScore = await this.getOrCreateScore(userId);

    // Collect all evidence types across all alerts for this user
    const allEvidenceTypes = new Set<string>();
    const otherUserIds = new Set<string>();

    for (const alert of alerts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evidence = (alert as any).evidence || [];
      for (const e of evidence) {
        if (e.type) allEvidenceTypes.add(e.type);
      }
      // Also add the alertType itself
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alertType = (alert as any).alertType;
      if (alertType) allEvidenceTypes.add(alertType);

      // Collect other user IDs for linkedAccounts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suspiciousIds: string[] = (alert as any).suspiciousUserIds || [];
      for (const id of suspiciousIds) {
        if (id.toString() !== userId) otherUserIds.add(id.toString());
      }
    }

    console.log(`📊 [RECALC] Evidence types found: ${Array.from(allEvidenceTypes).join(", ")}`);

    let updatesApplied = 0;

    for (const evidenceType of allEvidenceTypes) {
      const scoreMethod = evidenceTypeToMethod.get(evidenceType);
      if (!scoreMethod) continue;

      // Check if this method already has a score
      const breakdownMap = new Map(Object.entries(currentScore.scoreBreakdown));
      const existingBreakdown = breakdownMap.get(scoreMethod) as { percentage?: number } | undefined;
      if (existingBreakdown && (existingBreakdown.percentage || 0) > 0) {
        console.log(`   ✅ ${scoreMethod} already has ${existingBreakdown.percentage}%, skipping`);
        continue;
      }

      const percentage = backfillPercentages.get(scoreMethod);
      if (!percentage) continue;

      // Apply the score
      try {
        await this.updateScore(userId, {
          method: scoreMethod,
          percentage,
          evidence: `Backfilled from fraud alert evidence (${evidenceType})`,
          linkedUserIds: Array.from(otherUserIds),
        });
        updatesApplied++;
        console.log(`   📈 Added ${scoreMethod} +${percentage}% (from ${evidenceType})`);
      } catch (err) {
        console.error(`   ❌ Failed to update ${scoreMethod} for user ${userId}: ${err}`);
      }
    }

    console.log(`📊 [RECALC] Completed: ${updatesApplied} new score methods applied for user ${userId}`);

    // Return the updated score
    return this.getOrCreateScore(userId);
  }

  /**
   * Recalculate scores for ALL users in a specific fraud alert.
   * Called from admin panel to backfill scores for existing alerts.
   */
  static async recalculateScoresForAlert(alertId: string): Promise<number> {
    await connectToDatabase();

    const FraudAlertModel = (await import("@/database/models/fraud/fraud-alert.model")).default;

    const alert = await FraudAlertModel.findById(alertId).lean();
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds: string[] = ((alert as any).suspiciousUserIds || []).map((id: { toString: () => string }) => id.toString());

    console.log(`📊 [RECALC-ALERT] Recalculating scores for ${userIds.length} users in alert ${alertId}`);

    let totalUpdates = 0;
    for (const userId of userIds) {
      const result = await this.recalculateScoresFromAlerts(userId);
      if (result.totalScore > 0) totalUpdates++;
    }

    return totalUpdates;
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
      low: scores.filter((s) => s.riskLevel === "low").length,
      medium: scores.filter((s) => s.riskLevel === "medium").length,
      high: scores.filter((s) => s.riskLevel === "high").length,
      critical: scores.filter((s) => s.riskLevel === "critical").length,
      averageScore:
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
          : 0,
    };
  }
}

export default SuspicionScoringService;
