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
 * This file characterises the schema itself, which is why it is worth keeping now that the
 * defect is fixed: it is what makes the failure mode legible to the next person who writes
 * a ledger row. The end-to-end proof that the real entry path gets this right lives in
 * `competition-join-gate-parity.test.ts`.
 *
 * The defect it pinned: `enterCompetition` wrote `referenceId: competitionId` on the
 * competition_entry row, and the schema does not declare `referenceId`. It declares
 * `competitionId`, which that call never set. Mongoose strict mode drops undeclared fields
 * on create, so the reference was discarded and the row landed with no link to its
 * competition at all. No error, no warning.
 *
 * The admin mirror had the same line, so the two copies agreed - this was one bug
 * duplicated, not mirror drift, which is why the mirror guard did not catch it and could
 * not. Both are now gone: the admin copy was deleted and the main one writes
 * `competitionId` through `lib/services/contest-entry.service.ts`.
 *
 * Scope of harm, checked rather than assumed: nothing computes money from
 * WalletTransaction.competitionId. withdrawal-validator.service.ts reads competitionId from
 * CompetitionParticipant, and platform-financials.service.ts uses its own sourceId. So it
 * was a broken audit trail, not a wrong balance - but every competition entry fee taken
 * before the fix is unattributable to the competition that charged it, and no backfill is
 * possible because the value was never stored.
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

  it("loses the competition reference when written as referenceId, as the old code did", async () => {
    const competitionId = new mongoose.Types.ObjectId().toString();

    // Exactly what enterCompetition used to write.
    await WalletTransaction.create({ ...ENTRY_ROW, referenceId: competitionId });

    const raw = await mongoose.connection.db
      ?.collection("wallettransactions")
      .findOne({ userId: ENTRY_ROW.userId });

    expect(raw).toBeTruthy();
    expect(raw?.transactionType).toBe("competition_entry");
    expect(raw?.amount).toBe(-25);

    // Reason: this is the failure mode, kept as a characterisation of the schema rather
    // than of the old code. The row exists and the money on it is right, which is exactly
    // why nobody noticed - the only thing missing is the competition it belongs to.
    expect(raw).not.toHaveProperty("referenceId");
    expect(raw?.competitionId).toBeUndefined();
  });

  it("keeps the reference when written to the field the schema declares", async () => {
    const competitionId = new mongoose.Types.ObjectId().toString();

    // What the unified entry path writes.
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
