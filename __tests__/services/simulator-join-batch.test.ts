import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * Stage 0, Defect 1: the third competition entry path.
 *
 * The plan recorded two join paths. Mapping the writers on 1 September 2026 found four,
 * and this is the one that moves money without anybody having looked at it:
 *
 *   POST /api/simulator/competitions/join-batch
 *
 * It debits every wallet in a batch and inserts the participants in bulk, inside one
 * transaction. Two things were wrong with it, and both are fixed and pinned here:
 *
 *   1. It incremented `currentParticipants` but not `prizePool`, so a competition seeded
 *      by the simulator finalized against a pool of zero while the fees sat in platform
 *      revenue. Same defect class as Gate B.
 *
 *   2. Six of the participant field names did not exist on the schema. insertMany runs in
 *      strict mode, so each one was dropped in silence. That did no visible harm only
 *      because every dropped value happened to equal the schema default - which is the
 *      kind of luck that stops holding the moment a non-zero value is passed.
 *
 * The batch path is not being folded into the unified entry service: it exists to seed
 * thousands of participants quickly and a per-user service call would defeat that. It is
 * fixed in place instead, and these tests are what keeps it honest.
 */

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Reason: NODE_ENV is "test", not "development", so guardSimulatorRoute demands the real
// internal secret. Supplying it here means these tests also exercise the authentication
// added when the unauthenticated-simulator hole was closed, rather than bypassing it.
const SIMULATOR_SECRET = "test-internal-secret-value";
process.env.ENABLE_SIMULATOR = "true";
process.env.INTERNAL_API_SECRET = SIMULATOR_SECRET;

const { POST: joinBatch } = await import(
  "@/app/api/simulator/competitions/join-batch/route"
);
const { buildSimulatorParticipant } = await import(
  "@/lib/services/simulator/simulator-participant"
);
const CompetitionParticipant = (
  await import("@/database/models/trading/competition-participant.model")
).default;

const ENTRY_FEE = 25;
const START_BALANCE = 500;
const STARTING_CAPITAL = 10_000;

/** Twenty-four hex characters, because real Better Auth ids are ObjectId strings. */
const playerId = (n: number) => `64b7f${String(n).padStart(19, "0")}`;

async function callBatch(competitionId: string, userIds: string[]) {
  const request = new NextRequest(
    "http://localhost:3000/api/simulator/competitions/join-batch",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Simulator-Mode": "true",
        "X-Internal-Secret": SIMULATOR_SECRET,
      },
      body: JSON.stringify({ competitionId, userIds }),
    },
  );
  const response = await joinBatch(request);
  return {
    status: response.status,
    body: (await response.json()) as {
      success?: boolean;
      joined?: number;
      error?: string;
      insufficientBalance?: number;
    },
  };
}

async function seedCompetition(entryFee: number): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db?.collection("competitions").insertOne({
    _id: id,
    name: "Simulator Batch Competition",
    status: "upcoming",
    entryFee,
    prizePool: 0,
    currentParticipants: 0,
    maxParticipants: 100,
    minParticipants: 2,
    startingCapital: STARTING_CAPITAL,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    registrationDeadline: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
  });
  return id.toString();
}

async function seedWallets(
  userIds: string[],
  balance = START_BALANCE,
): Promise<void> {
  await mongoose.connection.db?.collection("creditwallets").insertMany(
    userIds.map((userId) => ({
      userId,
      creditBalance: balance,
      totalDeposited: balance,
      totalSpentOnCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
}

async function readCompetition(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

async function readParticipants(competitionId: string) {
  return (
    (await mongoose.connection.db
      ?.collection("competitionparticipants")
      .find({ competitionId })
      .toArray()) ?? []
  );
}

async function feesTaken(userIds: string[]): Promise<number> {
  const wallets =
    (await mongoose.connection.db
      ?.collection("creditwallets")
      .find({ userId: { $in: userIds } })
      .toArray()) ?? [];
  const remaining = wallets.reduce(
    (sum, w) => sum + (w.creditBalance as number),
    0,
  );
  return userIds.length * START_BALANCE - remaining;
}

describe("simulator batch join - the third entry path", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "creditwallets",
      "wallettransactions",
      "competitionparticipants",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("funds the prize pool with every fee it takes", async () => {
    const players = [1, 2, 3, 4].map(playerId);
    const competitionId = await seedCompetition(ENTRY_FEE);
    await seedWallets(players);

    const { status, body } = await callBatch(competitionId, players);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, joined: players.length });

    const collected = await feesTaken(players);
    expect(collected).toBe(ENTRY_FEE * players.length);

    // The invariant: what was taken from players is what the winners can be paid.
    const competition = await readCompetition(competitionId);
    expect(competition?.prizePool).toBe(collected);
    expect(competition?.currentParticipants).toBe(players.length);
  });

  it("funds the pool only for the players it could actually charge", async () => {
    const solvent = [1, 2].map(playerId);
    const broke = [3].map(playerId);
    const competitionId = await seedCompetition(ENTRY_FEE);
    await seedWallets(solvent);
    await seedWallets(broke, ENTRY_FEE - 1);

    const { body } = await callBatch(competitionId, [...solvent, ...broke]);

    expect(body).toMatchObject({
      success: true,
      joined: solvent.length,
      insufficientBalance: broke.length,
    });

    const competition = await readCompetition(competitionId);
    expect(competition?.prizePool).toBe(ENTRY_FEE * solvent.length);
    expect(competition?.currentParticipants).toBe(solvent.length);

    // The player who could not pay keeps their balance and gets no seat.
    const wallets = await mongoose.connection.db
      ?.collection("creditwallets")
      .findOne({ userId: broke[0] });
    expect(wallets?.creditBalance).toBe(ENTRY_FEE - 1);
    const seats = await readParticipants(competitionId);
    expect(seats.map((s) => s.userId).sort()).toEqual([...solvent].sort());
  });

  it("builds participants using only field names the schema declares", async () => {
    // Reason: this assertion has to be made against the builder, not against the stored
    // row. Strict mode has already discarded the bad names by the time the document
    // reaches MongoDB, so reading it back shows a clean row whether the route was right
    // or wrong - the same reason the misnaming survived unnoticed for so long. Comparing
    // the keys the route intends to write against the schema's paths is the only check
    // that actually fails when somebody adds a field the schema will drop.
    const declared = new Set(
      Object.keys(CompetitionParticipant.schema.paths).filter(
        (path) => !path.includes("."),
      ),
    );

    const row = buildSimulatorParticipant(
      "64b7f0000000000000000001",
      playerId(1),
      STARTING_CAPITAL,
      new Date(),
    );

    const undeclared = Object.keys(row).filter((key) => !declared.has(key));
    expect(undeclared).toEqual([]);

    // The six names that were wrong, listed so a regression names itself in the failure.
    for (const wrong of [
      "pnlPercent",
      "tradesCount",
      "joinedAt",
      "currentPnl",
      "currentPnlPercent",
      "currentDrawdown",
    ]) {
      expect(declared.has(wrong)).toBe(false);
      expect(row).not.toHaveProperty(wrong);
    }
  });

  it("stores the participant values it was given", async () => {
    const players = [1, 2].map(playerId);
    const competitionId = await seedCompetition(ENTRY_FEE);
    await seedWallets(players);

    await callBatch(competitionId, players);

    const seats = await readParticipants(competitionId);
    expect(seats).toHaveLength(players.length);

    for (const seat of seats) {
      expect(seat.enteredAt).toBeInstanceOf(Date);
      expect(seat).toMatchObject({
        competitionId,
        status: "active",
        startingCapital: STARTING_CAPITAL,
        currentCapital: STARTING_CAPITAL,
        availableCapital: STARTING_CAPITAL,
        pnl: 0,
        pnlPercentage: 0,
        totalTrades: 0,
      });
    }
  });

  it("attributes every entry-fee ledger row to its competition", async () => {
    const players = [1, 2, 3].map(playerId);
    const competitionId = await seedCompetition(ENTRY_FEE);
    await seedWallets(players);

    await callBatch(competitionId, players);

    const rows =
      (await mongoose.connection.db
        ?.collection("wallettransactions")
        .find({ transactionType: "competition_entry" })
        .toArray()) ?? [];

    expect(rows).toHaveLength(players.length);
    for (const row of rows) {
      // Reason: this is the field Gate A gets wrong (it writes `referenceId`, which the
      // schema does not declare). The batch route already wrote `competitionId`, so this
      // test guards a behaviour that is correct rather than proving a defect - worth
      // pinning, because the unified service must not regress to Gate A's version.
      expect(String(row.competitionId)).toBe(competitionId);
      expect(row.amount).toBe(-ENTRY_FEE);
    }
  });

  it("takes no fee and leaves the pool alone for a free competition", async () => {
    const players = [1, 2].map(playerId);
    const competitionId = await seedCompetition(0);
    await seedWallets(players);

    const { status, body } = await callBatch(competitionId, players);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, joined: players.length });
    expect(await feesTaken(players)).toBe(0);

    const competition = await readCompetition(competitionId);
    expect(competition?.prizePool).toBe(0);
    expect(competition?.currentParticipants).toBe(players.length);
    expect(await readParticipants(competitionId)).toHaveLength(players.length);
  });

  it("refuses a call without the internal secret, and moves no money", async () => {
    const players = [1, 2].map(playerId);
    const competitionId = await seedCompetition(ENTRY_FEE);
    await seedWallets(players);

    const request = new NextRequest(
      "http://localhost:3000/api/simulator/competitions/join-batch",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Simulator-Mode": "true",
        },
        body: JSON.stringify({ competitionId, userIds: players }),
      },
    );
    const response = await joinBatch(request);

    expect(response.status).toBe(403);
    expect(await feesTaken(players)).toBe(0);
    expect(await readParticipants(competitionId)).toHaveLength(0);
    expect((await readCompetition(competitionId))?.prizePool).toBe(0);
  });
});
