import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/ui/GameIcon";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import UTCClock from "@/components/trading/UTCClock";
import InlineCountdown from "@/components/trading/InlineCountdown";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import {
  HeroFigure,
  PanelNote,
  PanelRow,
  SidePanel,
  StatusBadge,
} from "@/components/games/lobby-ui";
import { getPlayState } from "@/lib/services/games/round-status.service";
import { isProviderContest } from "@/lib/services/games/contest-config";

/**
 * The lobby a player sees for a contest played through a game provider.
 *
 * IT EXISTS BECAUSE THE TRADING LOBBY KEPT WORKING, which is the failure mode this programme
 * keeps meeting. `app/(root)/competitions/[id]/page.tsx` renders charts, margin, leverage,
 * "PnL" and an Enter Terminal button, and for a puzzle contest it rendered all of them without
 * an error - nothing crashed, because the fields a provider contest lacks are either guarded or
 * filled by schema defaults (verified against a real MongoDB in
 * `__tests__/services/provider-contest-lobby-shape.test.ts`, not reasoned about). A player
 * simply read a trading screen for a game with no market. Same shape as the trading-shaped
 * services in `matchmaking.service.ts` and the admin list rendering drafts in the grey it uses
 * for finished contests.
 *
 * IT IS A BRANCH AT THE TOP OF THE PAGE, NOT A FIELD-BY-FIELD GUARD, and that is deliberate.
 * Threading conditionals through 1,100 lines of trading layout would touch every line the live
 * trading lobby depends on to serve a contest type that has never had a player. Branching once
 * leaves the trading path byte-identical, which is the only thing that makes the existing lobby
 * tests meaningful evidence that nothing moved.
 *
 * THREE FACTS `13` SECTION 4 SAYS A PROVIDER LOBBY MUST ANSWER, because a player will hit all
 * three and a lobby that stays silent generates support tickets: when the play window opens and
 * closes, how many attempts are left, and what happens if a round never finishes. The third is
 * the one nobody thinks to show and the one that costs money when it happens.
 *
 * THE CHROME IS THE TRADING LOBBY'S, DELIBERATELY AND EXACTLY (owner requirement, 6 Sep 2026).
 * Same page shell, same back-button-and-UTC-clock header, same gradient hero with a watermark
 * icon behind it, same uppercase hero figures, same two-thirds/one-third grid, same panel
 * shells, same 3D `GameIcon` set. The first version of this screen was correct and looked like
 * a different application - flat lucide glyphs, a narrower container, small plain headings -
 * and a player reaching it from the same competitions list reads that as a different site
 * rather than as a different game. What is emphatically NOT shared is the content: no capital,
 * no margin, no leverage, no asset classes, no profit and loss, no trade counts. `05` section
 * 10 makes that binding rather than stylistic.
 */

interface ProviderContestLobbyProps {
  /*
    Loosely typed on purpose, matching what `getCompetitionById` hands the page. Reason it is not
    a hand-written field list: an explicitly-typed shape is exactly where an invented field name
    survives a typecheck - `billsPerRound` on the pre-flight checklist and `scoreDirection` on
    the participant both got that far. Every field read below was checked against
    `competition.model.ts`.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaderboard: any[];
  isUserIn: boolean;
  isFull: boolean;
  userId: string;
  walletBalance: number;
  currencySymbol: string;
  participantStatus?: string;
  registrationClosed?: boolean;
}

/** What each unresolved-round policy actually means to the player whose round it was. */
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

export default async function ProviderContestLobby({
  competition,
  leaderboard,
  isUserIn,
  isFull,
  userId,
  walletBalance,
  currencySymbol,
  participantStatus,
  registrationClosed,
}: ProviderContestLobbyProps) {
  await connectToDatabase();

  /*
    The player-facing name comes from the catalogue, which is the editable content layer - never
    from `providerKey`, and never from `gameKey`, which is an internal join key that happens to
    read like English and would leak our own naming onto a player screen. Also never the
    provider's brand: `13` section 4 requires provider-neutral labels, because the player is
    playing a ChartVolt game.
  */
  /*
    `displayName` and `scoreType`, both of which `provider-game.model.ts` really declares. The
    first draft of this read a third field the model does NOT have, which would have rendered
    nothing for ever while looking entirely correct. Sixth instance of the class, after
    `billsPerRound` on the pre-flight checklist, `publishedAt` on the publish update,
    `scoreDirection` on the participant, `suspensionEndsAt` on the restriction and `referenceId`
    on the wallet transaction: **an unverified field name is a claim, not a fact**, and a
    hand-written `.lean<{...}>()` generic is precisely where one survives a typecheck, because
    the compiler checks the generic rather than the schema.
  */
  const title = await ProviderGame.findOne({
    providerKey: competition?.gameConfig?.providerKey,
    gameCode: competition?.gameConfig?.gameCode,
  })
    .select("displayName scoreType")
    .lean<{ displayName?: string; scoreType?: string } | null>();

  /*
    Attempts and the live round are only meaningful for someone holding a seat, and `getPlayState`
    is the authoritative source for both - the same function the play route and the launch API
    use, so this lobby cannot disagree with the screen it links to about how many attempts are
    left. A player without a seat gets a refusal here, which is correct and is simply not shown.
  */
  const playState =
    isUserIn && userId
      ? await getPlayState(String(competition._id), userId)
      : null;
  const state = playState?.success ? playState.state : null;

  /*
    THE LABEL DECIDES THE SCREEN; THE KEYS DECIDE WHETHER PLAY CAN WORK. The page routes here on
    the label alone, because a contest labelled provider with no provider key is still not a
    trading contest and must not be shown trading panels. But it cannot launch a round, so the
    Play control has to say so rather than fail on the click. Same distinction the admin
    competitions list draws between `hasProviderGameLabel` and `isProviderContest`, and giving
    the two questions two names is what stops the strict helper being reused for the first.
  */
  const canLaunch = isProviderContest(competition);

  const playWindowStart = formatUTC(competition.playWindowStart);
  const playWindowEnd = formatUTC(competition.playWindowEnd);
  const attemptsCopy = competition.attemptsPolicy
    ? ATTEMPTS_POLICY_COPY[competition.attemptsPolicy as string]
    : undefined;
  const unresolvedCopy = competition.unresolvedRoundPolicy
    ? UNRESOLVED_POLICY_COPY[competition.unresolvedRoundPolicy as string]
    : undefined;

  const gameName = title?.displayName ?? "Game";

  /*
    The column heading comes from the game's own score type, which is the smallest possible step
    towards `13` section 4's per-game ranking labels. It is NOT the full `ranking-config.service`
    pass - that is still outstanding - but "Score" on a time trial is the trading-shaped-label
    problem in miniature, and a heading is cheap to get right here.

    Note what it does not do: it does not reformat the number. `05` section 2 requires the raw
    score to be displayed as stored, because any transformation makes a dispute unanswerable.
  */
  const scoreLabel = title?.scoreType === "duration_ms" ? "Time" : "Score";

  const status = String(competition.status ?? "");
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  /*
    The fourth hero figure is a countdown on a running or upcoming contest and a word on a
    finished one, which is what the trading lobby does. `InlineCountdown` is reused rather than
    reimplemented: a game lobby that formats "2d 4h" differently from the trading lobby is the
    same inconsistency as a different card radius, and it would also be a second place for the
    "Started"/"Ended" wording to drift.
  */
  const countdownTarget = isActive ? competition.endTime : competition.startTime;

  return (
    <div className="flex min-h-screen flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-8 overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4">
        <Link href="/competitions">
          <Button
            variant="ghost"
            className="w-fit gap-2 text-gray-400 hover:text-gray-100 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Competitions</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
        <div className="hidden sm:block">
          <UTCClock />
        </div>
      </div>

      {/* Hero - the trading lobby's header, with a joystick watermark instead of a trophy */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-4 sm:p-6 md:p-8 shadow-xl border border-yellow-500/20">
        <div className="absolute top-0 right-0 opacity-10">
          <GameIcon name="joystick1" size={192} />
        </div>

        <div className="relative z-10">
          <StatusBadge status={status} />

          {/*
            The game's identity, from the catalogue. A pill rather than a line of text because
            the contest name is the h1 and the game is the category it belongs to - the same
            relationship the admin competitions list draws with its game badge.
          */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1">
            <GameIcon name="joystick1" size={14} />
            <span className="text-xs font-semibold text-violet-200">
              {gameName}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100 mb-2">
            {competition.name}
          </h1>
          {competition.description && (
            <p className="text-gray-400 mb-6 max-w-2xl">
              {competition.description}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <HeroFigure
              label="Prize Pool"
              tone="prize"
              value={`${currencySymbol}${(competition.prizePool ?? 0).toLocaleString()}`}
            />
            <HeroFigure
              label="Entry Fee"
              value={
                competition.entryFee
                  ? `${currencySymbol}${competition.entryFee.toLocaleString()}`
                  : "Free"
              }
            />
            <HeroFigure
              label="Players"
              value={`${competition.currentParticipants ?? 0}/${competition.maxParticipants ?? 0}`}
              note={
                status === "upcoming" && competition.minParticipants > 0 ? (
                  <p
                    className={`text-xs mt-1 ${
                      (competition.currentParticipants ?? 0) <
                      competition.minParticipants
                        ? "text-orange-400"
                        : "text-green-400"
                    }`}
                  >
                    Min: {competition.minParticipants}
                    {(competition.currentParticipants ?? 0) <
                    competition.minParticipants
                      ? " (need more!)"
                      : " ✓"}
                  </p>
                ) : undefined
              }
            />
            {/*
              The score, not PnL. A puzzle has no profit and loss, and `05` section 10 makes this
              a binding rule rather than a style point: every figure is either generalised across
              games or explicitly scoped to one. There is no third option, and the failure mode of
              getting it wrong is not a crash - a trading-only figure keeps computing and keeps
              rendering.

              A dash, never a zero, for a player with no scored round. Same read-side rule as the
              leaderboard cell and the dashboard card: an absent score and a score of nothing are
              different facts, and conflating them is what made every provider participant tie.
            */}
            {isUserIn ? (
              <HeroFigure
                label="Your Score"
                value={state ? state.participantScore.toLocaleString() : "-"}
              />
            ) : (
              <HeroFigure
                label={
                  isCancelled
                    ? "Status"
                    : isActive
                      ? "Time Remaining"
                      : isCompleted
                        ? "Status"
                        : "Starts In"
                }
                tone={isCancelled ? "cancelled" : isActive ? "live" : "neutral"}
                value={
                  isCancelled ? (
                    "Cancelled"
                  ) : isCompleted ? (
                    "Completed"
                  ) : countdownTarget ? (
                    <InlineCountdown
                      targetDate={new Date(countdownTarget).toISOString()}
                      type={isActive ? "end" : "start"}
                    />
                  ) : (
                    "-"
                  )
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* The trading lobby's leaderboard shell, with a score board inside it */}
          <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-6 flex-wrap">
              <GameIcon name="trophy" size={20} />
              <h2 className="text-lg sm:text-xl font-bold text-gray-100">
                Leaderboard
              </h2>
              {/*
                "players", never "traders". The trading lobby's identical pill says traders, and
                copying it wholesale is the trading-shaped-label problem in the one place a
                player is certain to read.
              */}
              <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs font-medium">
                {leaderboard.length} players
              </span>
            </div>
            <ProviderLeaderboard
              rows={leaderboard}
              currentUserId={userId}
              scoreLabel={scoreLabel}
            />
          </div>
        </div>

        <div className="space-y-6">
          <CompetitionEntryButton
            competition={competition}
            userBalance={walletBalance}
            isUserIn={isUserIn}
            isFull={isFull}
            participantStatus={participantStatus}
            registrationClosed={registrationClosed}
          />

          {/*
            A control that cannot work must refuse with its reason rather than be quietly
            disabled - third instance of the rule, after a provider enabled with no adapter and
            the Edit button withheld from a provider contest. A greyed-out button teaches the
            player nothing and sends them to support; this at least tells an operator what is
            missing.
          */}
          {isUserIn && !canLaunch && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <GameIcon name="warning" size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                This competition is missing the game details needed to start a
                round. Nothing has been charged for an attempt. Please contact
                support.
              </p>
            </div>
          )}

          {(playWindowStart || playWindowEnd) && (
            <SidePanel icon="timer" title="Play window" accent="sky">
              <div className="space-y-2">
                {playWindowStart && (
                  <PanelRow label="Opens" value={playWindowStart} />
                )}
                {playWindowEnd && (
                  <PanelRow label="Closes" value={playWindowEnd} />
                )}
              </div>
              <PanelNote>
                The play window can be narrower than the competition itself, so
                check both.
              </PanelNote>
            </SidePanel>
          )}

          {state && (
            <SidePanel icon="target" title="Your attempts" accent="violet">
              <PanelRow
                label="Remaining"
                emphasis
                value={`${state.attemptsRemaining} of ${state.attemptsPermitted}`}
              />
              {attemptsCopy && <PanelNote>{attemptsCopy}</PanelNote>}
              <PanelNote>
                An attempt is used the moment a round opens, even if you leave
                before finishing.
              </PanelNote>
            </SidePanel>
          )}

          {unresolvedCopy && (
            <SidePanel
              icon="guideBook"
              title="If a round does not finish"
              accent="amber"
            >
              <PanelNote>{unresolvedCopy}</PanelNote>
            </SidePanel>
          )}
        </div>
      </div>
    </div>
  );
}
