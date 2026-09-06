import fs from "fs";
import path from "path";

import type { Request, Response } from "express";

import { sendError } from "./errors";

/**
 * The document the platform's iframe loads, and its two assets.
 *
 * THREE NAMED ROUTES RATHER THAN `express.static`
 * ----------------------------------------------
 * A static middleware mounted on `/play` would sit in front of `/play/api/*` and would serve
 * whatever else ever lands in the directory. This surface is reached by an unauthenticated
 * browser holding a launch token, so the smallest possible file list is worth three lines: the
 * allowlist below is the complete set of paths, and anything else falls through to the JSON 404.
 *
 * The allowlist is a `Map` and not an object literal, because the key comes from the request. Both
 * `in` and object indexing walk the prototype chain, so `"__proto__"` and `"toString"` pass a
 * naive guard and return something truthy - the same defect was found in this platform's admin
 * round inspector on 5 September 2026. A `Map` has no prototype chain to walk.
 */

/**
 * Where the files live.
 *
 * `__dirname` is `src/http` when the service runs under `tsx` and `dist/src/http` after a build,
 * so the package root is either two or three levels up. Both are tried rather than guessed, which
 * is what makes `npm run dev` and `npm start` serve the same files with no copy step in the build.
 * A copy step would be the more conventional answer and it has a worse failure mode: forgetting it
 * produces a 404 on the play surface in production only, which is the one place nobody tests.
 */
function resolvePlayRoot(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "..", "public", "play"),
    path.resolve(__dirname, "..", "..", "..", "public", "play"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  return null;
}

const PLAY_ROOT = resolvePlayRoot();

if (!PLAY_ROOT) {
  // Loud, once, at boot. Reason it is not a thrown error: every other endpoint - creating rounds,
  // reporting results, the sweeper finishing rounds already in flight - works without these files,
  // and refusing to start would turn a broken play surface into a total outage.
  console.error(
    "❌ [games-service] the play surface was not found; /play will return 500. Expected " +
      "public/play/index.html beside package.json.",
  );
}

const ASSETS = new Map<string, { file: string; type: string }>([
  ["app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["app.css", { file: "app.css", type: "text/css; charset=utf-8" }],
  ["board.js", { file: "board.js", type: "text/javascript; charset=utf-8" }],
]);

function commonHeaders(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  /*
   * The launch token is in this page's own URL, so a referrer sent from here would carry it into
   * somebody else's logs. Set as a header as well as the document's `<meta>` because the meta tag
   * governs the document and this covers the assets too.
   */
  res.setHeader("Referrer-Policy", "no-referrer");
  /*
   * `no-cache` means revalidate, not "never store", so a repeat load is still a 304 rather than a
   * download. Chosen over a max-age because a player mid-contest holding a cached client from
   * before a deploy is a support ticket nobody can reproduce, and the whole surface is a few
   * kilobytes.
   */
  res.setHeader("Cache-Control", "no-cache");
}

/**
 * `GET /play` - the launch URL's target.
 *
 * The token in the query string is deliberately NOT read here. Serving the same bytes to everyone
 * keeps a credential out of the HTML, out of any cache that ignores our headers, and out of a
 * page that a player could save and share. The client reads it from `location.search` and sends it
 * in a request body from then on, so it never appears in a second URL.
 */
export function servePlayPage(_req: Request, res: Response): void {
  if (!PLAY_ROOT) {
    sendError(res, 500, "INTERNAL", "The play surface is unavailable.", true);
    return;
  }
  commonHeaders(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(path.join(PLAY_ROOT, "index.html"));
}

export function servePlayAsset(req: Request, res: Response): void {
  if (!PLAY_ROOT) {
    sendError(res, 500, "INTERNAL", "The play surface is unavailable.", true);
    return;
  }

  const asset = ASSETS.get(String(req.params.asset));
  if (!asset) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }

  commonHeaders(res);
  res.setHeader("Content-Type", asset.type);
  res.sendFile(path.join(PLAY_ROOT, asset.file));
}
