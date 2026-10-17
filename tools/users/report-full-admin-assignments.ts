/**
 * Finds active customer_assignments whose account manager is a Full Admin.
 *
 * WHY THIS EXISTS. The 6 Oct 2026 handoff fix stopped NEW auto-assigns from
 * minting Full Admin as the account manager, and AI escalate now follows
 * customer_assignments. Rows already stamped to Admin stay until somebody
 * moves them — a code fix only affects future writes.
 *
 * WHY REPORT-ONLY BY DEFAULT. Reassigning is an operator decision: some Full
 * Admin rows may be deliberate. The apply path spreads them onto Backoffice /
 * Support Agent by least_customers and also retargets open support tickets so
 * the stamp matches the badge.
 *
 *   npx tsx tools/users/report-full-admin-assignments.ts
 *   npx tsx tools/users/report-full-admin-assignments.ts --apply
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ACCOUNT_MANAGER_ROLES = ["Backoffice", "Support Agent"] as const;
const FULL_ADMIN_ROLE = "Full Admin";

type AssignmentRow = {
  _id: mongoose.Types.ObjectId;
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeRole?: string;
  assignedAt?: Date;
  previousEmployee?: unknown;
};

type AdminRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  isLockedOut?: boolean;
};

function pickLeastLoaded(
  pool: AdminRow[],
  counts: Map<string, number>,
): AdminRow | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    const ca = counts.get(a._id.toString()) ?? 0;
    const cb = counts.get(b._id.toString()) ?? 0;
    return ca - cb;
  });
  return sorted.at(0) ?? null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connecting.");

  console.log(
    `\n📊 Full Admin customer assignments — ${
      apply ? "APPLYING REASSIGNS" : "REPORT ONLY, nothing will be written"
    }\n`,
  );

  const fullAdmins = (await db
    .collection("admins")
    .find({ role: FULL_ADMIN_ROLE })
    .project({ name: 1, email: 1, role: 1, status: 1, isLockedOut: 1 })
    .toArray()) as AdminRow[];

  const fullAdminIds = new Set(fullAdmins.map((a) => a._id.toString()));

  const affected = (await db
    .collection("customer_assignments")
    .find({
      isActive: true,
      $or: [
        { employeeRole: FULL_ADMIN_ROLE },
        { employeeId: { $in: [...fullAdminIds] } },
      ],
    })
    .toArray()) as AssignmentRow[];

  console.log(`Full Admin accounts: ${fullAdmins.length}`);
  for (const a of fullAdmins) {
    console.log(
      `  - ${a.name || a.email} <${a.email}> id=${a._id.toString()} status=${a.status ?? "(unset)"}`,
    );
  }

  console.log(`\nActive assignments on Full Admin: ${affected.length}`);
  if (affected.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const sample = affected.slice(0, 25);
  for (const row of sample) {
    console.log(
      `  - ${row.customerEmail || row.customerId} → ${row.employeeName || row.employeeEmail} (${row.employeeRole}) assignedAt=${row.assignedAt?.toISOString?.() ?? "?"}`,
    );
  }
  if (affected.length > sample.length) {
    console.log(`  … and ${affected.length - sample.length} more`);
  }

  if (!apply) {
    console.log(
      "\nRe-run with --apply to move these onto Backoffice / Support Agent (least customers) and retarget open support tickets.",
    );
    await mongoose.disconnect();
    return;
  }

  const pool = (await db
    .collection("admins")
    .find({
      role: { $in: [...ACCOUNT_MANAGER_ROLES] },
      status: { $ne: "disabled" },
      isLockedOut: { $ne: true },
    })
    .project({ name: 1, email: 1, role: 1 })
    .toArray()) as AdminRow[];

  if (pool.length === 0) {
    console.error(
      "❌ No active Backoffice / Support Agent to take customers. Aborting — nothing written.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const counts = new Map<string, number>();
  for (const emp of pool) {
    const n = await db.collection("customer_assignments").countDocuments({
      employeeId: emp._id.toString(),
      isActive: true,
    });
    counts.set(emp._id.toString(), n);
  }

  let moved = 0;
  let tickets = 0;
  let failed = 0;
  const now = new Date();

  for (const row of affected) {
    try {
      const next = pickLeastLoaded(pool, counts);
      if (!next) {
        failed += 1;
        continue;
      }

      const nextId = next._id.toString();
      await db.collection("customer_assignments").updateOne(
        { _id: row._id, isActive: true },
        {
          $set: {
            previousEmployee: {
              employeeId: row.employeeId,
              employeeName: row.employeeName,
              employeeEmail: row.employeeEmail,
              employeeRole: row.employeeRole,
              assignedAt: row.assignedAt,
              unassignedAt: now,
            },
            employeeId: nextId,
            employeeName: next.name || next.email || "Support",
            employeeEmail: (next.email || "").toLowerCase(),
            employeeRole: next.role || "Backoffice",
            assignedAt: now,
            assignedBy: {
              type: "reassign",
              adminId: "system",
              adminEmail: "system@chartvolt",
              adminName: "Full Admin assignment cleanup",
              reason: "Move clients off Full Admin after handoff fix",
              strategy: "least_customers",
            },
          },
        },
      );

      counts.set(nextId, (counts.get(nextId) ?? 0) + 1);

      const ticketResult = await db.collection("conversations").updateMany(
        {
          type: "support",
          "participants.id": row.customerId,
          isActive: { $ne: false },
          temporarilyRedirected: { $ne: true },
          isChatTransferred: { $ne: true },
        },
        {
          $set: {
            assignedEmployeeId: nextId,
            assignedEmployeeName: next.name || next.email || "Support",
          },
        },
      );
      tickets += ticketResult.modifiedCount;
      moved += 1;
      console.log(
        `  ✓ ${row.customerEmail || row.customerId} → ${next.name || next.email}`,
      );
    } catch (err) {
      failed += 1;
      console.error(
        `  ✗ ${row.customerEmail || row.customerId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `\nDone. Reassigned ${moved}, ticket stamps updated ${tickets}, failed ${failed}.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
