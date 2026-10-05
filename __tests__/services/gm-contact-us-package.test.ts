import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  contactUsChatHref,
  isContactUsPackage,
  isUnlockedForUser,
  mustContactUsToBuy,
} from "@/lib/services/gamemaster/contact-us-package";

/**
 * "Contact us" Game Master packages: a package an operator marks contact-us cannot be bought;
 * an operator can enable it for one Game Master, who then sees the normal buy button.
 */

const ROOT = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const USER = "64b7f0c2a1b2c3d4e5f60718";
const OTHER = "64b7f0c2a1b2c3d4e5f60719";

describe("contact-us package rule", () => {
  it("only an explicit true on a GM package is contact-us", () => {
    expect(isContactUsPackage({ category: "gamemaster", gameMasterConfig: { contactUsOnly: true } })).toBe(true);
    expect(isContactUsPackage({ category: "gamemaster", gameMasterConfig: {} })).toBe(false);
    expect(isContactUsPackage({ category: "gamemaster", gameMasterConfig: { contactUsOnly: false } })).toBe(false);
    expect(isContactUsPackage({ category: "indicator", gameMasterConfig: { contactUsOnly: true } })).toBe(false);
    expect(isContactUsPackage(null)).toBe(false);
  });

  it("an unlock applies to the named player only", () => {
    const item = {
      category: "gamemaster",
      gameMasterConfig: { contactUsOnly: true },
      contactUsUnlockedUserIds: [USER],
    };
    expect(isUnlockedForUser(item, USER)).toBe(true);
    expect(mustContactUsToBuy(item, USER)).toBe(false);
    expect(mustContactUsToBuy(item, OTHER)).toBe(true);
    expect(mustContactUsToBuy(item, null)).toBe(true);
  });

  it("an ordinary GM package is bought as before", () => {
    expect(mustContactUsToBuy({ category: "gamemaster", gameMasterConfig: {} }, USER)).toBe(false);
  });

  it("the chat link opens support with the package named", () => {
    const href = contactUsChatHref("Gold Pack");
    expect(href.startsWith("/messaging?support=1&topic=")).toBe(true);
    expect(decodeURIComponent(href.split("topic=")[1])).toContain('"Gold Pack"');
  });

  it("the helper is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/services/gamemaster/contact-us-package.ts")).toBe(
      read("lib/services/gamemaster/contact-us-package.ts"),
    );
  });
});

describe("contact-us wiring", () => {
  it("the purchase route refuses a contact-us package before any wallet read", () => {
    const src = stripComments(read("app/api/marketplace/purchase/route.ts"));
    const gate = src.indexOf("mustContactUsToBuy(item, userId)");
    const wallet = src.indexOf("CreditWallet.findOne");
    expect(gate).toBeGreaterThan(-1);
    expect(wallet).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(wallet);
    expect(src).toContain('.select("+contactUsUnlockedUserIds")');
  });

  it("the player list never sends the unlock list to the browser", () => {
    const src = stripComments(read("app/api/marketplace/route.ts"));
    expect(src).toMatch(/const\s*\{\s*contactUsUnlockedUserIds:\s*_\w+,\s*\.\.\.publicItem\s*\}\s*=\s*item/);
    expect(src).toContain("gameMasterContactUs = mustContactUsToBuy(item, userId)");
  });

  it("the package editor can neither overwrite the unlock list nor store a non-boolean switch", () => {
    const src = stripComments(read("apps/admin/app/api/marketplace/route.ts"));
    expect(src).toContain("delete data.contactUsUnlockedUserIds");
    expect(src).toContain("delete updates.contactUsUnlockedUserIds");
    expect(src).toContain("isOptionalBoolean(data.gameMasterConfig?.contactUsOnly)");
    expect(src).toContain("isOptionalBoolean(updates.gameMasterConfig?.contactUsOnly)");
  });

  it("the unlock route guards every handler with the Game Master section", () => {
    const src = stripComments(read("apps/admin/app/api/gamemasters/[id]/package-unlocks/route.ts"));
    const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const guards = src.match(/guardSection\("gamemaster-management"\)/g) ?? [];
    const refusals = src.match(/if \(!guard\.ok\) return guard\.response/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
    expect(refusals.length).toBe(handlers.length);
    expect(src).toContain("isContactUsPackage(item)");
  });

  it("the unlock list is hidden from ordinary reads in both model copies", () => {
    for (const path of [
      "database/models/marketplace/marketplace-item.model.ts",
      "apps/admin/database/models/marketplace/marketplace-item.model.ts",
    ]) {
      expect(stripComments(read(path))).toMatch(
        /contactUsUnlockedUserIds:\s*\{[^}]*select:\s*false/,
      );
    }
  });

  it("every Game Master buy button on the marketplace offers Contact us", () => {
    const src = stripComments(read("app/(root)/marketplace/page-content.tsx"));
    expect(src.match(/item\.gameMasterContactUs \?/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(src).toContain("router.push(contactUsChatHref(item.name))");
  });
});
