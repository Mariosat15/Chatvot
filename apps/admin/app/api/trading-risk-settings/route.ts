/**
 * Admin Trading Risk Settings API
 *
 * ARCHITECTURE NOTE:
 * This admin API is separate from the trading platform to ensure resilience.
 * If admin settings fail to load, the trading platform falls back to defaults.
 * This prevents admin panel issues from breaking live trading.
 *
 * Admin changes settings → Saved to DB → Trading loads from DB (with fallback)
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/database/mongoose";
import TradingRiskSettings from "@/database/models/trading-risk-settings.model";
import { guardSection } from "@/lib/admin/section-route-guard";

// GET - Load current risk settings
export async function GET() {
  try {
    // Reason: TradingRiskSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("trading-risk");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const settings = await TradingRiskSettings.getSingleton();

    return NextResponse.json({
      success: true,
      settings: {
        marginLiquidation: settings.marginLiquidation,
        marginCall: settings.marginCall,
        marginWarning: settings.marginWarning,
        marginSafe: settings.marginSafe,
        maxOpenPositions: settings.maxOpenPositions,
        maxPositionSize: settings.maxPositionSize,
        minLeverage: settings.minLeverage,
        maxLeverage: settings.maxLeverage,
        defaultLeverage: settings.defaultLeverage,
        maxDrawdownPercent: settings.maxDrawdownPercent,
        dailyLossLimit: settings.dailyLossLimit,
      },
    });
  } catch (error) {
    console.error("❌ Error loading risk settings:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error details:", errorMessage);
    return NextResponse.json(
      {
        message: "Failed to load risk settings",
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

// POST - Save risk settings
export async function POST(req: Request) {
  try {
    // Reason: TradingRiskSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("trading-risk");
    if (!guard.ok) return guard.response;

    const body = await req.json();

    // Validate required fields
    const requiredFields = [
      "marginLiquidation",
      "marginCall",
      "marginWarning",
      "marginSafe",
      "maxOpenPositions",
      "maxPositionSize",
      "minLeverage",
      "maxLeverage",
      "defaultLeverage",
      "maxDrawdownPercent",
      "dailyLossLimit",
    ];

    for (const field of requiredFields) {
      if (typeof body[field] !== "number") {
        return NextResponse.json(
          { message: `Invalid or missing field: ${field}` },
          { status: 400 },
        );
      }
    }

    // Validate margin levels are in correct order
    if (body.marginLiquidation >= body.marginCall) {
      return NextResponse.json(
        { message: "Stopout level must be less than Margin Call level" },
        { status: 400 },
      );
    }
    if (body.marginCall >= body.marginWarning) {
      return NextResponse.json(
        { message: "Margin Call level must be less than Warning level" },
        { status: 400 },
      );
    }
    if (body.marginWarning >= body.marginSafe) {
      return NextResponse.json(
        { message: "Warning level must be less than Safe level" },
        { status: 400 },
      );
    }

    // Validate leverage
    if (body.minLeverage >= body.maxLeverage) {
      return NextResponse.json(
        { message: "Min leverage must be less than Max leverage" },
        { status: 400 },
      );
    }
    if (
      body.defaultLeverage < body.minLeverage ||
      body.defaultLeverage > body.maxLeverage
    ) {
      return NextResponse.json(
        { message: "Default leverage must be between Min and Max" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const settings = await TradingRiskSettings.updateSingleton({
      ...body,
      updatedBy: guard.admin.email,
    });

    console.log("✅ Trading risk settings updated by:", guard.admin.email);

    // Revalidate all trading pages to apply new settings immediately
    revalidatePath("/competitions/[id]/trade", "page");

    return NextResponse.json({
      success: true,
      message: "Risk settings saved successfully",
      settings: {
        marginLiquidation: settings.marginLiquidation,
        marginCall: settings.marginCall,
        marginWarning: settings.marginWarning,
        marginSafe: settings.marginSafe,
        maxOpenPositions: settings.maxOpenPositions,
        maxPositionSize: settings.maxPositionSize,
        minLeverage: settings.minLeverage,
        maxLeverage: settings.maxLeverage,
        defaultLeverage: settings.defaultLeverage,
        maxDrawdownPercent: settings.maxDrawdownPercent,
        dailyLossLimit: settings.dailyLossLimit,
        marginCheckIntervalSeconds: settings.marginCheckIntervalSeconds,
      },
    });
  } catch (error) {
    console.error("❌ Error saving risk settings:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error details:", errorMessage);
    return NextResponse.json(
      {
        message: "Failed to save risk settings",
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
