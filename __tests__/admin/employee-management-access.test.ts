/**
 * Anyone granted the Employees section may manage employees and role templates.
 *
 * Reason: owner decision, 5 Oct 2026 - "Full Admin should be able to create other admins and
 * grant them anything". Until then every employee and template route refused unless the
 * caller was the ORIGINAL admin (ADMIN_EMAIL or the oldest account), whatever sections they
 * held, so Full Admin saw the Employees tab and every write came back "Only super admin can
 * manage employees". The original admin's own account stays protected from everyone else,
 * which is the half that must survive: a delegated manager must never be able to lock the
 * owner out.
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
import { Admin } from "../../apps/admin/database/models/admin.model";
import {
  canManageEmployees,
  isOriginalAdmin,
} from "../../apps/admin/lib/admin/employee-management-access";

const ROOT = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

const ROUTES = [
  "apps/admin/app/api/employees/route.ts",
  "apps/admin/app/api/employees/[id]/route.ts",
  "apps/admin/app/api/employees/role-templates/route.ts",
];

describe("canManageEmployees", () => {
  const ownerEmail = "owner@example.com";
  let previousEnv: string | undefined;

  beforeAll(async () => {
    previousEnv = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "configured@example.com";
    await startTestMongo();
    await ensureCollections(["admins"]);
  }, 120_000);
  afterAll(async () => {
    process.env.ADMIN_EMAIL = previousEnv;
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
    await Admin.collection.insertOne({
      email: ownerEmail,
      name: "Owner",
      password: "x",
      allowedSections: [],
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
  });

  const seed = async (email: string, allowedSections: string[]) => {
    const { insertedId } = await Admin.collection.insertOne({
      email,
      name: email,
      password: "x",
      allowedSections,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    return { email, _id: insertedId, allowedSections };
  };

  it("admits an admin granted the employees section", async () => {
    const fullAdmin = await seed("full@example.com", ["overview", "employees"]);
    expect(await canManageEmployees(fullAdmin)).toBe(true);
    expect(await isOriginalAdmin(fullAdmin)).toBe(false);
  });

  it("refuses an admin without the employees section", async () => {
    const support = await seed("support@example.com", ["users"]);
    expect(await canManageEmployees(support)).toBe(false);
  });

  it("still admits the original admin, with or without sections", async () => {
    const owner = await Admin.collection.findOne({ email: ownerEmail });
    expect(
      await canManageEmployees({ email: ownerEmail, _id: owner!._id, allowedSections: [] }),
    ).toBe(true);
    expect(
      await canManageEmployees({ email: "CONFIGURED@example.com", _id: owner!._id }),
    ).toBe(true);
  });
});

describe("the employee and role-template routes use the shared rule", () => {
  it.each(ROUTES)("%s has no private copy of the original-admin check", (rel) => {
    expect(read(rel)).not.toMatch(/async function isOriginalAdmin\s*\(/);
  });

  it.each(ROUTES)("%s refuses through canManageEmployees, not isOriginalAdmin(currentAdmin)", (rel) => {
    const code = read(rel);
    expect(code).not.toContain("isOriginalAdmin(currentAdmin)");
    expect(code).not.toContain("Only super admin can manage");
    expect(code).toContain("canManageEmployees(currentAdmin)");
  });

  it("the original admin's own account stays protected from other managers", () => {
    const code = read("apps/admin/app/api/employees/[id]/route.ts");
    // Reason: PUT and PATCH both refuse to modify it, DELETE refuses to delete it. Count, so a
    // removed PATCH guard is not hidden by the PUT one.
    expect(code.match(/"Cannot modify super admin"/g)?.length).toBe(2);
    expect(code.match(/isOriginalAdmin\(employee\)/g)?.length).toBe(3);
    expect(code).toContain('"Cannot delete super admin"');
  });

  it("the Employees screen gates on canManageEmployees, not on being the original admin", () => {
    const screen = read("apps/admin/components/admin/EmployeesSection.tsx");
    expect(screen).toContain("statusData.currentAdmin?.canManageEmployees");
    expect(screen).not.toContain("statusData.currentAdmin?.isSuperAdmin");
    const status = read("apps/admin/app/api/employees/upgrade-super-admin/route.ts");
    expect(status).toMatch(/canManageEmployees:\s*await canManageEmployees\(admin\)/);
  });
});
