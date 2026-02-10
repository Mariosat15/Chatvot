import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Load admin pool settings from MDB Cluster settings in DB.
 * Falls back to defaults (10/2) on any error.
 */
async function loadAdminPoolSettings(
  uri: string,
): Promise<{ maxPoolSize: number; minPoolSize: number }> {
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    await client.connect();
    const doc = await client
      .db()
      .collection("mdbclustersettings")
      .findOne({ _id: "global-mdb-cluster-settings" as any });
    await client.close();

    if (doc) {
      return {
        maxPoolSize: doc.adminMaxPoolSize ?? 10,
        minPoolSize: doc.adminMinPoolSize ?? 2,
      };
    }
  } catch {
    // Settings not available — use defaults
  }
  return { maxPoolSize: 10, minPoolSize: 2 };
}

export const connectToDatabase = async () => {
  if (!MONGODB_URI) throw new Error("MONGODB_URI must be set within .env");

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = loadAdminPoolSettings(MONGODB_URI).then((pool) =>
      mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: pool.maxPoolSize,
        minPoolSize: pool.minPoolSize,
      }),
    );
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  console.log(`Connected to database ${process.env.NODE_ENV} - ${MONGODB_URI}`);

  return cached.conn;
};
