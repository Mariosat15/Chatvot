import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSignupInterest,
  SIGNUP_INTEREST_VALUES,
  SIGNUP_INTEREST_OPTIONS,
} from "@/lib/utils/signup-interest";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("signup interest (Q16)", () => {
  it("accepts only trading, games, both", () => {
    expect(parseSignupInterest("trading")).toBe("trading");
    expect(parseSignupInterest("games")).toBe("games");
    expect(parseSignupInterest("both")).toBe("both");
    expect(parseSignupInterest("")).toBeUndefined();
    expect(parseSignupInterest("Trading")).toBeUndefined();
    expect(parseSignupInterest("all")).toBeUndefined();
    expect(parseSignupInterest(null)).toBeUndefined();
    expect(SIGNUP_INTEREST_VALUES).toEqual(["trading", "games", "both"]);
    expect(SIGNUP_INTEREST_OPTIONS).toHaveLength(3);
  });

  // Reason: the sign-up page now only switches between the desktop and mobile
  // forms, so the choice is asserted on the form that renders it.
  it("sign-up form offers the three options and requires a choice", () => {
    const desktop = read("components/auth/desktop/DesktopRegister.tsx");
    expect(desktop).toMatch(/SIGNUP_INTEREST_OPTIONS/);
    expect(desktop).toMatch(/signupInterest/);
    expect(desktop).toMatch(/required:\s*["']Please pick one["']/);
  });

  it("auth action stores signupInterest only when parse accepts it", () => {
    const action = read("lib/actions/auth.actions.ts");
    expect(action).toMatch(/parseSignupInterest/);
    expect(action).toMatch(/signupInterest/);
    expect(action).toMatch(/signupInterestAt/);
  });
});
