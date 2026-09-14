import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import AppSettings from "@/database/models/app-settings.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { creditValueInBaseCurrency } from "@/lib/utils/credit-value";

// Disable Next.js caching for this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET - Fetch app settings (public endpoint)
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await AppSettings.findById("app-settings");

    // Create default settings if none exist
    if (!settings) {
      settings = await AppSettings.create({
        _id: "app-settings",
        currency: {
          code: "EUR",
          symbol: "€",
          name: "Euro",
          exchangeRateToEUR: 1.0,
        },
        credits: {
          name: "Volt Credits",
          symbol: "⚡",
          icon: "zap",
          valueInEUR: 1.0,
          showEUREquivalent: true,
          decimals: 2,
        },
        transactions: {
          minimumDeposit: 10,
          maximumDeposit: 10000,
          minimumWithdrawal: 20,
          withdrawalFeePercentage: 2,
        },
        branding: {
          primaryColor: "#EAB308",
          accentColor: "#F59E0B",
        },
      });
    }

    // Also fetch WhiteLabel settings for branding assets (no cache)
    const whiteLabel = await WhiteLabel.findOne().lean();

    /*
      What a credit is worth is DERIVED from the conversion rate the money actually moves on,
      and the stored `credits.valueInEUR` is deliberately not served.

      // Reason: this is the single place that reaches every client conversion. The context's
      // `creditsToEUR` / `eurToCredits` are built from this field, so the wallet balance, the
      // transaction rows, the profile summary and the deposit modal's "you will receive" line
      // were all a hundred times out against the withdrawal route. Overriding here fixes all
      // of them at once, and means no screen can pick the other number.
    */
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const derivedCreditValue = creditValueInBaseCurrency(
      conversionSettings?.eurToCreditsRate,
    );

    // Merge branding assets into settings
    const mergedSettings = {
      ...JSON.parse(JSON.stringify(settings)),
      credits: {
        ...JSON.parse(JSON.stringify(settings)).credits,
        valueInEUR: derivedCreditValue,
      },
      branding: {
        ...JSON.parse(JSON.stringify(settings)).branding,
        appLogo: whiteLabel?.appLogo || "/assets/images/logo.png",
        emailLogo: whiteLabel?.emailLogo || "/assets/images/logo.png",
        favicon: whiteLabel?.favicon || "/favicon.ico",
        profileImage: whiteLabel?.profileImage || "/assets/images/PROFILE.png",
        // SEO / Open Graph — editable from admin > Settings > Branding
        seoTitle: whiteLabel?.seoTitle || "",
        seoDescription: whiteLabel?.seoDescription || "",
        ogImageUrl: whiteLabel?.ogImageUrl || "",
        siteUrl: whiteLabel?.siteUrl || "",
      },
      // Feature Toggles
      arenaEnabled: whiteLabel?.arenaEnabled ?? true,
    };

    return NextResponse.json(
      {
        success: true,
        settings: mergedSettings,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching app settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
