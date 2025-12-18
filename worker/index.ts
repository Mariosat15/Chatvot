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

import Agenda from 'agenda';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
// Use process.cwd() since worker is always run from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ⚠️ IMPORTANT: Set IS_WORKER flag BEFORE any other imports
// This tells websocket-price-streamer to NOT connect (WEB app handles WebSocket)
// Worker reads prices from MongoDB cache instead
process.env.IS_WORKER = 'true';

import { connectToDatabase, disconnectFromDatabase } from './config/database';
import { runMarginCheck } from './jobs/margin-check.job';
import { runCompetitionEndCheck } from './jobs/competition-end.job';
import { runChallengeFinalizeCheck } from './jobs/challenge-finalize.job';
import { runTradeQueueProcessor } from './jobs/trade-queue.job';
import { runPriceCacheUpdate } from './jobs/price-cache.job';
import { runBadgeEvaluation } from './jobs/evaluate-badges.job';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Create Agenda instance
const agenda = new Agenda({
  db: {
    address: MONGODB_URI,
    collection: 'worker_jobs',
  },
  processEvery: '30 seconds',
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
agenda.define('margin-check', async () => {
  const startTime = Date.now();
  console.log('\n📊 [MARGIN CHECK] Starting...');
  
  try {
    const result = await runMarginCheck();
    const duration = Date.now() - startTime;
    
    console.log(`📊 [MARGIN CHECK] Completed in ${duration}ms`);
    console.log(`   Checked: ${result.checkedParticipants} participants`);
    console.log(`   Liquidated: ${result.liquidatedUsers} users (${result.liquidatedPositions} positions)`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`📊 [MARGIN CHECK] Failed:`, error);
  }
});

/**
 * Competition End Job
 * Runs every minute to catch competitions at exact end time
 */
agenda.define('competition-end', async () => {
  const startTime = Date.now();
  console.log('\n🏆 [COMPETITION END] Starting...');
  
  try {
    const result = await runCompetitionEndCheck();
    const duration = Date.now() - startTime;
    
    if (result.checkedCompetitions > 0) {
      console.log(`🏆 [COMPETITION END] Completed in ${duration}ms`);
      console.log(`   Checked: ${result.checkedCompetitions} competitions`);
      console.log(`   Ended: ${result.endedCompetitions}`);
      
      if (result.failedCompetitions.length > 0) {
        console.log(`   Failed: ${result.failedCompetitions.length}`);
        result.failedCompetitions.forEach(e => console.log(`     - ${e}`));
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
agenda.define('challenge-finalize', async () => {
  const startTime = Date.now();
  console.log('\n⚔️ [CHALLENGE FINALIZE] Starting...');
  
  try {
    const result = await runChallengeFinalizeCheck();
    const duration = Date.now() - startTime;
    
    if (result.checkedChallenges > 0) {
      console.log(`⚔️ [CHALLENGE FINALIZE] Completed in ${duration}ms`);
      console.log(`   Checked: ${result.checkedChallenges} challenges`);
      console.log(`   Finalized: ${result.finalizedChallenges}`);
      
      if (result.failedChallenges.length > 0) {
        console.log(`   Failed: ${result.failedChallenges.length}`);
        result.failedChallenges.forEach(e => console.log(`     - ${e}`));
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
agenda.define('trade-queue', async () => {
  const startTime = Date.now();
  
  try {
    const result = await runTradeQueueProcessor();
    const duration = Date.now() - startTime;
    
    // Only log if there was activity
    if (result.ordersExecuted > 0 || result.tpSlTriggered > 0) {
      console.log(`\n📋 [TRADE QUEUE] Completed in ${duration}ms`);
      console.log(`   Orders checked: ${result.pendingOrdersChecked}, executed: ${result.ordersExecuted}`);
      console.log(`   Positions checked: ${result.positionsChecked}, TP/SL backup triggered: ${result.tpSlTriggered}`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(e => console.log(`     - ${e}`));
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
agenda.define('price-cache', async () => {
  try {
    const result = await runPriceCacheUpdate();
    
    // Silent unless errors
    if (result.errors.length > 0) {
      console.log(`\n💱 [PRICE CACHE] Errors:`);
      result.errors.forEach(e => console.log(`     - ${e}`));
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
agenda.define('evaluate-badges', async () => {
  const startTime = Date.now();
  console.log('\n🏅 [BADGE EVALUATION] Starting...');
  
  try {
    const result = await runBadgeEvaluation();
    const duration = Date.now() - startTime;
    
    console.log(`🏅 [BADGE EVALUATION] Completed in ${duration}ms`);
    console.log(`   Users evaluated: ${result.usersEvaluated}`);
    console.log(`   Badges awarded: ${result.badgesAwarded}`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`     - ${e}`));
    }
  } catch (error) {
    console.error(`🏅 [BADGE EVALUATION] Failed:`, error);
  }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    await agenda.stop();
    console.log('✅ Agenda stopped');
    
    await disconnectFromDatabase();
    console.log('✅ Database disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// START WORKER
// ============================================

async function startWorker(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           CHARTVOLT BACKGROUND WORKER                    ║');
  console.log('║           No Redis Required - Uses MongoDB               ║');
  console.log('║           Real-Time TP/SL + Backup Sweep                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // Connect to database
    await connectToDatabase();

    // Start Agenda
    await agenda.start();
    console.log('✅ Agenda started');

    // Schedule recurring jobs (replaces ALL Inngest functions)
    await agenda.every('5 minutes', 'margin-check');
    await agenda.every('1 minute', 'competition-end');
    await agenda.every('1 minute', 'challenge-finalize');
    await agenda.every('1 minute', 'trade-queue');  // BACKUP sweep - real-time happens in main app
    await agenda.every('1 minute', 'price-cache');
    await agenda.every('1 hour', 'evaluate-badges');

    console.log('\n📅 Scheduled Jobs:');
    console.log('   • margin-check: every 5 minutes');
    console.log('   • competition-end: every 1 minute');
    console.log('   • challenge-finalize: every 1 minute');
    console.log('   • trade-queue: every 1 minute (backup TP/SL sweep & limit orders)');
    console.log('   • price-cache: every 1 minute');
    console.log('   • evaluate-badges: every 1 hour');
    console.log('\n⚡ TP/SL Note: Real-time triggers happen in main app on price updates!');
    console.log('   Worker trade-queue is a BACKUP sweep to catch any missed closures.');
    console.log('\n🚀 Worker is running! Press Ctrl+C to stop.\n');

    // Run initial checks immediately
    console.log('🔄 Running initial checks...');
    await agenda.now('margin-check', {});
    await agenda.now('competition-end', {});
    await agenda.now('challenge-finalize', {});
    await agenda.now('trade-queue', {});
    await agenda.now('price-cache', {});

  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

// Start the worker
startWorker();

