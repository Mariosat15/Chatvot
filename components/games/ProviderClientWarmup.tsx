"use client";

import { useEffect } from "react";

/** Game codes already being warmed in this document, so a remount never starts a second copy. */
const started = new Set<string>();

/** Gives the lobby's own requests a head start before the large download begins. */
const START_DELAY_MS = 3_000;

/** Only same-origin play-surface paths are ever fetched, whatever the list says. */
const PLAY_PATH = /^\/play\/[A-Za-z0-9._\-/]+$/;

/**
 * Starts a game's heavy first-time download while the player is still on a lobby, so pressing
 * Play is not followed by a long "loading" wait.
 *
 * It asks the first-party play surface's `/play/warmup/<gameCode>` for a list of files. A game
 * with nothing to fetch answers 204; one that has answers `{ urls: [...] }`, every entry an
 * `immutable` file, which are then downloaded ONE AT A TIME into the browser's cache so the game
 * later finds them there. The game code is passed through as data - nothing here knows which
 * games are heavy.
 *
 * One at a time on purpose: a lobby is still open while this runs, and forty parallel requests
 * would starve its own polling. A failed file is skipped, never retried - the game fetches it
 * itself on Play. `fetch` rather than a hidden frame, because the files are fetched by script in
 * the game too, and the one page the game loads as a frame is about a megabyte.
 *
 * Deliberately not cancelled on unmount, so the client-side move from the lobby to the play
 * screen does not abandon a download that is half done. Skipped under the browser's data-saver
 * setting, and not repeated once a tab has completed it (sessionStorage).
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

    window.setTimeout(() => {
      void warm(gameCode, key);
    }, START_DELAY_MS);
  }, [gameCode]);

  return null;
}

async function warm(gameCode: string, key: string): Promise<void> {
  let urls: string[] = [];
  try {
    const response = await fetch(`/play/warmup/${encodeURIComponent(gameCode)}`, {
      cache: "no-store",
    });
    if (response.status !== 200) return;
    const body = (await response.json()) as { urls?: unknown };
    urls = Array.isArray(body.urls)
      ? body.urls.filter(
          (url): url is string =>
            typeof url === "string" && PLAY_PATH.test(url) && !url.includes(".."),
        )
      : [];
  } catch {
    return;
  }

  for (const url of urls) {
    try {
      const response = await fetch(url);
      // Reason: reading the body is what completes the download into the cache.
      await response.arrayBuffer();
    } catch {
      // A file that failed is fetched by the game itself on Play; skip it.
    }
  }
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}
