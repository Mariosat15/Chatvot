/**
 * Cleanup old candles from MongoDB
 * 
 * Run with: npx ts-node scripts/cleanup-old-candles.ts
 * Or add to cron: 0 0 * * * cd /var/www/chartvolt && npx ts-node scripts/cleanup-old-candles.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DAYS_TO_KEEP = 7; // Keep only last 7 days of candles

async function cleanupOldCandles() {
  console.log('🧹 Starting candle cleanup...');
  console.log(`   Keeping last ${DAYS_TO_KEEP} days of candles`);
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }
    
    // Get stats before cleanup
    const statsBefore = await db.collection('candles_1m').stats();
    console.log(`\n📊 Before cleanup:`);
    console.log(`   Total candles: ${statsBefore.count}`);
    console.log(`   Size: ${(statsBefore.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Calculate cutoff timestamp (in seconds)
    const cutoffTime = Math.floor(Date.now() / 1000) - (DAYS_TO_KEEP * 24 * 60 * 60);
    const cutoffDate = new Date(cutoffTime * 1000);
    console.log(`\n🕐 Deleting candles older than: ${cutoffDate.toISOString()}`);
    
    // Delete old candles
    const result = await db.collection('candles_1m').deleteMany({
      t: { $lt: cutoffTime }
    });
    
    console.log(`\n🗑️  Deleted ${result.deletedCount} old candles`);
    
    // Get stats after cleanup
    const statsAfter = await db.collection('candles_1m').stats();
    console.log(`\n📊 After cleanup:`);
    console.log(`   Total candles: ${statsAfter.count}`);
    console.log(`   Size: ${(statsAfter.size / 1024 / 1024).toFixed(2)} MB`);
    
    const freedSpace = statsBefore.size - statsAfter.size;
    console.log(`\n✅ Freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB of space`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run cleanup
cleanupOldCandles();
