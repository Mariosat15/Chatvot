/**
 * How the admin app labels a player: the real name staff need for support,
 * followed by the public handle every other player sees.
 *
 * Model-free so client components may import it.
 */
export function withUsername(
  name: string | null | undefined,
  username: string | null | undefined,
): string {
  const real = (name || "").trim();
  const handle = (username || "").trim();
  if (!handle) return real;
  return real ? `${real} (@${handle})` : `@${handle}`;
}
