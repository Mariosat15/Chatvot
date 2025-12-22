"use strict";
/**
 * Database Configuration for API Server
 *
 * Reuses the same MongoDB connection as the main app.
 * Uses the existing mongoose configuration.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.disconnectFromDatabase = disconnectFromDatabase;
exports.getConnectionStatus = getConnectionStatus;
exports.ensureDbReady = ensureDbReady;
const mongoose_1 = __importDefault(require("mongoose"));
// Connection options optimized for performance
const connectionOptions = {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    // CRITICAL: Disable buffering to get immediate errors instead of timeouts
    bufferCommands: true,
    // Auto-reconnect
    autoIndex: true,
};
async function connectToDatabase() {
    // Check actual mongoose connection state
    const state = mongoose_1.default.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
        console.log('📊 Database already connected');
        return mongoose_1.default;
    }
    if (state === 2) {
        console.log('📊 Database connection in progress, waiting...');
        // Wait for connection to complete
        await new Promise((resolve, reject) => {
            mongoose_1.default.connection.once('connected', resolve);
            mongoose_1.default.connection.once('error', reject);
            // Timeout after 30 seconds
            setTimeout(() => reject(new Error('Connection timeout')), 30000);
        });
        return mongoose_1.default;
    }
    // Check for MONGODB_URI at runtime (after dotenv is loaded)
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not defined. Make sure .env file exists in project root.');
    }
    try {
        console.log('📊 Connecting to database...');
        const db = await mongoose_1.default.connect(MONGODB_URI, connectionOptions);
        console.log('✅ Database connected');
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected - will auto-reconnect');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        return db;
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        throw error;
    }
}
async function disconnectFromDatabase() {
    if (mongoose_1.default.connection.readyState === 0)
        return;
    await mongoose_1.default.disconnect();
}
function getConnectionStatus() {
    return mongoose_1.default.connection.readyState === 1;
}
/**
 * Ensure database is ready before operations
 * Call this at the start of routes that need DB
 */
async function ensureDbReady() {
    const state = mongoose_1.default.connection.readyState;
    if (state === 1)
        return; // Connected
    if (state === 0 || state === 3) {
        // Disconnected - try to reconnect
        console.log('📊 Database not connected, reconnecting...');
        await connectToDatabase();
    }
    else if (state === 2) {
        // Connecting - wait
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('DB connection timeout')), 15000);
            mongoose_1.default.connection.once('connected', () => {
                clearTimeout(timeout);
                resolve();
            });
            mongoose_1.default.connection.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
}
//# sourceMappingURL=database.js.map