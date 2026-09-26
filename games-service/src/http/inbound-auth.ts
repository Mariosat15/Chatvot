import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { loadConfig } from "../config";
import { sendError } from "./errors";

/**
 * Authenticates calls the platform makes to us (section 10, "calls from us to you").
 *
 * Three checks, in the order the specification lists them: a bearer API key we issued, a
 * timestamp no older than five minutes, and an HMAC-SHA256 over the **canonical request string**
 * (requirements HTML v1.7 / ambiguity A2):
 *
 *   `{timestamp}.{METHOD}.{path}.{rawBody}`
 *
 * with `rawBody` empty for a GET. Before v1.7 the basis was the raw body alone, which made every
 * GET signature a constant for a given secret — replayable on any path forever. Callbacks from
 * us to ChartVolt still sign the raw body only; that direction always has a body.
 */

/** How stale a timestamp may be. The specification asks for five minutes. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Constant-time compare that cannot throw.
 *
 * `crypto.timingSafeEqual` throws when the buffers differ in length, so a short token would
 * produce a 500 instead of a 401 - and in a service that reports errors faithfully, the
 * difference between the two is an oracle telling an attacker their guess was the right shape.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hmacHex(material: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(material, "utf8").digest("hex");
}

/**
 * Same formula the platform's outbound client uses. Exported for harnesses and probes.
 *
 * Path is whatever follows the host (e.g. `/v1/games`), never a full URL — a Host rewrite at a
 * proxy must not invalidate a correctly signed request.
 */
export function outboundSigningMaterial(
  timestamp: string,
  method: string,
  path: string,
  rawBody: string,
): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${rawBody}`;
}

/** Express request with the raw body captured by the JSON parser's `verify` hook. */
export interface SignedRequest extends Request {
  rawBody?: string;
}

function checkTimestamp(header: string | undefined): { ok: true } | { ok: false; why: string } {
  if (!header) return { ok: false, why: "X-Timestamp header is missing." };

  const seconds = Number.parseInt(header, 10);
  if (!Number.isFinite(seconds)) {
    return { ok: false, why: "X-Timestamp is not a Unix seconds value." };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - seconds);
  if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    // Reason for `Math.abs`: a timestamp from the future is as wrong as an old one and is what
    // a clock-skewed caller or a crafted header produces. Checking only the past direction
    // leaves an unbounded replay window for anyone willing to set a large number.
    return { ok: false, why: `X-Timestamp is ${ageSeconds}s out of tolerance.` };
  }

  return { ok: true };
}

export function requirePlatformAuth(
  req: SignedRequest,
  res: Response,
  next: NextFunction,
): void {
  const config = loadConfig();

  // ── bearer key ────────────────────────────────────────────────────────────────────────────
  const offeredKey = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const keys = [config.inbound.apiKey, config.inbound.apiKeyPrevious].filter(
    (value): value is string => Boolean(value),
  );
  if (!offeredKey || !keys.some((key) => safeEqual(offeredKey, key))) {
    sendError(res, 401, "UNAUTHENTICATED", "API key missing or not recognised.");
    return;
  }

  // ── timestamp ─────────────────────────────────────────────────────────────────────────────
  const timestampHeader = req.header("x-timestamp");
  const timestamp = checkTimestamp(timestampHeader);
  if (!timestamp.ok) {
    sendError(res, 401, "TIMESTAMP_REJECTED", timestamp.why);
    return;
  }

  // ── signature over the canonical request string ───────────────────────────────────────────
  //
  // `rawBody` is captured by the JSON parser rather than re-serialised from `req.body`. A
  // signature is over exact bytes, and `JSON.parse` followed by `JSON.stringify` does not
  // reproduce them: key order, whitespace and number formatting all shift.
  //
  // Path is `originalUrl` so a mount at `/v1` still sees `/v1/games` — the same string the
  // platform put in the signed material. `req.url` alone would be `/games` and every call would
  // fail with SIGNATURE_INVALID while looking correctly configured.
  const rawBody = req.rawBody ?? "";
  const path = req.originalUrl || req.url || "";
  const material = outboundSigningMaterial(
    timestampHeader!,
    req.method,
    path,
    rawBody,
  );
  const offeredSignature = req.header("x-signature") ?? "";
  if (!offeredSignature) {
    sendError(res, 401, "SIGNATURE_INVALID", "X-Signature header is missing.");
    return;
  }

  // Both spellings are accepted: the specification's own example sends `sha256=<hex>`, and a
  // bare hex is what several client libraries produce by default.
  const offered = offeredSignature.startsWith("sha256=")
    ? offeredSignature.slice("sha256=".length)
    : offeredSignature;

  const secrets = [config.inbound.apiSecret, config.inbound.apiSecretPrevious].filter(
    (value): value is string => Boolean(value),
  );
  // Accepting both secrets is the rotation window the specification asks providers to support.
  const matches = secrets.some((secret) => safeEqual(offered, hmacHex(material, secret)));
  if (!matches) {
    sendError(res, 401, "SIGNATURE_INVALID", "Signature does not match the request.");
    return;
  }

  next();
}

/**
 * Signs an outbound callback the way the platform verifies it (section 10, "your calls to us").
 *
 * Returns the exact body string alongside the headers, and the caller must send that string
 * rather than re-serialising the object. Reason: this is the single most common integration
 * failure in signed webhooks - serialise once, sign that string, send that string. Returning
 * them together is what makes the mistake awkward to make.
 *
 * Callbacks still sign the **raw body only** — that direction always has a JSON body, so the
 * empty-GET gap never applies. Do not "unify" this onto the outbound canonical string without
 * amending the platform's callback verifier in the same change.
 */
export function signOutbound(payload: unknown): { body: string; headers: Record<string, string> } {
  const config = loadConfig();
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = hmacHex(body, config.outbound.callbackSecret);

  return {
    body,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.outbound.callbackToken}`,
      "X-Timestamp": timestamp,
      "X-Signature": `sha256=${signature}`,
    },
  };
}
