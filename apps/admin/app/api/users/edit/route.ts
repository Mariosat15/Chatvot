import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { ObjectId } from "mongodb";

// Valid user roles (includes legacy roles for backwards compatibility)
// Active roles: trader, affiliate (coming soon), gamemaster (coming soon)
// Legacy roles: admin, backoffice (kept for existing users but no longer assignable via UI)
const VALID_ROLES = [
  "trader",
  "affiliate",
  "gamemaster",
  "admin",
  "backoffice",
] as const;
type UserRole = (typeof VALID_ROLES)[number];

/**
 * Build a query that matches user by various ID formats
 * Better-auth uses 'id' field, but MongoDB also has '_id'
 *
 * Callers MUST have established that `userId` is a string. `{ id: userId }` with an object
 * value is a query operator rather than a value, so `{ "$ne": null }` would match the first
 * user in the collection - and `!userId` is true for no object, so the presence check above
 * cannot stand in for the type check.
 */
function buildUserQuery(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: any[] = [{ id: userId }];

  // Try as ObjectId if valid
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }

  // Also try as string _id
  queries.push({ _id: userId });

  return { $or: queries };
}

/**
 * PATCH /api/admin/users/edit
 * Edit user information including role and address details
 */
export async function PATCH(request: Request) {
  try {
    // Reason: `role` is a settable field here and "admin" is a valid value, so this route
    // grants administrator. It must refuse BEFORE the write, and the refusal must be the
    // guard's - the audit-log lookup that used to be the file's only mention of a session
    // ran after the update and was skipped entirely when there was no session, so the one
    // artefact an operator would check for evidence was suppressed by the same condition.
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const {
      userId,
      name,
      email,
      role,
      country,
      city,
      address,
      postalCode,
      phone,
    } = await request.json();

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 },
      );
    }

    // Check if at least one field is being updated
    const hasBasicFields = name || email || role;
    const hasAddressFields =
      country !== undefined ||
      city !== undefined ||
      address !== undefined ||
      postalCode !== undefined ||
      phone !== undefined;

    if (!hasBasicFields && !hasAddressFields) {
      return NextResponse.json(
        { success: false, message: "At least one field is required to update" },
        { status: 400 },
      );
    }

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Get mongoose connection for Better Auth collections
    const mongoose = await import("mongoose");
    const db = mongoose.default.connection.db;

    if (!db) {
      throw new Error("Database connection not found");
    }

    // Build update object - only include fields that were explicitly provided
    const updateData: Record<string, any> = {};

    // Basic fields
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    // Address fields - allow empty strings to clear values
    if (country !== undefined) updateData.country = country;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (phone !== undefined) updateData.phone = phone;

    updateData.updatedAt = new Date();

    // Update user in Better Auth collection (try multiple ID formats)
    const query = buildUserQuery(userId);
    console.log(`🔍 Searching for user with query:`, JSON.stringify(query));

    const result = await db
      .collection("user")
      .updateOne(query, { $set: updateData });

    if (result.matchedCount === 0) {
      console.error(`❌ User not found with ID: ${userId}`);
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    console.log("✅ Updated user", userId, ":", updateData);

    // Log audit action. The actor comes from the guard above, so there is no longer a path
    // on which the update succeeds and the audit entry is silently skipped for want of a
    // session - the guard has already refused that request.
    try {
      await auditLogService.logUserUpdated(
        {
          id: guard.admin.id,
          email: guard.admin.email,
          name: guard.admin.name ?? guard.admin.email.split("@")[0],
          role: guard.admin.role ?? "admin",
        },
        userId,
        name || email || userId,
        updateData,
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      updated: updateData,
    });
  } catch (error) {
    console.error("❌ Error updating user:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update user",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
