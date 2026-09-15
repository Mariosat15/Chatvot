/**
 * X6.5 A2 - the contest create wizard reads its nouns from the token layer.
 *
 * WHAT A2 TURNED OUT TO BE, because the phase plan and the code disagreed. Chapter 14 budgets
 * "~40 strings" here on the assumption the wizard is full of trading vocabulary. It is not:
 * the provider wizard was built game-agnostic, a test in `game-contest-wizard.test.ts`
 * already forbids naming a game anywhere on it, and a scan for `Competition` / `Participant`
 * / `trader` across all fifteen files on the surface returned four lines - three of them the
 * `activeTab=competitions` route and one a deliberate comparison against trading.
 *
 * So the defect was never trading words. It was that the generic nouns - Competition, Player,
 * Entry Fee, Prize, Rank, Attempt - were LITERALS, so an operator who renamed "Competition"
 * to "Event" on Settings -> Wording got their word on the screens A1 had wired and the old one
 * here. A half-renamed admin panel is worse than an unrenamed one: it reads as the setting
 * being broken, and the operator cannot tell which screens they still have to check.
 *
 * WHAT IS PINNED BELOW, and the second group is the load-bearing one:
 *
 *   1. The surface calls `useTerms()` - trivially satisfiable, which is why it is not alone.
 *   2. No renameable noun survives as a literal in displayed text. This is the assertion that
 *      can actually fail, because adding a hard-coded "Competition" beside a correct
 *      `terms.contest` satisfies every positive check in the file.
 *   3. Nothing case-folds or pluralises a token. This is the rule A2 established and the one
 *      most likely to be "helpfully" added back: `terms.player.toLowerCase()` reads like
 *      careful sentence-casing and destroys an operator's own capitalisation - "eSports Cup"
 *      becomes "esports cup" - while `` `${terms.prize}s` `` is us editing their vocabulary,
 *      which is exactly what a separate `prizes` token exists to prevent.
 *   4. The route ids stay literal. `activeTab=competitions` is an `ADMIN_SECTIONS` value and a
 *      Mongoose enum, so it is on the never-rename list; tokenising it would route an operator
 *      who renamed the noun to a screen that does not exist.
 *
 * THE SCANNER MOVED OUT ON 15 SEP 2026, when A3 needed the identical rules on the contest list
 * and detail screens. It lives in `__tests__/helpers/terminology-scan.ts`; a second copy would
 * have been the "one rule, two copies" shape, and the copy that loses a rule keeps passing.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { TERMS } from "../../lib/constants/terminology";
import {
  ADMIN,
  code,
  literalNounHits,
  relative,
  report,
  tradingWordHits,
  walk,
} from "../helpers/terminology-scan";

const GAMES = join(ADMIN, "components/admin/games");
const WIZARD_STEPS = join(GAMES, "wizard");

/**
 * Every file an operator sees while creating or editing a game contest.
 *
 * The editor is in here beside the wizard deliberately. They render the same fields, so a
 * noun tokenised on one and left literal on the other is the "one rule, two copies" shape -
 * and the copy that drifts is the one nobody opens until a contest needs fixing.
 */
const SURFACE = [
  join(GAMES, "ProviderContestWizard.tsx"),
  join(GAMES, "ProviderContestEditor.tsx"),
  join(GAMES, "PrizeDistributionEditor.tsx"),
  join(GAMES, "RoundStartPolicyField.tsx"),
  join(GAMES, "UnscoredPolicyField.tsx"),
  join(GAMES, "ContestPlayModeField.tsx"),
  join(GAMES, "RoundClockNote.tsx"),
  join(GAMES, "ConfigSchemaFields.tsx"),
  ...readdirSync(WIZARD_STEPS)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join(WIZARD_STEPS, name)),
];

// =======================================================================================
// The surface exists and the reader reaches it
// =======================================================================================

describe("the scan reaches the wizard surface", () => {
  /*
    Asserted first and on purpose. Every claim below is "no match was found", and a reader
    that silently returns nothing satisfies all of them - the fourth cause of a green probe,
    a mutation with no observable. A renamed file, a moved folder or a `.tsx` filter that
    stops matching would make this whole suite vacuous while reporting fifteen passes.
  */
  it("reads every file, and each one has content", () => {
    expect(SURFACE.length).toBeGreaterThanOrEqual(12);
    for (const file of SURFACE) {
      expect(code(file).length).toBeGreaterThan(200);
    }
  });

  it("finds the step bodies, not just the orchestrator", () => {
    const steps = SURFACE.filter((f) => f.includes("wizard"));
    expect(steps.length).toBeGreaterThanOrEqual(5);
  });
});

// =======================================================================================
// 1. The surface is wired to the token layer
// =======================================================================================

describe("the wizard surface reads its nouns from useTerms", () => {
  /*
    The positive half, and it is the weak one: a file can call the hook, ignore the result and
    hard-code every caption. It is here because the NEGATIVE assertions below cannot tell
    "correctly tokenised" from "mentions no noun at all", and a step that renders no noun is a
    legitimate state. Together they say: if you display one of these words, it came from the
    pack.
  */
  it("calls the hook in every file that displays a renameable noun", () => {
    const missing: string[] = [];
    for (const file of SURFACE) {
      const source = code(file);
      const usesTokens = /\bterms\.[a-zA-Z]/.test(source);
      const callsHook = /\buseTerms\(\)/.test(source);
      if (usesTokens && !callsHook) missing.push(relative(file));
    }
    expect(missing).toEqual([]);
  });

  it("imports the hook from the context, never re-declares a pack of its own", () => {
    for (const file of SURFACE) {
      const source = code(file);
      if (!/\buseTerms\(\)/.test(source)) continue;
      expect(source).toMatch(
        /import\s*\{[^}]*\buseTerms\b[^}]*\}\s*from\s*"@\/contexts\/TerminologyContext"/,
      );
      /*
        A second definition of the defaults is the drift that reads to an operator as the
        setting not saving: the screen keeps showing "Competition" because it is holding its
        own copy of the word rather than the resolved one.
      */
      expect(source).not.toMatch(/\bTERMS\s*[:=]/);
    }
  });

  it("uses tokens that exist, so a typo cannot render undefined", () => {
    const known = new Set(Object.keys(TERMS));
    const unknown = new Set<string>();
    for (const file of SURFACE) {
      for (const match of code(file).matchAll(/\bterms\.([a-zA-Z]+)/g)) {
        const token = match[1];
        if (!known.has(token)) unknown.add(token);
      }
    }
    /*
      `tsc` types `TerminologyPack`, so this is belt to that braces - but a template literal
      is where a wrong name survives a typecheck in this codebase (an explicitly-typed
      `.lean<{...}>()` is the same trap), and `undefined` renders as nothing rather than as an
      error. A caption that silently disappears is the failure this catches.
    */
    expect([...unknown]).toEqual([]);
  });
});

// =======================================================================================
// 2. No renameable noun survives as a literal - the assertion that can fail
// =======================================================================================

describe("no renameable noun is a literal in displayed text", () => {
  /*
    THE LOAD-BEARING GUARD. Adding `<Label>Competition Name</Label>` beside a perfectly
    correct `terms.contest` elsewhere in the file satisfies every positive assertion above,
    and is precisely what a later edit does when somebody adds a field and copies the shape
    of the trading form rather than the shape of the file they are in.
  */
  it("has no Title Case noun as a JSX literal or a quoted caption", () => {
    expect(report(literalNounHits(SURFACE))).toBe("");
  });

  it("has no trading vocabulary in a caption, tokenised or not", () => {
    expect(report(tradingWordHits(SURFACE))).toBe("");
  });
});

// =======================================================================================
// 3. A token is inserted verbatim - no case folding, no derived plural
// =======================================================================================

describe("nothing transforms a token", () => {
  /*
    THE RULE A2 ESTABLISHED, and the one with nothing else holding it up. Both mutations read
    as care rather than as damage, which is why they need a guard rather than a comment:

      `terms.contest.toLowerCase()` - looks like correct mid-sentence casing. An operator who
      typed "eSports Cup" gets "esports cup", and the platform has edited their brand.

      `` `${terms.prize}s` `` - looks like a plural. It is us conjugating a word we do not
      own; "Grand Prix" becomes "Grand Prixs". Singular and plural are separate tokens for
      exactly this reason, which is why `prizes` was added when this pass found a heading
      that needed one.

    Asserted across the WHOLE admin component tree, not just the wizard, because the rule is
    platform-wide and the next consumer to break it will be a screen A3 or A4 touches.
  */
  const ALL = walk(join(ADMIN, "components"));

  it("reads the component tree, so the claims below are not vacuous", () => {
    expect(ALL.length).toBeGreaterThan(100);
    expect(ALL.some((f) => /terms\./.test(code(f)))).toBe(true);
  });

  it("never case-folds a token", () => {
    const hits: string[] = [];
    for (const file of ALL) {
      code(file)
        .split(/\r?\n/)
        .forEach((text, index) => {
          if (
            /\bterms\.[a-zA-Z]+\s*\.\s*(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\s*\(/.test(
              text,
            )
          ) {
            hits.push(`${relative(file)}:${index + 1}: ${text.trim()}`);
          }
        });
    }
    expect(hits.join("\n")).toBe("");
  });

  it("never derives a plural from a token", () => {
    const hits: string[] = [];
    for (const file of ALL) {
      code(file)
        .split(/\r?\n/)
        .forEach((text, index) => {
          /*
            Two shapes. A template appending a letter directly to the closing brace
            (`${terms.prize}s`), and a `replace` or `concat` on the token. A space after the
            brace is fine - that is the next word of a sentence, not a suffix.
          */
          const suffixed = /\$\{\s*terms\.[a-zA-Z]+\s*\}[a-z]/.test(text);
          const conjugated =
            /\bterms\.[a-zA-Z]+\s*\.\s*(replace|concat|padEnd)\s*\(/.test(text);
          const added = /\bterms\.[a-zA-Z]+\s*\+\s*"[a-z]/.test(text);
          if (suffixed || conjugated || added) {
            hits.push(`${relative(file)}:${index + 1}: ${text.trim()}`);
          }
        });
    }
    expect(hits.join("\n")).toBe("");
  });
});

// =======================================================================================
// 4. The never-rename list holds
// =======================================================================================

describe("route ids and section ids stay literal", () => {
  /*
    The other direction, and it matters as much. `competitions` in `?activeTab=competitions`
    is an `ADMIN_SECTIONS` value - a Mongoose enum on `allowedSections`, so add-only - and the
    URL an operator's bookmark holds. Tokenising it sends somebody who renamed the noun to a
    screen that does not exist, and the failure is a blank page rather than a wrong word.

    Written as "the literal is still there" rather than "the token is absent", because the
    absent form is green on a file that stopped navigating at all.
  */
  it("navigates by the section id, not by a token", () => {
    const navigators = SURFACE.filter((f) => /activeTab=/.test(code(f)));
    expect(navigators.length).toBeGreaterThanOrEqual(2);
    for (const file of navigators) {
      const source = code(file);
      expect(source).toMatch(/activeTab=competitions/);
      expect(source).not.toMatch(/activeTab=\$\{/);
    }
  });
});
