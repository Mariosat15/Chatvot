import { Gamepad2, RotateCcw, TriangleAlert } from "lucide-react";
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
import { NeonBackLink } from "@/components/neon/Buttons";
import { NeonNote, NeonPanel, NeonRow, StatusCard } from "@/components/neon/Cards";
import { NEON_LABEL } from "@/components/neon/tokens";
import {
  LobbyHelpFooter,
  LobbyTipsPlaceholder,
} from "@/components/games/lobby/LobbyFooterParts";
import { toInitialContest } from "@/components/games/lobby/lobby-initial-contest";
import { CompetitionRulesFairPlay } from "@/components/competitions/detail/CompetitionRulesFairPlay";
import {
  GameEventDetails,
  type GameEventSection,
} from "@/components/competitions/detail/GameEventDetails";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { GameLobbySummary } from "@/components/games/lobby/GameLobbySummary";
import {
  ATTEMPTS_POLICY_COPY,
  ATTEMPTS_POLICY_SHORT,
  UNRESOLVED_POLICY_COPY,
  UNRESOLVED_POLICY_SHORT,
  ANYTIME_STAGE_BLURB,
  buildStageFacts,
  toHowItWorksSteps,
  formatRoundClock,
  formatUTC,
  formatUTCShort,
} from "@/components/games/lobby/game-lobby-copy";
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
import { GameCompetitionArenaShell } from "@/components/games/lobby/GameCompetitionArenaShell";
import { LobbyHeroFeaturePills } from "@/components/games/lobby/LobbyHeroFeaturePills";
import { LobbyContestStatsGrid } from "@/components/games/lobby/LobbyContestStatsGrid";
import { LobbyCenterStage } from "@/components/games/lobby/LobbyCenterStage";
import { LobbyAttemptBadges } from "@/components/games/lobby/LobbyAttemptBadges";
import { MobileGameLobbyLeaderboard } from "@/components/games/lobby/mobile/MobileGameLobbyLeaderboard";
import { MobileGameCompetitionLobby } from "@/components/games/lobby/mobile/MobileGameCompetitionLobby";
import LobbyViewportSwitch from "@/components/competitions/lobby/LobbyViewportSwitch";
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

  // Owner, 15 Oct 2026: the long sentences became categories like the trading lobby's rule
  // cards - a short value per row, the full sentence on its ? tip. Nothing is dropped.
  const eventDetailSections: GameEventSection[] = [
    {
      title: "How you play",
      subtitle: "Format and rounds",
      iconSrc: NEON_ICON("swords"),
      accent: "sky",
      rows: [
        { icon: "format", label: "Format", value: modeRule.label, tone: "cyan", tip: modeRule.detail },
        { icon: "clock", label: "Round length", value: roundSeconds ? `Up to ${roundTimeLabel}` : null, tone: "cyan" },
        { icon: "attempt", label: "Attempts", value: ATTEMPTS_POLICY_SHORT.get(attemptsPolicy), tone: "purple", tip: attemptsCopy },
      ],
    },
    {
      title: "Scoring",
      subtitle: "Who wins",
      iconSrc: NEON_ICON("target-purple"),
      accent: "violet",
      rows: [
        { icon: "winner", label: "Winner", value: scoreLabel === "Time" ? "Fastest time" : "Highest score", tone: "yellow", tip: scoringNote },
      ],
    },
    {
      title: "Play window",
      subtitle: "Times in UTC",
      iconSrc: NEON_ICON("calendar-blue"),
      accent: "sky",
      rows: [
        { icon: "opens", label: "Opens", value: formatUTCShort(competition.playWindowStart), tip: playWindowStart ?? undefined },
        { icon: "closes", label: "Closes", value: formatUTCShort(competition.playWindowEnd), tip: playWindowEnd ?? undefined },
      ],
    },
    {
      title: "If something goes wrong",
      subtitle: "Stalled or abandoned rounds",
      iconSrc: NEON_ICON("shield"),
      accent: "rose",
      rows: [
        { icon: "stall", label: "If a round stalls", value: UNRESOLVED_POLICY_SHORT.get(unresolvedPolicy), tone: "orange", tip: unresolvedCopy },
        { icon: "leave", label: "Leaving mid-round", value: "Attempt used", tone: "red", tip: "An attempt is used the moment a round opens, even if you leave before finishing." },
      ],
    },
  ];

  const heroFeaturePills = resolveHeroFeatures(
    presentation.heroFeatures,
    presentation.maxDurationSeconds,
    presentation.family,
    competition.minParticipants,
    competition.maxParticipants,
  );

  const { title: heroTitle, subtitle: heroNameSubtitle } = splitGameTitle(gameName);

  // The long description left the hero (owner, 15 Oct 2026) and is read here once, under
  // the game name; the hero keeps the short subtitle only.
  const centerDescription =
    presentation.description ||
    competition.description ||
    presentation.tagline ||
    (playMode === "anytime" ? ANYTIME_STAGE_BLURB : null);

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
      badges={
        <LobbyAttemptBadges
          state={state}
          attemptsPolicy={attemptsPolicy}
          playMode={playMode}
          modeLabel={modeRule.label}
        />
      }
      showCountdown={showCountdown}
      countdownTarget={countdownTarget}
      serverNow={state?.serverNow}
      countdownLabel={
        isActive ? `${terms.contest} closes in` : `${terms.contest} starts in`
      }
      countdownVariant={isActive ? "end" : "start"}
      scheduleDetails={scheduleDetails}
      facts={buildStageFacts(roundSeconds, playMode)}
      entryControl={entryControl}
      attemptsPanel={attemptsPanel}
    />
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

  const statsPanel = (
    <NeonPanel accent="players" size="lg" title="Your contest">
      <LobbyContestStatsGrid
        roundTimeLabel={roundTimeLabel}
        attemptsLabel={attemptsLabel}
        initialScore={myInitialScore}
        initialRank={standings.yourRank}
        showScore={isUserIn}
        scoringNote={scoringNote}
      />
    </NeonPanel>
  );

  const prizesPanel =
    (competition.prizeDistribution?.length ?? 0) > 0 ? (
      <LobbyLivePrizePanel initialCompetition={competition} creditSymbol={creditSymbol} />
    ) : null;

  const rightColumn = (
    <>
      {/* The clock lives in the summary row under the hero now; one countdown per state. */}
      {statsPanel}
      {prizesPanel}

      <GameEventDetails sections={eventDetailSections} />
      <CompetitionRulesFairPlay />
    </>
  );

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
      subtitle={heroNameSubtitle || presentation.tagline || competition.description || presentation.description}
      status={<NeonStatusBadge status={status} />}
      meta={<LobbyHeroFeaturePills features={heroFeaturePills} />}
    />
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

      {/*
        Phone: dedicated Game Competition Lobby
        (`ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide`). Never a
        squeezed three-column desktop. Desktop shell is unchanged.

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
                banner: resolveProviderBanner({
                  bannerUrl: presentation?.bannerUrl,
                  gameName: presentation?.gameName ?? gameName,
                  gameCode: competition?.gameConfig?.gameCode,
                }),
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
            <GameCompetitionArenaShell
              nav={nav}
              hero={hero}
              summary={summary}
              left={leaderboard}
              center={centerStage}
              right={rightColumn}
              footer={
                <>
                  {howItWorks}
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
