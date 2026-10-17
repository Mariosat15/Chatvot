// ChartVolt patch (CHARTVOLT-PATCHES.md): the race server shares games-service/.env.
import test from 'node:test';
import assert from 'node:assert/strict';
import {raceEnvironment} from '../server/env.mjs';

const SHARED = {
  PORT: '4010',
  HOST: '0.0.0.0',
  GAMES_PUBLIC_URL: 'https://chartvolt.com/play',
  VELOCITY_TICKET_SECRET: 't'.repeat(40),
  VELOCITY_ADMIN_KEY: 'a'.repeat(40),
  VELOCITY_RACE_URL: 'http://127.0.0.1:3080',
};

test('reads the secrets under the names games-service already uses', () => {
  const env = raceEnvironment(SHARED, '/srv/velocity');
  assert.equal(env.secret, SHARED.VELOCITY_TICKET_SECRET);
  assert.equal(env.adminKey, SHARED.VELOCITY_ADMIN_KEY);
});

test("listens on VELOCITY_RACE_URL and ignores the shared file's PORT and HOST", () => {
  const env = raceEnvironment(SHARED, '/srv/velocity');
  assert.equal(env.port, 3080);
  assert.equal(env.host, '127.0.0.1');
});

test('defaults to loopback 3080 when VELOCITY_RACE_URL is unset', () => {
  const {VELOCITY_RACE_URL: _unused, ...rest} = SHARED;
  const env = raceEnvironment(rest, '/srv/velocity');
  assert.equal(env.port, 3080);
  assert.equal(env.host, '127.0.0.1');
});

test('VELOCITY_RACE_LISTEN overrides only the bind address', () => {
  const env = raceEnvironment({...SHARED, VELOCITY_RACE_LISTEN: '0.0.0.0:3080'}, '/x');
  assert.equal(env.host, '0.0.0.0');
  assert.equal(env.port, 3080);
});

test('a malformed VELOCITY_RACE_LISTEN falls back to VELOCITY_RACE_URL', () => {
  for (const bad of ['0.0.0.0', ':3080', '0.0.0.0:99999', 'nonsense']) {
    const env = raceEnvironment({...SHARED, VELOCITY_RACE_LISTEN: bad}, '/x');
    assert.equal(env.host, '127.0.0.1', bad);
    assert.equal(env.port, 3080, bad);
  }
});

test('allows the origin of GAMES_PUBLIC_URL unless an explicit list is given', () => {
  assert.deepEqual(raceEnvironment(SHARED, '/x').origins, ['https://chartvolt.com']);
  const explicit = raceEnvironment({...SHARED, VELOCITY_ALLOWED_ORIGINS: 'https://a.test, https://b.test'}, '/x');
  assert.deepEqual(explicit.origins, ['https://a.test', 'https://b.test']);
});

test('no origin is allowed when neither is set, rather than every origin', () => {
  const {GAMES_PUBLIC_URL: _unused, ...rest} = SHARED;
  assert.deepEqual(raceEnvironment(rest, '/x').origins, []);
});
