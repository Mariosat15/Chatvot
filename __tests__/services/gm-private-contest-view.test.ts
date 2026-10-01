import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * Gamemaster Program v2, step 6 (`External game plans/24` s4, s6.2): the direct-link gap.
 *
 * Step 5 hid a private contest from every list and refused it a seat, but somebody holding the
 * URL could still read the lobby, the arena, the live standings and the rankings. These tests
 * pin the one viewability rule, the "Join GM to enter" gate state, and every per-contest route
 * that now answers 404 - asserted as 404 specifically, because a 403 confirms the contest exists.
 */

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose,
  default: async () => mongoose,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));

const sessionUser: { current: { id: string; email: string; name?: string } | null } = {
  current: null,
};
vi.mock("@/lib/better-auth/auth", () => ({
  auth: {
    api: {
      getSession: async () => (sessionUser.current ? { user: sessionUser.current } : null),
    },
  },
}));

// Reason: the downstream readers are stubbed so each route test can tell "the guard refused"
// from "the downstream answered". Without the guard, rounds answers the stub's 403, standings and
// live-ranking answer 200 - so a 404 can only come from the check under test.
vi.mock("@/lib/services/games/round-status.service", () => ({
  getPlayState: async () => ({
    success: false,
    refusal: "not_a_participant",
    error: "You are not in this competition",
  }),
}));
const launchCalls: string[] = [];
vi.mock("@/lib/services/games/round-launch.service", () => ({
  launchContestRound: async (id: string) => {
    launchCalls.push(id);
    return { success: false, refusal: "not_a_participant", error: "Not in this competition" };
  },
}));
vi.mock("@/lib/services/games/arena-standings.service", () => ({
  getArenaStandings: async () => ({ rows: [] }),
}));
vi.mock("@/lib/caches/ranking-cache", () => ({
  getRankingFromCache: () => ({
    data: { allRankings: [{ userId: "someone", rank: 1, liveEquity: 1 }] },
  }),
  setRankingCache: () => {},
}));

import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import UserReferral from "@/database/models/user-referral.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  canViewContest,
  canViewContestById,
} from "@/lib/services/gamemaster/private-contest-access.service";
import { getPrivateContestGate } from "@/lib/services/gamemaster/private-contest-gate.service";

const { GET: roundsGet, POST: roundsPost } = await import(
  "@/app/api/competitions/[id]/rounds/route"
);
const { GET: standingsGet } = await import("@/app/api/competitions/[id]/standings/route");
const { GET: liveRankingGet } = await import("@/app/api/competitions/[id]/live-ranking/route");
const { GET: statusGet } = await import("@/app/api/competitions/[id]/status/route");

const OWNER_GM = "64d0000000000000000000a1";
const OTHER_GM = "64d0000000000000000000a2";
const PAUSED_GM = "64d0000000000000000000a3";
const PLAYER = "64d000000000000000000001";
const player = { id: PLAYER, email: "p@player.test", name: "Player" };
const db = () => mongoose.connection.db!;

function subscription(userId: string, referralCode: string, over: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    userId,
    userEmail: `${referralCode.toLowerCase()}@gm.test`,
    userName: `Master ${referralCode}`,
    packageId: "pkg",
    packageName: "Pro",
    status: "active",
    activatedAt: now,
    startDate: now,
    endDate: now,
    nextRenewalDate: now,
    autoRenew: true,
    renewalPrice: 10,
    referralCode,
    limits: { referralFeePercentage: 5, canCreateCompetitions: true },
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

async function seedContest(over: Record<string, unknown> = {}): Promise<string> {
  const id = new ObjectId();
  await Competition.collection.insertOne({
    _id: id,
    slug: `c-${id}`,
    name: "Private GM Competition",
    status: "upcoming",
    entryFee: 10,
    prizePool: 0,
    currentParticipants: 0,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    gameMasterId: OWNER_GM,
    visibility: "gm_private",
    ...over,
  });
  return String(id);
}

const affiliateTo = (gameMasterId: string) =>
  UserReferral.collection.insertOne({
    userId: PLAYER,
    gameMasterId,
    referralCode: "X",
    isActive: true,
    source: "gm_referral_link",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const seat = (competitionId: string) =>
  CompetitionParticipant.collection.insertOne({
    userId: PLAYER,
    competitionId,
    status: "active",
    enteredAt: new Date(),
  });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (id: string, path: string, method = "GET") =>
  new NextRequest(`http://x/api/competitions/${id}/${path}`, { method });

describe("private Game Master contest - who may view it (step 6)", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "whitelabels",
      Competition.collection.name,
      CompetitionParticipant.collection.name,
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    sessionUser.current = null;
    launchCalls.length = 0;
    await GameMasterSubscription.collection.insertMany([
      subscription(OWNER_GM, "OWNER"),
      subscription(OTHER_GM, "OTHER"),
      subscription(PAUSED_GM, "PAUSED", { isPaused: true }),
    ]);
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: player.email });
  });

  describe("canViewContest", () => {
    it("admits anybody to a public or unlabelled contest, signed in or not", async () => {
      expect(await canViewContest("x", { visibility: "public" }, null)).toBe(true);
      expect(await canViewContest("x", {}, undefined)).toBe(true);
    });

    it("refuses a signed-out viewer of a private contest", async () => {
      const id = await seedContest();
      expect(await canViewContest(id, { visibility: "gm_private", gameMasterId: OWNER_GM }, null)).toBe(false);
      expect(await canViewContest(id, { visibility: "gm_private", gameMasterId: OWNER_GM }, "  ")).toBe(false);
    });

    it("admits the creating Game Master, who is neither seated nor affiliated", async () => {
      const id = await seedContest();
      expect(await canViewContestById(id, OWNER_GM)).toBe(true);
    });

    it("admits a seated player after their Game Master changed (D5)", async () => {
      const id = await seedContest();
      await seat(id);
      await affiliateTo(OTHER_GM);
      expect(await canViewContestById(id, PLAYER)).toBe(true);
    });

    it("admits the Game Master's affiliate and refuses everybody else", async () => {
      const id = await seedContest();
      expect(await canViewContestById(id, PLAYER)).toBe(false);
      await affiliateTo(OTHER_GM);
      expect(await canViewContestById(id, PLAYER)).toBe(false);
      await UserReferral.collection.deleteMany({});
      await affiliateTo(OWNER_GM);
      expect(await canViewContestById(id, PLAYER)).toBe(true);
    });

    it("treats an unrecognised stored visibility as private", async () => {
      const id = await seedContest({ visibility: "friends_only" });
      expect(await canViewContestById(id, PLAYER)).toBe(false);
    });

    it("fails CLOSED when the seat lookup throws", async () => {
      const id = await seedContest();
      await affiliateTo(OWNER_GM);
      const spy = vi
        .spyOn(CompetitionParticipant, "exists")
        .mockRejectedValueOnce(new Error("database down"));
      expect(await canViewContestById(id, PLAYER)).toBe(false);
      spy.mockRestore();
    });

    // Reason: the route's own not-found handling must keep running unchanged - this check may
    // not turn a missing contest into something else.
    it("answers true for a contest that does not exist", async () => {
      expect(await canViewContestById(String(new ObjectId()), PLAYER)).toBe(true);
    });
  });

  describe("getPrivateContestGate - what replaces the entry button", () => {
    it("is unavailable for a Game Master with no subscription, or a paused one (D7)", async () => {
      sessionUser.current = player;
      await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
      expect((await getPrivateContestGate({ gameMasterId: "64d0000000000000000000ff", viewerUserId: PLAYER })).state).toBe("unavailable");
      expect((await getPrivateContestGate({ gameMasterId: PAUSED_GM, viewerUserId: PLAYER })).state).toBe("unavailable");
    });

    it("asks a signed-out viewer to sign in", async () => {
      await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
      expect((await getPrivateContestGate({ gameMasterId: OWNER_GM, viewerUserId: null })).state).toBe("signed_out");
    });

    it("says joining is off while the platform switch is off", async () => {
      expect((await getPrivateContestGate({ gameMasterId: OWNER_GM, viewerUserId: PLAYER })).state).toBe("join_disabled");
    });

    it("offers Join GM with the SUBSCRIPTION id for the URL and the USER id for the terms", async () => {
      await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
      const gate = await getPrivateContestGate({ gameMasterId: OWNER_GM, viewerUserId: PLAYER });
      const sub = await GameMasterSubscription.collection.findOne({ userId: OWNER_GM });
      expect(gate).toEqual({
        state: "joinable",
        gameMasterName: "Master OWNER",
        gameMasterUserId: OWNER_GM,
        subscriptionId: String(sub!._id),
      });
    });

    it("locks a player who already belongs to another Game Master (D1), naming them", async () => {
      await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
      await affiliateTo(OTHER_GM);
      const gate = await getPrivateContestGate({ gameMasterId: OWNER_GM, viewerUserId: PLAYER });
      expect(gate.state).toBe("locked");
      expect(gate.currentGameMasterName).toBe("Master OTHER");
      expect(gate.subscriptionId).toBeUndefined();
    });

    it("lets a player whose Game Master is gone join a new one (D4)", async () => {
      await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
      await affiliateTo("64d0000000000000000000ee");
      expect((await getPrivateContestGate({ gameMasterId: OWNER_GM, viewerUserId: PLAYER })).state).toBe("joinable");
    });
  });

  describe("per-contest routes answer 404, never 403, to an outsider", () => {
    it("rounds GET and POST refuse before the downstream is asked", async () => {
      const id = await seedContest();
      sessionUser.current = player;
      const get = await roundsGet(req(id, "rounds"), ctx(id));
      expect(get.status).toBe(404);
      const post = await roundsPost(req(id, "rounds", "POST"), ctx(id));
      expect(post.status).toBe(404);
      expect(launchCalls).toEqual([]);
    });

    it("rounds still reaches the downstream for a public contest", async () => {
      const id = await seedContest({ visibility: "public" });
      sessionUser.current = player;
      expect((await roundsGet(req(id, "rounds"), ctx(id))).status).toBe(403);
      expect((await roundsPost(req(id, "rounds", "POST"), ctx(id))).status).toBe(403);
      expect(launchCalls).toEqual([id]);
    });

    it("standings refuses an outsider and answers a seated player", async () => {
      const id = await seedContest();
      sessionUser.current = player;
      expect((await standingsGet(req(id, "standings"), ctx(id))).status).toBe(404);
      await seat(id);
      expect((await standingsGet(req(id, "standings"), ctx(id))).status).toBe(200);
    });

    // Reason: the cache is shared across callers, so the check must run BEFORE it - the stub
    // always has a cached ranking, so a check placed after the cache read returns 200 here.
    it("live-ranking refuses before the shared cache is read", async () => {
      const id = await seedContest();
      sessionUser.current = player;
      expect((await liveRankingGet(req(id, "live-ranking"), ctx(id))).status).toBe(404);
      const open = await seedContest({ visibility: "public" });
      expect((await liveRankingGet(req(open, "live-ranking"), ctx(open))).status).toBe(200);
    });

    it("status judges the signed-in caller, never the userId query parameter", async () => {
      const id = await seedContest();
      await affiliateTo(OWNER_GM);
      const spoofed = new NextRequest(`http://x/api/competitions/${id}/status?userId=${PLAYER}`);
      expect((await statusGet(spoofed, ctx(id))).status).toBe(404);
      sessionUser.current = player;
      expect((await statusGet(req(id, "status"), ctx(id))).status).toBe(200);
    });

    it("status keeps working without a session for a public contest", async () => {
      const id = await seedContest({ visibility: "public" });
      expect((await statusGet(req(id, "status"), ctx(id))).status).toBe(200);
    });

    // Reason: until 1 Oct 2026 a PUBLIC contest's final rank and prize were read for the
    // `userId` query parameter, so naming any player revealed their result. Both halves are
    // asserted: a named id with no session gets nothing, the session gets its own result.
    it("status reports the ranking of the signed-in caller only, never a named userId", async () => {
      const id = await seedContest({ visibility: "public", status: "completed" });
      await seat(id);
      await CompetitionParticipant.collection.updateOne(
        { competitionId: id, userId: PLAYER },
        { $set: { finalRank: 2, prizeWon: 7 } },
      );
      const spoofed = new NextRequest(`http://x/api/competitions/${id}/status?userId=${PLAYER}`);
      const anonymous = await (await statusGet(spoofed, ctx(id))).json();
      expect(anonymous.userRank).toBeUndefined();
      expect(anonymous.prizeWon).toBeUndefined();
      sessionUser.current = player;
      const own = await (await statusGet(req(id, "status"), ctx(id))).json();
      expect(own.userRank).toBe(2);
      expect(own.prizeWon).toBe(7);
    });
  });
});

/** Comment-stripped source, so a guard named only in prose cannot satisfy an assertion. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the pages consult the rule before rendering anything private", () => {
  // Reason: the leaderboard is FETCHED in the page's parallel read, before the contest is known
  // to be private - harmless, since the data never leaves the server. What must not happen is
  // any USE of it before the gate returns, so every mention after the destructure is asserted
  // to sit after the gate.
  it("the lobby returns the gate before it uses the leaderboard", () => {
    const src = code("app/(root)/competitions/[id]/page.tsx");
    const guard = src.indexOf("await canViewContest(id, competition, userId");
    const gate = src.indexOf("<PrivateContestGate");
    const destructure = src.indexOf("const [competition, leaderboard,");
    expect(guard).toBeGreaterThan(destructure);
    expect(destructure).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(guard);
    const uses = [...src.matchAll(/\bleaderboard\b/g)]
      .map((m) => m.index ?? -1)
      .filter((i) => i > destructure + "const [competition, ".length);
    expect(uses.length).toBeGreaterThan(0);
    for (const i of uses) expect(i).toBeGreaterThan(gate);
    // Reason: `isUserInCompetition` answers false on an error, so passing that false through
    // as "not seated" would hide a paid seat's own contest (D5); only a true may be trusted.
    expect(src).toMatch(/isSeated:\s*isUserIn\s*\|\|\s*undefined/);
  });

  it("the play and results screens redirect an outsider to the lobby gate", () => {
    const play = code("app/(root)/competitions/[id]/play/page.tsx");
    expect(play).toMatch(
      /if\s*\(!\(await canViewContestById\(competitionId,\s*session\.user\.id\)\)\)\s*\{?\s*redirect\(/,
    );
    const results = code("app/(root)/competitions/[id]/results/page.tsx");
    expect(results).toMatch(
      /if\s*\(!\(await canViewContest\(competitionId,\s*competition,\s*session\.user\.id\)\)\)\s*\{?\s*redirect\(/,
    );
  });

  it("the uncalled, unauthenticated participant-status route stays deleted", () => {
    expect(() => readFileSync("app/api/competitions/[id]/participant-status/route.ts")).toThrow();
  });

  // R58: a client component may name a service only in a type position.
  it("the gate component imports services as types only", () => {
    const src = code("components/gamemaster/PrivateContestGate.tsx");
    const serviceImports = src.match(/^import[^;]*from\s+["']@\/lib\/services\/[^"']+["']/gm) ?? [];
    expect(serviceImports.length).toBeGreaterThan(0);
    for (const line of serviceImports) expect(line).toMatch(/^import type /);
  });
});
