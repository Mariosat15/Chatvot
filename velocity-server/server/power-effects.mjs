import {POWER_TUNING as T} from '../src/power-tuning.js';
/* CHARTVOLT PATCH (28 Sep 2026; reduced 13 Oct 2026). Server-owned slipstream.
 * Shockwave, slick and the rival-hunting seeker were removed on 13 Oct 2026 when paid races became
 * skill-only: each one lowered another racer's hull, speed or heading. The seeker survives as a
 * tower-hunting missile inside the pilot's own simulation, so nothing here acts on a rival any more.
 * `c` is the room's RaceFeed. */

/** Tucking in behind a rival raises your top speed while you stay there. Same rule for every racer, and the leader is untouched. */
export function stepSlipstream(c, racers) {
  const t = T.slipstream;
  for (const p of racers) {
    const s = p.sim;
    const drafting = racers.some(o => {
      if (o === p || o.sim.speed < t.leaderSpeed) return false;
      const gap = c.delta(s.distance, o.sim.distance);
      return gap > t.minGap && gap < t.maxGap && Math.abs(o.sim.lateral - s.lateral) < t.lateral;
    });
    if (!drafting) continue;
    if (!(s.draft > 0) && c.room.tick - (p.slipstreamCalloutTick ?? -Infinity) >= t.calloutTicks) {
      p.slipstreamCalloutTick = c.room.tick;
      c.event('slipstream', p, null, 'slipstream');
    }
    s.draft = t.hold;
  }
}
