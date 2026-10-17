import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * GET /api/messaging/employees
 * Get list of employees for internal messaging
 */
export async function GET(_request: NextRequest) {
  try {
    // Reason: Messaging screen owns the employee picker; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    // Reason (7 Oct 2026, owner): this list is polled; dumping every admin
    // email on each hit flooded production. Keep console.error only.
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    // Get all active employees except current user
    let currentUserId: mongoose.Types.ObjectId;
    try {
      currentUserId = new mongoose.Types.ObjectId(guard.admin.id);
    } catch {
      return NextResponse.json({ error: "Invalid admin ID" }, { status: 400 });
    }

    // Get ALL active employees/admins (including super admin) - exclude only current user
    const employees = await db
      .collection("admins")
      .find({
        _id: { $ne: currentUserId },
        $or: [
          { status: "active" },
          { isSuperAdmin: true }, // Always include super admin
        ],
        isLockedOut: { $ne: true },
      })
      .toArray();

    // Get online status from presence collection
    const employeeIds = employees.map((e: { _id: mongoose.Types.ObjectId }) =>
      e._id.toString(),
    );

    let presenceMap = new Map<
      string,
      { status?: string; lastSeen?: Date }
    >();
    try {
      const presences = await db
        .collection("user_presence")
        .find({
          participantId: { $in: employeeIds },
          participantType: "employee",
        })
        .toArray();

      presenceMap = new Map(
        presences.map((p: { participantId: string; status?: string; lastSeen?: Date }) => [
          p.participantId,
          { status: p.status, lastSeen: p.lastSeen },
        ]),
      );
    } catch {
      // Presence is optional — offline is fine.
    }

    const result = employees.map(
      (emp: {
        _id: mongoose.Types.ObjectId;
        name?: string;
        email?: string;
        role?: string;
        isSuperAdmin?: boolean;
        profileImage?: string;
        avatar?: string;
        isOnline?: boolean;
        lastLoginAt?: Date;
        isAvailableForChat?: boolean;
      }) => {
        const presence = presenceMap.get(emp._id.toString());
        return {
          id: emp._id.toString(),
          name: emp.name || emp.email?.split("@")[0] || "Employee",
          email: emp.email,
          role: emp.isSuperAdmin ? "Super Admin" : emp.role || "Employee",
          isSuperAdmin: emp.isSuperAdmin || false,
          avatar: emp.profileImage || emp.avatar,
          status: presence?.status || (emp.isOnline ? "online" : "offline"),
          lastSeen: presence?.lastSeen,
          lastLoginAt: emp.lastLoginAt,
          isAvailableForChat: emp.isAvailableForChat !== false,
        };
      },
    );

    return NextResponse.json({
      employees: result,
    });
  } catch (error) {
    console.error("❌ [Employees] Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
