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
const ChallengeSettings = (
  await import("@/database/models/trading/challenge-settings.model")
).default;

// Reason: `challengesettings` is here because the reader now resolves each title's challenge
// defaults, and the platform's duration bounds live on that singleton - which `getSingleton`
// CREATES when it is absent. MongoDB cannot create a collection inside a transaction, so a
// collection the code under test writes to has to exist before the first test touches it.
const COLLECTIONS = [
  "game_provider",
  "provider_game",
  "whitelabels",
  "challengesettings",
];

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
  // Reason: `getSingleton` memoises the settings document in module scope, so a cached
  // instance survives `clearTestMongo` and the next test reads a document that no longer
  // exists in the database. The symptom is a duration bound from an earlier test, which
  // looks like the resolver getting the arithmetic wrong.
  ChallengeSettings.clearCache();
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

  // THE SETTINGS FORM: the picker is not merely a list of names, it has to render the title's
  // own settings, so the field list travels with the row. Behavioural rather than structural
  // because the parse happens server-side against the STORED schema - a component cannot ask.
  it("carries the parsed settings fields, so the create dialog can render the title's own form", async () => {
    await seedCatalogue();

    const titles = await listChallengeableTitles();
    expect(titles[0].settingsFields).toHaveLength(1);
    expect(titles[0].settingsFields[0]).toMatchObject({
      name: "rounds",
      type: "integer",
      minimum: 1,
      maximum: 20,
      default: 5,
    });
  });

  // Reason: `schemaOk: false` already withholds the card, so an empty list here is what stops
  // a half-parsed form being rendered from a schema the resolver will refuse anyway. An
  // exception thrown mid-parse leaves `parsed.fields` undefined, and spreading that onto the
  // row would hand the client `undefined.map`.
  it("carries an EMPTY field list for a malformed schema rather than a partial one", async () => {
    await seedCatalogue({
      title: {
        configSchema: {
          type: "object",
          properties: {
            good: { type: "integer", default: 3 },
            bad: { type: "object", oneOf: [{ type: "string" }] },
          },
        },
      },
    });

    const titles = await listChallengeableTitles();
    expect(titles[0].schemaOk).toBe(false);
    expect(titles[0].settingsFields).toEqual([]);
  });

  it("carries an empty field list for a title declaring no schema at all - a title with no settings, not a broken one", async () => {
    await seedCatalogue({ title: { configSchema: undefined } });

    const titles = await listChallengeableTitles();
    expect(titles[0].schemaOk).toBe(true);
    expect(titles[0].settingsFields).toEqual([]);
  });

  // THE DEFAULTS: what the challenge form opens pre-filled with. Resolved on the server, because
  // the resolver clamps to the platform's bounds and drops a stored setting the schema has since
  // stopped accepting - a second copy of either in the browser pre-fills a value the create route
  // then refuses, naming a control the player never chose.
  it("carries the resolved challenge defaults on every title", async () => {
    await seedCatalogue({ title: { challengeDefaults: { durationMinutes: 45 } } });

    const titles = await listChallengeableTitles();
    expect(titles[0].defaults.durationMinutes).toBe(45);
    expect(titles[0].defaults.roundStartPolicy).toBe("until_window_closes");
    // The schema's own default is under the stored answers, so an untouched form holds exactly
    // what it held before this field existed.
    expect(titles[0].defaults.settings).toMatchObject({ rounds: 5 });
  });

  it("reads the platform bounds from the challenge settings singleton rather than assuming them", async () => {
    /*
      TWO SOURCES HAVE TO DISAGREE before this can prove which one was read, which is why the
      stored length is outside the NARROWED range and inside the schema's own. With the bounds
      hard-coded to the schema defaults, 200 minutes is perfectly legal and passes through
      unchanged - so a test seeding a length outside both ranges would be green either way.

      An administrator may narrow these months after an operator chose a length, and the picker
      must clamp to what is administered NOW, or the box offers a length the create route refuses.
    */
    await ChallengeSettings.create({
      minDurationMinutes: 20,
      maxDurationMinutes: 90,
      defaultDurationMinutes: 25,
    });
    ChallengeSettings.clearCache();
    await seedCatalogue({ title: { challengeDefaults: { durationMinutes: 200 } } });

    const titles = await listChallengeableTitles();
    expect(titles[0].defaults.durationMinutes).toBe(90);
  });

  it("falls back to the platform's own default length for a title that has chosen none", async () => {
    await ChallengeSettings.create({
      minDurationMinutes: 20,
      maxDurationMinutes: 90,
      defaultDurationMinutes: 35,
    });
    ChallengeSettings.clearCache();
    await seedCatalogue();

    const titles = await listChallengeableTitles();
    expect(titles[0].defaults.durationMinutes).toBe(35);
  });

  it("returns nothing when zero providers are enabled at all - short-circuits before the title query", async () => {
    await seedCatalogue({ providerEnabled: false });

    const titles = await listChallengeableTitles();
    expect(titles).toEqual([]);
  });
});
