import { auth, twoFactorApi } from "@/lib/better-auth/auth";

/**
 * Two-Factor Step-Up Gate
 * -----------------------
 * Helpers that enforce 2FA on individual actions (withdrawals, password
 * changes, etc.) for users who already have an active session.
 *
 * Why a dedicated module:
 *   - Centralises the 2FA policy so the same rules apply across features.
 *   - Keeps route handlers thin and declarative:
 *       `const gate = await evaluateTwoFactorGate(...); if (!gate.ok) return 403`
 *   - Gives admin settings a single point of effect.
 */

export interface TwoFactorGateContext {
  userId: string;
  /** The request headers, used by better-auth to resolve the session. */
  reqHeaders: Headers;
  /** TOTP / backup code provided in the request body (if any). */
  code?: string;
  /** Admin policy — see WithdrawalSettings / ProfileSecuritySettings. */
  policy: {
    /** Always require 2FA. */
    required?: boolean;
    /**
     * Require 2FA only when the action amount exceeds this EUR value.
     * 0 or undefined disables threshold-based gating.
     */
    requireAboveAmount?: number;
    /** Block the action entirely if the user has no 2FA enabled. */
    blockIfNotEnabled?: boolean;
    /** Current amount being acted on, used for threshold comparison. */
    amount?: number;
  };
}

export type TwoFactorGateResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code:
        | "TWO_FACTOR_REQUIRED"
        | "TWO_FACTOR_NOT_ENABLED"
        | "TWO_FACTOR_INVALID"
        | "UNAUTHORIZED";
      error: string;
    };

/**
 * Returns whether the current user has 2FA enabled on their account.
 *
 * Reads the `twoFactorEnabled` flag via better-auth's session resolver
 * rather than querying the `user` collection directly.
 *
 * Reason: better-auth's mongodb adapter stores `user._id` as an
 * `ObjectId`, while session tokens expose the id as a hex *string*.
 * Querying `db.collection("user").findOne({ _id: stringId })` therefore
 * never matches and always returned `false` — which surfaced as a false
 * "Please enable two-factor authentication" error on withdrawals even
 * for users who had 2FA correctly enabled. Delegating to `auth.api.getSession`
 * lets the adapter perform the proper id conversion for us.
 */
export async function isTwoFactorEnabled(
  reqHeaders: Headers,
): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: reqHeaders });
    const user = session?.user as unknown as
      | { twoFactorEnabled?: boolean }
      | undefined;
    return Boolean(user?.twoFactorEnabled);
  } catch (err) {
    console.warn("⚠️ [2FA gate] isTwoFactorEnabled read error:", err);
    // Reason: Fail-closed would lock users out on a transient read error.
    // We fail-open here; the caller must still rely on policy flags to
    // decide whether the action is allowed.
    return false;
  }
}

/**
 * Verifies a supplied TOTP (or backup) code for the active session.
 * Delegates to better-auth's `verifyTOTP` / `verifyBackupCode` methods
 * which read the session from the supplied headers. Returns true only
 * on exact match; any error is treated as invalid.
 */
export async function verifyActionTwoFactor(
  code: string,
  reqHeaders: Headers,
): Promise<{ valid: boolean; usedBackup: boolean }> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, usedBackup: false };

  // Numeric 6-8 digit → TOTP. Anything else (e.g. alphanumeric backup codes) → backup code.
  const isTotp = /^\d{6,8}$/.test(trimmed);

  try {
    const api = twoFactorApi();
    if (isTotp) {
      await api.verifyTOTP({
        body: { code: trimmed, trustDevice: false },
        headers: reqHeaders,
      });
      return { valid: true, usedBackup: false };
    }
    await api.verifyBackupCode({
      body: { code: trimmed, trustDevice: false },
      headers: reqHeaders,
    });
    return { valid: true, usedBackup: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("⚠️ [2FA gate] verifyActionTwoFactor failed:", msg);
    return { valid: false, usedBackup: false };
  }
}

/**
 * Evaluates a step-up gate in one call. Typical usage in a route handler:
 *
 *   const gate = await evaluateTwoFactorGate({ userId, reqHeaders, code, policy });
 *   if (!gate.ok) return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
 */
export async function evaluateTwoFactorGate(
  ctx: TwoFactorGateContext,
): Promise<TwoFactorGateResult> {
  const { userId, reqHeaders, code, policy } = ctx;

  if (!userId) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "Unauthorized.",
    };
  }

  // Decide whether this specific action needs a TOTP challenge.
  const amountGate =
    typeof policy.requireAboveAmount === "number" &&
    policy.requireAboveAmount > 0 &&
    typeof policy.amount === "number" &&
    policy.amount > policy.requireAboveAmount;

  const needsTwoFactor = Boolean(policy.required) || amountGate;

  // Reason: `blockIfNotEnabled` is an *independent* enrolment gate. Even
  // when the action itself doesn't demand a fresh code (e.g. withdrawal
  // under threshold), the admin may still want to force all withdrawers
  // to have 2FA set up — this prevents session-theft "silent" drains from
  // unprotected accounts. If neither gate is active, skip the check.
  if (!needsTwoFactor && !policy.blockIfNotEnabled) {
    return { ok: true };
  }

  const enabled = await isTwoFactorEnabled(reqHeaders);

  if (!enabled) {
    const message = policy.blockIfNotEnabled
      ? "Please enable two-factor authentication in your profile before continuing."
      : "Two-factor authentication is required for this action. Please enable it in your profile first.";
    return {
      ok: false,
      status: 403,
      code: "TWO_FACTOR_NOT_ENABLED",
      error: message,
    };
  }

  // 2FA is enrolled. If the action itself doesn't demand a code (enrolment
  // gate only), we're done — having 2FA set up is sufficient.
  if (!needsTwoFactor) return { ok: true };

  if (!code) {
    return {
      ok: false,
      status: 403,
      code: "TWO_FACTOR_REQUIRED",
      error: "Enter your authenticator code to continue.",
    };
  }

  const { valid } = await verifyActionTwoFactor(code, reqHeaders);
  if (!valid) {
    return {
      ok: false,
      status: 403,
      code: "TWO_FACTOR_INVALID",
      error: "Invalid or expired verification code.",
    };
  }

  return { ok: true };
}
