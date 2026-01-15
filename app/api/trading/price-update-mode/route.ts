import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Use the same schema as admin but read-only
const MarketDataSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  priceUpdateMode: { type: String, enum: ['polling', 'websocket'], default: 'polling' },
  pollingIntervalMs: { type: Number, default: 200 },
  websocketIntervalMs: { type: Number, default: 200 },
}, { timestamps: true });

const MarketDataSettings = mongoose.models.MarketDataSettings || 
  mongoose.model('MarketDataSettings', MarketDataSettingsSchema);

/**
 * GET - Get current price update mode and intervals
 * This is called by the chart to determine whether to use polling or websocket
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const settings = await MarketDataSettings.findOne({ key: 'market_data_settings' });
    
    return NextResponse.json({
      mode: settings?.priceUpdateMode || 'polling',
      pollingIntervalMs: settings?.pollingIntervalMs || 200,
      websocketIntervalMs: settings?.websocketIntervalMs || 200,
      // Cache for 10 seconds - client can re-check periodically
      cacheTTL: 10000,
    });
  } catch (error) {
    console.error('Error getting price update mode:', error);
    // Default to polling on error
    return NextResponse.json({ 
      mode: 'polling', 
      pollingIntervalMs: 200,
      websocketIntervalMs: 200,
      cacheTTL: 10000 
    });
  }
}
