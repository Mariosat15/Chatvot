#!/usr/bin/env node
/**
 * ============================================
 * CHARTVOLT DATABASE SETUP SCRIPT
 * ============================================
 * 
 * Run this script to initialize a new database for white label deployments.
 * It creates all required indexes and seeds default data.
 * 
 * Usage:
 *   node scripts/setup-database.js
 * 
 * Options:
 *   --indexes-only    Only create indexes, skip seeding data
 *   --seed-only       Only seed data, skip index creation
 *   --force           Force re-seed data even if it exists
 * 
 * Environment:
 *   Requires MONGODB_URI in .env or environment
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================
// CONFIGURATION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not found in environment!');
  console.error('   Make sure .env file exists with MONGODB_URI=your_connection_string');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const indexesOnly = args.includes('--indexes-only');
const seedOnly = args.includes('--seed-only');
const forceReseed = args.includes('--force');

// ============================================
// INDEX DEFINITIONS
// ============================================
// These match the indexes defined in Mongoose schemas

const INDEXES = {
  // 1-minute candles (live data from WebSocket)
  candle1ms: [
    { keys: { symbol: 1, t: 1 }, options: { unique: true } },
    { keys: { symbol: 1, t: -1 } },
  ],
  
  // Historical candles - 5m (permanent storage from Massive.com API)
  candles_historical_5m: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Historical candles - 15m
  candles_historical_15m: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Historical candles - 30m
  candles_historical_30m: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Historical candles - 1h
  candles_historical_1h: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Historical candles - 4h
  candles_historical_4h: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Historical candles - 1d (daily)
  candles_historical_1d: [
    { keys: { symbol: 1, timestamp: 1 }, options: { unique: true } },
    { keys: { symbol: 1 } },
    { keys: { timestamp: 1 } },
  ],
  
  // Trading positions
  tradingpositions: [
    { keys: { competitionId: 1, status: 1 } },
    { keys: { userId: 1, status: 1 } },
    { keys: { symbol: 1, status: 1 } },
    { keys: { participantId: 1, status: 1 } },
    { keys: { competitionId: 1, userId: 1, status: 1 } },
    { keys: { userId: 1, competitionId: 1, openedAt: -1 } },
    { keys: { status: 1, lastPriceUpdate: 1 } },
    { keys: { competitionId: 1, symbol: 1, status: 1 } },
  ],
  
  // Trading orders
  tradingorders: [
    { keys: { competitionId: 1, userId: 1, placedAt: -1 } },
    { keys: { status: 1, placedAt: -1 } },
    { keys: { symbol: 1, status: 1 } },
    { keys: { userId: 1, status: 1, placedAt: -1 } },
  ],
  
  // Trade history
  tradehistories: [
    { keys: { competitionId: 1, closedAt: -1 } },
    { keys: { userId: 1, closedAt: -1 } },
    { keys: { participantId: 1, closedAt: -1 } },
    { keys: { symbol: 1, closedAt: -1 } },
    { keys: { competitionId: 1, isWinner: 1 } },
    { keys: { userId: 1, isWinner: 1 } },
    { keys: { userId: 1, competitionId: 1, closedAt: -1 } },
    { keys: { competitionId: 1, realizedPnl: -1 } },
    { keys: { closeReason: 1, closedAt: -1 } },
  ],
  
  // Competitions
  competitions: [
    { keys: { status: 1, startTime: -1 } },
    { keys: { slug: 1 }, options: { unique: true } },
    { keys: { createdBy: 1 } },
    { keys: { status: 1, registrationDeadline: 1 } },
    { keys: { status: 1, endTime: 1 } },
    { keys: { status: 1, currentParticipants: 1 } },
    { keys: { tags: 1, status: 1 } },
  ],
  
  // Wallet transactions
  wallettransactions: [
    { keys: { userId: 1, createdAt: -1 } },
    { keys: { competitionId: 1 } },
    { keys: { status: 1, createdAt: -1 } },
    { keys: { transactionType: 1, createdAt: -1 } },
    { keys: { provider: 1, createdAt: -1 } },
    { keys: { providerTransactionId: 1 } },
    { keys: { paymentIntentId: 1 } },
  ],
  
  // Credit wallets
  creditwallets: [
    { keys: { userId: 1 }, options: { unique: true } },
    { keys: { isActive: 1 } },
  ],
  
  // Trading symbols
  tradingsymbols: [
    { keys: { symbol: 1 }, options: { unique: true } },
    { keys: { enabled: 1, category: 1 } },
    { keys: { category: 1, sortOrder: 1 } },
    { keys: { popular: 1, enabled: 1 } },
  ],
  
  // Price logs
  pricelogs: [
    { keys: { symbol: 1, timestamp: -1 } },
    { keys: { tradeId: 1, tradeType: 1 } },
  ],
  
  // Price cache (for worker)
  pricecaches: [
    { keys: { symbol: 1 }, options: { unique: true } },
  ],
  
  // Users
  users: [
    { keys: { email: 1 }, options: { unique: true } },
    { keys: { username: 1 }, options: { unique: true, sparse: true } },
  ],
  
  // Sessions
  sessions: [
    { keys: { sessionToken: 1 }, options: { unique: true } },
    { keys: { userId: 1 } },
    { keys: { expires: 1 } },
  ],
  
  // Accounts (OAuth)
  accounts: [
    { keys: { provider: 1, providerAccountId: 1 }, options: { unique: true } },
    { keys: { userId: 1 } },
  ],
};

// ============================================
// DEFAULT DATA
// ============================================

const DEFAULT_TRADING_SYMBOLS = [
  // Major pairs
  { symbol: 'EUR/USD', category: 'major', pip: 0.0001, defaultSpread: 1.0, enabled: true, popular: true, sortOrder: 1 },
  { symbol: 'GBP/USD', category: 'major', pip: 0.0001, defaultSpread: 1.2, enabled: true, popular: true, sortOrder: 2 },
  { symbol: 'USD/JPY', category: 'major', pip: 0.01, defaultSpread: 1.0, enabled: true, popular: true, sortOrder: 3 },
  { symbol: 'USD/CHF', category: 'major', pip: 0.0001, defaultSpread: 1.5, enabled: true, popular: false, sortOrder: 4 },
  { symbol: 'AUD/USD', category: 'major', pip: 0.0001, defaultSpread: 1.2, enabled: true, popular: true, sortOrder: 5 },
  { symbol: 'USD/CAD', category: 'major', pip: 0.0001, defaultSpread: 1.5, enabled: true, popular: false, sortOrder: 6 },
  { symbol: 'NZD/USD', category: 'major', pip: 0.0001, defaultSpread: 1.8, enabled: true, popular: false, sortOrder: 7 },
  
  // Cross pairs
  { symbol: 'EUR/GBP', category: 'cross', pip: 0.0001, defaultSpread: 1.5, enabled: true, popular: false, sortOrder: 10 },
  { symbol: 'EUR/JPY', category: 'cross', pip: 0.01, defaultSpread: 1.5, enabled: true, popular: true, sortOrder: 11 },
  { symbol: 'EUR/CHF', category: 'cross', pip: 0.0001, defaultSpread: 2.0, enabled: true, popular: false, sortOrder: 12 },
  { symbol: 'EUR/AUD', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 13 },
  { symbol: 'EUR/CAD', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 14 },
  { symbol: 'EUR/NZD', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 15 },
  { symbol: 'GBP/JPY', category: 'cross', pip: 0.01, defaultSpread: 2.5, enabled: true, popular: true, sortOrder: 16 },
  { symbol: 'GBP/CHF', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 17 },
  { symbol: 'GBP/AUD', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 18 },
  { symbol: 'GBP/CAD', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 19 },
  { symbol: 'GBP/NZD', category: 'cross', pip: 0.0001, defaultSpread: 4.0, enabled: true, popular: false, sortOrder: 20 },
  { symbol: 'AUD/JPY', category: 'cross', pip: 0.01, defaultSpread: 2.0, enabled: true, popular: false, sortOrder: 21 },
  { symbol: 'AUD/CHF', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 22 },
  { symbol: 'AUD/CAD', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 23 },
  { symbol: 'AUD/NZD', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 24 },
  { symbol: 'CAD/JPY', category: 'cross', pip: 0.01, defaultSpread: 2.0, enabled: true, popular: false, sortOrder: 25 },
  { symbol: 'CAD/CHF', category: 'cross', pip: 0.0001, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 26 },
  { symbol: 'CHF/JPY', category: 'cross', pip: 0.01, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 27 },
  { symbol: 'NZD/JPY', category: 'cross', pip: 0.01, defaultSpread: 2.5, enabled: true, popular: false, sortOrder: 28 },
  { symbol: 'NZD/CHF', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 29 },
  { symbol: 'NZD/CAD', category: 'cross', pip: 0.0001, defaultSpread: 3.0, enabled: true, popular: false, sortOrder: 30 },
  
  // Exotic pairs
  { symbol: 'USD/MXN', category: 'exotic', pip: 0.0001, defaultSpread: 50, enabled: true, popular: false, sortOrder: 40 },
  { symbol: 'USD/ZAR', category: 'exotic', pip: 0.0001, defaultSpread: 80, enabled: true, popular: false, sortOrder: 41 },
  { symbol: 'USD/TRY', category: 'exotic', pip: 0.0001, defaultSpread: 100, enabled: true, popular: false, sortOrder: 42 },
  { symbol: 'USD/SEK', category: 'exotic', pip: 0.0001, defaultSpread: 40, enabled: true, popular: false, sortOrder: 43 },
  { symbol: 'USD/NOK', category: 'exotic', pip: 0.0001, defaultSpread: 40, enabled: true, popular: false, sortOrder: 44 },
];

const DEFAULT_MARKET_DATA_SETTINGS = {
  key: 'market_data_settings',
  cleanup: {
    enabled: false,
    maxAge: 90,
    schedule: { type: 'daily', hour: 3, minute: 0 },
  },
  gapFill: {
    enabled: true,
    maxGapMinutes: 60,
    schedule: { type: 'daily', hour: 4, minute: 0 },
  },
  priceUpdateMode: 'websocket',
  pollingIntervalMs: 200,
  websocketIntervalMs: 50,
  candleLimits: {
    '1m': 1440,
    '5m': 2016,
    '15m': 672,
    '30m': 336,
    '1h': 168,
    '4h': 180,
    '1d': 365,
  },
  chartLimitsEnabled: true,
};

// ============================================
// MAIN FUNCTIONS
// ============================================

async function createIndexes(db) {
  console.log('\n📊 Creating indexes...\n');
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const [collectionName, indexes] of Object.entries(INDEXES)) {
    process.stdout.write(`   ${collectionName}: `);
    
    try {
      const collection = db.collection(collectionName);
      
      // Get existing indexes
      const existingIndexes = await collection.indexes().catch(() => []);
      const existingIndexNames = existingIndexes.map(idx => JSON.stringify(idx.key));
      
      let collCreated = 0;
      let collSkipped = 0;
      
      for (const index of indexes) {
        const indexKey = JSON.stringify(index.keys);
        
        if (existingIndexNames.includes(indexKey)) {
          collSkipped++;
          skipped++;
        } else {
          await collection.createIndex(index.keys, index.options || {});
          collCreated++;
          created++;
        }
      }
      
      if (collCreated > 0) {
        console.log(`✅ ${collCreated} created, ${collSkipped} skipped`);
      } else {
        console.log(`⏭️  ${collSkipped} already exist`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n   Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
  return { created, skipped, errors };
}

async function seedData(db, force = false) {
  console.log('\n🌱 Seeding default data...\n');
  
  // Seed trading symbols
  const symbolsCollection = db.collection('tradingsymbols');
  const existingSymbols = await symbolsCollection.countDocuments();
  
  if (existingSymbols > 0 && !force) {
    console.log(`   tradingsymbols: ⏭️  ${existingSymbols} symbols already exist (use --force to re-seed)`);
  } else {
    if (force && existingSymbols > 0) {
      await symbolsCollection.deleteMany({});
      console.log(`   tradingsymbols: 🗑️  Cleared ${existingSymbols} existing symbols`);
    }
    
    const result = await symbolsCollection.insertMany(
      DEFAULT_TRADING_SYMBOLS.map(s => ({
        ...s,
        useFixedSpread: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
    console.log(`   tradingsymbols: ✅ Inserted ${result.insertedCount} symbols`);
  }
  
  // Seed market data settings
  const settingsCollection = db.collection('marketdatasettings');
  const existingSettings = await settingsCollection.findOne({ key: 'market_data_settings' });
  
  if (existingSettings && !force) {
    console.log(`   marketdatasettings: ⏭️  Settings already exist`);
  } else {
    await settingsCollection.updateOne(
      { key: 'market_data_settings' },
      { 
        $set: {
          ...DEFAULT_MARKET_DATA_SETTINGS,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`   marketdatasettings: ✅ Default settings ${existingSettings ? 'updated' : 'created'}`);
  }
  
  console.log('');
}

async function verifySetup(db) {
  console.log('\n🔍 Verifying setup...\n');
  
  const checks = [
    { collection: 'tradingsymbols', minCount: 1, description: 'Trading symbols' },
    { collection: 'marketdatasettings', minCount: 1, description: 'Market data settings' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    const count = await db.collection(check.collection).countDocuments();
    if (count >= check.minCount) {
      console.log(`   ✅ ${check.description}: ${count} documents`);
      passed++;
    } else {
      console.log(`   ❌ ${check.description}: ${count} documents (expected >= ${check.minCount})`);
      failed++;
    }
  }
  
  // Check index count
  let totalIndexes = 0;
  for (const collectionName of Object.keys(INDEXES)) {
    try {
      const indexes = await db.collection(collectionName).indexes();
      totalIndexes += indexes.length - 1; // -1 for _id index
    } catch {
      // Collection might not exist yet
    }
  }
  console.log(`   📊 Total custom indexes: ${totalIndexes}`);
  
  console.log(`\n   Result: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         CHARTVOLT DATABASE SETUP                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Connect to MongoDB
  console.log('🔌 Connecting to MongoDB...');
  console.log(`   URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('   ✅ Connected successfully!\n');
  } catch (err) {
    console.error(`   ❌ Connection failed: ${err.message}`);
    process.exit(1);
  }
  
  const db = mongoose.connection.db;
  
  try {
    // Create indexes
    if (!seedOnly) {
      await createIndexes(db);
    }
    
    // Seed data
    if (!indexesOnly) {
      await seedData(db, forceReseed);
    }
    
    // Verify
    const success = await verifySetup(db);
    
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         SETUP COMPLETE!                                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Start the app: pm2 start ecosystem.config.js');
    console.log('  2. Check health: curl http://localhost:3000/health');
    console.log('');
    
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Setup failed: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
