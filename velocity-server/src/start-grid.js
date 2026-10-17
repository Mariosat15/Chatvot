// CHARTVOLT PATCH (28 Sep 2026, owner: "have a pole position like F1 has, like 3 ships each position").
// REVISED 13 Oct 2026 (owner: "it put 3 at the time next to each other we need either larger roads
// or add them 2 by 2"). The grid is now a real Formula-1 grid: two columns, and every box sits half
// a row behind the one ahead of it, so P1 is on the line, P2 alongside but one stagger back, P3
// behind P1, and so on. Every ship has clear road on both sides at the start.
//
// Reason: this is the only definition of a grid slot. The race server places ships with it and
// the client paints the grid boxes with it, so a painted box can never disagree with where a
// ship actually starts. It imports nothing but the road width for the same reason.
//
// Reason (why the stagger is now right, when 28 Sep dropped it): that version dropped the in-row
// stagger because grid order was a seeded shuffle, so a stagger handed out a random head start.
// Since 13 Oct 2026 the order is the leaderboard (race-room.mjs `gridOrder`), so each slot being a
// little further back than the one before is exactly the F1 reward for qualifying higher. The road
// was not widened instead: that would move every pickup, gate, wall and piece of scenery.
import {road} from './road-width.js';

/** Most ships a race can start; race-room.mjs's MAX_RACERS reads this. */
export const GRID_SLOTS = 16;
export const GRID_COLUMNS = 2;
export const GRID_LANE_SPACING = road(8.8);   // 11 m between the two columns at ROAD_SCALE 1.25
export const GRID_ROW_SPACING = 14;           // metres between boxes in the same column
/** How far each box sits behind the one ahead of it in the other column (half a row). */
export const GRID_STAGGER = GRID_ROW_SPACING / 2;

/**
 * Starting position for grid slot `index` (0 = pole). Pole takes the left column on the line;
 * the right column is offset back by GRID_STAGGER. A lone ship in the last row keeps its column,
 * exactly as on an F1 grid, so `total` no longer changes a slot - it is accepted for callers that
 * still pass it.
 */
export function gridSlot(index, _total) {
  const row = Math.floor(index / GRID_COLUMNS), column = index % GRID_COLUMNS;
  const lateral = (column - (GRID_COLUMNS - 1) / 2) * GRID_LANE_SPACING;
  // `0 -` rather than a leading minus: -0 is not 0 under strict equality, and pole must read exactly 0.
  return { distance: 0 - (row * GRID_ROW_SPACING + column * GRID_STAGGER), lateral: lateral + 0, row, column };
}
