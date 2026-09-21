/**
 * Absolute URL for a player-facing page from the admin app.
 *
 * Admin and player are separate origins. A relative `/games/...` link from admin opens the
 * admin host (404 or the wrong app). Prefer `NEXT_PUBLIC_APP_URL` (main app), then
 * `NEXT_PUBLIC_BASE_URL`. Empty means local relative — only correct when both share a host.
 */

export function getPlayerAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  return raw.replace(/\/$/, "");
}

/** Player catalogue page for one title — slug is `gameCode` (see player-catalogue.service). */
export function playerGamePageHref(gameCode: string): string {
  const path = `/games/${encodeURIComponent(gameCode)}`;
  const base = getPlayerAppBaseUrl();
  return base ? `${base}${path}` : path;
}
