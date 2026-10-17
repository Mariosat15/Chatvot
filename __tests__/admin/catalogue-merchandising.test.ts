import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Catalogue merchandising admin route — guard and identity refusals.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("catalogue merchandising admin route", () => {
  const route = stripComments(
    readFileSync(
      join(
        process.cwd(),
        "apps/admin/app/api/games/catalogue/[gameKey]/route.ts",
      ),
      "utf8",
    ),
  );

  it("guards both GET and PATCH with game-providers or trading-page", () => {
    const gets = [...route.matchAll(/export async function (GET|PATCH)/g)];
    expect(gets.map((m) => m[1]).sort()).toEqual(["GET", "PATCH"]);
    const guardCalls = [
      ...route.matchAll(/guardAnySection\(\s*\[\s*"game-providers"\s*,\s*"trading-page"\s*\]/g),
    ];
    expect(guardCalls.length).toBe(2);
  });

  it("updates through updateCatalogueMerchandising — never spreads the body onto the model", () => {
    expect(route).toMatch(/updateCatalogueMerchandising\(/);
    expect(route).not.toMatch(/\.updateOne\([^)]*body/);
    expect(route).not.toMatch(/Object\.assign/);
  });
});

describe("CatalogueMerchandisingPanel", () => {
  const panel = stripComments(
    readFileSync(
      join(
        process.cwd(),
        "apps/admin/components/admin/games/CatalogueMerchandisingPanel.tsx",
      ),
      "utf8",
    ),
  );

  it("is a client panel that does not import mongoose models", () => {
    expect(panel).toMatch(/"use client"/);
    expect(panel).not.toMatch(/database\/models/);
    expect(panel).not.toMatch(/from\s+["']mongoose["']/);
  });

  it("does not offer a slug rename control", () => {
    expect(panel).toMatch(/Catalogue slug \(permanent\)/);
    expect(panel).not.toMatch(/setSlug|onChange.*slug/i);
  });
});
