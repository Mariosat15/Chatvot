/**
 * What is allowed to block a player out of paid contests.
 *
 * Written 2 September 2026 after a real incident. An admin elevated a fraud alert to
 * "investigation" and nothing else. The player was then refused entry to a 1v1 challenge
 * with "Entry is temporarily blocked while your account is under review", received no
 * notification, appeared on no admin screen, and stayed blocked after the admin dismissed
 * the alert. The admin had Auto-Suspend switched OFF the whole time.
 *
 * The cause was two independent blocking systems where the platform appeared to have one:
 *
 *   UserRestriction   - visible on the admin's Restricted Users screen, notifies the
 *                       player, and has a Lift button.
 *   SuspicionScore    - raised automatically by fraud detectors. The entry gate refused
 *                       entry above `entryBlockThreshold` (default 70). Invisible to the
 *                       admin, silent to the player, and with no reset anywhere in the
 *                       admin UI, permanent.
 *
 * The second one obeyed no admin setting at all: it read `entryBlockThreshold` and never
 * looked at `autoSuspendEnabled`. So an admin who deliberately left automatic suspension
 * off still got automatic, unliftable lockouts.
 *
 * These tests pin the rule that replaced it: a score escalates for review, and only a
 * restriction blocks. Each one asserts the CODE and REASON the gate returns, not merely
 * that something was allowed or refused - a gate that refuses for a different cause than
 * the test intends would otherwise pass.
 */

import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

// Reason: the harness owns the connection. The real helper would dial the configured
// MONGODB_URI, which in a test run is either absent or, worse, production.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Reason: the gate calls out to IP reputation for VPN/proxy/Tor checks. Left real it would
// make a network call per test and could refuse for IP_BLOCKED, which would make a test
// pass for entirely the wrong reason.
vi.mock("@/lib/services/ip-detection.service", () => ({
  evaluateIpRisk: async () => ({ blocked: false }),
}));

const USER = "6600000000000000000000a1";

const COLLECTIONS = [
  "suspicionscores",
  "userrestrictions",
  "fraudsettings",
  "fraudalerts",
  "devicefingerprints",
  "competitionparticipants",
];

/**
 * Write the fraud settings row the gate and the scoring service both read.
 *
 * Defaults mirror production: review threshold 70, auto-suspend OFF at 90. That "off" is
 * the state the reported incident happened in, so it is the state most tests run in.
 */
async function seedSettings(
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const FraudSettings = (
    await import("@/database/models/fraud/fraud-settings.model")
  ).default;
  await FraudSettings.deleteMany({});
  await FraudSettings.create({
    entryBlockThreshold: 70,
    alertThreshold: 40,
    autoSuspendEnabled: false,
    autoSuspendThreshold: 90,
    deviceFingerprintingEnabled: false,
    // Reason: the schema enforces a minimum of 1, so the throttle cannot be
    // switched off with 0. Set it high enough never to fire - a test that
    // tripped ENTRY_RATE_LIMIT would report a refusal for the wrong cause.
    maxEntriesPerHour: 10000,
    ...overrides,
  });

  // Reason: the settings service caches. Without clearing it the second test in a file
  // silently evaluates the first test's thresholds.
  const { clearFraudSettingsCache } = await import(
    "@/lib/services/fraud-settings.service"
  );
  clearFraudSettingsCache();
}

/** Put a suspicion score on the user, bypassing the scoring service. */
async function seedScore(totalScore: number): Promise<void> {
  const SuspicionScore = (
    await import("@/database/models/fraud/suspicion-score.model")
  ).default;
  await SuspicionScore.create({
    userId: USER,
    totalScore,
    riskLevel: totalScore >= 65 ? "high" : "medium",
  });
}

/**
 * Drive the score above the auto-suspend threshold through the real service, so the
 * auto-restrict branch actually runs.
 *
 * Reason: `addPercentage` caps each detection method individually - deviceMatch 40,
 * ipMatch 30, ipBrowserMatch 35 - so a single call asking for 100 is silently clamped to
 * 40 and lands nowhere near a threshold of 90. This is a trap in both directions: a test
 * expecting a restriction fails confusingly, and a test expecting NO restriction passes
 * without ever exercising the branch it claims to cover. Three methods are needed to
 * cross 90.
 */
async function raiseScoreAboveNinety(): Promise<number> {
  const { SuspicionScoringService } = await import(
    "@/lib/services/fraud/suspicion-scoring.service"
  );

  for (const method of ["deviceMatch", "ipMatch", "ipBrowserMatch"] as const) {
    await SuspicionScoringService.updateScore(USER, {
      method,
      percentage: 100,
      evidence: `test: ${method} forced to its cap`,
    });
  }

  const SuspicionScore = (
    await import("@/database/models/fraud/suspicion-score.model")
  ).default;
  const score = await SuspicionScore.findOne({ userId: USER }).lean();
  return (score as unknown as { totalScore: number }).totalScore;
}

describe("what may block a player from paid contest entry", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(COLLECTIONS);
  }, 120000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await seedSettings();
  });

  describe("the suspicion score, on its own", () => {
    it("does not block entry even at the maximum score of 100", async () => {
      await seedScore(100);

      const { assertEntryFraudGate } = await import(
        "@/lib/services/fraud/entry-fraud-gate.service"
      );
      const result = await assertEntryFraudGate({ userId: USER });

      // Reason: 100 against a threshold of 70 is the most extreme case the old gate
      // could see. If any score-based refusal returns, this is where it shows.
      expect(result.allowed).toBe(true);
      expect(result.code).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it("does not block entry when the score sits just above the review threshold", async () => {
      // 71 against a threshold of 70 - the exact shape of the reported incident, where
      // the old gate's strict `>` comparison began refusing.
      await seedScore(71);

      const { assertEntryFraudGate } = await import(
        "@/lib/services/fraud/entry-fraud-gate.service"
      );
      const result = await assertEntryFraudGate({ userId: USER });

      expect(result.allowed).toBe(true);
    });

    it("never returns the RISK_SCORE_BLOCKED code, at any threshold", async () => {
      // Reason: sweep the threshold rather than trusting one value. A reintroduced block
      // guarded by `if (threshold < 100)` would pass a single-value test at 100.
      const { assertEntryFraudGate } = await import(
        "@/lib/services/fraud/entry-fraud-gate.service"
      );

      for (const threshold of [1, 40, 70, 99]) {
        await seedSettings({ entryBlockThreshold: threshold });
        await seedScore(100);
        const result = await assertEntryFraudGate({ userId: USER });
        expect(result.code).not.toBe("RISK_SCORE_BLOCKED");
        expect(result.allowed).toBe(true);

        const SuspicionScore = (
          await import("@/database/models/fraud/suspicion-score.model")
        ).default;
        await SuspicionScore.deleteMany({});
      }
    });
  });

  describe("a UserRestriction", () => {
    it("blocks competition entry, and says why", async () => {
      const UserRestriction = (
        await import("@/database/models/user-restriction.model")
      ).default;
      await UserRestriction.create({
        userId: USER,
        restrictionType: "suspended",
        reason: "suspicious_activity",
        customReason: "Under review following unusual activity",
        canTrade: false,
        canEnterCompetitions: false,
        canDeposit: false,
        canWithdraw: false,
        restrictedBy: "admin-1",
        isActive: true,
      });

      const { canUserPerformAction } = await import(
        "@/lib/services/user-restriction.service"
      );
      const result = await canUserPerformAction(USER, "enterCompetition");

      expect(result.allowed).toBe(false);
      expect(result.restrictionType).toBe("suspended");
      expect(result.reason).toContain("Under review");
    });

    it("blocks challenges too, without the creator naming the flag", async () => {
      // The defect this pins: `canEnterChallenges` was the only one of the five
      // permission flags defaulting to "allowed", and 10 of the 11 places that create a
      // restriction never set it. So every suspended and banned account could still
      // accept paid 1v1 challenges - the easiest format to abuse, being exactly two
      // players with the pot returning to the pair minus the platform fee.
      //
      // Deliberately omits canEnterChallenges, exactly as those callers do. It passes
      // only because the schema default is now false.
      const UserRestriction = (
        await import("@/database/models/user-restriction.model")
      ).default;
      await UserRestriction.create({
        userId: USER,
        restrictionType: "suspended",
        reason: "multi_accounting",
        canTrade: false,
        canEnterCompetitions: false,
        canDeposit: false,
        canWithdraw: false,
        restrictedBy: "admin-1",
        isActive: true,
      });

      const { canUserPerformAction } = await import(
        "@/lib/services/user-restriction.service"
      );

      expect((await canUserPerformAction(USER, "enterChallenge")).allowed).toBe(
        false,
      );
    });

    it("still honours an explicit decision to allow challenges", async () => {
      // Reason: the duplicate-KYC path sets this flag on purpose, from the
      // `duplicateKYCBlockChallenges` setting. Flipping the default must not override a
      // caller that stated its intent, or that admin setting silently stops working.
      const UserRestriction = (
        await import("@/database/models/user-restriction.model")
      ).default;
      await UserRestriction.create({
        userId: USER,
        restrictionType: "suspended",
        reason: "kyc_fraud",
        canTrade: false,
        canEnterCompetitions: false,
        canEnterChallenges: true,
        canDeposit: false,
        canWithdraw: false,
        restrictedBy: "system",
        isActive: true,
      });

      const { canUserPerformAction } = await import(
        "@/lib/services/user-restriction.service"
      );

      expect((await canUserPerformAction(USER, "enterChallenge")).allowed).toBe(
        true,
      );
      expect(
        (await canUserPerformAction(USER, "enterCompetition")).allowed,
      ).toBe(false);
    });
  });

  describe("auto-suspend, which is the only automatic block left", () => {
    it("creates no restriction while the admin has it switched off", async () => {
      // The reported incident in one assertion: score well past every threshold, the
      // toggle off, and the correct outcome is that nothing restricts the account.
      await seedSettings({
        autoSuspendEnabled: false,
        autoSuspendThreshold: 90,
      });

      const total = await raiseScoreAboveNinety();

      // Reason: assert the score really did cross the threshold before asserting that
      // nothing happened. Without this the test passes whenever the score fails to
      // reach 90 for an unrelated reason - it would keep passing even if auto-suspend
      // started ignoring the toggle entirely, which is the one thing it exists to catch.
      expect(total).toBeGreaterThan(90);

      const UserRestriction = (
        await import("@/database/models/user-restriction.model")
      ).default;
      expect(await UserRestriction.countDocuments({ userId: USER })).toBe(0);

      // And the gate agrees - the account is entirely free to play.
      const { assertEntryFraudGate } = await import(
        "@/lib/services/fraud/entry-fraud-gate.service"
      );
      expect((await assertEntryFraudGate({ userId: USER })).allowed).toBe(true);
    });

    it("creates a liftable restriction that blocks challenges once switched on", async () => {
      await seedSettings({
        autoSuspendEnabled: true,
        autoSuspendThreshold: 90,
      });

      const total = await raiseScoreAboveNinety();
      expect(total).toBeGreaterThan(90);

      const UserRestriction = (
        await import("@/database/models/user-restriction.model")
      ).default;
      const restriction = await UserRestriction.findOne({ userId: USER });

      expect(restriction).not.toBeNull();
      // Reason: assert the flags rather than merely that a row exists. An auto-suspension
      // that leaves paid challenges open is the hole this whole change closes, and a
      // bare existence check would not notice it.
      expect(restriction?.canEnterCompetitions).toBe(false);
      expect(restriction?.canEnterChallenges).toBe(false);
      expect(restriction?.isActive).toBe(true);

      // Reason: assert `expiresAt` by name, and that it is genuinely in the future.
      // The auto-restrict branch used to set `suspensionEndsAt`, which
      // `UserRestriction` does not declare - so Mongoose discarded it and left
      // `expiresAt` unset, which this model defines as a PERMANENT ban. Every
      // automatic suspension was therefore permanent while the reason text and the
      // fraud-history entry both promised 7 days. Accepting either field name here
      // would let that regress unnoticed.
      expect(restriction?.expiresAt).toBeInstanceOf(Date);
      expect(restriction?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("clearing a score", () => {
    it("resets the total and records how much was cleared, and why", async () => {
      // Reason: dismissing an investigation now calls this. Before 2 Sep 2026 dismiss
      // reset only device-fingerprint risk while its own audit note claimed "Risk scores
      // have been reset" - so an admin was told the thing they needed had happened.
      const { SuspicionScoringService } = await import(
        "@/lib/services/fraud/suspicion-scoring.service"
      );
      await SuspicionScoringService.updateScore(USER, {
        method: "deviceMatch",
        percentage: 80,
        evidence: "test: raise before clearing",
      });

      const SuspicionScore = (
        await import("@/database/models/fraud/suspicion-score.model")
      ).default;
      const before = await SuspicionScore.findOne({ userId: USER });
      const previousTotal = before?.totalScore ?? 0;
      expect(previousTotal).toBeGreaterThan(0);

      const cleared = await SuspicionScoringService.resetScore(
        USER,
        "Investigation dismissed as a false positive",
      );

      expect(cleared?.totalScore).toBe(0);

      const after = await SuspicionScore.findOne({ userId: USER }).lean();
      const stored = after as unknown as {
        totalScore: number;
        scoreHistory: Array<{ reason: string; delta: number }>;
      };
      expect(stored.totalScore).toBe(0);

      // The reset must be auditable, and must say how much it removed. `delta` used to
      // be computed after zeroing the total, so it always recorded -0 and the size of
      // the reset was lost.
      const resetEntry = stored.scoreHistory.at(-1);
      expect(resetEntry?.reason).toBe(
        "Investigation dismissed as a false positive",
      );
      expect(resetEntry?.delta).toBe(-previousTotal);
    });
  });
});
