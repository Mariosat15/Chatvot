/**
 * Forgot / reset password (5 Oct 2026).
 *
 * Covers the admin template, better-auth wiring, 2FA-before-reset gate,
 * public routes, and the mobile terms/phone polish shipped in the same pass.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("password reset + mobile auth polish", () => {
  it("both EmailTemplate copies declare password_reset (add-only enum)", () => {
    const main = read("database/models/email-template.model.ts");
    const admin = read("apps/admin/database/models/email-template.model.ts");
    for (const src of [main, admin]) {
      expect(src).toContain('"password_reset"');
      expect(src).toContain('case "password_reset"');
      expect(src).toContain("{{resetLink}}");
    }
  });

  it("admin Email Templates lists password_reset and the API can seed/test it", () => {
    const section = read(
      "apps/admin/components/admin/EmailTemplatesSection.tsx",
    );
    const route = read("apps/admin/app/api/email-templates/route.ts");
    expect(section).toContain("password_reset:");
    expect(section).toContain("Password Reset");
    expect(section).toContain("KeyRound");
    expect(route).toContain('"password_reset"');
    expect(route).toContain("sendTestPasswordResetEmail");
    expect(route).toContain("password_reset: \"Password Reset\"");
  });

  it("better-auth sends the branded reset email and revokes sessions", () => {
    const src = stripComments(read("lib/better-auth/auth.ts"));
    expect(src).toContain("sendPasswordResetEmail");
    expect(src).toContain("sendResetPassword");
    expect(src).toContain("revokeSessionsOnPasswordReset: true");
    expect(src).toContain("/reset-password?token=");
  });

  it("password-reset API routes cover request, status, 2FA and confirm", () => {
    expect(
      existsSync(join(ROOT, "app/api/auth/password-reset/request/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/auth/password-reset/status/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/auth/password-reset/verify-2fa/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "app/api/auth/password-reset/confirm/route.ts")),
    ).toBe(true);

    const confirm = stripComments(
      read("app/api/auth/password-reset/confirm/route.ts"),
    );
    expect(confirm).toContain("userHasTwoFactorEnrolment");
    expect(confirm).toContain("isResetTokenTwoFactorVerified");
    expect(confirm).toContain("TWO_FACTOR_REQUIRED");
    expect(confirm).toContain("auth.api.resetPassword");

    const verify = stripComments(
      read("app/api/auth/password-reset/verify-2fa/route.ts"),
    );
    expect(verify).toContain("verifyTwoFactorWithoutSession");
    expect(verify).toContain("markResetTokenTwoFactorVerified");
  });

  it("session-less 2FA helper decrypts TOTP and stores 2FA proof separately", () => {
    const raw = read("lib/services/password-reset-2fa.service.ts");
    const src = stripComments(raw);
    expect(src).toContain("symmetricDecrypt");
    expect(src).toContain("createOTP");
    expect(src).toContain("reset-password-2fa:");
    // Reason: proof must be a second verification row — mutating the reset
    // token's value would break auth.api.resetPassword's userId read.
    expect(raw).toContain("markResetTokenTwoFactorVerified");
    expect(src).toContain('`${RESET_2FA_PREFIX}${token}`');
  });

  it("sign-in Forgot password links to /forgot-password on desktop and mobile", () => {
    const desktop = stripComments(
      read("components/auth/desktop/DesktopSignIn.tsx"),
    );
    const mobile = stripComments(
      read("components/auth/mobile/MobileSignIn.tsx"),
    );
    expect(desktop).toContain('href="/forgot-password"');
    expect(mobile).toContain('href="/forgot-password"');
    expect(desktop).not.toContain("Password reset is not available yet");
    expect(mobile).not.toContain("Password reset is not available yet");
  });

  it("forgot and reset pages exist under the auth layout", () => {
    expect(existsSync(join(ROOT, "app/(auth)/forgot-password/page.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "app/(auth)/reset-password/page.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "components/auth/ForgotPasswordForm.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "components/auth/ResetPasswordForm.tsx"))).toBe(
      true,
    );
  });

  it("middleware allows forgot-password and reset-password without a session", () => {
    const src = read("middleware/index.ts");
    expect(src).toContain("forgot-password");
    expect(src).toContain("reset-password");
  });

  it("mobile terms are high-contrast and phone/code share one height", () => {
    const terms = stripComments(read("components/auth/AuthTermsAgree.tsx"));
    expect(terms).toContain("text-cyan-50");
    expect(terms).toContain("underline");
    expect(terms).not.toMatch(/text-cyan-100\/75/);

    const register = stripComments(
      read("components/auth/mobile/MobileRegister.tsx"),
    );
    expect(register).toContain("[&_.form-input]:!h-14");
    expect(register).toContain("[&_.country-select-trigger]:!h-14");
    expect(register).not.toMatch(/\[&_input\]:min-h-14/);
  });
});
