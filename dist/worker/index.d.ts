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
export {};
