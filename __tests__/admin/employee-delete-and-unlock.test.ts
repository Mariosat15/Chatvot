/**
 * Deleting an employee must hand their customers to someone still working, and unlocking
 * an employee must also lift the player-site brute-force lock on their email.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

vi.mock("@/database/models/admin.model", () => import("../../apps/admin/database/models/admin.model"));
vi.mock("@/database/models/customer-assignment.model", () =>
  import("../../apps/admin/database/models/customer-assignment.model"),
);
vi.mock("@/database/models/assignment-settings.model", () =>
  import("../../apps/admin/database/models/assignment-settings.model"),
);
vi.mock("@/database/models/account-lockout.model", () =>
  import("../../apps/admin/database/models/account-lockout.model"),
);
vi.mock("@/database/mongoose", () => ({ connectToDatabase: async () => undefined }));
vi.mock("@/lib/nodemailer", () => ({
  getTransporter: async () => ({ sendMail: async () => undefined }),
  sendAccountManagerAssignedEmail: async () => undefined,
  sendAccountManagerChangedEmail: async () => undefined,
}));
vi.mock("@/lib/services/settings.service", () => ({ getSettings: async () => ({}) }));
vi.mock("../../apps/admin/lib/services/employee-notification.service", () => ({
  employeeNotificationService: new Proxy({}, { get: () => async () => undefined }),
}));
vi.mock("../../apps/admin/lib/services/customer-audit.service", () => ({
  customerAuditService: new Proxy({}, { get: () => async () => undefined }),
}));

import { Admin } from "../../apps/admin/database/models/admin.model";
import { CustomerAssignment } from "../../apps/admin/database/models/customer-assignment.model";
import AccountLockout from "../../apps/admin/database/models/account-lockout.model";
import { customerAssignmentService } from "../../apps/admin/lib/services/customer-assignment.service";
import { clearLoginLockouts } from "../../apps/admin/lib/services/login-lockout-clear";

const BY = { employeeId: "x", employeeEmail: "owner@example.com", employeeName: "Owner" };

async function seedAssignment(employeeId: string, n: number) {
  const docs = Array.from({ length: n }, (_, i) => ({
    customerId: `c${i}${employeeId}`,
    customerEmail: `c${i}@example.com`,
    customerName: `C${i}`,
    employeeId,
    employeeName: "Martha",
    employeeEmail: "martha@example.com",
    employeeRole: "Full Admin",
    assignedAt: new Date(),
    isActive: true,
    assignedBy: { type: "admin" },
  }));
  await CustomerAssignment.collection.insertMany(docs);
}

describe("deleting an employee reassigns their customers", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["admins", "customerassignments", "assignmentsettings", "accountlockouts"]);
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
  });

  it("hands them to an active employee even when nobody holds an assignable role", async () => {
    // The owner predates the status field: raw insert, so no stored status and no role.
    const owner = await Admin.collection.insertOne({ email: "owner@example.com", name: "Owner", password: "$2b$10$x" });
    const martha = await new Admin({ email: "martha@example.com", name: "Martha", password: "Pass-1234", role: "Full Admin" }).save();
    await seedAssignment(martha._id.toString(), 1);

    const r = await customerAssignmentService.reassignEmployeeCustomers(
      martha._id.toString(), "Martha", "martha@example.com", BY,
    );

    expect(r).toEqual({ reassigned: 1, failed: 0 });
    const a = await CustomerAssignment.findOne({ customerEmail: "c0@example.com" }).lean();
    expect(a?.isActive).toBe(true);
    expect(a?.employeeId).toBe(owner.insertedId.toString());
  });

  it("splits several customers across the remaining employees", async () => {
    await new Admin({ email: "a@example.com", name: "A", password: "Pass-1234", role: "Backoffice" }).save();
    await new Admin({ email: "b@example.com", name: "B", password: "Pass-1234", role: "Backoffice" }).save();
    const martha = await new Admin({ email: "martha@example.com", name: "Martha", password: "Pass-1234", role: "Backoffice" }).save();
    await seedAssignment(martha._id.toString(), 4);

    const r = await customerAssignmentService.reassignEmployeeCustomers(
      martha._id.toString(), "Martha", "martha@example.com", BY,
    );

    expect(r.reassigned).toBe(4);
    const counts = await CustomerAssignment.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$employeeEmail", n: { $sum: 1 } } },
    ]);
    expect(counts.map((c) => c.n).sort()).toEqual([2, 2]);
  });

  it("never reassigns to a locked-out or disabled employee", async () => {
    await new Admin({ email: "locked@example.com", name: "L", password: "Pass-1234", isLockedOut: true }).save();
    await new Admin({ email: "off@example.com", name: "O", password: "Pass-1234", status: "disabled" }).save();
    const martha = await new Admin({ email: "martha@example.com", name: "Martha", password: "Pass-1234" }).save();
    await seedAssignment(martha._id.toString(), 1);

    const r = await customerAssignmentService.reassignEmployeeCustomers(
      martha._id.toString(), "Martha", "martha@example.com", BY,
    );
    expect(r).toEqual({ reassigned: 0, failed: 1 });
  });

  it("unlocking clears the player-site lockout whatever its casing", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}"));
    await AccountLockout.collection.insertOne({
      email: "Martha@Example.com",
      isActive: true,
      lockedAt: new Date(),
      lockedUntil: new Date(Date.now() + 3_600_000),
    });

    const cleared = await clearLoginLockouts("martha@example.com", "x", "test");

    expect(cleared).toBe(1);
    expect(await AccountLockout.countDocuments({ isActive: true })).toBe(0);
    vi.unstubAllGlobals();
  });
});
