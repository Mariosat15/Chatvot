import {
  Clock,
  Gamepad2,
  Hourglass,
  LifeBuoy,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { connectToDatabase } from "@/database/mongoose";
import UTCClock from "@/components/trading/UTCClock";
import InlineCountdown from "@/components/trading/InlineCountdown";
import ProviderClientWarmup from "@/components/games/ProviderClientWarmup";
import {
  LobbyLiveEntryButton,
  LobbyLiveLeaderboard,
  LobbyLivePrizePanel,
} from "@/components/games/LobbyLiveParts";
import { ArenaLiveProvider } from "@/components/games/arena/ArenaLiveStandings";
import { ArenaHighlights } from "@/components/games/arena/ArenaHighlights";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { resolveProviderBanner } from "@/components/neon/banners";
import { NeonBackLink, NeonPill } from "@/components/neon/Buttons";
import {
  NeonNote,
  NeonPanel,
  NeonRow,
  StatusCard,
} from "@/components/neon/Cards";
import { NEON_LABEL, NEON_PANEL } from "@/components/neon/tokens";
import { CompetitionRulesFairPlay } from "@/components/competitions/detail/CompetitionRulesFairPlay";
import { GameEventDetails } from "@/components/competitions/detail/GameEventDetails";
import { ContestHowItWorks } from "@/components/competitions/lobby/ContestHowItWorks";
import { getTerms } from "@/lib/services/terminology.service";
import { getPlayState } from "@/lib/services/games/round-status.service";
import {
  getGamePresentation,
  UNKNOWN_GAME_NAME,
} from "@/lib/services/games/game-presentation.service";
import { isProviderContest } from "@/lib/services/games/contest-config";
import { playModePlayerRule } from "@/lib/services/games/play-shape";
import type { ArenaStandings } from "@/lib/services/games/arena-standings.service";
import { getTitleLevels } from "@/lib/services/xp-config.service";
import {
  contestReservesFullRound,
  fullRoundCutoffMs,
} from "@/components/games/round-window";
import { describeAttempts } from "@/components/games/preflight-parts";
import { GameCompetitionArenaShell } from "@/components/games/lobby/GameCompetitionArenaShell";
import { LobbyHeroFeaturePills } from "@/components/games/lobby/LobbyHeroFeaturePills";
import { LobbyContestStatsGrid } from "@/components/games/lobby/LobbyContestStatsGrid";
import {
  LobbyCenterStage,
  LobbyRuleBadge,
} from "@/components/games/lobby/LobbyCenterStage";
import { MobileGameCompetitionLobby } from "@/components/games/lobby/mobile/MobileGameCompetitionLobby";
import {
  resolveHeroFeatures,
  scoringSummary,
  splitGameTitle,
} from "@/components/games/arena/arena-facts";

/**
 * The lobby a player sees for a contest played through a game provider.
 *
 * Desktop uses the three-column arena shell (leaderboard | play stage | contest
 * info). Phone uses a dedicated vertical tree under 769px. Trading stays on
 * `CompetitionDetailShell` and is untouched.
 */

interface ProviderContestLobbyProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  standings: ArenaStandings;
  isUserIn: boolean;
  isFull: boolean;
  userId: string;
  walletBalance: number;
  creditSymbol?: string;
  participantStatus?: string;
  registrationClosed?: boolean;
}

const UNRESOLVED_POLICY_COPY: Record<string, string> = {
  score_zero:
    "If your round never reports a result, it is scored zero and the competition still settles on time. You will be told it happened.",
  exclude:
    "If your round never reports a result, you are removed from the ranking and your entry fee is refunded.",
  hold_and_alert:
    "If your round never reports a result, the competition is held and a person reviews it before anyone is paid.",
};

const ATTEMPTS_POLICY_COPY: Record<string, string> = {
  single: "One attempt, and the score from it is final.",
  best_of_n: "Your best attempt counts.",
  sum_of_n: "Every attempt is added together.",
};

function formatUTC(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function formatRoundClock(seconds?: number | null): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ProviderContestLobby({
  competition,
  standings,
  isUserIn,
  isFull,
  userId,
  walletBalance,
  creditSymbol,
  participantStatus,
  registrationClosed,
}: ProviderContestLobbyProps) {
  await connectToDatabase();
  const terms = await getTerms();

  const presentation = await getGamePresentation(
    competition?.gameConfig?.providerKey,
    competition?.gameConfig?.gameCode,
  );

  const playState =
    isUserIn && userId
      ? await getPlayState(String(competition._id), userId)
      : null;
  const state = playState?.success ? playState.state : null;

  const levelLadder = await getTitleLevels();
  const canLaunch = isProviderContest(competition);

  const playWindowStart = formatUTC(competition.playWindowStart);
  const playWindowEnd = formatUTC(competition.playWindowEnd);
  const attemptsCopy = competition.attemptsPolicy
    ? ATTEMPTS_POLICY_COPY[competition.attemptsPolicy as string]
    : undefined;
  const unresolvedCopy = competition.unresolvedRoundPolicy
    ? UNRESOLVED_POLICY_COPY[competition.unresolvedRoundPolicy as string]
    : undefined;

  const gameName =
    presentation.gameName === UNKNOWN_GAME_NAME ? terms.game : presentation.gameName;

  const scoreLabel =
    presentation.scoreType === "duration_ms" ? "Time" : "Score";

  const status = String(competition.status ?? "");
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const countdownTarget = isActive ? competition.endTime : competition.startTime;

  const playWindowEndMs = state?.playWindowEnd
    ? new Date(state.playWindowEnd).getTime()
    : null;
  const attemptCutoffMs = state
    ? fullRoundCutoffMs(playWindowEndMs, state.maxRoundSeconds)
    : null;
  const reservesFullRound = state
    ? contestReservesFullRound(state.roundStartPolicy)
    : true;
  const playMode = competition.playMode === "scheduled" ? "scheduled" : "anytime";
  const modeRule = playModePlayerRule(playMode, "competition");

  const scheduleDetails =
    playWindowStart || playWindowEnd ? (
      <>
        <p className={NEON_LABEL}>Play window</p>
        <div className="mt-2 space-y-2">
          {playWindowStart && <NeonRow label="Opens" value={playWindowStart} />}
          {playWindowEnd && <NeonRow label="Closes" value={playWindowEnd} />}
          {isActive &&
            reservesFullRound &&
            attemptCutoffMs !== null &&
            attemptCutoffMs > Date.now() && (
              <NeonRow
                label="Last attempt can start in"
                accent="waiting"
                value={
                  <InlineCountdown
                    targetDate={new Date(attemptCutoffMs).toISOString()}
                    type="end"
                    zeroLabel="Passed"
                  />
                }
              />
            )}
        </div>
        <NeonNote>
          <span className="font-semibold text-gray-100">{modeRule.label}</span>{" "}
          {modeRule.detail}
          {playMode === "anytime" && (
            <>
              {" "}
              {reservesFullRound
                ? "An attempt has to begin early enough to finish inside the window, so the last one starts before it shuts."
                : "Anything still running when the window shuts is closed with the competition and scored on what you managed."}
            </>
          )}
        </NeonNote>
      </>
    ) : null;

  const showCountdown = Boolean(countdownTarget) && !isCompleted && !isCancelled;

  const pollStandings = status === "active" || status === "upcoming";

  const initialContest = {
    currentParticipants: standings.contest.currentParticipants,
    maxParticipants:
      standings.contest.maxParticipants ?? competition.maxParticipants,
    prizePool: standings.contest.prizePool ?? competition.prizePool,
    prizePoolCredits:
      standings.contest.prizePoolCredits ?? competition.prizePoolCredits,
    entryFee: standings.contest.entryFee ?? competition.entryFee,
    platformFeePercentage:
      standings.contest.platformFeePercentage ??
      competition.platformFeePercentage,
    prizeDistribution:
      standings.contest.prizeDistribution ?? competition.prizeDistribution,
  };

  const myInitialScore = standings.rows.find((row) => row.userId === userId)
    ?.score;

  const eventDetailRows: Array<{ label: string; value: string }> = [
    { label: "Format", value: modeRule.label },
    {
      label: "Scoring",
      value:
        attemptsCopy ??
        (scoreLabel === "Time"
          ? "Faster finishes rank higher"
          : "Higher scores rank higher"),
    },
    {
      label: "Play window",
      value:
        playWindowStart && playWindowEnd
          ? `${playWindowStart} → ${playWindowEnd}`
          : playWindowEnd || playWindowStart || "",
    },
    {
      label: "If a round stalls",
      value: unresolvedCopy ?? "",
    },
  ];

  const roundSeconds =
    state?.maxRoundSeconds ?? presentation.maxDurationSeconds ?? null;
  const roundTimeLabel = formatRoundClock(roundSeconds);
  const scoringNote =
    scoringSummary(presentation.scoreType, presentation.scoreDirection) ??
    (scoreLabel === "Time" ? "Fastest time wins" : "Highest score wins");

  const heroFeaturePills = resolveHeroFeatures(
    presentation.heroFeatures,
    presentation.maxDurationSeconds,
    presentation.family,
    competition.minParticipants,
    competition.maxParticipants,
  );

  const { title: heroTitle, subtitle: heroNameSubtitle } = splitGameTitle(gameName);

  const attemptBadges = (
    <>
      {state ? (
        <LobbyRuleBadge tone="warn">{describeAttempts(state)}</LobbyRuleBadge>
      ) : competition.attemptsPolicy === "single" ? (
        <LobbyRuleBadge tone="warn">You have one attempt.</LobbyRuleBadge>
      ) : null}
      {playMode === "anytime" ? (
        <LobbyRuleBadge>
          Jump in whenever you&apos;re ready! 🎮
        </LobbyRuleBadge>
      ) : (
        <LobbyRuleBadge>{modeRule.label}</LobbyRuleBadge>
      )}
    </>
  );

  const centerDescription =
    presentation.tagline ||
    competition.description ||
    presentation.description ||
    (playMode === "anytime"
      ? "Play anytime before the competition ends and push for your best score. When the timer hits zero, everyone's final scores are compared and the winners are decided."
      : null);

  const attemptNote =
    roundSeconds && roundSeconds > 0
      ? `Each round takes up to ${formatRoundClock(roundSeconds)}. ${
          playMode === "anytime"
            ? "Start any time before the end."
            : "Everyone starts together when the window opens."
        } Starting uses one attempt, even if you leave before finishing.`
      : null;

  const entryControl = (
    <>
      <LobbyLiveEntryButton
        competition={competition}
        userBalance={walletBalance}
        isUserIn={isUserIn}
        isFull={isFull}
        participantStatus={participantStatus}
        registrationClosed={registrationClosed}
        levelLadder={levelLadder}
        currentUserId={userId}
        appearance="arena"
      />
      {isUserIn && !canLaunch && (
        <div className="mt-3">
          <StatusCard
            icon={TriangleAlert}
            accent="waiting"
            title="This competition cannot start a round yet"
            detail="The game details needed to start a round are missing. Nothing has been charged for an attempt. Please contact support."
          />
        </div>
      )}
    </>
  );

  const attemptsPanel =
    state != null ? (
      <NeonPanel
        icon={RotateCcw}
        accent="score"
        title="Your attempts"
        size="lg"
        className="mt-3"
      >
        <NeonRow
          label="Remaining"
          accent="score"
          value={`${state.attemptsRemaining} of ${state.attemptsPermitted}`}
        />
        {attemptsCopy && <NeonNote>{attemptsCopy}</NeonNote>}
        <NeonNote>
          An attempt is used the moment a round opens, even if you leave before
          finishing.
        </NeonNote>
      </NeonPanel>
    ) : null;

  const centerStage = (
    <LobbyCenterStage
      title={heroTitle}
      description={centerDescription}
      badges={attemptBadges}
      showCountdown={showCountdown}
      countdownTarget={countdownTarget}
      serverNow={state?.serverNow}
      countdownLabel={
        isActive ? "Play closes in" : `${terms.contest} starts in`
      }
      countdownVariant={isActive ? "end" : "start"}
      scheduleDetails={scheduleDetails}
      attemptNote={attemptNote}
      entryControl={entryControl}
      attemptsPanel={attemptsPanel}
    />
  );

  const statsGrid = (
    <LobbyContestStatsGrid
      prizePool={competition.prizePool ?? 0}
      entryFee={competition.entryFee ?? 0}
      currentParticipants={competition.currentParticipants ?? 0}
      maxParticipants={competition.maxParticipants ?? 0}
      roundTimeLabel={roundTimeLabel}
      creditSymbol={creditSymbol}
      playersLabel={terms.players}
      prizePoolLabel={terms.prizePool}
      entryFeeLabel={terms.entryFee}
      initialScore={myInitialScore}
      initialRank={standings.yourRank}
      showScore={isUserIn}
      scoringNote={scoringNote}
    />
  );

  const rightColumn = (
    <>
      <NeonPanel accent="players" size="lg">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <NeonStatusBadge status={status} />
          {showCountdown && countdownTarget ? (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">
              <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isActive ? "Ends in" : "Starts in"}{" "}
                <InlineCountdown
                  targetDate={
                    countdownTarget instanceof Date
                      ? countdownTarget.toISOString()
                      : String(countdownTarget)
                  }
                  type={isActive ? "end" : "start"}
                />
              </span>
            </div>
          ) : null}
        </div>
        {statsGrid}
      </NeonPanel>

      {(competition.prizeDistribution?.length ?? 0) > 0 && (
        <LobbyLivePrizePanel
          initialCompetition={competition}
          creditSymbol={creditSymbol}
        />
      )}

      <GameEventDetails rows={eventDetailRows} />
      <CompetitionRulesFairPlay />
    </>
  );

  const leaderboard = (
    <LobbyLiveLeaderboard title={terms.leaderboard} scoreLabel={scoreLabel} />
  );

  const howItWorks = (
    <ContestHowItWorks
      kind="game"
      steps={
        presentation.howItWorksSteps?.length
          ? presentation.howItWorksSteps.map((step) => ({
              title: step.title || "Step",
              detail: step.detail || "",
            }))
          : undefined
      }
    />
  );

  const tips =
    presentation.highlights.length > 0 ? (
      <ArenaHighlights
        highlights={presentation.highlights}
        imageUrl={
          presentation.highlightsImageUrl || presentation.thumbnailUrl
        }
      />
    ) : null;

  const nav = (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
      <NeonBackLink href="/competitions" label={terms.contests} />
      <div className="hidden sm:block">
        <UTCClock />
      </div>
    </div>
  );

  const hero = (
    <NeonHero
      banner={resolveProviderBanner({
        bannerUrl: presentation?.bannerUrl,
        gameName: presentation?.gameName ?? gameName,
        gameCode: competition?.gameConfig?.gameCode,
      })}
      badge={{ icon: Gamepad2, label: heroTitle }}
      title={heroTitle}
      subtitle={
        heroNameSubtitle ||
        presentation.tagline ||
        competition.description ||
        presentation.description
      }
      status={<NeonStatusBadge status={status} />}
      meta={<LobbyHeroFeaturePills features={heroFeaturePills} />}
    >
      {presentation.description &&
      (presentation.tagline || heroNameSubtitle) ? (
        <p className="max-w-2xl text-sm leading-relaxed text-gray-300/95">
          {presentation.description}
        </p>
      ) : null}
    </NeonHero>
  );

  const helpFooter = (
    <div
      className={`${NEON_PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
    >
      <div className="flex items-center gap-2.5">
        <LifeBuoy className="h-4 w-4 text-sky-300" />
        <p className="text-sm text-gray-400">
          Need help? Read how competitions work, or contact support.
        </p>
      </div>
      <NeonPill href="/help/competitions" icon={LifeBuoy} label="Help centre" />
    </div>
  );

  return (
    <ArenaLiveProvider
      competitionId={String(competition._id)}
      currentUserId={userId}
      active={pollStandings}
      initial={{
        rows: standings.rows,
        activity: standings.activity,
        feed: standings.feed,
        countries: standings.countries,
        contest: initialContest,
        yourRank: standings.yourRank,
      }}
      scoreType={presentation?.scoreType}
    >
      {isUserIn ? (
        <ProviderClientWarmup gameCode={competition?.gameConfig?.gameCode} />
      ) : null}

      {/* Phone: dedicated tree — never a squeezed three-column desktop. */}
      <div className="min-[769px]:hidden min-w-0">
        <MobileGameCompetitionLobby
          nav={nav}
          hero={hero}
          center={centerStage}
          stats={
            <NeonPanel accent="players" size="lg" title="Contest info">
              {statsGrid}
            </NeonPanel>
          }
          leaderboard={leaderboard}
          prizes={
            (competition.prizeDistribution?.length ?? 0) > 0 ? (
              <LobbyLivePrizePanel
                initialCompetition={competition}
                creditSymbol={creditSymbol}
              />
            ) : null
          }
          howItWorks={howItWorks}
          tips={tips}
          footer={
            <>
              <GameEventDetails rows={eventDetailRows} />
              <CompetitionRulesFairPlay />
              {helpFooter}
            </>
          }
        />
      </div>

      {/* Desktop / tablet arena: leaderboard | play stage | contest info. */}
      <div className="hidden min-[769px]:block">
        <GameCompetitionArenaShell
          nav={nav}
          hero={hero}
          left={leaderboard}
          center={centerStage}
          right={rightColumn}
          footer={
            <>
              {howItWorks}
              {tips ?? (
                <NeonPanel icon={Clock} accent="waiting" title="Game tips" size="lg">
                  <p className="text-sm text-gray-400">
                    Tips for this game appear here once they are written in the
                    catalogue.
                  </p>
                </NeonPanel>
              )}
            </>
          }
        />
        <div className="mx-auto max-w-[1600px] px-5 pb-8 sm:px-7 md:px-8">
          {helpFooter}
        </div>
      </div>
    </ArenaLiveProvider>
  );
}
