import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  reserveFreePrivateFunds,
  sponsorFreePrivateSeat,
} from "@/lib/services/gamemaster/free-private-reserve";
import {
  creditFundedRemainderToGameMaster,
  fundedGameMasterOf,
  refundFundedContestToGameMaster,
  refundFundedExcludedSeats,
  releaseFundedReserveAtSettlement,
} from "@/lib/services/settlement/free-private-refund";

/**
 * The owner's refund table for Free Private (Game Master funded) contests, against a real
 * MongoDB, because every claim here is about what is STORED: which wallet moved, by how much,
 * and that a retried call moves nothing.
 *
 * Raw driver throughout, exactly as the code under test, so no model's defaults or strict
 * mode can make a wrong write look right.
 */

const GM = "64b000000000000000000001";
const P1 = "64b000000000000000000011";
const P2 = "64b000000000000000000012";
const P3 = "64b000000000000000000013";
const FEE = 10;
const PLACES = 4;

const db = () => mongoose.connection.db!;
const wallet = async (userId: string) =>
  db().collection("creditwallets").findOne({ userId });
const ledger = (filter: Record<string, unknown> = {}) =>
  db().collection("wallettransactions").find(filter).toArray();

async function inTransaction<T>(fn: (s: mongoose.mongo.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

async function seedFundedContest(gmBalance = 100) {
  await db().collection("creditwallets").insertMany([
    { userId: GM, creditBalance: gmBalance, reservedBalance: 0 },
    { userId: P1, creditBalance: 3 },
    { userId: P2, creditBalance: 0 },
    { userId: P3, creditBalance: 0 },
  ]);
  const { insertedId } = await db().collection("competitions").insertOne({
    name: "Funded Cup",
    fundingMode: "gm_funded",
    entryFee: FEE,
    maxParticipants: PLACES,
  });
  return insertedId.toString();
}

async function contest(id: string) {
  return db().collection("competitions").findOne({ _id: new mongoose.mongo.ObjectId(id) });
}

async function reserveAndSeat(competitionId: string, players: string[]) {
  await inTransaction(async (session) => {
    const r = await reserveFreePrivateFunds(
      db(),
      { competitionId, competitionName: "Funded Cup", gameMasterUserId: GM, entryFee: FEE, maxParticipants: PLACES },
      session,
    );
    expect(r.ok).toBe(true);
    for (const userId of players) {
      const s = await sponsorFreePrivateSeat(
        db(),
        { competitionId, competitionName: "Funded Cup", userId, entryFee: FEE },
        session,
      );
      expect(s.ok).toBe(true);
    }
  });
}

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections(["creditwallets", "wallettransactions", "competitions"]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("reserve at creation", () => {
  it("moves entryFee x places from spendable into reserved and stamps the contest", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, []);
    expect(await wallet(GM)).toMatchObject({ creditBalance: 60, reservedBalance: 40 });
    expect((await contest(id))?.freePrivate).toMatchObject({
      gameMasterUserId: GM,
      reserveTotal: 40,
      reserveRemaining: 40,
      sponsoredCount: 0,
    });
  });

  it("refuses with no write when the Game Master cannot cover every place", async () => {
    const id = await seedFundedContest(39);
    const r = await reserveFreePrivateFunds(db(), {
      competitionId: id,
      competitionName: "Funded Cup",
      gameMasterUserId: GM,
      entryFee: FEE,
      maxParticipants: PLACES,
    });
    expect(r).toMatchObject({ ok: false, reason: "insufficient_balance", required: 40, available: 39 });
    expect(await wallet(GM)).toMatchObject({ creditBalance: 39, reservedBalance: 0 });
    expect(await ledger()).toHaveLength(0);
    expect((await contest(id))?.freePrivate).toBeUndefined();
  });
});

describe("sponsored entry", () => {
  it("draws the seat from the reserve and never changes the player's balance", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2]);
    expect(await wallet(P1)).toMatchObject({ creditBalance: 3 });
    expect(await wallet(P2)).toMatchObject({ creditBalance: 0 });
    expect(await wallet(GM)).toMatchObject({ creditBalance: 60, reservedBalance: 20 });
    expect((await contest(id))?.freePrivate).toMatchObject({ reserveRemaining: 20, sponsoredCount: 2 });
    const rows = await ledger({ userId: P1 });
    expect(rows.map((r) => [r.transactionType, r.amount, r.balanceBefore, r.balanceAfter])).toEqual([
      ["free_private_entry_sponsor", 10, 3, 3],
      ["free_private_entry_payment", -10, 3, 3],
    ]);
  });

  it("refuses a seat once the reserve is exhausted", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2, P3, "64b000000000000000000014"]);
    const r = await sponsorFreePrivateSeat(db(), {
      competitionId: id,
      competitionName: "Funded Cup",
      userId: "64b000000000000000000015",
      entryFee: FEE,
    });
    expect(r).toMatchObject({ ok: false, reason: "reserve_exhausted" });
    expect((await contest(id))?.freePrivate?.reserveRemaining).toBe(0);
  });
});

describe("refund table", () => {
  it("normal finish: only the unused reserve returns, once", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2]);
    const c = (await contest(id))!;
    const first = await inTransaction((session) =>
      releaseFundedReserveAtSettlement({ session, contest: c, noWinners: false }),
    );
    const again = await inTransaction((session) =>
      releaseFundedReserveAtSettlement({ session, contest: c, noWinners: false }),
    );
    expect([first, again]).toEqual([20, 0]);
    expect(await wallet(GM)).toMatchObject({ creditBalance: 80, reservedBalance: 0 });
    expect((await contest(id))?.freePrivate?.outcome).toBe("settled");
  });

  it("all disqualified: the pot after the fee goes to the Game Master, not the players", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2]);
    const c = (await contest(id))!;
    await inTransaction(async (session) => {
      await creditFundedRemainderToGameMaster({ session, contest: c, amount: 18, reason: "all disqualified" });
      await releaseFundedReserveAtSettlement({ session, contest: c, noWinners: true });
    });
    const retried = await inTransaction((session) =>
      creditFundedRemainderToGameMaster({ session, contest: c, amount: 18, reason: "all disqualified" }),
    );
    expect(retried).toBe(0);
    expect(await wallet(GM)).toMatchObject({ creditBalance: 98, reservedBalance: 0 });
    expect(await wallet(P1)).toMatchObject({ creditBalance: 3 });
    expect((await contest(id))?.freePrivate?.outcome).toBe("all_disqualified");
  });

  it("cancel / too few players: every seat at full fee plus the reserve, no player refund", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2]);
    const c = (await contest(id))!;
    const result = await inTransaction((session) =>
      refundFundedContestToGameMaster({
        session,
        contest: c,
        sponsoredUserIds: [P1, P2],
        outcome: "cancelled",
        reason: "too few players",
      }),
    );
    expect(result).toEqual({
      gameMasterUserId: GM,
      refundedSeatUserIds: [P1, P2],
      seatsRefunded: 20,
      reserveReleased: 20,
    });
    expect(await wallet(GM)).toMatchObject({ creditBalance: 100, reservedBalance: 0 });
    expect(await ledger({ transactionType: "competition_refund" })).toHaveLength(0);
    expect(await wallet(P1)).toMatchObject({ creditBalance: 3 });
  });

  it("a retried cancel moves nothing", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1]);
    const c = (await contest(id))!;
    const run = () =>
      inTransaction((session) =>
        refundFundedContestToGameMaster({
          session,
          contest: c,
          sponsoredUserIds: [P1],
          outcome: "technical_fault",
          reason: "platform fault",
        }),
      );
    await run();
    const second = await run();
    expect(second).toMatchObject({ seatsRefunded: 0, reserveReleased: 0 });
    expect(await wallet(GM)).toMatchObject({ creditBalance: 100 });
    expect((await contest(id))?.freePrivate?.outcome).toBe("technical_fault");
  });

  it("an excluded seat is not refunded twice when the contest is later cancelled", async () => {
    const id = await seedFundedContest();
    await reserveAndSeat(id, [P1, P2]);
    const c = (await contest(id))!;
    const excluded = await inTransaction((session) =>
      refundFundedExcludedSeats({ session, contest: c, userIds: [P1] }),
    );
    expect(excluded).toEqual({ refundedUserIds: [P1], totalRefunded: 10 });
    const cancel = await inTransaction((session) =>
      refundFundedContestToGameMaster({
        session,
        contest: c,
        sponsoredUserIds: [P1, P2],
        outcome: "cancelled",
        reason: "cancelled",
      }),
    );
    expect(cancel?.refundedSeatUserIds).toEqual([P2]);
    expect(await wallet(GM)).toMatchObject({ creditBalance: 100, reservedBalance: 0 });
  });
});

describe("player-paid contests are untouched", () => {
  it("fundedGameMasterOf is null and every helper is a no-op", async () => {
    const { insertedId } = await db()
      .collection("competitions")
      .insertOne({ name: "Paid Cup", entryFee: FEE, freePrivate: { gameMasterUserId: GM } });
    const c = (await db().collection("competitions").findOne({ _id: insertedId }))!;
    expect(fundedGameMasterOf(c)).toBeNull();
    const out = await inTransaction(async (session) => [
      await refundFundedContestToGameMaster({
        session,
        contest: c,
        sponsoredUserIds: [P1],
        outcome: "cancelled",
        reason: "x",
      }),
      await creditFundedRemainderToGameMaster({ session, contest: c, amount: 5, reason: "x" }),
      await releaseFundedReserveAtSettlement({ session, contest: c, noWinners: true }),
    ]);
    expect(out).toEqual([null, 0, 0]);
    expect(await ledger()).toHaveLength(0);
  });
});
