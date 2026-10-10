/**
 * Differences between the two apps' model copies that are DELIBERATE.
 *
 * Reason this file exists at all: a guard that reports differences everyone knows
 * about is noise, and a noisy guard gets switched off - at which point it protects
 * nothing. Every entry below must say why the difference is correct.
 *
 * RULES FOR ADDING AN ENTRY
 *  1. An entry is a claim that the two apps SHOULD disagree. If the honest answer is
 *     "we have not got round to syncing it", sync it instead. Do not add it here.
 *  2. Never suppress a difference in a money or contest field. Those are the ones the
 *     guard exists for.
 *  3. Removing an enum value to make two sides match orphans every document already
 *     carrying it. Add the value to the side that lacks it; never delete.
 */

export interface Allowance {
  /** Path relative to the models directory, e.g. `trading/competition.model.ts`. */
  file: string;
  /** Why this difference is correct. Required. */
  reason: string;
  /** Field paths that legitimately exist only in the main app. */
  mainOnlyFields?: string[];
  /** Field paths that legitimately exist only in apps/admin. */
  adminOnlyFields?: string[];
  /** Enum values that legitimately exist only in the main app, keyed by field path. */
  mainOnlyEnumValues?: Record<string, string[]>;
  /** Enum values that legitimately exist only in apps/admin, keyed by field path. */
  adminOnlyEnumValues?: Record<string, string[]>;
  /** Skip the file completely. Use sparingly and justify hard. */
  ignoreEntirely?: boolean;
}

export const ALLOWLIST: Allowance[] = [
  {
    file: "admin.model.ts",
    reason:
      "Staff accounts belong to the admin app. The main app's only use of this model " +
      "is lib/admin/auth.ts doing findById().select('name').lean() to put a name in " +
      "the header - it never creates or saves an Admin document, so there is no " +
      "whole-document save that could strip the fields it does not declare. " +
      "IF THE MAIN APP EVER WRITES AN Admin DOCUMENT, DELETE THIS ENTRY AND SYNC THE " +
      "MODEL: every field below would then be silently discarded, including the " +
      "lockout and permission fields that gate admin access.",
    adminOnlyFields: [
      // Permissions and role
      "role",
      "roleTemplateId",
      "allowedSections",
      // Presence and session control
      "isOnline",
      "lastLogin",
      "lastActivity",
      "status",
      "forceLogoutAt",
      // Lockout
      "isLockedOut",
      "lockedOutAt",
      "lockedOutBy",
      "lockedOutReason",
      // Support-chat availability
      "isAvailableForChat",
      "unavailableReason",
      "unavailableSince",
      "unavailableUntil",
      // Credential lifecycle
      "tempPasswordExpiresAt",
      "passwordChangedAt",
      "mustChangePassword",
      // Staff profile
      "avatar",
      "phone",
      "timezone",
      "language",
      "bio",
      "department",
      "title",
    ],
  },
];

export function findAllowance(relativePath: string): Allowance | undefined {
  return ALLOWLIST.find((entry) => entry.file === relativePath);
}

/**
 * Enum values this entry permits on one side only, for a given field path.
 *
 * Uses an entries scan rather than indexing by `enumPath`, because the path comes from
 * parsed source and indexing an object with it is a dynamic property read.
 */
export function allowedEnumValues(
  allowance: Allowance | undefined,
  enumPath: string,
  side: "main" | "admin",
): string[] {
  const table =
    side === "main"
      ? allowance?.mainOnlyEnumValues
      : allowance?.adminOnlyEnumValues;
  if (!table) return [];

  const match = Object.entries(table).find(([path]) => path === enumPath);
  return match ? match[1] : [];
}
