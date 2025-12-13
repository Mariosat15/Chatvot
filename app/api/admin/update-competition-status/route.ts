import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';

// Manual endpoint to update competition statuses
// Call this with: GET /api/admin/update-competition-status
export async function GET() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    const results = {
      started: 0,
      completed: 0,
    };

    // Update upcoming → active (when startTime has passed)
    const startedCompetitions = await Competition.updateMany(
      {
        status: 'upcoming',
        startTime: { $lte: now },
      },
      {
        $set: { status: 'active' },
      }
    );

    results.started = startedCompetitions.modifiedCount;

    // Update active → completed (when endTime has passed)
    const completedCompetitions = await Competition.updateMany(
      {
        status: 'active',
        endTime: { $lte: now },
      },
      {
        $set: { status: 'completed' },
      }
    );

    results.completed = completedCompetitions.modifiedCount;

    console.log(`✅ Manual status update: ${results.started} started, ${results.completed} completed`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.started + results.completed} competition(s)`,
      ...results,
    });
  } catch (error) {
    console.error('Error updating competition statuses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update statuses' },
      { status: 500 }
    );
  }
}

