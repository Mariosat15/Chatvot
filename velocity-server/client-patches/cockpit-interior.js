/* CHARTVOLT PATCH (14 Oct 2026, owner: "add another camera inside the cockpit meaning you need to design
 * interior as well"). First built as procedural three.js meshes riding on the camera; refitted the same day
 * for portrait and landscape phones ("in cockpit in portrait i cant see the frame of the cockpit").
 *
 * CHARTVOLT PATCH (14 Oct 2026, owner: "rebuild the cockpit to look like image 1 also i provided the elements
 * for you to build it must also work in all modes and devices"): the meshes are replaced by the owner's
 * artwork - two titanium canopy pillars, the crossbeam with its cyan light, the triple-bay dashboard, the
 * dual-lever throttle and the sidestick - drawn as a fixed overlay above the 3D view and below the HUD.
 * Reason: flat art reproduces image 1 exactly where boxes in camera space could only approximate it, and a
 * page overlay can be laid out per screen shape (cockpit-layout.js) instead of per field of view.
 * Pure presentation - it reads the simulation and never writes to it; pointer-events are off throughout, so
 * no tap or click can land on it instead of a control. */
import dashUrl from '../assets/ui/cockpit/cockpit-dash.webp';
import beamUrl from '../assets/ui/cockpit/cockpit-beam.webp';
import pillarLeftUrl from '../assets/ui/cockpit/cockpit-pillar-left.webp';
import pillarRightUrl from '../assets/ui/cockpit/cockpit-pillar-right.webp';
import pillarSlenderUrl from '../assets/ui/cockpit/cockpit-pillar-slender.webp';
import throttleUrl from '../assets/ui/cockpit/cockpit-throttle.webp';
import stickUrl from '../assets/ui/cockpit/cockpit-stick.webp';
import {cockpitGauges, cockpitLayout, interiorReserve} from './cockpit-layout.js';

const BOLT = '<svg viewBox="0 0 16 24" aria-hidden="true"><path d="M10 0 1 14h6l-2 10 10-15H9z"/></svg>';
const ARC = 'M16 100A84 84 0 0 1 184 100';
// Reason: fixed markup with no game or player text in it, so innerHTML carries nothing a player can inject.
const MARKUP = `<div class="cv-ck-floor" data-ck="floor"></div>
<img class="cv-ck-pillar" data-ck="left" alt="" draggable="false">
<img class="cv-ck-pillar" data-ck="right" alt="" draggable="false">
<img class="cv-ck-beam" data-ck="beam" alt="" draggable="false">
<div class="cv-ck-dash" data-ck="dash">
<img class="cv-ck-shell" data-ck="shell" alt="" draggable="false">
<div class="cv-ck-bay cv-ck-hull"><svg class="cv-ck-shield" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1 22 5v8c0 7-4.4 11.6-10 14C6.4 24.6 2 20 2 13V5z"/></svg><div class="cv-ck-col"><small>HULL</small><b data-ck="hull">100%</b><i class="cv-ck-bar"><span data-ck="hullBar"></span></i></div></div>
<div class="cv-ck-bay cv-ck-speed"><svg class="cv-ck-arc" viewBox="0 0 200 108" aria-hidden="true"><path class="cv-ck-track" d="${ARC}" pathLength="100"/><path class="cv-ck-fill" data-ck="arc" d="${ARC}" pathLength="100" stroke-dasharray="0 100"/></svg><b data-ck="speed">0</b><small>KM/H</small></div>
<div class="cv-ck-bay cv-ck-boost"><small>BOOST</small><span class="cv-ck-bolts">${BOLT}${BOLT}</span><b data-ck="boostState">EMPTY</b><i class="cv-ck-bar"><span data-ck="boostBar"></span></i></div>
</div>
<img class="cv-ck-throttle" data-ck="throttle" alt="" draggable="false">
<img class="cv-ck-stick" data-ck="stick" alt="" draggable="false">`;

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

  const part = name => root.querySelector(`[data-ck="${name}"]`);
  const el = {};
  for (const name of ['floor', 'left', 'right', 'beam', 'dash', 'shell', 'throttle', 'stick', 'hull', 'hullBar', 'arc', 'speed', 'boostState', 'boostBar']) el[name] = part(name);
  el.shell.src = dashUrl;
  el.beam.src = beamUrl;
  el.throttle.src = throttleUrl;
  el.stick.src = stickUrl;

  const place = (node, b) => {
    node.hidden = !b;
    if (b) node.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  };

  let fitted = '';
  function fit() {
    const view = doc.defaultView;
    const html = doc.documentElement;
    const touch = html.dataset.touch === '1';
    const reserve = interiorReserve(html.dataset.layout, touch);
    const width = view?.innerWidth ?? 1280, height = view?.innerHeight ?? 720;
    const key = `${width}x${height}|${reserve}|${touch}`;
    if (key === fitted) return;
    fitted = key;
    const layout = cockpitLayout({width, height, reserve, touch});
    root.dataset.variant = layout.variant;
    el.left.src = layout.variant === 'slender' ? pillarSlenderUrl : pillarLeftUrl;
    el.right.src = layout.variant === 'slender' ? pillarSlenderUrl : pillarRightUrl;
    el.right.dataset.mirror = layout.right.mirror ? '1' : '0';
    for (const name of ['floor', 'left', 'right', 'beam', 'dash', 'throttle', 'stick']) place(el[name], layout[name]);
    // Reason: every readout is sized from the dashboard's drawn height, so text scales with the art on any screen.
    el.dash.style.setProperty('--ck-h', `${layout.dash.h}px`);
  }

  let since = 1, lastText = '';
  function draw(g) {
    const text = `${g.speed}|${g.hull}|${g.boost}|${g.boostState}`;
    if (text === lastText) return;
    lastText = text;
    el.speed.textContent = g.speed;
    el.arc.setAttribute('stroke-dasharray', `${(g.arc * 100).toFixed(1)} 100`);
    el.hull.textContent = `${g.hull}%`;
    el.hullBar.style.width = `${g.hull}%`;
    el.boostState.textContent = BOOST_WORD[g.boostState];
    el.boostBar.style.width = `${g.boost}%`;
    root.dataset.hull = g.hullLevel;
    root.dataset.boost = g.boostState;
  }

  return {
    element: root,
    /** Shown only while the inside view is drawn; hiding is free, so the scene calls this every frame. */
    show(on) {
      if (root.hidden === !on) return;
      root.hidden = !on;
      if (on) { fitted = ''; since = 1; }
    },
    /** Reason: rewriting the readout every frame is layout work per frame on a phone; ten a second reads live. */
    update(sim, dt) {
      fit();
      since += Number.isFinite(dt) ? dt : 0;
      if (since < .1) return;
      since = 0;
      draw(cockpitGauges(sim));
    },
  };
}
