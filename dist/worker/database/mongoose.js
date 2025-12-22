"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = void 0;
exports.withTimeout = withTimeout;
exports.safeDbOperation = safeDbOperation;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = process.env.MONGODB_URI;
let cached = global.mongooseCache;
if (!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}
// Optimized connection options for performance
const connectionOptions = {
    bufferCommands: false,
    // Connection pool settings - INCREASED for peak load handling
    // Rule of thumb: maxPoolSize = expectedConcurrentUsers / 5
    maxPoolSize: 50, // Increased from 20 for better throughput under load
    minPoolSize: 10, // Keep more connections warm for faster response
    // Timeouts - CRITICAL for preventing 30+ second hangs
    serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    socketTimeoutMS: 10000, // Reduced from 45s to 10s - prevents long hangs
    connectTimeoutMS: 10000, // Connection timeout
    // Performance options
    maxIdleTimeMS: 60000, // Increased to 60s - keep connections alive longer under load
    // Retry options for resilience
    retryWrites: true,
    retryReads: true,
};
// =============================================================================
// SLOW QUERY PROFILING
// =============================================================================
const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries slower than 500ms
function enableQueryProfiling() {
    if (global.mongooseProfilingEnabled)
        return;
    global.mongooseProfilingEnabled = true;
    // Hook into mongoose to profile all queries
    mongoose_1.default.set('debug', (collectionName, methodName, ...methodArgs) => {
        const start = Date.now();
        // Log slow queries after completion (via process.nextTick to not block)
        process.nextTick(() => {
            const duration = Date.now() - start;
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                console.warn(`🐢 SLOW QUERY [${duration}ms]: ${collectionName}.${methodName}`, JSON.stringify(methodArgs[0] || {}).slice(0, 200));
            }
        });
    });
    // Alternative: Use mongoose middleware for more accurate timing
    mongoose_1.default.plugin((schema) => {
        // Pre-hook to capture start time
        schema.pre(/^find|^count|^aggregate/, function () {
            this._startTime = Date.now();
        });
        // Post-hook to log slow queries
        schema.post(/^find|^count|^aggregate/, function () {
            const startTime = this._startTime;
            if (startTime) {
                const duration = Date.now() - startTime;
                if (duration > SLOW_QUERY_THRESHOLD_MS) {
                    const filter = this.getFilter ? this.getFilter() : {};
                    console.warn(`🐢 SLOW QUERY [${duration}ms]: ${this.model?.modelName || 'Unknown'}.${this.op}`, JSON.stringify(filter).slice(0, 200));
                }
            }
        });
    });
}
// =============================================================================
// CONNECTION WITH RETRY LOGIC
// =============================================================================
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
async function connectWithRetry(retries = MAX_RETRIES) {
    try {
        return await mongoose_1.default.connect(MONGODB_URI, connectionOptions);
    }
    catch (err) {
        if (retries > 0) {
            console.warn(`⚠️ MongoDB connection failed, retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return connectWithRetry(retries - 1);
        }
        throw err;
    }
}
const connectToDatabase = async () => {
    if (!MONGODB_URI)
        throw new Error('MONGODB_URI must be set within .env');
    if (cached.conn)
        return cached.conn;
    if (!cached.promise) {
        // Enable profiling before connecting
        if (process.env.NODE_ENV === 'development' || process.env.ENABLE_QUERY_PROFILING === 'true') {
            enableQueryProfiling();
        }
        cached.promise = connectWithRetry();
    }
    try {
        cached.conn = await cached.promise;
    }
    catch (err) {
        cached.promise = null;
        throw err;
    }
    // Only log on first connection, not reconnects
    if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Connected to database - pool: ${connectionOptions.maxPoolSize} connections`);
    }
    return cached.conn;
};
exports.connectToDatabase = connectToDatabase;
// =============================================================================
// UTILITY: Query with timeout wrapper
// =============================================================================
async function withTimeout(promise, timeoutMs, operationName = 'Database operation') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
}
// =============================================================================
// UTILITY: Safe database operation with retry
// =============================================================================
async function safeDbOperation(operation, options = {}) {
    const { timeoutMs = 5000, retries = 2, operationName = 'DB operation' } = options;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await withTimeout(operation(), timeoutMs, operationName);
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < retries) {
                console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`);
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
