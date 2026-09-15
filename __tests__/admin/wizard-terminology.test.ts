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
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TERMS, type TerminologyToken } from "../../lib/constants/terminology";

const ROOT = join(__dirname, "..", "..");
const ADMIN = join(ROOT, "apps", "admin");
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

/**
 * Source with comments stripped, WITHOUT changing the line count.
 *
 * Stripping is required for the same reason as every other structural suite here: these files
 * explain the mistakes they avoid, naming "Competition" and "toLowerCase" in prose, so a test
 * that reads comments flags a correct file for discussing the trap and passes a broken one
 * whose only mention of the token layer is a note.
 *
 * The line count is preserved because these assertions REPORT a location. A first cut of the
 * scan behind this suite collapsed block comments, which shifted every number after them, and
 * reading the line it named showed a comment that had already been removed - indistinguishable
 * from the scan being wrong about the file.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (block) =>
      "\n".repeat((block.match(/\n/g) || []).length),
    )
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

interface Line {
  file: string;
  number: number;
  text: string;
}

function lines(): Line[] {
  const out: Line[] = [];
  for (const file of SURFACE) {
    const relative = file.slice(ADMIN.length + 1).replace(/\\/g, "/");
    code(file)
      .split(/\r?\n/)
      .forEach((text, index) => {
        out.push({ file: relative, number: index + 1, text });
      });
  }
  return out;
}

function report(hits: Line[]): string {
  return hits.map((h) => `${h.file}:${h.number}: ${h.text.trim()}`).join("\n");
}

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
      if (usesTokens && !callsHook) {
        missing.push(file.slice(ADMIN.length + 1).replace(/\\/g, "/"));
      }
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

/**
 * The words an operator can rename, in the shapes a label would use them in.
 *
 * Built from `TERMS` rather than hand-listed, so a token added later is policed the day it is
 * added. The default VALUE is what is searched for, because that is what a literal caption
 * would say - the token NAME (`entryFee`) never appears in prose.
 */
// `Object.entries` rather than `Object.keys` plus an index, which is a
// `security/detect-object-injection` sink - and the pre-commit hook lints at
// `--max-warnings=0`, so a warning here is a block on any later edit to this file.
const RENAMEABLE: { token: TerminologyToken; word: string }[] = Object.entries(
  TERMS,
).map(([token, word]) => ({ token: token as TerminologyToken, word }));

/**
 * Words that mean a token but are not spelled like its default value.
 *
 * WITHOUT THIS THE GUARD IS BLIND TO EXACTLY THE WORD THIS CODEBASE PREFERS. `contest`
 * defaults to "Competition" because that is what every route and screen already says, so a
 * search for token VALUES never looks for "Contest" - and "contest" is the platform-neutral
 * noun the services, the files and every docblock use, which makes it the spelling somebody
 * reaches for when writing a new caption. It found a live one on the first run:
 * `ProviderContestEditor.tsx` answered a successful save with `toast.success("Contest
 * saved.")`, so an operator who had renamed the noun to "Tournament" saved a Tournament and
 * was told a Contest had been saved.
 *
 * The general form, and the reason this is a list rather than one entry: a guard built from a
 * token's default value polices one spelling of a concept the codebase has several names for.
 * Add the synonym, not a looser pattern.
 */
const SYNONYMS: { token: TerminologyToken; word: string }[] = [
  { token: "contest", word: "Contest" },
  { token: "contests", word: "Contests" },
];

const BANNED_NOUNS = [...RENAMEABLE, ...SYNONYMS];

describe("no renameable noun is a literal in displayed text", () => {
  /*
    THE LOAD-BEARING GUARD. Adding `<Label>Competition Name</Label>` beside a perfectly
    correct `terms.contest` elsewhere in the file satisfies every positive assertion above,
    and is precisely what a later edit does when somebody adds a field and copies the shape
    of the trading form rather than the shape of the file they are in.

    Scoped to Title Case only, and that is a deliberate limit rather than an oversight. The
    lowercase forms appear legitimately in three places - route ids (`activeTab=competitions`,
    a never-rename `ADMIN_SECTIONS` value), mid-sentence prose that A2 left alone because a
    Title Case token cannot sit behind an article, and identifiers. Banning them outright
    fires on correct code, and a guard that fires on correct code is the one the next reader
    deletes.
  */
  it("has no Title Case noun as a JSX literal or a quoted caption", () => {
    const hits: Line[] = [];
    for (const line of lines()) {
      for (const { word } of BANNED_NOUNS) {
        /*
          Word-bounded, so "Competitions" does not also report as "Competition", and
          `Prize` inside `PrizeDistributionEditor` or `prizeTotal` is not a caption.
        */
        // Reason: the pattern is built from `TERMS`, a hard-coded catalogue in this
        // repository, never from a request or a stored value - so the rule's concern does not
        // arise. Scoped to the one rule rather than the blanket disable, or the next genuine
        // injection sink added to this file goes unreported.
        // eslint-disable-next-line security/detect-non-literal-regexp
        const boundary = new RegExp(`(?<![A-Za-z])${word}(?![A-Za-z])`);
        if (!boundary.test(line.text)) continue;
        /*
          An identifier or a type, not a caption: `PrizeSlice`, `MIN_PRIZE_RANKS`,
          `prizeDistribution`. Checked by requiring the word to be adjacent to text rather
          than to code punctuation.

          `<` IS DELIBERATELY NOT IN THAT PUNCTUATION CLASS, and it was on the first run -
          which made the guard silently blind to the commonest caption shape there is.
          `<Label>Attempts</Label>` puts the word immediately before the `<` of its own
          closing tag, so the heuristic read the caption as a generic type parameter and
          skipped it: the file was reported clean while a bare Title Case noun sat in it. It
          was found only because the hits this guard DID report were in a file that also
          contained one it had not. Nothing renameable is plausibly a generic (`Record`,
          `Map` and `ReadonlyMap` are not operator vocabulary), and the other three
          alternatives already cover a word touching an identifier or a dot - so the class
          costs nothing and the omission cost the whole assertion.
        */
        // Reason: same as the boundary pattern above - `word` comes from the catalogue.
        // eslint-disable-next-line security/detect-non-literal-regexp
        const isIdentifier = new RegExp(
          `[A-Za-z0-9_$]${word}|${word}[A-Za-z0-9_$]|\\.${word}|${word}\\s*[:=(]`,
        ).test(line.text);
        if (isIdentifier) continue;
        hits.push(line);
      }
    }
    expect(report(hits)).toBe("");
  });

  it("has no trading vocabulary in a caption, tokenised or not", () => {
    /*
      Separate from the noun check because these are not renameable - there is no token for
      them and there must not be. They are the words A2 exists to remove from a screen an
      operator uses for a puzzle contest.

      "trading" and "trader" ARE permitted in the lowercase, because two captions name
      trading deliberately: the unscored policy compares its refund rule against trading's,
      and only a trading account can be liquidated. Title Case is what a label would use.
    */
    const hits: Line[] = [];
    const BANNED = /(?<![A-Za-z])(Trading|Trader|Traders|Participant|Participants|Portfolio|Equity)(?![A-Za-z])/;
    for (const line of lines()) {
      if (!BANNED.test(line.text)) continue;
      if (/[A-Za-z0-9_$"]\s*(Trading|Trader)/.test(line.text)) continue;
      hits.push(line);
    }
    expect(report(hits)).toBe("");
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
  const ADMIN_COMPONENTS = join(ADMIN, "components");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        out.push(full);
      }
    }
    return out;
  }

  const ALL = walk(ADMIN_COMPONENTS);

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
            hits.push(
              `${file.slice(ADMIN.length + 1).replace(/\\/g, "/")}:${index + 1}: ${text.trim()}`,
            );
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
            hits.push(
              `${file.slice(ADMIN.length + 1).replace(/\\/g, "/")}:${index + 1}: ${text.trim()}`,
            );
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
