/**
 * Real in-process MongoDB for tests that cannot be written against mocks.
 *
 * Reason: every money path in the contest layer runs inside a Mongoose session
 * transaction, and MongoDB only supports multi-document transactions on a replica
 * set. A standalone mongod - which is mongodb-memory-server's default - fails those
 * tests for the wrong reason. So this helper always starts a single-node REPLICA SET.
 *
 * Use `db-mock.ts` instead when testing pure logic. Starting a server costs a few
 * seconds and should be reserved for tests that genuinely need to observe what the
 * database did.
 */
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | null = null;

/**
 * Boots a single-node replica set and connects Mongoose to it.
 * Returns the connection string, which is useful when a second client is needed.
 */
export async function startTestMongo(): Promise<string> {
  if (replSet) {
    return replSet.getUri();
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replSet.getUri();

  await mongoose.connect(uri, {
    // Reason: the driver needs a moment to elect the primary on a cold single-node
    // set; without this the first transaction can race the election and fail.
    serverSelectionTimeoutMS: 30_000,
  });

  await waitForPrimary();

  return uri;
}

/**
 * Blocks until the replica set has elected a primary and can accept a transaction.
 *
 * Reason: `mongoose.connect` resolves as soon as it can talk to the server, which on
 * a freshly created single-node set can be before the election completes. Starting a
 * session then throws "Transaction numbers are only allowed on a replica set member".
 */
async function waitForPrimary(attempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await session.abortTransaction();
        return;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `Replica set never became writable after ${attempts} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Disconnects Mongoose and shuts the server down. Safe to call when nothing started.
 */
export async function stopTestMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

/**
 * Empties every collection without tearing the server down, so each test starts
 * clean but does not pay the start-up cost again.
 */
export async function clearTestMongo(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/**
 * True when a transaction can actually be started. Lets a suite skip with a clear
 * message rather than reporting a misleading failure.
 */
export async function supportsTransactions(): Promise<boolean> {
  try {
    await waitForPrimary(1);
    return true;
  } catch {
    return false;
  }
}
