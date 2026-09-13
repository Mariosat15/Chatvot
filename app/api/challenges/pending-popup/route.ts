import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import UserNotificationPreferences from "@/database/models/user-notification-preferences.model";

/**
 * GET /api/challenges/pending-popup
 *
 * Lightweight endpoint for the challenge popup banner.
 * Returns the latest pending incoming challenge (if any) and whether
 * the user has the challenge popup feature enabled.
 *
 * Polled every ~10s by the ChallengePopup component.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch popup preference and pending challenges in parallel
    const [prefs, pendingChallenges] = await Promise.all([
      UserNotificationPreferences.findOne({ userId: session.user.id })
        .select("challengePopupEnabled")
        .lean() as Promise<{ challengePopupEnabled?: boolean } | null>,
      Challenge.find({
        challengedId: session.user.id,
        status: "pending",
        acceptDeadline: { $gt: new Date() }, // Not expired
      })
        .sort({ createdAt: -1 })
        .limit(5) // Max 5 pending popups at a time
        .select(
          "_id slug challengerName entryFee duration winnerPrize acceptDeadline createdAt startingCapital rules.rankingMethod",
        )
        .lean(),
    ]);

    // Reason: Default to true for users who haven't set preferences yet
    const popupEnabled = prefs?.challengePopupEnabled !== false;

    return NextResponse.json({
      popupEnabled,
      challenges: popupEnabled
        ? pendingChallenges.map((c: any) => ({
            _id: c._id.toString(),
            slug: c.slug,
            challengerName: c.challengerName,
            entryFee: c.entryFee,
            duration: c.duration,
            winnerPrize: c.winnerPrize,
            startingCapital: c.startingCapital,
            rankingMethod: c.rules?.rankingMethod || "pnl",
            acceptDeadline: c.acceptDeadline,
            createdAt: c.createdAt,
          }))
        : [],
    });
  } catch (error) {
    console.error("❌ Error in pending-popup:", error);
    return NextResponse.json(
      { error: "Failed to check pending challenges" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/challenges/pending-popup
 *
 * Toggle the challenge popup preference on/off.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    await UserNotificationPreferences.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { challengePopupEnabled: enabled } },
      { upsert: true },
    );

    return NextResponse.json({ success: true, challengePopupEnabled: enabled });
  } catch (error) {
    console.error("❌ Error toggling challenge popup:", error);
    return NextResponse.json(
      { error: "Failed to update preference" },
      { status: 500 },
    );
  }
}
