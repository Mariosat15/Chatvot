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
 * RANKING, TIE-BREAKING, DISQUALIFICATION AND THE MONEY, FOR BOTH GAMES.
 *
 * This suite calls `settleChallenge()` DIRECTLY rather than going through either
 * finalization path, and that is the deliverable rather than a shortcut:
 *
 * - `finalizeChallenge` (trading) RECOMPUTES `pnl` and `totalTrades` from `TradingPosition`
 *   and `TradeHistory` before ranking, so a seeded `pnl` is overwritten with zero, both
 *   players tie at rank 1, and the equal payout reads as a prize-distribution bug. Seeding
 *   closed positions and matching history rows instead would test the recompute, not the
 *   ranking.
 * - `finalizeProviderChallenge` reads `tiePrizeDistribution` off `ChallengeSettings`, a
 *   singleton, so the three tie policies could only be exercised by rewriting one global
 *   document between cases. `settleChallenge` takes the policy as a parameter.
 *
 * `provider-challenge-finalize.ts` already covers the cut-off, the grace window and the
 * optimistic lock, so nothing here re-tests those.
 *
 * The fixture seeds with the raw driver and then RE-HYDRATES through the models inside the
 * session, because `settleChallenge` calls `.save({ session })` on all three documents -
 * so the seed must satisfy every required path on both schemas, not merely the fields a
 * given assertion reads. That is the fixture rule this codebase has now learned three
 * times: Mongoose validates the document, not the subset you care about.
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

const { settleChallenge } = await import(
  "@/lib/services/settlement/challenge-settlement.service"
);
const { default: Challenge } = await import(
  "@/database/models/trading/challenge.model"
);
const { default: ChallengeParticipant } = await import(
  "@/database/models/trading/challenge-participant.model"
);
const { default: ProviderGame } = await import(
  "@/database/models/games/provider-game.model"
);

const ENTRY_FEE = 100;
const PRIZE_POOL = 2 * ENTRY_FEE;
const PLATFORM_FEE_PERCENTAGE = 20;
/** 200 pool less the 20% platform fee. The single winner takes all of it. */
const WINNER_PRIZE = 160;
const PLATFORM_FEE = 40;
const START_BALANCE = 1_000;
const START_CAPITAL = 10_000;
const GAME_KEY = "provider:mock:mock-puzzle";

/**
 * ObjectId-SHAPED, not readable labels. The fraud models declare `Schema.Types.ObjectId`
 * for `userId`, and a `CastError` there is caught and logged by the paths under test - the
 * test then passes while a whole branch never runs.
 */
const CHALLENGER = { id: "6500000000000000000000e1", name: "Ada" };
const CHALLENGED = { id: "6500000000000000000000e2", name: "Bo" };

interface ParticipantSeed {
  /** Provider score. ABSENT means no result has arrived - never seed a zero to mean this. */
  score?: number;
  pnl?: number;
  pnlPercentage?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  winRate?: number;
  currentCapital?: number;
  status?: string;
  /** Earlier wins the `join_time` tiebreaker. */
  joinedMinutesAgo?: number;
}

interface SeedOptions {
  gameType?: "trading" | "provider";
  rankingMethod?: string;
  tieBreaker1?: string;
  tieBreaker2?: string;
  minimumTrades?: number;
  disqualifyOnLiquidation?: boolean;
  challenger?: ParticipantSeed;
  challenged?: ParticipantSeed;
}

async function seedChallenge(options: SeedOptions = {}): Promise<string> {
  const {
    gameType = "trading",
    rankingMethod = "pnl",
    tieBreaker1 = "trades_count",
    tieBreaker2,
    // The schema floors this at 1, so every provider scenario below carries a trade minimum
    // its seats cannot possibly meet - which is a free assertion that the minimum-trades
    // check really is scoped to trading rather than merely happening to pass.
    minimumTrades = 1,
    disqualifyOnLiquidation = true,
    challenger = {},
    challenged = {},
  } = options;

  const isProvider = gameType === "provider";
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("challenges").insertOne({
    _id: id,
    slug: `challenge-${id.toString()}`,
    gameType,
    gameKey: isProvider ? GAME_KEY : "trading",
    gameConfig: isProvider
      ? { providerKey: "mock", gameCode: "mock-puzzle", settings: {} }
      : undefined,
    ...(isProvider ? { attemptsPolicy: "single" } : {}),
    challengerId: CHALLENGER.id,
    challengerName: CHALLENGER.name,
    challengerEmail: "ada@example.com",
    challengedId: CHALLENGED.id,
    challengedName: CHALLENGED.name,
    challengedEmail: "bo@example.com",
    entryFee: ENTRY_FEE,
    prizePool: PRIZE_POOL,
    platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
    platformFeeAmount: PLATFORM_FEE,
    winnerPrize: WINNER_PRIZE,
    acceptDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 60 * 1000),
    duration: 60,
    status: "finalizing",
    // Required only while `gameType` is "trading" - the predicate on the model, not a
    // blanket requirement. A provider challenge has no virtual trading capital.
    ...(isProvider ? {} : { startingCapital: START_CAPITAL }),
    assetClasses: [],
    allowedSymbols: [],
    blockedSymbols: [],
    leverage: { enabled: false, min: 1, max: 10 },
    rules: {
      rankingMethod,
      tieBreaker1,
      ...(tieBreaker2 ? { tieBreaker2 } : {}),
      minimumTrades,
      disqualifyOnLiquidation,
    },
    maxPositionSize: 50,
    maxOpenPositions: 10,
    allowShortSelling: false,
    marginCallThreshold: 100,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });

  const buildParticipant = (
    seed: ParticipantSeed,
    who: { id: string; name: string },
    role: "challenger" | "challenged",
    email: string,
  ) => ({
    challengeId: id.toString(),
    gameKey: isProvider ? GAME_KEY : "trading",
    userId: who.id,
    username: who.name,
    email,
    role,
    status: seed.status ?? "active",
    // Capital is required for a trading participant and absent for a provider one, exactly
    // as the seat builder writes it.
    ...(isProvider
      ? {}
      : {
          startingCapital: START_CAPITAL,
          currentCapital: seed.currentCapital ?? START_CAPITAL,
          availableCapital: seed.currentCapital ?? START_CAPITAL,
        }),
    // A provider seat carries NO `score` key unless the scenario says a result arrived
    // (R50: a phantom stored zero made every entrant eligible for a prize).
    ...(seed.score === undefined ? {} : { score: seed.score }),
    usedMargin: 0,
    pnl: seed.pnl ?? 0,
    pnlPercentage: seed.pnlPercentage ?? 0,
    realizedPnl: seed.pnl ?? 0,
    unrealizedPnl: 0,
    totalTrades: seed.totalTrades ?? 0,
    winningTrades: seed.winningTrades ?? 0,
    losingTrades: seed.losingTrades ?? 0,
    winRate: seed.winRate ?? 0,
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
    joinedAt: new Date(Date.now() - (seed.joinedMinutesAgo ?? 90) * 60 * 1000),
  });

  await db?.collection("challengeparticipants").insertMany([
    buildParticipant(challenger, CHALLENGER, "challenger", "ada@example.com"),
    buildParticipant(challenged, CHALLENGED, "challenged", "bo@example.com"),
  ]);

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

interface TitleSeed {
  scoreDirection?: "higher_is_better" | "lower_is_better";
  scoreType?: "integer" | "decimal" | "duration_ms";
  zeroIsValidResult?: boolean;
  minimumEligibleScore?: number;
}

/** The catalogue row `resolveScoringRules` reads the ranking direction and eligibility from. */
async function seedTitle(seed: TitleSeed = {}) {
  await ProviderGame.create({
    providerKey: "mock",
    gameCode: "mock-puzzle",
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    family: "independent",
    scoreDirection: seed.scoreDirection ?? "higher_is_better",
    scoreType: seed.scoreType ?? "integer",
    // Left ABSENT when the scenario says nothing, because an absent declaration and a
    // stored `false` must be able to differ in a test even where the code treats them alike.
    ...(seed.zeroIsValidResult === undefined
      ? {}
      : { zeroIsValidResult: seed.zeroIsValidResult }),
    ...(seed.minimumEligibleScore === undefined
      ? {}
      : { minimumEligibleScore: seed.minimumEligibleScore }),
  });
}

/**
 * Runs the settlement inside a real transaction, the way both finalizers do.
 *
 * The documents are re-read THROUGH THE MODELS inside the session rather than being the
 * ones the seed inserted, because `settleChallenge` saves all three and a raw-driver
 * insert is not a hydrated document.
 */
async function runSettlement(
  challengeId: string,
  tiePrizeDistribution?: "split_equally" | "challenger_wins" | "both_lose",
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const challenge = await Challenge.findById(challengeId).session(session);
    const challenger = await ChallengeParticipant.findOne({
      challengeId,
      role: "challenger",
    }).session(session);
    const challenged = await ChallengeParticipant.findOne({
      challengeId,
      role: "challenged",
    }).session(session);

    if (!challenge || !challenger || !challenged) {
      throw new Error("fixture did not seed the challenge and both seats");
    }

    const result = await settleChallenge({
      session,
      challenge,
      challenger,
      challenged,
      ...(tiePrizeDistribution ? { tiePrizeDistribution } : {}),
    });

    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
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

async function readWallet(userId: string) {
  return mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
}

async function readWinTransaction(challengeId: string, userId: string) {
  return mongoose.connection.db?.collection("wallettransactions").findOne({
    userId,
    challengeId,
    transactionType: "challenge_win",
  });
}

async function readPlatformTransaction(
  challengeId: string,
  transactionType: string,
) {
  return mongoose.connection.db?.collection("platformtransactions").findOne({
    sourceType: "challenge",
    sourceId: challengeId,
    transactionType,
  });
}

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "challenges",
    "challengeparticipants",
    "creditwallets",
    "wallettransactions",
    "platformtransactions",
    "gamemasterearnings",
    "gamemastersubscriptions",
    "userreferrals",
    "user",
    "marketplaceitems",
    "provider_game",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("challenge settlement ranks a trading challenge on its own metrics", () => {
  it("pays the higher P&L outright, books the fee and leaves the loser untouched", async () => {
    const challengeId = await seedChallenge({
      challenger: { pnl: 500, totalTrades: 10, currentCapital: 10_500 },
      challenged: { pnl: 200, totalTrades: 8, currentCapital: 10_200 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.loserId).toBe(CHALLENGED.id);
    expect(result.isTie).toBe(false);
    expect(result.noWinner).toBe(false);
    expect(result.winnerPnL).toBeCloseTo(500);
    expect(result.loserPnL).toBeCloseTo(200);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
    expect(challenge?.winnerId).toBe(CHALLENGER.id);
    expect(challenge?.isTie).toBe(false);
    // `noWinner` is written as `true` or not at all, so a false answer stores nothing.
    expect(challenge?.noWinner).toBeUndefined();

    const winner = await readParticipant(challengeId, CHALLENGER.id);
    expect(winner?.status).toBe("completed");
    expect(winner?.isWinner).toBe(true);
    expect(winner?.prizeReceived).toBe(WINNER_PRIZE);

    const loser = await readParticipant(challengeId, CHALLENGED.id);
    expect(loser?.status).toBe("completed");
    expect(loser?.isWinner).toBe(false);
    expect(loser?.prizeReceived).toBe(0);

    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(START_BALANCE);

    // ASSERT THE MONEY SEPARATELY FROM THE STATUS. A terminal status is not evidence of a
    // settlement - R42's fixture bug marked a contest `completed` having paid nobody.
    const win = await readWinTransaction(challengeId, CHALLENGER.id);
    expect(win?.amount).toBe(WINNER_PRIZE);
    expect(win?.metadata?.rank).toBe(1);
    expect(win?.metadata?.finalPnl).toBeCloseTo(500);
    expect(win?.metadata?.finalCapital).toBeCloseTo(10_500);

    const fee = await readPlatformTransaction(
      challengeId,
      "challenge_platform_fee",
    );
    expect(fee?.amount).toBeCloseTo(PLATFORM_FEE);
    expect(
      await readPlatformTransaction(challengeId, "unclaimed_pool"),
    ).toBeNull();
  });

  it("breaks an equal P&L on trade count, where FEWER trades wins", async () => {
    const challengeId = await seedChallenge({
      tieBreaker1: "trades_count",
      challenger: { pnl: 300, totalTrades: 5 },
      challenged: { pnl: 300, totalTrades: 15 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.isTie).toBe(false);
    // Both carry the same ranking value - the tiebreaker decided the order, not the metric.
    expect(result.winnerPnL).toBeCloseTo(300);
    expect(result.loserPnL).toBeCloseTo(300);

    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
  });

  it("falls through to the join-time tiebreaker, where the EARLIER entrant wins", async () => {
    // The first tiebreaker is equal on purpose, so only the second can resolve this. This
    // pins the fix for `join_time` having read `enteredAt`, a field this model has never
    // declared - it compared `Date.now()` with itself and could never resolve a tie.
    const challengeId = await seedChallenge({
      tieBreaker1: "trades_count",
      tieBreaker2: "join_time",
      challenger: { pnl: 300, totalTrades: 5, joinedMinutesAgo: 90 },
      challenged: { pnl: 300, totalTrades: 5, joinedMinutesAgo: 60 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.isTie).toBe(false);
    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
  });

  it("splits the prize equally on a tie no tiebreaker can resolve", async () => {
    const challengeId = await seedChallenge({
      tieBreaker1: "trades_count",
      challenger: { pnl: 300, totalTrades: 5 },
      challenged: { pnl: 300, totalTrades: 5 },
    });

    const result = await runSettlement(challengeId, "split_equally");

    expect(result.isTie).toBe(true);
    expect(result.winnerId).toBeNull();
    // A TIE IS NOT "NO WINNER". Both are paid, so the unclaimed pool must not fire.
    expect(result.noWinner).toBe(false);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.isTie).toBe(true);
    expect(challenge?.winnerId).toBeUndefined();
    expect(challenge?.noWinner).toBeUndefined();

    const half = WINNER_PRIZE / 2;
    for (const who of [CHALLENGER, CHALLENGED]) {
      const seat = await readParticipant(challengeId, who.id);
      expect(seat?.status).toBe("completed");
      expect(seat?.isWinner).toBe(true);
      expect(seat?.prizeReceived).toBe(half);
      expect((await readWallet(who.id))?.creditBalance).toBe(
        START_BALANCE + half,
      );

      const win = await readWinTransaction(challengeId, who.id);
      expect(win?.amount).toBe(half);
      expect(win?.metadata?.isTied).toBe(true);
      expect(win?.metadata?.rank).toBe(1);
    }

    expect(
      await readPlatformTransaction(challengeId, "unclaimed_pool"),
    ).toBeNull();
  });

  it("disqualifies a trading seat under the minimum trade count", async () => {
    // The trade floor is a contest RULE scoped to trading, and it is the only thing
    // `isTrading` decides on this path - the liquidation rule below is deliberately
    // game-agnostic, so it cannot stand in for this one.
    const challengeId = await seedChallenge({
      minimumTrades: 3,
      challenger: { pnl: 900, totalTrades: 1 },
      challenged: { pnl: 100, totalTrades: 5 },
    });

    const result = await runSettlement(challengeId);

    // The bigger P&L loses, because it was not earned over enough trades.
    expect(result.winnerId).toBe(CHALLENGED.id);
    expect(result.loserId).toBe(CHALLENGER.id);

    const disqualified = await readParticipant(challengeId, CHALLENGER.id);
    expect(disqualified?.disqualificationReason).toBe(
      "Did not make minimum 3 trade(s)",
    );
    expect(disqualified?.prizeReceived).toBe(0);

    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(START_BALANCE);
  });

  it("disqualifies a liquidated account and pays the survivor", async () => {
    const challengeId = await seedChallenge({
      disqualifyOnLiquidation: true,
      // Traded enough to clear the minimum, so "Account liquidated" is unambiguously the
      // reason rather than the trade floor.
      challenger: { pnl: -400, totalTrades: 3, status: "liquidated" },
      challenged: { pnl: 100, totalTrades: 5 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGED.id);
    expect(result.loserId).toBe(CHALLENGER.id);
    expect(result.winnerPnL).toBeCloseTo(100);
    expect(result.loserPnL).toBeCloseTo(-400);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.challengerFinalStats?.isDisqualified).toBe(true);
    expect(challenge?.challengerFinalStats?.disqualificationReason).toBe(
      "Account liquidated",
    );

    // The reason SURVIVES while the status becomes "completed", because only one of the two
    // was disqualified - the contest reached a normal conclusion for the other player.
    const disqualified = await readParticipant(challengeId, CHALLENGER.id);
    expect(disqualified?.status).toBe("completed");
    expect(disqualified?.disqualificationReason).toBe("Account liquidated");
    expect(disqualified?.isWinner).toBe(false);
    expect(disqualified?.prizeReceived).toBe(0);

    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(START_BALANCE);
  });
});

describe("challenge settlement ranks a provider challenge on its score", () => {
  it("pays the higher score when the title counts upward", async () => {
    await seedTitle({ scoreDirection: "higher_is_better" });
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 900 },
      challenged: { score: 300 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.isTie).toBe(false);
    expect(result.winnerPnL).toBeCloseTo(900);
    expect(result.loserPnL).toBeCloseTo(300);

    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );

    const win = await readWinTransaction(challengeId, CHALLENGER.id);
    expect(win?.amount).toBe(WINNER_PRIZE);
    expect(win?.metadata?.finalScore).toBe(900);
    // A provider seat carries no virtual capital at all, so the trading figure is absent
    // rather than zero - the distinction R45 and R50 both turn on.
    expect(win?.metadata?.finalCapital).toBeUndefined();
  });

  it("pays the LOWER score when the title counts downward", async () => {
    await seedTitle({
      scoreDirection: "lower_is_better",
      scoreType: "duration_ms",
    });
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 8_000 },
      challenged: { score: 12_000 },
    });

    const result = await runSettlement(challengeId);

    // The faster time wins. The stored score stays raw and positive; only the RANKING
    // value is negated, which is what these two audit fields carry.
    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.winnerPnL).toBeCloseTo(-8_000);
    expect(result.loserPnL).toBeCloseTo(-12_000);

    const winner = await readParticipant(challengeId, CHALLENGER.id);
    expect(winner?.score).toBe(8_000);
    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
  });

  it("gives the whole prize to the challenger under the challenger_wins tie policy", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 500 },
      challenged: { score: 500 },
    });

    const result = await runSettlement(challengeId, "challenger_wins");

    // The policy RESOLVES the tie rather than splitting it, so `isTie` is false by the end.
    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.isTie).toBe(false);
    expect(result.noWinner).toBe(false);

    expect((await readParticipant(challengeId, CHALLENGER.id))?.prizeReceived).toBe(
      WINNER_PRIZE,
    );
    expect((await readWallet(CHALLENGER.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(START_BALANCE);
  });

  it("pays nobody under both_lose, routing the pot to the unclaimed pool", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 500 },
      challenged: { score: 500 },
    });

    const result = await runSettlement(challengeId, "both_lose");

    expect(result.isTie).toBe(true);
    expect(result.winnerId).toBeNull();
    // STILL NOT "no winner": the contest produced a tie, which is an outcome. `noWinner` is
    // reserved for the case where nobody qualified at all.
    expect(result.noWinner).toBe(false);

    for (const who of [CHALLENGER, CHALLENGED]) {
      const seat = await readParticipant(challengeId, who.id);
      expect(seat?.status).toBe("completed");
      expect(seat?.isWinner).toBe(false);
      expect(seat?.prizeReceived).toBe(0);
      expect((await readWallet(who.id))?.creditBalance).toBe(START_BALANCE);
      expect(await readWinTransaction(challengeId, who.id)).toBeNull();
    }

    const unclaimed = await readPlatformTransaction(
      challengeId,
      "unclaimed_pool",
    );
    // Both players DID qualify - nobody was disqualified - so the reason must say the tie
    // policy left the prize unclaimed, not that the field was empty.
    expect(unclaimed?.unclaimedReason).toBe("no_qualified_winners");
    expect(
      await readPlatformTransaction(challengeId, "challenge_platform_fee"),
    ).not.toBeNull();
  });

  it("splits equally on identical scores, since a provider game declares no tiebreak", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      // Trade counts differ, which would break the tie on a trading challenge. It must not
      // here: `getProviderTieBreakerValue` returns a constant on purpose.
      challenger: { score: 500, totalTrades: 3 },
      challenged: { score: 500, totalTrades: 30 },
    });

    const result = await runSettlement(challengeId, "split_equally");

    expect(result.isTie).toBe(true);

    const half = WINNER_PRIZE / 2;
    for (const who of [CHALLENGER, CHALLENGED]) {
      expect((await readParticipant(challengeId, who.id))?.prizeReceived).toBe(
        half,
      );
      expect((await readWinTransaction(challengeId, who.id))?.metadata?.finalScore).toBe(
        500,
      );
    }
  });
});

describe("challenge settlement decides prize eligibility from the title's rules", () => {
  it("disqualifies a seat with NO score and pays the player who has one", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 700 },
      // No `score` key at all - a round that never reported.
      challenged: {},
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGER.id);
    expect(result.winnerPnL).toBeCloseTo(700);
    // An absent score ORDERS as zero while being ineligible - ordering and eligibility are
    // two separate questions.
    expect(result.loserPnL).toBeCloseTo(0);

    const challenge = await readChallenge(challengeId);
    expect(challenge?.challengedFinalStats?.isDisqualified).toBe(true);
    expect(challenge?.challengedFinalStats?.disqualificationReason).toBe(
      "No score recorded",
    );

    const unscored = await readParticipant(challengeId, CHALLENGED.id);
    expect(unscored?.disqualificationReason).toBe("No score recorded");
    expect(unscored?.prizeReceived).toBe(0);
    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(START_BALANCE);
  });

  it("treats a STORED zero as no result while the title says nothing", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 0 },
      challenged: { score: 400 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGED.id);
    expect(result.loserId).toBe(CHALLENGER.id);

    const zeroScorer = await readParticipant(challengeId, CHALLENGER.id);
    expect(zeroScorer?.disqualificationReason).toBe("No score recorded");
    expect(zeroScorer?.isWinner).toBe(false);
    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
  });

  it("admits a zero once the title DECLARES zero a valid result", async () => {
    await seedTitle({ zeroIsValidResult: true });
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 0 },
      challenged: { score: 250 },
    });

    const result = await runSettlement(challengeId);

    // Same score as the previous case and a different verdict: the zero loses on ranking
    // rather than being refused, which is the whole point of the declaration.
    expect(result.winnerId).toBe(CHALLENGED.id);

    const zeroScorer = await readParticipant(challengeId, CHALLENGER.id);
    expect(zeroScorer?.disqualificationReason).toBeUndefined();
    expect(zeroScorer?.status).toBe("completed");

    const challenge = await readChallenge(challengeId);
    expect(challenge?.challengerFinalStats?.isDisqualified).toBeFalsy();
  });

  it("keeps the zero rule DIRECTION-INDEPENDENT on a lower-is-better title", async () => {
    // Zero milliseconds is an unrecorded round, not the fastest possible one. Nothing here
    // may read the direction to decide what a zero means.
    await seedTitle({
      scoreDirection: "lower_is_better",
      scoreType: "duration_ms",
    });
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 0 },
      challenged: { score: 5_000 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGED.id);
    expect(result.winnerPnL).toBeCloseTo(-5_000);
    expect(
      (await readParticipant(challengeId, CHALLENGER.id))?.disqualificationReason,
    ).toBe("No score recorded");
  });

  it("refuses a score under the title's minimum, measured the right way up", async () => {
    await seedTitle({
      scoreDirection: "higher_is_better",
      minimumEligibleScore: 500,
    });
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: { score: 300 },
      challenged: { score: 600 },
    });

    const result = await runSettlement(challengeId);

    expect(result.winnerId).toBe(CHALLENGED.id);
    expect(result.loserPnL).toBeCloseTo(300);
    expect(
      (await readParticipant(challengeId, CHALLENGER.id))?.disqualificationReason,
    ).toBe("No score recorded");
    expect((await readWallet(CHALLENGED.id))?.creditBalance).toBe(
      START_BALANCE + WINNER_PRIZE,
    );
  });

  it("declares NO WINNER when neither seat produced a result, keeping both disqualified", async () => {
    await seedTitle();
    const challengeId = await seedChallenge({
      gameType: "provider",
      challenger: {},
      challenged: {},
    });

    const result = await runSettlement(challengeId);

    // The ONE case that sets `noWinner`. A tie does not, because a tie is an outcome.
    expect(result.noWinner).toBe(true);
    expect(result.isTie).toBe(false);
    expect(result.winnerId).toBeNull();

    const challenge = await readChallenge(challengeId);
    expect(challenge?.status).toBe("completed");
    expect(challenge?.noWinner).toBe(true);
    expect(challenge?.winnerId).toBeUndefined();

    for (const who of [CHALLENGER, CHALLENGED]) {
      // STAYS "disqualified" - the pass that rewrites a seat to "completed" is skipped
      // entirely when BOTH are disqualified, which is the behaviour that distinguishes this
      // case from every single-disqualification case above.
      const seat = await readParticipant(challengeId, who.id);
      expect(seat?.status).toBe("disqualified");
      expect(seat?.disqualificationReason).toBe("No score recorded");
      expect((await readWallet(who.id))?.creditBalance).toBe(START_BALANCE);
    }

    const unclaimed = await readPlatformTransaction(
      challengeId,
      "unclaimed_pool",
    );
    // Different reason from the both_lose tie: there, two qualified players simply were not
    // paid; here nobody qualified at all.
    expect(unclaimed?.unclaimedReason).toBe("all_disqualified");
  });
});
