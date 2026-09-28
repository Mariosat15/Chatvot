/* CHARTVOLT PATCH (28 Sep 2026, owner: "more features, more exciting, more power-ups").
 * One table for the five new power-ups, slipstream and the perfect start, read by the
 * simulation (solo races and client prediction), the race server and the tests, so the
 * numbers a player feels cannot drift between the three.
 * Fairness: every capsule is on the course for everyone, the server decides every effect,
 * and nothing here can be bought - the same rule as the vendor's eight items. */
export const SPECIAL_KINDS = Object.freeze(['shockwave', 'slick', 'seeker', 'cloak', 'magnet']);

export const POWER_TUNING = Object.freeze({
  shockwave: { radius: 18, damage: 0.05, slow: 0.85, shove: 1.6, kick: 0.35, hazardRadius: 40 },
  slick: { life: 14, arm: 0.5, radius: 3.2, spin: 1.8, kick: 0.45, slow: 0.78, behind: 10, perOwner: 2, total: 24 },
  seeker: { range: 300, speed: 200, life: 4, track: 60, damage: 0.24, slow: 0.72 },
  cloak: { seconds: 4 },
  magnet: { seconds: 6, radius: 7.5 },
  slipstream: { minGap: 6, maxGap: 32, lateral: 2.8, leaderSpeed: 40, extraSpeed: 10, hold: 0.3, calloutTicks: 180 },
  perfectStart: { window: 0.5, boost: 1.5 },
});

/** The lateral catch radius for a pickup; a magnet widens it for everyone the same way. */
export const PICKUP_RADIUS = 3;
export function pickupRadius(sim) { return sim.magnet > 0 ? POWER_TUNING.magnet.radius : PICKUP_RADIUS; }
