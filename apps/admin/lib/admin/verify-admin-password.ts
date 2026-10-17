import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";

export type AdminPasswordCheck =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 404; message: string };

/**
 * Check the signed-in admin's OWN password against the hash stored in MongoDB.
 *
 * Reason: `/api/verify-password` answers this for the browser, which then calls the real
 * route - so a direct call to that route skips the check entirely. A route whose action is
 * dangerous enough to need re-confirmation (setting somebody else's password) must run the
 * check itself, and must use the same rule, which is why both callers share this function.
 */
export async function verifyAdminPassword(
  adminId: string,
  password: unknown,
): Promise<AdminPasswordCheck> {
  if (typeof password !== "string" || !password) {
    return { ok: false, status: 400, message: "Password is required" };
  }

  await connectToDatabase();
  const admin = await Admin.findById(adminId).select("password");
  if (!admin?.password) {
    return { ok: false, status: 404, message: "Admin account not found" };
  }

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) {
    return { ok: false, status: 401, message: "Invalid password" };
  }
  return { ok: true };
}
