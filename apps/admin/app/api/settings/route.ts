import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import AppSettings from "@/database/models/app-settings.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { creditValueInBaseCurrency } from "@/lib/utils/credit-value";

/*
  GET is admin-at-all; PUT stays behind `currency`.

  // Reason (R110): AppSettingsProvider mounts in the root layout and fetches this on every
  // signed-in admin page. Scoping the read to the currency grant meant every employee without
  // that section still rendered createContext defaults for the credit symbol — the same silent
  // wrong answer the unmounted provider caused. Reading the display pack is not a privilege;
  // writing it is. Naming the generic "settings" section for either handler would silently
  // widen every currency grant to the whole settings surface.
*/

// GET - Fetch app settings (admin)
export async function GET(_request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    let settings = await AppSettings.findById("app-settings");

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

    /*
      Derived, never stored — the same override the player app applies, so an operator and a
      player are looking at one number. See `lib/utils/credit-value.ts`.
    */
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const serialised = JSON.parse(JSON.stringify(settings));

    return NextResponse.json({
      success: true,
      settings: {
        ...serialised,
        credits: {
          ...serialised.credits,
          valueInEUR: creditValueInBaseCurrency(
            conversionSettings?.eurToCreditsRate,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching app settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

// PUT - Update app settings
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("currency");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const updateData = await request.json();

    let settings = await AppSettings.findById("app-settings");

    if (!settings) {
      settings = new AppSettings({ _id: "app-settings" });
    }

    // Update settings
    if (updateData.currency) {
      settings.currency = { ...settings.currency, ...updateData.currency };
    }
    if (updateData.credits) {
      /*
        `valueInEUR` is derived and must never be written back.

        // Reason: the GET above serves the derived figure, so the currency form holds it in
        // state and would post it straight back on the next save of an unrelated field. That
        // would re-establish the second stored number as a fact — the same value today, and
        // a stale one the moment somebody edits the conversion rate. Dropping it silently is
        // right here rather than refusing, because the client is echoing our own response
        // rather than asking for a change.
      */
      const { valueInEUR: _derived, ...creditsUpdate } = updateData.credits;
      settings.credits = { ...settings.credits, ...creditsUpdate };
    }
    if (updateData.transactions) {
      settings.transactions = {
        ...settings.transactions,
        ...updateData.transactions,
      };
    }
    if (updateData.branding) {
      settings.branding = { ...settings.branding, ...updateData.branding };
    }

    await settings.save();

    console.log(
      "✅ App settings updated by admin:",
      guard.admin.email,
    );

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: JSON.parse(JSON.stringify(settings)),
    });
  } catch (error) {
    console.error("Error updating app settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
