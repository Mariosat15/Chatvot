// ChartVolt patches (CHARTVOLT-PATCHES.md): open roster, late registration, scheduled start, cancellation.
// Each test names the property it pins so a probe that breaks one patch turns exactly one test red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {RaceRoom, COUNTDOWN_MS, MAX_RACERS, MAX_SCHEDULE_AHEAD_MS} from '../server/race-room.mjs';
import {createRaceServer} from '../server/index.mjs';
import {issueTicket} from '../server/tickets.mjs';

const T0 = 1_800_000_000_000;
const spec = (extra = {}) => ({id: 'sched-race', trackId: 'orbital', seed: 91, players: [], openRoster: true, scheduledStartAt: T0 + 60_000, ...extra});
const racer = (id) => ({id, name: 'Racer ' + id});

test('vendor behaviour is unchanged without the ChartVolt fields: roster of 1 refused, roster frozen', () => {
  assert.throws(() => new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a')]}, T0));
  const room = new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a'), racer('b')]}, T0);
  assert.throws(() => room.addPlayer(racer('c'), T0), /frozen/);
});

test('vendor all-ready auto start still fires for an unscheduled room', () => {
  const room = new RaceRoom({id: 'v', trackId: 'orbital', seed: 1, players: [racer('a'), racer('b')]}, T0);
  for (const id of ['a', 'b']) { room.join(id, T0); room.ready(id, true, T0); }
  assert.equal(room.status, 'countdown');
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

test('addPlayer refuses a new player once the race has left the lobby', () => {
  const room = new RaceRoom(spec(), T0);
  ['a', 'b'].forEach((id) => { room.addPlayer(racer(id), T0); room.join(id, T0); });
  room.advance(T0 + 60_000 - COUNTDOWN_MS);
  assert.equal(room.status, 'countdown');
  assert.throws(() => room.addPlayer(racer('late'), T0 + 60_000), /closed/);
});

test('a scheduled room does NOT start early when everybody is ready', () => {
  const room = new RaceRoom(spec(), T0);
  ['a', 'b'].forEach((id) => { room.addPlayer(racer(id), T0); room.join(id, T0); room.ready(id, true, T0); });
  assert.equal(room.status, 'lobby');
  room.advance(T0 + 60_000 - COUNTDOWN_MS - 50);
  assert.equal(room.status, 'lobby');
});

test('scheduled start goes green AT scheduledStartAt, and not-Ready connected players race', () => {
  const room = new RaceRoom(spec(), T0);
  ['a', 'b', 'c'].forEach((id) => { room.addPlayer(racer(id), T0); room.join(id, T0); });
  room.ready('a', true, T0); // b and c never press Ready
  room.advance(T0 + 60_000 - COUNTDOWN_MS);
  assert.equal(room.status, 'countdown');
  assert.equal(room.startAt, T0 + 60_000);
  assert.deepEqual(['a', 'b', 'c'].map((id) => room.player(id).active), [true, true, true]);
});

test('a registered player who never connected does not race', () => {
  const room = new RaceRoom(spec(), T0);
  ['a', 'b', 'ghost'].forEach((id) => room.addPlayer(racer(id), T0));
  room.join('a', T0); room.join('b', T0);
  room.advance(T0 + 60_000 - COUNTDOWN_MS);
  assert.equal(room.player('ghost').active, false);
  assert.equal(room.player('a').active, true);
});

test('fewer than two connected at the start cancels the race and the result is final', () => {
  const room = new RaceRoom(spec(), T0);
  ['a', 'b'].forEach((id) => room.addPlayer(racer(id), T0));
  room.join('a', T0);
  room.advance(T0 + 60_000 - COUNTDOWN_MS);
  assert.equal(room.status, 'cancelled');
  const result = room.result();
  assert.equal(result.final, true);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.cancelReason, 'too-few-connected');
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.registered, ['a', 'b']);
  room.advance(T0 + 70_000);
  assert.equal(room.status, 'cancelled');
});

test('scheduledStartAt beyond the allowed horizon is refused', () => {
  assert.throws(() => new RaceRoom(spec({scheduledStartAt: T0 + MAX_SCHEDULE_AHEAD_MS + 1}), T0), /scheduledStartAt/);
  assert.throws(() => new RaceRoom(spec({scheduledStartAt: 'soon'}), T0), /scheduledStartAt/);
});

test('a scheduled lobby outlives the vendor 30-minute eviction until its start', () => {
  const room = new RaceRoom(spec({scheduledStartAt: T0 + 3 * 3600_000}), T0);
  assert.ok(room.lobbyExpiresAt() > T0 + 3 * 3600_000);
  const plain = new RaceRoom(spec({scheduledStartAt: null}), T0);
  assert.equal(plain.lobbyExpiresAt(), T0 + 1_800_000);
});

test('snapshot carries scheduledStartAt so the client can show the countdown to the gun', () => {
  const room = new RaceRoom(spec(), T0);
  room.addPlayer(racer('a'), T0);
  assert.equal(room.snapshot('a', T0).scheduledStartAt, T0 + 60_000);
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
    room.advance(startAt - COUNTDOWN_MS); // nobody connected over events -> cancelled
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
