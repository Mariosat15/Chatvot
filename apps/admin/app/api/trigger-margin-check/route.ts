/**
 * Admin API to manually trigger margin checks and liquidate positions
 * below the configured stopout level
 * 
 * GET /api/admin/trigger-margin-check
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import { checkMarginCalls } from '@/lib/actions/trading/position.actions';
import Competition from '@/database/models/trading/competition.model';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

export async function GET() {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token'); // Use underscore to match auth system

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
      await jwtVerify(token.value, SECRET_KEY);
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Connect to database
    await connectToDatabase();

    // Get all active competitions
    const activeCompetitions = await Competition.find({
      status: 'active',
    }).select('_id slug name').lean();

    if (!activeCompetitions || activeCompetitions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active competitions to check',
        competitions: 0,
      });
    }

    const results = [];

    for (const competition of activeCompetitions) {
      const competitionId = String((competition as any)._id);
      const competitionName = (competition as any).name;
      
      try {
        await checkMarginCalls(competitionId);
        results.push({
          id: competitionId,
          name: competitionName,
          status: 'checked',
        });
      } catch (error) {
        console.error(`Error checking ${competitionName}:`, error);
        results.push({
          id: competitionId,
          name: competitionName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${activeCompetitions.length} active competition(s)`,
      competitions: results,
    });
  } catch (error) {
    console.error('❌ Error triggering margin check:', error);
    return NextResponse.json(
      {
        message: 'Failed to trigger margin check',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

