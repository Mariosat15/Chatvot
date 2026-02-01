import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TradingSymbol, {
  DEFAULT_FOREX_PAIRS,
  ITradingSymbol,
} from "@/database/models/trading/symbol-settings.model";

/**
 * GET /api/symbols
 * Get all trading symbols with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const enabled = searchParams.get("enabled");
    const category = searchParams.get("category");

    // Build query
    const query: any = {};
    if (enabled !== null) {
      query.enabled = enabled === "true";
    }
    if (category && category !== "all") {
      query.category = category;
    }

    // Check if symbols exist, if not seed with defaults
    const count = await TradingSymbol.countDocuments();
    if (count === 0) {
      console.log("🌱 Seeding default trading symbols...");
      await seedDefaultSymbols();
    }

    const symbols = await TradingSymbol.find(query)
      .sort({ category: 1, sortOrder: 1 })
      .lean();

    // Get stats
    const stats = {
      total: await TradingSymbol.countDocuments(),
      enabled: await TradingSymbol.countDocuments({ enabled: true }),
      disabled: await TradingSymbol.countDocuments({ enabled: false }),
      byCategory: {
        major: await TradingSymbol.countDocuments({ category: "major" }),
        cross: await TradingSymbol.countDocuments({ category: "cross" }),
        exotic: await TradingSymbol.countDocuments({ category: "exotic" }),
        custom: await TradingSymbol.countDocuments({ category: "custom" }),
      },
    };

    return NextResponse.json({ symbols, stats });
  } catch (error) {
    console.error("Failed to fetch symbols:", error);
    return NextResponse.json(
      { error: "Failed to fetch symbols" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/symbols
 * Add a new custom symbol
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      symbol,
      name,
      pip,
      contractSize,
      category = "custom",
      ...rest
    } = body;

    // Validate required fields
    if (!symbol || !name) {
      return NextResponse.json(
        { error: "Symbol and name are required" },
        { status: 400 },
      );
    }

    // Check if symbol already exists
    const existing = await TradingSymbol.findOne({
      symbol: symbol.toUpperCase(),
    });
    if (existing) {
      return NextResponse.json(
        { error: "Symbol already exists" },
        { status: 400 },
      );
    }

    // Create new symbol
    const newSymbol = await TradingSymbol.create({
      symbol: symbol.toUpperCase(),
      name,
      pip: pip || 0.0001,
      contractSize: contractSize || 100000,
      category,
      enabled: true,
      minLotSize: rest.minLotSize || 0.01,
      maxLotSize: rest.maxLotSize || 100,
      lotStep: rest.lotStep || 0.01,
      defaultSpread: rest.defaultSpread || 2,
      commission: rest.commission || 0,
      popular: rest.popular || false,
      sortOrder: rest.sortOrder || 99,
      icon: rest.icon || "💱",
    });

    return NextResponse.json({
      success: true,
      symbol: newSymbol,
      message: `Symbol ${symbol} added successfully`,
    });
  } catch (error) {
    console.error("Failed to add symbol:", error);
    return NextResponse.json(
      { error: "Failed to add symbol" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/symbols
 * Bulk update symbols (enable/disable multiple)
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, symbols, category } = body;

    let updateMessage = "";

    if (action === "enableAll") {
      const filter = category && category !== "all" ? { category } : {};
      await TradingSymbol.updateMany(filter, { enabled: true });
      updateMessage = "All symbols enabled";
    } else if (action === "disableAll") {
      const filter = category && category !== "all" ? { category } : {};
      await TradingSymbol.updateMany(filter, { enabled: false });
      updateMessage = "All symbols disabled";
    } else if (action === "bulkUpdate" && Array.isArray(symbols)) {
      for (const sym of symbols) {
        await TradingSymbol.findOneAndUpdate(
          { symbol: sym.symbol },
          { enabled: sym.enabled },
          { upsert: false },
        );
      }
      updateMessage = `Updated ${symbols.length} symbols`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Notify the main app to refresh its price health monitor's enabled symbols list
    await notifyPriceHealthMonitorRefresh();

    return NextResponse.json({ success: true, message: updateMessage });
  } catch (error) {
    console.error("Failed to bulk update symbols:", error);
    return NextResponse.json(
      { error: "Failed to update symbols" },
      { status: 500 },
    );
  }
}

/**
 * Notify the main app's price health monitor to refresh its enabled symbols list
 * This ensures the monitor only tracks enabled symbols after admin changes
 */
async function notifyPriceHealthMonitorRefresh(): Promise<void> {
  try {
    const mainAppUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${mainAppUrl}/api/internal/price-health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.INTERNAL_API_KEY || "internal-key",
      },
      body: JSON.stringify({ action: "refreshSymbols" }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Price health monitor refreshed: ${data.message}`);
    } else {
      console.warn(
        "⚠️ Failed to notify price health monitor (main app may not be running)",
      );
    }
  } catch (error) {
    // Main app might not be running - this is not critical
    console.warn("⚠️ Could not notify price health monitor:", error);
  }
}

/**
 * Seed database with default forex pairs
 */
async function seedDefaultSymbols() {
  const defaultSymbols = Object.entries(DEFAULT_FOREX_PAIRS).map(
    ([symbol, config]) => ({
      symbol,
      name: config.name,
      pip: config.pip,
      category: config.category,
      popular: config.popular,
      sortOrder: config.sortOrder,
      contractSize: 100000,
      enabled: true,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      defaultSpread: symbol.includes("JPY") ? 1.5 : 1.2,
      commission: 0,
      icon: getSymbolIcon(symbol),
    }),
  );

  await TradingSymbol.insertMany(defaultSymbols);
  console.log(`✅ Seeded ${defaultSymbols.length} default trading symbols`);
}

function getSymbolIcon(symbol: string): string {
  const base = symbol.split("/")[0];
  const flags: Record<string, string> = {
    EUR: "🇪🇺",
    USD: "🇺🇸",
    GBP: "🇬🇧",
    JPY: "🇯🇵",
    AUD: "🇦🇺",
    CAD: "🇨🇦",
    CHF: "🇨🇭",
    NZD: "🇳🇿",
    MXN: "🇲🇽",
    ZAR: "🇿🇦",
    TRY: "🇹🇷",
    SEK: "🇸🇪",
    NOK: "🇳🇴",
  };
  return flags[base] || "💱";
}
