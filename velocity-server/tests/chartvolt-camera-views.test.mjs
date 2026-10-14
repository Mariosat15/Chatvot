import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CAMERA_VIEWS, chaseCamera, cockpitEye, resolveCameraView, nextCameraView} from '../client-patches/camera-views.js';
import {exhaustLook, applyExhaust} from '../client-patches/ship-exhaust.js';

// CHARTVOLT PATCH (14 Oct 2026, owner): "move these kind of wording to the place the red box is",
// "we need another cameras ... cockpit ... closer ... another camera you choose", and
// "when user use boost all ships boost as well".

const read = name => readFileSync(fileURLToPath(new URL(`../client-patches/${name}`, import.meta.url)), 'utf8');
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const scene = strip(read('scene.js'));
const main = strip(read('main.js'));
const html = read('root/index.html');
const hud = strip(read('root/cv-hud.css'));
const preset = {back: 24, up: 8.2, fov: 62, boostBack: 4, boostFov: 7};

test('five views, and an unknown or prototype id falls back to the chase view', () => {
  assert.deepEqual(Object.keys(CAMERA_VIEWS), ['chase', 'close', 'interior', 'cockpit', 'high']);
  for (const bad of ['__proto__', 'constructor', 'toString', '', null, undefined, 3]) assert.equal(resolveCameraView(bad), 'chase');
  assert.equal(nextCameraView('high'), 'chase');
  assert.equal(nextCameraView('chase'), 'close');
});

test('the chase view is exactly the old camera, so nobody who never opens settings sees a change', () => {
  assert.deepEqual(chaseCamera('chase', preset, false), {cockpit: false, back: 24, up: 8.2, shipPull: .32, fov: 62});
  assert.deepEqual(chaseCamera('chase', preset, true), {cockpit: false, back: 28, up: 8.2, shipPull: .32, fov: 69});
});

test('the close view is nearer and looks further down the road; the high view is above and behind', () => {
  const close = chaseCamera('close', preset, false), chase = chaseCamera('chase', preset, false), high = chaseCamera('high', preset, false);
  assert.ok(close.back < chase.back * .7 && close.up < chase.up * .7, 'close must sit nearer the ship');
  assert.ok(close.shipPull < chase.shipPull, 'close must aim further ahead so the front of the road stays in frame');
  assert.ok(high.up > chase.up * 2 && high.back > chase.back, 'high must sit above and behind');
});

test('the cockpit eye sits just above the hull, ahead of centre, and survives missing bounds', () => {
  const eye = cockpitEye({min: {y: 0, z: -4.25}, max: {y: 1.2, z: 4.25}});
  assert.ok(eye.y > 1.2 && eye.y < 1.6, 'just above the canopy, not inside it');
  assert.ok(eye.z < 0 && eye.z > -4.25, 'local -Z is forward: ahead of centre, behind the nose');
  assert.deepEqual(cockpitEye(undefined), {x: 0, y: 1.4, z: -0.6});
  assert.deepEqual(cockpitEye({min: {y: NaN, z: 0}, max: {y: 1, z: 1}}), {x: 0, y: 1.4, z: -0.6});
});

test('the scene reads the chosen view, and the cockpit follows the hull with no chase lag', () => {
  assert.match(scene, /const view=chaseCamera\(this\.cameraView,cameraPreset\(this\.camera\.aspect\),s\.boosting&&!this\.reduced\);/);
  assert.match(scene, /lerp\(this\.ship\.position,view\.shipPull\)/);
  assert.doesNotMatch(scene, /lerp\(this\.ship\.position,\.32\)/, 'the hard-coded pull must not come back beside the view');
  assert.match(scene, /const alpha=!hangar&&this\.cockpitView\?1:/);
  assert.match(scene, /goal=hangar\?55:Number\.isFinite\(this\.viewFov\)\?this\.viewFov:/);
});

test('settings offer the view, it is saved, a refused storage keeps chase, and C cycles it', () => {
  const select = html.slice(html.indexOf('<select id="cameraView">'), html.indexOf('</select>', html.indexOf('<select id="cameraView">')));
  assert.ok(select.length > 0, 'camera view select missing');
  for (const id of Object.keys(CAMERA_VIEWS)) assert.match(select, new RegExp(`value="${id}"`));
  assert.match(main, /try\{saved=localStorage\.getItem\(CAMERA_VIEW_KEY\);\}catch\{\}view\.cameraView=resolveCameraView\(saved\);/);
  assert.match(main, /try\{localStorage\.setItem\(CAMERA_VIEW_KEY,next\);\}catch\{\}/);
  assert.match(main, /\$\('cameraView'\)\.onchange=\(\)=>setCameraView\(\$\('cameraView'\)\.value\);/);
  assert.match(main, /e\.code==='KeyC'&&!e\.repeat/);
});

test('a rival flame follows that rival, not the player', () => {
  assert.deepEqual(exhaustLook({lit: true, boosting: true, speed: 90}), {visible: true, scaleZ: 1.7, push: 1.4});
  assert.deepEqual(exhaustLook({lit: true, boosting: false, speed: 90}), {visible: true, scaleZ: .6 + .5, push: 0});
  assert.equal(exhaustLook({lit: false, boosting: true, speed: 90}).visible, false);
  assert.equal(exhaustLook({lit: true, boosting: false, speed: NaN}).visible, false);
  const flame = {material: {uniforms: {clock: {value: 0}}}, scale: {z: 1}, position: {z: 0}, userData: {base: 2, anchored: false}, visible: true};
  applyExhaust([flame], exhaustLook({lit: true, boosting: true, speed: 90}), 5);
  assert.deepEqual([flame.visible, flame.scale.z, flame.position.z, flame.material.uniforms.clock.value], [true, 1.7, 3.4, 5]);
  const rivals = scene.slice(scene.indexOf('updateOpponents(players,selfId,dt,lead=0){'), scene.indexOf('disposeTree(root){'));
  assert.ok(rivals.length > 200, 'rival loop not found');
  assert.match(rivals, /applyExhaust\(m\.userData\.exhaust,exhaustLook\(\{lit:moving,boosting:Boolean\(p\.boosting\),speed:p\.speed\}\)/);
  assert.doesNotMatch(rivals, /\bs\.boosting\b/, 'a rival must never read the player\'s boost');
  assert.match(scene, /applyExhaust\(this\.ship\.userData\.exhaust,exhaustLook\(\{lit:!hangar&&s\.throttle,boosting:s\.boosting,speed:s\.speed\}\),t\);/);
});

test('on a phone in landscape the top-centre messages sit on the floor of the gap, below the callout', () => {
  const rule = sel => { const i = hud.indexOf(sel); assert.ok(i >= 0, `${sel} missing`); return hud.slice(i, hud.indexOf('}', i)); };
  const tc = rule('html[data-touch="1"][data-layout=landscape] body[data-state][data-mode] .cv-tc{');
  assert.match(tc, /position:fixed/);
  assert.match(tc, /bottom:calc\(max\(var\(--cv-pad\),env\(safe-area-inset-bottom,0px\)\) \+ var\(--cv-pedal\) \* \.04\)/);
  assert.match(tc, /max-width:max\(120px,calc\(100vw - var\(--cv-pedal\) \* 4\.9 - 48px\)\)/, 'must stay inside the gap between the buttons');
  assert.match(tc, /pointer-events:none/, 'must never swallow a steering touch');
  const callout = rule('html[data-touch="1"][data-layout=landscape] body[data-state][data-mode] #callout{');
  const lift = Number(callout.match(/var\(--cv-pedal\) \* ([.\d]+)\)/)[1]);
  assert.ok(lift >= .45, 'the callout must sit above the message line');
});
