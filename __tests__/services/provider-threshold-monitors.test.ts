/**
 * X9 / E7 — chapter 06 s10 threshold monitors + ingest-time alerts.
 *
 * Thresholds that need a window/scan live in the Agenda job. "Any occurrence"
 * alerts (signature, score range, integrity) fire at ingestion and are pinned
 * structurally here so a future poller cannot "own" them and miss events.
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

const recordAlert = vi.fn(async (input: { alertType: string }) => ({
  _id: `alert-${input.alertType}`,
}));

vi.mock("@/lib/services/security/security-alert.service", () => ({
  recordSecurityAlert: (...args: unknown[]) => recordAlert(...args),
}));

import Competition from "../../database/models/trading/competition.model";
import Challenge from "../../database/models/trading/challenge.model";
import GameProvider from "../../database/models/games/game-provider.model";
import GameRound from "../../database/models/games/game-round.model";
import ProviderEvent from "../../database/models/games/provider-event.model";
import PlatformTransaction from "../../database/models/platform-financials.model";
import SecurityAlert from "../../database/models/security-alert.model";
import { MOCK_PROVIDER_KEY } from "../../lib/services/game-providers/adapters/mock.adapter";
import {
  percentile,
  STUCK_FINALIZING_MS,
  CALLBACK_FAILURE_MIN_EVENTS,
  LATENCY_P95_MS,
  LATENCY_MIN_SAMPLES,
  REPEAT_PAIRING_THRESHOLD,
  CATALOGUE_STALE_MS,
} from "../../lib/services/game-providers/provider-threshold-monitors.service";

const { runProviderThresholdMonitors } = await import(
  "../../lib/services/game-providers/provider-threshold-monitors.service"
);

const ingestAlerts = await import(
  "../../lib/services/games/provider-ingest-alerts"
);

const ROOT = process.cwd();

const COLLECTIONS = [
  "competitions",
  "challenges",
  "game_provider",
  "game_round",
  "provider_event",
  "platformtransactions",
  "securityalerts",
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
  recordAlert.mockClear();
});

describe("percentile", () => {
  it("returns the ceil-indexed p95 of a sorted sample", () => {
    // 20 samples → index ceil(0.95*20)-1 = 18 → 19th value when 1-indexed
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(samples, 0.95)).toBe(19);
  });

  it("returns 0 for an empty list", () => {
    expect(percentile([], 0.95)).toBe(0);
  });
});

describe("runProviderThresholdMonitors", () => {
  it("alerts when a competition is stuck finalizing beyond 10 minutes", async () => {
    const updatedAt = new Date(Date.now() - STUCK_FINALIZING_MS - 60_000);
    await Competition.collection.insertOne({
      name: "Stuck Comp",
      slug: "stuck-comp",
      description: "x",
      status: "finalizing",
      gameKey: "trading",
      entryFee: 10,
      minParticipants: 2,
      maxParticipants: 10,
      currentParticipants: 2,
      startTime: new Date(),
      endTime: new Date(),
      registrationDeadline: new Date(),
      competitionType: "time_based",
      prizePool: 10,
      platformFeePercentage: 10,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      createdBy: "507f1f77bcf86cd799439011",
      updatedAt,
      createdAt: updatedAt,
    });

    const summary = await runProviderThresholdMonitors(new Date());
    expect(summary.alerts).toBeGreaterThanOrEqual(1);
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "contest_stuck_finalizing",
        severity: "critical",
      }),
    );
  });

  it("alerts when prizes plus booked fees disagree with prizePool", async () => {
    const id = new mongoose.Types.ObjectId();
    const updatedAt = new Date();
    await Competition.collection.insertOne({
      _id: id,
      name: "Mismatch Comp",
      slug: "mismatch-comp",
      description: "x",
      status: "completed",
      gameKey: "trading",
      entryFee: 10,
      minParticipants: 2,
      maxParticipants: 10,
      currentParticipants: 2,
      startTime: new Date(),
      endTime: new Date(),
      registrationDeadline: new Date(),
      competitionType: "time_based",
      prizePool: 100,
      platformFeePercentage: 10,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      finalLeaderboard: [{ prizeAmount: 50 }],
      createdBy: "507f1f77bcf86cd799439011",
      updatedAt,
      createdAt: updatedAt,
    });
    await PlatformTransaction.collection.insertOne({
      transactionType: "platform_fee",
      amount: 10,
      amountEUR: 10,
      currency: "USD",
      description: "fee",
      sourceType: "competition",
      sourceId: id.toString(),
      createdAt: updatedAt,
      updatedAt,
    });

    // prizes 50 + fee 10 = 60 ≠ pool 100
    const summary = await runProviderThresholdMonitors(new Date());
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "prize_pool_mismatch",
        severity: "critical",
      }),
    );
    expect(summary.alerts).toBeGreaterThanOrEqual(1);
  });

  it("alerts when callback failure rate exceeds 1% with enough events", async () => {
    const now = new Date();
    const docs = [];
    for (let i = 0; i < CALLBACK_FAILURE_MIN_EVENTS; i++) {
      docs.push({
        eventId: `evt-ok-${i}`,
        providerKey: MOCK_PROVIDER_KEY,
        receivedAt: now,
        processingResult: i < 2 ? "signature_invalid" : "scored",
        rawBody: "{}",
      });
    }
    await ProviderEvent.insertMany(docs);

    await runProviderThresholdMonitors(now);
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "provider_callback_failure_rate",
        severity: "high",
        provider: MOCK_PROVIDER_KEY,
      }),
    );
  });

  it("does not alert on callback failures below the minimum sample size", async () => {
    await ProviderEvent.create({
      eventId: "evt-one",
      providerKey: MOCK_PROVIDER_KEY,
      receivedAt: new Date(),
      processingResult: "signature_invalid",
      rawBody: "{}",
    });
    await runProviderThresholdMonitors(new Date());
    expect(recordAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "provider_callback_failure_rate" }),
    );
  });

  it("alerts when createRound p95 latency exceeds 5s", async () => {
    const now = new Date();
    const samples = [
      ...Array.from({ length: LATENCY_MIN_SAMPLES - 1 }, () => 100),
      LATENCY_P95_MS + 1_000,
    ];
    for (let i = 0; i < samples.length; i++) {
      const latencyMs = samples.at(i);
      if (latencyMs === undefined) continue;
      await GameRound.create({
        roundId: `cv_rnd_lat_${i}_${Date.now()}`,
        providerKey: MOCK_PROVIDER_KEY,
        gameCode: "mock",
        gameKey: `provider:${MOCK_PROVIDER_KEY}:mock`,
        userId: new mongoose.Types.ObjectId().toString(),
        contestType: "competition",
        contestId: new mongoose.Types.ObjectId(),
        attemptNumber: 1,
        mode: "ranked",
        status: "completed",
        rawScore: 1,
        expiresAt: new Date(now.getTime() + 60_000),
        pollAttempts: 0,
        providerCreateLatencyMs: latencyMs,
        createdAt: now,
      });
    }

    await runProviderThresholdMonitors(now);
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "provider_latency_high",
        severity: "high",
      }),
    );
  });

  it("alerts when an enabled provider catalogue is stale beyond 24h", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: true,
      lastCatalogueSyncAt: new Date(Date.now() - CATALOGUE_STALE_MS - 60_000),
    });

    await runProviderThresholdMonitors(new Date());
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "catalogue_sync_stale",
        severity: "low",
        provider: MOCK_PROVIDER_KEY,
      }),
    );
  });

  it("skips catalogue-stale for a disabled provider", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: false,
      lastCatalogueSyncAt: null,
    });

    await runProviderThresholdMonitors(new Date());
    expect(recordAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "catalogue_sync_stale" }),
    );
  });

  it("alerts when the same pair has too many challenges in 24h", async () => {
    const a = "507f1f77bcf86cd799439011";
    const b = "507f1f77bcf86cd799439012";
    const now = new Date();
    for (let i = 0; i < REPEAT_PAIRING_THRESHOLD; i++) {
      await Challenge.collection.insertOne({
        challengerId: a,
        challengedId: b,
        status: "completed",
        gameKey: "trading",
        gameType: "trading",
        entryFee: 10,
        startingCapital: 10000,
        duration: 60,
        rankingMethod: "pnl",
        slug: `ch-${i}-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      });
    }

    await runProviderThresholdMonitors(now);
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "repeat_challenge_pairing",
        severity: "medium",
      }),
    );
  });

  it("dedupes the same fingerprint within an hour", async () => {
    const updatedAt = new Date(Date.now() - STUCK_FINALIZING_MS - 60_000);
    const id = new mongoose.Types.ObjectId();
    await Competition.collection.insertOne({
      _id: id,
      name: "Stuck Once",
      slug: "stuck-once",
      description: "x",
      status: "finalizing",
      gameKey: "trading",
      entryFee: 10,
      minParticipants: 2,
      maxParticipants: 10,
      currentParticipants: 2,
      startTime: new Date(),
      endTime: new Date(),
      registrationDeadline: new Date(),
      competitionType: "time_based",
      prizePool: 10,
      platformFeePercentage: 10,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      createdBy: "507f1f77bcf86cd799439011",
      updatedAt,
      createdAt: updatedAt,
    });

    // First pass raises; seed an unacked alert with the fingerprint so the second skips.
    await runProviderThresholdMonitors(new Date());
    expect(recordAlert).toHaveBeenCalled();
    const call = recordAlert.mock.calls[0][0] as {
      alertType: string;
      metadata: { fingerprint: string };
    };

    await SecurityAlert.create({
      alertType: call.alertType,
      severity: "critical",
      source: "provider-threshold-monitors",
      reason: "seed",
      acknowledged: false,
      metadata: { fingerprint: call.metadata.fingerprint },
    });
    recordAlert.mockClear();

    const second = await runProviderThresholdMonitors(new Date());
    expect(second.skippedDuplicate).toBeGreaterThanOrEqual(1);
    expect(recordAlert).not.toHaveBeenCalled();
  });
});

describe("ingest-time alerts (any occurrence)", () => {
  it("records signature_invalid as critical", async () => {
    ingestAlerts.voidIngestSecurityAlerts({
      providerKey: MOCK_PROVIDER_KEY,
      result: "signature_invalid",
      eventId: "e1",
    });
    // Fire-and-forget — wait a tick for the promise.
    await new Promise((r) => setTimeout(r, 50));
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "provider_signature_invalid",
        severity: "critical",
      }),
    );
  });

  it("records score_out_of_range as high", async () => {
    ingestAlerts.voidIngestSecurityAlerts({
      providerKey: MOCK_PROVIDER_KEY,
      result: "score_out_of_range",
      eventId: "e2",
      scoreOutOfRange: true,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "provider_score_out_of_range",
        severity: "high",
      }),
    );
  });

  it("records integrity flags as medium", async () => {
    ingestAlerts.voidIngestSecurityAlerts({
      providerKey: MOCK_PROVIDER_KEY,
      result: "scored",
      roundId: "r1",
      integrityFlags: ["suspicious_timing"],
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "provider_integrity_flag",
        severity: "medium",
      }),
    );
  });
});

describe("06 s10 wiring (structural)", () => {
  it("schedules the Agenda job every minute", () => {
    const worker = readCode("worker/index.ts");
    expect(worker).toMatch(
      /agenda\.every\(\s*"1 minute"\s*,\s*"provider-threshold-monitors"\s*\)/,
    );
  });

  it("SecurityAlert schema enum includes every 06 s10 type", () => {
    const source = readCode("database/models/security-alert.model.ts");
    const enumStart = source.indexOf("enum: [");
    expect(enumStart).toBeGreaterThan(-1);
    const enumBlock = source.slice(enumStart, enumStart + 900);
    for (const t of [
      "round_unresolved",
      "provider_signature_invalid",
      "contest_stuck_finalizing",
      "prize_pool_mismatch",
      "provider_callback_failure_rate",
      "provider_latency_high",
      "provider_score_out_of_range",
      "provider_integrity_flag",
      "repeat_challenge_pairing",
      "catalogue_sync_stale",
    ]) {
      // Assert inside the schema enum array, not the type union — a type-only
      // leftover would still satisfy a file-wide toContain.
      expect(enumBlock).toContain(`"${t}"`);
    }
  });

  it("forwards createRound latencyMs from the ChartVolt adapter", () => {
    // THE DEFECT THIS PINS. Transport measured latency and the adapter dropped it,
    // so the p95 monitor never saw a sample from the live provider.
    const source = readCode(
      "lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
    );
    expect(source).toMatch(
      /success:\s*true,\s*data:\s*created,\s*latencyMs:\s*response\.latencyMs/,
    );
  });

  it("ingestion raises SecurityAlerts rather than leaving them to a poller", () => {
    const ingest = readCode("lib/services/games/result-ingestion.service.ts");
    expect(ingest).toMatch(/voidIngestSecurityAlerts/);
    const count = (ingest.match(/voidIngestSecurityAlerts\(/g) ?? []).length;
    // Bearer, HMAC, score range, integrity — at least four call sites.
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it("does not put any-occurrence signature alerts only on the poller", () => {
    const monitors = readCode(
      "lib/services/game-providers/provider-threshold-monitors.service.ts",
    );
    expect(monitors).not.toMatch(/provider_signature_invalid/);
    expect(monitors).not.toMatch(/provider_score_out_of_range/);
  });
});
