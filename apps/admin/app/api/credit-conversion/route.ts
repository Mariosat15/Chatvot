import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { guardSection } from "@/lib/admin/section-route-guard";

// GET: Fetch credit conversion settings
export async function GET(_request: NextRequest) {
  try {
    // Reason: CreditConversionSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("currency");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const settings = await CreditConversionSettings.getSingleton();

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching credit conversion settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

// POST: Update credit conversion settings
export async function POST(request: NextRequest) {
  try {
    // Reason: CreditConversionSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("currency");
    if (!guard.ok) return guard.response;

    const data = await request.json();

    await connectToDatabase();

    const settings = await CreditConversionSettings.findOneAndUpdate(
      { _id: "global-credit-conversion" },
      {
        eurToCreditsRate: data.eurToCreditsRate,
        minimumDeposit: data.minimumDeposit,
        minimumWithdrawal: data.minimumWithdrawal,
        withdrawalFeePercentage: data.withdrawalFeePercentage,
        lastUpdated: new Date(),
        updatedBy: guard.admin.email || "admin",
      },
      { new: true, upsert: true },
    );

    return NextResponse.json({
      success: true,
      message: "Credit conversion settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Error updating credit conversion settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
