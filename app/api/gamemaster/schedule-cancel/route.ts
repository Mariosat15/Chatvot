import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";

/**
 * POST /api/gamemaster/schedule-cancel
 * Schedule a Game Master subscription for cancellation after expiry
 * User will continue to receive referral fees until the subscription expires
 * After expiry, the subscription will be deleted from their arsenal
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { action } = body; // 'schedule' or 'unschedule'

    if (!action || !["schedule", "unschedule"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "schedule" or "unschedule"' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Find user's subscription
    const subscription = await GameMasterSubscription.findOne({ userId });

    if (!subscription) {
      return NextResponse.json(
        { error: "No Game Master subscription found" },
        { status: 404 },
      );
    }

    if (subscription.status !== "active") {
      return NextResponse.json(
        {
          error: "Only active subscriptions can be scheduled for cancellation",
        },
        { status: 400 },
      );
    }

    if (action === "schedule") {
      if (subscription.scheduledForDeletion) {
        return NextResponse.json(
          { error: "Subscription is already scheduled for cancellation" },
          { status: 400 },
        );
      }

      // Disable auto-renewal and schedule for deletion
      subscription.scheduledForDeletion = true;
      subscription.scheduledDeletionAt = new Date();
      subscription.autoRenew = false; // Also disable auto-renewal
      await subscription.save();

      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (subscription.endDate.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      console.log(
        `📅 [GM SCHEDULE CANCEL] User ${userId} scheduled their Game Master subscription for deletion after expiry (${daysRemaining} days)`,
      );

      return NextResponse.json({
        success: true,
        message: `Subscription scheduled for cancellation. You will continue receiving referral fees for ${daysRemaining} more days until ${subscription.endDate.toLocaleDateString()}.`,
        scheduledForDeletion: true,
        scheduledDeletionAt: subscription.scheduledDeletionAt,
        endDate: subscription.endDate,
        daysRemaining,
      });
    } else {
      // Unschedule
      if (!subscription.scheduledForDeletion) {
        return NextResponse.json(
          { error: "Subscription is not scheduled for cancellation" },
          { status: 400 },
        );
      }

      subscription.scheduledForDeletion = false;
      subscription.scheduledDeletionAt = undefined;
      // Note: We don't automatically re-enable autoRenew - user can enable it separately
      await subscription.save();

      console.log(
        `✅ [GM UNSCHEDULE CANCEL] User ${userId} unscheduled their Game Master subscription cancellation`,
      );

      return NextResponse.json({
        success: true,
        message:
          "Cancellation cancelled. Your subscription will not be deleted after expiry. You may want to enable auto-renewal.",
        scheduledForDeletion: false,
        autoRenew: subscription.autoRenew,
      });
    }
  } catch (error) {
    console.error("Error scheduling/unscheduling GM cancellation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/gamemaster/schedule-cancel
 * Get current scheduled cancellation status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const subscription = await GameMasterSubscription.findOne({
      userId: session.user.id,
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No Game Master subscription found" },
        { status: 404 },
      );
    }

    const daysRemaining =
      subscription.status === "active"
        ? Math.max(
            0,
            Math.ceil(
              (subscription.endDate.getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

    return NextResponse.json({
      success: true,
      scheduledForDeletion: subscription.scheduledForDeletion,
      scheduledDeletionAt: subscription.scheduledDeletionAt,
      endDate: subscription.endDate,
      daysRemaining,
      autoRenew: subscription.autoRenew,
    });
  } catch (error) {
    console.error("Error getting scheduled cancellation status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
