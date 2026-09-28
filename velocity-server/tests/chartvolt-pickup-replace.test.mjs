import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';

// CHARTVOLT PATCH (owner, 28 Sep 2026): picking up a weapon while holding one replaces it.
// The vendor refused the pickup instead, so a player sitting on an item they did not want could
// never take the capsule in front of them. The rule is in the shared simulation, so the server
// (which decides) and the client (which predicts) agree, and it is the same for every racer.

function room() {
  const r = new RaceRoom({id: 'pickup-replace', trackId: 'orbital', seed: 7, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  return r;
}

test('a new weapon replaces the held one', () => {
  const s = room().player('a').sim;
  assert.equal(s.collect('shield'), true);
  assert.equal(s.collect('missile'), true);
  assert.equal(s.item, 'missile');
  assert.equal(s.pickupCount, 2);
});

test('repair and energy never touch the held weapon', () => {
  const s = room().player('a').sim;
  s.collect('mine');
  s.hull = .5; s.energy = .1;
  s.collect('repair'); s.collect('energy');
  assert.equal(s.item, 'mine');
  assert.ok(s.hull > .5 && s.energy > .1);
});

test('a shared capsule goes to the first racer through it even when they already hold a weapon', () => {
  const r = room(), a = r.player('a'), b = r.player('b');
  const pickup = r.track.content.pickups.find((p) => !['energy', 'repair'].includes(p.kind)) ?? r.track.content.pickups[0];
  pickup.kind = 'emp';
  a.sim.item = 'shield';
  for (const p of [a, b]) { p.sim.lateral = pickup.lane; p.sim.content.hazards = []; }
  const index = r.track.content.pickups.indexOf(pickup);
  const previous = new Map([[a.id, {distance: pickup.distance - 2}], [b.id, {distance: pickup.distance - 30}]]);
  a.sim.distance = pickup.distance + 1;
  b.sim.distance = pickup.distance - 29;
  r.combat.sharedPickups([a, b], previous);
  assert.equal(a.sim.item, 'emp');
  assert.ok(r.combat.pickups[index] > r.raceElapsed);
});

test('a racer who is redeploying still cannot collect', () => {
  const s = room().player('a').sim;
  s.item = 'shield';
  s.respawnRemaining = 2;
  assert.equal(s.collect('missile'), false);
  assert.equal(s.item, 'shield');
});
