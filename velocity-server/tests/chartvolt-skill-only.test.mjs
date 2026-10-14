// CHARTVOLT PATCH (owner, 13 Oct 2026, after the preliminary legal opinion): a paid race is skill-only.
// No weapon, item or contact may reduce another pilot's hull, speed or energy; weapons only clear towers;
// capsules are per pilot; and the grid is set by the platform (settled points, then join time), never shuffled.
// Replaces the vendor's multiplayer-combat.test.mjs, whose every test proved the opposite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaceRoom, MAX_RACERS} from '../server/race-room.mjs';
import {createRaceServer} from '../server/index.mjs';

const drive = {steer: 0, throttle: false, brake: false, boost: false, fire: false};
function setup() {
  const r = new RaceRoom({id: 'skill-test', trackId: 'orbital', seed: 123, players: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Bravo'}]}, 0);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  r.advance(5000);
  const a = r.player('a'), b = r.player('b');
  for (const p of [a, b]) { p.sim.shield = 0; p.sim.lateral = 0; p.sim.content.hazards = []; }
  a.sim.distance = 300; b.sim.distance = 370;
  return {r, a, b};
}
function steps(r, n) { for (let i = 0; i < n; i++) { r.lastNow += 1000 / 60; r.step(r.lastNow); } }
const fingerprint = (s) => JSON.stringify({hull: s.hull, energy: s.energy, shield: s.shield, respawns: s.respawns});

test('a missile with a rival ahead and no tower in range locks nothing and harms nobody', () => {
  const {r, a, b} = setup();
  const before = fingerprint(b.sim);
  a.sim.item = 'missile'; a.sim.useItem();
  assert.equal(a.sim.projectiles.length, 0);
  assert.equal(a.sim.item, 'missile', 'an unusable missile is kept, not wasted');
  steps(r, 60);
  assert.equal(fingerprint(b.sim), before);
});

test('a missile fired at a tower clears the tower and only the tower', () => {
  const {r, a, b} = setup();
  a.sim.content.hazards = [{distance: 400, lane: 0, height: 0, kind: 'tower'}];
  const before = fingerprint(b.sim);
  a.sim.item = 'missile'; a.sim.useItem();
  assert.equal(a.sim.projectiles.length, 1);
  for (let i = 0; i < 120 && a.sim.projectiles.length; i++) { a.sim.speed = 0; a.sim.update(1 / 60, drive); }
  assert.ok(a.sim.destroyed.size >= 1, 'the tower was destroyed');
  assert.equal(fingerprint(b.sim), before);
});

test('the blaster, EMP and mines are gone: fire with no item does nothing', () => {
  const {r, a, b} = setup();
  const energy = a.sim.energy, before = fingerprint(b.sim);
  a.sim.item = null; a.sim.useItem();
  assert.equal(a.sim.energy, energy);
  for (const kind of ['emp', 'mine']) { a.sim.item = kind; a.sim.useItem(); }
  steps(r, 60);
  assert.equal(fingerprint(b.sim), before);
  const snap = r.feed.snapshot();
  assert.deepEqual([snap.bolts, snap.missiles, snap.mines], [[], [], []]);
  assert.equal(r.feed.hit, undefined, 'there is no code path that damages a rival');
});

// Flipped 14 Oct 2026: contact used to bounce the hulls apart; ships now pass through each other.
test('ship contact does nothing: no bounce, no damage, nobody pushed forward', () => {
  const {r, a, b} = setup();
  b.sim.distance = a.sim.distance + 2; a.sim.speed = 100; b.sim.speed = 50;
  const dA = a.sim.distance, dB = b.sim.distance, lA = a.sim.lateral, lB = b.sim.lateral;
  r.feed.step(1 / 60);
  assert.equal(a.sim.lateral, lA); assert.equal(b.sim.lateral, lB);
  assert.equal(a.sim.hull, 1); assert.equal(b.sim.hull, 1);
  assert.equal(a.sim.distance, dA); assert.equal(b.sim.distance, dB);
  assert.ok(!r.feed.events.some(e => e.type === 'bump'));
});

test('a forged input naming a weapon, damage or target is refused those fields', () => {
  const {r, a, b} = setup();
  const accepted = r.input('a', {seq: 1, input: {...drive, fire: true}, weapon: 'missile', damage: 999, target: 'b'}, 5000);
  assert.equal(accepted, true);
  steps(r, 30);
  assert.equal(b.sim.hull, 1);
  assert.equal(a.sim.item, null);
});

// ---- grid order ----
const roster = (n) => Array.from({length: n}, (_, i) => ({id: 'p' + i, name: 'Pilot ' + i}));
function startRoom(players, order) {
  const r = new RaceRoom({id: 'grid-test', trackId: 'orbital', seed: 42, players}, 0);
  for (const p of players) r.join(p.id, 0);
  if (order) assert.equal(r.setGridOrder(order), true);
  for (const p of players) r.ready(p.id, true, 0);
  assert.equal(r.status, 'countdown');
  return r;
}
const gridOf = (r) => [...r.players.values()].sort((x, y) => x.grid - y.grid).map(p => p.id);

test('sixteen racers get separated slots, and without a pushed order the grid is registration order, not a shuffle', () => {
  const players = roster(16);
  const r = startRoom(players);
  assert.equal(new Set([...r.players.values()].map(p => p.sim.distance + ':' + p.sim.lateral)).size, 16);
  assert.deepEqual(gridOf(r), players.map(p => p.id));
  assert.deepEqual(gridOf(startRoom(players.slice().reverse())), players.map(p => p.id).reverse());
});

test('a pushed order puts the highest-ranked pilot on pole and the rest follow it', () => {
  const r = startRoom(roster(4), ['p2', 'p0', 'p3', 'p1']);
  assert.deepEqual(gridOf(r), ['p2', 'p0', 'p3', 'p1']);
  assert.equal(r.player('p2').grid, 1);
});

test('ids the order does not name start behind it, in registration order', () => {
  const r = startRoom(roster(5), ['p3', 'ghost', 'p1']);
  assert.deepEqual(gridOf(r), ['p3', 'p1', 'p0', 'p2', 'p4']);
});

test('the order is refused once the race has started, when shorter than the last, or when malformed', () => {
  const r = new RaceRoom({id: 'g', trackId: 'orbital', seed: 1, players: roster(3)}, 0);
  assert.equal(r.setGridOrder(['p0', 'p1', 'p2']), true);
  assert.equal(r.setGridOrder(['p1', 'p0']), false, 'a stale, smaller order cannot overwrite a fuller one');
  assert.equal(r.setGridOrder(['p1', 'p1', 'p0']), false, 'duplicates');
  assert.equal(r.setGridOrder(['p0', 42, 'p2']), false, 'non-string id');
  assert.equal(r.setGridOrder(Array.from({length: MAX_RACERS + 1}, (_, i) => 'x' + i)), false);
  for (const p of r.players.values()) { r.join(p.id, 0); r.ready(p.id, true, 0); }
  assert.equal(r.setGridOrder(['p2', 'p1', 'p0']), false, 'too late');
  assert.deepEqual(gridOf(r), ['p0', 'p1', 'p2']);
});

test('HTTP: the admin grid route accepts an order in the lobby and requires the admin key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'volt-grid-'));
  const adminKey = 'admin-secret-'.repeat(4);
  const app = await createRaceServer({secret: 'ticket-secret-'.repeat(4), adminKey, origins: [], dataDir: dir});
  await new Promise((res) => app.server.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = (path, token, body) => fetch(base + path, {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  try {
    assert.equal((await call('/v1/races', adminKey, {id: 'http-grid', trackId: 'orbital', seed: 3, players: roster(2)})).status, 201);
    assert.equal((await call('/v1/races/http-grid/grid', 'wrong', {order: ['p1', 'p0']})).status, 401);
    const ok = await call('/v1/races/http-grid/grid', adminKey, {order: ['p1', 'p0']});
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), {accepted: true, status: 'lobby'});
    assert.deepEqual(app.rooms.get('http-grid').gridOrder, ['p1', 'p0']);
    assert.equal((await call('/v1/races/http-grid/grid', adminKey, {order: 'p1'})).status >= 400, true);
  } finally {
    await app.close();
    await rm(dir, {recursive: true, force: true});
  }
});
