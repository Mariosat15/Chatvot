/**
 * The operator-owned presentation content on a catalogue title, and the two routes that write it.
 *
 * WHAT THIS SLICE IS. `provider_game` gained `tagline`, `bannerUrl` and `highlights`, and an
 * operator can now edit the title, genre, description, logo and banner of any game. None of it
 * is part of the provider contract: a provider supplies capability facts, an operator supplies
 * the words and pictures players read. That distinction is the whole design, and the thing most
 * likely to be undone by somebody adding these fields to the catalogue sync "for completeness"
 * - which would overwrite an operator's wording on the next sync run, silently, with no error.
 *
 * The four properties asserted here are the four that fail invisibly.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  CONTENT_LIMITS,
  EDITABLE_CONTENT_FIELDS,
  NEVER_EDITABLE_CONTENT_FIELDS,
  validateGameContent,
} from "../../apps/admin/lib/admin/game-content-fields";

const PROVIDER_ROUTES = join(
  process.cwd(),
  "apps",
  "admin",
  "app",
  "api",
  "games",
  "providers",
);
const ARENA_DIR = join(process.cwd(), "components", "games", "arena");

/**
 * These files explain in prose why the guard is there and name `guardSection` while doing it.
 * A test that reads prose fails in both directions: it passes a file whose only mention of the
 * guard is the paragraph describing it, and it flags a correct file for discussing the trap.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFiles(dir: string, match: (entry: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findFiles(full, match));
    else if (match(entry)) found.push(full);
  }
  return found;
}

const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;

/**
 * The guard must be CALLED WITH A SECTION, not merely named. `toContain("guardSection")` stays
 * true when the call is deleted, because the import line still holds the identifier - an
 * import is not a use, which has defeated four assertions elsewhere in this suite.
 */
const GUARD_CALL = /guardSection\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g;

describe("the game content routes are behind a section grant", () => {
  /*
    READS THE DIRECTORY rather than naming the routes. Two new ones arrived in this slice
    (content and artwork), and the next one is the whole thing being defended against: a
    hard-coded list is green on the day it appears. Eight admin routes in this codebase have
    now been found authorising on admin-at-all or on nothing, and every one of them was found
    by counting handlers against guards rather than by reading the routes - because every
    neighbour having *something* is exactly what sends a reader past the file that has none.
  */
  const files = findFiles(PROVIDER_ROUTES, (e) => e === "route.ts");

  it("finds the routes at all, so an empty walk cannot pass", () => {
    // A test that examines nothing passes. A directory walk returning [] and every assertion
    // below holding look identical from the outside.
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of files) {
    const name = file.split(/[\\/]/).slice(-3).join("/");
    const code = stripComments(readFileSync(file, "utf8"));

    it(`${name}: guards every exported handler`, () => {
      const handlers = code.match(HANDLER) ?? [];
      const guards = code.match(GUARD_CALL) ?? [];

      expect(handlers.length).toBeGreaterThan(0);
      // Per handler, not per file. One guard in a file with two handlers is the shape that
      // leaves a mutation open while reviewing as protected.
      expect(guards.length).toBe(handlers.length);
    });
  }
});

describe("what an operator may edit, and what they may never", () => {
  it("refuses an unknown field BY NAME instead of dropping it", () => {
    /*
      Dropping is the tidier implementation and it is the one this codebase keeps undoing: the
      request succeeds, the screen says saved, the value is not there, and the operator
      concludes they misclicked. Same reasoning as `competition-update-fields.ts`.
    */
    const result = validateGameContent({ displayName: "Circuit Sprint", sneaky: 1 });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("sneaky");
  });

  it("refuses a provider-owned field with ITS OWN message, not the unknown-field one", () => {
    /*
      THE LOAD-BEARING ASSERTION OF THIS FILE. `gameKey` is absent from the allow-list as well
      as being on the never-editable list, so removing it from the never-editable list still
      leaves it refused - by the unknown-field branch, whose message also contains the word
      "gameKey". A test asserting only "it was refused" is green on that mutation, and the
      field silently stops being immutable the day somebody adds it to the allow-list.

      So the specific wording is pinned. Exactly the trap that made the equivalent probe on
      `competition-update-fields.ts` come back green.
    */
    const result = validateGameContent({ gameKey: "provider:x:y" });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("cannot be edited here");
  });

  it("never lets a capability flag be edited as though it were content", () => {
    /*
      A provider declares what its game can do; an operator declares how it reads. Letting
      `supportsContentSeed` or `scoreDirection` be typed into a content form would let an
      operator turn off a fairness gate (R53) or invert who wins, from a screen labelled
      "title and description".

      `playMode` joined this list when chapter 22 was built, and it was NOT here to begin
      with even though a comment in `catalogue.service.ts` asserted it was - the sixth
      instance of an unverified aside on this programme. It was refused the whole time, but
      by the unknown-field branch, which is precisely the fragile state the test above
      exists to describe: the day somebody adds it to the allow-list, because it reads like
      a title property an operator might set, a puzzle becomes a race from a content form.
      That changes when entry closes and how many attempts a contest grants, and the next
      catalogue sync reverts it with no error and nothing in a log.
    */
    for (const flag of [
      "supportsContentSeed",
      "scoreDirection",
      "configSchema",
      "playMode",
    ]) {
      expect(NEVER_EDITABLE_CONTENT_FIELDS.has(flag)).toBe(true);
      expect(EDITABLE_CONTENT_FIELDS.has(flag)).toBe(false);
    }
  });

  it("uses a Set and a Map, so a request-supplied key cannot walk the prototype chain", () => {
    /*
      `ALLOWED[key]` admits "constructor" and "__proto__": both return something truthy, both
      survive a `!allowed` test, and both fail later somewhere unrelated. Fourth instance of
      that trap after the round-inspector action map, the contest-edit field list and the
      unscored-policy copy, so it is asserted behaviourally rather than by reading the type.

      ASSERT WHICH REFUSAL FIRED, NOT MERELY THAT ONE DID. A probe swapping the Set for an
      object lookup came back GREEN against `expect(result.ok).toBe(false)`, because a
      prototype key admitted by the allow-list still lands in no field, so the function
      refuses at the "Nothing to update." guard at the bottom instead. The key was accepted
      and the test could not tell. Same trap as `competition-update-fields.ts`, where
      removing `gameKey` from the never-editable list still produced a refusal whose message
      happened to contain the word "gameKey".
    */
    for (const key of ["__proto__", "constructor", "toString"]) {
      const result = validateGameContent({ [key]: "x", displayName: "Circuit Sprint" });
      expect(result.ok).toBe(false);
      // The allow-list branch, by its own wording - not "Nothing to update.", which is what a
      // successfully-admitted prototype key produces on its own.
      expect(result.ok ? "" : result.error).toContain("is not an editable field");
    }
  });

  it("treats an empty string as a decision to clear, and keeps the title mandatory", () => {
    /*
      An empty box is a real instruction HERE, and is not on the credentials dialog - the
      difference being whether the operator can see what is already stored. A blank secret
      means "keep"; a blank tagline means "remove".

      The title is the exception: something has to name the game on every screen, so an empty
      one is refused rather than clearing.
    */
    const cleared = validateGameContent({ tagline: "" });
    expect(cleared.ok).toBe(true);
    expect(cleared.ok ? cleared.content.tagline : null).toBe("");

    const blankTitle = validateGameContent({ displayName: "   " });
    expect(blankTitle.ok).toBe(false);
  });

  it("refuses a plain http image, because the browser blocks it and shows nothing", () => {
    /*
      An http image on an https page is refused by the browser, so the operator sees a broken
      slot with no error anywhere - the failure looks like the upload not having worked. A
      relative path from our own upload route is fine, and is the normal case.
    */
    expect(validateGameContent({ bannerUrl: "http://example.com/a.png" }).ok).toBe(false);
    expect(validateGameContent({ bannerUrl: "https://example.com/a.png" }).ok).toBe(true);
    expect(validateGameContent({ bannerUrl: "/api/assets/images/a.png" }).ok).toBe(true);
  });

  it("bounds every stored string, so one paste cannot break every screen rendering it", () => {
    const tooLong = "x".repeat(CONTENT_LIMITS.tagline + 1);
    expect(validateGameContent({ tagline: tooLong }).ok).toBe(false);
  });
});

describe("the arena renders any game without knowing which one it is", () => {
  /*
    The owner's requirement is that a new title enters every screen with no additional coding,
    and there is exactly one way to lose it: something that enumerates games. For a set of
    screens driven by catalogue fields that means a branch on a game code, a provider key or a
    game key - so this asserts none appears anywhere in the folder.

    Without it, the first title needing a special case makes the claim quietly false while
    every other test in this file still passes.
  */
  const files = findFiles(ARENA_DIR, (e) => e.endsWith(".ts") || e.endsWith(".tsx"));

  it("finds the arena files at all", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of files) {
    const name = file.split(/[\\/]/).slice(-1)[0];
    const code = stripComments(readFileSync(file, "utf8"));

    it(`${name}: branches on no game identifier`, () => {
      expect(code).not.toMatch(/circuit-sprint|circuit_sprint/i);
      expect(code).not.toMatch(/\bgameCode\b/);
      expect(code).not.toMatch(/\bproviderKey\b/);
    });
  }
});
