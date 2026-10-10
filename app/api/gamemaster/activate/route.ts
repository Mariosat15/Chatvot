import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { buildSubscriptionLimits } from "@/lib/services/gamemaster/subscription-limits";
import { buildReferralLink } from "@/lib/services/gamemaster/referral-link";
import {
  freshSubscriptionFields,
  isRevokedSubscription,
} from "@/lib/services/gamemaster/revoked-subscription";
import {
  GM_SUSPENDED_ERROR_CODE,
  GM_SUSPENDED_MESSAGE,
  isSuspendedSubscription,
} from "@/lib/services/gamemaster/suspended-subscription";

/**
 * POST /api/gamemaster/activate
 * Activate a purchased game master package
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
    const { purchaseId } = await request.json();

    if (!purchaseId) {
      return NextResponse.json(
        { success: false, error: "Purchase ID is required" },
        { status: 400 },
      );
    }

    // Verify the purchase belongs to this user and is a gamemaster package
    const purchase = await UserPurchase.findOne({
      _id: purchaseId,
      userId,
    }).populate("itemId");

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: "Purchase not found" },
        { status: 404 },
      );
    }

    const item = await MarketplaceItem.findById(purchase.itemId);
    if (!item || item.category !== "gamemaster") {
      return NextResponse.json(
        { success: false, error: "This purchase is not a Game Master package" },
        { status: 400 },
      );
    }

    // Reason: `userId` is unique, so any existing row - not only an active one - would make
    // the create below fail. Only a revoked row may be restarted here.
    const existingSubscription = await GameMasterSubscription.findOne({
      userId,
    });

    if (isSuspendedSubscription(existingSubscription)) {
      return NextResponse.json(
        {
          success: false,
          error: GM_SUSPENDED_MESSAGE,
          errorCode: GM_SUSPENDED_ERROR_CODE,
        },
        { status: 403 },
      );
    }

    if (existingSubscription && !isRevokedSubscription(existingSubscription)) {
      return NextResponse.json(
        {
          success: false,
          error:
            existingSubscription.status === "active"
              ? "You already have an active Game Master subscription"
              : "You already have a Game Master subscription. Renew or delete it from your arsenal first.",
        },
        { status: 400 },
      );
    }

    // Get game master config from item
    const gmConfig = item.gameMasterConfig || {
      maxCompetitionsPerDay: 1,
      maxUsersPerCompetition: 50,
      referralFeePercentage: 5,
      subscriptionDurationDays: 30,
    };

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + gmConfig.subscriptionDurationDays);

    let subscription;
    if (existingSubscription) {
      existingSubscription.set(
        freshSubscriptionFields({
          packageId: item._id.toString(),
          packageName: item.name,
          renewalPrice: item.price,
          limits: buildSubscriptionLimits(gmConfig),
          startDate,
          endDate,
        }),
      );
      subscription = await existingSubscription.save();
    } else {
      // Generate unique referral code
      let referralCode: string;
      let isUnique = false;
      while (!isUnique) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        referralCode = "GM";
        for (let i = 0; i < 6; i++) {
          referralCode += chars.charAt(
            Math.floor(Math.random() * chars.length),
          );
        }
        const existing = await GameMasterSubscription.findOne({ referralCode });
        if (!existing) isUnique = true;
      }

      subscription = await GameMasterSubscription.create({
        userId,
        userEmail: session.user.email,
        userName: session.user.name || "Game Master",
        packageId: item._id.toString(),
        packageName: item.name,
        status: "active",
        activatedAt: startDate,
        startDate,
        endDate,
        nextRenewalDate: endDate,
        autoRenew: true,
        renewalPrice: item.price,
        referralCode: referralCode!,
        referralLink: buildReferralLink(referralCode!),
        limits: buildSubscriptionLimits(gmConfig),
        currentPeriodCompetitionsCreated: 0,
        lastCompetitionResetDate: startDate,
        totalCompetitionsCreated: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        totalReferredUsers: 0,
        activeReferredUsers: 0,
        renewalHistory: [],
      });
    }

    // Mark purchase as enabled (activated)
    await UserPurchase.findByIdAndUpdate(purchaseId, {
      $set: { isEnabled: true, lastUsedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription._id.toString(),
        referralCode: subscription.referralCode,
        referralLink: buildReferralLink(subscription.referralCode),
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        limits: subscription.limits,
      },
      message: "Game Master package activated successfully!",
    });
  } catch (error) {
    console.error("❌ Error activating game master package:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
