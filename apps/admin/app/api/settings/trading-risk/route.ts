import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/database/mongoose';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-secret-key';

async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload;
  } catch {
    return null;
  }
}

// GET - Fetch trading risk settings
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    let settings = await TradingRiskSettings.findById('trading-risk-settings');
    
    if (!settings) {
      // Return defaults if no settings exist
      return NextResponse.json({
        success: true,
        settings: {
          marginLiquidation: 50,
          marginCall: 80,
          marginWarning: 120,
          marginSafe: 200,
          maxOpenPositions: 10,
          maxPositionSize: 100,
          minLeverage: 1,
          maxLeverage: 100,
          defaultLeverage: 10,
          maxDrawdownPercent: 50,
          dailyLossLimit: 20,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
    });
  } catch (error) {
    console.error('Error fetching trading risk settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trading risk settings' },
      { status: 500 }
    );
  }
}

