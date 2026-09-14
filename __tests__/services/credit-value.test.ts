import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY,
  DEFAULT_EUR_TO_CREDITS_RATE,
  creditValueInBaseCurrency,
  resolveEurToCreditsRate,
} from "@/lib/utils/credit-value";

/*
  R74 — what a credit is worth, from one stored number.

  The platform stored the answer twice and the two defaults disagreed by a factor of a
  hundred: `CreditConversionSettings.eurToCreditsRate` at 100 credits = EUR 1, which every
  path that moves money reads, and `AppSettings.credits.valueInEUR` at 1 credit = EUR 1,
  which drove every figure a player was shown. A player holding 1,000 credits was shown
  EUR 1,000.00 and could withdraw EUR 10.

  These tests are mostly STRUCTURAL, deliberately. There is no wrong arithmetic to assert
  on — both numbers were computed correctly from the source each site happened to pick —
  so what has to be pinned is WHICH source each site picks.
*/

const root = join(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

/** Match the source with comments removed. */
function readCode(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("resolveEurToCreditsRate", () => {
  it("returns the stored rate when it is usable", () => {
    expect(resolveEurToCreditsRate(250)).toBe(250);
    expect(resolveEurToCreditsRate("250")).toBe(250);
  });

  /*
    // Reason: `|| DEFAULT` would catch 0 and NaN by accident and MISS a negative, which is
    // neither falsy nor usable and would flip the sign of every conversion on the platform.
  */
  it.each([
    ["absent", undefined],
    ["null", null],
    ["an empty string", ""],
    ["not a number", "abc"],
    ["zero", 0],
    ["negative", -100],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("falls back to the default when the stored rate is %s", (_label, stored) => {
    expect(resolveEurToCreditsRate(stored)).toBe(DEFAULT_EUR_TO_CREDITS_RATE);
  });
});

describe("creditValueInBaseCurrency", () => {
  it("is the reciprocal of the rate, so 100 credits = 1", () => {
    expect(creditValueInBaseCurrency(100)).toBeCloseTo(0.01, 10);
    expect(1000 * creditValueInBaseCurrency(100)).toBeCloseTo(10, 10);
  });

  it("tracks a rate an operator has changed", () => {
    expect(creditValueInBaseCurrency(50)).toBeCloseTo(0.02, 10);
  });

  /*
    The defect in one assertion: a player's balance and their withdrawal must quote the same
    figure. The withdrawal route divides by the rate; the display multiplies by this value.
  */
  it("agrees with dividing by the rate, which is what the withdrawal route does", () => {
    for (const rate of [1, 10, 100, 250, 1000]) {
      const credits = 1234;
      expect(credits * creditValueInBaseCurrency(rate)).toBeCloseTo(
        credits / rate,
        10,
      );
    }
  });

  it("exports a default fallback equal to the default rate's value", () => {
    expect(DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY).toBe(
      creditValueInBaseCurrency(DEFAULT_EUR_TO_CREDITS_RATE),
    );
    expect(DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY).not.toBe(1);
  });
});

describe("the resolver is mirrored", () => {
  /*
    // Reason: `check:mirrors` compares MODELS. It has never had an opinion about a utility
    // module, so the only guarantee that the two copies agree is this comparison.
  */
  it("is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/utils/credit-value.ts")).toBe(
      read("lib/utils/credit-value.ts"),
    );
  });
});

describe("the settings routes serve a derived value", () => {
  /*
    Both routes are the single place that reaches every client conversion, because the
    context builds `creditsToEUR` / `eurToCredits` out of the field they serve.
  */
  it.each([
    ["the player app", "app/api/settings/route.ts"],
    ["the admin app", "apps/admin/app/api/settings/route.ts"],
  ])("%s derives valueInEUR from the rate", (_label, file) => {
    const code = readCode(file);
    /*
      // Reason: match the CALL with its argument, never the bare name. Both identifiers
      // appear on the import line, so `toMatch(/creditValueInBaseCurrency/)` stays green
      // against a route that imports the resolver and then hard-codes a number.
    */
    expect(code).toMatch(
      /creditValueInBaseCurrency\(\s*\n?\s*\w+\??\.?\w*\.eurToCreditsRate/,
    );
    expect(code).toMatch(/CreditConversionSettings\.getSingleton\(\)/);
  });

  /*
    The load-bearing half. A route that reads the rate and then serves the stored field
    anyway satisfies every assertion above, so pin that the served object OVERRIDES it.
  */
  it.each([
    ["the player app", "app/api/settings/route.ts"],
    ["the admin app", "apps/admin/app/api/settings/route.ts"],
  ])("%s overrides the stored field rather than reading it", (_label, file) => {
    const code = readCode(file);
    const override = /valueInEUR:\s*(derivedCreditValue|creditValueInBaseCurrency\()/;
    expect(code).toMatch(override);
    // The stored path must not be read back out anywhere.
    expect(code).not.toMatch(/settings\.credits\.valueInEUR/);
  });

  /*
    // Reason: with the PUT still writing the field, an operator saving any unrelated currency
    // setting persists the derived value into the collection that must not hold it — and a
    // stored 0.01 is indistinguishable from one somebody typed.
  */
  it("the admin PUT refuses to write valueInEUR", () => {
    const code = readCode("apps/admin/app/api/settings/route.ts");
    expect(code).toMatch(/valueInEUR:\s*_?\w+\s*,\s*\.\.\./);
    expect(code).not.toMatch(/settings\.credits\s*=\s*\{[^}]*updateData\.credits\s*\}/);
  });
});

describe("the help page no longer shows two answers", () => {
  /*
    `/help` renders the credit value AND the deposit rate, from what used to be two models,
    on one screen — which is why it was the clearest statement of the defect.
  */
  it("derives both figures from the one rate", () => {
    const code = readCode("app/api/help-settings/route.ts");
    expect(code).toMatch(
      /valueInEUR:\s*creditValueInBaseCurrency\(\s*creditSettings\.eurToCreditsRate/,
    );
    expect(code).toMatch(
      /eurToCreditsRate:\s*resolveEurToCreditsRate\(\s*creditSettings\.eurToCreditsRate/,
    );
  });
});

describe("no client fallback reinstates the hundredfold figure", () => {
  /*
    A fallback is a stored value as far as the player reading it is concerned. Every one of
    these used to be a hard-coded 1, so a slow or failed settings fetch put the old number
    back on screen, briefly and silently.
  */
  it.each([
    ["the player context", "contexts/AppSettingsContext.tsx"],
    ["the admin context", "apps/admin/contexts/AppSettingsContext.tsx"],
    ["the wallet balance", "components/trading/WalletBalanceDisplay.tsx"],
    ["the help page", "app/(root)/help/page-content.tsx"],
    [
      "the admin currency screen",
      "apps/admin/components/admin/CurrencySettingsSection.tsx",
    ],
  ])("%s falls back to the derived default", (_label, file) => {
    const code = readCode(file);
    expect(code).toMatch(/DEFAULT_CREDIT_VALUE_IN_BASE_CURRENCY/);
    expect(code).not.toMatch(/valueInEUR:\s*1(\.0)?\s*,/);
    expect(code).not.toMatch(/valueInEUR\s*\|\|\s*1\b/);
  });
});

describe("the admin currency screen offers one number, not two", () => {
  const file = "apps/admin/components/admin/CurrencySettingsSection.tsx";

  /*
    // Reason: an editable control here is a second stored number by another name. Leaving it
    // enabled means the fix holds only until the next operator saves the screen.
  */
  it("does not render an input bound to valueInEUR", () => {
    const code = readCode(file);
    const inputs = code.match(/<Input[\s\S]*?\/>/g) ?? [];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input).not.toMatch(/valueInEUR/);
    }
  });

  /*
    Withholding a control without saying where the value comes from teaches an operator the
    setting no longer exists. Name the screen that owns it.
  */
  it("points the operator at the rate instead", () => {
    const code = read(file);
    expect(code).toMatch(/Credit Conversion/);
  });
});
