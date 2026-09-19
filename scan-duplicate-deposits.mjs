/**
 * Pre-launch safety scan: are there any DUPLICATE completed deposit credits?
 *
 * The deposit flow now guards against double-crediting with an atomic status
 * claim inside completeDeposit() (lib/actions/trading/wallet.actions.ts). This
 * script is the optional next step: it checks whether the historical data is
 * already clean enough to add a *defense-in-depth* unique index on completed
 * deposits, keyed by the provider's transaction id.
 *
 * It is READ-ONLY. It changes nothing.
 *
 * Run: node scan-duplicate-deposits.mjs
 *
 * If it reports ZERO duplicate groups, it is safe to add a partial unique index
 * such as (run in mongosh, adjust field to whatever your PSPs populate):
 *
 *   db.wallettransactions.createIndex(
 *     { paymentId: 1 },
 *     { unique: true,
 *       partialFilterExpression: {
 *         transactionType: "deposit", status: "completed",
 *         paymentId: { $exists: true, $type: "string" } } }
 *   )
 *
 * If it reports duplicates, DO NOT add the unique index yet — investigate and
 * resolve those rows first (they may indicate a past double-credit).
 */
import "dotenv/config";
import dns from "node:dns";
// Reason: some local resolvers refuse Atlas SRV lookups; prefer public DNS.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Non-fatal: fall back to the system resolver.
}
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI not set in .env");
  process.exit(1);
}

// Provider transaction-id fields a completed deposit may be keyed by. Different
// PSPs populate different fields, so we check each independently.
const KEY_FIELDS = ["paymentId", "providerTransactionId", "paymentIntentId"];

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const txCol = ["wallettransactions", "wallet_transactions"].find((c) =>
    cols.includes(c),
  );
  if (!txCol) {
    console.error("❌ Could not find the wallet transactions collection.");
    process.exit(1);
  }
  console.log(`Using collection: ${txCol}\n`);

  const coll = db.collection(txCol);
  let totalDuplicateGroups = 0;

  for (const field of KEY_FIELDS) {
    // Group completed deposits by the key field; report any key used more than
    // once (that would be a double-credit for the same provider payment).
    const dupes = await coll
      .aggregate([
        {
          $match: {
            transactionType: {
              $in: ["deposit", "manual_deposit_credit"],
            },
            status: "completed",
            [field]: { $exists: true, $ne: null, $type: "string" },
          },
        },
        {
          $group: {
            _id: `$${field}`,
            count: { $sum: 1 },
            ids: { $push: "$_id" },
            userIds: { $addToSet: "$userId" },
            totalCredits: { $sum: "$amount" },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    if (dupes.length === 0) {
      console.log(`✅ ${field}: no duplicate completed deposits.`);
      continue;
    }

    totalDuplicateGroups += dupes.length;
    console.log(
      `🚨 ${field}: ${dupes.length} duplicate group(s) found (possible double-credit):`,
    );
    for (const d of dupes) {
      console.log(
        `   ${field}=${d._id} × ${d.count}  users=${d.userIds.join(",")}  ` +
          `credits=${d.totalCredits}  txIds=${d.ids
            .map((x) => String(x))
            .join(",")}`,
      );
    }
    console.log("");
  }

  console.log("\n──────────────────────────────────────────────");
  if (totalDuplicateGroups === 0) {
    console.log(
      "✅ CLEAN: no duplicate completed deposits on any key field.\n" +
        "   It is safe to add the defense-in-depth unique index (see header).",
    );
  } else {
    console.log(
      `🚨 ${totalDuplicateGroups} duplicate group(s) total.\n` +
        "   Do NOT add the unique index until these are investigated/resolved.",
    );
  }

  await client.close();
};

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
