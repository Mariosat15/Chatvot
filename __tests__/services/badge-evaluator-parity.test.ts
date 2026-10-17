/**
 * R100 — the admin badge evaluator must stay byte-identical to the main app.
 *
 * `check:mirrors` compares MODELS and has never had an opinion about this service.
 * Before 16 Sep 2026 the admin copy was ~221 lines behind: no `typeof userId` guard,
 * no stats cache, no category filter, unbounded sequential queries, and a different
 * win-rate sample. That is how which badges a player held depended on which app
 * evaluated them, and how a request-supplied object could reach a Mongo query on the
 * admin path (reached by `trigger-badge-evaluation`, now section-granted under R101a).
 *
 * Full parity and a gate change (R96a) in one commit would destroy the only evidence
 * the port is safe — so this suite pins the port alone.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MAIN = "lib/services/badge-evaluation.service.ts";
const ADMIN = "apps/admin/lib/services/badge-evaluation.service.ts";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("R100 - admin badge evaluator parity", () => {
  it("is byte-identical in both apps", () => {
    // Reason: `check:mirrors` compares MODELS. Two copies that disagree about a
    // typeof guard or a win-rate sample reinstate R100 the day somebody edits one side.
    expect(read(ADMIN)).toBe(read(MAIN));
  });

  it("refuses a non-string userId before any query", () => {
    // Reason: match the guard WITH its throw, never the bare typeof. An import of
    // a helper named userId, or a comment, must not satisfy this.
    const code = stripComments(read(MAIN));
    expect(code).toMatch(
      /typeof\s+userId\s*!==\s*["']string["'][\s\S]{0,80}throw\s+new\s+Error\(\s*["']Invalid userId["']\s*\)/,
    );
  });

  it("caches gatherUserStats behind a TTL map", () => {
    const code = stripComments(read(MAIN));
    expect(code).toMatch(/_statsCache\.get\(\s*userId\s*\)/);
    expect(code).toMatch(/_statsCache\.set\(\s*userId\s*,/);
    expect(code).toMatch(/STATS_CACHE_TTL_MS/);
  });

  it("accepts an optional category filter on evaluateUserBadges", () => {
    const code = stripComments(read(MAIN));
    expect(code).toMatch(
      /export\s+async\s+function\s+evaluateUserBadges\s*\(\s*userId\s*:\s*string\s*,\s*categories\s*\?\s*:\s*string\s*\[\s*\]\s*\)/,
    );
    expect(code).toMatch(/categories\.includes\(\s*b\.category\s*\)/);
  });

  it("bounds the trade and position samples", () => {
    // Reason: the unbounded admin `.find({ userId }).lean()` was the OOM path. Pin
    // the limit on both collections so a tidy-up that drops one stays red.
    const code = stripComments(read(MAIN));
    expect(code).toMatch(/TradingPosition[\s\S]{0,200}\.limit\(\s*2000\s*\)/);
    expect(code).toMatch(/TradeHistory[\s\S]{0,200}\.limit\(\s*2000\s*\)/);
  });

  it("the admin trade-close path passes the same category list as main", () => {
    /*
      The service filter is useless if every caller still asks for the whole catalogue.
      Main's position.actions already passes six categories; admin's did not until R100.
      Assert both call sites, because a probe that only mutates admin stays green against
      a test that only reads main.
    */
    const cats =
      /\["Trading",\s*"Profit",\s*"Risk",\s*"Speed",\s*"Consistency",\s*"Strategy"\]/;
    expect(read("lib/actions/trading/position.actions.ts")).toMatch(
      new RegExp(`evaluateUserBadges\\([^)]+,\\s*${cats.source}`),
    );
    expect(read("apps/admin/lib/actions/trading/position.actions.ts")).toMatch(
      new RegExp(`evaluateUserBadges\\([^)]+,\\s*${cats.source}`),
    );
  });
});
