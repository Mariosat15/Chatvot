// CHARTVOLT PATCH (28 Sep 2026, owner: "we need to make the road larger as if we have 16 players
// not going to fit"). One number widens the whole course: physics limits, contact walls, content
// lanes and every road-tied piece of scenery are the vendor's values multiplied by ROAD_SCALE.
//
// Reason: this module imports nothing so the race server's .mjs files, the simulation and the
// client scenery can all read the same value. A second copy of the width is how a ship ends up
// driving through a barrier that the renderer draws somewhere else.
export const ROAD_SCALE = 1.25;
/** Painted road half-width, metres (vendor: 16). */
export const ROAD_HALF_WIDTH = 16 * ROAD_SCALE;
/** Furthest a ship's centre may drift before hitting the wall (vendor: 13.3). */
export const DRIVE_LIMIT = 13.3 * ROAD_SCALE;
/** Scale a vendor lateral offset (metres from the centre line) to the widened road. */
export const road = (vendorMetres) => vendorMetres * ROAD_SCALE;
