/**
 * Row packing for the competition card's data grid.
 *
 * Reason: each game has a different number of boxes, and some boxes need two
 * cells (Host, Starts In) so their text is not cut. Fixed spans left holes
 * whenever a row ran out early. This packer walks the boxes in order and,
 * when the next one does not fit the space left in the row, widens the last
 * box of that row to close the gap. Every row ends up full.
 */
export function packRowSpans(minSpans: readonly number[], cols: number): number[] {
  const done: number[] = [];
  let row: number[] = [];
  let used = 0;

  const closeRow = () => {
    const last = row.pop();
    if (last !== undefined) row.push(last + (cols - used));
    done.push(...row);
    row = [];
    used = 0;
  };

  for (const raw of minSpans) {
    const min = Math.max(1, Math.min(cols, Math.floor(raw)));
    if (used + min > cols) closeRow();
    row.push(min);
    used += min;
    if (used === cols) closeRow();
  }
  closeRow();
  return done;
}

/** Static Tailwind classes (the compiler cannot see interpolated names). */
const BASE_SPAN = new Map<number, string>([
  [1, "col-span-1"],
  [2, "col-span-2"],
]);
const WIDE_SPAN = new Map<number, string>([
  [1, "@[420px]:col-span-1"],
  [2, "@[420px]:col-span-2"],
  [3, "@[420px]:col-span-3"],
]);

/**
 * Span classes for the grid card: 2 columns below a 420px container, 3 above,
 * matching `grid-cols-2 @[420px]:grid-cols-3` on the card.
 */
export function packedSpanClasses(minSpans: readonly number[]): string[] {
  const wide = packRowSpans(minSpans, 3);
  return packRowSpans(minSpans, 2).map((narrow, i) => {
    const wideSpan = wide.at(i) ?? 3;
    return `${BASE_SPAN.get(narrow) ?? "col-span-2"} ${WIDE_SPAN.get(wideSpan) ?? "@[420px]:col-span-3"}`;
  });
}
