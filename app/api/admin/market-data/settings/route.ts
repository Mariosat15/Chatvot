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
    // Schedule settings for auto mode
    schedule: {
      type: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
      hour: { type: Number, default: 0 }, // 0-23 UTC hour to run
      // For weekly: which days (0=Sun, 1=Mon, ..., 6=Sat)
      weekDays: { type: [Number], default: [0, 6] }, // Default: weekends
      // For monthly: which week of month (1-4) and which days
      monthWeek: { type: Number, default: 1 }, // 1st week
    },
  },
  gapFill: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
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
          schedule: {
            type: 'daily',
            hour: 0,
            weekDays: [0, 6], // Weekends
            monthWeek: 1,
          },
        },
        gapFill: {
          enabled: true,
          mode: 'auto',
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
      
      // Schedule settings
      if (cleanup.schedule) {
        if (cleanup.schedule.type) updateData['cleanup.schedule.type'] = cleanup.schedule.type;
        if (typeof cleanup.schedule.hour === 'number') {
          updateData['cleanup.schedule.hour'] = Math.max(0, Math.min(23, cleanup.schedule.hour));
        }
        if (cleanup.schedule.weekDays) {
          updateData['cleanup.schedule.weekDays'] = cleanup.schedule.weekDays.filter(
            (d: number) => d >= 0 && d <= 6
          );
        }
        if (cleanup.schedule.monthWeek) {
          updateData['cleanup.schedule.monthWeek'] = Math.max(1, Math.min(4, cleanup.schedule.monthWeek));
        }
      }
    }
    
    if (gapFill) {
      if (typeof gapFill.enabled === 'boolean') updateData['gapFill.enabled'] = gapFill.enabled;
      if (gapFill.mode) updateData['gapFill.mode'] = gapFill.mode;
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
