import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";
// The original/default admin is ALWAYS considered the super admin
// They are identified by being the first admin created or matching ADMIN_EMAIL env var

// GET - Check super admin status
export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("employees");

    if (!guard.ok) return guard.response;

    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    await connectToDatabase();

    const admin = await Admin.findById(auth.adminId).select("-password");
    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Check if this is the original/default admin
    // The original admin is considered super admin by default
    const defaultAdminEmail = (
      process.env.ADMIN_EMAIL || "admin@email.com"
    ).toLowerCase();
    const isOriginalAdmin = admin.email.toLowerCase() === defaultAdminEmail;

    // Also check if they're the first admin (oldest by creation date)
    const oldestAdmin = await Admin.findOne({})
      .sort({ createdAt: 1 })
      .select("_id");
    const isFirstAdmin =
      oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();

    // Original admin or first admin = super admin
    const isSuperAdmin = isOriginalAdmin || isFirstAdmin;

    return NextResponse.json({
      success: true,
      currentAdmin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        isSuperAdmin: isSuperAdmin,
        role: isSuperAdmin ? "Super Admin" : "Admin",
      },
      needsUpgrade: false, // Original admin never needs upgrade
    });
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 },
    );
  }
}

// POST - Not needed for original admin, but keep for compatibility
export async function POST(request: NextRequest) {
  try {
    const guard = await guardSection("employees");

    if (!guard.ok) return guard.response;

    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    await connectToDatabase();

    const admin = await Admin.findById(auth.adminId);
    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Check if this is the original/default admin
    const defaultAdminEmail = (
      process.env.ADMIN_EMAIL || "admin@email.com"
    ).toLowerCase();
    const isOriginalAdmin = admin.email.toLowerCase() === defaultAdminEmail;

    const oldestAdmin = await Admin.findOne({})
      .sort({ createdAt: 1 })
      .select("_id");
    const isFirstAdmin =
      oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();

    if (isOriginalAdmin || isFirstAdmin) {
      return NextResponse.json({
        success: true,
        message: "You are the original admin with full super admin access.",
        admin: {
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name,
          isSuperAdmin: true,
        },
      });
    }

    return NextResponse.json(
      {
        error: "Only the original admin can access employee management.",
      },
      { status: 403 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
