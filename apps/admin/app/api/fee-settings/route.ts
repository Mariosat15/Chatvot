import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/database/mongoose";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { auditLogService } from "@/lib/services/audit-log.service";
import { getAdminJwtSecret } from "@/lib/admin/jwt-secret";

const JWT_SECRET = new TextEncoder().encode(getAdminJwtSecret());

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// GET - Fetch current fee settings
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const settings = await CreditConversionSettings.getSingleton();

    return NextResponse.json({
      success: true,
      settings: {
        // Platform fees (what we charge users)
        platformDepositFeePercentage:
          settings.platformDepositFeePercentage ?? 2,
        platformWithdrawalFeePercentage:
          settings.platformWithdrawalFeePercentage ??
          settings.withdrawalFeePercentage ??
          2,

        // Bank fees (what providers charge us)
        bankDepositFeePercentage: settings.bankDepositFeePercentage ?? 2.9,
        bankDepositFeeFixed: settings.bankDepositFeeFixed ?? 0.3,
        bankWithdrawalFeePercentage:
          settings.bankWithdrawalFeePercentage ?? 0.25,
        bankWithdrawalFeeFixed: settings.bankWithdrawalFeeFixed ?? 0.25,
      },
    });
  } catch (error) {
    console.error("Error fetching fee settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee settings" },
      { status: 500 },
    );
  }
}

// PUT - Update fee settings
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();

    console.log("📥 Received fee settings update:", body);

    // Parse and validate inputs with defaults
    const platformDepositFeePercentage =
      Number.parseFloat(body.platformDepositFeePercentage) || 0;
    const platformWithdrawalFeePercentage =
      Number.parseFloat(body.platformWithdrawalFeePercentage) || 0;
    const bankDepositFeePercentage =
      Number.parseFloat(body.bankDepositFeePercentage) || 0;
    const bankDepositFeeFixed = Number.parseFloat(body.bankDepositFeeFixed) || 0;
    const bankWithdrawalFeePercentage =
      Number.parseFloat(body.bankWithdrawalFeePercentage) || 0;
    const bankWithdrawalFeeFixed = Number.parseFloat(body.bankWithdrawalFeeFixed) || 0;

    // Validate percentages are within bounds
    if (platformDepositFeePercentage < 0 || platformDepositFeePercentage > 50) {
      return NextResponse.json(
        { error: "Platform deposit fee must be between 0% and 50%" },
        { status: 400 },
      );
    }

    if (
      platformWithdrawalFeePercentage < 0 ||
      platformWithdrawalFeePercentage > 50
    ) {
      return NextResponse.json(
        { error: "Platform withdrawal fee must be between 0% and 50%" },
        { status: 400 },
      );
    }

    // First ensure the document exists
    await CreditConversionSettings.getSingleton();

    // Update only fee-related settings (limits/conversion are managed in Currency settings)
    const settings = await CreditConversionSettings.findByIdAndUpdate(
      "global-credit-conversion",
      {
        $set: {
          platformDepositFeePercentage,
          platformWithdrawalFeePercentage,
          bankDepositFeePercentage,
          bankDepositFeeFixed,
          bankWithdrawalFeePercentage,
          bankWithdrawalFeeFixed,
          // Keep legacy field in sync
          withdrawalFeePercentage: platformWithdrawalFeePercentage,
          lastUpdated: new Date(),
          updatedBy: (admin.email as string) || "admin",
        },
      },
      { new: true },
    );

    if (!settings) {
      return NextResponse.json(
        { error: "Failed to update fee settings - document not found" },
        { status: 500 },
      );
    }

    // Sanitize email for logging to prevent format string injection
    const safeEmail = String(admin.email || "unknown").replaceAll(/[%\n\r]/g, "");
    console.log(`💰 Fee settings updated by ${safeEmail}:`, {
      platformDepositFeePercentage: settings.platformDepositFeePercentage,
      platformWithdrawalFeePercentage: settings.platformWithdrawalFeePercentage,
      bankDepositFeePercentage: settings.bankDepositFeePercentage,
      bankWithdrawalFeePercentage: settings.bankWithdrawalFeePercentage,
    });

    // Log audit action
    try {
      await auditLogService.logSettingsUpdated(
        {
          id: (admin.adminId as string) || "admin",
          email: (admin.email as string) || "admin",
          name: ((admin.email as string) || "admin").split("@")[0],
          role: "admin",
        },
        "Fee Settings",
        undefined,
        {
          platformDepositFeePercentage,
          platformWithdrawalFeePercentage,
          bankDepositFeePercentage,
          bankWithdrawalFeePercentage,
        },
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      settings: {
        platformDepositFeePercentage: settings.platformDepositFeePercentage,
        platformWithdrawalFeePercentage:
          settings.platformWithdrawalFeePercentage,
        bankDepositFeePercentage: settings.bankDepositFeePercentage,
        bankDepositFeeFixed: settings.bankDepositFeeFixed,
        bankWithdrawalFeePercentage: settings.bankWithdrawalFeePercentage,
        bankWithdrawalFeeFixed: settings.bankWithdrawalFeeFixed,
      },
    });
  } catch (error) {
    console.error("Error updating fee settings:", error);
    return NextResponse.json(
      { error: "Failed to update fee settings" },
      { status: 500 },
    );
  }
}
