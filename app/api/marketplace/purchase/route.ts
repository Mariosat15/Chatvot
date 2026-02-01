import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import mongoose from "mongoose";

/**
 * POST /api/marketplace/purchase
 * Purchase a marketplace item
 */
export async function POST(request: NextRequest) {
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
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400 },
      );
    }

    // Get the item
    const item = await MarketplaceItem.findById(itemId).session(mongoSession);
    if (!item) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 },
      );
    }

    if (!item.isPublished || item.status !== "active") {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Item is not available for purchase" },
        { status: 400 },
      );
    }

    // Check if already purchased
    const existingPurchase = await UserPurchase.findOne({
      userId,
      itemId: item._id,
    }).session(mongoSession);

    if (existingPurchase) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "You already own this item" },
        { status: 400 },
      );
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

    // Check balance (skip for free items)
    if (!item.isFree && wallet.creditBalance < item.price) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Insufficient credits" },
        { status: 400 },
      );
    }

    // Deduct credits (if not free)
    let transaction = null;
    if (!item.isFree && item.price > 0) {
      const balanceBefore = wallet.creditBalance;
      wallet.creditBalance -= item.price;
      wallet.totalSpentOnMarketplace =
        (wallet.totalSpentOnMarketplace || 0) + item.price;
      await wallet.save({ session: mongoSession });

      // Create transaction record
      transaction = await WalletTransaction.create(
        [
          {
            userId,
            transactionType: "marketplace_purchase",
            amount: -item.price,
            balanceBefore: balanceBefore,
            balanceAfter: wallet.creditBalance,
            currency: "EUR",
            exchangeRate: 1,
            status: "completed",
            description: `Purchased: ${item.name}`,
            processedAt: new Date(),
            metadata: {
              itemId: item._id.toString(),
              itemName: item.name,
              itemCategory: item.category,
            },
          },
        ],
        { session: mongoSession },
      );
    }

    // Create purchase record
    const purchase = await UserPurchase.create(
      [
        {
          userId,
          itemId: item._id,
          pricePaid: item.isFree ? 0 : item.price,
          transactionId: transaction
            ? transaction[0]._id.toString()
            : undefined,
          customSettings: item.defaultSettings,
        },
      ],
      { session: mongoSession },
    );

    // Update item stats
    await MarketplaceItem.findByIdAndUpdate(
      item._id,
      { $inc: { totalPurchases: 1 } },
      { session: mongoSession },
    );

    // If this is a Game Master package, handle subscription logic
    let gameMasterSubscription = null;
    let purchaseType: "new" | "upgrade" = "new";
    let remainingDaysFromOld = 0; // Days carried over from old subscription during upgrade

    if (item.category === "gamemaster" && item.gameMasterConfig) {
      // Check if user already has a subscription
      const existingSubscription = await GameMasterSubscription.findOne({
        userId,
      }).session(mongoSession);

      if (existingSubscription) {
        const isActive =
          existingSubscription.status === "active" &&
          new Date(existingSubscription.endDate) > new Date();
        const isExpired =
          existingSubscription.status === "expired" ||
          new Date(existingSubscription.endDate) <= new Date();

        // Get current package price for comparison
        let currentPackagePrice = existingSubscription.renewalPrice || 0;
        if (existingSubscription.packageId) {
          const currentPackage = await MarketplaceItem.findById(
            existingSubscription.packageId,
          ).session(mongoSession);
          if (currentPackage) {
            currentPackagePrice = currentPackage.price;
          }
        }

        // RULE 1: Active subscription - can only UPGRADE (higher price package)
        if (isActive) {
          if (item.price <= currentPackagePrice) {
            await mongoSession.abortTransaction();
            return NextResponse.json(
              {
                success: false,
                error:
                  "You already have an active Game Master subscription. You can only upgrade to a higher-tier package.",
                errorCode: "GM_ACTIVE_UPGRADE_ONLY",
                details: {
                  currentPackage: existingSubscription.packageName,
                  currentPrice: currentPackagePrice,
                  newPrice: item.price,
                  action: "upgrade",
                  message: `Your current package "${existingSubscription.packageName}" (${currentPackagePrice} credits) is active. To upgrade, choose a package with a higher price than ${currentPackagePrice} credits.`,
                },
              },
              { status: 400 },
            );
          }
          purchaseType = "upgrade";
        }

        // RULE 2: Expired subscription - must renew or delete first
        if (isExpired && existingSubscription.status !== "cancelled") {
          await mongoSession.abortTransaction();
          return NextResponse.json(
            {
              success: false,
              error:
                "You have an expired Game Master subscription. Please renew it or delete it before purchasing a new package.",
              errorCode: "GM_EXPIRED_MUST_RENEW_OR_DELETE",
              details: {
                currentPackage: existingSubscription.packageName,
                expiredDate: existingSubscription.endDate,
                renewalPrice: existingSubscription.renewalPrice,
                action: "renew_or_delete",
                message: `Your "${existingSubscription.packageName}" subscription expired on ${new Date(existingSubscription.endDate).toLocaleDateString()}. You must either renew it (${existingSubscription.renewalPrice} credits) or delete it from your arsenal before purchasing a new package.`,
              },
            },
            { status: 400 },
          );
        }
      }

      const config = item.gameMasterConfig;
      const now = new Date();
      const durationDays = config.subscriptionDurationDays || 30;

      // Calculate remaining days from old subscription (only for upgrades)
      if (existingSubscription && purchaseType === "upgrade") {
        const oldEndDate = new Date(existingSubscription.endDate);
        console.log(
          `📅 [GM UPGRADE] Old subscription endDate: ${oldEndDate.toISOString()}`,
        );
        console.log(`📅 [GM UPGRADE] Current time: ${now.toISOString()}`);
        if (oldEndDate > now) {
          remainingDaysFromOld = Math.ceil(
            (oldEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          console.log(
            `📅 [GM UPGRADE] Carrying over ${remainingDaysFromOld} remaining days from old subscription`,
          );
        } else {
          console.log(
            `📅 [GM UPGRADE] Old subscription already expired, no days to carry over`,
          );
        }
      }

      // Total duration = new package duration + remaining days from old
      const totalDurationDays = durationDays + remainingDaysFromOld;
      const endDate = new Date(
        now.getTime() + totalDurationDays * 24 * 60 * 60 * 1000,
      );

      console.log(`📅 [GM] New package duration: ${durationDays} days`);
      console.log(`📅 [GM] Days carried over: ${remainingDaysFromOld}`);
      console.log(`📅 [GM] Total duration: ${totalDurationDays} days`);
      console.log(`📅 [GM] New endDate: ${endDate.toISOString()}`);

      // Generate unique referral code (only if new subscription)
      let referralCode = existingSubscription?.referralCode || "";
      if (!referralCode) {
        let codeExists = true;
        while (codeExists) {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          referralCode = "GM";
          for (let i = 0; i < 6; i++) {
            referralCode += chars.charAt(
              Math.floor(Math.random() * chars.length),
            );
          }
          const existing = await GameMasterSubscription.findOne({
            referralCode,
          }).session(mongoSession);
          codeExists = !!existing;
        }
      }

      // If upgrading, remove old GM package purchase record so user only sees new one
      if (
        existingSubscription &&
        purchaseType === "upgrade" &&
        existingSubscription.packageId
      ) {
        // Find and delete old GM package purchase
        const oldGmPurchases = await UserPurchase.find({
          userId,
          itemId: { $ne: item._id }, // Not the new item
        })
          .session(mongoSession)
          .populate("itemId");

        for (const oldPurchase of oldGmPurchases) {
          const oldItem = oldPurchase.itemId as unknown as {
            category?: string;
            _id: mongoose.Types.ObjectId;
          };
          if (oldItem && oldItem.category === "gamemaster") {
            console.log(`🗑️ Removing old GM package purchase: ${oldItem._id}`);
            await UserPurchase.deleteOne({ _id: oldPurchase._id }).session(
              mongoSession,
            );
          }
        }
      }

      if (existingSubscription && existingSubscription.status !== "cancelled") {
        // UPGRADE: Update existing subscription with new package
        // This REPLACES the old subscription entirely - user only has ONE subscription
        existingSubscription.packageId = item._id.toString();
        existingSubscription.packageName = item.name;
        existingSubscription.status = "active";
        existingSubscription.startDate = now;
        existingSubscription.endDate = endDate; // Includes carried over days
        existingSubscription.nextRenewalDate = endDate;
        existingSubscription.renewalPrice = item.price;
        existingSubscription.limits = {
          maxCompetitionsPerDay: config.maxCompetitionsPerDay || 1,
          maxUsersPerCompetition: config.maxUsersPerCompetition || 50,
          referralFeePercentage: config.referralFeePercentage || 5,
          canCreateCompetitions: config.canCreateCompetitions !== false,
          canEarnFromChallenges: config.canEarnFromChallenges === true,
          challengeReferralFeePercentage: config.challengeReferralFeePercentage,
        };
        existingSubscription.currentPeriodCompetitionsCreated = 0;
        existingSubscription.lastCompetitionResetDate = now;
        existingSubscription.expiryWarnings = {}; // Reset expiry warnings
        await existingSubscription.save({ session: mongoSession });
        gameMasterSubscription = existingSubscription;
        console.log(
          `✅ [GM UPGRADE] Subscription UPGRADED for user ${userId} to ${item.name}`,
        );
        console.log(
          `✅ [GM UPGRADE] Saved endDate: ${existingSubscription.endDate}`,
        );
        console.log(
          `✅ [GM UPGRADE] Days remaining after upgrade: ${Math.ceil((new Date(existingSubscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}`,
        );
      } else {
        // NEW: Create new subscription (first time or after deletion)
        const newSubscription = await GameMasterSubscription.create(
          [
            {
              userId,
              userEmail: session.user.email || "",
              userName:
                session.user.name || session.user.email || "Game Master",
              packageId: item._id.toString(),
              packageName: item.name,
              status: "active",
              activatedAt: now,
              startDate: now,
              endDate: endDate,
              nextRenewalDate: endDate,
              autoRenew: true,
              renewalPrice: item.price,
              referralCode,
              limits: {
                maxCompetitionsPerDay: config.maxCompetitionsPerDay || 1,
                maxUsersPerCompetition: config.maxUsersPerCompetition || 50,
                referralFeePercentage: config.referralFeePercentage || 5,
                canCreateCompetitions: config.canCreateCompetitions !== false,
                canEarnFromChallenges: config.canEarnFromChallenges === true,
                challengeReferralFeePercentage:
                  config.challengeReferralFeePercentage,
              },
              currentPeriodCompetitionsCreated: 0,
              lastCompetitionResetDate: now,
              totalCompetitionsCreated: 0,
              totalEarnings: 0,
              pendingEarnings: 0,
              totalReferredUsers: 0,
              activeReferredUsers: 0,
              renewalHistory: [],
            },
          ],
          { session: mongoSession },
        );
        gameMasterSubscription = newSubscription[0];
        console.log(
          `✅ Game Master subscription CREATED for user ${userId}, referral code: ${gameMasterSubscription.referralCode}`,
        );
      }
    }

    await mongoSession.commitTransaction();

    // Calculate total days for response
    const totalDaysGranted =
      item.category === "gamemaster" && item.gameMasterConfig
        ? (item.gameMasterConfig.subscriptionDurationDays || 30) +
          (purchaseType === "upgrade" ? remainingDaysFromOld : 0)
        : 0;

    return NextResponse.json({
      success: true,
      purchase: purchase[0],
      newBalance: wallet.creditBalance,
      gameMasterActivated: !!gameMasterSubscription,
      gameMasterPurchaseType: purchaseType, // 'new' or 'upgrade'
      gameMasterSubscription: gameMasterSubscription
        ? {
            referralCode: gameMasterSubscription.referralCode,
            endDate: gameMasterSubscription.endDate,
            limits: gameMasterSubscription.limits,
            packageName: gameMasterSubscription.packageName,
          }
        : null,
      upgradeDetails:
        purchaseType === "upgrade"
          ? {
              daysCarriedOver: remainingDaysFromOld,
              newPackageDays:
                item.gameMasterConfig?.subscriptionDurationDays || 30,
              totalDays: totalDaysGranted,
              message:
                remainingDaysFromOld > 0
                  ? `Your ${remainingDaysFromOld} remaining days have been added to your new ${item.gameMasterConfig?.subscriptionDurationDays || 30}-day package!`
                  : undefined,
            }
          : null,
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("Error purchasing item:", error);
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
