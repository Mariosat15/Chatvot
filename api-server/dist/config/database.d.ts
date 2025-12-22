/**
 * Database Configuration for API Server
 *
 * Reuses the same MongoDB connection as the main app.
 * Uses the existing mongoose configuration.
 */
import mongoose from 'mongoose';
export declare function connectToDatabase(): Promise<typeof mongoose>;
export declare function disconnectFromDatabase(): Promise<void>;
export declare function getConnectionStatus(): boolean;
/**
 * Ensure database is ready before operations
 * Call this at the start of routes that need DB
 */
export declare function ensureDbReady(): Promise<void>;
//# sourceMappingURL=database.d.ts.map