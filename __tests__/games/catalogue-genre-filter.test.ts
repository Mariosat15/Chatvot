/**
 * Task 9 leftovers — discovery filter by genre on /games.
 *
 * The vocabulary shipped in 9.1; the filter was withheld while there was one title
 * (a one-value filter appears to work and does nothing). Merchandising made a second
 * title real, so the chips render when two or more distinct slugs are present.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const root = process.cwd();

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("GameCatalogueFilters — discovery by genre", () => {
  const filters = readFileSync(
    join(root, "components", "games", "catalogue", "GameCatalogueFilters.tsx"),
    "utf8",
  );
  const page = readFileSync(join(root, "app", "(root)", "games", "page.tsx"), "utf8");

  it("withholds the control when fewer than two genres are present", () => {
    const code = stripComments(filters);
    expect(code).toMatch(/options\.length\s*<\s*2/);
    expect(code).toMatch(/return null/);
  });

  it("keys filter state on ?category= so a link is shareable", () => {
    const code = stripComments(filters);
    expect(code).toMatch(/next\.set\("category"/);
    expect(code).toMatch(/next\.delete\("category"/);
  });

  it("the hub only accepts a slug that appears on a live card", () => {
    /*
      Invented bookmarks must not look like an empty catalogue. Assert the page filters
      against collectFilterOptions rather than against the vocabulary alone — custom genres
      on live cards are legitimate filter values.
    */
    const code = stripComments(page);
    expect(code).toMatch(/filterOptions\.some/);
    expect(code).toMatch(/g\.categorySlug\s*===\s*activeSlug/);
  });
});
