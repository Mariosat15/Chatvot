/**
 * The game's own round clock, remembered per round in this browser.
 *
 * Only the game knows when its timer started (the player presses Start inside the frame), and
 * it says so only while the frame is open (the `clock` frame message). Once the player leaves
 * the frame, or reloads, that fact would be lost and the Round time tile would have nothing to
 * count to but the server's deadline, which is capped at the competition end - owner, 15 Oct
 * 2026: "the round time must match the game round time not the competition end time".
 *
 * Reason for localStorage wrapped in try/catch: it THROWS rather than returning null when a
 * browser refuses storage, and a lost memory only costs the tile its countdown.
 */
const KEY_PREFIX = "cv-game-clock:";
/** Older entries are pruned on write; no round outlives this. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function rememberGameClock(roundId: string, endsAtMs: number): void {
  if (!roundId || !Number.isFinite(endsAtMs)) return;
  try {
    const store = window.localStorage;
    const now = Date.now();
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const value = Number(store.getItem(key));
      if (!Number.isFinite(value) || value < now - MAX_AGE_MS) store.removeItem(key);
    }
    store.setItem(KEY_PREFIX + roundId, String(endsAtMs));
  } catch {
    // Storage refused: the in-memory clock still serves this visit.
  }
}

export function recallGameClock(roundId: string): number | null {
  if (!roundId) return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + roundId);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
