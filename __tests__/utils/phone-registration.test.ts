import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parsePhoneInput,
  parseOptionalPhoneInput,
  dialCodeFor,
  isE164Phone,
} from "@/lib/utils/phone";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("phone normalisation (registration)", () => {
  it("normalises national and international forms of one Cyprus number to the same E.164", () => {
    const a = parsePhoneInput("99 123456", "CY");
    const b = parsePhoneInput("+35799123456", "CY");
    const c = parsePhoneInput("0035799123456", "CY");
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(a.e164).toBe("+35799123456");
      expect(b.e164).toBe(a.e164);
      expect(c.e164).toBe(a.e164);
      expect(a.country).toBe("CY");
    }
  });

  it("refuses an impossible national number for the chosen country", () => {
    const bad = parsePhoneInput("12", "CY");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.toLowerCase()).toMatch(/valid|not valid/);
    }
  });

  it("refuses a blank required number and treats blank as clear when optional", () => {
    expect(parsePhoneInput("").ok).toBe(false);
    const cleared = parseOptionalPhoneInput("  ");
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.e164).toBeNull();
    }
  });

  it("exposes a dial code for a supported country and none for garbage", () => {
    expect(dialCodeFor("CY")).toBe("+357");
    expect(dialCodeFor("US")).toBe("+1");
    expect(dialCodeFor("XX")).toBeNull();
  });

  it("recognises a stored E.164 and rejects free text", () => {
    expect(isE164Phone("+35799123456")).toBe(true);
    expect(isE164Phone("99 123456")).toBe(false);
    expect(isE164Phone("")).toBe(false);
  });

  it("sign-up form requires phoneCountry and phoneNational via PhoneInputField", () => {
    // Reason: the sign-up page only switches between desktop and mobile forms;
    // the field lives in the desktop form and its defaults in the shared hook.
    const page = stripComments(
      read("components/auth/desktop/DesktopRegister.tsx") + read("hooks/useSignUpForm.ts"),
    );
    // Reason: a commented-out tag still contains the identifier; require the JSX
    // open tag. Count so a second unused import cannot cover a removal.
    expect(page).toMatch(/<PhoneInputField[\s\S]*?required/);
    expect((page.match(/PhoneInputField/g) || []).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(page).toMatch(/phoneCountry:\s*""/);
    expect(page).toMatch(/phoneNational:\s*""/);
  });

  it("auth action parses phone, refuses duplicates, and stores E.164 plus unverified flags", () => {
    const action = stripComments(read("lib/actions/auth.actions.ts"));
    expect(action).toMatch(/parsePhoneInput\(phoneNational,\s*phoneCountry\)/);
    expect(action).toMatch(/assertPhoneAvailable\(phoneParsed\.e164\)/);
    // Reason: position — the store must use the parsed E.164, not the raw national digits.
    const phoneSet = action.indexOf("phone: phoneParsed.e164");
    expect(phoneSet).toBeGreaterThan(-1);
    expect(action.indexOf("phoneVerified: false")).toBeGreaterThan(phoneSet);
    expect(action).toMatch(/phoneCountry:\s*phoneParsed\.country/);
    // Must not create the account before the phone check.
    // Reason: indexOf("assertPhoneAvailable") hits the import first and stays green
    // when a second signUpEmail is injected above the real call.
    const createAt = action.indexOf("auth.api.signUpEmail");
    const checkAt = action.indexOf("assertPhoneAvailable(phoneParsed");
    expect(checkAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(-1);
    expect(checkAt).toBeLessThan(createAt);
  });

  it("profile route re-validates phone and refuses a taken number", () => {
    const profile = stripComments(read("app/api/user/profile/route.ts"));
    expect(profile).toMatch(/parseOptionalPhoneInput/);
    // Reason: assert the call with its exclude-self argument, not the import line.
    // Newlines between arguments are intentional formatting — allow them.
    expect(profile).toMatch(
      /assertPhoneAvailable\(\s*parsed\.e164[\s\S]*?session\.user\.id/,
    );
    expect(profile).toMatch(/phoneVerifiedAt/);
  });

  it("admin edit route re-validates phone and refuses a taken number", () => {
    const adminEdit = stripComments(
      read("apps/admin/app/api/users/edit/route.ts"),
    );
    expect(adminEdit).toMatch(/parseOptionalPhoneInput/);
    expect(adminEdit).toMatch(
      /assertPhoneAvailable\(\s*parsed\.e164\s*,\s*userId\s*\)/,
    );
  });

  it("Game Master referral view never exposes phone; admin CSV does", () => {
    const gmView = stripComments(
      read("lib/services/gamemaster/gm-referral-view.ts"),
    );
    expect(gmView).not.toMatch(/\bphone\b/);
    expect(gmView).toMatch(/\bcountry\b/);

    const csv = stripComments(read("apps/admin/lib/admin/gm-report-csv.ts"));
    expect(csv).toMatch(/Player phone/);
    expect(csv).toMatch(/r\.phone/);
  });

  it("admin phone utility stays byte-identical to the main copy", () => {
    const main = read("lib/utils/phone.ts");
    const admin = read("apps/admin/lib/utils/phone.ts");
    expect(admin).toBe(main);
    const mainU = read("lib/services/phone-uniqueness.service.ts");
    const adminU = read("apps/admin/lib/services/phone-uniqueness.service.ts");
    expect(adminU).toBe(mainU);
  });
});
