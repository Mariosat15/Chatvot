import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  seedMarketplaceItems,
  getMarketplaceStats,
} from "@/lib/services/marketplace-seed.service";
import { packageIdSyncFilter } from "@/lib/services/gamemaster/package-config";

/**
 * GET /api/admin/marketplace
 * Get all marketplace items (admin view - includes unpublished)
 */
export async function GET(request: NextRequest) {
  try {
    // Reason: MarketplaceSection is the only caller; requireAdminAuth was admin-at-all.
    const guard = await guardSection("marketplace");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Seed default items
    if (action === "seed") {
      const result = await seedMarketplaceItems(guard.admin.email || "admin");
      return NextResponse.json({ success: true, ...result });
    }

    // Get stats
    if (action === "stats") {
      const stats = await getMarketplaceStats();
      return NextResponse.json({ success: true, ...stats });
    }

    // Get all items
    const items = await MarketplaceItem.find().sort({ createdAt: -1 }).lean();

    // Get purchase counts per item
    const purchaseCounts = await UserPurchase.aggregate([
      { $group: { _id: "$itemId", count: { $sum: 1 } } },
    ]);

    const purchaseMap = new Map(
      purchaseCounts.map((p) => [p._id.toString(), p.count]),
    );

    // Add real purchase counts
    const itemsWithStats = items.map((item) => ({
      ...item,
      actualPurchases: purchaseMap.get(item._id.toString()) || 0,
    }));

    const stats = await getMarketplaceStats();

    return NextResponse.json({
      success: true,
      items: itemsWithStats,
      stats,
    });
  } catch (error) {
    console.error("Error fetching marketplace items:", error);
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
 * POST /api/admin/marketplace
 * Create a new marketplace item
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardSection("marketplace");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const data = await request.json();

    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Check for duplicate slug
    const existing = await MarketplaceItem.findOne({ slug: data.slug });
    if (existing) {
      // Append number to make unique
      let counter = 2;
      let newSlug = `${data.slug}-${counter}`;
      while (await MarketplaceItem.findOne({ slug: newSlug })) {
        counter++;
        newSlug = `${data.slug}-${counter}`;
      }
      data.slug = newSlug;
    }

    // Set defaults
    data.createdBy = guard.admin.email || "admin";
    data.isFree = data.price === 0;

    // Parse code template if it's a string
    if (typeof data.codeTemplate === "object") {
      data.codeTemplate = JSON.stringify(data.codeTemplate);
    }

    const item = await MarketplaceItem.create(data);

    // Reason: attribute from the guard — a follow-up getAdminSession is the R101b shape.
    await auditLogService.logSettingsUpdated(
      {
        id: guard.admin.id,
        email: guard.admin.email,
        name: guard.admin.name,
      },
      "marketplace_item_created",
      null,
      {
        itemId: String(item._id),
        name: item.name,
        category: item.category,
        price: item.price,
      },
    );

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("Error creating marketplace item:", error);
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
 * PUT /api/admin/marketplace
 * Update a marketplace item
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("marketplace");
    if (!guard.ok) return guard.response;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    const { itemId, ...updates } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400 },
      );
    }

    // Update isFree based on price
    if (typeof updates.price === "number") {
      updates.isFree = updates.price === 0;
    }

    // Parse code template if needed
    if (typeof updates.codeTemplate === "object") {
      updates.codeTemplate = JSON.stringify(updates.codeTemplate);
    }

    // Get the item before update to compare gameMasterConfig changes
    const oldItem = await MarketplaceItem.findById(itemId).lean();

    const item = await MarketplaceItem.findByIdAndUpdate(
      itemId,
      { $set: updates },
      { new: true },
    );

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 },
      );
    }

    // SYNC GAME MASTER SUBSCRIPTIONS: When a Game Master package's settings change,
    // update all active subscriptions that use this package
    let subscriptionsUpdated = 0;
    if (item.category === "gamemaster" && updates.gameMasterConfig && db) {
      const gmConfig = updates.gameMasterConfig;

      console.log(`🔄 Syncing Game Master package changes to subscriptions...`);
      console.log(`   Package: ${item.name} (${itemId})`);

      // Build the subscription limits update
      const limitsUpdate: Record<string, unknown> = {};

      if (gmConfig.referralFeePercentage !== undefined) {
        limitsUpdate["limits.referralFeePercentage"] =
          gmConfig.referralFeePercentage;
        console.log(
          `   → referralFeePercentage: ${oldItem?.gameMasterConfig?.referralFeePercentage} → ${gmConfig.referralFeePercentage}`,
        );
      }
      if (gmConfig.maxCompetitionsPerDay !== undefined) {
        limitsUpdate["limits.maxCompetitionsPerDay"] =
          gmConfig.maxCompetitionsPerDay;
        console.log(
          `   → maxCompetitionsPerDay: ${oldItem?.gameMasterConfig?.maxCompetitionsPerDay} → ${gmConfig.maxCompetitionsPerDay}`,
        );
      }
      if (gmConfig.maxActiveCompetitions !== undefined) {
        limitsUpdate["limits.maxActiveCompetitions"] =
          gmConfig.maxActiveCompetitions;
        console.log(
          `   → maxActiveCompetitions: ${oldItem?.gameMasterConfig?.maxActiveCompetitions} → ${gmConfig.maxActiveCompetitions}`,
        );
      }
      if (gmConfig.maxUsersPerCompetition !== undefined) {
        limitsUpdate["limits.maxUsersPerCompetition"] =
          gmConfig.maxUsersPerCompetition;
        console.log(
          `   → maxUsersPerCompetition: ${oldItem?.gameMasterConfig?.maxUsersPerCompetition} → ${gmConfig.maxUsersPerCompetition}`,
        );
      }
      if (gmConfig.canCreateCompetitions !== undefined) {
        limitsUpdate["limits.canCreateCompetitions"] =
          gmConfig.canCreateCompetitions;
        console.log(
          `   → canCreateCompetitions: ${oldItem?.gameMasterConfig?.canCreateCompetitions} → ${gmConfig.canCreateCompetitions}`,
        );
      }
      if (gmConfig.canEarnFromChallenges !== undefined) {
        limitsUpdate["limits.canEarnFromChallenges"] =
          gmConfig.canEarnFromChallenges;
        console.log(
          `   → canEarnFromChallenges: ${oldItem?.gameMasterConfig?.canEarnFromChallenges} → ${gmConfig.canEarnFromChallenges}`,
        );
      }
      if (gmConfig.challengeReferralFeePercentage !== undefined) {
        limitsUpdate["limits.challengeReferralFeePercentage"] =
          gmConfig.challengeReferralFeePercentage;
        console.log(
          `   → challengeReferralFeePercentage: ${oldItem?.gameMasterConfig?.challengeReferralFeePercentage} → ${gmConfig.challengeReferralFeePercentage}`,
        );
      }
      if (gmConfig.allowedGameTypes !== undefined) {
        // Reason: creation permission is resolved from the current package first; the
        // cached subscription.limits copy must stay in step or a GM keeps trading-only
        // until they re-buy the package (same sync path as referral % / create flag).
        limitsUpdate["limits.allowedGameTypes"] = gmConfig.allowedGameTypes;
        console.log(
          `   → allowedGameTypes: ${JSON.stringify(oldItem?.gameMasterConfig?.allowedGameTypes)} → ${JSON.stringify(gmConfig.allowedGameTypes)}`,
        );
      }

      // Only update if there are changes
      if (Object.keys(limitsUpdate).length > 0) {
        limitsUpdate.updatedAt = new Date();

        // Update all subscriptions using this package (string or ObjectId packageId).
        const updateResult = await db
          .collection("gamemastersubscriptions")
          .updateMany(packageIdSyncFilter(String(itemId)), {
            $set: limitsUpdate,
          });

        subscriptionsUpdated = updateResult.modifiedCount;
        console.log(`   ✅ Updated ${subscriptionsUpdated} subscription(s)`);
      }
    }

    await auditLogService.logSettingsUpdated(
      {
        id: guard.admin.id,
        email: guard.admin.email,
        name: guard.admin.name,
      },
      "marketplace_item_updated",
      null,
      {
        itemId: String(item._id),
        name: item.name,
        updates: Object.keys(updates),
        subscriptionsUpdated,
      },
    );

    return NextResponse.json({
      success: true,
      item,
      subscriptionsUpdated,
    });
  } catch (error) {
    console.error("Error updating marketplace item:", error);
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
 * DELETE /api/admin/marketplace
 * Delete a marketplace item
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardSection("marketplace");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400 },
      );
    }

    // Check if item has purchases
    const purchaseCount = await UserPurchase.countDocuments({ itemId });
    if (purchaseCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete item with ${purchaseCount} purchases. Set it to inactive instead.`,
        },
        { status: 400 },
      );
    }

    const item = await MarketplaceItem.findByIdAndDelete(itemId);

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 },
      );
    }

    await auditLogService.logSettingsUpdated(
      {
        id: guard.admin.id,
        email: guard.admin.email,
        name: guard.admin.name,
      },
      "marketplace_item_deleted",
      null,
      { itemId: String(item._id), name: item.name },
    );

    return NextResponse.json({
      success: true,
      message: "Item deleted",
    });
  } catch (error) {
    console.error("Error deleting marketplace item:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
