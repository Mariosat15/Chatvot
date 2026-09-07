import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

import Competition from "../../database/models/trading/competition.model";
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import GameRound from "../../database/models/games/game-round.model";
import { applyResult } from "../../lib/services/games/result-ingestion.service";
import { buildParticipantSeat } from "../../lib/services/contest-entry/participant-seat";
import {
  calculateRankings,
  distributePrizesWithTies,
  type CompetitionRules,
  type ParticipantData,
} from "../../lib/services/competition-ranking.service";
import { getPlayState } from "../../lib/services/games/round-status.service";

/**
 * WHETHER A PLAYER HAS A SCORE AT ALL, which is the fact R45's prize gate rests on - and
 * which nothing in production could express until this suite was written.
 *
 * THE DEFECT. `providerHasResult` is `Number.isFinite(participant.score)`, and the comment
 * beside it draws the distinction the whole fix depends on: "a stored zero orders last and is
 * eligible, because the player attempted the game; an absent score orders last and wins
 * nothing". The module was written correctly. Two other places then made the absent case
 * unreachable - `buildParticipantSeat` wrote `score: 0` into every seat at join, and the
 * schema declared the field `required: true, default: 0`, so even a writer that omitted it
 * stored a nought. **Every entrant therefore held a finite score from the moment they paid**,
 * every one of them passed the gate, and the "No score recorded" disqualification could not
 * fire for anybody.
 *
 * WHAT THAT COSTS, in the owner's own example: three prize ranks at 70/20/10, two players who
 * played and one who never launched a round. The third rank should be unclaimed and its share
 * redistributed to the two who placed. Instead the non-player ranked third on a phantom zero
 * and was paid for it.
 *
 * WHY R45'S OWN SUITE PASSED. `provider-prize-eligibility.test.ts` builds its participants as
 * plain objects and omits `score` to mean "never played" - a shape no production writer can
 * produce. It is the third instance of the rule that **a fixture supplying the value under
 * test has tested the consumer, not the producer**, after trading finalization's `pnl` and the
 * settlement suites that seeded the scores they ranked. The new twist worth naming: here the
 * fixture supplied an *absence* the code could never observe, which is harder to spot than a
 * wrong value because the assertion reads exactly like the intended behaviour.
 *
 * SO EVERY TEST BELOW GOES THROUGH THE REAL WRITERS - the seat builder, the Mongoose schema,
 * and `applyResult` - and never hands a participant object to the thing under test.
 */

const PROVIDER_KEY = "mock";
const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

const RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "win_rate",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: false,
};

/** The owner's example: three ranks, and only some of them earned. */
const DISTRIBUTION = [
  { rank: 1, percentage: 70 },
  { rank: 2, percentage: 20 },
  { rank: 3, percentage: 10 },
];

const POOL = 1000;

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "providergames",
    "gamerounds",
    "providerevents",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

async function seedTitle() {
  await ProviderGame.create({
    providerKey: PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    family: "independent",
    scoreType: "integer",
    scoreDirection: "higher_is_better",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    providerStatus: "active",
    chartvoltEnabled: true,
  });
}

/**
 * Satisfies the WHOLE competition schema, not the subset a score touches.
 *
 * ALWAYS SEEDED `active`, AND THE FIRST DRAFT OF THIS FILE GOT IT WRONG. Two tests seeded
 * `completed` because that is the state prizes are decided in - and gate 9 of ingestion
 * refuses a result for a closed contest, so no score ever landed and the players tied on
 * nought. Both tests went red, for a reason that had nothing to do with the defect: **a test
 * failing for the wrong reason is worth no more than one passing for the wrong reason.**
 * Ranking is told the contest is complete through `calculateRankings`' own options argument,
 * which is what R45 scoped the gate to, so the stored status plays no part here.
 */
async function seedContest() {
  const now = Date.now();
  return Competition.create({
    name: "Puzzle Cup",
    slug: `puzzle-cup-${now}-${Math.random().toString(16).slice(2)}`,
    description: "A mock puzzle competition",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: { providerKey: PROVIDER_KEY, gameCode: GAME_CODE, settings: {} },
    playWindowStart: new Date(now - 60_000),
    playWindowEnd: new Date(now + 3_600_000),
    resultGracePeriodSeconds: 600,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    status: "active",
    competitionType: "time_based",
    startTime: new Date(now - 120_000),
    endTime: new Date(now + 7_200_000),
    registrationDeadline: new Date(now - 120_000),
    entryFee: 5,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 1,
    prizePool: POOL,
    platformFeePercentage: 0,
    prizeDistribution: DISTRIBUTION,
    createdBy: new mongoose.Types.ObjectId().toString(),
  });
}

/**
 * A seat written the way the entry path writes one.
 *
 * Reason it goes through `buildParticipantSeat` rather than a literal: the builder is the
 * production writer, and a literal here would reintroduce exactly the fixture problem this
 * file exists to correct.
 */
async function seatFor(competitionId: string, userId: string) {
  return CompetitionParticipant.create(
    buildParticipantSeat({
      competitionId,
      userId,
      username: userId,
      email: `${userId}@example.com`,
      gameKey: GAME_KEY,
      gameType: "provider",
      enteredAt: new Date(),
    }),
  );
}

async function launchedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber = 1,
) {
  return GameRound.create({
    roundId: `cv_rnd_${Math.random().toString(16).slice(2).padEnd(24, "0")}`,
    providerKey: PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId,
    contestType: "competition",
    contestId,
    attemptNumber,
    mode: "ranked",
    status: "launched",
    expiresAt: new Date(Date.now() + 600_000),
  });
}

function resultFor(roundId: string, rawScore: number) {
  return {
    roundId,
    providerRoundId: `p_${roundId}`,
    status: "completed" as const,
    rawScore,
    scoreDirection: "higher_is_better" as const,
    completedAt: new Date(),
  };
}

/** Reads the stored rows back the way provider settlement maps them into ranking. */
async function storedParticipants(competitionId: string) {
  const rows = await CompetitionParticipant.find({ competitionId })
    .select("userId username score status enteredAt")
    .lean<
      {
        userId: string;
        username?: string;
        score?: number;
        status?: string;
        enteredAt?: Date;
      }[]
    >();

  return rows.map(
    (p) =>
      ({
        userId: p.userId,
        username: p.username || "Anonymous",
        score: p.score,
        scoreDirection: "higher_is_better",
        status: p.status ?? "active",
        enteredAt: p.enteredAt ?? new Date(),
      }) as unknown as ParticipantData,
  );
}

function rank(participants: ParticipantData[]) {
  return calculateRankings(participants, RULES, {
    competitionStatus: "completed",
    gameType: "provider",
  });
}

describe("a seat carries no score until a result arrives", () => {
  it("builds a provider seat with no score key at all", () => {
    const seat = buildParticipantSeat({
      competitionId: "c1",
      userId: "u1",
      username: "u1",
      email: "u1@example.com",
      gameKey: GAME_KEY,
      gameType: "provider",
      enteredAt: new Date(),
    });

    /*
      `toHaveProperty` rather than a value check, because the distinction IS presence. A seat
      carrying `score: undefined` would also fail a `toBe(0)` assertion while still handing
      Mongoose a path to apply its default to.
    */
    expect(Object.keys(seat)).not.toContain("score");
  });

  it("builds a TRADING seat with no score key either, which is one rule and not two", () => {
    /*
      Trading answers `hasResult` with an unconditional `true`, so an absent score costs it
      nothing - and a seat builder that wrote a score for one game and not the other would be
      a branch on game type in the one place invariant 8 most wants none.
    */
    const seat = buildParticipantSeat({
      competitionId: "c1",
      userId: "u1",
      username: "u1",
      email: "u1@example.com",
      gameKey: "trading",
      gameType: "trading",
      startingCapital: 10_000,
      enteredAt: new Date(),
    });

    expect(Object.keys(seat)).not.toContain("score");
    // The trading fields are still all there - this must not quietly shrink the seat.
    expect(seat.startingCapital).toBe(10_000);
    expect(seat.pnl).toBe(0);
  });

  it("stores nothing for score when the writer omits it", async () => {
    const contest = await seedContest();
    const seat = await seatFor(contest._id.toString(), "never-played");

    /*
      The schema half. `default: 0` would fill this in whatever the seat builder does, so the
      two fixes are not alternatives - a seat that omits the field and a schema that supplies
      one still produces a phantom zero.
    */
    expect(seat.score).toBeUndefined();

    const raw = await mongoose.connection
      .collection("competitionparticipants")
      .findOne({ userId: "never-played" });

    // Reason: read through the driver, not the model. A hydrated document applies defaults,
    // so a model read cannot tell a stored nought from an absent field.
    expect(raw && "score" in raw).toBe(false);
  });

  it("keeps a genuine zero, which is the whole point of the distinction", async () => {
    const contest = await seedContest();
    await CompetitionParticipant.create({
      competitionId: contest._id.toString(),
      userId: "scored-nothing",
      username: "scored-nothing",
      email: "scored-nothing@example.com",
      gameKey: GAME_KEY,
      score: 0,
      enteredAt: new Date(),
    });

    const stored = await CompetitionParticipant.findOne({
      userId: "scored-nothing",
    }).lean<{ score?: number } | null>();

    expect(stored?.score).toBe(0);
  });
});

describe("R45's prize gate, measured against rows the entry path actually writes", () => {
  it("disqualifies a player who never launched a round", async () => {
    const contest = await seedContest();
    await seatFor(contest._id.toString(), "never-played");

    const ranked = rank(await storedParticipants(contest._id.toString()));
    const absent = ranked.find((p) => p.userId === "never-played");

    expect(absent?.qualificationStatus).toBe("disqualified");
    expect(absent?.disqualificationReason).toMatch(/no score/i);
  });

  it("pays the owner's example correctly - the unclaimed rank goes to the players who placed", async () => {
    /*
      THE OWNER'S REPORT, THROUGH REAL ROWS: "if the admin sets more winners and we don't have
      them then the prize goes to the available winners... each of the 2 gets its percentage
      and the 3rd is split between the 2 equally."

      Two players score, one never plays. Rank 3 is unclaimed, so its 10% is split between the
      two who placed - and the player who never started a round is paid nothing.
    */
    const contest = await seedContest();
    const contestId = contest._id.toString();
    await seedTitle();

    for (const userId of ["scored-high", "scored-low", "never-played"]) {
      await seatFor(contestId, userId);
    }

    for (const [userId, score] of [
      ["scored-high", 900],
      ["scored-low", 400],
    ] as const) {
      const round = await launchedRound(contest._id, userId);
      const outcome = await applyResult({
        providerKey: PROVIDER_KEY,
        normalised: resultFor(round.roundId, score),
        eventId: `evt_${userId}`,
        source: "manual",
      });
      expect(outcome.accepted).toBe(true);
    }

    const ranked = rank(await storedParticipants(contestId));
    const paid = distributePrizesWithTies(ranked, DISTRIBUTION, POOL, RULES, 0);

    expect(paid.map((p) => p.userId).sort()).toEqual([
      "scored-high",
      "scored-low",
    ]);

    // 70 + half of the unclaimed 10, and 20 + the other half.
    const byUser = new Map(paid.map((p) => [p.userId, p.prizeAmount]));
    expect(byUser.get("scored-high")).toBe(750);
    expect(byUser.get("scored-low")).toBe(250);
  });

  it("qualifies a player once a score has actually arrived", async () => {
    const contest = await seedContest();
    await seedTitle();
    await seatFor(contest._id.toString(), "player");

    const round = await launchedRound(contest._id, "player");
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 512),
      eventId: "evt_player",
      source: "manual",
    });

    const ranked = rank(await storedParticipants(contest._id.toString()));
    expect(ranked[0].qualificationStatus).toBe("qualified");
    expect(ranked[0].score).toBe(512);
  });

  it("qualifies a player who played and genuinely scored nothing", async () => {
    /*
      THE BOUNDARY IN THE OTHER DIRECTION, and the reason the gate is `Number.isFinite` rather
      than truthiness. A player who solved no board still attempted the game; refusing them is
      the same class of error as reading an absent `canEnterChallenges` as a stored `false`.
    */
    const contest = await seedContest();
    await seedTitle();
    await seatFor(contest._id.toString(), "zero-scorer");

    const round = await launchedRound(contest._id, "zero-scorer");
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 0),
      eventId: "evt_zero",
      source: "manual",
    });

    const ranked = rank(await storedParticipants(contest._id.toString()));
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].qualificationStatus).toBe("qualified");
  });
});

describe("the sync leaves no phantom zero behind", () => {
  it("stores no score when the only round contributed none", async () => {
    /*
      A round voided by an operator hands the attempt back and is bookkeeping rather than play
      (R48). If the sync wrote the `combineRoundScores` answer for an empty list, a support
      action would make a player who never really scored eligible for a prize - the same
      phantom zero as the seat's, arriving one step later.
    */
    const contest = await seedContest();
    await seedTitle();
    await seatFor(contest._id.toString(), "voided-only");

    const round = await launchedRound(contest._id, "voided-only");
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: {
        roundId: round.roundId,
        providerRoundId: `p_${round.roundId}`,
        status: "voided" as const,
        // Reason it is 5000 rather than 0: a value that would take first place if it were
        // counted, so the test fails loudly instead of coincidentally agreeing with an absence.
        rawScore: 5000,
        scoreDirection: "higher_is_better" as const,
        completedAt: new Date(),
      },
      eventId: "evt_voided",
      source: "manual",
    });

    const raw = await mongoose.connection
      .collection("competitionparticipants")
      .findOne({ userId: "voided-only" });

    expect(raw && "score" in raw).toBe(false);

    const ranked = rank(await storedParticipants(contest._id.toString()));
    expect(ranked[0].qualificationStatus).toBe("disqualified");
  });
});

describe("the play screen can say 'no score yet'", () => {
  it("reports no participant score for a seated player who has not scored", async () => {
    const contest = await seedContest();
    await seedTitle();
    await seatFor(contest._id.toString(), "waiting");

    const outcome = await getPlayState(contest._id.toString(), "waiting");
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    /*
      `?? 0` here was what made the lobby's own comment false. That comment says the hero tile
      must show a dash because "an absent score and a score of nothing are different facts" -
      and the tile could never show one, because the service had already replaced the absence.
    */
    expect(outcome.state.participantScore).toBeUndefined();
  });

  it("reports the score once one exists", async () => {
    const contest = await seedContest();
    await seedTitle();
    await seatFor(contest._id.toString(), "player");

    const round = await launchedRound(contest._id, "player");
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 77),
      eventId: "evt_p",
      source: "manual",
    });

    const outcome = await getPlayState(contest._id.toString(), "player");
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    expect(outcome.state.participantScore).toBe(77);
  });

  it("renders a dash rather than a nought on the hero tile", () => {
    /*
      Structural, because the lobby is a client component and the tile's value is a string
      built from an optional number. Asserted as position within the construct rather than as
      a bare mention of `participantScore`: the identifier appears in the result panel too,
      and a bare match is green on a screen that has gone back to `?? 0`.
    */
    const lobby = fs.readFileSync(
      path.join(process.cwd(), "components/games/ProviderContestLobby.tsx"),
      "utf8",
    );

    expect(lobby).toMatch(
      /typeof state\?\.participantScore === "number"[\s\S]{0,200}toLocaleString\(\)[\s\S]{0,80}: "-"/,
    );

    const service = fs.readFileSync(
      path.join(process.cwd(), "lib/services/games/round-status.service.ts"),
      "utf8",
    );
    expect(service).not.toMatch(/participant\.score \?\? 0/);
  });
});
