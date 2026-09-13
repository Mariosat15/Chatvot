/**
 * The transport headers of the provider protocol, and nothing else.
 *
 * Two functions that know about HTTP headers and clocks, and know nothing about rounds, scores
 * or secrets. They were extracted out of `lib/services/games/callback-verification.ts` when the
 * ChartVolt Games adapter needed the timestamp rule (X4a), and the location is the point:
 *
 *   `lib/services/game-providers/` is MIRRORED into `apps/admin`; `lib/services/games/` is not.
 *
 * The alternatives were both worse. Mirroring the whole of `callback-verification.ts` would put
 * `loadProviderSecrets` into the admin app, where nothing calls it - a dead helper that hands
 * out callback secrets, in the app with the widest privileges. That is the `shouldBlockEntry`
 * shape: a dead helper is an invitation, and the dangerous ones are the invitations that matter.
 * Writing a second copy of the five-minute window in the adapter would be the "one rule, two
 * copies" failure this codebase has already had four times, and the copies would agree on the
 * day they were written.
 *
 * So there is one definition, in the folder both apps get, and `callback-verification.ts`
 * re-exports it so no existing importer changes.
 */

/** Chapter 01 section 2.2. The provider is told we reject anything older than this. */
export const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Header lookup, case-insensitively.
 *
 * Reason for a Map rather than indexing the object: HTTP header names are case-insensitive and
 * different runtimes hand them over differently, so every lookup needs three attempts - and
 * indexing an object by a variable trips security/detect-object-injection, which the pre-commit
 * hook treats as fatal. Normalising once is cheaper and reads better than disabling the rule at
 * five call sites.
 */
export function normaliseHeaders(
  headers: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    map.set(key.toLowerCase(), value);
  }
  return map;
}

export type TimestampCheck = { valid: true } | { valid: false; reason: string };

/**
 * Rejects anything outside the five-minute window (chapter 01 section 2.2).
 *
 * Uses `X-Timestamp` and NEVER the body's `occurredAt`. Reason: `occurredAt` is inside the
 * payload and describes when the provider says the event happened - it is data, not transport.
 * Trusting it for replay protection lets a replayed body carry a fresh claim about its own age,
 * which defeats the entire check (chapter 06 section 2.1).
 *
 * The window is absolute, not one-sided: a timestamp far in the FUTURE is as suspicious as an
 * old one, and a one-sided check would accept a replay dated next year forever.
 */
export function checkTimestamp(
  timestampHeader: string | undefined,
  now: number = Date.now(),
): TimestampCheck {
  if (!timestampHeader) {
    return { valid: false, reason: "Timestamp header missing." };
  }

  const seconds = Number(timestampHeader);
  if (!Number.isFinite(seconds)) {
    return { valid: false, reason: "Timestamp is not a number." };
  }

  const skew = Math.abs(now - seconds * 1000);
  if (skew > TIMESTAMP_WINDOW_MS) {
    return {
      valid: false,
      reason: `Timestamp outside the accepted window by ${Math.round(skew / 1000)}s.`,
    };
  }

  return { valid: true };
}
