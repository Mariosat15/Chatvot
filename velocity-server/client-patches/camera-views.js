/* CHARTVOLT PATCH (14 Oct 2026, owner: "we need another cameras ... like first person view like inside the
 * cockpit ... closer like the 3rd party camera now but closer to the ship but still see the front of the
 * view complete ... another camera you choose").
 * Pure presentation: a view moves the camera only, never the ship, the simulation or the seed.
 * `shipPull` is how far the look-at point is pulled from the road ahead towards the ship - lower keeps more of
 * the road ahead in frame, which is what lets the close view sit nearer without losing the corner. */
export const CAMERA_VIEWS = Object.freeze({
  chase:   Object.freeze({label: 'Chase',       back: 1,    up: 1,    shipPull: .32, fovAdd: 0}),
  close:   Object.freeze({label: 'Close chase', back: .58,  up: .55,  shipPull: .16, fovAdd: 4}),
  cockpit: Object.freeze({label: 'Cockpit',     cockpit: true, fov: 76}),
  high:    Object.freeze({label: 'High view',   back: 1.3,  up: 2.4,  shipPull: .55, fovAdd: -4}),
});
export const DEFAULT_CAMERA_VIEW = 'chase';
export const CAMERA_VIEW_KEY = 'cv-camera-view';
export const CAMERA_VIEW_ORDER = Object.freeze(Object.keys(CAMERA_VIEWS));

/** Reason: the id comes from localStorage or a <select>, so an object lookup would let "__proto__" through. */
export function resolveCameraView(id) {
  return typeof id === 'string' && Object.hasOwn(CAMERA_VIEWS, id) ? id : DEFAULT_CAMERA_VIEW;
}

export function nextCameraView(id) {
  const i = CAMERA_VIEW_ORDER.indexOf(resolveCameraView(id));
  return CAMERA_VIEW_ORDER[(i + 1) % CAMERA_VIEW_ORDER.length];
}

/** Chase-style offsets for one view, scaled from the per-layout preset so phones keep their own framing. */
export function chaseCamera(id, preset, boosting) {
  const v = CAMERA_VIEWS[resolveCameraView(id)];
  if (v.cockpit) return {cockpit: true, fov: v.fov + (boosting ? preset.boostFov : 0)};
  return {
    cockpit: false,
    back: preset.back * v.back + (boosting ? preset.boostBack * v.back : 0),
    up: preset.up * v.up,
    shipPull: v.shipPull,
    fov: preset.fov + v.fovAdd + (boosting ? preset.boostFov : 0),
  };
}

/** The eye in the ship's own space: just above the canopy and a little ahead of centre (local -Z is forward).
 *  Reason: sitting exactly inside the hull would put the near plane through the canopy glass. */
export function cockpitEye(bounds) {
  const min = bounds?.min, max = bounds?.max;
  if (!min || !max || ![min.y, min.z, max.y, max.z].every(Number.isFinite)) return {x: 0, y: 1.4, z: -0.6};
  const centreZ = (min.z + max.z) / 2;
  return {x: 0, y: max.y + 0.18, z: centreZ + (min.z - centreZ) * 0.2};
}
