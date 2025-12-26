import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../database/mongoose';
import SimulatorConfig from '../../../../../../database/models/simulator/simulator-config.model';

/**
 * GET /api/simulator/config
 * Get the current simulator configuration
 */
export async function GET() {
  try {
    await connectToDatabase();

    let config = await SimulatorConfig.findOne({ isActive: true });

    // Create default config if none exists
    if (!config) {
      config = await SimulatorConfig.create({
        name: 'Default Configuration',
        scale: 'small',
        virtualUsers: 100,
        userRegistrationRate: 10,
        competitions: 5,
        competitionTypes: ['standard', 'knockout', 'tournament', 'league'],
        tradersPerCompetition: 20,
        challenges: 50,
        challengeStakes: [10, 25, 50, 100],
        tradesPerUser: 10,
        tradingDuration: 30,
        tpSlPercentage: 70,
        simulateAdminActions: true,
        paymentApprovalDelay: 5,
        simulateFraud: true,
        fraudPercentage: 5,
        useTestDatabase: false,
        enableHardwareStress: false,
        cpuStressLevel: 5,
        memoryStressLevel: 5,
        useAIPatterns: true,
        useAIAnalysis: true,
        isActive: true,
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error fetching simulator config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/simulator/config
 * Save simulator configuration
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Find and update existing config or create new
    let config = await SimulatorConfig.findOne({ isActive: true });

    if (config) {
      Object.assign(config, body);
      await config.save();
    } else {
      config = await SimulatorConfig.create({
        ...body,
        isActive: true,
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error saving simulator config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

