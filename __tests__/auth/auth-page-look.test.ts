/**
 * Login / registration look (5 Oct 2026).
 *
 * The mockup is layout only. Forms stay real HTML. Social buttons are look-only
 * until the owner approves OAuth. Empty branding fields fall back to shipped art.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_AUTH_SIGN_IN_BG,
  DEFAULT_AUTH_SIGN_UP_BG,
} from "@/lib/constants/auth-art";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("auth page look", () => {
  it("ships both default background files and the constants name them", () => {
    expect(DEFAULT_AUTH_SIGN_IN_BG).toBe("/assets/auth/sign-in-bg.jpg");
    expect(DEFAULT_AUTH_SIGN_UP_BG).toBe("/assets/auth/sign-up-bg.jpg");
    expect(existsSync(join(ROOT, "public/assets/auth/sign-in-bg.jpg"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "public/assets/auth/sign-up-bg.jpg"))).toBe(
      true,
    );
  });

  it("the auth layout falls back to those constants when branding is empty", () => {
    const src = read("app/(auth)/layout.tsx");
    expect(src).toContain("authPageSignInImage");
    expect(src).toContain("authPageSignUpImage");
    expect(src).toContain("DEFAULT_AUTH_SIGN_IN_BG");
    expect(src).toContain("DEFAULT_AUTH_SIGN_UP_BG");
    expect(src).toMatch(/heroSettings\?\.authPageSignInImage \|\| DEFAULT_AUTH_SIGN_IN_BG/);
    expect(src).toMatch(/heroSettings\?\.authPageSignUpImage \|\| DEFAULT_AUTH_SIGN_UP_BG/);
  });

  it("both HeroSettings copies declare the two background fields", () => {
    const main = read("database/models/hero-settings.model.ts");
    const admin = read("apps/admin/database/models/hero-settings.model.ts");
    for (const src of [main, admin]) {
      expect(src).toContain("authPageSignInImage");
      expect(src).toContain("authPageSignUpImage");
    }
  });

  it("Branding Images lists both upload slots and saves them with the rest of auth settings", () => {
    // Reason: do not strip comments here. ImageUploadCard uses accept="image/*"
    // and `*/` closes a naive block-comment stripper, so the rest of the file
    // would vanish and this assertion would fail on correct code.
    const src = read("apps/admin/components/admin/ImagesSection.tsx");
    expect(src).toContain('field="authPageSignInImage"');
    expect(src).toContain('field="authPageSignUpImage"');
    expect(src).toContain('handleAuthImageUpload("authPageSignInImage"');
    expect(src).toContain('handleAuthImageUpload("authPageSignUpImage"');
    expect(src).toContain("JSON.stringify(authSettings)");
  });

  it("the glass card wraps the forms and the social row is look-only", () => {
    const shell = read("components/auth/AuthShell.tsx");
    const social = stripComments(read("components/auth/AuthSocialRow.tsx"));
    const signIn = read("app/(auth)/sign-in/page.tsx");
    expect(shell).toContain("auth-card");
    expect(signIn).toContain("AuthSocialRow");
    expect(social).not.toMatch(/socialProviders|signIn\.social|google\(/i);
    expect(social).toContain("not enabled yet");
  });

  it("Better Auth still has no socialProviders — Google is not wired", () => {
    const src = stripComments(read("lib/better-auth/auth.ts"));
    expect(src).not.toMatch(/socialProviders/);
  });
});
