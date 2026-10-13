// CHARTVOLT PATCH (13 Oct 2026): on a phone the race fills the whole screen, in portrait or landscape.
//
// The platform owns the frame: in full screen it pins the game stage over the whole window
// (`position:fixed; inset:0; 100dvw x 100dvh`), which is what makes it fill an iPhone, whose Safari
// has no element Fullscreen API. On Android and iPadOS this document may additionally ask for real
// full screen to hide the browser's own bars.
//
// Reason this was rewritten (owner: "the game must take the whole mobile screen when full screen
// either portrait or landscape", and "it keep freezing"): the first version locked the phone to
// landscape, showed a rotate banner in portrait, and re-requested full screen on EVERY tap while not
// full screen. Each request that was granted and then dropped by a system gesture resized the
// renderer, and every resize reallocates the canvas and all post-processing targets - a visible
// freeze. Now: at most one request per race, from a tap during the countdown or the race, never an
// orientation lock, and no banner.
//
// Nothing here touches the simulation, inputs or scoring - it is presentation only.

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const DRIVING = new Set(['racing', 'countdown']);

function canRequest() {
  const root = document.documentElement;
  return !document.fullscreenElement && document.fullscreenEnabled && typeof root.requestFullscreen === 'function';
}

export function installMobileImmersive() {
  if (!coarse || typeof document === 'undefined') return;

  let askedThisRace = false;
  let lastState = '';
  // Reason: main.js rewrites data-state every frame and an attribute write fires a mutation record
  // even when the value is unchanged, so react to genuine transitions only.
  new MutationObserver(() => {
    const state = document.body.dataset.state || '';
    if (state === lastState) return;
    if (state === 'countdown') askedThisRace = false;
    lastState = state;
  }).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });

  // A browser only grants full screen inside a user gesture, so ask from the player's own tap.
  document.addEventListener('pointerup', () => {
    if (askedThisRace || !DRIVING.has(document.body.dataset.state) || !canRequest()) return;
    askedThisRace = true;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* refused: the platform's pinned stage still fills the window */ });
  }, { passive: true });
}
