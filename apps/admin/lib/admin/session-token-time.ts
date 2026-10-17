/**
 * Whether an admin session token predates a moment that invalidates sessions
 * (`forceLogoutAt`, `passwordChangedAt`).
 *
 * `iat` is whole seconds while the stored moment has milliseconds, so the moment is
 * floored first: a login in the same second as a password change must not be refused.
 *
 * A token with no usable `iat` reads as issued at the epoch, so it predates every
 * moment and is refused (fails closed). That is why the login route must call
 * `setIssuedAt()` - without it every stored moment refuses every session.
 */
export function wasIssuedBefore(
  iat: unknown,
  moment: Date | string | number | null | undefined,
): boolean {
  if (moment === null || moment === undefined) return false;
  const momentMs = new Date(moment).getTime();
  if (!Number.isFinite(momentMs)) return false;
  const issuedAtSeconds =
    typeof iat === "number" && Number.isFinite(iat) ? iat : 0;
  return issuedAtSeconds < Math.floor(momentMs / 1000);
}
