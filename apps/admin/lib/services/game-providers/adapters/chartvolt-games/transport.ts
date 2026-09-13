import crypto from "crypto";

import type { ProviderResult } from "../../contract";
import type { ProviderConnection } from "./connection";

/**
 * The signed request, and what to make of the answer (chapter 01 sections 2.1 and 6a).
 *
 * Three headers on every call: a bearer API key, a Unix-seconds timestamp, and an HMAC-SHA256
 * over the raw body bytes. The provider rejects a timestamp more than five minutes old.
 */

/** The provider's own timeout expectation, applied in the direction we control. */
const REQUEST_TIMEOUT_MS = 10_000;

interface CallOptions {
  connection: ProviderConnection;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

/**
 * Serialise once, sign that string, send that string.
 *
 * This is the single most common way a signed integration fails, and it fails in the most
 * expensive way: the signature is computed over one byte sequence and a different one is sent,
 * because `JSON.stringify` was called twice and key order or number formatting shifted between
 * them. Every valid request is then rejected as forged. Returning the body and the headers
 * together is what makes that mistake awkward to write.
 */
function sign(
  connection: ProviderConnection,
  body: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", connection.apiSecret)
    .update(body, "utf8")
    .digest("hex");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connection.apiKey}`,
    "X-Timestamp": timestamp,
    "X-Signature": `sha256=${signature}`,
  };
}

interface ProviderErrorBody {
  error?: { code?: string; message?: string; retryable?: boolean };
}

/**
 * Whether it is worth trying again.
 *
 * THE PROVIDER'S OWN FLAG WINS WHEN IT IS PRESENT, and that is contractual rather than polite -
 * chapter 01 section 6a makes it authoritative. Only when it is absent do we fall back to the
 * status code, and the mapping is chosen by what the retry would achieve:
 *
 *   401 / 403   NOT retryable. Retrying a credential failure multiplies the 401s and delays the
 *               only fix, which is an operator correcting a key.
 *   404         NOT retryable. The round or the game does not exist and will not appear.
 *   409 / 422   NOT retryable. A conflict or an impossible value is a decision, not a fault.
 *   429 / 5xx   Retryable.
 *
 * A 4xx we have not enumerated is treated as NOT retryable, which is the fail-closed direction
 * for this particular question: retrying a request the provider has already refused on its
 * merits is how a client turns its own bug into an outage on somebody else's service.
 */
function retryableFor(status: number, declared: boolean | undefined): boolean {
  if (typeof declared === "boolean") return declared;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

/**
 * Makes one call and returns a result object. Never throws.
 *
 * A provider is a network dependency that WILL fail, and chapter 07 section 1 requires its
 * failure to degrade the experience without ever corrupting money - which is impossible to
 * guarantee if a failure can arrive as an exception from an arbitrary depth.
 */
export async function call<T>(options: CallOptions): Promise<ProviderResult<T>> {
  const { connection, method, path, body } = options;

  // An empty string, not "undefined" and not "{}". The provider signs the raw bytes it
  // received, so a GET must be signed over exactly nothing.
  const serialised = body === undefined ? "" : JSON.stringify(body);
  const headers = sign(connection, serialised);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  let text: string;
  try {
    response = await fetch(`${connection.baseUrl}${path}`, {
      method,
      headers,
      body: method === "GET" ? undefined : serialised,
      signal: controller.signal,
      // Reason: a provider response must never be served from a cache. A cached round state
      // during reconciliation is a stale answer to the one question that decides a payout.
      cache: "no-store",
    });
    text = await response.text();
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: timedOut
        ? `Provider did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
        : "Provider is unreachable.",
      code: timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNREACHABLE",
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let parsed: ProviderErrorBody = {};
    try {
      parsed = JSON.parse(text) as ProviderErrorBody;
    } catch {
      // A non-JSON error body is itself a finding, and the reason chapter 01 section 14 asks
      // for JSON always: an HTML error page forces the caller to guess what went wrong. It is
      // not fatal here - the status code still carries the retry decision.
      parsed = {};
    }

    return {
      success: false,
      error:
        parsed.error?.message ??
        `Provider returned HTTP ${response.status}.`,
      code: parsed.error?.code ?? `HTTP_${response.status}`,
      retryable: retryableFor(response.status, parsed.error?.retryable),
    };
  }

  try {
    return { success: true, data: JSON.parse(text) as T };
  } catch {
    return {
      success: false,
      error: "Provider returned a success status with an unreadable body.",
      code: "MALFORMED_RESPONSE",
      // Retryable: a truncated response is far more often a transient fault than a permanent
      // one, and the alternative loses a round that may well have been created.
      retryable: true,
    };
  }
}
