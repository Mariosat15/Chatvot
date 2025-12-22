"use strict";
/**
 * Agenda.js Configuration
 *
 * Uses MongoDB as the job queue storage.
 * No Redis required!
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agenda = void 0;
const agenda_1 = __importDefault(require("agenda"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found in environment variables');
}
// Create Agenda instance with MongoDB
exports.agenda = new agenda_1.default({
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
async function gracefulShutdown() {
    console.log('🛑 Worker shutting down gracefully...');
    await exports.agenda.stop();
    process.exit(0);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Export for use in jobs
exports.default = exports.agenda;
