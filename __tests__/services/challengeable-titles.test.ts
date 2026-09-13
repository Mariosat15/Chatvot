import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

// Reason: the service calls `connectToDatabase()`, which reads MONGODB_URI and refuses to
// guess. The suite is already connected to the in-memory replica set by `startTestMongo`,
// so hand the service that connection rather than giving the tests a real URI.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

/**
 * `listChallengeableTitles` (item 3 of the roadmap,
 * `lib/services/games/challengeable-titles.service.ts`) - the reader that feeds the
 * "create a challenge" game picker.
 *
 * THE HARD-GATE ASYMMETRY IS THE MOST IMPORTANT PROPERTY HERE, and it is why this file is
 * not a copy of the admin catalogue reader's tests: a player opening the picker has no
 * "drafting ahead of launch" case, so `externalGamesEnabled` off must empty the list rather
 * than merely warn - the picker shows Trading only, never a card that fails on submit.
 *
 * The other three switches (`provider.enabled`, `chartvoltEnabled`, `providerStatus:
 * "active"`) and the installed-adapter check are the SAME three the admin reader applies,
 * because a title that fails any of them cannot run a round regardless of who is asking.
 */

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
const { listChallengeableTitles } = await import(
  "@/lib/services/games/challengeable-titles.service"
);

const COLLECTIONS = ["game_provider", "provider_game", "whitelabels"];

const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;
const UNREGISTERED_PROVIDER_KEY = "acme-unregistered";

async function seedCatalogue(overrides: {
  providerKey?: string;
  providerEnabled?: boolean;
  externalGamesEnabled?: boolean | "absent";
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

  if (overrides.externalGamesEnabled !== "absent") {
    await WhiteLabel.create({
      externalGamesEnabled: overrides.externalGamesEnabled ?? true,
    });
  }
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

describe("listChallengeableTitles", () => {
  it("returns nothing when there is no WhiteLabel document at all - fails closed, not open", async () => {
    await seedCatalogue({ externalGamesEnabled: "absent" });
    // No WhiteLabel document exists, so `settings` is null and `settings?.externalGamesEnabled`
    // is undefined - the falsy branch, same as explicitly false.

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("returns nothing when externalGamesEnabled is off - the HARD gate, unlike the admin reader's warning", async () => {
    await seedCatalogue({ externalGamesEnabled: false });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("lists a title in good standing", async () => {
    await seedCatalogue();

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    expect(titles[0].gameKey).toBe(GAME_KEY);
    expect(titles[0].providerKey).toBe(MOCK_PROVIDER_KEY);
    expect(titles[0].providerName).toBe("Mock Provider");
    expect(titles[0].supportsOneVsOne).toBe(true);
    expect(titles[0].supportsContentSeed).toBe(true);
    expect(titles[0].schemaOk).toBe(true);
  });

  it("excludes a title whose PROVIDER is disabled, even though the title itself is fine", async () => {
    await seedCatalogue({ providerEnabled: false });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("excludes a title with chartvoltEnabled: false - OUR switch, independent of the provider's", async () => {
    await seedCatalogue({ title: { chartvoltEnabled: false } });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("excludes a title the provider itself has marked deprecated", async () => {
    await seedCatalogue({ title: { providerStatus: "deprecated" } });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("excludes a title with no installed adapter for its provider - checked independently of the enabled flags", async () => {
    await seedCatalogue({ providerKey: UNREGISTERED_PROVIDER_KEY });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });

  it("does NOT exclude a title with supportsOneVsOne: false - it is returned and flagged, so the picker can name the reason rather than hide the card", async () => {
    await seedCatalogue({ title: { supportsOneVsOne: false } });

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    expect(titles[0].supportsOneVsOne).toBe(false);
  });

  it("does NOT exclude a title with supportsContentSeed: false - same withhold-with-a-reason pattern", async () => {
    await seedCatalogue({ title: { supportsContentSeed: false } });

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    expect(titles[0].supportsContentSeed).toBe(false);
  });

  it("does NOT exclude a title with a malformed configSchema - it is listed with schemaOk: false rather than hidden, so the operator side is not silently affected", async () => {
    await seedCatalogue({
      title: {
        configSchema: {
          type: "object",
          properties: {
            bad: { type: "object", oneOf: [{ type: "string" }] },
          },
        },
      },
    });

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    expect(titles[0].schemaOk).toBe(false);
  });

  it("resolves playMode via resolvePlayMode - a head_to_head title is scheduled regardless of playMode", async () => {
    await seedCatalogue({ title: { family: "head_to_head" } });

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    expect(titles[0].family).toBe("head_to_head");
    expect(titles[0].playMode).toBe("scheduled");
  });

  it("resolves playMode to anytime for an independent title with no override", async () => {
    await seedCatalogue();

    const titles = await listChallengeableTitles();
    expect(titles[0].playMode).toBe("anytime");
  });

  it("resolves category through resolveGameCategory, humanising an unrecognised slug rather than dropping it", async () => {
    await seedCatalogue({ title: { category: "some-unknown-genre" } });

    const titles = await listChallengeableTitles();
    expect(titles[0].category).toBe("Some Unknown Genre");
  });

  it("leaves category undefined when none is stored, never a placeholder", async () => {
    await seedCatalogue();

    const titles = await listChallengeableTitles();
    expect(titles[0].category).toBeUndefined();
  });

  it("returns nothing when zero providers are enabled at all - short-circuits before the title query", async () => {
    await seedCatalogue({ providerEnabled: false });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });
});
