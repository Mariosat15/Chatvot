import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import GameRound from "../../database/models/games/game-round.model";
import GameProvider from "../../database/models/games/game-provider.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { getProviderAdapter } from "../../lib/services/game-providers/registry";
import { createRound } from "../../lib/services/games/round.service";
import {
  clearPracticeRounds,
  deletePracticeRound,
  endLivePracticeRounds,
  pullLivePracticeResults,
} from "../../lib/services/games/practice-round.service";

/**
 * Practice rounds through `createRound`.
 *
 * Reason: every practice round shares `contestId: null`, so the two contest rules keyed on the
 * contest - one live round, and the attempts limit - would otherwise treat ALL of a player's
 * practice, across every game, as a single contest. The first would resume a Sprint round when
 * the player pressed Practice on Volt Stack; the second would refuse the second practice round
 * ever played, because practice runs under `attemptsPolicy: "single"`.
 */

const GAME_A = "mock-trivia";
const GAME_B = "mock-sprint";
const keyOf = (code: string) => `provider:${MOCK_PROVIDER_KEY}:${code}`;

beforeAll(async () => {
  const uri = await startTestMongo();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections([
    "game_round",
    "provider_game",
    "game_provider",
    "whitelabels",
    "game_catalogue_entry",
  ]);
  const mock = getProviderAdapter(MOCK_PROVIDER_KEY) as MockProviderAdapter;
  mock.reset();
  mock.configure({ callbackSecret: "practice-secret" });
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [{ providerKey: MOCK_PROVIDER_KEY, enabled: true }],
  });
  // Reason: getBrowsableGameBySlug / ensureCatalogueEntries join GameProvider.enabled —
  // without this row finish / delete / clear-all refuse with "Game not found".
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock",
    baseUrl: "https://mock.example",
    enabled: true,
    healthStatus: "healthy",
    healthFailureStreak: 0,
  });
  for (const code of [GAME_A, GAME_B]) {
    await ProviderGame.create({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: code,
      gameKey: keyOf(code),
      displayName: code,
      family: "independent",
      supportsPractice: true,
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      scoreRange: { min: 0, max: 1000 },
      providerStatus: "active",
      chartvoltEnabled: true,
    });
  }
});

function practice(userId: string, code: string) {
  return createRound({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: code,
    gameKey: keyOf(code),
    userId,
    contestType: "practice",
    contestId: null,
    participantId: null,
    config: {
      attemptsPolicy: "single",
      playWindowEnd: new Date(Date.now() + 60 * 60 * 1000),
      roundStartPolicy: "until_window_closes",
      maxDurationSeconds: 300,
    },
    returnUrl: "https://chartvolt.test/games/x/practice",
    parentOrigin: "https://chartvolt.test",
    resultCallbackUrl: "https://chartvolt.test/api/games/providers/mock/events",
  });
}

describe("practice rounds", () => {
  it("never run out of attempts", async () => {
    const userId = new Types.ObjectId().toString();
    for (let i = 1; i <= 3; i += 1) {
      const outcome = await practice(userId, GAME_A);
      expect(outcome.success).toBe(true);
      if (!outcome.success) return;
      expect(outcome.idempotent).toBe(false);
      await GameRound.updateOne({ roundId: outcome.roundId }, { $set: { status: "completed" } });
    }
    expect(await GameRound.countDocuments({ userId, contestType: "practice" })).toBe(3);
  });

  it("resumes a live practice round of the SAME game", async () => {
    const userId = new Types.ObjectId().toString();
    const first = await practice(userId, GAME_A);
    const second = await practice(userId, GAME_A);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.idempotent).toBe(true);
    expect(second.roundId).toBe(first.roundId);
  });

  it("does not resume another game's live practice round", async () => {
    const userId = new Types.ObjectId().toString();
    const a = await practice(userId, GAME_A);
    const b = await practice(userId, GAME_B);
    expect(a.success && b.success).toBe(true);
    if (!a.success || !b.success) return;
    expect(b.idempotent).toBe(false);
    expect(b.roundId).not.toBe(a.roundId);
    const stored = await GameRound.findOne({ roundId: b.roundId }).lean<{ gameKey: string }>();
    expect(stored?.gameKey).toBe(keyOf(GAME_B));
  });
});

/**
 * Practice results are pulled, not pushed.
 *
 * A provider never pushes a practice result (requirements v1.10). The 28 Sep "keep no result"
 * rule voided on leave; owner reversed that on 6 Oct 2026 - practice must show the score.
 * Leaving MID-ROUND still voids. A finished round is pulled and kept.
 */
describe("practice results are pulled, not pushed", () => {
  it("a finished practice round is closed by the pull, so the next Start opens a new one", async () => {
    const userId = new Types.ObjectId().toString();
    const first = await practice(userId, GAME_A);
    expect(first.success).toBe(true);
    if (!first.success) return;

    await pullLivePracticeResults(userId, keyOf(GAME_A));
    const stored = await GameRound.findOne({ roundId: first.roundId }).lean<{
      status: string;
      resultSource?: string;
      rawScore?: number;
    }>();
    expect(stored?.status).toBe("completed");
    expect(stored?.resultSource).toBe("poll");
    expect(typeof stored?.rawScore).toBe("number");

    const second = await practice(userId, GAME_A);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.idempotent).toBe(false);
    expect(second.roundId).not.toBe(first.roundId);
  });

  it("never touches another player's or another game's round", async () => {
    const owner = new Types.ObjectId().toString();
    const round = await practice(owner, GAME_A);
    expect(round.success).toBe(true);
    if (!round.success) return;

    await pullLivePracticeResults(new Types.ObjectId().toString(), keyOf(GAME_A));
    await pullLivePracticeResults(owner, keyOf(GAME_B));
    const stored = await GameRound.findOne({ roundId: round.roundId }).lean<{ status: string }>();
    expect(stored?.status).not.toBe("completed");
  });
});

describe("leaving a practice round closes it", () => {
  it("voids a still-live round here and asks the provider to void it, so the next Start opens a new one", async () => {
    const mock = getProviderAdapter(MOCK_PROVIDER_KEY) as MockProviderAdapter;
    const voided = vi.spyOn(mock, "voidRound");
    const userId = new Types.ObjectId().toString();
    const first = await practice(userId, GAME_A);
    expect(first.success).toBe(true);
    if (!first.success) return;

    expect(await endLivePracticeRounds(userId, keyOf(GAME_A), first.roundId)).toBe(1);
    const stored = await GameRound.findOne({ roundId: first.roundId }).lean<{
      status: string;
      rawScore?: number;
      resultSource?: string;
    }>();
    expect(stored?.status).toBe("voided");
    expect(stored?.rawScore).toBeUndefined();
    expect(stored?.resultSource).toBeUndefined();
    expect(voided).toHaveBeenCalledWith(first.roundId);

    const second = await practice(userId, GAME_A);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.idempotent).toBe(false);
    expect(second.roundId).not.toBe(first.roundId);
    voided.mockRestore();
  });

  it("does not void a practice round that already has a scored result", async () => {
    // Reason: the 28 Sep host DELETEd after finished and rewrote completed → voided, which
    // emptied the recent list. Leaving must only close LIVE rounds.
    const userId = new Types.ObjectId().toString();
    const first = await practice(userId, GAME_A);
    expect(first.success).toBe(true);
    if (!first.success) return;
    await GameRound.updateOne(
      { roundId: first.roundId },
      { $set: { status: "completed", rawScore: 42, resultSource: "poll" } },
    );

    expect(await endLivePracticeRounds(userId, keyOf(GAME_A), first.roundId)).toBe(0);
    const stored = await GameRound.findOne({ roundId: first.roundId }).lean<{
      status: string;
      rawScore?: number;
    }>();
    expect(stored?.status).toBe("completed");
    expect(stored?.rawScore).toBe(42);
  });

  it("is idempotent: a round already closed ends nothing", async () => {
    const userId = new Types.ObjectId().toString();
    const round = await practice(userId, GAME_A);
    expect(round.success).toBe(true);
    if (!round.success) return;
    expect(await endLivePracticeRounds(userId, keyOf(GAME_A), round.roundId)).toBe(1);
    expect(await endLivePracticeRounds(userId, keyOf(GAME_A), round.roundId)).toBe(0);
  });

  it("never touches another player's or another game's round", async () => {
    const owner = new Types.ObjectId().toString();
    const round = await practice(owner, GAME_A);
    expect(round.success).toBe(true);
    if (!round.success) return;

    await endLivePracticeRounds(new Types.ObjectId().toString(), keyOf(GAME_A));
    await endLivePracticeRounds(owner, keyOf(GAME_B));
    const stored = await GameRound.findOne({ roundId: round.roundId }).lean<{ status: string }>();
    expect(stored?.status).not.toBe("voided");
  });

  it("never touches a contest round, even the same player's on the same game", async () => {
    const userId = new Types.ObjectId().toString();
    const practiceRound = await practice(userId, GAME_A);
    expect(practiceRound.success).toBe(true);
    if (!practiceRound.success) return;
    // Reason: the raw collection, because both fields are immutable on the model and Mongoose
    // silently drops an update to an immutable path - the fixture would change nothing.
    await GameRound.collection.updateOne(
      { roundId: practiceRound.roundId },
      { $set: { contestType: "competition", contestId: new Types.ObjectId() } },
    );

    expect(await endLivePracticeRounds(userId, keyOf(GAME_A))).toBe(0);
    const stored = await GameRound.findOne({ roundId: practiceRound.roundId }).lean<{
      status: string;
    }>();
    expect(stored?.status).not.toBe("voided");
  });
});

describe("practice history delete and clear-all", () => {
  it("refuses to delete a live round and deletes a finished one for the same player and game", async () => {
    const userId = new Types.ObjectId().toString();
    const live = await practice(userId, GAME_A);
    expect(live.success).toBe(true);
    if (!live.success) return;

    const refused = await deletePracticeRound(GAME_A, userId, live.roundId);
    expect(refused.found).toBe(true);
    expect(refused.deleted).toBe(false);

    await pullLivePracticeResults(userId, keyOf(GAME_A));
    const forgotten = await deletePracticeRound(GAME_A, userId, live.roundId);
    expect(forgotten.found).toBe(true);
    expect(forgotten.deleted).toBe(true);
    expect(await GameRound.countDocuments({ roundId: live.roundId })).toBe(0);
  });

  it("clear-all removes finished history and leaves a live round alone", async () => {
    const userId = new Types.ObjectId().toString();
    const first = await practice(userId, GAME_A);
    expect(first.success).toBe(true);
    if (!first.success) return;
    await pullLivePracticeResults(userId, keyOf(GAME_A));

    const second = await practice(userId, GAME_A);
    expect(second.success).toBe(true);
    if (!second.success) return;

    const cleared = await clearPracticeRounds(GAME_A, userId);
    expect(cleared.found).toBe(true);
    expect(cleared.deleted).toBeGreaterThanOrEqual(1);
    expect(await GameRound.countDocuments({ roundId: second.roundId })).toBe(1);
    expect(
      await GameRound.countDocuments({
        userId,
        contestType: "practice",
        status: "completed",
        gameKey: keyOf(GAME_A),
      }),
    ).toBe(0);
  });
});
