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

import Challenge from "../../database/models/trading/challenge.model";
import ChallengeParticipant from "../../database/models/trading/challenge-participant.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import GameRound from "../../database/models/games/game-round.model";
import { applyResult } from "../../lib/services/games/result-ingestion.service";

/**
 * THE CHALLENGE HALF OF THE SCORE SEAM, WHICH `participant-score-arrival.test.ts` NEVER
 * COVERED. That file drives `applyResult` exclusively through `contestType: "competition"`
 * fixtures, so `syncParticipantScore`'s `isChallenge` branch - reading `Challenge` instead of
 * `Competition`, writing `ChallengeParticipant` instead of `CompetitionParticipant` - has run
 * against a real database exactly zero times before this file.
 *
 * The risk this closes is the same one R32/R33/R50 already found twice on the competition
 * side: `syncParticipantScore` is one function branching on `contestType`, deliberately, so
 * every arithmetic mistake it could make is already pinned by the competition suite. What
 * is NOT shared is the two `findOneAndUpdate` filters (`{ challengeId, userId }` vs
 * `{ competitionId, userId }`) and the two `findById` reads (`Challenge` vs `Competition`) -
 * exactly the kind of "one rule, two copies" seam this codebase keeps finding wrong on one
 * side and not the other. A typo in either filter fails silently: `syncParticipantScore`
 * returns `{ synced: false, reason: "no participant row..." }`, `applyResult` logs one
 * `console.error` line, and the round result is still accepted - so nothing before this test
 * would have told anyone the challenge branch was wired to the wrong collection.
 */

const PROVIDER_KEY = "mock";
const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "challenges",
    "challengeparticipants",
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
    supportsOneVsOne: true,
    providerStatus: "active",
    chartvoltEnabled: true,
  });
}

/** A provider challenge, satisfying the whole schema - `gameType: "provider"` drops the
 * unconditional `startingCapital` requirement, exactly as it does on `Competition`. */
async function seedProviderChallenge(attemptsPolicy: string) {
  const now = Date.now();
  return Challenge.create({
    slug: `puzzle-duel-${now}-${Math.random().toString(16).slice(2)}`,
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: { providerKey: PROVIDER_KEY, gameCode: GAME_CODE, settings: {} },
    attemptsPolicy,
    attemptsAllowed: 3,
    challengerId: new mongoose.Types.ObjectId().toString(),
    challengerName: "Ada",
    challengerEmail: "ada@example.com",
    challengedId: new mongoose.Types.ObjectId().toString(),
    challengedName: "Bo",
    challengedEmail: "bo@example.com",
    entryFee: 20,
    prizePool: 40,
    platformFeePercentage: 10,
    winnerPrize: 36,
    acceptDeadline: new Date(now + 3_600_000),
    startTime: new Date(now - 60_000),
    endTime: new Date(now + 3_600_000),
    duration: 60,
    status: "active",
    assetClasses: [],
    allowedSymbols: [],
    blockedSymbols: [],
  });
}

async function seatFor(challengeId: string, userId: string, role: "challenger" | "challenged") {
  return ChallengeParticipant.create({
    challengeId,
    userId,
    username: role === "challenger" ? "Ada" : "Bo",
    email: `${role}@example.com`,
    role,
    gameKey: GAME_KEY,
    joinedAt: new Date(),
  });
}

async function launchedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber: number,
  status: "launched" | "unresolved" = "launched",
) {
  return GameRound.create({
    roundId: `cv_rnd_${Math.random().toString(16).slice(2).padEnd(24, "0")}`,
    providerKey: PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId,
    contestType: "challenge",
    contestId,
    attemptNumber,
    mode: "ranked",
    status,
    expiresAt: new Date(Date.now() + 600_000),
  });
}

function resultFor(roundId: string, rawScore: number, status: "completed" | "expired" | "abandoned" | "voided" = "completed") {
  return {
    roundId,
    providerRoundId: `p_${roundId}`,
    status,
    rawScore,
    completedAt: new Date(),
  };
}

const CHALLENGER = new mongoose.Types.ObjectId().toString();

describe("a provider score reaches the CHALLENGE participant row, not the competition one", () => {
  it("writes the score onto ChallengeParticipant via the challengeId filter", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    const outcome = await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 740),
      source: "manual",
    });

    expect(outcome.accepted).toBe(true);

    const seat = await ChallengeParticipant.findOne({
      challengeId: challenge._id,
      userId: CHALLENGER,
    });
    expect(seat?.score).toBe(740);
  });

  it("does NOT write to CompetitionParticipant - proves the two collections cannot cross-contaminate", async () => {
    // Reason this is its own assertion rather than an implication of the test above: the
    // `isChallenge` branch reads `contestType` off the ROUND to choose which model to touch,
    // and a round whose `contestType` disagrees with which participant collection actually
    // holds a matching row would leave BOTH branches reporting a plausible "no participant
    // row" refusal - so an assertion that only checks the right collection got written
    // cannot tell "wired correctly" from "wired to nothing, twice".
    const CompetitionParticipant = (
      await import("../../database/models/trading/competition-participant.model")
    ).default;

    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 740),
      source: "manual",
    });

    const stray = await CompetitionParticipant.findOne({ userId: CHALLENGER });
    expect(stray).toBeNull();
  });

  it("stores the RAW score for a lower-is-better game, never a negated one", async () => {
    await seedTitle("lower_is_better");
    const challenge = await seedProviderChallenge("single");
    await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 9_800),
      source: "manual",
    });

    const seat = await ChallengeParticipant.findOne({
      challengeId: challenge._id,
      userId: CHALLENGER,
    });
    expect(seat?.score).toBe(9_800);
  });

  it("keeps the best attempt under best_of_n, reading Challenge's own attemptsPolicy", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("best_of_n");
    await seatFor(String(challenge._id), CHALLENGER, "challenger");

    const first = await launchedRound(challenge._id, CHALLENGER, 1, "unresolved");
    const second = await launchedRound(challenge._id, CHALLENGER, 2, "launched");

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

    const seat = await ChallengeParticipant.findOne({
      challengeId: challenge._id,
      userId: CHALLENGER,
    });
    expect(seat?.score).toBe(880);
  });

  it("is idempotent - re-applying the same result does not inflate a sum", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("sum_of_n");
    await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 500),
      source: "manual",
    });
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 500),
      source: "manual",
    });

    const seat = await ChallengeParticipant.findOne({
      challengeId: challenge._id,
      userId: CHALLENGER,
    });
    expect(seat?.score).toBe(500);
  });

  it("leaves an absent score absent when nothing contributed, never a phantom zero", async () => {
    // R50's own fix, re-proven on the model it was fixed on. `combineRoundScores` returns 0
    // for an empty list - correct for its own job - so `syncParticipantScore` must `$unset`
    // rather than `$set` when nothing scored, on EITHER contest type.
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    const seat = await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 5000, "voided"),
      source: "manual",
    });

    const after = await ChallengeParticipant.findById(seat._id);
    expect(after?.score).toBeUndefined();
  });

  it("counts a run the CHALLENGE's own window cut short (expired), matching the competition rule", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    const seat = await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 2140, "expired"),
      source: "manual",
    });

    expect((await ChallengeParticipant.findById(seat._id))?.score).toBe(2140);
  });

  it("refuses to score a challenge with no attempts policy rather than guessing one", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    await Challenge.updateOne(
      { _id: challenge._id },
      { $unset: { attemptsPolicy: "" } },
    );
    const seat = await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

    const outcome = await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(round.roundId, 615),
      source: "manual",
    });

    // The round result is still stored - it is evidence, and the provider billed us for it.
    expect(outcome.accepted).toBe(true);
    expect((await GameRound.findOne({ roundId: round.roundId }))?.rawScore).toBe(615);

    expect((await ChallengeParticipant.findById(seat._id))?.score).toBeUndefined();
  });

  it("still records the round when there is no participant row to update", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    const round = await launchedRound(challenge._id, CHALLENGER, 1);

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

  it("does not touch a participant row for a practice round tied to a challenge's game", async () => {
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    const seat = await seatFor(String(challenge._id), CHALLENGER, "challenger");

    const round = await GameRound.create({
      roundId: `cv_rnd_${Math.random().toString(16).slice(2).padEnd(24, "0")}`,
      providerKey: PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: CHALLENGER,
      contestType: "practice",
      contestId: challenge._id,
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

    const after = await ChallengeParticipant.findById(seat._id);
    expect(after?.score).toBeUndefined();
  });

  it("ranks the two sides of one challenge independently, each on their own rounds", async () => {
    // The shape a competition fixture cannot show: exactly two participants sharing one
    // contest document, each with their own attempt history, settling to different scores.
    await seedTitle();
    const challenge = await seedProviderChallenge("single");
    const challenged = new mongoose.Types.ObjectId().toString();

    const challengerSeat = await seatFor(String(challenge._id), CHALLENGER, "challenger");
    const challengedSeat = await seatFor(String(challenge._id), challenged, "challenged");

    const challengerRound = await launchedRound(challenge._id, CHALLENGER, 1);
    const challengedRound = await launchedRound(challenge._id, challenged, 1);

    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(challengerRound.roundId, 610),
      source: "manual",
    });
    await applyResult({
      providerKey: PROVIDER_KEY,
      normalised: resultFor(challengedRound.roundId, 890),
      source: "manual",
    });

    expect((await ChallengeParticipant.findById(challengerSeat._id))?.score).toBe(610);
    expect((await ChallengeParticipant.findById(challengedSeat._id))?.score).toBe(890);
  });
});
