// CHARTVOLT PATCH (14 Oct 2026, owner: "still a bit heavy for mobiles ... reduce shadows, lights,
// flying cars, less buildings etc"). One definition of what a phone is and how much scenery it draws,
// so every scenery module thins by the same rule.
//
// Reason: everything these numbers touch is rendering only. A module that thins a list must still
// consume its random draws for the skipped entries, so the scenery that survives sits exactly where
// it did before and nothing the race reads - seed, track, gates - can move.
export const PHONE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;

export const PHONE_BUDGET = Object.freeze({
  // Hover-taxis over a city circuit; each is a CPU matrix update every frame.
  traffic: 30,
  trafficRange: 450,
  drones: 4,
  moteShare: .35,
  // Keep one tower in this many from the main skyline, and cap the second skyline.
  towerStride: 3,
  backTowers: 12,
  spectatorRange: 350
});
