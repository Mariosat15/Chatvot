/* eslint-disable @typescript-eslint/no-explicit-any -- Mongo query builders and lean() documents are dynamically shaped in this module. */
/* eslint-disable security/detect-non-literal-regexp -- every RegExp input is escapeRegex()'d before interpolation (see escapeRegex usage below). */
/* eslint-disable security/detect-object-injection -- object/array access uses trusted loop indices and queried keys, never raw user input. */
import crypto from "crypto";
import KYCSession from "@/database/models/kyc-session.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import FraudSettings from "@/database/models/fraud/fraud-settings.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import UserRestriction from "@/database/models/user-restriction.model";
import { connectToDatabase } from "@/database/mongoose";
import { isValidObjectId } from "@/lib/utils/url-validator";

interface DocumentInfo {
  documentNumber?: string;
  documentType?: string;
  documentCountry?: string;
  idNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateAccounts: {
    userId: string;
    userEmail?: string;
    userName?: string;
    sessionId: string;
    verifiedAt?: Date;
    matchType: "document_number" | "id_number" | "fingerprint" | "name_dob";
  }[];
  alertCreated: boolean;
  alertId?: string;
  usersSuspended: string[];
  suspensionMessage?: string;
}

/**
 * Generate a fingerprint hash from document data
 */
function generateDocumentFingerprint(doc: DocumentInfo): string | null {
  const parts: string[] = [];

  // Use document number as primary identifier
  if (doc.documentNumber) {
    parts.push(doc.documentNumber.toUpperCase().replace(/\s/g, ""));
  }

  if (doc.documentCountry) {
    parts.push(doc.documentCountry.toUpperCase());
  }

  if (doc.documentType) {
    parts.push(doc.documentType.toUpperCase());
  }

  if (parts.length < 2) return null;

  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Generate an alternative fingerprint using ID number
 */
function generateIdFingerprint(doc: DocumentInfo): string | null {
  if (!doc.idNumber) return null;

  const parts = [doc.idNumber.toUpperCase().replace(/\s/g, "")];

  if (doc.documentCountry) {
    parts.push(doc.documentCountry.toUpperCase());
  }

  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Check for duplicate KYC documents across accounts
 */
export async function checkForDuplicateKYC(
  userId: string,
  sessionId: string,
  documentInfo: DocumentInfo,
): Promise<DuplicateCheckResult> {
  await connectToDatabase();

  const result: DuplicateCheckResult = {
    isDuplicate: false,
    duplicateAccounts: [],
    alertCreated: false,
    usersSuspended: [],
  };

  // Generate fingerprints
  const docFingerprint = generateDocumentFingerprint(documentInfo);
  const _idFingerprint = generateIdFingerprint(documentInfo);

  // Update session with fingerprints
  const updateData: any = {};
  if (docFingerprint) updateData.documentFingerprint = docFingerprint;

  if (Object.keys(updateData).length > 0) {
    await KYCSession.findByIdAndUpdate(sessionId, updateData);
  }

  // Build queries for duplicate detection
  const duplicateQueries: any[] = [];

  // Query 1: Same document number and country
  if (documentInfo.documentNumber && documentInfo.documentCountry) {
    duplicateQueries.push({
      userId: { $ne: userId },
      status: "approved",
      "documentData.number": new RegExp(
        `^${escapeRegex(documentInfo.documentNumber)}$`,
        "i",
      ),
      "documentData.country": documentInfo.documentCountry.toUpperCase(),
    });
  }

  // Query 2: Same ID number
  if (documentInfo.idNumber) {
    duplicateQueries.push({
      userId: { $ne: userId },
      status: "approved",
      "personData.idNumber": new RegExp(
        `^${escapeRegex(documentInfo.idNumber)}$`,
        "i",
      ),
    });
  }

  // Query 3: Same document fingerprint
  if (docFingerprint) {
    duplicateQueries.push({
      userId: { $ne: userId },
      status: "approved",
      documentFingerprint: docFingerprint,
    });
  }

  // Query 4: Same name + date of birth (less confident, but useful)
  if (
    documentInfo.firstName &&
    documentInfo.lastName &&
    documentInfo.dateOfBirth
  ) {
    duplicateQueries.push({
      userId: { $ne: userId },
      status: "approved",
      "personData.firstName": new RegExp(
        `^${escapeRegex(documentInfo.firstName)}$`,
        "i",
      ),
      "personData.lastName": new RegExp(
        `^${escapeRegex(documentInfo.lastName)}$`,
        "i",
      ),
      "personData.dateOfBirth": documentInfo.dateOfBirth,
    });
  }

  // Execute duplicate searches
  const duplicateSessions: any[] = [];

  for (let i = 0; i < duplicateQueries.length; i++) {
    const matches = await KYCSession.find(duplicateQueries[i]).lean();
    for (const match of matches) {
      // Check if we already found this user
      if (!duplicateSessions.some((s) => s.userId === match.userId)) {
        const matchType =
          i === 0
            ? "document_number"
            : i === 1
              ? "id_number"
              : i === 2
                ? "fingerprint"
                : "name_dob";

        duplicateSessions.push({
          ...match,
          matchType,
        });
      }
    }
  }

  if (duplicateSessions.length === 0) {
    return result;
  }

  // Found duplicates!
  result.isDuplicate = true;

  // Batch-fetch wallets for all duplicate users (avoid N+1)
  const duplicateUserIds = [
    ...new Set(duplicateSessions.map((s) => s.userId)),
  ];
  const wallets = await CreditWallet.find({
    userId: { $in: duplicateUserIds },
  }).lean();
  const walletByUserId = new Map(
    wallets.map((w: any) => [String(w.userId), w]),
  );

  // Enrich with user details
  for (const session of duplicateSessions) {
    const _wallet = walletByUserId.get(String(session.userId)) || null;

    result.duplicateAccounts.push({
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      sessionId: session._id.toString(),
      verifiedAt: session.completedAt || session.updatedAt,
      matchType: session.matchType,
    });
  }

  // Create fraud alert
  const allInvolvedUserIds = [
    userId,
    ...result.duplicateAccounts.map((d) => d.userId),
  ].filter(id => isValidObjectId(id)); // Validate all user IDs to prevent NoSQL injection

  if (allInvolvedUserIds.length === 0) {
    console.error("❌ [KYC Fraud] No valid user IDs found");
    return result;
  }

  // Check if alert already exists for these users
  const existingAlert = await FraudAlert.findOne({
    alertType: "duplicate_kyc",
    suspiciousUserIds: { $all: allInvolvedUserIds },
    status: { $in: ["pending", "investigating"] },
  });

  if (!existingAlert) {
    const alert = await FraudAlert.create({
      alertType: "duplicate_kyc",
      severity: "critical",
      status: "pending",
      primaryUserId: userId,
      suspiciousUserIds: allInvolvedUserIds,
      confidence: calculateConfidence(result.duplicateAccounts),
      evidence: [
        {
          type: "duplicate_document",
          description: "Same identity document used across multiple accounts",
          data: {
            newUserId: userId,
            newSessionId: sessionId,
            documentInfo: {
              type: documentInfo.documentType,
              country: documentInfo.documentCountry,
              numberMasked: documentInfo.documentNumber
                ? maskDocumentNumber(documentInfo.documentNumber)
                : undefined,
            },
            existingAccounts: result.duplicateAccounts.map((d) => ({
              userId: d.userId,
              userEmail: d.userEmail,
              matchType: d.matchType,
              verifiedAt: d.verifiedAt,
            })),
          },
        },
      ],
      title: "🚨 Duplicate KYC Document Detected",
      description:
        `The same identity document was used to verify ${allInvolvedUserIds.length} different accounts. ` +
        `Document: ${documentInfo.documentType || "Unknown"} from ${documentInfo.documentCountry || "Unknown"}. ` +
        `Match type: ${result.duplicateAccounts[0]?.matchType || "unknown"}. ` +
        `This is a strong indicator of potential fraud or multi-accounting.`,
      detectedAt: new Date(),
      autoGenerated: true,
      notificationSent: false,
    });

    result.alertCreated = true;
    result.alertId = alert._id.toString();

    console.log(
      `🚨 [KYC Fraud] Created duplicate KYC alert for user ${userId}. Alert ID: ${alert._id}`,
    );

    // Update suspicion scores for ALL involved users
    const kycDuplicatePercentage = 50; // Max 50% contribution for KYC duplication
    const evidenceText =
      `Duplicate KYC document detected with ${allInvolvedUserIds.length - 1} other account(s). ` +
      `Match type: ${result.duplicateAccounts[0]?.matchType || "unknown"}`;

    // Reason: this used to read-then-create its own score document per user, which loses
    // the race against the unique index on `userId` and silently discards the
    // contribution - and a KYC duplicate scan updates several users at once, so the race
    // is the normal case here rather than an edge one. `updateScore` is the single atomic
    // path: it upserts, records the linked accounts, and reconciles the total server-side.
    // See `__tests__/services/suspicion-score-race.test.ts`.
    const { SuspicionScoringService } = await import(
      "@/lib/services/fraud/suspicion-scoring.service"
    );

    for (const involvedUserId of allInvolvedUserIds) {
      try {
        const updated = await SuspicionScoringService.updateScore(
          involvedUserId,
          {
            method: "kycDuplicate",
            percentage: kycDuplicatePercentage,
            evidence: evidenceText,
            linkedUserIds: allInvolvedUserIds.filter(
              (otherId) => otherId !== involvedUserId,
            ),
            confidence: 0.95, // High confidence for KYC match
            // Preserves the label this detector has always stored; see ScoreUpdate.
            matchType: "kyc_duplicate",
          },
        );
        console.log(
          `  📊 Updated suspicion score for user ${involvedUserId}: ${updated.totalScore}% (${updated.riskLevel})`,
        );
      } catch (scoreError) {
        console.error(
          `  ❌ Failed to update suspicion score for ${involvedUserId}:`,
          scoreError,
        );
      }
    }

    // Check if auto-suspend is enabled
    const fraudSettings = (await FraudSettings.findOne().lean()) as {
      duplicateKYCAutoSuspend?: boolean;
      duplicateKYCSuspendMessage?: string;
      duplicateKYCBlockTrading?: boolean;
      duplicateKYCBlockCompetitions?: boolean;
      duplicateKYCBlockChallenges?: boolean;
      duplicateKYCBlockDeposits?: boolean;
      duplicateKYCAllowWithdrawals?: boolean;
    } | null;

    if (fraudSettings?.duplicateKYCAutoSuspend) {
      console.log(
        `🔒 [KYC Fraud] Auto-suspend enabled, suspending all involved users...`,
      );

      result.suspensionMessage = fraudSettings.duplicateKYCSuspendMessage;

      // Suspend all involved users
      for (const involvedUserId of allInvolvedUserIds) {
        // Check if user already has an active restriction for this
        const existingRestriction = await UserRestriction.findOne({
          userId: involvedUserId,
          reason: "kyc_fraud",
          isActive: true,
        });

        if (!existingRestriction) {
          await UserRestriction.create({
            userId: involvedUserId,
            restrictionType: "suspended",
            reason: "kyc_fraud",
            customReason: `Duplicate KYC detected. Same identity document used across multiple accounts. Alert ID: ${alert._id}`,
            canTrade: !fraudSettings.duplicateKYCBlockTrading,
            canEnterCompetitions: !fraudSettings.duplicateKYCBlockCompetitions,
            canEnterChallenges: !fraudSettings.duplicateKYCBlockChallenges,
            canDeposit: !fraudSettings.duplicateKYCBlockDeposits,
            canWithdraw: fraudSettings.duplicateKYCAllowWithdrawals,
            restrictedBy: "system",
            relatedFraudAlertId: alert._id.toString(),
            relatedUserIds: allInvolvedUserIds.filter(
              (id) => id !== involvedUserId,
            ),
            isActive: true,
          });

          result.usersSuspended.push(involvedUserId);
          console.log(`  ✅ Suspended user: ${involvedUserId}`);
        } else {
          console.log(
            `  ⏭️ User ${involvedUserId} already has active KYC fraud restriction`,
          );
        }
      }

      console.log(
        `🔒 [KYC Fraud] Suspended ${result.usersSuspended.length} users`,
      );
    }
  }

  return result;
}

/**
 * Calculate confidence score based on match types
 */
function calculateConfidence(
  duplicates: DuplicateCheckResult["duplicateAccounts"],
): number {
  if (duplicates.length === 0) return 0;

  // Base confidence from match type
  const matchTypeConfidence: Record<string, number> = {
    document_number: 0.95,
    id_number: 0.95,
    fingerprint: 0.9,
    name_dob: 0.7,
  };

  // Take highest confidence from matches
  let maxConfidence = 0;
  for (const dup of duplicates) {
    const conf = matchTypeConfidence[dup.matchType] || 0.5;
    if (conf > maxConfidence) maxConfidence = conf;
  }

  // Increase confidence if multiple accounts found
  if (duplicates.length > 1) {
    maxConfidence = Math.min(
      maxConfidence + 0.05 * (duplicates.length - 1),
      1.0,
    );
  }

  return Math.round(maxConfidence * 100) / 100;
}

/**
 * Mask document number for logs/display
 */
function maskDocumentNumber(docNumber: string): string {
  if (docNumber.length <= 4) return "****";
  return (
    docNumber.slice(0, 2) +
    "*".repeat(docNumber.length - 4) +
    docNumber.slice(-2)
  );
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get all duplicate KYC alerts
 */
export async function getDuplicateKYCAlerts(status?: string): Promise<any[]> {
  await connectToDatabase();

  const query: any = { alertType: "duplicate_kyc" };
  if (status) query.status = status;

  return FraudAlert.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Check if a user has been flagged for duplicate KYC
 */
export async function isUserFlaggedForDuplicateKYC(
  userId: string,
): Promise<boolean> {
  await connectToDatabase();

  const alert = await FraudAlert.findOne({
    alertType: "duplicate_kyc",
    suspiciousUserIds: userId,
    status: { $in: ["pending", "investigating"] },
  });

  return !!alert;
}

export default {
  checkForDuplicateKYC,
  getDuplicateKYCAlerts,
  isUserFlaggedForDuplicateKYC,
};
