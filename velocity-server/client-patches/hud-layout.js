// CHARTVOLT PATCH (28 Sep 2026): race HUD layout that cannot overlap.
// Reason: the vendor places every HUD panel with fixed pixel offsets per breakpoint, so any panel
// whose size differs from what a breakpoint assumed (a long equipment name, the multiplayer
// standings list, a tall window) lands on top of its neighbour. Rather than add yet more
// breakpoints, this measures what is actually on screen and nudges a colliding panel vertically
// away from the ones already placed. It only ever writes the CSS `translate` property, which
// composes with (and never fights) the `transform` each stylesheet uses for scaling.
import logoUrl from '../assets/ui/volt-velocity-logo.webp';

// Never moved: the top buttons and the touch pads are where a player's thumbs and clicks go.
// The aux row is a full-width, pointer-events:none strip with a button at each end, so only its
// buttons count; the strip's empty middle is road the other panels may use.
const FIXED = ['header .brand', 'header .actions', '#steeringPad', '#touch .steer-controls', '#touch .aux-controls button', '#touch .pedal-controls'];
// Moved if needed, in priority order: earlier panels keep their place, later ones give way.
const MOVABLE = ['#hud .map', '#hud .race-stats', '#hud .speed', '#hud .integrity', '.skill-panel', '#liveStandings', '#hud .item-slot'];
const GAP = 8;

function visible(el) {
  if (!el || el.getClientRects().length === 0) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}
const shifted = (r, dy) => ({ left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy });
const hits = (a, b) => a.left < b.right + GAP && a.right + GAP > b.left && a.top < b.bottom + GAP && a.bottom + GAP > b.top;

// Walk in one direction until the panel clears everything already placed. Each step moves strictly
// further, so the loop ends; the bound is only a guard against a pathological layout.
function settle(r, placed, dir) {
  let dy = 0;
  for (let i = 0; i <= placed.length * 2; i++) {
    const hit = placed.find((p) => hits(shifted(r, dy), p));
    if (!hit) return dy;
    dy = dir > 0 ? hit.bottom + GAP - r.top : hit.top - GAP - r.bottom;
  }
  return dy;
}
const offscreen = (r, dy) => r.top + dy < 0 || r.bottom + dy > innerHeight;

export function layoutHud() {
  const movable = MOVABLE.map((q) => document.querySelector(q)).filter(Boolean);
  for (const el of movable) el.style.translate = '';
  if ((document.body.dataset.state || 'hangar') === 'hangar') return;
  const placed = FIXED.flatMap((q) => [...document.querySelectorAll(q)]).filter(visible).map((el) => el.getBoundingClientRect());
  for (const el of movable) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const away = r.top + r.height / 2 < innerHeight / 2 ? 1 : -1;
    let dy = settle(r, placed, away);
    if (offscreen(r, dy)) {
      const back = settle(r, placed, -away);
      if (!offscreen(r, back) || Math.abs(back) < Math.abs(dy)) dy = back;
    }
    if (dy) el.style.translate = `0 ${Math.round(dy)}px`;
    placed.push(shifted(r, dy));
  }
}

// Panel scale for mouse-and-keyboard screens: 1 on a large monitor, shrinking with the window so
// an embedded ~900x560 frame still leaves the road open. Touch layouts ignore it.
function setScale() {
  const s = Math.max(0.62, Math.min(1, innerWidth / 1500, innerHeight / 860));
  document.documentElement.style.setProperty('--cv-hud', s.toFixed(3));
}

// Reason: the vendor only showed the touch pad after the first touchstart, and our desktop rule hides
// it until then, so a touch device whose browser also reports a fine pointer (iPad with a trackpad,
// many Android tablets, hybrids) could never reveal the controls it needs to start driving.
function detectTouch() {
  const coarse = matchMedia('(any-pointer:coarse)').matches;
  const noHover = matchMedia('(hover:none)').matches;
  if (coarse || (navigator.maxTouchPoints > 0 && noHover)) document.body.dataset.touch = '1';
}

function installLogo() {
  const img = document.getElementById('brandLogo');
  if (img) img.src = logoUrl;
}

export function initHudLayout() {
  installLogo();
  detectTouch();
  setScale();
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; setScale(); layoutHud(); });
  };
  addEventListener('resize', schedule);
  addEventListener('orientationchange', schedule);
  const ro = new ResizeObserver(schedule);
  for (const q of [...FIXED, ...MOVABLE]) for (const el of document.querySelectorAll(q)) ro.observe(el);
  // The game rewrites body attributes every frame with unchanged values; only react to real changes.
  let last = '';
  new MutationObserver(() => {
    const b = document.body.dataset;
    const key = `${b.state}|${b.mode}|${b.touch}|${b.controlSize}`;
    if (key !== last) { last = key; schedule(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-state', 'data-mode', 'data-touch', 'data-control-size'] });
  const standings = document.getElementById('liveStandings');
  if (standings) new MutationObserver(schedule).observe(standings, { attributes: true, attributeFilter: ['class'] });
  // Panels fade in and out with CSS (opacity), which no observer reports; a slow sweep catches those.
  setInterval(() => { if (document.body.dataset.state !== 'hangar' && !document.hidden) schedule(); }, 1000);
  schedule();
}
