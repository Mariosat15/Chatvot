// CHARTVOLT PATCH (owner, 28 Sep 2026: "more features, more exciting, more power-ups").
// Two capsules (seeker, magnet) remain from the five added that day, plus slipstream and the perfect start.
// Since 13 Oct 2026 no item touches another racer at all; every rule is the same for every pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';
import {RaceSimulation} from '../src/simulation.js';
import {createTrack} from '../src/track.js';
import {generateContent, BALANCED_MIX} from '../src/race-content.js';
import {TRACKS} from '../src/tracks.js';
import {ITEMS} from '../src/catalog.js';
import {SPECIAL_KINDS, POWER_TUNING, pickupRadius, PICKUP_RADIUS} from '../src/power-tuning.js';

function setup() {
  const r = new RaceRoom({id: 'powers', trackId: 'orbital', seed: 123, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  const a = r.player('a'), b = r.player('b');
  for (const p of [a, b]) { Object.assign(p.sim, {shield: 0, counter: 0, lateral: 0, heading: 0, yawRate: 0, speed: 90, cooldown: 0, item: null}); p.sim.content.hazards = []; }
  a.sim.distance = 300; b.sim.distance = 300;
  return {r, a, b};
}
const stepCombat = (r, dt, prev) => r.feed.step(dt, new Map(Object.entries(prev).map(([id, distance]) => [id, {distance}])));

// Reason (13 Oct 2026, owner: "too many power-ups, no balance"): the base is 12 capsules with one fixed mix,
// so the balance is the same on every track and seed rather than whatever a shuffle of 24 dealt.
test('every track and seed carries the 12 balanced capsules and adds each new kind exactly once', () => {
  for (const def of TRACKS) for (const seed of [1, 7, 123, 99991]) {
    const pickups = generateContent(createTrack(def.id), seed).pickups;
    const base = pickups.filter(p => !SPECIAL_KINDS.includes(p.kind)).map(p => p.kind).sort();
    assert.deepEqual(base, [...BALANCED_MIX].sort(), `${def.id} seed ${seed}`);
    const d = pickups.map(p => p.distance), len = createTrack(def.id).length;
    assert.ok(d[0] < len * .2 && d[d.length - 1] > len * .8, `${def.id} capsules still span the lap`);
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

// CHARTVOLT PATCH (13 Oct 2026, skill-only races, after the legal opinion). Shockwave, oil slick, cloak,
// EMP and mines are gone, and the seeker hunts towers. These replace the 28 Sep tests that proved
// those effects reached a rival - the opposite of what a paid race may now allow.
const REMOVED = ['emp', 'mine', 'shockwave', 'slick', 'cloak'];

test('no removed item exists in the catalogue or on any track', () => {
  for (const k of REMOVED) assert.equal(ITEMS[k], undefined, k);
  for (const def of TRACKS) for (const seed of [1, 7, 123, 99991]) {
    const kinds = generateContent(createTrack(def.id), seed).pickups.map(p => p.kind);
    for (const k of REMOVED) assert.ok(!kinds.includes(k), `${def.id} seed ${seed} still places ${k}`);
  }
});

test('a seeker locks a tower out of missile range and leaves the rival alone', () => {
  const {r, a, b} = setup();
  a.sim.content.hazards = [{distance: 550, lane: 0, height: 0, kind: 'tower'}];
  b.sim.distance = 320;
  assert.equal(a.sim.target(180), undefined, 'a plain missile cannot reach it');
  a.sim.item = 'seeker'; a.sim.useItem();
  assert.equal(a.sim.projectiles.length, 1, 'the seeker locked the tower');
  assert.equal(a.sim.item, null);
  assert.equal(b.sim.hull, 1);
});

test('using any remaining item never changes a rival', () => {
  for (const kind of ['missile', 'seeker', 'shield', 'counter', 'overdrive', 'magnet']) {
    const {r, a, b} = setup();
    a.sim.content.hazards = [{distance: 400, lane: 0, height: 0, kind: 'tower'}];
    b.sim.distance = 330; b.sim.lateral = 0;
    const before = JSON.stringify({hull: b.sim.hull, speed: b.sim.speed, energy: b.sim.energy, lateral: b.sim.lateral, heading: b.sim.heading});
    a.sim.item = kind; a.sim.useItem();
    for (let i = 0; i < 90; i++) { b.sim.speed = 90; stepCombat(r, 1 / 60, {a: 300, b: 330}); }
    b.sim.speed = 90;
    assert.equal(JSON.stringify({hull: b.sim.hull, speed: b.sim.speed, energy: b.sim.energy, lateral: b.sim.lateral, heading: b.sim.heading}), before, kind);
  }
});

test('the room snapshot describes no rival weapon', () => {
  const {r} = setup();
  const snap = r.feed.snapshot();
  assert.equal(snap.lockTarget, null);
  for (const k of ['bolts', 'missiles', 'mines', 'slicks', 'unavailablePickups']) assert.deepEqual(snap[k], [], k);
  assert.equal(snap.skillOnly, true);
  assert.equal(r.config.competitiveCombat, false);
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
  assert.ok(r.feed.events.some(e => e.type === 'slipstream' && e.source === 'a'));
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
  assert.ok(r.feed.events.some(e => e.type === 'perfect-start' && e.source === 'a'));
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
