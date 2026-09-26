import { NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import InvoiceSettings from "@/database/models/invoice-settings.model";
import CompanySettings, {
  isEUCountry,
} from "@/database/models/company-settings.model";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * GET /api/admin/invoice-settings
 * Fetch invoice settings with company context
 */
export async function GET() {
  try {
    const guard = await guardAnySection(["invoices", "financial"]);
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const [invoiceSettings, companySettings] = await Promise.all([
      InvoiceSettings.getSingleton(),
      CompanySettings.getSingleton(),
    ]);

    // Determine if VAT should be applied based on company location
    const companyInEU = isEUCountry(companySettings.country);

    return NextResponse.json({
      invoiceSettings,
      companySettings,
      companyInEU,
      shouldApplyVat: companyInEU && invoiceSettings.vatEnabled,
    });
  } catch (error) {
    console.error("Error fetching invoice settings:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch invoice settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/invoice-settings
 * Update invoice settings
 */
export async function PUT(request: Request) {
  try {
    const guard = await guardAnySection(["invoices", "financial"]);
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const body = await request.json();

    // Get existing settings
    const settings = await InvoiceSettings.getSingleton();

    // Update fields
    const updateFields = [
      "vatEnabled",
      "vatPercentage",
      "vatLabel",
      "invoicePrefix",
      "invoiceNumberPadding",
      "showLogo",
      "showCompanyAddress",
      "showBankDetails",
      "showVatNumber",
      "showRegistrationNumber",
      "invoiceTitle",
      "invoiceFooter",
      "paymentTerms",
      "thankYouMessage",
      "legalDisclaimer",
      "showLegalDisclaimer",
      "sendInvoiceOnPurchase",
      "invoiceEmailSubject",
      "invoiceEmailBody",
      "currencySymbol",
      "currencyPosition",
      "primaryColor",
      "accentColor",
    ];

    for (const field of updateFields) {
      if (body[field] !== undefined) {
        (settings as any)[field] = body[field];
      }
    }

    // Handle numeric fields
    if (body.vatPercentage !== undefined) {
      settings.vatPercentage = parseFloat(body.vatPercentage) || 0;
    }
    if (body.invoiceNumberPadding !== undefined) {
      settings.invoiceNumberPadding = parseInt(body.invoiceNumberPadding) || 6;
    }

    await settings.save();

    console.log("✅ Invoice settings updated:", {
      vatEnabled: settings.vatEnabled,
      vatPercentage: settings.vatPercentage,
      sendInvoiceOnPurchase: settings.sendInvoiceOnPurchase,
    });

    // Reason: attribution comes from the guard that already refused; a follow-up
    // getAdminSession is the R101b shape (audit after an unauthenticated write).
    try {
      await auditLogService.logInvoiceSettingsUpdated({
        id: guard.admin.id,
        email: guard.admin.email,
        name: (guard.admin.name || guard.admin.email).split("@")[0],
        role: guard.admin.role || "admin",
      });
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error updating invoice settings:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to update invoice settings" },
      { status: 500 },
    );
  }
}
