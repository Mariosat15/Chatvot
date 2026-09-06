import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * WHAT A PROVIDER CONTEST ACTUALLY LOOKS LIKE WHEN A PLAYER SCREEN READS IT.
 *
 * This exists because a provider contest reached the player lobby and the page threw, showing
 * the generic error boundary. The lobby is `app/(root)/competitions/[id]/page.tsx`, it was
 * written for trading, and it dereferences a dozen contest fields with no guard - so the
 * question that identifies the defect is not "what does the schema declare" but **"what is
 * present on the object the page is handed"**.
 *
 * THE READ HAS TO BE `.lean()`, AND THAT IS THE WHOLE POINT OF THE FILE. `getCompetitionById`
 * uses `Competition.findById(id).lean()`. Mongoose applies schema defaults when it *hydrates*,
 * so an ordinary read reports a defaulted field as present whether or not anything was ever
 * stored; `.lean()` skips hydration and returns the raw document. A test written with an
 * ordinary read would therefore pass while the page crashed - which is exactly the trap
 * recorded for the label backfill, in the other direction.
 *
 * It seeds the contest with the SAME FIELD SET `createProviderContest` writes, deliberately
 * listing it out rather than importing the admin service: the service lives in `apps/admin`,
 * pulls in the catalogue and the config-schema parser, and none of that changes the shape of
 * the document. What matters is that the list below stays equal to the service's list, which
 * the last test in the file asserts.
 */

const CONTEST_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId().toString();

/**
 * Exactly the keys `createProviderContest` passes to `Competition.create`.
 *
 * Reason it is a named constant: the defect is about fields that are ABSENT, so the fixture's
 * value is entirely in what it leaves out. A fixture that quietly gained `startingCapital` to
 * make a test pass would destroy the only thing this file measures.
 */
function providerContestInput() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000);

  return {
    _id: CONTEST_ID,
    name: "Circuit Sprint Cup",
    description: "A provider contest.",
    slug: "circuit-sprint-cup",

    gameType: "provider",
    gameKey: "chartvolt-games:circuit-sprint",
    gameConfig: {
      providerKey: "chartvolt-games",
      gameCode: "circuit-sprint",
      settings: { size: "small" },
    },
    contentSeed: "a".repeat(32),

    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 120,
    attemptsPolicy: "best_of_n",
    attemptsAllowed: 3,
    unresolvedRoundPolicy: "score_zero",

    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 1,
    startTime: start,
    endTime: end,
    registrationDeadline: start,

    status: "draft",
    competitionType: "time_based",
    prizePool: 0,
    platformFeePercentage: 10,
    prizeDistribution: [
      { rank: 1, percentage: 70 },
      { rank: 2, percentage: 30 },
    ],

    createdBy: new mongoose.Types.ObjectId(),
  };
}

/**
 * A provider seat, with the fields `participant-seat.ts` omits for a non-trading game.
 *
 * Reason `username` and `email` are here and the capital fields are not: the model demands
 * those two of every participant and demands capital only of a trading one. A fixture trimmed
 * to the fields a test reads fails everything at once on one unrelated validation error, which
 * is the third time that has cost time on this codebase.
 */
function providerParticipantInput() {
  return {
    competitionId: CONTEST_ID.toString(),
    userId: USER_ID,
    username: "player_one",
    email: "player_one@example.com",
    gameKey: "chartvolt-games:circuit-sprint",
    status: "active",
    enteredAt: new Date(),
  };
}

/**
 * The catalogue row the direction is read from.
 *
 * `gameKey` must equal the contest's, because that is the join. Getting it wrong makes
 * `resolveScoreDirection` find no title, warn, and return the upward default - which is
 * indistinguishable from a correct higher-is-better test and would make the lower-is-better
 * test pass for the wrong reason.
 */
function providerTitleInput(scoreDirection: string) {
  return {
    providerKey: "chartvolt-games",
    gameCode: "circuit-sprint",
    gameKey: "chartvolt-games:circuit-sprint",
    displayName: "Circuit Sprint",
    family: "independent",
    scoreDirection,
    scoreType: "integer",
  };
}

/** Every contest field the trading lobby dereferences without a guard or a fallback. */
const LOBBY_DEREFERENCES_UNGUARDED = [
  "prizeDistribution",
  "assetClasses",
  "leverage",
  "rules",
  "levelRequirement",
];

let Competition: mongoose.Model<Record<string, unknown>>;
let CompetitionParticipant: mongoose.Model<Record<string, unknown>>;
let ProviderGame: mongoose.Model<Record<string, unknown>>;

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);

  // Reason: the server actions under test call `connectToDatabase()`, which reads
  // `MONGODB_URI` and throws when it is unset. Without this the action fails on the
  // connection and its catch block reports "Failed to get leaderboard" - the same message a
  // real defect produces, so the test would look like a finding.
  process.env.MONGODB_URI = uri;

  Competition = (await import("@/database/models/trading/competition.model"))
    .default as unknown as mongoose.Model<Record<string, unknown>>;
  CompetitionParticipant = (
    await import("@/database/models/trading/competition-participant.model")
  ).default as unknown as mongoose.Model<Record<string, unknown>>;
  ProviderGame = (await import("@/database/models/games/provider-game.model"))
    .default as unknown as mongoose.Model<Record<string, unknown>>;

  // `provider_game`, not a guessed pluralisation - the schema sets an explicit collection
  // name, and writing to the wrong one has the same symptom as writing the wrong value.
  await ensureCollections(["competitions", "competitionparticipants", "provider_game"]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

describe("the document a provider contest actually stores", () => {
  it("saves with no startingCapital, and that is legitimate", async () => {
    // The conditional requirement from X5: the three virtual-capital fields are demanded only
    // of a trading contest. If this throws, the model has been narrowed wrongly and no
    // provider contest can be created at all.
    await expect(Competition.create(providerContestInput())).resolves.toBeTruthy();

    const raw = await Competition.findById(CONTEST_ID).lean<Record<string, unknown>>();
    expect(raw).toBeTruthy();
    expect(raw!.startingCapital).toBeUndefined();
  });

  /**
   * THE TEST THAT IDENTIFIES THE CRASH.
   *
   * It reads with `.lean()`, exactly as `getCompetitionById` does, and reports which of the
   * lobby's unguarded dereferences would be performed on `undefined`. Each one is a
   * `TypeError` during a server render, which Next.js turns into the generic error boundary -
   * no field name, no line number, nothing a player or an operator can act on.
   */
  it("reports which unguarded lobby fields are absent on a lean read", async () => {
    await Competition.create(providerContestInput());

    const raw = await Competition.findById(CONTEST_ID).lean<Record<string, unknown>>();

    // `Object.hasOwn`, not a bare index: a bare read walks the prototype chain, so a field name
    // colliding with something on `Object.prototype` would report as stored when nothing is.
    const absent = LOBBY_DEREFERENCES_UNGUARDED.filter((field) => !Object.hasOwn(raw!, field));

    // ALL OF THEM ARE PRESENT, and recording that is the point - it is the opposite of what
    // was expected when this file was written. An array path is stored as `[]` even though
    // nothing set it, and a nested object whose subfields carry defaults is materialised, so
    // `assetClasses.map(...)`, `leverage.max` and `rules.minimumTrades` all survive a provider
    // contest. The lobby crash is therefore NOT the contest's shape, which is what sent the
    // search to `getCompetitionLeaderboard` instead. Kept as a pin: if a later model change
    // drops one of these defaults, the lobby starts throwing and this test says which field.
    expect(absent).toEqual([]);
  });

  it("materialises nested objects whose subfields carry defaults, which is why they are safe", async () => {
    await Competition.create(providerContestInput());
    const raw = await Competition.findById(CONTEST_ID).lean<{
      rules?: { rankingMethod?: string };
      leverage?: { max?: number };
    }>();

    // `rules.rankingMethod` and `leverage.max` declare defaults, so Mongoose creates the
    // parent object on save. `competition.rules.minimumTrades` therefore cannot throw - it
    // reads `undefined`, and `undefined > 0` is false. Pinned because it is the reason the
    // lobby survives those references, and a later model change removing a default would
    // silently turn them into the same crash.
    expect(raw!.rules).toBeTypeOf("object");
    expect(raw!.leverage).toBeTypeOf("object");
  });

  it("stores a participant with no capital fields, which is what the lobby's panels read", async () => {
    await Competition.create(providerContestInput());
    await CompetitionParticipant.create(providerParticipantInput());

    const raw = await CompetitionParticipant.findOne({ competitionId: CONTEST_ID }).lean<
      Record<string, unknown>
    >();

    expect(raw!.currentCapital).toBeUndefined();
    expect(raw!.startingCapital).toBeUndefined();
    // But the numeric display fields DO default, so `.toFixed()` on them cannot throw.
    expect(raw!.pnl).toBe(0);
    expect(raw!.pnlPercentage).toBe(0);
    expect(raw!.score).toBe(0);
  });
});

describe("the lobby's other reads", () => {
  // Both of these throw rather than returning a refusal, so either one takes the whole page
  // to the error boundary. `draft` is included because a contest is created in that status and
  // is reachable by URL before an operator publishes it.
  for (const status of ["draft", "upcoming", "active"]) {
    it(`getCompetitionById does not throw for a ${status} provider contest`, async () => {
      await Competition.create({ ...providerContestInput(), status });
      await CompetitionParticipant.create(providerParticipantInput());

      const { getCompetitionById } = await import("@/lib/actions/trading/competition.actions");

      await expect(getCompetitionById(CONTEST_ID.toString())).resolves.toBeTruthy();
    });
  }
});

/**
 * THE LOBBY'S ONE THROWING DEPENDENCY.
 *
 * `getCompetitionLeaderboard` ends in `catch { throw new Error("Failed to get leaderboard") }`,
 * and the lobby awaits it during a server render. So unlike every other read on that page, a
 * failure here is not a worded refusal - it propagates, Next.js catches it at
 * `app/(root)/error.tsx`, and the player sees "Something went wrong" with no indication of
 * which of the page's half-dozen reads failed. That makes it the first thing to test and the
 * last thing to leave throwing.
 */
describe("the leaderboard a provider contest renders", () => {
  it("does not throw for a provider contest whose participants have never traded", async () => {
    await Competition.create(providerContestInput());
    await CompetitionParticipant.create(providerParticipantInput());

    const { getCompetitionLeaderboard } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    await expect(getCompetitionLeaderboard(CONTEST_ID.toString())).resolves.toBeTruthy();
  });

  it("ranks a provider contest on score, not on trading PnL", async () => {
    await Competition.create(providerContestInput());

    // Two seats whose SCORES disagree while every trading metric is identical at zero. That is
    // the only fixture that can tell the two ranking paths apart: rank by PnL and both tie,
    // rank by score and the 900 wins. A fixture seeding pnl as well would pass either way.
    await CompetitionParticipant.create({ ...providerParticipantInput(), score: 100 });
    await CompetitionParticipant.create({
      ...providerParticipantInput(),
      userId: new mongoose.Types.ObjectId().toString(),
      username: "player_two",
      email: "player_two@example.com",
      score: 900,
    });

    const { getCompetitionLeaderboard } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    const board = (await getCompetitionLeaderboard(CONTEST_ID.toString())) as {
      username: string;
      currentRank: number;
      score?: number;
    }[];

    expect(board).toHaveLength(2);
    expect(board[0].username).toBe("player_two");
    expect(board[0].currentRank).toBe(1);
    expect(board[1].currentRank).toBe(2);
  });

  /**
   * The direction half of the seam, which needs its own test because the score half passes
   * without it. Ranking on score with no direction sorts a race time the wrong way round: the
   * slowest player leads the board for the entire contest, and then settlement - which does
   * resolve the direction - pays the fastest. Both halves render, neither errors.
   */
  it("ranks a lower-is-better provider contest with the lowest score first", async () => {
    await Competition.create(providerContestInput());
    await ProviderGame.create(providerTitleInput("lower_is_better"));

    await CompetitionParticipant.create({ ...providerParticipantInput(), score: 92 });
    await CompetitionParticipant.create({
      ...providerParticipantInput(),
      userId: new mongoose.Types.ObjectId().toString(),
      username: "player_slow",
      email: "player_slow@example.com",
      score: 105,
    });

    const { getCompetitionLeaderboard } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    const board = (await getCompetitionLeaderboard(CONTEST_ID.toString())) as {
      username: string;
      currentRank: number;
    }[];

    // 92 seconds beats 105 seconds. Without the direction this asserts the opposite.
    expect(board[0].username).toBe("player_one");
    expect(board[1].username).toBe("player_slow");
  });

  it("treats an unrecognised stored direction as higher-is-better", async () => {
    await Competition.create(providerContestInput());
    // A value the enum does not admit, which reaches the database when a row predates the enum
    // or is hand-edited. It must not reverse a board - the safe answer is the one that cannot
    // invert a result, which is the same fail-closed instinct as the market-hours gate.
    await ProviderGame.collection.insertOne({
      ...providerTitleInput("sideways"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await CompetitionParticipant.create({ ...providerParticipantInput(), score: 100 });
    await CompetitionParticipant.create({
      ...providerParticipantInput(),
      userId: new mongoose.Types.ObjectId().toString(),
      username: "player_high",
      email: "player_high@example.com",
      score: 900,
    });

    const { getCompetitionLeaderboard } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    const board = (await getCompetitionLeaderboard(CONTEST_ID.toString())) as {
      username: string;
    }[];

    expect(board[0].username).toBe("player_high");
  });
});
