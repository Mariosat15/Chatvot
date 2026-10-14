import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REMEMBERED_SETTINGS, restoreSettings, rememberSettings, hasSavedSetting, applyStoredValue} from '../client-patches/settings-memory.js';

// CHARTVOLT PATCH (14 Oct 2026, owner: "any game menu setting the user selects is saved and used when
// playing the game so it doesn't need to redo it every time", and the pre-race tips on the ship screen).

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../client-patches/root/index.html');
const main = read('../client-patches/main.js');
const css = read('../client-patches/root/chartvolt.css');

function memoryStorage() {
  const map = new Map();
  return {map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v))};
}
function control(id, type, extra = {}) {
  const listeners = {};
  return {id, type, tagName: type === 'select' ? 'SELECT' : 'INPUT', checked: false, value: '', min: '0', max: '1', options: [],
    add(o) { this.options.push(o); }, addEventListener(e, fn) { (listeners[e] ||= []).push(fn); },
    fire(e) { (listeners[e] || []).forEach(fn => fn()); }, ...extra};
}
const select = (id, values, value) => control(id, 'select', {options: values.map(v => ({value: v})), value});
function fakeDocument() {
  const els = {
    quality: select('quality', ['.8', '1', '1.25', '2'], '1.25'),
    bloom: control('bloom', 'checkbox', {checked: true}),
    reduced: control('reduced', 'checkbox'),
    shadowQuality: select('shadowQuality', ['off', 'low', 'medium', 'high'], 'medium'),
    musicVolume: control('musicVolume', 'range', {value: '.75'}),
    muteSounds: control('muteSounds', 'checkbox'),
    soundtrack: select('soundtrack', ['auto', 'afterburn'], 'auto'),
  };
  globalThis.Option = function (text, value) { return {text, value}; };
  return {els, getElementById: id => els[id] || null};
}

test('every graphics and sound control in the menu is remembered', () => {
  for (const id of ['quality', 'bloom', 'reduced', 'atmosphere', 'skyQuality', 'cloudQuality', 'shadowQuality', 'textureQuality',
    'reflectionQuality', 'musicVolume', 'sfxVolume', 'muteMusic', 'muteSounds', 'soundtrack']) {
    assert.ok(REMEMBERED_SETTINGS.includes(id), id);
    assert.match(html, new RegExp(`id="${id}"`), `${id} exists in the menu`);
  }
  // Settings already saved by their own module must not get a second owner.
  for (const id of ['cameraView', 'touchMode', 'controlHand', 'controlSize', 'racingLine', 'vibration', 'coachEnabled', 'cvKeysPref', 'cvTouchToggle'])
    assert.ok(!REMEMBERED_SETTINGS.includes(id), id);
});

test('a change is saved and comes back on the next visit', () => {
  const storage = memoryStorage(), first = fakeDocument();
  rememberSettings(first, storage);
  first.els.quality.value = '2'; first.els.quality.fire('change');
  first.els.bloom.checked = false; first.els.bloom.fire('change');
  first.els.shadowQuality.value = 'off'; first.els.shadowQuality.fire('change');
  first.els.musicVolume.value = '0.3'; first.els.musicVolume.fire('input');
  first.els.muteSounds.checked = true; first.els.muteSounds.fire('change');
  first.els.soundtrack.value = 'afterburn'; first.els.soundtrack.fire('change');

  const next = fakeDocument();
  const restored = restoreSettings(next, storage);
  assert.deepEqual(restored.sort(), ['bloom', 'musicVolume', 'muteSounds', 'quality', 'shadowQuality', 'soundtrack']);
  assert.equal(next.els.quality.value, '2');
  assert.equal(next.els.bloom.checked, false);
  assert.equal(next.els.shadowQuality.value, 'off');
  assert.equal(next.els.musicVolume.value, '0.3');
  assert.equal(next.els.muteSounds.checked, true);
  assert.equal(next.els.soundtrack.value, 'afterburn');
  assert.equal(hasSavedSetting('quality', storage), true);
  assert.equal(hasSavedSetting('skyQuality', storage), false);
});

test('a stored value that is not a real choice is ignored', () => {
  const doc = fakeDocument();
  assert.equal(applyStoredValue(doc.els.shadowQuality, 'ultra'), false);
  assert.equal(doc.els.shadowQuality.value, 'medium');
  assert.equal(applyStoredValue(doc.els.bloom, 'yes'), false);
  assert.equal(applyStoredValue(doc.els.musicVolume, '7'), false);
  assert.equal(applyStoredValue(doc.els.musicVolume, ''), false);
  assert.equal(applyStoredValue(doc.els.quality, '9'), false);
  // A per-device render ratio (added at runtime on phones) is accepted and added back.
  assert.equal(applyStoredValue(doc.els.quality, '1.75'), true);
  assert.ok(doc.els.quality.options.some(o => o.value === '1.75'));
});

test('a browser that refuses storage still loads the game', () => {
  const broken = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }};
  const doc = fakeDocument();
  assert.deepEqual(restoreSettings(doc, broken), []);
  rememberSettings(doc, broken);
  assert.doesNotThrow(() => doc.els.bloom.fire('change'));
});

test('main.js restores before the scene is built and pushes sound settings into the mixer', () => {
  const restoreAt = main.indexOf('restoreSettings();'), sceneAt = main.indexOf("view=new RaceScene($('world'),track);applyAtmosphere", restoreAt);
  const phoneDefaultsAt = main.indexOf("$('shadowQuality').value='off'");
  assert.ok(phoneDefaultsAt > 0 && restoreAt > phoneDefaultsAt, 'saved choices win over the phone defaults');
  assert.ok(sceneAt > restoreAt && sceneAt - restoreAt < 400, 'restored before the first scene');
  assert.match(main, /view\.bloom\.enabled=\$\('bloom'\)\.checked;graphics\(\);\r?\n  for\(const id of \['cloudQuality'/);
  assert.match(main, /audio\.levels\(Number\(\$\('musicVolume'\)\.value\),Number\(\$\('sfxVolume'\)\.value\)\);for/);
  assert.match(main, /audio\.muteBus\('music',\$\('muteMusic'\)\.checked\);audio\.muteBus\('sfx',\$\('muteSounds'\)\.checked\);audio\.setTrack\(\$\('soundtrack'\)\.value\);rememberSettings\(\);/);
  assert.match(main, /matches&&!hasSavedSetting\('skyQuality'\)\)\$\('skyQuality'\)\.value='2048'/, 'each race keeps a saved sky choice');
});

test('the ship screen shows the four pre-race tips in plain words', () => {
  const hangar = html.slice(html.indexOf('<section id="hangar"'), html.indexOf('</section>', html.indexOf('<section id="hangar"')));
  const tips = hangar.slice(hangar.indexOf('class="cv-tips"'), hangar.indexOf('<div class="cv-ship">'));
  assert.ok(tips.length > 100, 'tips sit in the hangar intro, before the ship panel');
  for (const [label, words] of [['CAMERA', /camera button/], ['CONNECTION', /Wi-Fi or 5G/], ['GRAPHICS', /Render quality/], ['DEVICE', /desktop or tablet/]]) {
    assert.match(tips, new RegExp(`<b>${label}</b>`));
    assert.match(tips, words);
  }
  assert.match(tips, /saved for next time/);
  assert.match(main, /\$\('cvTipsSettings'\)\.onclick=\(\)=>\$\('settings'\)\.onclick\(\);/);
  assert.match(css, /#hangar \.cv-tips li\{grid-area:1\/1;[^}]*animation:cv-tip 16s infinite;animation-delay:calc\(var\(--i\) \* 4s\)\}/, 'phones rotate one tip at a time');
});
