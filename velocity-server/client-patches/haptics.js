// CHARTVOLT PATCH (14 Oct 2026, owner: "a small vibration when collide to side or explode or when and
// while press buttons on the ship like turn accelerate brake etc for mobile ... vibration not shaking the
// camera"). Device vibration only - nothing here touches the camera, the simulation or the input it sends.
//
// Reason it is a module of its own: app.js-style files touch the DOM at load and cannot be imported in a
// test; everything that decides WHETHER and HOW LONG to buzz lives here, with the browser injected.

// Reason for a Map: the kind is a string built from a game event, and an object lookup walks the
// prototype chain, so "constructor" would return a function and buzz with it.
export const HAPTIC_PATTERNS = new Map([
  ['press', 10],          // a ship button or the steering pad pressed
  ['hold', 6],            // a light tick while a turn or brake is held
  ['wall', 28],           // scraping or hitting the side of the track
  ['hit', 45],            // a hazard or a tower shot landing on your own ship
  ['explode', [70, 50, 140]], // your own ship destroyed
]);

// A heavier pulse is never cut short by a lighter one: vibrate() replaces whatever is running.
const RANK = new Map([['press', 1], ['hold', 0], ['wall', 2], ['hit', 2], ['explode', 3]]);
// Reason: the wall event fires on every scraping step, so without a gap a long scrape is one continuous
// motor-on that reads as the phone failing rather than as feedback.
const MIN_GAP_MS = new Map([['press', 35], ['hold', 0], ['wall', 160], ['hit', 160], ['explode', 0]]);

// Turning and braking are the controls a player holds briefly and on purpose; throttle is held for the
// whole race, so a tick while it is held would be a buzz that never stops.
export const HOLD_ACTIONS = new Set(['left', 'right', 'brake', 'steer']);
export const HOLD_PULSE_MS = 240;
export const HAPTICS_KEY = 'cv-vibration';

const duration = pattern => (Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern);

/** Which own-ship event, if any, deserves a pulse. Rival events never buzz your phone. */
export function hapticForEvent(event, selfId = null) {
  if (!event) return null;
  if (event.type === 'ship-destroyed') return 'explode';
  if (event.type === 'destroyed') return selfId != null && event.target === selfId ? 'explode' : null;
  if (selfId != null && event.source != null && event.source !== selfId) return null;
  if (event.type === 'impact') return event.kind === 'wall' || event.source === 'wall' ? 'wall' : 'hit';
  if (event.type === 'blocked') return 'hit';
  return null;
}

export function createHaptics({
  nav = globalThis.navigator,
  storage = globalThis.localStorage,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  isTouch = () => globalThis.matchMedia?.('(any-pointer:coarse)').matches || globalThis.document?.body?.dataset.touch === '1',
  every = (fn, ms) => globalThis.setInterval(fn, ms),
  stop = id => globalThis.clearInterval(id),
} = {}) {
  const supported = typeof nav?.vibrate === 'function';
  let enabled = true;
  try { enabled = storage?.getItem(HAPTICS_KEY) !== 'off'; } catch { /* storage refused: keep the default */ }
  const last = new Map();
  let busyUntil = 0, busyRank = -1, timer = null;
  const held = new Set();

  function pulse(kind) {
    const pattern = HAPTIC_PATTERNS.get(kind);
    if (pattern === undefined || !supported || !enabled || !isTouch()) return false;
    const t = now(), rank = RANK.get(kind);
    if (t < busyUntil && rank < busyRank) return false;
    if (t - (last.get(kind) ?? -Infinity) < MIN_GAP_MS.get(kind)) return false;
    // Reason: a browser that refuses (no user gesture yet, a policy) may throw; feedback is never worth a crash.
    try { if (nav.vibrate(pattern) === false) return false; } catch { return false; }
    last.set(kind, t); busyUntil = t + duration(pattern); busyRank = rank;
    return true;
  }

  function hold(action, down) {
    if (!HOLD_ACTIONS.has(action)) return;
    if (down) held.add(action); else held.delete(action);
    if (held.size && timer === null) timer = every(() => pulse('hold'), HOLD_PULSE_MS);
    else if (!held.size && timer !== null) { stop(timer); timer = null; }
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled && supported) { try { nav.vibrate(0); } catch { /* nothing running to stop */ } }
    try { storage?.setItem(HAPTICS_KEY, enabled ? 'on' : 'off'); } catch { /* not persisted */ }
  }

  function releaseAll() { held.clear(); if (timer !== null) { stop(timer); timer = null; } }

  return { supported, pulse, hold, releaseAll, setEnabled, get enabled() { return enabled; } };
}
