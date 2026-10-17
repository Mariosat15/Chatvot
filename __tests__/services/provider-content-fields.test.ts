/**
 * Every piece of content the provider contract REQUIRES has somewhere to be stored.
 *
 * R63. Until 10 September 2026 the contract demanded six content fields of every provider,
 * our own reference provider sent all six, and the sync stored two. `tagline` and
 * `bannerUrl` had model fields and were in neither sync allow-list; `rulesSummary` and
 * `howToPlay` had no field at all and were not even declared on `ProviderCatalogueGame`,
 * so an adapter could not have handed them over if it wanted to. Four fields discarded on
 * every sync of every provider, with no error and no log line.
 *
 * WHY NOTHING CAUGHT IT, which is what this file is shaped around: NOTHING CONNECTED THE
 * ISSUED SPECIFICATION TO THE CODE. Both `01` s3.1 and the requirements HTML sent to
 * providers were correct and agreed with each other, so the paired-document rule was
 * satisfied and the drift ran document -> code, where nobody was looking. Every test that
 * touched the sync asserted the fields it already knew about.
 *
 * So the first test below READS THE SPEC'S OWN TABLE and requires each `Yes` row to be
 * either stored by a real sync or listed as a documented exception. That is deliberately a
 * BEHAVIOURAL tripwire rather than a text match against `firstSyncOnlyFields`: a structural
 * check is satisfied by a field named in an allow-list that the schema then discards,
 * which is a failure this codebase has hit repeatedly. A seventh required field added to
 * the spec and forgotten in the code turns it red.
 *
 * The exception list is the honest part. Two of the spec's `Yes` rows genuinely have
 * nowhere to go, and saying so in a place a test enforces beats a summary claiming the
 * contract is fully honoured.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "@/lib/services/game-providers/adapters/mock.adapter";
import { syncProviderCatalogue } from "@/lib/services/game-providers/catalogue.service";
import type { ProviderCatalogueGame } from "@/lib/services/game-providers/contract";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";

/*
 * Two rules are switched off for this file, both for the same reason and neither casually.
 *
 * `detect-object-injection` fires on `row[field]`, where `field` comes from a literal array
 * written below or from the spec table this repository ships. There is no request, no user
 * and no caller - the whole point of the file is to iterate a field list rather than name
 * each field, because naming them is precisely what let four of them be forgotten.
 *
 * `detect-non-literal-regexp` fires on patterns built from those same names. Building them
 * is the alternative to writing eight near-identical literals, which is the shape a ninth
 * field gets left out of.
 */
/* eslint-disable security/detect-object-injection, security/detect-non-literal-regexp */

const ROOT = join(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** Comments first: these files now explain the discarded fields in prose and name them. */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * The spec's `Yes` rows that the catalogue deliberately does not store, with the reason.
 *
 * Each of these is a decision, not an oversight, and the difference matters: a reader who
 * finds `locales` absent from the model needs to know whether localisation is unbuilt or
 * merely forgotten.
 */
const NOT_STORED: ReadonlyMap<string, string> = new Map([
  [
    "displayName",
    // Stored, but under the same name in a different allow-list position - it is the one
    // content field that is also required for a row to exist at all, so the sync writes it
    // on create like the rest and every screen has always read it. Listed here only because
    // the assertion below reads the spec table, which does not know that.
    "stored on create; asserted separately by the sync suite",
  ],
  [
    "locales",
    // Localisation is chapter 16 / X11 and is not built. There is no locale map on
    // `provider_game` and no screen that could choose between two languages, so a field
    // holding a provider's declared locales would be written and read by nothing - the
    // sixth declared-written-dead field, after `requiresSyncPlay`, `isPaused`,
    // `lastSuccessfulRoundAt`, `family` and `playModeOverride` on a head-to-head title.
    "localisation is X11 and unbuilt; storing it now would be a field nothing reads",
  ],
]);

/** Fields whose spec name differs from the stored name. */
const SPEC_TO_STORED: ReadonlyMap<string, string> = new Map([]);

/**
 * Parse section 3.1's table of presentation content.
 *
 * Reason for reading the `.md` rather than restating the list here: a restated list is a
 * second copy of the contract, and this whole defect is what happens when the contract and
 * the code disagree with nobody noticing. A copy would have been written to match the code
 * on the day it was added, which is exactly the state that shipped.
 */
function requiredContentFields(): string[] {
  const spec = read("External game plans/01-provider-contract-specification.md");
  const section = spec.slice(spec.indexOf("### 3.1 Presentation content"));
  expect(section.length, "section 3.1 not found in the provider spec").toBeGreaterThan(500);

  const rows = [...section.matchAll(/^\|\s*`(\w+)`\s*\|\s*(Yes|No)\s*\|/gm)];
  expect(rows.length, "no field rows parsed from the spec table").toBeGreaterThan(8);

  return rows.filter((row) => row[2] === "Yes").map((row) => row[1]);
}

/** One title declaring every content field the contract type can carry. */
const FULLY_POPULATED: ProviderCatalogueGame[] = [
  {
    gameCode: "spec-complete",
    displayName: "Spec Complete",
    tagline: "A tagline.",
    description: "A description of what the player actually does.",
    rulesSummary: "How the score is produced and how ties break.",
    howToPlay: "The controls, in plain language.",
    category: "puzzle",
    thumbnailUrl: "https://example.test/thumb.png",
    bannerUrl: "https://example.test/banner.png",
    family: "independent",
    supportsCompetition: true,
    supportsOneVsOne: false,
    supportsPractice: true,
    supportsContentSeed: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    status: "active",
  },
];

describe("R63: the contract's required content has somewhere to be stored", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
  }, 60_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.test",
    });
  });

  it("stores every content field the issued specification marks required", async () => {
    const required = requiredContentFields();

    const result = await syncProviderCatalogue(
      new MockProviderAdapter({ catalogue: FULLY_POPULATED }),
    );
    expect(result.success).toBe(true);

    const row = await ProviderGame.findOne({ gameCode: "spec-complete" }).lean<
      Record<string, unknown>
    >();
    expect(row, "the sync stored no row at all").toBeTruthy();

    const missing: string[] = [];
    for (const field of required) {
      if (NOT_STORED.has(field)) continue;
      const stored = SPEC_TO_STORED.get(field) ?? field;
      // Reason: a truthiness test would let a stored "" pass, and "" is the value this
      // codebase keeps having to tell apart from an absent one.
      if (typeof row?.[stored] !== "string" || row[stored] === "") {
        missing.push(field);
      }
    }

    expect(
      missing,
      `the provider contract requires these and the sync stores none of them: ${missing.join(", ")}. ` +
        "Either store the field or add it to NOT_STORED with the reason.",
    ).toEqual([]);
  });

  it("leaves a content field the provider omitted UNSET, never an empty string", async () => {
    // Reason: `mock-sprint` declares none of the four, and that asymmetry is the point of
    // the fixture. Every consumer treats an absent value as "say less" and falls back -
    // `banners.ts` answers from the game code, the arena omits the tagline line entirely.
    // A stored "" satisfies `field !== undefined`, so the fallbacks stop firing and the
    // screen renders a blank slot where it should have rendered nothing.
    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-sprint" }).lean<
      Record<string, unknown>
    >();
    expect(row, "the sync stored no row for mock-sprint").toBeTruthy();

    for (const field of ["tagline", "rulesSummary", "howToPlay", "bannerUrl"]) {
      expect(row?.[field], `${field} should be absent, not ""`).toBeUndefined();
    }
  });

  it("carries the four discarded fields all the way from the payload to the row", async () => {
    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" }).lean<
      Record<string, unknown>
    >();
    expect(row?.tagline).toBe("A fixture tagline, under ninety characters.");
    expect(row?.rulesSummary).toBe(
      "Correct answers score. Highest total wins; ties break on total time.",
    );
    expect(row?.howToPlay).toBe("Read the question and answer before the timer runs out.");
    expect(row?.bannerUrl).toBe("https://example.test/mock-trivia-banner.png");
  });

  it("does NOT revert an operator's edit to content on the next sync", async () => {
    // Reason: this is the load-bearing consequence of putting the six in
    // `firstSyncOnlyFields` rather than `providerOwnedFields`, and it is the half a
    // structural test cannot see. These are sentences a player reads, so an operator has to
    // be able to fix a provider's grammar, tone or language - and a scheduled sync silently
    // undoing that edit is the failure `catalogue.service.ts` exists to prevent.
    await syncProviderCatalogue(new MockProviderAdapter());
    await ProviderGame.updateOne(
      { gameCode: "mock-trivia" },
      {
        $set: {
          tagline: "The operator's own wording.",
          rulesSummary: "The operator's own rules text.",
          howToPlay: "The operator's own instructions.",
          bannerUrl: "/uploads/operator-banner.png",
        },
      },
    );

    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" }).lean<
      Record<string, unknown>
    >();
    expect(row?.tagline).toBe("The operator's own wording.");
    expect(row?.rulesSummary).toBe("The operator's own rules text.");
    expect(row?.howToPlay).toBe("The operator's own instructions.");
    expect(row?.bannerUrl).toBe("/uploads/operator-banner.png");
  });

  it("still honours the provider for fields that are THEIRS to declare", async () => {
    // Reason: the mirror image of the test above, and it is not decoration. If a later edit
    // moved the content fields into `providerOwnedFields` "for consistency", the previous
    // test goes red and this one stays green - but if somebody moved `scoreDirection` the
    // OTHER way, to first-sync-only, every test above would pass while a provider
    // correcting how their own game ranks would be permanently ignored.
    await syncProviderCatalogue(new MockProviderAdapter());
    await ProviderGame.updateOne(
      { gameCode: "mock-trivia" },
      { $set: { scoreDirection: "lower_is_better" } },
    );

    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" }).lean<
      Record<string, unknown>
    >();
    expect(row?.scoreDirection).toBe("higher_is_better");
  });
});

describe("R63: nothing on the path can drop a required content field", () => {
  it("declares all six on the catalogue contract", () => {
    const contract = code("lib/services/game-providers/contract.ts");
    const start = contract.indexOf("export interface ProviderCatalogueGame {");
    expect(start, "ProviderCatalogueGame not found").toBeGreaterThan(-1);
    const body = contract.slice(start, contract.indexOf("\n}", start));
    expect(body.length, "the interface body sliced to nothing").toBeGreaterThan(150);

    // Reason: asserted on the interface rather than only on a stored row, because the shape
    // this interface declares is WHERE THE FOUR FIELDS WERE LOST. An adapter cannot hand
    // over a field the type it returns has no room for, so the omission here was the defect
    // and every layer below it was working correctly on the data it was given.
    for (const field of [
      "displayName",
      "tagline",
      "description",
      "rulesSummary",
      "howToPlay",
      "thumbnailUrl",
      "bannerUrl",
      "category",
    ]) {
      expect(body, `ProviderCatalogueGame is missing ${field}`).toMatch(
        new RegExp(`\\b${field}\\??:`),
      );
    }
  });

  it("parses all six in the ChartVolt Games adapter, rather than dropping them", () => {
    const adapter = code("lib/services/game-providers/adapters/chartvolt-games.adapter.ts");

    for (const field of [
      "tagline",
      "rulesSummary",
      "howToPlay",
      "bannerUrl",
      "description",
      "thumbnailUrl",
      "category",
    ]) {
      // Reason: the ASSIGNMENT, not the field name. Naming it on the payload interface is
      // what the defect already did - the entry type could have declared every one of them
      // and the normaliser still never copied them across. Fourth instance of an identifier
      // appearing twice defeating a structural test.
      expect(adapter, `${field} is read but never assigned`).toMatch(
        new RegExp(`game\\.${field}\\s*=`),
      );
    }
  });

  it("keeps the two apps' copies of the whole path identical", () => {
    for (const file of [
      "lib/services/game-providers/contract.ts",
      "lib/services/game-providers/catalogue.service.ts",
      "lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
      "lib/services/game-providers/adapters/mock.adapter.ts",
    ]) {
      // `check:mirrors` compares MODELS, so it has no opinion about any of these. Both apps
      // sync catalogues, so a drifted copy means what a title stores depends on which
      // process happened to run the sync.
      expect(read(file), `${file} has drifted`).toBe(read(`apps/admin/${file}`));
    }
  });

  it("lets an operator edit the provider's rules text without a second door", () => {
    const fields = code("apps/admin/lib/admin/game-content-fields.ts");

    // Reason for slicing the Set rather than searching the file: both names appear TWICE
    // here - once in the allow-list and once in the validation loop below it - so a bare
    // `toContain` is satisfied by whichever copy survives. Probing this returned green with
    // the allow-list entry deleted, which is the fifth instance of one identifier defeating
    // a structural test, after `!expectedOrigin`, the fixed-character Edit guard,
    // `canTransitionRound` and `MIN_REASON_LENGTH`.
    const setStart = fields.indexOf("EDITABLE_CONTENT_FIELDS");
    expect(setStart, "EDITABLE_CONTENT_FIELDS not found").toBeGreaterThan(-1);
    const allowList = fields.slice(setStart, fields.indexOf("]);", setStart));
    expect(allowList.length, "the allow-list sliced to nothing").toBeGreaterThan(80);

    for (const field of ["rulesSummary", "howToPlay"]) {
      expect(allowList, `${field} is not in the allow-list`).toContain(`"${field}"`);
      expect(
        fields,
        `${field} has no length limit, so the form and the server can disagree`,
      ).toMatch(new RegExp(`${field}:\\s*\\d+`));
    }

    // Reason: the validation loop, not merely the allow-list. A field admitted by the
    // allow-list and absent from the loop is accepted, never trimmed and never
    // length-checked - it saves, and then fails at the schema for a reason no operator can
    // read. Asserting both is what makes the pair meaningful.
    const loop = fields.slice(fields.indexOf("for (const field of ["));
    expect(loop.length, "the validation loop sliced to nothing").toBeGreaterThan(100);
    expect(loop).toContain("rulesSummary");
    expect(loop).toContain("howToPlay");
  });

  it("offers both on the content screen, bound to the shared limits", () => {
    const dialog = code(
      "apps/admin/components/admin/games/GameContentDialog.tsx",
    );

    for (const field of ["rulesSummary", "howToPlay"]) {
      expect(dialog, `${field} is not on the draft`).toMatch(
        new RegExp(`${field}:\\s*title\\.${field}\\s*\\?\\?`),
      );
      expect(dialog, `${field} has no control`).toContain(`set("${field}"`);
      // Reason: the limit comes from `CONTENT_LIMITS`, never a number typed in the markup.
      // A counter saying 2000 while the server refuses at 1000 is a form that reports
      // success and then fails with a 400 the operator reads as a permissions problem.
      //
      // COUNTED, at two: the character counter reads it and so does the input's own
      // `maxLength`, and they are the two halves of that promise. A bare `toContain` came
      // back green with the `maxLength` replaced by a literal, because the counter still
      // named the constant - the same trap as the allow-list slice above.
      const uses = [...dialog.matchAll(new RegExp(`CONTENT_LIMITS\\.${field}\\b`, "g"))];
      expect(
        uses.length,
        `${field} should read the shared limit twice - the counter and the input`,
      ).toBe(2);
    }
  });
});
