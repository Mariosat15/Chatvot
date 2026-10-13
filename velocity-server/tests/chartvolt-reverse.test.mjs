// CHARTVOLT PATCH (owner, 13 Oct 2026): "add also back so it can reverse incorporate it on brake - at first
// brake then if keep press reverse", and "sometimes it stuck on the side of the road and not move".
import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceSimulation, REVERSE_SPEED, REVERSE_DELAY} from '../src/simulation.js';
import {DRIVE_LIMIT} from '../src/road-width.js';
import {serializeSimulation, restoreSimulation} from '../src/multiplayer-state.js';

const idle = {steer: 0, throttle: false, brake: false, boost: false, fire: false};
const racing = (curvature = () => 0) => {
  const s = new RaceSimulation(4000, curvature, {});
  s.start(); s.state = 'racing'; s.countdown = 0; s.distance = 200;
  return s;
};
const run = (s, input, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) s.update(1 / 60, input); };

test('brake stops first, and reverses only while it is still held', () => {
  const s = racing(); s.speed = 40;
  run(s, {...idle, brake: true}, 0.5);
  assert.equal(s.speed, 0, 'stopped, not yet reversing');
  run(s, {...idle, brake: true}, REVERSE_DELAY + 1.5);
  assert.ok(s.speed < 0, 'held brake now reverses');
  assert.ok(s.speed >= -REVERSE_SPEED, 'reverse is capped');
  const before = s.distance;
  run(s, {...idle, brake: true}, 1);
  assert.ok(s.distance < before, 'the ship actually moves backwards');
});

test('releasing brake or pressing throttle ends the reverse', () => {
  const s = racing(); s.speed = -REVERSE_SPEED;
  run(s, idle, 2);
  assert.equal(s.speed, 0, 'coasting back to a stop, never forwards on its own');
  s.speed = -REVERSE_SPEED;
  run(s, {...idle, throttle: true}, 2);
  assert.ok(s.speed > 0, 'throttle drives forwards again');
});

test('a tap on brake at a standstill does not reverse', () => {
  const s = racing(); s.speed = 0;
  run(s, {...idle, brake: true}, REVERSE_DELAY * 0.6);
  assert.equal(s.speed, 0);
});

test('a curve scraping the ship along the barrier no longer pins it there', () => {
  const s = racing(() => 0.006); s.speed = 60; s.lateral = DRIVE_LIMIT - 0.1;
  run(s, {...idle, throttle: true}, 4);
  assert.ok(s.speed > 40, `still moving at ${s.speed.toFixed(1)} m/s`);
});

test('reversing can neither go behind the line nor re-score a gate', () => {
  const s = racing(); s.distance = 1; s.speed = -REVERSE_SPEED;
  run(s, {...idle, brake: true}, 2);
  assert.ok(s.distance >= 0);
  const gate = s.content.gates?.[0];
  if (gate) {
    s.gatesHit.add(`${s.lap}:0`); const score = s.skillScore;
    s.distance = gate.distance - 2; s.lateral = gate.lane; s.speed = 30;
    run(s, idle, 0.5);
    assert.equal(s.skillScore >= score, true);
    assert.equal(s.gatesHit.size, 1, 'the gate is counted once');
  }
});

test('the reverse timer travels with the network state', () => {
  const s = racing(); s.reverseHold = 0.2;
  const copy = racing(); restoreSimulation(copy, serializeSimulation(s));
  assert.equal(copy.reverseHold, 0.2);
});
