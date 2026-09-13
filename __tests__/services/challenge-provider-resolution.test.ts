import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * `resolveChallengeProviderGame` (item 3 of the roadmap, `lib/services/games/challenge-
 * provider-resolution.ts`) - the resolver `POST /api/challenges` calls when a provider game
 * is picked, in front of `Challenge.create()`.
 *
 * THIS IS A MAIN-APP SERVICE WITH NO ADMIN COPY. It has no draft state - a player submitting
 * the create form is trying to play right now - so `externalGamesEnabled` is a HARD refusal
 * here, unlike `preflightProviderContest`'s warning for a competition draft. Several tests
 * below exist specifically to pin that asymmetry, because copying the competition path's
 * behaviour here would let a challenge be created while the picker that feeds this exact
 * route (`listChallengeableTitles`) has already hidden the title for the same reason.
 *
 * `runPreflight` is pure and already has its own suite (`contest-preflight.test.ts` /
 * equivalent); these tests are about what THIS resolver builds and passes to it - the
 * synthetic play window anchored at `now`, the derived result-grace period, and the
 * hard-coded `attemptsPolicy: "single"` / `roundStartPolicy: "reserve_full_round"` - not
 * about re-proving every branch of the checklist itself.
 */

// No `vi.mock` needed. This service does no I/O beyond the three lean reads it makes
// itself, and none of them go through `@/database/mongoose` - unlike the settlement
// services, it never calls `connectToDatabase()`, so there is nothing to intercept.

const GameProvider = (
  await import("@/database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("@/database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("@/database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { resolveChallengeProviderGame } = await import(
  "@/lib/services/games/challenge-provider-resolution"
);

const COLLECTIONS = ["game_provider", "provider_game", "whitelabels"];

const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;
const UNREGISTERED_PROVIDER_KEY = "acme-unregistered";

/** A provider, title and master switch with nothing stopping a challenge being created. */
async function seedCatalogue(overrides: {
  providerKey?: string;
  providerEnabled?: boolean;
  externalGamesEnabled?: boolean;
  title?: Record<string, unknown>;
} = {}): Promise<void> {
  const providerKey = overrides.providerKey ?? MOCK_PROVIDER_KEY;

  await GameProvider.create({
    providerKey,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: overrides.providerEnabled ?? true,
  });

  await ProviderGame.create({
    providerKey,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    // Real enum values, checked against `provider-game.model.ts` - a guessed pair fails the
    // whole suite on one validation error in `beforeEach`, which reads as every test broken
    // rather than one wrong fixture.
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: {
      type: "object",
      properties: {
        rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
    },
    lastSuccessfulRoundAt: new Date(),
    ...overrides.title,
  });

  await WhiteLabel.create({
    externalGamesEnabled: overrides.externalGamesEnabled ?? true,
  });
}

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
});

describe("resolveChallengeProviderGame", () => {
  it("refuses when the title is not in the provider's catalogue", async () => {
    await seedCatalogue();

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: "does-not-exist",
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("not in our catalogue");
  });

  it("refuses as a HARD gate when external games are switched off - a challenge has no draft state, unlike the competition path this deliberately does not reuse", async () => {
    await seedCatalogue({ externalGamesEnabled: false });

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    // Reason: `preflightProviderContest` phrases the SAME fact as a warning
    // ("...so this contest cannot run until..."). Pinning THIS wording, not merely `ok:
    // false`, is what would catch this resolver being swapped for that one.
    expect(result.error).toContain("switched off platform-wide right now");
  });

  it("coerces an empty settings submission into the schema's own defaults, and returns the catalogue's gameKey rather than deriving one from the request", async () => {
    await seedCatalogue();

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected refusal: ${result.error}`);
    expect(result.settings.rounds).toBe(5);
    expect(result.gameKey).toBe(GAME_KEY);
    expect(result.displayName).toBe("Mock Puzzle");
  });

  it("refuses when the submitted settings fail the schema's own validation", async () => {
    await seedCatalogue();

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: { rounds: 999 },
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.some((message) => message.includes("at most 20"))).toBe(true);
  });

  it("refuses when the provider is disabled, even though the title itself is fine", async () => {
    await seedCatalogue({ providerEnabled: false });

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.some((message) => message.includes("provider is disabled"))).toBe(
      true,
    );
  });

  it("refuses when no code connector is registered for the provider - `adapterInstalled` is checked independently of `enabled`", async () => {
    await seedCatalogue({ providerKey: UNREGISTERED_PROVIDER_KEY });

    const result = await resolveChallengeProviderGame({
      providerKey: UNREGISTERED_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(
      result.errors.some((message) => message.includes("No code connector is installed")),
    ).toBe(true);
  });

  it("refuses when the title does not support one-against-one challenges", async () => {
    await seedCatalogue({ title: { supportsOneVsOne: false } });

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(
      result.errors.some((message) =>
        message.includes("does not support one-against-one challenges"),
      ),
    ).toBe(true);
  });

  it("refuses when the title does not guarantee identical content for every player - `01` s4.3, checked unconditionally for both formats", async () => {
    await seedCatalogue({ title: { supportsContentSeed: false } });

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(
      result.errors.some((message) =>
        message.includes("does not guarantee identical content"),
      ),
    ).toBe(true);
  });

  it("refuses when the provider reports the title as deprecated rather than active", async () => {
    await seedCatalogue({ title: { providerStatus: "deprecated" } });

    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.some((message) => message.includes("deprecated"))).toBe(true);
  });

  it("refuses when the title's own declared play clock is longer than the requested challenge duration - the synthetic window is anchored at `now` for exactly this check", async () => {
    await seedCatalogue({
      title: {
        configSchema: {
          type: "object",
          properties: {
            durationSeconds: {
              type: "integer",
              format: "duration-seconds",
              default: 120,
            },
          },
        },
      },
    });

    // 1 minute requested, but the title's own clock defaults to 2 minutes.
    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(
      result.errors.some((message) => message.includes("longer than the contest itself")),
    ).toBe(true);
  });

  it("resolves successfully when the round fits inside the requested duration, threading a grace period the pre-flight itself demands back into its own check", async () => {
    await seedCatalogue({
      title: {
        configSchema: {
          type: "object",
          properties: {
            durationSeconds: {
              type: "integer",
              format: "duration-seconds",
              default: 120,
            },
          },
        },
      },
    });

    // 5 minutes requested against a 2-minute round - comfortably fits, and the derived
    // grace period (roundSeconds + RESULT_GRACE_MARGIN_SECONDS) must satisfy the pre-flight's
    // own minimum, which is exactly that formula. If the resolver ever hard-coded a fixed
    // grace figure instead of deriving it, this is the test that would catch it going stale
    // the moment a title's clock changed.
    const result = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
      durationMinutes: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected refusal: ${result.error}`);
    expect(result.settings.durationSeconds).toBe(120);
    expect(result.gameKey).toBe(GAME_KEY);
  });
});
