// Reason: relative import, not "@/", so vitest (which maps "@" to the repository root) resolves
// the admin-only model the same way `next build` does.
import { Admin } from "../../database/models/admin.model";

/**
 * Who may manage employees and role templates.
 *
 * Owner decision, 5 Oct 2026: anyone granted the `employees` section (Full Admin holds it)
 * may create other admins and grant them any section. Until then only the ORIGINAL admin
 * could, whatever sections the caller held, so Full Admin saw the Employees tab and every
 * write was refused. The original admin's own account stays protected from everyone else -
 * the routes refuse to edit, lock, reset or delete it - so a delegated manager can never
 * lock the owner out.
 */

interface AdminIdentity {
  email: string;
  _id: { toString(): string };
}

interface AdminWithSections extends AdminIdentity {
  allowedSections?: readonly string[] | null;
}

export const EMPLOYEE_MANAGEMENT_DENIED =
  "You do not have access to employee management.";

/** The account set by ADMIN_EMAIL, or the oldest admin. */
export async function isOriginalAdmin(admin: AdminIdentity): Promise<boolean> {
  const defaultAdminEmail = (
    process.env.ADMIN_EMAIL || "admin@email.com"
  ).toLowerCase();
  if (admin.email.toLowerCase() === defaultAdminEmail) return true;

  const oldestAdmin = await Admin.findOne({})
    .sort({ createdAt: 1 })
    .select("_id");
  return !!oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();
}

export async function canManageEmployees(
  admin: AdminWithSections,
): Promise<boolean> {
  // Reason: read from the stored account, not the session's section list, so a grant
  // withdrawn a moment ago takes effect on the next request.
  if (admin.allowedSections?.includes("employees")) return true;
  return isOriginalAdmin(admin);
}
