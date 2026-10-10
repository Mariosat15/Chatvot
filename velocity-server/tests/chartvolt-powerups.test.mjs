// CHARTVOLT PATCH (owner, 28 Sep 2026: "more features, more exciting, more power-ups").
// Five new capsules, slipstream and the perfect start. Every effect that touches another racer is
// decided by the server, and every rule is the same for every pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';
import {RaceSimulation} from '../src/simulation.js';
import {createTrack} from '../src/track.js';
import {generateContent} from '../src/race-content.js';
import {TRACKS} from '../src/tracks.js';
import {ITEMS} from '../src/catalog.js';
import {SPECIAL_KINDS, POWER_TUNING, pickupRadius, PICKUP_RADIUS} from '../src/power-tuning.js';

function setup() {
  const r = new RaceRoom({id: 'powers', trackId: 'orbital', seed: 123, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  const a = r.player('a'), b = r.player('b');
  for (const p of [a, b]) { Object.assign(p.sim, {shield: 0, counter: 0, cloak: 0, lateral: 0, heading: 0, yawRate: 0, speed: 90, cooldown: 0, item: null}); p.sim.content.hazards = []; }
  a.sim.distance = 300; b.sim.distance = 300;
  return {r, a, b};
}
const stepCombat = (r, dt, prev) => r.combat.step(dt, new Map(Object.entries(prev).map(([id, distance]) => [id, {distance}])));

test('every track and seed keeps the vendor 24 capsules and adds each new kind exactly once', () => {
  for (const def of TRACKS) for (const seed of [1, 7, 123, 99991]) {
    const pickups = generateContent(createTrack(def.id), seed).pickups;
    assert.equal(pickups.filter(p => !SPECIAL_KINDS.includes(p.kind)).length, 24, def.id);
    assert.deepEqual(pickups.filter(p => SPECIAL_KINDS.includes(p.kind)).map(p => p.kind).sort(), [...SPECIAL_KINDS].sort(), def.id);
  }
});

test('the extra capsules stay in distance order and never crowd a neighbour', () => {
  for (const def of TRACKS) for (const seed of [1, 7, 123]) {
    const d = generateContent(createTrack(def.id), seed).pickups.map(p => p.distance);
    for (let i = 1; i < d.length; i++) assert.ok(d[i] - d[i - 1] >= 25, `${def.id} seed ${seed} index ${i}`);
  }
});

test('every new kind has a name for its floating label', () => {
  for (const k of SPECIAL_KINDS) assert.ok(ITEMS[k]?.name, k);
});

test('a shockwave hits and shoves a nearby rival and leaves a distant one alone', () => {
  const {r, a, b} = setup();
  const c = r.player('b');
  b.sim.distance = 305; b.sim.lateral = 3;
  a.sim.item = 'shockwave'; a.sim.useItem();
  assert.ok(b.sim.hull < 1, 'the nearby rival took damage');
  assert.ok(b.sim.lateral > 3 + 1, 'the nearby rival was pushed away');
  assert.ok(r.combat.events.some(e => e.type === 'shockwave' && e.source === 'a'));
  assert.equal(a.sim.item, null, 'the capsule was spent');
  const far = setup();
  far.b.sim.distance = 360; far.a.sim.item = 'shockwave'; far.a.sim.useItem();
  assert.equal(far.b.sim.hull, 1);
  assert.ok(c);
});

test('a shield blocks the shockwave completely', () => {
  const {r, a, b} = setup();
  b.sim.distance = 305; b.sim.lateral = 3; b.sim.shield = 2;
  a.sim.item = 'shockwave'; a.sim.useItem();
  assert.equal(b.sim.hull, 1);
  assert.equal(b.sim.lateral, 3, 'a blocked shockwave does not shove');
  assert.ok(r.combat.events.some(e => e.type === 'blocked'));
});

test('an oil slick spins out the rival who drives over it, once', () => {
  const {r, a, b} = setup();
  a.sim.item = 'slick'; a.sim.useItem();
  assert.equal(r.combat.slicks.length, 1);
  a.sim.lateral = 7; b.sim.distance = 250;
  stepCombat(r, 0.6, {a: 300, b: 250});
  b.sim.distance = 295; b.sim.speed = 90;
  stepCombat(r, 1 / 60, {a: 300, b: 285});
  assert.ok(Math.abs(b.sim.yawRate) > 1, 'the rival is spinning');
  assert.ok(b.sim.speed < 90 * POWER_TUNING.slick.slow + 0.01, 'and slowed');
  assert.equal(b.sim.hull, 1, 'a slick does no damage');
  const spins = r.combat.events.filter(e => e.type === 'spin').length;
  stepCombat(r, 1 / 60, {a: 300, b: 285});
  assert.equal(r.combat.events.filter(e => e.type === 'spin').length, spins, 'the same slick never catches the same racer twice');
});

test('a pilot may have at most two slicks out; the third capsule is kept', () => {
  const {r, a} = setup();
  for (let i = 0; i < 3; i++) { a.sim.cooldown = 0; a.sim.item = 'slick'; a.sim.useItem(); }
  assert.equal(r.combat.slicks.length, 2);
  assert.equal(a.sim.item, 'slick');
});

test('the slick snapshot does not leak who it has already caught', () => {
  const {r, a} = setup();
  a.sim.item = 'slick'; a.sim.useItem();
  const snap = r.combat.snapshot('a');
  assert.equal(snap.slicks.length, 1);
  assert.equal('caught' in snap.slicks[0], false);
});

test('a seeker locks the nearest rival ahead in any lane and hits it', () => {
  const {r, a, b} = setup();
  a.sim.lateral = -6; b.sim.distance = 360; b.sim.lateral = 6;
  a.sim.item = 'seeker'; a.sim.useItem();
  assert.equal(r.combat.missiles.length, 1);
  assert.equal(r.combat.missiles[0].kind, 'seeker');
  for (let i = 0; i < 60; i++) stepCombat(r, 1 / 60, {a: 300, b: 360});
  assert.ok(b.sim.hull < 1);
  assert.ok(r.combat.events.some(e => e.type === 'hit' && e.kind === 'seeker'));
});

test('a cloaked rival cannot be locked by a missile or a seeker', () => {
  const {r, a, b} = setup();
  b.sim.distance = 360; b.sim.cloak = 3;
  assert.equal(r.combat.target(a), undefined);
  a.sim.item = 'seeker'; a.sim.useItem();
  assert.equal(r.combat.missiles.length, 0);
});

test('a magnet widens the capsule catch radius and nothing else does', () => {
  assert.equal(pickupRadius({magnet: 0}), PICKUP_RADIUS);
  assert.equal(pickupRadius({magnet: 2}), POWER_TUNING.magnet.radius);
  const sim = new RaceSimulation(1000);
  sim.item = 'magnet'; sim.state = 'racing'; sim.useItem();
  assert.equal(sim.magnet, POWER_TUNING.magnet.seconds);
});

test('tucking in behind a rival gives slipstream; alongside or far back does not', () => {
  const {r, a, b} = setup();
  b.sim.distance = 315;
  stepCombat(r, 1 / 60, {a: 300, b: 315});
  assert.equal(a.sim.draft, POWER_TUNING.slipstream.hold);
  assert.ok(!(b.sim.draft > 0), 'the leader gets nothing');
  assert.ok(r.combat.events.some(e => e.type === 'slipstream' && e.source === 'a'));
  const wide = setup();
  wide.b.sim.distance = 315; wide.b.sim.lateral = 6;
  stepCombat(wide.r, 1 / 60, {a: 300, b: 315});
  assert.ok(!(wide.a.sim.draft > 0));
});

function countdownRoom() {
  const r = new RaceRoom({id: 'launch', trackId: 'orbital', seed: 5, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(1);
  assert.equal(r.status, 'countdown');
  return r;
}
const press = (r, id, seq, throttle, now) => r.input(id, {seq, input: {steer: 0, throttle, brake: false, boost: false, fire: false}}, now);

test('pressing throttle in the last half second before green is a perfect start', () => {
  const r = countdownRoom();
  press(r, 'a', 1, true, r.startAt - 300);
  r.advance(r.startAt);
  assert.equal(r.player('a').sim.padBoost, POWER_TUNING.perfectStart.boost);
  assert.ok(!(r.player('b').sim.padBoost > 0));
  assert.ok(r.combat.events.some(e => e.type === 'perfect-start' && e.source === 'a'));
});

test('holding throttle through the whole countdown earns nothing', () => {
  const r = countdownRoom();
  press(r, 'a', 1, true, r.startAt - 2000);
  press(r, 'a', 2, true, r.startAt - 200);
  r.advance(r.startAt);
  assert.ok(!(r.player('a').sim.padBoost > 0));
});

test('the solo simulation times its own perfect start the same way', () => {
  const on = {steer: 0, throttle: true, brake: false, boost: false, fire: false}, off = {...on, throttle: false};
  // Reason: the simulation clears its event list at the top of every update, so collect as it runs.
  const run = (inputs) => { const s = new RaceSimulation(1000), seen = []; s.start(); for (const i of inputs) { s.update(0.1, i); seen.push(...s.events.map(e => e.type)); } return seen; };
  assert.ok(run([...Array(27).fill(off), ...Array(6).fill(on)]).includes('perfect-start'));
  assert.ok(!run(Array(35).fill(on)).includes('perfect-start'));
});
