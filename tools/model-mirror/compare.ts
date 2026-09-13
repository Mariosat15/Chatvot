/**
 * Finds mirrored model files and reports how their schemas differ.
 *
 * ChartVolt is two applications sharing one database, and each keeps its own copy of
 * every model. A field present in one copy and missing from the other is invisible to
 * the app that lacks it, and can be stripped by a whole-document save. A missing
 * *enum value* is worse: it fails the write outright.
 */
import fs from "fs";
import path from "path";
import { extractSchemaShape } from "./parse-schema";
import { findAllowance, allowedEnumValues } from "./allowlist";

export const MAIN_MODELS_DIR = path.join("database", "models");
export const ADMIN_MODELS_DIR = path.join(
  "apps",
  "admin",
  "database",
  "models",
);

export interface FieldDrift {
  path: string;
  side: "main-only" | "admin-only";
}

export interface EnumDrift {
  path: string;
  value: string;
  side: "main-only" | "admin-only";
}

export interface PairResult {
  /** Path relative to the models directory, e.g. `trading/competition.model.ts`. */
  relativePath: string;
  identical: boolean;
  fieldDrift: FieldDrift[];
  enumDrift: EnumDrift[];
  /** Differences suppressed because the allowlist marks them intentional. */
  allowedCount: number;
  /** Enum paths that cannot be compared statically on one or both sides. */
  skippedEnums: string[];
}

export interface MirrorReport {
  pairs: PairResult[];
  drifted: PairResult[];
  mainOnlyFiles: string[];
  adminOnlyFiles: string[];
  totals: {
    mainModels: number;
    adminModels: number;
    mirrored: number;
  };
}

/** Recursively lists model files under a directory, relative to it. */
export function listModelFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      // .d.ts files are hand-written declarations, not schemas. They are checked
      // separately by check-declarations.ts.
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
      out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };

  walk(root);
  return out.sort();
}

export function comparePair(
  relativePath: string,
  mainSource: string,
  adminSource: string,
): PairResult {
  const main = extractSchemaShape(mainSource, relativePath);
  const admin = extractSchemaShape(adminSource, relativePath);

  const allowance = findAllowance(relativePath);

  const fieldDrift: FieldDrift[] = [];
  const enumDrift: EnumDrift[] = [];
  const skippedEnums: string[] = [];
  let allowedCount = 0;

  for (const field of main.fields) {
    if (admin.fields.has(field)) continue;
    if (allowance?.mainOnlyFields?.includes(field)) {
      allowedCount++;
      continue;
    }
    fieldDrift.push({ path: field, side: "main-only" });
  }

  for (const field of admin.fields) {
    if (main.fields.has(field)) continue;
    if (allowance?.adminOnlyFields?.includes(field)) {
      allowedCount++;
      continue;
    }
    fieldDrift.push({ path: field, side: "admin-only" });
  }

  const enumPaths = new Set([...main.enums.keys(), ...admin.enums.keys()]);

  for (const enumPath of enumPaths) {
    // A runtime-computed enum on either side makes the comparison meaningless.
    if (main.dynamicEnums.has(enumPath) || admin.dynamicEnums.has(enumPath)) {
      skippedEnums.push(enumPath);
      continue;
    }

    const mainValues = main.enums.get(enumPath);
    const adminValues = admin.enums.get(enumPath);

    // If the field itself is drifted or allowlisted, the field report covers it.
    if (!mainValues || !adminValues) continue;

    const allowedMain = allowedEnumValues(allowance, enumPath, "main");
    const allowedAdmin = allowedEnumValues(allowance, enumPath, "admin");

    for (const value of mainValues) {
      if (adminValues.has(value)) continue;
      if (allowedMain.includes(value)) {
        allowedCount++;
        continue;
      }
      enumDrift.push({ path: enumPath, value, side: "main-only" });
    }

    for (const value of adminValues) {
      if (mainValues.has(value)) continue;
      if (allowedAdmin.includes(value)) {
        allowedCount++;
        continue;
      }
      enumDrift.push({ path: enumPath, value, side: "admin-only" });
    }
  }

  return {
    relativePath,
    identical: fieldDrift.length === 0 && enumDrift.length === 0,
    fieldDrift,
    enumDrift,
    allowedCount,
    skippedEnums,
  };
}

export function buildReport(repoRoot: string): MirrorReport {
  const mainRoot = path.join(repoRoot, MAIN_MODELS_DIR);
  const adminRoot = path.join(repoRoot, ADMIN_MODELS_DIR);

  const mainFiles = listModelFiles(mainRoot);
  const adminFiles = listModelFiles(adminRoot);

  const adminSet = new Set(adminFiles);
  const mainSet = new Set(mainFiles);

  const pairs: PairResult[] = [];

  for (const relativePath of mainFiles) {
    if (!adminSet.has(relativePath)) continue;
    if (findAllowance(relativePath)?.ignoreEntirely) continue;

    const mainSource = fs.readFileSync(
      path.join(mainRoot, relativePath),
      "utf8",
    );
    const adminSource = fs.readFileSync(
      path.join(adminRoot, relativePath),
      "utf8",
    );

    pairs.push(comparePair(relativePath, mainSource, adminSource));
  }

  return {
    pairs,
    drifted: pairs.filter((pair) => !pair.identical),
    mainOnlyFiles: mainFiles.filter((file) => !adminSet.has(file)),
    adminOnlyFiles: adminFiles.filter((file) => !mainSet.has(file)),
    totals: {
      mainModels: mainFiles.length,
      adminModels: adminFiles.length,
      mirrored: pairs.length,
    },
  };
}

/** Renders a drifted pair as a readable block naming the file and every field. */
export function formatPair(pair: PairResult): string {
  const lines: string[] = [];
  lines.push(`  ${pair.relativePath}`);

  for (const drift of pair.fieldDrift) {
    const missingFrom = drift.side === "main-only" ? "apps/admin" : "main app";
    lines.push(`      field  ${drift.path}  -  missing from ${missingFrom}`);
  }

  for (const drift of pair.enumDrift) {
    const missingFrom = drift.side === "main-only" ? "apps/admin" : "main app";
    lines.push(
      `      value  ${drift.path} = "${drift.value}"  -  missing from ${missingFrom}`,
    );
  }

  return lines.join("\n");
}
