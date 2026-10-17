import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// CHARTVOLT PATCH (14 Oct 2026, owner: "no way to scroll the menu ... no way to go out of the menu ...
// in mobile by default have the left/right buttons ... the button dont have press animation").

const read = name => readFileSync(fileURLToPath(new URL(`../client-patches/${name}`, import.meta.url)), 'utf8');
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const touch = strip(read('touch-controls.js'));
const main = strip(read('main.js'));
const html = read('root/index.html');
const hud = strip(read('root/cv-hud.css'));

test('the race scroll lock lets an open dialog scroll, and the exemption runs before preventDefault', () => {
  const handler = touch.slice(touch.indexOf("addEventListener('touchmove'"));
  const exempt = handler.indexOf("closest?.('dialog[open]'))return;");
  assert.ok(exempt > 0, 'dialog exemption missing');
  assert.ok(exempt < handler.indexOf('event.preventDefault()'), 'exemption must come before the lock');
  const rule = hud.slice(hud.indexOf('#settingsDialog[open]{'));
  assert.match(rule.slice(0, rule.indexOf('}')), /overflow-y:auto/);
});

test('a touch device defaults to the left/right buttons under a fresh storage key', () => {
  assert.match(touch, /const MODE_KEY='cv-touch-mode-3';/);
  assert.match(touch, /defaultMode=\(\)=>matchMedia\('\(any-pointer:coarse\)'\)\.matches\?'buttons':'analog'/);
  assert.match(touch, /localStorage\.getItem\(MODE_KEY\)\|\|defaultMode\(\)/);
  assert.match(touch, /catch\{setting\.value=defaultMode\(\);\}/, 'a browser refusing storage still gets the touch default');
});

test('the menu has a close button at its top, not only at the bottom', () => {
  const dialog = html.slice(html.indexOf('<dialog id="settingsDialog">'));
  const first = dialog.indexOf('<button');
  assert.ok(first >= 0 && first === dialog.indexOf('<button class="cv-dialog-close" value="close"'), 'close is the first control');
  assert.match(hud, /#settingsDialog \.cv-dialog-close\{position:sticky;top:0/);
});

test('menu and pause buttons acknowledge a press', () => {
  assert.match(hud, /touch-action:manipulation/);
  assert.match(hud, /:active\{[^}]*transform:scale\(\.95\)/);
});

test('a lost WebGL context reloads the frame even when no restore event arrives', () => {
  assert.match(main, /addEventListener\('webglcontextlost',\(\)=>\{setTimeout\(\(\)=>location\.reload\(\),2500\);\}\)/);
});
