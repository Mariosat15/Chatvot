import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * Stage 0, Defect 1, tests 6 and 8: paying out a finished competition.
 *
 * Test 6 - every credit collected must leave the pool exactly once, as a prize or as the
 * platform fee. Nothing may be created and nothing may be stranded.
 *
 * Test 8 - finalizing twice must pay the winners once. Unlike the refund path, this one is
 * expected to PASS: finalization already takes an optimistic lock. The test exists so the
 * unified service cannot lose that lock, and so the contrast with
 * `cancelCompetitionAndRefund` - which has no such guard and does double-pay - is on record
 * as a deliberate difference rather than an accident.
 *
 * No production code is changed by this file.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionEnded: async () => {},
    notifyCompetitionWinner: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
}));

const { finalizeCompetition } = await import(
  "@/lib/actions/trading/competition-end.actions"
);

const ENTRY_FEE = 100;
const PLATFORM_FEE_PERCENT = 20;
const START_BALANCE = 1_000;
const STARTING_CAPITAL = 10_000;

/** Three players, ranked by pnl: p1 first, p2 second, p3 third. */
const PLAYERS = [
  { id: "6500000000000000000000e1", name: "Winner", pnl: 3_000 },
  { id: "6500000000000000000000e2", name: "Runner Up", pnl: 1_500 },
  { id: "6500000000000000000000e3", name: "Third", pnl: -500 },
];

/**
 * Seeds a finished competition ready to finalize.
 *
 * Deliberately has no open positions and no trade history: the position-closing half of
 * finalization is a different concern with its own failure modes, and including it here
 * would make a payout test fail for reasons that have nothing to do with payouts.
 */
async function seedFinishedCompetition(
  prizeDistribution = [
    { rank: 1, percentage: 60 },
    { rank: 2, percentage: 40 },
  ],
): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Finished Competition",
    slug: "finished-competition",
    // Reason: finalization saves the competition document, so the fixture has to satisfy
    // the whole schema even though these fields play no part in a payout. Inserting through
    // the raw driver skips validation on the way in but not on the way out.
    description: "Seeded by competition-finalize-payout.test.ts",
    createdBy: "6500000000000000000000ff",
    registrationDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "active",
    entryFee: ENTRY_FEE,
    prizePool: PLAYERS.length * ENTRY_FEE,
    currentParticipants: PLAYERS.length,
    minParticipants: 2,
    maxParticipants: 100,
    startingCapital: STARTING_CAPITAL,
    platformFeePercentage: PLATFORM_FEE_PERCENT,
    prizeDistribution,
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 60 * 1000),
    createdAt: new Date(),
  });

  await db?.collection("competitionparticipants").insertMany(
    PLAYERS.map((p, index) => ({
      competitionId: id.toString(),
      userId: p.id,
      username: p.name,
      startingCapital: STARTING_CAPITAL,
      currentCapital: STARTING_CAPITAL + p.pnl,
      pnl: p.pnl,
      pnlPercentage: (p.pnl / STARTING_CAPITAL) * 100,
      totalTrades: 10,
      winningTrades: 6,
      losingTrades: 4,
      status: "active",
      enteredAt: new Date(Date.now() - 90 * 60 * 1000 + index * 1000),
      joinedAt: new Date(Date.now() - 90 * 60 * 1000 + index * 1000),
    })),
  );

  await db?.collection("creditwallets").insertMany(
    PLAYERS.map((p) => ({
      userId: p.id,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalWonFromCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return id.toString();
}

/**
 * Gives each player one closed trade, so finalization's recompute produces a real ranking.
 *
 * Reason: finalization derives pnl from closed positions reconciled against TradeHistory
 * (lines 161-179), not from whatever is on the participant document. A position alone is not
 * enough - the realized amount is read from the matching TradeHistory row by `positionId`.
 *
 * USD-quoted symbols only. A cross pair would make finalization fetch live conversion rates
 * over the network, which has no place in a unit test.
 */
async function seedClosedTrades(competitionId: string): Promise<void> {
  const db = mongoose.connection.db;

  const openedAt = new Date(Date.now() - 80 * 60 * 1000);
  const closedAt = new Date(Date.now() - 10 * 60 * 1000);

  // Paired rather than indexed, so the position and its history row cannot drift apart.
  const trades = PLAYERS.map((player) => {
    const positionId = new mongoose.Types.ObjectId();
    const common = {
      competitionId,
      userId: player.id,
      symbol: "EUR/USD",
      side: "buy",
      quantity: 1_000,
      entryPrice: 1.1,
      exitPrice: 1.1 + player.pnl / 100_000,
      openedAt,
      closedAt,
    };
    return {
      position: { _id: positionId, status: "closed", leverage: 1, ...common },
      history: { positionId: positionId.toString(), realizedPnl: player.pnl, ...common },
    };
  });

  await db
    ?.collection("tradingpositions")
    .insertMany(trades.map((t) => t.position));
  await db
    ?.collection("tradehistories")
    .insertMany(trades.map((t) => t.history));
}

async function balanceOf(userId: string): Promise<number> {
  const wallet = await mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
  return (wallet?.creditBalance as number) ?? 0;
}

/** Total credited to players above their starting balance. */
async function totalPaidOut(): Promise<number> {
  const amounts = await Promise.all(PLAYERS.map((p) => balanceOf(p.id)));
  return amounts.reduce((sum, b) => sum + (b - START_BALANCE), 0);
}

async function prizeRows(competitionId: string) {
  return (
    (await mongoose.connection.db
      ?.collection("wallettransactions")
      .find({ competitionId, transactionType: "competition_win" })
      .toArray()) ?? []
  );
}

async function platformFeeTotal(): Promise<number> {
  const rows =
    (await mongoose.connection.db
      ?.collection("platformtransactions")
      .find({ transactionType: { $in: ["platform_fee", "unclaimed_pool"] } })
      .toArray()) ?? [];
  return rows.reduce((sum, r) => sum + ((r.amount as number) ?? 0), 0);
}

async function readCompetition(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

describe("competition finalization - payout exactness and idempotency", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "creditwallets",
      "wallettransactions",
      "platformtransactions",
      "tradingpositions",
      "tradingorders",
      "tradehistories",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("pays out every credit in the pool exactly once (test 6)", async () => {
    const competitionId = await seedFinishedCompetition();
    const pool = PLAYERS.length * ENTRY_FEE;

    const result = await finalizeCompetition(competitionId);
    expect(result.success).toBe(true);

    const paidToPlayers = await totalPaidOut();
    const fee = await platformFeeTotal();

    // The invariant: prizes plus the platform fee account for the pool, to the credit.
    // Asserted as a sum rather than per-winner because the distribution can legitimately
    // change - what may never change is that the two sides balance.
    expect(paidToPlayers + fee).toBe(pool);

    // And the split is the configured one: 20% fee on a 300 pool leaves 240 in prizes.
    expect(paidToPlayers).toBe(240);
    expect(fee).toBe(60);

    // Reason: all three players tie here, and that is correct behaviour rather than a
    // broken fixture. **Finalization recomputes every participant's stats from their
    // positions and trade history** before ranking (lines 590-610), so the pnl seeded on the
    // participant document is overwritten. This competition has no trades, so all three end
    // on zero pnl and rank 1 together.
    //
    // Worth knowing before writing any finalization fixture: seeding `pnl` on a participant
    // does not produce a ranking. Only closed positions with matching TradeHistory rows do.
    // The ranked case is the test below.
    //
    // The tie split is itself worth pinning. Rank 2's 40% goes unclaimed because nobody
    // holds rank 2, and it is shared equally among the three rank-1 winners rather than
    // being kept by the platform - so each takes a third of the 240.
    const paid = Object.fromEntries(
      await Promise.all(
        PLAYERS.map(async (p) => [p.name, (await balanceOf(p.id)) - START_BALANCE]),
      ),
    );
    expect(paid).toEqual({ Winner: 80, "Runner Up": 80, Third: 80 });

    const comp = await readCompetition(competitionId);
    expect(comp?.status).toBe("completed");
  }, 60_000);

  it("pays the configured percentages when the players are actually ranked (test 6)", async () => {
    // Reason: this is the ranked half of test 6. With one closed trade each, the recompute
    // produces distinct pnl and the configured 60/40 split applies to the top two, so the
    // arithmetic is checked against a real ordering rather than a tie.
    const competitionId = await seedFinishedCompetition();
    await seedClosedTrades(competitionId);
    const pool = PLAYERS.length * ENTRY_FEE;

    const result = await finalizeCompetition(competitionId);
    expect(result.success).toBe(true);

    const paid = Object.fromEntries(
      await Promise.all(
        PLAYERS.map(async (p) => [p.name, (await balanceOf(p.id)) - START_BALANCE]),
      ),
    );

    // 20% fee on a 300 pool leaves 240: 60% of it to first, 40% to second, nothing to third.
    expect(paid).toEqual({ Winner: 144, "Runner Up": 96, Third: 0 });
    expect((await totalPaidOut()) + (await platformFeeTotal())).toBe(pool);
  }, 60_000);

  it("leaves no dust when the split does not divide evenly", async () => {
    // Reason: prizes are floored to two decimals (`Math.floor(netPrize * 100) / 100` in
    // competition-ranking.service.ts line 428), so an awkward percentage can round each
    // winner down and leave a fraction of a credit behind. The platform fee is computed as
    // `prizePool - totalDistributed`, which means that dust lands in the fee rather than
    // vanishing - the pool still balances. This test pins that, because a "tidier" fee
    // calculation that multiplies the percentage directly would silently start losing it.
    const competitionId = await seedFinishedCompetition([
      { rank: 1, percentage: 33 },
      { rank: 2, percentage: 33 },
      { rank: 3, percentage: 34 },
    ]);
    const pool = PLAYERS.length * ENTRY_FEE;

    await finalizeCompetition(competitionId);

    const paidToPlayers = await totalPaidOut();
    const fee = await platformFeeTotal();

    expect(paidToPlayers + fee).toBe(pool);
    expect(paidToPlayers).toBeLessThanOrEqual(pool * (1 - PLATFORM_FEE_PERCENT / 100));
  }, 60_000);

  it("pays the winners once when finalized twice (test 8)", async () => {
    // Reason: this is the control for live bug 5. Finalization locks the competition from
    // "active" to "finalizing" in a single findOneAndUpdate and returns early if it loses
    // the race (competition-end.actions.ts lines 62-76). The refund path has no equivalent
    // and does double-pay, so the difference between the two is a missing guard rather than
    // an inherent property of the money layer.
    const competitionId = await seedFinishedCompetition();
    await seedClosedTrades(competitionId);

    const first = await finalizeCompetition(competitionId);
    expect(first.success).toBe(true);

    const balancesAfterFirst = await Promise.all(
      PLAYERS.map((p) => balanceOf(p.id)),
    );
    const feeAfterFirst = await platformFeeTotal();

    const second = await finalizeCompetition(competitionId);
    expect(second.success).toBe(false);

    // Nothing moved on the second pass: no balance, no fee, no extra ledger row.
    expect(await Promise.all(PLAYERS.map((p) => balanceOf(p.id)))).toEqual(
      balancesAfterFirst,
    );
    expect(await platformFeeTotal()).toBe(feeAfterFirst);
    expect(await prizeRows(competitionId)).toHaveLength(2);
  }, 60_000);

  it("refuses to finalize a competition that is not active, whatever its state", async () => {
    // Reason: the lock is `status: "active"`, so the guard is really "is this competition
    // still open". Worth pinning separately from the double-run case: it is what stops a
    // cancelled competition being paid out as though it had finished, which would pay
    // prizes on top of refunds already given.
    const competitionId = await seedFinishedCompetition();
    await mongoose.connection.db
      ?.collection("competitions")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        { $set: { status: "cancelled" } },
      );

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(await totalPaidOut()).toBe(0);
    expect(await prizeRows(competitionId)).toHaveLength(0);
  }, 60_000);
});
