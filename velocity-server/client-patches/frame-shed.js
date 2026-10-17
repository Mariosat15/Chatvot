// CHARTVOLT PATCH (14 Oct 2026, owner: the game should lower its own graphics when a phone slows down).
// The scene already lowers its internal resolution when frames run long (`dynamicScale` in scene.js),
// but once that reaches its floor nothing else gives way, so a device short of CPU rather than pixels
// kept stuttering. This is the second stage: one visual extra at a time, cheapest-to-lose first.
//
// Reason: every step is rendering only - glow, sky cards and how far facade detail is drawn. Nothing the
// race reads (seed, track, gates, physics) is touched. Steps are never restored automatically, because
// each change is itself a hitch and swinging back and forth froze devices before (see scene.js); the
// player's own Settings choice still wins the next time it is applied.
export const SHED_DETAIL_RANGE = 140;

/** Turns off the next extra still on. Returns what it turned off, or null when nothing is left. */
export function shedNextEffect(view) {
  if (view.bloom?.enabled) {
    view.bloom.enabled = false;
    return 'bloom';
  }
  const clouds = view.cloudDetails || [];
  if (view.cloudVolume?.visible || clouds.some(c => c.visible)) {
    if (view.cloudVolume) view.cloudVolume.visible = false;
    for (const c of clouds) c.visible = false;
    return 'clouds';
  }
  if ((view.detailRange ?? 350) > SHED_DETAIL_RANGE) {
    view.detailRange = SHED_DETAIL_RANGE;
    return 'detail';
  }
  return null;
}
