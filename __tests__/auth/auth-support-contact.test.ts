import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("sign-in support email (5 Oct 2026)", () => {
  it("the auth layout reads Company Settings without creating a document", () => {
    // Reason: strip comments - the layout explains why it avoids getSingleton in prose.
    const layout = read("app/(auth)/layout.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(layout).toMatch(/CompanySettings\.findOne\(\)\.select\(\{ email: 1 \}\)/);
    // Reason: getSingleton() creates the row - a public page must never write.
    expect(layout).not.toMatch(/getSingleton/);
    // Both the success and the error branch must supply an address.
    expect(layout.match(/supportEmail:/g)?.length).toBe(2);
  });

  it.each([
    "components/auth/desktop/DesktopSignIn.tsx",
    "components/auth/mobile/MobileSignIn.tsx",
  ])("%s renders the shared support line", (file) => {
    const src = read(file);
    expect(src).toMatch(/<AuthSupportContact\b/);
    // Reason: one component owns the wording; a hand-rolled mailto is a second copy.
    expect(src).not.toMatch(/mailto:/);
  });

  it("the shared line links the configured address", () => {
    const src = read("components/auth/AuthSupportContact.tsx");
    expect(src).toMatch(/useAuthBranding\(\)/);
    expect(src).toMatch(/href=\{`mailto:\$\{supportEmail\}`\}/);
  });
});
