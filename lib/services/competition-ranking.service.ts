/**
 * Competition Ranking Service
 * Handles all ranking calculations, tie-breaking, and qualification logic
 */

export interface ParticipantData {
  userId: string;
  username: string;
  currentCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  status: string;
  enteredAt: Date;
  startingCapital: number;
}

export interface RankedParticipant extends ParticipantData {
  rank: number;
  isTied: boolean;
  tiedWith?: string[]; // User IDs of tied participants
  qualificationStatus: 'qualified' | 'disqualified';
  disqualificationReason?: string;
}

export interface CompetitionRules {
  rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
  tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  minimumTrades: number;
  minimumWinRate?: number;
  tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all';
  disqualifyOnLiquidation: boolean;
}

export interface RankingOptions {
  competitionStatus?: 'upcoming' | 'active' | 'completed' | 'cancelled';
}

/**
 * Calculate ranking value based on ranking method
 */
function getRankingValue(participant: ParticipantData, method: string): number {
  switch (method) {
    case 'pnl':
      return participant.pnl;
    case 'roi':
      return participant.pnlPercentage;
    case 'total_capital':
      return participant.currentCapital;
    case 'win_rate':
      return participant.winRate;
    case 'total_wins':
      return participant.winningTrades;
    case 'profit_factor':
      // Profit Factor = Total Wins / Total Losses
      const totalWins = participant.winningTrades;
      const totalLosses = participant.losingTrades;
      if (totalLosses === 0) return totalWins > 0 ? 9999 : 0; // Infinity if all wins
      return totalWins / totalLosses;
    default:
      return participant.pnl;
  }
}

/**
 * Get tiebreaker value
 */
function getTieBreakerValue(participant: ParticipantData, tieBreaker: string): number {
  switch (tieBreaker) {
    case 'trades_count':
      return -participant.totalTrades; // Negative because fewer is better (more efficient)
    case 'win_rate':
      return participant.winRate;
    case 'total_capital':
      return participant.currentCapital;
    case 'roi':
      return participant.pnlPercentage;
    case 'join_time':
      return -new Date(participant.enteredAt).getTime(); // Negative because earlier is better
    default:
      return 0;
  }
}

/**
 * Check if two participants are truly tied (same stats across ALL relevant criteria)
 * This ensures players with identical performance get the same rank/badge
 */
function areParticipantsTied(
  a: ParticipantData,
  b: ParticipantData,
  rules: CompetitionRules
): boolean {
  const epsilon = 0.0001;

  // Compare primary ranking value
  const aValue = getRankingValue(a, rules.rankingMethod);
  const bValue = getRankingValue(b, rules.rankingMethod);
  if (Math.abs(aValue - bValue) >= epsilon) return false;

  // Compare tiebreaker 1 (if not split_prize)
  if (rules.tieBreaker1 && rules.tieBreaker1 !== 'split_prize') {
    const aTie1 = getTieBreakerValue(a, rules.tieBreaker1);
    const bTie1 = getTieBreakerValue(b, rules.tieBreaker1);
    if (Math.abs(aTie1 - bTie1) >= epsilon) return false;
  }

  // Compare tiebreaker 2 (if exists and not split_prize)
  if (rules.tieBreaker2 && rules.tieBreaker2 !== 'split_prize') {
    const aTie2 = getTieBreakerValue(a, rules.tieBreaker2);
    const bTie2 = getTieBreakerValue(b, rules.tieBreaker2);
    if (Math.abs(aTie2 - bTie2) >= epsilon) return false;
  }

  // All criteria match - truly tied!
  return true;
}

/**
 * Check if participant qualifies for prizes
 * NOTE: Minimum trades are only checked when competition is COMPLETED
 * During active competitions, we show warnings but don't disqualify yet
 */
function checkQualification(
  participant: ParticipantData,
  rules: CompetitionRules,
  options?: RankingOptions
): { qualified: boolean; reason?: string } {
  const isCompleted = options?.competitionStatus === 'completed';
  
  // Check liquidation (always applies)
  if (rules.disqualifyOnLiquidation && participant.status === 'liquidated') {
    return { qualified: false, reason: 'Liquidated' };
  }

  // Check minimum trades - ONLY when competition is COMPLETED
  // During active competitions, users can still meet the requirement
  if (isCompleted && participant.totalTrades < rules.minimumTrades) {
    return {
      qualified: false,
      reason: `Insufficient trades (${participant.totalTrades}/${rules.minimumTrades})`,
    };
  }

  // Check minimum win rate - ONLY when competition is COMPLETED
  if (isCompleted && rules.minimumWinRate && participant.winRate < rules.minimumWinRate) {
    return {
      qualified: false,
      reason: `Win rate too low (${participant.winRate.toFixed(1)}% < ${rules.minimumWinRate}%)`,
    };
  }

  return { qualified: true };
}

/**
 * Main ranking function with tie-breaking logic
 * @param options.competitionStatus - Only checks min trades/win rate when 'completed'
 */
export function calculateRankings(
  participants: ParticipantData[],
  rules: CompetitionRules,
  options?: RankingOptions
): RankedParticipant[] {
  // Step 1: Check qualifications (min trades only checked when competition is completed)
  const qualifiedParticipants = participants.map((p) => {
    const qualification = checkQualification(p, rules, options);
    return {
      ...p,
      rank: 0, // Will be assigned later
      isTied: false,
      tiedWith: [] as string[], // Track tied participants
      qualificationStatus: qualification.qualified ? 'qualified' as const : 'disqualified' as const,
      disqualificationReason: qualification.reason,
    };
  });

  // Separate qualified and disqualified
  const qualified = qualifiedParticipants.filter((p) => p.qualificationStatus === 'qualified');
  const disqualified = qualifiedParticipants.filter((p) => p.qualificationStatus === 'disqualified');

  // Step 2: Sort qualified participants
  qualified.sort((a, b) => {
    // Primary ranking method
    const aValue = getRankingValue(a, rules.rankingMethod);
    const bValue = getRankingValue(b, rules.rankingMethod);

    if (aValue !== bValue) {
      return bValue - aValue; // Higher is better (descending)
    }

    // Tie! Apply tiebreaker 1
    if (rules.tieBreaker1 !== 'split_prize') {
      const aTie1 = getTieBreakerValue(a, rules.tieBreaker1);
      const bTie1 = getTieBreakerValue(b, rules.tieBreaker1);

      if (aTie1 !== bTie1) {
        return bTie1 - aTie1;
      }
    }

    // Still tied! Apply tiebreaker 2
    if (rules.tieBreaker2 && rules.tieBreaker2 !== 'split_prize') {
      const aTie2 = getTieBreakerValue(a, rules.tieBreaker2);
      const bTie2 = getTieBreakerValue(b, rules.tieBreaker2);

      if (aTie2 !== bTie2) {
        return bTie2 - aTie2;
      }
    }

    // Ultimate tiebreaker: join time (earlier is better)
    return new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime();
  });

  // Step 3: Assign ranks and detect TRUE ties (same across ALL criteria)
  let currentRank = 1;
  let skipCount = 0; // Track how many positions to skip after ties
  
  for (let i = 0; i < qualified.length; i++) {
    const current = qualified[i];
    const currentValue = getRankingValue(current, rules.rankingMethod);

    console.log(`  Ranking ${i + 1}: ${current.username} - ${rules.rankingMethod}=${currentValue.toFixed(4)}`);

    // Check if tied with previous (using comprehensive comparison)
    if (i > 0) {
      const previous = qualified[i - 1];
      
      // Use the comprehensive tie detection that checks ALL criteria
      const isTied = areParticipantsTied(current, previous, rules);

      if (isTied) {
        // Truly tied! Use same rank as previous
        current.rank = previous.rank;
        current.isTied = true;
        previous.isTied = true;
        skipCount++; // Skip this position for next non-tied participant

        console.log(`    🔗 TRUE TIE detected! Both at rank ${previous.rank}`);

        // Track who they're tied with (collect all tied participants)
        // Add all previous tied participants to current's list
        current.tiedWith.push(previous.userId);
        if (previous.tiedWith.length > 0) {
          previous.tiedWith.forEach((id: string) => {
            if (!current.tiedWith.includes(id)) {
              current.tiedWith.push(id);
            }
          });
        }
        
        // Add current to previous's list
        previous.tiedWith.push(current.userId);
        
        // Update all previously tied participants to include current
        for (let j = i - 2; j >= 0; j--) {
          if (qualified[j].rank === current.rank && qualified[j].isTied) {
            if (!qualified[j].tiedWith.includes(current.userId)) {
              qualified[j].tiedWith.push(current.userId);
            }
            if (!current.tiedWith.includes(qualified[j].userId)) {
              current.tiedWith.push(qualified[j].userId);
            }
          } else {
            break; // Stop when we hit a different rank
          }
        }
      } else {
        // Not tied - assign next available rank (accounting for skipped positions)
        currentRank = previous.rank + skipCount + 1;
        current.rank = currentRank;
        current.isTied = false;
        skipCount = 0;
        console.log(`    ✅ Different stats: assigned rank ${currentRank}`);
      }
    } else {
      // First participant
      current.rank = 1;
      current.isTied = false;
      currentRank = 1;
      console.log(`    🥇 First place`);
    }
  }

  // Step 4: Assign disqualified ranks (after all qualified)
  disqualified.forEach((p, index) => {
    p.rank = qualified.length + index + 1;
  });

  // Combine and return
  return [...qualified, ...disqualified];
}

/**
 * Calculate prize distribution with tie handling
 * FIXED: Now calculates from GROSS prize pool and deducts platform fee from each winner
 * FIXED: Redistributes unclaimed prize positions equally among actual winners
 */
export function distributePrizesWithTies(
  rankedParticipants: RankedParticipant[],
  prizeDistribution: { rank: number; percentage: number }[],
  grossPrizePool: number, // CHANGED: Now receives GROSS prize pool
  rules: CompetitionRules,
  platformFeePercentage: number = 0 // NEW: Platform fee to deduct from each prize
): { userId: string; prizeAmount: number; rank: number; isTied: boolean }[] {
  const distributions: { userId: string; prizeAmount: number; rank: number; isTied: boolean }[] = [];

  // Group qualified participants by rank to handle ties
  const rankGroups: { [rank: number]: RankedParticipant[] } = {};
  const qualifiedParticipants = rankedParticipants.filter((p) => p.qualificationStatus === 'qualified');
  
  qualifiedParticipants.forEach((p) => {
    if (!rankGroups[p.rank]) rankGroups[p.rank] = [];
    rankGroups[p.rank].push(p);
  });

  const totalQualifiedParticipants = qualifiedParticipants.length;
  console.log(`💰 Prize distribution: ${totalQualifiedParticipants} qualified participants, ${prizeDistribution.length} prize positions`);

  // Step 1: Calculate which prize positions are filled and which are unclaimed
  let unclaimedPercentage = 0;
  const filledPrizePositions: { rank: number; percentage: number; winners: RankedParticipant[] }[] = [];

  prizeDistribution.forEach((dist) => {
    const winnersAtRank = rankGroups[dist.rank] || [];
    
    if (winnersAtRank.length === 0) {
      // No one at this rank - add percentage to unclaimed pool
      unclaimedPercentage += dist.percentage;
      console.log(`  📭 Rank ${dist.rank}: No winner - ${dist.percentage}% added to unclaimed pool`);
    } else {
      // Winners exist at this rank
      filledPrizePositions.push({
        rank: dist.rank,
        percentage: dist.percentage,
        winners: winnersAtRank,
      });
      console.log(`  ✅ Rank ${dist.rank}: ${winnersAtRank.length} winner(s) - ${dist.percentage}%`);
    }
  });

  console.log(`  📊 Unclaimed percentage to redistribute: ${unclaimedPercentage}%`);

  // Step 2: Calculate bonus percentage per filled winner from unclaimed pool
  // Distribute unclaimed percentage equally among ALL actual winners
  const totalActualWinners = filledPrizePositions.reduce((sum, pos) => sum + pos.winners.length, 0);
  const bonusPercentagePerWinner = totalActualWinners > 0 ? unclaimedPercentage / totalActualWinners : 0;

  if (bonusPercentagePerWinner > 0) {
    console.log(`  🎁 Bonus per winner from unclaimed: +${bonusPercentagePerWinner.toFixed(2)}% each`);
  }

  // Step 3: Distribute prizes with bonus
  filledPrizePositions.forEach((pos) => {
    const winnersAtRank = pos.winners;
    
    // Calculate base percentage + bonus for each winner at this rank
    const basePercentage = pos.percentage;
    const winnersCount = winnersAtRank.length;
    
    // For ties at the same rank, they already split the base percentage
    // Plus each winner gets bonus from unclaimed pool
    const perWinnerBasePercentage = basePercentage / winnersCount;
    const totalPercentagePerWinner = perWinnerBasePercentage + bonusPercentagePerWinner;

    if (winnersCount === 1) {
      // Single winner at this rank
      const grossPrize = (grossPrizePool * (basePercentage + bonusPercentagePerWinner)) / 100;
      const netPrize = grossPrize * (1 - platformFeePercentage);
      const prizeAmount = Math.floor(netPrize * 100) / 100;
      
      console.log(`  🏆 Rank ${pos.rank}: ${winnersAtRank[0].username} gets ${basePercentage}% + ${bonusPercentagePerWinner.toFixed(2)}% bonus = ${(basePercentage + bonusPercentagePerWinner).toFixed(2)}% (${prizeAmount} credits after ${(platformFeePercentage * 100).toFixed(1)}% fee)`);
      
      distributions.push({
        userId: winnersAtRank[0].userId,
        prizeAmount,
        rank: pos.rank,
        isTied: false,
      });
    } else {
      // Multiple winners tied at this rank
      console.log(`  🤝 Rank ${pos.rank}: ${winnersCount} tied winners, each gets ${perWinnerBasePercentage.toFixed(2)}% + ${bonusPercentagePerWinner.toFixed(2)}% bonus = ${totalPercentagePerWinner.toFixed(2)}%`);

      if (rules.tiePrizeDistribution === 'split_equally') {
        // Split base percentage equally, plus each gets bonus
        winnersAtRank.forEach((winner) => {
          const grossPrize = (grossPrizePool * totalPercentagePerWinner) / 100;
          const netPrize = grossPrize * (1 - platformFeePercentage);
          const prizeAmount = Math.floor(netPrize * 100) / 100;
          
          distributions.push({
            userId: winner.userId,
            prizeAmount,
            rank: pos.rank,
            isTied: true,
          });
        });
      } else if (rules.tiePrizeDistribution === 'first_gets_all') {
        // First person (by join time) gets all (base + all bonuses for this rank)
        const sorted = winnersAtRank.sort(
          (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
        );
        const totalGroupPercentage = basePercentage + (bonusPercentagePerWinner * winnersCount);
        const grossPrize = (grossPrizePool * totalGroupPercentage) / 100;
        const netPrize = grossPrize * (1 - platformFeePercentage);
        const prizeAmount = Math.floor(netPrize * 100) / 100;
        
        distributions.push({
          userId: sorted[0].userId,
          prizeAmount,
          rank: pos.rank,
          isTied: true,
        });
      } else if (rules.tiePrizeDistribution === 'split_weighted') {
        // Split based on secondary metrics (e.g., capital)
        const totalWeight = winnersAtRank.reduce((sum, w) => sum + w.currentCapital, 0);
        // Total pool for this group: base + all bonuses
        const totalGroupPercentage = basePercentage + (bonusPercentagePerWinner * winnersCount);
        
        winnersAtRank.forEach((winner) => {
          const weight = winner.currentCapital / totalWeight;
          const grossPrize = (grossPrizePool * totalGroupPercentage * weight) / 100;
          const netPrize = grossPrize * (1 - platformFeePercentage);
          const prizeAmount = Math.floor(netPrize * 100) / 100;
          
          distributions.push({
            userId: winner.userId,
            prizeAmount,
            rank: pos.rank,
            isTied: true,
          });
        });
      }
    }
  });

  return distributions;
}

/**
 * Get ranking method description
 */
export function getRankingMethodDescription(method: string): string {
  const descriptions = {
    pnl: 'Highest Profit/Loss (P&L)',
    roi: 'Highest Return on Investment (ROI %)',
    total_capital: 'Highest Total Capital',
    win_rate: 'Highest Win Rate %',
    total_wins: 'Most Winning Trades',
    profit_factor: 'Best Profit Factor',
  };
  return descriptions[method as keyof typeof descriptions] || method;
}

/**
 * Get tiebreaker description
 */
export function getTieBreakerDescription(tieBreaker: string): string {
  const descriptions = {
    trades_count: 'Fewer trades (more efficient)',
    win_rate: 'Higher win rate',
    total_capital: 'Higher total capital',
    roi: 'Higher ROI %',
    join_time: 'Who joined first',
    split_prize: 'Split prize equally',
  };
  return descriptions[tieBreaker as keyof typeof descriptions] || tieBreaker;
}

