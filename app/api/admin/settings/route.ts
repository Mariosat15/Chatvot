import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/database/mongoose';
import AppSettings from '@/database/models/app-settings.model';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-secret-key';

async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload;
  } catch (error) {
    return null;
  }
}

// GET - Fetch app settings (admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    let settings = await AppSettings.findById('app-settings');
    
    if (!settings) {
      settings = await AppSettings.create({
        _id: 'app-settings',
        currency: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          exchangeRateToEUR: 1.0,
        },
        credits: {
          name: 'Volt Credits',
          symbol: '⚡',
          icon: 'zap',
          valueInEUR: 1.0,
          showEUREquivalent: true,
          decimals: 2,
        },
        transactions: {
          minimumDeposit: 10,
          minimumWithdrawal: 20,
          withdrawalFeePercentage: 2,
        },
        branding: {
          primaryColor: '#EAB308',
          accentColor: '#F59E0B',
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
    });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update app settings
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const updateData = await request.json();
    
    let settings = await AppSettings.findById('app-settings');
    
    if (!settings) {
      settings = new AppSettings({ _id: 'app-settings' });
    }
    
    // Update settings
    if (updateData.currency) {
      settings.currency = { ...settings.currency, ...updateData.currency };
    }
    if (updateData.credits) {
      settings.credits = { ...settings.credits, ...updateData.credits };
    }
    if (updateData.transactions) {
      settings.transactions = { ...settings.transactions, ...updateData.transactions };
    }
    if (updateData.branding) {
      settings.branding = { ...settings.branding, ...updateData.branding };
    }
    
    await settings.save();
    
    console.log('✅ App settings updated by admin:', admin.email);
    
    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: JSON.parse(JSON.stringify(settings)),
    });
  } catch (error) {
    console.error('Error updating app settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

