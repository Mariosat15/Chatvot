/**
 * Finds Game Master subscriptions whose cached `limits` disagree with the package they are
 * subscribed to.
 *
 * WHY THIS EXISTS. Fixing R31 stopped the apps STORING a 0% package as 5%, but a code fix
 * only affects future writes: every subscription created or renewed before 5 September 2026
 * still holds whatever the old `|| 5` expression produced, and a stored 5 is indistinguishable
 * from a deliberate 5. That is the same trap as the `canEnterChallenges` default - the schema
 * change fixed ten writers with one line and the existing rows still needed a migration.
 *
 * WHY IT IS REPORT-ONLY BY DEFAULT, and why it may well find nothing. Both money paths read
 * the CURRENT package first and treat `limits` as the fallback for a deleted package, so a
 * stale cached rate is only ever paid to a Game Master whose package has since been removed.
 * Renewal also re-copies from the package, so an auto-renewing subscription repairs itself
 * within one period. That makes this a report worth reading before deciding to write
 * anything, rather than a migration to run blind.
 *
 *   npx tsx tools/gamemaster/report-stale-subscription-limits.ts
 *   npx tsx tools/gamemaster/report-stale-subscription-limits.ts --apply
 */

import mongoose from "mongoose";
import { buildSubscriptionLimits } from "../../lib/services/gamemaster/subscription-limits";

interface CachedLimits {
  maxCompetitionsPerDay?: number;
  maxUsersPerCompetition?: number;
  referralFeePercentage?: number;
  canCreateCompetitions?: boolean;
  canEarnFromChallenges?: boolean;
  challengeReferralFeePercentage?: number;
}

interface Divergence {
  userId: string;
  packageName: string;
  field: string;
  stored: unknown;
  fromPackage: unknown;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connecting.");

  console.log(
    `\n📊 Game Master cached limits - ${apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"}\n`,
  );

  const subscriptions = await db
    .collection("gamemastersubscriptions")
    .find({ packageId: { $exists: true, $ne: null } })
    .toArray();

  const divergences: Divergence[] = [];
  let missingPackages = 0;
  let repaired = 0;

  for (const sub of subscriptions) {
    let pkg: Record<string, unknown> | null = null;
    try {
      pkg = await db
        .collection("marketplaceitems")
        .findOne({ _id: new mongoose.Types.ObjectId(String(sub.packageId)) });
    } catch {
      // An unparseable packageId is a different problem and is not this tool's business to
      // guess at. Counted, never rewritten.
      missingPackages += 1;
      continue;
    }

    // Reason this is reported rather than repaired: the cached limits are the ONLY remaining
    // record of what this Game Master was sold once the package is gone. Overwriting them
    // with a default would destroy the very thing the cache exists to preserve.
    if (!pkg?.gameMasterConfig) {
      missingPackages += 1;
      continue;
    }

    const expected = buildSubscriptionLimits(
      pkg.gameMasterConfig as CachedLimits,
    );
    const stored = (sub.limits ?? {}) as CachedLimits;
    const changes: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(expected)) {
      if (stored[field as keyof CachedLimits] !== value) {
        divergences.push({
          userId: String(sub.userId),
          packageName: String(sub.packageName ?? pkg.name ?? "unknown"),
          field,
          stored: stored[field as keyof CachedLimits],
          fromPackage: value,
        });
        changes[`limits.${field}`] = value;
      }
    }

    if (apply && Object.keys(changes).length > 0) {
      await db
        .collection("gamemastersubscriptions")
        .updateOne({ _id: sub._id }, { $set: changes });
      repaired += 1;
    }
  }

  console.log(`   Subscriptions with a package:   ${subscriptions.length}`);
  console.log(`   Package deleted or unreadable:  ${missingPackages}`);
  console.log(`   Field-level divergences:        ${divergences.length}\n`);

  for (const d of divergences) {
    const flag = d.field === "referralFeePercentage" ? " 💰" : "";
    console.log(
      `   ${d.userId}  ${d.packageName}  ${d.field}: stored ${JSON.stringify(d.stored)} vs package ${JSON.stringify(d.fromPackage)}${flag}`,
    );
  }

  if (divergences.length === 0) {
    console.log("   ✅ Every cached limit matches its package.\n");
  } else if (apply) {
    console.log(`\n   ✅ ${repaired} subscription(s) updated.\n`);
  } else {
    console.log(
      `\n   ➡️  Re-run with --apply to copy the package values onto these subscriptions.\n`,
    );
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("❌ Report failed:", error);
  process.exit(1);
});
