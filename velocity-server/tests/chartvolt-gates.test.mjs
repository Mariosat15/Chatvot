import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceSimulation,GATE_HALF_WIDTH} from '../src/simulation.js';

// CHARTVOLT PATCH (owner, 28 Sep 2026: "the rings that give you points don't work").
// The vendor scored a gate only inside 3.2 m of its centre and above 45 m/s while
// drawing it 9 m wide, so flying through the drawn opening could still miss.
// The score zone is now exactly the drawn opening, with no hidden speed rule.

function throughGate(lateral, speed) {
  const s = new RaceSimulation(3000, () => 0, {content: {pickups: [], hazards: [], pads: [], gates: [{distance: 5, lane: 0}]}});
  s.state = 'racing'; s.speed = speed; s.lateral = lateral;
  for (let i = 0; i < 30; i++) s.update(1/60, {});
  return s;
}

test('flying through the edge of the drawn opening scores', () => {
  const s = throughGate(GATE_HALF_WIDTH - 0.3, 60);
  assert.equal(s.gatesHit.size, 1);
  assert.equal(s.skillScore, 100);
});

test('a slow ship through the gate still scores (no hidden speed rule)', () => {
  const s = throughGate(0, 20);
  assert.equal(s.gatesHit.size, 1);
});

test('passing outside the posts misses, resets the chain and says so', () => {
  const s = new RaceSimulation(3000, () => 0, {content: {pickups: [], hazards: [], pads: [], gates: [{distance: 5, lane: 0}]}});
  s.state = 'racing'; s.speed = 60; s.lateral = GATE_HALF_WIDTH + 0.5; s.chain = 3;
  const events = [];
  for (let i = 0; i < 30; i++) { s.update(1/60, {}); events.push(...s.events); }
  assert.equal(s.gatesMissed.size, 1);
  assert.equal(s.chain, 0);
  assert.ok(events.some(e => e.type === 'gate-missed'));
});

test('the gate width the client draws is the width the server scores', () => {
  assert.equal(GATE_HALF_WIDTH, 4.5);
});
