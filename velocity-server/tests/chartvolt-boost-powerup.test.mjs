import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceSimulation} from '../src/simulation.js';

// CHARTVOLT PATCH (14 Oct 2026, owner: "put a boost as power up"): boost is earned on the track.
// The tank starts empty, does not refill on its own, and a respawn does not hand out a free tank.

const DRIVE = {steer: 0, throttle: true, brake: false, boost: true, fire: false};
function racing() {
  const s = new RaceSimulation(4000, () => 0, {content: {pickups: [], hazards: [], pads: []}});
  s.state = 'racing';
  return s;
}

test('the boost tank starts empty', () => {
  assert.equal(new RaceSimulation(4000).energy, 0);
});

test('holding boost with an empty tank does not boost', () => {
  const s = racing();
  for (let i = 0; i < 60; i++) s.update(1 / 60, DRIVE);
  assert.equal(s.boosting, false);
  assert.equal(s.energy, 0);
});

test('the tank does not refill on its own', () => {
  const s = racing();
  s.energy = .3;
  for (let i = 0; i < 300; i++) s.update(1 / 60, {...DRIVE, boost: false});
  assert.equal(s.energy, .3);
});

test('an energy capsule is what makes boost available', () => {
  const s = racing();
  assert.equal(s.collect('energy'), true);
  assert.ok(Math.abs(s.energy - .4) < 1e-9);
  s.update(1 / 60, DRIVE);
  assert.equal(s.boosting, true);
});

test('a respawn keeps the tank as it was', () => {
  const s = racing();
  s.energy = .05;
  s.recover();
  assert.equal(s.energy, .05);
});
