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
 * X9 dedicated re-settle: void disputed rounds on a completed provider contest, re-rank,
 * claw back old prizes, pay the corrected board.
 *
 * Assert money separately from status (R42). Adjust-results is a different feature.
 */

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const notifications: { userId: string; type: string }[] = [];
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    createCustom: async (n: { userId: string; type: string }) => {
      notifications.push(n);
      return null;
    },
  },
}));

import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import Incident from "@/database/models/incident.model";
import GameRound from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { resettleProviderCompetition } from "@/lib/services/settlement/provider-resettle.service";
import { canTransitionRound } from "@/database/models/games/game-round.model";

const GAME_KEY = "provider:mock:resettle-puzzle";
const ADA = "6500000000000000000000b1";
const BO = "6500000000000000000000b2";

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "creditwallets",
    "wallettransactions",
    "incidents",
    "game_round",
    "provider_game",
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

async function seedProviderTitle() {
  await ProviderGame.create({
    providerKey: "mock",
    gameCode: "resettle-puzzle",
    gameKey: GAME_KEY,
    displayName: "Resettle Puzzle",
    family: "independent",
    category: "puzzle",
    providerStatus: "active",
    chartvoltEnabled: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsContentSeed: true,
    maxDurationSeconds: 120,
  });
}

async function seedContest() {
  const now = Date.now();
  return Competition.create({
    name: "Resettle Cup",
    slug: `resettle-cup-${now}`,
    description: "Completed provider contest needing a dispute fix",
    gameType: "provider",
    gameKey: GAME_KEY,
    status: "completed",
    competitionType: "time_based",
    startTime: new Date(now - 7_200_000),
    endTime: new Date(now - 3_600_000),
    playWindowStart: new Date(now - 7_200_000),
    playWindowEnd: new Date(now - 3_600_000),
    registrationDeadline: new Date(now - 7_200_000),
    entryFee: 50,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 2,
    prizePool: 100,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    createdBy: new mongoose.Types.ObjectId().toString(),
    finalLeaderboard: [
      {
        rank: 1,
        userId: ADA,
        username: "Ada",
        score: 900,
        prizeAmount: 90,
      },
      {
        rank: 2,
        userId: BO,
        username: "Bo",
        score: 100,
        prizeAmount: 0,
      },
    ],
  });
}

async function seedSeat(
  competitionId: string,
  userId: string,
  username: string,
  score: number,
  rank: number,
) {
  return CompetitionParticipant.create({
    competitionId,
    userId,
    username,
    email: `${username.toLowerCase()}@example.com`,
    gameKey: GAME_KEY,
    score,
    currentRank: rank,
    status: "completed",
    enteredAt: new Date(),
  });
}

async function seedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  score: number,
  suffix: string,
) {
  return GameRound.create({
    roundId: `cv_rnd_resettle_${suffix}`,
    providerKey: "mock",
    gameCode: "resettle-puzzle",
    gameKey: GAME_KEY,
    userId,
    contestType: "competition",
    contestId,
    attemptNumber: 1,
    mode: "ranked",
    status: "completed",
    rawScore: score,
    expiresAt: new Date(Date.now() + 60_000),
    pollAttempts: 0,
  });
}

async function seedWallet(userId: string, balance: number) {
  return CreditWallet.create({
    userId,
    creditBalance: balance,
    totalDeposited: balance,
    totalWithdrawn: 0,
    totalSpentOnCompetitions: 0,
    totalWonFromCompetitions: 0,
    isActive: true,
    kycVerified: false,
    withdrawalEnabled: false,
  });
}

describe("canTransitionRound allows dispute void from scored terminals", () => {
  it("permits completed/abandoned/expired → voided", () => {
    expect(canTransitionRound("completed", "voided")).toBe(true);
    expect(canTransitionRound("abandoned", "voided")).toBe(true);
    expect(canTransitionRound("expired", "voided")).toBe(true);
    expect(canTransitionRound("voided", "completed")).toBe(false);
  });
});

describe("resettleProviderCompetition", () => {
  it("voids Ada's round, claws her prize back, and pays Bo", async () => {
    await seedProviderTitle();
    const contest = await seedContest();
    const cid = contest._id.toString();
    await seedSeat(cid, ADA, "Ada", 900, 1);
    await seedSeat(cid, BO, "Bo", 100, 2);
    const adaRound = await seedRound(contest._id, ADA, 900, "ada");
    await seedRound(contest._id, BO, 100, "bo");
    await seedWallet(ADA, 200);
    await seedWallet(BO, 50);

    const incident = await Incident.create({
      type: "system_error",
      severity: "high",
      status: "investigating",
      title: "Provider confirmed bad Ada round",
      description: "Support escalation",
      createdBy: "admin-1",
      auditLog: [],
    });

    const result = await resettleProviderCompetition({
      competitionId: cid,
      roundIds: [adaRound.roundId],
      incidentId: incident._id.toString(),
      reason: "Provider confirmed score error on Ada's round",
      adminId: "admin-1",
      adminEmail: "ops@chartvolt.test",
    });

    expect(result.success).toBe(true);
    expect(result.data?.voidedRoundIds).toContain(adaRound.roundId);

    const adaWallet = await CreditWallet.findOne({ userId: ADA }).lean<{
      creditBalance: number;
    } | null>();
    const boWallet = await CreditWallet.findOne({ userId: BO }).lean<{
      creditBalance: number;
    } | null>();
    // Ada started 200, lost 90 reclaim → 110, did not win again.
    expect(adaWallet?.creditBalance).toBe(110);
    // Bo started 50, gained 90 → 140.
    expect(boWallet?.creditBalance).toBe(140);

    const reclaims = await WalletTransaction.find({
      competitionId: cid,
      transactionType: "prize_reclaim",
    }).lean();
    expect(reclaims).toHaveLength(1);

    const wins = await WalletTransaction.find({
      competitionId: cid,
      transactionType: "competition_win",
    }).lean();
    expect(wins.some((w) => w.userId === BO && w.amount === 90)).toBe(true);

    const refreshed = await Competition.findById(cid).lean<{
      finalLeaderboard?: { userId: string; rank: number; prizeAmount: number }[];
    } | null>();
    const first = refreshed?.finalLeaderboard?.find((r) => r.rank === 1);
    expect(first?.userId).toBe(BO);
    expect(first?.prizeAmount).toBe(90);

    const voided = await GameRound.findOne({ roundId: adaRound.roundId }).lean<{
      status: string;
    } | null>();
    expect(voided?.status).toBe("voided");
  });

  it("refuses a trading contest without moving money", async () => {
    const now = Date.now();
    const contest = await Competition.create({
      name: "Trading Cup",
      slug: `trading-resettle-${now}`,
      description: "Trading",
      gameType: "trading",
      gameKey: "trading",
      startingCapital: 10_000,
      status: "completed",
      competitionType: "time_based",
      startTime: new Date(now - 7_200_000),
      endTime: new Date(now - 3_600_000),
      registrationDeadline: new Date(now - 7_200_000),
      entryFee: 5,
      minParticipants: 2,
      maxParticipants: 100,
      currentParticipants: 1,
      prizePool: 100,
      platformFeePercentage: 10,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      createdBy: new mongoose.Types.ObjectId().toString(),
      finalLeaderboard: [
        { rank: 1, userId: ADA, username: "Ada", prizeAmount: 90 },
      ],
    });
    await seedWallet(ADA, 200);
    const incident = await Incident.create({
      type: "system_error",
      severity: "low",
      status: "investigating",
      title: "Wrong tool",
      description: "x",
      createdBy: "admin-1",
      auditLog: [],
    });

    const result = await resettleProviderCompetition({
      competitionId: contest._id.toString(),
      roundIds: ["cv_rnd_none"],
      incidentId: incident._id.toString(),
      reason: "Should refuse trading contests entirely",
      adminId: "admin-1",
      adminEmail: "ops@chartvolt.test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/provider contests only/i);
    const wallet = await CreditWallet.findOne({ userId: ADA }).lean<{
      creditBalance: number;
    } | null>();
    expect(wallet?.creditBalance).toBe(200);
  });

  it("refuses when a winner cannot cover the reclaim", async () => {
    await seedProviderTitle();
    const contest = await seedContest();
    const cid = contest._id.toString();
    await seedSeat(cid, ADA, "Ada", 900, 1);
    await seedSeat(cid, BO, "Bo", 100, 2);
    const adaRound = await seedRound(contest._id, ADA, 900, "ada2");
    await seedRound(contest._id, BO, 100, "bo2");
    await seedWallet(ADA, 10); // less than 90 prize
    await seedWallet(BO, 50);
    const incident = await Incident.create({
      type: "system_error",
      severity: "high",
      status: "investigating",
      title: "Spent prize",
      description: "x",
      createdBy: "admin-1",
      auditLog: [],
    });

    const result = await resettleProviderCompetition({
      competitionId: cid,
      roundIds: [adaRound.roundId],
      incidentId: incident._id.toString(),
      reason: "Ada already spent the prize credits",
      adminId: "admin-1",
      adminEmail: "ops@chartvolt.test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot reclaim/i);

    const stillCompleted = await GameRound.findOne({
      roundId: adaRound.roundId,
    }).lean<{ status: string } | null>();
    expect(stillCompleted?.status).toBe("completed");

    const adaWallet = await CreditWallet.findOne({ userId: ADA }).lean<{
      creditBalance: number;
    } | null>();
    expect(adaWallet?.creditBalance).toBe(10);
  });
});

describe("re-settle mirrors and route exist", () => {
  it("admin settlement copy matches main byte-for-byte", () => {
    const main = readFileSync(
      join(process.cwd(), "lib/services/settlement/provider-resettle.service.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(
        process.cwd(),
        "apps/admin/lib/services/settlement/provider-resettle.service.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("admin participant-score copy matches main byte-for-byte", () => {
    const main = readFileSync(
      join(process.cwd(), "lib/services/games/participant-score.service.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(
        process.cwd(),
        "apps/admin/lib/services/games/participant-score.service.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("route guards with competitions section and calls the service", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "apps/admin/app/api/competitions/[id]/re-settle/route.ts",
      ),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/guardSection\(\s*["']competitions["']\s*\)/);
    expect(src).toMatch(/resettleProviderCompetition\s*\(/);
  });

  it("completed contest view mounts ResettlePanel for provider games", () => {
    const src = readFileSync(
      join(process.cwd(), "apps/admin/app/competitions/view/[id]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/ResettlePanel/);
    expect(src).toMatch(/isProviderGame && resettleRounds/);
  });
});
