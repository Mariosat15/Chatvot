import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readChallengeCode } from "../helpers/challenge-create-screen";

/**
 * What the help page tells a player a challenge IS.
 *
 * Nothing here is a calculation, which is why it went unnoticed for so long: the page
 * rendered perfectly while asserting that challenges are always a trading duel against a
 * named opponent, and that there is no public list of open ones. All three claims were
 * false by 14 September 2026, and a player reading them either never finds the Open tab or
 * concludes the platform cannot do what it plainly does.
 *
 * Every guard is structural because there is no wrong number to assert on. Two of the three
 * are written as ABSENCES - a page can mention open challenges in one paragraph while the
 * paragraph above still denies they exist, and a positive-only check is green on exactly
 * that.
 */

const HELP = "app/(root)/help/page-content.tsx";
const ROOT = process.cwd();

/**
 * Comments stripped, then every run of whitespace collapsed to one space.
 *
 * Reason: this is prose inside JSX, so the formatter breaks a sentence wherever the line
 * runs out - "no Decline\n    button", "needs the\n    relevant market". A pattern written
 * as it reads on screen matches nothing, and a guard that fails while the page is correct
 * is the kind the first person it inconveniences deletes. Collapsing first means the
 * assertions can be written the way a player reads them.
 */
const help = () => readChallengeCode(HELP).replace(/\s+/g, " ");

/**
 * The text between two markers, with both ends proven to exist.
 *
 * Reason: a phrase can be right in one place and missing in the place that matters. The Open
 * tab is named four times and "open to anyone" three, so a bare page-wide match is green
 * when the one occurrence a probe destroys is the one carrying the claim - which is exactly
 * what happened here, and is the same trap as `!expectedOrigin` and `MIN_REASON_LENGTH`. And
 * the slice itself has to be checked: `indexOf` returning -1 yields a slice that passes
 * everything asked of it, because a test examining nothing passes.
 */
function slice(from: string, to: string): string {
  const text = help();
  const start = text.indexOf(from);
  expect(start, `start marker moved: ${from}`).toBeGreaterThan(-1);
  const end = text.indexOf(to, start + from.length);
  expect(end, `end marker moved: ${to}`).toBeGreaterThan(-1);
  return text.slice(start, end);
}

describe("the vocabulary", () => {
  it("never says duel", () => {
    // Reason: a hard constraint, not a preference. The codebase has a `Challenge` model,
    // `/challenges` routes, `challengesEnabled` and `challenge_entry` ledger values, so a
    // second noun in the one document that teaches players the feature is how the two
    // vocabularies end up in support tickets.
    expect(help()).not.toMatch(/\bduels?\b/i);
  });
});

describe("open challenges", () => {
  it("does not deny that a challenge can be left open", () => {
    // Reason: the sentence that was there - "there's no public lobby, every challenge is an
    // invitation from one player to another" - is the specific false claim. Banning the
    // shape of it matters more than requiring the corrective text, because the corrective
    // text can be added underneath while the denial stays.
    const text = help();
    expect(text).not.toMatch(/no public (lobby|open)/i);
    expect(text).not.toMatch(/every challenge is an invitation/i);
  });

  it("offers the open seat in the opening description, not only further down", () => {
    // Scoped to the intro because that is the paragraph a player reads before deciding the
    // feature is not for them. Mentioned only in a later bullet, the capability is there and
    // undiscovered.
    expect(
      slice("A 1v1 Challenge is a head-to-head contest", "How a 1v1 Challenge works"),
    ).toMatch(/open to anyone/i);
  });

  it("names the Open tab in the routes block, which is the only way to find one", () => {
    // The tab is the destination. Describing open challenges without it is a feature a
    // player cannot reach, and the phrase appears elsewhere on the page, so this has to be
    // asserted inside the /challenges card rather than anywhere in the file.
    expect(slice("All your challenges in one place", "/challenges/[id]")).toMatch(
      /<em>Open<\/em>/,
    );
  });

  it("says decline is unavailable on an open challenge rather than leaving it implied", () => {
    // Reason: the decline route admits only the named `challengedId`, so an open seat has
    // nobody who may decline it - refused by construction. A player who is not told that
    // reads the missing button as a bug.
    expect(help()).toMatch(/no Decline button/i);
  });
});

describe("trading is one of two ways to play", () => {
  it("scopes the trading-only rule blocks instead of stating them as the rules", () => {
    const text = help();
    // Both blocks are trading-only in the code - a game challenge has no sandbox capital
    // and cannot be liquidated - so both headings must say so. Asserted together because
    // one scoped heading beside one unscoped heading is the state this fixes.
    expect(text).toMatch(/Rules inside a <em>trading<\/em> challenge/);
    expect(text).toMatch(/Liquidation &amp; disqualification \(trading\)/);
  });

  it("carries the game half beside it", () => {
    expect(help()).toMatch(/Rules inside a <em>game<\/em> challenge/);
  });

  it("scopes the market-hours guard to trading", () => {
    // Reason: `POST /api/challenges` gates on `gameNeedsMarketHours(gameLabel.gameType)`, so
    // a game challenge can be created at the weekend. Told otherwise, a player waits until
    // Monday to start a puzzle.
    expect(help()).toMatch(
      /<strong>trading<\/strong> challenge also needs the relevant market/i,
    );
  });

  it("does not offer the six trading ranking methods as how every challenge is scored", () => {
    // Reason: `getProviderRankingValue` ignores `rankingMethod` entirely and
    // `getProviderTieBreakerValue` always returns 0, so on a game challenge the six methods
    // and the tie-breakers are controls that do nothing. The tie-breaker heading is the one
    // that has to carry the scope, because the paragraph under it lists trading fields.
    expect(help()).toMatch(/Tie-breakers \(trading\)/);
  });
});

describe("the routes it sends players to", () => {
  it.each([
    ["app/(root)/challenges/page.tsx", "/challenges"],
    ["app/(root)/challenges/[id]/page.tsx", "/challenges/[id]"],
    ["app/(root)/challenges/[id]/trade/page.tsx", "/challenges/[id]/trade"],
    ["app/(root)/challenges/[id]/play/page.tsx", "/challenges/[id]/play"],
  ])("%s exists for the documented route %s", (file, route) => {
    // Reason: the page names four challenge routes in prose and in `<code>` blocks, and a
    // renamed segment breaks them silently - a help page is the one screen nobody notices
    // has gone stale, because it is read by people who do not yet know what is correct.
    expect(existsSync(join(ROOT, file)), `${route} -> ${file}`).toBe(true);
  });

  it("documents the game play screen and not only the trading one", () => {
    // The play route existed for a day before the page mentioned it. Counting both stops a
    // future edit dropping the game entry while the trading entry keeps this green.
    const text = help();
    expect(text).toMatch(/\/challenges\/\[id\]\/trade/);
    expect(text).toMatch(/\/challenges\/\[id\]\/play/);
  });
});
