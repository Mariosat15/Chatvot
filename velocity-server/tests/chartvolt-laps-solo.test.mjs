// ChartVolt patches (CHARTVOLT-PATCHES.md): per-room lap count and the one-pilot solo room.
// Each test names the property it pins so a probe that breaks one rule turns exactly one test red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRoom, SECONDS_PER_LAP} from '../server/race-room.mjs';
import {RaceSimulation} from '../src/simulation.js';

const T0 = 1_800_000_000_000;
const racer = (id) => ({id, name: 'Racer ' + id});
const pair = (extra = {}) => ({id: 'laps-race', trackId: 'orbital', seed: 7, players: [racer('a'), racer('b')], ...extra});
const solo = (extra = {}) => ({id: 'solo-race', trackId: 'orbital', seed: 7, players: [racer('a')], solo: true, ...extra});

test('a room without laps keeps the vendor 3 laps and 300 s exactly', () => {
  const room = new RaceRoom(pair(), T0);
  assert.equal(room.config.laps, 3);
  assert.equal(room.config.maxSeconds, 300);
  assert.equal('solo' in room.config, false);
});

test('laps sets the race limit to laps x 100 s, and each pilot sim uses it', () => {
  const room = new RaceRoom(pair({laps: 7}), T0);
  assert.equal(room.config.laps, 7);
  assert.equal(room.config.maxSeconds, 7 * SECONDS_PER_LAP);
  const sim = room.player('a').sim;
  assert.equal(sim.lapsTarget, 7);
  assert.equal(sim.maxTime, 700);
});

test('laps outside 1-10, or not a whole number, is refused', () => {
  for (const laps of [0, 11, 2.5, '3', -1]) assert.throws(() => new RaceRoom(pair({laps}), T0), /laps/);
  assert.doesNotThrow(() => new RaceRoom(pair({laps: 1}), T0));
  assert.doesNotThrow(() => new RaceRoom(pair({laps: 10}), T0));
});

test('the simulation falls back to 3 laps / 300 s when its config carries none', () => {
  const sim = new RaceSimulation(1000, () => 0, {});
  assert.equal(sim.lapsTarget, 3);
  assert.equal(sim.maxTime, 300);
});

test('a solo room starts with one pilot as soon as that pilot is Ready', () => {
  const room = new RaceRoom(solo(), T0);
  room.join('a', T0);
  room.ready('a', true, T0);
  assert.equal(room.status, 'countdown');
  assert.equal(room.config.solo, true);
});

test('a solo room refuses a second pilot, an open roster and a schedule', () => {
  assert.throws(() => new RaceRoom(solo({players: [racer('a'), racer('b')]}), T0), /solo/);
  assert.throws(() => new RaceRoom(solo({openRoster: true}), T0), /solo/);
  assert.throws(() => new RaceRoom(solo({scheduledStartAt: T0 + 60_000}), T0), /solo/);
  const room = new RaceRoom(solo(), T0);
  assert.throws(() => room.addPlayer(racer('b'), T0), /frozen/);
});

test('a shared room still needs two ready pilots to start', () => {
  const room = new RaceRoom(pair(), T0);
  room.join('a', T0);
  assert.throws(() => room.start(T0), /two/);
});
