// CHARTVOLT PATCH (13 Oct 2026): a phone plays the race as a full-screen landscape game.
//
// Reason it lives inside the race client rather than on the platform: only the game knows it is a
// landscape game, and the platform's frame is shared by every title (a puzzle must not be forced
// sideways). Both iframes above this document carry `allow="fullscreen"`, so a request made here
// from a player's tap makes this document the full-screen element on Android and iPadOS.
//
// iPhone Safari has no element Fullscreen API at all, so there the request is simply unavailable;
// the platform already pins the game stage over the whole window on a phone, and the hint below
// tells the player to turn the phone, which on iPhone also collapses Safari's bars.
//
// Nothing here touches the simulation, inputs or scoring - it is presentation only.

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const DRIVING = new Set(['racing', 'countdown']);
const HINT_MS = 6000;
const DISMISS_KEY = 'cv-rotate-dismissed';

function remembered() {
  // Reason: sessionStorage THROWS (not null) when a browser refuses storage.
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function remember() {
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage refused: hint may reappear */ }
}

async function goImmersive() {
  const root = document.documentElement;
  if (!document.fullscreenElement && document.fullscreenEnabled && typeof root.requestFullscreen === 'function') {
    try { await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* refused: stay windowed */ }
  }
  // Only meaningful (and only permitted on most browsers) while full screen.
  if (document.fullscreenElement && screen.orientation && typeof screen.orientation.lock === 'function') {
    try { await screen.orientation.lock('landscape'); } catch { /* unsupported device or policy */ }
  }
}

export function installMobileImmersive() {
  if (!coarse || typeof document === 'undefined') return;

  // Every tap while not full screen retries: the first one may land on a control whose own handler
  // runs first, and a player who left full screen with the system gesture gets it back on the next tap.
  document.addEventListener('pointerup', () => { if (!document.fullscreenElement) void goImmersive(); }, { passive: true });

  const hint = document.createElement('div');
  hint.id = 'cvRotate';
  hint.setAttribute('role', 'status');
  hint.hidden = true;
  hint.innerHTML = '<span aria-hidden="true">⟳</span><b>Turn your phone sideways for the full track</b><button type="button">OK</button>';
  document.body.appendChild(hint);
  let timer = 0;
  hint.querySelector('button').addEventListener('click', () => { remember(); hint.hidden = true; });

  const update = () => {
    const portrait = innerHeight > innerWidth;
    const show = portrait && DRIVING.has(document.body.dataset.state) && !remembered();
    if (show && hint.hidden) {
      hint.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { hint.hidden = true; }, HINT_MS);
    } else if (!show && !hint.hidden) {
      hint.hidden = true;
    }
  };
  // Reason: main.js rewrites data-state every frame and an attribute write fires a mutation record
  // even when the value is unchanged, so react to genuine transitions only.
  let lastState = '';
  new MutationObserver(() => {
    const state = document.body.dataset.state || '';
    if (state !== lastState) { lastState = state; update(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
  addEventListener('resize', update, { passive: true });
  addEventListener('orientationchange', update, { passive: true });
}
