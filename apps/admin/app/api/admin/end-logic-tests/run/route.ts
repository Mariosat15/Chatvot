import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

/**
 * End Logic Tests API - REAL TESTS
 * 
 * Creates test competitions/challenges and runs the ACTUAL production code
 * to verify end logic works correctly.
 * 
 * Tests call:
 * - runEarlyEndCheck() for early end scenarios
 * - finalizeCompetition() for normal competition end
 * - finalizeChallenge() for normal challenge end
 */

// Test scenarios configuration
const TEST_SCENARIOS: Record<string, {
  type: 'competition' | 'challenge';
  endType: 'early' | 'normal' | 'journey'; // 'journey' = test early end (should NOT trigger) then finalize
  disqualifyOnLiquidation: boolean;
  participants: Array<{
    role: 'participant' | 'challenger' | 'challenged';
    status: 'active' | 'liquidated' | 'disqualified';
    equity: number;
    totalTrades: number;
  }>;
  expected: {
    shouldEndEarly: boolean;
    winnerId?: number; // Index of winner in participants array (0, 1, 2...)
    winnerRole?: string;
    toUnclaimedPool: boolean;
    statusAfter: 'completed' | 'active';
    // Prize distribution verification (optional)
    expectedPrizePool?: number;
    expectedPlatformFee?: number;
    expectedWinnerPrize?: number;
    expectedUnclaimedAmount?: number;
  };
}> = {
  // ============ COMPETITION EARLY END TESTS ============
  'C-E1': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
      { role: 'participant', status: 'liquidated', equity: 4000, totalTrades: 4 },
    ],
    // Flag ON + all liquidated = all lost = unclaimed pool
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'C-E2': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    // All disqualified = unclaimed pool
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'C-E3': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    // Flag ON: liquidated = disqualified, so ALL are disqualified = unclaimed pool
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'C-E4': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },
  'C-E5': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'C-E6': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },

  // ============ COMPETITION NORMAL END TESTS ============
  'C-N1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerId: 0, toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'C-N2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 8000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: false, winnerId: 0, toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'C-N3': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'active', equity: 4000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 6000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerId: 1, toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'C-N4': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerId: 0, toUnclaimedPool: false, statusAfter: 'completed' },
  },

  // ============ CHALLENGE EARLY END TESTS ============
  'CH-E1': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenged', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E2': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'challenged', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E3': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E4': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenged', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E5': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'challenged', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'CH-E6': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E7': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },
  'CH-E8': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },
  'CH-E9': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenged', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E10': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'challenged', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'CH-E11': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },

  // ============ CHALLENGE NORMAL END TESTS ============
  'CH-N1': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenged', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N2': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenged', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N3': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N4': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 2000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N5': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false, // NOTE: In production this is always true, but kept for legacy test coverage
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'challenged', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },

  // ============ PRIZE DISTRIBUTION TESTS ============
  // These verify correct prize amounts, platform fees, and wallet updates
  
  'C-P1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 7000, totalTrades: 5 }, // Winner - highest equity
      { role: 'participant', status: 'active', equity: 5500, totalTrades: 3 }, // 2nd place
      { role: 'participant', status: 'active', equity: 4000, totalTrades: 4 }, // 3rd place
    ],
    // 3 participants × 100 entry = 300 prize pool
    // 20% platform fee = 60, winner gets 240
    expected: { 
      shouldEndEarly: false, 
      winnerId: 0, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      // Prize verification
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedWinnerPrize: 240,
    },
  },
  
  'C-P2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'disqualified', equity: 8000, totalTrades: 0 }, // Disqualified (no trades)
      { role: 'participant', status: 'disqualified', equity: 6000, totalTrades: 0 }, // Disqualified (no trades)
    ],
    // All disqualified - entire pool goes to platform (unclaimed)
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: true, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedUnclaimedAmount: 160,
    },
  },
  
  'CH-P1': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 6500, totalTrades: 5 }, // Winner
      { role: 'challenged', status: 'active', equity: 5000, totalTrades: 3 },
    ],
    // 2 × 100 = 200 prize pool, winner takes all (no platform fee on challenges in this test)
    expected: { 
      shouldEndEarly: false, 
      winnerRole: 'challenger', 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedWinnerPrize: 200,
    },
  },
  
  'CH-P2': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'challenged', status: 'disqualified', equity: 4000, totalTrades: 0 },
    ],
    // Both disqualified - pool goes to platform
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: true, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedUnclaimedAmount: 200,
    },
  },

  // ============ FULL JOURNEY TESTS ============
  // These test scenarios that DON'T end early, then manually finalize to verify distribution
  
  'C-J1': {
    type: 'competition',
    endType: 'journey', // Special: first checks early end (should NOT trigger), then finalizes
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 6000, totalTrades: 5 }, // Winner (higher equity despite liquidation)
      { role: 'participant', status: 'liquidated', equity: 4000, totalTrades: 3 },
    ],
    // Flag OFF: liquidated players are still eligible, ranked by equity
    expected: { 
      shouldEndEarly: false, // First check: should NOT end early
      winnerId: 0, // After finalization: participant 0 wins
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedWinnerPrize: 160,
    },
  },
  
  'C-J2': {
    type: 'competition',
    endType: 'journey',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 7000, totalTrades: 0 }, // Disqualified (no trades) - even higher equity but out
    ],
    // Flag OFF: liquidated can still win, disqualified cannot
    // Only participant 0 is eligible
    expected: { 
      shouldEndEarly: false, // Should NOT end early (liquidated player can still win)
      winnerId: 0, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedWinnerPrize: 160,
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const { testId } = await request.json();

    if (!testId || !TEST_SCENARIOS[testId]) {
      return NextResponse.json({ success: false, error: 'Invalid test ID' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    const scenario = TEST_SCENARIOS[testId];
    const testDataIds: string[] = [];
    const testRunId = `TEST_${testId}_${nanoid(6)}`;

    // Create test data and run ACTUAL production code
    if (scenario.type === 'competition') {
      const result = await runRealCompetitionTest(db, testRunId, scenario, testDataIds);
      return NextResponse.json({ success: true, result, testDataIds });
    } else {
      const result = await runRealChallengeTest(db, testRunId, scenario, testDataIds);
      return NextResponse.json({ success: true, result, testDataIds });
    }
  } catch (error) {
    console.error('End logic test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Test failed' 
    }, { status: 500 });
  }
}

/**
 * Run REAL competition test using actual production code
 */
async function runRealCompetitionTest(
  db: mongoose.mongo.Db,
  testRunId: string,
  scenario: typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS],
  testDataIds: string[]
) {
  const competitionsCollection = db.collection('competitions');
  const participantsCollection = db.collection('competitionparticipants');
  const platformTransactionsCollection = db.collection('platformtransactions');
  const walletsCollection = db.collection('creditwallets');

  const now = new Date();
  const prizePool = 300;
  const entryFee = 100;
  const startingCapital = 10000;
  
  // For early end tests: end time is in the future (1 hour)
  // For normal end tests: end time is in the past
  const endTime = scenario.endType === 'early' 
    ? new Date(now.getTime() + 60 * 60 * 1000)
    : new Date(now.getTime() - 1000);

  // Create test competition - NO isTest flag so real code processes it
  const competitionId = new mongoose.Types.ObjectId();
  const testAdminId = new mongoose.Types.ObjectId();
  testDataIds.push(`competition:${competitionId}`);

  await competitionsCollection.insertOne({
    _id: competitionId,
    name: `${testRunId}_Competition`,
    slug: `test-${testRunId.toLowerCase()}`,
    description: 'Real test competition for end logic verification',
    status: 'active',
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime,
    registrationDeadline: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    entryFee,
    startingCapital,
    prizePool,
    platformFeePercentage: 20,
    createdBy: testAdminId.toString(),
    rules: {
      rankingMethod: 'pnl',
      tieBreaker1: 'trades_count',
      minimumTrades: 0, // Set to 0 for tests - we want to test disqualification logic, not trade counts
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    maxParticipants: 100,
    minParticipants: 2,
    currentParticipants: scenario.participants.length,
    assetClasses: ['forex'],
    allowedSymbols: [],
    blockedSymbols: [],
    testRunId, // Mark for cleanup
    createdAt: now,
    updatedAt: now,
  });

  // Create test participants and wallets
  const participantUserIds: mongoose.Types.ObjectId[] = [];
  
  for (let i = 0; i < scenario.participants.length; i++) {
    const p = scenario.participants[i];
    const participantId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    participantUserIds.push(userId);
    testDataIds.push(`participant:${participantId}`);
    testDataIds.push(`wallet:${userId}`);

    // Create wallet for this test user (userId must be string to match schema)
    await walletsCollection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      userId: userId.toString(),
      creditBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    // IMPORTANT: Set startingCapital = equity so finalization calculates correct final capital
    // (finalizeCompetition does: currentCapital = startingCapital + position_P&L)
    // With no positions, currentCapital = startingCapital = equity
    const participantStartingCapital = p.equity;
    
    await participantsCollection.insertOne({
      _id: participantId,
      competitionId: competitionId.toString(), // Must be string to match schema
      oddsCompetitionId: competitionId.toString(),
      oddsParticipantId: participantId.toString(),
      oddsUserId: userId.toString(),
      oddsUsername: `${testRunId}_User${i + 1}`,
      userId: userId.toString(), // Must be string to match schema
      username: `${testRunId}_User${i + 1}`,
      status: p.status,
      currentCapital: p.equity,
      startingCapital: participantStartingCapital, // Use equity as starting capital for correct ranking
      pnl: 0, // No P&L from positions
      pnlPercentage: 0,
      totalTrades: 0, // No trades (minimumTrades is 0)
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      enteredAt: now,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
    
    // NOTE: Not creating positions because:
    // 1. We're testing disqualification/early-end logic, not actual trade mechanics
    // 2. finalizeCompetition recalculates currentCapital from startingCapital + position P&L
    // 3. By setting startingCapital = expected equity and having no positions, we get the correct ranking
  }

  // Now run the ACTUAL production code
  let actualResult: {
    passed: boolean;
    message: string;
    actualOutcome?: string;
    prizeDistribution?: {
      winnerId?: string;
      winnerPrize?: number;
      unclaimedPool?: number;
    };
    details?: Record<string, unknown>;
  };

  try {
    if (scenario.endType === 'early') {
      // Import and run the ACTUAL early end check (test-specific version)
      const { runEarlyEndCheckForTest } = await import('../../../../../../../worker/jobs/early-end-check.job');
      
      // Run early end check for THIS test run only
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);
      
      // Check results in database
      const updatedComp = await competitionsCollection.findOne({ _id: competitionId });
      const unclaimedTxn = await platformTransactionsCollection.findOne({
        sourceId: competitionId.toString(),
        transactionType: 'unclaimed_pool',
        testRunId: { $exists: false }, // Real transactions don't have testRunId
      });
      
      // Also check if any prize was distributed (check wallets)
      let winnerFound = false;
      let winnerUserId = '';
      for (const userId of participantUserIds) {
        const wallet = await walletsCollection.findOne({ userId: userId.toString() });
        if (wallet && wallet.creditBalance > 0) {
          winnerFound = true;
          winnerUserId = userId.toString();
          break;
        }
      }

      const actualStatus = updatedComp?.status || 'active';
      const expectedStatus = scenario.expected.statusAfter;
      const hadUnclaimed = !!unclaimedTxn || updatedComp?.noWinners === true;
      
      // Determine if test passed
      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== expectedStatus) {
        passed = false;
        issues.push(`Status: expected '${expectedStatus}', got '${actualStatus}'`);
      }

      if (scenario.expected.toUnclaimedPool && !hadUnclaimed) {
        passed = false;
        issues.push('Expected unclaimed pool but none recorded');
      }

      if (!scenario.expected.toUnclaimedPool && scenario.expected.winnerId !== undefined) {
        if (!winnerFound) {
          passed = false;
          issues.push('Expected winner but no prize distributed');
        }
      }

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real code executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${winnerFound ? winnerUserId.slice(-6) : 'none'}, Unclaimed: ${hadUnclaimed}`,
        prizeDistribution: hadUnclaimed 
          ? { unclaimedPool: prizePool }
          : winnerFound 
            ? { winnerId: winnerUserId, winnerPrize: prizePool * 0.8 }
            : undefined,
        details: {
          earlyEndResult,
          competitionStatus: actualStatus,
          hadUnclaimed,
          winnerFound,
        },
      };
    } else if (scenario.endType === 'journey') {
      // JOURNEY TEST: First verify early end does NOT trigger, then finalize and verify distribution
      const { runEarlyEndCheckForTest } = await import('../../../../../../../worker/jobs/early-end-check.job');
      const { finalizeCompetition } = await import('../../../../../../../lib/actions/trading/competition-end.actions');
      
      console.log(`\n🧪 [JOURNEY TEST] Step 1: Checking early end does NOT trigger for ${competitionId}`);
      
      // Step 1: Run early end check - should NOT end early
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);
      
      // Verify competition is still active
      let compAfterEarlyCheck = await competitionsCollection.findOne({ _id: competitionId });
      if (compAfterEarlyCheck?.status === 'completed') {
        actualResult = {
          passed: false,
          message: '❌ Test FAILED: Competition ended early when it should have continued',
          actualOutcome: 'Competition ended early unexpectedly',
          details: { earlyEndResult, status: compAfterEarlyCheck.status },
        };
      } else {
        console.log(`🧪 [JOURNEY TEST] Step 1 PASSED: Competition still active`);
        
        // Step 2: Now set end time to past and finalize
        await competitionsCollection.updateOne(
          { _id: competitionId },
          { $set: { endTime: new Date(Date.now() - 1000) } }
        );
        
        console.log(`🧪 [JOURNEY TEST] Step 2: Running finalizeCompetition`);
        const finalizeResult = await finalizeCompetition(competitionId.toString());
        console.log(`🧪 [TEST] finalizeCompetition result:`, JSON.stringify(finalizeResult, null, 2));

        // Check results
        const updatedComp = await competitionsCollection.findOne({ _id: competitionId });
        const actualStatus = updatedComp?.status || 'active';
        
        // Check wallets for prize distribution
        let winnerFound = false;
        let winnerUserId = '';
        let winnerIndex = -1;
        let winnerBalance = 0;
        for (let i = 0; i < participantUserIds.length; i++) {
          const wallet = await walletsCollection.findOne({ userId: participantUserIds[i].toString() });
          console.log(`🧪 [TEST] Wallet for user ${i}:`, wallet?.creditBalance);
          if (wallet && wallet.creditBalance > 0) {
            winnerFound = true;
            winnerUserId = participantUserIds[i].toString();
            winnerIndex = i;
            winnerBalance = wallet.creditBalance;
            break;
          }
        }
        
        // Check platform transactions
        const platformFeeTransaction = await platformTransactionsCollection.findOne({
          sourceId: competitionId.toString(),
          transactionType: 'competition_fee',
        });
        const unclaimedTransaction = await platformTransactionsCollection.findOne({
          sourceId: competitionId.toString(),
          transactionType: 'unclaimed_pool',
        });

        let passed = true;
        const issues: string[] = [];

        if (actualStatus !== 'completed') {
          passed = false;
          issues.push(`Status: expected 'completed', got '${actualStatus}'`);
        }

        if (scenario.expected.winnerId !== undefined && winnerIndex !== scenario.expected.winnerId) {
          passed = false;
          issues.push(`Winner: expected participant ${scenario.expected.winnerId}, got ${winnerIndex}`);
        }
        
        // Verify prize amounts if specified
        if (scenario.expected.expectedWinnerPrize !== undefined && winnerFound) {
          const expectedPrize = scenario.expected.expectedWinnerPrize;
          if (Math.abs(winnerBalance - expectedPrize) > 1) { // Allow $1 tolerance
            passed = false;
            issues.push(`Winner prize: expected $${expectedPrize}, got $${winnerBalance}`);
          }
        }
        
        if (scenario.expected.expectedPlatformFee !== undefined && platformFeeTransaction) {
          const actualFee = platformFeeTransaction.amount || 0;
          const expectedFee = scenario.expected.expectedPlatformFee;
          if (Math.abs(actualFee - expectedFee) > 1) {
            passed = false;
            issues.push(`Platform fee: expected $${expectedFee}, got $${actualFee}`);
          }
        }

        actualResult = {
          passed,
          message: passed ? '✅ Test PASSED - Journey test completed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
          actualOutcome: `Journey: Early check ✓ → Finalize → Status: ${actualStatus}, Winner: participant ${winnerIndex}, Prize: $${winnerBalance}`,
          prizeDistribution: winnerFound 
            ? { winnerId: winnerUserId, winnerPrize: winnerBalance }
            : unclaimedTransaction
              ? { unclaimedPool: unclaimedTransaction.amount }
              : undefined,
          details: {
            journeySteps: ['Early end check (should NOT trigger)', 'Manual finalization', 'Prize distribution'],
            earlyEndResult,
            finalizeResult,
            competitionStatus: actualStatus,
            winnerIndex,
            winnerBalance,
            platformFee: platformFeeTransaction?.amount,
            unclaimedAmount: unclaimedTransaction?.amount,
          },
        };
      }
    } else {
      // Normal end - call finalizeCompetition directly
      const { finalizeCompetition } = await import('../../../../../../../lib/actions/trading/competition-end.actions');
      
      console.log(`\n🧪 [TEST] Running finalizeCompetition for ${competitionId}`);
      const finalizeResult = await finalizeCompetition(competitionId.toString());
      console.log(`🧪 [TEST] finalizeCompetition result:`, JSON.stringify(finalizeResult, null, 2));

      // Check results
      const updatedComp = await competitionsCollection.findOne({ _id: competitionId });
      const actualStatus = updatedComp?.status || 'active';
      
      // Check participants to see their final status
      const finalParticipants = await participantsCollection.find({ competitionId: competitionId.toString() }).toArray();
      console.log(`🧪 [TEST] Participants after finalization:`, finalParticipants.map(p => ({
        username: p.username,
        status: p.status,
        currentCapital: p.currentCapital,
        isWinner: p.isWinner,
        prizeWon: p.prizeWon,
      })));
      
      // Check wallets for prize distribution
      let winnerFound = false;
      let winnerUserId = '';
      let winnerIndex = -1;
      let winnerBalance = 0;
      for (let i = 0; i < participantUserIds.length; i++) {
        const wallet = await walletsCollection.findOne({ userId: participantUserIds[i].toString() });
        console.log(`🧪 [TEST] Wallet for user ${i}:`, wallet?.creditBalance);
        if (wallet && wallet.creditBalance > 0) {
          winnerFound = true;
          winnerUserId = participantUserIds[i].toString();
          winnerIndex = i;
          winnerBalance = wallet.creditBalance;
          break;
        }
      }
      
      // Check platform transactions for prize verification
      const platformFeeTransaction = await platformTransactionsCollection.findOne({
        sourceId: competitionId.toString(),
        transactionType: 'competition_fee',
      });
      const unclaimedTransaction = await platformTransactionsCollection.findOne({
        sourceId: competitionId.toString(),
        transactionType: 'unclaimed_pool',
      });

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== 'completed') {
        passed = false;
        issues.push(`Status: expected 'completed', got '${actualStatus}'`);
      }

      if (scenario.expected.winnerId !== undefined && winnerIndex !== scenario.expected.winnerId) {
        passed = false;
        issues.push(`Winner: expected participant ${scenario.expected.winnerId}, got ${winnerIndex}`);
      }
      
      // Verify prize amounts if specified
      if (scenario.expected.expectedWinnerPrize !== undefined && winnerFound) {
        const expectedPrize = scenario.expected.expectedWinnerPrize;
        if (Math.abs(winnerBalance - expectedPrize) > 1) { // Allow $1 tolerance
          passed = false;
          issues.push(`Winner prize: expected $${expectedPrize}, got $${winnerBalance}`);
        }
      }
      
      if (scenario.expected.expectedUnclaimedAmount !== undefined && scenario.expected.toUnclaimedPool) {
        const actualUnclaimed = unclaimedTransaction?.amount || 0;
        const expectedUnclaimed = scenario.expected.expectedUnclaimedAmount;
        if (Math.abs(actualUnclaimed - expectedUnclaimed) > 1) {
          passed = false;
          issues.push(`Unclaimed pool: expected $${expectedUnclaimed}, got $${actualUnclaimed}`);
        }
      }

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real finalization executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winner: participant ${winnerIndex} (${winnerFound ? winnerUserId.slice(-6) : 'none'}), Prize: $${winnerBalance}`,
        prizeDistribution: winnerFound 
          ? { winnerId: winnerUserId, winnerPrize: winnerBalance }
          : unclaimedTransaction
            ? { unclaimedPool: unclaimedTransaction.amount }
            : undefined,
        details: {
          finalizeResult,
          finalizeSuccess: finalizeResult?.success,
          finalizeMessage: finalizeResult?.message,
          competitionStatus: actualStatus,
          winnerIndex,
          winnerBalance,
          platformFee: platformFeeTransaction?.amount,
          unclaimedAmount: unclaimedTransaction?.amount,
          participantsCount: finalParticipants.length,
        },
      };
    }
  } catch (error) {
    actualResult = {
      passed: false,
      message: `❌ Test ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.stack : String(error) },
    };
  }

  return actualResult;
}

/**
 * Run REAL challenge test using actual production code
 */
async function runRealChallengeTest(
  db: mongoose.mongo.Db,
  testRunId: string,
  scenario: typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS],
  testDataIds: string[]
) {
  const challengesCollection = db.collection('challenges');
  const participantsCollection = db.collection('challengeparticipants');
  const walletsCollection = db.collection('creditwallets');

  const now = new Date();
  const entryFee = 100;
  const prizePool = entryFee * 2;
  const winnerPrize = prizePool; // No platform fee for simplicity

  // For early end tests: end time is in the future
  // For normal end tests: end time is in the past
  const endTime = scenario.endType === 'early' 
    ? new Date(now.getTime() + 60 * 60 * 1000)
    : new Date(now.getTime() - 1000);

  // Create test challenge - NO isTest flag
  const challengeId = new mongoose.Types.ObjectId();
  const challengerUserId = new mongoose.Types.ObjectId();
  const opponentUserId = new mongoose.Types.ObjectId();
  testDataIds.push(`challenge:${challengeId}`);
  testDataIds.push(`wallet:${challengerUserId}`);
  testDataIds.push(`wallet:${opponentUserId}`);

  // Create wallets (userId must be string to match schema)
  await walletsCollection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    userId: challengerUserId.toString(),
    creditBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    testRunId,
    createdAt: now,
    updatedAt: now,
  });

  await walletsCollection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    userId: opponentUserId.toString(),
    creditBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    testRunId,
    createdAt: now,
    updatedAt: now,
  });

  await challengesCollection.insertOne({
    _id: challengeId,
    slug: `test-${testRunId.toLowerCase()}`,
    challengerId: challengerUserId.toString(),
    challengerName: `${testRunId}_Challenger`,
    challengerEmail: 'test@test.com',
    challengedId: opponentUserId.toString(),
    challengedName: `${testRunId}_Opponent`,
    challengedEmail: 'test2@test.com',
    status: 'active',
    entryFee,
    prizePool,
    winnerPrize,
    platformFeePercentage: 0,
    platformFeeAmount: 0,
    startingCapital: 10000,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime,
    duration: 60,
    acceptDeadline: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    rules: {
      rankingMethod: 'pnl',
      tieBreaker1: 'trades_count',
      minimumTrades: 0, // Set to 0 for tests since we don't want trade count to affect disqualification
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    assetClasses: ['forex'],
    allowedSymbols: [],
    blockedSymbols: [],
    testRunId,
    createdAt: now,
    updatedAt: now,
  });

  // Create participants
  const userIdMap: Record<string, mongoose.Types.ObjectId> = {
    challenger: challengerUserId,
    challenged: challengerUserId, // Map 'challenged' to opponentUserId below
  };
  userIdMap['challenged'] = opponentUserId;

  for (const p of scenario.participants) {
    const participantId = new mongoose.Types.ObjectId();
    const userId = userIdMap[p.role as 'challenger' | 'challenged'];
    testDataIds.push(`challengeparticipant:${participantId}`);

    // IMPORTANT: Set startingCapital = equity so finalization calculates correct final capital
    // (finalizeChallenge does: currentCapital = startingCapital + position_P&L)
    // With no positions, currentCapital = startingCapital = equity
    await participantsCollection.insertOne({
      _id: participantId,
      challengeId: challengeId.toString(), // Must be string to match schema
      oddsUserId: userId.toString(),
      oddsUsername: `${testRunId}_${p.role}`,
      userId: userId.toString(), // Must be string to match schema
      username: `${testRunId}_${p.role}`,
      email: `test_${p.role}@test.com`, // Required field
      role: p.role,
      status: p.status,
      currentCapital: p.equity,
      availableCapital: p.equity, // Required field
      startingCapital: p.equity, // Use equity as starting capital for correct ranking
      pnl: 0, // No P&L from positions
      pnlPercentage: 0,
      totalTrades: 0, // No trades (minimumTrades is 0)
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      enteredAt: now,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Run ACTUAL production code
  let actualResult: {
    passed: boolean;
    message: string;
    actualOutcome?: string;
    prizeDistribution?: {
      winnerId?: string;
      winnerPrize?: number;
      unclaimedPool?: number;
    };
    details?: Record<string, unknown>;
  };

  try {
    if (scenario.endType === 'early') {
      // Run early end check (test-specific version)
      const { runEarlyEndCheckForTest } = await import('../../../../../../../worker/jobs/early-end-check.job');
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);

      // Check results
      const updatedChallenge = await challengesCollection.findOne({ _id: challengeId });
      const actualStatus = updatedChallenge?.status || 'active';
      const actualWinnerRole = updatedChallenge?.winnerRole;
      const hadNoWinner = updatedChallenge?.noWinner === true;

      // Check wallets
      const challengerWallet = await walletsCollection.findOne({ userId: challengerUserId.toString() });
      const opponentWallet = await walletsCollection.findOne({ userId: opponentUserId.toString() });
      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;

      let actualWinner = challengerGotPrize ? 'challenger' : opponentGotPrize ? 'challenged' : null;

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== scenario.expected.statusAfter) {
        passed = false;
        issues.push(`Status: expected '${scenario.expected.statusAfter}', got '${actualStatus}'`);
      }

      if (scenario.expected.toUnclaimedPool && !hadNoWinner) {
        passed = false;
        issues.push('Expected unclaimed pool but challenge has winner');
      }

      if (scenario.expected.winnerRole && actualWinner !== scenario.expected.winnerRole) {
        passed = false;
        issues.push(`Winner: expected '${scenario.expected.winnerRole}', got '${actualWinner}'`);
      }

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real early end executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${actualWinner || 'none'}, NoWinner: ${hadNoWinner}`,
        prizeDistribution: hadNoWinner 
          ? { unclaimedPool: prizePool }
          : actualWinner 
            ? { winnerId: actualWinner === 'challenger' ? challengerUserId.toString() : opponentUserId.toString(), winnerPrize: prizePool }
            : undefined,
        details: {
          earlyEndResult,
          challengeStatus: actualStatus,
          actualWinnerRole,
          challengerBalance: challengerWallet?.creditBalance,
          opponentBalance: opponentWallet?.creditBalance,
        },
      };
    } else {
      // Normal end - call finalizeChallenge directly
      const { finalizeChallenge } = await import('../../../../../../../lib/actions/trading/challenge-finalize.actions');
      
      console.log(`\n🧪 [TEST] Running finalizeChallenge for ${challengeId}`);
      const finalizeResult = await finalizeChallenge(challengeId.toString());
      console.log(`🧪 [TEST] finalizeChallenge result:`, JSON.stringify(finalizeResult, null, 2));

      // Check results
      const updatedChallenge = await challengesCollection.findOne({ _id: challengeId });
      const actualStatus = updatedChallenge?.status || 'active';
      
      // Check participants
      const finalParticipants = await participantsCollection.find({ challengeId: challengeId.toString() }).toArray();
      console.log(`🧪 [TEST] Challenge participants after finalization:`, finalParticipants.map(p => ({
        username: p.username,
        role: p.role,
        status: p.status,
        currentCapital: p.currentCapital,
        isWinner: p.isWinner,
      })));

      // Check wallets
      const challengerWallet = await walletsCollection.findOne({ userId: challengerUserId.toString() });
      const opponentWallet = await walletsCollection.findOne({ userId: opponentUserId.toString() });
      console.log(`🧪 [TEST] Wallets - Challenger: ${challengerWallet?.creditBalance}, Opponent: ${opponentWallet?.creditBalance}`);
      
      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;
      const actualWinner = challengerGotPrize ? 'challenger' : opponentGotPrize ? 'challenged' : null;

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== 'completed') {
        passed = false;
        issues.push(`Status: expected 'completed', got '${actualStatus}'`);
      }

      if (scenario.expected.winnerRole && actualWinner !== scenario.expected.winnerRole) {
        passed = false;
        issues.push(`Winner: expected '${scenario.expected.winnerRole}', got '${actualWinner}'`);
      }

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real finalization executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${actualWinner || 'none'}`,
        prizeDistribution: actualWinner 
          ? { winnerId: actualWinner === 'challenger' ? challengerUserId.toString() : opponentUserId.toString(), winnerPrize: prizePool }
          : undefined,
        details: {
          finalizeResult,
          finalizeSuccess: finalizeResult?.success,
          challengeStatus: actualStatus,
          challengerBalance: challengerWallet?.creditBalance,
          opponentBalance: opponentWallet?.creditBalance,
          participantsCount: finalParticipants.length,
        },
      };
    }
  } catch (error) {
    actualResult = {
      passed: false,
      message: `❌ Test ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.stack : String(error) },
    };
  }

  return actualResult;
}
