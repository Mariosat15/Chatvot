/**
 * Fix Existing Game Master Purchases
 *
 * This script retroactively creates GameMasterSubscription records for users
 * who purchased Game Master packages before auto-activation was implemented.
 *
 * Run with: npx ts-node scripts/fix-existing-gm-purchases.ts
 * Or: npm run fix-gm-purchases
 */

import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment variables");
  process.exit(1);
}

interface PurchaseDoc {
  _id: mongoose.Types.ObjectId;
  userId: string;
  itemId: mongoose.Types.ObjectId;
  pricePaid: number;
  purchasedAt: Date;
  createdAt: Date;
}

interface ItemDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: string;
  price: number;
  gameMasterConfig?: {
    subscriptionDurationDays?: number;
    maxCompetitionsPerDay?: number;
    maxUsersPerCompetition?: number;
    referralFeePercentage?: number;
  };
}

interface UserDoc {
  _id: mongoose.Types.ObjectId;
  id?: string;
  email: string;
  name?: string;
}

async function fixExistingGMPurchases() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     FIX EXISTING GAME MASTER PURCHASES                   ║");
  console.log("║     Retroactively activate GM subscriptions              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");

  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection failed");
    }

    // Step 1: Find all Game Master marketplace items
    console.log("📦 Finding Game Master packages...");
    const gmItems = (await db
      .collection("marketplaceitems")
      .find({
        category: "gamemaster",
      })
      .toArray()) as unknown as ItemDoc[];

    if (gmItems.length === 0) {
      console.log("⚠️ No Game Master packages found in marketplace");
      return;
    }

    console.log(`   Found ${gmItems.length} Game Master package(s):`);
    gmItems.forEach((item) => {
      console.log(`   - ${item.name} (ID: ${item._id})`);
    });

    const gmItemIds = gmItems.map((item) => item._id);

    // Step 2: Find all purchases of GM packages
    console.log("\n🛒 Finding purchases of Game Master packages...");
    const gmPurchases = (await db
      .collection("userpurchases")
      .find({
        itemId: { $in: gmItemIds },
      })
      .toArray()) as unknown as PurchaseDoc[];

    if (gmPurchases.length === 0) {
      console.log("ℹ️ No Game Master purchases found");
      return;
    }

    console.log(`   Found ${gmPurchases.length} purchase(s)`);

    // Step 3: Check which users already have subscriptions
    console.log("\n🔍 Checking existing subscriptions...");
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
    console.log(
      `   ${usersWithSubscriptions.size} user(s) already have subscriptions`,
    );

    // Step 4: Create subscriptions for users who don't have one
    const purchasesNeedingActivation = gmPurchases.filter(
      (p) => !usersWithSubscriptions.has(p.userId),
    );

    if (purchasesNeedingActivation.length === 0) {
      console.log("\n✅ All Game Master purchases are already activated!");
      return;
    }

    console.log(
      `\n🎮 Creating subscriptions for ${purchasesNeedingActivation.length} user(s)...`,
    );

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const purchase of purchasesNeedingActivation) {
      try {
        // Get the purchased item details
        const item = gmItems.find(
          (i) => i._id.toString() === purchase.itemId.toString(),
        );
        if (!item) {
          errors.push(`Item not found for purchase ${purchase._id}`);
          failed++;
          continue;
        }

        // Get user details - try multiple ID formats
        const userIdStr = purchase.userId.toString();
        const userQueries: Record<string, unknown>[] = [
          { id: userIdStr },
          { _id: userIdStr },
        ];

        // Try ObjectId format if it's a valid ObjectId string
        if (ObjectId.isValid(userIdStr)) {
          userQueries.push({ _id: new ObjectId(userIdStr) });
        }

        const user = (await db.collection("user").findOne({
          $or: userQueries,
        })) as UserDoc | null;

        if (!user) {
          // Debug: Let's see what users exist with similar IDs
          console.log(`   ⚠️ User not found with ID: ${userIdStr}`);
          console.log(`      Searching with queries:`, userQueries);

          // Try to find any user to see the ID format
          const sampleUser = await db.collection("user").findOne({});
          if (sampleUser) {
            console.log(
              `      Sample user ID format: _id=${sampleUser._id}, id=${sampleUser.id || "none"}`,
            );
          }

          errors.push(`User not found: ${purchase.userId}`);
          failed++;
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
          limits: {
            maxCompetitionsPerDay: config.maxCompetitionsPerDay || 1,
            maxUsersPerCompetition: config.maxUsersPerCompetition || 50,
            referralFeePercentage: config.referralFeePercentage || 5,
          },
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

        console.log(
          `   ✅ ${user.email} - ${item.name} (${isExpired ? "EXPIRED" : "ACTIVE"}) - Code: ${referralCode}`,
        );
        created++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed for purchase ${purchase._id}: ${msg}`);
        failed++;
      }
    }

    // Summary
    console.log("\n");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                        SUMMARY                            ");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`   Total GM purchases found: ${gmPurchases.length}`);
    console.log(`   Already had subscriptions: ${usersWithSubscriptions.size}`);
    console.log(`   Newly created: ${created}`);
    console.log(`   Failed: ${failed}`);

    if (errors.length > 0) {
      console.log("\n   Errors:");
      errors.forEach((e) => console.log(`   - ${e}`));
    }

    console.log("\n✅ Done!\n");
  } catch (error) {
    console.error("❌ Script failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
fixExistingGMPurchases();
