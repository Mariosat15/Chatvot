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
 * The one settlement refusal that happens INSIDE the transaction, and the lock release
 * that has to follow it.
 *
 * WHY THIS IS A SEPARATE FILE. The hold-and-alert gate normally fires before the optimistic
 * lock is taken, which is what leaves a parked contest completely untouched. That makes the
 * second, in-transaction check unreachable in an ordinary test - and probing proved it:
 * disabling the lock-release path left the whole settlement suite green, because nothing in
 * it could produce a refusal after the claim.
 *
 * So this file mocks the assessment to answer differently on its two calls, which is
 * precisely the race the in-transaction check exists for: a round becomes unresolved between
 * the pre-lock read and the transaction. Deterministic here, rare in production, and
 * severe - without the release the contest sits at `finalizing` for ever, where no later
 * attempt can claim it, no sweep picks it up, and nobody is ever paid.
 *
 * The mock is the reason this cannot live in `provider-settlement.test.ts`: it would make
 * every other test in that file answer through a stub instead of the real reader.
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

/**
 * Blocks only when a session is passed, which is exactly the difference between the two
 * call sites: the pre-lock read has no session, the in-transaction one does. Asserting on
 * that rather than on a call counter keeps the test honest if the order ever changes.
 */
const assessCalls: { hadSession: boolean }[] = [];

vi.mock("@/lib/services/settlement/unresolved-rounds", () => ({
  resolveUnresolvedPolicy: (stored: string | null | undefined) =>
    stored === "exclude" || stored === "hold_and_alert" ? stored : "score_zero",
  assessUnresolvedRounds: async ({
    session,
  }: {
    session?: unknown;
  }) => {
    const hadSession = Boolean(session);
    assessCalls.push({ hadSession });

    if (!hadSession) {
      // The pre-lock read sees nothing wrong, so settlement proceeds and takes the lock.
      return {
        policy: "hold_and_alert" as const,
        unresolvedRoundCount: 0,
        excludedUserIds: [],
        blocksSettlement: false,
      };
    }

    // By the time the transaction reads it, a round has gone unresolved.
    return {
      policy: "hold_and_alert" as const,
      unresolvedRoundCount: 1,
      excludedUserIds: [],
      blocksSettlement: true,
      blockReason:
        "Settlement is held: a round became unresolved after the pre-lock check.",
    };
  },
}));

const { finalizeCompetition } = await import(
  "@/lib/actions/trading/competition-end.actions"
);

const ENTRY_FEE = 100;
const START_BALANCE = 1_000;
const GAME_KEY = "provider:mock:mock-puzzle";

const PLAYERS = [
  { id: "6500000000000000000000b1", name: "Ada", score: 900 },
  { id: "6500000000000000000000b2", name: "Bo", score: 500 },
];

async function seedContest(): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Late Hold Cup",
    slug: `late-hold-${id.toString()}`,
    description: "Seeded by provider-settlement-late-hold.test.ts",
    createdBy: "6500000000000000000000ff",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: { providerKey: "mock", gameCode: "mock-puzzle", settings: {} },
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "hold_and_alert",
    playWindowStart: new Date(Date.now() - 2 * 60 * 60 * 1000),
    playWindowEnd: new Date(Date.now() - 60 * 1000),
    resultGracePeriodSeconds: 600,
    registrationDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "active",
    entryFee: ENTRY_FEE,
    prizePool: PLAYERS.length * ENTRY_FEE,
    currentParticipants: PLAYERS.length,
    minParticipants: 2,
    maxParticipants: 100,
    platformFeePercentage: 20,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
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
      gameKey: GAME_KEY,
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
    "game_round",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
  assessCalls.length = 0;
});

describe("a hold that arrives after the contest has been claimed", () => {
  it("refuses, and RELEASES the claim so the contest can be settled later", async () => {
    const competitionId = await seedContest();

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(false);

    // Both call sites ran, which is what proves the refusal came from inside the
    // transaction rather than from the pre-lock gate.
    expect(assessCalls.map((c) => c.hadSession)).toEqual([false, true]);

    // THE ASSERTION THAT MATTERS. `finalizing` here is the permanent-stranding state: the
    // lock only admits `active`, so a contest left at `finalizing` can never be claimed
    // again by any caller, cron or human.
    const competition = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });

    expect(competition?.status).toBe("active");
  });

  it("commits nothing - no prize, no fee, no completion", async () => {
    // Reason for checking all three: the refusal happens after ranking has been computed
    // but the transaction must roll back everything, so a partially-settled contest cannot
    // exist. Prizes are the obvious one; `finalLeaderboard` is the one that would quietly
    // persist a ranking for a contest that never finished.
    const competitionId = await seedContest();

    await finalizeCompetition(competitionId);

    const db = mongoose.connection.db;
    const wallet = await db
      ?.collection("creditwallets")
      .findOne({ userId: PLAYERS[0].id });
    const competition = await db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
    const ledger =
      (await db
        ?.collection("wallettransactions")
        .find({ competitionId })
        .toArray()) ?? [];

    expect(wallet?.creditBalance).toBe(START_BALANCE);
    expect(competition?.finalLeaderboard).toBeUndefined();
    expect(competition?.winnerId).toBeUndefined();
    expect(ledger.length).toBe(0);
  });
});
