import { NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import CompanySettings from "@/database/models/company-settings.model";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * GET /api/admin/company-settings
 * Fetch company settings
 */
export async function GET() {
  const guard = await guardAnySection(["company", "hero-page"]);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    const settings = await CompanySettings.getSingleton();

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching company settings:", error);

    return NextResponse.json(
      { error: "Failed to fetch company settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/company-settings
 * Update company settings
 */
export async function PUT(request: Request) {
  const guard = await guardAnySection(["company", "hero-page"]);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    const body = await request.json();

    // Get existing settings
    const settings = await CompanySettings.getSingleton();

    // Update fields
    const updateFields = [
      "companyName",
      "legalName",
      "registrationNumber",
      "addressLine1",
      "addressLine2",
      "city",
      "stateProvince",
      "postalCode",
      "country",
      "email",
      "phone",
      "website",
      "vatNumber",
      "taxId",
      "isVatRegistered",
      "bankName",
      "bankAccountNumber",
      "bankIban",
      "bankSwift",
      "logoUrl",
    ];

    for (const field of updateFields) {
      if (body[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (settings as any)[field] = body[field];
      }
    }

    await settings.save();

    console.log("✅ Company settings updated:", {
      companyName: settings.companyName,
      country: settings.country,
      isVatRegistered: settings.isVatRegistered,
    });

    // Log audit action
    try {
      const admin = guard.admin;
      if (admin) {
        await auditLogService.logCompanySettingsUpdated({
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0],
          role: "admin",
        });
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error updating company settings:", error);

    return NextResponse.json(
      { error: "Failed to update company settings" },
      { status: 500 },
    );
  }
}
