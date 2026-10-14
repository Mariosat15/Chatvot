import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CAMERA_VIEWS, chaseCamera, interiorEye, cockpitEye, nextCameraView} from '../client-patches/camera-views.js';
import {interiorReadout} from '../client-patches/cockpit-interior.js';

// CHARTVOLT PATCH (14 Oct 2026, owner): "add another camera inside the cockpit meaning you need to design
// interior as well", "select also the cameras from the game not only in the menu ... easy to select ... work
// for mobile ... without disrupting view", and "remove the logo from top also the box that shows the info
// there is too big for all modes in mobile make it the same shape and on the place that the red box is".

const read = name => readFileSync(fileURLToPath(new URL(`../client-patches/${name}`, import.meta.url)), 'utf8');
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const scene = strip(read('scene.js'));
const main = strip(read('main.js'));
const interior = strip(read('cockpit-interior.js'));
const html = read('root/index.html');
const hud = strip(read('root/cv-hud.css'));
const preset = {back: 24, up: 8.2, fov: 62, boostBack: 4, boostFov: 7};
const PHONE = 'html:is([data-layout=portrait],[data-layout=landscape]) body:not([data-state=hangar])';
const rule = sel => { const i = hud.indexOf(sel); assert.ok(i >= 0, `${sel} missing`); return hud.slice(i, hud.indexOf('}', i)); };

test('the inside view is its own camera, distinct from the roof cam, and in the cycle', () => {
  assert.equal(CAMERA_VIEWS.interior.label, 'Inside cockpit');
  assert.notEqual(CAMERA_VIEWS.cockpit.label, CAMERA_VIEWS.interior.label, 'two views must not share a name');
  assert.deepEqual(chaseCamera('interior', preset, false), {cockpit: true, interior: true, fov: 80});
  assert.deepEqual(chaseCamera('cockpit', preset, false), {cockpit: true, interior: false, fov: 76});
  assert.equal(nextCameraView('close'), 'interior');
});

test('the interior eye sits inside the hull, below the roof-cam eye, and survives missing bounds', () => {
  const bounds = {min: {y: 0, z: -4.25}, max: {y: 1.2, z: 4.25}};
  const eye = interiorEye(bounds);
  assert.ok(eye.y > 0 && eye.y < 1.2, 'inside the hull height');
  assert.ok(eye.y < cockpitEye(bounds).y, 'below the roof cam');
  assert.ok(eye.z <= 0 && eye.z > -4.25, 'ahead of centre, behind the nose');
  assert.deepEqual(interiorEye(undefined), {x: 0, y: 0.9, z: -0.3});
  assert.deepEqual(interiorEye({min: {y: NaN, z: 0}, max: {y: 1, z: 1}}), {x: 0, y: 0.9, z: -0.3});
});

test('the dashboard readout is km/h and whole percentages, and never shows NaN', () => {
  assert.deepEqual(interiorReadout({speed: 77.5, energy: .456, hull: 1}), {speed: '279', boost: 46, hull: 100});
  assert.deepEqual(interiorReadout({speed: -10, energy: 2, hull: -1}), {speed: '36', boost: 100, hull: 0});
  assert.deepEqual(interiorReadout({speed: NaN}), {speed: '0', boost: 0, hull: 0});
  assert.deepEqual(interiorReadout(undefined), {speed: '0', boost: 0, hull: 0});
});

test('the interior rides on the camera, which must therefore be in the scene', () => {
  assert.match(interior, /if \(!camera\.parent\) scene\.add\(camera\);/);
  assert.match(interior, /camera\.add\(group\);/);
  assert.match(interior, /object\.frustumCulled = false;/);
  assert.match(interior, /if \(since < \.1\) return;/, 'the screen texture must not upload every frame');
});

test('the scene picks the interior eye, builds it lazily, and never shows it in the hangar', () => {
  assert.match(scene, /const eye=\(view\.interior\?interiorEye:cockpitEye\)\(this\.ship\.userData\.hullBounds\);/);
  assert.match(scene, /this\.interiorOn=!hangar&&this\.cockpitView&&this\.interiorView===true;/);
  assert.match(scene, /this\.cockpitInterior\?\?=createCockpitInterior\(this\.camera,this\.scene\);this\.cockpitInterior\.update\(s,dt\);/);
});

test('the player hull is hidden for the inside draw only, and restored even if the draw throws', () => {
  const render = scene.slice(scene.indexOf('render(){'), scene.indexOf('resize(){'));
  assert.ok(render.length > 200, 'render not found');
  assert.match(render, /if\(this\.cockpitInterior\)this\.cockpitInterior\.group\.visible=inside;/);
  assert.match(render, /const shipWas=this\.ship\.visible;if\(inside\)this\.ship\.visible=false;try\{/);
  assert.match(render, /\}finally\{if\(inside\)this\.ship\.visible=shipWas;\}/, 'destruction also uses ship.visible, so restore, never force true');
});

test('a camera button in the race toolbar cycles the view and names it; settings offer the inside view', () => {
  const util = html.slice(html.indexOf('id="cvUtil"'), html.indexOf('</div>', html.indexOf('id="cvUtil"')));
  assert.match(util, /<button id="cameraCycle" class="cv-u cv-u-cam" type="button" aria-label="Change camera"/);
  assert.doesNotMatch(util, /id="cameraCycle" class="[^"]*cv-u-(desk|tab)/, 'must not be one of the buttons phones hide');
  assert.match(html, /<option value="interior">Inside cockpit<\/option>/);
  assert.match(main, /function cycleCamera\(\)\{const next=nextCameraView\(view\.cameraView\);setCameraView\(next\);showCallout\(CAMERA_VIEWS\[next\]\.label\);\}/);
  assert.match(main, /\$\('cameraCycle'\)\.onclick=e=>\{cycleCamera\(\);e\.currentTarget\.blur\(\);\};/);
  assert.match(main, /e\.code==='KeyC'&&!e\.repeat&&!e\.ctrlKey&&!e\.metaKey\)\{cycleCamera\(\);return;\}/);
  assert.match(hud, /body\[data-state=hangar\] \.cv-util #cameraCycle\{display:none\}/);
  assert.match(rule('html[data-layout=landscape] body:not([data-state=hangar]) .cv-tr{'), /padding-right:calc\(var\(--cv-util\) \* 2 \+ 12px\)/, 'the map must clear both buttons');
});

test('on a phone in a race the logo is gone and position + speed are one slim strip at the top centre', () => {
  assert.match(rule(`${PHONE} .cv-brand{`), /display:none/);
  const strip = rule(`${PHONE} .cv-pace{`);
  assert.match(strip, /position:fixed/);
  assert.match(strip, /left:50%;transform:translateX\(-50%\)/);
  assert.match(strip, /top:max\(6px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(strip, /display:flex/);
  assert.match(strip, /height:24px/, 'one thin line, not a card');
  assert.match(strip, /min-width:clamp\(150px,40vw,340px\)/, 'wide, like the marked box');
  assert.match(strip, /backdrop-filter:none/);
  assert.match(rule('html:is([data-layout=portrait],[data-layout=landscape]) body[data-state][data-mode]:not([data-state=hangar]) .cv-pace .position-head small{'), /display:none/);
  assert.match(rule('html[data-layout=portrait] body:not([data-state=hangar]) .cv-tl{'), /padding-top:30px/, 'the lap card must step below the strip in portrait');
});
