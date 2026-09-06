/**
 * Symbol Config Service
 *
 * Resolves trading symbol configurations from the database (TradingSymbol collection)
 * with an in-memory cache and hardcoded FOREX_PAIRS fallback.
 *
 * Server-side only — do NOT import in client components.
 */

import { connectToDatabase } from "@/database/mongoose";
import TradingSymbol from "@/database/models/trading/symbol-settings.model";
import { FOREX_PAIRS, ForexSymbol } from "./pnl-calculator.service";

export interface SymbolConfig {
  pip: number;
  contractSize: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
  commission: number;
  marginRequirement?: number;
}

// Reason: In-memory cache avoids hitting MongoDB on every PnL/margin calculation.
// TTL of 5 minutes balances freshness with performance.
let symbolConfigCache: Map<string, SymbolConfig> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_TTL_MS && symbolConfigCache.size > 0;
}

function hardcodedFallback(symbol: string): SymbolConfig {
  const hc = FOREX_PAIRS[symbol as ForexSymbol];
  if (hc) {
    return {
      pip: hc.pip,
      contractSize: hc.contractSize,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      commission: 0,
    };
  }
  // Reason: Unknown symbols get safe generic defaults so calculations don't throw.
  return {
    pip: 0.0001,
    contractSize: 100000,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
    commission: 0,
  };
}

/**
 * Get configuration for a single trading symbol.
 * Returns DB values if available, otherwise falls back to hardcoded FOREX_PAIRS.
 */
export async function getSymbolConfig(
  symbol: ForexSymbol | string,
): Promise<SymbolConfig> {
  if (isCacheValid() && symbolConfigCache.has(symbol)) {
    return symbolConfigCache.get(symbol)!;
  }

  try {
    await connectToDatabase();
    const doc = await TradingSymbol.findOne({ symbol }).lean();

    if (doc) {
      const config: SymbolConfig = {
        pip: doc.pip,
        contractSize: doc.contractSize,
        minLotSize: doc.minLotSize,
        maxLotSize: doc.maxLotSize,
        lotStep: doc.lotStep,
        commission: doc.commission,
        marginRequirement: doc.marginRequirement,
      };
      symbolConfigCache.set(symbol, config);
      if (!isCacheValid()) cacheTimestamp = Date.now();
      return config;
    }
  } catch (err) {
    console.warn(`⚠️ Failed to fetch symbol config for ${symbol}:`, err);
  }

  return hardcodedFallback(symbol);
}

/**
 * Batch-fetch configurations for multiple symbols in a single DB query.
 * Use this when processing many trades/positions to avoid N+1 queries.
 */
export async function getMultipleSymbolConfigs(
  symbols: (ForexSymbol | string)[],
): Promise<Map<string, SymbolConfig>> {
  const result = new Map<string, SymbolConfig>();
  const needsFetch: string[] = [];

  for (const sym of symbols) {
    if (isCacheValid() && symbolConfigCache.has(sym)) {
      result.set(sym, symbolConfigCache.get(sym)!);
    } else {
      needsFetch.push(sym);
    }
  }

  if (needsFetch.length > 0) {
    try {
      await connectToDatabase();
      const docs = await TradingSymbol.find({
        symbol: { $in: needsFetch },
      }).lean();

      for (const doc of docs) {
        const config: SymbolConfig = {
          pip: doc.pip,
          contractSize: doc.contractSize,
          minLotSize: doc.minLotSize,
          maxLotSize: doc.maxLotSize,
          lotStep: doc.lotStep,
          commission: doc.commission,
          marginRequirement: doc.marginRequirement,
        };
        result.set(doc.symbol, config);
        symbolConfigCache.set(doc.symbol, config);
      }
      cacheTimestamp = Date.now();
    } catch (err) {
      console.warn("⚠️ Failed to batch-fetch symbol configs:", err);
    }
  }

  // Fill missing symbols from hardcoded fallback
  for (const sym of symbols) {
    if (!result.has(sym)) {
      result.set(sym, hardcodedFallback(sym));
    }
  }

  return result;
}

/**
 * Invalidate the in-memory cache. Call when admin updates symbol settings.
 */
export function clearSymbolConfigCache(): void {
  symbolConfigCache.clear();
  cacheTimestamp = 0;
}
