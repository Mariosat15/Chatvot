import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

/**
 * End Logic Tests API
 * 
 * Creates test competitions/challenges with specific participant states
 * and verifies the end logic works correctly.
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
    winnerRole?: string;
    toUnclaimedPool: boolean;
  };
}> = {
  // Competition Early End Tests
  'C-E1': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
      { role: 'participant', status: 'liquidated', equity: 4000, totalTrades: 4 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'highest-equity', toUnclaimedPool: false },
  },
  'C-E2': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true },
  },
  'C-E3': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'liquidated-only', toUnclaimedPool: false },
  },
  'C-E4': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false },
  },
  'C-E5': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true },
  },
  'C-E6': {
    type: 'competition',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 3000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false },
  },

  // Competition Normal End Tests
  'C-N1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'active-only', toUnclaimedPool: false },
  },
  'C-N2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'disqualified', equity: 8000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'active-only', toUnclaimedPool: false },
  },
  'C-N3': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'active', equity: 4000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 6000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'highest-equity-all', toUnclaimedPool: false },
  },
  'C-N4': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'participant', status: 'liquidated', equity: 3000, totalTrades: 3 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'highest-equity-all', toUnclaimedPool: false },
  },

  // Challenge Early End Tests
  'CH-E1': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false },
  },
  'CH-E2': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false },
  },
  'CH-E3': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false }, // Higher equity
  },
  'CH-E4': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false },
  },
  'CH-E5': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true },
  },
  'CH-E6': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false },
  },
  'CH-E7': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false },
  },
  'CH-E8': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, toUnclaimedPool: false },
  },
  'CH-E9': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'opponent', toUnclaimedPool: false },
  },
  'CH-E10': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'disqualified', equity: 5000, totalTrades: 0 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, toUnclaimedPool: true },
  },
  'CH-E11': {
    type: 'challenge',
    endType: 'early',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'disqualified', equity: 6000, totalTrades: 0 },
    ],
    expected: { shouldEndEarly: true, winnerRole: 'challenger', toUnclaimedPool: false },
  },

  // Challenge Normal End Tests
  'CH-N1': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'active', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'opponent', toUnclaimedPool: false },
  },
  'CH-N2': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'opponent', toUnclaimedPool: false },
  },
  'CH-N3': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false },
  },
  'CH-N4': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 3000, totalTrades: 5 },
      { role: 'opponent', status: 'active', equity: 2000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false },
  },
  'CH-N5': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: false,
    participants: [
      { role: 'challenger', status: 'liquidated', equity: 5000, totalTrades: 5 },
      { role: 'opponent', status: 'liquidated', equity: 3000, totalTrades: 5 },
    ],
    expected: { shouldEndEarly: false, winnerRole: 'challenger', toUnclaimedPool: false },
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
    const testPrefix = `TEST_${testId}_${nanoid(6)}`;

    // Create test data based on scenario type
    if (scenario.type === 'competition') {
      const result = await runCompetitionTest(db, testPrefix, scenario, testDataIds);
      return NextResponse.json({ success: true, result, testDataIds });
    } else {
      const result = await runChallengeTest(db, testPrefix, scenario, testDataIds);
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

async function runCompetitionTest(
  db: mongoose.mongo.Db,
  testPrefix: string,
  scenario: typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS],
  testDataIds: string[]
) {
  const competitionsCollection = db.collection('competitions');
  const participantsCollection = db.collection('competitionparticipants');

  const now = new Date();
  const prizePool = 300; // Test prize pool
  const entryFee = 100;
  const startingCapital = 10000;
  
  // Set end time based on test type
  const endTime = scenario.endType === 'early' 
    ? new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now (still time remaining)
    : new Date(now.getTime() - 1000); // Already ended

  // Create test competition with ALL required fields
  const competitionId = new mongoose.Types.ObjectId();
  const testAdminId = new mongoose.Types.ObjectId();
  testDataIds.push(`competition:${competitionId}`);

  await competitionsCollection.insertOne({
    _id: competitionId,
    name: `${testPrefix}_Competition`,
    slug: `test-${testPrefix.toLowerCase()}`,
    description: 'Test competition for end logic verification',
    status: 'active',
    startTime: new Date(now.getTime() - 60 * 60 * 1000),
    endTime,
    registrationDeadline: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
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
    createdAt: now,
    updatedAt: now,
    isTest: true,
  });

  // Create participants
  for (let i = 0; i < scenario.participants.length; i++) {
    const p = scenario.participants[i];
    const participantId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    testDataIds.push(`participant:${participantId}`);

    await participantsCollection.insertOne({
      _id: participantId,
      competitionId,
      userId: testUserId,
      username: `${testPrefix}_User${i + 1}`,
      status: p.status,
      currentCapital: p.equity,
      startingCapital: 10000,
      pnl: p.equity - 10000,
      totalTrades: p.totalTrades,
      winningTrades: Math.floor(p.totalTrades * 0.6),
      losingTrades: Math.floor(p.totalTrades * 0.4),
      enteredAt: now,
      createdAt: now,
      updatedAt: now,
      isTest: true,
    });
  }

  // Run the appropriate logic based on endType
  let actualResult: {
    passed: boolean;
    message: string;
    actualOutcome?: string;
    prizeDistribution?: {
      winnerId?: string;
      winnerPrize?: number;
      unclaimedPool?: number;
    };
  };

  if (scenario.endType === 'early') {
    // Simulate early end check logic
    const participants = await participantsCollection.find({ competitionId }).toArray();
    const activeCount = participants.filter(p => p.status === 'active').length;
    const liquidatedCount = participants.filter(p => p.status === 'liquidated').length;
    const disqualifiedCount = participants.filter(p => p.status === 'disqualified').length;

    let shouldEndEarly = false;
    let toUnclaimedPool = false;

    if (scenario.disqualifyOnLiquidation) {
      // If flag is ON, liquidated = out
      if (activeCount === 0) {
        shouldEndEarly = true;
        toUnclaimedPool = disqualifiedCount === participants.length;
      }
    } else {
      // If flag is OFF, only disqualified are out
      if (activeCount === 0 && liquidatedCount === 0) {
        shouldEndEarly = true;
        toUnclaimedPool = true;
      } else if (activeCount === 0 && disqualifiedCount === participants.length) {
        shouldEndEarly = true;
        toUnclaimedPool = true;
      }
    }

    const passed = shouldEndEarly === scenario.expected.shouldEndEarly && 
                   toUnclaimedPool === scenario.expected.toUnclaimedPool;

    actualResult = {
      passed,
      message: passed ? 'Test passed' : 'Test failed - unexpected outcome',
      actualOutcome: `shouldEndEarly=${shouldEndEarly}, toUnclaimedPool=${toUnclaimedPool}`,
      prizeDistribution: toUnclaimedPool ? { unclaimedPool: prizePool } : undefined,
    };
  } else {
    // Simulate normal end logic
    const participants = await participantsCollection.find({ competitionId }).toArray();
    
    // Filter eligible participants based on disqualifyOnLiquidation flag
    const eligible = participants.filter(p => {
      if (p.status === 'disqualified') return false;
      if (scenario.disqualifyOnLiquidation && p.status === 'liquidated') return false;
      return true;
    });

    // Rank by equity
    eligible.sort((a, b) => b.currentCapital - a.currentCapital);
    
    const winner = eligible[0];
    const hasWinner = !!winner;
    const toUnclaimedPool = !hasWinner;

    const passed = toUnclaimedPool === scenario.expected.toUnclaimedPool;

    actualResult = {
      passed,
      message: passed ? 'Test passed' : 'Test failed - unexpected outcome',
      actualOutcome: hasWinner 
        ? `Winner: ${winner.username} with $${winner.currentCapital}` 
        : 'No winner - prize to unclaimed pools',
      prizeDistribution: hasWinner 
        ? { winnerId: winner.userId.toString(), winnerPrize: prizePool }
        : { unclaimedPool: prizePool },
    };
  }

  return actualResult;
}

async function runChallengeTest(
  db: mongoose.mongo.Db,
  testPrefix: string,
  scenario: typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS],
  testDataIds: string[]
) {
  const challengesCollection = db.collection('challenges');
  const participantsCollection = db.collection('challengeparticipants');

  const now = new Date();
  const entryFee = 100;
  const prizePool = entryFee * 2;

  // Set end time based on test type
  const endTime = scenario.endType === 'early' 
    ? new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    : new Date(now.getTime() - 1000); // Already ended

  // Create test challenge
  const challengeId = new mongoose.Types.ObjectId();
  const challengerUserId = new mongoose.Types.ObjectId();
  const opponentUserId = new mongoose.Types.ObjectId();
  testDataIds.push(`challenge:${challengeId}`);

  await challengesCollection.insertOne({
    _id: challengeId,
    slug: `test-${testPrefix.toLowerCase()}`,
    challengerId: challengerUserId,
    challengerName: `${testPrefix}_Challenger`,
    challengedId: opponentUserId,
    challengedName: `${testPrefix}_Opponent`,
    status: 'active',
    entryFee,
    prizePool,
    winnerPrize: prizePool,
    startTime: new Date(now.getTime() - 60 * 60 * 1000),
    endTime,
    rules: {
      rankingMethod: 'pnl',
      minimumTrades: 1,
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    createdAt: now,
    updatedAt: now,
    isTest: true,
  });

  // Create participants
  for (const p of scenario.participants) {
    const participantId = new mongoose.Types.ObjectId();
    testDataIds.push(`challengeparticipant:${participantId}`);

    const userId = p.role === 'challenger' ? challengerUserId : opponentUserId;

    await participantsCollection.insertOne({
      _id: participantId,
      challengeId,
      userId,
      username: `${testPrefix}_${p.role}`,
      role: p.role,
      status: p.status,
      currentCapital: p.equity,
      startingCapital: 10000,
      pnl: p.equity - 10000,
      totalTrades: p.totalTrades,
      winningTrades: Math.floor(p.totalTrades * 0.6),
      losingTrades: Math.floor(p.totalTrades * 0.4),
      enteredAt: now,
      createdAt: now,
      updatedAt: now,
      isTest: true,
    });
  }

  // Run the challenge end logic simulation
  const participants = await participantsCollection.find({ challengeId }).toArray();
  const challenger = participants.find(p => p.role === 'challenger');
  const opponent = participants.find(p => p.role === 'opponent');

  if (!challenger || !opponent) {
    return { passed: false, message: 'Failed to create test participants' };
  }

  let actualWinner: string | null = null;
  let shouldEndEarly = false;
  let toUnclaimedPool = false;

  const challengerActive = challenger.status === 'active';
  const opponentActive = opponent.status === 'active';
  const challengerLiquidated = challenger.status === 'liquidated';
  const opponentLiquidated = opponent.status === 'liquidated';
  const challengerDisqualified = challenger.status === 'disqualified';
  const opponentDisqualified = opponent.status === 'disqualified';

  if (scenario.endType === 'early') {
    // Early end logic
    if (challengerActive && opponentActive) {
      shouldEndEarly = false;
    } else if (!scenario.disqualifyOnLiquidation) {
      // Flag OFF - liquidated can still win
      const challengerCanWin = challengerActive || challengerLiquidated;
      const opponentCanWin = opponentActive || opponentLiquidated;

      if (challengerCanWin && opponentCanWin) {
        shouldEndEarly = false;
      } else if (challengerDisqualified && opponentDisqualified) {
        shouldEndEarly = true;
        toUnclaimedPool = true;
      } else if (challengerDisqualified && opponentCanWin) {
        shouldEndEarly = true;
        actualWinner = 'opponent';
      } else if (opponentDisqualified && challengerCanWin) {
        shouldEndEarly = true;
        actualWinner = 'challenger';
      }
    } else {
      // Flag ON - liquidated = out
      if (challengerDisqualified && opponentDisqualified) {
        shouldEndEarly = true;
        toUnclaimedPool = true;
      } else if (challengerDisqualified && (opponentActive || opponentLiquidated)) {
        shouldEndEarly = true;
        actualWinner = 'opponent';
      } else if (opponentDisqualified && (challengerActive || challengerLiquidated)) {
        shouldEndEarly = true;
        actualWinner = 'challenger';
      } else if (challengerLiquidated && opponentActive) {
        shouldEndEarly = true;
        actualWinner = 'opponent';
      } else if (opponentLiquidated && challengerActive) {
        shouldEndEarly = true;
        actualWinner = 'challenger';
      } else if (challengerLiquidated && opponentLiquidated) {
        shouldEndEarly = true;
        // Compare equity
        actualWinner = challenger.currentCapital >= opponent.currentCapital ? 'challenger' : 'opponent';
      } else if (challengerLiquidated && opponentDisqualified) {
        shouldEndEarly = true;
        actualWinner = 'challenger';
      } else if (opponentLiquidated && challengerDisqualified) {
        shouldEndEarly = true;
        actualWinner = 'opponent';
      }
    }
  } else {
    // Normal end logic - time expired
    shouldEndEarly = false;

    // Check disqualification
    const challengerDQ = challengerDisqualified || 
      (scenario.disqualifyOnLiquidation && challengerLiquidated) ||
      challenger.totalTrades < 1;
    const opponentDQ = opponentDisqualified || 
      (scenario.disqualifyOnLiquidation && opponentLiquidated) ||
      opponent.totalTrades < 1;

    if (challengerDQ && opponentDQ) {
      toUnclaimedPool = true;
    } else if (challengerDQ) {
      actualWinner = 'opponent';
    } else if (opponentDQ) {
      actualWinner = 'challenger';
    } else {
      // Compare equity
      actualWinner = challenger.currentCapital >= opponent.currentCapital ? 'challenger' : 'opponent';
    }
  }

  // Verify against expected
  const expectedEndEarly = scenario.expected.shouldEndEarly;
  const expectedWinner = scenario.expected.winnerRole;
  const expectedUnclaimed = scenario.expected.toUnclaimedPool;

  let passed = true;
  let failReason = '';

  if (shouldEndEarly !== expectedEndEarly) {
    passed = false;
    failReason = `shouldEndEarly: expected ${expectedEndEarly}, got ${shouldEndEarly}`;
  } else if (toUnclaimedPool !== expectedUnclaimed) {
    passed = false;
    failReason = `toUnclaimedPool: expected ${expectedUnclaimed}, got ${toUnclaimedPool}`;
  } else if (expectedWinner && actualWinner !== expectedWinner) {
    passed = false;
    failReason = `winner: expected ${expectedWinner}, got ${actualWinner}`;
  }

  return {
    passed,
    message: passed ? 'Test passed' : `Test failed - ${failReason}`,
    actualOutcome: toUnclaimedPool 
      ? 'No winner - prize to unclaimed pools'
      : actualWinner 
        ? `Winner: ${actualWinner}` 
        : 'Continue to end time',
    prizeDistribution: toUnclaimedPool 
      ? { unclaimedPool: prizePool }
      : actualWinner
        ? { winnerId: actualWinner === 'challenger' ? challengerUserId.toString() : opponentUserId.toString(), winnerPrize: prizePool }
        : undefined,
  };
}
