import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../database/mongoose';
import SimulatorRun from '../../../../../../database/models/simulator/simulator-run.model';
import { 
  startSimulation, 
  stopSimulation, 
  isSimulationRunning,
  getActiveRunId 
} from '../../../../../../lib/services/simulator/simulator.service';

/**
 * GET /api/simulator/run
 * Get list of simulation runs or check if one is active
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      const isRunning = isSimulationRunning();
      const activeRunId = getActiveRunId();

      if (activeRunId) {
        const run = await SimulatorRun.findById(activeRunId);
        return NextResponse.json({
          success: true,
          isRunning,
          run,
        });
      }

      // When no active run, get the most recent run (might just have completed)
      const recentRun = await SimulatorRun.findOne()
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({
        success: true,
        isRunning,
        run: recentRun || null,
      });
    }

    // Get recent runs
    const limit = parseInt(searchParams.get('limit') || '10');
    const runs = await SimulatorRun.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-logs -hardwareMetrics') // Exclude large arrays for listing
      .lean();

    return NextResponse.json({
      success: true,
      runs,
      isRunning: isSimulationRunning(),
    });
  } catch (error) {
    console.error('Error fetching simulation runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/simulator/run
 * Start a new simulation or stop the current one
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, configId } = body;

    if (action === 'start') {
      if (isSimulationRunning()) {
        return NextResponse.json(
          { success: false, error: 'A simulation is already running' },
          { status: 400 }
        );
      }

      if (!configId) {
        return NextResponse.json(
          { success: false, error: 'Configuration ID is required' },
          { status: 400 }
        );
      }

      // Determine base URL for the WEB app
      let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   process.env.BETTER_AUTH_URL || 
                   'http://localhost:3000';
      
      // Fix IPv6 resolution issues in local development only
      // Production URLs with custom domains are unaffected
      if (baseUrl.includes('://localhost:') || baseUrl.includes('://localhost/')) {
        baseUrl = baseUrl.replace('://localhost', '://127.0.0.1');
      }
      
      console.log(`🧪 [SIMULATOR] Starting simulation with baseUrl: ${baseUrl}`);

      const { runId } = await startSimulation(configId, baseUrl);

      return NextResponse.json({
        success: true,
        message: 'Simulation started',
        runId,
      });
    }

    if (action === 'stop') {
      await stopSimulation();
      return NextResponse.json({
        success: true,
        message: 'Simulation stopped',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error controlling simulation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to control simulation' },
      { status: 500 }
    );
  }
}

