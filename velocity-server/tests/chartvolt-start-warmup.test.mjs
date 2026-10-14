import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// CHARTVOLT PATCH (14 Oct 2026, owner console: "'requestAnimationFrame' handler took 1407ms").
// RaceScene.render() links shaders and uploads textures on its first frame; that must happen while
// the loading screen still covers the canvas, never on a frame the player watches.

const read = name => readFileSync(fileURLToPath(new URL(`../client-patches/${name}`, import.meta.url)), 'utf8');
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '');
const main = strip(read('main.js'));
const scene = strip(read('scene.js'));

function body(name) {
  const start = main.indexOf(`async function ${name}(`);
  const end = main.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, `${name} not found`);
  return main.slice(start, end);
}

test('a race start warms the new scene before the loading screen is hidden', () => {
  const b = body('nextRace');
  const warm = b.indexOf('await warmScene(view)');
  assert.ok(warm > b.indexOf('view=new RaceScene('), 'warm the scene that was just built');
  assert.ok(warm < b.indexOf("$('loading').classList.add('hidden')"), 'warm before the canvas is revealed');
});

test('solo boot warms the scene before the first animation frame', () => {
  const b = body('boot');
  const warm = b.indexOf('await warmScene(view)');
  assert.ok(warm >= 0 && warm < b.indexOf('requestAnimationFrame(tick)'));
});

test('warming compiles off the main thread, with the ships visible, then draws once', () => {
  const start = main.indexOf('async function warmScene(');
  const b = main.slice(start, main.indexOf('\n', start));
  assert.ok(start >= 0);
  // Hidden meshes are skipped by compile, so the pooled ships must be shown for it and hidden after.
  assert.ok(b.indexOf('m.visible=true') < b.indexOf('compileAsync(') && b.indexOf('compileAsync(') < b.indexOf('m.visible=false'));
  assert.ok(b.indexOf('v.warmShips()') < b.indexOf('v.renderer.render('), 'the first draw uploads the textures');
});

test('the renderer no longer asks for the removed PCFSoftShadowMap', () => {
  assert.doesNotMatch(scene, /PCFSoftShadowMap/);
  assert.match(scene, /this\.renderer\.shadowMap\.type=T\.PCFShadowMap;/);
});
