/**
 * Login / registration look (5 Oct 2026) + dedicated mobile layouts.
 *
 * Desktop look stays; mobile is a separate tree behind AuthViewportSwitch.
 * Social OAuth is intentionally not on the pages (owner: remove for now).
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
    expect(src).toMatch(
      /heroSettings\?\.authPageSignInImage \|\| DEFAULT_AUTH_SIGN_IN_BG/,
    );
    expect(src).toMatch(
      /heroSettings\?\.authPageSignUpImage \|\| DEFAULT_AUTH_SIGN_UP_BG/,
    );
    expect(src).toContain("AuthBrandingProvider");
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

  it("pages split desktop and mobile through AuthViewportSwitch and share hooks", () => {
    const signIn = read("app/(auth)/sign-in/page.tsx");
    const signUp = read("app/(auth)/sign-up/page.tsx");
    const switchSrc = read("components/auth/AuthViewportSwitch.tsx");
    expect(signIn).toContain("AuthViewportSwitch");
    expect(signIn).toContain("DesktopSignIn");
    expect(signIn).toContain("MobileSignIn");
    expect(signUp).toContain("DesktopRegister");
    expect(signUp).toContain("MobileRegister");
    expect(switchSrc).toContain("min-width: 769px");
    expect(read("components/auth/desktop/DesktopSignIn.tsx")).toContain(
      "useSignInForm",
    );
    expect(read("components/auth/mobile/MobileSignIn.tsx")).toContain(
      "useSignInForm",
    );
    expect(read("components/auth/desktop/DesktopRegister.tsx")).toContain(
      "useSignUpForm",
    );
    expect(read("components/auth/mobile/MobileRegister.tsx")).toContain(
      "useSignUpForm",
    );
  });

  it("desktop and mobile shells center the background and hide the scrollbar chrome", () => {
    const desktop = read("components/auth/desktop/DesktopAuthShell.tsx");
    const mobile = read("components/auth/mobile/MobileAuthShell.tsx");
    const css = read("app/globals.css");
    expect(desktop).toContain("object-cover object-center");
    expect(desktop).toContain("auth-page-scroll");
    expect(mobile).toContain("auth-page-scroll");
    expect(mobile).toContain("min-h-dvh");
    expect(css).toContain(".auth-page-scroll");
    expect(css).toContain("scrollbar-width: none");
  });

  // Reason (10 Oct 2026): the two-step version hid address, city, ZIP, the player-type
  // choice and the terms box behind Continue, and the owner reported them as missing. Every
  // field now renders on one page, so none of them may sit behind a step condition.
  it("mobile registration is one page, one column, with every field and terms linking to real pages", () => {
    const mobileReg = stripComments(read("components/auth/mobile/MobileRegister.tsx"));
    const terms = read("components/auth/AuthTermsAgree.tsx");
    const hook = read("hooks/useSignUpForm.ts");
    expect(mobileReg).not.toMatch(/goToStep|step ===|\{step\}/);
    expect(hook).not.toMatch(/goToStep|setStep/);
    const order = [
      'name="fullName"',
      'name="username"',
      'name="email"',
      'name="password"',
      'name="confirmPassword"',
      "<PhoneInputField",
      'name="country"',
      'name="address"',
      'name="city"',
      'name="postalCode"',
      "<MobileInterestSelector",
      "<AuthTermsAgree",
      'type="submit"',
    ].map((marker) => mobileReg.indexOf(marker));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(mobileReg).not.toMatch(/grid-cols-2/);
    expect(terms).toContain('href="/terms"');
    expect(terms).toContain('href="/privacy"');
    expect(hook).toContain("referralCode");
    expect(hook).toContain("termsAccepted");
  });

  it("desktop registration follows the owner's field arrangement", () => {
    const src = stripComments(read("components/auth/desktop/DesktopRegister.tsx"));
    const order = [
      'name="fullName"',
      'name="username"',
      'name="email"',
      'name="password"',
      'name="confirmPassword"',
      "<PhoneInputField",
      'name="country"',
      'name="address"',
      'name="city"',
      'name="postalCode"',
    ].map((marker) => src.indexOf(marker));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Full name, username, email and the phone row each span both columns.
    for (const marker of ['name="fullName"', 'name="username"', 'name="email"', "<PhoneInputField"]) {
      const before = src.slice(0, src.indexOf(marker));
      expect(before.slice(before.lastIndexOf("<div")).startsWith('<div className="sm:col-span-2">')).toBe(true);
    }
    // Code and Phone number take one half-width column each.
    expect(src).toContain('layout="split"');
  });

  it("sign-in and sign-up pages do not render Google/Apple social buttons", () => {
    const signIn = stripComments(read("app/(auth)/sign-in/page.tsx"));
    const signUp = stripComments(read("app/(auth)/sign-up/page.tsx"));
    const desktopIn = stripComments(
      read("components/auth/desktop/DesktopSignIn.tsx"),
    );
    const mobileIn = stripComments(
      read("components/auth/mobile/MobileSignIn.tsx"),
    );
    for (const src of [signIn, signUp, desktopIn, mobileIn]) {
      expect(src).not.toContain("AuthSocialRow");
      expect(src).not.toMatch(/OR CONTINUE WITH/i);
    }
  });

  it("Better Auth still has no socialProviders — Google is not wired", () => {
    const src = stripComments(read("lib/better-auth/auth.ts"));
    expect(src).not.toMatch(/socialProviders/);
  });
});
