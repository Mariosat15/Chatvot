import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";

import type { Request, Response } from "express";

import { loadConfig, type VelocityConfig } from "../config";
import { VOLT_VELOCITY_CODE } from "../games/titles-codes";
import { sendError } from "./errors";

/**
 * The Volt Velocity play surface: a small host page of ours, and the race client beside it.
 *
 * THE CLIENT IS NOT IN THIS REPOSITORY
 * -----------------------------------
 * It is a single ~100 MB self-contained HTML document built by the game's own toolchain, not ours
 * to edit. It ships gzipped (~76 MB, under GitHub's 100 MB limit) as
 * `games-service/vendor/volt-velocity-client.html.gz` and is unpacked on first use (owner decision,
 * 27 Sep 2026: installing it by hand was too many steps). `VELOCITY_CLIENT_FILE` still overrides
 * it. When neither yields a file, the session refuses with
 * GAME_UNAVAILABLE rather than handing the browser a URL that 404s halfway through a lobby.
 *
 * WHY A FINGERPRINTED PATH SEGMENT
 * --------------------------------
 * One hundred megabytes must not be re-downloaded on every launch, so it is served
 * `immutable` - which is only safe when a new build gets a new URL. The segment is derived from
 * the file's size and modification time. An unrecognised fingerprint is still SERVED (with
 * `no-cache`) rather than refused, for R55's reason: a player mid-lobby holding the previous URL
 * after a deploy should get a working race, not a 404 their browser then caches.
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

function hostHeaders(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-cache");
}

const BUNDLED_NAME = "volt-velocity-client.html";
const BUNDLED_CANDIDATES = [
  path.resolve(__dirname, "..", "..", "vendor"),
  path.resolve(__dirname, "..", "..", "..", "vendor"),
];

function sameMtime(file: string, mtimeMs: number): boolean {
  try {
    return Math.floor(fs.statSync(file).mtimeMs / 1000) === Math.floor(mtimeMs / 1000);
  } catch {
    return false;
  }
}

/**
 * The client shipped in the repository as `vendor/volt-velocity-client.html.gz`, unpacked beside
 * itself on first use so `git pull` + restart is the whole install. Re-unpacked when the archive
 * changes. `VELOCITY_CLIENT_FILE`, when set, wins.
 */
function bundledClientFile(): string | null {
  const dir = BUNDLED_CANDIDATES.find((candidate) =>
    fs.existsSync(path.join(candidate, `${BUNDLED_NAME}.gz`)),
  );
  if (!dir) return null;
  const gz = path.join(dir, `${BUNDLED_NAME}.gz`);
  const html = path.join(dir, BUNDLED_NAME);
  try {
    const { mtime, mtimeMs } = fs.statSync(gz);
    // Reason: the unpacked copy carries the archive's mtime, so the fingerprint (size + mtime)
    // survives restarts and players are not made to re-download 100 MB after every deploy.
    if (sameMtime(html, mtimeMs)) return html;
    // Write to a temp name and rename, so a request arriving mid-unpack never streams half a
    // file under a fingerprint that is then cached as immutable for a year.
    const temp = `${html}.${process.pid}.tmp`;
    fs.writeFileSync(temp, zlib.gunzipSync(fs.readFileSync(gz)));
    fs.utimesSync(temp, mtime, mtime);
    fs.renameSync(temp, html);
    return html;
  } catch (error) {
    console.error("❌ [velocity] could not unpack the bundled race client:", error);
    return null;
  }
}

function resolveClientFile(velocity: VelocityConfig): string | null {
  return velocity.clientFile ?? bundledClientFile();
}

function clientStat(velocity: VelocityConfig): fs.Stats | null {
  const file = resolveClientFile(velocity);
  if (!file) return null;
  try {
    const stat = fs.statSync(file);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

function fingerprintOf(stat: fs.Stats): string {
  return crypto
    .createHash("sha256")
    .update(`${stat.size}:${Math.floor(stat.mtimeMs)}`)
    .digest("hex")
    .slice(0, 16);
}

/** Where the browser loads the client from, or null when no client is installed. */
export function clientUrlFor(velocity: VelocityConfig): string | null {
  const stat = clientStat(velocity);
  if (!stat) return null;
  return `/play/volt-velocity/client/${fingerprintOf(stat)}.html`;
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
 * title with nothing heavy to fetch answers 204. For Volt Velocity it redirects to the CURRENT
 * fingerprinted client, which is `immutable`, so the browser's cache then answers the frame.
 * The redirect itself is `no-store`, or a cached redirect would point at last deploy's build.
 */
export function serveClientWarmup(req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  const velocity = loadConfig().velocity;
  const url =
    req.params.gameCode === VOLT_VELOCITY_CODE && velocity ? clientUrlFor(velocity) : null;
  if (!url) {
    res.status(204).end();
    return;
  }
  res.redirect(302, url);
}

export function serveVelocityClient(req: Request, res: Response): void {
  const velocity = loadConfig().velocity;
  const file = velocity ? resolveClientFile(velocity) : null;
  const stat = velocity ? clientStat(velocity) : null;
  const requested = typeof req.params.fingerprint === "string" ? req.params.fingerprint : "";
  if (!file || !stat || !FINGERPRINT.test(requested)) {
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
    requested === `${fingerprintOf(stat)}.html`
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
  res.sendFile(path.resolve(file));
}
