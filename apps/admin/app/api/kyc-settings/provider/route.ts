import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import KYCSettings from "@/database/models/kyc-settings.model";
import AuditLog from "@/database/models/audit-log.model";

export async function POST(req: NextRequest) {
  const guard = await guardSection("kyc-settings");
  if (!guard.ok) return guard.response;

  try {
    
    const body = await req.json();
    const { provider, apiKey, apiSecret, baseUrl } = body;

    if (provider !== "veriff") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Update database
    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    await KYCSettings.findByIdAndUpdate(settings._id, {
      veriffApiKey: apiKey,
      veriffApiSecret: apiSecret,
      veriffBaseUrl: baseUrl || "https://stationapi.veriff.com",
    });

    // KYC credentials are stored in MongoDB (KYCSettings model) and shared
    // across all servers automatically. No .env file write needed.

    // Create audit log
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: "kyc_provider_configured",
      actionCategory: "security",
      description: `Configured Veriff KYC provider credentials`,
      targetType: "settings",
      targetId: "veriff",
      targetName: "Veriff KYC Provider",
      metadata: {
        provider: "veriff",
        environment: baseUrl?.includes("test") ? "sandbox" : "production",
        apiKeyPrefix: apiKey.slice(0, 8),
      },
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Veriff credentials saved successfully",
    });
  } catch (error) {
    console.error("Error saving KYC provider:", error);
    return NextResponse.json(
      { error: "Failed to save provider credentials" },
      { status: 500 },
    );
  }
}
