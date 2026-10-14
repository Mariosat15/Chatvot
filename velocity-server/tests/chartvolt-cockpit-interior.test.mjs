import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CAMERA_VIEWS, chaseCamera, interiorEye, cockpitEye, nextCameraView} from '../client-patches/camera-views.js';
import {interiorReadout, cockpitGauges, cockpitOverlay, chooseOverlay, OVERLAY_ART, TOUCH_TARGET_PX, UTIL_COUNT, BOOST_MIN_ENERGY, GAUGE_FULL_SCALE_KMH} from '../client-patches/cockpit-layout.js';

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
const cockpitCss = strip(read('root/cv-cockpit.css'));
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
  const shell = cockpitCss.slice(cockpitCss.indexOf('.cv-cockpit{'), cockpitCss.indexOf('}', cockpitCss.indexOf('.cv-cockpit{')));
  assert.match(shell, /position:fixed;inset:0;z-index:11;pointer-events:none/);
  assert.match(rule('.cv-hud{'), /z-index:12/, 'the HUD must stay above the cockpit');
  assert.match(cockpitCss, /\.cv-cockpit\[hidden\],\.cv-cockpit \[hidden\]\{display:none!important\}/, 'img display:block must not beat [hidden]');
  assert.match(cockpitCss, /body:not\(\[data-state=racing\]\):not\(\[data-state=countdown\]\):not\(\[data-state=paused\]\) \.cv-cockpit\{display:none!important\}/);
  assert.doesNotMatch(hud, /\.cv-ck-/, 'the cockpit rules live in cv-cockpit.css alone');
  assert.match(read('root/tools/build.mjs'), /readFile\('cv-hud\.css','utf8'\)\)\+'\\n'\+\(await fs\.readFile\('cv-cockpit\.css','utf8'\)\)/, 'the sheet must be built in, after cv-hud.css');
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

// Owner, 14 Oct 2026: "Please adjust the Volt Velocity cockpit to match the supplied mockups" - one complete
// cockpit image per screen shape, a telemetry panel under the logo, the controls on the two bays, nothing
// clipped, overlapping or under a thumb-sized minimum. These replaced the seven-piece layout's tests, which
// pinned pillar and crossbeam placement that no longer exists.
const SCREENS = {
  desktop: {width: 1920, height: 1080, touch: false, art: 'desktop'},
  laptop: {width: 1366, height: 768, touch: false, art: 'desktop'},
  'windowed desktop': {width: 1280, height: 649, touch: false, art: 'landscape'},
  'square desktop': {width: 1024, height: 768, touch: false, art: 'desktop'},
  tablet: {width: 1024, height: 768, touch: true, art: 'desktop'},
  'portrait tablet': {width: 768, height: 1024, touch: true, art: 'portrait'},
  'portrait phone': {width: 390, height: 844, touch: true, art: 'portrait'},
  'narrow portrait phone': {width: 360, height: 780, touch: true, art: 'portrait'},
  'notched portrait phone': {width: 390, height: 844, touch: true, art: 'portrait', safe: {top: 47, bottom: 34}},
  'landscape phone': {width: 844, height: 390, touch: true, art: 'landscape'},
  'notched landscape phone': {width: 844, height: 390, touch: true, art: 'landscape', safe: {left: 47, right: 47, bottom: 21}},
  'short landscape phone': {width: 740, height: 320, touch: true, art: 'landscape'},
  'smallest landscape phone': {width: 667, height: 300, touch: true, art: 'landscape'},
};
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const CONTROLS = ['fire', 'left', 'right', 'boost', 'brake', 'accel'];

for (const [name, sc] of Object.entries(SCREENS)) for (const hand of ['right', 'left']) {
  test(`on a ${name} (${hand} hand) the cockpit fills the bottom and nothing overlaps or leaves the screen`, () => {
    const safe = {top: 0, right: 0, bottom: 0, left: 0, ...sc.safe};
    const L = cockpitOverlay({width: sc.width, height: sc.height, touch: sc.touch, hand, safe});
    assert.equal(L.variant, sc.art);
    assert.ok(L.art.y + L.art.h >= sc.height - 1 && L.art.x <= 1 && L.art.x + L.art.w >= sc.width - 1, 'the image covers the screen to the bottom edge, no gap');
    const boxes = {...L.controls, telemetry: L.telemetry, util: L.util};
    if (L.minimap) boxes.minimap = L.minimap;
    if (L.live) boxes.live = L.live;
    if (L.logo) boxes.logo = L.logo;
    for (const [part, b] of Object.entries(boxes)) {
      assert.ok(b.x >= safe.left && b.y >= safe.top && b.x + b.w <= sc.width - safe.right && b.y + b.h <= sc.height - safe.bottom, `${part} ${JSON.stringify(b)} is off screen or under a notch`);
    }
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!hits(boxes[names[i]], boxes[names[j]]), `${names[i]} overlaps ${names[j]}`);
    for (const c of CONTROLS) for (const [k, r] of Object.entries(L.instruments)) assert.ok(!hits(L.controls[c], r), `${c} covers the ${k} instrument`);
    if (sc.touch) for (const c of CONTROLS) assert.ok(L.controls[c].w >= TOUCH_TARGET_PX && L.controls[c].h >= TOUCH_TARGET_PX, `${c} is under ${TOUCH_TARGET_PX}px`);
    if (sc.touch) assert.ok(L.util.size >= TOUCH_TARGET_PX, 'utility buttons are thumb-sized too');
    assert.equal(L.util.count, sc.touch ? UTIL_COUNT.touch : UTIL_COUNT.mouse);
    assert.equal(Boolean(L.minimap), !sc.touch, 'the minimap shows with a mouse only');
    assert.equal(Boolean(L.live), sc.art === 'portrait', 'portrait moves LIVE to a pill');
    assert.equal(Boolean(L.logo), L.logoCropped, 'a logo the crop removed is drawn again');
    const logoBottom = L.logo ? L.logo.y + L.logo.h : L.telemetry.y;
    assert.ok(L.telemetry.y >= logoBottom, 'the panel sits under the logo');
    const [steerSide, pedalSide] = hand === 'left' ? ['accel', 'left'] : ['left', 'accel'];
    assert.ok(L.controls[steerSide].x < sc.width / 2 && L.controls[pedalSide].x > sc.width / 2, 'steering under one thumb, pedals under the other');
    assert.ok(L.controls.fire.y < L.controls.left.y && L.controls.boost.y < L.controls.accel.y, 'the wide button sits above its pair');
    const top = Math.min(...CONTROLS.map(c => L.controls[c].y));
    assert.ok(top > L.telemetry.y + L.telemetry.h, 'the controls stay below the telemetry');
    assert.ok(L.dashTop > sc.height * .4, `the dashboard ${L.dashTop}px leaves the track visible`);
    assert.ok(L.messagesTop >= L.telemetry.y + L.telemetry.h && L.messagesTop < L.dashTop, 'messages land between the panel and the dashboard');
  });
}

test('the closest image wins, by ratio, and bad input falls back instead of NaN', () => {
  assert.equal(chooseOverlay(1672, 941), 'desktop');
  assert.equal(chooseOverlay(1844, 853), 'landscape');
  assert.equal(chooseOverlay(852, 1846), 'portrait');
  assert.equal(chooseOverlay(1280, 649), 'landscape', 'a windowed browser is wider than 16:9');
  const tab = cockpitOverlay({width: 820, height: 1180, touch: true});
  assert.ok(tab.logoCropped && tab.logo, 'a portrait tablet is taller than the art and loses the painted logo');
  assert.ok(tab.live.x >= tab.logo.x + tab.logo.w && tab.live.y < tab.telemetry.y, 'LIVE sits beside the redrawn logo');
  const L = cockpitOverlay({width: NaN, height: undefined, safe: {top: -5, left: NaN}});
  const walk = (v, path) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path} is ${v}`); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`); };
  walk(L, 'layout');
});

test('a large control size grows the buttons and a small one never drops a touch target under the minimum', () => {
  const base = cockpitOverlay({width: 844, height: 390, touch: true});
  const big = cockpitOverlay({width: 1024, height: 768, touch: true, controlScale: 1.12});
  const plain = cockpitOverlay({width: 1024, height: 768, touch: true});
  assert.ok(big.controls.accel.w >= plain.controls.accel.w, 'large is not smaller');
  const small = cockpitOverlay({width: 844, height: 390, touch: true, controlScale: .88});
  for (const c of CONTROLS) assert.ok(small.controls[c].w >= TOUCH_TARGET_PX && small.controls[c].h >= TOUCH_TARGET_PX, c);
  assert.ok(base.controlScale >= 1, 'a short landscape phone enlarges the controls rather than shrinking them');
});

test('the cockpit refits on size, touch, hand, control size and safe area, and hands back every borrowed style', () => {
  assert.match(interior, /const key = `\$\{width\}x\$\{height\}\|\$\{touch\}\|\$\{hand\}\|\$\{controlScale\}\|/);
  assert.match(interior, /if \(on\) \{ html\.dataset\.cockpit = '1'; fitted = ''; since = 1; lastText = ''; return; \}/, 'a resize while hidden is picked up when shown again');
  const hide = interior.slice(interior.indexOf("delete html.dataset.cockpit;"), interior.indexOf('update(sim, dt)'));
  assert.match(hide, /release\(\);/, 'the chase views must get their own control layout back');
  assert.match(interior, /if \(style === null\) node\.removeAttribute\('style'\); else node\.setAttribute\('style', style\);/);
  for (const sel of ['#cvControls [data-action="fire"]', '#cvControls [data-action="boost"]', '#cvControls [data-action="left"]', '#cvControls [data-action="right"]', '#cvControls [data-action="brake"]', '#cvControls [data-action="throttle"]']) {
    assert.ok(interior.includes(`'${sel}'`), `${sel} is not placed`);
    const action = sel.match(/data-action="(\w+)"/)[1];
    assert.ok(html.includes(`data-action="${action}"`), `the race has no ${action} button`);
  }
});

test('the controls keep their touch wiring: the same buttons, never covered and never replaced', () => {
  assert.match(cockpitCss, /\.cv-controls :is\(\.cv-steer,\.cv-pedals,\.cv-steer-buttons\)\{display:contents!important\}/);
  assert.match(cockpitCss, /\.cv-controls button\{position:fixed!important;display:grid!important/);
  assert.doesNotMatch(interior, /addEventListener\('pointer/, 'input stays in touch-controls.js');
  assert.match(cockpitCss, /@media \(hover:hover\)\{/, 'a hover skin must not stick on a phone after a tap');
  assert.match(cockpitCss, /\[data-action=boost\]\[data-ready=none\]\{background-image:var\(--ck-boost-disabled\)!important\}/);
  assert.match(cockpitCss, /html\[data-cockpit\]\[data-touch="1"\] [^{]*\.cv-util :is\(#mute,#cameraCycle,#fullscreenBtn\)\{display:none!important\}/, 'a phone keeps pause and settings; the menu has camera and full screen');
  assert.match(html, /CAMERA/i);
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
  const src = read('cockpit-interior.js');
  for (const [variant, art] of Object.entries(OVERLAY_ART)) {
    assert.ok(src.includes(`'../assets/ui/cockpit/overlay-${variant}.webp'`), `overlay-${variant} is not imported`);
    const size = webpSize(readFileSync(fileURLToPath(new URL(`../client-patches/root/assets/ui/cockpit/overlay-${variant}.webp`, import.meta.url))));
    assert.deepEqual(size, {w: art.w, h: art.h}, `overlay-${variant}.webp`);
  }
  const imports = [...src.matchAll(/from '\.\.\/assets\/ui\/cockpit\/([\w-]+\.webp)'/g)].map(m => m[1]);
  assert.ok(imports.length >= 30, 'every button skin is imported');
  for (const file of imports) assert.ok(readFileSync(fileURLToPath(new URL(`../client-patches/root/assets/ui/cockpit/${file}`, import.meta.url))).length > 0, file);
  for (const name of [...src.matchAll(/'([\w-]+)': \w+/g)].map(m => m[1])) assert.ok(cockpitCss.includes(`--ck-${name}`) || name.startsWith('blank') || /-(hover|pressed|idle|disabled)$/.test(name), name);
});

test('every readout the scene updates exists in the markup', () => {
  for (const name of ['hull', 'hullBar', 'arc', 'speed', 'boostState', 'boostBar', 'art', 'tele', 'pill', 't-lap', 't-time', 't-best', 't-live', 't-pos', 't-hull', 't-speed']) assert.ok(interior.includes(`data-ck="${name}"`) || interior.includes(`cell('${name.slice(2)}'`), `${name} missing from the markup`);
  for (const id of ['lap', 'time', 'best', 'networkStatus', 'liveStandings', 'positionValue', 'positionTotal']) assert.ok(html.includes(`id="${id}"`), `the telemetry reads #${id}, which the race does not have`);
});

// Owner, 14 Oct 2026: "in mobile landscape i cant see the hull health anymore, only in portrait".
test('the hull row is shown over the vendor rule that hides it on landscape phones', () => {
  assert.match(rule('html body[data-state][data-mode] .cv-hull.integrity{'), /display:flex/, 'must outrank body[data-mode=multiplayer] .integrity{display:none}');
  assert.match(rule('html body[data-state][data-mode] .cv-hull .cv-meter{'), /min-width:44px/);
});
