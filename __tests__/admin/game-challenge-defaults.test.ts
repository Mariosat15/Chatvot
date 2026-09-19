import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  guardCallPattern,
  guardedSections,
  handlerPattern,
  handlerSlices,
  stripComments,
} from "../helpers/route-guard-audit";

/**
 * Per-title challenge defaults - what a player's challenge form opens pre-filled with.
 *
 * OWNER REQUEST, 13 SEPTEMBER 2026, in the same instruction as R73: "we need to be able to
 * specify the default settings for challenges for each specific game... when users can join,
 * like any time or specific, the size of the board etc, so it's easier for the user to create
 * challenges." A player creating a 1v1 was being asked a game's own questions with no answers in
 * them, and unlike an operator drafting a contest they have no catalogue to compare against.
 *
 * NOTHING HERE WAS COMPUTED WRONGLY and there is no risk number: a form opening on the schema's
 * own defaults submits a perfectly valid challenge. What it cost is that a title's board size,
 * difficulty or playing time were answers only an operator could ever choose, and no operator
 * had a screen to choose them on.
 *
 * FOUR PROPERTIES ARE LOAD-BEARING, and the rest of this file is detail.
 *
 *   1. THE SYNC MUST LEAVE THE FIELD ALONE. `configSchema`, `playMode` and `maxDurationSeconds`
 *      are all `providerOwnedFields`, so the obvious implementation - a control writing one of
 *      them - saves, toasts and is reverted by the next catalogue pull with no error and nothing
 *      in a log. That is asserted by running a REAL sync and checking the provider's own fields
 *      WERE rewritten in the same pass; asserting only that our value survived would pass
 *      against a sync that did nothing, which is the version of this test that lets it through.
 *
 *   2. THE TWO READINGS ARE ASYMMETRIC ON PURPOSE. An operator saving is refused with the
 *      reason named; a player reading gets a clamp and a drop. A silent clamp on the write side
 *      stores a number the operator did not choose; a refusal on the read side takes the
 *      challenge dialog down for a title that is otherwise perfectly playable, months later,
 *      for a reason no player can act on.
 *
 *   3. THERE IS ONE DEFINITION OF WHICH STORED VALUE RESERVES A ROUND. There were nearly three
 *      - the round config reading a challenge, the resolver reading a title, and the create-time
 *      pre-flight - and all three were the same ternary. That is the "one rule, two copies"
 *      shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, and
 *      the drift here is the quiet kind: a challenge created under one reading and played under
 *      the other, where the refusal names the clock rather than the setting behind it.
 *
 *   4. RESERVING IS REFUSED WHEN THE TITLE CANNOT HONOUR IT, which is the guard that stops this
 *      new control quietly recreating R73. With no declared clock the switch does nothing; with
 *      a round as long as the whole challenge, every round is refused from the first second.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return stripComments(readFileSync(join(ROOT, relativePath), "utf8"));
}

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const {
  CHALLENGE_ROUND_START_POLICY,
  resolveChallengeStartPolicy,
  parseChallengeDefaults,
  resolveChallengeDefaults,
} = await import("@/lib/services/games/challenge-defaults");
const { parseConfigSchema } = await import("@/lib/services/games/config-schema");

const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const ChallengeSettings = (
  await import("@/database/models/trading/challenge-settings.model")
).default;
const { MOCK_PROVIDER_KEY, MockProviderAdapter } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { syncProviderCatalogue } = await import(
  "@/lib/services/game-providers/catalogue.service"
);
const { setGameChallengeDefaults, parseChallengeDefaultsBody } = await import(
  "../../apps/admin/lib/services/game-providers/challenge-defaults.service"
);
const { validateGameContent, NEVER_EDITABLE_CONTENT_FIELDS } = await import(
  "../../apps/admin/lib/admin/game-content-fields"
);

const BOUNDS = { minMinutes: 15, maxMinutes: 1440 };

/** A schema with one defaulted field, one bare number and one boolean - the three seed cases. */
const SCHEMA = {
  type: "object",
  properties: {
    rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    gridSize: { type: "integer", minimum: 4, maximum: 8 },
    ranked: { type: "boolean" },
  },
};

function fields() {
  const parsed = parseConfigSchema(SCHEMA);
  if (!parsed.ok) throw new Error("fixture schema should parse");
  return parsed.fields;
}

// =======================================================================================
// resolveChallengeStartPolicy - the one definition
// =======================================================================================

describe("resolveChallengeStartPolicy", () => {
  it("reserves only on an explicit reserve_full_round", () => {
    expect(resolveChallengeStartPolicy({ roundStartPolicy: "reserve_full_round" })).toBe(
      "reserve_full_round",
    );
  });

  it("is PERMISSIVE for every shape of missing, which is the opposite of a competition's", () => {
    // "Missing" has three shapes and only one is obvious: absent, `null` and `""`. A challenge
    // has no operator, so an unset value is a challenge created before there was a rule rather
    // than one whose players chose the strict one - the reverse of `contest-config.ts`'s reading
    // of the same field name, deliberately.
    expect(resolveChallengeStartPolicy(undefined)).toBe("until_window_closes");
    expect(resolveChallengeStartPolicy(null)).toBe("until_window_closes");
    expect(resolveChallengeStartPolicy({})).toBe("until_window_closes");
    expect(resolveChallengeStartPolicy({ roundStartPolicy: "" })).toBe("until_window_closes");
    expect(resolveChallengeStartPolicy({ roundStartPolicy: "sometimes" })).toBe(
      "until_window_closes",
    );
  });

  it("agrees with the constant every writer imports", () => {
    expect(CHALLENGE_ROUND_START_POLICY).toBe("until_window_closes");
  });

  it("is the ONE reader of the field - nobody spells the ternary out again", () => {
    // THE NEGATIVE HALF IS LOAD-BEARING. Each of these three files imports the helper, and
    // importing it is trivially satisfied by a file that imports it and then writes
    // `x.roundStartPolicy === "reserve_full_round"` five lines later. A second reading here
    // means a challenge stored under one rule and played under another.
    for (const path of [
      "lib/services/games/challenge-round-config.ts",
      "lib/services/games/challenge-provider-resolution.ts",
      "lib/services/games/challengeable-titles.service.ts",
    ]) {
      const code = readCode(path);
      expect(code).not.toMatch(/===\s*"reserve_full_round"/);
    }
    expect(readCode("lib/services/games/challenge-round-config.ts")).toMatch(
      /resolveChallengeStartPolicy\s*\(/,
    );
    expect(readCode("lib/services/games/challenge-provider-resolution.ts")).toMatch(
      /resolveChallengeStartPolicy\s*\(/,
    );
  });
});

// =======================================================================================
// resolveChallengeDefaults - the lenient read a player gets
// =======================================================================================

describe("resolveChallengeDefaults", () => {
  it("returns the platform's own answer when the title says nothing", () => {
    // The property that keeps this additive: an untouched form holds exactly what it held
    // before this field existed - the platform's default length and the schema's own defaults.
    const resolved = resolveChallengeDefaults({
      fields: fields(),
      stored: undefined,
      bounds: BOUNDS,
      fallbackMinutes: 60,
    });
    expect(resolved.durationMinutes).toBe(60);
    expect(resolved.roundStartPolicy).toBe("until_window_closes");
    expect(resolved.settings).toEqual({ rounds: 5, ranked: false });
  });

  it("CLAMPS a stored length that has gone out of range, rather than discarding it", () => {
    // An administrator may narrow the platform bounds months after an operator chose a length.
    // Clamping keeps "as long as possible" - closer to the operator's intent than the platform
    // default they never chose - and it is the read side, so refusing is not an option.
    expect(
      resolveChallengeDefaults({
        fields: [],
        stored: { durationMinutes: 5000 },
        bounds: BOUNDS,
        fallbackMinutes: 60,
      }).durationMinutes,
    ).toBe(1440);
    expect(
      resolveChallengeDefaults({
        fields: [],
        stored: { durationMinutes: 2 },
        bounds: BOUNDS,
        fallbackMinutes: 60,
      }).durationMinutes,
    ).toBe(15);
  });

  it("falls back rather than propagating a stored value that is not a finite number", () => {
    // A `NaN` here would reach a `min` attribute and a required Number path, where every
    // comparison downstream is silently false - the R31 lesson about what `||` was catching.
    for (const bad of [Number.NaN, undefined, null, "60" as unknown as number]) {
      expect(
        resolveChallengeDefaults({
          fields: [],
          stored: { durationMinutes: bad as number },
          bounds: BOUNDS,
          fallbackMinutes: 60,
        }).durationMinutes,
      ).toBe(60);
    }
  });

  it("keeps a stored setting the schema still accepts", () => {
    const resolved = resolveChallengeDefaults({
      fields: fields(),
      stored: { settings: { rounds: 12, gridSize: 8 } },
      bounds: BOUNDS,
      fallbackMinutes: 60,
    });
    expect(resolved.settings).toMatchObject({ rounds: 12, gridSize: 8 });
  });

  it("DROPS a stored setting the schema has stopped accepting, back to the declared default", () => {
    // A provider may narrow their own `configSchema` on a scheduled sync. Refusing then would
    // take the dialog down for a title that is otherwise perfectly playable; leaving the value
    // in place would pre-fill a form the create route then refuses, naming a field the player
    // never chose. `rounds` falls back to 5, `gridSize` disappears because it declares none.
    const resolved = resolveChallengeDefaults({
      fields: fields(),
      stored: { settings: { rounds: 999, gridSize: 40, retired: true } },
      bounds: BOUNDS,
      fallbackMinutes: 60,
    });
    expect(resolved.settings.rounds).toBe(5);
    expect("gridSize" in resolved.settings).toBe(false);
    expect("retired" in resolved.settings).toBe(false);
  });

  it("is empty for a title that takes no settings, and for one whose schema is malformed", () => {
    // The picker separates those two with `schemaOk`, which disables the second - the resolver
    // is handed an empty field list either way and must not invent anything.
    expect(
      resolveChallengeDefaults({
        fields: [],
        stored: { settings: { anything: 1 } },
        bounds: BOUNDS,
        fallbackMinutes: 60,
      }).settings,
    ).toEqual({});
  });
});

// =======================================================================================
// parseChallengeDefaults - the strict write an operator sees
// =======================================================================================

describe("parseChallengeDefaults", () => {
  const submit = (submitted: Record<string, unknown>, maxDurationSeconds?: number) =>
    parseChallengeDefaults({
      fields: fields(),
      submitted,
      bounds: BOUNDS,
      maxDurationSeconds,
    });

  it("accepts a length, a join rule and the game's own settings", () => {
    const result = submit({
      durationMinutes: 30,
      roundStartPolicy: "until_window_closes",
      settings: { rounds: 9 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.defaults.durationMinutes).toBe(30);
      expect(result.defaults.roundStartPolicy).toBe("until_window_closes");
      expect(result.defaults.settings).toMatchObject({ rounds: 9 });
    }
  });

  it("stores NOTHING when nothing was submitted, so the platform decides again", () => {
    // An empty result is what the service turns into a `$unset`. A stored `{}` satisfies every
    // truthiness test while meaning nothing - the `entryBlockThreshold` distinction.
    const result = submit({ durationMinutes: "", roundStartPolicy: "", settings: {} });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.defaults)).toHaveLength(0);
  });

  it("REFUSES an out-of-range length and NAMES the range", () => {
    // Named rather than merely rejected: the bounds live on the Challenge settings screen,
    // which is somewhere else, so an operator cannot see them from this dialog.
    const result = submit({ durationMinutes: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("15 and 1440");
  });

  it("refuses a length that is not a whole number of minutes", () => {
    for (const bad of ["abc", 20.5, "1e9999"]) {
      expect(submit({ durationMinutes: bad }).ok).toBe(false);
    }
  });

  it("refuses an unrecognised join rule", () => {
    for (const bad of ["sometimes", "__proto__", 1, true]) {
      expect(submit({ roundStartPolicy: bad }).ok).toBe(false);
    }
  });

  it("REFUSES a reservation on a title that declares no round length at all", () => {
    // The reservation only means something when the platform knows how long a round is. With
    // nothing declared the gate reserves nothing, so the switch would be a control that appears
    // to work and does nothing - the shape already on record for a provider with no adapter and
    // a `rankingMethod` a provider game ignores.
    const result = submit({ durationMinutes: 60, roundStartPolicy: "reserve_full_round" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/does not declare how long/i);
  });

  it("REFUSES a reservation as long as the whole challenge - which is R73 exactly", () => {
    // Both players pay, neither can ever start a round, and the refusal names the clock rather
    // than the setting behind it. That is the defect the owner reported, and this is the one
    // place the new control could reinstate it.
    const result = submit(
      { durationMinutes: 15, roundStartPolicy: "reserve_full_round" },
      1200,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/whole of a 15-minute/i);
  });

  it("ACCEPTS a reservation that leaves room to play", () => {
    const result = submit(
      { durationMinutes: 60, roundStartPolicy: "reserve_full_round" },
      300,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.defaults.roundStartPolicy).toBe("reserve_full_round");
  });

  it("checks the reservation against the SUBMITTED length, not the platform minimum", () => {
    // A 20-minute round fits a 60-minute challenge and not a 15-minute one. Reading the bounds
    // instead of the operator's own number would refuse a perfectly workable pair.
    expect(submit({ durationMinutes: 60, roundStartPolicy: "reserve_full_round" }, 1200).ok).toBe(
      true,
    );
    expect(submit({ durationMinutes: 15, roundStartPolicy: "reserve_full_round" }, 1200).ok).toBe(
      false,
    );
  });

  it("returns EVERY refusal, not the first", () => {
    // An operator fixing one refusal per submission gives up. Same rule as the contest
    // pre-flight's accumulating hard refusals.
    const result = submit({ durationMinutes: 2, roundStartPolicy: "nonsense" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(1);
  });
});

// =======================================================================================
// parseChallengeDefaultsBody - what the route may be handed
// =======================================================================================

describe("parseChallengeDefaultsBody", () => {
  it("accepts null as the CLEAR instruction", () => {
    expect(parseChallengeDefaultsBody(null)).toEqual({ ok: true, submitted: null });
  });

  it("refuses a shape that is not an object", () => {
    for (const bad of [[], "x", 1, true]) {
      expect(parseChallengeDefaultsBody(bad).ok).toBe(false);
    }
  });

  it("refuses settings that are not an object", () => {
    expect(parseChallengeDefaultsBody({ settings: [] }).ok).toBe(false);
    expect(parseChallengeDefaultsBody({ settings: null }).ok).toBe(false);
  });
});

// =======================================================================================
// Behavioural, against a real database
// =======================================================================================

const COLLECTIONS = ["game_provider", "provider_game", "challengesettings", "whitelabels"];

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
  // Reason: `getSingleton` caches for 60 seconds, so a document created by one test survives
  // `clearTestMongo` in the reader's memory and the next test reads bounds from a row that no
  // longer exists.
  ChallengeSettings.clearCache();
});

/**
 * One catalogue row with every field the schema demands.
 *
 * Not trimmed to the fields a test reads: Mongoose validates the document rather than the subset
 * under test, which is how 34 tests once failed on a single missing `slug`.
 */
async function seedTitle(
  overrides: {
    gameCode?: string;
    supportsOneVsOne?: boolean;
    maxDurationSeconds?: number;
    configSchema?: unknown;
    challengeDefaults?: unknown;
  } = {},
) {
  const gameCode = overrides.gameCode ?? "mock-sprint";
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey: `provider:${MOCK_PROVIDER_KEY}:${gameCode}`,
    displayName: "Mock Sprint",
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: overrides.maxDurationSeconds ?? 300,
    supportsCompetition: true,
    supportsOneVsOne: overrides.supportsOneVsOne ?? true,
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: "configSchema" in overrides ? overrides.configSchema : SCHEMA,
    ...(overrides.challengeDefaults
      ? { challengeDefaults: overrides.challengeDefaults }
      : {}),
  });
  return gameCode;
}

/**
 * The raw document, straight off the driver.
 *
 * A `.lean()` read through Mongoose cannot tell a stored `{}` from an absent key once a `??`
 * has swallowed it, and the difference between those two is the whole of the `$unset` rule.
 */
async function rawTitle(gameCode: string) {
  return mongoose.connection.db
    ?.collection("provider_game")
    .findOne({ providerKey: MOCK_PROVIDER_KEY, gameCode });
}

describe("the catalogue sync leaves the challenge defaults alone", () => {
  it("rewrites the provider's OWN fields and does not touch ours", async () => {
    // THE TEST THIS FILE EXISTS FOR. The row is seeded disagreeing with the mock adapter on
    // `maxDurationSeconds` - stored 300, declared 90 - so a passing run proves two separate
    // things: the sync really did write in this pass, and it wrote only the provider's fields.
    // Asserting our value survived on its own would pass just as happily against a sync that
    // failed and changed nothing, which is the version of this test that lets the defect
    // through - and the defect here is invisible, because the operator sees the toast.
    const gameCode = await seedTitle({
      gameCode: "mock-sprint",
      maxDurationSeconds: 300,
      challengeDefaults: { durationMinutes: 30, roundStartPolicy: "until_window_closes" },
    });

    const result = await syncProviderCatalogue(new MockProviderAdapter());
    expect(result.success).toBe(true);

    const after = await rawTitle(gameCode);
    expect(after?.maxDurationSeconds).toBe(90);
    expect(after?.challengeDefaults).toMatchObject({ durationMinutes: 30 });
  });

  it("does not invent defaults for a row it UPDATES", async () => {
    await seedTitle({ gameCode: "mock-sprint" });
    await syncProviderCatalogue(new MockProviderAdapter());

    const after = await rawTitle("mock-sprint");
    expect(after && "challengeDefaults" in after).toBe(false);
  });

  it("does not invent them for a row it CREATES either", async () => {
    // The create branch spreads a different field group from the update branch, so a default
    // landing only there would be invisible to the test above, which seeds the row itself.
    await syncProviderCatalogue(new MockProviderAdapter());

    const created = await rawTitle("mock-sprint");
    expect(created).toBeTruthy();
    expect(created && "challengeDefaults" in created).toBe(false);
  });

  it("holds the same allow-list in BOTH copies of the sync", () => {
    // THE TESTS ABOVE EXERCISE THE WRONG COPY and that is not fixable by importing the other
    // one: vitest aliases `@` to the repository root, and the copy an operator's Sync catalogue
    // button runs is the one in `apps/admin`, reached through that app's own `@`. So adding
    // `challengeDefaults` to the ADMIN allow-list alone would revert every operator's decision
    // on the next sync while every behavioural test here stayed green.
    const main = readFileSync(
      join(ROOT, "lib/services/game-providers/catalogue.service.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/game-providers/catalogue.service.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
    expect(stripComments(main)).not.toContain("challengeDefaults");
  });
});

describe("the two copies of the validator", () => {
  it("are byte-identical, because `check:mirrors` compares MODELS and says nothing about this", () => {
    // The player app resolves these and the admin app parses them. Two readings of what a valid
    // stored default looks like is the shape this whole module exists to avoid, and no guard in
    // the repository would notice - so the comparison is the guarantee.
    const main = readFileSync(join(ROOT, "lib/services/games/challenge-defaults.ts"), "utf8");
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/games/challenge-defaults.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});

describe("setGameChallengeDefaults", () => {
  it("stores them and reports what a PLAYER will now see, not the submission echoed back", async () => {
    const gameCode = await seedTitle();

    const result = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, {
      durationMinutes: "45",
      roundStartPolicy: "until_window_closes",
      settings: { rounds: 11 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.effective.durationMinutes).toBe(45);
      expect(result.effective.settings).toMatchObject({ rounds: 11 });
    }
    expect((await rawTitle(gameCode))?.challengeDefaults).toMatchObject({
      durationMinutes: 45,
    });
  });

  it("clears by REMOVING the key, never by storing an empty object", async () => {
    const gameCode = await seedTitle({
      challengeDefaults: { durationMinutes: 30 },
    });

    const result = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, null);
    expect(result.success).toBe(true);
    if (result.success) {
      // The platform decides again, so the length goes back to its own default.
      expect(result.effective.durationMinutes).toBe(60);
      expect(result.stored).toBeUndefined();
    }

    const after = await rawTitle(gameCode);
    expect(after && "challengeDefaults" in after).toBe(false);
  });

  it("removes the key when an empty submission is saved, rather than storing {}", async () => {
    const gameCode = await seedTitle({ challengeDefaults: { durationMinutes: 30 } });

    await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, {
      durationMinutes: "",
      roundStartPolicy: "",
      settings: {},
    });

    const after = await rawTitle(gameCode);
    expect(after && "challengeDefaults" in after).toBe(false);
  });

  it("REFUSES a title nobody can challenge on, naming the reason", async () => {
    // `supportsOneVsOne: false` is the provider's way of saying this title cannot be
    // challenged, so a default stored here would be written, transported and read by nothing -
    // the declared-written-dead field class found five times in this programme already.
    const gameCode = await seedTitle({ gameCode: "solo-only", supportsOneVsOne: false });

    const result = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, {
      durationMinutes: "30",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/one against one/i);

    const after = await rawTitle(gameCode);
    expect(after && "challengeDefaults" in after).toBe(false);
  });

  it("REFUSES a title whose schema cannot be parsed, rather than saving the length alone", async () => {
    // Fail closed, exactly as the wizard's parser does: a schema we cannot validate means we
    // cannot tell a valid answer from an invalid one, so a saved length would leave an operator
    // believing they had chosen a board size they had not - and the fields never rendered.
    const gameCode = await seedTitle({
      gameCode: "bad-schema",
      configSchema: {
        type: "object",
        properties: { bad: { type: "object", oneOf: [{ type: "string" }] } },
      },
    });

    const result = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, {
      durationMinutes: "30",
    });
    expect(result.success).toBe(false);

    const after = await rawTitle(gameCode);
    expect(after && "challengeDefaults" in after).toBe(false);
  });

  it("cannot reach another provider's title through this provider's key", async () => {
    // Matched on the pair, like `updateGameContent` and `setGamePlayStyle`. A caller-supplied
    // `gameKey` would be a way to edit somebody else's catalogue through a URL we authorise
    // them for.
    await ProviderGame.create({
      providerKey: "other-provider",
      gameCode: "their-game",
      gameKey: "provider:other-provider:their-game",
      displayName: "Someone Else's Game",
      family: "independent",
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      supportsCompetition: true,
      supportsOneVsOne: true,
      supportsContentSeed: true,
      providerStatus: "active",
    });

    const result = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, "their-game", {
      durationMinutes: "30",
    });
    expect(result.success).toBe(false);

    const theirs = await mongoose.connection.db
      ?.collection("provider_game")
      .findOne({ providerKey: "other-provider" });
    expect(theirs && "challengeDefaults" in theirs).toBe(false);
  });

  it("reads the platform's bounds rather than assuming them", async () => {
    // The bounds are administered on a different screen. An administrator narrowing them must
    // narrow this control too, or an operator sets a length the create route then refuses.
    await ChallengeSettings.create({
      minDurationMinutes: 20,
      maxDurationMinutes: 40,
      defaultDurationMinutes: 25,
    });
    ChallengeSettings.clearCache();
    const gameCode = await seedTitle();

    const refused = await setGameChallengeDefaults(MOCK_PROVIDER_KEY, gameCode, {
      durationMinutes: "60",
    });
    expect(refused.success).toBe(false);
    if (!refused.success) expect(refused.error).toContain("20 and 40");
  });
});

// =======================================================================================
// The player's side - the picker carries the answers, and does not recompute them
// =======================================================================================

describe("what the player's picker is handed", () => {
  it("carries the resolved defaults on every title", async () => {
    // Resolved on the SERVER and sent. The resolver clamps to the platform bounds and drops a
    // stored setting the schema no longer accepts; a second copy of either in the browser
    // pre-fills a value the create route then refuses, naming a control the player never chose.
    const { WhiteLabel } = await import("@/database/models/whitelabel.model");
    const GameProvider = (
      await import("@/database/models/games/game-provider.model")
    ).default;
    const { listChallengeableTitles } = await import(
      "@/lib/services/games/challengeable-titles.service"
    );

    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.example.com",
      enabled: true,
    });
    await WhiteLabel.create({ externalGamesEnabled: true });
    await seedTitle({ challengeDefaults: { durationMinutes: 5000, settings: { rounds: 12 } } });

    const titles = await listChallengeableTitles();
    expect(titles).toHaveLength(1);
    // Clamped, not echoed - which is the whole reason the browser is not allowed to do this.
    expect(titles[0].defaults.durationMinutes).toBe(1440);
    expect(titles[0].defaults.roundStartPolicy).toBe("until_window_closes");
    expect(titles[0].defaults.settings).toMatchObject({ rounds: 12, ranked: false });
  });
});

// =======================================================================================
// The create path - the pre-flight and the stored field agree, or R73 comes back
// =======================================================================================

describe("what a challenge is created with", () => {
  async function preflightFixture(): Promise<void> {
    const { WhiteLabel } = await import("@/database/models/whitelabel.model");
    const GameProvider = (
      await import("@/database/models/games/game-provider.model")
    ).default;
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock Provider",
      baseUrl: "https://mock.example.com",
      enabled: true,
    });
    await WhiteLabel.create({ externalGamesEnabled: true });
  }

  it("reads the join rule off the stored title, never from the request", async () => {
    /*
      THE VALUE THE PRE-FLIGHT WAS RUN AGAINST IS THE VALUE RETURNED, and that is the whole
      point of returning it rather than leaving the route to import the constant. A title whose
      operator reinstated the reservation would otherwise be approved permissively and then
      stored strictly - and every round of it refused from the first second, which is R73
      arriving through the door built to close it.

      Behavioural rather than structural: the policy is read off a stored document, so no
      assertion over the source can see a stored value.
    */
    await preflightFixture();
    const { resolveChallengeProviderGame } = await import(
      "@/lib/services/games/challenge-provider-resolution"
    );

    const permissive = await seedTitle();
    const resolvedPermissive = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: permissive,
      settings: {},
      durationMinutes: 60,
    });
    expect(resolvedPermissive.ok).toBe(true);
    if (resolvedPermissive.ok) {
      expect(resolvedPermissive.roundStartPolicy).toBe("until_window_closes");
    }

    const reserving = await seedTitle({
      gameCode: "mock-reserving",
      challengeDefaults: { roundStartPolicy: "reserve_full_round" },
    });
    const resolvedReserving = await resolveChallengeProviderGame({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: reserving,
      settings: {},
      durationMinutes: 60,
    });
    expect(resolvedReserving.ok).toBe(true);
    if (resolvedReserving.ok) {
      expect(resolvedReserving.roundStartPolicy).toBe("reserve_full_round");
    }
  });

  it("stores the policy the pre-flight was run against, not the constant", () => {
    // The structural half of the same claim, on the far side of the seam: the route must carry
    // the resolver's answer through to the stored document. A route reading the constant
    // compiles, reviews as correct, and quietly discards an operator's choice.
    const route = readCode("app/api/challenges/route.ts");
    expect(route).toMatch(/resolvedRoundStartPolicy\s*=\s*resolved\.roundStartPolicy/);
    expect(route).toMatch(
      /roundStartPolicy:\s*resolvedRoundStartPolicy\s*\?\?\s*CHALLENGE_ROUND_START_POLICY/,
    );
  });
});

describe("the create dialog uses what it was given", () => {
  const dialog = readCode("components/challenges/ChallengeCreateDialog.tsx");

  it("seeds the settings AND the length from the chosen title's resolved defaults", () => {
    expect(dialog).toMatch(/next\.title\.defaults\.settings/);
    expect(dialog).toMatch(/next\.title\.defaults\.durationMinutes/);
  });

  it("does NOT re-derive either in the browser", () => {
    // THE NEGATIVE HALF. A dialog that seeds the schema's raw defaults itself, or clamps the
    // length against its own copy of the bounds, is the "one rule, two copies" shape - and it
    // drifts in the quiet direction, pre-filling a value the server refuses.
    expect(dialog).not.toMatch(/defaultConfigValues\s*\(/);
    expect(dialog).not.toMatch(/resolveChallengeDefaults\s*\(/);
    // Reason: the clamp ban is SLICED to the game chooser rather than applied file-wide. The
    // trading branch legitimately floors `minimumTrades` at 1, so a whole-file ban fails on
    // correct code - and a guard that fires on a correct file is the one the next reader deletes.
    const chooser = dialog.slice(
      dialog.indexOf("const chooseGame"),
      dialog.indexOf("const [formData"),
    );
    expect(chooser.length).toBeGreaterThan(60);
    expect(chooser).not.toMatch(/Math\.(min|max)\s*\(/);
  });

  it("goes back to the platform's own length when the player picks Trading again", () => {
    // A provider title's 30 minutes must not stay in the box for a trading challenge, which
    // has no such title behind it.
    expect(dialog).toMatch(/settings\?\.defaultDurationMinutes/);
  });
});

// =======================================================================================
// It is not content
// =======================================================================================

describe("challenge defaults cannot be written through the content editor", () => {
  it("refuses them with THEIR OWN reason, not the generic unknown-field one", () => {
    // The specific message matters, and this is the lesson from `gameKey` on
    // `competition-update-fields.ts`: a field absent from BOTH lists is still refused, by the
    // unknown-field branch, whose message also names the field. So "was it refused" stays green
    // when the entry is deleted from the never-editable map, silently removing the explanation.
    const refused = validateGameContent({ challengeDefaults: { durationMinutes: 30 } });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toContain("Challenge defaults control");
      expect(refused.error).not.toContain("not an editable field");
    }
  });

  it("keeps them beside the play style, which is barred for the same reason", () => {
    expect(NEVER_EDITABLE_CONTENT_FIELDS.has("challengeDefaults")).toBe(true);
    expect(NEVER_EDITABLE_CONTENT_FIELDS.has("playModeOverride")).toBe(true);
  });

  it("is not offered by the content dialog", () => {
    const content = readCode("apps/admin/components/admin/games/GameContentDialog.tsx");
    expect(content.length).toBeGreaterThan(200);
    expect(content).not.toContain("challengeDefaults");
  });
});

// =======================================================================================
// The route
// =======================================================================================

const ROUTE =
  "apps/admin/app/api/games/providers/[providerKey]/games/challenge-defaults/route.ts";

describe("the challenge-defaults route", () => {
  const code = readCode(ROUTE);

  it("guards EVERY exported handler with the section that reveals the screen", () => {
    // Counted rather than merely found: a file whose PATCH is guarded and whose GET is not
    // passes any mention-based check while leaving a read wide open, and a route with no guard
    // has no attribution either (R40, R51, R57).
    const handlers = code.match(handlerPattern()) ?? [];
    expect(handlers.length).toBe(2);
    expect(guardedSections(code)).toEqual(["game-providers", "game-providers"]);
    expect(code).not.toMatch(/verifyAdminAuth\s*\(/);
    expect(code).not.toMatch(/verifyAdminToken\s*\(/);
  });

  it("guards before it reads the body, in EVERY handler that reads one", () => {
    // Reason: measured file-wide this passes against the defect. `code.search` finds the GET's
    // guard, which sits above the PATCH entirely, so a PATCH that read its body first would
    // still compare a guard at 45 against a body at 73 and look correct - the count-per-handler
    // rule one step along, and a probe reordering the PATCH proved it.
    const readers = handlerSlices(code).filter((handler) =>
      /await\s+request\.json\(\)/.test(handler.body),
    );
    expect(readers.map((handler) => handler.method)).toEqual(["PATCH"]);
    for (const handler of readers) {
      const guardAt = handler.body.search(guardCallPattern());
      const bodyAt = handler.body.search(/await\s+request\.json\(\)/);
      expect(guardAt).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(bodyAt);
    }
  });

  it("returns the guard's own refusal, once per guard", () => {
    const guards = code.match(guardCallPattern()) ?? [];
    const refusals =
      code.match(/if\s*\(\s*!\s*\w+\.ok\s*\)\s*return\s+\w+\.response/g) ?? [];
    expect(refusals.length).toBe(guards.length);
  });

  it("demands the field be PRESENT, so a malformed body cannot clear a decision", () => {
    // `null` means "the platform decides again", and an absent field would have to mean the
    // same - at which point `{ gameCode }` alone silently undoes an operator's choice.
    expect(code).toMatch(/"challengeDefaults"\s+in\s+body/);
  });

  it("writes only the defaults - it is not a second door onto the enable switch or the content", () => {
    expect(code).not.toContain("chartvoltEnabled");
    expect(code).not.toContain("setTitleEnabled");
    expect(code).not.toContain("updateGameContent");
    expect(code).not.toContain("setGamePlayStyle");
  });

  it("records the change, because a money-adjacent setting needs attribution", () => {
    expect(code).toMatch(/auditLogService\.log/);
  });
});

// =======================================================================================
// The control names no game
// =======================================================================================

describe("the Challenge defaults dialog", () => {
  const control = readCode("apps/admin/components/admin/games/GameChallengeDefaultsDialog.tsx");

  it("names no game code, provider key or field", () => {
    // The single failure mode of the no-developer-needed claim is something that enumerates
    // games. Every question below the two platform controls comes from the provider's own
    // `configSchema`, so a title we have never seen presents its own settings.
    expect(control.length).toBeGreaterThan(200);
    expect(control).not.toMatch(/gameCode\s*===/);
    expect(control).not.toMatch(/gameKey\s*===/);
    expect(control).not.toMatch(/field\.name\s*===/);
    expect(control).not.toContain("circuit-sprint");
  });

  it("seeds its own draft through the SAME resolver a player reads", () => {
    // An operator must see what a player would see, including a stored setting the schema has
    // since stopped accepting - which the resolver drops rather than leaving as a value that
    // cannot be saved again.
    expect(control).toMatch(/resolveChallengeDefaults\s*\(/);
  });

  it("fetches the bounds rather than writing them into its own min and max", () => {
    // Reason: the bounds are read back from the GET on the defaults route, never restated here.
    // The platform's own min and max live on a different screen and an administrator may narrow
    // them, so a copy in this dialog offers an operator a length the save then refuses - and the
    // refusal names a range the form itself said was allowed. 1440 is the schema's own maximum,
    // and its absence here is what proves the range travelled rather than being retyped.
    expect(control).toMatch(/challenge-defaults`/);
    expect(control).not.toMatch(/\b1440\b/);
  });

  it("appears on the Games list exactly once", () => {
    // Counted: two of these on one row would give an operator two dialogs for one setting, and
    // whichever they saved last would win.
    const catalogue = readCode("apps/admin/components/admin/games/ProviderCatalogueDialog.tsx");
    const uses = catalogue.match(/<GameChallengeDefaultsDialog\b/g) ?? [];
    expect(uses.length).toBe(1);
  });
});
