/**
 * Browser Price Checker (BROWSER ONLY)
 * 
 * ⚠️ This script runs IN THE BROWSER CONSOLE, not Node.js!
 * For Node.js, use: npx tsx test-scripts/price-checker.ts
 * 
 * Copy and paste this into the browser console while on the trading page
 * to verify that prices are consistent and trades would execute correctly.
 * 
 * Usage: 
 * 1. Open the trading page in your browser
 * 2. Open DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy everything below and paste into the console
 */

(function() {
  console.log('%c🔍 CHARTVOLT PRICE CHECKER', 'font-size: 20px; font-weight: bold; color: #2962ff;');
  console.log('='.repeat(60));
  
  // Fetch current prices
  fetch('/api/trading/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'] }),
  })
  .then(res => res.json())
  .then(data => {
    console.log('%c\n📊 CURRENT MARKET PRICES', 'font-weight: bold; color: #26a69a;');
    console.log('-'.repeat(60));
    
    data.prices.forEach(quote => {
      const pipSize = quote.symbol.includes('JPY') ? 0.01 : 0.0001;
      const spreadPips = (quote.spread / pipSize).toFixed(2);
      const midCheck = ((quote.bid + quote.ask) / 2).toFixed(5);
      const midMatches = Math.abs(parseFloat(midCheck) - quote.mid) < 0.00001;
      
      console.log(`\n%c${quote.symbol}`, 'font-weight: bold; font-size: 14px;');
      console.log(`  BID:    ${quote.bid.toFixed(5)} (Sell/Close Long here)`);
      console.log(`  ASK:    ${quote.ask.toFixed(5)} (Buy/Close Short here)`);
      console.log(`  MID:    ${quote.mid.toFixed(5)} ${midMatches ? '✅' : '⚠️ Expected: ' + midCheck}`);
      console.log(`  SPREAD: ${spreadPips} pips`);
      
      // Validate bid < ask
      if (quote.bid >= quote.ask) {
        console.log(`  %c❌ ERROR: BID >= ASK (Invalid!)`, 'color: red; font-weight: bold;');
      } else {
        console.log(`  %c✅ Valid: BID < ASK`, 'color: green;');
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('%c\n📋 EXECUTION RULES', 'font-weight: bold; color: #ff9800;');
    console.log('-'.repeat(60));
    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│ Action              │ Executes At      │ Chart Line    │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│ BUY (Open Long)     │ ASK (higher)     │ Red line      │');
    console.log('│ SELL (Open Short)   │ BID (lower)      │ Blue line     │');
    console.log('│ Close LONG          │ BID (lower)      │ Blue line     │');
    console.log('│ Close SHORT         │ ASK (higher)     │ Red line      │');
    console.log('└──────────────────────────────────────────────────────────┘');
    
    console.log('\n%c💡 TIP:', 'font-weight: bold; color: #9c27b0;');
    console.log('The spread is your cost. When you open a trade, you immediately');
    console.log('start at a small loss equal to the spread.');
    
    console.log('\n%cMarket Status: ' + data.status, data.marketOpen ? 'color: green;' : 'color: red;');
  })
  .catch(err => {
    console.error('❌ Failed to fetch prices:', err);
  });
})();

