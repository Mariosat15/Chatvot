/**
 * Public usernames - the only identity one player ever sees of another.
 *
 * Model-free by requirement: the registration form and the profile settings screen are
 * client components, and a client file that imports a module reaching the MongoDB driver
 * cannot build at all (R58). Mirrored byte-identical into `apps/admin/lib/utils/`.
 *
 * Reason: a player's real name is personal data. Every screen where one player reads
 * another's identity - leaderboards, challenges, chat, friends, profiles, notifications -
 * shows the username. The real name stays visible only to admins and to Game Masters whose
 * package enables `showExternalReferralDetails` (see `gm-referral-view.ts`).
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/** Starts with a letter; letters, digits and underscores only. */
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Names a player could use to impersonate staff or the platform. Compared on the
 * lower-cased key, so `Admin` and `ADMIN` are refused too.
 */
const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "chartvolt",
  "moderator",
  "mod",
  "support",
  "staff",
  "system",
  "root",
  "official",
  "help",
  "gamemaster",
  "null",
  "undefined",
]);

export type UsernameValidation =
  | { ok: true; value: string; key: string }
  | { ok: false; error: string };

/** The key uniqueness is enforced on, so `Alice` and `alice` cannot both exist. */
export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(raw: unknown): UsernameValidation {
  if (typeof raw !== "string") {
    return { ok: false, error: "Username is required" };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "Username is required" };
  }
  if (value.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      ok: false,
      error:
        "Username must start with a letter and use only letters, numbers and underscores",
    };
  }
  const key = usernameKey(value);
  if (RESERVED_USERNAMES.has(key)) {
    return { ok: false, error: "That username is reserved" };
  }
  return { ok: true, value, key };
}

/**
 * What other players see for a user.
 *
 * Reason: accounts created before usernames existed have none until the player picks one, and
 * falling back to `name` would show exactly the real name this module exists to hide. The
 * fallback is derived from the id, so it is stable and the same on every screen.
 */
export function resolvePublicName(
  user:
    | { username?: unknown; id?: unknown; _id?: unknown }
    | null
    | undefined,
): string {
  if (user && typeof user.username === "string" && user.username.trim()) {
    return user.username.trim();
  }
  const rawId = user?.id ?? user?._id;
  const id = rawId === undefined || rawId === null ? "" : String(rawId);
  if (!id) return "Player";
  return `Player_${id.slice(-6).toUpperCase()}`;
}
