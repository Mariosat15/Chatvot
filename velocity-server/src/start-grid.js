// CHARTVOLT PATCH (28 Sep 2026, owner: "have a pole position like F1 has, like 3 ships each position").
// Formula-1 style grid: three ships abreast to a row, rows one after another behind the line,
// each ship in its own painted box.
//
// Reason: this is the only definition of a grid slot. The race server places ships with it and
// the client paints the grid boxes with it, so a painted box can never disagree with where a
// ship actually starts. It imports nothing but the road width for the same reason.
//
// Reason (no in-row stagger): a real F1 grid also staggers each box within a row. That was tried
// and dropped the same day: it hands a pilot a head start over the other two in their own row,
// and it moves the front row off the line, which the vendor multiplayer tests pin ("nobody has
// moved before the green light" is asserted as distance === 0). Rows still differ, exactly as
// the vendor's own four-abreast grid did, and grid order is the seeded shuffle in race-room.mjs.
import {road} from './road-width.js';

/** Most ships a race can start; race-room.mjs's MAX_RACERS reads this. */
export const GRID_SLOTS = 16;
export const GRID_COLUMNS = 3;
export const GRID_LANE_SPACING = road(7.2);   // 9 m across at ROAD_SCALE 1.25
export const GRID_ROW_SPACING = 14;           // metres between rows

/**
 * Starting position for grid slot `index` (0 = pole) when `total` ships start together.
 * A final row with fewer than three ships is centred rather than left-aligned, so a two-ship
 * race starts side by side instead of one ship in the middle and one to its left.
 * Pass `total` as undefined for a pilot joining mid-countdown: their row is not known to be
 * final, so they take the full-row lane.
 */
export function gridSlot(index, total) {
  const row = Math.floor(index / GRID_COLUMNS), column = index % GRID_COLUMNS;
  const inRow = total === undefined ? GRID_COLUMNS : Math.min(GRID_COLUMNS, total - row * GRID_COLUMNS);
  const lateral = (column - (inRow - 1) / 2) * GRID_LANE_SPACING;
  // `0 -` rather than a leading minus: -0 is not 0 under strict equality, and the front row
  // must read exactly 0.
  return { distance: 0 - row * GRID_ROW_SPACING, lateral: lateral + 0, row, column };
}
