import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// CHARTVOLT PATCH (14 Oct 2026, owner: "when start still other ships clunky like back and forth").
// The server's tick stands still through the countdown. A clock learned from those snapshots drifted,
// so at the green light every rival was drawn the full 0.35 s ahead and then held back for seconds.

const source = readFileSync(new URL('../client-patches/multiplayer-client.js', import.meta.url), 'utf8')
  .replace(/from '\.\/([\w-]+\.js)'/g, (_, f) => `from '${new URL(`../src/${f}`, import.meta.url).href}'`);
const file = join(mkdtempSync(join(tmpdir(), 'cv-rival-start-')), 'multiplayer-client.js');
writeFileSync(file, source);
const {MultiplayerClient} = await import(pathToFileURL(file).href);

function raceThroughCountdown(countdownMs) {
  const c = Object.create(MultiplayerClient.prototype);
  c.rtt = 120; c.lastSnapshot = 0;
  let t = 0;
  const now = performance.now;
  performance.now = () => t;
  const leads = [];
  try {
    for (; t < countdownMs; t += 100) { c.lastSnapshot = t; c.noteClock({tick: 0, status: 'countdown'}); }
    for (let k = 0; k < 20; k++) {
      c.lastSnapshot = t; c.noteClock({tick: Math.round((t - countdownMs) * 60 / 1000), status: 'racing'});
      leads.push(c.leadSeconds());
      t += 100;
    }
  } finally { performance.now = now; }
  return leads;
}

test('rivals are not over-projected at the green light after a long countdown', () => {
  for (const countdownMs of [5000, 10000]) {
    const leads = raceThroughCountdown(countdownMs);
    // Half the 120 ms round trip is the honest lead; the cap is 0.35 s.
    for (const lead of leads) assert.ok(Math.abs(lead - 0.06) < 0.02, `lead ${lead.toFixed(3)} s after a ${countdownMs} ms countdown`);
  }
});

test('a countdown snapshot drops the clock anchor; a racing one sets it', () => {
  const c = Object.create(MultiplayerClient.prototype);
  c.rtt = 120; c.lastSnapshot = 0;
  c.noteClock({tick: 0, status: 'countdown'});
  assert.equal(c.clockOffset, null);
  c.noteClock({tick: 0, status: 'racing'});
  assert.notEqual(c.clockOffset, null);
  c.noteClock({tick: 5, status: 'finished'});
  assert.equal(c.clockOffset, null);
});
