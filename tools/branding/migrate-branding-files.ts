/**
 * Move every stored image out of `WhiteLabel.brandingFiles` and into `branding_asset`.
 *
 * The decision logic is in `migrate-branding-files-core.ts` so a test can drive it against a
 * real database; that file also records what this refuses to touch and why. Read it before
 * running this with `--apply`.
 *
 * NOT YET RUN ANYWHERE. Report-only until `--apply`.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/branding/migrate-branding-files.ts
 *
 *   Apply:
 *     npx tsx tools/branding/migrate-branding-files.ts --apply
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { migrateBrandingFiles } from "./migrate-branding-files-core";

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(
    `\n🖼️  Branding file migration - ${
      apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"
    }\n`,
  );

  const outcome = await migrateBrandingFiles(mongoose.connection, { apply });

  if (outcome.files.length === 0) {
    console.log("The brandingFiles map is empty. Nothing to migrate.\n");
    await mongoose.disconnect();
    return;
  }

  for (const file of outcome.files) {
    const label =
      file.outcome === "already-stored"
        ? "already in the collection, stale map entry"
        : file.outcome === "empty"
          ? "no data stored - left alone"
          : file.outcome === "failed"
            ? `FAILED: ${file.detail}`
            : "copied";
    console.log(`  ${file.filename.padEnd(48)} ${mb(file.bytes).padStart(8)}  ${label}`);
  }

  const failed = outcome.files.filter((f) => f.outcome === "failed").length;

  console.log(
    `\n  ${outcome.files.length} image(s), ${mb(outcome.totalBytes)} of document space.`,
  );
  console.log(
    apply
      ? `  ✅ Cleared ${outcome.cleared} of ${outcome.clearable} map entries.`
      : `  📋 ${outcome.clearable} map entries would be cleared.`,
  );
  if (failed > 0) {
    console.log(
      `  ⚠️  ${failed} entr${failed === 1 ? "y" : "ies"} failed and were LEFT IN THE MAP. Re-run.`,
    );
  }
  if (!apply && outcome.clearable > 0) {
    console.log("\n  Re-run with --apply to write the change.");
  }
  console.log("");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("❌ Migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
