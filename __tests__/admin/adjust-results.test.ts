import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * `POST /api/competitions/[id]/adjust-results` - the operator's correction of a settled result.
 *
 * WHY THIS SUITE IS BEHAVIOURAL AND NOT STRUCTURAL, unlike every other admin-route test here.
 * The five defects it pins all reported `success` while moving the wrong money, or no money,
 * or money with no ledger row. Not one of them is visible in the source: each is a branch that
 * runs, writes something, and returns a cheerful result row. The only assertion that can tell
 * them apart is the balance, the ledger and the stored document afterwards - so the route is
 * imported and run against a real replica set.
 *
 * ASSERT THE MONEY SEPARATELY FROM THE STATUS. R42's fixture bug is the precedent: a settlement
 * that matched zero participants still marked the contest `completed` and returned success, and
 * only the prize count disagreed. Every test below checks the wallet AND the ledger AND the
 * participant, because any one of the three passes on its own.
 */

// The guard is the one admin-only module the route reaches through `@`; see the alias in
// `vitest.config.ts` for why it is listed there one module at a time.
vi.mock("@/lib/admin/section-route-guard", () => ({
  guardSection: async () => ({
    ok: true,
    admin: { id: ADMIN_ID, email: "operator@chartvolt.test", role: "admin" },
  }),
}));

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

/*
  Mocked rather than left real. `createCustom` writes a Notification and then fans out to the
  websocket push, which reaches for a server that is not running - caught, but it turns every
  test into a several-second timeout. Nothing here is a claim about notification delivery.
*/
const notifications: { userId: string; type: string; message: string }[] = [];
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    createCustom: async (n: { userId: string; type: string; message: string }) => {
      notifications.push(n);
      return null;
    },
  },
}));

const ADMIN_ID = "admin-under-test";

import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import Incident from "@/database/models/incident.model";
import { POST } from "@/apps/admin/app/api/competitions/[id]/adjust-results/route";

const ROUTE = join(
  process.cwd(),
  "apps/admin/app/api/competitions/[id]/adjust-results/route.ts",
);

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  /*
    MongoDB cannot create a collection inside a transaction, and this route runs entirely in
    one - so the first test to touch a new collection fails with `due to catalog changes`,
    which is indistinguishable at a glance from a real conflict. Indexes are a catalog change
    too; `ensureCollections` settles those as well.
  */
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "creditwallets",
    "wallettransactions",
    "incidents",
  ]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  notifications.length = 0;
});

// =======================================================================================
// Fixtures
// =======================================================================================

/**
 * Deliberately NOT trimmed to the fields the route reads. Mongoose validates the document,
 * not the subset a test cares about, and a fixture missing `slug` or `startTime` fails every
 * test at once for one unrelated reason - which has cost this repository a day already.
 */
async function seedContest(
  userId: string,
  options: { status?: string; prizeAmount?: number; withSnapshot?: boolean } = {},
) {
  const now = Date.now();
  const {
    status = "completed",
    prizeAmount = 100,
    withSnapshot = true,
  } = options;

  return Competition.create({
    name: "Adjustment Cup",
    slug: `adjustment-cup-${now}-${Math.random().toString(16).slice(2)}`,
    description: "A settled contest an operator is correcting",
    gameType: "trading",
    gameKey: "trading",
    startingCapital: 10_000,
    status,
    competitionType: "time_based",
    startTime: new Date(now - 7_200_000),
    endTime: new Date(now - 3_600_000),
    registrationDeadline: new Date(now - 7_200_000),
    entryFee: 5,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 1,
    prizePool: 200,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId().toString(),
    ...(withSnapshot
      ? {
          finalLeaderboard: [
            {
              rank: 1,
              userId,
              username: "player_one",
              prizeAmount,
              finalCapital: 11_000,
              pnl: 1_000,
              pnlPercentage: 10,
              totalTrades: 4,
              winRate: 75,
            },
          ],
        }
      : {}),
  });
}

/**
 * NOTE THE ABSENT PRIZE. `CompetitionParticipant` declares no `prizeWon` and no `finalRank`,
 * which is the sixth defect this suite exists for - the route read and wrote both. What a
 * player was paid lives on the contest's `finalLeaderboard` row, so `seedContest` carries it.
 * Rank is `currentRank`, which is what `completeContest` writes.
 */
async function seedSeat(
  competitionId: string,
  userId: string,
  options: { rank?: number } = {},
) {
  return CompetitionParticipant.create({
    competitionId,
    userId,
    username: "player_one",
    email: "player_one@example.com",
    startingCapital: 10_000,
    currentCapital: 11_000,
    availableCapital: 11_000,
    gameKey: "trading",
    currentRank: options.rank ?? 1,
    status: "completed",
  });
}

/** The prize the stored snapshot records for this player, which is the route's baseline. */
async function snapshotPrizeOf(competitionId: string): Promise<number> {
  const contest = await Competition.findById(competitionId).lean<{
    finalLeaderboard?: { prizeAmount: number }[];
  }>();
  return contest?.finalLeaderboard?.[0]?.prizeAmount ?? 0;
}

async function seedIncident() {
  return Incident.create({
    type: "system_error",
    severity: "high",
    status: "investigating",
    title: "Result under review",
    description: "An operator is correcting a settled result",
    createdBy: ADMIN_ID,
    auditLog: [],
  });
}

async function call(
  competitionId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const request = {
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];

  const response = await POST(request, {
    params: Promise.resolve({ id: competitionId }),
  });

  return { status: response.status, json: await response.json() };
}

async function balanceOf(userId: string): Promise<number | null> {
  const wallet = await CreditWallet.findOne({ userId }).lean<{
    creditBalance: number;
  }>();
  return wallet ? wallet.creditBalance : null;
}

async function ledgerOf(userId: string) {
  return WalletTransaction.find({ userId }).lean<
    { transactionType: string; amount: number }[]
  >();
}

// =======================================================================================
// DEFECT 5 - the ledger types the route writes were declared nowhere.
//
// The largest of the five and the last found, because it is invisible in this route entirely:
// the value is spelled correctly at every call site and the model simply did not admit it. A
// missing enum value rejects the WHOLE document, so `WalletTransaction.create` threw, the
// per-adjustment `catch` filed it as a row-level error, and the route committed anyway - with
// the wallet `$inc` immediately above already applied.
// =======================================================================================

describe("the ledger row an adjustment writes", () => {
  it("records a prize increase, and the balance and the ledger agree", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, newPrize: 150, reason: "Recount" },
      ],
    });

    expect((json.results as { success: boolean }[])[0].success).toBe(true);
    expect(await balanceOf(userId)).toBe(150);

    // The half that used to be missing. Without the enum value this array is empty while the
    // balance above is already correct - which is exactly why no test asserting one figure
    // could ever have found it.
    const ledger = await ledgerOf(userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].transactionType).toBe("prize_adjustment_add");
    expect(ledger[0].amount).toBe(50);
  });

  it("records a prize reduction", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newPrize: 40, reason: "Recount" }],
    });

    expect(await balanceOf(userId)).toBe(40);
    const ledger = await ledgerOf(userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].transactionType).toBe("prize_adjustment_deduct");
    expect(ledger[0].amount).toBe(-60);
  });

  it("records a clawback when a paid player is disqualified", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    expect(await balanceOf(userId)).toBe(0);
    const ledger = await ledgerOf(userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].transactionType).toBe("prize_reclaim");
    expect(ledger[0].amount).toBe(-100);
  });

  it("saves the participant, which the throw used to happen before", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    /*
      `participant.save()` sits AFTER the ledger write, so the rejected document took the
      participant down with it: the player kept `status: "completed"` and the stored
      leaderboard still showed the prize as paid, while their wallet had already been emptied.
      The two disagreed permanently and the operator was told the disqualification had
      succeeded.
    */
    const after = await CompetitionParticipant.findById(seat.id).lean<{
      status: string;
    }>();
    expect(after!.status).toBe("disqualified");
    expect(await snapshotPrizeOf(contest.id)).toBe(0);
  });
});

// =======================================================================================
// DEFECT 1 - a disqualification that could not reclaim the prize used to half-apply.
// =======================================================================================

describe("a disqualification whose clawback cannot be performed", () => {
  it("refuses when the balance is short, and changes nothing at all", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 30 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    const row = (json.results as { success: boolean; adjustment: string }[])[0];
    expect(row.success).toBe(false);
    expect(row.adjustment).toBe("disqualify_failed");

    // The three that used to move independently of one another. The old code set the status
    // and left the prize and the balance where they were, so the contest carried a
    // disqualified player who had still been paid.
    expect(await balanceOf(userId)).toBe(30);
    const after = await CompetitionParticipant.findById(seat.id).lean<{
      status: string;
    }>();
    expect(after!.status).toBe("completed");
    expect(await snapshotPrizeOf(contest.id)).toBe(100);
  });

  it("refuses when the player has no wallet", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    expect((json.results as { adjustment: string }[])[0].adjustment).toBe(
      "disqualify_failed",
    );
    const after = await CompetitionParticipant.findById(seat.id).lean<{
      status: string;
    }>();
    expect(after!.status).toBe("completed");
  });

  it("disqualifies an unpaid player with no wallet, because there is nothing to reclaim", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 0 });
    const seat = await seedSeat(contest.id, userId);
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    // The refusal must be scoped to a clawback that is actually owed. Written as a blanket
    // "no wallet, no disqualification" it would refuse the commonest case there is.
    expect((json.results as { success: boolean }[])[0].success).toBe(true);
    const after = await CompetitionParticipant.findById(seat.id).lean<{
      status: string;
    }>();
    expect(after!.status).toBe("disqualified");
  });
});

// =======================================================================================
// DEFECT 2 - a prize increase for a player with no wallet moved nothing and said it had.
// =======================================================================================

describe("a prize change for a player with no wallet", () => {
  it("creates the wallet for an increase, exactly as settlement does", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 0 });
    const seat = await seedSeat(contest.id, userId);
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, newPrize: 75, reason: "Missed from payout" },
      ],
    });

    expect((json.results as { success: boolean }[])[0].success).toBe(true);
    expect(await balanceOf(userId)).toBe(75);
  });

  it("refuses a reduction, because there is nothing to take", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newPrize: 40, reason: "Recount" }],
    });

    const row = (json.results as { success: boolean; adjustment: string }[])[0];
    expect(row.success).toBe(false);
    expect(row.adjustment).toBe("prize_change_failed");
    expect(await balanceOf(userId)).toBeNull();
  });

  it("reports the prize change that was APPLIED, not the one requested", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, newPrize: 100, reason: "No net change" },
      ],
    });

    // Asking for the prize a player already holds moves nothing, and the row used to report
    // the full requested figure regardless of whether a credit changed hands.
    expect((json.results as { prizeChange: number }[])[0].prizeChange).toBe(0);
    expect(json.totalPrizeAdjustment).toBe(0);
  });
});

// =======================================================================================
// DEFECT 3 - disqualifying and re-pricing in one adjustment double-counted.
// =======================================================================================

describe("a disqualification and a prize change in the same adjustment", () => {
  it("prices the change against what the player holds NOW, not against the old prize", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        {
          participantId: seat.id,
          disqualify: true,
          newPrize: 25,
          reason: "Partial penalty",
        },
      ],
    });

    /*
      100 reclaimed, then 25 credited: the balance is 25. The old baseline was `previousPrize`
      captured before the clawback, so `prizeDiff` was 25 - 100 = -75 and the route tried to
      take a further 75 from an already-emptied wallet, leaving the player at -75 or, once the
      insufficient-balance guard caught it, at 0 with the row reporting a change of -75.
    */
    expect(await balanceOf(userId)).toBe(25);
    expect(await snapshotPrizeOf(contest.id)).toBe(25);
  });
});

// =======================================================================================
// DEFECT 4 - the stored snapshot did not move with the participant.
// =======================================================================================

describe("the stored final leaderboard", () => {
  it("carries the corrected rank and prize", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, newRank: 3, newPrize: 40, reason: "Recount" },
      ],
    });

    expect(json.snapshotRowsUpdated).toBe(1);

    const after = await Competition.findById(contest.id).lean<{
      finalLeaderboard: { rank: number; prizeAmount: number }[];
    }>();
    // `SettledResultPanel` captions this table as the amounts paid, so a correction that never
    // reached it left the operator reading the pre-adjustment figures as fact.
    expect(after!.finalLeaderboard[0].rank).toBe(3);
    expect(after!.finalLeaderboard[0].prizeAmount).toBe(40);
  });

  it("marks a disqualified player in the snapshot", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [
        { participantId: seat.id, disqualify: true, reason: "Collusion" },
      ],
    });

    const after = await Competition.findById(contest.id).lean<{
      finalLeaderboard: { qualificationStatus?: string; prizeAmount: number }[];
    }>();
    expect(after!.finalLeaderboard[0].qualificationStatus).toBe("disqualified");
    expect(after!.finalLeaderboard[0].prizeAmount).toBe(0);
  });

  it("refuses to move money on a contest that stored no snapshot, and invents nothing", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { withSnapshot: false });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newPrize: 40, reason: "Recount" }],
    });

    /*
      A contest finalized before X5 stored no leaderboard, so there is no record of what this
      player was paid. Refused rather than read as a zero prize: a zero is indistinguishable
      from "we do not know", and taking it literally credits the full 40 to a player who may
      already hold it. A row fabricated now would claim to be what finalization recorded,
      which is the one thing this table is for.
    */
    expect((json.results as { success: boolean }[])[0].success).toBe(false);
    expect(String((json.results as { error: string }[])[0].error)).toContain(
      "no recorded result",
    );
    expect(await balanceOf(userId)).toBe(100);
    expect(json.snapshotRowsUpdated).toBe(0);
    const after = await Competition.findById(contest.id).lean<{
      finalLeaderboard?: unknown[];
    }>();
    expect(after!.finalLeaderboard ?? []).toHaveLength(0);
  });
});

// =======================================================================================
// DEFECT 6 - the route read and wrote two fields the schema does not have.
//
// The largest of the six, and the reason the five above were all reachable: `prizeWon` and
// `finalRank` are declared on neither copy of `CompetitionParticipant`. Mongoose defines
// getters only for declared paths, so every read returned `undefined` however much had been
// paid, and every write was discarded by strict mode while `save()` reported success.
// =======================================================================================

describe("the fields an adjustment actually reads and writes", () => {
  it("writes a rank change to the field the platform counts wins on", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId, { rank: 1 });
    const incident = await seedIncident();

    const { json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newRank: 4, reason: "Recount" }],
    });

    expect((json.results as { adjustment: string }[])[0].adjustment).toBe(
      "rank_changed",
    );

    /*
      It used to write `finalRank`, which the schema has not got, so a rank correction moved
      nothing - including the win and podium counts on the dashboard, the profile and
      matchmaking, all of which read `currentRank`. `completeContest` writes `currentRank`
      too, so this is the same field settlement itself set.
    */
    const after = await CompetitionParticipant.findById(seat.id).lean<{
      currentRank: number;
    }>();
    expect(after!.currentRank).toBe(4);
  });

  it("prices a correction against the prize that was recorded, not against zero", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { prizeAmount: 100 });
    const seat = await seedSeat(contest.id, userId);
    await CreditWallet.create({ userId, creditBalance: 100 });
    const incident = await seedIncident();

    await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newPrize: 40, reason: "Recount" }],
    });

    /*
      THE MOST EXPENSIVE OF THE SIX. With the baseline always `undefined || 0`, correcting a
      winner paid 100 down to 40 CREDITED 40 instead of reclaiming 60 - the player ended on
      140 and the ledger recorded an addition. Asserted on the balance rather than on the
      diff, because the row that reports the diff was computed from the same wrong baseline.
    */
    expect(await balanceOf(userId)).toBe(40);
    const ledger = await ledgerOf(userId);
    expect(ledger[0].transactionType).toBe("prize_adjustment_deduct");
  });

  it("names no field the participant schema has not got", () => {
    const source = readFileSync(ROUTE, "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      "",
    );

    /*
      Structural as well as behavioural, and both are needed. The behavioural tests above
      cannot see a SECOND phantom read added later beside a correct one - it would simply be
      `undefined` in an expression whose answer the tests do not examine - and nothing in the
      typecheck objects, because `IParticipant` is reached through `models?.X || model(...)`,
      which widens the document type. Comments stripped first: this file explains both names
      at length, so a bare match is satisfied by the prose that exists to warn about them.
    */
    expect(source).not.toMatch(/participant\.prizeWon/);
    expect(source).not.toMatch(/participant\.finalRank/);
  });
});

// =======================================================================================
// The gate.
// =======================================================================================

describe("which contests may be adjusted at all", () => {
  it("refuses a cancelled contest, whose entry fees have already been refunded", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const contest = await seedContest(userId, { status: "cancelled" });
    const seat = await seedSeat(contest.id, userId);
    const incident = await seedIncident();

    const { status, json } = await call(contest.id, {
      incidentId: incident.id,
      adjustments: [{ participantId: seat.id, newPrize: 40, reason: "Recount" }],
    });

    expect(status).toBe(400);
    expect(String(json.error)).toContain("refunded");
  });

  it("does not name a state no contest can be in", () => {
    /*
      The gate used to admit `emergency_ended`, which nothing writes - so the arm was
      unreachable and the refusal message named it. Structural rather than behavioural
      precisely because an unreachable branch cannot be exercised: the only evidence is that
      the string is gone.
    */
    const source = readFileSync(ROUTE, "utf8");
    const gate = source.slice(
      source.indexOf("if (competition.status !== "),
      source.indexOf("console.log("),
    );
    expect(gate.length).toBeGreaterThan(50);
    expect(gate).not.toContain("emergency_ended");
  });
});

// =======================================================================================
// The route's own guards, which no behavioural test above can see.
// =======================================================================================

describe("the route's guard and its transaction", () => {
  it("is granted per section, on every exported handler", () => {
    const source = readFileSync(ROUTE, "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      "",
    );

    // Count the handlers against the guards. "Does the file mention guardSection" is green on
    // a second handler added later with nothing in front of it.
    const handlers =
      source.match(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g) ??
      [];
    const guards = source.match(/guardSection\(\s*["']competitions["']\s*\)/g) ?? [];

    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
    expect(source).not.toMatch(/verifyAdminToken|verifyAdminAuth|requireAdminAuth/);
  });

  it("aborts the transaction on every refusal, not only the late ones", () => {
    const source = readFileSync(ROUTE, "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      "",
    );

    /*
      COUNTED, not merely present. The two validation refusals returned without aborting while
      the six around them did, so any assertion that the file mentions `abortTransaction` was
      satisfied by the neighbours - and a leaked transaction is invisible until the session is
      ended under it.

      Route-level refusals only: the per-adjustment `continue`s deliberately do NOT abort,
      because one impossible clawback must not discard the adjustments beside it.
    */
    /*
      Whitespace is collapsed FIRST rather than matched. A refusal is written across two, three
      or four lines depending on how long its message is, and the pattern that allowed for that
      (`\(\s*\{?\s*\n?\s*(\{\s*)?error:`) nests quantifiers, which is a real backtracking risk
      and which ESLint's `security/detect-unsafe-regex` correctly refused. Flattening first
      leaves one shape to match and no optional groups inside a repeat.
    */
    const flat = source.replace(/\s+/g, " ");
    const refusals = flat.match(/return NextResponse\.json\( ?\{ ?error:/g) ?? [];
    const aborts = flat.match(/await mongoSession\.abortTransaction\(\)/g) ?? [];

    expect(refusals.length).toBeGreaterThan(0);
    /*
      COUNTED AGAINST THE REFUSALS, never against a fixed number. Written
      `toBeGreaterThanOrEqual(5)` it stayed green with one abort deleted, because seven were
      present - the weak-test cause of a green probe, and the exact shape the count was
      introduced to avoid.

      The `+ 1` is the guard's own refusal, which aborts and then returns `guard.response`
      rather than composing an error body of its own, so it is an abort with no matching
      refusal in the count above.
    */
    expect(aborts.length).toBeGreaterThanOrEqual(refusals.length + 1);
  });
});
