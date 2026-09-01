import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

/**
 * Stage 0, Defect 1, test 9: "Entry fee ledger row carries a resolvable competition
 * reference in a field the schema defines."
 *
 * This file pins the defect in place BEFORE the entry paths are unified, so the fix has
 * something to prove itself against. It touches no production code.
 *
 * The defect: lib/actions/trading/competition.actions.ts line 548 writes
 * `referenceId: competitionId` on the competition_entry row, and the schema does not
 * declare `referenceId`. It declares `competitionId`, which that call never sets. Because
 * Mongoose strict mode drops undeclared fields on create, the reference is discarded and
 * the row lands with no link to its competition at all.
 *
 * The admin mirror has the same line at apps/admin/lib/actions/trading/
 * competition.actions.ts:610, so the two copies agree - this is one bug, not drift.
 *
 * Scope of harm, checked rather than assumed: nothing computes money from
 * WalletTransaction.competitionId today. withdrawal-validator.service.ts reads
 * competitionId from CompetitionParticipant, and platform-financials.service.ts uses its
 * own sourceId. So this is a broken audit trail, not a wrong balance - every competition
 * entry fee in the ledger is unattributable to the competition that charged it.
 */

const ENTRY_ROW = {
  userId: "user-under-test",
  transactionType: "competition_entry" as const,
  amount: -25,
  balanceBefore: 100,
  balanceAfter: 75,
  currency: "CREDITS",
  status: "completed" as const,
  description: "Entry fee for Test Competition",
};

describe("competition entry fee ledger row", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("loses the competition reference when written as referenceId, as production does today", async () => {
    const competitionId = new mongoose.Types.ObjectId().toString();

    // Exactly what competition.actions.ts:548 writes.
    await WalletTransaction.create({ ...ENTRY_ROW, referenceId: competitionId });

    const raw = await mongoose.connection.db
      ?.collection("wallettransactions")
      .findOne({ userId: ENTRY_ROW.userId });

    expect(raw).toBeTruthy();
    expect(raw?.transactionType).toBe("competition_entry");
    expect(raw?.amount).toBe(-25);

    // Reason: this is the defect, asserted so it cannot be fixed by accident and so the
    // fix has a failing-to-passing signal. The row exists and the money is right, but
    // the competition it belongs to is nowhere on it.
    expect(raw).not.toHaveProperty("referenceId");
    expect(raw?.competitionId).toBeUndefined();
  });

  it("keeps the reference when written to the field the schema declares", async () => {
    const competitionId = new mongoose.Types.ObjectId().toString();

    // What the unified entry path must write instead.
    await WalletTransaction.create({ ...ENTRY_ROW, competitionId });

    const raw = await mongoose.connection.db
      ?.collection("wallettransactions")
      .findOne({ userId: ENTRY_ROW.userId });

    expect(raw?.competitionId).toBe(competitionId);
  });

  it("can be found by competition once the reference is on the declared field", async () => {
    const wanted = new mongoose.Types.ObjectId().toString();
    const other = new mongoose.Types.ObjectId().toString();

    await WalletTransaction.create([
      { ...ENTRY_ROW, userId: "player-a", competitionId: wanted },
      { ...ENTRY_ROW, userId: "player-b", competitionId: wanted },
      { ...ENTRY_ROW, userId: "player-c", competitionId: other },
    ]);

    // Reason: the query the audit trail needs and cannot currently answer - "which
    // entry fees did this competition collect?". Proving the query works is the point;
    // asserting the field is set is not the same thing.
    const rows = await WalletTransaction.find({
      competitionId: wanted,
      transactionType: "competition_entry",
    }).lean();

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.userId).sort()).toEqual(["player-a", "player-b"]);
  });

  it("still refuses a transactionType the schema does not list", async () => {
    // Reason: guards the fix. Adding competitionId to these writes must not be done by
    // loosening the schema, which would let a typo'd transaction type through and
    // corrupt every total that groups by it.
    await expect(
      WalletTransaction.create({
        ...ENTRY_ROW,
        transactionType: "competition_entrance" as never,
      }),
    ).rejects.toThrow(/validation failed/i);
  });
});
