import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Reason: the gate states themselves are pinned by gm-private-listing.test.ts. This suite owns
// only what the game page does with them, so the annotation is fixed: every private contest
// reads `joinable` for anybody, which isolates the seat override from membership resolution.
vi.mock("@/lib/services/gamemaster/private-contest-listing.service", () => ({
  annotatePrivateContests: async (
    contests: Array<{ visibility?: string }>,
  ) =>
    contests.map((c) =>
      c.visibility === "gm_private"
        ? { ...c, privateAccess: "joinable", privateGameMasterName: "Ace GM" }
        : c,
    ),
}));

/**
 * Task 2 (1 Oct 2026) — the private badge on the game page's competition list.
 *
 * Pins: a private contest carries its access state to the game page; a seated player reads as a
 * member (D5) and the seat is the viewer's own; "Play now" never one-clicks into a contest the
 * player cannot enter; the card and the admin list both render the badge.
 */

const Competition = (
  await import("@/database/models/trading/competition.model")
).default;
const { WhiteLabel } = await import("@/database/models/whitelabel.model");
const { listContestsForGame } = await import(
  "@/lib/services/games/player-catalogue.service"
);
const { resolvePlayNowHref } = await import(
  "@/lib/services/games/game-page-helpers"
);
const { TRADING_GAME_TYPE } = await import("@/lib/games");

const COLLECTIONS = ["whitelabels", "competitions", "competitionparticipants"];
const VIEWER = new mongoose.Types.ObjectId().toString();
const OTHER = new mongoose.Types.ObjectId().toString();
const GM = new mongoose.Types.ObjectId().toString();

function contest(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 60_000);
  return {
    name: "Contest",
    slug: `c-${Math.random().toString(36).slice(2, 10)}`,
    description: "fixture",
    createdBy: new mongoose.Types.ObjectId().toString(),
    status: "upcoming",
    competitionType: "time_based",
    entryFee: 50,
    prizePool: 100,
    platformFeePercentage: 10,
    currentParticipants: 0,
    maxParticipants: 20,
    minParticipants: 2,
    startTime: start,
    endTime: new Date(Date.now() + 3_600_000),
    registrationDeadline: start,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    startingCapital: 10_000,
    gameType: "trading",
    gameKey: TRADING_GAME_TYPE,
    ...overrides,
  };
}

async function seat(userId: string, competitionId: string): Promise<void> {
  // Reason: raw insert - the lookup reads two fields, and a seat fixture satisfying the whole
  // participant schema would bury the one fact under test. competitionId is stored as a String.
  await mongoose.connection
    .collection("competitionparticipants")
    .insertOne({ userId, competitionId });
}

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections(COLLECTIONS);
}, 60_000);
afterAll(async () => stopTestMongo());
beforeEach(async () => {
  await clearTestMongo();
  await WhiteLabel.create({ enabledGameTypes: ["trading"] });
});

describe("listContestsForGame private labels", () => {
  it("carries the private access state and Game Master name; public contests carry none", async () => {
    await Competition.create(contest({ name: "Open Cup" }));
    await Competition.create(
      contest({ name: "Members Cup", visibility: "gm_private", gameMasterId: GM }),
    );

    const rows = await listContestsForGame(TRADING_GAME_TYPE, { userId: VIEWER });
    const open = rows.find((r) => r.name === "Open Cup");
    const priv = rows.find((r) => r.name === "Members Cup");
    expect(open && "privateAccess" in open).toBe(false);
    expect(priv?.privateAccess).toBe("joinable");
    expect(priv?.privateGameMasterName).toBe("Ace GM");
  });

  it("reads a seated player as a member (D5)", async () => {
    const doc = await Competition.create(
      contest({ name: "Members Cup", visibility: "gm_private", gameMasterId: GM }),
    );
    await seat(VIEWER, doc._id.toString());

    const rows = await listContestsForGame(TRADING_GAME_TYPE, { userId: VIEWER });
    expect(rows[0].privateAccess).toBe("member");
  });

  it("counts only the viewer's own seat", async () => {
    const doc = await Competition.create(
      contest({ name: "Members Cup", visibility: "gm_private", gameMasterId: GM }),
    );
    await seat(OTHER, doc._id.toString());

    const rows = await listContestsForGame(TRADING_GAME_TYPE, { userId: VIEWER });
    expect(rows[0].privateAccess).toBe("joinable");
  });
});

describe("resolvePlayNowHref and private contests", () => {
  const game = {
    slug: "trading",
    formats: { competition: true, challenge: false, practice: true },
  };
  const row = (
    id: string,
    status: "upcoming" | "active",
    privateAccess?: string,
  ) => ({
    id,
    name: id,
    status,
    entryFee: 10,
    prizePool: 100,
    currentParticipants: 1,
    maxParticipants: 10,
    startTime: "",
    endTime: "",
    ...(privateAccess ? { privateAccess } : {}),
  });

  it("skips a live private contest the player cannot enter", () => {
    expect(
      resolvePlayNowHref(game, [row("locked1", "active", "joinable"), row("up1", "upcoming")]),
    ).toBe("/competitions/up1");
  });

  it("still targets a private contest the player is a member of", () => {
    expect(resolvePlayNowHref(game, [row("mine", "active", "member")])).toBe(
      "/competitions/mine",
    );
  });
});

describe("private badge rendering (structural)", () => {
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("the game page card renders the badge and gates the action on membership", () => {
    const src = read("components/game-page/GamePageContests.tsx");
    expect(src).toMatch(/<PrivateContestBadge access=\{c\.privateAccess\}/);
    expect(src).toMatch(
      /c\.privateAccess && c\.privateAccess !== "member" \?[\s\S]*?<PrivateContestCardAction/,
    );
  });

  it("the admin competitions list renders Private through the resolver", () => {
    const src = read("apps/admin/components/admin/CompetitionsListSection.tsx");
    expect(src).toMatch(
      /resolveCompetitionVisibility\(competition\.visibility\) === "gm_private" &&[\s\S]{0,300}Private/,
    );
    expect(src).not.toMatch(/visibility === "gm_private"/);
  });
});
