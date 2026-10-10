/**
 * Cross-game normalised points — pure arithmetic from `05` s3 / New games `04` s3.
 *
 * No I/O. Mirrored; the byte-identical claim is asserted here because
 * `check:mirrors` compares models only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clampRating,
  computeNormalizedPoints,
  computeRatingDelta,
} from "@/lib/services/games/normalized-points";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("computeNormalizedPoints", () => {
  it("returns 0 for an absent or non-positive rank", () => {
    expect(
      computeNormalizedPoints({ fieldSize: 10, entryFee: 50 }),
    ).toBe(0);
    expect(
      computeNormalizedPoints({ rank: 0, fieldSize: 10, entryFee: 50 }),
    ).toBe(0);
    expect(
      computeNormalizedPoints({ rank: -1, fieldSize: 10, entryFee: 50 }),
    ).toBe(0);
  });

  it("returns 0 for a field that is not a contest", () => {
    expect(
      computeNormalizedPoints({ rank: 1, fieldSize: 0, entryFee: 50 }),
    ).toBe(0);
  });

  it("honours a free contest (entryFee 0) rather than treating it as missing", () => {
    // stakeFactor at fee 0 is clamp(0 / log10(101), 0.5, 1.5) = 0.5
    const free = computeNormalizedPoints({
      rank: 1,
      fieldSize: 10,
      entryFee: 0,
    });
    const paid = computeNormalizedPoints({
      rank: 1,
      fieldSize: 10,
      entryFee: 100,
    });
    expect(free).toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(free);
  });

  it("pays first place more than last in the same field", () => {
    const first = computeNormalizedPoints({
      rank: 1,
      fieldSize: 20,
      entryFee: 50,
    });
    const last = computeNormalizedPoints({
      rank: 20,
      fieldSize: 20,
      entryFee: 50,
    });
    expect(first).toBeGreaterThan(last);
  });

  it("stays inside the documented ~0..2250 band for ordinary contests", () => {
    const top = computeNormalizedPoints({
      rank: 1,
      fieldSize: 50,
      entryFee: 1000,
    });
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThanOrEqual(2250);
  });
});

describe("computeRatingDelta", () => {
  it("raises rating for beating the field midpoint", () => {
    expect(computeRatingDelta({ rank: 1, fieldSize: 10 })).toBeGreaterThan(0);
  });

  it("lowers rating for finishing below the midpoint", () => {
    expect(computeRatingDelta({ rank: 10, fieldSize: 10 })).toBeLessThan(0);
  });

  it("returns 0 for a one-player field", () => {
    expect(computeRatingDelta({ rank: 1, fieldSize: 1 })).toBe(0);
  });
});

describe("clampRating", () => {
  it("bounds at 100 and 3000", () => {
    expect(clampRating(50)).toBe(100);
    expect(clampRating(4000)).toBe(3000);
    expect(clampRating(1200)).toBe(1200);
  });
});

describe("the two copies", () => {
  it("is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/services/games/normalized-points.ts")).toBe(
      read("lib/services/games/normalized-points.ts"),
    );
  });
});
