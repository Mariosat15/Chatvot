import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reason: a soft `router.push("/sign-in")` after the sign-out server action raced the current
// page's own redirect, so sign-out only worked on some pages. Every button must leave through
// the shared hard navigation instead.
const BUTTONS = [
  "components/UserSidebar.tsx",
  "components/UserDropdown.tsx",
  "app/verify-email-required/page.tsx",
];

const read = (file: string) =>
  readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("sign-out buttons", () => {
  it.each(BUTTONS)("%s signs out through signOutAndLeave, never a soft push", (file) => {
    const code = read(file);
    expect(code).toMatch(/await signOutAndLeave\(\)/);
    expect(code).not.toMatch(/router\.push\(\s*["']\/sign-in["']/);
    expect(code).not.toMatch(/from "@\/lib\/actions\/auth\.actions"/);
  });

  it("the helper leaves with a full page load, even when the request fails", () => {
    const code = read("lib/auth/sign-out-and-leave.ts");
    const tryEnd = code.indexOf("} catch");
    const leave = code.indexOf("window.location.replace(SIGN_IN_PATH)");
    expect(tryEnd).toBeGreaterThan(0);
    expect(leave).toBeGreaterThan(tryEnd);
  });
});
