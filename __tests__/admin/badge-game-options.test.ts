import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Badge Game Scope picker must not offer deprecated catalogue titles.
 * Circuit Perfect retired 8 Sep 2026 — chartvoltEnabled alone still showed it.
 */

const ROUTE = join(
  process.cwd(),
  "apps/admin/app/api/badges/game-options/route.ts",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("badge game-options excludes deprecated titles", () => {
  it("queries chartvoltEnabled and providerStatus active together", () => {
    const src = stripComments(readFileSync(ROUTE, "utf8"));
    expect(src).toMatch(/chartvoltEnabled:\s*true/);
    expect(src).toMatch(/providerStatus:\s*["']active["']/);
  });

  it("always includes Trading as a fixed first option", () => {
    const src = stripComments(readFileSync(ROUTE, "utf8"));
    expect(src).toMatch(/TRADING_GAME_TYPE/);
    expect(src).toMatch(/displayName:\s*["']Trading["']/);
  });
});
