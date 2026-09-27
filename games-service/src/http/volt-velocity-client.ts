import crypto from "crypto";
import fs from "fs";
import path from "path";

import type { Request, Response } from "express";

import { loadConfig, type VelocityConfig } from "../config";
import { VOLT_VELOCITY_CODE } from "../games/titles-codes";
import { sendError } from "./errors";

/**
 * The Volt Velocity play surface: a small host page of ours, and the race client beside it.
 *
 * THE CLIENT IS NOT OURS TO EDIT
 * ------------------------------
 * The game's own toolchain emits one ~100 MB HTML document with every model, texture, sky and
 * soundtrack inlined as base64. It is kept, gzipped, as `vendor/volt-velocity-client.html.gz`, but
 * it is no longer SERVED: `tools/games/pack-velocity-client.ts` splits it into
 * `vendor/volt-velocity/` - a ~1 MB `client.html` whose asset literals point at
 * `assets/<content-hash>.<ext>`, the assets themselves (oversized textures resized), and a
 * `manifest.json`. Owner decision, 27 Sep 2026: players were re-downloading 100 MB on every visit
 * because no browser will cache one response that large (Firefox's per-entry limit is 50 MB), and
 * base64 alone added a third. `VELOCITY_CLIENT_FILE` still overrides the page; when no page is
 * found the session refuses with GAME_UNAVAILABLE rather than handing out a URL that 404s.
 *
 * WHY THE PAGE URL IS FINGERPRINTED AND THE ASSETS ARE NOT
 * --------------------------------------------------------
 * Asset names ARE their content hash, so they are `immutable` by construction. The page is served
 * `immutable` only under a segment derived from its own bytes - which cover every asset name - so
 * a re-pack is a new URL. An unrecognised fingerprint is still SERVED (with `no-cache`) rather than
 * refused, for R55's reason: a player mid-lobby holding the previous URL after a deploy should get
 * a working race, not a 404 their browser then caches.
 *
 * WHY THE CLIENT'S FRAME POLICY NAMES 'self'
 * -----------------------------------------
 * `frame-ancestors` is checked against every ancestor, and the client's immediate parent is our
 * own host page, so a configured list gains 'self'. With no list configured nothing is sent,
 * because 'self' alone would refuse the platform - also an ancestor - in subdomain mode.
 */

const HOST_ROOT_CANDIDATES = [
  path.resolve(__dirname, "..", "..", "public", "play", "volt-velocity"),
  path.resolve(__dirname, "..", "..", "..", "public", "play", "volt-velocity"),
];

const HOST_ROOT =
  HOST_ROOT_CANDIDATES.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ??
  null;

/** The two files of ours, by exact name. Anything else is a 404. */
const HOST_FILES = new Map<string, string>([
  ["index.html", "text/html; charset=utf-8"],
  ["velocity-host.js", "text/javascript; charset=utf-8"],
]);

const FINGERPRINT = /^[a-f0-9]{16}\.html$/;

/** The only names the asset route answers: the pack tool's `<16 hex>.<ext>`, nothing else. */
const ASSET_NAME = /^[a-f0-9]{16}\.(webp|png|glb|hdr|ogg|mp3)$/;

const ASSET_TYPES = new Map<string, string>([
  ["webp", "image/webp"],
  ["png", "image/png"],
  ["glb", "model/gltf-binary"],
  ["hdr", "image/vnd.radiance"],
  ["ogg", "audio/ogg"],
  ["mp3", "audio/mpeg"],
]);

/**
 * Fallback soundtracks: the client asks for the `.ogg` and only a browser that cannot play Ogg
 * falls back to these, so the warm-up must not spend 7 MB of everybody's data on them.
 */
const WARMUP_SKIPPED_EXTENSIONS = new Set(["mp3"]);

const PACKED_DIR =
  [
    path.resolve(__dirname, "..", "..", "vendor", "volt-velocity"),
    path.resolve(__dirname, "..", "..", "..", "vendor", "volt-velocity"),
  ].find((candidate) => fs.existsSync(path.join(candidate, "client.html"))) ?? null;

const ASSET_DIR = PACKED_DIR ? path.join(PACKED_DIR, "assets") : null;

function hostHeaders(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-cache");
}

function resolveClientFile(velocity: VelocityConfig): string | null {
  return velocity.clientFile ?? (PACKED_DIR ? path.join(PACKED_DIR, "client.html") : null);
}

/** Content fingerprints, recomputed only when a file's size or mtime moves. */
const fingerprintCache = new Map<string, { key: string; fingerprint: string }>();

function clientFingerprint(velocity: VelocityConfig): string | null {
  const file = resolveClientFile(velocity);
  if (!file) return null;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    const key = `${stat.size}:${stat.mtimeMs}`;
    const cached = fingerprintCache.get(file);
    if (cached?.key === key) return cached.fingerprint;
    // Reason: hash the BYTES, not size+mtime - a `git pull` gives identical bytes a different
    // mtime on every server, which would send each player a "new" 1 MB page per server per deploy.
    const fingerprint = crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex")
      .slice(0, 16);
    fingerprintCache.set(file, { key, fingerprint });
    return fingerprint;
  } catch {
    return null;
  }
}

/** Where the browser loads the client from, or null when no client is installed. */
export function clientUrlFor(velocity: VelocityConfig): string | null {
  const fingerprint = clientFingerprint(velocity);
  return fingerprint ? `/play/volt-velocity/client/${fingerprint}.html` : null;
}

let manifestCache: { mtimeMs: number; files: string[] } | null = null;

/** The packed asset names the warm-up should fetch, from `manifest.json`. Empty when unpacked. */
function warmupAssetFiles(velocity: VelocityConfig): string[] {
  // An overriding single-file build carries its assets inline; the packed set is not its own.
  if (velocity.clientFile || !PACKED_DIR) return [];
  const manifest = path.join(PACKED_DIR, "manifest.json");
  try {
    const { mtimeMs } = fs.statSync(manifest);
    if (manifestCache?.mtimeMs === mtimeMs) return manifestCache.files;
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      assets?: Array<{ file?: unknown }>;
    };
    const files = (parsed.assets ?? [])
      .map((entry) => entry.file)
      .filter((file): file is string => typeof file === "string" && ASSET_NAME.test(file))
      .filter((file) => !WARMUP_SKIPPED_EXTENSIONS.has(file.slice(file.lastIndexOf(".") + 1)));
    manifestCache = { mtimeMs, files };
    return files;
  } catch (error) {
    console.warn("⚠️ [velocity] could not read the packed client manifest:", error);
    return [];
  }
}

export function serveVelocityHost(req: Request, res: Response): void {
  const raw = typeof req.params.file === "string" ? req.params.file : "index.html";
  const type = HOST_FILES.get(raw);
  if (!HOST_ROOT || !type) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }
  hostHeaders(res);
  res.setHeader("Content-Type", type);
  res.sendFile(path.join(HOST_ROOT, raw));
}

/**
 * `GET /play/warmup/:gameCode` - lets the platform start the heavy download while a seated
 * player is still on the lobby, so pressing Play does not sit on "Loading the race client…".
 *
 * Game-agnostic from the platform's side: it sends whatever game code the contest carries, and a
 * title with nothing heavy to fetch answers 204. For Volt Velocity it answers
 * `{ urls: [...] }` - the CURRENT client page, then its assets - every one `immutable`, so the
 * browser's cache then answers the race. The list itself is `no-store`, or a cached list would
 * name last deploy's page.
 */
export function serveClientWarmup(req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  const velocity = loadConfig().velocity;
  const clientUrl =
    req.params.gameCode === VOLT_VELOCITY_CODE && velocity ? clientUrlFor(velocity) : null;
  if (!clientUrl || !velocity) {
    res.status(204).end();
    return;
  }
  const urls = [
    clientUrl,
    ...warmupAssetFiles(velocity).map((file) => `/play/volt-velocity/client/assets/${file}`),
  ];
  res.status(200).json({ urls });
}

export function serveVelocityClient(req: Request, res: Response): void {
  const velocity = loadConfig().velocity;
  const file = velocity ? resolveClientFile(velocity) : null;
  const fingerprint = velocity ? clientFingerprint(velocity) : null;
  const requested = typeof req.params.fingerprint === "string" ? req.params.fingerprint : "";
  if (!file || !fingerprint || !FINGERPRINT.test(requested)) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }

  // Unset means "embeddable anywhere" service-wide, so send nothing; set means the same list
  // plus 'self' for our host page. The global middleware already wrote the list without it.
  const ancestors = loadConfig().frameAncestors;
  if (ancestors) {
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${ancestors}`);
  } else {
    res.removeHeader("Content-Security-Policy");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    requested === `${fingerprint}.html` ? "public, max-age=31536000, immutable" : "no-cache",
  );
  res.sendFile(path.resolve(file));
}

/**
 * `GET /play/volt-velocity/client/assets/:file` - one packed asset. The name is only ever tested
 * against `ASSET_NAME` and joined to a fixed directory, so no request string can reach a path of
 * its choosing. Content-hashed, hence `immutable`.
 */
export function serveVelocityAsset(req: Request, res: Response): void {
  const name = typeof req.params.file === "string" ? req.params.file : "";
  const type = ASSET_NAME.test(name)
    ? ASSET_TYPES.get(name.slice(name.lastIndexOf(".") + 1))
    : undefined;
  const file = ASSET_DIR && type ? path.join(ASSET_DIR, name) : null;
  if (!file || !type || !fs.existsSync(file)) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(file);
}
