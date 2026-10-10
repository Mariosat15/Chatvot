import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TASK DOCUMENT 13 - A ROUND RESULT CARRIES NO FACT ABOUT THE TITLE IT CAME FROM.
 *
 * The property under guard is narrow and worth stating exactly, because it is easy to
 * paraphrase into something either untrue or unenforceable: an ADAPTER translates a payload,
 * and does not get to say what a game IS. Everything a title declares - how it ranks, what
 * counts as a result, how long it runs - lives on `provider_game` and is read through one
 * resolver.
 *
 * WHAT THIS REPLACED. `chartvolt-games/normalise.ts` held `TITLE_DIRECTIONS`, a two-entry map
 * of game code to score direction, and gate 11b of `result-ingestion.service.ts` passed its
 * answer to `syncParticipantScore`, which uses the direction to pick the best of several
 * attempts. A third title shipped by the games service - with nobody editing that platform
 * file - would have had every player scored on their WORST attempt. Uniformly, so no board
 * looked reversed; and settlement reads the catalogue separately, so the contest then paid
 * the correct order of the wrong runs. The whole signal was one `console.warn`.
 *
 * WHERE THE BEHAVIOURAL HALF LIVES, because this file is structural and cannot prove a value
 * was read: `__tests__/services/participant-score-arrival.test.ts`, "takes the LOWEST of two
 * cut-short attempts when the CATALOGUE says lower is better". That test seeds `mock-puzzle`,
 * a code the deleted map never contained, and passes NO direction on either payload - so a
 * fallback to the platform's upward default scores it 140 instead of 92. It is the third-title
 * scenario reproduced exactly, and it used to override the direction on the payload, which is
 * precisely why it passed against the defect.
 *
 * COMMENTS ARE STRIPPED BEFORE MATCHING. Every file involved here now explains the deleted map
 * in prose and names both of its game codes, so a test that reads comments would fail on
 * correct code - and would pass a file whose only mention of the right thing is a comment.
 */

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

/** Block and line comments removed, so prose about the anti-pattern cannot fail the guard. */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * The body of a named interface, located by index rather than scanned towards.
 *
 * Reason: a lazy `interface X \{[\s\S]*?\}` matches leftmost-first and a greedy one runs to the
 * end of the file, so both routinely answer about a different construct. Slicing from the
 * declaration to its first closing brace at column zero is exact for this file's formatting,
 * and every caller asserts the slice found something - a test examining an empty string
 * passes everything asked of it.
 */
function interfaceBody(source: string, name: string): string {
  const start = source.indexOf(`interface ${name} {`);
  expect(start, `interface ${name} not found`).toBeGreaterThan(-1);
  const end = source.indexOf("\n}", start);
  expect(end, `interface ${name} has no closing brace`).toBeGreaterThan(start);
  return source.slice(start, end);
}

const CONTRACT = "lib/services/game-providers/contract.ts";
const NORMALISE = "lib/services/game-providers/adapters/chartvolt-games/normalise.ts";
const MOCK = "lib/services/game-providers/adapters/mock.adapter.ts";
const INGESTION = "lib/services/games/result-ingestion.service.ts";

/** The two titles the deleted map knew about. Named here, and nowhere in shipped code. */
const RETIRED_MAP_ENTRIES = ["circuit-sprint", "circuit-perfect"];

describe("a round result carries no fact about its title", () => {
  it("does not declare a score direction", () => {
    const body = interfaceBody(code(CONTRACT), "NormalisedRoundResult");
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("rawScore");
    expect(body).not.toContain("scoreDirection");
  });

  it("still lets the CATALOGUE entry declare one, which is the half that must not be swept up", () => {
    /*
     * The positive assertion, and it is not decoration. A provider declaring how their own
     * game ranks is exactly right - that is the fact the sync writes onto `provider_game`,
     * and it is what every resolver then reads. Delete it "for consistency" and the platform
     * has no source for the direction at all, at which point every title ranks upward and a
     * time trial pays the slowest player first.
     */
    const body = interfaceBody(code(CONTRACT), "ProviderCatalogueGame");
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("scoreDirection");
  });

  it("says the same thing in both apps", () => {
    expect(read(`apps/admin/${CONTRACT}`)).toBe(read(CONTRACT));
  });
});

describe("no adapter answers a question about a title", () => {
  it("the result parser names no game code", () => {
    /*
     * The strongest form available structurally, and deliberately stronger than "has no
     * direction map": any per-title table here is the same defect wearing a different field.
     * A parser that knows which title it is looking at is one edit away from knowing how that
     * title scores.
     */
    const parser = code(NORMALISE);
    for (const gameCode of RETIRED_MAP_ENTRIES) {
      expect(parser).not.toContain(gameCode);
    }
    expect(parser).not.toContain("scoreDirection");
    expect(parser).not.toContain("directionForGameCode");
  });

  it("the mock's round result declares no direction either", () => {
    /*
     * Located by its function, not by the file: `mock.adapter.ts` legitimately names game
     * codes and directions in its fabricated CATALOGUE, because a mock provider is the source
     * of its own catalogue. Only the round-result builder is under this rule.
     */
    const source = code(MOCK);
    // Reason for `private`: a bare `buildResult(` matches the CALL SITES first, and the slice
    // then runs from a call to the enclosing method's brace - 24 characters containing nothing.
    // The length assertion below is what caught that; without it this test passed vacuously.
    const start = source.indexOf("private buildResult(");
    expect(start, "buildResult definition not found").toBeGreaterThan(-1);
    const end = source.indexOf("\n  }", start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body.length).toBeGreaterThan(150);
    expect(body).toContain("rawScore");
    expect(body).not.toContain("scoreDirection");
  });

  it("keeps both adapters identical across the apps", () => {
    expect(read(`apps/admin/${NORMALISE}`)).toBe(read(NORMALISE));
    expect(read(`apps/admin/${MOCK}`)).toBe(read(MOCK));
  });
});

describe("ingestion resolves the direction from the catalogue", () => {
  it("asks the shared resolver, keyed on the round's own game", () => {
    const ingestion = code(INGESTION);
    expect(ingestion).toContain("resolveScoreDirection(round.gameKey)");
    expect(occurrences(ingestion, "resolveScoreDirection")).toBe(2); // import + the one call
  });

  it("never takes it from the payload", () => {
    /*
     * The load-bearing half. Importing the resolver is trivially satisfied by a service that
     * calls it and then passes the adapter's value anyway - which, since the field would have
     * to be reintroduced on the contract to compile, is exactly what a revert looks like.
     */
    expect(code(INGESTION)).not.toContain("normalised.scoreDirection");
  });

  it("resolves it inside the sync call, which runs after the round is saved", () => {
    /*
     * Position, not presence. `syncParticipantScore` recomputes from PERSISTED rounds, so a
     * resolve hoisted above `round.save()` is harmless while a sync hoisted with it silently
     * omits the very result being ingested. Asserting the order here is what stops a later
     * "read it once at the top" tidy-up from dragging the sync up with it.
     */
    const ingestion = code(INGESTION);
    const save = ingestion.lastIndexOf("await round.save();");
    const sync = ingestion.indexOf("syncParticipantScore({");
    const resolve = ingestion.indexOf("resolveScoreDirection(round.gameKey)");
    expect(save).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(save);
    expect(resolve).toBeGreaterThan(sync);
  });
});
