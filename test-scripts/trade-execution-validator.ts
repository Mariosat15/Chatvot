/**
 * Trade Execution Validator
 * 
 * Validates ALL trades in the database - no contest or user ID required.
 * Checks that all trades were executed at correct bid/ask prices.
 * 
 * Run with: npx tsx test-scripts/trade-execution-validator.ts
 * 
 * Options:
 *   --limit=N     Limit to last N trades (default: all)
 *   --symbol=X    Filter by symbol (e.g., --symbol=EUR/USD)
 *   --failed      Show only failed validations
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (try .env.local first, then .env)
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Types
interface TradeValidation {
  tradeId: string;
  contestId: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  orderType: string;
  status: string;
  
  // Entry validation
  entryPrice: number;
  entryBid?: number;
  entryAsk?: number;
  expectedEntryPrice?: number;
  entryPriceCorrect?: boolean;
  entrySlippagePips?: number;
  entryHasLog: boolean;
  
  // Exit validation (if closed)
  exitPrice?: number;
  exitBid?: number;
  exitAsk?: number;
  expectedExitPrice?: number;
  exitPriceCorrect?: boolean;
  exitSlippagePips?: number;
  exitHasLog: boolean;
  
  // Spread info
  spreadAtEntry?: number;
  spreadAtExit?: number;
  
  // P&L
  realizedPnl?: number;
  pnlPips?: number;
  
  // Timestamps
  openedAt: Date;
  closedAt?: Date;
  
  // Overall status
  validationStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NO_DATA';
  issues: string[];
}

interface ValidationSummary {
  timestamp: Date;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  
  // Entry stats
  entriesWithLog: number;
  entriesWithoutLog: number;
  entriesPassed: number;
  entriesFailed: number;
  
  // Exit stats  
  exitsWithLog: number;
  exitsWithoutLog: number;
  exitsPassed: number;
  exitsFailed: number;
  
  // Overall
  passedValidations: number;
  failedValidations: number;
  warningValidations: number;
  noDataValidations: number;
  
  // Metrics
  entryAccuracy: number;
  exitAccuracy: number;
  avgEntrySlippage: number;
  avgExitSlippage: number;
  avgSpread: number;
}

// Price tolerance in pips
const PRICE_TOLERANCE_PIPS = 0.5;

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
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message: string): void {
  console.log('\n' + '═'.repeat(70));
  log(message, 'bold');
  console.log('═'.repeat(70));
}

function logSection(message: string): void {
  console.log('\n' + '─'.repeat(50));
  log(message, 'cyan');
  console.log('─'.repeat(50));
}

function getPipSize(symbol: string): number {
  return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function getPipDifference(price1: number, price2: number, symbol: string): number {
  const pipSize = getPipSize(symbol);
  return Math.abs(price1 - price2) / pipSize;
}

/**
 * Validate a single trade with its price logs
 */
function validateTrade(position: any, entryLog: any, exitLog: any): TradeValidation {
  const pipSize = getPipSize(position.symbol);
  
  const validation: TradeValidation = {
    tradeId: position._id.toString(),
    contestId: position.competitionId || 'N/A',
    userId: position.userId || 'N/A',
    symbol: position.symbol,
    side: position.side,
    orderType: position.orderType || 'market',
    status: position.status,
    entryPrice: position.entryPrice,
    exitPrice: position.exitPrice || position.currentPrice,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
    realizedPnl: position.realizedPnl,
    entryHasLog: !!entryLog,
    exitHasLog: !!exitLog,
    validationStatus: 'NO_DATA',
    issues: [],
  };

  // === ENTRY VALIDATION ===
  if (entryLog) {
    validation.entryBid = entryLog.bid;
    validation.entryAsk = entryLog.ask;
    validation.spreadAtEntry = entryLog.spread / pipSize;
    
    // Expected: LONG buys at ASK, SHORT sells at BID
    const expectedEntry = position.side === 'long' ? entryLog.ask : entryLog.bid;
    validation.expectedEntryPrice = expectedEntry;
    validation.entrySlippagePips = getPipDifference(position.entryPrice, expectedEntry, position.symbol);
    validation.entryPriceCorrect = validation.entrySlippagePips <= PRICE_TOLERANCE_PIPS;

    if (!validation.entryPriceCorrect) {
      validation.issues.push(
        `ENTRY: Got ${position.entryPrice.toFixed(5)}, Expected ${expectedEntry.toFixed(5)} ` +
        `(${position.side === 'long' ? 'ASK' : 'BID'}), Slippage: ${validation.entrySlippagePips.toFixed(2)} pips`
      );
    }
  }

  // === EXIT VALIDATION (only for closed trades) ===
  if (position.status === 'closed' || position.status === 'liquidated') {
    const actualExitPrice = position.exitPrice || position.currentPrice;
    validation.exitPrice = actualExitPrice;
    
    if (exitLog) {
      validation.exitBid = exitLog.bid;
      validation.exitAsk = exitLog.ask;
      validation.spreadAtExit = exitLog.spread / pipSize;
      
      // Expected: LONG sells at BID, SHORT buys at ASK
      const expectedExit = position.side === 'long' ? exitLog.bid : exitLog.ask;
      validation.expectedExitPrice = expectedExit;
      validation.exitSlippagePips = getPipDifference(actualExitPrice, expectedExit, position.symbol);
      validation.exitPriceCorrect = validation.exitSlippagePips <= PRICE_TOLERANCE_PIPS;

      if (!validation.exitPriceCorrect) {
        validation.issues.push(
          `EXIT: Got ${actualExitPrice.toFixed(5)}, Expected ${expectedExit.toFixed(5)} ` +
          `(${position.side === 'long' ? 'BID' : 'ASK'}), Slippage: ${validation.exitSlippagePips.toFixed(2)} pips`
        );
      }
    } else {
      validation.issues.push('No exit price log found for closed trade');
    }

    // Calculate P&L in pips
    validation.pnlPips = position.side === 'long'
      ? (actualExitPrice - position.entryPrice) / pipSize
      : (position.entryPrice - actualExitPrice) / pipSize;
  }

  // === DETERMINE OVERALL STATUS ===
  const hasAnyLog = validation.entryHasLog || validation.exitHasLog;
  const entryFailed = validation.entryPriceCorrect === false;
  const exitFailed = validation.exitPriceCorrect === false;
  
  if (!hasAnyLog) {
    validation.validationStatus = 'NO_DATA';
  } else if (entryFailed || exitFailed) {
    validation.validationStatus = 'FAIL';
  } else if (validation.issues.length > 0) {
    validation.validationStatus = 'WARNING';
  } else {
    validation.validationStatus = 'PASS';
  }

  return validation;
}

/**
 * Print a single trade validation result
 */
function printTradeValidation(v: TradeValidation, showDetails: boolean = true): void {
  const statusColors: Record<string, keyof typeof colors> = {
    'PASS': 'green',
    'FAIL': 'red',
    'WARNING': 'yellow',
    'NO_DATA': 'blue',
  };
  const statusIcons: Record<string, string> = {
    'PASS': '✅',
    'FAIL': '❌',
    'WARNING': '⚠️',
    'NO_DATA': 'ℹ️',
  };

  const icon = statusIcons[v.validationStatus];
  const color = statusColors[v.validationStatus];

  console.log('');
  log(`${icon} [${v.validationStatus}] Trade ${v.tradeId.slice(-8)}`, color);
  console.log(`   Symbol: ${v.symbol} | Side: ${v.side.toUpperCase()} | Status: ${v.status}`);
  
  // Entry details
  console.log(`   📥 ENTRY: ${v.entryPrice.toFixed(5)} @ ${new Date(v.openedAt).toLocaleString()}`);
  if (v.entryHasLog && showDetails) {
    const entryIcon = v.entryPriceCorrect ? '✓' : '✗';
    const entryColor = v.entryPriceCorrect ? 'green' : 'red';
    console.log(`      Bid/Ask: ${v.entryBid?.toFixed(5)} / ${v.entryAsk?.toFixed(5)} | Spread: ${v.spreadAtEntry?.toFixed(2)} pips`);
    log(`      ${entryIcon} Expected: ${v.expectedEntryPrice?.toFixed(5)} (${v.side === 'long' ? 'ASK' : 'BID'}) | Slip: ${v.entrySlippagePips?.toFixed(2)} pips`, entryColor);
  } else if (!v.entryHasLog) {
    log(`      ⚠ No entry price log`, 'yellow');
  }
  
  // Exit details (if closed)
  if (v.status === 'closed' || v.status === 'liquidated') {
    console.log(`   📤 EXIT: ${v.exitPrice?.toFixed(5)} @ ${v.closedAt ? new Date(v.closedAt).toLocaleString() : 'N/A'}`);
    if (v.exitHasLog && showDetails) {
      const exitIcon = v.exitPriceCorrect ? '✓' : '✗';
      const exitColor = v.exitPriceCorrect ? 'green' : 'red';
      console.log(`      Bid/Ask: ${v.exitBid?.toFixed(5)} / ${v.exitAsk?.toFixed(5)} | Spread: ${v.spreadAtExit?.toFixed(2)} pips`);
      log(`      ${exitIcon} Expected: ${v.expectedExitPrice?.toFixed(5)} (${v.side === 'long' ? 'BID' : 'ASK'}) | Slip: ${v.exitSlippagePips?.toFixed(2)} pips`, exitColor);
    } else if (!v.exitHasLog) {
      log(`      ⚠ No exit price log`, 'yellow');
    }
    
    // P&L
    if (v.pnlPips !== undefined) {
      const pnlColor = v.pnlPips >= 0 ? 'green' : 'red';
      log(`   💰 P&L: ${v.pnlPips >= 0 ? '+' : ''}${v.pnlPips.toFixed(2)} pips`, pnlColor);
    }
  }

  // Issues
  if (v.issues.length > 0 && showDetails) {
    v.issues.forEach(issue => {
      log(`   ⚠ ${issue}`, 'yellow');
    });
  }
}

/**
 * Print summary report
 */
function printSummary(summary: ValidationSummary, validations: TradeValidation[]): void {
  logHeader('📊 TRADE EXECUTION VALIDATION REPORT');
  
  console.log(`Timestamp: ${summary.timestamp.toISOString()}`);
  console.log('');
  
  logSection('Trade Statistics');
  console.log(`Total Trades:     ${summary.totalTrades}`);
  console.log(`  Open:           ${summary.openTrades}`);
  console.log(`  Closed:         ${summary.closedTrades}`);
  console.log('');

  logSection('Entry Validation');
  console.log(`Trades with entry log:    ${summary.entriesWithLog}`);
  console.log(`Trades without entry log: ${summary.entriesWithoutLog}`);
  if (summary.entriesWithLog > 0) {
    log(`  ✅ Passed: ${summary.entriesPassed}`, 'green');
    log(`  ❌ Failed: ${summary.entriesFailed}`, 'red');
    const entryAcc = summary.entriesWithLog > 0 ? (summary.entriesPassed / summary.entriesWithLog) * 100 : 0;
    const entryColor = entryAcc >= 95 ? 'green' : entryAcc >= 80 ? 'yellow' : 'red';
    log(`  Accuracy: ${entryAcc.toFixed(1)}%`, entryColor);
    console.log(`  Avg Slippage: ${summary.avgEntrySlippage.toFixed(2)} pips`);
  }

  logSection('Exit Validation');
  console.log(`Closed trades with exit log:    ${summary.exitsWithLog}`);
  console.log(`Closed trades without exit log: ${summary.exitsWithoutLog}`);
  if (summary.exitsWithLog > 0) {
    log(`  ✅ Passed: ${summary.exitsPassed}`, 'green');
    log(`  ❌ Failed: ${summary.exitsFailed}`, 'red');
    const exitAcc = summary.exitsWithLog > 0 ? (summary.exitsPassed / summary.exitsWithLog) * 100 : 0;
    const exitColor = exitAcc >= 95 ? 'green' : exitAcc >= 80 ? 'yellow' : 'red';
    log(`  Accuracy: ${exitAcc.toFixed(1)}%`, exitColor);
    console.log(`  Avg Slippage: ${summary.avgExitSlippage.toFixed(2)} pips`);
  }

  logSection('Overall Validation Results');
  log(`  ✅ Passed:      ${summary.passedValidations}`, 'green');
  log(`  ❌ Failed:      ${summary.failedValidations}`, 'red');
  log(`  ⚠️ Warnings:    ${summary.warningValidations}`, 'yellow');
  log(`  ℹ️ No Data:     ${summary.noDataValidations}`, 'blue');

  logSection('Execution Rules Reference');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Action              │ Should Execute At                   │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ BUY (Open Long)     │ ASK price (higher - red line)       │');
  console.log('│ SELL (Open Short)   │ BID price (lower - blue line)       │');
  console.log('│ Close LONG          │ BID price (lower - blue line)       │');
  console.log('│ Close SHORT         │ ASK price (higher - red line)       │');
  console.log('└────────────────────────────────────────────────────────────┘');

  // Show failed trades
  const failedTrades = validations.filter(v => v.validationStatus === 'FAIL');
  if (failedTrades.length > 0) {
    logSection(`❌ Failed Validations (${failedTrades.length})`);
    failedTrades.slice(0, 20).forEach(v => printTradeValidation(v, true));
    if (failedTrades.length > 20) {
      console.log(`\n... and ${failedTrades.length - 20} more failed validations`);
    }
  }

  // Show warnings
  const warningTrades = validations.filter(v => v.validationStatus === 'WARNING');
  if (warningTrades.length > 0 && warningTrades.length <= 10) {
    logSection(`⚠️ Warnings (${warningTrades.length})`);
    warningTrades.forEach(v => printTradeValidation(v, true));
  }

  console.log('\n' + '═'.repeat(70));
  if (summary.failedValidations === 0) {
    log('✅ ALL VALIDATED TRADES EXECUTED CORRECTLY!', 'green');
  } else {
    log(`❌ ${summary.failedValidations} TRADE(S) HAVE EXECUTION ISSUES`, 'red');
  }
  console.log('═'.repeat(70) + '\n');
}

/**
 * Main validation function
 */
async function validateAllTrades(options: {
  limit?: number;
  symbol?: string;
  failedOnly?: boolean;
}): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    log('MONGODB_URI not found in environment variables', 'red');
    log('Make sure you have a .env or .env.local file with MONGODB_URI', 'yellow');
    process.exit(1);
  }

  log('Connecting to database...', 'cyan');
  await mongoose.connect(mongoUri);
  log('Connected!', 'green');

  try {
    const positionsCollection = mongoose.connection.collection('tradingpositions');
    const priceLogsCollection = mongoose.connection.collection('pricelogs');

    // Build query
    const query: any = {};
    if (options.symbol) {
      query.symbol = options.symbol;
    }

    // Fetch positions
    let positionsCursor = positionsCollection.find(query).sort({ openedAt: -1 });
    if (options.limit) {
      positionsCursor = positionsCursor.limit(options.limit);
    }
    const positions = await positionsCursor.toArray();

    log(`Found ${positions.length} trades to validate`, 'cyan');

    const validations: TradeValidation[] = [];
    let processedCount = 0;

    for (const position of positions) {
      processedCount++;
      if (processedCount % 100 === 0) {
        log(`Processing trade ${processedCount}/${positions.length}...`, 'cyan');
      }

      // Look for price logs for this trade
      const priceLogs = await priceLogsCollection.find({
        tradeId: position._id.toString(),
      }).toArray();

      // Get entry and exit logs
      const entryLog = priceLogs.find((p: any) => p.tradeType === 'entry');
      const exitLog = priceLogs.find((p: any) => p.tradeType === 'exit');

      // Validate trade with both logs
      const validation = validateTrade(position, entryLog, exitLog);
      validations.push(validation);
    }

    // Calculate summary
    const closedTrades = validations.filter(v => v.status === 'closed' || v.status === 'liquidated');
    
    const summary: ValidationSummary = {
      timestamp: new Date(),
      totalTrades: validations.length,
      openTrades: validations.filter(v => v.status === 'open').length,
      closedTrades: closedTrades.length,
      
      // Entry stats
      entriesWithLog: validations.filter(v => v.entryHasLog).length,
      entriesWithoutLog: validations.filter(v => !v.entryHasLog).length,
      entriesPassed: validations.filter(v => v.entryPriceCorrect === true).length,
      entriesFailed: validations.filter(v => v.entryPriceCorrect === false).length,
      
      // Exit stats
      exitsWithLog: closedTrades.filter(v => v.exitHasLog).length,
      exitsWithoutLog: closedTrades.filter(v => !v.exitHasLog).length,
      exitsPassed: validations.filter(v => v.exitPriceCorrect === true).length,
      exitsFailed: validations.filter(v => v.exitPriceCorrect === false).length,
      
      // Overall
      passedValidations: validations.filter(v => v.validationStatus === 'PASS').length,
      failedValidations: validations.filter(v => v.validationStatus === 'FAIL').length,
      warningValidations: validations.filter(v => v.validationStatus === 'WARNING').length,
      noDataValidations: validations.filter(v => v.validationStatus === 'NO_DATA').length,
      
      entryAccuracy: 0,
      exitAccuracy: 0,
      avgEntrySlippage: 0,
      avgExitSlippage: 0,
      avgSpread: 0,
    };

    // Calculate averages
    const entrySlipage = validations.filter(v => v.entrySlippagePips !== undefined);
    if (entrySlipage.length > 0) {
      summary.avgEntrySlippage = entrySlipage.reduce((a, v) => a + (v.entrySlippagePips || 0), 0) / entrySlipage.length;
    }

    const exitSlippage = validations.filter(v => v.exitSlippagePips !== undefined);
    if (exitSlippage.length > 0) {
      summary.avgExitSlippage = exitSlippage.reduce((a, v) => a + (v.exitSlippagePips || 0), 0) / exitSlippage.length;
    }

    const withSpread = validations.filter(v => v.spreadAtEntry !== undefined);
    if (withSpread.length > 0) {
      summary.avgSpread = withSpread.reduce((a, v) => a + (v.spreadAtEntry || 0), 0) / withSpread.length;
    }

    // Filter if --failed only
    const displayValidations = options.failedOnly 
      ? validations.filter(v => v.validationStatus === 'FAIL' || v.validationStatus === 'WARNING')
      : validations;

    printSummary(summary, displayValidations);

  } finally {
    await mongoose.disconnect();
  }
}

// Parse CLI arguments
function parseArgs(): { limit?: number; symbol?: string; failedOnly?: boolean } {
  const args = process.argv.slice(2);
  const options: { limit?: number; symbol?: string; failedOnly?: boolean } = {};

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--symbol=')) {
      options.symbol = arg.split('=')[1];
    } else if (arg === '--failed') {
      options.failedOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Trade Execution Validator
=========================

Validates ALL trades in the database to ensure they executed at correct prices.

Usage:
  npx tsx test-scripts/trade-execution-validator.ts [options]

Options:
  --limit=N       Limit to last N trades (default: all)
  --symbol=X      Filter by symbol (e.g., --symbol=EUR/USD)
  --failed        Show only failed validations
  --help, -h      Show this help

Examples:
  npx tsx test-scripts/trade-execution-validator.ts
  npx tsx test-scripts/trade-execution-validator.ts --limit=100
  npx tsx test-scripts/trade-execution-validator.ts --symbol=EUR/USD
  npx tsx test-scripts/trade-execution-validator.ts --failed
`);
      process.exit(0);
    }
  }

  return options;
}

// Main
async function main(): Promise<void> {
  console.log('');
  console.log('═'.repeat(70));
  log('🔍 TRADE EXECUTION VALIDATOR', 'bold');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Validates ALL trades in the database for correct bid/ask execution.');
  console.log('Checks ENTRY (open) and EXIT (close) prices separately.');
  console.log('');

  const options = parseArgs();
  
  if (options.limit) {
    console.log(`Limiting to last ${options.limit} trades`);
  }
  if (options.symbol) {
    console.log(`Filtering by symbol: ${options.symbol}`);
  }
  if (options.failedOnly) {
    console.log('Showing failed/warning validations only');
  }
  console.log('');

  try {
    await validateAllTrades(options);
  } catch (error) {
    log(`Fatal error: ${error}`, 'red');
    process.exit(1);
  }
}

main();
