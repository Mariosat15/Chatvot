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

  it("sign-up form offers the three options and requires a choice", () => {
    const page = read("app/(auth)/sign-up/page.tsx");
    expect(page).toMatch(/SIGNUP_INTEREST_OPTIONS/);
    expect(page).toMatch(/signupInterest/);
    expect(page).toMatch(/required:\s*["']Please pick one["']/);
  });

  it("auth action stores signupInterest only when parse accepts it", () => {
    const action = read("lib/actions/auth.actions.ts");
    expect(action).toMatch(/parseSignupInterest/);
    expect(action).toMatch(/signupInterest/);
    expect(action).toMatch(/signupInterestAt/);
  });
});
