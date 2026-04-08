import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TradingSymbol, {
  DEFAULT_FOREX_PAIRS,
} from "@/database/models/trading/symbol-settings.model";

/**
 * POST /api/symbols/sync
 * Sync symbols with default FOREX_PAIRS
 * - Adds any missing default symbols
 * - Does NOT override existing settings
 * - Optionally can reset all to defaults
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const { reset = false } = body;

    if (reset) {
      await TradingSymbol.deleteMany({});

      const defaultSymbols = Object.entries(DEFAULT_FOREX_PAIRS).map(
        ([symbol, config]) => ({
          symbol,
          name: config.name,
          pip: config.pip,
          contractSize: config.contractSize,
          category: config.category,
          popular: config.popular,
          sortOrder: config.sortOrder,
          enabled: true,
          minLotSize: config.minLotSize,
          maxLotSize: config.maxLotSize,
          lotStep: config.lotStep,
          defaultSpread: config.defaultSpread,
          commission: config.commission,
          icon: getSymbolIcon(symbol),
        }),
      );

      await TradingSymbol.insertMany(defaultSymbols);

      return NextResponse.json({
        success: true,
        message: `Reset complete. ${defaultSymbols.length} symbols restored to defaults.`,
        added: defaultSymbols.length,
        reset: true,
      });
    }

    let added = 0;
    let skipped = 0;

    for (const [symbol, config] of Object.entries(DEFAULT_FOREX_PAIRS)) {
      const exists = await TradingSymbol.findOne({ symbol });

      if (!exists) {
        await TradingSymbol.create({
          symbol,
          name: config.name,
          pip: config.pip,
          contractSize: config.contractSize,
          category: config.category,
          popular: config.popular,
          sortOrder: config.sortOrder,
          enabled: true,
          minLotSize: config.minLotSize,
          maxLotSize: config.maxLotSize,
          lotStep: config.lotStep,
          defaultSpread: config.defaultSpread,
          commission: config.commission,
          icon: getSymbolIcon(symbol),
        });
        added++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message:
        added > 0
          ? `Sync complete. Added ${added} missing symbols.`
          : "All symbols already synced.",
      added,
      skipped,
      reset: false,
    });
  } catch (error) {
    console.error("Failed to sync symbols:", error);
    return NextResponse.json(
      { error: "Failed to sync symbols" },
      { status: 500 },
    );
  }
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
