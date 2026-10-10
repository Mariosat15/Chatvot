# Trade Execution Test Scripts

Scripts for validating that all trades execute at correct bid/ask prices.

## Quick Start

**Make sure your dev server is running** (`npm run dev`) before running these scripts.

### 1. Price Checker (Quick Status)

Check current prices from the API:

```bash
npx tsx test-scripts/price-checker.ts
```

Options:
```bash
# Specify custom URL for deployed server
npx tsx test-scripts/price-checker.ts --url=https://your-domain.com
```

This shows:
- All current bid/ask/mid prices
- Spread in pips for each pair
- Validates that bid < mid < ask
- Market open/closed status

### 2. Live Monitor (Real-time)

Watch ALL new trades as they happen:

```bash
npx tsx test-scripts/live-trade-monitor.ts
```

This will:
- Monitor ALL trades globally (no contest ID needed)
- Validate each new trade's entry price
- Validate each closed trade's exit price
- Show real-time pass/fail status

### 3. Validate All Historical Trades

Check ALL trades in the database:

```bash
npx tsx test-scripts/trade-execution-validator.ts
```

Options:
```bash
# Limit to last 100 trades
npx tsx test-scripts/trade-execution-validator.ts --limit=100

# Filter by symbol
npx tsx test-scripts/trade-execution-validator.ts --symbol=EUR/USD

# Show only failed trades
npx tsx test-scripts/trade-execution-validator.ts --failed

# Combine options
npx tsx test-scripts/trade-execution-validator.ts --limit=50 --failed
```

### 4. Browser Console Check

Open the trading page in your browser, then paste the content of `browser-price-checker.js` into DevTools Console to see current prices and validate bid/ask lines.

**Note:** The browser-price-checker.js is for **browser console only**, not Node.js!

## Execution Rules

| Action | Executes At | Chart Line |
|--------|-------------|------------|
| BUY (Open Long) | **ASK** (higher) | Red line |
| SELL (Open Short) | **BID** (lower) | Blue line |
| Close LONG | **BID** (lower) | Blue line |
| Close SHORT | **ASK** (higher) | Red line |

## What Gets Checked

✅ Entry price matches expected (ASK for buy, BID for sell)
✅ Exit price matches expected (BID for long close, ASK for short close)
✅ Spread is positive (ASK > BID)
✅ Slippage within tolerance (< 0.5 pips = PASS)

## Validation Status

- **✅ PASS** - Trade executed at correct price (< 0.5 pip slippage)
- **❌ FAIL** - Trade executed at wrong price (> 0.5 pip slippage)
- **⚠️ WARNING** - Minor issues detected
- **ℹ️ NO_DATA** - No price log available (older trades before logging was added)

## Price Logging

New trades automatically log price snapshots to the database for validation.
The `pricelogs` collection stores:
- Bid, Ask, Mid, Spread at execution time
- Expected vs actual execution price
- Slippage in pips
- Pass/Fail validation

## Admin Panel Integration

These scripts are also available in the **Admin Panel → Settings → Dev Settings** section where you can run them with one click!

## Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### "MONGODB_URI not found"
Make sure you have a `.env` file with your MongoDB connection string.

### "No price log found"
Price logging was recently added. Older trades won't have logs.
New trades will be fully validated.

### "ECONNREFUSED" error
Make sure your dev server is running (`npm run dev`) on localhost:3000

### Live monitor not showing trades
Make sure your dev server is running on localhost:3000
