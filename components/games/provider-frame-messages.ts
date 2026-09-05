/**
 * The only four things a provider's game may tell the browser, and what we do about them.
 *
 * THE WHOLE FILE EXISTS TO MAKE ONE RULE UNMISSABLE: **a score never arrives this way.**
 * `ChartVolt-Game-API-Requirements.html` section 7 states it to providers as "we will ignore
 * any score arriving from the browser. Scores decide real money and are accepted only from
 * your servers, signed." A `postMessage` is attacker-controlled by construction - the player
 * has a developer console, and anything the frame can send, they can send. So the payload
 * type below has **no score field at all**, which is stronger than remembering not to read
 * one: there is nothing to read.
 *
 * `finished` is therefore not "the player scored X". It means "stop showing the game and go
 * ask the server whether a result landed". The real result comes from the provider's servers
 * to the signed callback at `/api/games/providers/[providerKey]/events`.
 *
 * KEPT MODEL-FREE AND FRAMEWORK-FREE ON PURPOSE, so both the client component and the tests
 * import the same list. This is the "one rule, two copies" trap that has produced four
 * defects in this codebase already - `referenceId`, `failedReason`, `challengeId` and the
 * Game Master `||` - none of which `check:mirrors` can see, because it compares models.
 */

/** Every message type we act on. Anything else is ignored. */
export const PROVIDER_FRAME_MESSAGE_TYPES = [
  /** The game has loaded and is interactive. Lets us drop our own loading state. */
  "ready",
  /** The round reached a terminal state. A cue to poll, never a result. */
  "finished",
  /** The player asked to leave. We return them to the contest. */
  "exit",
  /** The game wants a different height. Advisory, and clamped. */
  "resize",
] as const;

export type ProviderFrameMessageType =
  (typeof PROVIDER_FRAME_MESSAGE_TYPES)[number];

/**
 * A message we are willing to act on.
 *
 * Note what is absent: no score, no rank, no prize, no player id. `height` is the only number
 * that crosses this boundary, and it is clamped before use.
 */
export interface ProviderFrameMessage {
  type: ProviderFrameMessageType;
  /** Only meaningful for `resize`. Clamped by `clampFrameHeight`. */
  height?: number;
}

/**
 * The height bounds we will honour from a frame.
 *
 * Reason there is an upper bound: `height` is a number chosen by a third party, and a frame
 * asking for 10,000,000 pixels is not obviously malicious - a units mistake does it - but it
 * hangs the page either way. A lower bound stops a frame collapsing itself to nothing, which
 * would look to the player exactly like the game failing to load while it is in fact running.
 */
export const MIN_FRAME_HEIGHT = 320;
export const MAX_FRAME_HEIGHT = 2000;

export function clampFrameHeight(height: number): number {
  if (!Number.isFinite(height)) return MIN_FRAME_HEIGHT;
  return Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(height)));
}

/**
 * Narrow an untrusted `MessageEvent.data` to something we will act on.
 *
 * Returns `null` for anything unrecognised, and the caller ignores it silently. Reason it is
 * silent rather than logged: a browser page receives `postMessage` traffic constantly from
 * extensions, dev tools and wallets, so warning on every stray message would bury the one
 * that matters. The caller warns only when the ORIGIN matched and the type did not, because
 * that is a provider sending something we have not agreed on.
 */
export function parseProviderFrameMessage(
  data: unknown,
): ProviderFrameMessage | null {
  if (typeof data !== "object" || data === null) return null;

  const candidate = data as { type?: unknown; height?: unknown };
  if (typeof candidate.type !== "string") return null;

  // Reason for the array rather than a `Set` or an object lookup: an object keyed by the
  // message type would be indexed with an attacker-supplied string, and both `in` and object
  // indexing walk the prototype chain - so `"toString"` and `"__proto__"` pass a naive guard
  // and `ACTIONS["__proto__"]` is truthy. The same defect was found in the admin round
  // inspector on 5 Sep 2026. `includes` on a literal array has no such hole.
  if (
    !(PROVIDER_FRAME_MESSAGE_TYPES as readonly string[]).includes(candidate.type)
  ) {
    return null;
  }

  return {
    type: candidate.type as ProviderFrameMessageType,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
  };
}

/**
 * The origin we will accept messages from, derived from the launch URL we were given.
 *
 * WHY THE LAUNCH URL AND NOT A CONFIGURED ALLOWLIST: we have no registered play domain to
 * compare against. `game_provider` stores `baseUrl`, which is the provider's API host, and the
 * spec's own example puts play on a different subdomain (`play.you.com` against `you.com`), so
 * checking against it would reject correct integrations. The launch URL is the frame we
 * actually loaded, and "only trust messages from the window I opened" is the check that
 * matters - it is enforced together with `event.source === frame.contentWindow`, which no
 * unrelated page can satisfy.
 *
 * Returns null for a non-http(s) URL, and the caller then refuses to render the frame at all.
 */
export function frameOriginOf(launchUrl: string): string | null {
  try {
    const url = new URL(launchUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
