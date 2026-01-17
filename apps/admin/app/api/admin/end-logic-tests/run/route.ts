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
  endType: 'early' | 'normal';
  disqualifyOnLiquidation: boolean;
  participants: Array<{
    role: 'participant' | 'challenger' | 'opponent';
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
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E2': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E3': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E4': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E5': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'CH-E6': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E7': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },
  'CH-E8': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false, statusAfter: 'active' },
  },
  'CH-E9': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-E10': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true, statusAfter: 'completed' },
  },
  'CH-E11': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
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
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'opponent', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N2': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'opponent', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N3': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N4': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 2000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
  },
  'CH-N5': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false, statusAfter: 'completed' },
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
      minimumTrades: 1,
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

    // Create wallet for this test user
    await walletsCollection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      userId,
      creditBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    await participantsCollection.insertOne({
      _id: participantId,
      competitionId,
      oddsCompetitionId: competitionId, // Required field
      oddsParticipantId: participantId,
      oddsUserId: userId,
      oddsUsername: `${testRunId}_User${i + 1}`,
      userId,
      username: `${testRunId}_User${i + 1}`,
      status: p.status,
      currentCapital: p.equity,
      startingCapital,
      pnl: p.equity - startingCapital,
      pnlPercentage: ((p.equity - startingCapital) / startingCapital) * 100,
      totalTrades: p.totalTrades,
      winningTrades: Math.floor(p.totalTrades * 0.6),
      losingTrades: Math.floor(p.totalTrades * 0.4),
      winRate: p.totalTrades > 0 ? 60 : 0,
      enteredAt: now,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
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
        const wallet = await walletsCollection.findOne({ userId });
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
      const finalParticipants = await participantsCollection.find({ competitionId }).toArray();
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
      for (let i = 0; i < participantUserIds.length; i++) {
        const wallet = await walletsCollection.findOne({ userId: participantUserIds[i] });
        console.log(`🧪 [TEST] Wallet for user ${i}:`, wallet?.creditBalance);
        if (wallet && wallet.creditBalance > 0) {
          winnerFound = true;
          winnerUserId = participantUserIds[i].toString();
          winnerIndex = i;
          break;
        }
      }

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

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real finalization executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winner: participant ${winnerIndex} (${winnerFound ? winnerUserId.slice(-6) : 'none'})`,
        prizeDistribution: winnerFound 
          ? { winnerId: winnerUserId, winnerPrize: prizePool * 0.8 }
          : undefined,
        details: {
          finalizeResult,
          finalizeSuccess: finalizeResult?.success,
          finalizeMessage: finalizeResult?.message,
          competitionStatus: actualStatus,
          winnerIndex,
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

  // Create wallets
  await walletsCollection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    userId: challengerUserId,
    creditBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    testRunId,
    createdAt: now,
    updatedAt: now,
  });

  await walletsCollection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    userId: opponentUserId,
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
    challengerId: challengerUserId,
    challengerName: `${testRunId}_Challenger`,
    challengerEmail: 'test@test.com',
    challengedId: opponentUserId,
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
      minimumTrades: 1,
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
    opponent: opponentUserId,
  };

  for (const p of scenario.participants) {
    const participantId = new mongoose.Types.ObjectId();
    const userId = userIdMap[p.role as 'challenger' | 'opponent'];
    testDataIds.push(`challengeparticipant:${participantId}`);

    await participantsCollection.insertOne({
      _id: participantId,
      challengeId,
      oddsUserId: userId,
      oddsUsername: `${testRunId}_${p.role}`,
      userId,
      username: `${testRunId}_${p.role}`,
      role: p.role,
      status: p.status,
      currentCapital: p.equity,
      startingCapital: 10000,
      pnl: p.equity - 10000,
      pnlPercentage: ((p.equity - 10000) / 10000) * 100,
      totalTrades: p.totalTrades,
      winningTrades: Math.floor(p.totalTrades * 0.6),
      losingTrades: Math.floor(p.totalTrades * 0.4),
      winRate: p.totalTrades > 0 ? 60 : 0,
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
      const challengerWallet = await walletsCollection.findOne({ userId: challengerUserId });
      const opponentWallet = await walletsCollection.findOne({ userId: opponentUserId });
      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;

      let actualWinner = challengerGotPrize ? 'challenger' : opponentGotPrize ? 'opponent' : null;

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
      const finalParticipants = await participantsCollection.find({ challengeId }).toArray();
      console.log(`🧪 [TEST] Challenge participants after finalization:`, finalParticipants.map(p => ({
        username: p.username,
        role: p.role,
        status: p.status,
        currentCapital: p.currentCapital,
        isWinner: p.isWinner,
      })));

      // Check wallets
      const challengerWallet = await walletsCollection.findOne({ userId: challengerUserId });
      const opponentWallet = await walletsCollection.findOne({ userId: opponentUserId });
      console.log(`🧪 [TEST] Wallets - Challenger: ${challengerWallet?.creditBalance}, Opponent: ${opponentWallet?.creditBalance}`);
      
      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;
      const actualWinner = challengerGotPrize ? 'challenger' : opponentGotPrize ? 'opponent' : null;

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
          finalizeMessage: finalizeResult?.message,
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
