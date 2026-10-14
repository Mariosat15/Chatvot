// CHARTVOLT PATCH (14 Oct 2026, owner's "velocity fix" HUD spec): the race HUD is recomposed per
// device rather than scaled.
//
// Reason this replaced the 28 Sep collision pass: that version measured every panel on screen and
// nudged colliding ones vertically, which was a synchronous layout of the whole HUD inside the WebGL
// frame loop and still left large panels over the road. The HUD is now a CSS grid of six edge zones
// (root/cv-hud.css) and nothing is measured at all - this file only decides WHICH layout applies and
// wires the few presentation buttons. Nothing here touches the simulation, inputs or scoring.
import logoUrl from '../assets/ui/volt-velocity-logo.webp';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  // Reason: localStorage THROWS (rather than returning null) when a browser refuses storage, and an
  // unwrapped write would kill the race in exactly the privacy settings most likely to refuse.
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* preference simply not remembered */ } },
};
const coarse = () => matchMedia('(any-pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover:none)').matches);

// The layout is decided by the SHORT side and the orientation, never the width alone: a phone held
// sideways is ~850px wide and still has phone-sized thumbs and a 390px-tall screen.
export function layoutFor(w, h, isCoarse) {
  const short = Math.min(w, h);
  if (short <= 500 || w < 768) return w > h ? 'landscape' : 'portrait';
  if (isCoarse || w < 1024) return 'tablet';
  return 'desktop';
}

function viewportSize() {
  const vv = globalThis.visualViewport;
  return vv ? [Math.round(vv.width), Math.round(vv.height)] : [innerWidth, innerHeight];
}

// Rotating only rewrites these attributes; nothing reloads, and the canvas resizes on its own.
function applyLayout() {
  const [w, h] = viewportSize();
  const layout = layoutFor(w, h, coarse());
  if (root.dataset.layout !== layout) root.dataset.layout = layout;
  const touch = touchWanted(layout) ? '1' : '0';
  if (root.dataset.touch !== touch) root.dataset.touch = touch;
}

// Desktop shows no touch pads unless the device can be touched or the player asked for them.
function touchWanted(layout) {
  const pref = store.get('cv-touch-controls');
  if (pref === 'on') return true;
  if (pref === 'off' && layout === 'desktop') return false;
  return layout !== 'desktop' || coarse() || document.body.dataset.touch === '1';
}

// The minimap is visible by default on desktop and tablet and a toggle on phones; when it is hidden
// main.js skips drawing it, which is a whole 2D canvas redraw saved every 100ms.
export function mapShown() {
  return root.dataset.map !== 'off';
}
function setMap(on, remember) {
  root.dataset.map = on ? 'on' : 'off';
  $('mapToggle')?.setAttribute('aria-pressed', String(on));
  if (remember) store.set('cv-map', on ? 'on' : 'off');
}

function installFullscreen() {
  const buttons = [...document.querySelectorAll('.cv-fs')];
  // Reason: iPhone Safari has no element Fullscreen API at all; a button that does nothing is worse
  // than none, and on a phone the platform already pins the stage over the whole window.
  if (!document.fullscreenEnabled || typeof root.requestFullscreen !== 'function') {
    for (const b of buttons) b.hidden = true;
    return;
  }
  const label = () => {
    const on = !!document.fullscreenElement;
    for (const b of buttons) {
      b.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      if (b.id === 'pauseFullscreen') b.textContent = on ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
    }
    root.dataset.fullscreen = on ? '1' : '0';
  };
  for (const b of buttons) b.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* refused: nothing changed */ });
  });
  document.addEventListener('fullscreenchange', label);
  label();
}

// The key strip is a reminder, not furniture: it collapses to one chip five seconds into each race.
function installKeys() {
  const strip = $('cvKeys');
  const pref = $('cvKeysPref');
  if (!strip) return;
  let timer = 0;
  const enabled = () => store.get('cv-keys') !== 'off';
  const show = (open) => { strip.dataset.open = open ? '1' : '0'; };
  $('cvKeysToggle')?.addEventListener('click', () => { clearTimeout(timer); show(strip.dataset.open !== '1'); });
  if (pref) {
    pref.checked = enabled();
    pref.addEventListener('change', () => { store.set('cv-keys', pref.checked ? 'on' : 'off'); strip.hidden = !pref.checked; });
  }
  strip.hidden = !enabled();
  show(false);
  return () => { clearTimeout(timer); show(true); timer = setTimeout(() => show(false), 5000); };
}

// The LIVE indicator: full strength when the connection changes, 40% three seconds later.
function installLiveDot() {
  const el = $('networkStatus');
  if (!el) return;
  let last = '', timer = 0;
  new MutationObserver(() => {
    const text = el.textContent || '';
    if (text === last) return;
    last = text;
    const live = /LIVE|CONNECTED/i.test(text) && !/RECONNECT|LOST|OFFLINE|CONNECTING/i.test(text);
    el.dataset.state = live ? 'live' : 'alert';
    el.dataset.short = live ? 'LIVE' : (text.split('·')[0].trim() || 'OFFLINE');
    el.classList.add('fresh');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('fresh'), 3000);
  }).observe(el, { childList: true, characterData: true, subtree: true });
}

// The pause card's shortcuts open the existing settings dialog at the matching section.
function installPauseCard() {
  const dialog = $('settingsDialog');
  const target = { driving: 0, sound: 1, display: 2 };
  for (const b of document.querySelectorAll('[data-settings]')) b.addEventListener('click', () => {
    $('settings')?.click();
    const key = b.dataset.settings;
    const el = key === 'camera' ? $('reduced')?.closest('label') : dialog?.querySelectorAll('h3')[target[key]];
    requestAnimationFrame(() => el?.scrollIntoView({ block: 'start' }));
  });
  const leave = $('leaveRace');
  const pauseLeave = $('pauseLeave');
  if (leave && pauseLeave) {
    pauseLeave.addEventListener('click', () => leave.click());
    const sync = () => pauseLeave.classList.toggle('hidden', leave.classList.contains('hidden'));
    new MutationObserver(sync).observe(leave, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
}

function installTouchPref() {
  const box = $('cvTouchToggle');
  if (!box) return;
  box.checked = root.dataset.touch === '1';
  box.addEventListener('change', () => { store.set('cv-touch-controls', box.checked ? 'on' : 'off'); applyLayout(); });
}

export function initHudLayout() {
  const img = $('brandLogo');
  if (img) img.src = logoUrl;
  applyLayout();
  const remembered = store.get('cv-map');
  setMap(remembered ? remembered === 'on' : !['portrait', 'landscape'].includes(root.dataset.layout), false);
  $('mapToggle')?.addEventListener('click', () => setMap(!mapShown(), true));
  installFullscreen();
  const raceStarted = installKeys();
  installLiveDot();
  installPauseCard();
  installTouchPref();

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; applyLayout(); });
  };
  addEventListener('resize', schedule);
  globalThis.visualViewport?.addEventListener('resize', schedule);
  // main.js rewrites body attributes every frame with unchanged values; react to real changes only.
  let lastState = '', lastTouch = '';
  new MutationObserver(() => {
    const { state = '', touch = '' } = document.body.dataset;
    if (touch !== lastTouch) { lastTouch = touch; schedule(); }
    if (state === lastState) return;
    if (state === 'countdown' && lastState !== 'paused') raceStarted?.();
    lastState = state;
  }).observe(document.body, { attributes: true, attributeFilter: ['data-state', 'data-touch'] });
}
