import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_GM_LEADERBOARD_SORT,
  GM_LEADERBOARD_MAX_PAGE_SIZE,
  GM_LEADERBOARD_SORTS,
  JOIN_GM_REFUSAL_STATUS,
  joinGmRowState,
  parseGmLeaderboardPage,
  parseGmLeaderboardSort,
  rankGmMetrics,
  sortGmRows,
} from "@/lib/services/gamemaster/gm-leaderboard-rules";
import { decideAffiliation } from "@/lib/services/gamemaster/affiliation-rules";

/**
 * Gamemaster Program v2, step 4 (`External game plans/24` s6.1 / s6.3) - the pure rules
 * and the structural guards. The database and route behaviour is in
 * `gm-leaderboard-join.test.ts`.
 */

const ROOT = resolve(__dirname, "../..");
// Reason: these files explain their own anti-patterns in prose, so a test reading
// comments would flag a correct file for discussing the mistake.
const readCode = (rel: string) =>
  readFileSync(resolve(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const VIEWER = "64c000000000000000000001";
const GM_A = "64c0000000000000000000a1";
const GM_B = "64c0000000000000000000a2";
const live = (userId: string) => ({ userId, userName: `GM ${userId.slice(-2)}`, status: "active" });

describe("leaderboard sort and page parsing", () => {
  it("an absent sort is the default, an unknown or inherited name is refused", () => {
    expect(parseGmLeaderboardSort(null)).toBe(DEFAULT_GM_LEADERBOARD_SORT);
    expect(parseGmLeaderboardSort("")).toBe(DEFAULT_GM_LEADERBOARD_SORT);
    for (const s of GM_LEADERBOARD_SORTS) expect(parseGmLeaderboardSort(s)).toBe(s);
    expect(parseGmLeaderboardSort("totalEarnings")).toBeNull();
    // Reason: the query string is attacker-supplied; an object lookup admits this.
    expect(parseGmLeaderboardSort("constructor")).toBeNull();
  });

  it("pages are whole positive numbers and the size is capped", () => {
    expect(parseGmLeaderboardPage(null, null)).toEqual({ page: 1, pageSize: 20 });
    expect(parseGmLeaderboardPage("3", "50")).toEqual({ page: 3, pageSize: 50 });
    expect(parseGmLeaderboardPage("0", null)).toBeNull();
    expect(parseGmLeaderboardPage("1.5", null)).toBeNull();
    expect(parseGmLeaderboardPage("-1", null)).toBeNull();
    expect(parseGmLeaderboardPage(null, String(GM_LEADERBOARD_MAX_PAGE_SIZE + 1))).toBeNull();
    expect(parseGmLeaderboardPage(null, "0")).toBeNull();
  });
});

describe("row join state agrees with the one affiliation decision", () => {
  const cases = [
    { name: "own", input: { viewerUserId: GM_A, row: live(GM_A) }, want: "own" },
    { name: "joinable", input: { viewerUserId: VIEWER, row: live(GM_A) }, want: "joinable" },
    {
      name: "your_gm",
      input: { viewerUserId: VIEWER, row: live(GM_A), activeGameMasterId: GM_A, activeGameMaster: live(GM_A) },
      want: "your_gm",
    },
    {
      name: "locked",
      input: { viewerUserId: VIEWER, row: live(GM_B), activeGameMasterId: GM_A, activeGameMaster: live(GM_A) },
      want: "locked",
    },
    {
      name: "paused current GM locks",
      input: {
        viewerUserId: VIEWER,
        row: live(GM_B),
        activeGameMasterId: GM_A,
        activeGameMaster: { ...live(GM_A), isPaused: true },
      },
      want: "locked",
    },
    {
      name: "expired GM frees D4",
      input: {
        viewerUserId: VIEWER,
        row: live(GM_B),
        activeGameMasterId: GM_A,
        activeGameMaster: { ...live(GM_A), status: "expired" },
      },
      want: "joinable",
    },
    {
      name: "deleted GM frees D4",
      input: { viewerUserId: VIEWER, row: live(GM_B), activeGameMasterId: GM_A },
      want: "joinable",
    },
  ] as const;

  it.each(cases)("row state $name", ({ input, want }) => {
    expect(joinGmRowState(input)).toBe(want);
  });

  it("every row state matches what affiliate would decide on the same facts", () => {
    for (const { input, want } of cases) {
      const d = decideAffiliation({
        userId: input.viewerUserId,
        channel: "chartvolt_join_gm",
        gm: input.row,
        activeGameMasterId: "activeGameMasterId" in input ? input.activeGameMasterId : undefined,
        activeGameMaster: "activeGameMaster" in input ? input.activeGameMaster : undefined,
      });
      const server =
        d.kind === "create" ? "joinable" : d.kind === "already_affiliated" ? "your_gm" : d.code;
      expect({ want, server }).toEqual({
        want,
        server: want === "own" ? "self" : want === "locked" ? "already_affiliated_other" : want,
      });
    }
  });
});

describe("ranking and sorting", () => {
  const row = (name: string, activeAffiliates: number, affiliates: number, entryVolts = 0) => ({
    subscriptionId: name,
    gameMasterUserId: name,
    gameMasterName: name,
    activeAffiliates,
    affiliates,
    competitionsCreated: 0,
    competitionsCompleted: 0,
    participants: 0,
    entryVolts,
  });

  it("ranks by active affiliates then affiliates, and ties share a rank", () => {
    const ranked = rankGmMetrics([row("C", 1, 5), row("A", 3, 3), row("B", 3, 3), row("D", 1, 2)]);
    expect(ranked.map((r) => [r.gameMasterName, r.rank])).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("re-sorting changes the order and never the rank", () => {
    const ranked = rankGmMetrics([row("A", 3, 3, 10), row("B", 1, 1, 90)]);
    const byVolts = sortGmRows(ranked, "entryVolts");
    expect(byVolts.map((r) => [r.gameMasterName, r.rank])).toEqual([
      ["B", 2],
      ["A", 1],
    ]);
  });
});

describe("join refusal status map", () => {
  it("maps each refusal to its status and leaves unknown codes to 500", () => {
    expect(Object.fromEntries(JOIN_GM_REFUSAL_STATUS)).toEqual({
      invalid_input: 400,
      self: 400,
      terms_not_accepted: 400,
      gm_not_found: 404,
      user_not_found: 404,
      gm_not_joinable: 409,
      already_affiliated_other: 409,
      terms_outdated: 409,
      terms_unavailable: 503,
    });
    expect(JOIN_GM_REFUSAL_STATUS.get("error")).toBeUndefined();
    expect(JOIN_GM_REFUSAL_STATUS.get("constructor")).toBeUndefined();
  });
});

describe("step 4 structural guards", () => {
  it("the leaderboard rules module reaches no model R58", () => {
    // Reason: a bare side-effect `import "x"` has no `from`, and it pulls a model into the
    // client bundle just as surely, so both spellings are collected.
    const code = readCode("lib/services/gamemaster/gm-leaderboard-rules.ts");
    const imports = [...code.matchAll(/(?:from|import)\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["./affiliation-rules"]);
    const upstream = readCode("lib/services/gamemaster/affiliation-rules.ts");
    expect(upstream).not.toMatch(/database\/models|from\s+"mongoose"|from\s+"mongodb"/);
  });

  it("the join route counts the rate limit before it reads the body", () => {
    const route = readCode("app/api/gamemasters/[subscriptionId]/join/route.ts");
    const session = route.indexOf("auth.api.getSession(");
    const flag = route.indexOf("await isGmJoinEnabled()");
    const limit = route.indexOf("RateLimiters.gmJoin(session.user.id)");
    const body = route.indexOf("await request.json()");
    expect(session).toBeGreaterThan(-1);
    expect(flag).toBeGreaterThan(session);
    expect(limit).toBeGreaterThan(flag);
    expect(body).toBeGreaterThan(limit);
    expect(route).toMatch(/channel:\s*"chartvolt_join_gm"/);
  });

  it("the leaderboard route is closed while the switch is off", () => {
    const route = readCode("app/api/gamemasters/leaderboard/route.ts");
    const flag = route.indexOf("await isGmJoinEnabled()");
    const read = route.indexOf("getGmLeaderboardPage({");
    expect(flag).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(flag);
  });

  it("the admin switch route is section-granted on every handler with a Set allow-list", () => {
    const route = readCode("apps/admin/app/api/gamemasters/program-settings/route.ts");
    const handlers = route.match(/export async function (GET|PUT|POST|PATCH|DELETE)\b/g) ?? [];
    const guards = route.match(/guardSection\("gamemaster-management"\)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
    // Step 5 added the second switch; the claim is unchanged - a named Set of exactly these.
    expect(route).toMatch(
      /PROGRAM_SWITCHES: ReadonlySet<string> = new Set\(\[\s*"gmJoinEnabled",\s*"gmPrivateContestsEnabled",\s*\]\)/,
    );
    expect(route).toMatch(/if \(!PROGRAM_SWITCHES\.has\(key\)\)/);
    expect(route).not.toMatch(/\$set:\s*body/);
    expect(route).toMatch(/logSettingsUpdated\(/);
  });

  it("the player board is offered only when the switch is on", () => {
    const client = readCode("components/leaderboard/LeaderboardClient.tsx");
    expect(client).toMatch(/q === GM_BOARD && gmBoardEnabled/);
    expect(client).toMatch(/next === GM_BOARD && gmBoardEnabled/);
    expect(client).toMatch(/gmBoardEnabled \? \[\.\.\.boards/);
    const page = readCode("app/(root)/leaderboard/page.tsx");
    expect(page).toMatch(/await isGmJoinEnabled\(\)/);
    expect(page).toMatch(/gmBoardEnabled=/);
  });

  it("the board records consent against the Game Master user id and shows no earnings", () => {
    const board = readCode("components/leaderboard/GameMasterLeaderboard.tsx");
    expect(board).toMatch(/recordedContext=\{\{ gameMasterId: joining\.gameMasterUserId \}\}/);
    expect(board).toMatch(/ACTION_TERM_SLUGS\.GM_AFFILIATION/);
    expect(board).not.toMatch(/totalEarnings|pendingEarnings|userEmail/);
  });
});
