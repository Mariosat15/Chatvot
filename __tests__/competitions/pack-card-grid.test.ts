import { describe, expect, it } from "vitest";
import { packRowSpans, packedSpanClasses } from "@/lib/competitions/pack-card-grid";

/** Rows of spans, so a hole shows up as a row that does not sum to `cols`. */
function rows(spans: number[], cols: number): number[][] {
  const out: number[][] = [];
  let row: number[] = [];
  let used = 0;
  for (const s of spans) {
    if (used + s > cols) {
      out.push(row);
      row = [];
      used = 0;
    }
    row.push(s);
    used += s;
    if (used === cols) {
      out.push(row);
      row = [];
      used = 0;
    }
  }
  if (row.length) out.push(row);
  return out;
}

describe("competition card row packing", () => {
  it.each([
    ["7 metrics, Host, Starts In", [1, 1, 1, 1, 1, 1, 1, 2, 2]],
    ["7 metrics, Host, Starts In, Funding", [1, 1, 1, 1, 1, 1, 1, 2, 2, 1]],
    ["7 metrics, Host, no clock", [1, 1, 1, 1, 1, 1, 1, 2]],
    ["6 metrics, Host, Starts In, Funding", [1, 1, 1, 1, 1, 1, 2, 2, 1]],
    ["8 metrics, Host, Starts In", [1, 1, 1, 1, 1, 1, 1, 1, 2, 2]],
  ])("leaves no hole on 2 or 3 columns: %s", (_name, mins) => {
    for (const cols of [2, 3]) {
      const spans = packRowSpans(mins, cols);
      for (const r of rows(spans, cols)) {
        expect(r.reduce((a, b) => a + b, 0)).toBe(cols);
      }
      expect(spans).toHaveLength(mins.length);
      mins.forEach((min, i) =>
        expect(spans.at(i)).toBeGreaterThanOrEqual(Math.min(min, cols)),
      );
    }
  });

  it("puts Rounds beside Host and Funding beside Starts In on 3 columns", () => {
    const spans = packRowSpans([1, 1, 1, 1, 1, 1, 1, 2, 2, 1], 3);
    expect(spans.slice(6)).toEqual([1, 2, 2, 1]);
  });

  it("widens Starts In to the full row when nothing sits beside it", () => {
    const spans = packRowSpans([1, 1, 1, 1, 1, 1, 1, 2, 2], 3);
    expect(spans.slice(6)).toEqual([1, 2, 3]);
  });

  it("emits only static Tailwind class names", () => {
    const classes = packedSpanClasses([1, 2, 2, 1]);
    for (const c of classes) {
      expect(c).toMatch(/^col-span-[12] @\[420px\]:col-span-[123]$/);
    }
  });
});
