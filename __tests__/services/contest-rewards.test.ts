import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  R94 - ONE reward stage for every contest that finishes.

  The defect was a DIVERGENCE, not a wrong number, which is why almost every guard here is
  behavioural rather than arithmetic: there was no incorrect figure to assert on, only six
  finalize paths that disagreed about whether a finish is worth anything at all.

    | path                        | activity XP | badges |
    | main competition finalizer  | yes         | yes    |
    | admin competition finalizer | NO          | yes    |
    | main challenge finalizer    | yes         | yes    |
    | admin challenge finalizer   | NO          | NO     |
    | provider competition        | NO          | NO     |
    | provider challenge          | NO          | NO     |

  Both apps register `checkAndFinalizeCompetitions` on an every-minute cron, so rows 1-2 and
  3-4 made a trading player's XP depend on which app's cron claimed the contest first - live,
  and already happened, with no flag, no error and no log line on either branch. Rows 5-6 are
  latent only because no provider contest has settled in production, and their harm is worse
  in kind: a player who only plays games earned nothing, for ever.
*/

const root = join(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

/** Match the source with comments removed, so a file that DISCUSSES a pattern is not read as using it. */
function readCode(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const MAIN = "lib/services/settlement/contest-rewards.ts";
const ADMIN = "apps/admin/lib/services/settlement/contest-rewards.ts";

const xpCalls: { userId: string; event: string; gameKey?: string }[] = [];
const badgeCalls: string[] = [];

vi.mock("@/lib/services/xp-level.service", () => ({
  awardActivityXP: vi.fn(async (userId: string, event: string, gameKey?: string) => {
    xpCalls.push({ userId, event, gameKey });
    return { success: true };
  }),
}));

vi.mock("@/lib/services/badge-evaluation.service", () => ({
  evaluateUserBadges: vi.fn(async (userId: string) => {
    badgeCalls.push(userId);
    return { newBadges: [] };
  }),
}));

const statsCalls: {
  userId: string;
  gameKey: string;
  rank?: number;
  fieldSize: number;
  entryFee: number;
}[] = [];

vi.mock("@/lib/services/games/user-game-stats.service", () => ({
  recordContestFinish: vi.fn(async (record: {
    userId: string;
    gameKey: string;
    rank?: number;
    fieldSize: number;
    entryFee: number;
  }) => {
    statsCalls.push(record);
    return { points: 0, ratingDelta: 0 };
  }),
}));

const { awardContestRewards } = await import(
  "@/lib/services/settlement/contest-rewards"
);

/**
 * The awards are fire-and-forget by design - the money has already committed, so a badge
 * service that is slow must not hold a settlement open. That means the assertions have to
 * wait for the microtask queue to drain rather than for the function's own promise.
 */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  xpCalls.length = 0;
  badgeCalls.length = 0;
  statsCalls.length = 0;
});

describe("awardContestRewards - what a finish is worth", () => {
  it("awards completion XP to every player, placed or not", async () => {
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      gameKey: "trading",
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u2", rank: 2 },
        { userId: "u3", rank: 3 },
        { userId: "u4", rank: 9 },
        { userId: "u5" },
      ],
    });
    await settle();

    const completions = xpCalls.filter((c) => c.event === "competition_completed");
    expect(completions.map((c) => c.userId).sort()).toEqual([
      "u1",
      "u2",
      "u3",
      "u4",
      "u5",
    ]);
  });

  it("awards a podium bonus to the top three only", async () => {
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u2", rank: 2 },
        { userId: "u3", rank: 3 },
        { userId: "u4", rank: 4 },
      ],
    });
    await settle();

    expect(xpCalls.filter((c) => c.event === "competition_podium_1")).toHaveLength(1);
    expect(xpCalls.filter((c) => c.event === "competition_podium_2")).toHaveLength(1);
    expect(xpCalls.filter((c) => c.event === "competition_podium_3")).toHaveLength(1);
    // A fourth place is a completion, not a placing.
    expect(xpCalls.filter((c) => c.userId === "u4" && c.event !== "competition_completed"))
      .toHaveLength(0);
  });

  it("gives an UNRANKED player completion XP and no bonus", async () => {
    // Reason: absent is a real state, not a missing value - a player excluded by the
    // eligibility gate (R45) or refunded for never scoring (R50) is not in the ranking, and
    // defaulting their absent rank to a number is how a non-scorer is paid a first place.
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [{ userId: "u1" }],
    });
    await settle();

    expect(xpCalls).toHaveLength(1);
    expect(xpCalls[0].event).toBe("competition_completed");
  });

  it("evaluates badges for every player exactly once, placed or not", async () => {
    // Reason: the UNPLACED player is the load-bearing half. Evaluating badges only for
    // those who placed is how a player who enters steadily and never makes a podium earns
    // nothing for ever - with nothing thrown and nothing logged - and it is the reading
    // that would make a games-only player's badge shelf permanently empty.
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u2", rank: 2 },
        { userId: "u3" },
      ],
    });
    await settle();

    expect(badgeCalls.sort()).toEqual(["u1", "u2", "u3"]);
  });
});

describe("awardContestRewards - a challenge is not a competition", () => {
  it("pays the winner bonus, never a podium", async () => {
    await awardContestRewards({
      kind: "challenge",
      contestId: "ch1",
      participants: [{ userId: "u1", rank: 1 }, { userId: "u2" }],
    });
    await settle();

    expect(xpCalls.filter((c) => c.event === "challenge_won")).toHaveLength(1);
    expect(xpCalls.filter((c) => c.event === "challenge_completed")).toHaveLength(2);
    expect(xpCalls.some((c) => c.event.startsWith("competition_"))).toBe(false);
  });

  it("pays NO bonus on a tie, because a tie leaves both players unranked", async () => {
    await awardContestRewards({
      kind: "challenge",
      contestId: "ch1",
      participants: [{ userId: "u1" }, { userId: "u2" }],
    });
    await settle();

    expect(xpCalls.filter((c) => c.event === "challenge_won")).toHaveLength(0);
    expect(xpCalls.filter((c) => c.event === "challenge_completed")).toHaveLength(2);
  });
});

describe("awardContestRewards - the game label", () => {
  // Reason: BOTH kinds, because there are three award lines and a label can be dropped on
  // any one of them. Run as a competition alone this covers the completion and podium lines
  // and leaves the challenge-won line unreachable - proven by a probe that dropped the label
  // there and stayed green. The length assertion is the other half: `.every` on an empty
  // array is true, so a fixture that awarded nothing would pass this vacuously.
  it.each([
    ["competition", 2] as const,
    ["challenge", 2] as const,
  ])("carries the contest's gameKey onto every XP award (%s)", async (kind, expected) => {
    await awardContestRewards({
      kind,
      contestId: "c1",
      gameKey: "provider:chartvolt-games:circuit-sprint",
      participants: [{ userId: "u1", rank: 1 }],
    });
    await settle();

    expect(xpCalls.length).toBe(expected);
    expect(
      xpCalls.every((c) => c.gameKey === "provider:chartvolt-games:circuit-sprint"),
    ).toBe(true);
  });

  it("resolves an ABSENT gameKey to trading, matching invariant 5", async () => {
    // Reason: an unlabelled contest predates X1 and is a trading one. Leaving the label
    // absent instead would put every pre-X1 finish in a per-game rollup keyed on nothing.
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [{ userId: "u1", rank: 1 }],
    });
    await settle();

    expect(xpCalls.every((c) => c.gameKey === "trading")).toBe(true);
  });

  it("reads no trading figure at all, so nothing here learns about the next game", () => {
    const code = readCode(MAIN);
    for (const tradingOnly of [
      "pnl",
      "totalTrades",
      "winRate",
      "currentCapital",
      "startingCapital",
    ]) {
      expect(code).not.toContain(tradingOnly);
    }
  });
});

describe("awardContestRewards - the properties the old copies broke", () => {
  it("awards a duplicated player once, keeping the BEST rank", async () => {
    // Reason: the competition path can legitimately hand over a participant list and a
    // leaderboard that overlap. A plain Map would let the unranked duplicate erase the
    // podium place depending purely on iteration order.
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u1" },
        { userId: "u1", rank: 5 },
      ],
    });
    await settle();

    expect(xpCalls.filter((c) => c.event === "competition_completed")).toHaveLength(1);
    expect(xpCalls.filter((c) => c.event === "competition_podium_1")).toHaveLength(1);
    expect(badgeCalls).toEqual(["u1"]);
  });

  it("keeps the best rank whichever order the duplicates arrive in", async () => {
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [{ userId: "u1" }, { userId: "u1", rank: 2 }],
    });
    await settle();

    expect(xpCalls.filter((c) => c.event === "competition_podium_2")).toHaveLength(1);
  });

  it("does nothing, and reports nothing, for an empty contest", async () => {
    const result = await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [],
    });
    await settle();

    expect(result).toEqual({ playersRewarded: 0, podiumAwards: 0 });
    expect(xpCalls).toHaveLength(0);
    expect(badgeCalls).toHaveLength(0);
    expect(statsCalls).toHaveLength(0);
  });

  it("skips a row with no userId rather than awarding a blank player", async () => {
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [{ userId: "" }, { userId: "u1", rank: 1 }],
    });
    await settle();

    expect(badgeCalls).toEqual(["u1"]);
  });

  it("records UserGameStats for every distinct player with field size and fee", async () => {
    // X7 step 1: the shared stage is the ONE writer. A finish that awards XP but
    // skips the stats upsert is how the leaderboard stays empty while badges light up.
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      gameKey: "provider:x:y",
      fieldSize: 12,
      entryFee: 75,
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u2", rank: 2 },
        { userId: "u3" },
      ],
    });
    await settle();

    expect(statsCalls).toHaveLength(3);
    expect(statsCalls.map((c) => c.userId).sort()).toEqual(["u1", "u2", "u3"]);
    for (const call of statsCalls) {
      expect(call.gameKey).toBe("provider:x:y");
      expect(call.fieldSize).toBe(12);
      expect(call.entryFee).toBe(75);
    }
  });

  it("defaults fieldSize to the player count and entryFee to 0 when omitted", async () => {
    await awardContestRewards({
      kind: "competition",
      contestId: "c1",
      participants: [
        { userId: "u1", rank: 1 },
        { userId: "u2", rank: 2 },
      ],
    });
    await settle();

    expect(statsCalls).toHaveLength(2);
    expect(statsCalls[0].fieldSize).toBe(2);
    expect(statsCalls[0].entryFee).toBe(0);
  });

  it("NEVER throws into its caller - the prizes are already paid", () => {
    // Reason: every call site runs after the money transaction has committed, so a reward
    // failure that propagated would produce a refusal the caller reports as a failed
    // settlement, and an operator would finalize a paid contest a second time. Asserted
    // structurally because the awards are fire-and-forget, so no rejection reaches here.
    const code = readCode(MAIN);
    expect(code).toMatch(/catch\s*\(error\)/);
    expect(code).toMatch(/console\.error/);
    expect(code).toMatch(/\.catch\(\(\)\s*=>\s*\{\}\)/);

    // The handler EXISTING is not the property - a handler that logs and rethrows reads as
    // careful and does exactly the harm the stage is scoped to avoid. Sliced from the catch
    // rather than matched file-wide, with a length assertion, because a slice that found
    // nothing passes everything asked of it.
    const handler = code.slice(code.indexOf("catch (error)"));
    expect(handler.length).toBeGreaterThan(80);
    expect(handler).not.toMatch(/\bthrow\b/);
  });
});

describe("the six finalize paths all call it", () => {
  const CALL_SITES = [
    "lib/actions/trading/competition-end.actions.ts",
    "apps/admin/lib/actions/trading/competition-end.actions.ts",
    "lib/actions/trading/challenge-finalize.actions.ts",
    "apps/admin/lib/actions/trading/challenge-finalize.actions.ts",
    "lib/services/settlement/provider-finalize.ts",
    "lib/services/settlement/provider-challenge-finalize.ts",
  ];

  it.each(CALL_SITES)("%s awards through the shared stage", (relative) => {
    const code = readCode(relative);
    expect(code).toMatch(/awardContestRewards\(\{/);
  });

  it.each(CALL_SITES)(
    "%s no longer awards XP or badges of its own",
    (relative) => {
      // THE LOAD-BEARING HALF. Importing the shared stage is trivially satisfied by a
      // finalizer that also keeps its old inline copy, which would award every player
      // twice - so the guard is the ABSENCE of the direct calls, not the presence of the
      // shared one. Matching the CALL with its open bracket rather than the bare
      // identifier, because the name legitimately survives in a comment explaining R94.
      const code = readCode(relative);
      expect(code).not.toMatch(/awardActivityXP\(/);
      expect(code).not.toMatch(/evaluateUserBadges\(/);
    },
  );

  it("asks for the right KIND at each site, so a challenge cannot pay a podium", () => {
    for (const relative of CALL_SITES) {
      const code = readCode(relative);
      const expected = relative.includes("challenge")
        ? 'kind: "challenge"'
        : 'kind: "competition"';
      expect(code).toContain(expected);
    }
  });

  it("passes the contest's own gameKey, never a literal", () => {
    // Reason: a hard-coded "trading" here is how every provider finish lands in the
    // trading rollup while every figure still adds up.
    for (const relative of CALL_SITES) {
      const code = readCode(relative);
      const call = code.slice(code.indexOf("awardContestRewards({"));
      expect(call.length).toBeGreaterThan(50);
      expect(call).toMatch(/gameKey:\s*(competition|challenge|stored)/);
    }
  });

  it("passes fieldSize and entryFee so points are not computed from defaults forever", () => {
    // Reason: omitting both silently awards every finish as a free 2-player contest
    // (or however many seats were handed over). Presence of the keys is the property;
    // the values come from the contest document.
    for (const relative of CALL_SITES) {
      const code = readCode(relative);
      const call = code.slice(code.indexOf("awardContestRewards({"));
      expect(call).toMatch(/fieldSize:/);
      expect(call).toMatch(/entryFee:/);
    }
  });
});

describe("the two copies", () => {
  it("is byte-identical in both apps", () => {
    // `check:mirrors` compares MODELS, so it has no opinion about this file. Two copies
    // that disagree about what a finish is worth would reinstate R94 one layer down.
    expect(read(ADMIN)).toBe(read(MAIN));
  });
});
