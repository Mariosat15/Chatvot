// ChartVolt patches (CHARTVOLT-PATCHES.md): open roster, late registration, scheduled start, cancellation.
// Each test names the property it pins so a probe that breaks one patch turns exactly one test red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {RaceRoom, MAX_RACERS, MAX_SCHEDULE_AHEAD_MS, SCHEDULED_COUNTDOWN_MS, LATE_JOIN_COUNTDOWN_S, DEFAULT_START_WAIT_MS} from '../server/race-room.mjs';
import {createRaceServer} from '../server/index.mjs';
import {issueTicket} from '../server/tickets.mjs';

const T0 = 1_800_000_000_000;
const GUN = T0 + 60_000;
const spec = (extra = {}) => ({id: 'sched-race', trackId: 'orbital', seed: 91, players: [], openRoster: true, scheduledStartAt: GUN, ...extra});
const racer = (id) => ({id, name: 'Racer ' + id});
/** Register, connect and (optionally) press Launch for each id. */
function seat(room, ids, {ready = true, at = T0} = {}) {
  for (const id of ids) { room.addPlayer(racer(id), at); room.join(id, at); if (ready) room.ready(id, true, at); }
}
/** Advance the room in 1/60 s ticks, holding throttle for every connected player. */
function run(room, from, to) {
  for (let now = from; now <= to; now += 1000 / 60) {
    for (const p of room.players.values()) if (p.connected) { p.lastInput = {steer: 0, throttle: true, brake: false, boost: false, fire: false}; p.lastInputAt = now; }
    room.advance(now);
  }
}

test('vendor behaviour is unchanged without the ChartVolt fields: roster of 1 refused, roster frozen', () => {
  assert.throws(() => new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a')]}, T0));
  const room = new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a'), racer('b')]}, T0);
  assert.throws(() => room.addPlayer(racer('c'), T0), /frozen/);
});

test('vendor all-ready auto start still fires for an unscheduled room, with the vendor 5 s countdown', () => {
  const room = new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a'), racer('b')]}, T0);
  for (const id of ['a', 'b']) { room.join(id, T0); room.ready(id, true, T0); }
  assert.equal(room.status, 'countdown');
  assert.equal(room.startAt, T0 + 5000);
});

test('open roster may start empty and grows to 16, then refuses the 17th', () => {
  const room = new RaceRoom(spec(), T0);
  for (let i = 0; i < MAX_RACERS; i++) room.addPlayer(racer('p' + i), T0);
  assert.equal(room.players.size, 16);
  assert.throws(() => room.addPlayer(racer('p16'), T0), /full/);
});

test('addPlayer is idempotent for a known id, even when the room is full or started', () => {
  const room = new RaceRoom(spec(), T0);
  for (let i = 0; i < MAX_RACERS; i++) room.addPlayer(racer('p' + i), T0);
  const first = room.player('p3');
  assert.equal(room.addPlayer(racer('p3'), T0), first);
});

test('a scheduled race stays open to a late pilot after the start, and closes once it has finished', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.advance(GUN);
  assert.equal(room.status, 'countdown');
  assert.ok(room.addPlayer(racer('late'), GUN + 1000));
  room.status = 'finished';
  assert.throws(() => room.addPlayer(racer('later'), GUN + 2000), /closed/);
});

test('an unscheduled open room still refuses a new player once it has left the lobby', () => {
  const room = new RaceRoom(spec({scheduledStartAt: null}), T0);
  seat(room, ['a', 'b'], {ready: false});
  room.ready('a', true, T0); room.ready('b', true, T0);
  assert.equal(room.status, 'countdown');
  assert.throws(() => room.addPlayer(racer('late'), T0 + 1000), /closed/);
});

test('a scheduled room does NOT start before its start time, even when everybody is ready', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.advance(GUN - 1);
  assert.equal(room.status, 'lobby');
});

test('at the start time with two Ready pilots a 10 s countdown begins, and only Ready pilots race', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  seat(room, ['c'], {ready: false}); // connected, never pressed Launch
  room.advance(GUN);
  assert.equal(room.status, 'countdown');
  assert.equal(SCHEDULED_COUNTDOWN_MS, 10_000);
  assert.equal(room.startAt, GUN + SCHEDULED_COUNTDOWN_MS);
  assert.equal(room.player('a').sim.countdown, 10);
  assert.deepEqual(['a', 'b', 'c'].map((id) => room.player(id).active), [true, true, false]);
});

test('connected is not enough: with one Ready pilot the lobby waits past the start time', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a']);
  seat(room, ['b'], {ready: false});
  room.advance(GUN + 30_000);
  assert.equal(room.status, 'lobby');
  room.ready('b', true, GUN + 31_000);
  room.advance(GUN + 31_000);
  assert.equal(room.status, 'countdown');
  assert.equal(room.startAt, GUN + 31_000 + SCHEDULED_COUNTDOWN_MS);
});

test('ships cannot move before the countdown reaches zero, and can after', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.advance(GUN);
  const before = room.player('a').sim.distance;
  run(room, GUN, GUN + SCHEDULED_COUNTDOWN_MS - 100);
  assert.equal(room.status, 'countdown');
  assert.equal(room.player('a').sim.distance, before);
  run(room, GUN + SCHEDULED_COUNTDOWN_MS, GUN + SCHEDULED_COUNTDOWN_MS + 2000);
  assert.equal(room.status, 'racing');
  assert.ok(room.player('a').sim.distance > before);
});

test('a pilot who Launches during the countdown takes a grid slot and goes green with everyone', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.advance(GUN);
  seat(room, ['c'], {at: GUN + 2000});
  const c = room.player('c');
  assert.equal(c.active, true);
  assert.equal(c.lateOffsetMs, 0);
  run(room, GUN + 2000, GUN + SCHEDULED_COUNTDOWN_MS + 100);
  assert.equal(c.sim.state, 'racing');
});

test('a pilot who Launches after the green light races, and the time already run counts against them', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.advance(GUN);
  const green = GUN + SCHEDULED_COUNTDOWN_MS;
  run(room, GUN, green + 20_000);
  assert.equal(room.status, 'racing');
  seat(room, ['late'], {at: green + 20_000});
  const late = room.player('late');
  assert.equal(late.active, true);
  assert.equal(late.sim.state, 'countdown');
  assert.ok(Math.abs(late.lateOffsetMs - (20_000 + LATE_JOIN_COUNTDOWN_S * 1000)) < 100, String(late.lateOffsetMs));
  run(room, green + 20_000, green + 30_000);
  assert.equal(late.sim.state, 'racing');
  const row = room.result().results.find((r) => r.playerId === 'late');
  assert.ok(row, 'late pilot is in the results');
  assert.equal(row.timeMs, late.sim.result().timeMs + late.lateOffsetMs);
  assert.equal(row.lateStartMs, late.lateOffsetMs);
});

test('a registered player who never connected does not race', () => {
  const room = new RaceRoom(spec(), T0);
  seat(room, ['a', 'b']);
  room.addPlayer(racer('ghost'), T0);
  room.advance(GUN);
  assert.equal(room.player('ghost').active, false);
  assert.equal(room.player('a').active, true);
});

test('without two Ready pilots by latestStartAt the race is cancelled and the result is final', () => {
  const room = new RaceRoom(spec({latestStartAt: GUN + 120_000}), T0);
  ['a', 'b'].forEach((id) => room.addPlayer(racer(id), T0));
  room.join('a', T0); room.ready('a', true, T0);
  room.advance(GUN + 119_999);
  assert.equal(room.status, 'lobby');
  room.advance(GUN + 120_000);
  assert.equal(room.status, 'cancelled');
  const result = room.result();
  assert.equal(result.final, true);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.cancelReason, 'too-few-ready');
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.registered, ['a', 'b']);
});

test('latestStartAt defaults to five minutes after the start and must not precede it', () => {
  assert.equal(new RaceRoom(spec(), T0).latestStartAt, GUN + DEFAULT_START_WAIT_MS);
  assert.throws(() => new RaceRoom(spec({latestStartAt: GUN - 1}), T0), /latestStartAt/);
  assert.throws(() => new RaceRoom(spec({scheduledStartAt: null, latestStartAt: GUN}), T0), /latestStartAt/);
});

test('scheduledStartAt beyond the allowed horizon is refused', () => {
  assert.throws(() => new RaceRoom(spec({scheduledStartAt: T0 + MAX_SCHEDULE_AHEAD_MS + 1}), T0), /scheduledStartAt/);
  assert.throws(() => new RaceRoom(spec({scheduledStartAt: 'soon'}), T0), /scheduledStartAt/);
});

test('a scheduled lobby outlives the vendor 30-minute eviction until its latest start', () => {
  const room = new RaceRoom(spec({scheduledStartAt: T0 + 3 * 3600_000, latestStartAt: T0 + 4 * 3600_000}), T0);
  assert.ok(room.lobbyExpiresAt() > T0 + 4 * 3600_000);
  const plain = new RaceRoom(spec({scheduledStartAt: null}), T0);
  assert.equal(plain.lobbyExpiresAt(), T0 + 1_800_000);
});

test('snapshot carries scheduledStartAt so the client can show the countdown to the gun', () => {
  const room = new RaceRoom(spec(), T0);
  room.addPlayer(racer('a'), T0);
  assert.equal(room.snapshot('a', T0).scheduledStartAt, GUN);
});

test('HTTP: admin adds players, a late ticket joins, a cancelled race archives a signed final receipt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'volt-sched-'));
  const secret = 'ticket-secret-'.repeat(4), adminKey = 'admin-secret-'.repeat(4);
  const app = await createRaceServer({secret, adminKey, origins: [], dataDir: dir});
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = (path, token, body, method = 'POST') => fetch(base + path, {method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, ...(method === 'GET' ? {} : {body: JSON.stringify(body)})});
  try {
    const startAt = Date.now() + 3_600_000;
    assert.equal((await call('/v1/races', adminKey, spec({id: 'http-sched', scheduledStartAt: startAt}))).status, 201);
    assert.equal((await call('/v1/races/http-sched/players', 'wrong', {players: [racer('a')]})).status, 401);
    const added = await call('/v1/races/http-sched/players', adminKey, {players: [racer('a')]});
    assert.equal(added.status, 200);
    assert.deepEqual((await added.json()).registered, ['a']);
    assert.equal((await call('/v1/races/http-sched/players', adminKey, {players: [racer('a')]})).status, 200);
    const ticket = issueTicket({aud: 'volt-velocity', raceId: 'http-sched', playerId: 'a', exp: Math.floor(Date.now() / 1000) + 600}, secret);
    const joined = await call('/v1/races/http-sched/join', ticket, {});
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).scheduledStartAt, startAt);
    assert.equal((await call('/v1/races/http-sched/result', adminKey, undefined, 'GET')).status, 202);

    const room = app.rooms.get('http-sched');
    room.advance(room.latestStartAt); // nobody Ready -> cancelled at the latest start
    assert.equal(room.status, 'cancelled');
    const res = await call('/v1/races/http-sched/result', adminKey, undefined, 'GET');
    assert.equal(res.status, 200);
    const receipt = await res.json();
    assert.equal(receipt.final, true);
    assert.equal(receipt.status, 'cancelled');
    assert.equal(receipt.signature, createHmac('sha256', secret).update(receipt.signedPayload).digest('hex'));
  } finally {
    await app.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('HTTP: the vendor client route is gone', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'volt-root-'));
  const app = await createRaceServer({secret: 'ticket-secret-'.repeat(4), adminKey: 'admin-secret-'.repeat(4), origins: [], dataDir: dir});
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch('http://127.0.0.1:' + app.server.address().port + '/');
    assert.equal(res.status, 404);
  } finally {
    await app.close();
    await rm(dir, {recursive: true, force: true});
  }
});
