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
 * Creates the named collections up front, if they do not already exist.
 *
 * Call this in `beforeAll`, listing every collection the code under test will write to.
 *
 * Reason: MongoDB cannot create a collection inside a multi-document transaction on a
 * single-node replica set - the attempt fails with "Unable to write to collection ... due
 * to catalog changes; please retry the operation". The first test to write a given
 * collection therefore fails, and every later one passes, which reads exactly like a
 * concurrency or ordering bug in the application. It is neither; it is a property of the
 * test server.
 *
 * This mattered concretely: without it, a 20-way concurrent join test reported that only
 * one join in twenty succeeded, and the obvious conclusion - that the entry path cannot
 * handle contention - would have been recorded as a production finding. Most of those
 * failures were this. Pre-create the collections before drawing any conclusion about
 * contention.
 */
export async function ensureCollections(names: string[]): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("ensureCollections called before startTestMongo");

  const existing = new Set((await db.collections()).map((c) => c.collectionName));
  await Promise.all(
    names
      .filter((name) => !existing.has(name))
      .map((name) => db.createCollection(name)),
  );
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
