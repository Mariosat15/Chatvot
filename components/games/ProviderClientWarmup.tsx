"use client";

import { useEffect } from "react";

/** Game codes already being warmed in this document, so a remount never starts a second copy. */
const started = new Set<string>();

/** Gives the lobby's own requests a head start before the large download begins. */
const START_DELAY_MS = 3_000;
/** Removes a frame that never reported load (a 204, or a stalled network). */
const GIVE_UP_MS = 15 * 60_000;

/**
 * Starts a game's heavy first-time download while the player is still on a lobby, so pressing
 * Play is not followed by a long "loading" wait.
 *
 * It loads the first-party play surface's `/play/warmup/<gameCode>`, which answers 204 for a game
 * with nothing to fetch and redirects to an `immutable` file for one that has. The game code is
 * passed through as data - nothing here knows which games are heavy.
 *
 * WHY A HIDDEN FRAME AND NOT fetch(): the game loads that file as a FRAME, and Chrome keeps a
 * frame's document in a different cache entry from the same URL fetched by script, so a fetch
 * would download 100 MB the frame then downloads again. A frame loading the same URL shares the
 * entry. `sandbox` without `allow-scripts` means the document downloads and parses but none of
 * the game runs; `allow-same-origin` keeps its origin, and therefore its cache entry, the same.
 *
 * Appended to `document.body` rather than rendered, so the client-side move from the lobby to the
 * play screen does not remove it and cancel a download that is half done. Skipped under the
 * browser's data-saver setting, and not repeated once a tab has completed it (sessionStorage).
 */
export default function ProviderClientWarmup({ gameCode }: { gameCode?: string | null }) {
  useEffect(() => {
    if (typeof gameCode !== "string" || gameCode.length === 0 || started.has(gameCode)) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    const key = `cv-warmup:${gameCode}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Reason: a browser refusing storage just means the warm-up may run again - harmless.
    }
    started.add(gameCode);

    // Reason: deliberately no cleanup - see the header on why the frame outlives this component.
    window.setTimeout(() => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText =
        "position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none";
      const remove = () => frame.remove();
      frame.addEventListener("load", () => {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        remove();
      });
      window.setTimeout(remove, GIVE_UP_MS);
      frame.src = `/play/warmup/${encodeURIComponent(gameCode)}`;
      document.body.appendChild(frame);
    }, START_DELAY_MS);
  }, [gameCode]);

  return null;
}
