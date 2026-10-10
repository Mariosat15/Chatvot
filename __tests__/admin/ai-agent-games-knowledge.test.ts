/**
 * What the AI agent knows, and what it reports (X6.5 A6, chapter 14 section 4).
 *
 * WHAT WAS WRONG, IN TWO HALVES.
 *
 * The knowledge base opened "ChartVolt is a trading competition platform" and described a
 * competition as a "trading event". Asked how to run a contest on a provider game, the agent
 * did not decline - it answered fluently out of the only material it had, and told the
 * operator to set starting capital and leverage on a puzzle. Nothing thrown, nothing logged.
 * It also carried about a dozen navigation paths that no longer exist, and a path is the one
 * thing an operator cannot work around: they either find the screen or they ask support.
 *
 * The reports were R92 one surface along. `participant-seat.ts` defaults `pnl`,
 * `pnlPercentage` and `totalTrades` to `0` on EVERY seat regardless of game, so a provider
 * contest's leaderboard rendered a confident `0.00` P&L for every player while the score -
 * the only figure that decided the prize - was never selected at all. The agent's output is
 * quoted into support replies and prize disputes, so a phantom zero here is a number an
 * operator defends in writing.
 *
 * WHAT IS PINNED BELOW, in order: that the games material exists, reaches the prompt and
 * enumerates no game; that the vocabulary clause is appended rather than spliced; that a
 * provider contest reports a score and withholds the trading figures; that an absent figure
 * is a dash and never a zero; and that no reporter infers a provider ranking for itself.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GAMES_KNOWLEDGE_BASE,
  GAMES_QUICK_ANSWERS,
} from "../../apps/admin/lib/ai-agent/games-knowledge-base";
import { PLATFORM_KNOWLEDGE_BASE } from "../../apps/admin/lib/ai-agent/knowledge-base";
import { TERMS } from "../../lib/constants/terminology";

const ROOT = join(__dirname, "..", "..");
const ADMIN = join(ROOT, "apps", "admin");

const ROUTE = join(ADMIN, "app/api/ai-agent/chat/route.ts");
const GAMES_KB = join(ADMIN, "lib/ai-agent/games-knowledge-base.ts");

/**
 * Source with comments stripped.
 *
 * Every module involved here EXPLAINS the mistakes it exists to avoid, naming the exact
 * things asserted against below - "score", "withheld", "never zeroed". A test that reads
 * prose fails in both directions: it flags a correct file for discussing the anti-pattern,
 * and it passes a broken one whose only mention of the right thing is in a comment.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The body of one function, located by name and proven to have been found. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `${name} is not in the file`).toBeGreaterThan(-1);

  // Reason the end is the NEXT declaration rather than a brace count: a slice whose end
  // marker has moved returns -1, and `slice(start, -1)` hands back almost the whole file
  // with every assertion trivially true. Both ends are asserted.
  const rest = source.slice(start + 1);
  const next = rest.search(/\n(async )?function \w+\(|\nexport /);
  const body = next === -1 ? rest : rest.slice(0, next);

  expect(body.length, `${name} sliced to nothing`).toBeGreaterThan(40);
  return body;
}

// =======================================================================================
// The games material exists and reaches the model
// =======================================================================================

describe("the agent knows how games are administered", () => {
  it("is composed into the knowledge base the prompt reads", () => {
    /*
      A module nobody imports is the R42 shape - correct code that never runs. The knowledge
      base is the only thing the agent is told about this platform, so material sitting
      beside it rather than inside it is material the model has never seen.
    */
    expect(PLATFORM_KNOWLEDGE_BASE).toContain(GAMES_KNOWLEDGE_BASE);
    expect(GAMES_KNOWLEDGE_BASE.length).toBeGreaterThan(2000);
  });

  it("states the two facts that make every trading answer wrong on a game", () => {
    /*
      Not a copy test - these two are the load-bearing claims. A provider game has no
      starting capital and reports a score; a provider never touches money. Everything the
      agent would otherwise get wrong about a game contest follows from one of them.
    */
    expect(GAMES_KNOWLEDGE_BASE).toMatch(/\bscore\b/i);
    expect(GAMES_KNOWLEDGE_BASE).toMatch(
      /provider never touches money|no wallet access/i,
    );
  });

  it("enumerates no game anywhere", () => {
    /*
      THE ONE FAILURE MODE OF THE NO-DEVELOPER-NEEDED CLAIM is something that names a game.
      A knowledge base mentioning a title is wrong about the second title the day it is
      synced, silently, while every other assertion here still passes.
    */
    const text = `${GAMES_KNOWLEDGE_BASE}\n${Object.values(GAMES_QUICK_ANSWERS).join("\n")}`;

    for (const forbidden of [
      "circuit",
      "chartvolt-games",
      "gameCode",
      "gameKey",
      "providerKey",
    ]) {
      expect(
        text.toLowerCase(),
        `the games knowledge base names ${forbidden}`,
      ).not.toContain(forbidden.toLowerCase());
    }
  });

  it("carries no navigation path the sidebar does not have", () => {
    /*
      The original knowledge base's paths were mostly stale, which is why they were rewritten
      rather than extended. These are the names that were WRONG, so their reappearance is the
      regression: "Financials" is Finance, "Credit Conversion" is Currency, and KYC and fraud
      are under Security rather than Settings.
    */
    const text = code(GAMES_KB);

    for (const stale of [
      "Financials ->",
      "Credit Conversion",
      "Settings -> KYC",
      "Settings -> Fraud",
    ]) {
      expect(text, `a stale path survived: ${stale}`).not.toContain(stale);
    }
  });
});

// =======================================================================================
// The operator's own nouns, by the one mechanism
// =======================================================================================

describe("the system prompt carries the vocabulary clause", () => {
  it("appends it rather than splicing it into the prompt", () => {
    /*
      A3c's pattern, and the reason is the same one that kept the Game Master `||` verbatim
      while settlement was extracted: the historical prompt is the only evidence the agent
      still behaves as it did, and that evidence survives only while the clause is
      CONCATENATED. Being last is a second, independent benefit - it is the position a model
      resolves a conflict in favour of.
    */
    const source = code(ROUTE);

    expect(source).toContain("SYSTEM_PROMPT_BASE + vocabularyRule(terms)");

    const base = source.slice(
      source.indexOf("const SYSTEM_PROMPT_BASE"),
      source.indexOf("function buildSystemPrompt"),
    );
    expect(base.length).toBeGreaterThan(200);
    expect(base).not.toContain("vocabularyRule");
  });

  it("reads the terms server-side and never off the request", () => {
    /*
      The vocabulary is OURS, not the caller's - the same rule that makes `gameKey` a lookup
      key and nothing else. Taken off the body it is arbitrary text inside a system prompt.
    */
    const source = code(ROUTE);

    expect(source).toMatch(/buildSystemPrompt\(await getTerms\(\)\)/);
    expect(source).not.toMatch(
      /terms\s*\}\s*=\s*await (request|req)\.json\(\)/,
    );
  });
});

// =======================================================================================
// R92's remainder: what a report says about a game
// =======================================================================================

describe("a provider contest is reported on its score", () => {
  it("withholds every trading figure rather than zeroing it", () => {
    /*
      THE LOAD-BEARING ASSERTION OF THIS FILE. Withholding is the whole difference between
      this and the defect: the seat carries `pnl: 0` on a puzzle, so a version that reported
      it "because the field is there" produces a leaderboard that is complete, plausible,
      internally consistent and wrong - and the operator quotes it.
    */
    const body = functionBody(code(ROUTE), "participantMetrics");
    const provider = body.slice(0, body.indexOf("return {", body.indexOf("}")));

    expect(provider).toContain("score");
    for (const trading of ["pnl", "winRate", "totalTrades", "Capital"]) {
      expect(provider, `the provider branch reports ${trading}`).not.toContain(
        trading,
      );
    }
  });

  it("labels the score column with the operator's word", () => {
    const body = functionBody(code(ROUTE), "participantMetricColumns");

    expect(body).toContain("terms.score");
    // Asserted, not assumed - a hedge here makes the line above vacuous.
    expect(TERMS.score.length).toBeGreaterThan(0);
  });

  it("reports a challenge on score too, and withholds its starting capital", () => {
    /*
      R92's write side put `score` on both stat blocks; this is the read side in the agent.
      `startingCapital` goes with it: the seat builder writes it per game, so on a provider
      challenge it is absent, and an absent required-looking figure reads as a data fault.
    */
    const body = functionBody(code(ROUTE), "executeGetChallengeDetails");

    expect(body).toContain("hasProviderGameLabel(challenge)");
    expect(body).toContain("challengerFinalStats?.score");
    expect(body).toMatch(/isProviderChallenge[\s\S]{0,80}starting_capital/);
  });

  it("tells a trading challenge from a game one in the list", () => {
    // Every other column on that table is identical for both, so without this an operator
    // reading a mixed list cannot tell which game any row belongs to.
    const body = functionBody(code(ROUTE), "executeGetChallenges");

    expect(body).toContain("resolveGameBadge(c).label");
    expect(body).toContain('label: "Game"');
  });
});

// =======================================================================================
// An absent figure, and a ranking nobody may guess
// =======================================================================================

describe("the reporter never invents a figure", () => {
  it("renders an absent number as a dash and a stored zero as zero", () => {
    /*
      R45 and R50's read-side rule. `??`-shaped rather than `||`-shaped, because a stored
      zero is a real figure - the `entryBlockThreshold` rule one field along - so the two
      halves are asserted separately or a truthiness check passes the first alone.
    */
    const body = functionBody(code(ROUTE), "reportedFigure");

    expect(body).toContain("Number.isFinite");
    expect(body).toContain("—");
    expect(body).not.toMatch(/\|\|\s*0/);
  });

  it("uses no phantom zero in the competition reports", () => {
    /*
      The defect in its original spelling. `pnl?.toFixed(2) || "0"` is what made a puzzle's
      leaderboard read as a flat trading contest, and it is a one-character edit from
      returning.
    */
    const source = code(ROUTE);
    const reports = source.slice(
      source.indexOf("async function executeGetCompetitionLeaderboard"),
      source.indexOf("// ==================== INVOICE"),
    );

    expect(reports.length).toBeGreaterThan(1000);
    expect(reports).not.toMatch(/toFixed\(2\)\s*\|\|\s*"0"/);
    expect(reports).not.toMatch(/pnlPercentage\?\.toFixed\(2\)\s*\|\|\s*0/);
  });

  it("refuses to infer a provider winner by sorting", () => {
    /*
      THE SUBTLEST ONE, AND THE REASON IT CANNOT BE "FIXED" BY SORTING ON SCORE INSTEAD.
      Which score wins is a property of the catalogue title - a time trial's winner holds the
      LOWEST score - so a reporter ordering on `score` names the loser on half the catalogue
      and puts a medal next to it. `resolveScoreDirection` is the only answer and applying it
      is settlement's job, not a reporter's, so the fallback declines instead.
    */
    const body = functionBody(code(ROUTE), "executeGetCompetitionWinner");

    // The pnl-ordered fallback must be reachable only for a trading contest.
    expect(body).toMatch(/isProviderContest[\s\S]{0,200}sort\(\{ pnl: -1 \}\)/);
    expect(body).not.toMatch(/sort\(\{ score:/);
  });

  it("orders a live provider leaderboard on the rank the engine computed", () => {
    // Same reasoning, one tool along: `currentRank` already has the direction applied.
    const body = functionBody(code(ROUTE), "executeGetCompetitionLeaderboard");

    expect(body).toContain("currentRank: 1");
    expect(body).toContain("participantSort");
    // Counted, because three queries share it and a fourth spelled out inline is the bug.
    expect(body.match(/\.sort\(participantSort\)/g)).toHaveLength(3);
  });
});
