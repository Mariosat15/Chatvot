#!/usr/bin/env npx tsx
/**
 * CLI for backfilling gameKey onto gamemasterearnings (X7 step 5).
 *
 * Default is report-only. Pass --apply to write.
 *
 * Usage:
 *   npx tsx tools/gamemaster/backfill-gm-earning-gamekey.ts
 *   npx tsx tools/gamemaster/backfill-gm-earning-gamekey.ts --apply
 */

import mongoose from "mongoose";
import { backfillGmEarningGameKeys } from "./backfill-gm-earning-gamekey-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(apply ? "APPLY mode" : "REPORT-ONLY (pass --apply to write)");

  const result = await backfillGmEarningGameKeys(apply);
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
