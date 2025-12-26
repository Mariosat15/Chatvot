import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import BadgeConfig from '@/database/models/badge-config.model';
import XPConfig from '@/database/models/xp-config.model';
import mongoose from 'mongoose';

/**
 * GET /api/admin/test-badge-models
 * Test endpoint to verify badge models are working
 */
export async function GET() {
  try {
    console.log('🧪 Testing badge models...');
    
    await connectToDatabase();
    console.log('✅ Database connected');

    // Check registered models
    const registeredModels = Object.keys(mongoose.models);
    console.log('📋 Registered models:', registeredModels);

    // Check if our models are registered
    const badgeConfigExists = 'BadgeConfig' in mongoose.models;
    const xpConfigExists = 'XPConfig' in mongoose.models;
    
    console.log('BadgeConfig model registered:', badgeConfigExists);
    console.log('XPConfig model registered:', xpConfigExists);

    // Get collection names
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('📦 Existing collections:', collectionNames);

    // Try to count documents
    const badgeCount = await BadgeConfig.countDocuments();
    const xpCount = await XPConfig.countDocuments();

    console.log('📊 Badge count:', badgeCount);
    console.log('📊 XP config count:', xpCount);

    // Try to create a test badge
    const testBadge = {
      id: 'test_badge_' + Date.now(),
      name: 'Test Badge',
      description: 'Test badge for verification',
      category: 'Competition',
      icon: '🧪',
      rarity: 'common' as const,
      condition: { type: 'test' },
      isActive: true,
    };

    console.log('🧪 Creating test badge...');
    const createdBadge = await BadgeConfig.create(testBadge);
    console.log('✅ Test badge created:', createdBadge._id);

    // Delete test badge
    await BadgeConfig.deleteOne({ _id: createdBadge._id });
    console.log('🗑️ Test badge deleted');

    return NextResponse.json({
      success: true,
      message: 'Badge models are working correctly!',
      details: {
        modelsRegistered: {
          BadgeConfig: badgeConfigExists,
          XPConfig: xpConfigExists,
        },
        allModels: registeredModels,
        collections: collectionNames,
        counts: {
          badges: badgeCount,
          xpConfigs: xpCount,
        },
        testBadgeCreated: true,
      },
    });
  } catch (error) {
    console.error('❌ Error testing models:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Model test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

