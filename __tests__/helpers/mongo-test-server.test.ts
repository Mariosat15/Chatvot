/**
 * Proves the test database can do the one thing the money tests need: run a real
 * multi-document transaction that commits atomically and rolls back atomically.
 *
 * Reason: this was the blocker on Stage 0 Defect 1. Before this file existed there
 * was no way to execute a transaction in a test, so the entry-path tests could not be
 * written at all. If this file fails, no money test below it can be trusted.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "./mongo-test-server";

// Two throwaway models standing in for a wallet and a contest, so the test proves
// the *multi-document* guarantee rather than a single-document atomic update.
const WalletSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  balance: { type: Number, required: true },
});

const PotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  total: { type: Number, required: true },
});

const Wallet = mongoose.model("TxTestWallet", WalletSchema);
const Pot = mongoose.model("TxTestPot", PotSchema);

describe("test MongoDB harness", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("connects and is a replica set, not a standalone", async () => {
    expect(mongoose.connection.readyState).toBe(1);

    const admin = mongoose.connection.db?.admin();
    const status = await admin?.command({ hello: 1 });

    // A standalone has no setName; a replica set member does. This is the exact
    // difference that decides whether transactions work.
    expect(status?.setName).toBeTruthy();
  });

  it("commits a two-collection transaction atomically", async () => {
    await Wallet.create({ owner: "alice", balance: 100 });
    await Pot.create({ name: "contest", total: 0 });

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      await Wallet.updateOne(
        { owner: "alice" },
        { $inc: { balance: -25 } },
        { session },
      );
      await Pot.updateOne(
        { name: "contest" },
        { $inc: { total: 25 } },
        { session },
      );

      await session.commitTransaction();
    } finally {
      await session.endSession();
    }

    const wallet = await Wallet.findOne({ owner: "alice" }).lean();
    const pot = await Pot.findOne({ name: "contest" }).lean();

    expect(wallet?.balance).toBe(75);
    expect(pot?.total).toBe(25);
  });

  it("rolls back both writes when the transaction aborts", async () => {
    await Wallet.create({ owner: "bob", balance: 100 });
    await Pot.create({ name: "contest", total: 0 });

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      await Wallet.updateOne(
        { owner: "bob" },
        { $inc: { balance: -40 } },
        { session },
      );
      await Pot.updateOne(
        { name: "contest" },
        { $inc: { total: 40 } },
        { session },
      );

      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    const wallet = await Wallet.findOne({ owner: "bob" }).lean();
    const pot = await Pot.findOne({ name: "contest" }).lean();

    // The whole point: a debit must never survive without its matching credit.
    expect(wallet?.balance).toBe(100);
    expect(pot?.total).toBe(0);
  });

  it("leaves no data behind between tests", async () => {
    expect(await Wallet.countDocuments()).toBe(0);
    expect(await Pot.countDocuments()).toBe(0);
  });
});
