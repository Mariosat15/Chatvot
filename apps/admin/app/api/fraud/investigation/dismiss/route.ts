import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import DeviceFingerprint from "@/database/models/fraud/device-fingerprint.model";
import SuspicionScore from "@/database/models/fraud/suspicion-score.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { FraudHistoryService } from "@/lib/services/fraud/fraud-history.service";
import { auditLogService } from "@/lib/services/audit-log.service";

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth();
    if (!adminUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { alertId, userIds } = await request.json();

    if (!alertId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: "Alert ID and user IDs required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Update fraud alert to dismissed
    // IMPORTANT: Set investigationClearedAt immediately since user was NOT banned/suspended
    // This allows new fraud activity to generate NEW alerts
    const clearanceTimestamp = new Date();
    const updatedAlert = await FraudAlert.findByIdAndUpdate(
      alertId,
      {
        status: "dismissed",
        resolvedAt: clearanceTimestamp,
        resolvedBy: adminUser.adminId || adminUser.email || "system",
        actionTaken: "none",
        resolution: `Investigation dismissed - Marked as false positive. After investigation, this alert was determined to be a false positive or acceptable use case (e.g., family members, shared device).`,
        // Mark as cleared so user can trigger NEW alerts if they commit fraud again
        investigationClearedAt: clearanceTimestamp,
        clearanceNote: `Dismissed by ${adminUser.email || "admin"} - User cleared without restrictions`,
      },
      { new: true },
    );

    console.log(`📝 Alert ${alertId} dismissed and marked as cleared`);
    console.log(`   → Future fraud by these users will generate NEW alerts`);

    if (!updatedAlert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 },
      );
    }

    // Reduce risk scores on device fingerprints
    await DeviceFingerprint.updateMany(
      { userId: { $in: userIds } },
      {
        $set: {
          riskScore: 0,
          flaggedForReview: false,
        },
      },
    );

    // Reason: added 2 Sep 2026. Until then this route reset only the device
    // fingerprint risk above, while telling the admin - in the fraud-history
    // entry below - that "Risk scores have been reset". The suspicion score was
    // left untouched, and that was the score that mattered: it drives alert
    // creation and, when auto-suspend is on, an actual suspension. Dismissing a
    // false positive therefore left the account primed to be flagged or
    // suspended again for the very activity an admin had just cleared.
    //
    // Clearing per-user rather than with one updateMany so the reset lands in
    // each document's scoreHistory as an admin action. That audit trail is the
    // point: this is a fraud control being switched off for a named person.
    let scoresCleared = 0;
    for (const userId of userIds) {
      try {
        const score = await SuspicionScore.findOne({ userId });
        if (!score) continue;
        score.resetScore(
          `Investigation dismissed as a false positive by ${adminUser.email || "admin"}`,
        );
        await score.save();
        scoresCleared += 1;
      } catch (scoreError) {
        // A failed reset must not abort the dismissal - the alert is already
        // closed by this point and leaving it half-done would be worse.
        console.error(
          `⚠️ Failed to reset suspicion score for ${userId}:`,
          scoreError,
        );
      }
    }
    console.log(`   → Suspicion score cleared for ${scoresCleared} user(s)`);

    // Log to fraud history for each cleared user
    const usersMap = await getUsersByIds(userIds);
    const adminInfo = {
      adminId: adminUser.adminId,
      adminEmail: adminUser.email,
      adminName: adminUser.email?.split("@")[0],
    };

    for (const userId of userIds) {
      const user = usersMap.get(userId);
      if (!user) continue;

      const userInfo = {
        userId: userId,
        email: user.email,
        name: user.name,
      };

      await FraudHistoryService.logAlertDismissed(
        userInfo,
        "Investigation dismissed - False positive",
        "After investigation, this alert was determined to be a false positive or acceptable use case (e.g., family members, shared device). Device risk and suspicion score have both been reset to zero, and the user has been notified that the review closed with no action.",
        adminInfo,
        alertId,
      );
    }

    // Reason: added 2 Sep 2026. A player who was told an investigation had been
    // opened (see investigation/open) must be told when it closes with no
    // action. Without this the "under review" notice is the last thing they ever
    // hear, which reads as an unresolved accusation.
    try {
      const { notificationService } = await import(
        "@/lib/services/notification.service"
      );
      for (const userId of userIds) {
        await notificationService.notifyAccountReviewClosed(userId);
      }
      console.log(`🔔 Sent review-closed notices to ${userIds.length} user(s)`);
    } catch (notifError) {
      console.error("Error sending review-closed notifications:", notifError);
    }

    console.log(
      `✅ Dismissed investigation for ${userIds.length} accounts (Alert: ${alertId})`,
    );

    // Log audit action
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
        "dismissed",
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Investigation dismissed - ${userIds.length} account(s) cleared`,
      data: updatedAlert,
    });
  } catch (error) {
    console.error("Error dismissing investigation:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
