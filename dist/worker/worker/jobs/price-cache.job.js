"use strict";
/**
 * Price Cache Update Job
 *
 * Updates the price cache for all forex pairs.
 * Runs every minute (same as Inngest: update-price-cache)
 *
 * Note: This is a backup to real-time price updates.
 * The main app fetches prices on-demand, this ensures cache stays fresh.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPriceCacheUpdate = runPriceCacheUpdate;
const database_1 = require("../config/database");
const real_forex_prices_service_1 = require("../../lib/services/real-forex-prices.service");
const pnl_calculator_service_1 = require("../../lib/services/pnl-calculator.service");
async function runPriceCacheUpdate() {
    const result = {
        pairsUpdated: 0,
        errors: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // Get all supported forex symbols
        const allSymbols = Object.keys(pnl_calculator_service_1.FOREX_PAIRS);
        // Fetch and cache all prices
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(allSymbols);
        result.pairsUpdated = pricesMap.size;
        return result;
    }
    catch (error) {
        result.errors.push(`Price cache error: ${error}`);
        return result;
    }
}
exports.default = runPriceCacheUpdate;
