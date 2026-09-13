import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  sanitiseBreakdown,
  MAX_PROGRESS_ENTRIES,
} from "@/lib/services/games/round-progress.service";

/**
 * A round reporting what the player has done SO FAR (11 September 2026).
 *
 * THE ONE CLAIM EVERY OTHER TEST HERE SERVES. There is now a second place a provider may write
 * to a `game_round`, and chapter 02 section 10 rule 3 says scores enter through exactly one
 * function. This suite exists to prove that `recordRoundProgress` is not that second door:
 * the update it builds names two paths, it refuses a round that is no longer live, and
 * nothing about it touches a participant.
 *
 * Most of it is STRUCTURAL rather than behavioural, and deliberately so. The property is
 * "this code cannot write that field", which no assertion about a stored document can
 * establish - a behavioural test proves what one call did, and the whole risk here is the
 * call somebody adds next year.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const SERVICE = "lib/services/games/round-progress.service.ts";
const ROUTE = "app/api/games/providers/[providerKey]/progress/route.ts";
const LAUNCH = "lib/services/games/round-launch.service.ts";
const ACTIVITY = "lib/services/games/contest-activity.service.ts";
const GS_PROGRESS = "games-service/src/callback/progress.ts";
const GS_PLAY = "games-service/src/rounds/play.ts";

describe("a progress report is not a second scoring door", () => {
  /*
    THE LOAD-BEARING TEST IN THIS FILE.

    Asserted as a COUNT of `$set` blocks plus the exact two paths, not as "the file does not
    contain rawScore". The negative alone is satisfied by a spread of the parsed body, which
    is the realistic way this goes wrong: `$set: { ...payload.breakdown }` mentions no
    forbidden name and writes whatever the provider sends.
  */
  it("writes two named paths and builds them from nothing the provider chose", () => {
    const code = readCode(SERVICE);

    expect(countOf(code, "$set:")).toBe(1);
    expect(code).toMatch(/\$set:\s*\{\s*scoreBreakdown:\s*breakdown,\s*progressAt:\s*new Date\(\)\s*\}/);

    // No spread anywhere near the update, and no second update verb.
    expect(code).not.toMatch(/\$set:\s*\{\s*\.\.\./);
    expect(code).not.toMatch(/\$inc:/);
    expect(code).not.toMatch(/\$push:/);
  });

  it("names none of the fields that decide money or position", () => {
    const code = readCode(SERVICE);

    for (const forbidden of [
      "rawScore",
      "CompetitionParticipant",
      "syncParticipantScore",
      "applyResult",
      "calculateRankings",
    ]) {
      expect(code).not.toContain(forbidden);
    }

    // `status` is READ, to refuse a round that is not live, and never written. The distinction
    // is the point, so it is asserted rather than the word being banned.
    expect(code).toMatch(/round\.status/);
    expect(code).not.toMatch(/status:\s*"/);
  });

  /*
    THE ROUTE IS THE OTHER HALF OF THE SAME CLAIM. Two routes rather than one with a
    `final: false` flag, because a flag is one wrong branch away from the scoring path.
  */
  it("the route decides nothing and cannot reach the ingestion door", () => {
    const code = readCode(ROUTE);

    expect(code).toMatch(/recordRoundProgress\(/);
    expect(code).not.toMatch(/ingestProviderCallback/);
    expect(code).not.toMatch(/applyResult/);
    // It must not verify anything itself - that is the drift the thin route prevents.
    expect(code).not.toMatch(/verifyCallbackSignature/);
    expect(code).not.toMatch(/loadProviderSecrets/);
  });

  it("a round that is no longer live is refused", () => {
    const code = readCode(SERVICE);

    const gateAt = code.indexOf("LIVE_ROUND_STATUSES.includes(round.status)");
    const writeAt = code.indexOf("GameRound.updateOne");
    expect(gateAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(gateAt);
    expect(code).toMatch(/refuse\(\s*\n?\s*"round_not_live"/);
  });
});

describe("what a progress report may carry", () => {
  it("keeps the primitives a screen can render, in the game's own order", () => {
    const kept = sanitiseBreakdown({
      boardsCompleted: 3,
      fastest: "00:12",
      perfect: false,
    });

    expect(Object.keys(kept ?? {})).toEqual([
      "boardsCompleted",
      "fastest",
      "perfect",
    ]);
  });

  it("drops what cannot be rendered rather than flattening it", () => {
    const kept = sanitiseBreakdown({
      boardsCompleted: 2,
      // A nested object renders as "[object Object]" in any consumer not expecting it, and
      // the platform deciding how to flatten a provider's structure is per-game code.
      detail: { a: 1 },
      board: [1, 2],
      broken: Number.NaN,
      missing: null,
    });

    expect(Object.keys(kept ?? {})).toEqual(["boardsCompleted"]);
  });

  it("refuses a key that would write through the prototype", () => {
    const hostile = JSON.parse('{"__proto__": 1, "constructor": 2, "ok": 3}') as Record<
      string,
      unknown
    >;
    const kept = sanitiseBreakdown(hostile);

    expect(Object.keys(kept ?? {})).toEqual(["ok"]);
    expect(({} as Record<string, unknown>).ok).toBeUndefined();
  });

  /*
    THE CAP IS NOT TIDINESS. This endpoint is called once per solved board, and
    `scoreBreakdown` is `Schema.Types.Mixed` - it stores whatever shape arrives. Without a
    bound, a provider looping a growing structure through it inflates one document on every
    board until the 16MB limit refuses the write. That is the `brandingFiles` failure in a new
    place: a store that fills up by SUCCEEDING.
  */
  it("caps how much one report can store", () => {
    const huge: Record<string, number> = {};
    for (let i = 0; i < MAX_PROGRESS_ENTRIES + 10; i++) huge[`k${i}`] = i;

    expect(Object.keys(sanitiseBreakdown(huge) ?? {})).toHaveLength(
      MAX_PROGRESS_ENTRIES,
    );
  });

  it("an empty or unrenderable report is nothing, not an empty object", () => {
    expect(sanitiseBreakdown(undefined)).toBeNull();
    expect(sanitiseBreakdown({})).toBeNull();
    expect(sanitiseBreakdown({ detail: { a: 1 } })).toBeNull();
  });
});

describe("retrying a progress report almost never helps", () => {
  /*
    The 2xx/non-2xx split is a retry INSTRUCTION, and it lands differently here from
    `/events`. A finished round and an unrenderable report are both final, so both are 200 -
    inviting a retry achieves nothing. A round we cannot find keeps its 404, because that is
    usually a game pointed at the wrong environment and a silent success hides it for good.
  */
  it("says so in the status codes", () => {
    const code = readCode(ROUTE);
    const bodyAt = code.indexOf("function statusFor");
    expect(bodyAt).toBeGreaterThan(-1);
    const fn = code.slice(bodyAt, code.indexOf("export async function POST"));
    expect(fn.length).toBeGreaterThan(200);

    for (const final of ['case "recorded"', 'case "round_not_live"', 'case "nothing_to_record"']) {
      expect(fn.indexOf(final)).toBeGreaterThan(-1);
      expect(fn.indexOf(final)).toBeLessThan(fn.indexOf("return 401"));
    }
    expect(fn).toMatch(/case "round_not_found":\s*\n?\s*return 404;/);
  });

  /*
    REFUSALS ARE NOT LOGGED, and that is a decision. This is the highest-rate provider route
    by a wide margin - once per solved board per player - so a log line per refusal turns one
    misconfigured game into a flood that buries the warnings that matter.
  */
  it("and does not log one line per refused board", () => {
    const code = readCode(ROUTE);
    // The unexpected-throw path keeps its console.error. Nothing else logs.
    expect(countOf(code, "console.")).toBe(1);
    expect(code).toMatch(/console\.error\("❌ Provider progress callback failed unexpectedly:/);
  });
});

describe("the platform always offers the address and the provider chooses", () => {
  it("supplies it at launch beside the result callback", () => {
    const code = readCode(LAUNCH);
    expect(code).toMatch(
      /progressCallbackUrl: `\$\{baseUrl\}\/api\/games\/providers\/\$\{config\.providerKey\}\/progress`/,
    );
  });

  /*
    OPTIONAL ON THE CONTRACT AND UNCONDITIONAL AT LAUNCH, and the asymmetry is the design. A
    round that never reports a RESULT is a round nobody gets paid for; a round that never
    reports progress simply shows less on a board. Withholding the URL from a provider who
    later adds progress reporting would mean a config change on our side before their feature
    could work.
  */
  it("optional for a provider to use, never optional for us to send", () => {
    const contract = readCode("lib/services/game-providers/contract.ts");
    expect(contract).toMatch(/progressCallbackUrl\?: string;/);
    expect(contract).toMatch(/resultCallbackUrl: string;/);

    const launch = readCode(LAUNCH);
    const at = launch.indexOf("progressCallbackUrl:");
    expect(at).toBeGreaterThan(-1);
    // Not inside a conditional - the line before it is the result callback, not an `if`.
    expect(launch.slice(Math.max(0, at - 400), at)).not.toMatch(/if\s*\(/);
  });

  // Named without an apostrophe deliberately: a probe selects a test with vitest's `-t`, which
  // is a REGULAR EXPRESSION, and a name needing escaping is one a harness silently fails to
  // select - reporting a passing run over zero tests, which reads exactly like a missing guard.
  it("the two apps carry the same contract", () => {
    const main = readFileSync(
      join(ROOT, "lib/services/game-providers/contract.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/game-providers/contract.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});

describe("a live round's activity moves when a board is solved", () => {
  /*
    `progressAt` SITS BELOW `completedAt` AND ABOVE `startedAt`, and both halves matter.
    Below, because a result is the last word on a round. Above, because without it every live
    player's feed entry is frozen at the moment they pressed Play - so a contest in which four
    people have each just solved a board orders them by who started first and never moves.
  */
  it("the feed orders on the progress report, under the result and over the start", () => {
    const code = readCode(ACTIVITY);
    expect(code).toMatch(
      /return row\.completedAt \?\? row\.progressAt \?\? row\.startedAt \?\? row\.createdAt;/,
    );
  });

  it("and the query actually selects it", () => {
    // A field absent from the projection arrives `undefined`, so the coalesce above would
    // silently skip it and every assertion about ordering would still pass.
    expect(readCode(ACTIVITY)).toMatch(/\.select\(\s*\n?\s*"[^"]*\bprogressAt\b/);
  });

  it("the field is declared on both copies of the model", () => {
    for (const path of [
      "database/models/games/game-round.model.ts",
      "apps/admin/database/models/games/game-round.model.ts",
    ]) {
      const code = readFileSync(join(ROOT, path), "utf8");
      expect(code).toMatch(/progressAt\?: Date;/);
      expect(code).toMatch(/progressAt: \{ type: Date \}/);
    }
  });
});

describe("the game's half never slows the player down", () => {
  /*
    NO `await`, AND THAT IS THE WHOLE RULE. This sits between a player solving a board and
    being handed the next one, in a round they PAID for, so an await on a slow or unreachable
    platform is a visible stall at the worst possible moment.
  */
  it("starts the send and does not wait for it", () => {
    const code = readCode(GS_PLAY);
    expect(code).toMatch(/void sendProgress\(round\);/);
    expect(code).not.toMatch(/await sendProgress/);
  });

  /*
    SENT ONCE, ON THE CONTINUING BRANCH ONLY. The finishing branch is already delivering a
    result with the same figures and a score beside them, and the platform refuses progress
    for a round that is no longer live - so a send there is a guaranteed refusal, warned
    about, on every single completed round.
  */
  it("and not on the branch that finishes the round", () => {
    const code = readCode(GS_PLAY);
    expect(countOf(code, "sendProgress(round)")).toBe(1);

    // `lastIndexOf`, because the same finishing call appears in `resumeRound` earlier in the
    // file: measured from the first one, the send is after it either way and the assertion
    // proves nothing.
    const finishAt = code.lastIndexOf(
      'finishRound(round.roundId, { status: "completed"',
    );
    const sendAt = code.lastIndexOf("void sendProgress(round);");
    expect(finishAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(finishAt);
  });

  it("never rejects, so there is no unhandled rejection behind the player", () => {
    const code = readCode(GS_PROGRESS);
    const bodyAt = code.indexOf("export async function sendProgress");
    expect(bodyAt).toBeGreaterThan(-1);
    const fn = code.slice(bodyAt);
    expect(fn.length).toBeGreaterThan(400);
    expect(fn).toMatch(/catch \(error\)/);
    expect(fn).not.toMatch(/throw /);
  });

  /*
    ONE SCORING FUNCTION. Reusing `scoreRound` is what makes the live line and the final line
    agree - a separate "progress breakdown" drifts the moment either changes, and a board
    saying five solved beside a result saying four is worse than a board saying nothing.
  */
  it("computes the figures with the same function the result uses", () => {
    const code = readCode(GS_PROGRESS);
    expect(code).toMatch(/scoreRound\(/);
    expect(code).not.toMatch(/boardsCompleted/);
  });

  it("sends no score, only the display figures", () => {
    const code = readCode(GS_PROGRESS);
    expect(code).toMatch(/signOutbound\(\{\s*\n\s*roundId[\s\S]{0,160}breakdown,\s*\n\s*\}\)/);
    expect(code).not.toMatch(/score:/);
  });
});
