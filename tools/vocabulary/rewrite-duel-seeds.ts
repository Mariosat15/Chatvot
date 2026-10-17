/**
 * Report (and optionally rewrite) seeded landing / hero documents that still say "duel".
 *
 * NOT YET RUN ANYWHERE. Report-only until `--apply`. Owner decision 24 Sep 2026: no
 * production `--apply` is scheduled (NEXT-TASKS P1 #17) — scripts stay report-only.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/vocabulary/rewrite-duel-seeds.ts
 *
 *   Apply (owner / ops only — not scheduled):
 *     npx tsx tools/vocabulary/rewrite-duel-seeds.ts --apply
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { rewriteDuelSeeds } from "./rewrite-duel-seeds-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(
    `\n🗡️  Duel → challenge seed rewrite - ${
      apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"
    }\n`,
  );

  const outcome = await rewriteDuelSeeds(mongoose.connection, { apply });

  if (outcome.documents.length === 0) {
    console.log("No duel tokens found in the three seed collections. Nothing to do.\n");
    await mongoose.disconnect();
    return;
  }

  for (const doc of outcome.documents) {
    console.log(
      `  ${doc.collection}  ${doc.id}  (${doc.hits.length} field${
        doc.hits.length === 1 ? "" : "s"
      })${doc.rewritten ? "  rewritten" : ""}`,
    );
    for (const hit of doc.hits.slice(0, 5)) {
      console.log(`    ${hit.path}`);
      console.log(`      - ${hit.before}`);
      console.log(`      + ${hit.after}`);
    }
    if (doc.hits.length > 5) {
      console.log(`    … ${doc.hits.length - 5} more`);
    }
  }

  console.log(
    `\n  ${outcome.documents.length} document(s), ${outcome.totalHits} field hit(s).`,
  );
  console.log(
    apply
      ? `  ✅ Rewrote ${outcome.totalRewritten} document(s).`
      : `  📋 Re-run with --apply to write the change (not scheduled — owner P1 #17).`,
  );
  console.log("");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("❌", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
