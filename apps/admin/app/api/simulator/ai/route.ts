import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../database/mongoose';
import SimulatorRun from '../../../../../../database/models/simulator/simulator-run.model';
import { 
  generateTradingPatterns, 
  generateTestScenario,
  analyzeFailureRootCause,
  analyzeSimulationResults 
} from '../../../../../../lib/services/simulator/ai-analyzer.service';

/**
 * POST /api/simulator/ai
 * AI-powered simulator features
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'generate-patterns': {
        const type = data?.type || 'trade_params';
        const patterns = await generateTradingPatterns(type);
        return NextResponse.json({
          success: true,
          patterns,
        });
      }

      case 'generate-scenario': {
        const description = data?.description || 'Standard load test';
        const scenario = await generateTestScenario(description);
        return NextResponse.json({
          success: true,
          scenario,
        });
      }

      case 'analyze-failure': {
        const logs = data?.logs || [];
        const analysis = await analyzeFailureRootCause(logs);
        return NextResponse.json({
          success: true,
          analysis,
        });
      }

      case 'analyze-run':
      case 'analyze-results': {
        const runId = data?.runId;
        if (!runId) {
          return NextResponse.json(
            { success: false, error: 'runId is required' },
            { status: 400 }
          );
        }

        const run = await SimulatorRun.findById(runId);
        if (!run) {
          return NextResponse.json(
            { success: false, error: 'Run not found' },
            { status: 404 }
          );
        }

        if (run.status !== 'completed') {
          return NextResponse.json(
            { success: false, error: 'Can only analyze completed runs' },
            { status: 400 }
          );
        }

        console.log('🤖 Running AI analysis for run:', runId);
        const aiAnalysis = await analyzeSimulationResults(run);
        
        // Save the analysis to the run
        run.aiAnalysis = aiAnalysis;
        await run.save();

        console.log('✅ AI analysis completed with score:', aiAnalysis.performanceScore);

        return NextResponse.json({
          success: true,
          aiAnalysis, // Return as aiAnalysis for frontend compatibility
          analysis: aiAnalysis, // Also return as analysis for backwards compatibility
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in AI endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'AI operation failed' },
      { status: 500 }
    );
  }
}

