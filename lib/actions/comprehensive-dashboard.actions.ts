"use server";
/* eslint-disable */

import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { getUserFinancialSummary } from "@/lib/services/user-financial-summary.service";
import { computeProfitFactor, computeWinRate } from "@/lib/services/trading-metrics";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import {
  ForexSymbol,
  calculateUnrealizedPnL,
  getQuoteToUsdRate,
  getConversionPairSymbols,
} from "@/lib/services/pnl-calculator.service";
import { getMultipleSymbolConfigs } from "@/lib/services/symbol-config.service";
import { getPlayerGamePerformance } from "@/lib/services/games/player-game-performance.service";
import { getPlayerGameProfile } from "@/lib/services/games/player-game-stats.service";
import { CROSS_GAME_SCORING_STARTED_CAPTION } from "@/lib/services/games/game-leaderboard.service";
import { buildChartData, calculateStreaks } from "./dashboard/charts";
import { processCompetitionParticipations } from "./dashboard/process-competitions";
import { processChallengeParticipations } from "./dashboard/process-challenges";
import type {
  ComprehensiveDashboardData,
  TradeData,
  PositionData,
} from "./dashboard/types";

export type { ComprehensiveDashboardData } from "./dashboard/types";
import { getEnabledGameTypes, TRADING_GAME_TYPE } from "@/lib/games";
import { getUserLevel } from "@/lib/services/xp-level.service";
import {
  calculateXPProgress,
  getTitleLevels,
} from "@/lib/services/xp-config.service";
import { resolveLevelTitle } from "@/lib/utils/level-title";
import { getUserGlobalRank } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import UserBadge from "@/database/models/user-badge.model";
import BadgeConfig from "@/database/models/badge-config.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import UserRestriction from "@/database/models/user-restriction.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import AccountLockout from "@/database/models/account-lockout.model";
import SuspicionScore from "@/database/models/fraud/suspicion-score.model";
import KYCSession from "@/database/models/kyc-session.model";

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
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  await connectToDatabase();

  // Fetch user-scoped data first (no load-all)
  // PERF: .select() on every query to fetch only fields used by dashboard
  // Reason: `score` is the provider-game equivalent of `pnl`. Without it here the card
  // renders every provider contest at zero - the read-side half of R37, one screen along.
  const participantSelect = "competitionId challengeId userId username currentCapital startingCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate averageWin averageLoss currentRank status unrealizedPnl currentOpenPositions prizeWon isWinner prizeReceived createdAt score";
  const tradeSelect = "symbol side entryPrice exitPrice quantity realizedPnl isWinner openedAt closedAt competitionId challengeId";
  // Reason: Challenge model uses challengerName/challengedName (not *Username), entryFee (not stakeAmount), and has no "name" field
  // Reason: Include "rules" to access rules.rankingMethod for correct dashboard metric display
  const challengeSelect = "_id challengerId challengedId status startTime endTime entryFee challengerName challengedName rules";

  // Reason: Charts (win/loss donut, top symbols, by-hour, monthly) and streaks
  // must reflect ALL closed trades — competitions AND challenges — to stay
  // consistent with the Performance rings (which aggregate every trade). The
  // previous single `.limit(100)` query silently undercounted analytics and made
  // the donut total disagree with the rings for anyone past 100 trades.
  // We therefore use a tiny full-field query for the Recent Trades feed and a
  // separate lightweight projection (4 fields) over the full trade history for
  // the analytics — keeping memory small even for very active traders.
  const chartTradeSelect = "symbol realizedPnl closedAt isWinner competitionId";

  // Reason (R21): resolve the trading surface BEFORE TradeHistory / open-position work
  // so a games-only player never pays for forex and full-history trade scans. Fail open
  // to trading so a settings blip does not hide steps traders still need (20 s5).
  const enabledGameTypes = await getEnabledGameTypes().catch(() => [
    TRADING_GAME_TYPE,
  ]);
  const tradingEnabled = enabledGameTypes.includes(TRADING_GAME_TYPE);

  // Reason (R29): disabling trading does not erase earned history. A former trader on a
  // platform that later turns trading off still needs TradeHistory. exists() is one
  // indexed probe and only runs when trading is already off.
  const needsTradeHistory =
    tradingEnabled || Boolean(await TradeHistory.exists({ userId }));

  const noTrades: never[] = [];

  const [
    competitionParticipations,
    challengeParticipations,
    allChallenges,
    recentTradesRaw,
    chartTrades,
    wallet,
    walletTransactions,
  ] = await Promise.all([
    CompetitionParticipant.find({ userId }).select(participantSelect).sort({ createdAt: -1 }).limit(200).lean(),
    ChallengeParticipant.find({ userId }).select(participantSelect).sort({ createdAt: -1 }).limit(200).lean(),
    Challenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
    }).select(challengeSelect).sort({ createdAt: -1 }).limit(100).lean(),
    needsTradeHistory
      ? TradeHistory.find({ userId }).select(tradeSelect).sort({ closedAt: -1 }).limit(20).lean()
      : Promise.resolve(noTrades),
    needsTradeHistory
      ? TradeHistory.find({ userId }).select(chartTradeSelect).sort({ closedAt: -1 }).lean()
      : Promise.resolve(noTrades),
    // Reason: Select all wallet fields needed by dashboard hero stats and charts
    CreditWallet.findOne({ userId }).select("creditBalance totalDeposited totalWithdrawn totalWonFromCompetitions totalWonFromChallenges totalSpentOnCompetitions totalSpentOnChallenges totalSpentOnMarketplace").lean(),
    // Reason: No limit — all transactions needed for accurate dashboard totals.
    // .limit(1000) was silently truncating data for active users.
    WalletTransaction.find({ userId, status: "completed" })
      .select("createdAt balanceAfter amount transactionType")
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  // Reason: R64 player twin + 13 s5 summary cards. Fail soft so a games DB blip
  // cannot blank the whole trading dashboard. Fetched in parallel — neither
  // depends on the other, and both read UserGameStats / game_round only.
  const [gamePerformanceRows, gameStanding] = await Promise.all([
    getPlayerGamePerformance(userId).catch((err) => {
      console.warn("⚠️ gamePerformance fetch failed:", err);
      return [] as Awaited<ReturnType<typeof getPlayerGamePerformance>>;
    }),
    getPlayerGameProfile(userId).catch((err) => {
      console.warn("⚠️ gameStanding fetch failed:", err);
      return {
        overall: null,
        perGame: [],
        startsFromCaption: CROSS_GAME_SCORING_STARTED_CAPTION,
      } as Awaited<ReturnType<typeof getPlayerGameProfile>>;
    }),
  ]);

  // Reason: We need opponent participations for challenge dashboard cards.
  // The query above only fetches the current user's participations, so the opponent's
  // PnL/performance data would never be available. Fetch opponent records separately.
  const userChallengeIds = (allChallenges as any[]).map((c: any) => c._id.toString());
  const opponentParticipations = userChallengeIds.length > 0
    ? await ChallengeParticipant.find({
        challengeId: { $in: userChallengeIds },
        userId: { $ne: userId },
      })
        .select("challengeId userId username pnl pnlPercentage currentCapital startingCapital totalTrades winningTrades losingTrades status isWinner prizeReceived")
        .lean()
    : [];
  // Build a quick lookup: challengeId → opponent participation
  const opponentByChallengeId = new Map(
    (opponentParticipations as any[]).map((p: any) => [p.challengeId?.toString(), p]),
  );

  const userCompIds = [
    ...new Set(
      (competitionParticipations as any[])
        .map((p: any) => p.competitionId)
        .filter(Boolean),
    ),
  ];
  const competitionSelect = "_id name status startTime endTime prizePool prizePoolCredits entryFee entryFeeCredits currentParticipants startingCapital rules prizeDistribution gameType gameKey";
  const allCompetitions =
    userCompIds.length > 0
      ? await Competition.find({ _id: { $in: userCompIds } }).select(competitionSelect).lean()
      : [];

  const { processedCompetitions } = await processCompetitionParticipations({
    userId,
    competitionParticipations: competitionParticipations as any[],
    allCompetitions: allCompetitions as any[],
  });

  const { processedChallenges } = processChallengeParticipations({
    userId,
    allChallenges: allChallenges as any[],
    challengeParticipations: challengeParticipations as any[],
    opponentByChallengeId,
  });

  // Calculate overview stats
  // ONLY count capital from ACTIVE competitions/challenges for "Live Balance"
  const activeCompetitionIdsSet = new Set(
    allCompetitions
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString()),
  );

  const activeChallengeIdsSet = new Set(
    allChallenges
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString()),
  );

  // Filter to only active participations for capital calculation
  const activeCompParticipations = (competitionParticipations as any[]).filter(
    (p: any) => activeCompetitionIdsSet.has(p.competitionId?.toString()),
  );
  const activeChallengeParticipations = (
    challengeParticipations as any[]
  ).filter((p: any) => activeChallengeIdsSet.has(p.challengeId?.toString()));

  // For total stats, use all participations
  const allParticipations = [
    ...competitionParticipations,
    ...challengeParticipations,
  ] as any[];
  // For live capital, use only active participations
  const activeParticipations = [
    ...activeCompParticipations,
    ...activeChallengeParticipations,
  ];

  // Live capital = only from active contests
  let totalCapital = 0;
  for (const p of activeParticipations) {
    totalCapital += p.currentCapital || 0;
  }

  // SINGLE SOURCE OF TRUTH: Get stats from TradeHistory collection
  // This ensures consistency between Dashboard, Profile, and Admin Panel.
  // Reason (R21): skip the aggregate when this player has never traded and trading
  // is off — zeros are the correct overview and the scan is pure cost.
  const [tradeStats] = needsTradeHistory
    ? await TradeHistory.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalTrades: { $sum: 1 },
            winningTrades: {
              $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] },
            },
            // Reason: count ONLY genuine losses (PnL < 0). Breakeven trades
            // (PnL === 0) are excluded here and shown separately in the donut, so
            // losingTrades / avgLoss / winRate are not inflated by breakevens.
            losingTrades: {
              $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] },
            },
            totalPnL: { $sum: "$realizedPnl" },
            grossWins: {
              $sum: {
                $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
              },
            },
            grossLosses: {
              $sum: {
                $cond: [
                  { $lt: ["$realizedPnl", 0] },
                  { $abs: "$realizedPnl" },
                  0,
                ],
              },
            },
            largestWin: {
              $max: {
                $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
              },
            },
            largestLoss: {
              $min: {
                $cond: [{ $lt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
              },
            },
          },
        },
      ])
    : [null];

  const stats = tradeStats || {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    grossWins: 0,
    grossLosses: 0,
    largestWin: 0,
    largestLoss: 0,
  };

  const totalTrades = stats.totalTrades;
  const winningTrades = stats.winningTrades;
  const losingTrades = stats.losingTrades;
  const totalPnL = stats.totalPnL;
  const totalGrossWins = stats.grossWins;
  const totalGrossLosses = stats.grossLosses;
  const largestWin = stats.largestWin || 0;
  const largestLoss = stats.largestLoss || 0;

  // Calculate unrealized PnL from participation records (this is still valid)
  let unrealizedPnL = 0;
  let realizedPnL = stats.totalPnL;
  for (const p of allParticipations) {
    unrealizedPnL += p.unrealizedPnl || 0;
  }

  // Reason: Use the shared getUserFinancialSummary service as SINGLE SOURCE OF TRUTH.
  // This eliminates drift between user dashboard, admin dashboard, and profile pages.
  const walletData = wallet as any;
  const wCreditBalance = walletData?.creditBalance || 0;
  const wTotalDeposited = walletData?.totalDeposited || 0;
  const wTotalWithdrawn = walletData?.totalWithdrawn || 0;

  const financialSummary = await getUserFinancialSummary(userId);
  const wTrueCompWins = financialSummary.competitionWins;
  const wTrueChalWins = financialSummary.challengeWins;
  const wTrueCompSpent = financialSummary.netCompetitionSpent;
  const wTrueChalSpent = financialSummary.netChallengeSpent;
  const wTotalSpentOnMarketplace = financialSummary.marketplaceSpent;
  const totalPrizesWon = financialSummary.totalPrizesWon;
  const wTotalSpent = financialSummary.totalSpent;
  const wNetProfit = financialSummary.netProfit;
  const wROI = financialSummary.roi;
  const wGMEarnings = financialSummary.gmEarnings;

  const winRate = computeWinRate(winningTrades, losingTrades);
  const profitFactor = computeProfitFactor(totalGrossWins, totalGrossLosses);
  const averageWin = winningTrades > 0 ? totalGrossWins / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalGrossLosses / losingTrades : 0;

  // Build chart data including wallet balance history
  const currentWalletBalance = walletData?.creditBalance || 0;
  const charts = await buildChartData(
    userId,
    chartTrades as any[],
    walletTransactions as any[],
    currentWalletBalance,
  );

  // Reason: Trades/positions store the contest id in `competitionId` for BOTH
  // modes (the schema has no `challengeId`). To label a row correctly we check
  // whether that id belongs to one of the user's challenges, otherwise it's a
  // competition. Without this, every challenge trade was mislabeled "Competition".
  const userChallengeIdSet = new Set(userChallengeIds);
  const contestTypeFor = (contestId: unknown): "competition" | "challenge" =>
    userChallengeIdSet.has(String(contestId)) ? "challenge" : "competition";

  // Get recent trades and positions
  const recentTrades: TradeData[] = (recentTradesRaw as any[]).map((t: any) => {
    const type = contestTypeFor(t.competitionId);
    return {
      id: t._id.toString(),
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      pnl: t.realizedPnl || 0,
      pnlPercentage:
        t.entryPrice > 0
          ? ((t.exitPrice - t.entryPrice) / t.entryPrice) *
            100 *
            (t.side === "long" ? 1 : -1)
          : 0,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      contestName: type === "challenge" ? "Challenge" : "Competition",
      contestType: type,
    };
  });

  // Reason (R21): open positions imply trading; skip the collection + forex round-trip
  // when this player has no trade history and trading is off.
  const openPositions = needsTradeHistory
    ? await TradingPosition.find({
        userId,
        status: "open",
      })
        .select(
          "_id symbol side entryPrice quantity marginUsed openedAt competitionId challengeId",
        )
        .lean()
    : [];
  const uniqueSymbols = [
    ...new Set((openPositions as any[]).map((p: any) => p.symbol).filter(Boolean)),
  ] as ForexSymbol[];
  const cdConv = getConversionPairSymbols(uniqueSymbols);
  const cdAll = [...new Set([...uniqueSymbols, ...cdConv])] as ForexSymbol[];
  const pricesMap =
    cdAll.length > 0
      ? await fetchRealForexPrices(cdAll)
      : new Map<ForexSymbol, { bid: number; ask: number }>();
  const symbolCfgMap =
    uniqueSymbols.length > 0
      ? await getMultipleSymbolConfigs(uniqueSymbols)
      : new Map();
  const positionsWithPrices: PositionData[] = (openPositions as any[]).map(
    (pos: any) => {
      const price = pricesMap.get(pos.symbol as ForexSymbol);
      const currentPrice = price
        ? pos.side === "long"
          ? price.bid
          : price.ask
        : pos.entryPrice;
      const cdRate = getQuoteToUsdRate(
        pos.symbol as ForexSymbol,
        pricesMap as Map<string, { bid: number; ask: number }>,
      );
      const symbolCfg = symbolCfgMap.get(pos.symbol)!;
      const unrealizedPnL = calculateUnrealizedPnL(
        pos.side,
        pos.entryPrice,
        currentPrice,
        pos.quantity,
        pos.symbol,
        cdRate,
        symbolCfg,
      );
      return {
        id: pos._id.toString(),
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        currentPrice,
        quantity: pos.quantity,
        unrealizedPnL,
        unrealizedPnLPercentage:
          pos.marginUsed > 0 ? (unrealizedPnL / pos.marginUsed) * 100 : 0,
        openedAt: pos.openedAt,
        contestName:
          contestTypeFor(pos.competitionId) === "challenge"
            ? "Challenge"
            : "Competition",
        contestType: contestTypeFor(pos.competitionId),
      };
    },
  );

  // Calculate streaks
  const streaks = calculateStreaks(chartTrades as any[]);

  // Calculate starting capital for percentage
  const totalStartingCapital = allParticipations.reduce(
    (sum, p) => sum + (p.startingCapital || 10000),
    0,
  );
  const totalPnLPercentage =
    totalStartingCapital > 0 ? (totalPnL / totalStartingCapital) * 100 : 0;

  /*
    Fetch player profile data (XP, badges, rank) in parallel.

    There used to be a fourth member here, `calculateXPProgress(0)`, whose result was
    destructured as `xpProgress` and then read by nothing - the progress figures are
    recomputed below against the player's real XP, which this call cannot know because it
    runs beside the `getUserLevel` that fetches it. Its own comment said so and returned
    the value anyway. It is deleted rather than left: `calculateXPProgress` awaits two
    `XPConfig` reads, so it cost this action two round trips per load to produce a number
    that was thrown away.

    The `getUserLevel` fallback carries only the two fields that are read. `currentLevel`,
    `currentIcon` and `currentColor` were dropped with the same reasoning that closed R88
    on this file - `resolveLevelTitle` reads `currentXP`, so those three were a dead shape
    sitting beside a live one, which is how the next person to fix a dashboard bug ends up
    reading a colour out of the award-time cache because it was right there.
  */
  const [userLevelData, rankData, earnedBadges] = await Promise.all([
    getUserLevel(userId).catch(() => ({ currentXP: 0, totalBadgesEarned: 0 })),
    getUserGlobalRank(userId).catch(() => ({ rank: 0, totalUsers: 0, percentile: 0 })),
    // Reason: Fetch ALL earned badges (no limit) so dashboard can show them with expand/collapse
    UserBadge.find({ userId }).sort({ earnedAt: -1 }).lean().catch(() => []),
  ]);

  /*
    Progress against the ladder, computed from the player's actual XP.

    Only the two progress figures are destructured, which is what keeps the failure shape
    honest: the full return carries a `currentLevel` entry, and a `.catch` supplying one
    has to invent a rung name, an icon and a colour. Those three inventions were the last
    "Novice Trader" literals in this file, and they were unreadable anyway - presentation
    comes from `resolveLevelTitle` below, never from here.
  */
  const { progressPercent, xpToNext } = await calculateXPProgress(
    (userLevelData as any).currentXP || 0
  ).catch(() => ({ progressPercent: 0, xpToNext: 100 }));

  /*
    R88 - the one resolver for what this player's rung is CALLED and how it is drawn.

    `calculateXPProgress` above answers the progress questions (how far to the next rung,
    what percentage) and its `currentLevel` is deliberately not destructured: that entry's
    icon and colour come from the operator's database row, which `resolveLevelTitle`
    refuses on purpose because neither is renameable content - see its header.

    The ladder is read once here rather than once per field. No `.catch` is wrapped round
    it deliberately: `getTitleLevels` already swallows its own failure and returns the code
    ladder, so a `.catch(() => [])` here would be unreachable code reading as though this
    call could reject.
  */
  const levelDisplay = resolveLevelTitle(
    userLevelData as Record<string, unknown> | null,
    await getTitleLevels(),
  );

  // Fetch badge details for earned badges
  const badgeIds = (earnedBadges as any[]).map((b: any) => b.badgeId);
  const badgeConfigs = badgeIds.length > 0
    ? await BadgeConfig.find({ id: { $in: badgeIds }, isActive: true }).lean().catch(() => [])
    : [];
  const badgeConfigMap = new Map((badgeConfigs as any[]).map((b: any) => [b.id, b]));

  const recentBadges = (earnedBadges as any[]).map((ub: any) => {
    const config = badgeConfigMap.get(ub.badgeId);
    return {
      id: ub.badgeId,
      name: config?.name || ub.badgeId,
      icon: config?.icon || "🏅",
      rarity: config?.rarity || "common",
      earnedAt: ub.earnedAt,
    };
  });

  // ── Journey / Milestone data ──────────────────────────────────────────
  let journeyData = {
    currentMapName: "",
    currentMapTheme: "",
    completedMilestones: 0,
    totalMilestones: 0,
    recentMilestones: [] as Array<{
      id: string; name: string; icon: string; xp: number; completedAt: Date;
    }>,
  };
  try {
    const userProgress = await UserJourneyProgress.findOne({ userId })
      .select("completedMilestones currentMapIndex mapId totalMilestonesCompleted")
      .lean();

    if (userProgress) {
      // Fetch current map config
      const mapConfig = await JourneyMapConfig.findOne({ isActive: true, sequenceOrder: (userProgress as any).currentMapIndex || 1 })
        .select("name theme totalMilestones mapId")
        .lean();

      // Count total milestones on current map
      const mapMilestoneCount = mapConfig
        ? await JourneyMilestone.countDocuments({ mapId: (mapConfig as any).mapId, isActive: true })
        : 0;

      // Reason: Send ALL completed milestones (sorted newest first) so the dashboard can show them with expand/collapse
      const completedArr = ((userProgress as any).completedMilestones || []) as Array<{
        milestoneId: string; completedAt: Date; rewards: { xp: number };
      }>;
      const allCompleted = completedArr
        .slice()
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      // Fetch milestone details for all completed ones
      const milestoneIds = allCompleted.map((m) => m.milestoneId);
      const milestoneDetails = milestoneIds.length > 0
        ? await JourneyMilestone.find({ id: { $in: milestoneIds }, isActive: true })
            .select("id name icon rewards")
            .lean()
        : [];
      const milestoneMap = new Map((milestoneDetails as any[]).map((m: any) => [m.id, m]));

      journeyData = {
        currentMapName: (mapConfig as any)?.name || "Map 1",
        currentMapTheme: (mapConfig as any)?.theme || "pirate",
        completedMilestones: completedArr.length,
        totalMilestones: mapMilestoneCount || (mapConfig as any)?.totalMilestones || 0,
        recentMilestones: allCompleted.map((cm) => {
          const detail = milestoneMap.get(cm.milestoneId);
          return {
            id: cm.milestoneId,
            name: detail?.name || cm.milestoneId,
            icon: detail?.icon || "⭐",
            xp: cm.rewards?.xp || detail?.rewards?.xp || 0,
            completedAt: cm.completedAt,
          };
        }),
      };
    }
  } catch (err) {
    // Non-critical — dashboard still works without journey data
    console.warn("⚠️ Failed to fetch journey data for dashboard:", err);
  }

  // ── Account Status: restrictions, fraud alerts, lockouts, KYC, suspicion score ──
  let accountStatusData: ComprehensiveDashboardData["accountStatus"] = {
    restrictions: [],
    fraudAlerts: [],
    lockouts: [],
    kycStatus: "none",
    suspicionScore: 0,
    riskLevel: "low",
    hasActiveRestriction: false,
    hasOpenAlert: false,
    isLocked: false,
  };
  try {
    const [restrictions, alerts, lockouts, kycSession, suspicion] = await Promise.all([
      // Active restrictions for this user
      UserRestriction.find({ userId, isActive: true }).lean().catch(() => []),
      // Open/investigating fraud alerts involving this user
      // Reason: Also check evidence.data.connectedAccountIds because some
      // users may only appear in evidence but not in top-level suspiciousUserIds.
      // Reason: Select evidence.data.connectedAccountIds and
      // evidence.data.accountsDetails.userId so we can filter evidence
      // to only show types where THIS user is specifically involved.
      FraudAlert.find({
        $or: [
          { primaryUserId: userId },
          { suspiciousUserIds: userId },
          { "evidence.data.connectedAccountIds": userId },
        ],
        status: { $in: ["pending", "investigating"] },
      })
        .select("alertType severity status title description confidence detectedAt evidence.type evidence.data.connectedAccountIds evidence.data.accountsDetails.userId")
        .sort({ detectedAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      // Active account lockouts
      AccountLockout.find({
        $and: [
          { $or: [{ userId }, { email: session.user.email }] },
          { isActive: true },
          { $or: [{ lockedUntil: { $gt: new Date() } }, { lockedUntil: null }] },
        ],
      })
        .lean()
        .catch(() => []),
      // Latest KYC session
      KYCSession.findOne({ userId })
        .sort({ createdAt: -1 })
        .select("status verificationReason")
        .lean()
        .catch(() => null),
      // Suspicion score
      SuspicionScore.findOne({ userId })
        .select("totalScore riskLevel")
        .lean()
        .catch(() => null),
    ]);

    // Map KYC status
    let kycStatus: ComprehensiveDashboardData["accountStatus"]["kycStatus"] = "none";
    let kycDeclineReason: string | undefined;
    if (kycSession) {
      const s = (kycSession as any).status;
      if (s === "approved") kycStatus = "approved";
      else if (s === "declined") { kycStatus = "declined"; kycDeclineReason = (kycSession as any).verificationReason; }
      else if (s === "resubmission_requested") kycStatus = "resubmission";
      else if (["created", "started", "submitted"].includes(s)) kycStatus = "pending";
    }

    accountStatusData = {
      restrictions: (restrictions as any[]).map((r) => ({
        id: r._id.toString(),
        type: r.restrictionType,
        reason: r.reason,
        customReason: r.customReason,
        canTrade: r.canTrade,
        canEnterCompetitions: r.canEnterCompetitions,
        canDeposit: r.canDeposit,
        canWithdraw: r.canWithdraw,
        restrictedAt: r.restrictedAt,
        expiresAt: r.expiresAt,
      })),
      fraudAlerts: (alerts as any[]).map((a) => ({
        id: a._id.toString(),
        alertType: a.alertType,
        severity: a.severity,
        status: a.status,
        title: a.title,
        description: a.description,
        confidence: a.confidence,
        detectedAt: a.detectedAt,
        // Reason: Only include evidence types where THIS specific user
        // is actually involved — not all evidence from the alert.
        // Each evidence item stores which users are connected via
        // data.connectedAccountIds or data.accountsDetails[].userId.
        evidenceTypes: [
          ...new Set<string>(
            (a.evidence || [])
              .filter((ev: { type: string; data?: { connectedAccountIds?: string[]; accountsDetails?: Array<{ userId: string }> } }) => {
                const connectedIds = ev.data?.connectedAccountIds;
                const accountDetails = ev.data?.accountsDetails;
                // If evidence has connectedAccountIds, check if this user is listed
                if (connectedIds && connectedIds.length > 0) {
                  return connectedIds.some((id: string) => id.toString() === userId);
                }
                // If evidence has accountsDetails (device fingerprint), check userId
                if (accountDetails && accountDetails.length > 0) {
                  return accountDetails.some((acc: { userId: string }) => acc.userId?.toString() === userId);
                }
                // Reason: If neither field exists (legacy evidence or minimal data),
                // include it conservatively — the user is already in suspiciousUserIds.
                return true;
              })
              .map((ev: { type: string }) => ev.type),
          ),
        ],
      })),
      lockouts: (lockouts as any[]).map((l) => ({
        id: l._id.toString(),
        reason: l.reason,
        lockedAt: l.lockedAt,
        lockedUntil: l.lockedUntil,
      })),
      kycStatus,
      kycDeclineReason,
      suspicionScore: (suspicion as any)?.totalScore || 0,
      riskLevel: (suspicion as any)?.riskLevel || "low",
      hasActiveRestriction: (restrictions as any[]).length > 0,
      hasOpenAlert: (alerts as any[]).length > 0,
      isLocked: (lockouts as any[]).length > 0,
      openChargebackCaseId: null,
    };
  } catch (err) {
    // Non-critical — dashboard still works without account status data
    console.warn("⚠️ Failed to fetch account status for dashboard:", err);
  }

  // Chargeback case lookup: a separate lean find keeps the main account-status
  // block backward-compatible. If this fails, the dashboard still renders the
  // generic payment_fraud restriction copy.
  try {
    const { default: Chargeback } = await import(
      "@/database/models/chargeback.model"
    );
    const openCase = await Chargeback.findOne({
      userId,
      status: { $in: ["pending_review", "initiated", "represented"] },
    })
      .select("_id status")
      .sort({ createdAt: -1 })
      .lean();
    if (openCase && (openCase as any)._id) {
      accountStatusData.openChargebackCaseId = String((openCase as any)._id);
    }
  } catch (err) {
    console.warn("⚠️ Failed to check open chargeback case:", err);
  }

  return {
    user: {
      id: userId,
      name: session.user.name || "Trader",
      email: session.user.email || "",
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
      activeContests:
        processedCompetitions.active.length + processedChallenges.active.length,
      totalPrizesWon,
      // Wallet stats for hero bar
      creditBalance: wCreditBalance,
      totalDeposited: wTotalDeposited,
      totalSpent: wTotalSpent,
      totalWithdrawn: wTotalWithdrawn,
      roi: wROI,
      gmEarnings: wGMEarnings,
    },
    competitions: {
      ...processedCompetitions,
      stats: {
        ...processedCompetitions.stats,
        totalCreditsWon: wTrueCompWins,
        activeCount: processedCompetitions.active.length,
      },
    },
    challenges: {
      ...processedChallenges,
      stats: {
        ...processedChallenges.stats,
        totalCreditsWon: wTrueChalWins,
      },
    },
    charts: {
      ...charts,
      // Reason: All-time totals from getUserFinancialSummary() — SSOT.
      // Chart range only covers 30 days; summary chips need all-time values.
      allTimeTotals: {
        deposits: wTotalDeposited,
        wins: financialSummary.totalPrizesWon,
        entries: financialSummary.netCompetitionSpent + financialSummary.netChallengeSpent,
        withdrawals: wTotalWithdrawn,
        marketplace: financialSummary.marketplaceSpent,
        gmEarnings: financialSummary.gmEarnings,
        refunds: financialSummary.competitionRefunds + financialSummary.challengeRefunds,
      },
    },
    recentActivity: {
      trades: recentTrades,
      positions: positionsWithPrices,
    },
    streaks,
    player: {
      // Reason: the OPERATOR'S ladder is authoritative. The stored `currentTitle` and
      // `currentLevel` are a cache written at XP-award time and are stale from the
      // instant the ladder changes (R88) - taking them here is what made the dashboard
      // disagree with the profile. All four fields below come from the one resolver so
      // they cannot disagree with each other either.
      level: levelDisplay.level,
      currentXP: (userLevelData as any).currentXP || 0,
      xpToNextLevel: xpToNext,
      progressPercent,
      title: levelDisplay.title,
      // Reason: a rung's name, colour and icon are one fact and must come from one place.
      // These two read the award-time cache until 15 Sep 2026, so this object named the
      // new rung in the operator's ladder while painting it in the old one's colour -
      // R88 surviving on the very site the rest of R88 had just been fixed on.
      //
      // They deliberately do NOT read `actualXPProgress.currentLevel.color`/`.icon`,
      // which is the obvious repair and is wrong: that entry comes from the DATABASE
      // ladder, and `resolveLevelTitle` exists partly to refuse it. `GameIconName` is a
      // union of committed SVG assets and the colour is a Tailwind class that has to be
      // in the compiled stylesheet, so an operator-typed value for either draws nothing
      // while reviewing as correct - pinned by "takes the icon and colour from the code
      // ladder, never the operator's entry" in `level-ladder-rename.test.ts`.
      //
      // The old `|| "⚔️"` was an emoji standing in for a `GameIconName`, and
      // `components/ui/GameIcon.tsx` does not render an unknown name as text the way the
      // admin copy does - it substitutes `starBadge`, so that fallback silently drew a
      // generic badge rather than the sword it appears to promise.
      titleColor: levelDisplay.color,
      titleIcon: levelDisplay.icon,
      globalRank: rankData.rank,
      totalUsers: rankData.totalUsers,
      recentBadges,
      totalBadges: (userLevelData as any).totalBadgesEarned || 0,
    },
    journey: journeyData,
    accountStatus: accountStatusData,
    gamePerformance: gamePerformanceRows.map((row) => ({
      gameKey: row.gameKey,
      title: row.title,
      providerName: row.providerName,
      category: row.category
        ? {
            slug: row.category.slug,
            label: row.category.label,
            isKnown: row.category.isKnown,
          }
        : undefined,
      inCatalogue: row.inCatalogue,
      rounds: row.rounds,
      competitions: row.competitions,
      challenges: row.challenges,
      bestScore: row.bestScore,
      scoreUnit: row.scoreUnit,
      scoreDirection: row.scoreDirection,
      averagePlaySeconds: row.averagePlaySeconds,
      lastPlayedAt: row.lastPlayedAt,
      bestRoundBreakdown: row.bestRoundBreakdown,
    })),
    gameStanding,
    tradingEnabled,
  };
}
