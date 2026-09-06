import { ArrowLeft, BarChart3, Trophy } from "lucide-react";
import {
  calculateCompetitionDifficulty,
  DifficultyLevel,
} from "@/lib/utils/competition-difficulty";
import {
  getCompetitionById,
  getCompetitionLeaderboard,
  isUserInCompetition,
  getUserParticipant,
} from "@/lib/actions/trading/competition.actions";
import { getWalletBalance } from "@/lib/actions/trading/wallet.actions";
import { getTradingRiskSettings } from "@/lib/actions/trading/risk-settings.actions";
import CompetitionLeaderboard from "@/components/trading/CompetitionLeaderboard";
import CompetitionDashboard from "@/components/trading/CompetitionDashboard";
import CompetitionStatusMonitor from "@/components/trading/CompetitionStatusMonitor";
import UTCClock from "@/components/trading/UTCClock";
import TradingLobbyHero from "@/components/trading/lobby/TradingLobbyHero";
import TradingLobbySidebar from "@/components/trading/lobby/TradingLobbySidebar";
import { NeonCountPill, NeonPanel } from "@/components/neon/Cards";
import { NeonPill } from "@/components/neon/Buttons";
import ProviderContestLobby from "@/components/games/ProviderContestLobby";
import { hasProviderGameLabel } from "@/lib/services/games/contest-config";
import { isRegistrationClosed } from "@/lib/utils/registration-deadline";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import AppSettingsModel from "@/database/models/app-settings.model";

interface CompetitionDetailsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const CompetitionDetailsPage = async ({
  params,
  searchParams,
}: CompetitionDetailsPageProps) => {
  // CRITICAL: Disable cache to always show fresh competition data
  noStore();

  const { id } = await params;
  const query = await searchParams;

  // Get session for user identification
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || "";

  try {
    // PERF: Fetch independent data in parallel instead of sequentially
    const [competition, leaderboard, isUserIn, walletBalance, riskSettings, appSettings] =
      await Promise.all([
        getCompetitionById(id),
        getCompetitionLeaderboard(id, 50),
        isUserInCompetition(id),
        getWalletBalance(),
        getTradingRiskSettings(),
        // Reason the shape is declared on the query rather than cast at the use site: the cast
        // was `as any`, which the pre-commit hook rejects now that this file is being edited.
        // Naming the one field that is read is both narrower and self-documenting.
        AppSettingsModel.findById("app-settings")
          .lean<{ currency?: { symbol?: string } } | null>()
          .catch(() => null),
      ]);
    const currSymbol = appSettings?.currency?.symbol || "€";
    // getUserParticipant depends on isUserIn — must be sequential
    const userParticipant = isUserIn ? await getUserParticipant(id) : null;

    // Get user level for level requirement check (client-side)
    let userLevel = { level: 1, title: "Novice Trader", icon: "🌱" };
    if (userId) {
      try {
        const { getUserLevel: fetchUserLevel } =
          await import("@/lib/services/xp-level.service");
        const levelData = await fetchUserLevel(userId);
        userLevel = {
          level: levelData.currentLevel || 1,
          title: levelData.currentTitle || "Novice Trader",
          icon: levelData.currentIcon || "🌱",
        };
      } catch {
        // Use default level if fetch fails
      }
    }

    const isActive = competition.status === "active";
    const isUpcoming = competition.status === "upcoming";
    const isCompleted = competition.status === "completed";
    const isCancelled = competition.status === "cancelled";
    const isFull =
      competition.currentParticipants >= competition.maxParticipants;

    // Reason: Participants of completed competitions land on the results
    // page by default. ?view=details bypasses this so users can revisit
    // the competition detail view (leaderboard, chart, etc.) from results.
    if (isCompleted && isUserIn && query.view !== "details") {
      redirect(`/competitions/${id}/results`);
    }

    // Reason it is extracted rather than inline: the clamp against `startTime` exists for
    // documents an old bug wrote with a deadline an hour BEFORE the start, and a second copy
    // that forgot it would silently refuse entry to those contests. See the helper.
    const registrationClosed = isRegistrationClosed(competition);

    /*
      THE GAME BRANCH, AND IT IS DELIBERATELY THE WHOLE PAGE RATHER THAN A SET OF GUARDS.

      Everything below this point is the forex trading lobby: difficulty computed from leverage
      and starting capital, an asset-class list, a margin explainer, an "Enter Terminal" button
      and a leaderboard whose columns are profit and loss. For a puzzle contest none of it means
      anything - and it never crashed, which is why it survived: the fields a provider contest
      lacks are either guarded or filled by schema defaults, verified against a real MongoDB in
      `__tests__/services/provider-contest-lobby-shape.test.ts` rather than assumed. A paying
      player just read a trading screen for a game with no market, exactly as they were sent to
      the trading workspace by a "Start Trading" button before `/play` existed.

      IT BRANCHES ON THE LABEL, NOT ON THE STRICT `isProviderContest`, and the difference decides
      a real case. A contest labelled provider but missing its provider key cannot launch a round
      - but it is still not a trading contest, and showing it the trading lobby would hand a
      player an Enter Terminal button for a game. The lobby answers "what kind of screen is
      this"; whether Play can work is a separate question the lobby component asks with the
      strict helper and refuses with a stated reason. Same distinction the admin competitions
      list draws, and giving the two questions two names is what stops one being used for the
      other.

      Returning here also means none of the trading computation runs for a provider contest, and
      the trading path below is byte-identical - which is the only thing that makes the existing
      lobby behaviour trustworthy evidence that nothing moved.
    */
    if (hasProviderGameLabel(competition)) {
      return (
        <ProviderContestLobby
          competition={competition}
          leaderboard={leaderboard}
          isUserIn={isUserIn}
          isFull={isFull}
          userId={userId}
          walletBalance={walletBalance.balance}
          currencySymbol={currSymbol}
          participantStatus={userParticipant?.status}
          registrationClosed={registrationClosed}
        />
      );
    }

    const formatUTCDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      const day = date.getUTCDate().toString().padStart(2, "0");
      const hours = date.getUTCHours().toString().padStart(2, "0");
      const minutes = date.getUTCMinutes().toString().padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    // Calculate difficulty
    const getDifficultyData = () => {
      const manualDifficulty = (
        competition as {
          difficulty?: { mode: "auto" | "manual"; manualLevel?: string };
        }
      ).difficulty;

      if (manualDifficulty?.mode === "manual" && manualDifficulty.manualLevel) {
        const levelMap: Record<
          string,
          { level: DifficultyLevel; label: string; score: number }
        > = {
          beginner: { level: "Novice", label: "Novice Trader", score: 10 },
          intermediate: {
            level: "Skilled",
            label: "Skilled Trader",
            score: 25,
          },
          advanced: { level: "Elite", label: "Elite Trader", score: 45 },
          expert: { level: "Grand Master", label: "Grand Master", score: 65 },
          extreme: { level: "Trading God", label: "Trading God", score: 95 },
        };
        const mapped = levelMap[manualDifficulty.manualLevel] || {
          level: "Skilled" as DifficultyLevel,
          label: "Skilled Trader",
          score: 25,
        };
        return {
          level: mapped.level,
          label: mapped.label,
          score: mapped.score,
          factors: [
            { factor: "Manually Set", impact: "high", score: mapped.score },
          ],
          isManual: true,
        };
      }

      const calculated = calculateCompetitionDifficulty({
        entryFee: competition.entryFee || competition.entryFeeCredits || 0,
        startingCapital:
          competition.startingCapital ||
          competition.startingTradingPoints ||
          10000,
        maxLeverage: competition.leverage?.max || riskSettings.maxLeverage,
        duration: Math.round(
          (new Date(competition.endTime).getTime() -
            new Date(competition.startTime).getTime()) /
            (1000 * 60),
        ),
        rules: competition.rules,
        riskLimits: competition.riskLimits,
        levelRequirement: competition.levelRequirement,
      });
      return {
        level: calculated.level,
        label: calculated.label,
        score: calculated.score,
        factors: calculated.factors,
        isManual: false,
      };
    };

    const difficultyData = getDifficultyData();

    /*
      The difficulty tint, emoji and description used to be three ninety-line dictionaries
      here. They are presentation for one card, so they moved into
      `components/trading/lobby/TradingLobbySidebar.tsx` with the card that renders them - as
      `Map`s, because they were indexed by a value derived from a competition document.
    */

    return (
      <div className="flex min-h-screen flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-8 overflow-x-hidden">
        {/* Auto-refresh when competition status changes */}
        <CompetitionStatusMonitor
          competitionId={id}
          initialStatus={competition.status}
          startTime={competition.startTime}
          userId={userId}
        />

        {/* Header with Back Button and UTC Clock */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <NeonPill href="/competitions" icon={ArrowLeft} label="Back to Competitions" />
            {isCompleted && isUserIn && (
              <NeonPill
                href={`/competitions/${id}/results`}
                icon={BarChart3}
                label="View Results"
              />
            )}
          </div>
          <div className="hidden sm:block">
            <UTCClock />
          </div>
        </div>

        <TradingLobbyHero
          competition={competition}
          currSymbol={currSymbol}
          isActive={isActive}
          isUpcoming={isUpcoming}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ========== LEFT COLUMN: MAIN CONTENT ========== */}
          <div className="lg:col-span-2 space-y-6">
            {/* User's Dashboard */}
            {isUserIn && userParticipant && (
              <CompetitionDashboard
                competitionId={id}
                initialParticipant={{
                  _id: userParticipant._id.toString(),
                  currentCapital: userParticipant.currentCapital,
                  pnl: userParticipant.pnl,
                  pnlPercentage: userParticipant.pnlPercentage,
                  totalTrades: userParticipant.totalTrades,
                  currentRank: userParticipant.currentRank,
                  winningTrades: userParticipant.winningTrades,
                  losingTrades: userParticipant.losingTrades,
                  status: userParticipant.status,
                }}
                competitionStatus={
                  isCancelled
                    ? "cancelled"
                    : isCompleted
                      ? "completed"
                      : isActive
                        ? "active"
                        : "upcoming"
                }
                startTime={new Date(competition.startTime).toISOString()}
                endTime={new Date(competition.endTime).toISOString()}
                startingCapital={
                  competition.startingCapital ||
                  competition.startingTradingPoints ||
                  10000
                }
                competitionRules={
                  competition.rules
                    ? {
                        minimumTrades: competition.rules.minimumTrades,
                        minimumWinRate: competition.rules.minimumWinRate,
                        disqualifyOnLiquidation:
                          competition.rules.disqualifyOnLiquidation,
                      }
                    : undefined
                }
                totalParticipants={competition.currentParticipants}
              />
            )}

            {/* Leaderboard */}
            <NeonPanel
              icon={Trophy}
              accent="prize"
              title="Leaderboard"
              action={
                <div className="flex items-center gap-2">
                  {/*
                    "traders" here and "players" on the game lobby. The appearance comes from the
                    kit; the wording deliberately does not, because the two words describe
                    genuinely different things and a shared label would be wrong on one screen.
                  */}
                  <NeonCountPill>{leaderboard.length} traders</NeonCountPill>
                  {competition.rules?.minimumTrades > 0 && (
                    <NeonCountPill tone="warn">
                      Min {competition.rules.minimumTrades} trades
                    </NeonCountPill>
                  )}
                </div>
              }
            >
              <CompetitionLeaderboard
                leaderboard={leaderboard}
                userParticipantId={userParticipant?._id}
                prizeDistribution={competition.prizeDistribution}
                minimumTrades={competition.rules?.minimumTrades || 0}
                competitionStatus={competition.status}
              />
            </NeonPanel>
          </div>

          {/* ========== RIGHT COLUMN: SIDEBAR ========== */}
          <TradingLobbySidebar
            competition={competition}
            riskSettings={riskSettings}
            difficultyData={difficultyData}
            currSymbol={currSymbol}
            walletBalance={walletBalance.balance}
            isUserIn={isUserIn && !!userParticipant}
            isFull={isFull}
            isActive={isActive}
            isUpcoming={isUpcoming}
            isCompleted={isCompleted}
            participantStatus={userParticipant?.status}
            userLevel={userLevel}
            registrationClosed={registrationClosed}
            formatUTCDate={formatUTCDate}
          />
        </div>
      </div>
    );
  } catch (error) {
    // Reason: Next.js implements redirect() by throwing a NEXT_REDIRECT error.
    // We must re-throw it so the redirect actually happens instead of showing 404.
    if (error && typeof error === "object" && "digest" in error) {
      const digest = (error as { digest?: string }).digest;
      if (digest?.startsWith("NEXT_REDIRECT")) throw error;
    }
    console.error("Error loading competition:", error);
    notFound();
  }
};

export default CompetitionDetailsPage;
