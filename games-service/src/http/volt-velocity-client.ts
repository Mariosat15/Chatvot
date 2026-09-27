import crypto from "crypto";
import fs from "fs";
import path from "path";

import type { Request, Response } from "express";

import { loadConfig, type VelocityConfig } from "../config";
import { sendError } from "./errors";

/**
 * The Volt Velocity play surface: a small host page of ours, and the race client beside it.
 *
 * THE CLIENT IS NOT IN THIS REPOSITORY
 * -----------------------------------
 * It is a single ~100 MB self-contained HTML document built by the game's own toolchain, far too
 * large to commit and not ours to edit. The operator points `VELOCITY_CLIENT_FILE` at it; this
 * module streams it. When the variable is unset or the file is missing, the session refuses with
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

function clientStat(velocity: VelocityConfig): fs.Stats | null {
  if (!velocity.clientFile) return null;
  try {
    const stat = fs.statSync(velocity.clientFile);
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

export function serveVelocityClient(req: Request, res: Response): void {
  const velocity = loadConfig().velocity;
  const stat = velocity ? clientStat(velocity) : null;
  const requested = typeof req.params.fingerprint === "string" ? req.params.fingerprint : "";
  if (!velocity?.clientFile || !stat || !FINGERPRINT.test(requested)) {
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
  res.sendFile(path.resolve(velocity.clientFile));
}
