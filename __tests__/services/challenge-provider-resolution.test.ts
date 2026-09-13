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
 * synthetic play window anchored at `now`, the derived result-grace period, the hard-coded
 * `attemptsPolicy: "single"` and the `CHALLENGE_ROUND_START_POLICY` it threads in - not about
 * re-proving every branch of the checklist itself.
 *
 * THAT LAST ONE USED TO READ `roundStartPolicy: "reserve_full_round"`, and the test below
 * asserting the resulting refusal is FLIPPED rather than deleted, because the reason it
 * existed is the record of why the owner overrode the rule on 13 September 2026. See
 * `CHALLENGE_ROUND_START_POLICY` in `challenge-round-config.ts`.
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
const { CHALLENGE_ROUND_START_POLICY } = await import(
  "@/lib/services/games/challenge-round-config"
);
// Imported for the precedence test only - it runs the same checklist the resolver runs, with
// and without the policy, which is the only way to show which value reached it.
const { runPreflight, RESULT_GRACE_MARGIN_SECONDS } = await import(
  "@/lib/services/games/contest-preflight"
);
const { parseConfigSchema } = await import("@/lib/services/games/config-schema");

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

  it("ALLOWS a challenge shorter than the title's own play clock, warning rather than refusing - flipped 13 Sep 2026, when the reservation stopped being the rule", async () => {
    /*
      Reason, kept because it is the whole point of the flip: this test used to assert a
      REFUSAL, and it was right about the code. `runPreflight` phrases the same fact two ways
      (`contest-preflight.ts` around the `reservesFullRound` branch) - a refusal when a full
      round must be reserved, because then nobody could start an attempt at any moment of the
      contest, and a warning when it may not, because `resolveExpiry` clamps the round to the
      window and the player is told how long they actually get.

      The resolver now threads `until_window_closes`, so this lands on the warning arm. What
      that buys is the owner's instruction: a player is never turned away for being late. What
      it costs is that a challenge CAN now be created whose every round is cut short, which is
      acceptable only because R48 made a partial run score - so if that ever changes, this is
      the test to read first.
    */
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

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected refusal: ${result.errors.join(" | ")}`);
    // The fact is still reported - to the creator, as a warning. Asserting the warning and
    // not merely `ok: true` is what would catch the check being dropped altogether rather
    // than re-phrased.
    expect(
      result.warnings.some((message) => message.includes("cut short when the contest ends")),
    ).toBe(true);
  });

  it("resolves what the pre-flight would refuse under the reserving policy, proven by running the same checklist both ways", async () => {
    /*
      THE PRECEDENCE TEST, and it needs two answers that differ or it proves nothing.

      `runPreflight`'s `roundStartPolicy` is OPTIONAL and an absent value means
      `reserve_full_round`, matching `competition.model.ts`'s schema default - so a resolver
      that simply stopped passing the field would refuse exactly as it did before the owner's
      decision, with nothing in the diff to look at. The test above shows the resolver
      accepting; this one shows that the SAME facts refuse when the field is absent, which is
      the only way to attribute the acceptance to the value being threaded through.
    */
    const schemaFields = parseConfigSchema({
      type: "object",
      properties: {
        durationSeconds: { type: "integer", format: "duration-seconds", default: 120 },
      },
    });
    if (!schemaFields.ok) throw new Error("fixture schema did not parse");

    const now = new Date();
    const facts = {
      format: "challenge" as const,
      minParticipants: 2,
      title: {
        displayName: "Mock Puzzle",
        providerStatus: "active" as const,
        supportsCompetition: true,
        supportsOneVsOne: true,
        supportsContentSeed: true,
        maxDurationSeconds: 300,
      },
      provider: { enabled: true, adapterInstalled: true },
      chartvoltEnabled: true,
      externalGamesEnabled: true,
      schemaFields: schemaFields.fields,
      settings: {},
      playWindowStart: now,
      // One minute, against a two-minute round - the same shape as the test above.
      playWindowEnd: new Date(now.getTime() + 60_000),
      resultGracePeriodSeconds: 120 + RESULT_GRACE_MARGIN_SECONDS,
      attemptsPolicy: "single" as const,
      unresolvedRoundPolicy: "score_zero" as const,
      now,
    };

    const reserving = runPreflight(facts);
    const permissive = runPreflight({
      ...facts,
      roundStartPolicy: CHALLENGE_ROUND_START_POLICY,
    });

    expect(reserving.ok).toBe(false);
    expect(permissive.ok).toBe(true);
    // And the constant really is the permissive one, so nobody can satisfy this by pointing
    // it back at the reservation.
    expect(CHALLENGE_ROUND_START_POLICY).toBe("until_window_closes");
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
