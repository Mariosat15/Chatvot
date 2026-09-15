/**
 * The shared reader behind every X6.5 terminology guard.
 *
 * EXTRACTED RATHER THAN COPIED, and the reason is the one this programme keeps meeting. A2
 * built this scanner inside `wizard-terminology.test.ts`; A3 needs the identical rules on a
 * different set of files. A second copy is the "one rule, two copies" shape behind
 * `referenceId`, `failedReason`, `challengeId` and the Game Master `||` - and here the drift
 * is the worst kind available, because the copy that loses a rule keeps passing. A guard that
 * has quietly stopped checking something is indistinguishable from a surface that is clean.
 *
 * Two of the rules below were each learned by getting them wrong, and both are recorded at
 * their site rather than here: comments must be stripped without changing the line count, and
 * `<` must count as caption punctuation.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TERMS, type TerminologyToken } from "../../lib/constants/terminology";

export const ROOT = join(__dirname, "..", "..");
export const ADMIN = join(ROOT, "apps", "admin");

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
export function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (block) =>
      "\n".repeat((block.match(/\n/g) || []).length),
    )
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

export interface Line {
  file: string;
  number: number;
  text: string;
}

export function relative(file: string): string {
  return file.slice(ADMIN.length + 1).replace(/\\/g, "/");
}

export function lines(surface: string[]): Line[] {
  const out: Line[] = [];
  for (const file of surface) {
    const name = relative(file);
    code(file)
      .split(/\r?\n/)
      .forEach((text, index) => {
        out.push({ file: name, number: index + 1, text });
      });
  }
  return out;
}

export function report(hits: Line[]): string {
  return hits.map((h) => `${h.file}:${h.number}: ${h.text.trim()}`).join("\n");
}

export function walk(dir: string): string[] {
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
 * "Participant" is here rather than getting a token of its own (owner decision, 15 Sep 2026).
 * It is the same fact as `players` - how many people are in this contest - and the admin app
 * was already contradicting itself, the Game Master dashboard counting the identical number
 * and calling them "Players". A second token would have let an operator rename one and not
 * the other and keep the contradiction.
 *
 * The general form, and the reason this is a list rather than one entry: a guard built from a
 * token's default value polices one spelling of a concept the codebase has several names for.
 * Add the synonym, not a looser pattern.
 */
const SYNONYMS: { token: TerminologyToken; word: string }[] = [
  { token: "contest", word: "Contest" },
  { token: "contests", word: "Contests" },
  { token: "player", word: "Participant" },
  { token: "players", word: "Participants" },
];

export const BANNED_NOUNS = [...RENAMEABLE, ...SYNONYMS];

/**
 * Title Case renameable nouns sitting in displayed text rather than in an identifier.
 *
 * Scoped to Title Case only, and that is a deliberate limit rather than an oversight. The
 * lowercase forms appear legitimately in route ids (`activeTab=competitions`, a never-rename
 * `ADMIN_SECTIONS` value) and in identifiers. Banning them outright fires on correct code,
 * and a guard that fires on correct code is the one the next reader deletes. The lowercase
 * sweep is A3b, which tokenises the prose first and then tightens this.
 */
export function literalNounHits(surface: string[]): Line[] {
  const hits: Line[] = [];
  for (const line of lines(surface)) {
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
        skipped it: the file was reported clean while a bare Title Case noun sat in it.
        Nothing renameable is plausibly a generic (`Record`, `Map` and `ReadonlyMap` are not
        operator vocabulary), and the other three alternatives already cover a word touching
        an identifier or a dot - so the class costs nothing and the omission cost the whole
        assertion.
      */
      // Reason: same as the boundary pattern above - `word` comes from the catalogue.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const isIdentifier = new RegExp(
        `[A-Za-z0-9_$]${word}|${word}[A-Za-z0-9_$]|\\.${word}|${word}\\s*[:=(]`,
      ).test(line.text);
      if (isIdentifier) continue;
      /*
        A TypeScript TYPE reference, which the adjacency test above cannot see because a type
        name is surrounded by the same punctuation a caption is. Three shapes, all of them
        live on the A3 surface: `interface Competition {`, `useState<Competition | null>` and
        `(competition: Competition) =>`.

        These are `Competition` the INTERFACE, not the word an operator renames, and there is
        no token that could replace them - a type name is an identifier. The A2 surface had
        none of them, which is why the first cut of this scan did not need the case; the
        contest list declares its row shape locally and has five.
      */
      // Reason: `word` comes from the hard-coded catalogue, as above.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const isTypeReference = new RegExp(
        `\\b(?:interface|type|class|enum)\\s+${word}\\b` +
          `|<${word}\\s*(?:[|,>\\[])` +
          `|:\\s*${word}\\s*(?:[)|,;>\\[=]|$)`,
      ).test(line.text);
      if (isTypeReference) continue;
      /*
        "GAME MASTER" IS A ROLE, NOT A GAME, so the `game` token must never reach it. An
        operator who renames Games to "Puzzles" has said what their contests are called; they
        have not renamed the partner programme, and "Puzzle Master" is a job title nobody
        holds. Chapter 19 is a whole subsystem with its own model, routes and ledger values,
        and `gameMasterName` is stored per contest.

        Scoped to the two-word phrase rather than exempting `Game` outright, so a bare
        "Game" caption is still caught.
      */
      if (/^Games?$/.test(word) && /\bGames?\s+Master/.test(line.text)) continue;
      hits.push(line);
    }
  }
  return hits;
}

/**
 * Trading vocabulary in a caption.
 *
 * Separate from the noun check because these are not renameable - there is no token for them
 * and there must not be. They are the words this pass exists to remove from a screen an
 * operator uses for a puzzle contest.
 *
 * "trading" and "trader" ARE permitted in the lowercase, because some captions name trading
 * deliberately: the unscored policy compares its refund rule against trading's, and only a
 * trading account can be liquidated. Title Case is what a label would use.
 */
export function tradingWordHits(surface: string[]): Line[] {
  const hits: Line[] = [];
  const BANNED =
    /(?<![A-Za-z])(Trading|Trader|Traders|Portfolio|Equity)(?![A-Za-z])/;
  for (const line of lines(surface)) {
    if (!BANNED.test(line.text)) continue;
    if (/[A-Za-z0-9_$"]\s*(Trading|Trader)/.test(line.text)) continue;
    hits.push(line);
  }
  return hits;
}
