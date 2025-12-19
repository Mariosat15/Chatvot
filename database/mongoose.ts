import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    }
    var mongooseProfilingEnabled: boolean;
}

let cached = global.mongooseCache;

if(!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

// Optimized connection options for performance
const connectionOptions: mongoose.ConnectOptions = {
    bufferCommands: false,
    // Connection pool settings - optimized for trading app workload
    maxPoolSize: 20, // Max connections in pool (default is 100, too high for most apps)
    minPoolSize: 5,  // Keep minimum connections ready
    // Timeouts - CRITICAL for preventing 30+ second hangs
    serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    socketTimeoutMS: 10000, // Reduced from 45s to 10s - prevents long hangs
    connectTimeoutMS: 10000, // Connection timeout
    // Performance options
    maxIdleTimeMS: 30000, // Close idle connections after 30s
    // Retry options for resilience
    retryWrites: true,
    retryReads: true,
};

// =============================================================================
// SLOW QUERY PROFILING
// =============================================================================
const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries slower than 500ms

function enableQueryProfiling() {
    if (global.mongooseProfilingEnabled) return;
    global.mongooseProfilingEnabled = true;
    
    // Hook into mongoose to profile all queries
    mongoose.set('debug', (collectionName: string, methodName: string, ...methodArgs: unknown[]) => {
        const start = Date.now();
        
        // Log slow queries after completion (via process.nextTick to not block)
        process.nextTick(() => {
            const duration = Date.now() - start;
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                console.warn(`🐢 SLOW QUERY [${duration}ms]: ${collectionName}.${methodName}`, 
                    JSON.stringify(methodArgs[0] || {}).slice(0, 200));
            }
        });
    });
    
    // Alternative: Use mongoose middleware for more accurate timing
    mongoose.plugin((schema) => {
        // Pre-hook to capture start time
        schema.pre(/^find|^count|^aggregate/, function(this: mongoose.Query<unknown, unknown>) {
            (this as unknown as { _startTime: number })._startTime = Date.now();
        });
        
        // Post-hook to log slow queries
        schema.post(/^find|^count|^aggregate/, function(this: mongoose.Query<unknown, unknown>) {
            const startTime = (this as unknown as { _startTime?: number })._startTime;
            if (startTime) {
                const duration = Date.now() - startTime;
                if (duration > SLOW_QUERY_THRESHOLD_MS) {
                    const filter = this.getFilter ? this.getFilter() : {};
                    console.warn(`🐢 SLOW QUERY [${duration}ms]: ${this.model?.modelName || 'Unknown'}.${this.op}`,
                        JSON.stringify(filter).slice(0, 200));
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

async function connectWithRetry(retries = MAX_RETRIES): Promise<typeof mongoose> {
    try {
        return await mongoose.connect(MONGODB_URI!, connectionOptions);
    } catch (err) {
        if (retries > 0) {
            console.warn(`⚠️ MongoDB connection failed, retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return connectWithRetry(retries - 1);
        }
        throw err;
    }
}

export const connectToDatabase = async () => {
    if(!MONGODB_URI) throw new Error('MONGODB_URI must be set within .env');

    if(cached.conn) return cached.conn;

    if(!cached.promise) {
        // Enable profiling before connecting
        if (process.env.NODE_ENV === 'development' || process.env.ENABLE_QUERY_PROFILING === 'true') {
            enableQueryProfiling();
        }
        
        cached.promise = connectWithRetry();
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    // Only log on first connection, not reconnects
    if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Connected to database - pool: ${connectionOptions.maxPoolSize} connections`);
    }

    return cached.conn;
}

// =============================================================================
// UTILITY: Query with timeout wrapper
// =============================================================================
export async function withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    operationName = 'Database operation'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
}

// =============================================================================
// UTILITY: Safe database operation with retry
// =============================================================================
export async function safeDbOperation<T>(
    operation: () => Promise<T>,
    options: {
        timeoutMs?: number;
        retries?: number;
        operationName?: string;
    } = {}
): Promise<T> {
    const { 
        timeoutMs = 5000, 
        retries = 2, 
        operationName = 'DB operation' 
    } = options;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await withTimeout(operation(), timeoutMs, operationName);
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            
            if (attempt < retries) {
                console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`);
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }
    
    throw lastError;
}
