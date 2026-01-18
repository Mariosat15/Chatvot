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
    // Multi-winner distribution (optional)
    expectedRanking?: number[]; // Array of participant indices in order [1st, 2nd, 3rd...]
    expectedPrizes?: number[]; // Array of prize amounts for each rank
    expectedTiedRanks?: boolean; // Flag to indicate all participants are tied
    expectedWinners?: number; // Number of winners expected (for verification)
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
    // With flag ON, both liquidated = both disqualified = pool to platform (no winner)
    // NOTE: Early-end logic picks higher equity, but normal-end treats both as disqualified
    expected: { shouldEndEarly: false, toUnclaimedPool: true, statusAfter: 'completed' },
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

  // ============ MULTI-WINNER DISTRIBUTION TESTS ============
  // Prize split: 1st=70%, 2nd=20%, 3rd=10%
  // Pool = participants × 100 entry fee, minus 20% platform fee
  
  'C-D1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 8000, totalTrades: 5 }, // 1st place
      { role: 'participant', status: 'active', equity: 7000, totalTrades: 4 }, // 2nd place
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 3 }, // 3rd place
      { role: 'participant', status: 'active', equity: 5000, totalTrades: 2 }, // 4th (no prize)
      { role: 'participant', status: 'active', equity: 4000, totalTrades: 1 }, // 5th (no prize)
    ],
    // 5 × 100 = 500 pool, 20% fee = 100, net = 400
    // 1st: 400 × 70% = 280, 2nd: 400 × 20% = 80, 3rd: 400 × 10% = 40
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 500,
      expectedPlatformFee: 100,
      expectedRanking: [0, 1, 2], // participant indices by rank
      expectedPrizes: [280, 80, 40], // prizes for 1st, 2nd, 3rd
    },
  },
  
  'C-D2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 7500, totalTrades: 5 }, // 1st place
      { role: 'participant', status: 'active', equity: 6500, totalTrades: 4 }, // 2nd place
      { role: 'participant', status: 'active', equity: 5500, totalTrades: 3 }, // 3rd place
      { role: 'participant', status: 'disqualified', equity: 9000, totalTrades: 0 }, // Disqualified (no trades)
      { role: 'participant', status: 'disqualified', equity: 8500, totalTrades: 0 }, // Disqualified (no trades)
    ],
    // 5 × 100 = 500 pool, 20% fee = 100, net = 400
    // Only 3 active, they get all prizes: 280, 80, 40
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 500,
      expectedPlatformFee: 100,
      expectedRanking: [0, 1, 2], // Only active players ranked
      expectedPrizes: [280, 80, 40],
    },
  },
  
  'C-D3': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false, // Liquidated players still eligible!
    participants: [
      { role: 'participant', status: 'active', equity: 8000, totalTrades: 5 }, // 1st place
      { role: 'participant', status: 'active', equity: 7000, totalTrades: 4 }, // 2nd place
      { role: 'participant', status: 'liquidated', equity: 6500, totalTrades: 3 }, // 3rd place (liquidated but eligible!)
      { role: 'participant', status: 'liquidated', equity: 6000, totalTrades: 2 }, // 4th (liquidated)
      { role: 'participant', status: 'liquidated', equity: 5500, totalTrades: 1 }, // 5th (liquidated)
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 1 }, // 6th (liquidated)
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // Flag OFF: 2 active + 4 liquidated, ALL ranked by equity
    // 1st (active): 480 × 70% = 336
    // 2nd (active): 480 × 20% = 96
    // 3rd (liquidated!): 480 × 10% = 48
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // 3rd place is liquidated participant!
      expectedPrizes: [336, 96, 48],
    },
  },
  
  'C-D4': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false, // Liquidated players compete for all positions!
    participants: [
      { role: 'participant', status: 'active', equity: 8000, totalTrades: 5 }, // 1st place (only active)
      { role: 'participant', status: 'liquidated', equity: 7500, totalTrades: 4 }, // 2nd place (liquidated!)
      { role: 'participant', status: 'liquidated', equity: 7000, totalTrades: 3 }, // 3rd place (liquidated!)
      { role: 'participant', status: 'liquidated', equity: 6000, totalTrades: 2 }, // 4th 
      { role: 'participant', status: 'liquidated', equity: 5000, totalTrades: 1 }, // 5th
      { role: 'participant', status: 'liquidated', equity: 4000, totalTrades: 1 }, // 6th
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // 1 active + 5 liquidated, flag OFF = all ranked by equity
    // 1st (active): 336, 2nd (liquidated): 96, 3rd (liquidated): 48
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // All liquidated for 2nd and 3rd
      expectedPrizes: [336, 96, 48],
    },
  },
  
  'C-D5': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true, // Flag ON - liquidated are OUT
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 }, // 1st place
      { role: 'participant', status: 'active', equity: 5500, totalTrades: 4 }, // 2nd place
      { role: 'participant', status: 'active', equity: 5000, totalTrades: 3 }, // 3rd place
      { role: 'participant', status: 'liquidated', equity: 8000, totalTrades: 2 }, // Liquidated (disqualified) - even higher equity!
      { role: 'participant', status: 'liquidated', equity: 7500, totalTrades: 1 }, // Liquidated (disqualified)
      { role: 'participant', status: 'liquidated', equity: 7000, totalTrades: 1 }, // Liquidated (disqualified)
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // Flag ON: only 3 active are eligible, liquidated are disqualified even with higher equity!
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // Only active players, liquidated excluded
      expectedPrizes: [336, 96, 48],
    },
  },
  
  'C-D6': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 }, // 1st place
      { role: 'participant', status: 'active', equity: 5000, totalTrades: 4 }, // 2nd place
      { role: 'participant', status: 'liquidated', equity: 8000, totalTrades: 2 }, // Liquidated - disqualified
      { role: 'participant', status: 'disqualified', equity: 7000, totalTrades: 0 }, // Disqualified (no trades)
    ],
    // 4 × 100 = 400 pool, 20% fee = 80, net = 320
    // Only 2 active winners - production code REDISTRIBUTES 3rd place prize to existing winners
    // 10% unclaimed ÷ 2 winners = 5% bonus each
    // 1st: 320 × (70% + 5%) = 240, 2nd: 320 × (20% + 5%) = 80
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, // Prize redistribution, not unclaimed
      statusAfter: 'completed',
      expectedPrizePool: 400,
      expectedPlatformFee: 80,
      expectedRanking: [0, 1], // Only 2 winners
      expectedPrizes: [240, 80], // Redistributed: 75% and 25% of net pool
      // No unclaimed - 3rd place prize redistributed to winners as bonus
    },
  },

  // ============ TIE SCENARIO TESTS ============
  // Test exact tied PNL and tie-breaker logic
  
  'C-T1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // Two players with EXACTLY same equity (same PNL)
      // Tie-breaker: trades_count = FEWER trades wins (more efficient trader)
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 3 },  // Winner (fewer trades = more efficient)
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 10 }, // 2nd place (more trades)
    ],
    // 2 × 100 = 200 pool, 20% fee = 40, net = 160
    // Both have same PNL (+1000), tie-breaker = fewer trades wins
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins due to fewer trades
      expectedPrizes: [160, 0], // Winner takes all (single prize position)
    },
  },
  
  'C-T2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // Three players tied for 1st place with EXACT same stats
      // All have same equity AND same trades - should split 1st prize equally
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // All tied for 1st - should split 70% equally = 56 each
    // 2nd place (20%) and 3rd place (10%) go to... same people (they're all 1st)
    // Actually: 3 tied for rank 1 = split ALL prize money equally
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2], // All rank 1 (tied)
      expectedPrizes: [80, 80, 80], // Equal split of 240 net pool
      expectedTiedRanks: true, // Flag to indicate tie handling
    },
  },
  
  'C-T3': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // Two players tied for 2nd place
      { role: 'participant', status: 'active', equity: 7000, totalTrades: 5 }, // Clear 1st
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 }, // Tied 2nd
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 }, // Tied 2nd
      { role: 'participant', status: 'active', equity: 5000, totalTrades: 5 }, // 4th (no prize)
    ],
    // 4 × 100 = 400 pool, 20% fee = 80, net = 320
    // 3rd place is EMPTY (P1&P2 tie for 2nd, skip to rank 4)
    // 10% unclaimed is redistributed equally to ALL 3 winners
    // Bonus per winner: 10% ÷ 3 = 3.33%
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 400,
      expectedPlatformFee: 80,
      expectedRanking: [0, 1, 2, 3], // P0=1st, P1&P2 tied for 2nd, P3=4th
      // P0: 70% + 3.33% bonus = 73.33% × 320 = 234.66
      // P1: (20%÷2) + 3.33% = 13.33% × 320 = 42.66
      // P2: (20%÷2) + 3.33% = 13.33% × 320 = 42.66
      expectedPrizes: [234.66, 42.66, 42.66, 0],
      expectedWinners: 3, // Only 3 people get prizes
    },
  },

  // ============ EDGE CASE TESTS ============
  
  'C-EC1': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // All participants have NEGATIVE PNL - worst performer
      { role: 'participant', status: 'active', equity: 4000, totalTrades: 5 }, // -1000 PNL (best of worst)
      { role: 'participant', status: 'active', equity: 3000, totalTrades: 5 }, // -2000 PNL
      { role: 'participant', status: 'active', equity: 2000, totalTrades: 5 }, // -3000 PNL (worst)
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // Ranking by PNL: P0 (-1000) > P1 (-2000) > P2 (-3000)
    // Even with negative PNL, highest wins
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2],
      expectedPrizes: [168, 48, 24], // 70%, 20%, 10% of 240
    },
  },
  
  'C-EC2': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // Single participant - they win by default
      { role: 'participant', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    // 1 × 100 = 100 pool, 20% fee = 20, net = 80
    // Single participant wins everything
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 100,
      expectedPlatformFee: 20,
      expectedRanking: [0],
      expectedPrizes: [80], // Winner takes all
    },
  },
  
  'C-EC3': {
    type: 'competition',
    endType: 'normal',
    disqualifyOnLiquidation: false, // Flag OFF - liquidated can win
    participants: [
      // All liquidated, but flag is OFF so they compete by equity
      { role: 'participant', status: 'liquidated', equity: 500, totalTrades: 5 },  // Best liquidated
      { role: 'participant', status: 'liquidated', equity: 300, totalTrades: 5 },  // 2nd
      { role: 'participant', status: 'liquidated', equity: 100, totalTrades: 5 },  // Worst
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // With flag OFF, liquidated players still compete
    expected: { 
      shouldEndEarly: false, 
      toUnclaimedPool: false, 
      statusAfter: 'completed',
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2],
      expectedPrizes: [168, 48, 24],
    },
  },

  // ============ CHALLENGE TIE TESTS ============
  
  'CH-T1': {
    type: 'challenge',
    endType: 'normal',
    disqualifyOnLiquidation: true,
    participants: [
      // Both have EXACTLY same equity - true tie
      { role: 'challenger', status: 'active', equity: 6000, totalTrades: 5 },
      { role: 'challenged', status: 'active', equity: 6000, totalTrades: 5 },
    ],
    // Default: split_equally - both players split prize, no single winner
    // isTie=true, winnerId=null, both get half the prize
    expected: { 
      shouldEndEarly: false, 
      winnerRole: 'tie', // Both players tie - prize split equally (default admin setting)
      toUnclaimedPool: false, 
      statusAfter: 'completed',
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
  const entryFee = 100;
  // Calculate prizePool based on number of participants (must match test expectations)
  const prizePool = entryFee * scenario.participants.length;
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

  // Determine prize distribution based on test type
  // Multi-winner tests use 70/20/10 split (where expectedPrizes has multiple non-zero values)
  // Others use winner-takes-all (100% to rank 1)
  const nonZeroPrizes = scenario.expected.expectedPrizes?.filter(p => p > 0).length || 0;
  const isMultiWinnerTest = nonZeroPrizes > 1;
  const prizeDistribution = isMultiWinnerTest
    ? [
        { rank: 1, percentage: 70 },
        { rank: 2, percentage: 20 },
        { rank: 3, percentage: 10 },
      ]
    : [{ rank: 1, percentage: 100 }];

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
      // No tieBreaker2 - so participants with same PNL and trades are truly tied
      minimumTrades: 1, // Participants with 0 trades get disqualified (matches real behavior)
      tiePrizeDistribution: 'split_equally', // When truly tied after all tiebreakers, split equally
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    prizeDistribution,
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

    // IMPORTANT: Use COMMON starting capital so PNL differences reflect equity differences
    // PNL = currentCapital - startingCapital = equity - startingCapital
    // Example: startingCapital=5000, equity=6000 → PNL=+1000, equity=4000 → PNL=-1000
    const commonStartingCapital = startingCapital; // Use competition's starting capital (5000)
    const participantPnl = p.equity - commonStartingCapital;
    const participantPnlPercentage = (participantPnl / commonStartingCapital) * 100;
    
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
      startingCapital: commonStartingCapital, // Common starting capital for all
      pnl: participantPnl, // Calculated PNL based on equity difference
      pnlPercentage: participantPnlPercentage,
      totalTrades: p.totalTrades || 1, // At least 1 trade to avoid disqualification
      winningTrades: p.totalTrades > 0 ? Math.ceil(p.totalTrades / 2) : 1,
      losingTrades: p.totalTrades > 0 ? Math.floor(p.totalTrades / 2) : 0,
      winRate: 50,
      enteredAt: now,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
    
    // ONLY create positions for participants with totalTrades > 0
    // Participants with totalTrades: 0 should remain disqualified due to insufficient trades
    if (p.totalTrades > 0) {
      const positionsCollection = db.collection('tradingpositions');
      const positionId = new mongoose.Types.ObjectId();
      testDataIds.push(`position:${positionId}`);
      
      // IMPORTANT: Production calculates PNL as: priceDiff * quantity * 100000 (forex contract size)
      // To get the desired participantPnl, we need: priceDiff = participantPnl / (quantity * 100000)
      // Using quantity = 1 for simplicity: priceDiff = participantPnl / 100000
      const quantity = 1;
      const contractSize = 100000;
      const priceDiff = participantPnl / (quantity * contractSize);
      
      await positionsCollection.insertOne({
        _id: positionId,
        oddsPositionId: positionId.toString(),
        oddsUserId: userId.toString(),
        userId: userId.toString(),
        competitionId: competitionId.toString(),
        symbol: 'EUR/USD',
        side: 'long',
        orderType: 'market',
        quantity: quantity,
        entryPrice: 1.1000,
        exitPrice: 1.1000 + priceDiff,
        currentPrice: 1.1000 + priceDiff,
        unrealizedPnl: 0,
        unrealizedPnlPercentage: 0,
        realizedPnl: participantPnl, // Not used by production, but kept for reference
        leverage: 1,
        marginUsed: 1000,
        maintenanceMargin: 500,
        status: 'closed',
        openOrderId: `test-order-${i}`,
        lastPriceUpdate: now,
        priceUpdateCount: 1,
        openedAt: new Date(now.getTime() - 60 * 60 * 1000),
        closedAt: new Date(now.getTime() - 30 * 60 * 1000),
        testRunId,
        createdAt: now,
        updatedAt: now,
      });
    }
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
      tie?: boolean; // True if both participants got prize (split_equally)
      splitPrize?: number; // Prize per participant when tied
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
        finalRank: p.finalRank,
      })));
      
      // Check ALL wallets for multi-winner distribution (include $0 prizes for ranking)
      const walletBalances: { participantIndex: number; userId: string; balance: number }[] = [];
      for (let i = 0; i < participantUserIds.length; i++) {
        const wallet = await walletsCollection.findOne({ userId: participantUserIds[i].toString() });
        const balance = wallet?.creditBalance || 0;
        console.log(`🧪 [TEST] Wallet for participant ${i}: $${balance}`);
        // Include ALL participants for full ranking (even those with $0 prize)
        walletBalances.push({ participantIndex: i, userId: participantUserIds[i].toString(), balance });
      }
      
      // Sort by balance descending to get ranking order (higher prize = higher rank)
      walletBalances.sort((a, b) => b.balance - a.balance);
      const actualRanking = walletBalances.map(w => w.participantIndex);
      const actualPrizes = walletBalances.map(w => w.balance);
      
      console.log(`🧪 [TEST] Prize distribution: ranking=${actualRanking.join(',')}, prizes=${actualPrizes.join(',')}`);
      
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

      // Single winner tests
      if (scenario.expected.winnerId !== undefined && actualRanking[0] !== scenario.expected.winnerId) {
        passed = false;
        issues.push(`Winner: expected participant ${scenario.expected.winnerId}, got ${actualRanking[0] ?? 'none'}`);
      }
      
      // Verify single winner prize amounts if specified
      if (scenario.expected.expectedWinnerPrize !== undefined && walletBalances.length > 0) {
        const expectedPrize = scenario.expected.expectedWinnerPrize;
        const actualWinnerPrize = walletBalances[0]?.balance || 0;
        if (Math.abs(actualWinnerPrize - expectedPrize) > 1) { // Allow $1 tolerance
          passed = false;
          issues.push(`Winner prize: expected $${expectedPrize}, got $${actualWinnerPrize}`);
        }
      }
      
      // Multi-winner ranking verification
      if (scenario.expected.expectedRanking) {
        const expectedRanking = scenario.expected.expectedRanking;
        if (actualRanking.length < expectedRanking.length) {
          passed = false;
          issues.push(`Winners count: expected ${expectedRanking.length}, got ${actualRanking.length}`);
        } else {
          // Check each rank position
          for (let r = 0; r < expectedRanking.length; r++) {
            if (actualRanking[r] !== expectedRanking[r]) {
              passed = false;
              issues.push(`Rank ${r + 1}: expected participant ${expectedRanking[r]}, got ${actualRanking[r]}`);
            }
          }
        }
      }
      
      // Multi-winner prize verification
      if (scenario.expected.expectedPrizes) {
        const expectedPrizes = scenario.expected.expectedPrizes;
        for (let p = 0; p < expectedPrizes.length; p++) {
          const expectedPrize = expectedPrizes[p];
          const actualPrize = actualPrizes[p] || 0;
          if (Math.abs(actualPrize - expectedPrize) > 1) { // Allow $1 tolerance
            passed = false;
            issues.push(`Prize ${p + 1}: expected $${expectedPrize}, got $${actualPrize}`);
          }
        }
      }
      
      // Platform fee verification
      if (scenario.expected.expectedPlatformFee !== undefined && platformFeeTransaction) {
        const actualFee = platformFeeTransaction.amount || 0;
        const expectedFee = scenario.expected.expectedPlatformFee;
        if (Math.abs(actualFee - expectedFee) > 1) {
          passed = false;
          issues.push(`Platform fee: expected $${expectedFee}, got $${actualFee}`);
        }
      }
      
      // Unclaimed pool verification (for missing winners or all disqualified)
      if (scenario.expected.expectedUnclaimedAmount !== undefined) {
        const actualUnclaimed = unclaimedTransaction?.amount || 0;
        const expectedUnclaimed = scenario.expected.expectedUnclaimedAmount;
        if (Math.abs(actualUnclaimed - expectedUnclaimed) > 1) {
          passed = false;
          issues.push(`Unclaimed pool: expected $${expectedUnclaimed}, got $${actualUnclaimed}`);
        }
      }

      // Build prize distribution summary
      const winnerSummary = walletBalances.length > 0 
        ? walletBalances.map((w, i) => `${i + 1}st: P${w.participantIndex} ($${w.balance})`).join(', ')
        : 'No winners';

      actualResult = {
        passed,
        message: passed ? '✅ Test PASSED - Real finalization executed correctly' : `❌ Test FAILED: ${issues.join(', ')}`,
        actualOutcome: `Status: ${actualStatus}, Winners: ${winnerSummary}`,
        prizeDistribution: walletBalances.length > 0
          ? { 
              winnerId: walletBalances[0].userId, 
              winnerPrize: walletBalances[0].balance,
              unclaimedPool: unclaimedTransaction?.amount,
            }
          : unclaimedTransaction
            ? { unclaimedPool: unclaimedTransaction.amount }
            : undefined,
        details: {
          finalizeResult,
          finalizeSuccess: finalizeResult?.success,
          finalizeMessage: finalizeResult?.message,
          competitionStatus: actualStatus,
          actualRanking,
          actualPrizes,
          platformFee: platformFeeTransaction?.amount,
          unclaimedAmount: unclaimedTransaction?.amount,
          participantsCount: finalParticipants.length,
          winnersCount: walletBalances.length,
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
      minimumTrades: 1, // Schema requires min 1
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

    // IMPORTANT: Use common starting capital so PNL differences reflect equity differences
    // PNL = currentCapital - startingCapital = equity - 10000
    const commonStartingCapital = 10000; // Challenge starting capital
    const participantPnl = p.equity - commonStartingCapital;
    const participantPnlPercentage = (participantPnl / commonStartingCapital) * 100;
    
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
      startingCapital: commonStartingCapital, // Common starting capital for proper PNL
      pnl: participantPnl, // Calculated PNL
      pnlPercentage: participantPnlPercentage,
      totalTrades: p.totalTrades || 1, // At least 1 trade (schema requires min 1)
      winningTrades: p.totalTrades > 0 ? Math.ceil(p.totalTrades / 2) : 1,
      losingTrades: p.totalTrades > 0 ? Math.floor(p.totalTrades / 2) : 0,
      winRate: 50,
      enteredAt: now,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
    
    // ONLY create positions for participants with totalTrades > 0
    // Participants with totalTrades: 0 should remain disqualified due to insufficient trades
    if (p.totalTrades > 0) {
      const positionsCollection = db.collection('tradingpositions');
      const positionId = new mongoose.Types.ObjectId();
      testDataIds.push(`position:${positionId}`);
      
      // IMPORTANT: Production calculates PNL as: priceDiff * quantity * 100000 (forex contract size)
      // Also: Challenge finalization queries positions by competitionId, not challengeId!
      const quantity = 1;
      const contractSize = 100000;
      const priceDiff = participantPnl / (quantity * contractSize);
      
      await positionsCollection.insertOne({
        _id: positionId,
        oddsPositionId: positionId.toString(),
        oddsUserId: userId.toString(),
        userId: userId.toString(),
        competitionId: challengeId.toString(), // Challenge finalization queries competitionId!
        symbol: 'EUR/USD',
        side: 'long',
        orderType: 'market',
        quantity: quantity,
        entryPrice: 1.1000,
        exitPrice: 1.1000 + priceDiff,
        currentPrice: 1.1000 + priceDiff,
        unrealizedPnl: 0,
        unrealizedPnlPercentage: 0,
        realizedPnl: participantPnl, // Not used by production, but kept for reference
        leverage: 1,
        marginUsed: 1000,
        maintenanceMargin: 500,
        status: 'closed',
        openOrderId: `test-order-${p.role}`,
        lastPriceUpdate: now,
        priceUpdateCount: 1,
        openedAt: new Date(now.getTime() - 60 * 60 * 1000),
        closedAt: new Date(now.getTime() - 30 * 60 * 1000),
        testRunId,
        createdAt: now,
        updatedAt: now,
      });
    }
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
      tie?: boolean; // True if both participants got prize (split_equally)
      splitPrize?: number; // Prize per participant when tied
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

      // Determine winner - if BOTH got prize, it's a tie (split_equally)
      let actualWinner: string | null;
      if (challengerGotPrize && opponentGotPrize) {
        actualWinner = 'tie'; // Both got prize = tie with split_equally
      } else if (challengerGotPrize) {
        actualWinner = 'challenger';
      } else if (opponentGotPrize) {
        actualWinner = 'challenged';
      } else {
        actualWinner = null;
      }

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
          : actualWinner === 'tie'
            ? { tie: true, splitPrize: prizePool / 2 }
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
      
      // Determine winner - if BOTH got prize, it's a tie (split_equally)
      let actualWinner: string | null;
      if (challengerGotPrize && opponentGotPrize) {
        actualWinner = 'tie'; // Both got prize = tie with split_equally
      } else if (challengerGotPrize) {
        actualWinner = 'challenger';
      } else if (opponentGotPrize) {
        actualWinner = 'challenged';
      } else {
        actualWinner = null;
      }

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
        prizeDistribution: actualWinner === 'tie'
          ? { tie: true, splitPrize: prizePool / 2 }
          : actualWinner 
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
