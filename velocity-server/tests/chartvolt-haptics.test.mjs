import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHaptics, hapticForEvent, HAPTIC_PATTERNS, HOLD_ACTIONS, HOLD_PULSE_MS, HAPTICS_KEY} from '../client-patches/haptics.js';

// CHARTVOLT PATCH (14 Oct 2026, owner): a small phone vibration on wall hits, explosions and ship
// buttons - vibration, never camera shake.

const code = name => readFileSync(new URL(`../client-patches/${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function rig({touch = true, vibrate = true, stored = null} = {}) {
  const calls = [], store = new Map(stored ? [[HAPTICS_KEY, stored]] : []), timers = [];
  let t = 1000;
  const nav = vibrate ? {vibrate: p => { calls.push(p); return true; }} : {};
  const h = createHaptics({
    nav, now: () => t, isTouch: () => touch,
    storage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)},
    every: (fn, ms) => { timers.push({fn, ms, live: true}); return timers.length - 1; },
    stop: id => { timers[id].live = false; },
  });
  return {h, calls, store, timers, advance: ms => { t += ms; }};
}

test('own wall, hazard and explosion events map to the right pulse; rivals never buzz your phone', () => {
  assert.equal(hapticForEvent({type: 'impact', source: 'wall'}), 'wall');
  assert.equal(hapticForEvent({type: 'impact', source: 'me', kind: 'wall'}, 'me'), 'wall');
  assert.equal(hapticForEvent({type: 'impact'}), 'hit');
  assert.equal(hapticForEvent({type: 'impact', source: 'lava'}), 'hit');
  assert.equal(hapticForEvent({type: 'ship-destroyed'}), 'explode');
  assert.equal(hapticForEvent({type: 'destroyed', target: 'me'}, 'me'), 'explode');
  assert.equal(hapticForEvent({type: 'destroyed', target: 'rival'}, 'me'), null);
  assert.equal(hapticForEvent({type: 'impact', source: 'rival', kind: 'wall'}, 'me'), null);
  assert.equal(hapticForEvent({type: 'lap'}), null);
});

test('it vibrates on a touch device that supports it and stays silent everywhere else', () => {
  const ok = rig();
  assert.equal(ok.h.pulse('wall'), true);
  assert.deepEqual(ok.calls, [HAPTIC_PATTERNS.get('wall')]);
  for (const r of [rig({touch: false}), rig({vibrate: false}), rig({stored: 'off'})]) {
    assert.equal(r.h.pulse('wall'), false);
    assert.deepEqual(r.calls, []);
  }
  assert.equal(rig({vibrate: false}).h.supported, false, 'iPhone browsers have no vibrate(), so the switch is withheld there');
});

test('every pulse is short but long enough to feel, and an explosion is the strongest', () => {
  const total = p => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p);
  for (const [kind, p] of HAPTIC_PATTERNS) assert.ok(total(p) >= 5 && total(p) <= 400, `${kind} lasts ${total(p)}ms`);
  for (const kind of ['press', 'hold', 'wall', 'hit']) assert.ok(total(HAPTIC_PATTERNS.get(kind)) < total(HAPTIC_PATTERNS.get('explode')));
});

test('an unknown or inherited kind never vibrates', () => {
  const r = rig();
  for (const kind of ['constructor', '__proto__', 'toString', null, undefined]) assert.equal(r.h.pulse(kind), false);
  assert.deepEqual(r.calls, []);
});

test('a long scrape is a series of taps, not a motor that never stops', () => {
  const r = rig();
  assert.equal(r.h.pulse('wall'), true);
  r.advance(40); assert.equal(r.h.pulse('wall'), false);
  r.advance(200); assert.equal(r.h.pulse('wall'), true);
});

test('a button tap never cuts an explosion short', () => {
  const r = rig();
  r.h.pulse('explode');
  r.advance(30); assert.equal(r.h.pulse('press'), false);
  r.advance(400); assert.equal(r.h.pulse('press'), true);
});

test('turning and braking tick while held; throttle, held all race, does not', () => {
  assert.deepEqual([...HOLD_ACTIONS].sort(), ['brake', 'left', 'right', 'steer']);
  const r = rig();
  r.h.hold('throttle', true);
  assert.equal(r.timers.length, 0);
  r.h.hold('left', true); r.h.hold('brake', true);
  assert.equal(r.timers.length, 1, 'one tick timer however many are held');
  assert.equal(r.timers[0].ms, HOLD_PULSE_MS);
  r.timers[0].fn(); assert.deepEqual(r.calls, [HAPTIC_PATTERNS.get('hold')]);
  r.h.hold('left', false); assert.equal(r.timers[0].live, true);
  r.h.hold('brake', false); assert.equal(r.timers[0].live, false);
  r.h.hold('right', true); r.h.releaseAll(); assert.equal(r.timers.at(-1).live, false);
});

test('switching it off stops any pulse and is remembered', () => {
  const r = rig();
  r.h.setEnabled(false);
  assert.deepEqual(r.calls, [0]);
  assert.equal(r.store.get(HAPTICS_KEY), 'off');
  assert.equal(r.h.pulse('explode'), false);
});

test('a vibrate() that throws is swallowed rather than taking the race down', () => {
  const h = createHaptics({nav: {vibrate: () => { throw new Error('policy'); }}, isTouch: () => true, storage: null, now: () => 0});
  assert.equal(h.pulse('press'), false);
});

test('the touch pad and every ship button pulse on press and start or stop the hold tick', () => {
  const t = code('touch-controls.js');
  assert.match(t, /pad\.classList\.add\('pressed'\);haptics\?\.pulse\('press'\);haptics\?\.hold\('steer',true\)/);
  assert.match(t, /button\.classList\.add\('pressed'\);haptics\?\.pulse\('press'\);haptics\?\.hold\(button\.dataset\.action,true\)/);
  assert.match(t, /function clear\(\)\{haptics\?\.hold\('steer',false\)/);
  assert.match(t, /function resetAll\(\)\{clear\(\);haptics\?\.releaseAll\(\)/);
  assert.match(t, /if\(was&&!\[\.\.\.pointers\.values\(\)\]\.includes\(was\)\)haptics\?\.hold\(was,false\)/);
});

test('solo and live races both feed own events to the vibration, and nothing shakes the camera', () => {
  const m = code('main.js'), s = code('scene.js');
  assert.match(m, /for\(const e of sim\.events\)\{haptics\.pulse\(hapticForEvent\(e\)\)/);
  assert.match(m, /if\(\(s\.tick-e\.tick\)<24\)haptics\.pulse\(hapticForEvent\(e,multiplayer\.playerId\)\)/);
  assert.match(m, /queueFire:\(\)=>fireQueued=true,haptics\}\)/);
  assert.match(m, /\$\('vibration'\)\.closest\('label'\)\.hidden=!haptics\.supported/);
  for (const gone of [/shakeBy/, /applyShake/, /bumpBurst/, /'bump'/]) { assert.doesNotMatch(m, gone); assert.doesNotMatch(s, gone); }
  assert.match(readFileSync(new URL('../client-patches/root/index.html', import.meta.url), 'utf8'), /<input id="vibration" type="checkbox" checked>/);
});

test('a wall hit is labelled at the source so the phone can tell it from a hazard', () => {
  const sim = readFileSync(new URL('../src/simulation.js', import.meta.url), 'utf8');
  assert.match(sim, /\.001\)\);this\.events\.push\(\{type:'impact',source:'wall'\}\)/);
});
