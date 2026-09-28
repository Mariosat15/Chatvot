import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';

// CHARTVOLT PATCH (owner, 28 Sep 2026: "when hit the planes move like when actually hit
// something; now it is like ghosts"). A contact must change where the ships are GOING,
// not only where they are, because the simulation rebuilds sideways speed from heading.

function setup() {
  const r = new RaceRoom({id: 'contact', trackId: 'orbital', seed: 123, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  const a = r.player('a'), b = r.player('b');
  for (const p of [a, b]) { p.sim.shield = 0; p.sim.lateral = 0; p.sim.heading = 0; p.sim.yawRate = 0; p.sim.content.hazards = []; p.sim.speed = 90; }
  a.sim.distance = 300; b.sim.distance = 300;
  return {r, a, b};
}
const once = (r, a, b) => r.combat.step(1/60, new Map([['a', {distance: a.sim.distance}], ['b', {distance: b.sim.distance}]]));
const sideways = s => s.speed * Math.sin(s.heading);

test('a side swipe sends both ships away from each other, not just apart', () => {
  const {r, a, b} = setup();
  a.sim.lateral = -1; b.sim.lateral = 1;
  once(r, a, b);
  assert.ok(sideways(a.sim) < -3, 'the left ship is now moving left');
  assert.ok(sideways(b.sim) > 3, 'the right ship is now moving right');
  assert.ok(sideways(b.sim) - sideways(a.sim) > 7, 'they separate at close to the minimum bounce');
  assert.ok(a.sim.yawRate < 0 && b.sim.yawRate > 0, 'both noses are knocked outward');
  assert.ok(r.combat.events.some(e => e.type === 'bump' && e.kind === 'side' && e.force > 0));
});

test('a heavier ship is moved less than a lighter one', () => {
  const {r, a, b} = setup();
  a.sim.lateral = -1; b.sim.lateral = 1;
  a.sim.shipId = 'bastion'; b.sim.shipId = 'comet';
  once(r, a, b);
  assert.ok(Math.abs(sideways(b.sim)) > Math.abs(sideways(a.sim)));
});

test('ramming from behind slows the rammer and never speeds up the rammed ship', () => {
  const {r, a, b} = setup();
  b.sim.distance = a.sim.distance + 3; a.sim.speed = 120; b.sim.speed = 80;
  once(r, a, b);
  assert.ok(a.sim.speed < 80, 'the rammer bounces back below the ship it hit');
  assert.ok(b.sim.speed <= 80, 'no contact awards forward progress');
  assert.ok(r.combat.events.some(e => e.type === 'bump' && e.kind === 'rear'));
});

test('a shield no longer makes a ship a ghost: it still bounces but takes no damage', () => {
  const {r, a, b} = setup();
  a.sim.lateral = -1; b.sim.lateral = 1; b.sim.shield = 3;
  once(r, a, b);
  assert.ok(sideways(b.sim) > 3);
  assert.equal(b.sim.hull, 1);
});

test('a freshly respawned ship still phases so it cannot be trapped', () => {
  const {r, a, b} = setup();
  a.sim.lateral = -1; b.sim.lateral = 1; b.phaseUntilTick = r.tick + 100;
  once(r, a, b);
  assert.equal(b.sim.heading, 0);
  assert.ok(!r.combat.events.some(e => e.type === 'bump'));
});
