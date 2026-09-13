import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import KYCSession from "@/database/models/kyc-session.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import FraudSettings from "@/database/models/fraud/fraud-settings.model";
import UserRestriction from "@/database/models/user-restriction.model";
import AuditLog from "@/database/models/audit-log.model";
import { SuspicionScoringService } from "@/lib/services/fraud/suspicion-scoring.service";

type MatchType = "document_number" | "id_number" | "fingerprint" | "name_dob";

/** Only the fields this scan reads, so the grouping below is checked rather than `any`. */
interface KycSessionRow {
  userId: string;
  userEmail?: string;
  userName?: string;
  completedAt?: Date;
  createdAt?: Date;
  documentFingerprint?: string;
  documentData?: { type?: string; country?: string; number?: string };
  personData?: {
    idNumber?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
}

interface DuplicateGroup {
  key: string;
  matchType: MatchType;
  sessions: KycSessionRow[];
}

interface DuplicateReport {
  matchType: MatchType;
  userIds: string[];
  alertId: string;
  alertExisted?: boolean;
  documentInfo?: { type: string; country: string; numberMasked: string };
  accountCount?: number;
}

function maskDocNumber(num: string): string {
  if (num.length <= 4) return "****";
  return num.slice(0, 2) + "*".repeat(num.length - 4) + num.slice(-2);
}

/**
 * Bucket sessions by a caller-supplied key, skipping any session with no key.
 *
 * Reason for a Map rather than a plain object: the keys are document numbers and names
 * taken from user-submitted KYC data, so `obj[key] = ...` is a prototype-pollution sink -
 * a document number of `__proto__` or `constructor` would corrupt the grouping. A Map
 * treats every key as data. This also replaced four hand-rolled copies of the same loop.
 */
function groupSessions(
  sessions: KycSessionRow[],
  keyOf: (session: KycSessionRow) => string | undefined,
): Map<string, KycSessionRow[]> {
  const groups = new Map<string, KycSessionRow[]>();
  for (const session of sessions) {
    const key = keyOf(session);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(session);
    else groups.set(key, [session]);
  }
  return groups;
}

/** True when every user in `sessions` is already covered by an earlier group. */
function alreadyGrouped(
  groups: DuplicateGroup[],
  sessions: KycSessionRow[],
): boolean {
  return groups.some((group) => {
    const seen = new Set(group.sessions.map((s) => s.userId));
    return sessions.every((s) => seen.has(s.userId));
  });
}

const NORMALISE = (value: string) => value.toUpperCase().replace(/\s/g, "");

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get fraud settings
    const fraudSettings = await FraudSettings.findOne();

    // Get all approved KYC sessions
    const approvedSessions = await KYCSession.find({
      status: "approved",
    }).lean();

    if (approvedSessions.length < 2) {
      return NextResponse.json({
        success: true,
        message: "Not enough sessions to have duplicates",
        stats: {
          sessionsScanned: approvedSessions.length,
          duplicateGroupsFound: 0,
          alertsCreated: 0,
          scoresUpdated: 0,
          usersSuspended: 0,
        },
        duplicates: [],
      });
    }

    // Group by various identifiers to find duplicates.
    //
    // Order matters: document number first, because it is the strongest signal, then the
    // weaker ones - each of which is skipped when an earlier, stronger group already
    // covers the same set of users, so one identity is not reported four times.
    const rows = approvedSessions as unknown as KycSessionRow[];
    const duplicateGroups: DuplicateGroup[] = [];

    const passes: Array<{
      matchType: MatchType;
      keyOf: (session: KycSessionRow) => string | undefined;
      /** The strongest signal reports unconditionally; the rest defer to it. */
      skipIfCovered: boolean;
    }> = [
      {
        matchType: "document_number",
        keyOf: (s) =>
          s.documentData?.number && s.documentData?.country
            ? `${NORMALISE(s.documentData.number)}|${s.documentData.country.toUpperCase()}`
            : undefined,
        skipIfCovered: false,
      },
      {
        matchType: "id_number",
        keyOf: (s) =>
          s.personData?.idNumber ? NORMALISE(s.personData.idNumber) : undefined,
        skipIfCovered: true,
      },
      {
        matchType: "fingerprint",
        keyOf: (s) => s.documentFingerprint || undefined,
        skipIfCovered: true,
      },
      {
        matchType: "name_dob",
        keyOf: (s) =>
          s.personData?.firstName &&
          s.personData?.lastName &&
          s.personData?.dateOfBirth
            ? `${s.personData.firstName.toUpperCase()}|${s.personData.lastName.toUpperCase()}|${s.personData.dateOfBirth}`
            : undefined,
        skipIfCovered: true,
      },
    ];

    for (const pass of passes) {
      for (const [key, sessions] of groupSessions(rows, pass.keyOf)) {
        if (sessions.length < 2) continue;
        if (pass.skipIfCovered && alreadyGrouped(duplicateGroups, sessions)) {
          continue;
        }
        duplicateGroups.push({ key, matchType: pass.matchType, sessions });
      }
    }

    let alertsCreated = 0;
    let usersSuspended = 0;
    let scoresUpdated = 0;
    const duplicatesFound: DuplicateReport[] = [];

    for (const group of duplicateGroups) {
      const userIds = [...new Set(group.sessions.map((s) => s.userId))];

      // Check if alert already exists
      const existingAlert = await FraudAlert.findOne({
        alertType: "duplicate_kyc",
        suspiciousUserIds: { $all: userIds },
        status: { $in: ["pending", "investigating"] },
      });

      if (existingAlert) {
        duplicatesFound.push({
          matchType: group.matchType,
          userIds,
          alertId: existingAlert._id.toString(),
          alertExisted: true,
        });
        continue;
      }

      // Get document info from first session
      const firstSession = group.sessions[0];
      const docInfo = {
        type: firstSession.documentData?.type || "Unknown",
        country: firstSession.documentData?.country || "Unknown",
        numberMasked: firstSession.documentData?.number
          ? maskDocNumber(firstSession.documentData.number)
          : "Unknown",
      };

      // Create fraud alert
      const alert = await FraudAlert.create({
        alertType: "duplicate_kyc",
        severity: "critical",
        status: "pending",
        primaryUserId: userIds[0],
        suspiciousUserIds: userIds,
        confidence:
          group.matchType === "document_number"
            ? 0.95
            : group.matchType === "id_number"
              ? 0.95
              : group.matchType === "fingerprint"
                ? 0.9
                : 0.7,
        evidence: [
          {
            type: "duplicate_document",
            description: `Same identity document used across ${userIds.length} accounts`,
            data: {
              matchType: group.matchType,
              documentInfo: docInfo,
              accounts: group.sessions.map((s) => ({
                userId: s.userId,
                userEmail: s.userEmail,
                userName: s.userName,
                verifiedAt: s.completedAt || s.createdAt,
              })),
            },
          },
        ],
        title: "🚨 Duplicate KYC Document Detected",
        description:
          `The same identity document was used to verify ${userIds.length} different accounts. ` +
          `Document: ${docInfo.type} from ${docInfo.country}. ` +
          `Match type: ${group.matchType}. ` +
          `This is a strong indicator of potential fraud or multi-accounting.`,
        detectedAt: new Date(),
        autoGenerated: true,
        notificationSent: false,
      });

      alertsCreated++;

      // Update suspicion scores
      const evidenceText = `Duplicate KYC document detected with ${userIds.length - 1} other account(s). Match type: ${group.matchType}`;

      // Reason: this used to read-then-create its own score document per user, which loses
      // the race against the unique index on `userId` and silently discards the
      // contribution. A duplicate scan updates a whole group at once, so the race is the
      // normal case here. `updateScore` upserts atomically and reconciles the total
      // server-side. See `__tests__/services/suspicion-score-race.test.ts`.
      for (const userId of userIds) {
        try {
          await SuspicionScoringService.updateScore(userId, {
            method: "kycDuplicate",
            percentage: 50,
            evidence: evidenceText,
            linkedUserIds: userIds.filter((otherId) => otherId !== userId),
            confidence: 0.95,
            // Preserves the label this scan has always stored; see ScoreUpdate.
            matchType: "kyc_duplicate",
          });
          scoresUpdated++;
        } catch (err) {
          console.error(`Failed to update score for ${userId}:`, err);
        }
      }

      // Apply suspensions if enabled
      if (fraudSettings?.duplicateKYCAutoSuspend) {
        for (const userId of userIds) {
          const existingRestriction = await UserRestriction.findOne({
            userId,
            reason: "kyc_fraud",
            isActive: true,
          });

          if (existingRestriction) continue;

          await UserRestriction.create({
            userId,
            restrictionType: "suspended",
            reason: "kyc_fraud",
            customReason: `Duplicate KYC detected. Found by admin scan. Alert ID: ${alert._id}`,
            canTrade: !(fraudSettings.duplicateKYCBlockTrading ?? true),
            canEnterCompetitions: !(
              fraudSettings.duplicateKYCBlockCompetitions ?? true
            ),
            canDeposit: !(fraudSettings.duplicateKYCBlockDeposits ?? true),
            canWithdraw: fraudSettings.duplicateKYCAllowWithdrawals ?? true,
            restrictedBy: session.id,
            relatedFraudAlertId: alert._id.toString(),
            relatedUserIds: userIds.filter((id) => id !== userId),
            isActive: true,
          });

          usersSuspended++;
        }
      }

      duplicatesFound.push({
        matchType: group.matchType,
        userIds,
        alertId: alert._id.toString(),
        alertExisted: false,
        documentInfo: docInfo,
      });
    }

    // Log the action
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: "kyc_duplicate_scan",
      actionCategory: "security",
      description: `Scanned ${approvedSessions.length} KYC sessions. Found ${duplicateGroups.length} duplicate groups. Created ${alertsCreated} alerts, suspended ${usersSuspended} users.`,
      targetType: "settings",
      targetId: "kyc",
      metadata: {
        sessionsScanned: approvedSessions.length,
        duplicateGroupsFound: duplicateGroups.length,
        alertsCreated,
        scoresUpdated,
        usersSuspended,
      },
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message:
        duplicateGroups.length > 0
          ? `Found ${duplicateGroups.length} duplicate group(s). Created ${alertsCreated} new alert(s).`
          : "No duplicates found. All KYC sessions are unique.",
      stats: {
        sessionsScanned: approvedSessions.length,
        duplicateGroupsFound: duplicateGroups.length,
        alertsCreated,
        scoresUpdated,
        usersSuspended,
      },
      duplicates: duplicatesFound,
    });
  } catch (error) {
    console.error("Error scanning for duplicate KYC:", error);
    return NextResponse.json(
      { error: "Failed to scan for duplicates" },
      { status: 500 },
    );
  }
}
