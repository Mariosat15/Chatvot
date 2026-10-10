import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  isAffiliationMigrationComplete,
  migrateAffiliationSource,
} from "@/lib/services/gamemaster/affiliation-migration";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The "Run migration" button on Admin -> Game Masters (`External game plans/24` s2.1, D4).
 * GET reports only, POST applies. The same function backs the CLI in
 * `tools/gamemaster/backfill-affiliation-source.ts`, so the two cannot disagree.
 *
 * Reason: until it has run, the old `userId_1` index refuses a second referral row for
 * the same player, so a player whose Game Master expired cannot join a new one.
 */
export async function GET() {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;
    await connectToDatabase();
    const report = await migrateAffiliationSource(false);
    return NextResponse.json({
      success: true,
      status: report,
      complete: isAffiliationMigrationComplete(report),
    });
  } catch (error) {
    console.error("❌ Read affiliation migration status failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST() {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const applied = await migrateAffiliationSource(true);
    // Reason: re-read rather than trust the applied result - its `needingSource` is the count
    // found before writing, and the screen must show what the database holds now.
    const status = await migrateAffiliationSource(false);

    try {
      await auditLogService.logSystemAction(
        {
          id: guard.admin.id,
          email: guard.admin.email,
          name: guard.admin.name ?? guard.admin.email.split("@")[0],
          role: guard.admin.role ?? "admin",
        },
        "gm_affiliation_migration",
        applied.refusedReason
          ? `Game Master affiliation migration refused: ${applied.refusedReason}`
          : `Game Master affiliation migration run: ${applied.labelled} row(s) labelled`,
        { applied, status },
      );
    } catch (auditError) {
      console.error("❌ Failed to audit affiliation migration:", auditError);
    }

    return NextResponse.json({
      success: true,
      applied,
      status,
      complete: isAffiliationMigrationComplete(status),
    });
  } catch (error) {
    console.error("❌ Affiliation migration failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
