/**
 * Player-facing badge titles from an id (and optional known name).
 *
 * Blueprint badges use ids like `trading_beat_top_trader_flag` while the
 * constants catalogue still uses older ids (`comp_giant_killer`). Looking up
 * only the constants map shows the raw slug — which reads as a backend name
 * on the journey milestone dialog. Prefer a stored `name` when known; otherwise
 * humanise the id so a missing catalogue row never leaks snake_case.
 */

const SCOPE_PREFIXES = [
  "trading_",
  "platform_",
  "pf_",
  "provider_",
] as const;

const TRAILING_TOKENS = new Set(["flag", "true", "false"]);

/**
 * Turn a badge id into Title Case words when no catalogue name is available.
 *
 * Reason: strip a known scope prefix and a trailing `flag` / numeric tier so
 * `trading_beat_top_trader_flag` reads "Beat Top Trader", not the slug.
 */
export function humanizeBadgeId(id: string): string {
  if (!id || typeof id !== "string") return "";

  let rest = id.trim();
  for (const prefix of SCOPE_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }

  // Reason: provider scopes are `provider:<key>:<code>` slugged into a long
  // prefix; drop a leading `provider_` segment if the short list missed it.
  if (rest.includes("_")) {
    const parts = rest.split("_").filter(Boolean);
    while (parts.length > 1 && TRAILING_TOKENS.has(parts[parts.length - 1]!.toLowerCase())) {
      parts.pop();
    }
    // Drop a trailing pure-numeric tier (`_5`) — the display name should not
    // look like an internal ladder index.
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]!)) {
      parts.pop();
    }
    rest = parts.join(" ");
  }

  return rest
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve the name a player should see for a badge id.
 *
 * Precedence: explicit known name → map lookup → humanised id. Never return
 * the raw snake_case id when it can be humanised.
 */
export function resolveBadgeDisplayName(
  id: string,
  knownName?: string | null,
  nameById?: ReadonlyMap<string, string> | null,
): string {
  const trimmedKnown = typeof knownName === "string" ? knownName.trim() : "";
  if (trimmedKnown) return trimmedKnown;

  const fromMap = nameById?.get(id);
  if (fromMap && fromMap.trim()) return fromMap.trim();

  return humanizeBadgeId(id) || id;
}
