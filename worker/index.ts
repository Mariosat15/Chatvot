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
 * - margin-check: Backup margin monitoring (every 1 minute, covers competitions + challenges)
 * - competition-end: Check for expired competitions (every 1 minute)
 * - challenge-finalize: Check for expired challenges (every 1 minute)
 * - trade-queue: Process limit orders (every 1 minute) — TP/SL handled by real-time service
 * - evaluate-badges: Evaluate user badges (every 1 hour)
 * (price-cache REMOVED — WEB app WebSocket writes prices to PriceCache)
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
// NOTE: price-cache job REMOVED — WebSocket streamer already writes prices every 1s.
// The worker's price-cache job was redundant (external API call + ~33 upserts/minute duplicating
// the WEB app's WebSocket-driven PriceCache writes). Worker reads from PriceCache instead.
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

/**
 * Invalidate the leaderboard cache on the main app.
 * Called after competition/challenge ends so rankings update immediately.
 * The main app's cache is in a different process — we call its HTTP endpoint.
 */
async function invalidateLeaderboardCache(): Promise<void> {
  try {
    const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await fetch(`${mainAppUrl}/api/leaderboard/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.INTERNAL_API_SECRET || "simulator-cleanup" }),
    });
  } catch {
    // Main app might not be reachable — cache will expire naturally in 5 min
  }
}

// Create Agenda instance
// IMPORTANT: Agenda creates its OWN MongoClient internally.
// Without db.options, it defaults to maxPoolSize: 100 — way too many.
// Cap it to 5 since jobs run sequentially (maxConcurrency: 3).
const agenda = new Agenda({
  db: {
    address: MONGODB_URI,
    collection: "worker_jobs",
    options: {
      maxPoolSize: 5,
      minPoolSize: 1,
      // NOTE: serverMonitoringMode is NOT supported by Agenda's bundled MongoDB driver (v4.x).
      // It's only available in MongoDB driver v6+. The worker's own Mongoose connection
      // already uses serverMonitoringMode:"poll" — this only affects Agenda's internal client.
    } as any,
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

      // Invalidate leaderboard cache so new rankings show immediately
      if (result.endedCompetitions > 0) {
        await invalidateLeaderboardCache();
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

    // Invalidate leaderboard cache so new rankings show immediately
    if (result.finalizedChallenges > 0) {
      await invalidateLeaderboardCache();
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
    if (result.ordersExecuted > 0) {
      console.log(`\n📋 [TRADE QUEUE] Completed in ${duration}ms`);
      console.log(
        `   Orders checked: ${result.pendingOrdersChecked}, executed: ${result.ordersExecuted}`,
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

// price-cache job REMOVED — WEB app's WebSocket streamer writes prices to PriceCache
// every 1-2 seconds via bulkWrite. The worker's 1-minute REST API fetch was redundant
// and added ~33 extra upserts/minute + an external API call. Worker reads from cache instead.

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

      // Badges affect leaderboard scores — invalidate cache
      await invalidateLeaderboardCache();
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

      // Invalidate leaderboard cache so new rankings show immediately
      await invalidateLeaderboardCache();
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
    await agenda.every("1 minute", "margin-check");
    await agenda.every("1 minute", "competition-end");
    await agenda.every("1 minute", "challenge-finalize");
    await agenda.every("1 minute", "early-end-check");
    await agenda.every("1 minute", "trade-queue");
    // price-cache REMOVED — redundant with WEB app's WebSocket PriceCache writes
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
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

// Start the worker
startWorker();
