import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../../database/mongoose';
import SimulatorRun from '../../../../../../../database/models/simulator/simulator-run.model';
import { analyzeSimulationResults } from '../../../../../../../lib/services/simulator/ai-analyzer.service';

/**
 * GET /api/simulator/run/[runId]
 * Get detailed information about a specific run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await connectToDatabase();

    const { runId } = await params;
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    let query = SimulatorRun.findById(runId);

    // Optionally exclude large arrays for performance
    if (!includeDetails) {
      query = query.select('-logs -hardwareMetrics');
    }

    const run = await query.lean();

    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error) {
    console.error('Error fetching simulation run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/simulator/run/[runId]
 * Perform actions on a specific run (analyze, cleanup)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await connectToDatabase();

    const { runId } = await params;
    const body = await request.json();
    const { action } = body;

    const run = await SimulatorRun.findById(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Run not found' },
        { status: 404 }
      );
    }

    if (action === 'analyze') {
      // Run AI analysis
      const analysis = await analyzeSimulationResults(run);
      run.aiAnalysis = analysis;
      await run.save();

      return NextResponse.json({
        success: true,
        analysis,
      });
    }

    if (action === 'cleanup') {
      // Clean up test data
      const cleanupResult = await cleanupTestData(run);
      
      run.cleanedUp = true;
      run.cleanedUpAt = new Date();
      await run.save();

      return NextResponse.json({
        success: true,
        message: 'Test data cleaned up',
        cleanupResult,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "analyze" or "cleanup"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error performing action on run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/simulator/run/[runId]
 * Delete a simulation run and optionally its test data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await connectToDatabase();

    const { runId } = await params;
    const { searchParams } = new URL(request.url);
    const cleanupData = searchParams.get('cleanup') === 'true';

    const run = await SimulatorRun.findById(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Run not found' },
        { status: 404 }
      );
    }

    // Clean up test data first if requested
    if (cleanupData && !run.cleanedUp) {
      await cleanupTestData(run);
    }

    // Delete the run record
    await SimulatorRun.findByIdAndDelete(runId);

    return NextResponse.json({
      success: true,
      message: 'Run deleted',
    });
  } catch (error) {
    console.error('Error deleting run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete run' },
      { status: 500 }
    );
  }
}

/**
 * Clean up test data created during simulation
 */
async function cleanupTestData(run: typeof SimulatorRun.prototype): Promise<Record<string, number>> {
  const result: Record<string, number> = {
    users: 0,
    competitions: 0,
    challenges: 0,
    positions: 0,
    transactions: 0,
  };

  try {
    // Import models dynamically to avoid circular dependencies
    const mongoose = await import('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Delete test users (those with simulator email pattern)
    if (run.testDataIds.users.length > 0) {
      const userResult = await db.collection('user').deleteMany({
        $or: [
          { id: { $in: run.testDataIds.users } },
          { email: { $regex: /@test\.simulator$/ } },
        ],
      });
      result.users = userResult.deletedCount;
    }

    // Delete test competitions
    if (run.testDataIds.competitions.length > 0) {
      const { ObjectId } = mongoose.Types;
      const compIds = run.testDataIds.competitions
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));
      
      if (compIds.length > 0) {
        const compResult = await db.collection('competitions').deleteMany({
          _id: { $in: compIds },
        });
        result.competitions = compResult.deletedCount;

        // Also delete related participants
        await db.collection('competitionparticipants').deleteMany({
          competitionId: { $in: compIds },
        });
      }
    }

    // Delete test challenges
    if (run.testDataIds.challenges.length > 0) {
      const { ObjectId } = mongoose.Types;
      const chalIds = run.testDataIds.challenges
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));
      
      if (chalIds.length > 0) {
        const chalResult = await db.collection('challenges').deleteMany({
          _id: { $in: chalIds },
        });
        result.challenges = chalResult.deletedCount;
      }
    }

    // Delete test positions
    if (run.testDataIds.positions.length > 0) {
      const { ObjectId } = mongoose.Types;
      const posIds = run.testDataIds.positions
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));
      
      if (posIds.length > 0) {
        const posResult = await db.collection('tradingpositions').deleteMany({
          _id: { $in: posIds },
        });
        result.positions = posResult.deletedCount;
      }
    }

    // Delete test transactions
    if (run.testDataIds.transactions.length > 0) {
      const { ObjectId } = mongoose.Types;
      const txIds = run.testDataIds.transactions
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));
      
      if (txIds.length > 0) {
        const txResult = await db.collection('wallettransactions').deleteMany({
          _id: { $in: txIds },
        });
        result.transactions = txResult.deletedCount;
      }
    }

    // Clean up any simulator-related data by pattern
    await db.collection('devicefingerprints').deleteMany({
      fingerprintId: { $regex: /^sim_fingerprint_/ },
    });

    await db.collection('session').deleteMany({
      'user.email': { $regex: /@test\.simulator$/ },
    });

    console.log('✅ Simulator cleanup completed:', result);
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }

  return result;
}

