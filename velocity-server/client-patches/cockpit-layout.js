/* CHARTVOLT PATCH (14 Oct 2026, owner: "Please adjust the Volt Velocity cockpit to match the supplied mockups",
 * with the Volt-Velocity-Complete-Overlay pack). Supersedes the seven-piece image cockpit of the same day.
 * The pure half of the cockpit drawn by cockpit-interior.js: what the dashboard reads, which of the three
 * complete cockpit images suits a screen, and where every instrument, the telemetry panel, the utility
 * buttons and the two control groups land on it. No DOM, no three.js and no asset imports, so it is tested
 * directly. Pure presentation - nothing here reads back into the simulation. */

/** Label for the item bay / chip. Long names drop " READY" (and COUNTERMEASURE shortens) so the fixed skin does not overflow.
 *  CHARTVOLT PATCH (14 Oct 2026, owner: "the overdrive word come out of the button"). */
export function itemBayLabel(item) {
  if (!item?.name) return 'EMPTY';
  const name = item.name === 'COUNTERMEASURE' ? 'COUNTER' : item.name;
  return name.length > 7 ? name : `${name} READY`;
}

/** Readout text, kept pure so it can be tested without a page. */
export function interiorReadout(sim) {
  const speed = Number.isFinite(sim?.speed) ? Math.round(Math.abs(sim.speed) * 3.6) : 0;
  const pct = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : 0;
  return {speed: String(speed), boost: pct(sim?.energy), hull: pct(sim?.hull)};
}

/** Full scale of the speed arc. Fastest base hull 124 m/s plus boost 36, overdrive 22 and a pad 18 is 720 km/h. */
export const GAUGE_FULL_SCALE_KMH = 720;
/** Reason: simulation.js only lets a ship boost while energy > .02, so READY must use the same line. */
export const BOOST_MIN_ENERGY = .02;

/** Everything the three dashboard bays show. */
export function cockpitGauges(sim) {
  const readout = interiorReadout(sim);
  const energy = Number.isFinite(sim?.energy) ? sim.energy : 0;
  const boostState = energy > BOOST_MIN_ENERGY ? (sim?.boosting === true ? 'active' : 'ready') : 'empty';
  const hullLevel = readout.hull > 50 ? 'ok' : readout.hull > 25 ? 'low' : 'critical';
  return {...readout, arc: Math.min(1, Number(readout.speed) / GAUGE_FULL_SCALE_KMH), boostState, hullLevel};
}

/**
 * The three cockpit images and the pack's placement.json, in each image's own pixels as [x, y, w, h].
 * `bays` hold the control groups: `top` is the wide button (SHIELD or BOOST), `a` and `b` the pair below it.
 * `util.right` is the right edge of the last utility button; `util.below` (portrait only) is the gap under
 * the telemetry panel, because there the buttons sit beneath it rather than along the top edge.
 */
export const OVERLAY_ART = Object.freeze({
  desktop: {w: 1672, h: 941, logo: [680, 10, 315, 80], telemetry: [486, 106, 700, 85.56],
    util: {y: 22, size: 54, gap: 13, right: 1645}, minimapGap: 30, minimapSize: 140,
    instruments: {left: [490, 750, 125, 80], centre: [710, 773, 255, 70], right: [1056, 750, 130, 80]},
    bays: {left: {top: [77, 755, 188, 54], a: [36, 821, 128, 84], b: [171, 821, 126, 84]},
      right: {top: [1411, 758, 182, 54], a: [1370, 821, 128, 84], b: [1506, 821, 128, 84]}}},
  landscape: {w: 1844, h: 853, logo: [720, 9, 405, 90], telemetry: [486, 116, 872, 106.58],
    util: {y: 20, size: 68, gap: 12, right: 1815}, minimapGap: 30, minimapSize: 140,
    instruments: {left: [522, 678, 145, 75], centre: [810, 694, 240, 75], right: [1180, 678, 145, 75]},
    bays: {left: {top: [58, 644, 264, 75.68], a: [20, 720, 151, 99], b: [184, 720, 151, 99]},
      right: {top: [1517, 644, 264, 75.68], a: [1500, 720, 151, 99], b: [1670, 720, 151, 99]}}},
  portrait: {w: 852, h: 1846, logo: [296, 20, 260, 96], telemetry: [39, 140, 774, 172],
    util: {below: 5, size: 72, gap: 23, right: 823}, minimapGap: 30, minimapSize: 140,
    instruments: {left: [90, 1410, 115, 80], centre: [317, 1430, 210, 80], right: [645, 1410, 115, 80]},
    bays: {left: {top: [48, 1602, 260, 74.53], a: [10, 1682, 160, 104.89], b: [180, 1682, 160, 104.89]},
      right: {top: [550, 1602, 260, 74.53], a: [510, 1682, 160, 104.89], b: [680, 1682, 160, 104.89]}}},
});

/** The smallest finger target on a touch screen, and the smallest mouse target beside it. */
export const TOUCH_TARGET_PX = 48;
export const MOUSE_TARGET_PX = 36;
/** The telemetry panel is never drawn narrower than this on a wide screen, or the values stop being readable. */
export const TELEMETRY_MIN_WIDTH = Object.freeze({wide: 460, portrait: 360});
/** Size of the LIVE pill a portrait screen draws beside the logo instead of a seventh panel cell. */
export const LIVE_PILL = Object.freeze({w: 78, h: 26});
/** How many utility buttons show along the top: mute, camera, pause, settings, fullscreen.
 *  CHARTVOLT PATCH (14 Oct 2026, owner: put the camera change button back in the game area): a phone keeps
 *  camera + pause + settings (mute and fullscreen stay in the menu). */
export const UTIL_COUNT = Object.freeze({mouse: 5, touch: 3});
/** Landscape phone only: the shell may use at most this fraction of the screen height so the road stays visible. */
export const LANDSCAPE_SHELL_HEIGHT = 0.66;
/** Landscape phone only: the lap/time strip stays this tall relative to the screen. */
export const LANDSCAPE_TELEMETRY_HEIGHT = 0.11;

const EDGE = 8;
const num = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const inset = value => Number.isFinite(value) && value > 0 ? value : 0;
const box = (x, y, w, h) => ({x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h)});
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The cockpit image whose shape is closest to the screen's, compared as a ratio so wide and tall weigh alike. */
export function chooseOverlay(width, height) {
  const aspect = num(width, 1280) / num(height, 720);
  let best = 'desktop', off = Infinity;
  for (const [name, art] of Object.entries(OVERLAY_ART)) {
    const d = Math.abs(Math.log(aspect / (art.w / art.h)));
    if (d < off) { off = d; best = name; }
  }
  return best;
}

/**
 * Where everything goes on a `width` x `height` screen. The image is scaled to cover the screen, centred
 * across it and anchored to the bottom, so the dashboard always meets the bottom edge and runs the full width
 * with no gap; anything the cover fit pushes off the top or the sides is cropped. Instruments live inside the
 * artwork and are mapped with it. The controls are real inputs and are NOT left where a crop would put them:
 * each group is anchored to its bay's outer bottom corner, kept inside the safe area, grown to the minimum
 * finger size and kept clear of the instruments. `hand: 'left'` swaps the two groups.
 */
export function cockpitOverlay({width, height, touch = false, hand = 'right', controlScale = 1, safe = {}} = {}) {
  const W = num(width, 1280), H = num(height, 720);
  const art = OVERLAY_ART[chooseOverlay(W, H)];
  const variant = Object.keys(OVERLAY_ART).find(name => OVERLAY_ART[name] === art);
  const portrait = variant === 'portrait';
  const landscape = variant === 'landscape';
  // Reason: landscape phones match the art's aspect, so a cover fit fills the whole height and the road
  // window collapses between the lap strip and the dashboard. Shrink only that shell (portrait/desktop
  // keep cover) and leave a clear band of track above it.
  let s = Math.max(W / art.w, H / art.h);
  if (landscape) s = Math.min(s, (H * LANDSCAPE_SHELL_HEIGHT) / art.h);
  const ox = (W - art.w * s) / 2, oy = H - art.h * s;
  const map = ([x, y, w, h]) => ({x: ox + x * s, y: oy + y * s, w: w * s, h: h * s});
  const top0 = inset(safe.top) + EDGE, bottom0 = H - inset(safe.bottom) - EDGE;
  const left0 = inset(safe.left) + EDGE, right0 = W - inset(safe.right) - EDGE;
  const minHit = touch ? TOUCH_TARGET_PX : MOUSE_TARGET_PX;

  const instruments = {};
  for (const [key, rect] of Object.entries(art.instruments)) instruments[key] = map(rect);
  const logo = map(art.logo);
  // Reason: a cover fit on a screen taller than the art crops its top, and the painted logo goes with it.
  // Landscape already clears the top for the track, so the painted logo is never re-drawn as a badge there.
  const logoCropped = !landscape && logo.y < top0 - logo.h * .25;
  // Reason: the mockups always carry the logo above the panel, so a cropped one is drawn again as a badge,
  // cut from the same image at the same scale, at the top centre.
  const badge = logoCropped ? {x: W / 2 - logo.w / 2, y: top0, w: logo.w, h: logo.h} : null;
  const head = badge || logo;

  // Telemetry: the mapped panel, widened to a readable minimum and kept on screen below the safe area.
  // Landscape: a compact strip pinned under the safe area (the mapped slot sits mid-screen and blocks the road).
  const t = map(art.telemetry);
  const avail = right0 - left0;
  const want = Math.min(avail, portrait ? TELEMETRY_MIN_WIDTH.portrait : landscape ? Math.min(TELEMETRY_MIN_WIDTH.wide * .72, avail * .62) : TELEMETRY_MIN_WIDTH.wide);
  const grow = landscape ? Math.min(want / t.w, avail / t.w) : Math.min(Math.max(1, want / t.w), avail / t.w);
  const tele = landscape
    ? {w: Math.min(t.w * Math.max(grow, .55), avail * .62), h: Math.min(t.h * .55, H * LANDSCAPE_TELEMETRY_HEIGHT), y: top0}
    : {w: t.w * grow, h: t.h * grow, y: Math.max(t.y, top0, badge ? badge.y + badge.h + 4 : 0)};
  tele.x = Math.min(Math.max(W / 2 - tele.w / 2, left0), right0 - tele.w);

  // Portrait has six cells, so LIVE becomes a pill beside the logo, or above the panel when there is no room.
  let live = null;
  if (portrait) {
    live = {w: LIVE_PILL.w, h: LIVE_PILL.h, x: Math.min(head.x + head.w + 6 * s, right0 - LIVE_PILL.w), y: head.y + head.h / 2 - LIVE_PILL.h / 2};
    if (live.y < top0 || hits(live, head)) {
      live.x = tele.x + tele.w - LIVE_PILL.w;
      live.y = tele.y - LIVE_PILL.h - 4;
      if (live.y < top0) { tele.y += top0 - live.y; live.y = top0; }
    }
  }

  // Utility buttons: a right-aligned row along the top, or straight under the panel on a portrait screen.
  const uCount = touch ? UTIL_COUNT.touch : UTIL_COUNT.mouse;
  const uSize = Math.min(Math.max(art.util.size * s, minHit), 64);
  const uGap = Math.max(6, art.util.gap * s);
  const uRight = Math.min(right0, ox + art.util.right * s);
  const uY = portrait ? tele.y + tele.h + Math.max(4, art.util.below * s) : Math.max(top0, oy + art.util.y * s);
  const uWidth = uCount * uSize + (uCount - 1) * uGap;
  const util = {x: uRight - uWidth, y: uY, w: uWidth, h: uSize, size: uSize, gap: uGap, count: uCount};
  // Reason: the 48 px finger minimum can make the row taller than the art's, which would reach the panel.
  // Landscape pins the lap strip at the top for road visibility, so the utility row steps under it instead.
  if (!portrait && hits(util, tele)) {
    if (landscape) util.y = tele.y + tele.h + 6;
    else tele.y = util.y + util.h + 6;
  }

  // Minimap, mouse screens only: under the utility row, right-aligned with it.
  let minimap = null;
  if (!touch) {
    const size = Math.min(Math.max(art.minimapSize * s, 110), 180);
    minimap = {x: uRight - size, y: util.y + util.h + Math.max(12, art.minimapGap * s), w: size, h: size};
    if (hits(minimap, tele)) minimap = null;
  }

  const groups = hand === 'left'
    ? {left: ['boost', 'brake', 'accel'], right: ['fire', 'left', 'right']}
    : {left: ['fire', 'left', 'right'], right: ['boost', 'brake', 'accel']};
  const bayBounds = {};
  for (const side of ['left', 'right']) {
    const {top, a, b} = art.bays[side];
    const minX = Math.min(top[0], a[0]), maxX = Math.max(top[0] + top[2], b[0] + b[2]);
    const minY = top[1], maxY = Math.max(a[1] + a[3], b[1] + b[3]);
    const ax = side === 'left' ? Math.max(left0, ox + minX * s) : Math.min(right0, ox + maxX * s);
    bayBounds[side] = {minX, maxX, minY, maxY, gw: maxX - minX, gh: maxY - minY, ax, ay: Math.min(bottom0, oy + maxY * s)};
  }
  // One scale for both groups, so the two bays stay a matching pair.
  const smallest = Math.min(art.bays.left.top[3], art.bays.left.a[3]);
  const sizeFactor = Number.isFinite(controlScale) && controlScale > 0 ? controlScale : 1;
  let k = (touch ? Math.max(1, minHit / (smallest * s)) : 1) * sizeFactor;
  k = Math.min(k, (avail - 16) / ((bayBounds.left.gw + bayBounds.right.gw) * s));
  for (const side of ['left', 'right']) {
    const g = bayBounds[side];
    for (const r of Object.values(instruments)) {
      const room = side === 'left' ? r.x - 8 - g.ax : g.ax - (r.x + r.w) - 8;
      const kH = room / (g.gw * s), kV = (g.ay - 8 - (r.y + r.h)) / (g.gh * s);
      k = Math.min(k, Math.max(kH, kV));
    }
  }
  k = Math.max(k, .5);

  const controls = {};
  for (const side of ['left', 'right']) {
    const g = bayBounds[side], src = art.bays[side];
    const place = rect => {
      const relX = side === 'left' ? rect[0] - g.minX : rect[0] - g.maxX;
      const b = {x: g.ax + relX * s * k, y: g.ay + (rect[1] - g.maxY) * s * k, w: rect[2] * s * k, h: rect[3] * s * k};
      // Reason: the skin is drawn with background-size: contain, so the hit box may grow past it.
      if (b.w < minHit) { b.x -= (minHit - b.w) / 2; b.w = minHit; }
      if (b.h < minHit) { b.y -= (minHit - b.h) / 2; b.h = minHit; }
      return b;
    };
    const [topName, aName, bName] = groups[side];
    const ta = place(src.top), pa = place(src.a), pb = place(src.b);
    const mainTop = Math.min(pa.y, pb.y);
    if (ta.y + ta.h > mainTop - 4) ta.y = mainTop - 4 - ta.h;
    const lift = Math.max(0, Math.max(pa.y + pa.h, pb.y + pb.h) - bottom0);
    const minLeft = Math.min(ta.x, pa.x, pb.x), maxRight = Math.max(ta.x + ta.w, pa.x + pa.w, pb.x + pb.w);
    const shift = minLeft < left0 ? left0 - minLeft : maxRight > right0 ? right0 - maxRight : 0;
    for (const [name, b] of [[topName, ta], [aName, pa], [bName, pb]]) controls[name] = box(b.x + shift, b.y - lift, b.w, b.h);
  }

  const groupTop = Math.min(...Object.values(controls).map(b => b.y));
  const dashTop = Math.min(groupTop, ...Object.values(instruments).map(r => r.y)) - 8;
  const out = {};
  for (const [key, r] of Object.entries(instruments)) out[key] = box(r.x, r.y, r.w, r.h);
  return {
    variant, scale: s, controlScale: k, logoCropped,
    logo: badge && {...box(badge.x, badge.y, badge.w, badge.h), size: [Math.round(art.w * s), Math.round(art.h * s)], offset: [Math.round(-art.logo[0] * s), Math.round(-art.logo[1] * s)]},
    art: box(ox, oy, art.w * s, art.h * s),
    instruments: out,
    telemetry: {...box(tele.x, tele.y, tele.w, tele.h), portrait},
    live: live && box(live.x, live.y, live.w, live.h),
    util: {...box(util.x, util.y, util.w, util.h), size: Math.round(uSize), gap: Math.round(uGap), count: uCount},
    minimap: minimap && box(minimap.x, minimap.y, minimap.w, minimap.h),
    controls,
    messagesTop: Math.round(Math.max(tele.y + tele.h, portrait ? util.y + util.h : 0, live ? live.y + live.h : 0) + 8),
    dashTop: Math.round(dashTop),
  };
}
