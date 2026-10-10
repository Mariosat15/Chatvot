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

// Reason: a suspension does not pause the pack's clock, so a pack can run out while suspended.
// Reactivate used to refuse it outright, and the player's routes refuse a suspended pack, so
// nobody could release that Game Master. Reactivate now lands it on "expired".
describe("admin reactivate releases a pack that expired while suspended", () => {
  const code = readCode("apps/admin/app/api/gamemasters/[id]/route.ts");
  const start = firstIndex(code, 'case "reactivate":');
  const branch = code.slice(start, firstIndex(code, 'case "update_limits":'));

  it("never refuses because the end date has passed", () => {
    expect(branch).not.toMatch(/Cannot reactivate expired/);
  });

  it("refuses anything that is not suspended", () => {
    expect(branch).toMatch(/subscription\.status !== "suspended"/);
  });

  it("an expired-while-suspended pack becomes expired, never active", () => {
    const expiredCheck = firstIndex(branch, "new Date(subscription.endDate) < now");
    const expiredWrite = branch.indexOf('status: "expired"', expiredCheck);
    const activeWrite = branch.indexOf('status: "active"', expiredCheck);
    expect(expiredWrite).toBeGreaterThan(expiredCheck);
    expect(expiredWrite).toBeLessThan(activeWrite);
    expect(branch.slice(expiredCheck, activeWrite)).toMatch(/return NextResponse\.json/);
  });

  it("ends the player's Contact-us permissions as the worker's expiry does", () => {
    const expiredCheck = firstIndex(branch, "new Date(subscription.endDate) < now");
    const activeWrite = firstIndex(branch, 'status: "active"');
    expect(branch.slice(expiredCheck, activeWrite)).toContain(
      "await disableAllContactUsPackagesForUser(",
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
