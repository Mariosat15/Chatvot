import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CAMERA_VIEWS, chaseCamera, interiorEye, cockpitEye, nextCameraView} from '../client-patches/camera-views.js';
import {interiorReadout, interiorReserve, INTERIOR_RESERVE, cockpitGauges, cockpitLayout, COCKPIT_ART, BOOST_MIN_ENERGY, GAUGE_FULL_SCALE_KMH, DASH_MAX_STRETCH} from '../client-patches/cockpit-layout.js';

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

// Owner, 14 Oct 2026: "rebuild the cockpit to look like image 1 also i provided the elements for you to build it
// must also work in all modes and devices". The 3D meshes were replaced by the owner's artwork as a page overlay;
// the tests that pinned their camera-space placement were replaced by the screen-space guarantees below.
test('the cockpit is a page overlay between the 3D view and the HUD that no tap can land on', () => {
  assert.match(interior, /root\.setAttribute\('aria-hidden', 'true'\);/);
  assert.match(interior, /if \(world\) world\.after\(root\); else doc\.body\.prepend\(root\);/);
  const shell = rule('.cv-cockpit{');
  assert.match(shell, /position:fixed;inset:0;z-index:11;pointer-events:none/);
  assert.match(rule('.cv-hud{'), /z-index:12/, 'the HUD must stay above the cockpit');
  assert.match(hud, /\.cv-cockpit\[hidden\],\.cv-cockpit \[hidden\]\{display:none!important\}/, 'img display:block must not beat [hidden]');
  assert.match(hud, /body:not\(\[data-state=racing\]\):not\(\[data-state=countdown\]\):not\(\[data-state=paused\]\) \.cv-cockpit\{display:none!important\}/);
  assert.match(interior, /if \(since < \.1\) return;/, 'the readout must not be rewritten every frame');
  assert.doesNotMatch(interior, /from 'three'/, 'no meshes are left to keep in step with the art');
});

test('the scene picks the interior eye, builds it lazily, and never shows it in the hangar', () => {
  assert.match(scene, /const eye=\(view\.interior\?interiorEye:cockpitEye\)\(this\.ship\.userData\.hullBounds\);/);
  assert.match(scene, /this\.interiorOn=!hangar&&this\.cockpitView&&this\.interiorView===true;/);
  assert.match(scene, /this\.cockpitInterior\?\?=createCockpitInterior\(\);this\.cockpitInterior\.update\(s,dt\);/);
});

test('the player hull is hidden for the inside draw only, and restored even if the draw throws', () => {
  const render = scene.slice(scene.indexOf('render(){'), scene.indexOf('resize(){'));
  assert.ok(render.length > 200, 'render not found');
  assert.match(render, /if\(this\.cockpitInterior\)this\.cockpitInterior\.show\(inside\);/);
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

// Owner, 14 Oct 2026: "in cockpit in portrait i cant see the frame of the cockpit also the dashboard is hidden in
// both views in landscape and portrait" - and then "it must also work in all modes and devices". Every shape the
// game is played on, with the layout and touch flags hud-layout.js gives it.
const SCREENS = {
  desktop: {width: 1920, height: 1080, layout: 'desktop', touch: false},
  'small desktop': {width: 1024, height: 576, layout: 'desktop', touch: false},
  tablet: {width: 1024, height: 768, layout: 'tablet', touch: true},
  'portrait tablet': {width: 768, height: 1024, layout: 'portrait', touch: true},
  'portrait phone': {width: 390, height: 844, layout: 'portrait', touch: true},
  'landscape phone': {width: 844, height: 390, layout: 'landscape', touch: true},
  'short landscape phone': {width: 740, height: 320, layout: 'landscape', touch: true},
  'smallest landscape phone': {width: 667, height: 300, layout: 'landscape', touch: true},
};
const inside = (b, W, H, slack = 0) => b.x >= -b.w * .1 - 1 - slack && b.x + b.w <= W + b.w * .1 + 1 + slack && b.y >= -b.h * .25 && b.y + b.h <= H + 1;

for (const [name, sc] of Object.entries(SCREENS)) {
  test(`on a ${name} the whole cockpit is on screen and the dashboard clears the controls`, () => {
    const reserve = interiorReserve(sc.layout, sc.touch);
    const L = cockpitLayout({width: sc.width, height: sc.height, reserve, touch: sc.touch});
    for (const part of ['dash', 'left', 'right', 'beam']) assert.ok(inside(L[part], sc.width, sc.height), `${part} ${JSON.stringify(L[part])} is off screen`);
    assert.ok(L.dash.y + L.dash.h <= sc.height * (1 - reserve) + 1, `dashboard bottom ${L.dash.y + L.dash.h} is under the controls (reserve ${reserve})`);
    assert.ok(L.dash.y > sc.height * .45, 'the dashboard stays in the lower half, clear of the road ahead');
    assert.ok(L.dash.h >= 40, `dashboard ${L.dash.h}px tall is too small to read`);
    assert.ok(L.left.x + L.left.w * .5 < sc.width / 2 && L.right.x + L.right.w * .5 > sc.width / 2, 'one pillar each side');
    assert.ok(L.left.h > L.dash.y && L.right.h > L.dash.y, 'the pillars reach down into the dashboard');
    assert.ok(L.beam.y <= 0 && L.beam.w > sc.width * .5, 'the crossbeam spans the top');
    assert.equal(L.variant, sc.width < sc.height ? 'slender' : 'raked');
    assert.equal(L.right.mirror, sc.width < sc.height, 'the slender art is mirrored for the right pillar');
    if (sc.touch) assert.ok(L.throttle === null && L.stick === null, 'no throttle or stick where the thumbs and buttons are');
    else {
      for (const part of ['throttle', 'stick']) assert.ok(L[part] && L[part].x >= 0 && L[part].x + L[part].w <= sc.width + 1, `${part} must be drawn on screen`);
      assert.ok(L.throttle.x < L.dash.x + L.dash.w * .2 && L.stick.x > L.dash.x + L.dash.w * .8, 'throttle bottom left, stick bottom right');
    }
  });
}

test('the dashboard art is only widened a little on short wide screens, never squashed', () => {
  const aspect = COCKPIT_ART.dash.w / COCKPIT_ART.dash.h;
  for (const sc of Object.values(SCREENS)) {
    const L = cockpitLayout({width: sc.width, height: sc.height, reserve: interiorReserve(sc.layout, sc.touch), touch: sc.touch});
    const stretch = (L.dash.w / L.dash.h) / aspect;
    assert.ok(stretch >= .98 && stretch <= DASH_MAX_STRETCH * 1.02, `stretch ${stretch.toFixed(2)} at ${sc.width}x${sc.height}`);
  }
});

test('the phone reserve covers the control zone, and bad input falls back instead of NaN', () => {
  assert.ok(INTERIOR_RESERVE.portrait >= .3, 'portrait controls are max-height:30dvh');
  assert.ok(INTERIOR_RESERVE.landscape >= .3);
  assert.equal(interiorReserve('unknown', true), INTERIOR_RESERVE.landscape);
  assert.equal(interiorReserve('__proto__', true), INTERIOR_RESERVE.landscape);
  assert.equal(interiorReserve('landscape', false), 0, 'no touch pads, nothing to clear');
  const L = cockpitLayout({width: NaN, height: undefined, reserve: NaN, touch: false});
  for (const part of ['dash', 'floor', 'left', 'right', 'beam', 'throttle', 'stick']) for (const v of Object.values(L[part])) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${part} has ${v}`);
});

test('the cockpit refits whenever the screen size, layout or touch mode changes', () => {
  assert.match(interior, /const key = `\$\{width\}x\$\{height\}\|\$\{reserve\}\|\$\{touch\}`;/);
  assert.match(interior, /update\(sim, dt\) \{\s*fit\(\);/);
  assert.match(interior, /if \(on\) \{ fitted = ''; since = 1; \}/, 'a resize while hidden is picked up when shown again');
});

test('the three bays read hull, speed and boost, and READY uses the simulation\'s own boost line', () => {
  const sim = readFileSync(fileURLToPath(new URL('../src/simulation.js', import.meta.url)), 'utf8');
  assert.ok(sim.includes(`this.energy>${String(BOOST_MIN_ENERGY).replace(/^0/, '')};`), 'simulation.js and the cockpit must agree on when boost is available');
  assert.deepEqual(cockpitGauges({speed: 100, energy: .5, hull: .87, boosting: false}), {speed: '360', boost: 50, hull: 87, arc: 360 / GAUGE_FULL_SCALE_KMH, boostState: 'ready', hullLevel: 'ok'});
  assert.equal(cockpitGauges({energy: .5, boosting: true}).boostState, 'active');
  assert.equal(cockpitGauges({energy: .02, boosting: true}).boostState, 'empty', 'at the threshold the ship cannot boost');
  assert.equal(cockpitGauges({hull: .4}).hullLevel, 'low');
  assert.equal(cockpitGauges({hull: .2}).hullLevel, 'critical');
  assert.equal(cockpitGauges({speed: 1e6}).arc, 1, 'the arc never runs past full');
  assert.deepEqual(cockpitGauges(undefined), {speed: '0', boost: 0, hull: 0, arc: 0, boostState: 'empty', hullLevel: 'critical'});
});

// Reason: the layout places pillar feet and the crossbeam by image proportions, so a re-exported file of another
// shape would silently misalign them. Read the real canvas size out of each WebP header.
const webpSize = buf => {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return {w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3)};
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return {w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff)}; }
  return {w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff};
};
test('every cockpit image the module imports exists and has the size the layout assumes', () => {
  const files = {dash: 'dash', beam: 'beam', pillarLeft: 'pillar-left', pillarRight: 'pillar-right', pillarSlender: 'pillar-slender', throttle: 'throttle', stick: 'stick'};
  for (const [key, file] of Object.entries(files)) {
    assert.ok(read('cockpit-interior.js').includes(`'../assets/ui/cockpit/cockpit-${file}.webp'`), `${file} is not imported`);
    const size = webpSize(readFileSync(fileURLToPath(new URL(`../client-patches/root/assets/ui/cockpit/cockpit-${file}.webp`, import.meta.url))));
    assert.deepEqual(size, {w: COCKPIT_ART[key].w, h: COCKPIT_ART[key].h}, `${file}.webp`);
  }
});

test('every bay readout the scene updates exists in the markup', () => {
  for (const name of ['hull', 'hullBar', 'arc', 'speed', 'boostState', 'boostBar', 'floor', 'left', 'right', 'beam', 'dash', 'shell', 'throttle', 'stick']) assert.ok(interior.includes(`data-ck="${name}"`), `${name} missing from the markup`);
});

// Owner, 14 Oct 2026: "in mobile landscape i cant see the hull health anymore, only in portrait".
test('the hull row is shown over the vendor rule that hides it on landscape phones', () => {
  assert.match(rule('html body[data-state][data-mode] .cv-hull.integrity{'), /display:flex/, 'must outrank body[data-mode=multiplayer] .integrity{display:none}');
  assert.match(rule('html body[data-state][data-mode] .cv-hull .cv-meter{'), /min-width:44px/);
});
