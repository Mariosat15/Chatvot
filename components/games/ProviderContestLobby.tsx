import { TriangleAlert } from "lucide-react";
import { connectToDatabase } from "@/database/mongoose";
import ProviderClientWarmup from "@/components/games/ProviderClientWarmup";
import {
  LobbyLiveEntryButton,
  LobbyLiveLeaderboard,
  LobbyLivePrizePanel,
} from "@/components/games/LobbyLiveParts";
import { ArenaLiveProvider } from "@/components/games/arena/ArenaLiveStandings";
import { ArenaHighlights } from "@/components/games/arena/ArenaHighlights";
import { resolveProviderBanner } from "@/components/neon/banners";
import { StatusCard } from "@/components/neon/Cards";
import {
  LobbyHelpFooter,
  LobbyTipsPlaceholder,
} from "@/components/games/lobby/LobbyFooterParts";
import { GameLobbyScheduleNote } from "@/components/games/lobby/GameLobbyScheduleNote";
import { toInitialContest } from "@/components/games/lobby/lobby-initial-contest";
import { GameEventDetails } from "@/components/competitions/detail/GameEventDetails";
import { GameLobbySummary } from "@/components/games/lobby/GameLobbySummary";
import {
  ATTEMPTS_POLICY_COPY,
  ATTEMPTS_POLICY_SHORT,
  UNRESOLVED_POLICY_COPY,
  ANYTIME_STAGE_BLURB,
  toHowItWorksSteps,
  formatRoundClock,
  formatUTC,
} from "@/components/games/lobby/game-lobby-copy";
import { buildGameOverviewCopy } from "@/components/games/lobby/game-overview-copy";
import {
  buildGameEventSections,
  buildGameLobbySections,
} from "@/components/games/lobby/game-lobby-sections";
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
import {
  DesktopGameLobby,
  GameLobbyYourRun,
} from "@/components/competitions/detail/DesktopGameLobby";
import { MobileGameLobbyLeaderboard } from "@/components/games/lobby/mobile/MobileGameLobbyLeaderboard";
import { MobileGameCompetitionLobby } from "@/components/games/lobby/mobile/MobileGameCompetitionLobby";
import LobbyViewportSwitch from "@/components/competitions/lobby/LobbyViewportSwitch";
import {
  resolveHeroFeatures,
  scoringSummary,
  splitGameTitle,
} from "@/components/games/arena/arena-facts";
import { CompetitionRulesFairPlay } from "@/components/competitions/detail/CompetitionRulesFairPlay";

/**
 * The lobby a player sees for a contest played through a game provider.
 *
 * Desktop uses the same `CompetitionDetailShell` layout as trading
 * (`DesktopGameLobby`: hero → KPIs → tabs + leaderboard | sidebar). Phone uses
 * a dedicated vertical tree under 769px. Trading is untouched.
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
  const attemptsPolicy = String(competition.attemptsPolicy ?? "");
  const unresolvedPolicy = String(competition.unresolvedRoundPolicy ?? "");
  const attemptsCopy = ATTEMPTS_POLICY_COPY.get(attemptsPolicy);
  const unresolvedCopy = UNRESOLVED_POLICY_COPY.get(unresolvedPolicy);

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

  const showCountdown = Boolean(countdownTarget) && !isCompleted && !isCancelled;

  const pollStandings = status === "active" || status === "upcoming";

  const initialContest = toInitialContest(standings.contest, competition);

  const myInitialScore = standings.rows.find((row) => row.userId === userId)
    ?.score;

  const roundSeconds =
    state?.maxRoundSeconds ?? presentation.maxDurationSeconds ?? null;
  const roundTimeLabel = formatRoundClock(roundSeconds);
  const scoringNote =
    scoringSummary(presentation.scoreType, presentation.scoreDirection) ??
    (scoreLabel === "Time" ? "Fastest time wins" : "Highest score wins");
  const attemptsLabel = state
    ? `${state.attemptsRemaining} of ${state.attemptsPermitted}`
    : attemptsPolicy === "single"
      ? "1"
      : undefined;

  const eventDetailSections = buildGameEventSections({
    modeLabel: modeRule.label,
    modeDetail: modeRule.detail,
    roundTimeLabel,
    roundSeconds,
    attemptsPolicy,
    attemptsTip: attemptsCopy,
    scoreLabel,
    scoringNote,
    playWindowStart: competition.playWindowStart,
    playWindowEnd: competition.playWindowEnd,
    playWindowStartTip: playWindowStart ?? undefined,
    playWindowEndTip: playWindowEnd ?? undefined,
    unresolvedPolicy,
    unresolvedTip: unresolvedCopy,
  });

  const heroFeaturePills = resolveHeroFeatures(
    presentation.heroFeatures,
    presentation.maxDurationSeconds,
    presentation.family,
    competition.minParticipants,
    competition.maxParticipants,
  );

  const { title: heroTitle, subtitle: heroNameSubtitle } = splitGameTitle(gameName);

  const centerDescription =
    presentation.description ||
    competition.description ||
    presentation.tagline ||
    (playMode === "anytime" ? ANYTIME_STAGE_BLURB : null);

  const launchBlocked =
    isUserIn && !canLaunch ? (
      <div className="mt-3">
        <StatusCard
          icon={TriangleAlert}
          accent="waiting"
          title="This competition cannot start a round yet"
          detail="The game details needed to start a round are missing. Nothing has been charged for an attempt. Please contact support."
        />
      </div>
    ) : null;

  // Phone: same entry rules, arranged like the trading phone entry card (CTA beside heading).
  const mobileEntryControl = (
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
        layout="mobile"
      />
      {launchBlocked}
    </>
  );

  const summary = (
    <GameLobbySummary
      initial={initialContest}
      minParticipants={competition.minParticipants}
      countdownTarget={
        countdownTarget ? new Date(countdownTarget).toISOString() : undefined
      }
      isActive={isActive}
      isUpcoming={status === "upcoming"}
      isCompleted={isCompleted}
      isCancelled={isCancelled}
      creditSymbol={creditSymbol}
      prizePoolLabel={terms.prizePool}
      entryFeeLabel={terms.entryFee}
      playersLabel={terms.players}
    />
  );

  const prizesPanel =
    (competition.prizeDistribution?.length ?? 0) > 0 ? (
      <LobbyLivePrizePanel initialCompetition={competition} creditSymbol={creditSymbol} />
    ) : null;

  const leaderboard = (
    <LobbyLiveLeaderboard title={terms.leaderboard} scoreLabel={scoreLabel} />
  );

  const howItWorks = (
    <ContestHowItWorks kind="game" steps={toHowItWorksSteps(presentation.howItWorksSteps)} />
  );

  const tips =
    presentation.highlights.length > 0 ? (
      <ArenaHighlights
        highlights={presentation.highlights}
        imageUrl={presentation.highlightsImageUrl || presentation.logoUrl}
      />
    ) : null;

  const overview = buildGameOverviewCopy({
    playModeLabel: modeRule.label,
    playModeDetail: modeRule.detail,
    scoreLabel,
    scoringNote,
    roundSeconds,
    attemptsShort: ATTEMPTS_POLICY_SHORT.get(attemptsPolicy) ?? null,
    howItWorksSteps: toHowItWorksSteps(presentation.howItWorksSteps),
  });

  const sections = buildGameLobbySections({
    eventSections: eventDetailSections,
    rulesSummary: presentation.rulesSummary,
    howToPlay: presentation.howToPlay,
  });

  const scheduleNote = (
    <GameLobbyScheduleNote
      modeLabel={modeRule.label}
      modeDetail={modeRule.detail}
      playMode={playMode}
      reservesFullRound={reservesFullRound}
      showAttemptCutoff={
        isActive &&
        reservesFullRound &&
        attemptCutoffMs !== null &&
        attemptCutoffMs > Date.now()
      }
      attemptCutoffMs={attemptCutoffMs}
    />
  );

  const banner = resolveProviderBanner({
    bannerUrl: presentation?.bannerUrl,
    gameName: presentation?.gameName ?? gameName,
    gameCode: competition?.gameConfig?.gameCode,
  });

  const startLabel = formatUTC(competition.startTime);
  const endLabel = formatUTC(competition.endTime);

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

      {/*
        Phone: dedicated Game Competition Lobby
        (`ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide`). Never a
        squeezed desktop. Desktop matches trading via CompetitionDetailShell.

        Reason (16 Oct 2026): matchMedia switch, not CSS alone — phones were
        still painting the desktop shell when Safari's layout width stayed wide.
      */}
      <LobbyViewportSwitch
        mobile={
          <div className="min-w-0">
            <MobileGameCompetitionLobby
              competitionId={String(competition._id)}
              contestsHref="/competitions"
              contestsLabel={terms.contests}
              hero={{
                title: heroTitle,
                description: centerDescription,
                banner,
                categoryLabel: presentation.category ?? null,
                status,
                cancellationReason: competition.cancellationReason ?? null,
              }}
              contest={{
                isActive,
                isUpcoming: status === "upcoming",
                isCompleted,
                isCancelled,
                countdownTarget,
              }}
              run={{
                isUserIn,
                state,
                roundTimeLabel,
                scoringNote,
                initialScore: myInitialScore,
                initialRank: standings.yourRank,
                entryControl: mobileEntryControl,
              }}
              metrics={{
                prizePool: Number(
                  competition.prizePool ?? competition.prizePoolCredits ?? 0,
                ),
                entryFee: Number(
                  competition.entryFee ?? competition.entryFeeCredits ?? 0,
                ),
                currentParticipants: Number(competition.currentParticipants ?? 0),
                maxParticipants: Number(competition.maxParticipants ?? 0),
                minParticipants: Number(competition.minParticipants ?? 0),
                playersLabel: terms.players,
                creditSymbol,
                funded: competition.fundingMode === "gm_funded",
              }}
              leaderboard={
                <MobileGameLobbyLeaderboard
                  title={terms.leaderboard}
                  scoreLabel={scoreLabel}
                  playersLabel={terms.players}
                />
              }
              prizes={prizesPanel}
              howItWorks={howItWorks}
              tips={tips}
              rounds={{
                list: state?.rounds ?? [],
                scoreType: presentation?.scoreType,
                scoreLabel,
              }}
              details={
                <>
                  <GameEventDetails sections={eventDetailSections} />
                  <CompetitionRulesFairPlay />
                  <LobbyHelpFooter />
                </>
              }
            />
          </div>
        }
        desktop={
          <div>
            <DesktopGameLobby
              contestsHref="/competitions"
              contestsLabel={terms.contests}
              competitionId={String(competition._id)}
              isCompleted={isCompleted}
              isUserIn={isUserIn}
              banner={banner}
              heroBadgeLabel={heroTitle}
              heroTitle={heroTitle}
              heroSubtitle={
                heroNameSubtitle ||
                presentation.tagline ||
                competition.description ||
                presentation.description
              }
              heroFeatures={heroFeaturePills}
              status={status}
              cancellationReason={competition.cancellationReason ?? null}
              summary={summary}
              description={centerDescription}
              sections={sections}
              overview={overview}
              leaderboard={leaderboard}
              yourRun={
                isUserIn ? (
                  <GameLobbyYourRun
                    roundTimeLabel={roundTimeLabel}
                    attemptsLabel={attemptsLabel}
                    attemptsNote={attemptsCopy}
                    initialScore={myInitialScore}
                    initialRank={standings.yourRank}
                    scoringNote={scoringNote}
                    showScore
                  />
                ) : undefined
              }
              sidebar={{
                competition,
                creditSymbol,
                walletBalance,
                isUserIn,
                isFull,
                isActive,
                isUpcoming: status === "upcoming",
                isCompleted,
                participantStatus,
                registrationClosed,
                levelLadder,
                currentUserId: userId,
                startLabel,
                endLabel,
                countdownTarget,
                countdownLabel: isActive
                  ? `${terms.contest} closes in`
                  : `${terms.contest} starts in`,
                countdownVariant: isActive ? "end" : "start",
                serverNow: state?.serverNow,
                showCountdown,
                scheduleNote,
                launchBlocked,
              }}
              footer={
                <>
                  {tips ?? <LobbyTipsPlaceholder />}
                </>
              }
            />
            <div className="mx-auto max-w-[1600px] px-5 pb-8 sm:px-7 md:px-8">
              <LobbyHelpFooter />
            </div>
          </div>
        }
      />
    </ArenaLiveProvider>
  );
}
