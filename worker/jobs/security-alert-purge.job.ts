/**
 * Daily auto-purge of SecurityAlert documents when Dev Zone retention is enabled.
 *
 * Cheap: one settings read + one deleteMany with a createdAt cutoff. Off by default.
 */

import type { Job } from "agenda";

export async function runSecurityAlertPurgeCheck(
  _job?: Job,
): Promise<{ deleted: number; skipped: boolean; retentionDays: number }> {
  const { runSecurityAlertAutoPurge } = await import(
    "../../lib/services/security/security-alert-ops.service"
  );
  const result = await runSecurityAlertAutoPurge();
  if (result.skipped) {
    console.log("🧹 [SECURITY ALERT PURGE] Skipped (auto-delete off)");
  } else {
    console.log(
      `🧹 [SECURITY ALERT PURGE] Deleted ${result.deleted} alert(s) older than ${result.retentionDays} day(s)`,
    );
  }
  return result;
}
