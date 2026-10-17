/**
 * Serve the Volt Stack play surface from `public/play/volt-stack/`.
 *
 * Separate from Circuit's fingerprinted `/play` routes so relative imports (`./game.js`)
 * resolve under `/play/volt-stack/` and never collide with Circuit's asset Map.
 *
 * Path safety: the request path is joined under a resolved root and then checked with
 * `path.relative` — anything that escapes the root is refused. Nested assets (fonts) are
 * allowed; directory listings are not.
 */

import fs from "fs";
import path from "path";

import type { Request, Response } from "express";

import { sendError } from "./errors";

function resolveVoltStackRoot(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "..", "public", "play", "volt-stack"),
    path.resolve(__dirname, "..", "..", "..", "public", "play", "volt-stack"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  return null;
}

const ROOT = resolveVoltStackRoot();

const CONTENT_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ogg", "audio/ogg"],
  // Reason: soundtrack FLACs live under assets/audio/. Without this entry the
  // extension allow-list 404s a present file and music never loads (owner, 27 Sep 2026).
  [".flac", "audio/flac"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
]);

function commonHeaders(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-cache");
}

function resolveUnderRoot(relativePath: string): string | null {
  if (!ROOT) return null;
  const normalised = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!normalised || normalised.includes("\0")) return null;
  const absolute = path.resolve(ROOT, normalised);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolute;
}

export function serveVoltStackPage(_req: Request, res: Response): void {
  if (!ROOT) {
    sendError(res, 500, "INTERNAL", "The Volt Stack play surface is unavailable.", true);
    return;
  }
  const file = path.join(ROOT, "index.html");
  commonHeaders(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(file);
}

export function serveVoltStackAsset(req: Request, res: Response): void {
  if (!ROOT) {
    sendError(res, 500, "INTERNAL", "The Volt Stack play surface is unavailable.", true);
    return;
  }

  // Express 4 splat: `/play/volt-stack/*` → req.params[0]
  const raw = typeof req.params[0] === "string" ? req.params[0] : "";
  if (!raw || raw === "index.html") {
    serveVoltStackPage(req, res);
    return;
  }

  const absolute = resolveUnderRoot(raw);
  if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }

  const type = CONTENT_TYPES.get(path.extname(absolute).toLowerCase());
  if (!type) {
    sendError(res, 404, "NOT_FOUND", "No such asset.");
    return;
  }

  commonHeaders(res);
  res.setHeader("Content-Type", type);
  res.sendFile(absolute);
}
