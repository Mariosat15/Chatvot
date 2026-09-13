import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { buildSubscriptionLimits } from "@/lib/services/gamemaster/subscription-limits";

/**
 * POST /api/gamemaster/fix-purchases
 *
 * Retroactively creates GameMasterSubscription records for users
 * who purchased Game Master packages before auto-activation was implemented.
 *
 * Admin only endpoint.
 */
export async function POST() {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth();
    if (!authResult.isAuthenticated || !authResult.admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Only super admins can run this
    if (authResult.admin.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super admins can run this operation" },
        { status: 403 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection failed");
    }

    const results = {
      totalPurchases: 0,
      alreadyActivated: 0,
      newlyCreated: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as {
        email: string;
        packageName: string;
        referralCode: string;
        status: string;
      }[],
    };

    // Step 1: Find all Game Master marketplace items
    const gmItems = await db
      .collection("marketplaceitems")
      .find({
        category: "gamemaster",
      })
      .toArray();

    if (gmItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Game Master packages found in marketplace",
        results,
      });
    }

    const gmItemIds = gmItems.map((item) => item._id);

    // Step 2: Find all purchases of GM packages
    const gmPurchases = await db
      .collection("userpurchases")
      .find({
        itemId: { $in: gmItemIds },
      })
      .toArray();

    results.totalPurchases = gmPurchases.length;

    if (gmPurchases.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Game Master purchases found",
        results,
      });
    }

    // Step 3: Check which users already have subscriptions
    const purchasedUserIds = gmPurchases.map((p) => p.userId);
    const existingSubscriptions = await db
      .collection("gamemastersubscriptions")
      .find({
        userId: { $in: purchasedUserIds },
      })
      .toArray();

    const usersWithSubscriptions = new Set(
      existingSubscriptions.map((s) => s.userId),
    );
    results.alreadyActivated = usersWithSubscriptions.size;

    // Step 4: Create subscriptions for users who don't have one
    const purchasesNeedingActivation = gmPurchases.filter(
      (p) => !usersWithSubscriptions.has(p.userId),
    );

    for (const purchase of purchasesNeedingActivation) {
      try {
        // Get the purchased item details
        const item = gmItems.find(
          (i) => i._id.toString() === purchase.itemId.toString(),
        );
        if (!item) {
          results.errors.push(`Item not found for purchase ${purchase._id}`);
          results.failed++;
          continue;
        }

        // Get user details - try multiple ID formats
        const userIdStr = purchase.userId.toString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userQueries: any[] = [{ id: userIdStr }, { _id: userIdStr }];

        // Try ObjectId format if it's a valid ObjectId string
        if (ObjectId.isValid(userIdStr)) {
          userQueries.push({ _id: new ObjectId(userIdStr) });
        }

        const user = await db.collection("user").findOne({
          $or: userQueries,
        });

        if (!user) {
          results.errors.push(`User not found: ${purchase.userId}`);
          results.failed++;
          continue;
        }

        const config = item.gameMasterConfig || {};
        const now = new Date();
        const purchaseDate = purchase.purchasedAt || purchase.createdAt || now;
        const durationDays = config.subscriptionDurationDays || 30;

        // Calculate end date from purchase date
        const endDate = new Date(
          purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
        );

        // Check if subscription would already be expired
        const isExpired = endDate < now;

        // Generate unique referral code
        let referralCode = "";
        let codeExists = true;
        while (codeExists) {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          referralCode = "GM";
          for (let i = 0; i < 6; i++) {
            referralCode += chars.charAt(
              Math.floor(Math.random() * chars.length),
            );
          }
          const existing = await db
            .collection("gamemastersubscriptions")
            .findOne({ referralCode });
          codeExists = !!existing;
        }

        // Create the subscription
        await db.collection("gamemastersubscriptions").insertOne({
          userId: purchase.userId,
          userEmail: user.email,
          userName: user.name || user.email,
          packageId: item._id.toString(),
          packageName: item.name,
          status: isExpired ? "expired" : "active",
          activatedAt: purchaseDate,
          startDate: purchaseDate,
          endDate: endDate,
          nextRenewalDate: endDate,
          autoRenew: true,
          renewalPrice: item.price,
          referralCode,
          // Reason for the shared builder: this repair route previously stored a 0% package
          // as 5%, and it also omitted both permission flags and relied on schema defaults.
          // A repair route writing a different limits shape from the purchase route is how a
          // repair introduces the drift it was run to remove.
          limits: buildSubscriptionLimits(config),
          currentPeriodCompetitionsCreated: 0,
          lastCompetitionResetDate: now,
          totalCompetitionsCreated: 0,
          totalEarnings: 0,
          pendingEarnings: 0,
          totalReferredUsers: 0,
          activeReferredUsers: 0,
          renewalHistory: [],
          createdAt: now,
          updatedAt: now,
        });

        results.newlyCreated++;
        results.created.push({
          email: user.email,
          packageName: item.name,
          referralCode,
          status: isExpired ? "expired" : "active",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Failed for purchase ${purchase._id}: ${msg}`);
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${results.newlyCreated} Game Master subscription(s)`,
      results,
    });
  } catch (error) {
    console.error("Error fixing GM purchases:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/gamemaster/fix-purchases
 *
 * Check how many purchases need fixing (dry run)
 */
export async function GET() {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth();
    if (!authResult.isAuthenticated || !authResult.admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection failed");
    }

    // Find all Game Master marketplace items
    const gmItems = await db
      .collection("marketplaceitems")
      .find({
        category: "gamemaster",
      })
      .toArray();

    if (gmItems.length === 0) {
      return NextResponse.json({
        success: true,
        gmPackagesCount: 0,
        totalPurchases: 0,
        alreadyActivated: 0,
        needsActivation: 0,
      });
    }

    const gmItemIds = gmItems.map((item) => item._id);

    // Find all purchases of GM packages
    const gmPurchases = await db
      .collection("userpurchases")
      .find({
        itemId: { $in: gmItemIds },
      })
      .toArray();

    // Check which users already have subscriptions
    const purchasedUserIds = gmPurchases.map((p) => p.userId);
    const existingSubscriptions = await db
      .collection("gamemastersubscriptions")
      .find({
        userId: { $in: purchasedUserIds },
      })
      .toArray();

    const usersWithSubscriptions = new Set(
      existingSubscriptions.map((s) => s.userId),
    );
    const purchasesNeedingActivation = gmPurchases.filter(
      (p) => !usersWithSubscriptions.has(p.userId),
    );

    return NextResponse.json({
      success: true,
      gmPackagesCount: gmItems.length,
      totalPurchases: gmPurchases.length,
      alreadyActivated: usersWithSubscriptions.size,
      needsActivation: purchasesNeedingActivation.length,
      packages: gmItems.map((i) => ({ id: i._id, name: i.name })),
    });
  } catch (error) {
    console.error("Error checking GM purchases:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
