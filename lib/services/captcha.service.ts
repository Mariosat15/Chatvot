/**
 * CAPTCHA Verification Service
 *
 * Server-side verification for the registration bot-challenge. Supports
 * Cloudflare Turnstile, Google reCAPTCHA (v2/v3) and hCaptcha.
 *
 * Reason: the admin panel exposed a "Require CAPTCHA" toggle + provider + site
 * key, but the token was never verified server-side — so the challenge did
 * nothing. This module performs the real siteverify call. The secret key is
 * read from environment variables (never the client):
 *   - Turnstile : TURNSTILE_SECRET_KEY   (or CAPTCHA_SECRET_KEY)
 *   - reCAPTCHA : RECAPTCHA_SECRET_KEY   (or CAPTCHA_SECRET_KEY)
 *   - hCaptcha  : HCAPTCHA_SECRET_KEY    (or CAPTCHA_SECRET_KEY)
 */

export type CaptchaProvider = "none" | "recaptcha" | "turnstile" | "hcaptcha";

export interface CaptchaVerifyInput {
  provider?: string; // from FraudSettings.registrationChallengeProvider
  enabled?: boolean; // from FraudSettings.registrationChallengeEnabled
  token?: string; // token produced by the client widget
  ip?: string; // remote IP (optional, improves accuracy)
}

export interface CaptchaVerifyResult {
  /** True when the challenge passed OR when verification is not required. */
  ok: boolean;
  /** True when we didn't actually verify (disabled or not configured). */
  skipped: boolean;
  reason?: string;
}

const VERIFY_ENDPOINTS: Record<Exclude<CaptchaProvider, "none">, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
  hcaptcha: "https://hcaptcha.com/siteverify",
};

/**
 * Resolve the secret key for a provider from the environment.
 */
function getSecret(provider: Exclude<CaptchaProvider, "none">): string {
  const generic = process.env.CAPTCHA_SECRET_KEY || "";
  switch (provider) {
    case "turnstile":
      return process.env.TURNSTILE_SECRET_KEY || generic;
    case "recaptcha":
      return process.env.RECAPTCHA_SECRET_KEY || generic;
    case "hcaptcha":
      return process.env.HCAPTCHA_SECRET_KEY || generic;
    default:
      return generic;
  }
}

/**
 * Verify a CAPTCHA token. When the challenge is disabled, the provider is
 * "none", or no secret is configured, verification is SKIPPED (ok:true) so a
 * misconfiguration never locks users out of registration. When it is enabled
 * and configured, a missing or invalid token fails (ok:false).
 */
export async function verifyCaptcha(
  input: CaptchaVerifyInput,
): Promise<CaptchaVerifyResult> {
  const provider = (input.provider || "none") as CaptchaProvider;

  if (!input.enabled || provider === "none") {
    return { ok: true, skipped: true };
  }

  const endpoint = VERIFY_ENDPOINTS[provider as Exclude<CaptchaProvider, "none">];
  const secret = getSecret(provider as Exclude<CaptchaProvider, "none">);

  // Not fully configured on the server → skip rather than block signups.
  if (!endpoint || !secret) {
    console.warn(
      `⚠️ CAPTCHA is enabled (${provider}) but no secret key is configured — skipping verification. ` +
        `Set the provider secret in the environment to enforce it.`,
    );
    return { ok: true, skipped: true };
  }

  // Enabled + configured but the client sent no token → reject (likely a bot).
  if (!input.token) {
    return {
      ok: false,
      skipped: false,
      reason: "Please complete the verification challenge.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", input.token);
    if (input.ip && input.ip !== "unknown") body.set("remoteip", input.ip);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json()) as { success?: boolean };
    if (data.success) {
      return { ok: true, skipped: false };
    }

    return {
      ok: false,
      skipped: false,
      reason: "Verification failed. Please try again.",
    };
  } catch (error) {
    // Reason: on a provider outage we fail OPEN so legitimate users are not
    // blocked from registering. The other anti-bot layers (honeypot, rate
    // limits, name checks) still apply.
    console.error("⚠️ CAPTCHA verification error (failing open):", error);
    return { ok: true, skipped: true };
  }
}
