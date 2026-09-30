#!/usr/bin/env npx tsx
/**
 * CLI for the Gamemaster Program v2 step-1 migration: label legacy referral rows with
 * their source and swap `userId_1` for the partial unique `userId_active_unique`.
 *
 * Default is report-only. Pass --apply to write.
 *
 * Usage:
 *   npx tsx tools/gamemaster/backfill-affiliation-source.ts
 *   npx tsx tools/gamemaster/backfill-affiliation-source.ts --apply
 */

import mongoose from "mongoose";
import { migrateAffiliationSource } from "./backfill-affiliation-source-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(apply ? "APPLY mode" : "REPORT-ONLY (pass --apply to write)");

  const result = await migrateAffiliationSource(apply);
  console.log(JSON.stringify(result, null, 2));
  if (result.refusedReason) console.warn(`⚠️ ${result.refusedReason}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
