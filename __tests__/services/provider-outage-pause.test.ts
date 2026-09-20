/**
 * X9 / E7 — outage-driven pause and extend.
 *
 * Pins: pause active provider contests when healthStatus is down; resume +
 * extend only system-outage pauses when evidence is ok; never auto-resume a
 * manual pause; recovery works while the provider stays enabled:false.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    createCustom: vi.fn(async () => undefined),
  },
}));

import Competition from "../../database/models/trading/competition.model";
import GameProvider from "../../database/models/games/game-provider.model";
import GameRound from "../../database/models/games/game-round.model";
import {
  SYSTEM_OUTAGE_PAUSED_BY,
  isSystemOutagePause,
} from "../../lib/services/games/contest-pause.service";
import { MOCK_PROVIDER_KEY } from "../../lib/services/game-providers/adapters/mock.adapter";

const { runProviderOutagePause } = await import(
  "../../lib/services/game-providers/provider-outage-pause.service"
);

const ROOT = process.cwd();
const HOUR = 60 * 60 * 1000;
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "competitions",
  "competitionparticipants",
  "game_provider",
  "game_round",
  "provider_event",
];

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

async function seedProvider(overrides: Record<string, unknown> = {}) {
  return GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock",
    baseUrl: "https://mock.example",
    enabled: true,
    healthStatus: "down",
    healthFailureStreak: 5,
    healthDownSince: new Date(Date.now() - 5 * 60_000),
    ...overrides,
  });
}

async function seedActiveContest(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - HOUR);
  const end = new Date(Date.now() + 6 * HOUR);
  return Competition.create({
    name: "Trivia Night",
    slug: `trivia-${Math.random().toString(36).slice(2, 10)}`,
    description: "A test contest",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: {
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
    },
    contentSeed: "aabbccdd",
    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "best_of_n",
    attemptsAllowed: 3,
    unresolvedRoundPolicy: "score_zero",
    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 50,
    currentParticipants: 1,
    startTime: start,
    endTime: end,
    registrationDeadline: start,
    status: "active",
    competitionType: "time_based",
    prizePool: 10,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: "507f1f77bcf86cd799439011",
    ...overrides,
  });
}

async function seedOkEvidence() {
  await GameRound.create({
    roundId: `cv_rnd_ok_${Date.now()}`,
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId: new mongoose.Types.ObjectId().toString(),
    contestType: "competition",
    contestId: new mongoose.Types.ObjectId(),
    attemptNumber: 1,
    mode: "ranked",
    status: "completed",
    rawScore: 100,
    expiresAt: new Date(Date.now() + 60_000),
    pollAttempts: 0,
  });
}

describe("runProviderOutagePause — pause on down", () => {
  it("pauses every active contest for a down provider with the system marker", async () => {
    await seedProvider();
    const contest = await seedActiveContest();

    const summary = await runProviderOutagePause(new Date());
    expect(summary.paused).toBe(1);
    expect(summary.errors).toEqual([]);

    const row = await Competition.findById(contest._id);
    expect(row?.isPaused).toBe(true);
    expect(isSystemOutagePause(row!)).toBe(true);
    expect(row?.pauseHistory?.at(-1)?.pausedBy).toBe(SYSTEM_OUTAGE_PAUSED_BY);
  });

  it("skips contests that are already paused", async () => {
    await seedProvider();
    await seedActiveContest({
      isPaused: true,
      pauseReason: "Already out",
      pauseHistory: [
        {
          pausedAt: new Date(),
          reason: "Already out",
          pausedBy: "admin-1",
        },
      ],
    });

    const summary = await runProviderOutagePause(new Date());
    expect(summary.paused).toBe(0);
    expect(summary.skippedAlreadyPaused).toBe(1);
  });

  /**
   * R111, 20 Sep 2026. `healthStatus` defaults to `"down"` and the kill-switch
   * worker leaves it alone while there is no evidence, so the bare status query
   * this worker used to run matched every provider that has never produced a
   * scored round — and system-paused perfectly healthy live contests, with a
   * banner and a notification to every participant. Only an OBSERVED outage,
   * carrying `healthDownSince`, may pause anything.
   */
  it("does not pause a provider that has never been health checked", async () => {
    await seedProvider({ healthDownSince: null });
    const contest = await seedActiveContest();

    const summary = await runProviderOutagePause(new Date());
    expect(summary.examinedDown).toBe(0);
    expect(summary.paused).toBe(0);

    const row = await Competition.findById(contest._id);
    expect(row?.isPaused).not.toBe(true);
  });

  it("does not pause contests for a different provider", async () => {
    await seedProvider();
    await seedActiveContest({
      gameConfig: {
        providerKey: "other-provider",
        gameCode: GAME_CODE,
        settings: {},
      },
      gameKey: `provider:other-provider:${GAME_CODE}`,
    });

    const summary = await runProviderOutagePause(new Date());
    expect(summary.paused).toBe(0);
    const row = await Competition.findOne({ isPaused: true });
    expect(row).toBeNull();
  });
});

describe("runProviderOutagePause — resume on recovery", () => {
  it("resumes a system pause and extends playWindowEnd when evidence is ok", async () => {
    const pausedAt = new Date(Date.now() - 30 * 60_000);
    await seedProvider({
      // Kill-switched: still down in storage, but evidence recovers.
      enabled: false,
      healthStatus: "down",
    });
    const start = new Date(Date.now() - HOUR);
    const end = new Date(Date.now() + 6 * HOUR);
    const contest = await seedActiveContest({
      isPaused: true,
      pausedAt,
      pauseReason: "Provider outage",
      playWindowStart: start,
      playWindowEnd: end,
      endTime: end,
      pauseHistory: [
        {
          pausedAt,
          reason: "Provider outage",
          pausedBy: SYSTEM_OUTAGE_PAUSED_BY,
        },
      ],
    });
    await seedOkEvidence();

    const now = new Date();
    const summary = await runProviderOutagePause(now);
    expect(summary.resumed).toBe(1);
    expect(summary.errors).toEqual([]);

    const row = await Competition.findById(contest._id);
    expect(row?.isPaused).toBe(false);
    const pauseMs = now.getTime() - pausedAt.getTime();
    expect(row?.playWindowEnd?.getTime()).toBe(end.getTime() + pauseMs);
    expect(row?.endTime.getTime()).toBe(end.getTime() + pauseMs);

    const provider = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ healthStatus?: string; enabled?: boolean }>();
    // Health cleared for the next kill-switch pass; enable stays operator-owned.
    expect(provider?.healthStatus).toBe("healthy");
    expect(provider?.enabled).toBe(false);
  });

  it("never auto-resumes a manual pause", async () => {
    await seedProvider({ healthStatus: "healthy", healthFailureStreak: 0 });
    await seedActiveContest({
      isPaused: true,
      pausedAt: new Date(Date.now() - 10 * 60_000),
      pauseReason: "Operator decision",
      pauseHistory: [
        {
          pausedAt: new Date(Date.now() - 10 * 60_000),
          reason: "Operator decision",
          pausedBy: "admin-42",
        },
      ],
    });
    await seedOkEvidence();

    const summary = await runProviderOutagePause(new Date());
    expect(summary.resumed).toBe(0);
    expect(summary.skippedManualPause).toBe(1);

    const still = await Competition.findOne({ isPaused: true });
    expect(still).not.toBeNull();
  });

  it("does not resume while evidence is still fail", async () => {
    await seedProvider();
    await seedActiveContest({
      isPaused: true,
      pausedAt: new Date(Date.now() - 10 * 60_000),
      pauseReason: "Provider outage",
      pauseHistory: [
        {
          pausedAt: new Date(Date.now() - 10 * 60_000),
          reason: "Provider outage",
          pausedBy: SYSTEM_OUTAGE_PAUSED_BY,
        },
      ],
    });
    await GameRound.create({
      roundId: `cv_rnd_fail_${Date.now()}`,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: new mongoose.Types.ObjectId().toString(),
      contestType: "competition",
      contestId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      mode: "ranked",
      status: "unresolved",
      expiresAt: new Date(Date.now() + 60_000),
      pollAttempts: 0,
    });

    const summary = await runProviderOutagePause(new Date());
    expect(summary.resumed).toBe(0);
    const row = await Competition.findOne({ isPaused: true });
    expect(row).not.toBeNull();
  });
});

describe("outage pause wiring (structural)", () => {
  it("schedules the Agenda job every minute beside the kill-switch", () => {
    const worker = readCode("worker/index.ts");
    expect(worker).toMatch(/agenda\.every\(\s*"1 minute"\s*,\s*"provider-outage-pause"\s*\)/);
    expect(worker).toMatch(/runProviderOutagePauseCheck/);
  });

  it("reuses contest-pause rather than reimplementing extend math", () => {
    const source = readCode(
      "lib/services/game-providers/provider-outage-pause.service.ts",
    );
    expect(source).toMatch(/pauseContest/);
    expect(source).toMatch(/resumeContest/);
    expect(source).toMatch(/isSystemOutagePause/);
    // Must not duplicate the window arithmetic.
    expect(source).not.toMatch(/playWindowEnd\s*=/);
  });

  it("marks system pauses with the stable pausedBy string", () => {
    const pause = readCode("lib/services/games/contest-pause.service.ts");
    expect(pause).toMatch(/SYSTEM_OUTAGE_PAUSED_BY\s*=\s*"system:provider-outage"/);
  });
});
