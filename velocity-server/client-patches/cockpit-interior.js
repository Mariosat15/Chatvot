/* CHARTVOLT PATCH (14 Oct 2026, owner: "add another camera inside the cockpit meaning you need to design
 * interior as well"). First built as procedural three.js meshes, then the same day as seven separate pieces
 * of artwork ("rebuild the cockpit to look like image 1").
 *
 * CHARTVOLT PATCH (14 Oct 2026, owner: "Please adjust the Volt Velocity cockpit to match the supplied
 * mockups", Volt-Velocity-Complete-Overlay pack): one complete cockpit image per screen shape - desktop,
 * phone landscape, phone portrait - so the pillars, crossbeam and dashboard can never come apart and leave a
 * gap. Over it: the three live instruments, one telemetry panel under the logo (lap, time, best, live,
 * position, hull, speed) and the race's real controls, re-skinned with the pack's buttons and placed on the
 * two bays by cockpit-layout.js. The controls stay the same <button data-action> elements touch-controls.js
 * already drives, so multi-touch, pointer capture and release-on-cancel are unchanged.
 * Pure presentation - it reads the simulation and the HUD's own text and never writes to either; the image
 * and the panels take no pointer events, so no tap can land on them instead of a control. */
import overlayDesktop from '../assets/ui/cockpit/overlay-desktop.webp';
import overlayLandscape from '../assets/ui/cockpit/overlay-landscape.webp';
import overlayPortrait from '../assets/ui/cockpit/overlay-portrait.webp';
import leftIdle from '../assets/ui/cockpit/btn-left-idle.webp';
import leftHover from '../assets/ui/cockpit/btn-left-hover.webp';
import leftPressed from '../assets/ui/cockpit/btn-left-pressed.webp';
import rightIdle from '../assets/ui/cockpit/btn-right-idle.webp';
import rightHover from '../assets/ui/cockpit/btn-right-hover.webp';
import rightPressed from '../assets/ui/cockpit/btn-right-pressed.webp';
import brakeIdle from '../assets/ui/cockpit/btn-brake-idle.webp';
import brakeHover from '../assets/ui/cockpit/btn-brake-hover.webp';
import brakePressed from '../assets/ui/cockpit/btn-brake-pressed.webp';
import accelIdle from '../assets/ui/cockpit/btn-accel-idle.webp';
import accelHover from '../assets/ui/cockpit/btn-accel-hover.webp';
import accelPressed from '../assets/ui/cockpit/btn-accel-pressed.webp';
import boostIdle from '../assets/ui/cockpit/btn-boost-idle.webp';
import boostHover from '../assets/ui/cockpit/btn-boost-hover.webp';
import boostPressed from '../assets/ui/cockpit/btn-boost-pressed.webp';
import boostDisabled from '../assets/ui/cockpit/btn-boost-disabled.webp';
import cameraIdle from '../assets/ui/cockpit/btn-camera-idle.webp';
import cameraHover from '../assets/ui/cockpit/btn-camera-hover.webp';
import cameraPressed from '../assets/ui/cockpit/btn-camera-pressed.webp';
import pauseIdle from '../assets/ui/cockpit/btn-pause-idle.webp';
import pauseHover from '../assets/ui/cockpit/btn-pause-hover.webp';
import pausePressed from '../assets/ui/cockpit/btn-pause-pressed.webp';
import settingsIdle from '../assets/ui/cockpit/btn-settings-idle.webp';
import settingsHover from '../assets/ui/cockpit/btn-settings-hover.webp';
import settingsPressed from '../assets/ui/cockpit/btn-settings-pressed.webp';
import fullscreenIdle from '../assets/ui/cockpit/btn-fullscreen-idle.webp';
import fullscreenHover from '../assets/ui/cockpit/btn-fullscreen-hover.webp';
import fullscreenPressed from '../assets/ui/cockpit/btn-fullscreen-pressed.webp';
import blankWide from '../assets/ui/cockpit/btn-blank-wide.webp';
import blankUtility from '../assets/ui/cockpit/btn-blank-utility.webp';
import {cockpitGauges, cockpitOverlay} from './cockpit-layout.js';

const OVERLAY = Object.freeze({desktop: overlayDesktop, landscape: overlayLandscape, portrait: overlayPortrait});
/** Every skin as a CSS variable, so cv-cockpit.css can name a state without the stylesheet holding the images. */
const SKINS = Object.freeze({
  'left-idle': leftIdle, 'left-hover': leftHover, 'left-pressed': leftPressed,
  'right-idle': rightIdle, 'right-hover': rightHover, 'right-pressed': rightPressed,
  'brake-idle': brakeIdle, 'brake-hover': brakeHover, 'brake-pressed': brakePressed,
  'accel-idle': accelIdle, 'accel-hover': accelHover, 'accel-pressed': accelPressed,
  'boost-idle': boostIdle, 'boost-hover': boostHover, 'boost-pressed': boostPressed, 'boost-disabled': boostDisabled,
  'camera-idle': cameraIdle, 'camera-hover': cameraHover, 'camera-pressed': cameraPressed,
  'pause-idle': pauseIdle, 'pause-hover': pauseHover, 'pause-pressed': pausePressed,
  'settings-idle': settingsIdle, 'settings-hover': settingsHover, 'settings-pressed': settingsPressed,
  'fullscreen-idle': fullscreenIdle, 'fullscreen-hover': fullscreenHover, 'fullscreen-pressed': fullscreenPressed,
  'blank-wide': blankWide, 'blank-utility': blankUtility,
});
/** The race's own control buttons, by the name cockpit-layout.js gives each slot. */
const CONTROL_SELECTORS = Object.freeze({
  fire: '#cvControls [data-action="fire"]', boost: '#cvControls [data-action="boost"]',
  left: '#cvControls [data-action="left"]', right: '#cvControls [data-action="right"]',
  brake: '#cvControls [data-action="brake"]', accel: '#cvControls [data-action="throttle"]',
});

const BOLT = '<svg viewBox="0 0 16 24" aria-hidden="true"><path d="M10 0 1 14h6l-2 10 10-15H9z"/></svg>';
const ARC = 'M16 100A84 84 0 0 1 184 100';
const cell = (key, label, value) => `<div class="cv-ck-cell" data-cell="${key}"><small>${label}</small><b data-ck="t-${key}">${value}</b></div>`;
// Reason: fixed markup with no game or player text in it, so innerHTML carries nothing a player can inject.
const MARKUP = `<img class="cv-ck-art" data-ck="art" alt="" draggable="false">
<div class="cv-ck-bay cv-ck-hull" data-ck="bay-left"><svg class="cv-ck-shield" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1 22 5v8c0 7-4.4 11.6-10 14C6.4 24.6 2 20 2 13V5z"/></svg><div class="cv-ck-col"><small>HULL</small><b data-ck="hull">100%</b><i class="cv-ck-bar"><span data-ck="hullBar"></span></i></div></div>
<div class="cv-ck-bay cv-ck-speed" data-ck="bay-centre"><svg class="cv-ck-arc" viewBox="0 0 200 108" aria-hidden="true"><path class="cv-ck-track" d="${ARC}" pathLength="100"/><path class="cv-ck-fill" data-ck="arc" d="${ARC}" pathLength="100" stroke-dasharray="0 100"/></svg><b data-ck="speed">0</b><small>KM/H</small></div>
<div class="cv-ck-bay cv-ck-boost" data-ck="bay-right"><small>BOOST</small><span class="cv-ck-bolts">${BOLT}${BOLT}</span><b data-ck="boostState">EMPTY</b><i class="cv-ck-bar"><span data-ck="boostBar"></span></i></div>
<div class="cv-ck-tele" data-ck="tele">
<div class="cv-ck-row">${cell('lap', 'LAP', '01/03')}${cell('time', 'TIME', '00:00.000')}${cell('best', 'BEST', '—')}<div class="cv-ck-cell cv-ck-live-cell" data-cell="live"><small>LIVE</small><b data-ck="t-live"><i class="cv-ck-dot"></i><span data-ck="t-liveText">SOLO</span></b></div></div>
<div class="cv-ck-row">${cell('pos', 'POSITION', '—')}${cell('hull', 'HULL', '100%')}${cell('speed', 'SPEED', '0 <em>KM/H</em>')}</div>
</div>
<div class="cv-ck-logo" data-ck="logo" hidden></div>
<div class="cv-ck-pill" data-ck="pill"><i class="cv-ck-dot"></i><span data-ck="pillText">SOLO</span></div>
<div class="cv-ck-safe" data-ck="safe"></div>`;

const BOOST_WORD = Object.freeze({active: 'ACTIVE', ready: 'READY', empty: 'EMPTY'});

export function createCockpitInterior(doc = document) {
  const root = doc.createElement('div');
  root.id = 'cvCockpit';
  root.className = 'cv-cockpit';
  root.setAttribute('aria-hidden', 'true');
  root.hidden = true;
  root.innerHTML = MARKUP;
  // Reason: straight after the 3D canvas, so the damage flash, the HUD and every control still stack above it.
  const world = doc.getElementById('world');
  if (world) world.after(root); else doc.body.prepend(root);

  const skins = doc.createElement('style');
  skins.id = 'cvCockpitSkins';
  skins.textContent = `:root{${Object.entries(SKINS).map(([name, url]) => `--ck-${name}:url("${url}")`).join(';')}}`;
  doc.head.append(skins);

  const part = name => root.querySelector(`[data-ck="${name}"]`);
  const el = {};
  for (const name of ['art', 'logo', 'bay-left', 'bay-centre', 'bay-right', 'tele', 'pill', 'pillText', 'safe', 'hull', 'hullBar', 'arc', 'speed', 'boostState', 'boostBar', 't-lap', 't-time', 't-best', 't-live', 't-liveText', 't-pos', 't-hull', 't-speed']) el[name] = part(name);
  const $ = id => doc.getElementById(id);
  const html = doc.documentElement;

  // Elements this module positions but does not own: their own inline style is saved and handed back on hide.
  const borrowed = new Map();
  const borrow = node => { if (node && !borrowed.has(node)) borrowed.set(node, node.getAttribute('style')); return node; };
  const release = () => {
    for (const [node, style] of borrowed) { if (style === null) node.removeAttribute('style'); else node.setAttribute('style', style); }
    borrowed.clear();
  };
  const place = (node, b) => {
    if (!node) return;
    node.style.left = `${b.x}px`; node.style.top = `${b.y}px`;
    node.style.width = `${b.w}px`; node.style.height = `${b.h}px`;
  };
  const insets = () => {
    const cs = doc.defaultView?.getComputedStyle?.(el.safe);
    const px = name => parseFloat(cs?.[name]) || 0;
    return {top: px('paddingTop'), right: px('paddingRight'), bottom: px('paddingBottom'), left: px('paddingLeft')};
  };

  let fitted = '';
  function fit() {
    const view = doc.defaultView;
    const width = view?.innerWidth ?? 1280, height = view?.innerHeight ?? 720;
    const touch = html.dataset.touch === '1';
    const body = doc.body?.dataset ?? {};
    const hand = body.hand === 'left' ? 'left' : 'right';
    const controlScale = body.controlSize === 'small' ? .88 : body.controlSize === 'large' ? 1.12 : 1;
    const safe = insets();
    const key = `${width}x${height}|${touch}|${hand}|${controlScale}|${safe.top},${safe.right},${safe.bottom},${safe.left}`;
    if (key === fitted) return;
    fitted = key;
    const L = cockpitOverlay({width, height, touch, hand, controlScale, safe});
    root.dataset.variant = L.variant;
    html.dataset.cockpitVariant = L.variant;
    if (el.art.dataset.src !== L.variant) { el.art.src = OVERLAY[L.variant]; el.art.dataset.src = L.variant; }
    place(el.art, L.art);
    for (const [side, name] of [['left', 'bay-left'], ['centre', 'bay-centre'], ['right', 'bay-right']]) {
      place(el[name], L.instruments[side]);
      // Reason: every readout is sized from its own bay, so text scales with the art on any screen.
      el[name].style.setProperty('--ck-h', `${L.instruments[side].h}px`);
    }
    place(el.tele, L.telemetry);
    el.tele.style.setProperty('--ck-h', `${L.telemetry.h}px`);
    el.logo.hidden = !L.logo;
    if (L.logo) {
      place(el.logo, L.logo);
      el.logo.style.backgroundImage = `url("${OVERLAY[L.variant]}")`;
      el.logo.style.backgroundSize = `${L.logo.size[0]}px ${L.logo.size[1]}px`;
      el.logo.style.backgroundPosition = `${L.logo.offset[0]}px ${L.logo.offset[1]}px`;
    }
    el.pill.hidden = !L.live;
    if (L.live) place(el.pill, L.live);
    for (const [name, selector] of Object.entries(CONTROL_SELECTORS)) {
      const node = borrow(doc.querySelector(selector));
      if (node) { place(node, L.controls[name]); node.style.setProperty('--ck-h', `${L.controls[name].h}px`); }
    }
    const util = borrow($('cvUtil'));
    if (util) {
      util.style.left = `${L.util.x}px`; util.style.top = `${L.util.y}px`;
      util.style.setProperty('--ck-u', `${L.util.size}px`);
      util.style.setProperty('--ck-ugap', `${L.util.gap}px`);
    }
    const map = borrow(doc.querySelector('.cv-map'));
    if (map) { if (L.minimap) place(map, L.minimap); html.dataset.cockpitMap = L.minimap ? '1' : '0'; }
    html.style.setProperty('--ck-msg-top', `${L.messagesTop}px`);
    html.style.setProperty('--ck-dash-bottom', `${Math.max(0, height - L.dashTop)}px`);
  }

  let since = 1, lastText = '';
  function draw(g) {
    const text = (id, fallback) => ($(id)?.textContent ?? fallback).replace(/\s+/g, '');
    const status = $('networkStatus');
    const solo = !status || status.classList.contains('hidden');
    const liveText = solo ? 'SOLO' : (status.dataset.short || 'LIVE');
    const liveState = solo ? 'solo' : (status.dataset.state || 'live');
    const standings = $('liveStandings');
    const pos = !standings || standings.classList.contains('hidden') ? '—' : `${text('positionValue', '—')}${text('positionTotal', '')}`;
    const lap = text('lap', '01/03'), time = text('time', '00:00.000'), best = text('best', '—');
    const key = `${g.speed}|${g.hull}|${g.boost}|${g.boostState}|${lap}|${time}|${best}|${liveText}|${liveState}|${pos}`;
    if (key === lastText) return;
    lastText = key;
    el.speed.textContent = g.speed;
    el.arc.setAttribute('stroke-dasharray', `${(g.arc * 100).toFixed(1)} 100`);
    el.hull.textContent = `${g.hull}%`;
    el.hullBar.style.width = `${g.hull}%`;
    el.boostState.textContent = BOOST_WORD[g.boostState];
    el.boostBar.style.width = `${g.boost}%`;
    root.dataset.hull = g.hullLevel;
    root.dataset.boost = g.boostState;
    el['t-lap'].textContent = lap;
    el['t-time'].textContent = time;
    el['t-best'].textContent = best;
    el['t-liveText'].textContent = liveText;
    el.pillText.textContent = liveText;
    root.dataset.live = liveState;
    el['t-pos'].textContent = pos;
    el['t-hull'].textContent = `${g.hull}%`;
    el['t-speed'].firstChild.textContent = `${g.speed} `;
  }

  return {
    element: root,
    /** Shown only while the inside view is drawn; hiding is free, so the scene calls this every frame. */
    show(on) {
      if (root.hidden === !on) return;
      root.hidden = !on;
      if (on) { html.dataset.cockpit = '1'; fitted = ''; since = 1; lastText = ''; return; }
      delete html.dataset.cockpit;
      delete html.dataset.cockpitVariant;
      delete html.dataset.cockpitMap;
      html.style.removeProperty('--ck-msg-top');
      html.style.removeProperty('--ck-dash-bottom');
      release();
    },
    /** Reason: rewriting the readout every frame is layout work per frame on a phone; ten a second reads live. */
    update(sim, dt) {
      if (root.hidden) return;
      since += Number.isFinite(dt) ? dt : 0;
      if (since < .1) return;
      since = 0;
      // Reason: fit reads the safe-area probe's computed style, which forces a style pass; ten a second is plenty for a resize.
      fit();
      draw(cockpitGauges(sim));
    },
  };
}
