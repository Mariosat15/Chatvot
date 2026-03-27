import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import { SuspicionScoringService } from "@/lib/services/fraud/suspicion-scoring.service";

/**
 * GET /api/fraud/user-status?userId=xxx
 * Lightweight endpoint for the user panel to check investigation/fraud status.
 * Returns active alerts and suspicion score without loading full device/payment data.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const [alerts, suspicionScore] = await Promise.all([
      FraudAlert.find({
        $or: [
          { primaryUserId: userId },
          { suspiciousUserIds: userId },
        ],
        status: { $nin: ["resolved", "dismissed"] },
      })
        .sort({ detectedAt: -1 })
        .limit(10)
        .lean(),
      SuspicionScoringService.getScore(userId),
    ]);

    const underInvestigation = alerts.some(
      (a) => a.status === "investigating",
    );

    // Gather investigation reasons from alerts
    const investigationReasons = alerts
      .filter((a) => a.status === "investigating")
      .map(
        (a) =>
          (a as unknown as { alertType?: string }).alertType
            ?.replace(/_/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Unknown",
      );

    const formattedAlerts = alerts.map((a) => ({
      _id: String(a._id),
      alertType: (a as unknown as { alertType?: string }).alertType,
      status: a.status,
      severity: (a as unknown as { severity?: string }).severity,
      detectedAt: (a as unknown as { detectedAt?: Date }).detectedAt,
      evidence: (
        a as unknown as { evidence?: Array<{ type: string }> }
      ).evidence?.slice(0, 3),
    }));

    return NextResponse.json({
      success: true,
      data: {
        underInvestigation,
        investigationReasons,
        activeAlerts: formattedAlerts,
        suspicionScore,
        alertsTotal: alerts.length,
        alertsInvestigating: alerts.filter((a) => a.status === "investigating")
          .length,
        alertsPending: alerts.filter((a) => a.status === "pending").length,
      },
    });
  } catch (error) {
    console.error("Error fetching user fraud status:", error);
    return NextResponse.json(
      { error: "Failed to fetch user fraud status" },
      { status: 500 },
    );
  }
}
