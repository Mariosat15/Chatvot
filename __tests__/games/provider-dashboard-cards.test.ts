import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guards on the dashboard's contest cards (chapter 13 section 5).
 *
 * WHY STRUCTURAL: the vitest environment is `node` with no jsdom and no react-testing-library,
 * and adding them here would land a test-stack change in the same commit as a player-facing
 * change. The properties below are structural anyway - which field a card reads, which route a
 * link points at, and whether a colour has a third state.
 *
 * THE FOUR RULES THESE OBEY, EACH LEARNED BY GETTING IT WRONG:
 *
 *   - Strip comments before matching, because these files explain in prose the anti-patterns
 *     they avoid. A test that reads prose flags a correct file and passes a broken one.
 *   - An import is not a use. Every assertion matches a call with its arguments, or an
 *     operator with its operands, never a bare identifier.
 *   - Count the occurrences. The same identifier appears in more than one place in these
 *     files, so a bare match is satisfied by the copy you did not mean.
 *   - Assert position within the construct, never a fixed number of characters back.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ACTION = "lib/actions/comprehensive-dashboard.actions.ts";
const SIDEBAR = "components/dashboard/ContestsSidebar.tsx";
const CARD = "components/dashboard/ActiveCompetitionCard.tsx";
const TABLE = "components/dashboard/CompetitionsTable.tsx";

describe("the dashboard action carries the game label and the score", () => {
  /**
   * The read-side half of R37, one screen along. The leaderboard was fixed on 6 September
   * 2026 by selecting `score`; the dashboard selects its own narrower field list and was
   * never touched, so every provider card would have shown zero.
   */
  it("selects score on the participant", () => {
    const code = readCode(ACTION);
    const selects = code.match(/participantSelect\s*=\s*"[^"]*"/g) || [];
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select).toMatch(/\bscore\b/);
    }
  });

  it("selects score on the bulk participant read used for ranking", () => {
    const code = readCode(ACTION);
    // Reason: this is a SECOND, separate select. Fixing only `participantSelect` leaves the
    // rank computed from rows that have no score, which is the defect in a different place.
    expect(code).toMatch(
      /\.select\(\s*"userId competitionId[^"]*\bscore\b[^"]*"\s*\)/,
    );
  });

  it("selects the game label on the competition", () => {
    const code = readCode(ACTION);
    const select = code.match(/competitionSelect\s*=\s*"([^"]*)"/);
    expect(select).not.toBeNull();
    expect(select![1]).toMatch(/\bgameType\b/);
    expect(select![1]).toMatch(/\bgameKey\b/);
  });

  it("does not coerce an absent score to zero on its way to the card", () => {
    // Reason: undefined means no round has reported yet; zero means the player scored
    // nothing. `score: participation.score || 0` collapses the two and the card then claims
    // a score the player has not been given. The read-side form of the bug behind R37.
    const code = readCode(ACTION);
    expect(code).toMatch(/score:\s*participation\.score\s*,/);
    expect(code).not.toMatch(/score:\s*participation\.score\s*(\|\||\?\?)/);
  });
});

describe("the dashboard ranks a provider contest on its score", () => {
  /**
   * Both halves of the trading comparator misfire on a provider contest, and neither errors.
   * `getDashboardRankingValue` reads `pnl`, which is zero on every provider row, and the
   * has-trades pre-sort is a no-op because nobody has trades - so every comparison returns
   * zero, the sort does nothing, and the card shows the player's position in the query's
   * result order as though it were a rank.
   */
  it("resolves the score direction rather than assuming higher is better", () => {
    const code = readCode(ACTION);

    // Reason this asserts the ABSENCE of a literal and not merely the presence of the call:
    // the first version of this test matched `await resolveScoreDirection(` and stayed green
    // when the ranking site was replaced with a hard-coded `"higher_is_better"`, because the
    // resolver was still called from the memo helper a few lines above. It proved the
    // function existed, not that the ranking used its answer. A direction literal anywhere
    // in this file is the defect: it silently ranks the slowest player first in every
    // lower-is-better game, which is R33 in a second place.
    expect(code).not.toMatch(/["'](higher|lower)_is_better["']/);

    expect(code).toMatch(
      /const\s+direction\s*=\s*isProviderGame\s*\?\s*await\s+scoreDirectionFor\(/,
    );
    expect(code).toMatch(/await\s+resolveScoreDirection\(/);
  });

  it("dispatches through the game registry instead of adding a score case to the switch", () => {
    // Reason: the direction negation must exist in exactly one place. A `case "score":` in
    // `getDashboardRankingValue` would be a fourth copy of it, and the fourth copy is the one
    // that disagrees with the leaderboard.
    const code = readCode(ACTION);
    expect(code).toMatch(/getGameModuleOrTrading\(\s*competition\.gameType\s*\)/);
    expect(code).toMatch(/providerModule\.getRankingValue\(/);
    expect(code).not.toMatch(/case\s+["']score["']/);
  });

  it("skips the has-trades pre-sort for a provider contest", () => {
    // Reason: it is not merely useless there - it is a rule that a player with trades
    // outranks one without, applied to a game that has no trades. Today it is a no-op
    // because the answer is the same for everyone; the moment anything sets `totalTrades`
    // on a provider row it silently becomes the ranking.
    const code = readCode(ACTION);
    const guard = code.match(/if\s*\(\s*!isProviderGame\s*\)\s*\{/);
    expect(guard).not.toBeNull();

    const guardAt = code.indexOf(guard![0]);
    const hasTradesAt = code.indexOf("aHasTrades");
    expect(hasTradesAt).toBeGreaterThan(guardAt);
  });

  it("reads the game label with the display helper, not the launch helper", () => {
    // Reason: `isProviderContest` also demands a provider key and a game code, because a
    // contest missing those cannot launch a round. Ranking is not launching - a keyless
    // provider contest still has scores and no P&L - so the strict helper would rank its
    // players on `pnl` and tie every one of them at zero.
    const code = readCode(ACTION);
    expect(code).toMatch(/hasProviderGameLabel\(\s*competition\s*\)/);
    expect(code).not.toMatch(/isProviderContest\(/);
  });
});

describe("the live dashboard card shows a score, not a profit and loss", () => {
  /**
   * `ContestsSidebar` is the component players actually see on `/dashboard`. The two
   * components named in chapter 13 section 5 - `ActiveCompetitionCard` and
   * `CompetitionsTable` - are orphaned; see the describe block below.
   */
  it("decides value, label and colour in one function", () => {
    // Reason: three parallel switches meant making the card game-aware required remembering
    // all three, and the one that mattered most was the colour.
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/function\s+describeCompMetric\s*\(/);
    expect(code).toMatch(/const\s+metric\s*=\s*describeCompMetric\(\s*comp\s*\)/);
  });

  it("gives the colour a third state so a score is never rendered as a loss", () => {
    // THE DEFECT THIS PINS: `isCompMetricPositive(comp) ? green : red` has no way to say
    // "neither". A provider score of 0, or one that has not arrived, took the else branch
    // and rendered RED - telling a puzzle player they were down money in a game with no
    // money in it. No error, no log line.
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/tone:\s*["']neutral["']/);
    expect(code).toMatch(/metric\.tone\s*===\s*["']negative["']/);

    // And the two-way version is gone from the render, not merely joined by a third arm.
    expect(code).not.toMatch(
      /isCompMetricPositive\(\s*comp\s*\)\s*\?\s*["']text-green/,
    );
  });

  it("renders an absent score as a dash rather than as zero", () => {
    const code = readCode(SIDEBAR);
    expect(code).toMatch(
      /comp\.score\s*===\s*undefined\s*\|\|\s*comp\.score\s*===\s*null/,
    );
  });

  it("labels the metric Score for a provider contest", () => {
    const code = readCode(SIDEBAR);
    const provider = code.indexOf('comp.gameType === "provider"');
    expect(provider).toBeGreaterThan(-1);
    const label = code.indexOf('label: "Score"');
    expect(label).toBeGreaterThan(provider);
  });
});

describe("the two cards chapter 13 section 5 names are game-aware too", () => {
  /**
   * BOTH ARE ORPHANED, and that is a correction to the plan rather than a discovery about
   * the code. Nothing imports `ActiveCompetitionCard` at all, and `CompetitionsTable` is
   * imported only by `LiveDashboardWrapper`, which is itself imported by nothing. They were
   * fixed anyway, because reviving the wrapper would otherwise resurrect a defect that had
   * been recorded as closed - the same reasoning that deletes a dead helper rather than
   * leaving it as a one-line invitation.
   */
  it("nothing imports the two of them into a live screen", () => {
    // Reason: if this ever goes red, one of them has been mounted and the assertions below
    // stop being cheap insurance and start being load-bearing. That is worth being told.
    const layout = readCode("components/dashboard/DashboardLayout.tsx");
    expect(layout).not.toMatch(/ActiveCompetitionCard/);
    expect(layout).not.toMatch(/CompetitionsTable/);
  });

  it("the active-competition card branches instead of guarding nine blocks", () => {
    const code = readCode(CARD);
    const branch = code.match(
      /if\s*\(\s*competition\?\.gameType\s*===\s*["']provider["']\s*\)/,
    );
    expect(branch).not.toBeNull();

    // Assert POSITION: the branch must sit above the trading arithmetic, not below it.
    const branchAt = code.indexOf(branch![0]);
    const capitalAt = code.indexOf("capitalPercentage");
    expect(capitalAt).toBeGreaterThan(branchAt);
  });

  it("the provider card never says Trade Now and never links to the trade route", () => {
    const code = readCode(CARD);
    // Reason: count them. The trading body legitimately keeps its own "Trade Now" and its
    // `/trade` links, so a bare absence assertion would have to be false. What must hold is
    // that the provider component contains neither.
    const providerAt = code.indexOf("function ProviderActiveCompetitionCard");
    expect(providerAt).toBeGreaterThan(-1);
    const providerBody = code.slice(providerAt);

    expect(providerBody).not.toMatch(/Trade Now/);
    expect(providerBody).not.toMatch(/\/trade/);
    expect(providerBody).not.toMatch(/formatCurrency\(\s*participation\.pnl/);
  });

  it("the provider card does not link straight at the route that spends an attempt", () => {
    // Reason: launching a round consumes an attempt, and Next.js prefetches `<Link>` targets
    // on hover - so a card linking directly to a launching route would spend a paying
    // player's only attempt on a mouse movement.
    const code = readCode(CARD);
    const providerBody = code.slice(
      code.indexOf("function ProviderActiveCompetitionCard"),
    );
    expect(providerBody).not.toMatch(/\/play/);
    expect(providerBody).toMatch(/href=\{`\/competitions\/\$\{competition\._id\}`\}/);
  });

  it("the table replaces its trading columns rather than filling them with zeroes", () => {
    const code = readCode(TABLE);
    expect(code).toMatch(/function\s+ProviderCompetitionRow\s*\(/);
    // Reason: the header has 13 columns. Name and rank survive, the action survives, so the
    // span is exactly 10. A wrong span silently misaligns every row below it.
    expect(code).toMatch(/colSpan=\{10\}/);
  });

  it("the table branches before computing capital health", () => {
    const code = readCode(TABLE);
    const branch = code.match(
      /if\s*\(\s*comp\.competition\?\.gameType\s*===\s*["']provider["']\s*\)/,
    );
    expect(branch).not.toBeNull();

    // Reason: `capitalHealth` divides undefined by undefined and renders "NaN%", and the
    // margin maths lands on Infinity and paints a green "safe" shield for a contest with no
    // margin. Neither throws, so only position keeps them unreachable.
    const branchAt = code.indexOf(branch![0]);
    expect(code.indexOf("const capitalHealth")).toBeGreaterThan(branchAt);
    expect(code.indexOf("const marginLevel")).toBeGreaterThan(branchAt);
  });
});
