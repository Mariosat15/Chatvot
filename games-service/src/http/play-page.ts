import fs from "fs";
import path from "path";

import type { Request, Response } from "express";

import { sendError } from "./errors";

/**
 * The document the platform's iframe loads, and the assets beside it.
 *
 * TWO NAMED ROUTES RATHER THAN `express.static`
 * --------------------------------------------
 * A static middleware mounted on `/play` would sit in front of `/play/api/*`, and it would follow
 * subdirectories and serve whatever else ever lands under them. This surface is reached by an
 * unauthenticated browser holding a launch token, so the two explicit routes are worth keeping:
 * `/play` serves the document, `/play/:asset` serves one top-level file whose type we recognise,
 * and everything else falls through to the JSON 404.
 *
 * The served set used to be four filenames written out below. It is now read from the directory
 * at boot, because a compiled list of filenames and the directory it describes are two things
 * that have to be deployed together, and on 8 September 2026 they were not - see the long note on
 * `readServableAssets`. The security properties that list provided are unchanged and are listed
 * there too; the one worth repeating here is that the request string is only ever a `Map` key and
 * never a path component.
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

/**
 * THE SERVED SET IS READ FROM THE DIRECTORY, NOT LISTED HERE. THIS IS THE SECOND DESIGN.
 *
 * It was a hand-written list of four filenames until 8 September 2026, and that list is what took
 * the game down twice in two days. `public/play` arrives with a `git pull`; a list compiled into
 * TypeScript only changes when `npm run build` runs. Pull without building and the service is the
 * old code serving the new front end, so `presentation.js` sits on disk, is imported by `app.js`,
 * and is answered with a JSON 404 - and an ES module that 404s takes its importer down with it, so
 * NOTHING evaluates. The page holds its own boot spinner, never posts `ready`, and no request has
 * failed from anybody's point of view.
 *
 * WHY THE BOOT AUDIT BELOW WAS NOT THE FIX, WHICH IS THE PART WORTH CARRYING. The audit added
 * earlier the same day detects exactly this drift and names the file. It could never have fired:
 * IT LIVES IN THE BUILD IT EXISTS TO WARN ABOUT. A guard shipped in the artifact whose staleness
 * it reports is a guard that is absent in precisely the state it was written for - the same shape
 * as a comment asserting a check that does not run, except that the code is real and unreachable.
 *
 * So the coupling is removed rather than monitored. Two things must ship together for a filename
 * list; one thing cannot disagree with itself.
 *
 * WHAT STILL MAKES THIS SAFE, because a browser reaches it unauthenticated with only a launch
 * token, and `express.static` was rejected for this route for good reasons that all still hold:
 *
 * - The request string is used ONLY as a `Map` key. The path component handed to `sendFile` comes
 *   from `readdirSync`, so `../` and its encoded forms cannot become a path however they arrive.
 *   That property is what the old allowlist bought, and it is unchanged.
 * - Still a `Map`, not an object literal. `in` and object indexing walk the prototype chain, so
 *   `"__proto__"` and `"toString"` pass a naive guard and return something truthy - found in this
 *   platform's admin round inspector on 5 September 2026, and twice more since.
 * - Top-level regular files only. No recursion, so nothing nested is reachable, and a directory
 *   cannot be mistaken for a file.
 * - `index.html` is excluded because it has its own route.
 * - An EXTENSION allowlist, so a stray `.env`, `.ts`, `.map` or editor backup in the directory is
 *   not servable. This is the one rule that can still refuse a file somebody expected to serve,
 *   which is why the boot audit below now reports exactly that case.
 *
 * READ ONCE AT BOOT, not per request. A `readdirSync` on an unauthenticated route is a syscall an
 * anonymous caller can repeat; and picking up a new file needs a restart, which every deploy does
 * anyway. The point of the change is that it no longer needs a BUILD.
 */
const CONTENT_TYPES = new Map<string, string>([
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

export function readServableAssets(
  entries: readonly { name: string; isFile: () => boolean }[],
): Map<string, { file: string; type: string }> {
  const assets = new Map<string, { file: string; type: string }>();

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    /*
     * Reason: `index.html` is served by `servePlayPage`, which sets its own content type. Listing
     * it here would give the document a second route reachable as `/play/index.html`.
     *
     * THIS LINE CANNOT CURRENTLY FIRE, and it is kept rather than deleted. `.html` is not in
     * `CONTENT_TYPES`, so the extension check below already refuses the document - a probe
     * removing this line stayed green, which is what exposed it. It stays because the property is
     * held somewhere unobvious: the moment anybody adds `.html` to that table, for a rules page
     * or a second screen, this becomes the only thing keeping the document off the asset route.
     * The comment says it is a tripwire rather than the test pretending it holds a property it
     * cannot lose - an overstated guard is a wrong fact, the same duty as correcting a risk
     * downward.
     */
    if (entry.name === "index.html") continue;

    const type = CONTENT_TYPES.get(path.extname(entry.name).toLowerCase());
    if (!type) continue;

    assets.set(entry.name, { file: entry.name, type });
  }

  return assets;
}

const ASSETS: Map<string, { file: string; type: string }> = PLAY_ROOT
  ? readServableAssets(fs.readdirSync(PLAY_ROOT, { withFileTypes: true }))
  : new Map();

/**
 * Files that look like part of a front end, whether or not this service can serve them.
 *
 * Broader than the content-type table on purpose: the gap between the two is what the boot audit
 * reports. A `game.wasm` dropped into the directory is plainly meant to be served and will 404,
 * and that is now the only way a file can be present and unreachable. `.map` is deliberately
 * absent - a source map 404 harms nothing and warning about it would train operators to ignore
 * the message.
 */
const PLAUSIBLE_ASSET = /\.(js|css|svg|png|webp|woff2|wasm|json|gif|jpe?g|ico|ttf|otf|woff|mp3|ogg)$/i;

export interface PlaySurfaceAudit {
  /** On disk, and nothing in this build will serve them. */
  unserved: string[];
  /** Promised by this build, and absent from disk. */
  missing: string[];
}

/**
 * Compare the files on disk against the files this service will serve.
 *
 * WHAT THIS STILL CATCHES AFTER THE ALLOWLIST WAS REMOVED, because the honest answer is "less
 * than it was written for, and the remainder is worth keeping":
 *
 * - `unserved` now means ONE thing: a file that looks like a front-end asset and whose extension
 *   is not in `CONTENT_TYPES`. That is the only remaining way to put a file in this directory and
 *   have it be unreachable, and it is silent without this.
 * - `missing` is now STRUCTURALLY IMPOSSIBLE, because the served set is derived from the same
 *   directory listing this compares against. It is kept as a tripwire rather than deleted: it
 *   becomes reachable again the moment anybody reintroduces a hand-written list, which is exactly
 *   the change this file exists to argue against. The comment says so rather than the assertion
 *   pretending to hold a property it cannot lose - an overstated guard is a wrong fact.
 *
 * WHY A RUNTIME CHECK WHEN A TEST ALREADY COVERS THIS
 * --------------------------------------------------
 * `every module the play surface imports is served` walks the real import graph and would catch a
 * module added without an allowlist entry. It passes, and it passed on the day the play surface
 * broke in production - because it can only ever test ONE REVISION, and the fault is a
 * disagreement BETWEEN revisions.
 *
 * `public/play` is plain files that arrive with a `git pull`. The allowlist authorising them is
 * TypeScript that only exists once `npm run build` has run. Pull without building and the running
 * service is the old code serving the new front end, so `presentation.js` is on disk, imported by
 * `app.js`, and answered with a JSON 404. The browser then fails to evaluate the importer as well,
 * so nothing runs at all: the page sits on its own boot spinner, never posts `ready`, and the
 * player watches a loading state for ever. No request fails from the platform's point of view and
 * nothing appears in any log.
 *
 * Exactly that happened on 8 September 2026 - a 6 September build serving a 7 September surface.
 * The general rule is the one this codebase already applies to `check:mirrors`: a green guard
 * proves two copies agree IN THE REPOSITORY, never that the two halves of a running deployment
 * agree with each other. Only the deployment can answer that, so it has to answer at boot.
 *
 * BOTH INPUTS ARE INJECTED, AND THE SECOND ONE MATTERS MORE THAN IT LOOKS. Reading `ASSETS` from
 * module scope here would leave this only half pure: every unit test would then be coupled to the
 * real allowlist, so removing one entry turns five tests red at once and each test stops being able
 * to say which rule it holds. The probes are what exposed that - a one-line change with a blast
 * radius of five is the harness telling you the seam is in the wrong place.
 */
export function auditPlaySurface(
  filesOnDisk: readonly string[],
  servedFiles: readonly string[],
): PlaySurfaceAudit {
  const servable = new Set(servedFiles);
  const present = new Set(filesOnDisk);

  return {
    unserved: filesOnDisk
      .filter((file) => PLAUSIBLE_ASSET.test(file) && !servable.has(file))
      .sort(),
    missing: [...servable].filter((file) => !present.has(file)).sort(),
  };
}

/** The files this build will actually serve, for the boot audit and for its test. */
export function servedFileNames(): string[] {
  return [...ASSETS.values()].map((asset) => asset.file);
}

/**
 * Report any drift, loudly, once, at boot.
 *
 * It does NOT refuse to start, for the same reason `resolvePlayRoot` does not: creating rounds and
 * - above all - the sweeper delivering results for rounds already in flight all work without these
 * files. Refusing to boot would turn a broken play surface into a contest that cannot settle,
 * which is the worse of the two failures.
 */
function reportPlaySurfaceDrift(root: string): void {
  let audit: PlaySurfaceAudit;
  try {
    audit = auditPlaySurface(fs.readdirSync(root), servedFileNames());
  } catch (error) {
    console.error("❌ [games-service] could not read the play surface directory:", error);
    return;
  }

  if (audit.unserved.length > 0) {
    console.error(
      `❌ [games-service] public/play holds ${audit.unserved.join(", ")}, whose file type this ` +
        "service will not serve. If any of them is imported by the play surface the game cannot " +
        "boot at all, and the player sees only a loading spinner. Add the extension to " +
        "CONTENT_TYPES in src/http/play-page.ts.",
    );
  }

  if (audit.missing.length > 0) {
    // Reason: unreachable while the served set is derived from this same directory. See the
    // tripwire note on `auditPlaySurface` - if this ever prints, a hand-written file list has
    // come back.
    console.error(
      `❌ [games-service] this build serves ${audit.missing.join(", ")}, which are NOT on ` +
        "disk. The play surface will answer a 404 for them.",
    );
  }
}

if (PLAY_ROOT) reportPlaySurfaceDrift(PLAY_ROOT);

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
