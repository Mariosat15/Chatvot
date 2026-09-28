import {DRIVE_LIMIT} from '../src/road-width.js';
import {POWER_TUNING as T} from '../src/power-tuning.js';
/* CHARTVOLT PATCH (28 Sep 2026). Server-owned effects for the new power-ups and slipstream.
 * `c` is the room's PlayerCombat. Cloak and magnet are plain timers the simulation owns, so they
 * are not here; every effect below touches another racer and so must be decided by the server. */
export const SERVER_POWER_KINDS = new Set(['shockwave', 'slick', 'seeker']);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Which way to push `victim` away from `source`; a dead-level tie is broken by id so the answer is deterministic. */
function awaySide(source, victim) {
  const d = victim.sim.lateral - source.sim.lateral;
  return d !== 0 ? Math.sign(d) : (victim.id < source.id ? -1 : 1);
}

function shove(sim, side, metres, kick) {
  sim.lateral = clamp(sim.lateral + side * metres, -DRIVE_LIMIT, DRIVE_LIMIT);
  sim.heading = clamp(sim.heading + side * kick, -1.3, 1.3);
}

/** A cloaked or jammed racer cannot be locked. */
export function lockable(p) { return p.sim.counter <= 0 && !(p.sim.cloak > 0); }

/**
 * Resolves one of SERVER_POWER_KINDS. Returns 'used' (consume the item), 'fallback' (no rival to
 * act on - the caller runs the solo behaviour, as the vendor does for a missile with no lock) or
 * 'blocked' (keep the item, like the vendor's full-mine rule).
 */
export function usePower(c, p, kind) {
  const s = p.sim;
  if (kind === 'shockwave') {
    const t = T.shockwave;
    for (const other of c.racers()) {
      if (other.id === p.id) continue;
      if (Math.hypot(c.delta(s.distance, other.sim.distance), other.sim.lateral - s.lateral) >= t.radius) continue;
      if (c.hit(p, other, t.damage, t.slow, kind)) shove(other.sim, awaySide(p, other), t.shove, t.kick);
    }
    for (const h of s.targets()) if (Math.abs(h.distance - s.distance) < t.hazardRadius) s.destroy(h.key);
    c.event('shockwave', p, null, kind);
    return 'used';
  }
  if (kind === 'slick') {
    const t = T.slick;
    if (c.slicks.filter(k => k.owner === p.id).length >= t.perOwner || c.slicks.length >= t.total) return 'blocked';
    c.slicks.push({ id: c.nextId++, owner: p.id, distance: s.distance - t.behind, lane: s.lateral, life: t.life, arm: t.arm, caught: [] });
    c.event('deploy', p, null, kind);
    return 'used';
  }
  if (kind === 'seeker') {
    const t = T.seeker;
    // Reason: unlike the missile it ignores lane alignment - it hunts the nearest rival ahead anywhere on the road.
    const target = c.racers()
      .filter(o => o.id !== p.id && lockable(o))
      .map(o => ({ o, gap: c.delta(s.distance, o.sim.distance) }))
      .filter(x => x.gap > 7 && x.gap < t.range)
      .sort((a, b) => a.gap - b.gap)[0]?.o;
    if (!target) return 'fallback';
    if (c.missiles.length >= 48) return 'blocked';
    c.missiles.push({ id: c.nextId++, owner: p.id, target: target.id, distance: s.distance + 5, lane: s.lateral, life: t.life, speed: t.speed, kind, track: t.track, damage: t.damage, slow: t.slow });
    c.event('launch', p, target, kind);
    return 'used';
  }
  return 'fallback';
}

/** Slicks spin out each rival once. No damage, and a shield rides straight over one. */
export function stepSlicks(c, dt, racers, previous) {
  const t = T.slick;
  for (const k of c.slicks) {
    k.life -= dt; k.arm -= dt;
    if (k.arm > 0) continue;
    for (const p of racers) {
      if (p.id === k.owner || k.caught.includes(p.id)) continue;
      const old = previous.get(p.id)?.distance ?? p.sim.distance, d = c.delta(old, k.distance), travel = p.sim.distance - old;
      const crossed = Math.abs(c.delta(k.distance, p.sim.distance)) < t.radius || (d >= -t.radius && d <= travel + t.radius);
      if (!crossed || Math.abs(p.sim.lateral - k.lane) >= t.radius) continue;
      k.caught.push(p.id);
      const owner = c.room.players.get(k.owner);
      if (p.sim.shield > 0) { c.event('blocked', owner, p, 'slick'); continue; }
      const side = p.sim.lateral >= k.lane ? 1 : -1;
      p.sim.yawRate += side * t.spin;
      p.sim.heading = clamp(p.sim.heading + side * t.kick, -1.3, 1.3);
      p.sim.speed *= t.slow;
      c.event('spin', owner, p, 'slick');
    }
  }
  c.slicks = c.slicks.filter(k => k.life > 0);
}

/** Tucking in behind a rival raises your top speed while you stay there. Same rule for every racer. */
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
