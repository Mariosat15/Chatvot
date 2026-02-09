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
  try {
    const result = await runMarginCheck();

    // Only log when liquidations happen
    if (result.liquidatedUsers > 0) {
      console.log(`📊 [MARGIN CHECK] Liquidated: ${result.liquidatedUsers} users (${result.liquidatedPositions} positions)`);
    }

    if (result.errors.length > 0) {
      console.error(`📊 [MARGIN CHECK] Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.error(`     - ${e}`));
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
  try {
    const result = await runCompetitionEndCheck();

    // Only log when actual work was done
    if (result.checkedCompetitions > 0) {
      console.log(`🏆 [COMPETITION END] Ended: ${result.endedCompetitions}/${result.checkedCompetitions}`);

      if (result.failedCompetitions.length > 0) {
        console.error(`🏆 [COMPETITION END] Failed: ${result.failedCompetitions.length}`);
        result.failedCompetitions.forEach((e) => console.error(`     - ${e}`));
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
  try {
    const result = await runChallengeFinalizeCheck();

    // Only log when actual work was done
    if (result.expiredPendingChallenges > 0) {
      console.log(
        `⚔️ [CHALLENGE FINALIZE] Expired pending: ${result.expiredPendingChallenges} (refunded ${result.refundedAmount} credits)`,
      );
    }

    if (result.finalizedChallenges > 0) {
      console.log(
        `⚔️ [CHALLENGE FINALIZE] Finalized: ${result.finalizedChallenges}/${result.checkedChallenges}`,
      );
    }

    if (result.failedChallenges.length > 0) {
      console.error(`⚔️ [CHALLENGE FINALIZE] Failed: ${result.failedChallenges.length}`);
      result.failedChallenges.forEach((e) => console.error(`     - ${e}`));
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
      console.error(`📋 [TRADE QUEUE] Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach((e) => console.error(`     - ${e}`));
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
      console.error(`💱 [PRICE CACHE] Errors:`);
      result.errors.forEach((e) => console.error(`     - ${e}`));
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
  try {
    const result = await runBadgeEvaluation();

    // Only log when badges are actually awarded
    if (result.badgesAwarded > 0) {
      console.log(`🏅 [BADGE EVALUATION] Awarded ${result.badgesAwarded} badges to ${result.usersEvaluated} users`);
    }

    if (result.errors.length > 0) {
      console.error(`🏅 [BADGE EVALUATION] Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.error(`     - ${e}`));
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
  try {
    const result = await runKYCExpiryCheck();

    // Only log when there are actual actions taken
    if (result.expired > 0 || result.notificationsSent > 0) {
      console.log(`🔐 [KYC EXPIRY CHECK] Expired: ${result.expired}, Notifications: ${result.notificationsSent}`);
    }

    if (result.errors.length > 0) {
      console.error(`🔐 [KYC EXPIRY CHECK] Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.error(`     - ${e}`));
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
      console.error(`🏁 [EARLY END CHECK] Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.error(`     - ${e}`));
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
  console.log("🚀 Chartvolt Worker starting...");

  try {
    // Connect to database
    await connectToDatabase();

    // Start Agenda
    await agenda.start();

    // Schedule recurring jobs
    await agenda.every("5 minutes", "margin-check");
    await agenda.every("1 minute", "competition-end");
    await agenda.every("1 minute", "challenge-finalize");
    await agenda.every("1 minute", "early-end-check");
    await agenda.every("1 minute", "trade-queue");
    await agenda.every("1 minute", "price-cache");
    await agenda.every("1 hour", "evaluate-badges");
    await agenda.every("1 day", "kyc-expiry-check");
    await agenda.every("5 minutes", "market-data-maintenance");
    await agenda.every("1 day", "gamemaster-renewal");

    // Schedule withdrawal processing jobs
    await scheduleWithdrawalJobs(agenda);

    console.log("✅ Chartvolt Worker running (silent mode - only errors/actions logged)");

    // Run initial checks immediately
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
