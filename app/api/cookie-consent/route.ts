import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { CookieConsent } from "@/database/models/cookie-consent.model";

// Public endpoint — no auth required (cookie banner must load for all visitors)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await connectToDatabase();

    let settings = await CookieConsent.findOne().lean();

    // Reason: Auto-create default settings on first request so the admin
    // doesn't have to manually initialize. Defaults are comprehensive and
    // GDPR-compliant out of the box.
    if (!settings) {
      const created = await CookieConsent.create({});
      settings = created.toObject();
    }

    return NextResponse.json({
      success: true,
      settings: {
        enabled: settings.enabled,
        title: settings.title,
        message: settings.message,
        acceptAllText: settings.acceptAllText,
        rejectAllText: settings.rejectAllText,
        customizeText: settings.customizeText,
        savePreferencesText: settings.savePreferencesText,
        categories: settings.categories,
        cookiePolicyUrl: settings.cookiePolicyUrl,
        privacyPolicyUrl: settings.privacyPolicyUrl,
        position: settings.position,
        showDeclineButton: settings.showDeclineButton,
        showCustomizeButton: settings.showCustomizeButton,
        backdropEnabled: settings.backdropEnabled,
        autoExpireDays: settings.autoExpireDays,
      },
    });
  } catch (error) {
    console.error("❌ Cookie consent settings fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load cookie consent settings" },
      { status: 500 },
    );
  }
}
