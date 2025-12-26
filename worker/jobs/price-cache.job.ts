/**
 * Price Cache Update Job
 * 
 * Updates the price cache for all forex pairs.
 * Runs every minute (same as Inngest: update-price-cache)
 * 
 * Note: This is a backup to real-time price updates.
 * The main app fetches prices on-demand, this ensures cache stays fresh.
 */

import { connectToDatabase } from '../config/database';
import { fetchRealForexPrices } from '../../lib/services/real-forex-prices.service';
import { FOREX_PAIRS, type ForexSymbol } from '../../lib/services/pnl-calculator.service';

export interface PriceCacheResult {
  pairsUpdated: number;
  errors: string[];
}

export async function runPriceCacheUpdate(): Promise<PriceCacheResult> {
  const result: PriceCacheResult = {
    pairsUpdated: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Get all supported forex symbols
    const allSymbols = Object.keys(FOREX_PAIRS) as ForexSymbol[];

    // Fetch and cache all prices
    const pricesMap = await fetchRealForexPrices(allSymbols);
    result.pairsUpdated = pricesMap.size;

    return result;
  } catch (error) {
    result.errors.push(`Price cache error: ${error}`);
    return result;
  }
}

export default runPriceCacheUpdate;

