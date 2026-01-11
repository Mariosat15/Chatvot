/**
 * Live Trade Monitor
 * 
 * Monitors ALL trades in real-time across all competitions and challenges.
 * Validates execution prices as they happen.
 * 
 * Run with: npx ts-node test-scripts/live-trade-monitor.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (try .env.local first, then .env)
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function getPipSize(symbol: string): number {
  return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function getPipDifference(price1: number, price2: number, symbol: string): number {
  const pipSize = getPipSize(symbol);
  return Math.abs(price1 - price2) / pipSize;
}

interface TradeEvent {
  _id: mongoose.Types.ObjectId;
  competitionId?: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  openedAt: Date;
  closedAt?: Date;
  status: string;
  closeReason?: string;
}

interface PriceQuote {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
}

/**
 * Fetch current price from the API
 */
async function getCurrentPrice(symbol: string): Promise<PriceQuote | null> {
  try {
    const response = await fetch(`http://localhost:3000/api/trading/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: [symbol] }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.prices && data.prices.length > 0) {
        return data.prices[0];
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a new trade against current market prices
 */
async function validateNewTrade(trade: TradeEvent): Promise<void> {
  const currentPrice = await getCurrentPrice(trade.symbol);
  
  console.log('');
  console.log('═'.repeat(70));
  log(`🆕 NEW TRADE OPENED`, 'green');
  console.log('═'.repeat(70));
  
  console.log(`  Trade ID:      ${trade._id}`);
  console.log(`  User ID:       ${trade.userId}`);
  console.log(`  Contest ID:    ${trade.competitionId || 'N/A'}`);
  console.log(`  Symbol:        ${trade.symbol}`);
  console.log(`  Side:          ${trade.side.toUpperCase()}`);
  console.log(`  Quantity:      ${trade.quantity} lots`);
  console.log(`  Entry Price:   ${trade.entryPrice.toFixed(5)}`);
  console.log(`  Opened At:     ${trade.openedAt}`);
  
  if (currentPrice) {
    console.log('');
    console.log('  📊 Current Market:');
    console.log(`    BID: ${currentPrice.bid.toFixed(5)} (Blue line - Sell here)`);
    console.log(`    ASK: ${currentPrice.ask.toFixed(5)} (Red line - Buy here)`);
    console.log(`    MID: ${currentPrice.mid.toFixed(5)}`);
    console.log(`    Spread: ${(currentPrice.spread / getPipSize(trade.symbol)).toFixed(2)} pips`);
    
    // Expected entry price
    const expectedEntry = trade.side === 'long' ? currentPrice.ask : currentPrice.bid;
    const pipDiff = getPipDifference(trade.entryPrice, expectedEntry, trade.symbol);
    
    console.log('');
    console.log('  🔍 Execution Validation:');
    console.log(`    Expected Entry: ${expectedEntry.toFixed(5)} (${trade.side === 'long' ? 'ASK' : 'BID'})`);
    console.log(`    Actual Entry:   ${trade.entryPrice.toFixed(5)}`);
    console.log(`    Difference:     ${pipDiff.toFixed(2)} pips`);
    
    if (pipDiff < 0.5) {
      log(`  ✅ PASS: Entry price matches expected (within 0.5 pips)`, 'green');
    } else if (pipDiff < 2) {
      log(`  ⚠️ WARNING: Entry differs by ${pipDiff.toFixed(2)} pips (market may have moved)`, 'yellow');
    } else {
      log(`  ❌ ERROR: Large price difference (${pipDiff.toFixed(2)} pips)`, 'red');
    }
    
    // Validate bid < ask
    if (currentPrice.bid >= currentPrice.ask) {
      log(`  ❌ ERROR: Invalid price data - BID >= ASK`, 'red');
    }
  } else {
    log(`  ⚠️ Could not fetch current market price for comparison`, 'yellow');
  }
  
  console.log('═'.repeat(70));
  console.log('');
}

/**
 * Validate a closed trade
 */
async function validateClosedTrade(trade: TradeEvent): Promise<void> {
  const currentPrice = await getCurrentPrice(trade.symbol);
  
  console.log('');
  console.log('═'.repeat(70));
  log(`💰 TRADE CLOSED (${trade.closeReason || 'manual'})`, 'magenta');
  console.log('═'.repeat(70));
  
  console.log(`  Trade ID:      ${trade._id}`);
  console.log(`  User ID:       ${trade.userId}`);
  console.log(`  Contest ID:    ${trade.competitionId || 'N/A'}`);
  console.log(`  Symbol:        ${trade.symbol}`);
  console.log(`  Side:          ${trade.side.toUpperCase()}`);
  console.log(`  Entry Price:   ${trade.entryPrice.toFixed(5)}`);
  console.log(`  Exit Price:    ${trade.exitPrice?.toFixed(5) || 'N/A'}`);
  console.log(`  Closed At:     ${trade.closedAt}`);
  console.log(`  Close Reason:  ${trade.closeReason || 'user'}`);
  
  if (currentPrice && trade.exitPrice) {
    // Expected exit price
    const expectedExit = trade.side === 'long' ? currentPrice.bid : currentPrice.ask;
    const pipDiff = getPipDifference(trade.exitPrice, expectedExit, trade.symbol);
    
    console.log('');
    console.log('  📊 Current Market:');
    console.log(`    BID: ${currentPrice.bid.toFixed(5)}`);
    console.log(`    ASK: ${currentPrice.ask.toFixed(5)}`);
    
    console.log('');
    console.log('  🔍 Exit Validation:');
    console.log(`    Expected Exit: ${expectedExit.toFixed(5)} (${trade.side === 'long' ? 'BID' : 'ASK'})`);
    console.log(`    Actual Exit:   ${trade.exitPrice.toFixed(5)}`);
    console.log(`    Difference:    ${pipDiff.toFixed(2)} pips`);
    
    // Calculate P&L
    const pnlPips = trade.side === 'long' 
      ? (trade.exitPrice - trade.entryPrice) / getPipSize(trade.symbol)
      : (trade.entryPrice - trade.exitPrice) / getPipSize(trade.symbol);
    
    console.log(`    P&L:           ${pnlPips >= 0 ? '+' : ''}${pnlPips.toFixed(2)} pips`);
    
    if (pipDiff < 0.5) {
      log(`  ✅ PASS: Exit price matches expected`, 'green');
    } else if (pipDiff < 2) {
      log(`  ⚠️ INFO: Exit differs by ${pipDiff.toFixed(2)} pips`, 'yellow');
    } else {
      log(`  ❌ WARNING: Large exit price difference`, 'red');
    }
  }
  
  console.log('═'.repeat(70));
  console.log('');
}

/**
 * Main monitoring loop - watches ALL trades globally
 */
async function startMonitoring(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    log('MONGODB_URI not found in environment variables', 'red');
    process.exit(1);
  }

  log('Connecting to database...', 'cyan');
  await mongoose.connect(mongoUri);
  log('Connected!', 'green');

  const positionsCollection = mongoose.connection.collection('tradingpositions');
  
  // Track known positions
  const knownPositions = new Map<string, { status: string; exitPrice?: number }>();
  
  // Initial load of ALL positions
  const existingPositions = await positionsCollection.find({}).toArray();
  
  existingPositions.forEach(p => {
    knownPositions.set(p._id.toString(), {
      status: p.status,
      exitPrice: p.exitPrice,
    });
  });
  
  log(`Loaded ${existingPositions.length} existing positions from database`, 'cyan');
  console.log('');
  console.log('═'.repeat(70));
  log('🔴 LIVE MONITORING ACTIVE - Watching ALL trades globally', 'bold');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Waiting for new trades...');
  console.log('Press Ctrl+C to stop monitoring');
  console.log('─'.repeat(70));

  // Polling loop
  const pollInterval = 1000; // 1 second
  
  const poll = async () => {
    try {
      const positions = await positionsCollection.find({}).toArray();

      for (const position of positions) {
        const posId = position._id.toString();
        const known = knownPositions.get(posId);
        
        // Check for NEW positions
        if (!known) {
          knownPositions.set(posId, {
            status: position.status,
            exitPrice: position.exitPrice,
          });
          await validateNewTrade(position as any);
        }
        // Check for CLOSED positions (status changed from 'open' to 'closed')
        else if (known.status === 'open' && position.status !== 'open') {
          knownPositions.set(posId, {
            status: position.status,
            exitPrice: position.exitPrice,
          });
          await validateClosedTrade(position as any);
        }
      }
    } catch (error) {
      log(`Error polling positions: ${error}`, 'red');
    }
  };

  // Start polling
  setInterval(poll, pollInterval);
  
  // Keep the process running
  process.on('SIGINT', async () => {
    log('\nShutting down monitor...', 'yellow');
    await mongoose.disconnect();
    process.exit(0);
  });
}

// CLI
async function main(): Promise<void> {
  console.log('');
  console.log('═'.repeat(70));
  log('🔴 CHARTVOLT LIVE TRADE MONITOR', 'bold');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Monitors ALL trades in real-time and validates execution prices.');
  console.log('No contest ID required - watches globally across all competitions/challenges.');
  console.log('');
  console.log('Expected execution rules:');
  console.log('  • BUY/LONG entry  → ASK price (red line on chart)');
  console.log('  • SELL/SHORT entry → BID price (blue line on chart)');
  console.log('  • Close LONG      → BID price');
  console.log('  • Close SHORT     → ASK price');
  console.log('');

  await startMonitoring();
}

main();
