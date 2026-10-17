import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// CHARTVOLT PATCH (14 Oct 2026, owner: "still a bit heavy for mobiles ... when go out and come in the
// game ... the music and sound stops ... put [the wordings] between the buttons").

const read = name => readFileSync(fileURLToPath(new URL(`../client-patches/${name}`, import.meta.url)), 'utf8');
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const audio = strip(read('audio.js'));
const main = strip(read('main.js'));
const scene = strip(read('scene.js'));
const trackLife = strip(read('track-life.js'));
const architecture = strip(read('architecture.js'));
const living = strip(read('living-world.js'));
const traffic = strip(read('traffic-kit.js'));
const hud = strip(read('root/cv-hud.css'));

function method(src, name) {
  const start = src.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const end = src.indexOf('\n  }', start);
  return src.slice(start, end > start ? end : undefined);
}

test('a stuck audio context is replaced on the next gesture, never from a timer', () => {
  const wake = method(audio, 'wake');
  assert.match(wake, /fromGesture&&\(this\.stalled/, 'only a gesture may rebuild');
  const timer = wake.slice(wake.indexOf('setTimeout('));
  assert.doesNotMatch(timer.slice(0, timer.indexOf(';},')), /rebuild\(/, 'iOS refuses a new context outside a gesture');
  const rebuild = method(audio, 'rebuild');
  assert.match(rebuild, /this\.ctx=null/);
  assert.match(rebuild, /this\.rack=null/);
  assert.match(rebuild, /this\.unlock\(\)/);
});

test('unlock cannot hang the solo Resume button on a context iOS will not resume', () => {
  assert.match(audio, /await Promise\.race\(\[this\.ctx\.resume\(\),new Promise\(r=>setTimeout\(r,RESUME_WAIT_MS\)\)\]\)\.catch\(/);
  assert.doesNotMatch(audio, /await this\.ctx\.resume\(\);/);
});

test('returning to the page wakes the sound in multiplayer, and a paused solo race stays silent', () => {
  const pause = main.slice(main.indexOf('function pause(){'), main.indexOf('async function resume('));
  const mp = pause.slice(0, pause.indexOf('return;}'));
  assert.match(mp, /audio\.pause\(\)/, 'a live race suspends its sound when hidden');
  assert.match(main, /const wakeAudio=gesture=>\{if\(!multiplayer&&sim\.state==='paused'\)return;[\s\S]{0,200}?return;\}audio\.wake\(gesture\);\}/);
  // 14 Oct 2026: a frame reloaded mid-race has no audio context; the first tap must create one, not wake nothing.
  assert.match(main, /if\(gesture&&multiplayer&&!audio\.ctx&&\['racing','countdown'\]\.includes\(sim\.state\)\)\{audio\.begin\(config\.trackId,config\.seed\);audio\.unlock\(\)/);
  assert.match(main, /dataset\.resume==='true'\)resume\(\);if\(multiplayer\)audio\.wake\(false\);/, 'closing the menu wakes a live race\'s sound');
  assert.match(main, /if\(document\.hidden\)pause\(\);else wakeAudio\(false\);/);
  assert.match(main, /addEventListener\('pageshow',\(\)=>wakeAudio\(false\)\)/);
  assert.match(main, /\['pointerdown','touchend','keydown'\]\)addEventListener\(type,\(\)=>wakeAudio\(true\),\{capture:true/);
});

test('phones render no shadow map at any tier', () => {
  assert.match(main, /\$\('shadowQuality'\)\.value='off';/);
  assert.doesNotMatch(main, /\$\('shadowQuality'\)\.value=tier/);
});

test('a phone keeps only the engine glow among the local point lights', () => {
  assert.match(scene, /if\(!PHONE\|\|i===3\)this\.scene\.add\(light\)/);
});

test('trackside life thins by spacing, never by truncating a lap-ordered list', () => {
  assert.doesNotMatch(trackLife, /environmentFullCount/);
  assert.match(trackLife, /LIGHT_SPACING = PHONE \? 20 : 10/);
  assert.match(trackLife, /if \(!view\.environment\.aurora \|\| PHONE\) return;/);
});

test('skipped towers consume their random draw and keep their plot', () => {
  const loop = architecture.slice(architecture.indexOf('const height=135+random()*150'));
  assert.ok(loop.indexOf('random()*150') < loop.indexOf('PHONE&&i%PHONE_BUDGET.towerStride'), 'draw before the skip');
  assert.match(loop, /reserved\.push\(\{x:center\.x,z:center\.z\}\);continue;/);
  assert.match(architecture, /placements\.concat\(reserved\)\.some\(v=>Math\.hypot\(v\.x-center\.x/);
  assert.match(architecture, /const backHeight=65\+random\(\)\*190;if\(PHONE&&backPlaced>=PHONE_BUDGET\.backTowers\)/);
});

test('a skipped hover-taxi consumes exactly the draws a kept one makes', () => {
  const start = living.indexOf('for(let i=0;i<120;i++){');
  const skip = living.slice(start, living.indexOf('continue;}', start));
  // The altitude is a ternary with a draw on each side, and only one side runs.
  const literal = living.slice(living.indexOf('g.userData={fraction', start), living.indexOf('};', living.indexOf('g.userData={fraction', start)))
    .replace(':20+random()*14', '');
  const count = s => (s.match(/random\(\)/g) || []).length;
  assert.ok(count(literal) > 0);
  assert.equal(count(skip), count(literal));
  assert.match(living, /const range=PHONE\?PHONE_BUDGET\.trafficRange:/);
});

test('phone taxis drop the clearcoat layer and most of their segments', () => {
  assert.match(traffic, /COAT=PHONE\?0:1/);
  assert.doesNotMatch(traffic, /SphereGeometry\(1,\d/);
  assert.doesNotMatch(traffic, /clearcoat:1\}/);
});

test('phone callouts sit in the bottom gap between the controls, not over the road', () => {
  const rule = hud.slice(hud.indexOf('html[data-touch="1"][data-layout=landscape] body[data-state][data-mode] #callout{'));
  const body = rule.slice(0, rule.indexOf('}'));
  assert.match(body, /top:auto/);
  assert.match(body, /bottom:calc\(max\(var\(--cv-pad\),env\(safe-area-inset-bottom,0px\)\) \+ var\(--cv-pedal\)/);
  assert.match(body, /pointer-events:none/);
  for (const sel of ['[data-layout=landscape] body[data-state][data-mode] #pickupFlash{', '[data-layout=portrait] body[data-state][data-mode] #callout{', '[data-layout=portrait] body[data-state][data-mode] #pickupFlash{']) {
    const r = hud.slice(hud.indexOf(`html[data-touch="1"]${sel}`));
    assert.ok(hud.includes(`html[data-touch="1"]${sel}`), sel);
    assert.match(r.slice(0, r.indexOf('}')), /top:auto;[\s\S]*bottom:calc\(/);
  }
});
