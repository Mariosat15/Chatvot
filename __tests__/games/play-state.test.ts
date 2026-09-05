import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
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
import GameRound from "../../database/models/games/game-round.model";
import { getPlayState } from "../../lib/services/games/round-status.service";
import { attemptsPermitted } from "../../lib/services/games/round.service";

/**
 * What one player may learn about a provider contest they have entered.
 *
 * The load-bearing test here is the `userId` scoping one. Everything else in this file describes
 * a screen; that one describes an edge in a money contest, and its failure mode is a 200 with
 * correct-looking data rather than an error.
 */

const PLAYER = "68b5c1a2d4e5f60718293a4b";
const RIVAL = "68b5c1a2d4e5f60718293a4c";

async function seedContest(
  overrides: Record<string, unknown> = {},
): Promise<mongoose.Types.ObjectId> {
  // Reason the fixture is complete rather than trimmed to the fields under test: Mongoose
  // validates the whole document, so an omitted `slug` or `startTime` fails every test in the
  // file at once for one unrelated reason. That has happened three times in this codebase, and
  // it recurs because trimming a fixture always feels like tidying.
  const contest = await Competition.create({
    name: "Puzzle Cup",
    slug: `puzzle-cup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: "A provider game contest",
    createdBy: PLAYER,
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 3_600_000),
    registrationDeadline: new Date(Date.now() - 120_000),
    status: "active",
    entryFee: 5,
    prizePool: 10,
    gameType: "provider",
    gameKey: "acme:puzzle-blitz",
    gameConfig: { providerKey: "acme", gameCode: "puzzle-blitz" },
    playWindowStart: new Date(Date.now() - 30_000),
    playWindowEnd: new Date(Date.now() + 1_800_000),
    resultGracePeriodSeconds: 120,
    attemptsPolicy: "best_of_n",
    attemptsAllowed: 3,
    unresolvedRoundPolicy: "score_zero",
    ...overrides,
  });
  return contest._id as mongoose.Types.ObjectId;
}

async function seatPlayer(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  score = 0,
) {
  return CompetitionParticipant.create({
    competitionId: contestId,
    userId,
    username: `player-${userId.slice(-4)}`,
    // Required by the schema and read by nothing here. Same trimmed-fixture trap as the
    // contest above: eight tests failed on this one absent field before it was added.
    email: `player-${userId.slice(-4)}@example.test`,
    gameKey: "acme:puzzle-blitz",
    score,
  });
}

async function seedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber: number,
  status: string,
  rawScore?: number,
) {
  return GameRound.create({
    roundId: `cv_rnd_${userId.slice(-4)}_${attemptNumber}_${Math.random().toString(16).slice(2)}`,
    providerKey: "acme",
    gameCode: "puzzle-blitz",
    gameKey: "acme:puzzle-blitz",
    userId,
    contestType: "competition",
    contestId,
    attemptNumber,
    mode: "ranked",
    status,
    rawScore,
    expiresAt: new Date(Date.now() + 600_000),
  });
}

describe("reading a player's own play state", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    await mongoose.connect(uri);
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "game_round",
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  /**
   * THE SECURITY TEST.
   *
   * A provider contest ranks players against each other for money, so another player's score
   * before the leaderboard is published is an edge. The whole service is scoped to one `userId`,
   * and this proves it - note the rival's round is seeded with a distinctive score so a leak
   * would be unmistakable rather than merely a count being wrong.
   */
  it("never returns another player's rounds or score", async () => {
    const contestId = await seedContest();
    await seatPlayer(contestId, PLAYER, 100);
    await seatPlayer(contestId, RIVAL, 999);

    await seedRound(contestId, PLAYER, 1, "completed", 100);
    await seedRound(contestId, RIVAL, 1, "completed", 999);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.state.rounds).toHaveLength(1);
    expect(outcome.state.rounds[0].score).toBe(100);
    expect(outcome.state.participantScore).toBe(100);

    // The rival's number must appear nowhere in the payload, not merely not in `rounds`.
    expect(JSON.stringify(outcome.state)).not.toContain("999");
  });

  /**
   * The attempts arithmetic must agree with what `createRound` enforces, or the screen offers a
   * Play button the API then refuses - or worse, hides one it would have allowed.
   */
  it("counts a voided round as not used, exactly as the round service does", async () => {
    const contestId = await seedContest();
    await seatPlayer(contestId, PLAYER);

    await seedRound(contestId, PLAYER, 1, "voided", undefined);
    await seedRound(contestId, PLAYER, 2, "completed", 42);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    // Two rounds exist, one is voided, so one attempt has been used out of three.
    expect(outcome.state.rounds).toHaveLength(2);
    expect(outcome.state.attemptsUsed).toBe(1);
    expect(outcome.state.attemptsRemaining).toBe(2);
  });

  it("takes the permitted count from the round service rather than restating it", async () => {
    // `single` must mean one even when `attemptsAllowed` says three - a contest can hold both
    // values and the policy wins. Asserting against the imported helper is what stops this
    // service growing its own copy of that rule.
    const contestId = await seedContest({
      attemptsPolicy: "single",
      attemptsAllowed: 3,
    });
    await seatPlayer(contestId, PLAYER);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.state.attemptsPermitted).toBe(
      attemptsPermitted({
        attemptsPolicy: "single",
        attemptsAllowed: 3,
        playWindowEnd: new Date(),
      }),
    );
    expect(outcome.state.attemptsPermitted).toBe(1);
  });

  it("offers a live round to resume and marks it live", async () => {
    const contestId = await seedContest();
    await seatPlayer(contestId, PLAYER);
    await seedRound(contestId, PLAYER, 1, "launched");

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.state.liveRound).not.toBeNull();
    expect(outcome.state.liveRound?.attemptNumber).toBe(1);
    expect(outcome.state.liveRound?.isLive).toBe(true);
  });

  /**
   * Absent is not zero, and the two are indistinguishable once flattened.
   *
   * A launched round showing `0` would tell a player they had scored nothing while they were
   * still playing - and zero is a legitimate score, so there is no value that can mean both.
   */
  it("withholds a score from a round that has not been scored", async () => {
    const contestId = await seedContest();
    await seatPlayer(contestId, PLAYER);
    await seedRound(contestId, PLAYER, 1, "launched", undefined);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.state.rounds[0].score).toBeUndefined();
  });

  it("reports a genuine zero score on a completed round", async () => {
    const contestId = await seedContest();
    await seatPlayer(contestId, PLAYER);
    await seedRound(contestId, PLAYER, 1, "completed", 0);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    // The pair of tests is the point: one value must not serve for "none yet" and "scored zero".
    expect(outcome.state.rounds[0].score).toBe(0);
  });

  it("refuses a player who holds no seat, before revealing anything about the contest", async () => {
    const contestId = await seedContest();
    // Deliberately no participant row for PLAYER.

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.refusal).toBe("not_a_participant");
  });

  it("refuses a trading contest rather than describing it as unplayable", async () => {
    // A trading contest reached through a /play URL is not a broken provider contest, and the
    // caller redirects on this specific refusal instead of showing an error.
    const contestId = await seedContest({
      gameType: "trading",
      gameKey: "trading",
      gameConfig: undefined,
      startingCapital: 10_000,
    });
    await seatPlayer(contestId, PLAYER);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.refusal).toBe("not_provider_contest");
  });

  it("refuses a provider contest whose round settings never persisted", async () => {
    // Never defaults them. A contest running on settings no operator chose is the failure the
    // publish checklist exists to prevent, and guessing here would reintroduce it after the fact.
    const contestId = await seedContest({ attemptsPolicy: undefined });
    await seatPlayer(contestId, PLAYER);

    const outcome = await getPlayState(contestId.toString(), PLAYER);
    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.refusal).toBe("misconfigured");
  });

  it("does not treat a malformed competition id as a database error", async () => {
    const outcome = await getPlayState("not-an-object-id", PLAYER);
    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.refusal).toBe("not_found");
  });
});
