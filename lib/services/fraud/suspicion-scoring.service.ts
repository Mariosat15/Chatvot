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

/**
 * A `.lean()` suspicion score: plain data with the document methods stripped.
 *
 * Named so that the three read helpers below can state what they return instead of casting
 * through `any`, which hid the fact that a lean result has no `addPercentage` on it.
 */
export type LeanSuspicionScore = Omit<
  ISuspicionScore,
  | "calculateRiskLevel"
  | "addPercentage"
  | "addPoints"
  | "addLinkedAccount"
  | "resetScore"
>;

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
    kycDuplicate: 50, // 50% for duplicate KYC documents
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
   * This is the ONLY way a score document should be obtained. Four other call sites used
   * to read-then-create their own, and each one carried the race described below; they now
   * all come through here.
   *
   * Reason: `userId` is uniquely indexed, so a read-then-create loses the race. Measured
   * on 1 Sep 2026 (`__tests__/services/suspicion-score-race.test.ts`): with twenty
   * detectors arriving together for a user who has no score yet, seventeen of them threw
   * E11000 and their contributions were discarded. Every caller is a fire-and-forget fraud
   * detector that logs and swallows, so nothing surfaced. The harm is that the entry fraud
   * gate reads `totalScore` to decide whether to refuse an entry, and coordinated entry -
   * many accounts joining one contest in the same second - is both what the detector looks
   * for and what provokes the race, so detection was weakest exactly when needed.
   *
   * It became reachable at scale only when Defect 1's unified entry service gave both join
   * gates a retry loop. Before that the entry path admitted about one concurrent join in
   * twenty, and the losers never reached the fraud services at all.
   */
  static async getOrCreateScore(userId: string): Promise<ISuspicionScore> {
    await connectToDatabase();

    // Reason: `$setOnInsert` rather than `$set` is what makes this safe to call on a user
    // who already has a score - the zero values are written only when the document is
    // actually created, never over a score that has accumulated.
    //
    // `scoreBreakdown` is deliberately absent: the schema declares a default for each of
    // the fourteen methods, and naming the parent here would insert an empty object
    // instead. That would be worse than the race it replaced, because `addPercentage`
    // returns silently when `scoreBreakdown[method]` is missing - every score would then
    // read zero forever. Pinned by the tests asserting a non-zero total.
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

    // Reason: `save()` writes only the paths this caller modified, so two detectors using
    // DIFFERENT methods both persist their own breakdown entry - but `totalScore` is a
    // whole-document field that each computed from its own stale copy, so it is
    // last-write-wins. The document then contradicts itself: measured on 1 Sep 2026, a
    // concurrent 40% and 25% left both breakdown entries correct and `totalScore` at 40.
    // That is worse than losing the write outright, because `riskLevel` derives from the
    // total, so 65% - which crosses the "high" threshold - was filed as medium and the
    // account was never auto-restricted. Recomputing server-side from the document's own
    // persisted breakdown is order-independent: whichever caller reconciles last sees
    // every entry, so the pair always converges on the right total.
    const reconciled = await this.reconcileTotals(userId);

    const current = reconciled ?? score;

    // Reason: this used to run only when `oldRiskLevel !== current.riskLevel`, which made
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
   * document, in one atomic server-side update.
   *
   * Reason for a pipeline update rather than a read-modify-write: the sum must be taken
   * from what is IN the document at that moment, not from a copy the caller loaded
   * earlier. That is the whole point - it is what makes the operation order-independent
   * and therefore safe to run concurrently.
   *
   * The thresholds are duplicated from the model's `calculateRiskLevel` because the
   * comparison happens inside MongoDB, where a JavaScript method cannot run. They must be
   * kept in step; the tests assert a specific band either side of a boundary so a
   * divergence fails rather than quietly mis-classifying accounts.
   */
  private static async reconcileTotals(
    userId: string,
  ): Promise<ISuspicionScore | null> {
    // Derived from the schema, not hard-coded, so a newly declared detection method is
    // counted without anyone having to remember this function exists.
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
   * Get suspicion score for a user (plain object, no methods)
   */
  static async getScore(userId: string): Promise<LeanSuspicionScore | null> {
    await connectToDatabase();
    return (await SuspicionScore.findOne({
      userId,
    }).lean()) as unknown as LeanSuspicionScore | null;
  }

  /**
   * Get all high-risk users (plain objects, no methods)
   */
  static async getHighRiskUsers(): Promise<LeanSuspicionScore[]> {
    await connectToDatabase();
    return (await SuspicionScore.find({
      riskLevel: { $in: ["high", "critical"] },
    })
      .sort({ totalScore: -1 })
      .lean()) as unknown as LeanSuspicionScore[];
  }

  /**
   * Get users by risk level (plain objects, no methods)
   */
  static async getUsersByRiskLevel(
    level: "low" | "medium" | "high" | "critical",
  ): Promise<LeanSuspicionScore[]> {
    await connectToDatabase();
    return (await SuspicionScore.find({ riskLevel: level })
      .sort({ totalScore: -1 })
      .lean()) as unknown as LeanSuspicionScore[];
  }

  /**
   * Reset score for a user.
   *
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

    // console.log(`🔄 Reset suspicion score for user ${userId}`);

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
        // console.log(
          // `⏭️ Auto-suspend is DISABLED in admin settings. User ${userId} NOT auto-restricted.`,
        // );
        // console.log(
          // `   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`,
        // );
        // console.log(
          // `   To enable auto-suspension, admin must enable it in Fraud Settings.`,
        // );
        return;
      }

      // Check if score meets auto-suspend threshold
      if (score.totalScore < settings.autoSuspendThreshold) {
        // console.log(
          // `⏭️ User ${userId} score (${score.totalScore}) below auto-suspend threshold (${settings.autoSuspendThreshold}). Not auto-restricting.`,
        // );
        return;
      }

      // Check if already restricted
      const existingRestriction = await UserRestriction.findOne({
        userId,
        isActive: true,
      });

      if (existingRestriction) {
        // console.log(
          // `⏭️ User ${userId} already restricted, skipping auto-restriction`,
        // );
        return;
      }

      // Auto-suspend enabled and threshold met - create restriction
      // console.log(`🚨 AUTO-SUSPEND ENABLED: Restricting user ${userId}`);
      // console.log(
        // `   Score: ${score.totalScore}/100, Threshold: ${settings.autoSuspendThreshold}`,
      // );

      await UserRestriction.create({
        userId,
        restrictionType: "suspended",
        reason: "automated_fraud_detection",
        customReason: `Automatically suspended: Suspicion score (${score.totalScore}%) exceeded auto-suspend threshold (${settings.autoSuspendThreshold}%). Admin has enabled auto-suspension in fraud settings.`,
        canTrade: false,
        canEnterCompetitions: false,
        // Reason: added explicitly 2 Sep 2026. The schema default now blocks
        // challenges too, but stating it here keeps the intent readable next to
        // its four siblings - an auto-suspension that left paid 1v1 challenges
        // open was the exact hole this closes.
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

      // console.log(
        // "🚨 AUTO-SUSPENDED user", userId, "- Score:", score.totalScore, "%/", settings.autoSuspendThreshold, "% threshold"
      // );
    } catch (error) {
      console.error("❌ Failed to check/auto-restrict user", userId, ":", error);
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
