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
 * The start-or-cancel step must not depend on Inngest (15 Oct 2026): a 1/50 trading contest
 * sat at "upcoming" an hour past its start, unrefunded and unjoinable, because the only
 * thing that cancelled undersubscribed contests was the Inngest cron. The step is now one
 * shared service called by both the Inngest cron and the Agenda worker.
 */

// Reason: revalidatePath throws outside a Next request, which is exactly the worker's case.
// Throwing here proves the worker path never calls it.
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    throw new Error("revalidatePath called outside a request");
  },
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const started: string[] = [];
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionCancelled: async () => {},
    notifyCompetitionStarted: async (userId: string) => {
      started.push(userId);
    },
  },
}));

const { startOrCancelDueCompetitions } = await import(
  "@/lib/services/competition-start.service"
);
// Reason: the service imports the refund action lazily, so its models must be registered
// before ensureCollections() builds their indexes - otherwise the first refund transaction
// fails with "catalog changes".
await import("@/lib/actions/trading/competition-cancel.actions");

const ENTRY_FEE = 10;
const START_BALANCE = 100;

async function seedDue(players: string[], startOffsetMs = -60 * 60 * 1000) {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db!;
  await db.collection("competitions").insertOne({
    _id: id,
    name: `Due ${players.length}`,
    status: "upcoming",
    entryFee: ENTRY_FEE,
    prizePool: players.length * ENTRY_FEE,
    currentParticipants: players.length,
    participants: players,
    minParticipants: 2,
    maxParticipants: 50,
    startingCapital: 10_000,
    startTime: new Date(Date.now() + startOffsetMs),
    endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  });
  if (players.length) {
    await db.collection("competitionparticipants").insertMany(
      players.map((userId) => ({
        competitionId: id.toString(),
        userId,
        status: "active",
        currentBalance: 10_000,
        joinedAt: new Date(),
      })),
    );
    await db.collection("creditwallets").insertMany(
      players.map((userId) => ({
        userId,
        creditBalance: START_BALANCE - ENTRY_FEE,
        totalSpentOnCompetitions: ENTRY_FEE,
        totalRefunded: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }
  return id;
}

async function statusOf(id: mongoose.Types.ObjectId) {
  const c = await mongoose.connection.db!.collection("competitions").findOne({ _id: id });
  return c?.status;
}

describe("startOrCancelDueCompetitions", () => {
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
    started.length = 0;
    await clearTestMongo();
  });

  it("cancels a contest below its minimum and refunds the entry fee, with no Next request", async () => {
    const lonely = "6500000000000000000000d1";
    const id = await seedDue([lonely]);

    const result = await startOrCancelDueCompetitions({ revalidate: false });

    expect(result).toEqual({ started: 0, cancelled: 1, failed: [] });
    expect(await statusOf(id)).toBe("cancelled");
    const wallet = await mongoose.connection.db!
      .collection("creditwallets")
      .findOne({ userId: lonely });
    expect(wallet?.creditBalance).toBe(START_BALANCE);
  });

  it("starts a contest that met its minimum, exactly once across two schedulers", async () => {
    const players = ["6500000000000000000000d2", "6500000000000000000000d3"];
    const id = await seedDue(players);

    const [a, b] = await Promise.all([
      startOrCancelDueCompetitions({ revalidate: false }),
      startOrCancelDueCompetitions({ revalidate: false }),
    ]);

    expect(await statusOf(id)).toBe("active");
    expect(a.started + b.started).toBe(1);
    expect(started.sort()).toEqual([...players].sort());
  });

  it("leaves a contest whose start is still in the future alone", async () => {
    const id = await seedDue(["6500000000000000000000d4"], 60 * 60 * 1000);
    const result = await startOrCancelDueCompetitions({ revalidate: false });
    expect(result).toEqual({ started: 0, cancelled: 0, failed: [] });
    expect(await statusOf(id)).toBe("upcoming");
  });

  it("is scheduled every minute by the Agenda worker, not only by Inngest", () => {
    const worker = readFileSync(pathResolve("worker/index.ts"), "utf8");
    expect(worker).toMatch(/agenda\.every\("1 minute", "competition-start"\)/);
    expect(worker).toMatch(/agenda\.define\("competition-start"/);
    const inngest = readFileSync(pathResolve("lib/inngest/functions.ts"), "utf8");
    expect(inngest).toContain("startOrCancelDueCompetitions(");
    // The inline copy is gone, so the two schedulers cannot disagree about the rule.
    expect(inngest).not.toContain("const competitionsToStart = await Competition.find");
  });

  it("admin cancel cannot turn a committed refund into an error by revalidating during render", () => {
    const src = readFileSync(
      pathResolve("apps/admin/lib/actions/trading/competition-cancel.actions.ts"),
      "utf8",
    ).replace(/\/\/.*$/gm, "");
    const helperStart = src.indexOf("function revalidateAfterCommit(");
    const helperEnd = src.indexOf("export async function cancelCompetitionAndRefund(");
    expect(helperStart).toBeGreaterThan(-1);
    expect(helperEnd).toBeGreaterThan(helperStart);
    const outside = src.slice(0, helperStart) + src.slice(helperEnd);
    expect(outside).not.toMatch(/revalidatePath\(/);
  });
});
