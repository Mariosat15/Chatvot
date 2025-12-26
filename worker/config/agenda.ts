/**
 * Agenda.js Configuration
 * 
 * Uses MongoDB as the job queue storage.
 * No Redis required!
 */

import Agenda from 'agenda';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not found in environment variables');
}

// Create Agenda instance with MongoDB
export const agenda = new Agenda({
  db: {
    address: MONGODB_URI,
    collection: 'worker_jobs', // Separate collection for jobs
    options: {
      // Use new URL parser and unified topology
    },
  },
  processEvery: '30 seconds', // Check for new jobs every 30 seconds
  maxConcurrency: 5, // Max 5 jobs running at once
  defaultConcurrency: 1, // Default 1 job at a time per type
  lockLimit: 0, // No limit on locked jobs
  defaultLockLimit: 0,
  defaultLockLifetime: 10 * 60 * 1000, // 10 minutes lock timeout
});

// Graceful shutdown
async function gracefulShutdown(): Promise<void> {
  console.log('🛑 Worker shutting down gracefully...');
  await agenda.stop();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export for use in jobs
export default agenda;

