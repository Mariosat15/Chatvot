/**
 * R99 — badge catalogue canonical source and add-only sync.
 *
 * `data/defaults/badges.json` (134) is what a fresh seed installs when present;
 * `lib/constants/badges.ts` (128) is the code fallback and the source of "missing
 * id" inserts. Before 16 Sep 2026 the sync branch also overwrote `condition` (and
 * metadata) whenever constants disagreed with the DB — silently undoing operator
 * tuning and rewriting JSON-seeded thresholds back to the constants.
 *
 * This suite pins: (1) sync never writes `condition` on an existing row, (2) fresh
 * seed prefers JSON, (3) the two catalogues' sizes and the six JSON-only ids stay
 * documented until an alignment pass (separate from this fix).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SEED_FILES = [
  "lib/services/badge-config-seed.service.ts",
  "apps/admin/lib/services/badge-config-seed.service.ts",
] as const;

/** Ids present in data/defaults/badges.json and absent from BADGES constants. */
const JSON_ONLY_IDS = [
  "new_trade_1000_plus",
  "new_profit_100_plus",
  "new_risk_10_drawdown",
  "new_speed_100_scalps",
  "new_consistency_30_days",
  "trade_1000_plus",
] as const;

describe("R99 - badge catalogue and add-only sync", () => {
  it.each(SEED_FILES)("%s never overwrites condition on an existing row", (file) => {
    /*
      // Reason: the defect was `conditionChanged` + `$set: { condition: ... }` inside
      // the existingCount > 0 branch. Match the overwrite shape, never a bare
      // `condition:` which still appears on create/insertMany.
    */
    const code = stripComments(read(file));
    expect(code).not.toMatch(/conditionChanged/);
    expect(code).not.toMatch(
      /\$set\s*:\s*\{[\s\S]*?condition\s*:\s*badge\.condition/,
    );
  });

  it.each(SEED_FILES)("%s prefers saved JSON defaults on an empty database", (file) => {
    const code = stripComments(read(file));
    // Reason: assert the CALL order — getDefaultBadges before BADGES.insertMany —
    // not merely that both names appear.
    const defaultsCall = code.indexOf("getDefaultBadges()");
    const constantsInsert = code.indexOf("BADGES.map");
    expect(defaultsCall).toBeGreaterThan(-1);
    expect(constantsInsert).toBeGreaterThan(-1);
    expect(defaultsCall).toBeLessThan(constantsInsert);
    expect(code).toMatch(/existingCount\s*===\s*0/);
  });

  it("documents the live catalogue sizes and the six JSON-only badges", () => {
    const json = JSON.parse(read("data/defaults/badges.json")) as { id: string }[];
    const constants = read("lib/constants/badges.ts");
    const constantIds = [
      ...constants.matchAll(/^\s*id:\s*"([^"]+)"/gm),
    ].map((m) => m[1]);

    expect(json.length).toBe(134);
    expect(new Set(constantIds).size).toBe(128);

    const constantSet = new Set(constantIds);
    const onlyInJson = json.map((b) => b.id).filter((id) => !constantSet.has(id));
    expect(onlyInJson.sort()).toEqual([...JSON_ONLY_IDS].sort());
  });

  it("both seed services stay add-only in the same shape", () => {
    // Reason: check:mirrors compares MODELS. Drift between the two sync branches
    // is how the overwrite returns on one app only.
    const main = stripComments(read(SEED_FILES[0]));
    const admin = stripComments(read(SEED_FILES[1]));
    const addOnlyLoop = /for\s*\(\s*const\s+badge\s+of\s+BADGES\s*\)\s*\{[\s\S]*?!existingIds\.has/;
    expect(main).toMatch(addOnlyLoop);
    expect(admin).toMatch(addOnlyLoop);
    expect(main.includes("conditionChanged")).toBe(false);
    expect(admin.includes("conditionChanged")).toBe(false);
    expect(main).not.toMatch(/\$set\s*:\s*\{[\s\S]*?condition\s*:\s*badge\.condition/);
    expect(admin).not.toMatch(/\$set\s*:\s*\{[\s\S]*?condition\s*:\s*badge\.condition/);
  });
});
