import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GM_SUSPENDED_ERROR_CODE,
  GM_SUSPENDED_MESSAGE,
  isSuspendedSubscription,
} from "@/lib/services/gamemaster/suspended-subscription";

// Reason: an admin-suspended Game Master bought a cheaper package and the purchase set the
// subscription back to "active". Suspended is neither active nor expired, so every rule that
// sorted subscriptions into those two buckets let it through. These tests pin that each
// player route touching a GM package refuses a suspended subscription BEFORE it moves money
// or writes the subscription.

function readCode(relativePath: string): string {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function firstIndex(code: string, needle: string): number {
  const index = code.indexOf(needle);
  expect(index, `expected to find ${needle}`).toBeGreaterThan(-1);
  return index;
}

const CHECK = "isSuspendedSubscription(";

describe("isSuspendedSubscription", () => {
  it("is true only for a suspended subscription", () => {
    expect(isSuspendedSubscription({ status: "suspended" })).toBe(true);
    for (const status of ["active", "expired", "cancelled", undefined]) {
      expect(isSuspendedSubscription({ status })).toBe(false);
    }
    expect(isSuspendedSubscription(null)).toBe(false);
    expect(isSuspendedSubscription(undefined)).toBe(false);
  });

  it("tells the player the subscription is suspended and who can lift it", () => {
    expect(GM_SUSPENDED_ERROR_CODE).toBe("GM_SUSPENDED");
    expect(GM_SUSPENDED_MESSAGE).toMatch(/suspended/i);
    expect(GM_SUSPENDED_MESSAGE).toMatch(/admin/i);
  });
});

describe("marketplace purchase refuses a suspended Game Master", () => {
  const code = readCode("app/api/marketplace/purchase/route.ts");

  it("refuses before the wallet is read and before the contact-us gate", () => {
    const check = firstIndex(code, CHECK);
    expect(check).toBeLessThan(firstIndex(code, "CreditWallet.findOne("));
    expect(check).toBeLessThan(firstIndex(code, "mustContactUsToBuy("));
  });

  it("re-checks the subscription it is about to overwrite", () => {
    const load = firstIndex(code, "const existingSubscription = await GameMasterSubscription.findOne(");
    const recheck = code.indexOf(CHECK + "existingSubscription)", load);
    expect(recheck).toBeGreaterThan(load);
    expect(recheck).toBeLessThan(code.indexOf('existingSubscription.status = "active"', load));
  });

  it("returns the suspended error code on both refusals", () => {
    expect(code.split("errorCode: GM_SUSPENDED_ERROR_CODE").length - 1).toBe(2);
  });
});

describe("renew refuses a suspended Game Master", () => {
  const code = readCode("app/api/gamemaster/renew/route.ts");

  it("refuses before the expiry check and before the wallet is read", () => {
    const check = firstIndex(code, CHECK);
    expect(check).toBeLessThan(firstIndex(code, "const isExpired"));
    expect(check).toBeLessThan(firstIndex(code, "CreditWallet.findOne("));
  });
});

describe("delete refuses a suspended Game Master", () => {
  const code = readCode("app/api/gamemaster/delete/route.ts");

  it("refuses before the subscription is marked cancelled", () => {
    expect(firstIndex(code, CHECK)).toBeLessThan(
      firstIndex(code, 'subscription.status = "cancelled"'),
    );
  });
});

describe("activate names the suspension", () => {
  const code = readCode("app/api/gamemaster/activate/route.ts");

  it("refuses a suspended subscription before the generic already-have-one refusal", () => {
    expect(firstIndex(code, CHECK)).toBeLessThan(
      firstIndex(code, "!isRevokedSubscription(existingSubscription)"),
    );
  });
});
