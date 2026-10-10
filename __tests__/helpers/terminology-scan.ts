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
    /*
      AN IMPORT SPECIFIER IS AN IDENTIFIER, and it took the A4 surface to expose that this
      scan had never said so. `lowercaseNounHits` has skipped import lines since it was
      written; this one did not, so `import Challenge from "@/database/models/trading/
      challenge.model"` was reported as a caption. A default import's local name is
      surrounded by spaces, which is exactly the adjacency test below looking for prose.

      It matters more than a single false report: a guard that fires on correct code is the
      one the next reader deletes, and the deletion takes the twenty real hits with it.
    */
    if (/^\s*(?:import|export)\b.*\bfrom\b/.test(line.text)) continue;

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
      /*
        `${word}\\.[A-Za-z_$]` IS A MEMBER ACCESS, NOT A SENTENCE ENDING, and the distinction
        is the whole reason it is spelled that way. `\\.${word}` already covered
        `foo.Competition`; the mirror case `Challenge.findById(id)` was not covered, so the
        model's own static call read as prose. A bare `${word}\\.` would have covered it and
        also exempted every sentence that ends in the noun - "...refunded to the
        Competition." - which is the commonest caption shape there is. Requiring an
        identifier character immediately after the dot separates the two exactly: a sentence
        ending has a space or the end of the line there, never a letter.
      */
      // Reason: same as the boundary pattern above - `word` comes from the token catalogue,
      // not from anything a request or a file can supply.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const isIdentifier = new RegExp(
        `[A-Za-z0-9_$]${word}|${word}[A-Za-z0-9_$]|\\.${word}` +
          `|${word}\\s*[:=(]|${word}\\.[A-Za-z_$]`,
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
 * The same renameable nouns in their LOWERCASE form, in running prose.
 *
 * WHY THIS IS A SECOND FUNCTION RATHER THAN A CASE FLAG ON THE ONE ABOVE. Title Case and
 * lowercase are two different problems. A Title Case noun in this codebase is almost always a
 * caption, so `literalNounHits` can be strict and cheap. The lowercase forms are the same word
 * used as a route segment (`activeTab=competitions`), a stored status value (`"contest"`), a
 * property (`round.pollAttempts`), a local (`const rounds =`) and a type-ish identifier - all
 * of which are on chapter 14 section 6's never-rename list, and all of which sit on the same
 * lines as the prose. One function trying to be both is a function that is wrong in one
 * direction or the other, and the direction it fails in is the quiet one.
 *
 * So this works OCCURRENCE BY OCCURRENCE rather than line by line: a line is reported only if
 * at least one occurrence of the word is in a position no identifier, path or bare string
 * literal can occupy. `toast.error("Failed to load competitions")` is reported on the same
 * line as `/api/competitions/${id}` would be, which is the whole reason for counting
 * positions rather than testing the line.
 *
 * `console.*` is excluded outright. A developer log is not operator-facing, and tokenising one
 * makes the log depend on a stored value - so a support engineer reading "Failed to load
 * Tournaments" cannot grep for the line that wrote it.
 */
/** True when `[start, end)` falls inside a quoted span that contains a space. */
function quotedSpanWithSpace(text: string, start: number, end: number): boolean {
  for (const quote of ['"', "'", "`"]) {
    let from = text.indexOf(quote);
    while (from !== -1) {
      const to = text.indexOf(quote, from + 1);
      if (to === -1) break;
      const inner = text.slice(from + 1, to);
      if (start > from && end <= to && /\s/.test(inner)) return true;
      from = text.indexOf(quote, to + 1);
    }
  }
  return false;
}

/**
 * Runs of three or more plain words - the shape of a sentence rather than a signature.
 *
 * Written as a tokenise-then-merge rather than the obvious single pattern, which was
 * `/[A-Za-z]{2,}(?:[ ]+[A-Za-z]{2,}){2,}/g`. That spelling nests a `+` inside a `{2,}`, so a
 * long run of spaces that never completes a word can be split between the two quantifiers in
 * many ways and the matcher tries them all - polynomial backtracking on an input this helper
 * reads from every file in the admin app. `security/detect-unsafe-regex` flagged it as an
 * error, correctly.
 *
 * Tokenising is linear and says the same thing more plainly: find the words, then join the
 * neighbours whose gap is nothing but spaces.
 */
function wordRuns(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];

  const word = /[A-Za-z]{2,}/g;
  const words: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = word.exec(text)) !== null) {
    words.push({ start: match.index, end: match.index + match[0].length });
  }

  /*
    Reason for the rule-scoped disables: every index below is a loop counter bounded by
    `words.length`, so there is no external key to inject. Scoped to the one rule rather than
    disabling the file, and never the blanket `eslint-disable` - a helper that has switched
    every check off is the next place a real problem hides.
  */
  let i = 0;
  while (i < words.length) {
    let last = i;
    // Reason: the gap must be spaces ONLY. A comma, a tag or an operator between two words
    // means this is punctuation or code, not the running prose the scan is looking for.
    while (
      last + 1 < words.length &&
      // eslint-disable-next-line security/detect-object-injection
      /^[ ]+$/.test(text.slice(words[last].end, words[last + 1].start))
    ) {
      last += 1;
    }
    // eslint-disable-next-line security/detect-object-injection
    if (last - i >= 2) out.push({ start: words[i].start, end: words[last].end });
    i = last + 1;
  }

  return out;
}

export function lowercaseNounHits(surface: string[]): Line[] {
  const hits: Line[] = [];
  for (const line of lines(surface)) {
    // Not displayed: a log line, an import specifier, a directive.
    if (/\bconsole\.(?:log|warn|error|info|debug)\s*\(/.test(line.text)) continue;
    if (/^\s*(?:import|export)\b.*\bfrom\b/.test(line.text)) continue;

    for (const { word } of BANNED_NOUNS) {
      const lower = word.toLowerCase();
      // Reason: built from `TERMS`, a hard-coded catalogue in this repository - never from a
      // request or a stored value. Scoped to the one rule rather than a blanket disable.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const occurrence = new RegExp(`(?<![A-Za-z])${lower}(?![A-Za-z])`, "g");
      let match: RegExpExecArray | null;
      let prose = false;
      while ((match = occurrence.exec(line.text)) !== null) {
        const start = match.index;
        const end = start + lower.length;
        const before = start === 0 ? "" : line.text.slice(start - 1, start);
        const after = line.text.slice(end);

        /*
          WHAT MAY SIT TO THE LEFT OF A DISPLAYED WORD. Whitespace, the `>` that closes the tag
          before it, the `}` that closes an interpolation before it, or the quote that opens
          its string. Everything else is code welded to the noun, and enumerating what is
          ALLOWED rather than what is banned is what keeps this short: `/api/games/`,
          `edit-game`, `?activeTab=competitions`, `!competition`, `(competition)`,
          `{competitions.map` and `[rounds, setRounds]` are all excluded by one rule.
        */
        if (!(start === 0 || /[\s>}"'`]/.test(before))) continue;

        /*
          AND WHAT MAY SIT TO THE RIGHT. Whitespace, the `<` of the next tag, a closing quote,
          an HTML entity, sentence punctuation that is genuinely followed by a break, or a
          possessive. The punctuation clause is written with the break requirement rather than
          as a bare class because `round.pollAttempts`, `game.rounds` and `competition._id` end
          in a dot too, and a rule that let those through would report every property access in
          the file.
        */
        const rightOk =
          after.length === 0 ||
          /^[\s<]/.test(after) ||
          /^["'`]/.test(after) ||
          /^&[a-z]+;/.test(after) ||
          /^[.,;:!?](?:\s|$|["'`<])/.test(after) ||
          /^['\u2019]s(?![A-Za-z])/.test(after);
        if (!rightOk) continue;

        /*
          A BARE STRING LITERAL, which is a stored value or a route id rather than a word an
          operator reads: `"competition"`, `'contests'`, `` `round` ``. Distinguished from
          prose that merely STARTS a string - `"competition analytics failed"` - by what
          follows: a quote closing immediately means the string is the word and nothing else.
        */
        if (/["'`]/.test(before) && /^["'`]/.test(after)) continue;

        /*
          FINALLY, EVIDENCE THAT THE LINE DISPLAYS ANYTHING. The two tests above locate a word
          in a prose POSITION, which a destructure (`const { round, contest } = detail`) and a
          signature (`function X({ contests, creditSymbol })`) both satisfy - a comma and a
          space read exactly like the end of a clause. So one of three things must also be
          true: the word sits inside a quoted string with a space in it, or inside a run of
          three or more plain words, or the line carries JSX furniture.

          The three-word run must CONTAIN the occurrence, not merely appear on the line.
          Anchored to the line, `export default function GameRevenueBreakdown({ contests,` has
          a perfectly good three-word run in it and nothing displayed at all.
        */
        const quoted = quotedSpanWithSpace(line.text, start, end);
        const inRun = wordRuns(line.text).some(
          (run) => start >= run.start && end <= run.end,
        );
        const jsxFurniture = /<\/|\/>|<[A-Z]|&[a-z]+;|\{" "\}/.test(line.text);
        if (!quoted && !inRun && !jsxFurniture) continue;

        prose = true;
        break;
      }
      if (!prose) continue;

      // "Game Master" is a role, not a game - same reasoning as the Title Case scan above.
      if (/^games?$/.test(lower) && /\bgames?\s+master/i.test(line.text)) continue;

      hits.push(line);
      break;
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
