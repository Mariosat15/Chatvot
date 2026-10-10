/**
 * One-off remedy: find and release users silently blocked from entering
 * contests by their suspicion score alone.
 *
 * Why this exists
 * ---------------
 * Before the fix of 2 September 2026, `entry-fraud-gate.service.ts` refused
 * competition and challenge entry whenever `SuspicionScore.totalScore` exceeded
 * `entryBlockThreshold` (default 70). That block was invisible: it created no
 * UserRestriction, sent no notification, appeared on no admin screen, and
 * dismissing the fraud alert did not lower the score. An affected player was
 * locked out with no lever an admin could pull.
 *
 * This releases anyone left in that state. It is a data remedy; the gate change
 * is what stops it recurring.
 *
 * It also carries a second, unrelated migration found the same day - see
 * `--close-challenge-hole` below.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/fraud/fix-entry-blocked-users.ts
 *
 *   Release specific users:
 *     npx tsx tools/fraud/fix-entry-blocked-users.ts --clear <userId> [<userId> ...]
 *
 *   Release everyone the report flags as blocked by score alone:
 *     npx tsx tools/fraud/fix-entry-blocked-users.ts --clear-all-score-blocked
 *
 *   Close the challenge hole on existing restrictions:
 *     npx tsx tools/fraud/fix-entry-blocked-users.ts --close-challenge-hole
 *
 * Reason: clearing is opt-in and never the default, because a suspicion score
 * is a fraud control. An account genuinely under suspicion should be handled
 * with a real suspension, which stays visible and reversible.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import SuspicionScore from "../../database/models/fraud/suspicion-score.model";
import UserRestriction from "../../database/models/user-restriction.model";
import FraudAlert from "../../database/models/fraud/fraud-alert.model";
import FraudSettings from "../../database/models/fraud/fraud-settings.model";

interface BlockedUser {
  userId: string;
  totalScore: number;
  riskLevel: string;
  hasActiveRestriction: boolean;
  openAlerts: number;
  /** True when the score is the ONLY thing keeping them out. */
  blockedByScoreAlone: boolean;
}

async function loadThreshold(): Promise<number> {
  const settings = await FraudSettings.findOne().lean();
  const threshold = (settings as { entryBlockThreshold?: number } | null)
    ?.entryBlockThreshold;
  return typeof threshold === "number" ? threshold : 70;
}

async function findBlockedUsers(threshold: number): Promise<BlockedUser[]> {
  // Reason: the old gate compared with strict `>`, so reproduce that exactly.
  // Using `>=` here would report a user sitting on the threshold as blocked
  // when they never were, and send us chasing a case that does not exist.
  const scores = await SuspicionScore.find({ totalScore: { $gt: threshold } })
    .select({ userId: 1, totalScore: 1, riskLevel: 1 })
    .lean();

  const results: BlockedUser[] = [];

  for (const raw of scores) {
    const score = raw as unknown as {
      userId: string;
      totalScore: number;
      riskLevel: string;
    };

    const [restriction, openAlerts] = await Promise.all([
      UserRestriction.findOne({ userId: score.userId, isActive: true }).lean(),
      FraudAlert.countDocuments({
        $or: [
          { primaryUserId: score.userId },
          { suspiciousUserIds: score.userId },
        ],
        status: { $in: ["pending", "investigating"] },
      }),
    ]);

    const hasActiveRestriction = Boolean(restriction);

    results.push({
      userId: score.userId,
      totalScore: score.totalScore,
      riskLevel: score.riskLevel,
      hasActiveRestriction,
      openAlerts,
      // The stuck case: no restriction an admin could lift, and often no open
      // alert either, so nothing explains the lockout on their dashboard.
      blockedByScoreAlone: !hasActiveRestriction,
    });
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

function report(users: BlockedUser[], threshold: number): void {
  console.log(`\n🔍 Entry-block audit  (entryBlockThreshold = ${threshold})\n`);

  if (users.length === 0) {
    console.log("✅ No user has a suspicion score above the threshold.");
    console.log("   Nobody is being blocked from entry by score.\n");
    return;
  }

  console.log(`Found ${users.length} user(s) with a score above ${threshold}:\n`);

  for (const u of users) {
    const verdict = u.blockedByScoreAlone
      ? "🔴 BLOCKED BY SCORE ALONE - no restriction, admin has no lever"
      : "🟡 also has an active restriction - release via Lift, not this script";

    console.log(`  ${u.userId}`);
    console.log(
      `      score ${u.totalScore}  risk ${u.riskLevel}  openAlerts ${u.openAlerts}`,
    );
    console.log(`      ${verdict}`);
    console.log("");
  }

  const stuck = users.filter((u) => u.blockedByScoreAlone);
  console.log(
    `Summary: ${stuck.length} stuck by score alone, ` +
      `${users.length - stuck.length} with a restriction that lifts normally.\n`,
  );

  if (stuck.length > 0) {
    console.log("To release them, re-run with:");
    console.log(
      `  npx tsx tools/fraud/fix-entry-blocked-users.ts --clear ${stuck
        .map((s) => s.userId)
        .join(" ")}`,
    );
    console.log("or:");
    console.log(
      "  npx tsx tools/fraud/fix-entry-blocked-users.ts --clear-all-score-blocked\n",
    );
  }
}

async function clearScores(userIds: string[]): Promise<void> {
  console.log(`\n🧹 Clearing suspicion scores for ${userIds.length} user(s)\n`);

  for (const userId of userIds) {
    const score = await SuspicionScore.findOne({ userId });

    if (!score) {
      console.log(`  ⏭️  ${userId} - no score document, nothing to clear`);
      continue;
    }

    const before = score.totalScore;

    // Reason: use the model's own resetScore() rather than a raw update, so the
    // reset lands in scoreHistory as an admin reset and the breakdown is
    // cleared consistently. An audit trail matters here - this is a fraud
    // control being switched off for a specific person.
    score.resetScore(
      "Cleared: silently entry-blocked by score with no restriction",
    );
    await score.save();

    console.log(`  ✅ ${userId} - score ${before} → ${score.totalScore}`);
  }

  console.log("");
}

/**
 * Second, separate migration. Until 2 September 2026 `canEnterChallenges`
 * defaulted to TRUE while its four sibling flags defaulted to false, and 10 of
 * the 11 places that create a restriction never set it - so a suspended or
 * banned account could still accept a paid 1v1 challenge.
 *
 * The schema default is now false, which fixes every future restriction. It
 * does NOT fix rows already written: Mongoose persisted the old default, so
 * those documents hold a real stored `true` that is indistinguishable from a
 * deliberate choice by looking at the field alone.
 *
 * Reason for the `reason` filter: exactly one writer ever set this flag on
 * purpose - the duplicate-KYC path, driven by the `duplicateKYCBlockChallenges`
 * setting. Skipping `kyc_fraud` rows is what keeps this migration from
 * overwriting the only genuine intent in the data.
 */
async function closeChallengeHole(apply: boolean): Promise<void> {
  const query = {
    isActive: true,
    canEnterChallenges: true,
    canEnterCompetitions: false,
    reason: { $ne: "kyc_fraud" },
  };

  const affected = await UserRestriction.find(query)
    .select({ userId: 1, restrictionType: 1, reason: 1 })
    .lean();

  console.log(
    `\n🕳️  Challenge hole: ${affected.length} active restriction(s) block competitions but still allow challenges\n`,
  );

  if (affected.length === 0) {
    console.log("✅ Nothing to migrate.\n");
    return;
  }

  for (const raw of affected) {
    const r = raw as unknown as {
      userId: string;
      restrictionType: string;
      reason: string;
    };
    console.log(`  ${r.userId}  ${r.restrictionType}  (${r.reason})`);
  }
  console.log("");

  if (!apply) {
    console.log("Report only. To close it, re-run with:");
    console.log(
      "  npx tsx tools/fraud/fix-entry-blocked-users.ts --close-challenge-hole\n",
    );
    return;
  }

  const result = await UserRestriction.updateMany(query, {
    $set: { canEnterChallenges: false },
  });
  console.log(
    `✅ Updated ${result.modifiedCount} restriction(s) - challenges now blocked too.\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const clearAll = args.includes("--clear-all-score-blocked");
  const closeHole = args.includes("--close-challenge-hole");
  const clearIndex = args.indexOf("--clear");
  const explicitIds =
    clearIndex >= 0
      ? args.slice(clearIndex + 1).filter((a) => !a.startsWith("--"))
      : [];

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI not found in environment");
  }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to database");

  try {
    const threshold = await loadThreshold();
    const blocked = await findBlockedUsers(threshold);

    report(blocked, threshold);

    // Always reported, only applied when asked - same rule as the score clear.
    await closeChallengeHole(closeHole);

    if (clearAll) {
      const ids = blocked
        .filter((u) => u.blockedByScoreAlone)
        .map((u) => u.userId);
      if (ids.length === 0) {
        console.log("Nothing to clear.\n");
      } else {
        await clearScores(ids);
      }
    } else if (explicitIds.length > 0) {
      await clearScores(explicitIds);
    } else {
      console.log("Report only. No changes were made.\n");
    }
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected\n");
  }
}

main().catch((err) => {
  console.error("\n❌ Script failed:", err);
  process.exit(1);
});
