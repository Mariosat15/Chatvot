import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Use the same schema as admin but read-only
const MarketDataSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  priceUpdateMode: { type: String, enum: ['polling', 'websocket'], default: 'polling' },
}, { timestamps: true });

const MarketDataSettings = mongoose.models.MarketDataSettings || 
  mongoose.model('MarketDataSettings', MarketDataSettingsSchema);

/**
 * GET - Get current price update mode
 * This is called by the chart to determine whether to use polling or websocket
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const settings = await MarketDataSettings.findOne({ key: 'market_data_settings' });
    
    const mode = settings?.priceUpdateMode || 'polling';
    
    return NextResponse.json({
      mode,
      // Cache for 10 seconds - client can re-check periodically
      cacheTTL: 10000,
    });
  } catch (error) {
    console.error('Error getting price update mode:', error);
    // Default to polling on error
    return NextResponse.json({ mode: 'polling', cacheTTL: 10000 });
  }
}
