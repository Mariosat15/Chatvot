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
  stripComments,
} from "../helpers/route-guard-audit";

/**
 * The operator's own answer to "does everybody play this title at once?".
 *
 * WHY THERE IS A SECOND FIELD AT ALL, which is the fact this suite exists to defend.
 *
 * `playMode` arrives with the catalogue and is the provider's statement about their own game.
 * That is right for a third party and wrong for us, because for ChartVolt Games we ARE the
 * provider and the declaration lives in a TypeScript literal inside `games-service` that only
 * changes on a rebuild. There was no way to answer the question from a screen.
 *
 * The obvious implementation - a control that writes `playMode` - is the one that must never
 * be built, and it would pass a careless test suite. `playMode` is a member of
 * `providerOwnedFields` in `catalogue.service.ts`, so the write survives until the next
 * catalogue pull and is then reverted with no error and nothing in a log. An operator sets a
 * race to start together, watches the toast, and finds it staggered again the next morning.
 * That is the "control that appears to work and does nothing" shape already on record for a
 * provider enabled with no adapter, a `rankingMethod` a provider game ignores, and `isPaused`
 * on a provider contest (R41).
 *
 * So the load-bearing test in this file is not "can an operator set it" - it is
 * `the catalogue sync leaves our override alone`, which runs a real sync against a real
 * database and asserts the provider's own field WAS rewritten in the same pass. Asserting only
 * that the override survived would pass against a sync that did nothing at all.
 *
 * Three more things are pinned rather than trusted:
 *
 *   1. `head_to_head` BEATS THE OVERRIDE. Two people cannot play each other at different
 *      times, so a value stored there would be read by nothing - the class of declared,
 *      written, dead field found four times in this programme (`requiresSyncPlay`, `isPaused`,
 *      `lastSuccessfulRoundAt`, `family`). The service refuses it and the control withholds
 *      itself, from one helper.
 *
 *   2. CLEARING IS `$unset`, NEVER A STORED `""`. `resolvePlayMode` reads the field's presence
 *      to decide whether we have taken a decision at all, and an empty string satisfies
 *      `field !== undefined` while meaning nothing - the `entryBlockThreshold` distinction.
 *
 *   3. IT IS NOT CONTENT. The dialog that writes a tagline must not be able to write this, or
 *      an operator turns a puzzle into a gun-start race while fixing a typo and the audit
 *      trail records a content edit. Same reasoning as `chartvoltEnabled`.
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
  resolvePlayMode,
  canOverridePlayMode,
  playShapeRules,
  PLAY_MODES,
  PLAY_MODE_COPY,
} = await import("@/lib/services/games/play-shape");

const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { MOCK_PROVIDER_KEY, MockProviderAdapter } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { syncProviderCatalogue } = await import(
  "@/lib/services/game-providers/catalogue.service"
);
const { setGamePlayStyle, parsePlayStyleInput } = await import(
  "../../apps/admin/lib/services/game-providers/game-play-style.service"
);
const { validateGameContent, NEVER_EDITABLE_CONTENT_FIELDS } = await import(
  "../../apps/admin/lib/admin/game-content-fields"
);

// =======================================================================================
// resolvePlayMode - the precedence, which is the whole rule
// =======================================================================================

describe("resolvePlayMode with an operator override", () => {
  it("lets our override decide when the provider says otherwise", () => {
    // The case the whole feature exists for: a race whose provider declared nothing useful,
    // or a title of ours whose declaration is baked into a build we do not want to redeploy.
    expect(
      resolvePlayMode({ playMode: "anytime", playModeOverride: "scheduled" }),
    ).toBe("scheduled");
  });

  it("honours an override in the loosening direction too", () => {
    // Deliberately allowed. This module already fails towards `anytime`: a simultaneous title
    // run staggered still produces comparable, payable scores because `supportsContentSeed`
    // guarantees identical content, whereas the reverse shuts entry at the start and turns
    // paying players away. Refusing this direction would also make the control a one-way door.
    expect(
      resolvePlayMode({ playMode: "scheduled", playModeOverride: "anytime" }),
    ).toBe("anytime");
  });

  it("falls back to the provider when we have taken no decision", () => {
    expect(resolvePlayMode({ playMode: "scheduled" })).toBe("scheduled");
    expect(
      resolvePlayMode({ playMode: "scheduled", playModeOverride: null }),
    ).toBe("scheduled");
  });

  it('treats an empty-string override as no decision, not as "anytime"', () => {
    // "Missing" has three shapes and only one is obvious: absent, `null`, and `""`. The empty
    // string is what a half-run migration or a form submitting a blank leaves behind, and read
    // literally it masks the provider's own `scheduled` behind a decision nobody took.
    expect(
      resolvePlayMode({ playMode: "scheduled", playModeOverride: "" }),
    ).toBe("scheduled");
    expect(
      resolvePlayMode({ playMode: "scheduled", playModeOverride: "sometimes" }),
    ).toBe("scheduled");
  });

  it("THE ORDER THAT MATTERS: a head-to-head title ignores the override entirely", () => {
    // Both directions, because only one of them looks wrong. Overriding to `anytime` is the
    // request an operator would actually make - "let them play whenever" - and it cannot be
    // honoured: there is no such thing as playing an opponent at a different time.
    expect(
      resolvePlayMode({ family: "head_to_head", playModeOverride: "anytime" }),
    ).toBe("scheduled");
    expect(
      resolvePlayMode({
        family: "head_to_head",
        playMode: "anytime",
        playModeOverride: "anytime",
      }),
    ).toBe("scheduled");
  });

  it("asks the same question ahead of time, so a control can withhold itself", () => {
    expect(canOverridePlayMode({ family: "head_to_head" })).toBe(false);
    expect(canOverridePlayMode({ family: "independent" })).toBe(true);
    // An absent family is not head-to-head, and must not be refused: a row synced before the
    // field existed would otherwise lose a control it is entitled to.
    expect(canOverridePlayMode(undefined)).toBe(true);
    expect(canOverridePlayMode({})).toBe(true);
  });

  it("still resolves to a real rule set for every mode it can return", () => {
    for (const mode of PLAY_MODES) {
      expect(playShapeRules(mode).mode).toBe(mode);
    }
  });
});

describe("PLAY_MODE_COPY", () => {
  it("names both modes, so a control never renders a blank option", () => {
    for (const mode of PLAY_MODES) {
      const copy = PLAY_MODE_COPY.get(mode);
      expect(copy?.label.length).toBeGreaterThan(3);
      expect(copy?.detail.length).toBeGreaterThan(40);
    }
  });

  it("is a Map, so a stored key cannot walk the prototype chain", () => {
    // A `Record` lookup on `"__proto__"` returns a truthy `Object.prototype`, which survives a
    // `!copy` test and fails later somewhere unrelated. Fourth instance of that trap after the
    // round-inspector action map, `competition-update-fields.ts` and the unscored-policy copy.
    expect(PLAY_MODE_COPY instanceof Map).toBe(true);
    expect(PLAY_MODE_COPY.get("__proto__" as never)).toBeUndefined();
    expect(PLAY_MODE_COPY.get("constructor" as never)).toBeUndefined();
  });
});

// =======================================================================================
// parsePlayStyleInput - what the route may be handed
// =======================================================================================

describe("parsePlayStyleInput", () => {
  it("accepts the two modes and null", () => {
    expect(parsePlayStyleInput("anytime")).toEqual({ ok: true, mode: "anytime" });
    expect(parsePlayStyleInput("scheduled")).toEqual({
      ok: true,
      mode: "scheduled",
    });
    expect(parsePlayStyleInput(null)).toEqual({ ok: true, mode: null });
  });

  it("refuses anything else, including the shapes that look harmless", () => {
    for (const bad of ["", "ANYTIME", "sometimes", "__proto__", "constructor", 1, {}, []]) {
      expect(parsePlayStyleInput(bad).ok).toBe(false);
    }
  });

  it("names the value it refused, so an operator is not left guessing", () => {
    const refused = parsePlayStyleInput("race");
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain("race");
  });
});

// =======================================================================================
// Behavioural, against a real database
// =======================================================================================

const COLLECTIONS = ["game_provider", "provider_game"];

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

/**
 * One catalogue row, with every field the schema demands.
 *
 * Not trimmed to the fields a test reads: Mongoose validates the document rather than the
 * subset under test, which is how 34 tests once failed on a single missing `slug`.
 */
async function seedTitle(
  overrides: {
    gameCode?: string;
    family?: string;
    playMode?: string;
    playModeOverride?: string;
  } = {},
) {
  const gameCode = overrides.gameCode ?? "mock-trivia";
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey: `provider:${MOCK_PROVIDER_KEY}:${gameCode}`,
    displayName: "Mock Trivia",
    family: overrides.family ?? "independent",
    ...(overrides.playMode ? { playMode: overrides.playMode } : {}),
    ...(overrides.playModeOverride
      ? { playModeOverride: overrides.playModeOverride }
      : {}),
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
  });
  return gameCode;
}

/**
 * The raw document, straight off the driver.
 *
 * A `.lean()` read cannot tell a stored `""` from an absent key - both arrive as something a
 * `?? ` swallows - and the difference between those two is the whole of rule 2 above. `in` on
 * the raw document is the only assertion that can see it.
 */
async function rawTitle(gameCode: string) {
  const collection = mongoose.connection.db?.collection("provider_game");
  return collection?.findOne({ providerKey: MOCK_PROVIDER_KEY, gameCode });
}

describe("the catalogue sync leaves our override alone", () => {
  it("rewrites the provider's own playMode and does not touch ours", async () => {
    // THE TEST THIS FILE EXISTS FOR.
    //
    // The row is seeded disagreeing with the provider on BOTH fields: stored `playMode` says
    // scheduled, the mock adapter declares `anytime`. So a passing run proves two separate
    // things - that the sync really did write in this pass, and that it wrote only one of the
    // two fields. Asserting the override survived on its own would pass just as happily
    // against a sync that failed and changed nothing, which is the version of this test that
    // would have let the defect through.
    const gameCode = await seedTitle({
      playMode: "scheduled",
      playModeOverride: "scheduled",
    });

    const result = await syncProviderCatalogue(new MockProviderAdapter());
    expect(result.success).toBe(true);

    const after = await rawTitle(gameCode);
    expect(after?.playMode).toBe("anytime");
    expect(after?.playModeOverride).toBe("scheduled");
  });

  it("does not invent an override for a title that has never had one", async () => {
    // A sync writing a default here would give every row in the catalogue a decision nobody
    // took, and `resolvePlayMode` would then stop consulting the provider for ever.
    await seedTitle({ playMode: "anytime" });
    await syncProviderCatalogue(new MockProviderAdapter());

    const after = await rawTitle("mock-trivia");
    expect(after && "playModeOverride" in after).toBe(false);
  });

  it("does not invent one when it CREATES a row either", async () => {
    // The create branch of the sync is a separate code path from the update branch, and it
    // spreads two different field groups. A default landing only there would be invisible to
    // the test above, which seeds the row itself.
    await syncProviderCatalogue(new MockProviderAdapter());

    const created = await rawTitle("mock-trivia");
    expect(created).toBeTruthy();
    expect(created && "playModeOverride" in created).toBe(false);
  });

  it("holds the same allow-list in BOTH copies of the sync", () => {
    // THE TESTS ABOVE EXERCISE THE WRONG COPY, and that is not fixable by importing the other
    // one. `catalogue.service.ts` exists twice, vitest aliases `@` to the repository root, and
    // the copy an operator's Sync catalogue button actually runs is the one in `apps/admin` -
    // reached through that app's own `@`, which no runtime assertion here can see.
    //
    // So a change adding `playModeOverride` to the ADMIN allow-list alone would revert every
    // operator's decision on the next sync while every behavioural test in this file stayed
    // green. That is the "one rule, two copies" shape behind `referenceId`, `failedReason`,
    // `challengeId` and the Game Master `||`, and `check:mirrors` cannot see it either,
    // because it compares models. A text comparison is the only guard available.
    //
    // Read raw rather than through `readCode`: a comment that has stopped being true in one
    // copy is exactly the drift worth catching.
    const main = readFileSync(
      join(ROOT, "lib/services/game-providers/catalogue.service.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/game-providers/catalogue.service.ts"),
      "utf8",
    );
    expect(admin).toBe(main);

    // And the property the comparison is standing in for, asserted on the copy this file can
    // read, so a reader knows what the byte match is protecting.
    expect(stripComments(main)).not.toContain("playModeOverride");
  });
});

describe("setGamePlayStyle", () => {
  it("stores our decision and reports what the wizard will now offer", async () => {
    const gameCode = await seedTitle({ playMode: "anytime" });

    const result = await setGamePlayStyle(MOCK_PROVIDER_KEY, gameCode, "scheduled");
    expect(result).toEqual({
      success: true,
      effective: "scheduled",
      override: "scheduled",
    });

    expect((await rawTitle(gameCode))?.playModeOverride).toBe("scheduled");
  });

  it("clears it by removing the key, never by storing an empty string", async () => {
    const gameCode = await seedTitle({
      playMode: "scheduled",
      playModeOverride: "anytime",
    });

    const result = await setGamePlayStyle(MOCK_PROVIDER_KEY, gameCode, null);
    expect(result.success).toBe(true);
    // The provider decides again, so the effective answer goes back to their declaration.
    if (result.success) {
      expect(result.effective).toBe("scheduled");
      expect(result.override).toBeUndefined();
    }

    const after = await rawTitle(gameCode);
    expect(after && "playModeOverride" in after).toBe(false);
  });

  it("refuses a head-to-head title, naming the reason", async () => {
    // Refused rather than stored and ignored. `resolvePlayMode` forces this title to
    // `scheduled` ahead of any override, so accepting the write would leave a value in the
    // database that no code path ever reads.
    const gameCode = await seedTitle({ family: "head_to_head" });

    const result = await setGamePlayStyle(MOCK_PROVIDER_KEY, gameCode, "anytime");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/opponent/i);

    const after = await rawTitle(gameCode);
    expect(after && "playModeOverride" in after).toBe(false);
  });

  it("refuses a game this provider does not have", async () => {
    await seedTitle();
    const result = await setGamePlayStyle(MOCK_PROVIDER_KEY, "not-a-game", "scheduled");
    expect(result.success).toBe(false);
  });

  it("cannot reach another provider's title through this provider's key", async () => {
    // Matched on the pair, like `updateGameContent`. A caller-supplied `gameKey` would be a
    // way to edit somebody else's catalogue through a URL we authorise them for.
    await ProviderGame.create({
      providerKey: "other-provider",
      gameCode: "their-game",
      gameKey: "provider:other-provider:their-game",
      displayName: "Someone Else's Game",
      family: "independent",
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      supportsCompetition: true,
      supportsContentSeed: true,
      providerStatus: "active",
    });

    const result = await setGamePlayStyle(MOCK_PROVIDER_KEY, "their-game", "scheduled");
    expect(result.success).toBe(false);

    const theirs = await mongoose.connection.db
      ?.collection("provider_game")
      .findOne({ providerKey: "other-provider" });
    expect(theirs && "playModeOverride" in theirs).toBe(false);
  });
});

// =======================================================================================
// It is not content
// =======================================================================================

describe("the play style cannot be written through the content editor", () => {
  it("refuses it with ITS OWN reason, not the generic unknown-field one", () => {
    // The specific message matters, and this is the lesson from `gameKey` on
    // `competition-update-fields.ts`: a field absent from BOTH lists is still refused, by the
    // unknown-field branch, whose message also contains the field name. So an assertion on
    // "was it refused" - or even on "does the error mention playModeOverride" - stays green
    // when the entry is deleted from the never-editable map, silently removing the explanation
    // an operator needs.
    const refused = validateGameContent({ playModeOverride: "scheduled" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toContain("Play style control");
      expect(refused.error).not.toContain("not an editable field");
    }
  });

  it("keeps it beside chartvoltEnabled, which is barred for the same reason", () => {
    expect(NEVER_EDITABLE_CONTENT_FIELDS.has("playModeOverride")).toBe(true);
    expect(NEVER_EDITABLE_CONTENT_FIELDS.has("chartvoltEnabled")).toBe(true);
  });

  it("is not offered by the content dialog", () => {
    const dialog = readCode(
      "apps/admin/components/admin/games/GameContentDialog.tsx",
    );
    expect(dialog.length).toBeGreaterThan(200);
    expect(dialog).not.toContain("playModeOverride");
    expect(dialog).not.toContain("GamePlayStyleControl");
  });
});

// =======================================================================================
// The route
// =======================================================================================

const PLAY_STYLE_ROUTE =
  "apps/admin/app/api/games/providers/[providerKey]/games/play-style/route.ts";

describe("PATCH .../games/play-style", () => {
  const code = readCode(PLAY_STYLE_ROUTE);

  it("guards every exported handler with the section that reveals the screen", () => {
    // `guardSection`, never `verifyAdminAuth` or `verifyAdminToken` - those ask whether the
    // caller is an admin at all, so an employee granted one unrelated section passes them.
    // Nine instances of that confusion are on record, the most recent being R57.
    const handlers = code.match(handlerPattern()) ?? [];
    expect(handlers.length).toBe(1);
    expect(guardedSections(code)).toEqual(["game-providers"]);
    expect(code).not.toMatch(/verifyAdminAuth\s*\(/);
    expect(code).not.toMatch(/verifyAdminToken\s*\(/);
  });

  it("guards before it reads the body", () => {
    const guardAt = code.search(guardCallPattern());
    const bodyAt = code.search(/await\s+request\.json\(\)/);
    expect(guardAt).toBeGreaterThan(-1);
    expect(bodyAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(bodyAt);
  });

  it("returns the guard's own refusal, once per guard", () => {
    const guards = code.match(guardCallPattern()) ?? [];
    const refusals =
      code.match(/if\s*\(\s*!\s*\w+\.ok\s*\)\s*return\s+\w+\.response/g) ?? [];
    expect(refusals.length).toBe(guards.length);
  });

  it("demands the field be present, so a malformed body cannot clear a decision", () => {
    // `null` means "follow the provider again", and an absent field would have to mean the
    // same thing - at which point `{ gameCode }` alone silently undoes an operator's choice.
    expect(code).toMatch(/"playMode"\s+in\s+body/);
  });

  it("writes only the play style - it is not a second door onto the enable switch", () => {
    // The three controls on a catalogue row write through three routes precisely so that one
    // cannot be used to work the others. A content save silently changing a game's live state
    // is the failure this separation exists to prevent.
    expect(code).not.toContain("chartvoltEnabled");
    expect(code).not.toContain("setTitleEnabled");
    expect(code).not.toContain("updateGameContent");
  });

  it("records the change, because a money-adjacent setting needs attribution", () => {
    expect(code).toMatch(/auditLogService\.log/);
  });
});

// =======================================================================================
// The control, and where the style is shown
// =======================================================================================

const CONTROL = "apps/admin/components/admin/games/GamePlayStyleControl.tsx";
const CATALOGUE = "apps/admin/components/admin/games/ProviderCatalogueDialog.tsx";
const PICKER = "apps/admin/components/admin/games/wizard/StepChooseGame.tsx";

describe("the Play style control", () => {
  const control = readCode(CONTROL);

  it("names no game code, provider key or title", () => {
    // The single failure mode of the no-developer-needed claim. Every word this control
    // renders comes from `PLAY_MODE_COPY` and the catalogue row, so a title we have never
    // seen shows its own style with its own explanation.
    expect(control.length).toBeGreaterThan(200);
    expect(control).not.toMatch(/gameCode\s*===/);
    expect(control).not.toMatch(/gameKey\s*===/);
    expect(control).not.toContain("circuit-sprint");
  });

  it("asks the shared helper whether the choice exists, rather than testing family itself", () => {
    // THE NEGATIVE HALF IS LOAD-BEARING. Importing `canOverridePlayMode` is trivially
    // satisfied by a component that imports it and then writes `family === "head_to_head"`
    // five lines later - which is the shape behind `referenceId`, `failedReason`,
    // `challengeId` and the Game Master `||`. If this control ever disagreed with the service,
    // an operator would be offered a choice the server refuses with a 400 that reads like a
    // permissions problem.
    expect(control).toMatch(/canOverridePlayMode\s*\(/);
    expect(control).not.toContain("head_to_head");
    expect(control).not.toMatch(/family\s*===/);
  });

  it("resolves the effective style through the one resolver", () => {
    expect(control).toMatch(/resolvePlayMode\s*\(/);
  });

  it("says WHY the choice is withheld rather than merely greying it out", () => {
    // A disabled control teaches an operator that the setting does not exist. Same rule as
    // refusing to enable a provider with no adapter, and as the wizard's withheld
    // round-start control.
    expect(control.toLowerCase()).toContain("opponent");
  });
});

describe("where the play style is shown", () => {
  it("appears on the Games list, exactly once", () => {
    // Counted, not merely found: a second copy of this control on one row would give an
    // operator two switches for one setting, and whichever they used last would win.
    const catalogue = readCode(CATALOGUE);
    const uses = catalogue.match(/<GamePlayStyleControl\b/g) ?? [];
    expect(uses.length).toBe(1);
    expect(catalogue).toContain("Play style");
  });

  it("appears on the wizard's game picker", () => {
    // It changes the rest of the wizard more than any other property of the title - the
    // schedule step relabels itself, entry closes at the start, and the attempts and
    // round-start controls are withheld - so an operator must see it before choosing.
    const picker = readCode(PICKER);
    expect(picker).toMatch(/PLAY_MODE_COPY\.get\(\s*title\.playMode\s*\)/);
  });

  it("does not re-derive the style on the picker", () => {
    // `listContestableTitles` already passes the row through `resolvePlayMode`, so the picker
    // is handed the corrected answer. A second resolution here would let the badge disagree
    // with the controls the next steps render.
    const picker = readCode(PICKER);
    expect(picker).not.toMatch(/resolvePlayMode\s*\(/);
    expect(picker).not.toContain("playModeOverride");
  });
});
