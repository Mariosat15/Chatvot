/**
 * A newly registered employee can sign in, and the ready-made role templates offer every
 * section the admin panel has.
 *
 * Reason (login): the login route signed its token with no `iat`. jose adds none unless
 * `.setIssuedAt()` is called, and check-session read the missing value as the 1970 epoch -
 * so any stored `forceLogoutAt` or `passwordChangedAt` (both written by Reset Password,
 * disable and lock) made every new session look older than the logout and redirected the
 * employee to /login on the first poll. Unlocking cleared `forceLogoutAt`, which is why
 * "lock, then unlock" was the owner's workaround.
 *
 * Reason (templates): the defaults were inserted once into an empty collection, so every
 * section added afterwards never reached a stored template, and the section picker carried
 * its own label table that had fallen 14 sections behind ADMIN_SECTIONS.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { stripComments } from "../helpers/route-guard-audit";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";
import { wasIssuedBefore } from "../../apps/admin/lib/admin/session-token-time";
import {
  ADMIN_SECTION_GROUPS,
  ADMIN_SECTION_LABELS,
  adminSectionLabel,
} from "../../apps/admin/lib/admin/admin-section-catalog";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
import { Admin } from "../../apps/admin/database/models/admin.model";
import {
  AdminRoleTemplate,
  DEFAULT_ROLE_TEMPLATES,
} from "../../apps/admin/database/models/admin-role-template.model";
import { syncDefaultRoleTemplates } from "../../apps/admin/lib/admin/default-role-templates";

const ROOT = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

describe("wasIssuedBefore - when a session predates a logout or password change", () => {
  const moment = new Date("2026-10-03T10:00:00.500Z");
  const momentSeconds = Math.floor(moment.getTime() / 1000);

  it("refuses a token with no iat whenever a moment is stored (fails closed)", () => {
    expect(wasIssuedBefore(undefined, moment)).toBe(true);
    expect(wasIssuedBefore("123", moment)).toBe(true);
  });

  it("accepts a token issued in the same second as the moment", () => {
    expect(wasIssuedBefore(momentSeconds, moment)).toBe(false);
  });

  it("refuses a token issued before the moment and accepts one after it", () => {
    expect(wasIssuedBefore(momentSeconds - 1, moment)).toBe(true);
    expect(wasIssuedBefore(momentSeconds + 1, moment)).toBe(false);
  });

  it("applies no rule when nothing is stored", () => {
    expect(wasIssuedBefore(undefined, undefined)).toBe(false);
    expect(wasIssuedBefore(undefined, null)).toBe(false);
    expect(wasIssuedBefore(undefined, "not a date")).toBe(false);
  });
});

describe("the session token and the checks that read it", () => {
  it("the login route stamps iat on the token it signs", () => {
    const code = read("apps/admin/app/api/auth/login/route.ts");
    const start = code.indexOf("new SignJWT(");
    const end = code.indexOf(".sign(", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(code.slice(start, end)).toContain(".setIssuedAt()");
  });

  it("the login route grants a super admin the real section list, not a stale copy", () => {
    const code = read("apps/admin/app/api/auth/login/route.ts");
    expect(code).toContain("[...ADMIN_SECTIONS]");
    expect(code).not.toContain("ALL_ADMIN_SECTIONS");
  });

  it("check-session decides both invalidations through the shared helper", () => {
    const code = read("apps/admin/app/api/auth/check-session/route.ts");
    expect(code).toContain("wasIssuedBefore(payload.iat, admin.forceLogoutAt)");
    expect(code).toContain("wasIssuedBefore(payload.iat, admin.passwordChangedAt)");
    expect(code).not.toMatch(/payload\.iat\s*\|\|/);
  });

  it("verifyAdminAuth applies the same two rules server-side", () => {
    const code = read("apps/admin/lib/admin/auth.ts");
    expect(code).toContain("wasIssuedBefore(payload.iat, admin.forceLogoutAt)");
    expect(code).toMatch(/wasIssuedBefore\(\s*payload\.iat,\s*\(admin[^)]*\)\.passwordChangedAt/);
    expect(code).not.toMatch(/if\s*\(\s*payload\.iat\s*&&/);
  });
});

describe("the section catalogue behind the picker and the credentials email", () => {
  it("labels every section and files each in exactly one group", () => {
    const grouped = Object.values(ADMIN_SECTION_GROUPS).flat();
    for (const section of ADMIN_SECTIONS) {
      expect(Object.prototype.hasOwnProperty.call(ADMIN_SECTION_LABELS, section)).toBe(true);
      expect(grouped.filter((s) => s === section)).toHaveLength(1);
    }
    expect(grouped).toHaveLength(ADMIN_SECTIONS.length);
  });

  it("offers no grant that maps to no screen", () => {
    expect(Object.values(ADMIN_SECTION_GROUPS).flat()).not.toContain("trading-menu");
  });

  it("does not resolve inherited keys as labels", () => {
    expect(adminSectionLabel("constructor")).toBe("constructor");
  });

  it("the employees screen reads the shared catalogue rather than its own table", () => {
    const code = read("apps/admin/components/admin/EmployeesSection.tsx");
    expect(code).toContain("@/lib/admin/admin-section-catalog");
    expect(code).not.toMatch(/const SECTION_GROUPS\s*[:=]\s*(Record|\{)/);
    expect(code).not.toMatch(/const SECTION_LABELS\s*[:=]/);
  });

  it("the credentials email labels sections from the shared catalogue", () => {
    const code = read("apps/admin/app/api/employees/route.ts");
    expect(code).toContain("adminSectionLabel(s)");
    expect(code).not.toMatch(/const sectionLabels\s*[:=]/);
  });
});

describe("the ready-made role templates", () => {
  it("Full Admin carries every section, employees included", () => {
    const full = DEFAULT_ROLE_TEMPLATES.find((t) => t.name === "Full Admin");
    expect([...(full?.allowedSections ?? [])].sort()).toEqual([...ADMIN_SECTIONS].sort());
  });

  it("both entry points sync the defaults rather than inserting into an empty collection", () => {
    for (const rel of [
      "apps/admin/app/api/employees/route.ts",
      "apps/admin/app/api/employees/role-templates/route.ts",
    ]) {
      const code = read(rel);
      expect(code).toContain("await syncDefaultRoleTemplates()");
      expect(code).not.toContain("insertMany(DEFAULT_ROLE_TEMPLATES)");
    }
  });
});

describe("syncDefaultRoleTemplates", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["adminroletemplates", "admins"]);
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
  });

  const backoffice = () => DEFAULT_ROLE_TEMPLATES.find((t) => t.name === "Backoffice")!;

  it("creates every missing default on an empty collection", async () => {
    const result = await syncDefaultRoleTemplates();
    expect(result.created.sort()).toEqual(DEFAULT_ROLE_TEMPLATES.map((t) => t.name).sort());
    const stored = await AdminRoleTemplate.findOne({ name: "Full Admin" }).lean();
    expect([...(stored?.allowedSections ?? [])].sort()).toEqual([...ADMIN_SECTIONS].sort());
  });

  it("adds a section the code gained to an old template and to its employees", async () => {
    const def = backoffice();
    const old = def.allowedSections.filter((s) => s !== "tutorials");
    const template = await AdminRoleTemplate.create({ ...def, allowedSections: old });
    await Admin.collection.insertOne({
      email: "emp@example.com",
      name: "Emp",
      password: "x",
      roleTemplateId: template._id,
      allowedSections: old,
    });

    const result = await syncDefaultRoleTemplates();

    expect(result.sectionsAdded.Backoffice).toEqual(["tutorials"]);
    const stored = await AdminRoleTemplate.findById(template._id).lean();
    expect(stored?.allowedSections).toContain("tutorials");
    const employee = await Admin.collection.findOne({ email: "emp@example.com" });
    expect(employee?.allowedSections).toContain("tutorials");
  });

  it("does not put back a section a super admin removed after it was offered", async () => {
    await syncDefaultRoleTemplates();
    await AdminRoleTemplate.updateOne(
      { name: "Backoffice" },
      { $pull: { allowedSections: "tutorials" } },
    );

    const result = await syncDefaultRoleTemplates();

    expect(result.sectionsAdded.Backoffice).toBeUndefined();
    const stored = await AdminRoleTemplate.findOne({ name: "Backoffice" }).lean();
    expect(stored?.allowedSections).not.toContain("tutorials");
  });

  it("leaves an operator's own template that shares a default's name alone", async () => {
    await AdminRoleTemplate.create({
      name: "Backoffice",
      allowedSections: ["overview"],
      isDefault: false,
      createdBy: "operator",
    });

    await syncDefaultRoleTemplates();

    const stored = await AdminRoleTemplate.findOne({ name: "Backoffice" }).lean();
    expect(stored?.allowedSections).toEqual(["overview"]);
  });

  it("is idempotent", async () => {
    await syncDefaultRoleTemplates();
    const second = await syncDefaultRoleTemplates();
    expect(second).toEqual({ created: [], sectionsAdded: {} });
  });
});
