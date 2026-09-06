/**
 * Game Master Subscription Renewal Job
 *
 * This job runs daily to:
 * 1. Process auto-renewals for subscriptions ending soon
 * 2. Expire subscriptions that have ended and didn't renew
 * 3. Reset daily competition counters
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../../database/mongoose";

interface RenewalResult {
  processedCount: number;
  renewedCount: number;
  expiredCount: number;
  failedCount: number;
  resetCount: number;
  warningsSent: number;
  deletedCount: number; // Scheduled cancellations that were deleted
  errors: string[];
}

export async function runGameMasterRenewalJob(): Promise<RenewalResult> {
  const result: RenewalResult = {
    processedCount: 0,
    renewedCount: 0,
    expiredCount: 0,
    failedCount: 0,
    resetCount: 0,
    warningsSent: 0,
    deletedCount: 0,
    errors: [],
  };

  try {
    console.log(
      "🎮 [GM RENEWAL] Starting game master subscription renewal job...",
    );

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection failed");
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // TASK 1: Reset daily competition counters
    console.log("📊 [GM RENEWAL] Resetting daily competition counters...");

    const resetResult = await db
      .collection("gamemastersubscriptions")
      .updateMany(
        {
          status: "active",
          lastCompetitionResetDate: { $lt: todayStart },
        },
        {
          $set: {
            currentPeriodCompetitionsCreated: 0,
            lastCompetitionResetDate: now,
          },
        },
      );
    result.resetCount = resetResult.modifiedCount;
    console.log(
      `   ✅ Reset ${result.resetCount} subscription(s) daily counters`,
    );

    // TASK 1.5: Send expiry warning notifications (7 days, 3 days, 1 day before)
    console.log(
      "📢 [GM RENEWAL] Checking for subscriptions needing expiry warnings...",
    );

    const warningDays = [7, 3, 1]; // Days before expiry to send warnings

    for (const daysBeforeExpiry of warningDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
      targetDate.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDate);
      targetDateEnd.setHours(23, 59, 59, 999);

      // Find subscriptions expiring on this target day that haven't been warned for this period
      const subscriptionsToWarn = await db
        .collection("gamemastersubscriptions")
        .find({
          status: "active",
          endDate: { $gte: targetDate, $lte: targetDateEnd },
          [`expiryWarnings.${daysBeforeExpiry}d`]: { $ne: true }, // Not already warned for this period
        })
        .toArray();

      for (const subscription of subscriptionsToWarn) {
        try {
          // Create notification for user
          await db.collection("notifications").insertOne({
            userId: subscription.userId,
            type: "gamemaster_expiry_warning",
            title:
              daysBeforeExpiry === 1
                ? "⚠️ Game Master Expires Tomorrow!"
                : `⏰ Game Master Expires in ${daysBeforeExpiry} Days`,
            message:
              daysBeforeExpiry === 1
                ? `Your Game Master subscription expires tomorrow. ${subscription.autoRenew ? "Auto-renewal is enabled." : "Enable auto-renewal or renew manually to keep earning!"}`
                : `Your Game Master subscription (${subscription.packageName}) expires in ${daysBeforeExpiry} days. ${subscription.autoRenew ? "Auto-renewal is enabled." : "Consider enabling auto-renewal to avoid interruption."}`,
            link: "/gamemaster",
            isRead: false,
            metadata: {
              subscriptionId: subscription._id.toString(),
              packageName: subscription.packageName,
              endDate: subscription.endDate,
              daysRemaining: daysBeforeExpiry,
              autoRenew: subscription.autoRenew,
            },
            createdAt: now,
          });

          // Mark this warning as sent
          await db.collection("gamemastersubscriptions").updateOne(
            { _id: subscription._id },
            {
              $set: {
                [`expiryWarnings.${daysBeforeExpiry}d`]: true,
                updatedAt: now,
              },
            },
          );

          result.warningsSent++;
          console.log(
            `   📧 Sent ${daysBeforeExpiry}-day warning to ${subscription.userEmail}`,
          );
        } catch (warnError) {
          console.error(
            `   ⚠️ Failed to send warning for ${subscription._id}:`,
            warnError,
          );
        }
      }
    }

    console.log(
      `   ✅ Sent ${result.warningsSent} expiry warning notification(s)`,
    );

    // TASK 2: Process subscriptions that need renewal (ending today or already ended)
    console.log("🔄 [GM RENEWAL] Processing subscriptions due for renewal...");

    const subscriptionsToProcess = await db
      .collection("gamemastersubscriptions")
      .find({
        status: "active",
        nextRenewalDate: { $lte: now },
      })
      .toArray();

    console.log(
      `   Found ${subscriptionsToProcess.length} subscription(s) to process`,
    );
    result.processedCount = subscriptionsToProcess.length;

    for (const subscription of subscriptionsToProcess) {
      try {
        console.log(
          `\n   Processing subscription for user ${subscription.userId}...`,
        );

        // Check if auto-renewal is enabled
        if (!subscription.autoRenew) {
          console.log(`   ⚠️ Auto-renewal disabled, expiring subscription`);

          await db.collection("gamemastersubscriptions").updateOne(
            { _id: subscription._id },
            {
              $set: {
                status: "expired",
                updatedAt: now,
              },
            },
          );
          result.expiredCount++;
          continue;
        }

        // Get user's wallet balance
        const wallet = await db.collection("creditwallets").findOne({
          userId: subscription.userId,
        });

        const balance = wallet?.creditBalance || 0;
        const renewalPrice = subscription.renewalPrice || 0;

        console.log(
          `   Wallet balance: ${balance}, Renewal price: ${renewalPrice}`,
        );

        // Check if user has enough balance
        if (balance < renewalPrice) {
          console.log(`   ❌ Insufficient balance, expiring subscription`);

          await db.collection("gamemastersubscriptions").updateOne(
            { _id: subscription._id },
            {
              $set: {
                status: "expired",
                updatedAt: now,
              },
              $push: {
                renewalHistory: {
                  date: now,
                  amount: renewalPrice,
                  transactionId: "",
                  status: "failed",
                  failureReason: "Insufficient balance",
                },
              } as unknown as mongoose.mongo.PushOperator<Document>,
            },
          );

          // Send notification to user about expired subscription
          // TODO: Implement notification

          result.expiredCount++;
          continue;
        }

        // Process renewal - deduct from wallet
        const balanceBefore = balance;
        const balanceAfter = balance - renewalPrice;

        await db.collection("creditwallets").updateOne(
          { userId: subscription.userId },
          {
            $inc: { creditBalance: -renewalPrice },
          },
        );

        // Create transaction record
        const transactionResult = await db
          .collection("wallettransactions")
          .insertOne({
            userId: subscription.userId,
            transactionType: "gamemaster_subscription",
            amount: -renewalPrice,
            balanceBefore,
            balanceAfter,
            status: "completed",
            description: `🎮 Game Master subscription renewal for ${subscription.packageName}`,
            metadata: {
              subscriptionId: subscription._id.toString(),
              packageName: subscription.packageName,
              period: "monthly",
            },
            createdAt: now,
            updatedAt: now,
          });

        // Calculate new dates
        const durationDays = 30; // Default 30 days
        const newStartDate = new Date(subscription.endDate);
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + durationDays);

        // Update subscription (and clear expiry warnings for new period)
        await db.collection("gamemastersubscriptions").updateOne(
          { _id: subscription._id },
          {
            $set: {
              startDate: newStartDate,
              endDate: newEndDate,
              nextRenewalDate: newEndDate,
              expiryWarnings: {}, // Reset warnings for new period
              updatedAt: now,
            },
            $push: {
              renewalHistory: {
                date: now,
                amount: renewalPrice,
                transactionId: transactionResult.insertedId.toString(),
                status: "success",
              },
            } as unknown as mongoose.mongo.PushOperator<Document>,
          },
        );

        console.log(`   ✅ Renewed until ${newEndDate.toISOString()}`);
        result.renewedCount++;

        // Send notification to user about successful renewal
        // TODO: Implement notification
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `   ❌ Error processing subscription ${subscription._id}:`,
          error,
        );
        result.errors.push(`Subscription ${subscription._id}: ${errorMessage}`);
        result.failedCount++;
      }
    }

    // TASK 3: Expire subscriptions that have passed their end date (missed renewal)
    console.log("\n⏰ [GM RENEWAL] Checking for expired subscriptions...");

    const expireResult = await db
      .collection("gamemastersubscriptions")
      .updateMany(
        {
          status: "active",
          endDate: { $lt: now },
        },
        {
          $set: {
            status: "expired",
            updatedAt: now,
          },
        },
      );

    if (expireResult.modifiedCount > 0) {
      console.log(
        `   ⚠️ Force-expired ${expireResult.modifiedCount} subscription(s) past end date`,
      );
      result.expiredCount += expireResult.modifiedCount;
    }

    // TASK 4: Delete subscriptions that were scheduled for cancellation and have now expired
    console.log("\n🗑️ [GM RENEWAL] Checking for scheduled deletions...");

    const subscriptionsToDelete = await db
      .collection("gamemastersubscriptions")
      .find({
        scheduledForDeletion: true,
        endDate: { $lt: now },
      })
      .toArray();

    for (const subscription of subscriptionsToDelete) {
      try {
        console.log(
          `   Deleting scheduled subscription for user ${subscription.userId}...`,
        );

        // Delete the subscription
        await db
          .collection("gamemastersubscriptions")
          .deleteOne({ _id: subscription._id });

        // Also delete the associated UserPurchase record for the GM package
        const deletedPurchase = await db.collection("userpurchases").deleteOne({
          userId: subscription.userId,
          "item.category": "gamemaster",
        });

        // Send notification to user about deleted subscription
        await db.collection("notifications").insertOne({
          userId: subscription.userId,
          type: "gamemaster_deleted",
          title: "🎮 Game Master Subscription Ended",
          message: `Your ${subscription.packageName} subscription has ended and been removed from your arsenal as scheduled. Thank you for being a Game Master!`,
          link: "/marketplace",
          isRead: false,
          metadata: {
            packageName: subscription.packageName,
            finalEndDate: subscription.endDate,
            totalEarnings: subscription.totalEarnings,
            totalReferredUsers: subscription.totalReferredUsers,
          },
          createdAt: now,
        });

        console.log(
          `   ✅ Deleted subscription and ${deletedPurchase.deletedCount} purchase record(s) for user ${subscription.userId}`,
        );
        result.deletedCount++;
      } catch (deleteError) {
        console.error(
          `   ❌ Failed to delete subscription ${subscription._id}:`,
          deleteError,
        );
        result.errors.push(
          `Failed to delete scheduled cancellation ${subscription._id}`,
        );
      }
    }

    if (result.deletedCount > 0) {
      console.log(
        `   ✅ Deleted ${result.deletedCount} scheduled cancellation(s)`,
      );
    }

    console.log("\n🎮 [GM RENEWAL] Job completed!");
    console.log(`   Processed: ${result.processedCount}`);
    console.log(`   Renewed: ${result.renewedCount}`);
    console.log(`   Expired: ${result.expiredCount}`);
    console.log(`   Deleted (scheduled): ${result.deletedCount}`);
    console.log(`   Failed: ${result.failedCount}`);
    console.log(`   Daily resets: ${result.resetCount}`);
    console.log(`   Warnings sent: ${result.warningsSent}`);

    return result;
  } catch (error) {
    console.error("❌ [GM RENEWAL] Job failed:", error);
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error",
    );
    return result;
  }
}

// Export for worker index
export default runGameMasterRenewalJob;
