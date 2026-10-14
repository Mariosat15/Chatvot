/* CHARTVOLT PATCH (14 Oct 2026, owner: "rebuild the cockpit to look like image 1 also i provided the elements
 * for you to build it must also work in all modes and devices").
 * The pure half of the image cockpit drawn by cockpit-interior.js: what the dashboard reads and where every
 * piece of artwork sits on a screen of any shape. No DOM, no three.js and no asset imports, so it is tested
 * directly. Pure presentation - nothing here reads back into the simulation. */

/** Readout text, kept pure so it can be tested without a page. */
export function interiorReadout(sim) {
  const speed = Number.isFinite(sim?.speed) ? Math.round(Math.abs(sim.speed) * 3.6) : 0;
  const pct = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : 0;
  return {speed: String(speed), boost: pct(sim?.energy), hull: pct(sim?.hull)};
}

/** Share of the screen height, from the bottom, covered by touch controls and the bottom HUD per layout. */
export const INTERIOR_RESERVE = Object.freeze({portrait: .31, landscape: .34, tablet: .12, desktop: 0});

/** How much of the bottom of the screen the cockpit must keep its dashboard above. No touch pads, no reserve. */
export function interiorReserve(layout, touch) {
  if (!touch) return 0;
  return Object.hasOwn(INTERIOR_RESERVE, layout) ? INTERIOR_RESERVE[layout] : INTERIOR_RESERVE.landscape;
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
 * Pixel sizes of the prepared artwork in root/assets/ui/cockpit/, and where on each pillar its foot and its
 * top meet the dashboard and the crossbeam, as a share of the image width (measured from the alpha channel).
 */
export const COCKPIT_ART = Object.freeze({
  dash: {w: 1600, h: 338},
  beam: {w: 1600, h: 113},
  pillarLeft: {w: 586, h: 900, foot: .66, top: .06},
  pillarRight: {w: 536, h: 900, foot: .45, top: .94},
  pillarSlender: {w: 305, h: 900, foot: .57, top: .06},
  throttle: {w: 520, h: 505},
  stick: {w: 460, h: 564},
});

/** How far the dashboard art may be widened past its own shape on a short, wide screen before it looks drawn wrong. */
export const DASH_MAX_STRETCH = 1.45;

const box = (x, y, w, h) => ({x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h)});

/**
 * Where each piece of the cockpit goes on a `width` x `height` screen whose bottom `reserve` share is covered by
 * touch controls. Portrait screens get the slender pillars (the raked ones would fill a narrow screen); every
 * other shape gets the raked pair from image 1. The throttle and sidestick are drawn only without touch
 * controls, because on a phone or tablet those corners are where the player's thumbs and buttons are.
 */
export function cockpitLayout({width, height, reserve, touch}) {
  const W = Number.isFinite(width) && width > 0 ? width : 1280;
  const H = Number.isFinite(height) && height > 0 ? height : 720;
  const r = Number.isFinite(reserve) ? Math.max(0, Math.min(.6, reserve)) : 0;
  // Reason: without touch pads the bottom strip still holds the item pill and key hints, so keep 5% clear.
  const bottom = touch ? H * r : H * .05;
  const free = H - bottom;
  const portrait = W < H;
  const aspect = COCKPIT_ART.dash.w / COCKPIT_ART.dash.h;

  const dashCap = free * (portrait ? .22 : .3);
  const dashW = portrait ? Math.min(W * 1.04, 620) : Math.min(W * .64, aspect * DASH_MAX_STRETCH * dashCap, 1500);
  const dashH = Math.min(dashW / aspect, dashCap);
  const dashX = (W - dashW) / 2, dashY = H - bottom - dashH;

  const variant = portrait ? 'slender' : 'raked';
  const leftArt = portrait ? COCKPIT_ART.pillarSlender : COCKPIT_ART.pillarLeft;
  const rightArt = portrait ? COCKPIT_ART.pillarSlender : COCKPIT_ART.pillarRight;
  // Reason: the slender art leans one way only, so the right pillar is the same image mirrored.
  const rightFoot = portrait ? 1 - rightArt.foot : rightArt.foot;
  const rightTop = portrait ? 1 - rightArt.top : rightArt.top;
  // The pillar runs from the top of the screen down into the upper half of the dashboard, where its foot tucks behind it.
  const pillarH = dashY + dashH * .55;
  const leftW = pillarH * leftArt.w / leftArt.h, rightW = pillarH * rightArt.w / rightArt.h;
  const leftX = Math.max(-leftW * .1, dashX + dashW * .02 - leftW * leftArt.foot);
  const rightX = Math.min(W - rightW * .9, dashX + dashW * .98 - rightW * rightFoot);

  const beamFrom = leftX + leftW * leftArt.top, beamTo = rightX + rightW * rightTop;
  const beamW = Math.max(0, beamTo - beamFrom) * 1.06;
  const beamH = beamW * COCKPIT_ART.beam.h / COCKPIT_ART.beam.w;

  let throttle = null, stick = null;
  if (!touch && W >= 700) {
    const th = Math.min(dashH * 1.2, H * .26), tw = th * COCKPIT_ART.throttle.w / COCKPIT_ART.throttle.h;
    throttle = box(Math.max(W * .005, dashX - tw * .75), H - th * .88, tw, th);
    const sh = Math.min(dashH * 1.4, H * .3), sw = sh * COCKPIT_ART.stick.w / COCKPIT_ART.stick.h;
    stick = box(Math.min(W - sw * 1.005, dashX + dashW - sw * .25), H - sh * .9, sw, sh);
  }

  return {
    variant,
    bottom: Math.round(bottom),
    dash: box(dashX, dashY, dashW, dashH),
    floor: box(0, dashY + dashH * .5, W, H - (dashY + dashH * .5)),
    left: {...box(leftX, 0, leftW, pillarH), mirror: false},
    right: {...box(rightX, 0, rightW, pillarH), mirror: portrait},
    beam: box((beamFrom + beamTo) / 2 - beamW / 2, -beamH * .2, beamW, beamH),
    throttle,
    stick,
  };
}
