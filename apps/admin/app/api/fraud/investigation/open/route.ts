import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import UserRestriction from "@/database/models/user-restriction.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { FraudHistoryService } from "@/lib/services/fraud/fraud-history.service";
import { auditLogService } from "@/lib/services/audit-log.service";
import { normalizeReviewPacket } from "@/lib/services/fraud/review-packet";

/**
 * POST /api/fraud/investigation/open
 *
 * Open an investigation on a fraud alert, and let the admin decide - in the same
 * step - whether the accounts involved should be restricted while it runs.
 *
 * Why this route exists
 * ---------------------
 * Elevating an alert to "investigating" used to be a bare status change on
 * `PUT /api/fraud/alerts/[id]`: no notification to the player, no restriction,
 * and no decision offered to the admin. In practice an admin who elevated an
 * alert believed they had put the account under review, while the player was
 * simultaneously locked out of contest entry by a *different* mechanism (their
 * suspicion score) that the admin could neither see nor undo.
 *
 * That score-based block is gone - see `lib/services/fraud/entry-fraud-gate.service.ts`
 * section 4 - so an investigation on its own now restricts nothing. This route
 * makes the consequence explicit and reversible:
 *
 *   restrict: false → alert goes to "investigating", player is told their
 *                     account is under review and remains fully active.
 *   restrict: true  → the same, plus a real `UserRestriction` per account, which
 *                     appears on the admin's Restricted Users screen and can be
 *                     lifted at any time.
 *
 * The alert stays "investigating" either way. Resolving it is a separate step,
 * so an admin can restrict now and decide the outcome later.
 */
export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminAuth();
    if (!adminUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const {
      alertId,
      userIds,
      restrict = false,
      suspendUntil,
      // Reason: `UserRestriction.reason` is an enum in both apps and has no
      // "under_investigation" value. suspicious_activity already carries exactly
      // this meaning, so reuse it rather than mirror a schema change.
      reason = "suspicious_activity",
      customReason,
      restrictions = {},
      hideFromPublic,
      reviewEtaDays: rawReviewEtaDays,
      documentsRequested: rawDocumentsRequested,
    } = await request.json();

    if (!alertId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: "Alert ID and user IDs required" },
        { status: 400 },
      );
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one account is required" },
        { status: 400 },
      );
    }

    // Reason: a restriction with no end date is a ban, not a review measure. An
    // investigation is by definition temporary, so refuse rather than silently
    // create something permanent the admin did not ask for.
    if (restrict && !suspendUntil) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A suspension end date is required when restricting accounts during an investigation",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const alert = await FraudAlert.findById(alertId);
    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 },
      );
    }

    const { reviewEtaDays, documentsRequested } = normalizeReviewPacket(
      rawReviewEtaDays,
      rawDocumentsRequested,
    );

    // ── 1. Restrict, if the admin chose to ────────────────────────────────
    let restrictedCount = 0;

    if (restrict) {
      // Reason: skip accounts that already carry an active restriction rather
      // than stacking a second one. Two live restrictions on one account make
      // "Lift" ambiguous - the player stays blocked by the copy the admin did
      // not lift, which is the same class of trap this whole change removes.
      const existing = await UserRestriction.find({
        userId: { $in: userIds },
        isActive: true,
      })
        .select({ userId: 1 })
        .lean();
      const alreadyRestricted = new Set(
        existing.map((r) => (r as unknown as { userId: string }).userId),
      );

      const toRestrict = userIds.filter(
        (id: string) => !alreadyRestricted.has(id),
      );

      await Promise.all(
        toRestrict.map((userId: string) =>
          UserRestriction.create({
            userId,
            restrictionType: "suspended",
            reason,
            customReason:
              customReason ||
              "Account restricted while we review recent activity",
            canTrade:
              restrictions.canTrade !== undefined
                ? restrictions.canTrade
                : false,
            canEnterCompetitions:
              restrictions.canEnterCompetitions !== undefined
                ? restrictions.canEnterCompetitions
                : false,
            canEnterChallenges:
              restrictions.canEnterChallenges !== undefined
                ? restrictions.canEnterChallenges
                : false,
            canDeposit:
              restrictions.canDeposit !== undefined
                ? restrictions.canDeposit
                : false,
            canWithdraw:
              restrictions.canWithdraw !== undefined
                ? restrictions.canWithdraw
                : false,
            hideFromPublic: !!hideFromPublic,
            expiresAt: new Date(suspendUntil),
            restrictedBy: adminUser.adminId || "unknown",
            relatedFraudAlertId: alertId,
            relatedUserIds: userIds,
            isActive: true,
            reviewEtaDays,
            documentsRequested:
              documentsRequested && documentsRequested.length > 0
                ? documentsRequested
                : undefined,
          }),
        ),
      );

      restrictedCount = toRestrict.length;
    }

    // ── 2. Move the alert to "investigating" ──────────────────────────────
    const previousStatus = alert.status;
    alert.status = "investigating";
    alert.actionTaken = restrict ? "account_suspended" : "none";
    alert.resolution = restrict
      ? `Investigation opened. ${restrictedCount} account(s) restricted until ${new Date(suspendUntil).toLocaleString()} while the review runs.`
      : "Investigation opened. No restrictions applied - accounts remain active.";
    await alert.save();

    // ── 3. Tell the players, and record it ────────────────────────────────
    const usersMap = await getUsersByIds(userIds);
    const adminInfo = {
      adminId: adminUser.adminId,
      adminEmail: adminUser.email,
      adminName: adminUser.email?.split("@")[0],
    };

    const { notificationService } = await import(
      "@/lib/services/notification.service"
    );

    for (const userId of userIds) {
      const user = usersMap.get(userId);
      if (!user) continue;

      const userInfo = { userId, email: user.email, name: user.name };

      // Reason: notify individually and swallow per-user failures. A missing
      // notification template must not abort the investigation or leave some
      // accounts restricted and others not.
      try {
        await notificationService.notifyAccountUnderReview(userId, restrict);
      } catch (notifError) {
        console.error(
          `Failed to notify ${userId} of investigation:`,
          notifError,
        );
      }

      if (previousStatus !== "investigating") {
        await FraudHistoryService.logInvestigationStarted(
          userInfo,
          alert.title,
          restrict
            ? `Investigation opened with restrictions until ${new Date(suspendUntil).toLocaleString()}. Reason: ${customReason || reason}`
            : `Investigation opened with no restrictions - account remains active. Alert: ${alert.description}`,
          adminInfo,
          alertId,
        );
      }
    }

    try {
      await auditLogService.logSecurityAlertHandled(
        {
          id: adminUser.adminId || "admin",
          email: adminUser.email || "admin",
          name: (adminUser.email || "admin").split("@")[0],
          role: "admin",
        },
        alertId,
        "fraud_investigation",
        restrict ? "investigating_restricted" : "investigating",
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    console.log(
      `🔍 Investigation opened on alert ${alertId} for ${userIds.length} account(s); ${restrictedCount} restricted`,
    );

    return NextResponse.json({
      success: true,
      message: restrict
        ? `Investigation opened. ${restrictedCount} of ${userIds.length} account(s) restricted — the rest already had a restriction.`
        : `Investigation opened. ${userIds.length} account(s) notified and left fully active.`,
      data: {
        alert: JSON.parse(JSON.stringify(alert)),
        restrictedCount,
        notified: userIds.length,
      },
    });
  } catch (error) {
    console.error("Error opening investigation:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
