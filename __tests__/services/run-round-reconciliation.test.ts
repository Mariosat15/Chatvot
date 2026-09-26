/**
 * X9 / E7 — scheduled reconciliation orchestrator.
 *
 * The decision logic is already pinned in round-lifecycle.test.ts. This suite pins the
 * CALLER: config loading, practice skip, challenge defaults, batch isolation, and that
 * the Agenda worker actually schedules the job.
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
import crypto from "crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose, { Types } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

import GameRound from "../../database/models/games/game-round.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import Competition from "../../database/models/trading/competition.model";
import Challenge from "../../database/models/trading/challenge.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { getProviderAdapter } from "../../lib/services/game-providers/registry";
import { createRound } from "../../lib/services/games/round.service";
import type { RoundContestConfig } from "../../lib/services/games/round-types";

const notifySend = vi.fn(async () => ({ _id: "notif" }));
const recordAlert = vi.fn(async () => ({ _id: "alert" }));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    send: (...args: unknown[]) => notifySend(...args),
  },
}));

vi.mock("@/lib/services/security/security-alert.service", () => ({
  recordSecurityAlert: (...args: unknown[]) => recordAlert(...args),
}));

const { runRoundReconciliation } = await import(
  "../../lib/services/games/run-round-reconciliation"
);

const CALLBACK_SECRET = "test-callback-secret";
const CALLBACK_TOKEN = "test-callback-token";
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "game_round",
  "provider_event",
  "provider_game",
  "competitions",
  "challenges",
  "whitelabels",
];

let mock: MockProviderAdapter;

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
  await ensureCollections(COLLECTIONS);
  notifySend.mockClear();
  recordAlert.mockClear();

  mock = getProviderAdapter(MOCK_PROVIDER_KEY) as MockProviderAdapter;
  mock.reset();
  mock.configure({ callbackSecret: CALLBACK_SECRET });

  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [{ providerKey: MOCK_PROVIDER_KEY, enabled: true }],
    gameProviderCredentials: [
      {
        providerKey: MOCK_PROVIDER_KEY,
        environment: "sandbox",
        callbackToken: CALLBACK_TOKEN,
        callbackSecret: CALLBACK_SECRET,
      },
    ],
  });

  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Trivia",
    family: "independent",
    supportsCompetition: true,
    supportsOneVsOne: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    scoreRange: { min: 0, max: 1000 },
    providerStatus: "active",
    chartvoltEnabled: true,
  });
});

function contestConfig(
  overrides: Partial<RoundContestConfig> = {},
): RoundContestConfig {
  return {
    attemptsPolicy: "single",
    playWindowEnd: new Date(Date.now() + 60 * 60 * 1000),
    maxDurationSeconds: 300,
    contentSeed: "seed-abc",
    ...overrides,
  };
}

async function seedCompetition(overrides: Record<string, unknown> = {}) {
  const unique = crypto.randomBytes(4).toString("hex");
  const competition = await Competition.create({
    name: `X9 fixture ${unique}`,
    slug: `x9-fixture-${unique}`,
    description: "Round reconciliation fixture",
    status: "active",
    entryFee: 0,
    prizePool: 0,
    startingCapital: 10_000,
    maxParticipants: 10,
    minParticipants: 2,
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    registrationDeadline: new Date(Date.now() + 30 * 60 * 1000),
    createdBy: new Types.ObjectId().toString(),
    playWindowStart: new Date(Date.now() - 60_000),
    playWindowEnd: new Date(Date.now() + 60 * 60 * 1000),
    resultGracePeriodSeconds: 600,
    unresolvedRoundPolicy: "score_zero",
    gameType: "provider",
    gameKey: GAME_KEY,
    ...overrides,
  });
  return competition._id as Types.ObjectId;
}

async function seedChallenge() {
  const unique = crypto.randomBytes(4).toString("hex");
  const challenge = await Challenge.create({
    slug: `x9-challenge-${unique}`,
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: {
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
    },
    attemptsPolicy: "single",
    challengerId: new Types.ObjectId().toString(),
    challengerName: "Ada",
    challengerEmail: "ada@example.com",
    challengedId: new Types.ObjectId().toString(),
    challengedName: "Bo",
    challengedEmail: "bo@example.com",
    entryFee: 10,
    prizePool: 20,
    platformFeePercentage: 10,
    platformFeeAmount: 2,
    winnerPrize: 18,
    acceptDeadline: new Date(Date.now() - 60_000),
    startTime: new Date(Date.now() - 30 * 60 * 1000),
    endTime: new Date(Date.now() + 30 * 60 * 1000),
    duration: 60,
    status: "active",
    assetClasses: [],
    allowedSymbols: [],
    blockedSymbols: [],
    leverage: { enabled: false, min: 1, max: 10 },
    rules: {
      rankingMethod: "pnl",
      tieBreaker1: "trades_count",
      minimumTrades: 1,
      disqualifyOnLiquidation: false,
    },
    maxPositionSize: 50,
    maxOpenPositions: 10,
    allowShortSelling: false,
    marginCallThreshold: 100,
  });
  return challenge._id as Types.ObjectId;
}

async function launchCompetitionRound(
  contestId: Types.ObjectId,
  config: RoundContestConfig = contestConfig(),
) {
  const outcome = await createRound({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId: new Types.ObjectId().toString(),
    contestType: "competition",
    contestId,
    config,
    returnUrl: "https://chartvolt.test/return",
    parentOrigin: "https://chartvolt.test",
    resultCallbackUrl: "https://chartvolt.test/api/games/providers/mock/events",
  });
  if (!outcome.success) {
    throw new Error(`Fixture round could not be created: ${outcome.error}`);
  }
  return outcome;
}

async function launchChallengeRound(contestId: Types.ObjectId) {
  const outcome = await createRound({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId: new Types.ObjectId().toString(),
    contestType: "challenge",
    contestId,
    config: contestConfig({
      playWindowEnd: new Date(Date.now() + 30 * 60 * 1000),
    }),
    returnUrl: "https://chartvolt.test/return",
    parentOrigin: "https://chartvolt.test",
    resultCallbackUrl: "https://chartvolt.test/api/games/providers/mock/events",
  });
  if (!outcome.success) {
    throw new Error(`Challenge round could not be created: ${outcome.error}`);
  }
  return outcome;
}

async function expireRound(roundId: string, expiresAt: Date) {
  await GameRound.updateOne({ roundId }, { $set: { expiresAt } });
}

describe("runRoundReconciliation - competition poll path", () => {
  it("loads contest config and scores a withheld callback through the shared door", async () => {
    const contestId = await seedCompetition();
    const created = await launchCompetitionRound(contestId);
    await expireRound(created.roundId, new Date(Date.now() - 5 * 60 * 1000));

    mock.configure({ score: 512 });
    const summary = await runRoundReconciliation(new Date());

    expect(summary.examined).toBe(1);
    expect(summary.reconciled).toBe(1);
    expect(summary.resolved).toBe(1);

    const settled = await GameRound.findOne({ roundId: created.roundId });
    expect(settled?.status).toBe("completed");
    expect(settled?.rawScore).toBe(512);
    expect(settled?.resultSource).toBe("poll");
  });
});

describe("runRoundReconciliation - stage 4 alerts and notifies", () => {
  it("marks unresolved, records a critical alert, and notifies the player", async () => {
    // Reason: create while the window is open (launch refuses a closed contest), then
    // move the contest clock into the past so stage 4 applies on the next pass.
    const contestId = await seedCompetition({
      unresolvedRoundPolicy: "score_zero",
    });
    const created = await launchCompetitionRound(contestId);
    await Competition.updateOne(
      { _id: contestId },
      {
        $set: {
          playWindowEnd: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      },
    );
    await expireRound(created.roundId, new Date(Date.now() - 60 * 60 * 1000));

    mock.configure({ failureModes: ["callback_never_arrives"] });
    const summary = await runRoundReconciliation(new Date());

    expect(summary.policiesApplied).toBe(1);
    expect(summary.alerts).toBe(1);
    expect(summary.notified).toBe(1);

    const settled = await GameRound.findOne({ roundId: created.roundId });
    expect(settled?.status).toBe("unresolved");

    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "round_unresolved",
        severity: "critical",
        source: "round-reconciliation",
      }),
    );
    expect(notifySend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "round_unresolved",
        variables: expect.objectContaining({
          policyApplied: "score_zero",
        }),
      }),
    );
  });
});

describe("runRoundReconciliation - practice rounds skipped", () => {
  it("does not reconcile a practice round even when expired", async () => {
    const outcome = await createRound({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: new Types.ObjectId().toString(),
      contestType: "practice",
      contestId: null,
      config: contestConfig(),
      returnUrl: "https://chartvolt.test/return",
    parentOrigin: "https://chartvolt.test",
      resultCallbackUrl: "https://chartvolt.test/api/games/providers/mock/events",
    });
    if (!outcome.success) {
      throw new Error(`Practice round failed: ${outcome.error}`);
    }
    await expireRound(outcome.roundId, new Date(Date.now() - 5 * 60 * 1000));

    const summary = await runRoundReconciliation(new Date());
    expect(summary.examined).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.reconciled).toBe(0);
    // Reason: without the practice early-return, resolveRoundConfig fails on a null
    // contestId and fires a critical alert — so asserting no alert is what makes the
    // skip guard probeable rather than covered by the missing-contest path.
    expect(summary.alerts).toBe(0);
    expect(recordAlert).not.toHaveBeenCalled();

    const still = await GameRound.findOne({ roundId: outcome.roundId });
    expect(still?.status).toBe("launched");
  });
});

describe("runRoundReconciliation - challenge config", () => {
  it("uses score_zero and the derived challenge window", async () => {
    const challengeId = await seedChallenge();
    const created = await launchChallengeRound(challengeId);

    // Push past grace: challenge endTime is +30min, grace default 600s, so move
    // endTime into the past and expire the round.
    await Challenge.updateOne(
      { _id: challengeId },
      {
        $set: {
          startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      },
    );
    await expireRound(created.roundId, new Date(Date.now() - 60 * 60 * 1000));

    mock.configure({ failureModes: ["callback_never_arrives"] });
    const summary = await runRoundReconciliation(new Date());

    expect(summary.policiesApplied).toBe(1);
    const settled = await GameRound.findOne({ roundId: created.roundId });
    expect(settled?.status).toBe("unresolved");
    expect(notifySend).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          policyApplied: "score_zero",
          actionUrl: `/challenges/${String(challengeId)}`,
        }),
      }),
    );
  });
});

describe("runRoundReconciliation - orphan contest", () => {
  it("voids a live round whose challenge is gone and does not re-alert on the next pass", async () => {
    const challengeId = await seedChallenge();
    const created = await launchChallengeRound(challengeId);
    await expireRound(created.roundId, new Date(Date.now() - 60 * 60 * 1000));
    await Challenge.deleteOne({ _id: challengeId });

    const first = await runRoundReconciliation(new Date());
    expect(first.orphansRetired).toBe(1);
    expect(first.alerts).toBe(1);
    expect(first.skipped).toBe(0);

    const voided = await GameRound.findOne({ roundId: created.roundId });
    expect(voided?.status).toBe("voided");
    expect(voided?.resultSource).toBe("manual");
    expect(voided?.integrityFlags).toContain("orphan_contest_missing");

    expect(recordAlert).toHaveBeenCalledTimes(1);
    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "round_unresolved",
        severity: "critical",
        reason: expect.stringContaining("not found"),
      }),
    );

    recordAlert.mockClear();
    const second = await runRoundReconciliation(new Date());
    expect(second.examined).toBe(0);
    expect(second.orphansRetired).toBe(0);
    expect(recordAlert).not.toHaveBeenCalled();
  });
});

describe("runRoundReconciliation - batch isolation", () => {
  it("voids an orphan and still settles the sibling contest in the same pass", async () => {
    const goodId = await seedCompetition();
    const good = await launchCompetitionRound(goodId);
    await Competition.updateOne(
      { _id: goodId },
      {
        $set: {
          playWindowEnd: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      },
    );
    await expireRound(good.roundId, new Date(Date.now() - 60 * 60 * 1000));

    // Orphan round: contestId points at nothing.
    const orphanId = new Types.ObjectId();
    const orphanRoundId = `orphan-${crypto.randomBytes(4).toString("hex")}`;
    await GameRound.create({
      roundId: orphanRoundId,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: new Types.ObjectId().toString(),
      contestType: "competition",
      contestId: orphanId,
      attemptNumber: 1,
      mode: "ranked",
      status: "launched",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      pollAttempts: 0,
    });

    mock.configure({ failureModes: ["callback_never_arrives"] });
    const summary = await runRoundReconciliation(new Date());

    expect(summary.examined).toBe(2);
    expect(summary.orphansRetired).toBe(1);
    expect(summary.policiesApplied).toBe(1);
    // Reason: the old path counted orphans as skipped forever; retiring them must not
    // inflate skipped, or a probe that restores skip-only stays green against this suite.
    expect(summary.skipped).toBe(0);

    const orphan = await GameRound.findOne({ roundId: orphanRoundId });
    expect(orphan?.status).toBe("voided");

    const settled = await GameRound.findOne({ roundId: good.roundId });
    expect(settled?.status).toBe("unresolved");
  });
});

describe("worker schedules round-reconciliation", () => {
  it("defines and schedules the job every minute", () => {
    const source = readFileSync(
      join(process.cwd(), "worker/index.ts"),
      "utf8",
    );
    // Reason: strip nothing — these strings must appear as live schedule calls, not
    // only in comments. Count both so a define without every (or the reverse) fails.
    expect(source).toMatch(
      /agenda\.define\(\s*["']round-reconciliation["']/,
    );
    expect(source).toMatch(
      /agenda\.every\(\s*["']1 minute["']\s*,\s*["']round-reconciliation["']/,
    );
  });

  it("job file imports the orchestrator", () => {
    const source = readFileSync(
      join(process.cwd(), "worker/jobs/round-reconciliation.job.ts"),
      "utf8",
    );
    expect(source).toContain("runRoundReconciliation");
    expect(source).toContain("run-round-reconciliation");
  });
});
