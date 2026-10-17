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
  s.collect('counter');
  s.hull = .5; s.energy = .1;
  s.collect('repair'); s.collect('energy');
  assert.equal(s.item, 'counter');
  assert.ok(s.hull > .5 && s.energy > .1);
});

// CHARTVOLT PATCH (13 Oct 2026, skill-only races): capsules are per pilot. Replaces the 28 Sep test
// "a shared capsule goes to the first racer through it" - reaching a capsule first used to take it
// away from the pilot behind, which is one racer's play changing another's.
test('two pilots driving through the same capsule each collect it', () => {
  const r = room(), a = r.player('a'), b = r.player('b');
  const pickup = r.track.content.pickups.find(p => !['energy', 'repair'].includes(p.kind));
  for (const p of [a, b]) { p.sim.lateral = pickup.lane; p.sim.content.hazards = []; p.sim.item = null; p.sim.distance = pickup.distance - 1; p.sim.speed = 60; }
  for (let i = 0; i < 10; i++) { r.lastNow += 1000 / 60; r.step(r.lastNow); }
  assert.equal(a.sim.item, pickup.kind);
  assert.equal(b.sim.item, pickup.kind);
});

test('a racer who is redeploying still cannot collect', () => {
  const s = room().player('a').sim;
  s.item = 'shield';
  s.respawnRemaining = 2;
  assert.equal(s.collect('missile'), false);
  assert.equal(s.item, 'shield');
});
