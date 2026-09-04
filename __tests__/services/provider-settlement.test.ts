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

  await db?.collection("competitionparticipants").insertMany(
    PLAYERS.map((p, index) => ({
      competitionId: id.toString(),
      userId: p.id,
      username: p.name,
      gameKey: options.gameKey ?? GAME_KEY,
      score: p.score,
      ...(options.scoreDirection
        ? { scoreDirection: options.scoreDirection }
        : {}),
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
