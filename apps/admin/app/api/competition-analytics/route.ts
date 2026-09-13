import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";
import { getUserById } from "@/lib/utils/user-lookup";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * How far back the screen looks. **Exported and reported to the client on purpose.**
 *
 * Every headline figure on `CompetitionAnalytics` is a reduction over this list, so the limit is
 * not a pagination detail - it is the scope of every number on the screen, and it used to be
 * invisible. `resolveScopeNote` turns it into a sentence. See
 * `lib/admin/contest-analytics-presentation.ts` for why the window was labelled rather than
 * widened.
 */
const CONTEST_LIMIT = 50;

/**
 * The game label as it sits on a contest document, narrowed to what the analytics screen reads.
 *
 * Declared rather than reached for with `as any` - the rest of this file predates the game work
 * and is full of them, and adding more would make the one place a field name could be invented
 * indistinguishable from the places where the cast is load-bearing. An **explicitly-typed lean
 * read is a place a field that does not exist looks real** (the R33 lesson), so these three are
 * checked against the schema: `gameType`, `gameKey`, `providerKey` and `gameCode` are all
 * declared on `competition.model.ts`.
 */
interface GameLabelled {
  gameType?: string | null;
  gameKey?: string | null;
  /**
   * The provider key and game code live INSIDE `gameConfig`, not beside `gameKey`.
   *
   * Checked against `competition.model.ts` rather than assumed, for the reason R33 records: an
   * explicitly-typed `.lean()` read is checked against the hand-written generic and never
   * against the schema, so a plausible-looking flat `providerKey` would have compiled, returned
   * `undefined` for every contest, and shown every provider game as having no provider.
   */
  gameConfig?: {
    providerKey?: string | null;
    gameCode?: string | null;
  } | null;
}

interface CatalogueTitle {
  gameKey: string;
  displayName?: string | null;
}

interface CatalogueProvider {
  providerKey: string;
  displayName?: string | null;
}

/**
 * The `PlatformTransaction` fields this screen reads.
 *
 * Reason it is declared rather than cast away: `sourceId` is compared against a stringified
 * `_id`, and a `Types.ObjectId` here would compare unequal to a `string` on every row while
 * `=== ` reports no error at all - the screen would simply show every platform fee as zero.
 * Naming the field's type is what makes the string conversion beside it obviously necessary.
 */
interface LedgerRow {
  sourceId?: string | null;
  amount?: number | null;
  metadata?: { competitionId?: string | null } | null;
}

/**
 * The `finalLeaderboard` entry fields this screen reads.
 *
 * `pnl` and `score` are both optional and neither is defaulted - that is R46, and the reason is
 * recorded at each use below rather than here.
 */
interface LeaderboardRow {
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  qualificationStatus?: string | null;
  disqualificationReason?: string | null;
  pnl?: number;
  score?: number;
}

/** The `CompetitionParticipant` fields this screen reads. */
interface SeatRow {
  userId?: string | null;
  username?: string | null;
  status?: string | null;
  disqualificationReason?: string | null;
  pnl?: number;
  score?: number;
  competitionId?: unknown;
}

export async function GET() {
  // Reason `guardSection` rather than the local token check this route used to carry: a decoded
  // `admin_token` proves the caller is an admin, not that they hold the `analytics` grant. An
  // employee granted one unrelated section could read every competition's revenue, prize
  // payments and named winners. Seventh instance of that class after Prerequisite A, the
  // internal-secret fallbacks, the unprotected suspicion-score route, the provider admin
  // routes, the competition update route and the lifecycle controls (R40).
  const guard = await guardSection("analytics");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    // Get all competitions (completed AND cancelled)
    const competitions = await Competition.find({
      status: { $in: ["completed", "cancelled"] },
    })
      .sort({ endTime: -1 })
      .limit(CONTEST_LIMIT)
      .lean();

    const competitionIds = competitions.map((c) => c._id);

    // Get all wallet transactions for these competitions
    const [winTransactions, entryTransactions, refundTransactions] =
      await Promise.all([
        WalletTransaction.find({
          transactionType: "competition_win",
          competitionId: { $in: competitionIds },
          status: "completed",
        }).lean(),
        WalletTransaction.find({
          transactionType: "competition_entry",
          competitionId: { $in: competitionIds },
          status: "completed",
        }).lean(),
        WalletTransaction.find({
          transactionType: "competition_refund",
          competitionId: { $in: competitionIds },
          status: "completed",
        }).lean(),
      ]);

    // Get platform fees from PlatformTransaction (not WalletTransaction)
    // Platform fees for competitions are stored in PlatformTransaction with sourceType: 'competition'
    const competitionIdStrings = competitionIds.map((id) => String(id));

    const [platformFeeTransactions, unclaimedPools] = await Promise.all([
      PlatformTransaction.find({
        transactionType: "platform_fee",
        sourceType: "competition",
        sourceId: { $in: competitionIdStrings },
      }).lean(),
      PlatformTransaction.find({
        transactionType: "unclaimed_pool",
        $or: [
          { sourceId: { $in: competitionIdStrings } },
          { "metadata.competitionId": { $in: competitionIdStrings } },
        ],
      }).lean(),
    ]);

    // Get participants with status info
    const participants = await CompetitionParticipant.find({
      competitionId: { $in: competitionIds },
    }).lean();

    // Get conversion settings
    const conversionSettings = await CreditConversionSettings.getSingleton();

    // The catalogue names for whichever provider titles these contests belong to.
    //
    // Reason it is looked up rather than read off the contest: a contest stores `providerKey`
    // and `gameCode`, which are identifiers, not names. An operator comparing revenue between
    // games needs "Circuit Sprint", and a screen showing `provider:chartvolt:circuit-sprint`
    // in a revenue table is one nobody reads twice.
    //
    // Reason it is keyed on `gameKey` and not on the name: `gameKey` is immutable and is what
    // every historical figure joins on, so the name is presentation only. A title renamed or
    // retired keeps its row (R29) - which is why the presentation module falls back to the code
    // and then the key rather than to "Unknown".
    const providerGameKeys = [
      ...new Set(
        (competitions as GameLabelled[])
          .filter((comp) => comp.gameType === "provider")
          .map((comp) => comp.gameKey)
          .filter((key): key is string => typeof key === "string" && key.length > 0),
      ),
    ];

    const [providerTitles, providers] = await Promise.all([
      providerGameKeys.length > 0
        ? ProviderGame.find({ gameKey: { $in: providerGameKeys } })
            .select("gameKey displayName providerKey")
            .lean()
        : Promise.resolve([]),
      providerGameKeys.length > 0
        ? GameProvider.find().select("providerKey displayName").lean()
        : Promise.resolve([]),
    ]);

    const titleNameByKey = new Map(
      (providerTitles as CatalogueTitle[]).map((title) => [
        title.gameKey,
        title.displayName,
      ]),
    );
    const providerNameByKey = new Map(
      (providers as CatalogueProvider[]).map((provider) => [
        provider.providerKey,
        provider.displayName,
      ]),
    );

    // Build detailed competition analytics
    const competitionAnalytics = await Promise.all(
      competitions.map(async (comp) => {
        const compId = String(comp._id);

        // Get transactions for this competition
        const compWins = winTransactions.filter(
          (t) => t.competitionId?.toString() === compId,
        );
        const compEntries = entryTransactions.filter(
          (t) => t.competitionId?.toString() === compId,
        );
        const compRefunds = refundTransactions.filter(
          (t) => t.competitionId?.toString() === compId,
        );
        // Platform fees are stored in PlatformTransaction with sourceId = competitionId
        const compPlatformFee = (
          platformFeeTransactions as unknown as LedgerRow[]
        ).find((t) => t.sourceId === compId);
        const compUnclaimedPool = (
          unclaimedPools as unknown as LedgerRow[]
        ).find(
          (t) =>
            t.sourceId === compId || t.metadata?.competitionId === compId,
        );
        const compParticipants = (
          participants as unknown as SeatRow[]
        ).filter((p) => String(p.competitionId ?? "") === compId);

        // The stored payout snapshot, or an empty list when prizes have not been paid.
        //
        // Reason it is resolved once here: it is read twice below - to decide who was
        // disqualified, and to describe them - and the two reads disagreeing about whether the
        // snapshot exists is exactly how a disqualified player ends up counted but unexplained.
        const finalRows = (comp.finalLeaderboard ??
          []) as unknown as LeaderboardRow[];

        // Calculate totals
        const totalWinnersPaid = compWins.reduce(
          (sum, t) => sum + Math.abs(t.amount || 0),
          0,
        );
        const _totalEntryFees = compEntries.reduce(
          (sum, t) => sum + Math.abs(t.amount || 0),
          0,
        );
        const totalRefunds = compRefunds.reduce(
          (sum, t) => sum + Math.abs(t.amount || 0),
          0,
        );
        const platformFeeFromTransactions = compPlatformFee?.amount || 0;
        const unclaimedPoolAmount = compUnclaimedPool?.amount || 0;

        // Calculate platform fee earned
        const prizePool = comp.prizePool || 0;
        const participantsCount = comp.currentParticipants || 0;
        const entryFee = comp.entryFee || 0;
        const platformFeePercentage = comp.platformFeePercentage || 0;

        // Calculate expected platform fee from competition settings
        const totalCollected = participantsCount * entryFee;
        const expectedPlatformFee =
          totalCollected * (platformFeePercentage / 100);

        // Use actual transactions if available
        let platformFeeEarned = platformFeeFromTransactions;

        // Reason this flag is reported to the screen: everything below this line INFERS a fee
        // when no `platform_fee` ledger row was found, and an inferred figure is
        // indistinguishable on screen from a recorded one. It has always been that way and the
        // arithmetic is deliberately left alone - changing what the platform reports it earned
        // is not a change to make in the same edit as a labelling fix. But an operator
        // reconciling the screen against the ledger has to be told which rows will not
        // reconcile, or the screen quietly teaches them that the ledger is wrong.
        let platformFeeEstimated = false;

        // If no transaction found, calculate the platform fee from settings
        if (
          platformFeeEarned === 0 &&
          comp.status === "completed" &&
          totalCollected > 0
        ) {
          platformFeeEstimated = true;
          // Method 1: Use the expected fee percentage
          platformFeeEarned = expectedPlatformFee;

          // Method 2: Calculate from what's left over (totalCollected - prizePool - totalWinnersPaid)
          // If prize pool was never properly distributed, use this
          const actualRemainder = totalCollected - totalWinnersPaid;
          if (actualRemainder > 0 && actualRemainder !== platformFeeEarned) {
            // Use the larger of expected fee or actual remainder
            // This handles cases where some winners didn't get paid (disqualified)
            platformFeeEarned = Math.max(
              expectedPlatformFee,
              actualRemainder - unclaimedPoolAmount,
            );
          }
        }

        // For cancelled competitions, fee earned is 0 (all refunded)
        if (comp.status === "cancelled") {
          platformFeeEarned = 0;
        }

        // Ensure non-negative
        if (platformFeeEarned < 0) platformFeeEarned = 0;

        // Count disqualified participants
        const disqualifiedParticipants = compParticipants.filter(
          (p) =>
            p.status === "disqualified" ||
            finalRows.some(
              (l) =>
                String(l.userId ?? "") === String(p.userId ?? "") &&
                l.qualificationStatus === "disqualified",
            ),
        );

        // Get disqualification details from leaderboard or participants
        let disqualifiedDetails: {
          userId: string;
          displayName: string;
          reason: string;
          finalPnl?: number;
          finalScore?: number;
        }[] = [];

        // Try to get from finalLeaderboard first
        if (finalRows.length > 0) {
          disqualifiedDetails = finalRows
            .filter((l) => l.qualificationStatus === "disqualified")
            .map((l) => ({
              userId: l.userId || "",
              displayName: l.displayName || l.username || "Unknown",
              reason:
                l.disqualificationReason || "Did not meet minimum requirements",
              // Reason both are passed through and neither is defaulted: `pnl` is a trading
              // fact and `score` is a provider one, and `|| 0` on either turns "this game has
              // no such measure" into "we measured zero". That substitution is R46, and the
              // presentation module decides which to render.
              finalPnl: l.pnl,
              finalScore: l.score,
            }));
        }

        // If no leaderboard data, get from participants
        if (
          disqualifiedDetails.length === 0 &&
          disqualifiedParticipants.length > 0
        ) {
          disqualifiedDetails = disqualifiedParticipants.map((p) => ({
            userId: p.userId || "",
            displayName: p.username || "Unknown",
            reason:
              p.disqualificationReason || "Did not meet minimum requirements",
            // Reason `pnl` is NOT defaulted here even though the seat declares it with a
            // default of 0: on a provider seat that stored zero is the schema's, not a
            // measurement, and it is exactly what made every provider row on the contest view
            // screen read `+0.00`. The presentation module reads `score` for those.
            finalPnl: p.pnl,
            finalScore: p.score,
          }));
        }

        // Build winner details
        const winners = await Promise.all(
          compWins.map(async (t) => {
            let displayName = "Unknown";
            try {
              const user = await getUserById(t.userId);
              displayName =
                user?.name ||
                user?.email?.split("@")[0] ||
                t.userId.substring(0, 8);
            } catch {
              displayName = t.userId.substring(0, 8);
            }

            return {
              userId: t.userId,
              displayName,
              amount: Math.abs(t.amount),
              rank: t.metadata?.rank || 0,
              // Reason `percentage` is gone rather than defaulted: NOTHING has ever written it.
              // `buildWinMetadata` in both copies of `prize-payout.service.ts` writes `rank`,
              // `isTied`, the qualification snapshot and then whichever of `finalPnl`,
              // `finalCapital` and `finalScore` apply - never a percentage. So the screen's
              // "Prize %" column has read `0%` against every winner of every competition ever
              // settled, for every game. The share of the pool is derived on the client from
              // the amount and the pool, which is both a real figure and a better one: after
              // ties and redistribution the share actually paid at a rank is routinely not the
              // share configured for it (R45).
              //
              // Both performance facts are passed through undefaulted for the same reason as
              // the disqualified rows above.
              finalPnl: t.metadata?.finalPnl,
              finalScore: t.metadata?.finalScore,
            };
          }),
        );

        // Get refund details for cancelled competitions
        const refundDetails = await Promise.all(
          compRefunds.map(async (t) => {
            let displayName = "Unknown";
            try {
              const user = await getUserById(t.userId);
              displayName =
                user?.name ||
                user?.email?.split("@")[0] ||
                t.userId.substring(0, 8);
            } catch {
              displayName = t.userId.substring(0, 8);
            }

            return {
              userId: t.userId,
              displayName,
              amount: Math.abs(t.amount),
              description: t.description,
              date: t.createdAt,
            };
          }),
        );

        const label = comp as GameLabelled;

        return {
          _id: comp._id,
          name: comp.name,
          status: comp.status,
          cancellationReason: comp.cancellationReason,
          startTime: comp.startTime,
          endTime: comp.endTime,
          entryFee,
          participants: participantsCount,
          prizePool,
          platformFeePercentage,
          // The game this contest belongs to. Absent on every contest created before X1, which
          // is why the presentation module resolves an absent label to trading rather than
          // filtering it out - `.lean()` skips hydration, so the schema default never fills in.
          gameType: label.gameType,
          gameKey: label.gameKey,
          providerKey: label.gameConfig?.providerKey ?? null,
          gameCode: label.gameConfig?.gameCode ?? null,
          gameDisplayName: label.gameKey
            ? titleNameByKey.get(label.gameKey) ?? null
            : null,
          providerDisplayName: label.gameConfig?.providerKey
            ? providerNameByKey.get(label.gameConfig.providerKey) ?? null
            : null,
          // Creator info
          gameMasterId: comp.gameMasterId || null,
          gameMasterName: comp.gameMasterName || null,
          createdByAdmin: !comp.gameMasterId,
          // Financial breakdown
          totalCollected, // Total entry fees collected
          platformFeeEarned, // What platform actually kept
          platformFeeEstimated, // ...or, when this is true, what we think it kept
          expectedPlatformFee, // What platform was supposed to earn
          totalWinnersPaid, // Total prizes distributed
          totalRefunds, // Total refunds (for cancelled)
          unclaimedPool: unclaimedPoolAmount, // From disqualified users
          // Counts
          winnersCount: compWins.length,
          disqualifiedCount: disqualifiedParticipants.length,
          refundsCount: compRefunds.length,
          // Details
          winners,
          disqualifiedDetails,
          refundDetails,
          leaderboard: comp.finalLeaderboard || [],
        };
      }),
    );

    // Calculate overall statistics
    const completedComps = competitionAnalytics.filter(
      (c) => c.status === "completed",
    );
    const cancelledComps = competitionAnalytics.filter(
      (c) => c.status === "cancelled",
    );

    const totalPrizePools = completedComps.reduce(
      (sum, c) => sum + c.prizePool,
      0,
    );
    const totalPlatformFees = completedComps.reduce(
      (sum, c) => sum + c.platformFeeEarned,
      0,
    );
    const totalWinnersPaid = completedComps.reduce(
      (sum, c) => sum + c.totalWinnersPaid,
      0,
    );
    const totalRefunds = cancelledComps.reduce(
      (sum, c) => sum + c.totalRefunds,
      0,
    );
    const totalUnclaimedPools = completedComps.reduce(
      (sum, c) => sum + (c.unclaimedPool || 0),
      0,
    );
    const totalParticipants = competitionAnalytics.reduce(
      (sum, c) => sum + c.participants,
      0,
    );
    const totalDisqualified = competitionAnalytics.reduce(
      (sum, c) => sum + c.disqualifiedCount,
      0,
    );
    const totalCompetitions = competitionAnalytics.length;

    // Reason: Breakdown of admin vs GM created competitions for financial clarity
    const adminComps = completedComps.filter((c) => c.createdByAdmin);
    const gmComps = completedComps.filter((c) => !c.createdByAdmin);
    const adminCompFees = adminComps.reduce(
      (sum, c) => sum + c.platformFeeEarned,
      0,
    );
    const gmCompFees = gmComps.reduce(
      (sum, c) => sum + c.platformFeeEarned,
      0,
    );

    // ========== 1v1 CHALLENGE ANALYTICS ==========
    const challenges = await Challenge.find({
      status: { $in: ["completed", "declined", "expired"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const challengeIds = challenges.map((c) => String(c._id));

    // Get challenge-related wallet transactions
    const [challengeWinTransactions, challengeEntryTransactions] =
      await Promise.all([
        WalletTransaction.find({
          transactionType: "challenge_win",
          challengeId: { $in: challengeIds },
          status: "completed",
        }).lean(),
        WalletTransaction.find({
          transactionType: "challenge_entry",
          challengeId: { $in: challengeIds },
          status: "completed",
        }).lean(),
      ]);

    // Get challenge platform fees from PlatformTransaction
    const challengePlatformFees = await PlatformTransaction.find({
      transactionType: "challenge_platform_fee",
      sourceId: { $in: challengeIds },
    }).lean();

    // Get unclaimed pools from challenges (both disqualified)
    const challengeUnclaimedPools = await PlatformTransaction.find({
      transactionType: "unclaimed_pool",
      sourceType: "challenge",
      sourceId: { $in: challengeIds },
    }).lean();

    // Build challenge analytics
    const challengeAnalytics = challenges.map((challenge) => {
      const chalId = String(challenge._id);
      const _wins = challengeWinTransactions.filter(
        (t) => t.challengeId === chalId,
      );
      const _entries = challengeEntryTransactions.filter(
        (t) => t.challengeId === chalId,
      );
      const platformFee = (
        challengePlatformFees as unknown as LedgerRow[]
      ).find((t) => t.sourceId === chalId);
      const unclaimedPool = (
        challengeUnclaimedPools as unknown as LedgerRow[]
      ).find((t) => t.sourceId === chalId);

      // Check if both players were disqualified
      const challengerDisqualified =
        challenge.challengerFinalStats?.isDisqualified;
      const challengedDisqualified =
        challenge.challengedFinalStats?.isDisqualified;
      const bothDisqualified = challengerDisqualified && challengedDisqualified;

      return {
        _id: challenge._id,
        status: challenge.status,
        challengerName: challenge.challengerName,
        challengedName: challenge.challengedName,
        entryFee: challenge.entryFee,
        prizePool: challenge.prizePool,
        platformFeeAmount:
          challenge.platformFeeAmount || platformFee?.amount || 0,
        winnerPrize: challenge.winnerPrize,
        duration: challenge.duration,
        winnerId: challenge.winnerId,
        winnerName: challenge.winnerName,
        winnerPnL: challenge.winnerPnL,
        loserId: challenge.loserId,
        loserName: challenge.loserName,
        loserPnL: challenge.loserPnL,
        isTie: challenge.isTie,
        bothDisqualified,
        unclaimedPool: bothDisqualified
          ? unclaimedPool?.amount || challenge.winnerPrize || 0
          : 0,
        createdAt: challenge.createdAt,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        challengerStats: challenge.challengerFinalStats,
        challengedStats: challenge.challengedFinalStats,
      };
    });

    // Calculate challenge overall statistics
    const completedChallenges = challengeAnalytics.filter(
      (c) => c.status === "completed",
    );
    const declinedChallenges = challengeAnalytics.filter(
      (c) => c.status === "declined",
    );
    const expiredChallenges = challengeAnalytics.filter(
      (c) => c.status === "expired",
    );
    const tieChallenges = completedChallenges.filter((c) => c.isTie);
    const bothDisqualifiedChallenges = completedChallenges.filter(
      (c) => c.bothDisqualified,
    );

    const totalChallengePrizePools = completedChallenges.reduce(
      (sum, c) => sum + (c.prizePool || 0),
      0,
    );
    const totalChallengePlatformFees = completedChallenges.reduce(
      (sum, c) => sum + (c.platformFeeAmount || 0),
      0,
    );
    const totalChallengeWinnersPaid = completedChallenges
      .filter((c) => !c.bothDisqualified)
      .reduce((sum, c) => sum + (c.winnerPrize || 0), 0);
    const totalChallengeUnclaimedPools = completedChallenges.reduce(
      (sum, c) => sum + (c.unclaimedPool || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        competitions: competitionAnalytics,
        overallStats: {
          totalCompetitions,
          completedCompetitions: completedComps.length,
          cancelledCompetitions: cancelledComps.length,
          totalParticipants,
          totalPrizePools,
          totalPlatformFees,
          totalWinnersPaid,
          totalRefunds,
          totalUnclaimedPools,
          totalDisqualified,
          averageParticipantsPerComp:
            totalCompetitions > 0 ? totalParticipants / totalCompetitions : 0,
          averagePrizePool:
            completedComps.length > 0
              ? totalPrizePools / completedComps.length
              : 0,
          // Admin vs GM breakdown
          adminCompetitionCount: adminComps.length,
          gmCompetitionCount: gmComps.length,
          adminCompetitionFees: adminCompFees,
          gmCompetitionFees: gmCompFees,
        },
        // 1v1 Challenge data
        challenges: challengeAnalytics,
        challengeStats: {
          totalChallenges: challenges.length,
          completedChallenges: completedChallenges.length,
          declinedChallenges: declinedChallenges.length,
          expiredChallenges: expiredChallenges.length,
          tieChallenges: tieChallenges.length,
          bothDisqualifiedChallenges: bothDisqualifiedChallenges.length,
          totalChallengePrizePools,
          totalChallengePlatformFees,
          totalChallengeWinnersPaid,
          totalChallengeUnclaimedPools, // From both-disqualified challenges
          averageChallengeEntryFee:
            completedChallenges.length > 0
              ? completedChallenges.reduce(
                  (sum, c) => sum + (c.entryFee || 0),
                  0,
                ) / completedChallenges.length
              : 0,
        },
        conversionRate: conversionSettings.eurToCreditsRate,
        // Reason the limit is returned rather than hard-coded in the component: the client has
        // to be able to say whether the totals are all of history or a window, and it cannot
        // know that from the row count alone - 50 rows could be everything there is.
        contestLimit: CONTEST_LIMIT,
      },
    });
  } catch (error) {
    console.error("Error fetching competition analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch competition analytics" },
      { status: 500 },
    );
  }
}
