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
 * THE CUT-OFF, GRACE WINDOW AND GAME-AGNOSTIC WINNER DETERMINATION FOR PROVIDER CHALLENGES.
 *
 * Mirrors `provider-round-cutoff.test.ts` exactly, one contest shape along: a 1v1
 * `Challenge` instead of a many-player `Competition`. `Challenge` declares neither
 * `resultGracePeriodSeconds` nor `unresolvedRoundPolicy` (see the file header on
 * `provider-challenge-finalize.ts`), so this suite pins that both gates still run and
 * both resolve to their permissive defaults - the grace WAIT still matters even though the
 * HOLD gate can never fire for a two-player contest.
 *
 * The fixture seeds real `game_round` documents for the same reason the competition suite
 * does: every pre-existing settlement test seeds a `score` directly on the participant and
 * never a round, so there was never anything for a cut-off to be measured against.
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
    send: async () => {},
    notifyCompetitionEnded: async () => {},
    notifyCompetitionWinner: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
}));

const { finalizeProviderChallenge } = await import(
  "@/lib/services/settlement/provider-challenge-finalize"
);
const { finalizeChallenge } = await import(
  "@/lib/actions/trading/challenge-finalize.actions"
);

/**
 * Resolved through a variable, deliberately - same machinery as
 * `admin-finalize-gamemaster-parity.test.ts`. A literal specifier would pull the admin
 * action into the MAIN app's `tsc` program, where its `@/lib/services/notification.service`
 * resolves to the root copy whose method signatures differ from admin's. `@vite-ignore`
 * plus a variable specifier keeps TypeScript from following it while the runtime import is
 * unchanged. Step 17 added the dispatch this exercises; without this test, removing
 * `route.path === "provider"` from admin's copy would leave the whole suite green.
 */
const ADMIN_CHALLENGE_FINALIZE_MODULE =
  "../../apps/admin/lib/actions/trading/challenge-finalize.actions";
const { finalizeChallenge: finalizeChallengeInAdminApp } = (await import(
  /* @vite-ignore */ ADMIN_CHALLENGE_FINALIZE_MODULE
)) as {
  finalizeChallenge: (
    challengeId: string,
  ) => Promise<{ success: boolean; winnerId?: string | null; error?: string }>;
};

const ENTRY_FEE = 100;
const START_BALANCE = 1_000;
const GAME_KEY = "provider:mock:mock-puzzle";
const GRACE_SECONDS = 600;

/** Ada finished and has a score; Bo was still playing when the clock ran out. */
const CHALLENGER = { id: "6500000000000000000000e1", name: "Ada", score: 900 };
const CHALLENGED = { id: "6500000000000000000000e2", name: "Bo", score: 300 };

interface SeedOptions {
  /** How long ago play closed. The grace window is measured from here. */
  playClosedSecondsAgo: number;
  /** Status of the round belonging to the player who did not finish. Set to `"completed"`
   *  (with `challengedScored: true`) to test the no-live-rounds path. */
  unfinishedRoundStatus?: "pending" | "launched" | "abandoned" | "completed";
  /** Whether Bo (the "challenged" role) already has a recorded score. */
  challengedScored?: boolean;
  status?: string;
  gameType?: string;
}

async function seedChallenge(options: SeedOptions): Promise<string> {
  const {
    playClosedSecondsAgo,
    unfinishedRoundStatus = "launched",
    challengedScored = false,
    status = "active",
    gameType = "provider",
  } = options;

  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;
  const endTime = new Date(Date.now() - playClosedSecondsAgo * 1000);

  await db?.collection("challenges").insertOne({
    _id: id,
    slug: `challenge-${id.toString()}`,
    gameType,
    gameKey: gameType === "provider" ? GAME_KEY : gameType,
    gameConfig:
      gameType === "provider"
        ? { providerKey: "mock", gameCode: "mock-puzzle", settings: {} }
        : undefined,
    attemptsPolicy: "single",
    challengerId: CHALLENGER.id,
    challengerName: CHALLENGER.name,
    challengerEmail: "ada@example.com",
    challengedId: CHALLENGED.id,
    challengedName: CHALLENGED.name,
    challengedEmail: "bo@example.com",
    entryFee: ENTRY_FEE,
    prizePool: 2 * ENTRY_FEE,
    platformFeePercentage: 20,
    platformFeeAmount: 40,
    winnerPrize: 160,
    acceptDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime,
    duration: 60,
    status,
    assetClasses: [],
    allowedSymbols: [],
    blockedSymbols: [],
    leverage: { enabled: false, min: 1, max: 10 },
    rules: {
      rankingMethod: "pnl",
      tieBreaker1: "trades_count",
      minimumTrades: 1,
      disqualifyOnLiquidation: true,
    },
    maxPositionSize: 50,
    maxOpenPositions: 10,
    allowShortSelling: false,
    marginCallThreshold: 100,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });

  const baseParticipant = {
    challengeId: id.toString(),
    gameKey: gameType === "provider" ? GAME_KEY : gameType,
    usedMargin: 0,
    pnl: 0,
    pnlPercentage: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    currentOpenPositions: 0,
    maxDrawdown: 0,
    maxDrawdownPercentage: 0,
    marginCallWarnings: 0,
    isWinner: false,
    prizeReceived: 0,
    joinedAt: new Date(Date.now() - 90 * 60 * 1000),
  };

  await db?.collection("challengeparticipants").insertMany([
    {
      ...baseParticipant,
      userId: CHALLENGER.id,
      username: CHALLENGER.name,
      email: "ada@example.com",
      role: "challenger",
      status: "active",
      // Ada finished, so she has a score. Absent means no result - never a stored zero.
      ...(gameType === "provider" ? { score: CHALLENGER.score } : {}),
    },
    {
      ...baseParticipant,
      userId: CHALLENGED.id,
      username: CHALLENGED.name,
      email: "bo@example.com",
      role: "challenged",
      status: "active",
      // NO `score` FIELD AT ALL unless the scenario says Bo already finished too - the same
      // distinction `provider-round-cutoff.test.ts` pins: a stored value and an absent one
      // are different facts.
      ...(gameType === "provider" && challengedScored
        ? { score: CHALLENGED.score }
        : {}),
    },
  ]);

  if (gameType === "provider") {
    await db?.collection("game_round").insertMany([
      {
        roundId: `round-challenger-${id.toString()}`,
        providerKey: "mock",
        gameCode: "mock-puzzle",
        gameKey: GAME_KEY,
        userId: CHALLENGER.id,
        contestType: "challenge",
        contestId: id,
        attemptNumber: 1,
        mode: "ranked",
        status: "completed",
        rawScore: CHALLENGER.score,
        expiresAt: endTime,
        createdAt: new Date(),
      },
      {
        roundId: `round-challenged-${id.toString()}`,
        providerKey: "mock",
        gameCode: "mock-puzzle",
        gameKey: GAME_KEY,
        userId: CHALLENGED.id,
        contestType: "challenge",
        contestId: id,
        attemptNumber: 1,
        mode: "ranked",
        status: unfinishedRoundStatus,
        ...(unfinishedRoundStatus === "completed"
          ? { rawScore: CHALLENGED.score }
          : {}),
        expiresAt: endTime,
        createdAt: new Date(),
      },
    ]);
  }

  await db?.collection("creditwallets").insertMany(
    [CHALLENGER.id, CHALLENGED.id].map((userId) => ({
      userId,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalWonFromCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return id.toString();
}

async function readChallenge(challengeId: string) {
  return mongoose.connection.db
    ?.collection("challenges")
    .findOne({ _id: new mongoose.Types.ObjectId(challengeId) });
}

async function readParticipant(challengeId: string, userId: string) {
  return mongoose.connection.db
    ?.collection("challengeparticipants")
    .findOne({ challengeId, userId });
}

async function readRound(roundId: string) {
  return mongoose.connection.db?.collection("game_round").findOne({ roundId });
}

async function readWallet(userId: string) {
  return mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
}

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "challenges",
    "challengeparticipants",
    "challengesettings",
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
    "provider_game",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("provider challenge settlement waits out the result grace window", () => {
  it("defers, leaving the challenge untouched, while a round could still report", async () => {
    // Play closed a minute ago and the grace window is ten minutes, so a provider may
    // still post Bo's result.
    const challengeId = await seedChallenge({ playClosedSecondsAgo: 60 });

    const result = await finalizeProviderChallenge(challengeId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/still open when play closed/i);

    // THE ASSERTION THAT MATTERS IS THAT NOTHING WAS WRITTEN, not that it refused - same
    // reasoning as the competition suite: the gate sits before the optimistic claim so a
    // challenge merely waiting is never moved to "finalizing".
    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("active");
    expect(challenge?.winnerId).toBeUndefined();
    expect(challenge?.updatedAt).toBeUndefined();

    const wallet = await readWallet(CHALLENGER.id);
    expect(wallet?.creditBalance).toBe(START_BALANCE);

    // The round is left exactly as it was - the deferral must not pre-emptively close it.
    const open = await readRound(`round-challenged-${challengeId}`);
    expect(open?.status).toBe("launched");
  });

  it("settles once the grace window has expired, marking the silent round UNRESOLVED", async () => {
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: GRACE_SECONDS + 60,
    });

    const result = await finalizeProviderChallenge(challengeId);

    expect(result.success).toBe(true);
    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.isTie).toBe(false);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
    expect(challenge?.winnerId).toBe(CHALLENGER.id);

    // Bo never reported a result, so `providerHasResult` refuses an absent score and Bo is
    // disqualified rather than tied on a phantom zero (R50's challenge half). The permanent
    // record of that lives in `challengedFinalStats.isDisqualified` / the reason - the
    // participant's own `.status` moves on to "completed" once settlement decides only one
    // side was disqualified, exactly as `challenge-settlement.service.ts`'s own file comment
    // says: "every other outcome ... moves both participants to completed."
    const bo = await readParticipant(challengeId, CHALLENGED.id);
    expect(bo?.status).toBe("completed");
    expect(bo?.disqualificationReason).toBe("No score recorded");
    expect(bo?.isWinner).toBe(false);

    const challengeAfterBo = await readChallenge(challengeId);
    expect(challengeAfterBo?.challengedFinalStats?.isDisqualified).toBe(true);
    expect(challengeAfterBo?.challengedFinalStats?.disqualificationReason).toBe(
      "No score recorded",
    );

    // Ada is paid the stored `winnerPrize` - never recomputed at settlement time.
    const wallet = await readWallet(CHALLENGER.id);
    expect(wallet?.creditBalance).toBe(START_BALANCE + 160);

    const boWallet = await readWallet(CHALLENGED.id);
    expect(boWallet?.creditBalance).toBe(START_BALANCE);

    // THE STATUS IS THE WHOLE DECISION - `unresolved`, never `voided`, matching the
    // competition suite's own pinning of this fact.
    const open = await readRound(`round-challenged-${challengeId}`);
    expect(open?.status).toBe("unresolved");
    expect(open?.resultSource).toBeUndefined();

    // A round that already reported is not touched.
    const finished = await readRound(`round-challenger-${challengeId}`);
    expect(finished?.status).toBe("completed");
    expect(finished?.rawScore).toBe(CHALLENGER.score);
  });

  it("does not defer a challenge whose rounds have all reported, however long ago it ended", async () => {
    // Both players finished, so there is nothing left to wait for - settling one second
    // after the cut-off must not be held up for ten minutes.
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      unfinishedRoundStatus: "completed",
      challengedScored: true,
    });

    const result = await finalizeProviderChallenge(challengeId);

    expect(result.success).toBe(true);
    expect(result.winnerId).toBe(CHALLENGER.id);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");

    const wallet = await readWallet(CHALLENGER.id);
    expect(wallet?.creditBalance).toBe(START_BALANCE + 160);
  });
});

describe("provider challenge settlement guards", () => {
  it("refuses a challenge that is not active, leaving it untouched", async () => {
    // No live round, or the cut-off gate (which runs before the status check) would defer
    // rather than reach the "not active" refusal this test is aimed at.
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      unfinishedRoundStatus: "completed",
      challengedScored: true,
      status: "completed",
    });

    const result = await finalizeProviderChallenge(challengeId);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Challenge is not active");

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
  });

  it("refuses to settle a challenge whose endTime has not yet passed, even with no live rounds", async () => {
    // `assessRoundCutoff` only looks at LIVE rounds - it has no opinion about whether `now`
    // is before `playWindowEnd` - so with both rounds already completed there is nothing for
    // the cut-off gate above the lock to defer on. The LOCK's own `endTime` clause (see the
    // comment beside the `findOneAndUpdate` in `provider-challenge-finalize.ts`) is the only
    // thing standing between this call and settling a challenge that has not actually ended,
    // mirroring the trading attempt function's own gate. `playClosedSecondsAgo` negative
    // means `endTime` is in the future.
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: -3600,
      unfinishedRoundStatus: "completed",
      challengedScored: true,
    });

    const result = await finalizeProviderChallenge(challengeId);

    expect(result.success).toBe(false);

    // THE ASSERTION THAT MATTERS IS THAT NOTHING WAS WRITTEN - the lock query never matched,
    // so status stays "active" and the document is never touched, same reasoning as the
    // grace-window deferral above.
    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("active");
    expect(challenge?.winnerId).toBeUndefined();
    expect(challenge?.updatedAt).toBeUndefined();
  });
});

describe("finalizeChallenge dispatches by gameType (X1 seam 3, extended to challenges)", () => {
  it("routes a provider challenge to finalizeProviderChallenge rather than the trading path", async () => {
    // No live rounds, so this settles immediately - the point of the test is which FUNCTION
    // ran, not the grace window, which the suite above already covers.
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      unfinishedRoundStatus: "completed",
      challengedScored: true,
    });

    const result = (await finalizeChallenge(challengeId)) as {
      success: boolean;
      winnerId?: string | null;
    };

    // The trading path would have thrown or produced a different result shape (it reads
    // `TradingPosition` and `pnl`, neither of which this fixture seeds) - a correct
    // dispatch is the only way this succeeds at all.
    expect(result.success).toBe(true);
    expect(result.winnerId).toBe(CHALLENGER.id);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
  });

  it("refuses an unrecognised game type with no settlement path, leaving the challenge untouched", async () => {
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      gameType: "chess",
    });

    const result = (await finalizeChallenge(challengeId)) as {
      success: boolean;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    // A refusal before the lock must not touch the document at all.
    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("active");
    expect(challenge?.updatedAt).toBeUndefined();
  });
});

describe("the ADMIN APP's finalizeChallenge dispatches identically (step 17, R42's shape one contest kind along)", () => {
  it("routes a provider challenge to finalizeProviderChallenge from the admin cron's entry point", async () => {
    // Same fixture shape as the main-app dispatch test above - no live rounds, so this
    // settles immediately and the only question is which function ran.
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      unfinishedRoundStatus: "completed",
      challengedScored: true,
    });

    const result = await finalizeChallengeInAdminApp(challengeId);

    // The trading path reads `TradingPosition` and `pnl`, neither of which this fixture
    // seeds, so a correct dispatch is the only way this succeeds at all - same reasoning as
    // the main-app test, run against admin's own copy of the dispatch guard.
    expect(result.success).toBe(true);
    expect(result.winnerId).toBe(CHALLENGER.id);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
  });

  it("refuses an unrecognised game type with no settlement path, leaving the challenge untouched", async () => {
    const challengeId = await seedChallenge({
      playClosedSecondsAgo: 1,
      gameType: "chess",
    });

    const result = await finalizeChallengeInAdminApp(challengeId);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("active");
    expect(challenge?.updatedAt).toBeUndefined();
  });
});
