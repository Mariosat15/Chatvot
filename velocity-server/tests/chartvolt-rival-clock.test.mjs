import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// The patch imports its siblings relatively; in this repository they live in src/.
const source = readFileSync(new URL('../client-patches/multiplayer-client.js', import.meta.url), 'utf8')
  .replace(/from '\.\/([\w-]+\.js)'/g, (_, f) => `from '${new URL(`../src/${f}`, import.meta.url).href}'`);
const file = join(mkdtempSync(join(tmpdir(), 'cv-rival-')), 'multiplayer-client.js');
writeFileSync(file, source);
const {MultiplayerClient} = await import(pathToFileURL(file).href);

// CHARTVOLT PATCH (14 Oct 2026, owner: "the other ships look clunky, forward and back instantly").
// A rival is drawn at (reported tick / 60 + leadSeconds) of server time. That moment must move
// smoothly with the wall clock however unevenly the snapshots arrive.

function clientAt(clock) {
  const c = Object.create(MultiplayerClient.prototype);
  c.rtt = 120; c.lastSnapshot = 0;
  const now = performance.now;
  performance.now = () => clock.t;
  return {c, restore: () => { performance.now = now; }};
}

test('a late snapshot does not move the drawn rival back or forward', () => {
  const clock = {t: 10000};
  const {c, restore} = clientAt(clock);
  try {
    const drawnAt = tick => tick / 60 + c.leadSeconds();
    // Snapshots every 6 ticks (100 ms) arriving on time, to settle the clock.
    for (let tick = 600; tick <= 660; tick += 6) { clock.t = 10000 + (tick - 600) * 1000 / 60; c.lastSnapshot = clock.t; c.noteClock({tick}); }
    clock.t += 90; const before = drawnAt(660);
    // The next snapshot is 150 ms late - phone-network jitter.
    clock.t += 160; c.lastSnapshot = clock.t; c.noteClock({tick: 666});
    const after = drawnAt(666);
    const elapsed = 0.16;
    assert.ok(Math.abs(after - before - elapsed) < 0.01, `projected server time jumped by ${(after - before - elapsed).toFixed(3)} s`);
  } finally { restore(); }
});

test('a new race restarting the tick re-anchors the clock instead of projecting a huge lead', () => {
  const clock = {t: 50000};
  const {c, restore} = clientAt(clock);
  try {
    c.noteClock({tick: 9000});
    clock.t += 100; c.noteClock({tick: 0});
    assert.ok(c.leadSeconds() < 0.1);
  } finally { restore(); }
});

test('a rival flying forward is never drawn moving backwards between resets', () => {
  const scene = readFileSync(new URL('../client-patches/scene.js', import.meta.url), 'utf8');
  const body = scene.slice(scene.indexOf('updateOpponents('), scene.indexOf('disposeTree(root)'));
  assert.ok(body.length > 500);
  assert.match(body, /entry\.distance=velocity>0\?Math\.max\(entry\.distance,next\):next;/);
  assert.ok(body.indexOf('Math.abs(target-entry.distance)>40') < body.indexOf('Math.max(entry.distance,next)'), 'a real jump resets first');
});