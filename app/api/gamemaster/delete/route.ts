import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { clearContactUsUnlocks } from "@/lib/services/gamemaster/contact-us-unlocks";
import {
  GM_SUSPENDED_ERROR_CODE,
  GM_SUSPENDED_MESSAGE,
  isSuspendedSubscription,
} from "@/lib/services/gamemaster/suspended-subscription";

/**
 * DELETE /api/gamemaster/delete
 * Delete (cancel) a Game Master subscription
 * This allows the user to purchase a completely new package
 */
export async function DELETE() {
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

    // Find user's subscription
    const subscription = await GameMasterSubscription.findOne({ userId });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "No Game Master subscription found" },
        { status: 404 },
      );
    }

    // Reason: deleting marks the row cancelled, and a cancelled row may buy a fresh package -
    // so deleting a suspended subscription was a way round the admin's suspension.
    if (isSuspendedSubscription(subscription)) {
      return NextResponse.json(
        {
          success: false,
          error: GM_SUSPENDED_MESSAGE,
          errorCode: GM_SUSPENDED_ERROR_CODE,
        },
        { status: 403 },
      );
    }

    // Check if subscription is active - only allow deletion of expired subscriptions
    const isActive =
      subscription.status === "active" &&
      new Date(subscription.endDate) > new Date();

    if (isActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete an active subscription. Your subscription must be expired before it can be deleted.",
          details: {
            status: subscription.status,
            endDate: subscription.endDate,
            daysRemaining: Math.ceil(
              (new Date(subscription.endDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
            message:
              "If you want a different package, you can upgrade to a higher-tier package while your subscription is active.",
          },
        },
        { status: 400 },
      );
    }

    // Store info for response before deletion
    const deletedInfo = {
      packageName: subscription.packageName,
      referralCode: subscription.referralCode,
      totalReferredUsers: subscription.totalReferredUsers,
      totalEarnings: subscription.totalEarnings,
    };

    // Mark subscription as cancelled (soft delete)
    // This preserves the referral code history and prevents reuse
    // Reason: still "active" past its end date means the daily worker has not expired it yet,
    // so end the player's Contact-us package permissions here, as the expiry would have.
    if (subscription.status === "active") {
      await clearContactUsUnlocks(userId);
    }
    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = "User requested deletion";
    await subscription.save();

    // Note: We don't delete referral records or earnings history
    // The user's referrals remain in the system but won't generate new earnings

    return NextResponse.json({
      success: true,
      message: `Your "${deletedInfo.packageName}" subscription has been deleted. You can now purchase any Game Master package.`,
      deletedSubscription: deletedInfo,
      note: "Your referral history and past earnings have been preserved for records.",
    });
  } catch (error) {
    console.error("Error deleting GM subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
