/**
 * Script to fix TradingRiskSettings collection
 * Removes any documents with ObjectId _id and creates fresh default settings
 * 
 * Run with: npx ts-node scripts/fix-risk-settings-id.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function fixRiskSettings() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    const collection = db.collection('tradingrisk settings');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'tradingrisk settings' }).toArray();
    
    if (collections.length > 0) {
      console.log('📋 Found existing TradingRiskSettings collection');
      
      // Count documents
      const count = await collection.countDocuments();
      console.log(`📊 Found ${count} document(s)`);

      if (count > 0) {
        console.log('🗑️  Dropping all documents...');
        await collection.deleteMany({});
        console.log('✅ All documents deleted');
      }
    } else {
      console.log('ℹ️  No existing collection found');
    }

    // Create the correct document with string _id
    console.log('📝 Creating default settings with string _id...');
    await collection.insertOne({
      _id: 'global-trading-risk-settings' as any,
      marginLiquidation: 50,
      marginCall: 100,
      marginWarning: 150,
      marginSafe: 200,
      maxOpenPositions: 10,
      maxPositionSize: 100,
      minLeverage: 1,
      maxLeverage: 500,
      defaultLeverage: 10,
      maxDrawdownPercent: 50,
      dailyLossLimit: 20,
      updatedAt: new Date(),
    } as any);

    console.log('✅ Default settings created successfully!');
    console.log('\n📊 Final state:');
    const finalDoc = await collection.findOne({ _id: 'global-trading-risk-settings' as any } as any);
    console.log(JSON.stringify(finalDoc, null, 2));

    await mongoose.disconnect();
    console.log('\n✅ Done! Risk settings fixed.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixRiskSettings();

