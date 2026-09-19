/**
 * Fails the build when the two apps' copies of a model have drifted apart.
 *
 * Usage:
 *   npm run check:mirrors           fail on drift (CI, pre-push)
 *   npm run check:mirrors -- --list report everything, always exit 0
 *
 * Reason this is a build gate rather than a report: the drift it looks for has already
 * happened once and was found by hand months later. The games work introduces a field
 * that decides which settlement code runs against a contest holding real prize money,
 * so a silent divergence there pays the wrong players.
 */
import path from "path";
import { buildReport, formatPair } from "./compare";
import { ALLOWLIST } from "./allowlist";

function main(): void {
  const listOnly = process.argv.includes("--list");
  const repoRoot = path.resolve(__dirname, "..", "..");
  const report = buildReport(repoRoot);

  const { totals, drifted, pairs, mainOnlyFiles, adminOnlyFiles } = report;

  console.log("");
  console.log("Model mirror check");
  console.log(
    `  ${totals.mainModels} models in the main app, ${totals.adminModels} in apps/admin, ${totals.mirrored} mirrored`,
  );
  console.log(
    `  ${pairs.length - drifted.length} agree, ${drifted.length} drifted`,
  );

  const allowed = pairs.reduce((sum, pair) => sum + pair.allowedCount, 0);
  if (allowed > 0) {
    console.log(
      `  ${allowed} difference(s) suppressed by the allowlist (${ALLOWLIST.length} entr${ALLOWLIST.length === 1 ? "y" : "ies"})`,
    );
  }

  const skipped = pairs.flatMap((pair) =>
    pair.skippedEnums.map((enumPath) => `${pair.relativePath}:${enumPath}`),
  );
  if (skipped.length > 0) {
    console.log(
      `  ${skipped.length} enum(s) not statically comparable, so not checked`,
    );
    if (listOnly) {
      for (const entry of skipped) console.log(`      ${entry}`);
    }
  }

  if (listOnly) {
    if (mainOnlyFiles.length > 0) {
      console.log("");
      console.log(`  Only in the main app (${mainOnlyFiles.length}):`);
      for (const file of mainOnlyFiles) console.log(`      ${file}`);
    }
    if (adminOnlyFiles.length > 0) {
      console.log("");
      console.log(`  Only in apps/admin (${adminOnlyFiles.length}):`);
      for (const file of adminOnlyFiles) console.log(`      ${file}`);
    }
  }

  if (drifted.length === 0) {
    console.log("");
    console.log("  OK - every mirrored model agrees.");
    console.log("");
    return;
  }

  console.log("");
  console.log(
    `DRIFT in ${drifted.length} mirrored model${drifted.length === 1 ? "" : "s"}:`,
  );
  console.log("");
  for (const pair of drifted) {
    console.log(formatPair(pair));
    console.log("");
  }

  console.log("How to fix:");
  console.log(
    "  Add the missing field or enum value to the copy that lacks it. Only ever add -",
  );
  console.log(
    "  removing an enum value orphans every document already storing it.",
  );
  console.log(
    "  If a difference is deliberate, record it in tools/model-mirror/allowlist.ts",
  );
  console.log("  with a reason.");
  console.log("");

  if (!listOnly) {
    process.exitCode = 1;
  }
}

main();
