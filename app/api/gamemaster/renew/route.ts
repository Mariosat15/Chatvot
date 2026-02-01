import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import mongoose from "mongoose";

/**
 * POST /api/gamemaster/renew
 * Manually renew an expired Game Master subscription
 */
export async function POST() {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

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
    const subscription = await GameMasterSubscription.findOne({
      userId,
    }).session(mongoSession);

    if (!subscription) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "No Game Master subscription found" },
        { status: 404 },
      );
    }

    // Check if subscription is expired
    const isExpired =
      subscription.status === "expired" ||
      new Date(subscription.endDate) <= new Date();

    if (!isExpired) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: "Your subscription is still active. No need to renew yet.",
          details: {
            status: subscription.status,
            endDate: subscription.endDate,
            daysRemaining: Math.ceil(
              (new Date(subscription.endDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          },
        },
        { status: 400 },
      );
    }

    // Get current package to determine renewal price and duration
    let renewalPrice = subscription.renewalPrice || 0;
    let durationDays = 30;
    let packageConfig = subscription.limits;

    if (subscription.packageId) {
      const currentPackage = await MarketplaceItem.findById(
        subscription.packageId,
      ).session(mongoSession);
      if (currentPackage && currentPackage.gameMasterConfig) {
        renewalPrice = currentPackage.price;
        durationDays =
          currentPackage.gameMasterConfig.subscriptionDurationDays || 30;
        packageConfig = {
          maxCompetitionsPerDay:
            currentPackage.gameMasterConfig.maxCompetitionsPerDay || 1,
          maxUsersPerCompetition:
            currentPackage.gameMasterConfig.maxUsersPerCompetition || 50,
          referralFeePercentage:
            currentPackage.gameMasterConfig.referralFeePercentage || 5,
          canCreateCompetitions:
            currentPackage.gameMasterConfig.canCreateCompetitions !== false,
        };
      }
    }

    // Get user wallet
    const wallet = await CreditWallet.findOne({ userId }).session(mongoSession);
    if (!wallet) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 },
      );
    }

    // Check balance
    if (wallet.creditBalance < renewalPrice) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient credits",
          details: {
            required: renewalPrice,
            available: wallet.creditBalance,
            shortage: renewalPrice - wallet.creditBalance,
          },
        },
        { status: 400 },
      );
    }

    // Deduct credits
    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance -= renewalPrice;
    await wallet.save({ session: mongoSession });

    // Create transaction record
    const transaction = await WalletTransaction.create(
      [
        {
          userId,
          transactionType: "gamemaster_subscription",
          amount: -renewalPrice,
          balanceBefore: balanceBefore,
          balanceAfter: wallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          description: `🎮 Game Master subscription renewal: ${subscription.packageName}`,
          processedAt: new Date(),
          metadata: {
            subscriptionId: subscription._id.toString(),
            packageName: subscription.packageName,
            renewalType: "manual",
          },
        },
      ],
      { session: mongoSession },
    );

    // Update subscription
    const now = new Date();
    const newEndDate = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    subscription.status = "active";
    subscription.startDate = now;
    subscription.endDate = newEndDate;
    subscription.nextRenewalDate = newEndDate;
    subscription.renewalPrice = renewalPrice;
    subscription.limits = packageConfig;
    subscription.currentPeriodCompetitionsCreated = 0;
    subscription.lastCompetitionResetDate = now;
    subscription.expiryWarnings = {}; // Reset expiry warnings
    subscription.renewalHistory.push({
      date: now,
      amount: renewalPrice,
      transactionId: transaction[0]._id.toString(),
      status: "success",
    });

    await subscription.save({ session: mongoSession });

    await mongoSession.commitTransaction();

    return NextResponse.json({
      success: true,
      message: `Your ${subscription.packageName} subscription has been renewed successfully!`,
      subscription: {
        packageName: subscription.packageName,
        status: "active",
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        renewalPrice: renewalPrice,
      },
      newBalance: wallet.creditBalance,
      durationDays,
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("Error renewing GM subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  } finally {
    mongoSession.endSession();
  }
}
