import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { loadConfig } from "../config";
import { sendError } from "./errors";

/**
 * Authenticates calls the platform makes to us (section 10, "calls from us to you").
 *
 * Three checks, in the order the specification lists them: a bearer API key we issued, a
 * timestamp no older than five minutes, and an HMAC-SHA256 over the raw request body bytes.
 *
 * THE SIGNATURE PROVES NOTHING ON A GET, AND THAT IS THE SPECIFICATION'S GAP
 * -------------------------------------------------------------------------
 * The signature basis is defined as "the raw request body bytes, exactly as sent". A `GET` has
 * no body, so the basis is the empty string, so the signature is a fixed value for a given
 * secret - the same on every GET, forever. Anyone who observes one can replay it indefinitely,
 * and `GET /v1/rounds/{roundId}` is the endpoint that discloses a round's score.
 *
 * This service implements the rule exactly as written anyway, and the reason is worth stating
 * because the alternative is tempting. Inventing a stronger basis - signing method, path and
 * timestamp - would mean the platform's generic outbound client no longer matches us, and a
 * provider that unilaterally redefines the signing scheme has not improved security, it has
 * broken the integration and blamed the document. The correct fix is a specification revision on
 * both sides, which is recorded as ambiguity A2 and is the kind of finding X4a exists to produce.
 *
 * What carries the weight in the meantime is the bearer token, which is secret, and the
 * timestamp, which bounds a replay to five minutes. Both are checked on every request including
 * GETs, so the endpoint is not unprotected - it is protected by two of the three mechanisms
 * rather than three.
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

function hmacHex(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
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
  const timestamp = checkTimestamp(req.header("x-timestamp"));
  if (!timestamp.ok) {
    sendError(res, 401, "TIMESTAMP_REJECTED", timestamp.why);
    return;
  }

  // ── signature over the raw bytes ──────────────────────────────────────────────────────────
  //
  // `rawBody` is captured by the JSON parser rather than re-serialised from `req.body`. A
  // signature is over exact bytes, and `JSON.parse` followed by `JSON.stringify` does not
  // reproduce them: key order, whitespace and number formatting all shift.
  const rawBody = req.rawBody ?? "";
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
  const matches = secrets.some((secret) => safeEqual(offered, hmacHex(rawBody, secret)));
  if (!matches) {
    sendError(res, 401, "SIGNATURE_INVALID", "Signature does not match the request body.");
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
