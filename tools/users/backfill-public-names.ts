/**
 * Replace real names stored on leaderboards, challenges, friendships and chats with each
 * player's public name (their username, or the generated `Player_xxxxxx` fallback).
 *
 * NOT YET RUN ANYWHERE. Report-only until `--apply`.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/users/backfill-public-names.ts
 *
 *   Apply:
 *     npx tsx tools/users/backfill-public-names.ts --apply
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { backfillPublicNames } from "./backfill-public-names-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection has no db handle");

  console.log(
    `\n🔄 Public-name backfill - ${apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"}\n`,
  );

  const outcome = await backfillPublicNames(db, { apply });

  console.log(`  Users:              ${outcome.users}`);
  console.log(`  With a username:    ${outcome.withUsername}`);
  console.log(`  Without a username: ${outcome.withoutUsername} (shown as Player_xxxxxx)`);

  if (apply) {
    console.log(`\n  Synced: ${outcome.synced}, failed: ${outcome.failed}`);
    for (const [key, value] of Object.entries(outcome.totals)) {
      console.log(`    ${key}: ${value} row(s) rewritten`);
    }
  } else {
    console.log("\n  📋 Re-run with --apply to rewrite the stored name copies.");
  }
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
