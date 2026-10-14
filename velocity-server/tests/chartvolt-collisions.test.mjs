import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {RaceRoom} from '../server/race-room.mjs';

// CHARTVOLT PATCH history. 28 Sep 2026 (owner: "when hit the planes move like when actually hit
// something; now it is like ghosts"): contacts were made to bounce, changing heading and yaw.
// 14 Oct 2026 (owner: "remove the collision between the ships ... reduce memory and also the
// clunkiness"): REVERSED. Ships now pass through each other by design. These tests were flipped
// rather than deleted so the reason the bounce existed, and the reason it went, stay on record.

function setup() {
  const r = new RaceRoom({id: 'contact', trackId: 'orbital', seed: 123, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  const a = r.player('a'), b = r.player('b');
  for (const p of [a, b]) { p.sim.shield = 0; p.sim.lateral = 0; p.sim.heading = 0; p.sim.yawRate = 0; p.sim.content.hazards = []; p.sim.speed = 90; }
  a.sim.distance = 300; b.sim.distance = 300;
  return {r, a, b};
}
const once = r => r.feed.step(1 / 60);
const motion = s => [s.lateral, s.heading, s.yawRate, s.speed, s.distance, s.hull].join('|');

const overlaps = [
  ['side by side', ({a, b}) => { a.sim.lateral = -1; b.sim.lateral = 1; }],
  ['nose to tail', ({a, b}) => { b.sim.distance = a.sim.distance + 3; a.sim.speed = 120; b.sim.speed = 80; }],
  ['exactly on top of each other', () => {}],
  ['heavy against light', ({a, b}) => { a.sim.lateral = -1; b.sim.lateral = 1; a.sim.shipId = 'bastion'; b.sim.shipId = 'comet'; }],
];

for (const [name, arrange] of overlaps) {
  test(`ships ${name} pass through each other untouched`, () => {
    const s = setup();
    arrange(s);
    const before = [motion(s.a.sim), motion(s.b.sim)];
    once(s.r);
    assert.deepEqual([motion(s.a.sim), motion(s.b.sim)], before);
    assert.ok(!s.r.feed.events.some(e => e.type === 'bump' || e.type === 'hit' || e.type === 'destroyed'));
  });
}

test('the contact module is gone, so nothing can bring the bounce back by importing it', () => {
  assert.equal(existsSync(new URL('../server/ship-contact.mjs', import.meta.url)), false);
});
