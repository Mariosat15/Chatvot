import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Settings schema for market data management
const MarketDataSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'market_data_settings' },
  cleanup: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    daysToKeep: { type: Number, default: 30 },
    lastRun: { type: Date, default: null },
    autoRunTime: { type: String, default: '00:00' }, // Daily at midnight
  },
  gapFill: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    maxGapMinutes: { type: Number, default: 60 }, // Max gap to fill
    lastRun: { type: Date, default: null },
  },
}, { timestamps: true });

const MarketDataSettings = mongoose.models.MarketDataSettings || 
  mongoose.model('MarketDataSettings', MarketDataSettingsSchema);

/**
 * GET - Retrieve market data settings
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    let settings = await MarketDataSettings.findOne({ key: 'market_data_settings' });
    
    // Create default settings if not exists
    if (!settings) {
      settings = await MarketDataSettings.create({
        key: 'market_data_settings',
        cleanup: {
          enabled: false,
          mode: 'manual',
          daysToKeep: 30,
          lastRun: null,
          autoRunTime: '00:00',
        },
        gapFill: {
          enabled: true,
          mode: 'auto',
          maxGapMinutes: 60,
          lastRun: null,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting market data settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

/**
 * POST - Update market data settings
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { cleanup, gapFill } = body;
    
    const updateData: Record<string, unknown> = {};
    
    if (cleanup) {
      if (typeof cleanup.enabled === 'boolean') updateData['cleanup.enabled'] = cleanup.enabled;
      if (cleanup.mode) updateData['cleanup.mode'] = cleanup.mode;
      if (cleanup.daysToKeep) updateData['cleanup.daysToKeep'] = Math.max(1, Math.min(365, cleanup.daysToKeep));
      if (cleanup.autoRunTime) updateData['cleanup.autoRunTime'] = cleanup.autoRunTime;
    }
    
    if (gapFill) {
      if (typeof gapFill.enabled === 'boolean') updateData['gapFill.enabled'] = gapFill.enabled;
      if (gapFill.mode) updateData['gapFill.mode'] = gapFill.mode;
      if (gapFill.maxGapMinutes) updateData['gapFill.maxGapMinutes'] = Math.max(1, Math.min(1440, gapFill.maxGapMinutes));
    }
    
    const settings = await MarketDataSettings.findOneAndUpdate(
      { key: 'market_data_settings' },
      { $set: updateData },
      { new: true, upsert: true }
    );
    
    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating market data settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
