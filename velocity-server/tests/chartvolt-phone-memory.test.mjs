import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// CHARTVOLT PATCH (14 Oct 2026, owner: "find why the game crashes" - phones were dropped back to
// the practice screen mid-race). Phone browsers kill a tab that holds too much texture memory.

const main = readFileSync(fileURLToPath(new URL('../client-patches/main.js', import.meta.url)), 'utf8');

test('phones default to 1024 textures unless they measured as high', () => {
  assert.match(main, /\$\('textureQuality'\)\.value=tier==='high'\?'medium':'low';/);
  assert.doesNotMatch(main, /\$\('textureQuality'\)\.value=tier==='low'\?'low':'medium'/);
});

test('an iPhone can never measure as high, so it always starts on low textures', () => {
  // Safari reports no deviceMemory, so `memory` falls back to 4 and high needs 6.
  assert.match(main, /const memory=navigator\.deviceMemory\|\|4/);
  assert.match(main, /measured=memory>=6&&cores>=8\?'high'/);
});

test('a race start applies the graphics settings once, not twice', () => {
  const start = main.indexOf('async function nextRace');
  const end = main.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, 'nextRace not found');
  // Comments stripped: the Reason note itself names graphics().
  const body = main.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(body.match(/graphics\(\)/g)?.length, 1);
  // The single call must come after bloom is chosen, or a phone renders one frame with it on.
  assert.ok(body.indexOf('view.bloom.enabled=') < body.indexOf('graphics()'));
});
