/**
 * X9 / E7 — automatic provider kill switch.
 *
 * Pins: evidence classification, streak → status, 15-minute disable, WhiteLabel
 * flag, SecurityAlert once, Agenda schedule, and that idle traffic does not kill.
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

import GameProvider from "../../database/models/games/game-provider.model";
import GameRound from "../../database/models/games/game-round.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import { MOCK_PROVIDER_KEY } from "../../lib/services/game-providers/adapters/mock.adapter";
import {
  classifyProviderEvidence,
  nextHealthState,
  KILL_SWITCH_DOWN_MS,
  KILL_SWITCH_DOWN_STREAK,
  KILL_SWITCH_DEGRADED_STREAK,
} from "../../lib/services/game-providers/provider-kill-switch.service";

// Reason: declare the parameters. A zero-arg mock makes `mock.calls` a tuple of
// length 0, so reading `calls[0][0]` — which is how the alert's contents are
// asserted below — fails to typecheck while the test itself passes.
const recordAlert = vi.fn(async (..._args: unknown[]) => ({ _id: "alert" }));

vi.mock("@/lib/services/security/security-alert.service", () => ({
  recordSecurityAlert: (...args: unknown[]) => recordAlert(...args),
}));

const { runProviderKillSwitch } = await import(
  "../../lib/services/game-providers/provider-kill-switch.service"
);

const COLLECTIONS = [
  "game_provider",
  "game_round",
  "provider_event",
  "whitelabels",
];

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

describe("classifyProviderEvidence", () => {
  it("treats no finished rounds as no_evidence (idle must not kill)", () => {
    expect(
      classifyProviderEvidence({
        completed: 0,
        unresolved: 0,
        endedWithoutResult: 0,
        signatureInvalid: 0,
        scored: 0,
      }),
    ).toBe("no_evidence");
  });

  it("fails when every finished round produced no score", () => {
    expect(
      classifyProviderEvidence({
        completed: 0,
        unresolved: 2,
        endedWithoutResult: 1,
        signatureInvalid: 0,
        scored: 0,
      }),
    ).toBe("fail");
  });

  it("fails on signature_invalid with nothing scored", () => {
    expect(
      classifyProviderEvidence({
        completed: 0,
        unresolved: 0,
        endedWithoutResult: 0,
        signatureInvalid: 3,
        scored: 0,
      }),
    ).toBe("fail");
  });

  it("passes when completed rounds exist and unresolved share is low", () => {
    expect(
      classifyProviderEvidence({
        completed: 10,
        unresolved: 0,
        endedWithoutResult: 1,
        signatureInvalid: 0,
        scored: 10,
      }),
    ).toBe("ok");
  });
});

describe("nextHealthState", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("does not change streak or status on no_evidence", () => {
    const next = nextHealthState({
      evidence: "no_evidence",
      previousStreak: 4,
      previousStatus: "degraded",
      previousDownSince: null,
      now,
    });
    expect(next).toEqual({
      streak: 4,
      healthStatus: "degraded",
      healthDownSince: null,
    });
  });

  it("resets to healthy on ok", () => {
    const downSince = new Date("2026-09-20T11:00:00.000Z");
    const next = nextHealthState({
      evidence: "ok",
      previousStreak: 8,
      previousStatus: "down",
      previousDownSince: downSince,
      now,
    });
    expect(next).toEqual({
      streak: 0,
      healthStatus: "healthy",
      healthDownSince: null,
    });
  });

  it("reaches degraded at three failures and down at five", () => {
    let state = nextHealthState({
      evidence: "fail",
      previousStreak: KILL_SWITCH_DEGRADED_STREAK - 1,
      previousStatus: "healthy",
      previousDownSince: null,
      now,
    });
    expect(state.healthStatus).toBe("degraded");
    expect(state.healthDownSince).toBeNull();

    state = nextHealthState({
      evidence: "fail",
      previousStreak: KILL_SWITCH_DOWN_STREAK - 1,
      previousStatus: "degraded",
      previousDownSince: null,
      now,
    });
    expect(state.healthStatus).toBe("down");
    expect(state.healthDownSince).toEqual(now);
  });

  it("keeps the original healthDownSince across further down probes", () => {
    const first = new Date("2026-09-20T11:40:00.000Z");
    const next = nextHealthState({
      evidence: "fail",
      previousStreak: 10,
      previousStatus: "down",
      previousDownSince: first,
      now,
    });
    expect(next.healthDownSince).toEqual(first);
  });
});

describe("runProviderKillSwitch", () => {
  async function seedEnabledProvider(overrides: Record<string, unknown> = {}) {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: true,
      healthStatus: "healthy",
      healthFailureStreak: 0,
      ...overrides,
    });
    await WhiteLabel.create({
      siteName: "Test",
      externalGamesEnabled: true,
      gameProviders: [
        {
          providerKey: MOCK_PROVIDER_KEY,
          enabled: true,
          baseUrl: "https://mock.example",
          displayName: "Mock",
        },
      ],
    });
  }

  it("does not disable an idle enabled provider", async () => {
    await seedEnabledProvider();
    const summary = await runProviderKillSwitch(new Date());
    expect(summary.disabled).toBe(0);
    expect(recordAlert).not.toHaveBeenCalled();

    const row = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ enabled?: boolean; healthFailureStreak?: number }>();
    expect(row?.enabled).toBe(true);
    expect(row?.healthFailureStreak).toBe(0);
  });

  /** A round of failure evidence, so `no_evidence` does not freeze the prior state. */
  async function seedFailureEvidence() {
    await GameRound.create({
      roundId: `cv_rnd_kill_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: "mock",
      gameKey: `provider:${MOCK_PROVIDER_KEY}:mock`,
      userId: new mongoose.Types.ObjectId().toString(),
      contestType: "competition",
      contestId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      mode: "ranked",
      status: "unresolved",
      expiresAt: new Date(Date.now() + 60_000),
      pollAttempts: 0,
    });
  }

  /**
   * THE DEFAULT, AND IT IS THE ONE THAT CHANGED (owner decision, 20 Sep 2026).
   *
   * The platform may watch and must shout; it may not take a provider off sale
   * on its own. This is deliberately asserted as a pair with the test below:
   * asserting only that a flagless provider survives is equally green against a
   * worker that has stopped noticing outages altogether, which is why the alert
   * is required here rather than merely permitted.
   */
  it("alerts but does NOT disable when automatic response was never enabled", async () => {
    const downSince = new Date(Date.now() - KILL_SWITCH_DOWN_MS - 60_000);
    await seedEnabledProvider({
      healthStatus: "down",
      healthFailureStreak: KILL_SWITCH_DOWN_STREAK,
      healthDownSince: downSince,
    });
    await seedFailureEvidence();

    const summary = await runProviderKillSwitch(new Date());
    expect(summary.disabled).toBe(0);
    expect(summary.withheld).toBe(1);
    expect(recordAlert).toHaveBeenCalledTimes(1);

    const row = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ enabled?: boolean; outageAlertedAt?: Date }>();
    expect(row?.enabled).toBe(true);
    expect(row?.outageAlertedAt).toBeInstanceOf(Date);

    // Still enabled, so the worker examines it again every minute. The alert is
    // claimed per outage episode rather than per pass, or an unattended outage
    // pages somebody sixty times an hour and the next real one is ignored.
    recordAlert.mockClear();
    const again = await runProviderKillSwitch(new Date());
    expect(again.disabled).toBe(0);
    expect(again.withheld).toBe(1);
    expect(recordAlert).not.toHaveBeenCalled();
  });

  it("disables after sustained down and alerts once", async () => {
    const downSince = new Date(Date.now() - KILL_SWITCH_DOWN_MS - 60_000);
    await seedEnabledProvider({
      healthStatus: "down",
      healthFailureStreak: KILL_SWITCH_DOWN_STREAK,
      healthDownSince: downSince,
      autoOutageResponseEnabled: true,
    });

    await seedFailureEvidence();

    const summary = await runProviderKillSwitch(new Date());
    expect(summary.disabled).toBe(1);
    expect(summary.withheld).toBe(0);
    expect(recordAlert).toHaveBeenCalledTimes(1);
    expect(recordAlert.mock.calls[0][0]).toMatchObject({
      alertType: "provider_kill_switch",
      severity: "critical",
      provider: MOCK_PROVIDER_KEY,
    });

    const row = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ enabled?: boolean }>();
    expect(row?.enabled).toBe(false);

    const settings = await WhiteLabel.findOne()
      .select("gameProviders")
      .lean<{ gameProviders?: { providerKey: string; enabled?: boolean }[] }>();
    const entry = settings?.gameProviders?.find(
      (p) => p.providerKey === MOCK_PROVIDER_KEY,
    );
    expect(entry?.enabled).toBe(false);

    // Second pass must not alert again — provider is no longer enabled.
    recordAlert.mockClear();
    const again = await runProviderKillSwitch(new Date());
    expect(again.disabled).toBe(0);
    expect(recordAlert).not.toHaveBeenCalled();
  });

  it("does not disable when down for under 15 minutes", async () => {
    const downSince = new Date(Date.now() - KILL_SWITCH_DOWN_MS / 2);
    await seedEnabledProvider({
      healthStatus: "down",
      healthFailureStreak: KILL_SWITCH_DOWN_STREAK,
      healthDownSince: downSince,
    });

    await GameRound.create({
      roundId: `cv_rnd_kill_early_${Date.now()}`,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: "mock",
      gameKey: `provider:${MOCK_PROVIDER_KEY}:mock`,
      userId: new mongoose.Types.ObjectId().toString(),
      contestType: "competition",
      contestId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      mode: "ranked",
      status: "unresolved",
      expiresAt: new Date(Date.now() + 60_000),
      pollAttempts: 0,
    });

    const summary = await runProviderKillSwitch(new Date());
    expect(summary.disabled).toBe(0);
    expect(recordAlert).not.toHaveBeenCalled();

    const row = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    }).lean<{ enabled?: boolean }>();
    expect(row?.enabled).toBe(true);
  });

  it("skips providers with no registered adapter", async () => {
    await GameProvider.create({
      providerKey: "unknown-vendor",
      displayName: "Unknown",
      baseUrl: "https://example.com",
      enabled: true,
    });
    const summary = await runProviderKillSwitch(new Date());
    expect(summary.skipped).toBe(1);
    expect(summary.disabled).toBe(0);
  });
});

describe("worker wiring", () => {
  it("defines and schedules the job every minute", () => {
    const src = readFileSync(
      join(process.cwd(), "worker/index.ts"),
      "utf8",
    );
    expect(src).toMatch(/agenda\.define\("provider-kill-switch"/);
    expect(src).toMatch(
      /agenda\.every\("1 minute", "provider-kill-switch"\)/,
    );
  });

  it("SecurityAlert schema enum includes provider_kill_switch", () => {
    const src = readFileSync(
      join(process.cwd(), "database/models/security-alert.model.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Reason: the type union alone is not enough — Mongoose rejects writes against the
    // enum array. Assert inside the enum: block so a type-only mention cannot satisfy.
    const enumBlock = stripped.match(/enum:\s*\[([\s\S]*?)\]/);
    expect(enumBlock?.[1]).toMatch(/"provider_kill_switch"/);
  });

  it("disable claims with enabled true so a retry cannot double-alert", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "lib/services/game-providers/provider-kill-switch.service.ts",
      ),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Match the findOneAndUpdate filter specifically — a bare `enabled: true` elsewhere
    // (querying candidates) must not cover for a missing claim.
    expect(stripped).toMatch(
      /findOneAndUpdate\(\s*\{\s*providerKey,\s*enabled:\s*true\s*\}/,
    );
  });
});
