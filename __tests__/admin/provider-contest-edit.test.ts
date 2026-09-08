/**
 * X6: editing a contest - the trading route's allow-list, and the provider contest editor.
 *
 * TWO DEFECTS ARE PINNED HERE AND ONLY ONE OF THEM IS ABOUT GAMES.
 *
 * `PUT /api/competitions/[id]` did `Object.assign(competition, await request.json())` behind
 * a hand-rolled JWT check. Every employee is issued an `admin_token`, so a support employee
 * granted only `messaging` could rewrite any field on any contest - including `gameKey`,
 * which is the immutable join key for every historical stat, and `status`, which could walk
 * a contest backwards out of `completed`. That is not a provider-games problem; it was live
 * for trading contests the whole time.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE. The edit service lives in
 * `apps/admin`, but vitest maps `@` to the REPO ROOT, so its `@/database/...` imports
 * resolve to the MAIN app's models. This file therefore seeds the main copies - the ones the
 * service actually reads. Seeding the admin copies puts fixtures on a Mongoose instance the
 * service never touches, and every assertion then fails on an empty collection, which reads
 * exactly like a logic bug. Only ONE copy of each model is imported, because both register
 * under the same name via `models.X || model(...)`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  TRADING_EDITABLE_FIELDS,
  NEVER_EDITABLE_FIELDS,
  filterTradingCompetitionUpdate,
} from "../../apps/admin/lib/admin/competition-update-fields";
import {
  EDITABLE_ONCE_ENTERED,
  isClosedToEdits,
} from "../../apps/admin/lib/admin/provider-contest-edit-policy";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const Competition = (
  await import("../../database/models/trading/competition.model")
).default;
const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);
const { editProviderContest } = await import(
  "../../apps/admin/lib/services/game-providers/provider-contest-edit.service"
);

const ROOT = process.cwd();
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "competitions",
  "game_provider",
  "provider_game",
  "whitelabels",
];

function readCode(relativePath: string): string {
  // Comments stripped before matching. A structural test that reads prose fails in both
  // directions: it flags a correct file for explaining the anti-pattern, and it passes a
  // broken one whose only mention of the right thing is in a comment.
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// =======================================================================================
// The trading route's allow-list
// =======================================================================================

describe("filterTradingCompetitionUpdate", () => {
  it("accepts exactly the fields the trading editor submits", () => {
    const body: Record<string, unknown> = {};
    // Reason: the keys are the allow-list itself, not request input - building the fixture
    // FROM the constant is the point, so a field added to it is covered without editing here.
    // eslint-disable-next-line security/detect-object-injection
    for (const field of TRADING_EDITABLE_FIELDS) body[field] = 1;

    const result = filterTradingCompetitionUpdate(body);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.update).sort()).toEqual(
      [...TRADING_EDITABLE_FIELDS].sort(),
    );
  });

  it("REFUSES gameKey with the IMMUTABILITY message, not the unknown-field one", () => {
    // The message, not merely the refusal, and the first version of this test was weak for
    // exactly that reason. `gameKey` is absent from the allow-list too, so deleting it from
    // the never-list still gets it refused - as an unknown field. Asserting only
    // `toContain("gameKey")` therefore passed with the never-list gutted, because both
    // messages name the key.
    //
    // The never-list is defence in DEPTH rather than the defence: the allow-list is what
    // stops `gameKey` today. What the never-list buys is the day somebody legitimately adds
    // a field to the allow-list and reaches for `status` or `gameKey` while they are there.
    // Pinning the wording is what keeps that second layer real.
    const result = filterTradingCompetitionUpdate({
      name: "Fine",
      gameKey: "provider:acme:whatever",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("gameKey");
    expect(result.error).toContain("cannot be changed after a contest is created");
    // Nothing partially applied: a refusal must not leave the legal half of a body written.
    expect(result.update).toEqual({});
  });

  it("refuses gameType, so a contest cannot be relabelled into another game", () => {
    const result = filterTradingCompetitionUpdate({ gameType: "provider" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("gameType");
  });

  it("refuses status, so a contest cannot be walked back out of completed", () => {
    const result = filterTradingCompetitionUpdate({ status: "upcoming" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("status");
  });

  it("refuses contentSeed - changing it means two ranked players played different games", () => {
    const result = filterTradingCompetitionUpdate({ contentSeed: "deadbeef" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("contentSeed");
  });

  it("REFUSES an unknown field rather than silently dropping it", () => {
    // The load-bearing choice. Dropping is how the simulator batch route lost six
    // participant fields and how strict mode lost `suspensionEndsAt` - both reporting
    // success. A refusal breaks a save loudly in an admin screen instead.
    const result = filterTradingCompetitionUpdate({
      name: "Fine",
      somethingNobodyDeclared: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("somethingNobodyDeclared");
  });

  it("refuses prototype-shaped keys, which an object lookup table would have admitted", () => {
    // THE ORIGINAL VERSION OF THIS TEST MADE A FALSE CLAIM and its probe correctly stayed
    // green. It said a `for...in` loop "would have admitted" `toString`; measured, `for...in`
    // and `Object.keys` return exactly the same keys for a JSON body, because inherited
    // prototype properties are not enumerable. Swapping the loop changes nothing.
    //
    // The real trap is one level along, and it is the same one as the round-resolution action
    // list: an object used as a lookup table. `({name: 1})["constructor"]` is truthy via the
    // prototype chain, so `if (!ALLOWED[key]) refuse` admits `constructor` and hands it to
    // `Object.assign`. A `Set` has no prototype chain, so `has` is total. Note `__proto__`
    // arrives as a genuine OWN key from `JSON.parse`, unlike from an object literal.
    for (const key of ["constructor", "toString", "__proto__", "valueOf"]) {
      const result = filterTradingCompetitionUpdate(
        JSON.parse(`{"${key}": "gotcha"}`),
      );
      expect(result.ok, `${key} must be refused`).toBe(false);
      expect(result.update).toEqual({});
    }
  });

  it("refuses a body that is not an object, and an empty one", () => {
    expect(filterTradingCompetitionUpdate(null).ok).toBe(false);
    expect(filterTradingCompetitionUpdate([]).ok).toBe(false);
    expect(filterTradingCompetitionUpdate("nope").ok).toBe(false);
    expect(filterTradingCompetitionUpdate({}).ok).toBe(false);
  });

  it("has no field appearing in both the allow-list and the never-list", () => {
    // A field in both would make the allow-list a lie: it reads as editable and is refused.
    const allowed = new Set<string>(TRADING_EDITABLE_FIELDS);
    const overlap = NEVER_EDITABLE_FIELDS.filter((f) => allowed.has(f));
    expect(overlap).toEqual([]);
  });
});

describe("the allow-list matches what the trading editor actually sends", () => {
  it("covers every key in CompetitionEditorForm's updatePayload", () => {
    // THE GUARD THAT MATTERS. Adding a field to the form without adding it here makes the
    // save refuse - loudly, but only when an operator tries it. This turns that into a
    // failing test at the moment the field is added.
    const form = readCode(
      "apps/admin/components/admin/CompetitionEditorForm.tsx",
    );
    const block = /const updatePayload = \{([\s\S]*?)\n {6}\};/.exec(form);
    expect(block, "updatePayload literal not found - has the form been renamed?").
      not.toBeNull();

    const keys = [...block![1].matchAll(/^\s{8}([A-Za-z0-9_]+)\s*[:,]/gm)].map(
      (m) => m[1],
    );
    // Sanity: if the extraction breaks, this is what tells us, rather than a vacuous pass
    // against an empty list.
    expect(keys.length).toBeGreaterThanOrEqual(10);

    const allowed = new Set<string>(TRADING_EDITABLE_FIELDS);
    expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
  });
});

// =======================================================================================
// The route
// =======================================================================================

describe("PUT/GET/DELETE /api/competitions/[id]", () => {
  const ROUTE = "apps/admin/app/api/competitions/[id]/route.ts";

  it("no longer carries its own JWT check", () => {
    // The hand-rolled `verifyAdminToken` verified a signature and nothing else - no section
    // grant, and none of the four revocations `verifyAdminAuth` performs (deleted, disabled,
    // locked out, force-logged-out).
    expect(readCode(ROUTE)).not.toContain("verifyAdminToken");
  });

  it("guards every exported handler on the competitions section", () => {
    // Counted rather than merely present: a file whose GET is guarded and whose PUT is not
    // passes a `toContain` check while leaving the mutation wide open.
    const code = readCode(ROUTE);
    const handlers = [...code.matchAll(/export async function (GET|PUT|DELETE|POST|PATCH)\b/g)];
    const guards = [...code.matchAll(/guardSection\("competitions"\)/g)];
    expect(handlers.length).toBe(3);
    expect(guards.length).toBe(handlers.length);
  });

  it("assigns the FILTERED update, never the raw request body", () => {
    const code = readCode(ROUTE);
    expect(code).toMatch(/Object\.assign\(\s*competition,\s*filtered\.update\s*\)/);
    // And the raw body never reaches the document under any name.
    expect(code).not.toMatch(/Object\.assign\(\s*competition,\s*(updateData|body)\s*\)/);
  });

  it("refuses a provider contest BEFORE it reads or applies a body", () => {
    // Position, not presence. A refusal placed after the assign would already have written
    // trading fields onto the puzzle by the time it fired.
    const code = readCode(ROUTE);
    const refusal = code.indexOf("hasProviderGameLabel(competition)");
    const readBody = code.indexOf("await request.json()");
    const assign = code.indexOf("Object.assign(competition");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(readBody);
    expect(refusal).toBeLessThan(assign);
  });

  it("asks about the LABEL, not the stricter isProviderContest", () => {
    // A provider contest with no keys cannot launch a round but is still not a trading
    // contest, and is exactly the row an operator would try to "fix" through this form.
    const code = readCode(ROUTE);
    expect(code).toContain("hasProviderGameLabel");
    expect(code).not.toContain("isProviderContest");
  });
});

describe("the provider edit route", () => {
  const ROUTE = "apps/admin/app/api/games/contests/[competitionId]/route.ts";

  it("guards both handlers on competitions, not on game-providers", () => {
    // Running contests and reaching provider API credentials are different jobs. Guarding
    // this on `game-providers` would make every competition operator a credential holder -
    // and it would review as consistent.
    const code = readCode(ROUTE);
    const handlers = [...code.matchAll(/export async function (GET|PATCH)\b/g)];
    expect(handlers.length).toBe(2);
    expect([...code.matchAll(/guardSection\("competitions"\)/g)].length).toBe(2);
    expect(code).not.toContain('guardSection("game-providers")');
  });

  it("never reads a game identity field out of the request body", () => {
    // Game identity is not editable at any status. If the body parser learned to read
    // `providerKey`, the service's freeze list would be the only thing standing between an
    // operator and a contest that changes game.
    const code = readCode(ROUTE);
    expect(code).not.toMatch(/raw\.(providerKey|gameCode|gameKey|gameType|contentSeed)/);
  });
});

// =======================================================================================
// The list screen
// =======================================================================================

describe("the competitions list Edit control", () => {
  const LIST = "apps/admin/components/admin/CompetitionsListSection.tsx";

  it("routes a provider contest to the game editor and trading to the trading editor", () => {
    const code = readCode(LIST);
    expect(code).toContain("/competitions/edit-game/");
    expect(code).toContain("/competitions/edit/");
    // The condition and both destinations in one expression, so neither can be reached by
    // the wrong kind of contest.
    expect(code).toMatch(
      /hasProviderGameLabel\(competition\)[\s\S]{0,120}edit-game[\s\S]{0,120}competitions\/edit\//,
    );
  });

  it("no longer tells the operator that editing is unbuilt", () => {
    // An operator-facing caution that has become false is worse than none: it sends someone
    // to cancel and refund a contest they could simply have edited.
    expect(readCode(LIST)).not.toContain("not built yet");
  });
});

// =======================================================================================
// The freeze policy
// =======================================================================================

describe("the shared freeze policy", () => {
  it("is imported by both the service and the form, never duplicated", () => {
    // "One rule, two copies" has produced four defects in this codebase, none of which
    // `check:mirrors` can see because it compares models.
    const service = readCode(
      "apps/admin/lib/services/game-providers/provider-contest-edit.service.ts",
    );
    const form = readCode(
      "apps/admin/components/admin/games/ProviderContestEditor.tsx",
    );
    expect(service).toContain("provider-contest-edit-policy");
    expect(form).toContain("provider-contest-edit-policy");
    // Neither may re-declare the list locally.
    expect(service).not.toMatch(/EDITABLE_ONCE_ENTERED\s*=/);
    expect(form).not.toMatch(/EDITABLE_ONCE_ENTERED\s*=/);
  });

  it("treats finalizing as closed, not merely completed", () => {
    // During `finalizing` ranking is being computed from participant scores, so a change
    // landing then may or may not be counted depending purely on timing.
    expect(isClosedToEdits("finalizing")).toBe(true);
    expect(isClosedToEdits("completed")).toBe(true);
    expect(isClosedToEdits("cancelled")).toBe(true);
    expect(isClosedToEdits("emergency_ended")).toBe(true);
    expect(isClosedToEdits("draft")).toBe(false);
    expect(isClosedToEdits("upcoming")).toBe(false);
    expect(isClosedToEdits("active")).toBe(false);
  });

  it("freezes every money and fairness field once a player has entered", () => {
    const survives = new Set<string>(EDITABLE_ONCE_ENTERED);
    for (const frozen of [
      "entryFee",
      "platformFeePercentage",
      "prizeDistribution",
      "settings",
      "startTime",
      "endTime",
      "playWindowStart",
      "playWindowEnd",
      "attemptsPolicy",
      "minParticipants",
    ]) {
      expect(survives.has(frozen), `${frozen} must be frozen`).toBe(false);
    }
  });
});

// =======================================================================================
// editProviderContest - behavioural
// =======================================================================================

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
  await seedCatalogue();
});

/** A provider, title and master switch with nothing stopping a contest being saved. */
async function seedCatalogue() {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Trivia",
    // Real enum values, checked against `provider-game.model.ts`. A guessed "trivia" /
    // "points" pair failed the whole suite on one validation error in `beforeEach`, which
    // reads as 34 broken tests rather than one wrong fixture.
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: {
      type: "object",
      properties: {
        rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["rounds"],
    },
    lastSuccessfulRoundAt: new Date(),
  });
  await WhiteLabel.create({ externalGamesEnabled: true });
}

const HOUR = 60 * 60 * 1000;

/**
 * A complete provider contest.
 *
 * EVERY FIELD THE SCHEMA DEMANDS, not just the ones an edit touches. Mongoose validates the
 * document, not the subset under test - a fixture trimmed to what the test reads is how 34
 * unrelated tests once failed on one missing `slug`.
 */
async function seedContest(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 2 * HOUR);
  const end = new Date(Date.now() + 6 * HOUR);
  return Competition.create({
    name: "Trivia Night",
    slug: `trivia-night-${Math.random().toString(36).slice(2, 8)}`,
    description: "A test contest",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: {
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: { rounds: 5 },
    },
    contentSeed: "aabbccdd",
    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 50,
    currentParticipants: 0,
    startTime: start,
    endTime: end,
    registrationDeadline: start,
    status: "draft",
    competitionType: "time_based",
    prizePool: 0,
    platformFeePercentage: 10,
    prizeDistribution: [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 },
    ],
    createdBy: "507f1f77bcf86cd799439011",
    ...overrides,
  });
}

describe("editProviderContest", () => {
  it("edits a draft freely and stores the COERCED setting, not the submitted string", () => {
    return (async () => {
      const contest = await seedContest();
      const result = await editProviderContest(String(contest._id), {
        name: "Trivia Night II",
        entryFee: 25,
        settings: { rounds: "7" as unknown as number },
      });

      expect(result.success, result.error).toBe(true);
      const saved = await Competition.findById(contest._id).lean<{
        name: string;
        entryFee: number;
        gameConfig?: { settings?: Record<string, unknown> };
      } | null>();
      expect(saved?.name).toBe("Trivia Night II");
      expect(saved?.entryFee).toBe(25);
      // "7" from a form becomes the number 7. Storing the string would reach the provider
      // as a string and be refused at play time.
      expect(saved?.gameConfig?.settings?.rounds).toBe(7);
    })();
  });

  it("REFUSES a frozen field once a player has entered, naming it", async () => {
    const contest = await seedContest({
      status: "upcoming",
      currentParticipants: 3,
    });
    const result = await editProviderContest(String(contest._id), {
      entryFee: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("entryFee");
    const saved = await Competition.findById(contest._id).lean<{
      entryFee: number;
    } | null>();
    expect(saved?.entryFee).toBe(10);
  });

  it("still allows the name, description and RAISING the cap once entered", async () => {
    const contest = await seedContest({
      status: "upcoming",
      currentParticipants: 3,
    });
    const result = await editProviderContest(String(contest._id), {
      name: "Renamed",
      description: "Fixed a typo",
      maxParticipants: 80,
    });

    expect(result.success, result.error).toBe(true);
    const saved = await Competition.findById(contest._id).lean<{
      name: string;
      maxParticipants: number;
    } | null>();
    expect(saved?.name).toBe("Renamed");
    expect(saved?.maxParticipants).toBe(80);
  });

  it("refuses a cap below the players already entered", async () => {
    // Otherwise `currentParticipants > maxParticipants`, which every "is registration open"
    // check reads - the contest silently looks full.
    const contest = await seedContest({
      status: "upcoming",
      currentParticipants: 30,
    });
    const result = await editProviderContest(String(contest._id), {
      maxParticipants: 10,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("30");
  });

  it("refuses to edit a completed contest at all", async () => {
    const contest = await seedContest({ status: "completed" });
    const result = await editProviderContest(String(contest._id), {
      name: "Too late",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("completed");
  });

  it("refuses a trading contest, directing the caller to the trading form", async () => {
    const contest = await seedContest({
      gameType: "trading",
      gameKey: "trading",
      startingCapital: 10_000,
      gameConfig: undefined,
    });
    const result = await editProviderContest(String(contest._id), {
      name: "Nope",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("trading form");
  });

  it("leaves game identity and the content seed untouched by any edit", async () => {
    const contest = await seedContest();
    await editProviderContest(String(contest._id), {
      name: "Renamed",
      settings: { rounds: 9 },
    });

    const saved = await Competition.findById(contest._id).lean<{
      gameType: string;
      gameKey: string;
      contentSeed?: string;
      gameConfig?: { providerKey?: string; gameCode?: string };
    } | null>();
    expect(saved?.gameType).toBe("provider");
    expect(saved?.gameKey).toBe(GAME_KEY);
    expect(saved?.contentSeed).toBe("aabbccdd");
    expect(saved?.gameConfig?.providerKey).toBe(MOCK_PROVIDER_KEY);
    expect(saved?.gameConfig?.gameCode).toBe(GAME_CODE);
  });

  it("re-validates settings against the title's LIVE schema", async () => {
    // A provider can change a title's `configSchema` between sync runs, so an edit is the
    // moment to discover the stored answers no longer fit.
    const contest = await seedContest();
    const result = await editProviderContest(String(contest._id), {
      settings: { rounds: 999 },
    });
    expect(result.success).toBe(false);
    expect((result.errors ?? []).join(" ")).toMatch(/rounds/i);
  });

  it("re-runs the pre-flight, so a title disabled since creation blocks the save", async () => {
    const contest = await seedContest();
    await ProviderGame.updateOne(
      { providerKey: MOCK_PROVIDER_KEY, gameCode: GAME_CODE },
      { $set: { chartvoltEnabled: false } },
    );

    const result = await editProviderContest(String(contest._id), {
      name: "Renamed",
    });
    expect(result.success).toBe(false);
    expect((result.errors ?? []).join(" ")).toContain("not enabled on ChartVolt");
  });

  it("validates the MERGED contest, not the submitted subset", async () => {
    // Submitting `endTime` alone is only legal against the stored `startTime`. Validating
    // the subset in isolation is how a contest ends up ending before it starts.
    const contest = await seedContest();
    const result = await editProviderContest(String(contest._id), {
      endTime: new Date(Date.now() + HOUR),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("end after it starts");
  });

  it("refuses an empty update rather than reporting a save that did nothing", async () => {
    const contest = await seedContest();
    const result = await editProviderContest(String(contest._id), {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("no fields");
  });

  it("recomputes the registration deadline instead of pinning it to the start time", async () => {
    // FLIPPED 8 September 2026. This test asserted `deadline === startTime`, which was the
    // rule until the owner's instruction that a player may join at any point before the
    // contest ends. Kept rather than deleted, because the reason it was written still holds:
    // leaving the OLD deadline behind after moving the schedule is silently wrong.
    //
    // What replaces it: the deadline is the last moment an attempt could still be started,
    // which here is the play window end less the title's 300-second clock, because the seeded
    // `configSchema` declares no `duration-seconds` field and the contest reserves a full
    // round. Deriving it in the test the way the service does would be tautological, so the
    // load-bearing assertion is the second one - it is nowhere near the start time.
    const contest = await seedContest();
    const newStart = new Date(Date.now() + 3 * HOUR);
    const result = await editProviderContest(String(contest._id), {
      startTime: newStart,
      playWindowStart: newStart,
    });

    expect(result.success, result.error).toBe(true);
    const saved = await Competition.findById(contest._id).lean<{
      registrationDeadline: Date;
      playWindowEnd: Date;
    } | null>();

    expect(saved?.registrationDeadline.getTime()).toBe(
      saved!.playWindowEnd.getTime() - 300_000,
    );
    // The defect this replaces, stated as a behaviour: entry survives the start.
    expect(saved!.registrationDeadline.getTime()).toBeGreaterThan(
      newStart.getTime(),
    );
  });
});
