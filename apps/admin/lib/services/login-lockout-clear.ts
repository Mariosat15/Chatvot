import { connectToDatabase } from "@/database/mongoose";
import AccountLockout from "@/database/models/account-lockout.model";

/**
 * Clear the main app's brute-force lockouts for an email: the database rows that
 * `validateLogin` reads, and the main app's in-memory copy.
 */
export async function clearLoginLockouts(
  email: string,
  adminId: string,
  reason: string,
): Promise<number> {
  await connectToDatabase();

  // Reason: the main app stores and matches lockout emails case-insensitively, so an
  // exact match here left a lockout written with different casing in force.
  const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = await AccountLockout.updateMany(
    {
      // Input is escaped above.
      // eslint-disable-next-line security/detect-non-literal-regexp
      email: { $regex: new RegExp(`^${escaped}$`, "i") },
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        unlockedAt: new Date(),
        unlockedBy: adminId,
        unlockedReason: reason,
      },
    },
  );

  try {
    const mainAppUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";
    const adminApiKey =
      process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;

    await fetch(`${mainAppUrl}/api/admin/lockouts/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-api-key": adminApiKey || "",
      },
      body: JSON.stringify({ email, adminId, reason }),
    });
  } catch (memoryError) {
    console.warn(
      "⚠️ Could not clear in-memory lockouts (main app may be unreachable):",
      memoryError,
    );
  }

  return result.modifiedCount;
}
