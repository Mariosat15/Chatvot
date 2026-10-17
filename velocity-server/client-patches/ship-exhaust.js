/* CHARTVOLT PATCH (14 Oct 2026, owner: "when user use boost all ships boost as well").
 * Every ship's exhaust is drawn from that ship's OWN state. Before this, only the player's flames were ever
 * updated: rival hulls kept the flame they were built with - always lit, never boosting - while the
 * player's own boost also pulled the camera back and widened the view, so the whole field appeared to
 * surge together. The race server already sends each rival's `boosting` and `speed`; this reads them.
 * Pure presentation - no simulation input. */
export function exhaustLook({lit, boosting, speed}) {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  return {visible: Boolean(lit) && s > 1, scaleZ: boosting ? 1.7 : .6 + s / 180, push: boosting ? 1.4 : 0};
}

/** Applies one look to every flame on a hull. Anchored flames (fixed nozzles) stretch but do not slide. */
export function applyExhaust(flames, look, clock) {
  for (const flame of flames || []) {
    if (flame.material?.uniforms?.clock) flame.material.uniforms.clock.value = clock;
    flame.visible = look.visible;
    flame.scale.z = look.scaleZ;
    flame.position.z = flame.userData.base + (!flame.userData.anchored ? look.push : 0);
  }
}
