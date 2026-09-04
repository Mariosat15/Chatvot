import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

import GameRound, {
  canTransitionRound,
  LIVE_ROUND_STATUSES,
} from "../../database/models/games/game-round.model";
import ProviderEvent from "../../database/models/games/provider-event.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import Competition from "../../database/models/trading/competition.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { getProviderAdapter } from "../../lib/services/game-providers/registry";
import { createRound, attemptsPermitted } from "../../lib/services/games/round.service";
import { ingestProviderCallback } from "../../lib/services/games/result-ingestion.service";
import {
  decideStage,
  reconcileRound,
  DEFAULT_RESULT_GRACE_SECONDS,
} from "../../lib/services/games/reconciliation.service";
import type { RoundContestConfig } from "../../lib/services/games/round-types";

/**
 * X3 - round lifecycle and result ingestion.
 *
 * The exit gate for this phase is chapter 07 section 9: "Do not move past E2 until those
 * tests are green." Rehearsals 1-6 are in scope here and each has its own `describe` block
 * named after the checklist line, so a reader can match test to plan without guessing.
 * Rehearsals 7-10 belong to later phases and are listed at the bottom as documented gaps
 * rather than silently missing.
 *
 * Everything runs against the mock adapter (chapter 18 tier 4). Reason: a provider that
 * always works proves nothing. Every interesting case here is the provider misbehaving.
 */

const CALLBACK_SECRET = "test-callback-secret";
const CALLBACK_TOKEN = "test-callback-token";
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "game_round",
  "provider_event",
  "provider_game",
  "competitions",
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

  // The registry holds a single mock instance; reset it so failure modes never leak
  // between tests. A leaked `provider_down` produces a failure in an unrelated test that
  // reads as a real bug.
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
        apiKey: CALLBACK_TOKEN,
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
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    scoreRange: { min: 0, max: 1000 },
    providerStatus: "active",
    chartvoltEnabled: true,
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────────────────

/** A contest far enough in the future that rounds are startable. */
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

/**
 * Reason this satisfies the WHOLE competition schema rather than the fields these tests
 * read: `slug`, `startTime`, `endTime` and `startingCapital` play no part in a round, but
 * Mongoose validates the document and not the subset a test cares about. Trimming a fixture
 * to what looks relevant is how 34 tests fail at once for one unrelated reason.
 */
async function seedCompetition(status = "active"): Promise<Types.ObjectId> {
  const unique = crypto.randomBytes(4).toString("hex");
  const competition = await Competition.create({
    name: `X3 fixture ${unique}`,
    slug: `x3-fixture-${unique}`,
    description: "Round lifecycle fixture",
    status,
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
  });
  return competition._id as Types.ObjectId;
}

/**
 * Builds a callback that passes every transport gate.
 *
 * Signs TWICE on purpose: `x-signature` for the engine's own HMAC (gate 5) and
 * `x-mock-signature` for the adapter's check (gate 5b). Both gates are mandatory, so a
 * helper that satisfied only one would make every happy-path test fail for the wrong reason.
 */
function signedCallback(args: {
  roundId: string;
  eventId?: string;
  score?: number;
  status?: string;
  secret?: string;
  timestampSeconds?: number;
}) {
  const eventId = args.eventId ?? `evt_${crypto.randomBytes(6).toString("hex")}`;
  const rawBody = JSON.stringify({
    eventId,
    roundId: args.roundId,
    score: args.score,
    status: args.status ?? "completed",
    occurredAt: new Date().toISOString(),
  });

  const secret = args.secret ?? CALLBACK_SECRET;
  const engineSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return {
    eventId,
    rawBody,
    headers: {
      authorization: `Bearer ${CALLBACK_TOKEN}`,
      "x-event-id": eventId,
      "x-timestamp": String(
        args.timestampSeconds ?? Math.floor(Date.now() / 1000),
      ),
      "x-signature": `sha256=${engineSignature}`,
      "x-mock-signature": mock.sign(rawBody),
    } as Record<string, string>,
  };
}

async function launchRound(
  contestId: Types.ObjectId | null,
  config: RoundContestConfig = contestConfig(),
  userId = new Types.ObjectId().toString(),
) {
  const outcome = await createRound({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId,
    contestType: contestId ? "competition" : "practice",
    contestId,
    config,
    returnUrl: "https://chartvolt.test/return",
    resultCallbackUrl: "https://chartvolt.test/api/games/providers/mock/events",
  });
  if (!outcome.success) {
    throw new Error(`Fixture round could not be created: ${outcome.error}`);
  }
  return { ...outcome, userId };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Round creation, idempotency and the attempts policy
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("RoundService - creation and attempts", () => {
  it("creates a launched round and returns a launch URL", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    expect(created.attemptNumber).toBe(1);
    expect(created.idempotent).toBe(false);
    expect(created.launchUrl).toContain(created.roundId);

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.status).toBe("launched");
    expect(round?.gameKey).toBe(GAME_KEY);
    expect(round?.providerRoundId).toBe(`mock_${created.roundId}`);
  });

  it("freezes the config at creation rather than referring to the contest later", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(
      contestId,
      contestConfig({
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 3,
        settings: { difficulty: "hard" },
      }),
    );

    const round = await GameRound.findOne({ roundId: created.roundId });
    const snapshot = round?.configSnapshot as {
      attemptsPolicy?: string;
      attemptsAllowed?: number;
      settings?: Record<string, unknown>;
    };

    // Reason this matters: an operator can change the contest's difficulty while a round is
    // in flight. Without the snapshot the round would be judged by rules the player never
    // saw, and there would be no record of which rules those were.
    expect(snapshot.attemptsPolicy).toBe("best_of_n");
    expect(snapshot.attemptsAllowed).toBe(3);
    expect(snapshot.settings?.difficulty).toBe("hard");
  });

  it("answers a double-click with the same round, not a second one", async () => {
    const contestId = await seedCompetition();
    const userId = new Types.ObjectId().toString();
    const config = contestConfig();

    const first = await launchRound(contestId, config, userId);
    const second = await launchRound(contestId, config, userId);

    expect(second.roundId).toBe(first.roundId);
    expect(second.idempotent).toBe(true);
    expect(second.launchUrl).toBe(first.launchUrl);
    expect(await GameRound.countDocuments({ contestId, userId })).toBe(1);
  });

  it("refuses a second attempt under the `single` policy", async () => {
    const contestId = await seedCompetition();
    const userId = new Types.ObjectId().toString();
    const created = await launchRound(contestId, contestConfig(), userId);

    // Resolve the first round so the live-round path is not what refuses this.
    const callback = signedCallback({ roundId: created.roundId, score: 500 });
    await ingestProviderCallback({ providerKey: MOCK_PROVIDER_KEY, ...callback });

    const second = await createRound({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId,
      contestType: "competition",
      contestId,
      config: contestConfig(),
      returnUrl: "https://chartvolt.test/return",
      resultCallbackUrl: "https://chartvolt.test/cb",
    });

    expect(second.success).toBe(false);
    if (!second.success) expect(second.refusal).toBe("attempts_exhausted");
  });

  it("ignores attemptsAllowed when the policy is `single`", () => {
    // Reason: a contest configured `single` with attemptsAllowed 3 must mean one. Trusting
    // the number would hand out extra attempts because of a misconfiguration.
    expect(
      attemptsPermitted({
        attemptsPolicy: "single",
        attemptsAllowed: 3,
        playWindowEnd: new Date(),
      }),
    ).toBe(1);
    expect(
      attemptsPermitted({
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 3,
        playWindowEnd: new Date(),
      }),
    ).toBe(3);
  });

  it("does NOT consume an attempt when the provider refuses to create the round", async () => {
    const contestId = await seedCompetition();
    const userId = new Types.ObjectId().toString();
    mock.configure({ failureModes: ["round_creation_fails"] });

    const failed = await createRound({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId,
      contestType: "competition",
      contestId,
      config: contestConfig(),
      returnUrl: "https://chartvolt.test/return",
      resultCallbackUrl: "https://chartvolt.test/cb",
    });

    expect(failed.success).toBe(false);
    if (!failed.success) expect(failed.refusal).toBe("provider_error");

    // The pending row must be GONE. A surviving row of any status permanently burns this
    // attempt number, because of the unique index on { contestId, userId, attemptNumber }.
    expect(await GameRound.countDocuments({ contestId, userId })).toBe(0);

    // And the player can still play once the provider recovers.
    mock.configure({ failureModes: [] });
    const retried = await launchRound(contestId, contestConfig(), userId);
    expect(retried.attemptNumber).toBe(1);
  });

  it("refuses to start a round that could not finish inside the play window", async () => {
    const contestId = await seedCompetition();
    const outcome = await createRound({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: new Types.ObjectId().toString(),
      contestType: "competition",
      contestId,
      // 300s game, 60s of window left.
      config: contestConfig({ playWindowEnd: new Date(Date.now() + 60_000) }),
      returnUrl: "https://chartvolt.test/return",
      resultCallbackUrl: "https://chartvolt.test/cb",
    });

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("play_window_too_short");
  });

  it("never sets expiresAt beyond the play window end", async () => {
    const contestId = await seedCompetition();
    const playWindowEnd = new Date(Date.now() + 4 * 60 * 1000);
    const created = await launchRound(
      contestId,
      // A 300s game with 240s of window: it fits the 240s check only because
      // maxDuration is smaller here, so expiry must clamp to the window.
      contestConfig({ playWindowEnd, maxDurationSeconds: 120 }),
    );

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round!.expiresAt.getTime()).toBeLessThanOrEqual(playWindowEnd.getTime());
  });

  it("refuses when the provider is disabled, and writes no round", async () => {
    const contestId = await seedCompetition();
    await WhiteLabel.updateOne({}, { $set: { externalGamesEnabled: false } });

    const outcome = await createRound({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId: new Types.ObjectId().toString(),
      contestType: "competition",
      contestId,
      config: contestConfig(),
      returnUrl: "https://chartvolt.test/return",
      resultCallbackUrl: "https://chartvolt.test/cb",
    });

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("provider_unavailable");
    expect(await GameRound.countDocuments({})).toBe(0);
  });
});

describe("One live round per player per contest", () => {
  it("is enforced by the database, not only by the service", async () => {
    const contestId = await seedCompetition();
    const userId = new Types.ObjectId().toString();
    const created = await launchRound(contestId, contestConfig(), userId);

    // Reason for writing directly rather than through the service: the point of this test
    // is that the INDEX holds even if a future caller forgets the check. Chapter 07
    // section 4 claims database enforcement, and the only index chapter 04 documents
    // prevents a duplicate attempt NUMBER - attempt 1 launched plus attempt 2 launched
    // satisfies it perfectly. This asserts the partial unique index that closes that.
    await expect(
      GameRound.create({
        roundId: `${created.roundId}_second`,
        providerKey: MOCK_PROVIDER_KEY,
        gameCode: GAME_CODE,
        gameKey: GAME_KEY,
        userId,
        contestType: "competition",
        contestId,
        attemptNumber: 2,
        mode: "ranked",
        status: "launched",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("permits a new round once the previous one is terminal", async () => {
    const contestId = await seedCompetition();
    const userId = new Types.ObjectId().toString();
    const created = await launchRound(contestId, contestConfig(), userId);

    await GameRound.updateOne(
      { roundId: created.roundId },
      { $set: { status: "completed", rawScore: 400 } },
    );

    const next = await GameRound.create({
      roundId: `${created.roundId}_next`,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId,
      contestType: "competition",
      contestId,
      attemptNumber: 2,
      mode: "ranked",
      status: "launched",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(next.attemptNumber).toBe(2);
  });

  it("does not apply to practice, which has no contest", async () => {
    const userId = new Types.ObjectId().toString();
    // Two live practice rounds must both be allowed: the partial index is scoped to a real
    // objectId contestId, so a null contestId is exempt. Without that scoping every
    // practice round would collide with the player's previous one.
    for (const suffix of ["a", "b"]) {
      await GameRound.create({
        roundId: `practice_${userId}_${suffix}`,
        providerKey: MOCK_PROVIDER_KEY,
        gameCode: GAME_CODE,
        gameKey: GAME_KEY,
        userId,
        contestType: "practice",
        contestId: null,
        attemptNumber: suffix === "a" ? 1 : 2,
        mode: "practice",
        status: "launched",
        expiresAt: new Date(Date.now() + 60_000),
      });
    }
    expect(
      await GameRound.countDocuments({ userId, status: "launched" }),
    ).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Rehearsal 4 - "Send the same callback twice, confirm one score"
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Rehearsal 4 - duplicate callback yields one score", () => {
  it("records one score and reports success both times", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const callback = signedCallback({ roundId: created.roundId, score: 640 });

    const first = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...callback,
    });
    const second = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...callback,
    });

    expect(first.result).toBe("scored");
    // Idempotent SUCCESS, not an error: a retried delivery has done nothing wrong, and
    // answering with a failure invites a third attempt.
    expect(second.accepted).toBe(true);
    expect(second.result).toBe("duplicate_ignored");

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.rawScore).toBe(640);
    expect(round?.status).toBe("completed");
    expect(await ProviderEvent.countDocuments({ eventId: callback.eventId })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Rehearsal 3 - "Send a callback with a bad signature, confirm rejection and alert"
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Rehearsal 3 - bad signature is rejected and alerted", () => {
  it("rejects a wrong HMAC, stores the event, and writes no score", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const forged = signedCallback({
      roundId: created.roundId,
      score: 900,
      secret: "the-wrong-secret",
    });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...forged,
    });

    expect(outcome.accepted).toBe(false);
    expect(outcome.result).toBe("signature_invalid");
    expect(outcome.alert).toBe("critical");

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.rawScore).toBeUndefined();
    expect(round?.status).toBe("launched");

    // Store-before-process: the rejected event is EVIDENCE and must survive. A verify-first
    // implementation would have discarded exactly the payload an incident needs.
    const event = await ProviderEvent.findOne({ eventId: forged.eventId });
    expect(event).not.toBeNull();
    expect(event?.signatureValid).toBe(false);
    expect(event?.processingResult).toBe("signature_invalid");
    expect(event?.rawBody).toBe(forged.rawBody);
  });

  it("rejects a bad bearer token before it ever looks at the round", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const callback = signedCallback({ roundId: created.roundId, score: 300 });
    callback.headers.authorization = "Bearer not-the-token";

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...callback,
    });
    expect(outcome.result).toBe("signature_invalid");
    expect(outcome.alert).toBe("critical");
  });

  it("rejects a replayed event on the timestamp window", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const stale = signedCallback({
      roundId: created.roundId,
      score: 300,
      timestampSeconds: Math.floor(Date.now() / 1000) - 10 * 60,
    });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...stale,
    });
    expect(outcome.result).toBe("timestamp_rejected");

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.rawScore).toBeUndefined();
  });

  it("rejects a future timestamp as well as an old one", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const future = signedCallback({
      roundId: created.roundId,
      timestampSeconds: Math.floor(Date.now() / 1000) + 10 * 60,
    });

    // Reason: a one-sided check would accept a replay dated next year forever.
    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...future,
    });
    expect(outcome.result).toBe("timestamp_rejected");
  });

  it("rejects when the adapter's own check fails, even with a valid engine signature", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const callback = signedCallback({ roundId: created.roundId, score: 300 });

    // Gate 5b. Both signature checks are mandatory, so an adapter refusal must stand on
    // its own - otherwise a provider with a stricter scheme could not enforce it.
    mock.configure({ failureModes: ["bad_signature"] });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...callback,
    });
    expect(outcome.result).toBe("signature_invalid");
  });

  it("refuses a callback for a provider that is not enabled", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    const callback = signedCallback({ roundId: created.roundId, score: 300 });

    await WhiteLabel.updateOne(
      {},
      { $set: { "gameProviders.0.enabled": false } },
    );

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...callback,
    });
    expect(outcome.result).toBe("provider_unknown");
    // Still stored. A callback arriving for a provider we just disabled is exactly the
    // event an operator will want to read.
    expect(await ProviderEvent.countDocuments({ eventId: callback.eventId })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Rehearsal 5 - "Send two different scores for one round, confirm the discrepancy alert"
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Rehearsal 5 - conflicting scores", () => {
  it("keeps the first valid score and flags the second", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    const first = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 700 }),
    });
    expect(first.result).toBe("scored");

    // A different eventId, so this is not a duplicate - it is a genuine second claim.
    const second = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 950 }),
    });

    expect(second.result).toBe("conflict_flagged");
    expect(second.alert).toBe("critical");

    const round = await GameRound.findOne({ roundId: created.roundId });
    // FIRST VALID RESULT WINS. The score that was ranked has to stay the score stored.
    expect(round?.rawScore).toBe(700);
    expect(round?.conflictFlaggedAt).toBeInstanceOf(Date);
  });

  it("treats a re-sent IDENTICAL score as settled, not as a conflict", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 700 }),
    });
    const repeat = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 700 }),
    });

    // Reason this is separated from the conflict case: a provider re-sending the same
    // result under a new event id is a delivery quirk, not a discrepancy. Alerting on it
    // would train operators to ignore the alert that matters.
    expect(repeat.result).toBe("round_not_acceptable");
    expect(repeat.accepted).toBe(true);
    expect(repeat.alert).toBeUndefined();

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.conflictFlaggedAt).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Rehearsal 6 - "Send a result after settlement, confirm it is recorded but not applied"
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Rehearsal 6 - result after settlement", () => {
  it("records a late result, does not apply it, and alerts", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    await Competition.updateOne({ _id: contestId }, { $set: { status: "completed" } });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 880 }),
    });

    expect(outcome.result).toBe("late_recorded_not_applied");
    expect(outcome.alert).toBe("critical");

    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.lateResultRecordedAt).toBeInstanceOf(Date);
    // Deliberately untouched: applying it would change a ranking that has already paid.
    expect(round?.rawScore).toBeUndefined();
    expect(round?.status).toBe("launched");
  });

  it("treats `finalizing` as closed, which is the dangerous window", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    // Reason this is its own test: the obvious check is "is the contest completed", and it
    // is not enough. During `finalizing` ranking is being computed from participant
    // scores, so a score written now may or may not be included depending purely on
    // timing - worse than a late result, because a late result is at least consistently
    // excluded and alerted while this one is a coin flip that leaves no trace.
    await Competition.updateOne({ _id: contestId }, { $set: { status: "finalizing" } });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 880 }),
    });

    expect(outcome.result).toBe("late_recorded_not_applied");
    const round = await GameRound.findOne({ roundId: created.roundId });
    expect(round?.rawScore).toBeUndefined();
  });

  it("fails closed when the contest has vanished", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    await Competition.deleteOne({ _id: contestId });

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 500 }),
    });

    // Wrongly refusing produces an alert somebody reads; wrongly accepting produces a
    // payout nobody can trace.
    expect(outcome.accepted).toBe(false);
    expect(outcome.result).toBe("round_not_acceptable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Score range - chapter 18 tier 4, "score outside range is rejected"
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Score range validation", () => {
  it("rejects an impossible score and marks the round unresolved", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 999_999 }),
    });

    expect(outcome.result).toBe("score_out_of_range");
    expect(outcome.alert).toBe("critical");

    const round = await GameRound.findOne({ roundId: created.roundId });
    // Unresolved rather than left launched: the net must stop polling it and the contest's
    // unresolved policy must decide what the player gets.
    expect(round?.status).toBe("unresolved");
    expect(round?.rawScore).toBeUndefined();
  });

  it("rejects a score below the declared minimum", async () => {
    await ProviderGame.updateOne(
      { gameKey: GAME_KEY },
      { $set: { "scoreRange.min": 100 } },
    );
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 5 }),
    });
    expect(outcome.result).toBe("score_out_of_range");
  });

  it("accepts the exact boundary values", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    // Reason: an off-by-one here silently disqualifies a perfect score, which is the one
    // result a player is most likely to dispute.
    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 1000 }),
    });
    expect(outcome.result).toBe("scored");
  });

  it("fails closed when the title is missing from the catalogue", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    await ProviderGame.deleteMany({});

    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 500 }),
    });
    expect(outcome.result).toBe("score_out_of_range");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Rehearsals 1 and 2 - the reconciliation safety net
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("decideStage - chapter 07 section 2.2's schedule", () => {
  const playWindowEnd = new Date("2026-01-01T12:00:00Z");
  const config = {
    unresolvedRoundPolicy: "score_zero" as const,
    resultGracePeriodSeconds: 600,
    playWindowEnd,
  };
  const round = {
    expiresAt: new Date("2026-01-01T11:00:00Z"),
    lastPolledAt: undefined,
    pollAttempts: 0,
  };

  it("waits inside the first two minutes, because the callback is still in flight", () => {
    // Reason: polling here races the provider's own webhook, and both paths would apply
    // the same result - which gate 8 then has to reject as a conflict. Waiting turns a
    // self-inflicted alert into no alert.
    expect(
      decideStage(round, config, new Date("2026-01-01T11:01:00Z")),
    ).toBe("wait");
  });

  it("polls between two and ten minutes past expiry", () => {
    expect(
      decideStage(round, config, new Date("2026-01-01T11:05:00Z")),
    ).toBe("poll");
  });

  it("sweeps urgently once past the play window", () => {
    expect(
      decideStage(round, config, new Date("2026-01-01T12:05:00Z")),
    ).toBe("final_sweep");
  });

  it("applies the policy once grace has expired", () => {
    expect(
      decideStage(round, config, new Date("2026-01-01T12:11:00Z")),
    ).toBe("apply_policy");
  });

  it("backs off between polls, and caps the backoff", () => {
    const polled = {
      expiresAt: new Date("2026-01-01T11:00:00Z"),
      lastPolledAt: new Date("2026-01-01T11:05:00Z"),
      pollAttempts: 1,
    };
    // 60s of backoff after one attempt: not yet.
    expect(
      decideStage(polled, config, new Date("2026-01-01T11:05:30Z")),
    ).toBe("wait");
    expect(
      decideStage(polled, config, new Date("2026-01-01T11:06:30Z")),
    ).toBe("poll");

    // Reason for the cap: an uncapped exponential eventually exceeds the grace window, so
    // the round would sit un-polled until stage 3 - the backoff would have quietly
    // disabled stage 2 altogether.
    const hammered = { ...polled, pollAttempts: 30 };
    expect(
      decideStage(hammered, config, new Date("2026-01-01T11:11:00Z")),
    ).toBe("poll");
  });

  it("uses the documented 600-second default when no grace is configured", () => {
    expect(DEFAULT_RESULT_GRACE_SECONDS).toBe(600);
    expect(
      decideStage(
        round,
        { unresolvedRoundPolicy: "score_zero", playWindowEnd },
        new Date("2026-01-01T12:09:00Z"),
      ),
    ).toBe("final_sweep");
  });
});

describe("Rehearsal 1 - a withheld callback is resolved by reconciliation", () => {
  it("pulls the result and scores it through the same single door", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    // The provider never posts. Push the round past its expiry so stage 2 applies.
    await GameRound.updateOne(
      { roundId: created.roundId },
      { $set: { expiresAt: new Date(Date.now() - 5 * 60 * 1000) } },
    );
    const round = await GameRound.findOne({ roundId: created.roundId });

    mock.configure({ score: 512 });
    const outcome = await reconcileRound(round!, {
      unresolvedRoundPolicy: "score_zero",
      playWindowEnd: new Date(Date.now() + 30 * 60 * 1000),
    });

    expect(outcome.stage).toBe("poll");
    expect(outcome.resolved).toBe(true);

    const settled = await GameRound.findOne({ roundId: created.roundId });
    expect(settled?.status).toBe("completed");
    expect(settled?.rawScore).toBe(512);
    // Proves the poller went through the shared apply function rather than its own path.
    expect(settled?.resultSource).toBe("poll");
    expect(settled?.pollAttempts).toBe(1);
  });

  it("keeps polling without resolving while the round is genuinely still running", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    await GameRound.updateOne(
      { roundId: created.roundId },
      { $set: { expiresAt: new Date(Date.now() - 5 * 60 * 1000) } },
    );
    const round = await GameRound.findOne({ roundId: created.roundId });

    mock.configure({ failureModes: ["callback_never_arrives"] });
    const outcome = await reconcileRound(round!, {
      unresolvedRoundPolicy: "score_zero",
      playWindowEnd: new Date(Date.now() + 30 * 60 * 1000),
    });

    // Warning and not critical: a failed pull is expected on a lost webhook and the net has
    // more stages to run. It only becomes critical if stage 4 is reached.
    expect(outcome.resolved).toBe(false);
    expect(outcome.alert).toBe("warning");
    const still = await GameRound.findOne({ roundId: created.roundId });
    expect(still?.status).toBe("launched");
  });
});

describe("Rehearsal 2 - a permanently withheld callback fires the policy and alerts", () => {
  async function runPolicyStage(policy: "score_zero" | "exclude" | "hold_and_alert") {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    await GameRound.updateOne(
      { roundId: created.roundId },
      { $set: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) } },
    );
    const round = await GameRound.findOne({ roundId: created.roundId });

    mock.configure({ failureModes: ["callback_never_arrives"] });
    return {
      roundId: created.roundId,
      outcome: await reconcileRound(round!, {
        unresolvedRoundPolicy: policy,
        // Grace long expired.
        playWindowEnd: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }),
    };
  }

  it("score_zero settles on time, tells the player, and alerts", async () => {
    const { roundId, outcome } = await runPolicyStage("score_zero");

    expect(outcome.stage).toBe("apply_policy");
    expect(outcome.policyApplied).toBe("score_zero");
    // Always critical. Reaching stage 4 means the provider never reported and all three
    // earlier stages failed - an integration problem even when the contest settles cleanly.
    expect(outcome.alert).toBe("critical");
    // A round silently scored zero is indistinguishable, from the player's seat, from
    // being cheated.
    expect(outcome.notifyPlayer).toBe(true);
    expect(outcome.refundOwed).toBeUndefined();
    expect(outcome.blocksSettlement).toBeUndefined();

    const round = await GameRound.findOne({ roundId });
    expect(round?.status).toBe("unresolved");
  });

  it("exclude names the refund settlement owes, rather than paying it here", async () => {
    const { outcome } = await runPolicyStage("exclude");

    // Reason the money is NOT moved here: paying it would put a second money writer beside
    // settlement - the shape of the four-writer entry defect Stage 0 spent a phase
    // unifying. Removing a player also changes the prize pool, so the refund and the
    // re-split are one transaction that belongs to settlement (X5).
    expect(outcome.policyApplied).toBe("exclude");
    expect(outcome.refundOwed).toBe(true);
    expect(outcome.notifyPlayer).toBe(true);
  });

  it("hold_and_alert blocks settlement until a human decides", async () => {
    const { outcome } = await runPolicyStage("hold_and_alert");
    expect(outcome.policyApplied).toBe("hold_and_alert");
    expect(outcome.blocksSettlement).toBe(true);
  });

  it("does not overwrite a round that reported just before the policy ran", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);
    await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      ...signedCallback({ roundId: created.roundId, score: 321 }),
    });
    const round = await GameRound.findOne({ roundId: created.roundId });

    const outcome = await reconcileRound(round!, {
      unresolvedRoundPolicy: "score_zero",
      playWindowEnd: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    // Reachable when a callback lands between the stage decision and the policy write.
    expect(outcome.resolved).toBe(true);
    const settled = await GameRound.findOne({ roundId: created.roundId });
    expect(settled?.status).toBe("completed");
    expect(settled?.rawScore).toBe(321);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The status lifecycle, which chapter 04 lists without a transition table
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("Round status transitions", () => {
  it("permits the documented forward moves", () => {
    expect(canTransitionRound("pending", "launched")).toBe(true);
    for (const terminal of ["completed", "abandoned", "expired", "voided"] as const) {
      expect(canTransitionRound("launched", terminal)).toBe(true);
    }
    expect(canTransitionRound("launched", "unresolved")).toBe(true);
  });

  it("refuses to reopen a terminal round", () => {
    // Reason: a round that has reported must not be reopened, or the score that was ranked
    // stops being the score that is stored. A late or conflicting result is recorded on the
    // document instead.
    for (const terminal of ["completed", "abandoned", "expired", "voided"] as const) {
      expect(canTransitionRound(terminal, "completed")).toBe(false);
      expect(canTransitionRound(terminal, "launched")).toBe(false);
    }
  });

  it("lets an unresolved round still accept a real result", () => {
    // Stage 2 or 3 can pull a score for a round the policy already gave up on, and
    // honouring it beats keeping a zero we know is wrong.
    expect(canTransitionRound("unresolved", "completed")).toBe(true);
    // But never back to in-flight.
    expect(canTransitionRound("unresolved", "launched")).toBe(false);
  });

  it("agrees with the live-status list the partial index depends on", () => {
    // Reason: the partial unique index is built from LIVE_ROUND_STATUSES. If a status were
    // added to the enum and not to that list, two live rounds would silently become
    // possible again - and nothing else in the suite would notice.
    expect([...LIVE_ROUND_STATUSES].sort()).toEqual(["launched", "pending"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Invariants
// ─────────────────────────────────────────────────────────────────────────────────────────

describe("X3 invariants", () => {
  it("seam 4: the round services never touch TradingPosition", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.join(process.cwd(), "lib", "services", "games");

    for (const file of fs.readdirSync(dir)) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      const imports = source.match(/from\s+["'][^"']+["']/g) ?? [];
      for (const line of imports) {
        // Chapter 11 seam 4 is a HARD rule: round state lives in game_round. A provider
        // round written to TradingPosition would be a row of nulls that the trading
        // engine's own queries would then pick up and try to value.
        expect(line).not.toMatch(/trading-position|position\.model/i);
      }
    }
  });

  it("invariant 6: nothing in the round path can move money", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.join(process.cwd(), "lib", "services", "games");
    const banned = /wallet|credit-wallet|payout|ledger|transaction\.model/i;

    for (const file of fs.readdirSync(dir)) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      const imports = source.match(/from\s+["'][^"']+["']/g) ?? [];
      for (const line of imports) {
        expect(line).not.toMatch(banned);
      }
    }
  });

  it("gameKey is immutable once written", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    const round = await GameRound.findOne({ roundId: created.roundId });
    round!.gameKey = "provider:someone-else:other-game";
    await round!.save();

    // Reason: gameKey is the join key for every historical stat. A recompute would move
    // history silently, and it cannot be corrected in place afterwards.
    const reread = await GameRound.findOne({ roundId: created.roundId });
    expect(reread?.gameKey).toBe(GAME_KEY);
  });

  it("stores every event before processing it, including ones it rejects", async () => {
    const contestId = await seedCompetition();
    const created = await launchRound(contestId);

    const cases = [
      signedCallback({ roundId: created.roundId, secret: "wrong" }),
      signedCallback({
        roundId: created.roundId,
        timestampSeconds: Math.floor(Date.now() / 1000) - 3600,
      }),
      signedCallback({ roundId: "cv_rnd_does_not_exist" }),
    ];

    for (const c of cases) {
      await ingestProviderCallback({ providerKey: MOCK_PROVIDER_KEY, ...c });
      const stored = await ProviderEvent.findOne({ eventId: c.eventId });
      expect(stored).not.toBeNull();
      expect(stored?.rawBody).toBe(c.rawBody);
      expect(stored?.processedAt).toBeInstanceOf(Date);
    }
  });

  it("refuses an event with no id, before storing anything", async () => {
    const rawBody = JSON.stringify({ roundId: "cv_rnd_x", score: 1 });
    const outcome = await ingestProviderCallback({
      providerKey: MOCK_PROVIDER_KEY,
      rawBody,
      headers: {
        authorization: `Bearer ${CALLBACK_TOKEN}`,
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-signature": `sha256=${crypto
          .createHmac("sha256", CALLBACK_SECRET)
          .update(rawBody)
          .digest("hex")}`,
      },
    });

    // Reason it is refused rather than stored under a generated id: an id we invented
    // cannot deduplicate anything, so the provider's retry would look like a new event and
    // score twice.
    expect(outcome.result).toBe("unparseable");
    expect(await ProviderEvent.countDocuments({})).toBe(0);
  });
});

/**
 * DOCUMENTED GAPS - rehearsals 7 to 10 are deliberately not here.
 *
 * Recorded rather than omitted, so the next reader does not assume they were forgotten:
 *
 *   7. Provider offline mid-contest, pause and extend  -> E7/X8 (chapter 07 s3.2)
 *   8. Cancel a contest with live rounds, full refunds  -> E4/X5 (chapter 07 s5)
 *   9. Settle the same contest twice, winners paid once -> E4/X5 (chapter 07 s6 #4)
 *   10. End-to-end with real small entry fees           -> E9 pilot
 *
 * All four need contest settlement or a running worker, neither of which exists yet. Every
 * one of them is a money test, so building half of it now against a stub would produce a
 * green test that proves nothing about the path real money will take.
 */
