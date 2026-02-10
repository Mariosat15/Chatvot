import mongoose from "mongoose";
import { MongoClient } from "mongodb";

// NOTE: Don't capture MONGODB_URI at module load time!
// It must be read at runtime because the worker loads .env after imports are resolved.
// See: worker/index.ts dotenv.config() runs after all imports are hoisted.

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
  var mongooseProfilingEnabled: boolean;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

// =============================================================================
// DEFAULT CONNECTION OPTIONS (overridden by MDB Cluster settings from DB)
// These are fallbacks if the DB settings haven't been configured yet.
// To change pool sizes: Admin Panel → MDB Cluster → Save → pm2 restart all
// =============================================================================
const DEFAULT_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
  maxIdleTimeMS: 60000,
};

/**
 * Fetch MDB Cluster settings from the database BEFORE establishing the
 * Mongoose connection, so pool sizes take effect on first connect.
 * Uses a quick MongoClient query — adds ~50ms to first connection.
 * Falls back to DEFAULT_OPTIONS on any error.
 */
async function loadClusterSettings(
  uri: string,
): Promise<mongoose.ConnectOptions> {
  const base: mongoose.ConnectOptions = {
    bufferCommands: false,
    maxPoolSize: DEFAULT_OPTIONS.maxPoolSize,
    minPoolSize: DEFAULT_OPTIONS.minPoolSize,
    serverSelectionTimeoutMS: DEFAULT_OPTIONS.serverSelectionTimeoutMS,
    socketTimeoutMS: DEFAULT_OPTIONS.socketTimeoutMS,
    connectTimeoutMS: DEFAULT_OPTIONS.connectTimeoutMS,
    maxIdleTimeMS: DEFAULT_OPTIONS.maxIdleTimeMS,
    // NOTE: readPreference is NOT set globally because MongoDB transactions
    // require primary reads. Instead, use .read("secondaryPreferred") on
    // specific read-heavy queries (leaderboard, stats) that don't use transactions.
    retryWrites: true,
    retryReads: true,
    // Use poll mode to reduce monitoring connections from 6 to 3 per instance
    // (no separate RTT pinger connection per replica set member)
    serverMonitoringMode: "poll",
  };

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      serverMonitoringMode: "poll",
    });
    await client.connect();
    const doc = await client
      .db()
      .collection("mdbclustersettings")
      .findOne({ _id: "global-mdb-cluster-settings" as any });
    await client.close();

    if (doc) {
      // Determine which pool fields to use based on PM2 env vars.
      // IMPORTANT: Don't use process.argv — Next.js build workers have
      // "worker" in their argv which causes false matches.
      const isWorker = process.env.IS_WORKER === "true";
      const isAdmin = process.env.IS_ADMIN === "true";

      if (isWorker) {
        base.maxPoolSize = doc.workerMaxPoolSize ?? DEFAULT_OPTIONS.maxPoolSize;
        base.minPoolSize = doc.workerMinPoolSize ?? DEFAULT_OPTIONS.minPoolSize;
      } else if (isAdmin) {
        base.maxPoolSize = doc.adminMaxPoolSize ?? DEFAULT_OPTIONS.maxPoolSize;
        base.minPoolSize = doc.adminMinPoolSize ?? DEFAULT_OPTIONS.minPoolSize;
      } else {
        base.maxPoolSize = doc.mainMaxPoolSize ?? DEFAULT_OPTIONS.maxPoolSize;
        base.minPoolSize = doc.mainMinPoolSize ?? DEFAULT_OPTIONS.minPoolSize;
      }

      base.serverSelectionTimeoutMS =
        doc.serverSelectionTimeoutMS ?? DEFAULT_OPTIONS.serverSelectionTimeoutMS;
      base.socketTimeoutMS =
        doc.socketTimeoutMS ?? DEFAULT_OPTIONS.socketTimeoutMS;
      base.connectTimeoutMS =
        doc.connectTimeoutMS ?? DEFAULT_OPTIONS.connectTimeoutMS;
      base.maxIdleTimeMS =
        doc.maxIdleTimeMS ?? DEFAULT_OPTIONS.maxIdleTimeMS;

      console.log(
        `📊 MDB Cluster settings loaded: pool ${base.maxPoolSize}/${base.minPoolSize} (tier: ${doc.clusterTier || "unknown"})`,
      );
    }
  } catch {
    // Settings not available yet — use defaults silently
  }

  return base;
}

// =============================================================================
// SLOW QUERY PROFILING
// =============================================================================
const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries slower than 500ms

function enableQueryProfiling() {
  if (global.mongooseProfilingEnabled) return;
  global.mongooseProfilingEnabled = true;

  // Use mongoose middleware for accurate query timing (pre/post hooks)
  mongoose.plugin((schema) => {
    // Pre-hook to capture start time
    schema.pre(
      /^find|^count|^aggregate/,
      function (this: mongoose.Query<unknown, unknown>) {
        (this as unknown as { _startTime: number })._startTime = Date.now();
      },
    );

    // Post-hook to log slow queries
    schema.post(
      /^find|^count|^aggregate/,
      function (this: mongoose.Query<unknown, unknown>) {
        const startTime = (this as unknown as { _startTime?: number })
          ._startTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          if (duration > SLOW_QUERY_THRESHOLD_MS) {
            const filter = this.getFilter ? this.getFilter() : {};
            console.warn(
              `🐢 SLOW QUERY [${duration}ms]: ${this.model?.modelName || "Unknown"}.${(this as unknown as { op?: string }).op}`,
              JSON.stringify(filter).slice(0, 200),
            );
          }
        }
      },
    );
  });
}

// =============================================================================
// CONNECTION WITH RETRY LOGIC
// =============================================================================
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function connectWithRetry(
  uri: string,
  options: mongoose.ConnectOptions,
  retries = MAX_RETRIES,
): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(uri, options);
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `⚠️ MongoDB connection failed, retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectWithRetry(uri, options, retries - 1);
    }
    throw err;
  }
}

export const connectToDatabase = async () => {
  // Read MONGODB_URI at RUNTIME, not module load time!
  // This is critical for the worker which loads dotenv after imports are resolved.
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) throw new Error("MONGODB_URI must be set within .env");

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    // Enable slow query profiling (always on — logs queries >500ms)
    enableQueryProfiling();

    // Load cluster settings from DB (pool sizes, timeouts) before connecting
    cached.promise = loadClusterSettings(mongoUri).then((opts) =>
      connectWithRetry(mongoUri, opts),
    );
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
};

// =============================================================================
// UTILITY: Query with timeout wrapper
// =============================================================================
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = "Database operation",
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
  } = {},
): Promise<T> {
  const {
    timeoutMs = 5000,
    retries = 2,
    operationName = "DB operation",
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(operation(), timeoutMs, operationName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        console.warn(
          `⚠️ ${operationName} failed (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
      }
    }
  }

  throw lastError;
}
