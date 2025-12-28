'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { getRealPrice } from '@/lib/services/real-forex-prices.service';
import { ForexSymbol, calculateUnrealizedPnL } from '@/lib/services/pnl-calculator.service';

/**
 * Comprehensive Dashboard Data
 * Includes all competitions, challenges, performance metrics, and analytics
 */
export interface ComprehensiveDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  
  // Overview Stats
  overview: {
    totalCapital: number;
    totalPnL: number;
    totalPnLPercentage: number;
    unrealizedPnL: number;
    realizedPnL: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    activeContests: number;
    totalPrizesWon: number;
  };
  
  // Competitions
  competitions: {
    active: CompetitionData[];
    upcoming: CompetitionData[];
    completed: CompetitionData[];
    stats: {
      total: number;
      won: number;
      topThreeFinishes: number;
      averageRank: number;
      bestRank: number;
    };
  };
  
  // Challenges (1v1)
  challenges: {
    active: ChallengeData[];
    pending: ChallengeData[];
    completed: ChallengeData[];
    stats: {
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      totalStaked: number;
      totalWon: number;
    };
  };
  
  // Performance Charts Data
  charts: {
    equityCurve: { date: string; equity: number; pnl: number }[];
    dailyPnL: { date: string; pnl: number; trades: number }[];
    winLossDistribution: { wins: number; losses: number; breakeven: number };
    tradesBySymbol: { symbol: string; count: number; pnl: number }[];
    tradesByHour: { hour: number; count: number; pnl: number }[];
    monthlyPerformance: { month: string; pnl: number; trades: number; winRate: number }[];
  };
  
  // Recent Activity
  recentActivity: {
    trades: TradeData[];
    positions: PositionData[];
  };
  
  // Streaks & Achievements
  streaks: {
    currentWinStreak: number;
    currentLossStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
    tradingDaysThisMonth: number;
    consecutiveProfitableDays: number;
  };
}

interface CompetitionData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  prizePool: number;
  entryFee: number;
  currentRank: number;
  totalParticipants: number;
  pnl: number;
  pnlPercentage: number;
  currentCapital: number;
  startingCapital: number;
  totalTrades: number;
  winRate: number;
  openPositions: number;
  prizeWon?: number;
  // For Win Potential Card
  rankingMethod: string;
  prizeDistribution: { rank: number; percentage: number }[];
  minimumTrades: number;
  userParticipation: {
    userId: string;
    currentCapital: number;
    startingCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    currentRank: number;
    status: string;
  };
  allParticipants: Array<{
    userId: string;
    currentCapital: number;
    startingCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    currentRank: number;
    status: string;
  }>;
}

interface ChallengeData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  opponent: {
    name: string;
    pnl: number;
    pnlPercentage: number;
  } | null;
  userPnL: number;
  userPnLPercentage: number;
  isLeading: boolean;
  isWinner?: boolean;
  prizeWon?: number;
}

interface TradeData {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  openedAt: Date;
  closedAt: Date;
  contestName: string;
  contestType: 'competition' | 'challenge';
}

interface PositionData {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  openedAt: Date;
  contestName: string;
  contestType: 'competition' | 'challenge';
}

/**
 * Get comprehensive dashboard data for the authenticated user
 * 
 * SOURCE OF TRUTH:
 * - Financial stats (totalPrizesWon) → CreditWallet model (line ~472)
 * - Trading metrics (trades, PnL, win rate) → CompetitionParticipant + ChallengeParticipant records
 * - Live capital → Only from ACTIVE contest participations (not wallet balance)
 * 
 * IMPORTANT: totalPrizesWon MUST come from wallet to match profile page!
 * See lib/services/unified-user-stats.service.ts for the canonical definition.
 */
export async function getComprehensiveDashboardData(): Promise<ComprehensiveDashboardData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');
  
  const userId = session.user.id;
  await connectToDatabase();
  
  // Parallel fetch all data
  const [
    competitionParticipations,
    challengeParticipations,
    allCompetitions,
    allChallenges,
    allTrades,
    wallet,
  ] = await Promise.all([
    CompetitionParticipant.find({ userId }).lean(),
    ChallengeParticipant.find({ userId }).lean(),
    Competition.find({}).lean(),
    Challenge.find({ $or: [{ challengerId: userId }, { challengedId: userId }] }).lean(),
    TradeHistory.find({ userId }).sort({ closedAt: -1 }).limit(100).lean(),
    // Wallet is the SOURCE OF TRUTH for financial data (prizes won, etc.)
    CreditWallet.findOne({ userId }).lean(),
  ]);
  
  // Process competitions
  const competitionsMap = new Map(allCompetitions.map((c: any) => [c._id.toString(), c]));
  
  const processedCompetitions = {
    active: [] as CompetitionData[],
    upcoming: [] as CompetitionData[],
    completed: [] as CompetitionData[],
    stats: {
      total: competitionParticipations.length,
      won: 0,
      topThreeFinishes: 0,
      averageRank: 0,
      bestRank: Infinity,
    },
  };
  
  let totalRankSum = 0;
  let rankedCount = 0;
  
  // Pre-fetch all participants for active competitions (needed for Win Potential card)
  const activeCompetitionIds = allCompetitions
    .filter((c: any) => c.status === 'active')
    .map((c: any) => c._id);
  
  const allActiveParticipants = await CompetitionParticipant.find({
    competitionId: { $in: activeCompetitionIds }
  }).lean();
  
  // Group participants by competition
  const participantsByCompetition = new Map<string, any[]>();
  for (const p of allActiveParticipants as any[]) {
    const compId = p.competitionId?.toString();
    if (!participantsByCompetition.has(compId)) {
      participantsByCompetition.set(compId, []);
    }
    participantsByCompetition.get(compId)!.push(p);
  }
  
  for (const participation of competitionParticipations as any[]) {
    const competition = competitionsMap.get(participation.competitionId?.toString());
    if (!competition) continue;
    
    // Get all participants for this competition (for win potential calculation)
    const competitionParticipants = participantsByCompetition.get(competition._id.toString()) || [];
    
    // Map participants to the format needed by WinPotentialCard
    const mappedParticipants = competitionParticipants.map((p: any) => ({
      userId: p.userId?.toString() || '',
      currentCapital: p.currentCapital || 0,
      startingCapital: p.startingCapital || competition.startingCapital || 10000,
      pnl: p.pnl || 0,
      pnlPercentage: p.pnlPercentage || 0,
      totalTrades: p.totalTrades || 0,
      winningTrades: p.winningTrades || 0,
      losingTrades: p.losingTrades || 0,
      winRate: p.totalTrades > 0 ? ((p.winningTrades || 0) / p.totalTrades) * 100 : 0,
      averageWin: p.averageWin || 0,
      averageLoss: p.averageLoss || 0,
      currentRank: p.currentRank || 0,
      status: p.status || 'active',
    }));
    
    const compData: CompetitionData = {
      id: competition._id.toString(),
      name: competition.name,
      status: competition.status,
      startTime: competition.startTime,
      endTime: competition.endTime,
      prizePool: competition.prizePool || competition.prizePoolCredits || 0,
      entryFee: competition.entryFee || competition.entryFeeCredits || 0,
      currentRank: participation.currentRank || 0,
      totalParticipants: competition.currentParticipants || 0,
      pnl: participation.pnl || 0,
      pnlPercentage: participation.pnlPercentage || 0,
      currentCapital: participation.currentCapital || 0,
      startingCapital: participation.startingCapital || competition.startingCapital || 10000,
      totalTrades: participation.totalTrades || 0,
      winRate: participation.winRate || 0,
      openPositions: participation.currentOpenPositions || 0,
      prizeWon: participation.prizeWon,
      // Win Potential Card data
      rankingMethod: competition.rules?.rankingMethod || 'pnl',
      prizeDistribution: competition.prizeDistribution || [],
      minimumTrades: competition.rules?.minimumTrades || 0,
      userParticipation: {
        userId: userId,
        currentCapital: participation.currentCapital || 0,
        startingCapital: participation.startingCapital || competition.startingCapital || 10000,
        pnl: participation.pnl || 0,
        pnlPercentage: participation.pnlPercentage || 0,
        totalTrades: participation.totalTrades || 0,
        winningTrades: participation.winningTrades || 0,
        losingTrades: participation.losingTrades || 0,
        winRate: participation.totalTrades > 0 ? ((participation.winningTrades || 0) / participation.totalTrades) * 100 : 0,
        averageWin: participation.averageWin || 0,
        averageLoss: participation.averageLoss || 0,
        currentRank: participation.currentRank || 0,
        status: participation.status || 'active',
      },
      allParticipants: mappedParticipants,
    };
    
    if (competition.status === 'active') {
      processedCompetitions.active.push(compData);
    } else if (competition.status === 'upcoming') {
      processedCompetitions.upcoming.push(compData);
    } else if (competition.status === 'completed') {
      processedCompetitions.completed.push(compData);
      
      if (participation.currentRank === 1) processedCompetitions.stats.won++;
      if (participation.currentRank <= 3) processedCompetitions.stats.topThreeFinishes++;
    }
    
    if (participation.currentRank > 0) {
      totalRankSum += participation.currentRank;
      rankedCount++;
      if (participation.currentRank < processedCompetitions.stats.bestRank) {
        processedCompetitions.stats.bestRank = participation.currentRank;
      }
    }
  }
  
  processedCompetitions.stats.averageRank = rankedCount > 0 ? totalRankSum / rankedCount : 0;
  if (processedCompetitions.stats.bestRank === Infinity) processedCompetitions.stats.bestRank = 0;
  
  // Process challenges
  const processedChallenges = {
    active: [] as ChallengeData[],
    pending: [] as ChallengeData[],
    completed: [] as ChallengeData[],
    stats: {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalStaked: 0,
      totalWon: 0,
    },
  };
  
  for (const challenge of allChallenges as any[]) {
    const userParticipation = (challengeParticipations as any[]).find(
      (p: any) => p.challengeId?.toString() === challenge._id.toString()
    );
    
    if (!userParticipation) continue;
    
    const isChallenger = challenge.challengerId === userId;
    const opponentParticipation = (challengeParticipations as any[]).find(
      (p: any) => p.challengeId?.toString() === challenge._id.toString() && p.userId !== userId
    );
    
    const challengeData: ChallengeData = {
      id: challenge._id.toString(),
      name: challenge.name || `Challenge vs ${isChallenger ? challenge.challengedUsername : challenge.challengerUsername}`,
      status: challenge.status,
      startTime: challenge.startTime,
      endTime: challenge.endTime,
      stakeAmount: challenge.stakeAmount || 0,
      opponent: opponentParticipation ? {
        name: opponentParticipation.username,
        pnl: opponentParticipation.pnl || 0,
        pnlPercentage: opponentParticipation.pnlPercentage || 0,
      } : null,
      userPnL: userParticipation.pnl || 0,
      userPnLPercentage: userParticipation.pnlPercentage || 0,
      isLeading: opponentParticipation ? (userParticipation.pnl || 0) > (opponentParticipation.pnl || 0) : true,
      isWinner: userParticipation.isWinner,
      prizeWon: userParticipation.prizeReceived,
    };
    
    processedChallenges.stats.total++;
    processedChallenges.stats.totalStaked += challenge.stakeAmount || 0;
    
    if (challenge.status === 'active') {
      processedChallenges.active.push(challengeData);
    } else if (challenge.status === 'pending') {
      processedChallenges.pending.push(challengeData);
    } else if (challenge.status === 'completed') {
      processedChallenges.completed.push(challengeData);
      if (userParticipation.isWinner) {
        processedChallenges.stats.wins++;
        processedChallenges.stats.totalWon += userParticipation.prizeReceived || 0;
      } else {
        processedChallenges.stats.losses++;
      }
    }
  }
  
  const totalChallengeGames = processedChallenges.stats.wins + processedChallenges.stats.losses;
  processedChallenges.stats.winRate = totalChallengeGames > 0 
    ? (processedChallenges.stats.wins / totalChallengeGames) * 100 
    : 0;
  
  // Calculate overview stats
  // ONLY count capital from ACTIVE competitions/challenges for "Live Balance"
  const activeCompetitionIdsSet = new Set(
    allCompetitions
      .filter((c: any) => c.status === 'active')
      .map((c: any) => c._id.toString())
  );
  
  const activeChallengeIdsSet = new Set(
    allChallenges
      .filter((c: any) => c.status === 'active')
      .map((c: any) => c._id.toString())
  );
  
  // Filter to only active participations for capital calculation
  const activeCompParticipations = (competitionParticipations as any[]).filter(
    (p: any) => activeCompetitionIdsSet.has(p.competitionId?.toString())
  );
  const activeChallengeParticipations = (challengeParticipations as any[]).filter(
    (p: any) => activeChallengeIdsSet.has(p.challengeId?.toString())
  );
  
  // For total stats, use all participations
  const allParticipations = [...competitionParticipations, ...challengeParticipations] as any[];
  // For live capital, use only active participations
  const activeParticipations = [...activeCompParticipations, ...activeChallengeParticipations];
  
  // Live capital = only from active contests
  let totalCapital = 0;
  for (const p of activeParticipations) {
    totalCapital += p.currentCapital || 0;
  }
  
  // All-time stats = from all participations
  let totalPnL = 0;
  let unrealizedPnL = 0;
  let realizedPnL = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalGrossWins = 0;
  let totalGrossLosses = 0;
  let largestWin = 0;
  let largestLoss = 0;
  
  // IMPORTANT: Use wallet as SOURCE OF TRUTH for prizes won (not participation records)
  // This ensures consistency with the profile page which also uses wallet data
  const walletData = wallet as any;
  const totalPrizesWon = (walletData?.totalWonFromCompetitions || 0) + (walletData?.totalWonFromChallenges || 0);
  
  for (const p of allParticipations) {
    totalPnL += p.pnl || 0;
    unrealizedPnL += p.unrealizedPnl || 0;
    realizedPnL += p.realizedPnl || 0;
    totalTrades += p.totalTrades || 0;
    winningTrades += p.winningTrades || 0;
    losingTrades += p.losingTrades || 0;
    
    if (p.averageWin && p.winningTrades) {
      totalGrossWins += p.averageWin * p.winningTrades;
    }
    if (p.averageLoss && p.losingTrades) {
      totalGrossLosses += Math.abs(p.averageLoss) * p.losingTrades;
    }
    if (p.largestWin && p.largestWin > largestWin) largestWin = p.largestWin;
    if (p.largestLoss && p.largestLoss < largestLoss) largestLoss = p.largestLoss;
  }
  
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor = totalGrossLosses > 0 ? totalGrossWins / totalGrossLosses : (totalGrossWins > 0 ? 999 : 0);
  const averageWin = winningTrades > 0 ? totalGrossWins / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalGrossLosses / losingTrades : 0;
  
  // Build chart data
  const charts = await buildChartData(userId, allTrades as any[]);
  
  // Get recent trades and positions
  const recentTrades: TradeData[] = (allTrades as any[]).slice(0, 20).map((t: any) => ({
    id: t._id.toString(),
    symbol: t.symbol,
    side: t.side,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    quantity: t.quantity,
    pnl: t.realizedPnl || 0,
    pnlPercentage: t.entryPrice > 0 ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 * (t.side === 'long' ? 1 : -1) : 0,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    contestName: t.competitionId ? 'Competition' : 'Challenge',
    contestType: t.competitionId ? 'competition' : 'challenge',
  }));
  
  // Get open positions
  const openPositions = await TradingPosition.find({ userId, status: 'open' }).lean();
  const positionsWithPrices: PositionData[] = [];
  
  for (const pos of openPositions as any[]) {
    const price = await getRealPrice(pos.symbol as ForexSymbol);
    const currentPrice = price ? (pos.side === 'long' ? price.bid : price.ask) : pos.entryPrice;
    const unrealizedPnL = calculateUnrealizedPnL(pos.side, pos.entryPrice, currentPrice, pos.quantity, pos.symbol);
    
    positionsWithPrices.push({
      id: pos._id.toString(),
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      currentPrice,
      quantity: pos.quantity,
      unrealizedPnL,
      unrealizedPnLPercentage: pos.marginUsed > 0 ? (unrealizedPnL / pos.marginUsed) * 100 : 0,
      openedAt: pos.openedAt,
      contestName: pos.competitionId ? 'Competition' : 'Challenge',
      contestType: pos.competitionId ? 'competition' : 'challenge',
    });
  }
  
  // Calculate streaks
  const streaks = calculateStreaks(allTrades as any[]);
  
  // Calculate starting capital for percentage
  const totalStartingCapital = allParticipations.reduce((sum, p) => sum + (p.startingCapital || 10000), 0);
  const totalPnLPercentage = totalStartingCapital > 0 ? (totalPnL / totalStartingCapital) * 100 : 0;
  
  return {
    user: {
      id: userId,
      name: session.user.name || 'Trader',
      email: session.user.email || '',
    },
    overview: {
      totalCapital,
      totalPnL,
      totalPnLPercentage,
      unrealizedPnL,
      realizedPnL,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      activeContests: processedCompetitions.active.length + processedChallenges.active.length,
      totalPrizesWon,
    },
    competitions: processedCompetitions,
    challenges: processedChallenges,
    charts,
    recentActivity: {
      trades: recentTrades,
      positions: positionsWithPrices,
    },
    streaks,
  };
}

async function buildChartData(userId: string, allTrades: any[]) {
  const now = new Date();
  
  // Daily P&L for last 30 days
  const dailyPnL: { date: string; pnl: number; trades: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dayTrades = allTrades.filter((t: any) => {
      const tradeDate = new Date(t.closedAt);
      return tradeDate >= startOfDay && tradeDate <= endOfDay;
    });
    
    const dayPnL = dayTrades.reduce((sum: number, t: any) => sum + (t.realizedPnl || 0), 0);
    dailyPnL.push({ date: dateStr, pnl: dayPnL, trades: dayTrades.length });
  }
  
  // Equity curve (cumulative)
  const equityCurve: { date: string; equity: number; pnl: number }[] = [];
  let cumulativeEquity = 10000; // Starting capital assumption
  for (const day of dailyPnL) {
    cumulativeEquity += day.pnl;
    equityCurve.push({ date: day.date, equity: cumulativeEquity, pnl: day.pnl });
  }
  
  // Win/Loss distribution
  const wins = allTrades.filter((t: any) => (t.realizedPnl || 0) > 0).length;
  const losses = allTrades.filter((t: any) => (t.realizedPnl || 0) < 0).length;
  const breakeven = allTrades.filter((t: any) => (t.realizedPnl || 0) === 0).length;
  
  // Trades by symbol
  const symbolMap = new Map<string, { count: number; pnl: number }>();
  for (const trade of allTrades) {
    const existing = symbolMap.get(trade.symbol) || { count: 0, pnl: 0 };
    existing.count++;
    existing.pnl += trade.realizedPnl || 0;
    symbolMap.set(trade.symbol, existing);
  }
  const tradesBySymbol = Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Trades by hour
  const hourMap = new Map<number, { count: number; pnl: number }>();
  for (let i = 0; i < 24; i++) hourMap.set(i, { count: 0, pnl: 0 });
  for (const trade of allTrades) {
    const hour = new Date(trade.closedAt).getHours();
    const existing = hourMap.get(hour)!;
    existing.count++;
    existing.pnl += trade.realizedPnl || 0;
  }
  const tradesByHour = Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, ...data }));
  
  // Monthly performance
  const monthMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const trade of allTrades) {
    const month = new Date(trade.closedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    const existing = monthMap.get(month) || { pnl: 0, trades: 0, wins: 0 };
    existing.pnl += trade.realizedPnl || 0;
    existing.trades++;
    if ((trade.realizedPnl || 0) > 0) existing.wins++;
    monthMap.set(month, existing);
  }
  const monthlyPerformance = Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))
    .slice(-6);
  
  return {
    equityCurve,
    dailyPnL,
    winLossDistribution: { wins, losses, breakeven },
    tradesBySymbol,
    tradesByHour,
    monthlyPerformance,
  };
}

function calculateStreaks(trades: any[]) {
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );
  
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;
  
  for (const trade of sortedTrades) {
    const pnl = trade.realizedPnl || 0;
    if (pnl > 0) {
      tempWinStreak++;
      tempLossStreak = 0;
      if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
    } else if (pnl < 0) {
      tempLossStreak++;
      tempWinStreak = 0;
      if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
    }
  }
  
  // Current streak from the end
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    const pnl = sortedTrades[i].realizedPnl || 0;
    if (pnl > 0 && currentLossStreak === 0) {
      currentWinStreak++;
    } else if (pnl < 0 && currentWinStreak === 0) {
      currentLossStreak++;
    } else {
      break;
    }
  }
  
  // Trading days this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tradingDays = new Set(
    trades
      .filter((t: any) => new Date(t.closedAt) >= startOfMonth)
      .map((t: any) => new Date(t.closedAt).toDateString())
  );
  
  // Consecutive profitable days
  const dayPnLMap = new Map<string, number>();
  for (const trade of trades) {
    const day = new Date(trade.closedAt).toDateString();
    dayPnLMap.set(day, (dayPnLMap.get(day) || 0) + (trade.realizedPnl || 0));
  }
  
  let consecutiveProfitableDays = 0;
  const sortedDays = Array.from(dayPnLMap.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  
  for (const [, pnl] of sortedDays) {
    if (pnl > 0) consecutiveProfitableDays++;
    else break;
  }
  
  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak,
    tradingDaysThisMonth: tradingDays.size,
    consecutiveProfitableDays,
  };
}

