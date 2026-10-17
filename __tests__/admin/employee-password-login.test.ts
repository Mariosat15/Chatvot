/**
 * Every way Employee Management sets a password must produce one the employee can log in with.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

vi.mock("@/database/models/admin.model", () => import("../../apps/admin/database/models/admin.model"));
vi.mock("@/database/models/admin-employee.model", () => import("../../apps/admin/database/models/admin-employee.model"));
vi.mock("@/database/mongoose", () => ({ connectToDatabase: async () => undefined }));
vi.mock("@/lib/admin/jwt-secret", () => import("../../apps/admin/lib/admin/jwt-secret"));
vi.mock("@/lib/services/audit-log.service", () => ({
  auditLogService: { logAdminLogin: async () => undefined },
}));

import { Admin } from "../../apps/admin/database/models/admin.model";
import { POST as login } from "../../apps/admin/app/api/auth/login/route";

const OWNER = "owner@example.com";

async function tryLogin(email: string, password: string) {
  const req = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ email, password }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await login(req as any);
  return { status: res.status, body: await res.json() };
}

describe("employee passwords set by Employee Management", () => {
  beforeAll(async () => {
    process.env.ADMIN_EMAIL = OWNER;
    await startTestMongo();
    await ensureCollections(["admins"]);
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
    await new Admin({ email: OWNER, password: "owner-pass-123" }).save();
  });

  it("a custom password typed on create logs in", async () => {
    await new Admin({
      email: "emp@example.com",
      name: "Emp",
      password: "Custom-Pass-99",
      status: "active",
      isFirstLogin: true,
      mustChangePassword: false,
    }).save();
    const r = await tryLogin("emp@example.com", "Custom-Pass-99");
    expect(r.body.error).toBeUndefined();
    expect(r.status).toBe(200);
  });

  it("an auto-generated password logs in", async () => {
    await new Admin({
      email: "auto@example.com",
      name: "Auto",
      password: "aB3$xY9&kL2!",
      status: "active",
      tempPasswordExpiresAt: new Date(Date.now() + 86_400_000),
      mustChangePassword: true,
    }).save();
    const r = await tryLogin("auto@example.com", "aB3$xY9&kL2!");
    expect(r.body.error).toBeUndefined();
    expect(r.status).toBe(200);
  });

  it("a password reset by the admin logs in", async () => {
    await new Admin({ email: "reset@example.com", name: "R", password: "Old-Pass-111" }).save();
    const emp = await Admin.findOne({ email: "reset@example.com" });
    emp!.password = "New-Pass-222";
    emp!.isFirstLogin = true;
    emp!.tempPasswordExpiresAt = undefined;
    emp!.forceLogoutAt = new Date();
    await emp!.save();
    const r = await tryLogin("reset@example.com", "New-Pass-222");
    expect(r.body.error).toBeUndefined();
    expect(r.status).toBe(200);
  });
});
