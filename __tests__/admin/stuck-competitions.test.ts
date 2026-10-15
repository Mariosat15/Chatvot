import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * The admin "Find stuck competitions" button (15 Oct 2026). It may offer a cancel-and-refund
 * ONLY when every seat's real payment, read from the ledger, matches what the refund would
 * pay - because `cancelCompetitionAndRefund` refunds the CURRENT entry fee and silently skips
 * a player with no wallet.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const { assessStuckCompetition, findStuckCompetitions, STUCK_GRACE_MS } = await import(
  "../../apps/admin/lib/services/competitions/stuck-competitions.service"
);

const FEE = 10;
const HOUR = 60 * 60 * 1000;
const db = () => mongoose.connection.db!;

async function seed(opts: {
  players: string[];
  status?: string;
  startOffsetMs?: number;
  min?: number;
  paid?: number;
  wallets?: boolean;
}) {
  const id = new mongoose.Types.ObjectId();
  const paid = opts.paid ?? FEE;
  await db().collection("competitions").insertOne({
    _id: id,
    name: `Contest ${opts.players.length}`,
    slug: `contest-${id.toString()}`,
    status: opts.status ?? "upcoming",
    entryFee: FEE,
    prizePool: opts.players.length * paid,
    currentParticipants: opts.players.length,
    participants: opts.players,
    minParticipants: opts.min ?? 2,
    startTime: new Date(Date.now() + (opts.startOffsetMs ?? -HOUR)),
    endTime: new Date(Date.now() + 2 * 24 * HOUR),
  });
  for (const userId of opts.players) {
    await db().collection("competitionparticipants").insertOne({
      competitionId: id.toString(),
      userId,
      username: `u-${userId.slice(-2)}`,
      status: "active",
    });
    await db().collection("wallettransactions").insertOne({
      userId,
      competitionId: id.toString(),
      transactionType: "competition_entry",
      amount: -paid,
      status: "completed",
    });
    if (opts.wallets !== false) {
      await db().collection("creditwallets").insertOne({ userId, creditBalance: 100 - paid });
    }
  }
  return id.toString();
}

describe("stuck competition finder", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "creditwallets",
      "wallettransactions",
    ]);
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });
  afterEach(async () => {
    await clearTestMongo();
  });

  it("lists an under-filled contest past its start, with who gets what", async () => {
    const id = await seed({ players: ["6500000000000000000000e1"] });
    const found = await assessStuckCompetition(id);
    expect(found?.reason).toBe("under_minimum_past_start");
    expect(found?.refundable).toBe(true);
    expect(found?.seats).toEqual([
      expect.objectContaining({
        userId: "6500000000000000000000e1",
        paid: FEE,
        refundToPlayer: FEE,
        refundToGameMaster: 0,
        alreadyRefunded: false,
      }),
    ]);
    expect(found?.totalToPlayers).toBe(FEE);
    expect((await findStuckCompetitions()).map((c) => c.id)).toEqual([id]);
  });

  it("does not list a full contest, or one still inside the grace period", async () => {
    await seed({ players: ["6500000000000000000000e2", "6500000000000000000000e3"] });
    await seed({ players: ["6500000000000000000000e4"], startOffsetMs: -(STUCK_GRACE_MS / 2) });
    expect(await findStuckCompetitions()).toEqual([]);
  });

  it("refuses when the ledger shows a different payment than the refund would pay", async () => {
    const id = await seed({ players: ["6500000000000000000000e5"], paid: 7 });
    const found = await assessStuckCompetition(id);
    expect(found?.refundable).toBe(false);
    expect(found?.seats[0].issue).toMatch(/7 paid, but the refund would pay 10/);
  });

  it("refuses when a player has no wallet, because the refund would skip them silently", async () => {
    const id = await seed({ players: ["6500000000000000000000e6"], wallets: false });
    const found = await assessStuckCompetition(id);
    expect(found?.refundable).toBe(false);
    expect(found?.seats[0].issue).toMatch(/no wallet/);
  });

  it("refuses when a prize was already recorded", async () => {
    const id = await seed({ players: ["6500000000000000000000e7"] });
    await db().collection("wallettransactions").insertOne({
      userId: "6500000000000000000000e7",
      competitionId: id,
      transactionType: "competition_win",
      amount: 5,
    });
    const found = await assessStuckCompetition(id);
    expect(found?.refundable).toBe(false);
    expect(found?.issues.join(" ")).toMatch(/prize has already been recorded/);
  });

  it("lists a cancelled contest whose seat was never refunded, and drops it once refunded", async () => {
    const id = await seed({ players: ["6500000000000000000000e8"], status: "cancelled" });
    expect((await assessStuckCompetition(id))?.reason).toBe("cancelled_unrefunded");
    expect((await findStuckCompetitions()).map((c) => c.id)).toEqual([id]);

    await db().collection("wallettransactions").insertOne({
      userId: "6500000000000000000000e8",
      competitionId: id,
      transactionType: "competition_refund",
      amount: FEE,
    });
    expect(await assessStuckCompetition(id)).toBeNull();
  });

  it("ignores active and completed contests entirely", async () => {
    const a = await seed({ players: ["6500000000000000000000e9"], status: "active" });
    const c = await seed({ players: ["6500000000000000000000ea"], status: "completed" });
    expect(await assessStuckCompetition(a)).toBeNull();
    expect(await assessStuckCompetition(c)).toBeNull();
  });
});

describe("stuck competition route and panel guards", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const route = strip(
    readFileSync(pathResolve("apps/admin/app/api/competitions/stuck/route.ts"), "utf8"),
  );
  const panel = strip(
    readFileSync(
      pathResolve("apps/admin/components/admin/competitions/StuckCompetitionsPanel.tsx"),
      "utf8",
    ),
  );

  it("guards every handler with the competitions section", () => {
    const handlers = route.match(/export async function (GET|POST)\(/g) ?? [];
    const guards = route.match(/guardSection\("competitions"\)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
  });

  it("re-assesses every contest on the server before cancelling it", () => {
    const assess = route.indexOf("assessStuckCompetition(");
    const cancel = route.indexOf("cancelCompetitionAndRefund(");
    expect(assess).toBeGreaterThan(-1);
    expect(cancel).toBeGreaterThan(assess);
    expect(route).toMatch(/!before\.refundable|before\.refundable\s*===\s*false/);
    expect(route).toMatch(/confirm\s*!==\s*true/);
  });

  it("audits each cancellation", () => {
    expect(route).toMatch(/auditLogService\.log\(/);
    expect(route).toContain("stuck_competition_sweep");
  });

  it("is a client component that only imports the service's types", () => {
    expect(panel).toMatch(/^\s*["']use client["']/);
    expect(panel).toMatch(/import type \{[^}]*StuckCompetition[^}]*\} from/);
    expect(panel).not.toMatch(/^import \{[^}]*\} from ["'][^"']*stuck-competitions\.service/m);
    expect(panel).toContain("DIALOG_WIDTH_WIDE");
  });

  it("is mounted on the Competitions list", () => {
    const list = readFileSync(
      pathResolve("apps/admin/components/admin/CompetitionsListSection.tsx"),
      "utf8",
    );
    expect(list).toContain("<StuckCompetitionsPanel onDone={fetchCompetitions} />");
  });
});
