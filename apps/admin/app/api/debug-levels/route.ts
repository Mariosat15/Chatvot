import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import XPConfig from '@/database/models/xp-config.model';
import { TITLE_LEVELS } from '@/lib/constants/levels';

export async function GET() {
  try {
    await connectToDatabase();
    
    // Get levels from database
    const dbLevels = await XPConfig.findOne({ 
      configType: 'level_progression', 
      isActive: true 
    }).lean();
    
    // Get default levels from constants
    const defaultLevels = TITLE_LEVELS;
    
    return NextResponse.json({
      success: true,
      database: dbLevels?.data?.levels || null,
      defaults: defaultLevels,
      message: 'Compare database levels with default levels'
    });
  } catch (error) {
    console.error('Error fetching levels:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch levels'
    }, { status: 500 });
  }
}

