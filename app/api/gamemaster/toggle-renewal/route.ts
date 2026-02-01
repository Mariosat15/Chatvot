import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";

/**
 * POST /api/gamemaster/toggle-renewal
 * Toggle auto-renewal for a game master subscription
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const { autoRenew } = await request.json();

    if (typeof autoRenew !== "boolean") {
      return NextResponse.json(
        { success: false, error: "autoRenew must be a boolean" },
        { status: 400 },
      );
    }

    // Find user's active subscription
    const subscription = await GameMasterSubscription.findOne({
      userId,
      status: "active",
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "No active Game Master subscription found" },
        { status: 404 },
      );
    }

    // Update auto-renewal setting
    subscription.autoRenew = autoRenew;
    await subscription.save();

    return NextResponse.json({
      success: true,
      autoRenew: subscription.autoRenew,
      message: autoRenew
        ? "Auto-renewal enabled. Your subscription will renew automatically."
        : "Auto-renewal disabled. Your subscription will expire at the end of the current period.",
    });
  } catch (error) {
    console.error("Error toggling renewal:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
