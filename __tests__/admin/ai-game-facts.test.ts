/**
 * What the AI is told about a game, and who decides it (task document 20).
 *
 * TASK 20 ASKS FOR TWO THINGS AND ONLY ONE OF THEM WAS MISSING. "Data-driven, no
 * `if (gameName === ...)`" has been true and pinned since `12` s2.8 - the prompts are
 * composed from catalogue fields and a test forbids a game code appearing on the wizard at
 * all. The gap was the list of facts: it named the game, its genre, its blurb and how it
 * scores, and said nothing about how it is PLAYED, because until task 19 the platform threw
 * the provider's `rulesSummary` and `howToPlay` away on every sync. With the storage fixed,
 * the assistant was still writing from the smaller picture.
 *
 * A second defect came with the fix and is the one worth naming, because it fails silently:
 * both routes spelled out their own `.select()` and their own `.lean<{...}>` type, so a field
 * added to the shared source type and to one projection leaves the other assistant describing
 * the same game from fewer facts, with nothing to see - no error, no log line, just blander
 * copy on one screen.
 *
 * WHAT IS PINNED BELOW, in order: that one function produces the facts and no consumer
 * composes its own; that the provider's own account reaches the model AND is barred from
 * being restated; that an absent field states nothing; that the projection covers every field
 * the type declares; and that nothing here enumerates a game.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeGameFacts,
  providerVocabulary,
  VOCABULARY_SELECT,
  type CatalogueVocabularySource,
} from "../../apps/admin/lib/admin/ai-contest-vocabulary";
import { gameContentVocabulary } from "../../apps/admin/lib/admin/ai-game-content-vocabulary";

const ADMIN = join(__dirname, "..", "..", "apps", "admin");

const VOCABULARY = join(ADMIN, "lib/admin/ai-contest-vocabulary.ts");
const GAME_VOCABULARY = join(ADMIN, "lib/admin/ai-game-content-vocabulary.ts");
const CONTEST_ROUTE = join(ADMIN, "app/api/ai/generate-competition/route.ts");
const CONTENT_ROUTE = join(ADMIN, "app/api/ai/generate-game-content/route.ts");

/**
 * Source with comments stripped.
 *
 * Every file here EXPLAINS what it must not do, naming the very strings asserted against -
 * "WHAT THE GAME IS", "do not reproduce it". A test that reads prose fails in both
 * directions: it flags a correct file for discussing the rule and passes a broken one whose
 * only mention of the right thing is in a comment.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const TETRIS: CatalogueVocabularySource = {
  displayName: "Block Cascade",
  category: "puzzle",
  description: "Falling blocks, cleared rows, rising speed.",
  scoreDirection: "higher_is_better",
  scoreType: "integer",
  typicalDurationSeconds: 180,
  rulesSummary:
    "Rotate and place falling pieces. A filled row clears and scores. The round ends when the stack reaches the top.",
  howToPlay: "Arrow keys to move and rotate. Space drops the piece instantly.",
  scoreUnit: "lines",
  supportsOneVsOne: true,
};

const BARE: CatalogueVocabularySource = {
  displayName: "Tile Rush",
  scoreDirection: "lower_is_better",
  scoreType: "duration_ms",
};

// =======================================================================================
// One definition, two consumers
// =======================================================================================

describe("describeGameFacts - the facts block is composed once", () => {
  it("is what both assistants send", () => {
    /*
      BEHAVIOURAL, and deliberately not "both files import it". An import is trivially
      satisfied by a module that imports the helper and hand-rolls its own block beside it -
      which is exactly the state this replaced. The only assertion that cannot be satisfied
      that way is that the same characters appear in both prompts.
    */
    const facts = describeGameFacts(TETRIS);

    expect(facts.length).toBeGreaterThan(80);
    expect(providerVocabulary(TETRIS).systemPrompt).toContain(facts);
    expect(gameContentVocabulary(TETRIS).systemPrompt).toContain(facts);
  });

  it("is defined in one place and composed in no consumer", () => {
    /*
      The negative half, and the load-bearing one. `WHAT THE GAME IS:` is the block's opening
      line, so a second module producing it is a second answer to "what is this game" - the
      drift being that one screen learns a catalogue field and the other does not.
    */
    expect(code(VOCABULARY)).toContain("WHAT THE GAME IS:");

    for (const file of [GAME_VOCABULARY, CONTEST_ROUTE, CONTENT_ROUTE]) {
      expect(code(file), `${file} composes its own facts block`).not.toContain(
        "WHAT THE GAME IS",
      );
    }
  });

  it("reads the catalogue row and never a game's identity", () => {
    // The one failure mode of the no-developer-needed claim is something that enumerates
    // games. A `switch` on a game code here would make every title after the switch was
    // written describable only by whoever edits this file.
    const source = code(VOCABULARY);
    const facts = source.slice(source.indexOf("export function describeGameFacts"));

    expect(facts.length).toBeGreaterThan(400);
    for (const identity of ["gameKey", "providerKey", "gameCode"]) {
      expect(facts, `describeGameFacts branches on ${identity}`).not.toContain(
        identity,
      );
    }
  });
});

// =======================================================================================
// The provider's own account: given, and still barred from being restated
// =======================================================================================

describe("describeGameFacts - the rules reach the model", () => {
  it("sends the provider's rules and how-to-play verbatim", () => {
    /*
      This is task 20's Tetris example. Without them the model knows only "Block Cascade
      (Puzzle)" and a blurb, so its copy reaches for whatever a name suggests. Handing it the
      real rules is the STRONGEST form of "do not invent them".
    */
    const facts = describeGameFacts(TETRIS);

    expect(facts).toContain("A filled row clears and scores");
    expect(facts).toContain("Space drops the piece instantly");
  });

  it("forbids reproducing them in the same breath", () => {
    /*
      NOT IN TENSION WITH THE ABOVE, and asserted together in one test so nobody deletes half
      of it. `rulesSummary` is the authoritative text support quotes back in a prize dispute
      (`01` s3.1). A paraphrase in a marketing description is a second, disagreeing account of
      the same rules, and the player read whichever one they happened to see.
    */
    const facts = describeGameFacts(TETRIS);
    const instruction = facts.slice(facts.indexOf("THE PROVIDER'S OWN ACCOUNT"));

    expect(instruction.length).toBeGreaterThan(120);
    expect(instruction).toMatch(/Do not reproduce it, paraphrase it/);
  });

  it("carries the bar into both prompts, not just into the block", () => {
    // The block is embedded in two different prompts. A prompt that dropped the surrounding
    // rules while keeping the rules TEXT is the worst of both: the model has the authoritative
    // wording and no instruction against repeating it.
    for (const prompt of [
      providerVocabulary(TETRIS).systemPrompt,
      gameContentVocabulary(TETRIS).systemPrompt,
    ]) {
      expect(prompt).toContain("Rotate and place falling pieces");
      expect(prompt).toMatch(/Do not reproduce it, paraphrase it/);
    }
  });
});

// =======================================================================================
// An absent field states nothing
// =======================================================================================

describe("describeGameFacts - what a bare catalogue row produces", () => {
  it("states no rules section when the provider supplied none", () => {
    /*
      The recurring rule, and the reason every line is conditional. A "rules to follow"
      heading over nothing invites the model to fill it, which is precisely how a puzzle gets
      copy about laps - the failure this whole slice exists to prevent.
    */
    const facts = describeGameFacts(BARE);

    expect(facts).not.toContain("THE PROVIDER'S OWN ACCOUNT");
    expect(facts).not.toContain('"""');
  });

  it("invents no unit, no duration and no capability", () => {
    const facts = describeGameFacts(BARE);

    expect(facts).not.toContain("A score is measured in");
    expect(facts).not.toContain("A round takes about");
    expect(facts).not.toContain("one player against one other");
    expect(facts).not.toContain("undefined");
  });

  it("still says what the game is and how it is won", () => {
    // A row with only the required fields is the normal case for a title just synced, so the
    // fallback has to describe a game rather than trailing off.
    const facts = describeGameFacts(BARE);

    expect(facts).toContain("A skill game called Tile Rush");
    expect(facts).toContain("the fastest time wins");
  });

  it("says a score is measured in the provider's own word", () => {
    // Read as a word, never as a number: `scoreUnit` is display-only by declaration, so the
    // model is told what a score counts and nothing invites arithmetic with one.
    expect(describeGameFacts(TETRIS)).toContain("A score is measured in lines");
  });
});

// =======================================================================================
// The projection that fills the facts
// =======================================================================================

describe("VOCABULARY_SELECT - every declared fact is actually fetched", () => {
  it("covers every field on CatalogueVocabularySource", () => {
    /*
      THE TRIPWIRE FOR THE SILENT HALF. A field added to the type and to the block but not to
      the projection arrives `undefined` at runtime, so its line is simply omitted - no error,
      no log line, and the typecheck is clean because the compiler checks the hand-written
      generic rather than the schema (the R32/R33 shape).

      Read out of the source rather than listed here: a list would be a third copy of the
      same field names, and it would be the one nobody updates.
    */
    const source = readFileSync(VOCABULARY, "utf8");
    const body = source.slice(
      source.indexOf("export interface CatalogueVocabularySource"),
    );
    const declared = [
      ...body.slice(0, body.indexOf("\n}")).matchAll(/^\s{2}(\w+)\??:/gm),
    ].map((m) => m[1]);

    expect(declared.length).toBeGreaterThanOrEqual(10);
    for (const field of declared) {
      expect(
        VOCABULARY_SELECT.split(" "),
        `${field} is described to the model but never fetched`,
      ).toContain(field);
    }
  });

  it("is what both routes ask the database for", () => {
    /*
      Asserted per route and by absence of the alternative. Either route keeping its own
      projection is the drift itself, and it reviews as harmless because both lists are
      correct on the day they are written.
    */
    for (const file of [CONTEST_ROUTE, CONTENT_ROUTE]) {
      const route = code(file);

      expect(route, `${file} does not use the shared projection`).toMatch(
        /\.select\(VOCABULARY_SELECT\)/,
      );
      expect(route, `${file} hand-writes a projection`).not.toMatch(
        /\.select\("/,
      );
      expect(route, `${file} hand-writes a lean type`).not.toMatch(
        /\.lean<\{/,
      );
      expect(route).toContain(".lean<CatalogueVocabularySource>()");
    }
  });
});
