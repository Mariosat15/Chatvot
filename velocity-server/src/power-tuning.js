/* CHARTVOLT PATCH (28 Sep 2026, owner: "more features, more exciting, more power-ups").
 * One table for the extra power-ups, slipstream and the perfect start, read by the
 * simulation (solo races and client prediction), the race server and the tests, so the
 * numbers a player feels cannot drift between the three.
 * Fairness: every capsule is on the course for everyone, the server decides every effect,
 * and nothing here can be bought - the same rule as the vendor's eight items.
 *
 * CHARTVOLT PATCH (13 Oct 2026, owner, after the legal opinion): paid races are SKILL-ONLY.
 * No item may touch another pilot. Shockwave, oil slick and cloak are gone from every room,
 * solo included; the seeker now homes on a TOWER, never on a rival. */
export const SPECIAL_KINDS = Object.freeze(['seeker', 'magnet']);

export const POWER_TUNING = Object.freeze({
  seeker: { range: 300 },
  magnet: { seconds: 6, radius: 7.5 },
  slipstream: { minGap: 6, maxGap: 32, lateral: 2.8, leaderSpeed: 40, extraSpeed: 10, hold: 0.3, calloutTicks: 180 },
  perfectStart: { window: 0.5, boost: 1.5 },
});

/** The lateral catch radius for a pickup; a magnet widens it for everyone the same way. */
export const PICKUP_RADIUS = 3;
export function pickupRadius(sim) { return sim.magnet > 0 ? POWER_TUNING.magnet.radius : PICKUP_RADIUS; }
