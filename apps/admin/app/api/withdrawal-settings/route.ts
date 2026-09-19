import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import WithdrawalSettings from "@/database/models/withdrawal-settings.model";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * GET /api/withdrawal-settings
 * Get current withdrawal settings
 */
export async function GET() {
  try {
    // Reason: WithdrawalSettingsSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("withdrawals");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const settings = await WithdrawalSettings.getSingleton();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error fetching withdrawal settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch withdrawal settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/withdrawal-settings
 * Update withdrawal settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Reason: WithdrawalSettingsSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("withdrawals");
    if (!guard.ok) return guard.response;

    const updates = await request.json();

    // Remove fields that shouldn't be directly updated
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    await connectToDatabase();
    const settings = await WithdrawalSettings.updateSingleton(
      updates,
      guard.admin.email || "admin",
    );

    return NextResponse.json({
      success: true,
      message: "Withdrawal settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Error updating withdrawal settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update withdrawal settings" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/withdrawal-settings/reset
 * Reset withdrawal settings to defaults
 */
export async function POST(request: NextRequest) {
  try {
    // Reason: WithdrawalSettingsSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("withdrawals");
    if (!guard.ok) return guard.response;

    const { action } = await request.json();

    if (action !== "reset") {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Delete existing and let getSingleton create fresh defaults
    await WithdrawalSettings.deleteOne({ _id: "global-withdrawal-settings" });
    const settings = await WithdrawalSettings.getSingleton();

    return NextResponse.json({
      success: true,
      message: "Withdrawal settings reset to defaults",
      settings,
    });
  } catch (error) {
    console.error("Error resetting withdrawal settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset withdrawal settings" },
      { status: 500 },
    );
  }
}
