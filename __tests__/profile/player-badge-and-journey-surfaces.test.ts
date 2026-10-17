import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The two PLAYER-side surfaces behind the owner's reports: the profile badge screen and the
 * `/journey` page.
 *
 * Three properties are pinned here, and each one failed silently rather than loudly.
 *
 *   1. THE CATEGORY FILTER MUST OFFER EVERY CATEGORY THE CATALOGUE CAN HOLD. `Volume` is a real
 *      `BadgeCategory` and the stats payload counts it, so a filter list that omits one category
 *      renders perfectly, counts correctly, and simply cannot be used to find those badges. The
 *      assertion is derived from the type union rather than from a second hand-written list, or
 *      the guard is one more place to forget the next category.
 *
 *   2. AN EMPTY CATALOGUE MUST REPORT 0%, NOT `NaN%`. A gamification reset can legitimately leave
 *      no badges at all, and `0 / 0` reached the screen as the string "NaN%".
 *
 *   3. THE JOURNEY PAGE MUST SEPARATE "STILL ASKING" FROM "ASKED, NONE EXIST". The skeleton was
 *      gated on a `loading` flag that nothing cleared when the map sequence came back empty, so
 *      the page spun for ever with no error and nothing in a log - which is exactly the state a
 *      reset leaves behind, since it deletes every `JourneyMapConfig` and reseeds none.
 */

const ROOT = process.cwd();

/**
 * Comments stripped before matching, always.
 *
 * Reason: both files under test now explain in prose why the omission mattered, naming the very
 * strings asserted below. A bare match reads the explanation as the code - it passes a broken
 * file whose only mention of the right thing is a comment, and fails a correct one for
 * discussing the mistake.
 */
function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CONSTANTS = "lib/constants/badges.ts";
const DISPLAY = "components/profile/BadgesDisplay.tsx";
const JOURNEY = "app/(root)/journey/JourneyClient.tsx";

/** The `BadgeCategory` union members, read out of the type rather than restated. */
function declaredCategories(): string[] {
  const source = readCode(CONSTANTS);
  const start = source.indexOf("export type BadgeCategory =");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(";", start);
  expect(end).toBeGreaterThan(start);
  const union = source.slice(start, end);
  return [...union.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("the profile badge screen can reach every category", () => {
  it("offers every declared BadgeCategory in its filter list", () => {
    const categories = declaredCategories();
    expect(categories.length).toBeGreaterThan(5);

    const code = readCode(DISPLAY);
    const declaration = "const CATEGORIES: BadgeCategory[] = [";
    const start = code.indexOf(declaration);
    expect(start).toBeGreaterThan(-1);
    // Reason: slice from the opening bracket of the ARRAY, not from the declaration - the
    // `BadgeCategory[]` annotation carries a `]` of its own, and a slice ending there examines
    // nothing while passing every assertion asked of it.
    const open = start + declaration.length;
    const end = code.indexOf("]", open);
    expect(end).toBeGreaterThan(open);
    const list = code.slice(open, end);

    for (const category of categories) {
      expect(list, `filter list is missing ${category}`).toContain(`"${category}"`);
    }
  });

});

describe("badge stats survive an empty catalogue", () => {
  it("reports 0 percent rather than NaN when no badges are configured", async () => {
    vi.resetModules();

    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    vi.doMock("next/navigation", () => ({
      redirect: () => {
        throw new Error("unexpected redirect");
      },
    }));
    vi.doMock("@/lib/better-auth/auth", () => ({
      auth: {
        api: {
          getSession: async () => ({ user: { id: "68b5c1a2d4e5f60718293a4b" } }),
        },
      },
    }));
    vi.doMock("@/lib/services/badge-evaluation.service", () => ({
      getUserBadges: async () => [],
      evaluateUserBadges: async () => [],
    }));

    const { getMyBadgeStats } = await import("@/lib/actions/badges/user-badges.actions");
    const stats = await getMyBadgeStats();

    expect(stats.totalBadges).toBe(0);
    expect(stats.earnedCount).toBe(0);
    expect(Number.isNaN(stats.percentage)).toBe(false);
    expect(stats.percentage).toBe(0);
    // Reason: the screen renders `percentage.toFixed(0)`, which is where NaN became visible.
    expect(stats.percentage.toFixed(0)).toBe("0");
  });

  it("counts every declared category, including Games", async () => {
    vi.resetModules();

    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    vi.doMock("next/navigation", () => ({
      redirect: () => {
        throw new Error("unexpected redirect");
      },
    }));
    vi.doMock("@/lib/better-auth/auth", () => ({
      auth: {
        api: {
          getSession: async () => ({ user: { id: "68b5c1a2d4e5f60718293a4b" } }),
        },
      },
    }));
    vi.doMock("@/lib/services/badge-evaluation.service", () => ({
      getUserBadges: async () => [
        { id: "g1", category: "Games", rarity: "rare", earned: true },
        { id: "v1", category: "Volume", rarity: "common", earned: true },
        { id: "g2", category: "Games", rarity: "epic", earned: false },
      ],
      evaluateUserBadges: async () => [],
    }));

    const { getMyBadgeStats } = await import("@/lib/actions/badges/user-badges.actions");
    const stats = await getMyBadgeStats();

    for (const category of declaredCategories()) {
      expect(
        Object.keys(stats.categoryCount),
        `categoryCount is missing ${category}`,
      ).toContain(category);
    }
    expect(stats.categoryCount.Games).toBe(1);
    expect(stats.categoryCount.Volume).toBe(1);
  });
});

describe("the journey page distinguishes an empty sequence from a pending one", () => {
  const code = readCode(JOURNEY);

  it("clears the sequence flag in a finally, so a failed or empty fetch still resolves", () => {
    const start = code.indexOf("const fetchMaps");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, code.indexOf("fetchMaps();", start));
    expect(block.length).toBeGreaterThan(100);

    const settled = block.indexOf("finally");
    expect(settled).toBeGreaterThan(-1);
    expect(block.slice(settled)).toContain("setMapsResolved(true)");
  });

  it("gates the skeleton on the request, never on a loading flag alone", () => {
    /*
      THIS IS THE DEFECT ITSELF. `loading` starts true and the effect that clears it returns
      early when there are no maps, so `loading && maps.length === 0` was permanently true.
      The flag has to be one the sequence request itself sets.
    */
    expect(code).toContain("if (!mapsResolved && maps.length === 0)");
    expect(code).not.toContain("if (loading && maps.length === 0)");
  });

  it("renders an empty state, with the same wording as the profile tab", () => {
    const start = code.indexOf("if (mapsResolved && maps.length === 0)");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, start + 900);
    expect(block).toContain("No journey maps found");
    expect(block).not.toContain("Skeleton");
  });

  it("carries no write-only loading flag for the skeleton to be re-gated on", () => {
    /*
      The old flag started true and was cleared only by the map-data effect, which returns early
      when there are no maps - so nothing cleared it in exactly the state that mattered. It is
      deleted rather than left write-only: a flag nothing reads reviews as harmless and is the
      one thing a later reader would reach for to gate the skeleton, putting the hang back.
    */
    expect(code).not.toContain("setLoading");
    expect(code).not.toMatch(/\[\s*loading\s*,/);
  });
});
