import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestMongo, stopTestMongo } from "../helpers/mongo-test-server";

let headerCountry: string | null = null;
// Reason: the test harness owns the connection; the real helper would reconnect to
// MONGODB_URI, which is unset here, and the service would fall back to "allow".
vi.mock("@/database/mongoose", () => ({ connectToDatabase: vi.fn(async () => undefined) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(headerCountry ? { "cf-ipcountry": headerCountry } : {}),
}));

import {
  evaluateGeoAccess,
  GEO_RESTRICTED_ENTRY_MESSAGE,
  GEO_RESTRICTED_REGISTER_MESSAGE,
  isCountryRestricted,
  normaliseCountryCode,
  type GeoRestrictionFacts,
} from "@/lib/services/geo/geo-access-rule";
import {
  checkGeoAccess,
  clearGeoRestrictionCache,
} from "@/lib/services/geo/geo-restriction.service";
import GeoRestrictionSettings from "@/database/models/geo-restriction-settings.model";
import { validateGeoRestrictionUpdate } from "@/apps/admin/lib/admin/geo-restriction-update";

/**
 * Geo-gate (legal opinion s9 item 7): sign-up and paid entry refused in markets that have
 * not been reviewed. Two countries are consulted - the network one (Cloudflare) and the
 * declared one (profile) - and either restricted refuses. The structural half pins that
 * every paid door actually asks, because a rule nothing calls is the failure this
 * codebase keeps finding.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const LIVE: GeoRestrictionFacts = {
  enabled: true,
  restrictedCountries: ["US", "FR"],
  blockRegistration: true,
  blockPaidEntry: true,
  blockUnknownNetworkCountry: false,
};

describe("evaluateGeoAccess - the pure rule", () => {
  it("allows everything while the rule is disabled, whatever the list says", () => {
    const r = evaluateGeoAccess({ ...LIVE, enabled: false }, "paid_entry", {
      networkCountry: "US",
      declaredCountry: "US",
    });
    expect(r).toEqual({ allowed: true });
  });

  it("refuses on the NETWORK country even when the declared one is fine", () => {
    const r = evaluateGeoAccess(LIVE, "paid_entry", { networkCountry: "us", declaredCountry: "DE" });
    expect(r).toMatchObject({ allowed: false, code: "GEO_RESTRICTED", basis: "network", country: "US" });
  });

  it("refuses on the DECLARED country when the network one is fine (VPN case)", () => {
    const r = evaluateGeoAccess(LIVE, "register", { networkCountry: "DE", declaredCountry: "fr" });
    expect(r).toMatchObject({ allowed: false, basis: "declared", country: "FR" });
    if (!r.allowed) expect(r.message).toBe(GEO_RESTRICTED_REGISTER_MESSAGE);
  });

  it("uses the entry message for paid entry", () => {
    const r = evaluateGeoAccess(LIVE, "paid_entry", { networkCountry: "US" });
    if (r.allowed) throw new Error("expected refusal");
    expect(r.message).toBe(GEO_RESTRICTED_ENTRY_MESSAGE);
  });

  it("each scope switch turns off only its own action", () => {
    const noReg = { ...LIVE, blockRegistration: false };
    expect(evaluateGeoAccess(noReg, "register", { networkCountry: "US" }).allowed).toBe(true);
    expect(evaluateGeoAccess(noReg, "paid_entry", { networkCountry: "US" }).allowed).toBe(false);
    const noEntry = { ...LIVE, blockPaidEntry: false };
    expect(evaluateGeoAccess(noEntry, "paid_entry", { networkCountry: "US" }).allowed).toBe(true);
    expect(evaluateGeoAccess(noEntry, "register", { networkCountry: "US" }).allowed).toBe(false);
  });

  it("an unknown network country is allowed unless blockUnknownNetworkCountry is on", () => {
    for (const unknown of [undefined, null, "", "XX", "T1", "zzz"]) {
      expect(evaluateGeoAccess(LIVE, "paid_entry", { networkCountry: unknown }).allowed).toBe(true);
      const strict = evaluateGeoAccess({ ...LIVE, blockUnknownNetworkCountry: true }, "paid_entry", {
        networkCountry: unknown,
      });
      expect(strict).toMatchObject({ allowed: false, code: "GEO_UNKNOWN", basis: "unknown" });
    }
  });

  it("an unrestricted country passes", () => {
    expect(
      evaluateGeoAccess({ ...LIVE, blockUnknownNetworkCountry: true }, "paid_entry", {
        networkCountry: "DE",
        declaredCountry: "GB",
      }),
    ).toEqual({ allowed: true });
  });

  it("normaliseCountryCode and isCountryRestricted", () => {
    expect(normaliseCountryCode(" gb ")).toBe("GB");
    expect(normaliseCountryCode("XX")).toBeUndefined();
    expect(normaliseCountryCode("T1")).toBeUndefined();
    expect(normaliseCountryCode(42)).toBeUndefined();
    expect(isCountryRestricted(LIVE, "us")).toBe(true);
    expect(isCountryRestricted(LIVE, "DE")).toBe(false);
    expect(isCountryRestricted({ ...LIVE, enabled: false }, "US")).toBe(false);
  });
});

describe("validateGeoRestrictionUpdate - the admin edit", () => {
  it("accepts booleans and normalises codes", () => {
    const r = validateGeoRestrictionUpdate({ enabled: true, restrictedCountries: ["fr", "US", "fr"] });
    expect(r).toEqual({ ok: true, update: { enabled: true, restrictedCountries: ["FR", "US"] } });
  });

  it("refuses an unknown field by name, including a prototype key", () => {
    expect(validateGeoRestrictionUpdate({ enabled: true, extra: 1 })).toEqual({
      ok: false,
      error: "Unknown field: extra",
    });
    expect(validateGeoRestrictionUpdate(JSON.parse('{"constructor": true}'))).toMatchObject({ ok: false });
  });

  it("refuses a malformed code rather than dropping it", () => {
    expect(validateGeoRestrictionUpdate({ restrictedCountries: ["USA"] })).toMatchObject({ ok: false });
    expect(validateGeoRestrictionUpdate({ restrictedCountries: "US" })).toMatchObject({ ok: false });
  });

  it("refuses a non-boolean switch and an empty edit", () => {
    expect(validateGeoRestrictionUpdate({ enabled: "yes" })).toMatchObject({ ok: false });
    expect(validateGeoRestrictionUpdate({})).toMatchObject({ ok: false });
    expect(validateGeoRestrictionUpdate([])).toMatchObject({ ok: false });
  });
});

describe("checkGeoAccess - the server half against a real database", () => {
  beforeAll(async () => {
    await startTestMongo();
  });
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    headerCountry = null;
    clearGeoRestrictionCache();
    await GeoRestrictionSettings.deleteMany({});
    await mongoose.connection.db!.collection("user").deleteMany({});
  });

  it("allows when no settings document exists (deploy changes nothing)", async () => {
    headerCountry = "US";
    expect(await checkGeoAccess("paid_entry", {})).toEqual({ allowed: true });
  });

  it("refuses by the Cloudflare header", async () => {
    await GeoRestrictionSettings.create({ enabled: true, restrictedCountries: ["us"] });
    headerCountry = "US";
    expect(await checkGeoAccess("register", { declaredCountry: "DE" })).toMatchObject({
      allowed: false,
      basis: "network",
    });
  });

  it("reads the declared country off the user row by _id (R68) and by id", async () => {
    await GeoRestrictionSettings.create({ enabled: true, restrictedCountries: ["FR"] });
    headerCountry = "DE";
    const byObjectId = new mongoose.Types.ObjectId();
    const users = mongoose.connection.db!.collection("user");
    await users.insertOne({ _id: byObjectId, email: "a@x.test", country: "FR" });
    await users.insertOne({ id: "legacy-id", email: "b@x.test", country: "FR" });
    await users.insertOne({ _id: new mongoose.Types.ObjectId(), id: "ok", email: "c@x.test", country: "GB" });

    expect(await checkGeoAccess("paid_entry", { userId: byObjectId.toHexString() })).toMatchObject({
      allowed: false,
      basis: "declared",
    });
    expect(await checkGeoAccess("paid_entry", { userId: "legacy-id" })).toMatchObject({ allowed: false });
    expect(await checkGeoAccess("paid_entry", { userId: "ok" })).toEqual({ allowed: true });
  });

  it("the model setter normalises codes", async () => {
    const doc = await GeoRestrictionSettings.create({ restrictedCountries: ["fr", "x", "US", "fr", 3] });
    expect(doc.restrictedCountries).toEqual(["FR", "US"]);
  });
});

describe("every paid door asks the geo gate", () => {
  it("sign-up asks before validating the registration", () => {
    const src = code("lib/actions/auth.actions.ts");
    const gate = src.indexOf('checkGeoAccess("register"');
    expect(gate).toBeGreaterThan(-1);
    const validation = src.indexOf("validateRegistration(", src.lastIndexOf("signUpWithEmail", gate));
    expect(validation).toBeGreaterThan(gate);
    expect(src.slice(gate, gate + 300)).toMatch(/if \(!geo\.allowed\)[\s\S]*success: false/);
  });

  it("competition entry asks, for funded and fee-paying seats, before the wallet read", () => {
    const src = code("lib/services/contest-entry.service.ts");
    const gate = src.indexOf('checkGeoAccess("paid_entry"');
    expect(gate).toBeGreaterThan(-1);
    expect(src.slice(gate - 200, gate)).toMatch(/!actor\.trusted && \(funded \|\| entryFee > 0\)/);
    const walletRead = src.indexOf("CreditWallet.findOne", gate);
    expect(walletRead).toBeGreaterThan(gate);
    expect(src.slice(0, gate)).not.toContain("CreditWallet.findOne");
    expect(src.slice(gate, gate + 300)).toContain('fail("geo_restricted"');
    expect(code("app/api/competitions/[id]/join/route.ts")).toMatch(/geo_restricted:\s*403/);
  });

  it("challenge create asks inside the non-simulator guard block", () => {
    const src = code("app/api/challenges/route.ts");
    const gate = src.indexOf('checkGeoAccess("paid_entry"');
    expect(gate).toBeGreaterThan(src.indexOf("assertEntryFraudGate"));
    expect(src.slice(gate, gate + 200)).toContain("errorResponse(geo.message, 403)");
  });

  it("challenge accept asks before any wallet read and aborts the transaction", () => {
    const src = code("app/api/challenges/[id]/accept/route.ts");
    const gate = src.indexOf('checkGeoAccess("paid_entry"');
    expect(gate).toBeGreaterThan(-1);
    expect(src.slice(0, gate)).not.toContain("CreditWallet.findOne");
    expect(src.slice(gate, gate + 250)).toContain("dbSession.abortTransaction()");
  });

  it("both sign-up forms hide restricted countries from the list", () => {
    for (const f of ["components/auth/desktop/DesktopRegister.tsx", "components/auth/mobile/MobileRegister.tsx"]) {
      expect(code(f)).toContain("excludeCodes={registrationGeo.restrictedCountries}");
    }
    expect(code("components/forms/CountrySelectField.tsx")).toContain("excludeCodes");
  });

  it("the public status endpoint never returns the caller's IP", () => {
    const src = code("app/api/geo/registration-status/route.ts");
    expect(src).not.toMatch(/\bip\b\s*:/i);
    expect(src).not.toContain("x-forwarded-for");
  });
});

describe("admin wiring", () => {
  it("the route guards every exported handler with geo-restrictions", () => {
    const src = code("apps/admin/app/api/geo-restrictions/route.ts");
    const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const guards = src.match(/guardSection\("geo-restrictions"\)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
  });

  it("the section id is on the enum, the catalog and the dashboard", () => {
    expect(read("apps/admin/database/models/admin-employee.model.ts")).toContain('"geo-restrictions"');
    expect(read("apps/admin/lib/admin/admin-section-catalog.ts")).toContain('"geo-restrictions"');
    const dash = read("apps/admin/components/admin/AdminDashboard.tsx");
    expect(dash).toContain('id: "geo-restrictions"');
    expect(dash).toContain('case "geo-restrictions":');
  });

  it("the settings model is byte-identical in both apps", () => {
    expect(read("apps/admin/database/models/geo-restriction-settings.model.ts")).toBe(
      read("database/models/geo-restriction-settings.model.ts"),
    );
  });

  it("no geo service is reachable from a client component in a value import", () => {
    const dir = join(ROOT, "apps/admin/components/admin");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    for (const f of files) {
      expect(read(`apps/admin/components/admin/${f}`)).not.toContain("geo-restriction.service");
    }
  });
});
