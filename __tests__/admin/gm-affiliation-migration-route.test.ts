import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The "Run migration" button on Admin -> Game Masters (`External game plans/24` s2.1, D4).
 * The behaviour is pinned in `__tests__/services/gm-program-data-model.test.ts`; this suite
 * pins the admin wiring around it.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** Reason: these files name the helpers in prose, so match the code, not the comments. */
const readCode = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ROUTE = "apps/admin/app/api/gamemasters/affiliation-migration/route.ts";

describe("affiliation migration admin wiring", () => {
  it("the admin copy is byte-identical to the main copy", () => {
    // Reason: check:mirrors compares models only, and the admin copy is the one the button runs.
    expect(read("apps/admin/lib/services/gamemaster/affiliation-migration.ts")).toBe(
      read("lib/services/gamemaster/affiliation-migration.ts"),
    );
  });

  it("the CLI runs the same function as the button", () => {
    const cli = readCode("tools/gamemaster/backfill-affiliation-source.ts");
    expect(cli).toMatch(/from "\.\.\/\.\.\/lib\/services\/gamemaster\/affiliation-migration"/);
  });

  it("every handler is section-granted", () => {
    const route = readCode(ROUTE);
    const handlers = route.match(/export async function (GET|PUT|POST|PATCH|DELETE)\b/g) ?? [];
    const guards = route.match(/guardSection\("gamemaster-management"\)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
  });

  it("GET only reports and POST applies, then re-reads", () => {
    const route = readCode(ROUTE);
    const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    const post = route.slice(route.indexOf("export async function POST"));
    expect(get.length).toBeGreaterThan(0);
    expect(get).toMatch(/migrateAffiliationSource\(false\)/);
    expect(get).not.toMatch(/migrateAffiliationSource\(true\)/);
    const apply = post.indexOf("migrateAffiliationSource(true)");
    const reread = post.indexOf("migrateAffiliationSource(false)");
    expect(apply).toBeGreaterThan(-1);
    expect(reread).toBeGreaterThan(apply);
  });

  it("a run is written to the audit trail", () => {
    const post = readCode(ROUTE).slice(readCode(ROUTE).indexOf("export async function POST"));
    expect(post).toMatch(/logSystemAction\(/);
    expect(post).toMatch(/"gm_affiliation_migration"/);
  });

  it("the button is mounted on the Game Masters screen", () => {
    const section = readCode("apps/admin/components/admin/GameMasterManagementSection.tsx");
    expect(section).toMatch(/<GmAffiliationMigration \/>/);
    const component = readCode("apps/admin/components/admin/gamemaster/GmAffiliationMigration.tsx");
    expect(component).toMatch(/fetch\("\/api\/gamemasters\/affiliation-migration", \{ method: "POST" \}\)/);
  });
});
