/**
 * The public base URL, or null.
 *
 * EXTRACTED FROM `round-launch.service.ts` UNCHANGED, because a challenge round launch needs
 * exactly the same value for exactly the same reason - it becomes the address a provider
 * posts a result and a progress report to. Two copies of this function would be the "one
 * rule, two copies" shape this codebase keeps finding: a competition contest and a challenge
 * disagreeing about which base URL is safe to hand a provider, discovered only when one of
 * them is wrong.
 *
 * Reason for refusing rather than defaulting to localhost: this value becomes the address
 * the provider posts every result to. A localhost fallback would let a misconfigured
 * deployment launch real rounds whose results can never arrive - the provider POSTs into
 * nothing, our reconciliation eventually writes the player off under the unresolved-round
 * policy, and the only visible symptom is players complaining their scores vanished.
 *
 * PRODUCTION ALSO REJECTS PLAIN HTTP AND LOOPBACK, and that is not belt-and-braces - it is
 * the same failure the paragraph above describes, reached by a value that looks configured.
 * Found live on 6 Sep 2026: a deployment had `NEXT_PUBLIC_BASE_URL=http://chartvolt.com/`
 * while the site served https.
 *
 *   - **Plain http.** Certbot installs an http -> https redirect as a matter of course, and a
 *     POST that follows a 301 is converted to a GET by the fetch specification. The result
 *     arrives at our route as a GET, is rejected, and the round is written off as unresolved.
 *     The callback token would also travel unencrypted on the way.
 *   - **Loopback.** The provider is a different process, and on a real integration a different
 *     company. `127.0.0.1` there means "post the result to yourself".
 *
 * Development is deliberately exempt, for the same reason `assertPlayableOrigin` in the games
 * service is: every local rehearsal and every test legitimately serves plain http on loopback,
 * and a guard that fired there would be switched off rather than fixed.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export function publicBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;

  const trimmed = raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Fails closed. A value the regex accepts but `URL` cannot parse is not one to hand a
    // provider as a callback address.
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (LOOPBACK_HOSTS.has(parsed.hostname)) return null;

  return trimmed;
}
