import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { requireAdminAuth } from "@/lib/admin/auth";

/**
 * POST /api/fraud/resolve-users
 * Resolve an array of user IDs to their name, email, and creation date.
 * Used by the fraud monitoring panel to display connected accounts with details.
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "userIds must be a non-empty array" },
        { status: 400 },
      );
    }

    // Cap to prevent abuse
    const cappedIds = userIds.slice(0, 50);

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 },
      );
    }

    const userCollection = db.collection("user");

    // Reason: Users can be stored with 'id' (better-auth custom field) or '_id' (ObjectId).
    // We query both to be robust.
    const { ObjectId } = await import("mongodb");

    const orConditions: Record<string, unknown>[] = cappedIds.map((uid: string) => {
      const conditions: Record<string, unknown>[] = [{ id: uid }];
      if (ObjectId.isValid(uid) && String(new ObjectId(uid)) === uid) {
        conditions.push({ _id: new ObjectId(uid) });
      }
      return { $or: conditions };
    });

    const users = await userCollection
      .find({ $or: orConditions })
      .project({ id: 1, _id: 1, name: 1, email: 1, createdAt: 1, image: 1 })
      .toArray();

    // Build a map: userId -> user details
    const userMap = new Map<string, { id: string; name: string; email: string; createdAt: string; image?: string }>();

    for (const user of users) {
      const resolvedId = String(user.id || user._id?.toString());
      const entry = {
        id: resolvedId,
        name: String(user.name || "Unknown"),
        email: String(user.email || "No email"),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : "",
        image: user.image ? String(user.image) : undefined,
      };
      userMap.set(resolvedId, entry);
      // Also map by _id string if different from id
      const objectIdStr = user._id?.toString();
      if (objectIdStr && objectIdStr !== resolvedId) {
        userMap.set(objectIdStr, entry);
      }
    }

    return NextResponse.json({ success: true, users: Object.fromEntries(userMap) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error resolving users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resolve users" },
      { status: 500 },
    );
  }
}
