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
import ProviderGame from "../../database/models/games/provider-game.model";
import GameRound from "../../database/models/games/game-round.model";
import { applyResult } from "../../lib/services/games/result-ingestion.service";

/**
 * THE TEST WHOSE ABSENCE LET A PRIZE-DISTRIBUTION BUG SHIP AS "CODE-COMPLETE".
 *
 * It asserts one thing the settlement suites structurally cannot: that a score **arrives** at
 * the participant row ranking reads. Those suites seed `score: 900 / 500 / 100` on the
 * participants and then rank them, which proves ranking works *given* scores and is silent on
 * whether one ever gets written. It never was - `applyResult` wrote `game_round` and stopped,
 * so every provider participant would have settled on the seat default of zero, tied at rank
 * 1, and split the pool equally however well they played.
 *
 * The generalisable rule, second instance after trading finalization's `pnl`: **a fixture that
 * supplies the value under test has tested the consumer, not the producer.** When a value
 * crosses a seam, one test must start on the far side of it.
 *
 * These go through `applyResult` rather than calling the sync directly, because the thing that
 * was missing was the CALL, not the arithmetic. A test aimed at `syncParticipantScore` alone
 * would have passed against the broken code.
 */

const PROVIDER_KEY = "mock";
const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

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

/**
 * The catalogue entry gate 10 checks the score against.
 *
 * `scoreRange` is deliberately wide: this suite is about the seam, and a range refusal would
 * mark the round `unresolved` and never reach the sync - a green test measuring the wrong path.
 */
async function seedTitle(
  scoreDirection: "higher_is_better" | "lower_is_better" = "higher_is_better",
) {
  await ProviderGame.create({
    providerKey: PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    family: "independent",
    scoreType: "integer",
    scoreDirection,
    maxDurationSeconds: 300,
    supportsCompetition: true,
    providerStatus: "active",
    chartvoltEnabled: true,
  });
}

/** Satisfies the WHOLE competition schema, not the subset a round touches. */
async function seedContest(attemptsPolicy: string) {
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
    attemptsPolicy,
    attemptsAllowed: 3,
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
    prizePool: 5,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId().toString(),
  });
}

async function seatFor(competitionId: string, userId: string) {
  return CompetitionParticipant.create({
    competitionId,
    userId,
    username: "player",
    email: "player@example.com",
    gameKey: GAME_KEY,
    enteredAt: new Date(),
  });
}

/**
 * A round in a given state.
 *
 * `status` is a parameter because of a real constraint this suite ran into: the partial unique
 * index `one_live_round_per_player_per_contest` forbids two rounds at `pending` or `launched`
 * for the same player in the same contest. Seeding two launched rounds to test multi-attempt
 * aggregation fails with E11000 - **the fixture was wrong, not the code**, and the index doing
 * its job is the abandon-and-peek guarantee from X3. So a multi-attempt test has to move the
 * first round out of a live state before opening the second, which is what really happens.
 */
async function roundAt(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber: number,
  status: "launched" | "unresolved",
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
    status,
    expiresAt: new Date(Date.now() + 600_000),
  });
}

async function launchedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber: number,
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

function resultFor(roundId: string, rawScore: number, direction = "higher_is_better") {
  return {
    roundId,
    providerRoundId: `p_${roundId}`,
    status: "completed" as const,
    rawScore,
    scoreDirection: direction as "higher_is_better" | "lower_is_better",
    completedAt: new Date(),
  };
}

const USER = new mongoose.Types.ObjectId().toString();

describe("a provider score reaches the participant row ranking reads", () => {
  it("writes the score onto the participant, not only onto the round", async () => {
    await seedTitle();
    const contest = await seedContest("single");
    await seatFor(String(contest._id), USER);
    const round = await launchedRound(contest._id, USER, 1);

    const outcome = await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 740),
      source: "manual",
    });

    expect(outcome.accepted).toBe(true);

    // The round, which always worked.
    const storedRound = await GameRound.findOne({ roundId: round.roundId });
    expect(storedRound?.rawScore).toBe(740);
    expect(storedRound?.status).toBe("completed");

    // The participant, which never did. This is the assertion that was missing.
    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(740);
  });

  it("stores the RAW score for a lower-is-better game, never a negated one", async () => {
    // Chapter 05: `participant.score` holds the raw, displayable value. A stored `-9800` would
    // show a race time as negative on every leaderboard and profile, and poison any cross-game
    // total that sums it. Negation happens at comparison, inside the ranking module.
    //
    // This test replaced one asserting `participant.scoreDirection`. That field was added here
    // and then removed: chapter 05 keeps direction OFF the participant so two rows in one
    // leaderboard cannot disagree, and settlement now reads it once from the catalogue title.
    await seedTitle("lower_is_better");
    const contest = await seedContest("single");
    await seatFor(String(contest._id), USER);
    const round = await launchedRound(contest._id, USER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 9_800, "lower_is_better"),
      source: "manual",
    });

    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(9_800);
  });

  it("keeps the best attempt under best_of_n, whichever order results arrive in", async () => {
    // Out-of-order arrival is normal: a late poll for attempt 1 can land after attempt 2's
    // callback. Recomputing from persisted rounds is what makes the answer independent of
    // arrival order - a last-write-wins assignment would leave the participant on 310.
    //
    // Attempt 1 is seeded `unresolved` rather than `launched`: the reconciliation net moved it
    // there when it missed its window, which is exactly why the player was able to open
    // attempt 2, and `unresolved -> completed` is a legal transition for the late result.
    await seedTitle();
    const contest = await seedContest("best_of_n");
    await seatFor(String(contest._id), USER);

    const first = await roundAt(contest._id, USER, 1, "unresolved");
    const second = await roundAt(contest._id, USER, 2, "launched");

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(second.roundId, 880),
      source: "manual",
    });
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(first.roundId, 310),
      source: "manual",
    });

    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(880);
  });

  it("adds attempts up under sum_of_n", async () => {
    await seedTitle();
    const contest = await seedContest("sum_of_n");
    await seatFor(String(contest._id), USER);

    // The natural sequence, and the one the live-round index requires: play attempt 1 to
    // completion, then open attempt 2.
    const first = await launchedRound(contest._id, USER, 1);
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(first.roundId, 200),
      source: "manual",
    });

    const second = await launchedRound(contest._id, USER, 2);
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(second.roundId, 45),
      source: "manual",
    });

    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(245);
  });

  it("is idempotent - re-applying the same result does not inflate a sum", async () => {
    // The reason the sync recomputes rather than increments. Gate 6 dedupes by `eventId`, but
    // a poll and a callback reporting the same round carry different event ids by design, so
    // `applyResult` genuinely can run twice for one round.
    await seedTitle();
    const contest = await seedContest("sum_of_n");
    await seatFor(String(contest._id), USER);
    const round = await launchedRound(contest._id, USER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 500),
      source: "manual",
    });
    // Second delivery of the same round. Gate 8 refuses the transition on an already-completed
    // round, so what is being proven is that the refusal leaves the score alone rather than
    // adding to it.
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 500),
      source: "manual",
    });

    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(500);
  });

  it("leaves a legitimate zero as zero rather than as no score", async () => {
    await seedTitle();
    const contest = await seedContest("single");
    await seatFor(String(contest._id), USER);
    const round = await launchedRound(contest._id, USER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 0),
      source: "manual",
    });

    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(0);
    // And the round is genuinely completed, so this is a played zero rather than an absence.
    const storedRound = await GameRound.findOne({ roundId: round.roundId });
    expect(storedRound?.status).toBe("completed");
  });

  it("does not touch a participant row for a practice round", async () => {
    // Practice is free, unranked and prize-less. A practice score reaching a paid contest's
    // participant row would be a ranking the player did not earn under contest conditions.
    //
    // THE FIXTURE CARRIES A REAL CONTEST ID DELIBERATELY, and the first version did not - it
    // passed `contestId: null`, which the very next guard catches, so removing the practice
    // check left the suite green and said nothing about it. A practice round tied to a
    // contest's game is the case this guard exists for, and it is the only fixture that can
    // tell the two guards apart.
    await seedTitle();
    const contest = await seedContest("single");
    const seat = await seatFor(String(contest._id), USER);

    const round = await GameRound.create({
      roundId: `cv_rnd_${Math.random().toString(16).slice(2).padEnd(24, "0")}`,
      providerKey: PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: USER,
      contestType: "practice",
      contestId: contest._id,
      attemptNumber: 1,
      mode: "practice",
      status: "launched",
      expiresAt: new Date(Date.now() + 600_000),
    });

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 999),
      source: "manual",
    });

    const after = await CompetitionParticipant.findById(seat._id);
    expect(after?.score).toBe(0);
  });

  it("refuses to score a contest with no attempts policy rather than guessing one", async () => {
    // Added because a probe that defaulted the policy to `single` left the suite green - there
    // was no test for the refusal at all. A missing test, not a weak one.
    //
    // Refusing is right even though it costs the player their score: publishing already
    // refuses a contest whose round settings did not persist, so this path is nearly
    // unreachable, and the alternative is ranking somebody under a rule no operator chose. It
    // logs loudly and the score is recoverable, because the sync recomputes from persisted
    // rounds whenever it is next called.
    await seedTitle();
    const contest = await seedContest("single");
    await Competition.updateOne(
      { _id: contest._id },
      { $unset: { attemptsPolicy: "" } },
    );
    await seatFor(String(contest._id), USER);
    const round = await launchedRound(contest._id, USER, 1);

    const outcome = await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 615),
      source: "manual",
    });

    // The round result is still stored - it is evidence, and the provider billed us for it.
    expect(outcome.accepted).toBe(true);
    const storedRound = await GameRound.findOne({ roundId: round.roundId });
    expect(storedRound?.rawScore).toBe(615);

    // But nothing was ranked on a guessed rule.
    const seat = await CompetitionParticipant.findOne({
      competitionId: contest._id,
      userId: USER,
    });
    expect(seat?.score).toBe(0);
  });

  it("still records the round when there is no participant row to update", async () => {
    // A round whose player holds no seat is the launch-service defect's aftermath. The result
    // must still be stored - it is evidence, and the provider has already billed us for it.
    await seedTitle();
    const contest = await seedContest("single");
    const round = await launchedRound(contest._id, USER, 1);

    const outcome = await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 400),
      source: "manual",
    });

    expect(outcome.accepted).toBe(true);
    const storedRound = await GameRound.findOne({ roundId: round.roundId });
    expect(storedRound?.rawScore).toBe(400);
    expect(storedRound?.status).toBe("completed");
  });
});
