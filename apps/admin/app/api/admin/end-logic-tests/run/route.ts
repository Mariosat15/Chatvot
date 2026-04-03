import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

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

// Game Master configuration for referral fee tests
interface TestGmConfig {
  gmId: string; // Unique identifier for this GM in the test
  feePercentage: number; // Referral fee percentage (5, 10, etc.)
  status: "active" | "expired" | "paused" | "suspended";
  canEarnFromChallenges?: boolean; // For challenge tests
  challengeFeePercentage?: number; // Different % for challenges (optional)
}

// Test scenarios configuration
const TEST_SCENARIOS: Record<
  string,
  {
    type: "competition" | "challenge";
    endType: "early" | "normal" | "journey"; // 'journey' = test early end (should NOT trigger) then finalize
    disqualifyOnLiquidation: boolean;
    // Custom tiebreaker settings (optional - defaults to trades_count)
    tieBreaker1?:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    tieBreaker2?:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    tiePrizeDistribution?:
      | "split_equally"
      | "split_weighted"
      | "first_gets_all";
    // Game Master configurations for referral tests
    gameMasters?: TestGmConfig[];
    participants: Array<{
      role: "participant" | "challenger" | "challenged";
      status: "active" | "liquidated" | "disqualified";
      equity: number;
      totalTrades: number;
      winRate?: number; // Optional: for win_rate tiebreaker tests
      pnlPercentage?: number; // Optional: for ROI tiebreaker tests
      startingCapital?: number; // Optional: override starting capital for ROI tests
      // Referral configuration
      referredByGmId?: string; // GM ID if this participant was referred
    }>;
    expected: {
      shouldEndEarly: boolean;
      winnerId?: number; // Index of winner in participants array (0, 1, 2...)
      winnerRole?: string;
      toUnclaimedPool: boolean;
      statusAfter: "completed" | "active";
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
      // Game Master referral fee verification
      expectedGmFees?: Array<{
        gmId: string;
        amount: number;
        referredCount: number;
      }>;
      expectedRetainedFees?: number; // Fees retained by platform (inactive GMs)
      expectedNetPlatformFee?: number; // Platform fee after GM deductions
    };
  }
> = {
  // ============ COMPETITION EARLY END TESTS ============
  "C-E1": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "liquidated",
        equity: 3000,
        totalTrades: 3,
      },
      {
        role: "participant",
        status: "liquidated",
        equity: 4000,
        totalTrades: 4,
      },
    ],
    // Flag ON + all liquidated = all lost = unclaimed pool
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "C-E2": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "participant",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      {
        role: "participant",
        status: "disqualified",
        equity: 3000,
        totalTrades: 0,
      },
    ],
    // All disqualified = unclaimed pool
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "C-E3": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "disqualified",
        equity: 3000,
        totalTrades: 0,
      },
    ],
    // Flag ON: liquidated = disqualified, so ALL are disqualified = unclaimed pool
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "C-E4": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "liquidated",
        equity: 3000,
        totalTrades: 3,
      },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "active",
    },
  },
  "C-E5": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      {
        role: "participant",
        status: "disqualified",
        equity: 3000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "C-E6": {
    type: "competition",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "disqualified",
        equity: 3000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "active",
    },
  },

  // ============ COMPETITION NORMAL END TESTS ============
  "C-N1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      {
        role: "participant",
        status: "liquidated",
        equity: 3000,
        totalTrades: 3,
      },
    ],
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "C-N2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      {
        role: "participant",
        status: "disqualified",
        equity: 8000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "C-N3": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: false,
    participants: [
      { role: "participant", status: "active", equity: 4000, totalTrades: 5 },
      {
        role: "participant",
        status: "liquidated",
        equity: 6000,
        totalTrades: 3,
      },
    ],
    expected: {
      shouldEndEarly: false,
      winnerId: 1,
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "C-N4": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "liquidated",
        equity: 3000,
        totalTrades: 3,
      },
    ],
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },

  // ============ CHALLENGE EARLY END TESTS ============
  "CH-E1": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E2": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "challenger", status: "active", equity: 6000, totalTrades: 5 },
      {
        role: "challenged",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E3": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E4": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E5": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      {
        role: "challenged",
        status: "disqualified",
        equity: 6000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "CH-E6": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "disqualified",
        equity: 6000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E7": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "active",
    },
  },
  "CH-E8": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "active",
    },
  },
  "CH-E9": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-E10": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      {
        role: "challenged",
        status: "disqualified",
        equity: 6000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: true,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "CH-E11": {
    type: "challenge",
    endType: "early",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "disqualified",
        equity: 6000,
        totalTrades: 0,
      },
    ],
    expected: {
      shouldEndEarly: true,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },

  // ============ CHALLENGE NORMAL END TESTS ============
  "CH-N1": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "challenger", status: "active", equity: 5000, totalTrades: 5 },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-N2": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-N3": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
    ],
    // With flag ON, both liquidated = both disqualified = pool to platform (no winner)
    // NOTE: Early-end logic picks higher equity, but normal-end treats both as disqualified
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: true,
      statusAfter: "completed",
    },
  },
  "CH-N4": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
      { role: "challenged", status: "active", equity: 2000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },
  "CH-N5": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: false, // NOTE: In production this is always true, but kept for legacy test coverage
    participants: [
      {
        role: "challenger",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "challenged",
        status: "liquidated",
        equity: 3000,
        totalTrades: 5,
      },
    ],
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },

  // ============ PRIZE DISTRIBUTION TESTS ============
  // These verify correct prize amounts, platform fees, and wallet updates

  "C-P1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 7000, totalTrades: 5 }, // Winner - highest equity
      { role: "participant", status: "active", equity: 5500, totalTrades: 3 }, // 2nd place
      { role: "participant", status: "active", equity: 4000, totalTrades: 4 }, // 3rd place
    ],
    // 3 participants × 100 entry = 300 prize pool
    // 20% platform fee = 60, winner gets 240
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      // Prize verification
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedWinnerPrize: 240,
    },
  },

  "C-P2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "participant",
        status: "disqualified",
        equity: 8000,
        totalTrades: 0,
      }, // Disqualified (no trades)
      {
        role: "participant",
        status: "disqualified",
        equity: 6000,
        totalTrades: 0,
      }, // Disqualified (no trades)
    ],
    // All disqualified - entire pool goes to platform (unclaimed)
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: true,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedUnclaimedAmount: 160,
    },
  },

  "CH-P1": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "challenger", status: "active", equity: 6500, totalTrades: 5 }, // Winner
      { role: "challenged", status: "active", equity: 5000, totalTrades: 3 },
    ],
    // 2 × 100 = 200 prize pool, winner takes all (no platform fee on challenges in this test)
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedWinnerPrize: 200,
    },
  },

  "CH-P2": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      {
        role: "challenger",
        status: "disqualified",
        equity: 5000,
        totalTrades: 0,
      },
      {
        role: "challenged",
        status: "disqualified",
        equity: 4000,
        totalTrades: 0,
      },
    ],
    // Both disqualified - pool goes to platform
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: true,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedUnclaimedAmount: 200,
    },
  },

  // ============ FULL JOURNEY TESTS ============
  // These test scenarios that DON'T end early, then manually finalize to verify distribution

  "C-J1": {
    type: "competition",
    endType: "journey", // Special: first checks early end (should NOT trigger), then finalizes
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 6000,
        totalTrades: 5,
      }, // Winner (higher equity despite liquidation)
      {
        role: "participant",
        status: "liquidated",
        equity: 4000,
        totalTrades: 3,
      },
    ],
    // Flag OFF: liquidated players are still eligible, ranked by equity
    expected: {
      shouldEndEarly: false, // First check: should NOT end early
      winnerId: 0, // After finalization: participant 0 wins
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedWinnerPrize: 160,
    },
  },

  "C-J2": {
    type: "competition",
    endType: "journey",
    disqualifyOnLiquidation: false,
    participants: [
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 5,
      },
      {
        role: "participant",
        status: "disqualified",
        equity: 7000,
        totalTrades: 0,
      }, // Disqualified (no trades) - even higher equity but out
    ],
    // Flag OFF: liquidated can still win, disqualified cannot
    // Only participant 0 is eligible
    expected: {
      shouldEndEarly: false, // Should NOT end early (liquidated player can still win)
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedWinnerPrize: 160,
    },
  },

  // ============ MULTI-WINNER DISTRIBUTION TESTS ============
  // Prize split: 1st=70%, 2nd=20%, 3rd=10%
  // Pool = participants × 100 entry fee, minus 20% platform fee

  "C-D1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 8000, totalTrades: 5 }, // 1st place
      { role: "participant", status: "active", equity: 7000, totalTrades: 4 }, // 2nd place
      { role: "participant", status: "active", equity: 6000, totalTrades: 3 }, // 3rd place
      { role: "participant", status: "active", equity: 5000, totalTrades: 2 }, // 4th (no prize)
      { role: "participant", status: "active", equity: 4000, totalTrades: 1 }, // 5th (no prize)
    ],
    // 5 × 100 = 500 pool, 20% fee = 100, net = 400
    // 1st: 400 × 70% = 280, 2nd: 400 × 20% = 80, 3rd: 400 × 10% = 40
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 500,
      expectedPlatformFee: 100,
      expectedRanking: [0, 1, 2], // participant indices by rank
      expectedPrizes: [280, 80, 40], // prizes for 1st, 2nd, 3rd
    },
  },

  "C-D2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 7500, totalTrades: 5 }, // 1st place
      { role: "participant", status: "active", equity: 6500, totalTrades: 4 }, // 2nd place
      { role: "participant", status: "active", equity: 5500, totalTrades: 3 }, // 3rd place
      {
        role: "participant",
        status: "disqualified",
        equity: 9000,
        totalTrades: 0,
      }, // Disqualified (no trades)
      {
        role: "participant",
        status: "disqualified",
        equity: 8500,
        totalTrades: 0,
      }, // Disqualified (no trades)
    ],
    // 5 × 100 = 500 pool, 20% fee = 100, net = 400
    // Only 3 active, they get all prizes: 280, 80, 40
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 500,
      expectedPlatformFee: 100,
      expectedRanking: [0, 1, 2], // Only active players ranked
      expectedPrizes: [280, 80, 40],
    },
  },

  "C-D3": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: false, // Liquidated players still eligible!
    participants: [
      { role: "participant", status: "active", equity: 8000, totalTrades: 5 }, // 1st place
      { role: "participant", status: "active", equity: 7000, totalTrades: 4 }, // 2nd place
      {
        role: "participant",
        status: "liquidated",
        equity: 6500,
        totalTrades: 3,
      }, // 3rd place (liquidated but eligible!)
      {
        role: "participant",
        status: "liquidated",
        equity: 6000,
        totalTrades: 2,
      }, // 4th (liquidated)
      {
        role: "participant",
        status: "liquidated",
        equity: 5500,
        totalTrades: 1,
      }, // 5th (liquidated)
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 1,
      }, // 6th (liquidated)
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // Flag OFF: 2 active + 4 liquidated, ALL ranked by equity
    // 1st (active): 480 × 70% = 336
    // 2nd (active): 480 × 20% = 96
    // 3rd (liquidated!): 480 × 10% = 48
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // 3rd place is liquidated participant!
      expectedPrizes: [336, 96, 48],
    },
  },

  "C-D4": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: false, // Liquidated players compete for all positions!
    participants: [
      { role: "participant", status: "active", equity: 8000, totalTrades: 5 }, // 1st place (only active)
      {
        role: "participant",
        status: "liquidated",
        equity: 7500,
        totalTrades: 4,
      }, // 2nd place (liquidated!)
      {
        role: "participant",
        status: "liquidated",
        equity: 7000,
        totalTrades: 3,
      }, // 3rd place (liquidated!)
      {
        role: "participant",
        status: "liquidated",
        equity: 6000,
        totalTrades: 2,
      }, // 4th
      {
        role: "participant",
        status: "liquidated",
        equity: 5000,
        totalTrades: 1,
      }, // 5th
      {
        role: "participant",
        status: "liquidated",
        equity: 4000,
        totalTrades: 1,
      }, // 6th
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // 1 active + 5 liquidated, flag OFF = all ranked by equity
    // 1st (active): 336, 2nd (liquidated): 96, 3rd (liquidated): 48
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // All liquidated for 2nd and 3rd
      expectedPrizes: [336, 96, 48],
    },
  },

  "C-D5": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true, // Flag ON - liquidated are OUT
    participants: [
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 }, // 1st place
      { role: "participant", status: "active", equity: 5500, totalTrades: 4 }, // 2nd place
      { role: "participant", status: "active", equity: 5000, totalTrades: 3 }, // 3rd place
      {
        role: "participant",
        status: "liquidated",
        equity: 8000,
        totalTrades: 2,
      }, // Liquidated (disqualified) - even higher equity!
      {
        role: "participant",
        status: "liquidated",
        equity: 7500,
        totalTrades: 1,
      }, // Liquidated (disqualified)
      {
        role: "participant",
        status: "liquidated",
        equity: 7000,
        totalTrades: 1,
      }, // Liquidated (disqualified)
    ],
    // 6 × 100 = 600 pool, 20% fee = 120, net = 480
    // Flag ON: only 3 active are eligible, liquidated are disqualified even with higher equity!
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 600,
      expectedPlatformFee: 120,
      expectedRanking: [0, 1, 2], // Only active players, liquidated excluded
      expectedPrizes: [336, 96, 48],
    },
  },

  "C-D6": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 }, // 1st place
      { role: "participant", status: "active", equity: 5000, totalTrades: 4 }, // 2nd place
      {
        role: "participant",
        status: "liquidated",
        equity: 8000,
        totalTrades: 2,
      }, // Liquidated - disqualified
      {
        role: "participant",
        status: "disqualified",
        equity: 7000,
        totalTrades: 0,
      }, // Disqualified (no trades)
    ],
    // 4 × 100 = 400 pool, 20% fee = 80, net = 320
    // Only 2 active winners - production code REDISTRIBUTES 3rd place prize to existing winners
    // 10% unclaimed ÷ 2 winners = 5% bonus each
    // 1st: 320 × (70% + 5%) = 240, 2nd: 320 × (20% + 5%) = 80
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false, // Prize redistribution, not unclaimed
      statusAfter: "completed",
      expectedPrizePool: 400,
      expectedPlatformFee: 80,
      expectedRanking: [0, 1], // Only 2 winners
      expectedPrizes: [240, 80], // Redistributed: 75% and 25% of net pool
      // No unclaimed - 3rd place prize redistributed to winners as bonus
    },
  },

  // ============ TIE SCENARIO TESTS ============
  // Test exact tied PNL and tie-breaker logic

  "C-T1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // Two players with EXACTLY same equity (same PNL)
      // Tie-breaker: trades_count = FEWER trades wins (more efficient trader)
      { role: "participant", status: "active", equity: 6000, totalTrades: 3 }, // Winner (fewer trades = more efficient)
      { role: "participant", status: "active", equity: 6000, totalTrades: 10 }, // 2nd place (more trades)
    ],
    // 2 × 100 = 200 pool, 20% fee = 40, net = 160
    // Both have same PNL (+1000), tie-breaker = fewer trades wins
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins due to fewer trades
      expectedPrizes: [160, 0], // Winner takes all (single prize position)
    },
  },

  "C-T2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // Three players tied for 1st place with EXACT same stats
      // All have same equity AND same trades - should split 1st prize equally
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // All tied for 1st - should split 70% equally = 56 each
    // 2nd place (20%) and 3rd place (10%) go to... same people (they're all 1st)
    // Actually: 3 tied for rank 1 = split ALL prize money equally
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2], // All rank 1 (tied)
      expectedPrizes: [80, 80, 80], // Equal split of 240 net pool
      expectedTiedRanks: true, // Flag to indicate tie handling
    },
  },

  "C-T3": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // Two players tied for 2nd place
      { role: "participant", status: "active", equity: 7000, totalTrades: 5 }, // Clear 1st
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 }, // Tied 2nd
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 }, // Tied 2nd
      { role: "participant", status: "active", equity: 5000, totalTrades: 5 }, // 4th (no prize)
    ],
    // 4 × 100 = 400 pool, 20% fee = 80, net = 320
    // 3rd place is EMPTY (P1&P2 tie for 2nd, skip to rank 4)
    // 10% unclaimed is redistributed equally to ALL 3 winners
    // Bonus per winner: 10% ÷ 3 = 3.33%
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
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

  // ============ TIEBREAKER TYPE TESTS ============
  // Test each tiebreaker option from admin settings

  "C-T4": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "win_rate", // Higher win rate wins
    participants: [
      // Same PNL, different win rates
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 10,
        winRate: 70,
      }, // 70% win rate
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 10,
        winRate: 50,
      }, // 50% win rate
    ],
    // 2 × 100 = 200 pool, 20% fee = 40, net = 160
    // P0 wins due to higher win rate (70% > 50%)
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins via win_rate tiebreaker
      expectedPrizes: [160, 0], // Winner takes all
    },
  },

  "C-T5": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "total_capital", // Higher capital wins
    participants: [
      // Same PNL percentage, different final capital
      { role: "participant", status: "active", equity: 6500, totalTrades: 5 }, // Higher capital
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 }, // Lower capital
    ],
    // Same PNL% but P0 has more capital
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins via capital tiebreaker
      expectedPrizes: [160, 0],
    },
  },

  "C-T6": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "roi", // Higher ROI wins
    participants: [
      // Same PNL ($1000), but different starting capitals = different ROI
      // P0: started $3000, ended $4000, PNL=+$1000, ROI=33.3% (HIGHER)
      // P1: started $5000, ended $6000, PNL=+$1000, ROI=20%
      {
        role: "participant",
        status: "active",
        equity: 4000,
        totalTrades: 5,
        startingCapital: 3000,
      }, // 33% ROI
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 5,
        startingCapital: 5000,
      }, // 20% ROI
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins via ROI tiebreaker (33% > 20%)
      expectedPrizes: [160, 0],
    },
  },

  "C-T7": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "join_time", // Earlier joiner wins
    participants: [
      // Same everything, different join times (created in order, so P0 joins first)
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 wins because joined first
      expectedPrizes: [160, 0],
    },
  },

  "C-T8": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "split_prize", // No tiebreaker - split the prize
    participants: [
      // Same everything - should split equally
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
    ],
    // 2 × 100 = 200 pool, 20% fee = 40, net = 160
    // Both tied, split_prize means split equally
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // Both rank 1 (tied)
      expectedPrizes: [80, 80], // Split equally
      expectedWinners: 2,
    },
  },

  // ============ PRIZE DISTRIBUTION TYPE TESTS ============

  "C-T9": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "split_prize", // Use split_prize to force a tie
    tiePrizeDistribution: "first_gets_all", // But first joiner gets everything
    participants: [
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
    ],
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1], // P0 joined first, gets all
      expectedPrizes: [160, 0], // First gets all
      expectedWinners: 1,
    },
  },

  "C-T10": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "split_prize", // Force a tie
    tiePrizeDistribution: "split_weighted", // Split by capital
    participants: [
      { role: "participant", status: "active", equity: 7500, totalTrades: 5 }, // 75% of total capital
      { role: "participant", status: "active", equity: 2500, totalTrades: 5 }, // 25% of total capital
    ],
    // 2 × 100 = 200 pool, 20% fee = 40, net = 160
    // P0 capital: 7500, P1 capital: 2500, total: 10000
    // P0 gets 75% of 160 = 120, P1 gets 25% of 160 = 40
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [0, 1],
      expectedPrizes: [120, 40], // Split weighted by capital
      expectedWinners: 2,
    },
  },

  // ============ SECOND TIEBREAKER TESTS ============

  "C-T11": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    tieBreaker1: "trades_count", // First: fewer trades
    tieBreaker2: "win_rate", // Second: higher win rate
    participants: [
      // Same PNL, same trades, different win rates
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 5,
        winRate: 60,
      }, // 60% win rate
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 5,
        winRate: 80,
      }, // 80% win rate (wins!)
    ],
    // Both have same trades (5), so tiebreaker1 is tied
    // tiebreaker2 (win_rate): P1 has 80% > P0's 60%, so P1 wins
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedRanking: [1, 0], // P1 wins via second tiebreaker
      expectedPrizes: [0, 160], // P1 gets all
    },
  },

  // ============ EDGE CASE TESTS ============

  "C-EC1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // All participants have NEGATIVE PNL - worst performer
      { role: "participant", status: "active", equity: 4000, totalTrades: 5 }, // -1000 PNL (best of worst)
      { role: "participant", status: "active", equity: 3000, totalTrades: 5 }, // -2000 PNL
      { role: "participant", status: "active", equity: 2000, totalTrades: 5 }, // -3000 PNL (worst)
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // Ranking by PNL: P0 (-1000) > P1 (-2000) > P2 (-3000)
    // Even with negative PNL, highest wins
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2],
      expectedPrizes: [168, 48, 24], // 70%, 20%, 10% of 240
    },
  },

  "C-EC2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // Single participant - they win by default
      { role: "participant", status: "active", equity: 6000, totalTrades: 5 },
    ],
    // 1 × 100 = 100 pool, 20% fee = 20, net = 80
    // Single participant wins everything
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 100,
      expectedPlatformFee: 20,
      expectedRanking: [0],
      expectedPrizes: [80], // Winner takes all
    },
  },

  "C-EC3": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: false, // Flag OFF - liquidated can win
    participants: [
      // All liquidated, but flag is OFF so they compete by equity
      {
        role: "participant",
        status: "liquidated",
        equity: 500,
        totalTrades: 5,
      }, // Best liquidated
      {
        role: "participant",
        status: "liquidated",
        equity: 300,
        totalTrades: 5,
      }, // 2nd
      {
        role: "participant",
        status: "liquidated",
        equity: 100,
        totalTrades: 5,
      }, // Worst
    ],
    // 3 × 100 = 300 pool, 20% fee = 60, net = 240
    // With flag OFF, liquidated players still compete
    expected: {
      shouldEndEarly: false,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedRanking: [0, 1, 2],
      expectedPrizes: [168, 48, 24],
    },
  },

  // ============ CHALLENGE TIE TESTS ============

  "CH-T1": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    participants: [
      // Both have EXACTLY same equity - true tie
      { role: "challenger", status: "active", equity: 6000, totalTrades: 5 },
      { role: "challenged", status: "active", equity: 6000, totalTrades: 5 },
    ],
    // Default: split_equally - both players split prize, no single winner
    // isTie=true, winnerId=null, both get half the prize
    expected: {
      shouldEndEarly: false,
      winnerRole: "tie", // Both players tie - prize split equally (default admin setting)
      toUnclaimedPool: false,
      statusAfter: "completed",
    },
  },

  // ============ COMPETITION REFERRAL FEE TESTS ============
  // Test Game Master referral fee distribution during competition finalization

  "C-RF1": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [{ gmId: "gm1", feePercentage: 5, status: "active" }],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred - wins
      { role: "participant", status: "active", equity: 6000, totalTrades: 4 }, // Not referred
      { role: "participant", status: "active", equity: 5000, totalTrades: 3 }, // Not referred
    ],
    // 3 × 100 = 300 pool, 20% platform fee = 60
    // GM1 gets 5% of referred user's entry fee: 100 × 5% = 5
    // Net platform fee: 60 - 5 = 55
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedGmFees: [{ gmId: "gm1", amount: 5, referredCount: 1 }],
      expectedNetPlatformFee: 55,
    },
  },

  "C-RF2": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [{ gmId: "gm1", feePercentage: 10, status: "active" }],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred - wins
      { role: "participant", status: "active", equity: 6000, totalTrades: 4 }, // Not referred
    ],
    // 2 × 100 = 200 pool, 20% platform fee = 40
    // GM1 gets 10% of referred user's entry fee: 100 × 10% = 10
    // Net platform fee: 40 - 10 = 30
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedGmFees: [{ gmId: "gm1", amount: 10, referredCount: 1 }],
      expectedNetPlatformFee: 30,
    },
  },

  "C-RF3": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [{ gmId: "gm1", feePercentage: 10, status: "active" }],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 4,
        referredByGmId: "gm1",
      }, // Referred
      {
        role: "participant",
        status: "active",
        equity: 5000,
        totalTrades: 3,
        referredByGmId: "gm1",
      }, // Referred
    ],
    // 3 × 100 = 300 pool, 20% platform fee = 60
    // GM1 gets 10% of ALL referred users' entry fees: 3 × 100 × 10% = 30
    // Net platform fee: 60 - 30 = 30
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedGmFees: [{ gmId: "gm1", amount: 30, referredCount: 3 }],
      expectedNetPlatformFee: 30,
    },
  },

  "C-RF4": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      { gmId: "gm1", feePercentage: 10, status: "active" },
      { gmId: "gm2", feePercentage: 5, status: "active" },
    ],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // GM1's referral
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 4,
        referredByGmId: "gm2",
      }, // GM2's referral
      { role: "participant", status: "active", equity: 5000, totalTrades: 3 }, // Not referred
    ],
    // 3 × 100 = 300 pool, 20% platform fee = 60
    // GM1 gets 10% of 1 user: 100 × 10% = 10
    // GM2 gets 5% of 1 user: 100 × 5% = 5
    // Total GM fees: 15, Net platform fee: 60 - 15 = 45
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedGmFees: [
        { gmId: "gm1", amount: 10, referredCount: 1 },
        { gmId: "gm2", amount: 5, referredCount: 1 },
      ],
      expectedNetPlatformFee: 45,
    },
  },

  "C-RF5": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      { gmId: "gm1", feePercentage: 10, status: "expired" }, // EXPIRED - should not earn
    ],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred but GM expired
      { role: "participant", status: "active", equity: 6000, totalTrades: 4 }, // Not referred
    ],
    // 2 × 100 = 200 pool, 20% platform fee = 40
    // GM1 is EXPIRED - should NOT earn, fee retained by platform
    // Would-be fee: 100 × 10% = 10 retained
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedGmFees: [], // No GM earnings
      expectedRetainedFees: 10, // Fee retained by platform
      expectedNetPlatformFee: 40, // Full platform fee kept
    },
  },

  "C-RF6": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      { gmId: "gm1", feePercentage: 10, status: "paused" }, // PAUSED - should not earn
    ],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred but GM paused
      { role: "participant", status: "active", equity: 6000, totalTrades: 4 }, // Not referred
    ],
    // GM1 is PAUSED - should NOT earn, fee retained by platform
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 200,
      expectedPlatformFee: 40,
      expectedGmFees: [], // No GM earnings
      expectedRetainedFees: 10, // Fee retained by platform
      expectedNetPlatformFee: 40, // Full platform fee kept
    },
  },

  "C-RF7": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [{ gmId: "gm1", feePercentage: 10, status: "active" }],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred
      { role: "participant", status: "active", equity: 6500, totalTrades: 4 }, // Not referred
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 3,
        referredByGmId: "gm1",
      }, // Referred
      { role: "participant", status: "active", equity: 5500, totalTrades: 2 }, // Not referred
      { role: "participant", status: "active", equity: 5000, totalTrades: 1 }, // Not referred
    ],
    // 5 × 100 = 500 pool, 20% platform fee = 100
    // GM1 gets 10% of 2 referred users: 2 × 100 × 10% = 20
    // Net platform fee: 100 - 20 = 80
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 500,
      expectedPlatformFee: 100,
      expectedGmFees: [{ gmId: "gm1", amount: 20, referredCount: 2 }],
      expectedNetPlatformFee: 80,
    },
  },

  "C-RF8": {
    type: "competition",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      { gmId: "gm1", feePercentage: 50, status: "active" }, // Very high % - will exceed platform fee
    ],
    participants: [
      {
        role: "participant",
        status: "active",
        equity: 7000,
        totalTrades: 5,
        referredByGmId: "gm1",
      },
      {
        role: "participant",
        status: "active",
        equity: 6000,
        totalTrades: 4,
        referredByGmId: "gm1",
      },
      {
        role: "participant",
        status: "active",
        equity: 5000,
        totalTrades: 3,
        referredByGmId: "gm1",
      },
    ],
    // 3 × 100 = 300 pool, 20% platform fee = 60
    // GM1 would get 50% of 3 users: 3 × 100 × 50% = 150
    // BUT this exceeds platform fee (60)! Capped at 60.
    // Net platform fee: 60 - 60 = 0
    expected: {
      shouldEndEarly: false,
      winnerId: 0,
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedPrizePool: 300,
      expectedPlatformFee: 60,
      expectedGmFees: [
        { gmId: "gm1", amount: 60, referredCount: 3 }, // Capped at platform fee
      ],
      expectedNetPlatformFee: 0, // All platform fee goes to GM
    },
  },

  // ============ CHALLENGE REFERRAL FEE TESTS ============
  // Test Game Master referral fee distribution during challenge finalization

  "CH-RF1": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 5,
      },
    ],
    participants: [
      {
        role: "challenger",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred - wins
      { role: "challenged", status: "active", equity: 5500, totalTrades: 5 }, // Not referred
    ],
    // Challenge: 2 × 100 = 200 pool, 10% platform fee = 20
    // GM1 gets 5% (challenge rate) of challenger's entry: 100 × 5% = 5
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [{ gmId: "gm1", amount: 5, referredCount: 1 }],
    },
  },

  "CH-RF2": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 5,
      },
    ],
    participants: [
      { role: "challenger", status: "active", equity: 5500, totalTrades: 5 }, // Not referred
      {
        role: "challenged",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred - wins
    ],
    // GM1 gets 5% of challenged user's entry: 100 × 5% = 5
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenged",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [{ gmId: "gm1", amount: 5, referredCount: 1 }],
    },
  },

  "CH-RF3": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 5,
      },
    ],
    participants: [
      {
        role: "challenger",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred
      {
        role: "challenged",
        status: "active",
        equity: 5500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred
    ],
    // GM1 gets 5% from BOTH users: 2 × 100 × 5% = 10
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [{ gmId: "gm1", amount: 10, referredCount: 2 }],
    },
  },

  "CH-RF4": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 8,
      },
      {
        gmId: "gm2",
        feePercentage: 5,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 3,
      },
    ],
    participants: [
      {
        role: "challenger",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // GM1's referral
      {
        role: "challenged",
        status: "active",
        equity: 5500,
        totalTrades: 5,
        referredByGmId: "gm2",
      }, // GM2's referral
    ],
    // GM1 gets 8% from challenger: 100 × 8% = 8
    // GM2 gets 3% from challenged: 100 × 3% = 3
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [
        { gmId: "gm1", amount: 8, referredCount: 1 },
        { gmId: "gm2", amount: 3, referredCount: 1 },
      ],
    },
  },

  "CH-RF5": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: false,
      }, // Cannot earn from challenges
    ],
    participants: [
      {
        role: "challenger",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred but GM can't earn
      { role: "challenged", status: "active", equity: 5500, totalTrades: 5 },
    ],
    // GM1 has canEarnFromChallenges=false - should NOT earn
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [], // No GM earnings
      expectedRetainedFees: 10, // Would-be fee retained
    },
  },

  "CH-RF6": {
    type: "challenge",
    endType: "normal",
    disqualifyOnLiquidation: true,
    gameMasters: [
      {
        gmId: "gm1",
        feePercentage: 10,
        status: "active",
        canEarnFromChallenges: true,
        challengeFeePercentage: 5,
      },
    ],
    participants: [
      {
        role: "challenger",
        status: "active",
        equity: 6500,
        totalTrades: 5,
        referredByGmId: "gm1",
      }, // Referred
      { role: "challenged", status: "active", equity: 5500, totalTrades: 5 }, // Not referred
    ],
    // Only challenger is referred
    // GM1 gets 5% from challenger only: 100 × 5% = 5
    expected: {
      shouldEndEarly: false,
      winnerRole: "challenger",
      toUnclaimedPool: false,
      statusAfter: "completed",
      expectedGmFees: [{ gmId: "gm1", amount: 5, referredCount: 1 }],
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const { testId } = await request.json();

    if (!testId || !TEST_SCENARIOS[testId]) {
      return NextResponse.json(
        { success: false, error: "Invalid test ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const scenario = TEST_SCENARIOS[testId];
    const testDataIds: string[] = [];
    const testRunId = `TEST_${testId}_${nanoid(6)}`;

    // Create test data and run ACTUAL production code
    if (scenario.type === "competition") {
      const result = await runRealCompetitionTest(
        db,
        testRunId,
        scenario,
        testDataIds,
      );
      return NextResponse.json({ success: true, result, testDataIds });
    } else {
      const result = await runRealChallengeTest(
        db,
        testRunId,
        scenario,
        testDataIds,
      );
      return NextResponse.json({ success: true, result, testDataIds });
    }
  } catch (error) {
    console.error("End logic test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 },
    );
  }
}

/**
 * Run REAL competition test using actual production code
 */
/**
 * Create Game Master referral data for referral fee tests
 * Creates GM users, subscriptions, packages, and referral records
 */
async function createGmReferralData(
  db: mongoose.mongo.Db,
  testRunId: string,
  scenario: (typeof TEST_SCENARIOS)[keyof typeof TEST_SCENARIOS],
  participantUserIds: mongoose.Types.ObjectId[],
  testDataIds: string[],
): Promise<Map<string, mongoose.Types.ObjectId>> {
  // Map from scenario gmId to actual MongoDB ObjectId
  const gmIdMap = new Map<string, mongoose.Types.ObjectId>();
  // Map from scenario gmId to unique referral code
  const gmReferralCodeMap = new Map<string, string>();

  if (!scenario.gameMasters || scenario.gameMasters.length === 0) {
    return gmIdMap;
  }

  const now = new Date();
  // IMPORTANT: Use 'user' collection (singular) to match production code queries
  const usersCollection = db.collection("user");
  const walletsCollection = db.collection("creditwallets");
  const subscriptionsCollection = db.collection("gamemastersubscriptions");
  const packagesCollection = db.collection("marketplaceitems");
  const referralsCollection = db.collection("userreferrals");

  // Create GM users, subscriptions, packages
  for (const gm of scenario.gameMasters) {
    const gmUserId = new mongoose.Types.ObjectId();
    const packageId = new mongoose.Types.ObjectId();
    const subscriptionId = new mongoose.Types.ObjectId();
    // Generate unique referral code per GM per test run
    const uniqueReferralCode = `TESTGM_${gm.gmId.toUpperCase()}_${nanoid(10)}`;

    gmIdMap.set(gm.gmId, gmUserId);
    gmReferralCodeMap.set(gm.gmId, uniqueReferralCode);

    testDataIds.push(`user:${gmUserId}`);
    testDataIds.push(`wallet:${gmUserId}`);
    testDataIds.push(`gmsubscription:${subscriptionId}`);
    testDataIds.push(`gmpackage:${packageId}`);

    // Create GM user
    // IMPORTANT: Include 'id' field to match Clerk's schema (production queries use 'id', not '_id')
    await usersCollection.insertOne({
      _id: gmUserId,
      id: gmUserId.toString(), // Clerk-style ID field for production compatibility
      email: `${testRunId}_gm_${gm.gmId}@test.com`,
      username: `${testRunId}_GM_${gm.gmId}`,
      name: `Test GM ${gm.gmId}`,
      role: "gamemaster",
      status: "active",
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    // Create GM wallet (starts at 0 to track earnings)
    await walletsCollection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      userId: gmUserId.toString(),
      creditBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    // Determine subscription dates based on status
    let subscriptionStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    let subscriptionEnd: Date;

    if (gm.status === "expired") {
      subscriptionEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Expired yesterday
    } else {
      subscriptionEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }

    // Create GM package (marketplace item)
    await packagesCollection.insertOne({
      _id: packageId,
      name: `${testRunId}_GM_Package_${gm.gmId}`,
      slug: `test-gm-package-${testRunId}-${gm.gmId}`.toLowerCase(),
      description: "Test GM package",
      category: "gamemaster",
      price: 100,
      currency: "credits",
      status: "active",
      gameMasterConfig: {
        referralFeePercentage: gm.feePercentage,
        challengeReferralFeePercentage:
          gm.challengeFeePercentage ?? gm.feePercentage,
        canCreateCompetitions: true,
        canEarnFromChallenges: gm.canEarnFromChallenges ?? true,
        maxCompetitionsPerDay: 10,
        maxChallengesPerDay: 10,
      },
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    // Create GM subscription with unique referral code
    // Note: isPaused must be explicitly false for the production query { isPaused: { $ne: true } }
    await subscriptionsCollection.insertOne({
      _id: subscriptionId,
      userId: gmUserId.toString(),
      packageId: packageId.toString(),
      referralCode: uniqueReferralCode,
      status: gm.status,
      isPaused: gm.status === "paused", // Explicitly set isPaused
      subscriptionStart,
      subscriptionEnd,
      limits: {
        referralFeePercentage: gm.feePercentage,
        challengeReferralFeePercentage:
          gm.challengeFeePercentage ?? gm.feePercentage,
        canCreateCompetitions: true,
        canEarnFromChallenges: gm.canEarnFromChallenges ?? true,
        maxCompetitionsPerDay: 10,
        maxChallengesPerDay: 10,
      },
      totalEarnings: 0,
      totalReferrals: 0,
      testRunId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create UserReferral records for referred participants
  console.log(
    `🧪 [GM REFERRAL] Creating UserReferral records for ${scenario.participants.length} participants`,
  );
  console.log(
    `🧪 [GM REFERRAL] participantUserIds: ${participantUserIds.map((id) => id.toString()).join(", ")}`,
  );

  for (let i = 0; i < scenario.participants.length; i++) {
    const p = scenario.participants[i];
    if (p.referredByGmId && gmIdMap.has(p.referredByGmId)) {
      const gmUserId = gmIdMap.get(p.referredByGmId)!;
      const gmReferralCode = gmReferralCodeMap.get(p.referredByGmId)!;
      const participantUserId = participantUserIds[i];
      const referralId = new mongoose.Types.ObjectId();
      testDataIds.push(`referral:${referralId}`);

      // Get GM email from the GM config
      const gmConfig = scenario.gameMasters?.find(
        (gm) => gm.gmId === p.referredByGmId,
      );
      const gmEmail = `${testRunId}_gm_${p.referredByGmId}@test.com`;
      const userEmail = `${testRunId}_participant_${i}@test.com`;
      const userName = `${testRunId}_User${i + 1}`;

      console.log(
        `🧪 [GM REFERRAL] Creating UserReferral for participant ${i}: userId=${participantUserId.toString()}, gmId=${gmUserId.toString()}, gmScenarioId=${p.referredByGmId}`,
      );

      await referralsCollection.insertOne({
        _id: referralId,
        gameMasterId: gmUserId.toString(),
        gameMasterEmail: gmEmail,
        referralCode: gmReferralCode,
        userId: participantUserId.toString(),
        userEmail: userEmail,
        userName: userName,
        referredAt: now,
        isActive: true, // Required field - production code queries for this!
        totalEntryFees: 0,
        totalGMEarnings: 0,
        competitionsEntered: 0,
        challengesEntered: 0,
        testRunId,
        createdAt: now,
        updatedAt: now,
      });

      // Also update the participant's user document with referredByGameMasterId
      // Create a user document for the participant if not exists
      // IMPORTANT: Query by both _id and id for compatibility
      const participantIdStr = participantUserId.toString();
      const existingUser = await usersCollection.findOne({
        $or: [{ _id: participantUserId }, { id: participantIdStr }],
      });
      if (!existingUser) {
        // IMPORTANT: Include 'id' field to match Clerk's schema (production queries use 'id', not '_id')
        await usersCollection.insertOne({
          _id: participantUserId,
          id: participantIdStr, // Clerk-style ID field for production compatibility
          email: `${testRunId}_participant_${i}@test.com`,
          username: `${testRunId}_User${i + 1}`,
          name: `Test User ${i + 1}`,
          role: "user",
          status: "active",
          referredByGameMasterId: gmUserId.toString(),
          referredByReferralCode: gmReferralCode,
          testRunId,
          createdAt: now,
          updatedAt: now,
        });
        testDataIds.push(`user:${participantUserId}`);
      } else {
        await usersCollection.updateOne(
          { $or: [{ _id: participantUserId }, { id: participantIdStr }] },
          {
            $set: {
              id: participantIdStr, // Ensure id field exists
              referredByGameMasterId: gmUserId.toString(),
              referredByReferralCode: gmReferralCode,
            },
          },
        );
      }
    }
  }

  return gmIdMap;
}

async function runRealCompetitionTest(
  db: mongoose.mongo.Db,
  testRunId: string,
  scenario: (typeof TEST_SCENARIOS)[keyof typeof TEST_SCENARIOS],
  testDataIds: string[],
) {
  const competitionsCollection = db.collection("competitions");
  const participantsCollection = db.collection("competitionparticipants");
  const platformTransactionsCollection = db.collection("platformtransactions");
  const walletsCollection = db.collection("creditwallets");

  const now = new Date();
  const entryFee = 100;
  // Calculate prizePool based on number of participants (must match test expectations)
  const prizePool = entryFee * scenario.participants.length;
  const startingCapital = 5000; // 5000 so equity 6000 = PNL +1000 (positive profit)

  // For early end tests: end time is in the future (1 hour)
  // For normal end tests: end time is in the past
  const endTime =
    scenario.endType === "early"
      ? new Date(now.getTime() + 60 * 60 * 1000)
      : new Date(now.getTime() - 1000);

  // Create test competition - NO isTest flag so real code processes it
  const competitionId = new mongoose.Types.ObjectId();
  const testAdminId = new mongoose.Types.ObjectId();
  testDataIds.push(`competition:${competitionId}`);

  // Determine prize distribution based on test type
  // Multi-winner tests use 70/20/10 split (where expectedPrizes has multiple non-zero values)
  // Others use winner-takes-all (100% to rank 1)
  const nonZeroPrizes =
    scenario.expected.expectedPrizes?.filter((p) => p > 0).length || 0;
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
    description: "Real test competition for end logic verification",
    status: "active",
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime,
    registrationDeadline: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    entryFee,
    startingCapital,
    prizePool,
    platformFeePercentage: 20,
    createdBy: testAdminId.toString(),
    rules: {
      rankingMethod: "pnl",
      tieBreaker1: scenario.tieBreaker1 || "trades_count", // Use test-specific or default
      ...(scenario.tieBreaker2 && { tieBreaker2: scenario.tieBreaker2 }), // Only include if defined
      minimumTrades: 1, // Participants with 0 trades get disqualified (matches real behavior)
      tiePrizeDistribution: scenario.tiePrizeDistribution || "split_equally", // Use test-specific or default
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    prizeDistribution,
    maxParticipants: 100,
    minParticipants: 2,
    currentParticipants: scenario.participants.length,
    assetClasses: ["forex"],
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

    // PNL = currentCapital - startingCapital = equity - startingCapital
    // Use custom startingCapital if provided (for ROI tiebreaker tests), otherwise use common
    // Example: startingCapital=5000, equity=6000 → PNL=+1000 (profit), equity=4000 → PNL=-1000 (loss)
    const participantStartingCapital = p.startingCapital ?? startingCapital;
    const participantPnl = p.equity - participantStartingCapital;
    // Use custom pnlPercentage if provided, otherwise calculate from equity difference
    const participantPnlPercentage =
      p.pnlPercentage ?? (participantPnl / participantStartingCapital) * 100;

    // Calculate winning/losing trades based on winRate (if provided)
    const totalTrades = p.totalTrades || 1;
    const customWinRate = p.winRate ?? 50; // Default 50% if not specified
    const winningTrades = Math.round((customWinRate / 100) * totalTrades);
    const losingTrades = totalTrades - winningTrades;

    // Offset enteredAt for join_time tiebreaker tests (earlier participants join first)
    const enteredAt = new Date(now.getTime() + i * 1000); // Each participant 1 second apart

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
      startingCapital: participantStartingCapital, // Use custom or common starting capital
      pnl: participantPnl, // Calculated PNL based on equity difference
      pnlPercentage: participantPnlPercentage, // Use custom or calculated
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: customWinRate, // Use custom winRate for tiebreaker tests
      enteredAt, // Offset for join_time tiebreaker tests
      testRunId,
      createdAt: now,
      updatedAt: now,
    });

    // ONLY create positions for participants with totalTrades > 0
    // Participants with totalTrades: 0 should remain disqualified due to insufficient trades
    // IMPORTANT: Create MULTIPLE positions to match totalTrades count!
    // Production recalculates totalTrades from actual position count (stats.closedPositionsCount)
    if (p.totalTrades > 0) {
      const positionsCollection = db.collection("tradingpositions");
      const numPositions = p.totalTrades;

      // Calculate winning/losing positions based on winRate
      // Production counts winningTrades based on positions with positive realizedPnl
      const winRatePercent = customWinRate; // Use the participant's winRate
      const numWinningPositions = Math.round(
        (winRatePercent / 100) * numPositions,
      );
      const numLosingPositions = numPositions - numWinningPositions;

      // Calculate PNL per position to achieve total participantPnl
      // We need: (winningPnl * numWins) + (losingPnl * numLosses) = totalPnl
      // Simplify: Use fixed win/loss amounts that sum to totalPnl
      let winPnl: number, lossPnl: number;

      if (numWinningPositions === 0) {
        // All losing - split loss equally
        winPnl = 0;
        lossPnl = participantPnl / numLosingPositions;
      } else if (numLosingPositions === 0) {
        // All winning - split profit equally
        winPnl = participantPnl / numWinningPositions;
        lossPnl = 0;
      } else {
        // Mix of wins and losses
        // Use a simple formula: wins are +200 each, losses are calculated to balance
        winPnl = Math.abs(participantPnl) / numWinningPositions + 50; // Positive
        lossPnl =
          (participantPnl - winPnl * numWinningPositions) / numLosingPositions; // Negative
      }

      const quantity = 1;
      const contractSize = 100000;

      for (let posIdx = 0; posIdx < numPositions; posIdx++) {
        const positionId = new mongoose.Types.ObjectId();
        testDataIds.push(`position:${positionId}`);

        // First numWinningPositions are wins, rest are losses
        const isWin = posIdx < numWinningPositions;
        const positionPnl = isWin ? winPnl : lossPnl;
        const priceDiff = positionPnl / (quantity * contractSize);

        await positionsCollection.insertOne({
          _id: positionId,
          oddsPositionId: positionId.toString(),
          oddsUserId: userId.toString(),
          userId: userId.toString(),
          competitionId: competitionId.toString(),
          symbol: "EUR/USD",
          side: "long",
          orderType: "market",
          quantity: quantity,
          entryPrice: 1.1,
          exitPrice: 1.1 + priceDiff,
          currentPrice: 1.1 + priceDiff,
          unrealizedPnl: 0,
          unrealizedPnlPercentage: 0,
          realizedPnl: positionPnl, // PNL for this position (positive=win, negative=loss)
          leverage: 1,
          marginUsed: 1000,
          maintenanceMargin: 500,
          status: "closed",
          openOrderId: `test-order-${i}-${posIdx}`,
          lastPriceUpdate: now,
          priceUpdateCount: 1,
          openedAt: new Date(now.getTime() - (60 + posIdx) * 60 * 1000), // Stagger open times
          closedAt: new Date(now.getTime() - (30 + posIdx) * 60 * 1000), // Stagger close times
          testRunId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Create Game Master referral data if this is a referral test
  const gmIdMap = await createGmReferralData(
    db,
    testRunId,
    scenario,
    participantUserIds,
    testDataIds,
  );
  console.log(
    `🧪 [TEST] Created GM referral data: ${gmIdMap.size} GMs configured`,
  );

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
    if (scenario.endType === "early") {
      // Import and run the ACTUAL early end check (test-specific version)
      const { runEarlyEndCheckForTest } =
        await import("../../../../../../../worker/jobs/early-end-check.job");

      // Run early end check for THIS test run only
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);

      // Check results in database
      const updatedComp = await competitionsCollection.findOne({
        _id: competitionId,
      });
      const unclaimedTxn = await platformTransactionsCollection.findOne({
        sourceId: competitionId.toString(),
        transactionType: "unclaimed_pool",
        testRunId: { $exists: false }, // Real transactions don't have testRunId
      });

      // Also check if any prize was distributed (check wallets)
      let winnerFound = false;
      let winnerUserId = "";
      for (const userId of participantUserIds) {
        const wallet = await walletsCollection.findOne({
          userId: userId.toString(),
        });
        if (wallet && wallet.creditBalance > 0) {
          winnerFound = true;
          winnerUserId = userId.toString();
          break;
        }
      }

      const actualStatus = updatedComp?.status || "active";
      const expectedStatus = scenario.expected.statusAfter;
      const hadUnclaimed = !!unclaimedTxn || updatedComp?.noWinners === true;

      // Determine if test passed
      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== expectedStatus) {
        passed = false;
        issues.push(
          `Status: expected '${expectedStatus}', got '${actualStatus}'`,
        );
      }

      if (scenario.expected.toUnclaimedPool && !hadUnclaimed) {
        passed = false;
        issues.push("Expected unclaimed pool but none recorded");
      }

      if (
        !scenario.expected.toUnclaimedPool &&
        scenario.expected.winnerId !== undefined
      ) {
        if (!winnerFound) {
          passed = false;
          issues.push("Expected winner but no prize distributed");
        }
      }

      actualResult = {
        passed,
        message: passed
          ? "✅ Test PASSED - Real code executed correctly"
          : `❌ Test FAILED: ${issues.join(", ")}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${winnerFound ? winnerUserId.slice(-6) : "none"}, Unclaimed: ${hadUnclaimed}`,
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
    } else if (scenario.endType === "journey") {
      // JOURNEY TEST: First verify early end does NOT trigger, then finalize and verify distribution
      const { runEarlyEndCheckForTest } =
        await import("../../../../../../../worker/jobs/early-end-check.job");
      const { finalizeCompetition } =
        await import("../../../../../../../lib/actions/trading/competition-end.actions");

      console.log(
        `\n🧪 [JOURNEY TEST] Step 1: Checking early end does NOT trigger for ${competitionId}`,
      );

      // Step 1: Run early end check - should NOT end early
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);

      // Verify competition is still active
      let compAfterEarlyCheck = await competitionsCollection.findOne({
        _id: competitionId,
      });
      if (compAfterEarlyCheck?.status === "completed") {
        actualResult = {
          passed: false,
          message:
            "❌ Test FAILED: Competition ended early when it should have continued",
          actualOutcome: "Competition ended early unexpectedly",
          details: { earlyEndResult, status: compAfterEarlyCheck.status },
        };
      } else {
        console.log(
          `🧪 [JOURNEY TEST] Step 1 PASSED: Competition still active`,
        );

        // Step 2: Now set end time to past and finalize
        await competitionsCollection.updateOne(
          { _id: competitionId },
          { $set: { endTime: new Date(Date.now() - 1000) } },
        );

        console.log(`🧪 [JOURNEY TEST] Step 2: Running finalizeCompetition`);
        let finalizeResult: Record<string, unknown> | null = null;
        let finalizeError: string | null = null;
        try {
          finalizeResult = await finalizeCompetition(
            competitionId.toString(),
          ) as Record<string, unknown>;
        } catch (finErr) {
          finalizeError = finErr instanceof Error ? finErr.message : String(finErr);
          console.error(`🧪 [JOURNEY TEST] finalizeCompetition threw:`, finalizeError);
        }
        console.log(
          `🧪 [TEST] finalizeCompetition result:`,
          JSON.stringify(finalizeResult, null, 2),
        );

        // Check results
        const updatedComp = await competitionsCollection.findOne({
          _id: competitionId,
        });
        const actualStatus = updatedComp?.status || "active";

        // Check wallets for prize distribution
        let winnerFound = false;
        let winnerUserId = "";
        let winnerIndex = -1;
        let winnerBalance = 0;
        for (let i = 0; i < participantUserIds.length; i++) {
          const wallet = await walletsCollection.findOne({
            userId: participantUserIds[i].toString(),
          });
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
        const platformFeeTransaction =
          await platformTransactionsCollection.findOne({
            sourceId: competitionId.toString(),
            transactionType: "competition_fee",
          });
        const unclaimedTransaction =
          await platformTransactionsCollection.findOne({
            sourceId: competitionId.toString(),
            transactionType: "unclaimed_pool",
          });

        let passed = true;
        const issues: string[] = [];

        if (actualStatus !== "completed") {
          passed = false;
          issues.push(`Status: expected 'completed', got '${actualStatus}'`);
        }

        if (
          scenario.expected.winnerId !== undefined &&
          winnerIndex !== scenario.expected.winnerId
        ) {
          passed = false;
          issues.push(
            `Winner: expected participant ${scenario.expected.winnerId}, got ${winnerIndex}`,
          );
        }

        // Verify prize amounts if specified
        if (
          scenario.expected.expectedWinnerPrize !== undefined &&
          winnerFound
        ) {
          const expectedPrize = scenario.expected.expectedWinnerPrize;
          if (Math.abs(winnerBalance - expectedPrize) > 1) {
            // Allow $1 tolerance
            passed = false;
            issues.push(
              `Winner prize: expected $${expectedPrize}, got $${winnerBalance}`,
            );
          }
        }

        if (
          scenario.expected.expectedPlatformFee !== undefined &&
          platformFeeTransaction
        ) {
          const actualFee = platformFeeTransaction.amount || 0;
          const expectedFee = scenario.expected.expectedPlatformFee;
          if (Math.abs(actualFee - expectedFee) > 1) {
            passed = false;
            issues.push(
              `Platform fee: expected $${expectedFee}, got $${actualFee}`,
            );
          }
        }

        actualResult = {
          passed,
          message: passed
            ? "✅ Test PASSED - Journey test completed correctly"
            : `❌ Test FAILED: ${issues.join(", ")}${finalizeError ? ` [Error: ${finalizeError}]` : ""}`,
          actualOutcome: `Journey: Early check ✓ → Finalize → Status: ${actualStatus}, Winner: participant ${winnerIndex}, Prize: $${winnerBalance}`,
          prizeDistribution: winnerFound
            ? { winnerId: winnerUserId, winnerPrize: winnerBalance }
            : unclaimedTransaction
              ? { unclaimedPool: unclaimedTransaction.amount }
              : undefined,
          details: {
            journeySteps: [
              "Early end check (should NOT trigger)",
              "Manual finalization",
              "Prize distribution",
            ],
            earlyEndResult,
            finalizeResult,
            finalizeError,
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
      const { finalizeCompetition } =
        await import("../../../../../../../lib/actions/trading/competition-end.actions");

      console.log(
        `\n🧪 [TEST] Running finalizeCompetition for ${competitionId}`,
      );
      let finalizeResult: Record<string, unknown> | null = null;
      let finalizeError: string | null = null;
      try {
        finalizeResult = await finalizeCompetition(
          competitionId.toString(),
        ) as Record<string, unknown>;
      } catch (finErr) {
        finalizeError = finErr instanceof Error ? finErr.message : String(finErr);
        console.error(`🧪 [TEST] finalizeCompetition threw:`, finalizeError);
      }
      console.log(
        `🧪 [TEST] finalizeCompetition result:`,
        JSON.stringify(finalizeResult, null, 2),
      );

      // Check results
      const updatedComp = await competitionsCollection.findOne({
        _id: competitionId,
      });
      const actualStatus = updatedComp?.status || "active";

      // Check participants to see their final status
      const finalParticipants = await participantsCollection
        .find({ competitionId: competitionId.toString() })
        .toArray();
      console.log(
        `🧪 [TEST] Participants after finalization:`,
        finalParticipants.map((p) => ({
          username: p.username,
          status: p.status,
          currentCapital: p.currentCapital,
          isWinner: p.isWinner,
          prizeWon: p.prizeWon,
          finalRank: p.finalRank,
        })),
      );

      // Check ALL wallets for multi-winner distribution (include $0 prizes for ranking)
      const walletBalances: {
        participantIndex: number;
        userId: string;
        balance: number;
      }[] = [];
      for (let i = 0; i < participantUserIds.length; i++) {
        const wallet = await walletsCollection.findOne({
          userId: participantUserIds[i].toString(),
        });
        const balance = wallet?.creditBalance || 0;
        console.log(`🧪 [TEST] Wallet for participant ${i}: $${balance}`);
        // Include ALL participants for full ranking (even those with $0 prize)
        walletBalances.push({
          participantIndex: i,
          userId: participantUserIds[i].toString(),
          balance,
        });
      }

      // Get prizes in PARTICIPANT ORDER (for expectedPrizes comparison)
      const prizesByParticipantIndex = walletBalances.map((w) => w.balance);

      // Sort by balance descending to get ranking order (higher prize = higher rank)
      const sortedByRank = [...walletBalances].sort(
        (a, b) => b.balance - a.balance,
      );
      const actualRanking = sortedByRank.map((w) => w.participantIndex);
      const actualPrizes = prizesByParticipantIndex; // Prizes in PARTICIPANT order to match expectedPrizes

      console.log(
        `🧪 [TEST] Prize distribution: ranking=${actualRanking.join(",")}, prizesByParticipant=${actualPrizes.join(",")}`,
      );

      // Check platform transactions for prize verification
      const platformFeeTransaction =
        await platformTransactionsCollection.findOne({
          sourceId: competitionId.toString(),
          transactionType: "competition_fee",
        });
      const unclaimedTransaction = await platformTransactionsCollection.findOne(
        {
          sourceId: competitionId.toString(),
          transactionType: "unclaimed_pool",
        },
      );

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== "completed") {
        passed = false;
        issues.push(`Status: expected 'completed', got '${actualStatus}'`);
      }

      // Single winner tests
      if (
        scenario.expected.winnerId !== undefined &&
        actualRanking[0] !== scenario.expected.winnerId
      ) {
        passed = false;
        issues.push(
          `Winner: expected participant ${scenario.expected.winnerId}, got ${actualRanking[0] ?? "none"}`,
        );
      }

      // Verify single winner prize amounts if specified
      if (
        scenario.expected.expectedWinnerPrize !== undefined &&
        walletBalances.length > 0
      ) {
        const expectedPrize = scenario.expected.expectedWinnerPrize;
        const actualWinnerPrize = walletBalances[0]?.balance || 0;
        if (Math.abs(actualWinnerPrize - expectedPrize) > 1) {
          // Allow $1 tolerance
          passed = false;
          issues.push(
            `Winner prize: expected $${expectedPrize}, got $${actualWinnerPrize}`,
          );
        }
      }

      // Multi-winner ranking verification
      if (scenario.expected.expectedRanking) {
        const expectedRanking = scenario.expected.expectedRanking;
        if (actualRanking.length < expectedRanking.length) {
          passed = false;
          issues.push(
            `Winners count: expected ${expectedRanking.length}, got ${actualRanking.length}`,
          );
        } else {
          // Check each rank position
          for (let r = 0; r < expectedRanking.length; r++) {
            if (actualRanking[r] !== expectedRanking[r]) {
              passed = false;
              issues.push(
                `Rank ${r + 1}: expected participant ${expectedRanking[r]}, got ${actualRanking[r]}`,
              );
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
          if (Math.abs(actualPrize - expectedPrize) > 1) {
            // Allow $1 tolerance
            passed = false;
            issues.push(
              `Prize ${p + 1}: expected $${expectedPrize}, got $${actualPrize}`,
            );
          }
        }
      }

      // Platform fee verification
      if (
        scenario.expected.expectedPlatformFee !== undefined &&
        platformFeeTransaction
      ) {
        const actualFee = platformFeeTransaction.amount || 0;
        const expectedFee = scenario.expected.expectedPlatformFee;
        if (Math.abs(actualFee - expectedFee) > 1) {
          passed = false;
          issues.push(
            `Platform fee: expected $${expectedFee}, got $${actualFee}`,
          );
        }
      }

      // Unclaimed pool verification (for missing winners or all disqualified)
      if (scenario.expected.expectedUnclaimedAmount !== undefined) {
        const actualUnclaimed = unclaimedTransaction?.amount || 0;
        const expectedUnclaimed = scenario.expected.expectedUnclaimedAmount;
        if (Math.abs(actualUnclaimed - expectedUnclaimed) > 1) {
          passed = false;
          issues.push(
            `Unclaimed pool: expected $${expectedUnclaimed}, got $${actualUnclaimed}`,
          );
        }
      }

      // ============ GM REFERRAL FEE VERIFICATION ============
      const gmEarningsCollection = db.collection("gamemasterearnings");
      const gmFeeVerification: {
        gmId: string;
        expected: number;
        actual: number;
        passed: boolean;
      }[] = [];

      // Debug: Check what UserReferrals and GM subscriptions exist
      const allReferrals = await db
        .collection("userreferrals")
        .find({ testRunId })
        .toArray();
      const allGmSubscriptions = await db
        .collection("gamemastersubscriptions")
        .find({ testRunId })
        .toArray();
      console.log(
        `🧪 [VERIFY] Found ${allReferrals.length} UserReferrals with testRunId`,
      );
      for (const ref of allReferrals) {
        console.log(
          `🧪 [VERIFY] UserReferral: userId=${ref.userId}, gameMasterId=${ref.gameMasterId}, isActive=${ref.isActive}`,
        );
      }
      console.log(
        `🧪 [VERIFY] Found ${allGmSubscriptions.length} GM subscriptions with testRunId`,
      );
      for (const sub of allGmSubscriptions) {
        console.log(
          `🧪 [VERIFY] GMSubscription: userId=${sub.userId}, status=${sub.status}, isPaused=${sub.isPaused}`,
        );
      }

      if (
        scenario.expected.expectedGmFees &&
        scenario.expected.expectedGmFees.length > 0
      ) {
        for (const expectedGmFee of scenario.expected.expectedGmFees) {
          // Get actual GM user ID from map
          const actualGmUserId = gmIdMap.get(expectedGmFee.gmId);
          if (!actualGmUserId) {
            passed = false;
            issues.push(`GM ${expectedGmFee.gmId}: Not found in gmIdMap`);
            continue;
          }

          // Check GM wallet balance
          const gmWallet = await walletsCollection.findOne({
            userId: actualGmUserId.toString(),
          });
          const actualGmBalance = gmWallet?.creditBalance || 0;

          console.log(
            `🧪 [TEST] GM ${expectedGmFee.gmId} wallet: expected $${expectedGmFee.amount}, actual $${actualGmBalance}`,
          );

          gmFeeVerification.push({
            gmId: expectedGmFee.gmId,
            expected: expectedGmFee.amount,
            actual: actualGmBalance,
            passed: Math.abs(actualGmBalance - expectedGmFee.amount) <= 1, // $1 tolerance
          });

          if (Math.abs(actualGmBalance - expectedGmFee.amount) > 1) {
            passed = false;
            issues.push(
              `GM ${expectedGmFee.gmId} fee: expected $${expectedGmFee.amount}, got $${actualGmBalance}`,
            );
          }

          // Verify GameMasterEarning record was created
          const gmEarning = await gmEarningsCollection.findOne({
            gameMasterId: actualGmUserId.toString(),
            sourceId: competitionId.toString(),
          });

          if (!gmEarning && expectedGmFee.amount > 0) {
            passed = false;
            issues.push(
              `GM ${expectedGmFee.gmId}: No GameMasterEarning record found`,
            );
          } else if (gmEarning) {
            console.log(
              `🧪 [TEST] GM ${expectedGmFee.gmId} earning record: $${gmEarning.amount}, referrals: ${gmEarning.referredUserCount || 1}`,
            );
          }
        }
      }

      // Verify net platform fee (gross - GM fees) if specified
      if (
        scenario.expected.expectedNetPlatformFee !== undefined &&
        platformFeeTransaction
      ) {
        // The platform fee transaction should reflect the net amount after GM deductions
        // Note: This depends on how the production code handles fee recording
        const actualNetFee = platformFeeTransaction.amount || 0;
        const expectedNetFee = scenario.expected.expectedNetPlatformFee;

        // Calculate total GM fees paid
        const totalGmFeesPaid = gmFeeVerification.reduce(
          (sum, v) => sum + v.actual,
          0,
        );
        const calculatedNetFee =
          (scenario.expected.expectedPlatformFee || 0) - totalGmFeesPaid;

        console.log(
          `🧪 [TEST] Net platform fee: expected $${expectedNetFee}, calculated $${calculatedNetFee}, recorded $${actualNetFee}`,
        );

        // The platform fee transaction records gross fee, we verify GM wallets received their portion
        // So we verify: gross fee - GM wallet balances = expected net fee
        if (Math.abs(calculatedNetFee - expectedNetFee) > 1) {
          passed = false;
          issues.push(
            `Net platform fee: expected $${expectedNetFee}, calculated $${calculatedNetFee}`,
          );
        }
      }

      // Verify retained fees (fees from inactive GMs kept by platform)
      if (scenario.expected.expectedRetainedFees !== undefined) {
        // For inactive GMs, no wallet credit should occur
        // Total GM fees expected but not paid = retained fees
        const totalExpectedGmFees =
          scenario.expected.expectedGmFees?.reduce(
            (sum, f) => sum + f.amount,
            0,
          ) || 0;
        const totalActualGmFees = gmFeeVerification.reduce(
          (sum, v) => sum + v.actual,
          0,
        );
        const actualRetained =
          totalExpectedGmFees > 0
            ? totalExpectedGmFees - totalActualGmFees
            : scenario.expected.expectedRetainedFees;

        // If no GM fees were expected to be paid (empty array), check that expected retained was indeed retained
        if (
          scenario.expected.expectedGmFees?.length === 0 &&
          scenario.expected.expectedRetainedFees > 0
        ) {
          // Verify no GM earnings were created for this competition
          const anyGmEarnings = await gmEarningsCollection.findOne({
            sourceId: competitionId.toString(),
          });
          if (anyGmEarnings) {
            passed = false;
            issues.push(
              `Retained fees: Expected no GM earnings but found one for GM ${anyGmEarnings.gameMasterId}`,
            );
          }
        }

        console.log(
          `🧪 [TEST] Retained fees: expected $${scenario.expected.expectedRetainedFees}, actual retained $${actualRetained}`,
        );
      }

      // Build prize distribution summary
      const winnerSummary =
        walletBalances.length > 0
          ? walletBalances
              .map(
                (w, i) => `${i + 1}st: P${w.participantIndex} ($${w.balance})`,
              )
              .join(", ")
          : "No winners";

      actualResult = {
        passed,
        message: passed
          ? "✅ Test PASSED - Real finalization executed correctly"
          : `❌ Test FAILED: ${issues.join(", ")}${finalizeError ? ` [Error: ${finalizeError}]` : ""}`,
        actualOutcome: `Status: ${actualStatus}, Winners: ${winnerSummary}`,
        prizeDistribution:
          walletBalances.length > 0
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
          finalizeError,
          finalizeSuccess: finalizeResult?.success,
          finalizeMessage: finalizeResult?.message,
          competitionStatus: actualStatus,
          actualRanking,
          actualPrizes,
          platformFee: platformFeeTransaction?.amount,
          unclaimedAmount: unclaimedTransaction?.amount,
          participantsCount: finalParticipants.length,
          winnersCount: walletBalances.length,
          // GM referral fee details
          gmFeeVerification:
            gmFeeVerification.length > 0 ? gmFeeVerification : undefined,
          gmFeesTotal:
            gmFeeVerification.reduce((sum, v) => sum + v.actual, 0) ||
            undefined,
        },
      };
    }
  } catch (error) {
    actualResult = {
      passed: false,
      message: `❌ Test ERROR: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  scenario: (typeof TEST_SCENARIOS)[keyof typeof TEST_SCENARIOS],
  testDataIds: string[],
) {
  const challengesCollection = db.collection("challenges");
  const participantsCollection = db.collection("challengeparticipants");
  const walletsCollection = db.collection("creditwallets");

  const now = new Date();
  const entryFee = 100;
  const prizePool = entryFee * 2; // 200
  // For referral fee tests, we need a platform fee (GM fees come FROM platform fee)
  const hasPlatformFee =
    scenario.gameMasters && scenario.gameMasters.length > 0;
  const platformFeePercent = hasPlatformFee ? 10 : 0;
  const platformFee = prizePool * (platformFeePercent / 100);
  const winnerPrize = prizePool - platformFee; // 180 if 10% fee, 200 if no fee

  // For early end tests: end time is in the future
  // For normal end tests: end time is in the past
  const endTime =
    scenario.endType === "early"
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
    challengerEmail: "test@test.com",
    challengedId: opponentUserId.toString(),
    challengedName: `${testRunId}_Opponent`,
    challengedEmail: "test2@test.com",
    status: "active",
    entryFee,
    prizePool,
    winnerPrize,
    platformFeePercentage: platformFeePercent,
    platformFeeAmount: platformFee,
    startingCapital: 10000,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime,
    duration: 60,
    acceptDeadline: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    rules: {
      rankingMethod: "pnl",
      tieBreaker1: "trades_count",
      minimumTrades: 1, // Schema requires min 1
      disqualifyOnLiquidation: scenario.disqualifyOnLiquidation,
    },
    assetClasses: ["forex"],
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
  userIdMap["challenged"] = opponentUserId;

  for (const p of scenario.participants) {
    const participantId = new mongoose.Types.ObjectId();
    const userId = userIdMap[p.role as "challenger" | "challenged"];
    testDataIds.push(`challengeparticipant:${participantId}`);

    // IMPORTANT: Use common starting capital so PNL differences reflect equity differences
    // PNL = currentCapital - startingCapital = equity - 10000
    const commonStartingCapital = 10000; // Challenge starting capital
    const participantPnl = p.equity - commonStartingCapital;
    const participantPnlPercentage =
      (participantPnl / commonStartingCapital) * 100;

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
    // IMPORTANT: Create MULTIPLE positions to match totalTrades count!
    // Production recalculates totalTrades from actual position count (stats.totalTrades++)
    if (p.totalTrades > 0) {
      const positionsCollection = db.collection("tradingpositions");
      const numPositions = p.totalTrades;

      // Split total PNL across all positions evenly
      const pnlPerPosition = participantPnl / numPositions;

      // IMPORTANT: Production calculates PNL as: priceDiff * quantity * 100000 (forex contract size)
      // Also: Challenge finalization queries positions by competitionId, not challengeId!
      const quantity = 1;
      const contractSize = 100000;
      const priceDiff = pnlPerPosition / (quantity * contractSize);

      for (let posIdx = 0; posIdx < numPositions; posIdx++) {
        const positionId = new mongoose.Types.ObjectId();
        testDataIds.push(`position:${positionId}`);

        await positionsCollection.insertOne({
          _id: positionId,
          oddsPositionId: positionId.toString(),
          oddsUserId: userId.toString(),
          userId: userId.toString(),
          competitionId: challengeId.toString(), // Challenge finalization queries competitionId!
          symbol: "EUR/USD",
          side: "long",
          orderType: "market",
          quantity: quantity,
          entryPrice: 1.1,
          exitPrice: 1.1 + priceDiff,
          currentPrice: 1.1 + priceDiff,
          unrealizedPnl: 0,
          unrealizedPnlPercentage: 0,
          realizedPnl: pnlPerPosition, // PNL for this position
          leverage: 1,
          marginUsed: 1000,
          maintenanceMargin: 500,
          status: "closed",
          openOrderId: `test-order-${p.role}-${posIdx}`,
          lastPriceUpdate: now,
          priceUpdateCount: 1,
          openedAt: new Date(now.getTime() - (60 + posIdx) * 60 * 1000), // Stagger open times
          closedAt: new Date(now.getTime() - (30 + posIdx) * 60 * 1000), // Stagger close times
          testRunId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Create Game Master referral data if this is a referral test
  // For challenges, participant order is [challenger, challenged]
  const challengeParticipantUserIds = [challengerUserId, opponentUserId];
  const gmIdMap = await createGmReferralData(
    db,
    testRunId,
    scenario,
    challengeParticipantUserIds,
    testDataIds,
  );
  console.log(
    `🧪 [TEST] Created GM referral data for challenge: ${gmIdMap.size} GMs configured`,
  );

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
    if (scenario.endType === "early") {
      // Run early end check (test-specific version)
      const { runEarlyEndCheckForTest } =
        await import("../../../../../../../worker/jobs/early-end-check.job");
      const earlyEndResult = await runEarlyEndCheckForTest(testRunId);

      // Check results
      const updatedChallenge = await challengesCollection.findOne({
        _id: challengeId,
      });
      const actualStatus = updatedChallenge?.status || "active";
      const actualWinnerRole = updatedChallenge?.winnerRole;
      const hadNoWinner = updatedChallenge?.noWinner === true;

      // Check wallets
      const challengerWallet = await walletsCollection.findOne({
        userId: challengerUserId.toString(),
      });
      const opponentWallet = await walletsCollection.findOne({
        userId: opponentUserId.toString(),
      });
      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;

      // Determine winner - if BOTH got prize, it's a tie (split_equally)
      let actualWinner: string | null;
      if (challengerGotPrize && opponentGotPrize) {
        actualWinner = "tie"; // Both got prize = tie with split_equally
      } else if (challengerGotPrize) {
        actualWinner = "challenger";
      } else if (opponentGotPrize) {
        actualWinner = "challenged";
      } else {
        actualWinner = null;
      }

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== scenario.expected.statusAfter) {
        passed = false;
        issues.push(
          `Status: expected '${scenario.expected.statusAfter}', got '${actualStatus}'`,
        );
      }

      if (scenario.expected.toUnclaimedPool && !hadNoWinner) {
        passed = false;
        issues.push("Expected unclaimed pool but challenge has winner");
      }

      if (
        scenario.expected.winnerRole &&
        actualWinner !== scenario.expected.winnerRole
      ) {
        passed = false;
        issues.push(
          `Winner: expected '${scenario.expected.winnerRole}', got '${actualWinner}'`,
        );
      }

      actualResult = {
        passed,
        message: passed
          ? "✅ Test PASSED - Real early end executed correctly"
          : `❌ Test FAILED: ${issues.join(", ")}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${actualWinner || "none"}, NoWinner: ${hadNoWinner}`,
        prizeDistribution: hadNoWinner
          ? { unclaimedPool: prizePool }
          : actualWinner === "tie"
            ? { tie: true, splitPrize: prizePool / 2 }
            : actualWinner
              ? {
                  winnerId:
                    actualWinner === "challenger"
                      ? challengerUserId.toString()
                      : opponentUserId.toString(),
                  winnerPrize: prizePool,
                }
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
      const { finalizeChallenge } =
        await import("../../../../../../../lib/actions/trading/challenge-finalize.actions");

      console.log(`\n🧪 [TEST] Running finalizeChallenge for ${challengeId}`);
      let finalizeResult: Record<string, unknown> | null = null;
      let finalizeError: string | null = null;
      try {
        finalizeResult = await finalizeChallenge(challengeId.toString()) as Record<string, unknown>;
      } catch (finErr) {
        finalizeError = finErr instanceof Error ? finErr.message : String(finErr);
        console.error(`🧪 [TEST] finalizeChallenge threw:`, finalizeError);
      }
      console.log(
        `🧪 [TEST] finalizeChallenge result:`,
        JSON.stringify(finalizeResult, null, 2),
      );

      // Check results
      const updatedChallenge = await challengesCollection.findOne({
        _id: challengeId,
      });
      const actualStatus = updatedChallenge?.status || "active";

      // Check participants
      const finalParticipants = await participantsCollection
        .find({ challengeId: challengeId.toString() })
        .toArray();
      console.log(
        `🧪 [TEST] Challenge participants after finalization:`,
        finalParticipants.map((p) => ({
          username: p.username,
          role: p.role,
          status: p.status,
          currentCapital: p.currentCapital,
          isWinner: p.isWinner,
        })),
      );

      // Check wallets
      const challengerWallet = await walletsCollection.findOne({
        userId: challengerUserId.toString(),
      });
      const opponentWallet = await walletsCollection.findOne({
        userId: opponentUserId.toString(),
      });
      console.log(
        `🧪 [TEST] Wallets - Challenger: ${challengerWallet?.creditBalance}, Opponent: ${opponentWallet?.creditBalance}`,
      );

      const challengerGotPrize = (challengerWallet?.creditBalance || 0) > 0;
      const opponentGotPrize = (opponentWallet?.creditBalance || 0) > 0;

      // Determine winner - if BOTH got prize, it's a tie (split_equally)
      let actualWinner: string | null;
      if (challengerGotPrize && opponentGotPrize) {
        actualWinner = "tie"; // Both got prize = tie with split_equally
      } else if (challengerGotPrize) {
        actualWinner = "challenger";
      } else if (opponentGotPrize) {
        actualWinner = "challenged";
      } else {
        actualWinner = null;
      }

      let passed = true;
      const issues: string[] = [];

      if (actualStatus !== "completed") {
        passed = false;
        issues.push(`Status: expected 'completed', got '${actualStatus}'`);
      }

      if (
        scenario.expected.winnerRole &&
        actualWinner !== scenario.expected.winnerRole
      ) {
        passed = false;
        issues.push(
          `Winner: expected '${scenario.expected.winnerRole}', got '${actualWinner}'`,
        );
      }

      // ============ GM REFERRAL FEE VERIFICATION FOR CHALLENGES ============
      const gmEarningsCollection = db.collection("gamemasterearnings");
      const gmFeeVerification: {
        gmId: string;
        expected: number;
        actual: number;
        passed: boolean;
      }[] = [];

      // Debug: Check what UserReferrals and GM subscriptions exist
      const allReferrals = await db
        .collection("userreferrals")
        .find({ testRunId })
        .toArray();
      const allGmSubscriptions = await db
        .collection("gamemastersubscriptions")
        .find({ testRunId })
        .toArray();
      console.log(
        `🧪 [VERIFY CHALLENGE] Found ${allReferrals.length} UserReferrals with testRunId`,
      );
      for (const ref of allReferrals) {
        console.log(
          `🧪 [VERIFY CHALLENGE] UserReferral: userId=${ref.userId}, gameMasterId=${ref.gameMasterId}, isActive=${ref.isActive}`,
        );
      }
      console.log(
        `🧪 [VERIFY CHALLENGE] Found ${allGmSubscriptions.length} GM subscriptions with testRunId`,
      );
      for (const sub of allGmSubscriptions) {
        console.log(
          `🧪 [VERIFY CHALLENGE] GMSubscription: userId=${sub.userId}, status=${sub.status}, isPaused=${sub.isPaused}, canEarnFromChallenges=${sub.limits?.canEarnFromChallenges}`,
        );
      }

      if (
        scenario.expected.expectedGmFees &&
        scenario.expected.expectedGmFees.length > 0
      ) {
        for (const expectedGmFee of scenario.expected.expectedGmFees) {
          // Get actual GM user ID from map
          const actualGmUserId = gmIdMap.get(expectedGmFee.gmId);
          if (!actualGmUserId) {
            passed = false;
            issues.push(`GM ${expectedGmFee.gmId}: Not found in gmIdMap`);
            continue;
          }

          // Check GM wallet balance
          const gmWallet = await walletsCollection.findOne({
            userId: actualGmUserId.toString(),
          });
          const actualGmBalance = gmWallet?.creditBalance || 0;

          console.log(
            `🧪 [TEST] Challenge GM ${expectedGmFee.gmId} wallet: expected $${expectedGmFee.amount}, actual $${actualGmBalance}`,
          );

          gmFeeVerification.push({
            gmId: expectedGmFee.gmId,
            expected: expectedGmFee.amount,
            actual: actualGmBalance,
            passed: Math.abs(actualGmBalance - expectedGmFee.amount) <= 1, // $1 tolerance
          });

          if (Math.abs(actualGmBalance - expectedGmFee.amount) > 1) {
            passed = false;
            issues.push(
              `GM ${expectedGmFee.gmId} fee: expected $${expectedGmFee.amount}, got $${actualGmBalance}`,
            );
          }

          // Verify GameMasterEarning record was created
          // Challenge finalization writes sourceType:"challenge" + sourceId (the challenge _id)
          const gmEarning = await gmEarningsCollection.findOne({
            gameMasterId: actualGmUserId.toString(),
            sourceId: challengeId.toString(),
            sourceType: "challenge",
          });

          if (!gmEarning && expectedGmFee.amount > 0) {
            passed = false;
            issues.push(
              `GM ${expectedGmFee.gmId}: No GameMasterEarning record found`,
            );
          } else if (gmEarning) {
            console.log(
              `🧪 [TEST] Challenge GM ${expectedGmFee.gmId} earning record: $${gmEarning.amount}, referrals: ${gmEarning.referredUserCount || 1}`,
            );
          }
        }
      }

      // Verify retained fees (fees from GMs with canEarnFromChallenges=false)
      if (scenario.expected.expectedRetainedFees !== undefined) {
        if (
          scenario.expected.expectedGmFees?.length === 0 &&
          scenario.expected.expectedRetainedFees > 0
        ) {
          // Verify no GM earnings were created for this challenge
          // Challenge finalization writes sourceType:"challenge" + sourceId
          const anyGmEarnings = await gmEarningsCollection.findOne({
            sourceId: challengeId.toString(),
            sourceType: "challenge",
          });
          if (anyGmEarnings) {
            passed = false;
            issues.push(
              `Retained fees: Expected no GM earnings but found one for GM ${anyGmEarnings.gameMasterId}`,
            );
          } else {
            console.log(
              `🧪 [TEST] Challenge retained fees verified: no GM earnings created`,
            );
          }
        }
      }

      actualResult = {
        passed,
        message: passed
          ? "✅ Test PASSED - Real finalization executed correctly"
          : `❌ Test FAILED: ${issues.join(", ")}${finalizeError ? ` [Error: ${finalizeError}]` : ""}`,
        actualOutcome: `Status: ${actualStatus}, Winner: ${actualWinner || "none"}${gmFeeVerification.length > 0 ? `, GM fees: ${gmFeeVerification.map((g) => `${g.gmId}=$${g.actual}`).join(", ")}` : ""}`,
        prizeDistribution:
          actualWinner === "tie"
            ? { tie: true, splitPrize: prizePool / 2 }
            : actualWinner
              ? {
                  winnerId:
                    actualWinner === "challenger"
                      ? challengerUserId.toString()
                      : opponentUserId.toString(),
                  winnerPrize: prizePool,
                }
              : undefined,
        details: {
          finalizeResult,
          finalizeError,
          finalizeSuccess: finalizeResult?.success,
          challengeStatus: actualStatus,
          challengerBalance: challengerWallet?.creditBalance,
          opponentBalance: opponentWallet?.creditBalance,
          participantsCount: finalParticipants.length,
          // GM referral fee details
          gmFeeVerification:
            gmFeeVerification.length > 0 ? gmFeeVerification : undefined,
          gmFeesTotal:
            gmFeeVerification.reduce((sum, v) => sum + v.actual, 0) ||
            undefined,
        },
      };
    }
  } catch (error) {
    actualResult = {
      passed: false,
      message: `❌ Test ERROR: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: { error: error instanceof Error ? error.stack : String(error) },
    };
  }

  return actualResult;
}
