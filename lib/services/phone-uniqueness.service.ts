/**
 * Ensures one phone number maps to at most one user account.
 *
 * Application-level only: the owner declined a pre-cleanup of existing free-text
 * duplicates, so a unique index on `user.phone` cannot be built safely. The
 * registration and profile writers still refuse a collision they can see.
 *
 * Compares the stored E.164 string exactly. Older free-text values that were
 * never normalised will not match a new E.164 — that is accepted: new
 * registrations are the path that must be unique going forward.
 */

import { connectToDatabase } from "@/database/mongoose";

export type PhoneAvailability =
  | { available: true }
  | {
      available: false;
      reason: string;
      code: "PHONE_TAKEN" | "PHONE_LOOKUP_FAILED";
    };

/**
 * @param e164 - Canonical number from `parsePhoneInput` (e.g. `+35799123456`)
 * @param excludeUserId - When editing a profile, the caller's own id so they
 *   can keep their current number without a false "taken" refusal.
 */
export async function assertPhoneAvailable(
  e164: string,
  excludeUserId?: string,
): Promise<PhoneAvailability> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return {
        available: false,
        reason: "Something went wrong. Please contact support.",
        code: "PHONE_LOOKUP_FAILED",
      };
    }

    const existing = await db.collection("user").findOne(
      { phone: e164 },
      { projection: { _id: 1, id: 1 } },
    );

    if (!existing) {
      return { available: true };
    }

    if (excludeUserId) {
      const existingId =
        typeof existing.id === "string" && existing.id
          ? existing.id
          : String(existing._id);
      if (
        existingId === excludeUserId ||
        String(existing._id) === excludeUserId
      ) {
        return { available: true };
      }
    }

    return {
      available: false,
      reason: "This phone number is already registered to another account",
      code: "PHONE_TAKEN",
    };
  } catch (err) {
    console.error("❌ Phone uniqueness check failed:", err);
    return {
      available: false,
      reason: "Something went wrong. Please contact support.",
      code: "PHONE_LOOKUP_FAILED",
    };
  }
}
