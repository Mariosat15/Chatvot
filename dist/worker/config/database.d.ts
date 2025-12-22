/**
 * Worker Database Configuration
 *
 * Connects to the same MongoDB as the main app.
 * Uses the existing mongoose connection from the shared database folder.
 */
export declare function connectToDatabase(): Promise<void>;
export declare function disconnectFromDatabase(): Promise<void>;
