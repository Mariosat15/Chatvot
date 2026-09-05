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
 * X5: settling a provider contest - ranking scores, paying winners, closing it out.
 *
 * The point being proved is not that a payout works; the trading tests already prove that,
 * and they prove it about THE SAME CODE. X5 extracted the payout, fee, Game Master and
 * completion stages out of `finalizeCompetition` so a provider contest runs through them
 * rather than through a second copy. So what these tests establish is narrower and more
 * useful:
 *
 *   - the dispatch sends a provider contest to the provider path, and a trading contest to
 *     the trading path, and an unrecognised label to NEITHER
 *   - a participant carrying a score and no capital can be ranked and paid at all, which
 *     before X5 was impossible at two separate layers
 *   - the score is ranked in the title's direction, and STORED RAW whichever way it sorts
 *
 * Read with `competition-finalize-payout.test.ts`: that file pins the shared stages, this
 * one pins that a provider contest reaches them correctly.
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
const { resolveSettlementPath } = await import("@/lib/games/settlement");

const ENTRY_FEE = 100;
const PLATFORM_FEE_PERCENT = 20;
const START_BALANCE = 1_000;
const GAME_KEY = "provider:mock:mock-puzzle";

/** Three players with scores. Under higher_is_better: A first, B second, C third. */
const PLAYERS = [
  { id: "6500000000000000000000a1", name: "Ada", score: 900 },
  { id: "6500000000000000000000a2", name: "Bo", score: 500 },
  { id: "6500000000000000000000a3", name: "Cy", score: 100 },
];

interface SeedOptions {
  gameType?: string | null;
  gameKey?: string;
  scoreDirection?: string;
  prizeDistribution?: { rank: number; percentage: number }[];
  prizePool?: number;
}

/**
 * A finished provider contest ready to settle.
 *
 * NOTE WHAT THE PARTICIPANTS DO NOT HAVE: no `startingCapital`, no `currentCapital`, no
 * `pnl`, no `totalTrades`. That is the whole point. Before X5 this fixture could not be
 * settled, and it failed at TWO layers for the same reason - `CompetitionParticipant`
 * required three capital fields, and `ParticipantData` in the ranking service required
 * eight trading fields. Both were "additive only" changes that added `score` and left the
 * old requirements untouched.
 */
async function seedFinishedProviderContest(
  options: SeedOptions = {},
): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  const gameType = options.gameType === undefined ? "provider" : options.gameType;

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Puzzle Cup",
    slug: `puzzle-cup-${id.toString()}`,
    description: "Seeded by provider-settlement.test.ts",
    createdBy: "6500000000000000000000ff",
    ...(gameType ? { gameType } : {}),
    gameKey: options.gameKey ?? GAME_KEY,
    gameConfig: {
      providerKey: "mock",
      gameCode: "mock-puzzle",
      settings: {},
    },
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    playWindowStart: new Date(Date.now() - 2 * 60 * 60 * 1000),
    playWindowEnd: new Date(Date.now() - 60 * 1000),
    resultGracePeriodSeconds: 600,
    registrationDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "active",
    entryFee: ENTRY_FEE,
    prizePool: options.prizePool ?? PLAYERS.length * ENTRY_FEE,
    currentParticipants: PLAYERS.length,
    minParticipants: 2,
    maxParticipants: 100,
    platformFeePercentage: PLATFORM_FEE_PERCENT,
    prizeDistribution:
      options.prizeDistribution ??
      [
        { rank: 1, percentage: 60 },
        { rank: 2, percentage: 40 },
      ],
    competitionType: "time_based",
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 60 * 1000),
    createdAt: new Date(),
  });

  // THE CATALOGUE TITLE, which is where the ranking direction comes from.
  //
  // This used to be seeded as `scoreDirection` on each PARTICIPANT, and that fixture is the
  // reason a real defect stayed green for a day. `CompetitionParticipant` declares no such
  // field, so no production code path could ever write it - but these rows go in through
  // `db.collection(...).insertMany`, the **raw MongoDB driver**, which does not apply Mongoose
  // strict mode. The fixture therefore wrote a field the schema forbids, settlement read it
  // back, and the test proved a behaviour production could not reach.
  //
  // Generalises, and it is the sharpest version of a rule already recorded three times: **a
  // raw-driver fixture can prove anything, because it is not bound by the schema the
  // application writes through.** Seed through the model, or seed the thing production
  // actually reads.
  // `provider_game`, not the pluralised default: the schema sets an explicit collection name.
  // A raw-driver fixture that guesses this writes to a collection nothing reads, and the
  // symptom is identical to the value being wrong.
  await db?.collection("provider_game").insertOne({
    providerKey: "mock",
    gameCode: "mock-puzzle",
    gameKey: options.gameKey ?? GAME_KEY,
    displayName: "Mock Puzzle",
    scoreDirection: options.scoreDirection ?? "higher_is_better",
  });

  await db?.collection("competitionparticipants").insertMany(
    PLAYERS.map((p, index) => ({
      competitionId: id.toString(),
      userId: p.id,
      username: p.name,
      gameKey: options.gameKey ?? GAME_KEY,
      score: p.score,
      status: "active",
      enteredAt: new Date(Date.now() - 90 * 60 * 1000 + index * 1000),
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

async function balanceOf(userId: string): Promise<number> {
  const wallet = await mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
  return (wallet?.creditBalance as number) ?? 0;
}

async function wonBy(userId: string): Promise<number> {
  return (await balanceOf(userId)) - START_BALANCE;
}

async function readCompetition(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

async function prizeRows(competitionId: string) {
  return (
    (await mongoose.connection.db
      ?.collection("wallettransactions")
      .find({ competitionId, transactionType: "competition_win" })
      .toArray()) ?? []
  );
}

async function refundRows(competitionId: string) {
  return (
    (await mongoose.connection.db
      ?.collection("wallettransactions")
      .find({ competitionId, transactionType: "competition_refund" })
      .toArray()) ?? []
  );
}

async function participantOf(competitionId: string, userId: string) {
  return mongoose.connection.db
    ?.collection("competitionparticipants")
    .findOne({ competitionId, userId });
}

/**
 * A round that never reported, which is the only state settlement can read.
 *
 * `status: "unresolved"` is what reconciliation stage 4 writes, and it is the ONLY part of
 * the policy outcome that survives - `refundOwed` and `blocksSettlement` are return values
 * in a worker that has long since exited by the time a contest settles. A test that handed
 * settlement the outcome object would be testing something the production path can never
 * receive.
 */
async function seedUnresolvedRound(
  competitionId: string,
  userId: string,
  attemptNumber = 1,
): Promise<void> {
  await mongoose.connection.db?.collection("game_round").insertOne({
    roundId: `round-${userId}-${attemptNumber}-${competitionId.slice(-6)}`,
    providerKey: "mock",
    gameCode: "mock-puzzle",
    gameKey: GAME_KEY,
    userId,
    contestType: "competition",
    // Reason for the ObjectId: `contestId` is declared as one, and a string here would
    // match nothing while the test still looked correct - every assertion about exclusion
    // would pass for the wrong reason, because nothing would be excluded.
    contestId: new mongoose.Types.ObjectId(competitionId),
    attemptNumber,
    mode: "ranked",
    status: "unresolved",
    expiresAt: new Date(Date.now() - 30 * 60 * 1000),
    createdAt: new Date(),
  });
}

async function setPolicy(
  competitionId: string,
  policy: "score_zero" | "exclude" | "hold_and_alert",
): Promise<void> {
  await mongoose.connection.db
    ?.collection("competitions")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(competitionId) },
      { $set: { unresolvedRoundPolicy: policy } },
    );
}

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
    "gamemasterearnings",
    "gamemastersubscriptions",
    "userreferrals",
    "user",
    "marketplaceitems",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("the settlement dispatch", () => {
  it("sends a provider contest to the provider path", () => {
    const route = resolveSettlementPath("provider", "test contest");
    expect(route.path).toBe("provider");
  });

  it("still sends a trading contest to the trading path", () => {
    expect(resolveSettlementPath("trading", "test contest").path).toBe(
      "trading",
    );
  });

  it("treats an absent label as trading, per invariant 5", () => {
    // Reason: pre-X1 contests carry no label at all, and they are all trading. The
    // backfill exists for exactly this, and until it has been applied the fallback is
    // what keeps historical contests settleable.
    expect(resolveSettlementPath(undefined, "test contest").path).toBe(
      "trading",
    );
    expect(resolveSettlementPath("", "test contest").path).toBe("trading");
  });

  it("FAILS CLOSED on a label with no registered module", () => {
    // The asymmetry is deliberate. Refusing to settle leaves a contest visibly stuck and
    // somebody reports it; settling it as trading pays real credits to the wrong players
    // and cannot be undone.
    const route = resolveSettlementPath("chess", "test contest");
    expect(route.path).toBe("none");
    if (route.path === "none") {
      expect(route.reason).toBe("unknown_game");
      expect(route.error).toContain("chess");
    }
  });
});

describe("settling a provider competition", () => {
  it("ranks by score and pays the winners", async () => {
    const competitionId = await seedFinishedProviderContest();

    const result = await finalizeCompetition(competitionId);
    expect(result.success).toBe(true);

    // Pool 300, fee 20%. Rank 1 takes 60% gross = 180, less fee = 144.
    // Rank 2 takes 40% gross = 120, less fee = 96.
    expect(await wonBy(PLAYERS[0].id)).toBeCloseTo(144, 2);
    expect(await wonBy(PLAYERS[1].id)).toBeCloseTo(96, 2);
    // Third place is outside the prize distribution.
    expect(await wonBy(PLAYERS[2].id)).toBe(0);
  });

  it("settles a participant carrying NO capital fields at all", async () => {
    // The P0 this phase opened with, at both layers. If either the model's conditional
    // requirement or the ranking interface regressed, this test cannot even reach a payout.
    const competitionId = await seedFinishedProviderContest();

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(true);
    const seats = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .find({ competitionId })
      .toArray();

    for (const seat of seats ?? []) {
      expect(seat.startingCapital).toBeUndefined();
      expect(seat.status).toBe("completed");
      // The rank has to land on the row, or every win statistic on the platform reads zero.
      expect(typeof seat.currentRank).toBe("number");
    }
  });

  it("writes the final ranks in score order", async () => {
    const competitionId = await seedFinishedProviderContest();
    await finalizeCompetition(competitionId);

    const seats = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .find({ competitionId })
      .toArray();

    const rankByUser = new Map(
      (seats ?? []).map((s) => [s.userId as string, s.currentRank as number]),
    );

    expect(rankByUser.get(PLAYERS[0].id)).toBe(1);
    expect(rankByUser.get(PLAYERS[1].id)).toBe(2);
    expect(rankByUser.get(PLAYERS[2].id)).toBe(3);
  });

  it("ranks a lower_is_better title the other way round", async () => {
    // A time trial: the smallest number wins. Cy's 100 is the best result here.
    const competitionId = await seedFinishedProviderContest({
      scoreDirection: "lower_is_better",
    });

    await finalizeCompetition(competitionId);

    expect(await wonBy(PLAYERS[2].id)).toBeCloseTo(144, 2);
    expect(await wonBy(PLAYERS[1].id)).toBeCloseTo(96, 2);
    expect(await wonBy(PLAYERS[0].id)).toBe(0);
  });

  it("stores the RAW score even when the title sorts downward", async () => {
    // Reason: the ranking engine negates a lower-is-better score at the moment of
    // comparison and nothing persists the negated value. Storing -100 would show a race
    // time as negative on every screen reading the leaderboard, and poison any cross-game
    // total built from it.
    const competitionId = await seedFinishedProviderContest({
      scoreDirection: "lower_is_better",
    });

    await finalizeCompetition(competitionId);

    const competition = await readCompetition(competitionId);
    const board = (competition?.finalLeaderboard ?? []) as {
      userId: string;
      score: number;
      rank: number;
    }[];

    const winner = board.find((e) => e.rank === 1);
    expect(winner?.userId).toBe(PLAYERS[2].id);
    expect(winner?.score).toBe(100);
    for (const entry of board) {
      expect(entry.score).toBeGreaterThan(0);
    }
  });

  it("actually PERSISTS the leaderboard fields the schema used to discard", async () => {
    // Reason this exists as its own test: X5 found that `finalLeaderboard` declared only
    // trading's numeric fields, so `score`, `isTied`, `qualificationStatus` and
    // `disqualificationReason` were dropped by strict mode on every save - three of them
    // written by TRADING finalization all along. Declaring them is not evidence they store;
    // this round-trips real data through the real save, which is the only thing that is.
    const competitionId = await seedFinishedProviderContest();
    await finalizeCompetition(competitionId);

    const competition = await readCompetition(competitionId);
    const board = (competition?.finalLeaderboard ?? []) as Record<
      string,
      unknown
    >[];

    expect(board.length).toBe(PLAYERS.length);
    for (const entry of board) {
      expect(entry.qualificationStatus).toBe("qualified");
      expect(typeof entry.isTied).toBe("boolean");
      expect(typeof entry.score).toBe("number");
    }
  });

  it("records no winner PnL, because a puzzle has none", async () => {
    // Chapter 05 section 10: a figure is generalised, or explicitly scoped to one game, or
    // absent. Writing 0 here would claim we measured a profit of nothing-in-particular.
    const competitionId = await seedFinishedProviderContest();
    await finalizeCompetition(competitionId);

    const competition = await readCompetition(competitionId);
    expect(competition?.status).toBe("completed");
    expect(competition?.winnerId).toBe(PLAYERS[0].id);
    expect(competition?.winnerPnL).toBeUndefined();
  });

  it("puts the score on the winner's ledger row, not a phantom PnL", async () => {
    const competitionId = await seedFinishedProviderContest();
    await finalizeCompetition(competitionId);

    const rows = await prizeRows(competitionId);
    const winnerRow = rows.find((r) => r.userId === PLAYERS[0].id);

    expect(winnerRow).toBeTruthy();
    const metadata = winnerRow?.metadata as Record<string, unknown>;
    expect(metadata.finalScore).toBe(900);
    // Absent rather than null: a number-shaped hole reads as "we measured zero".
    expect(metadata.finalPnl).toBeUndefined();
    expect(metadata.finalCapital).toBeUndefined();
  });

  it("pays the winners once when finalized twice", async () => {
    const competitionId = await seedFinishedProviderContest();

    const first = await finalizeCompetition(competitionId);
    const second = await finalizeCompetition(competitionId);

    expect(first.success).toBe(true);
    // The optimistic lock means the second caller finds the contest no longer active.
    expect(second.success).toBe(false);

    expect(await wonBy(PLAYERS[0].id)).toBeCloseTo(144, 2);
    expect((await prizeRows(competitionId)).length).toBe(2);
  });

  it("caps a prize pool inflated beyond the fees actually collected", async () => {
    // Reason: the same integrity guard the trading path applies. A stored pool higher than
    // 3 x 100 means credits would be created out of a bug somewhere upstream.
    const competitionId = await seedFinishedProviderContest({
      prizePool: 10_000,
    });

    await finalizeCompetition(competitionId);

    // Capped to 300, so the rank-1 prize is 144 rather than 4,800.
    expect(await wonBy(PLAYERS[0].id)).toBeCloseTo(144, 2);
    const competition = await readCompetition(competitionId);
    expect(competition?.prizePool).toBe(300);
  });

  it("refuses a contest whose game has no module, leaving it untouched", async () => {
    const competitionId = await seedFinishedProviderContest({
      gameType: "chess",
    });

    const before = await readCompetition(competitionId);
    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(false);
    // Untouched: still active, nobody paid. A refusal that stranded the contest in
    // `finalizing` would be worse than the refusal itself.
    const competition = await readCompetition(competitionId);
    expect(competition?.status).toBe("active");
    // Reason this asserts a timestamp and not just the status: the X1 gate inside
    // `_finalizeCompetitionAttempt` ALSO refuses an unknown game, but only after claiming
    // the contest into `finalizing` and putting it back - so the end status is identical
    // whether the pre-lock gate exists or not, and a status-only assertion cannot tell the
    // two apart. Probing proved it: deleting the pre-lock gate left this test green.
    // `updatedAt` is the only surviving evidence that no lock was ever taken, which is what
    // stops a crash between the two writes from stranding the contest in `finalizing`.
    expect(Number(competition?.updatedAt)).toBe(Number(before?.updatedAt));
    expect(await wonBy(PLAYERS[0].id)).toBe(0);
    expect((await prizeRows(competitionId)).length).toBe(0);
  });
});

/**
 * The unresolved-round policies, which settlement is the only place that can honour.
 *
 * Chapter 07 gives a contest three answers for a round that never reports, chosen at
 * creation so that nobody decides mid-incident when the choice stops being neutral.
 * Reconciliation stage 4 writes `status: "unresolved"` and NAMES the consequence in a
 * return value - `refundOwed`, `blocksSettlement` - then deliberately stops, because both
 * consequences need to move money and re-split a pool in one transaction.
 *
 * Until this point NEITHER was consumed anywhere. `exclude` left the player ranked and
 * unrefunded, so they could be paid a prize AND be owed their fee back; `hold_and_alert`
 * settled on time and paid out while promising the opposite. Only `score_zero` worked, and
 * it worked because it asks settlement to do nothing.
 */
describe("the unresolved-round policies", () => {
  const UNRESOLVED_PLAYER = PLAYERS[1]; // Bo, who would otherwise finish second and be paid.

  describe("exclude", () => {
    async function seedExcluded(): Promise<string> {
      const competitionId = await seedFinishedProviderContest();
      await setPolicy(competitionId, "exclude");
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id);
      return competitionId;
    }

    it("returns the excluded player's entry fee", async () => {
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      expect(await balanceOf(UNRESOLVED_PLAYER.id)).toBe(
        START_BALANCE + ENTRY_FEE,
      );
    });

    it("does NOT pay them a prize as well", async () => {
      // The defect this pins is a double payment, not a missing one. `calculateRankings`
      // does not filter on participant status - it reads `status` only for the liquidation
      // rule - so marking a player `refunded` leaves them ranked and payable. Bo is seeded
      // second of three with a rank-2 prize, so a settlement that ranks them pays twice:
      // once as a refund and once as winnings.
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      const rows = await prizeRows(competitionId);
      expect(rows.some((r) => r.userId === UNRESOLVED_PLAYER.id)).toBe(false);
      // Exactly the entry fee back, no more: proves the refund landed and no prize did.
      expect(await wonBy(UNRESOLVED_PLAYER.id)).toBe(ENTRY_FEE);
    });

    it("re-splits the pool, so the remaining winners are paid from the reduced pot", async () => {
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      // Pool was 3 x 100; one fee is returned, so 200 remains. The platform takes 20%,
      // leaving 160 to distribute, and rank 1 takes 60% of it.
      const competition = await readCompetition(competitionId);
      expect(competition?.prizePool).toBe(200);
      expect(await wonBy(PLAYERS[0].id)).toBeCloseTo(96, 2);

      // And the participant count follows the pool. Reason it must: the integrity cap is
      // `currentParticipants * entryFee`, so leaving the count at 3 would leave headroom
      // for exactly the fee just handed back - the cap would stop catching its own case.
      expect(competition?.currentParticipants).toBe(2);
    });

    it("reduces the pool even when the integrity cap cannot do it for us", async () => {
      // THIS TEST EXISTS BECAUSE A PROBE STAYED GREEN. Deleting the pool reduction left the
      // suite passing, and the reason is that the integrity cap below it computes
      // `currentParticipants * entryFee` and had already been given the reduced count - so
      // it capped 300 down to 200 and produced the right answer by a completely different
      // route. The two agree only while the stored pool is at or above the fees collected.
      //
      // Seeded at 250 against 300 of collected fees, the cap has 200 of headroom and never
      // fires. The reduction must then do the work alone: 250 - 100 = 150. A settlement
      // relying on the cap pays out of 200 instead, which is 50 credits of fees that were
      // handed back to a player.
      const competitionId = await seedFinishedProviderContest({
        prizePool: 250,
      });
      await setPolicy(competitionId, "exclude");
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id);

      await finalizeCompetition(competitionId);

      expect((await readCompetition(competitionId))?.prizePool).toBe(150);
      // 150 less 20% platform fee is 120; rank 1 takes 60% of that.
      expect(await wonBy(PLAYERS[0].id)).toBeCloseTo(72, 2);
    });

    it("writes a refund row attributed to the competition", async () => {
      // Reason: an unattributable money row is the defect Stage 0 found twice, with
      // `referenceId` on entry fees and `challengeId` across the whole challenge trail.
      // Neither was a wrong balance and both were a broken audit trail.
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      const rows = await refundRows(competitionId);
      expect(rows.length).toBe(1);
      expect(rows[0].userId).toBe(UNRESOLVED_PLAYER.id);
      expect(rows[0].amount).toBe(ENTRY_FEE);
      expect(rows[0].competitionId).toBe(competitionId);
      expect(rows[0].balanceBefore).toBe(START_BALANCE);
      expect(rows[0].balanceAfter).toBe(START_BALANCE + ENTRY_FEE);
    });

    it("records the refund as a reversed spend, never as winnings", async () => {
      // Reason: a refund that increments `totalWonFromCompetitions` credits the player with
      // winnings they never earned on every stats and leaderboard screen that reads it.
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      const wallet = await mongoose.connection.db
        ?.collection("creditwallets")
        .findOne({ userId: UNRESOLVED_PLAYER.id });

      expect(wallet?.totalWonFromCompetitions).toBe(0);
      expect(wallet?.totalRefunded).toBe(ENTRY_FEE);
      expect(wallet?.totalSpentOnCompetitions).toBe(-ENTRY_FEE);
    });

    it("marks the participant refunded", async () => {
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      const participant = await participantOf(
        competitionId,
        UNRESOLVED_PLAYER.id,
      );
      expect(participant?.status).toBe("refunded");
    });

    it("refunds a player ONCE even with several unresolved rounds", async () => {
      // Reachable under `best_of_n`: one player, three attempts, none of which reported.
      // Refunding per round rather than per player pays the entry fee back three times and
      // takes three fees out of the pool.
      const competitionId = await seedFinishedProviderContest();
      await setPolicy(competitionId, "exclude");
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id, 1);
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id, 2);
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id, 3);

      await finalizeCompetition(competitionId);

      expect((await refundRows(competitionId)).length).toBe(1);
      expect(await wonBy(UNRESOLVED_PLAYER.id)).toBe(ENTRY_FEE);
      expect((await readCompetition(competitionId))?.prizePool).toBe(200);
    });

    it("does not refund twice when the contest is settled again", async () => {
      // Not a theoretical path: a run that stalls in `finalizing` is reset to `active`
      // after five minutes (R4) and the next sweep settles it for real. The transaction
      // being atomic does not help - the first run committed.
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);
      await mongoose.connection.db
        ?.collection("competitions")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(competitionId) },
          { $set: { status: "active" } },
        );
      await finalizeCompetition(competitionId);

      expect((await refundRows(competitionId)).length).toBe(1);
      expect(await wonBy(UNRESOLVED_PLAYER.id)).toBe(ENTRY_FEE);
    });

    it("leaves the other players ranked in order", async () => {
      const competitionId = await seedExcluded();

      await finalizeCompetition(competitionId);

      const competition = await readCompetition(competitionId);
      const board = (competition?.finalLeaderboard ?? []) as {
        rank: number;
        userId: string;
      }[];

      expect(board.map((e) => e.userId)).toEqual([
        PLAYERS[0].id,
        PLAYERS[2].id,
      ]);
      expect(board.map((e) => e.rank)).toEqual([1, 2]);
    });
  });

  describe("hold_and_alert", () => {
    async function seedHeld(): Promise<string> {
      const competitionId = await seedFinishedProviderContest();
      await setPolicy(competitionId, "hold_and_alert");
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id);
      return competitionId;
    }

    it("refuses to settle at all", async () => {
      const competitionId = await seedHeld();

      const result = await finalizeCompetition(competitionId);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/held/i);
    });

    it("pays nobody and leaves the contest claimable", async () => {
      // The failure mode without this is not a crash: the contest settles on time and pays
      // out, exactly as though the policy were `score_zero`, while the policy the operator
      // chose promises settlement is held until a human decides.
      const competitionId = await seedHeld();

      const before = await readCompetition(competitionId);
      await finalizeCompetition(competitionId);

      const competition = await readCompetition(competitionId);
      expect(competition?.status).toBe("active");
      // Reason for the timestamp: the gate sits BEFORE the optimistic lock, so a held
      // contest is never claimed. Checking after the claim would leave every sweep churning
      // `active -> finalizing -> active` on a contest that is deliberately parked, and the
      // end status alone cannot tell those two placements apart.
      expect(Number(competition?.updatedAt)).toBe(Number(before?.updatedAt));
      expect(await wonBy(PLAYERS[0].id)).toBe(0);
      expect((await prizeRows(competitionId)).length).toBe(0);
      expect((await refundRows(competitionId)).length).toBe(0);
    });

    it("settles normally once the round is no longer unresolved", async () => {
      // Reason this matters: the hold must be a hold, not a permanent refusal. A human
      // voiding or resolving the round has to leave the contest settleable.
      const competitionId = await seedHeld();

      expect((await finalizeCompetition(competitionId)).success).toBe(false);

      await mongoose.connection.db
        ?.collection("game_round")
        .updateMany(
          { contestId: new mongoose.Types.ObjectId(competitionId) },
          { $set: { status: "voided" } },
        );

      const result = await finalizeCompetition(competitionId);

      expect(result.success).toBe(true);
      expect(await wonBy(PLAYERS[0].id)).toBeGreaterThan(0);
    });
  });

  describe("score_zero", () => {
    it("settles on time and refunds nobody", async () => {
      // The default, and the one policy that was already correct. Pinned so the two fixes
      // above cannot start refunding or holding contests that did not ask for it.
      const competitionId = await seedFinishedProviderContest();
      await setPolicy(competitionId, "score_zero");
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id);

      const result = await finalizeCompetition(competitionId);

      expect(result.success).toBe(true);
      expect((await refundRows(competitionId)).length).toBe(0);
      expect((await readCompetition(competitionId))?.prizePool).toBe(300);
      // Bo keeps their seeded score and their rank-2 prize.
      expect(await wonBy(UNRESOLVED_PLAYER.id)).toBeGreaterThan(0);
    });

    it("is the fallback for a contest that predates the field", async () => {
      // Reason it must default this way round: an absent policy defaulting to `exclude`
      // would refund players nobody configured a refund for, and defaulting to
      // `hold_and_alert` would freeze every legacy contest the first time a round went
      // missing. Doing nothing is the only safe absent-value behaviour here - the opposite
      // instinct to a capability gate, because "closed" here means moving money.
      const competitionId = await seedFinishedProviderContest();
      await mongoose.connection.db
        ?.collection("competitions")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(competitionId) },
          { $unset: { unresolvedRoundPolicy: "" } },
        );
      await seedUnresolvedRound(competitionId, UNRESOLVED_PLAYER.id);

      const result = await finalizeCompetition(competitionId);

      expect(result.success).toBe(true);
      expect((await refundRows(competitionId)).length).toBe(0);
    });
  });
});
