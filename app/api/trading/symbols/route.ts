import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import TradingSymbol, { DEFAULT_FOREX_PAIRS, ITradingSymbol } from '@/database/models/trading/symbol-settings.model';
import { FOREX_PAIRS, ForexSymbol } from '@/lib/services/pnl-calculator.service';

/**
 * GET /api/trading/symbols
 * 
 * Get enabled trading symbols for the trading interface
 * Falls back to hardcoded FOREX_PAIRS if database is empty
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    
    // Check if we have symbols in database
    const count = await TradingSymbol.countDocuments();
    
    if (count === 0) {
      // Return hardcoded pairs if database is empty
      console.log('ℹ️ No symbols in database, using defaults');
      return NextResponse.json({
        symbols: Object.entries(FOREX_PAIRS).map(([symbol, config]) => ({
          symbol: symbol as ForexSymbol,
          name: config.name,
          pip: config.pip,
          contractSize: config.contractSize,
          enabled: true,
          category: getCategoryFromSymbol(symbol),
        })),
        source: 'defaults'
      });
    }
    
    // Build query for enabled symbols
    const query: any = { enabled: true };
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const symbols = await TradingSymbol.find(query)
      .sort({ category: 1, sortOrder: 1 })
      .lean();
    
    // Transform to format expected by frontend
    const formattedSymbols = symbols.map(sym => ({
      symbol: sym.symbol as ForexSymbol,
      name: sym.name,
      pip: sym.pip,
      contractSize: sym.contractSize,
      enabled: sym.enabled,
      category: sym.category,
      minLotSize: sym.minLotSize,
      maxLotSize: sym.maxLotSize,
      defaultSpread: sym.defaultSpread,
      popular: sym.popular,
      icon: sym.icon,
    }));
    
    return NextResponse.json({
      symbols: formattedSymbols,
      source: 'database'
    });
  } catch (error) {
    console.error('Failed to fetch trading symbols:', error);
    
    // Fallback to hardcoded on error
    return NextResponse.json({
      symbols: Object.entries(FOREX_PAIRS).map(([symbol, config]) => ({
        symbol: symbol as ForexSymbol,
        name: config.name,
        pip: config.pip,
        contractSize: config.contractSize,
        enabled: true,
        category: getCategoryFromSymbol(symbol),
      })),
      source: 'fallback'
    });
  }
}

function getCategoryFromSymbol(symbol: string): 'major' | 'cross' | 'exotic' {
  const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
  const exoticPairs = ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'];
  
  if (majorPairs.includes(symbol)) return 'major';
  if (exoticPairs.includes(symbol)) return 'exotic';
  return 'cross';
}

