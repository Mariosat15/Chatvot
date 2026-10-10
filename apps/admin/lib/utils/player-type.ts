/**
 * Player type: what kind of player an account is (owner, 5 Oct 2026).
 *
 * Stored in the Better Auth `user.role` field, alongside the staff roles that
 * already lived there. Chosen at registration (mandatory), then upgraded to
 * `both` automatically the first time a trader plays a game or a gamer places
 * a trade. Game Master is NOT a player type: it is derived from an active
 * Game Master subscription, so it appears and disappears on its own and the
 * underlying player type survives it.
 *
 * Model-free on purpose: imported by client components (R58) and mirrored
 * byte-identical into `apps/admin/lib/utils/player-type.ts`.
 */

export const PLAYER_TYPES = ["trader", "gamer", "both"] as const;

export type PlayerType = (typeof PLAYER_TYPES)[number];

/**
 * Roles that belong to staff, never to a player. Everything else stored in
 * `role` (including an absent value, which predates player types and means
 * trader) is a player and may appear on player-facing lists.
 */
export const STAFF_ROLES = ["admin", "backoffice"] as const;

/** Every role an admin may assign from the user panel. Affiliate is retired. */
export const ASSIGNABLE_ROLES = [...PLAYER_TYPES, "gamemaster"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type PlayerActivity = "trading" | "games";

const SIGNUP_ROLE = new Map<string, PlayerType>([
  ["trading", "trader"],
  ["games", "gamer"],
  ["both", "both"],
]);

/** The player type a registration answer assigns, or undefined for an unknown answer. */
export function playerTypeForSignupInterest(
  interest: unknown,
): PlayerType | undefined {
  return typeof interest === "string" ? SIGNUP_ROLE.get(interest) : undefined;
}

export function isPlayerType(role: unknown): role is PlayerType {
  return typeof role === "string" && (PLAYER_TYPES as readonly string[]).includes(role);
}

export function isStaffRole(role: unknown): boolean {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Stored roles that the given activity turns into `both`.
 *
 * Reason: only the OPPOSITE single type is promoted. `both` has nothing to
 * gain, and gamemaster / staff / legacy affiliate are never rewritten by a
 * player's own activity. `null` stands for an absent or empty role, which is a
 * legacy trader, so playing a game promotes it exactly like `trader`.
 */
export function rolesPromotedBy(activity: PlayerActivity): ReadonlyArray<string | null> {
  return activity === "games" ? ["trader", null] : ["gamer"];
}

/** Pure form of the promotion rule, used by tests and screens. */
export function promotedPlayerType(
  role: unknown,
  activity: PlayerActivity,
): PlayerType | undefined {
  const stored = typeof role === "string" && role !== "" ? role : null;
  return rolesPromotedBy(activity).includes(stored) ? "both" : undefined;
}
