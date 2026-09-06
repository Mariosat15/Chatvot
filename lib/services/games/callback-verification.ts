import crypto from "crypto";
import { WhiteLabel } from "@/database/models/whitelabel.model";

/**
 * Transport-level verification for provider callbacks (X3, gates 3-5 of chapter 06 s2).
 *
 * Split out of `result-ingestion.service.ts` to keep both files under the 500-line limit,
 * and because these are genuinely a different concern: nothing here knows what a round or a
 * score is. It answers one question - did this request really come from the provider we
 * think it did, recently enough to not be a replay.
 */

/*
 * The transport-header half now lives in `lib/services/game-providers/callback-headers.ts` and
 * is re-exported here so every existing importer is unchanged.
 *
 * Reason for the move: `lib/services/game-providers/` is mirrored into `apps/admin` and this
 * folder is not, and the ChartVolt Games adapter needs the timestamp rule. See that file for why
 * mirroring this one instead would have put `loadProviderSecrets` into the admin app with
 * nothing calling it.
 */
export {
  TIMESTAMP_WINDOW_MS,
  normaliseHeaders,
  checkTimestamp,
} from "../game-providers/callback-headers";
export type { TimestampCheck } from "../game-providers/callback-headers";

/**
 * Constant-time compare that cannot throw.
 *
 * Reason for the length check: `crypto.timingSafeEqual` THROWS when the two buffers differ
 * in length, so a short signature would produce a 500 rather than a rejection - and in a
 * route that reports errors, the difference between "500" and "401" is an oracle telling an
 * attacker their guess was at least the right shape.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export interface ProviderSecrets {
  callbackSecret?: string;
  previousCallbackSecret?: string;
  callbackToken?: string;
}

/**
 * Loads a provider's secrets, but only if the provider is actually enabled.
 *
 * Reason enablement is checked HERE rather than left to the caller: this is the function
 * that hands out the means to be trusted. Returning secrets for a disabled provider and
 * relying on somebody else to check the flag is precisely the shape of Prerequisite A,
 * where an auth helper accepted a request because configuration was missing.
 *
 * Requires `+gameProviderCredentials` because that field is `select: false`.
 */
export async function loadProviderSecrets(
  providerKey: string,
): Promise<ProviderSecrets | null> {
  const settings = await WhiteLabel.findOne()
    .select("+gameProviderCredentials externalGamesEnabled gameProviders")
    .lean<{
      externalGamesEnabled?: boolean;
      gameProviders?: { providerKey: string; enabled?: boolean }[];
      gameProviderCredentials?: {
        providerKey: string;
        apiKey?: string;
        callbackSecret?: string;
        previousCallbackSecret?: string;
      }[];
    }>();

  if (!settings?.externalGamesEnabled) return null;

  const entry = settings.gameProviders?.find((p) => p.providerKey === providerKey);
  if (!entry?.enabled) return null;

  const credentials = settings.gameProviderCredentials?.find(
    (c) => c.providerKey === providerKey,
  );

  return {
    callbackSecret: credentials?.callbackSecret,
    previousCallbackSecret: credentials?.previousCallbackSecret,
    callbackToken: credentials?.apiKey,
  };
}

/**
 * Verifies the HMAC over the RAW BODY BYTES.
 *
 * The raw bytes matter more than anything else in this file. A signature is computed over
 * exact bytes, and `JSON.parse` followed by re-serialisation does not reproduce them - key
 * order, whitespace and number formatting all shift. Verifying a re-serialised body fails
 * for valid requests and can be made to pass for crafted ones.
 *
 * Both the current and previous secret are accepted, because chapter 06 section 8 requires
 * rotation with no downtime: a callback signed moments before a rotation is still in flight
 * when the new secret lands, and rejecting it would discard a real score because of an
 * operational action the provider was never told about.
 */
export function verifyCallbackSignature(
  rawBody: string,
  providedSignature: string,
  secrets: ProviderSecrets,
): boolean {
  const candidates = [
    secrets.callbackSecret,
    secrets.previousCallbackSecret,
  ].filter((secret): secret is string => Boolean(secret));

  if (candidates.length === 0) return false;

  // Providers send `sha256=<hex>` (chapter 01 section 2.2). A bare hex is accepted too.
  const offered = providedSignature.startsWith("sha256=")
    ? providedSignature.slice(7)
    : providedSignature;

  return candidates.some((secret) =>
    safeEqual(
      offered,
      crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    ),
  );
}

/**
 * Extracts the provider's event id, which is the deduplication key.
 *
 * Header first, body second, and the order is a security property rather than a preference.
 * Reading the id from an unverified body would let a forged payload choose its own
 * deduplication key, and therefore replay a genuine score under a fresh id - defeating gate
 * 6 entirely. The body fallback exists for providers that only carry it there, and by the
 * time it is trusted the signature has already passed.
 */
export function extractEventId(
  headers: Map<string, string>,
  rawBody: string,
): string | null {
  const fromHeader = headers.get("x-event-id");
  if (fromHeader?.trim()) return fromHeader.trim();

  try {
    const parsed = JSON.parse(rawBody) as { eventId?: string };
    return parsed.eventId?.trim() || null;
  } catch {
    return null;
  }
}
