/**
 * Chartvolt Background Worker
 *
 * Runs independently from the main Next.js app.
 * Handles all background jobs using Agenda.js with MongoDB.
 *
 * NO REDIS REQUIRED - uses your existing MongoDB!
 * REPLACES INNGEST - all scheduled jobs handled here!
 *
 * Jobs:
 * - margin-check: Backup margin monitoring (every 5 minutes)
 * - competition-end: Check for expired competitions (every 1 minute)
 * - challenge-finalize: Check for expired challenges (every 1 minute)
 * - trade-queue: Process limit orders & TP/SL (every 1 minute)
 * - price-cache: Update price cache (every 1 minute)
 * - evaluate-badges: Evaluate user badges (every 1 hour)
 *
 * Usage:
 *   npm run worker
 *
 * Or with PM2:
 *   pm2 start dist/worker/index.js --name chartvolt-worker
 */

import Agenda from "agenda";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env
// Use process.cwd() since worker is always run from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ⚠️ IMPORTANT: Set IS_WORKER flag BEFORE any other imports
// This tells websocket-price-streamer to NOT connect (WEB app handles WebSocket)
// Worker reads prices from MongoDB cache instead
process.env.IS_WORKER = "true";

import { connectToDatabase, disconnectFromDatabase } from "./config/database";
import { runMarginCheck } from "./jobs/margin-check.job";
import { runCompetitionEndCheck } from "./jobs/competition-end.job";
import { runChallengeFinalizeCheck } from "./jobs/challenge-finalize.job";
import { runTradeQueueProcessor } from "./jobs/trade-queue.job";
import { runPriceCacheUpdate } from "./jobs/price-cache.job";
import { runBadgeEvaluation } from "./jobs/evaluate-badges.job";
import {
  defineWithdrawalProcessJob,
  scheduleWithdrawalJobs,
} from "./jobs/withdrawal-process.job";
import { runKYCExpiryCheck } from "./jobs/kyc-expiry-check.job";
import { runMarketDataMaintenance } from "./jobs/market-data-maintenance.job";
import { runEarlyEndCheck } from "./jobs/early-end-check.job";
import { runGameMasterRenewalJob } from "./jobs/gamemaster-renewal.job";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment variables");
  process.exit(1);
}

// Create Agenda instance
const agenda = new Agenda({
  db: {
    address: MONGODB_URI,
    collection: "worker_jobs",
  },
  processEvery: "30 seconds",
  maxConcurrency: 3,
  defaultConcurrency: 1,
  defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
});

// ============================================
// JOB DEFINITIONS
// ============================================

/**
 * Margin Check Job
 * Runs every 5 minutes as backup to client-side checks
 */
agenda.define("margin-check", async () => {
  const startTime = Date.now();
  console.log("\n📊 [MARGIN CHECK] Starting...");

  try {
    const result = await runMarginCheck();
    const duration = Date.now() - startTime;

    console.log(`📊 [MARGIN CHECK] Completed in ${duration}ms`);
    console.log(`   Checked: ${result.checkedParticipants} participants`);
    console.log(
      `   Liquidated: ${result.liquidatedUsers} users (${result.liquidatedPositions} positions)`,
    );

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`📊 [MARGIN CHECK] Failed:`, error);
  }
});

/**
 * Competition End Job
 * Runs every minute to catch competitions at exact end time
 */
agenda.define("competition-end", async () => {
  const startTime = Date.now();
  console.log("\n🏆 [COMPETITION END] Starting...");

  try {
    const result = await runCompetitionEndCheck();
    const duration = Date.now() - startTime;

    // Always log completion with result
    console.log(`🏆 [COMPETITION END] Completed in ${duration}ms`);
    console.log(
      `   Checked: ${result.checkedCompetitions} expired competitions`,
    );

    if (result.checkedCompetitions > 0) {
      console.log(`   Ended: ${result.endedCompetitions}`);

      if (result.failedCompetitions.length > 0) {
        console.log(`   ❌ Failed: ${result.failedCompetitions.length}`);
        result.failedCompetitions.forEach((e) => console.log(`     - ${e}`));
      }
    }
  } catch (error) {
    console.error(`🏆 [COMPETITION END] Failed:`, error);
  }
});

/**
 * Challenge Finalize Job
 * Runs every minute to finalize ended challenges
 */
agenda.define("challenge-finalize", async () => {
  const startTime = Date.now();
  console.log("\n⚔️ [CHALLENGE FINALIZE] Starting...");

  try {
    const result = await runChallengeFinalizeCheck();
    const duration = Date.now() - startTime;

    // Log if any work was done
    if (result.checkedChallenges > 0 || result.expiredPendingChallenges > 0) {
      console.log(`⚔️ [CHALLENGE FINALIZE] Completed in ${duration}ms`);

      if (result.expiredPendingChallenges > 0) {
        console.log(
          `   ⏰ Expired pending: ${result.expiredPendingChallenges} (refunded ${result.refundedAmount} credits)`,
        );
      }

      if (result.checkedChallenges > 0) {
        console.log(
          `   🏁 Finalized active: ${result.finalizedChallenges}/${result.checkedChallenges}`,
        );
      }

      if (result.failedChallenges.length > 0) {
        console.log(`   ❌ Failed: ${result.failedChallenges.length}`);
        result.failedChallenges.forEach((e) => console.log(`     - ${e}`));
      }
    }
  } catch (error) {
    console.error(`⚔️ [CHALLENGE FINALIZE] Failed:`, error);
  }
});

/**
 * Trade Queue Processor Job
 * - Processes pending limit orders every minute
 * - BACKUP sweep for TP/SL (real-time triggering happens in WebSocket handler!)
 * - Catches any positions that real-time check might have missed
 * (Replaces Inngest: process-trade-queue)
 */
agenda.define("trade-queue", async () => {
  const startTime = Date.now();

  try {
    const result = await runTradeQueueProcessor();
    const duration = Date.now() - startTime;

    // Only log if there was activity
    if (result.ordersExecuted > 0 || result.tpSlTriggered > 0) {
      console.log(`\n📋 [TRADE QUEUE] Completed in ${duration}ms`);
      console.log(
        `   Orders checked: ${result.pendingOrdersChecked}, executed: ${result.ordersExecuted}`,
      );
      console.log(
        `   Positions checked: ${result.positionsChecked}, TP/SL backup triggered: ${result.tpSlTriggered}`,
      );
    }

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`📋 [TRADE QUEUE] Failed:`, error);
  }
});

/**
 * Price Cache Update Job
 * Updates forex price cache every minute
 * (Replaces Inngest: update-price-cache)
 */
agenda.define("price-cache", async () => {
  try {
    const result = await runPriceCacheUpdate();

    // Silent unless errors
    if (result.errors.length > 0) {
      console.log(`\n💱 [PRICE CACHE] Errors:`);
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`💱 [PRICE CACHE] Failed:`, error);
  }
});

/**
 * Badge Evaluation Job
 * Evaluates all user badges every hour
 * (Replaces Inngest: chatvolt-evaluate-badges)
 */
agenda.define("evaluate-badges", async () => {
  const startTime = Date.now();
  console.log("\n🏅 [BADGE EVALUATION] Starting...");

  try {
    const result = await runBadgeEvaluation();
    const duration = Date.now() - startTime;

    console.log(`🏅 [BADGE EVALUATION] Completed in ${duration}ms`);
    console.log(`   Users evaluated: ${result.usersEvaluated}`);
    console.log(`   Badges awarded: ${result.badgesAwarded}`);

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`🏅 [BADGE EVALUATION] Failed:`, error);
  }
});

/**
 * KYC Expiry Check Job
 * Runs daily to check for expiring KYC verifications and send reminders
 */
agenda.define("kyc-expiry-check", async () => {
  const startTime = Date.now();
  console.log("\n🔐 [KYC EXPIRY CHECK] Starting...");

  try {
    const result = await runKYCExpiryCheck();
    const duration = Date.now() - startTime;

    console.log(`🔐 [KYC EXPIRY CHECK] Completed in ${duration}ms`);
    console.log(`   Users checked: ${result.checkedUsers}`);
    console.log(`   Expiring in 30 days: ${result.expiringSoon30Days}`);
    console.log(`   Expiring in 7 days: ${result.expiringSoon7Days}`);
    console.log(`   Expiring in 1 day: ${result.expiringSoon1Day}`);
    console.log(`   Expired (reset): ${result.expired}`);
    console.log(`   Data retention expiring: ${result.dataRetentionExpiring}`);
    console.log(`   Notifications sent: ${result.notificationsSent}`);

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`🔐 [KYC EXPIRY CHECK] Failed:`, error);
  }
});

/**
 * Market Data Maintenance Job
 * Runs every 5 minutes to check if cleanup should run (auto mode)
 * Gap fill runs in background via API, not here
 */
agenda.define("market-data-maintenance", async () => {
  try {
    await runMarketDataMaintenance();
  } catch (error) {
    console.error(`📊 [MARKET DATA MAINTENANCE] Failed:`, error);
  }
});

/**
 * GAME MASTER RENEWAL JOB
 * Processes subscription renewals, expirations, and daily counter resets
 * Runs daily at 00:05 UTC
 */
agenda.define("gamemaster-renewal", async () => {
  try {
    await runGameMasterRenewalJob();
  } catch (error) {
    console.error(`🎮 [GAMEMASTER RENEWAL] Failed:`, error);
  }
});

/**
 * Early End Check Job
 * Checks if all players eliminated/disqualified and ends competition/challenge early
 * - Competitions: All liquidated → rank by equity, all disqualified → no winners
 * - Challenges: One out → other wins, both out → compare equity or refund
 */
agenda.define("early-end-check", async () => {
  try {
    const result = await runEarlyEndCheck();

    // Only log if something happened
    if (result.competitionsEnded > 0 || result.challengesEnded > 0) {
      console.log(`\n🏁 [EARLY END CHECK]`);
      if (result.competitionsEnded > 0) {
        console.log(`   Competitions ended early: ${result.competitionsEnded}`);
      }
      if (result.challengesEnded > 0) {
        console.log(`   Challenges ended early: ${result.challengesEnded}`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`🏁 [EARLY END CHECK] Failed:`, error);
  }
});

// Define withdrawal processing jobs
defineWithdrawalProcessJob(agenda);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  try {
    await agenda.stop();
    console.log("✅ Agenda stopped");

    await disconnectFromDatabase();
    console.log("✅ Database disconnected");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ============================================
// START WORKER
// ============================================

async function startWorker(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           CHARTVOLT BACKGROUND WORKER                    ║");
  console.log("║           No Redis Required - Uses MongoDB               ║");
  console.log("║           Real-Time TP/SL + Backup Sweep                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");

  try {
    // Connect to database
    await connectToDatabase();

    // Start Agenda
    await agenda.start();
    console.log("✅ Agenda started");

    // Schedule recurring jobs (replaces ALL Inngest functions)
    await agenda.every("5 minutes", "margin-check");
    await agenda.every("1 minute", "competition-end"); // BACKUP - client-side auto-finalizes on access
    await agenda.every("1 minute", "challenge-finalize"); // BACKUP - client-side auto-finalizes on access
    await agenda.every("1 minute", "early-end-check"); // Check if all players eliminated
    await agenda.every("1 minute", "trade-queue"); // BACKUP sweep - real-time happens in main app
    await agenda.every("1 minute", "price-cache");
    await agenda.every("1 hour", "evaluate-badges");
    await agenda.every("1 day", "kyc-expiry-check"); // Daily KYC expiry check
    await agenda.every("5 minutes", "market-data-maintenance"); // Market data cleanup check
    await agenda.every("1 day", "gamemaster-renewal"); // Daily game master subscription renewal

    // Schedule withdrawal processing jobs
    await scheduleWithdrawalJobs(agenda);

    console.log("\n📅 Scheduled Jobs:");
    console.log("   • margin-check: every 5 minutes");
    console.log(
      "   • competition-end: every 1 minute (backup - client auto-finalizes on access)",
    );
    console.log(
      "   • challenge-finalize: every 1 minute (backup - client auto-finalizes on access)",
    );
    console.log(
      "   • early-end-check: every 1 minute (end if all players eliminated)",
    );
    console.log(
      "   • trade-queue: every 1 minute (backup TP/SL sweep & limit orders)",
    );
    console.log("   • price-cache: every 1 minute");
    console.log("   • evaluate-badges: every 1 hour");
    console.log(
      "   • kyc-expiry-check: every 1 day (expiry reminders & auto-reset)",
    );
    console.log(
      "   • market-data-maintenance: every 5 minutes (auto cleanup check)",
    );
    console.log(
      "   • check-pending-withdrawals: every 1 hour (status summary)",
    );
    console.log("   • check-stuck-withdrawals: every 6 hours");
    console.log("   • check-old-pending-withdrawals: every 12 hours");
    console.log(
      "\n⚡ TP/SL Note: Real-time triggers happen in main app on price updates!",
    );
    console.log(
      "   Worker trade-queue is a BACKUP sweep to catch any missed closures.",
    );
    console.log("\n🚀 Worker is running! Press Ctrl+C to stop.\n");

    // Run initial checks immediately
    console.log("🔄 Running initial checks...");
    await agenda.now("margin-check", {});
    await agenda.now("competition-end", {});
    await agenda.now("challenge-finalize", {});
    await agenda.now("early-end-check", {});
    await agenda.now("trade-queue", {});
    await agenda.now("price-cache", {});
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

// Start the worker
startWorker();
