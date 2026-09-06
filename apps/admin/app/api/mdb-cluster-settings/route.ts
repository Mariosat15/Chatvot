import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import MdbClusterSettings from "@/database/models/mdb-cluster-settings.model";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET /api/mdb-cluster-settings
 * Get current MongoDB cluster settings
 */
export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const settings = await MdbClusterSettings.getSingleton();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error fetching MDB cluster settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cluster settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/mdb-cluster-settings
 * Update MongoDB cluster settings
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updates = await request.json();

    // Remove fields that shouldn't be directly updated
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    await connectToDatabase();
    const settings = await MdbClusterSettings.updateSingleton(
      updates,
      admin.email || "admin",
    );

    return NextResponse.json({
      success: true,
      message:
        "Cluster settings updated. Restart all PM2 processes for changes to take effect.",
      settings,
    });
  } catch (error) {
    console.error("Error updating MDB cluster settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cluster settings" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mdb-cluster-settings
 * Reset to defaults
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();

    if (action !== "reset") {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    await MdbClusterSettings.deleteOne({
      _id: "global-mdb-cluster-settings",
    });
    const settings = await MdbClusterSettings.getSingleton();

    return NextResponse.json({
      success: true,
      message: "Cluster settings reset to defaults",
      settings,
    });
  } catch (error) {
    console.error("Error resetting MDB cluster settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset cluster settings" },
      { status: 500 },
    );
  }
}
