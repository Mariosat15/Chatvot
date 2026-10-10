/**
 * A Game Master subscription an admin has suspended.
 *
 * Reason this is its own question: a suspended subscription is neither active nor expired, so
 * every rule written as "active may only upgrade, expired must renew or delete" let it fall
 * through - a suspended Game Master could buy a cheaper package, and the purchase then set the
 * status back to "active", lifting the suspension without the admin. Nothing the player does
 * may change a suspended subscription; only the admin's unsuspend does.
 *
 * Model-free so client code may import the error code.
 */
export function isSuspendedSubscription(
  subscription: { status?: string } | null | undefined,
): boolean {
  return subscription?.status === "suspended";
}

export const GM_SUSPENDED_ERROR_CODE = "GM_SUSPENDED";

export const GM_SUSPENDED_MESSAGE =
  "Your Game Master subscription is suspended. You cannot buy, renew or change a Game Master package until an admin lifts the suspension. Please contact support.";
