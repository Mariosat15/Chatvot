/**
 * Price Checker - Node.js Version
 *
 * Fetches and displays current prices from the trading API.
 * Works both locally and on deployed servers.
 *
 * Run with: npx tsx test-scripts/price-checker.ts
 *
 * Options:
 *   --url=URL     Base URL (default: http://localhost:3000)
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

interface PriceQuote {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
}

interface PricesResponse {
  prices: PriceQuote[];
  marketOpen: boolean;
  status: string;
  timestamp: number;
}

// All forex symbols to check
const ALL_SYMBOLS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "AUD/USD",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "EUR/AUD",
  "GBP/AUD",
  "EUR/CAD",
  "AUD/JPY",
  "CHF/JPY",
  "EUR/CHF",
  "GBP/CHF",
  "AUD/NZD",
  "EUR/NZD",
  "GBP/NZD",
  "NZD/JPY",
  "CAD/JPY",
  "AUD/CAD",
  "AUD/CHF",
  "NZD/CAD",
  "USD/MXN",
  "USD/ZAR",
  "USD/TRY",
  "USD/SEK",
  "USD/NOK",
];

async function main() {
  console.log("🔍 CHARTVOLT PRICE CHECKER (Node.js)");
  console.log("============================================================\n");

  // Get base URL from args or environment or default
  const args = process.argv.slice(2);
  const urlArg = args.find((arg) => arg.startsWith("--url="));
  const baseUrl = urlArg
    ? urlArg.split("=")[1]
    : process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

  console.log(`📡 Base URL: ${baseUrl}`);
  console.log(`🕐 Time: ${new Date().toISOString()}\n`);

  try {
    // Fetch prices from API using POST with symbols array
    const response = await fetch(`${baseUrl}/api/trading/prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ symbols: ALL_SYMBOLS }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: PricesResponse = await response.json();

    // Display market status
    console.log("📊 MARKET STATUS");
    console.log("------------------------------------------------------------");
    console.log(`  Market Open: ${data.marketOpen ? "✅ YES" : "❌ NO"}`);
    console.log(`  Status: ${data.status || "N/A"}`);
    console.log("");

    // Display prices
    const prices = data.prices || [];

    if (prices.length === 0) {
      console.log("❌ No prices available");
      return;
    }

    console.log("💰 CURRENT PRICES");
    console.log("------------------------------------------------------------");
    console.log(
      "  Symbol      │    BID       │    ASK       │   MID        │ Spread(pips)",
    );
    console.log(
      "──────────────┼──────────────┼──────────────┼──────────────┼─────────────",
    );

    // Sort by symbol
    prices.sort((a, b) => a.symbol.localeCompare(b.symbol));

    let warnings = 0;
    let errors = 0;

    for (const quote of prices) {
      const isJPY = quote.symbol.includes("JPY");
      const decimals = isJPY ? 3 : 5;
      const pipMultiplier = isJPY ? 100 : 10000;
      const spreadPips = (quote.spread * pipMultiplier).toFixed(1);

      console.log(
        `  ${quote.symbol.padEnd(12)}│ ${quote.bid.toFixed(decimals).padStart(12)} │ ${quote.ask.toFixed(decimals).padStart(12)} │ ${quote.mid.toFixed(decimals).padStart(12)} │ ${spreadPips.padStart(11)}`,
      );

      // Validate: mid should be between bid and ask
      if (quote.mid < quote.bid || quote.mid > quote.ask) {
        console.log(
          `    ⚠️  WARNING: Mid price (${quote.mid}) is outside bid/ask range!`,
        );
        warnings++;
      }

      // Validate: bid should be less than ask
      if (quote.bid >= quote.ask) {
        console.log(`    ❌ ERROR: Bid (${quote.bid}) >= Ask (${quote.ask})!`);
        errors++;
      }
    }

    console.log("");
    console.log(`📈 Total: ${prices.length} pairs`);

    // Summary stats
    const spreads = prices.map((p) => {
      const pipMultiplier = p.symbol.includes("JPY") ? 100 : 10000;
      return p.spread * pipMultiplier;
    });
    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const maxSpread = Math.max(...spreads);
    const minSpread = Math.min(...spreads);

    console.log("");
    console.log("📊 SPREAD STATISTICS");
    console.log("------------------------------------------------------------");
    console.log(`  Average: ${avgSpread.toFixed(2)} pips`);
    console.log(`  Min: ${minSpread.toFixed(2)} pips`);
    console.log(`  Max: ${maxSpread.toFixed(2)} pips`);

    console.log("");
    console.log("✅ VALIDATION RESULTS");
    console.log("------------------------------------------------------------");
    if (errors === 0 && warnings === 0) {
      console.log("  ✅ All prices are valid!");
    } else {
      console.log(`  ⚠️ Warnings: ${warnings}`);
      console.log(`  ❌ Errors: ${errors}`);
    }

    console.log("");
    console.log("📋 EXECUTION RULES");
    console.log("------------------------------------------------------------");
    console.log("  BUY (Open Long)   → Executes at ASK (higher price)");
    console.log("  SELL (Open Short) → Executes at BID (lower price)");
    console.log("  Close LONG        → Executes at BID (lower price)");
    console.log("  Close SHORT       → Executes at ASK (higher price)");
  } catch (error) {
    console.error("❌ Failed to fetch prices:", error);
    console.log("");
    console.log("💡 Tips:");
    console.log("   - Make sure the dev server is running (npm run dev)");
    console.log(
      "   - Or specify a URL: npx tsx test-scripts/price-checker.ts --url=https://your-domain.com",
    );
    process.exit(1);
  }
}

main();
