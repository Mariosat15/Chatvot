import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "@/lib/nodemailer/html-to-text";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("registration and email verification", () => {
  it("sign-up does not sign the player in", () => {
    // Reason: an auto-signed-in unverified session is what bounced the verification
    // link through /sign-in to a dashboard that refused the player until a refresh.
    expect(read("lib/better-auth/auth.ts")).toMatch(/autoSignIn:\s*false/);
  });

  it("a verified link lands on the success page, outside both session-redirecting layouts", () => {
    const route = read("app/api/auth/verify-email/route.ts");
    expect(route).toMatch(/redirect\(`\$\{baseUrl\}\/email-verified`\)/);
    expect(route).not.toContain("verification=success");
    expect(fs.existsSync(path.join(ROOT, "app/email-verified/page.tsx"))).toBe(true);
    expect(read("app/email-verified/page.tsx")).toContain("SIGN_IN_PATH");
  });

  it("the verify route ends a leftover session before sending the player to sign in", () => {
    const route = read("app/api/auth/verify-email/route.ts");
    const success = route.slice(route.indexOf("if (result.success)"), route.indexOf("} else {"));
    expect(success.length).toBeGreaterThan(0);
    expect(success).toContain("await endLeftoverSession(request, response)");
  });

  it("a link already spent by a mail scanner counts as verified, not invalid", () => {
    const service = read("lib/services/email-verification.service.ts");
    expect(service).toMatch(/emailVerified === true\) \{\s*return \{ success: true, userId, alreadyVerified: true \}/);
  });

  it("the dashboard layout never caches an unverified answer", () => {
    const layout = read("app/(root)/layout.tsx");
    expect(layout).toMatch(/if \(verified\) emailVerifiedCache\.set/);
  });

  it("the welcome email is sent after verification, never at sign-up", () => {
    expect(read("lib/actions/auth.actions.ts")).not.toContain("sendWelcomeEmail");
    expect(read("lib/services/email-verification.service.ts")).toContain(
      "void sendWelcomeAfterVerification(",
    );
  });

  it("every HTML email gets a plain-text part, in both apps identically", () => {
    expect(read("lib/nodemailer/email-brand.ts")).toMatch(
      /if \(!mail\.data\.text\) mail\.data\.text = htmlToPlainText\(finalHtml\)/,
    );
    expect(fs.readFileSync(path.join(ROOT, "apps/admin/lib/nodemailer/html-to-text.ts"), "utf8")).toBe(
      fs.readFileSync(path.join(ROOT, "lib/nodemailer/html-to-text.ts"), "utf8"),
    );
  });

  it("the plain-text part keeps link addresses and drops markup", () => {
    const text = htmlToPlainText(
      '<html><head><style>p{color:red}</style></head><body><p>Hi&nbsp;Sam &amp; co</p>' +
        '<a href="https://x.test/verify?t=1">Verify Email</a></body></html>',
    );
    expect(text).toBe("Hi Sam & co\nVerify Email (https://x.test/verify?t=1)");
  });
});
