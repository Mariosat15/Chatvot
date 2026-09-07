import {
  ArrowLeft,
  Clock,
  Gamepad2,
  Gift,
  Info,
  Link2,
  LifeBuoy,
  RotateCcw,
  Trophy,
  TriangleAlert,
  Users,
} from "lucide-react";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import UTCClock from "@/components/trading/UTCClock";
import InlineCountdown from "@/components/trading/InlineCountdown";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import PrizeTable from "@/components/competitions/PrizeTable";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { providerBanner } from "@/components/neon/banners";
import { NeonPill } from "@/components/neon/Buttons";
import {
  NeonCountPill,
  NeonNote,
  NeonPanel,
  NeonRow,
  StatCard,
  StatusCard,
} from "@/components/neon/Cards";
import { NEON_PANEL } from "@/components/neon/tokens";
import { getPlayState } from "@/lib/services/games/round-status.service";
import { isProviderContest } from "@/lib/services/games/contest-config";
import {
  contestReservesFullRound,
  fullRoundCutoffMs,
} from "@/components/games/round-window";

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
 * Threading conditionals through a thousand lines of trading layout would touch every line the
 * live trading lobby depends on, to serve a contest type that has never had a player.
 *
 * THREE FACTS `13` SECTION 4 SAYS A PROVIDER LOBBY MUST ANSWER, because a player will hit all
 * three and a lobby that stays silent generates support tickets: when the play window opens and
 * closes, how many attempts are left, and what happens if a round never finishes. The third is
 * the one nobody thinks to show and the one that costs money when it happens.
 *
 * THE CHROME COMES FROM `components/neon/`, WHICH THE TRADING LOBBY ALSO WEARS (owner
 * requirement, 6 Sep 2026, from the style sheet in
 * `External game plans/design-reference/component-sheet.png`). This replaces an earlier and
 * weaker arrangement worth describing, because the reason it was replaced generalises: the two
 * lobbies used to be kept consistent by copying the trading page's class strings into this file
 * and having a test compare the two files. That works for two screens and collapses at five -
 * the same sheet also specifies the dashboard, the competitions hub, the game arena and the
 * rankings page, and pairwise comparison between five screens is twenty comparisons nobody
 * maintains. **One definition with tests on the definition** is the version that survives the
 * next screen.
 *
 * What is emphatically not shared is the content: no capital, no margin, no leverage, no asset
 * classes, no profit and loss, no trade counts. `05` section 10 makes that binding rather than
 * stylistic.
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

    `displayName` and `scoreType`, both of which `provider-game.model.ts` really declares. The
    first draft of this read a third field the model does NOT have, which would have rendered
    nothing for ever while looking entirely correct. **An unverified field name is a claim, not a
    fact**, and a hand-written `.lean<{...}>()` generic is precisely where one survives a
    typecheck, because the compiler checks the generic rather than the schema.
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
    The fourth figure is a countdown on a running or upcoming contest and a word on a finished
    one, which is what the trading lobby does. `InlineCountdown` is reused rather than
    reimplemented: a game lobby that formats "2d 4h" differently from the trading lobby is the
    same inconsistency as a different card radius, and it would also be a second place for the
    "Started"/"Ended" wording to drift.
  */
  const countdownTarget = isActive ? competition.endTime : competition.startTime;

  /*
    THE DOOR ON STARTING AN ATTEMPT, which is a different clock from the contest's end and was
    shown on neither this screen nor anywhere a player looks before travelling to the play
    screen. The owner's report was about the entry deadline; this is its sibling, and the two
    are easy to conflate: one is the last moment to *join*, this is the last moment to *start*.

    Derived from `fullRoundCutoffMs`, the same producer `RoundPreflight` uses to decide whether
    Play is still offered. A second expression here would eventually promise time the play
    screen refuses, which is worse than saying nothing at all.

    Only for a player holding a seat, because `state` is the authoritative source and a player
    without one has no attempts to start. Only while the cut-off is real: under
    `until_window_closes` there is none, and implying one would send a player away believing
    they had missed a deadline that does not exist.
  */
  const playWindowEndMs = state?.playWindowEnd
    ? new Date(state.playWindowEnd).getTime()
    : null;
  const attemptCutoffMs = state
    ? fullRoundCutoffMs(playWindowEndMs, state.maxRoundSeconds)
    : null;
  const reservesFullRound = state
    ? contestReservesFullRound(state.roundStartPolicy)
    : true;

  return (
    <div className="flex min-h-screen flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <NeonPill
          href="/competitions"
          icon={ArrowLeft}
          label="Back to Competitions"
        />
        <div className="hidden sm:block">
          <UTCClock />
        </div>
      </div>

      <NeonHero
        /*
          The artwork is chosen by the game's own code, so a second title gets its own banner
          without touching this file. A game we have no art for falls through to a generic
          trophy, which is visibly generic rather than silently wrong - see `banners.ts` for why
          that is an acceptable fallback here and would not be in anything producing a number.
        */
        banner={providerBanner(competition?.gameConfig?.gameCode)}
        badge={{ icon: Gamepad2, label: gameName }}
        title={competition.name}
        subtitle={competition.description}
        status={<NeonStatusBadge status={status} />}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
          <StatCard
            icon={Trophy}
            accent="prize"
            label="Prize pool"
            value={`${currencySymbol}${(competition.prizePool ?? 0).toLocaleString()}`}
          />
          <StatCard
            icon={Link2}
            accent="entry"
            label="Entry fee"
            value={
              competition.entryFee
                ? `${currencySymbol}${competition.entryFee.toLocaleString()}`
                : "Free"
            }
          />
          <StatCard
            icon={Users}
            accent="players"
            label="Players"
            value={`${competition.currentParticipants ?? 0} / ${competition.maxParticipants ?? 0}`}
            note={
              status === "upcoming" && competition.minParticipants > 0 ? (
                <p
                  className={`mt-2 text-xs ${
                    (competition.currentParticipants ?? 0) <
                    competition.minParticipants
                      ? "text-orange-400"
                      : "text-emerald-400"
                  }`}
                >
                  Minimum {competition.minParticipants}
                  {(competition.currentParticipants ?? 0) <
                  competition.minParticipants
                    ? " - needs more players"
                    : " - reached"}
                </p>
              ) : undefined
            }
          />
          {/*
            The score, not PnL. A puzzle has no profit and loss, and `05` section 10 makes this a
            binding rule rather than a style point: every figure is either generalised across
            games or explicitly scoped to one. There is no third option, and the failure mode of
            getting it wrong is not a crash - a trading-only figure keeps computing and keeps
            rendering.

            A dash, never a zero, for a player with no scored round. Same read-side rule as the
            leaderboard cell and the dashboard card: an absent score and a score of nothing are
            different facts, and conflating them is what made every provider participant tie.

            THAT SENTENCE WAS FALSE FOR A DAY, and the correction is left visible because the
            next reader needs to know it was once believed. The service defaulted the field to
            nought before the payload left it, so this tile showed `0` to a player who had not
            played and the dash was unreachable. Fixed with the seat and the schema in R50 -
            all three had to change, since any one of them supplying a zero is enough.
          */}
          {isUserIn ? (
            <StatCard
              icon={Gamepad2}
              accent="score"
              label="Your score"
              value={
                typeof state?.participantScore === "number"
                  ? state.participantScore.toLocaleString()
                  : "-"
              }
            />
          ) : (
            <StatCard
              icon={Clock}
              accent={isCancelled ? "ended" : isActive ? "entry" : "waiting"}
              label={
                isCancelled || isCompleted
                  ? "Status"
                  : isActive
                    ? "Time remaining"
                    : "Starts in"
              }
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
      </NeonHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <NeonPanel
            icon={Trophy}
            accent="prize"
            title="Leaderboard"
            action={
              /*
                "players", never "traders". The trading lobby's equivalent pill says traders, and
                copying it wholesale would put a trading label in the one place a player is
                certain to read.
              */
              <NeonCountPill>{leaderboard.length} players</NeonCountPill>
            }
          >
            <ProviderLeaderboard
              rows={leaderboard}
              currentUserId={userId}
              scoreLabel={scoreLabel}
            />
          </NeonPanel>
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
            disabled - after a provider enabled with no adapter and the Edit button withheld from
            a provider contest. A greyed-out button teaches the player nothing and sends them to
            support; this at least tells an operator what is missing.
          */}
          {isUserIn && !canLaunch && (
            <StatusCard
              icon={TriangleAlert}
              accent="waiting"
              title="This competition cannot start a round yet"
              detail="The game details needed to start a round are missing. Nothing has been charged for an attempt. Please contact support."
            />
          )}

          {/*
            THE PRIZE TABLE, which this lobby did not have at all - a player could see the pool
            and the entry fee and had no way to learn what finishing second was worth.

            It is the SAME component the trading lobby's sidebar renders, moved out of
            `components/trading/lobby/` rather than reimplemented. Nothing in the calculation is
            about trading: it reads the pool, the configured shares, the participant count and
            the platform fee, and a provider contest carries all four in the same fields. A
            second copy of a payout calculation is the shape behind four defects here.

            Rendered only when shares are configured. A contest with none is a legitimate free
            or practice contest, and an empty panel headed "Prize distribution" reads as data
            that failed to load.
          */}
          {(competition.prizeDistribution?.length ?? 0) > 0 && (
            <NeonPanel icon={Gift} accent="prize" title="Prize distribution">
              <PrizeTable
                competition={competition}
                currSymbol={currencySymbol}
              />
            </NeonPanel>
          )}

          {(playWindowStart || playWindowEnd) && (
            <NeonPanel icon={Clock} accent="players" title="Play window">
              <div className="space-y-2">
                {playWindowStart && (
                  <NeonRow label="Opens" value={playWindowStart} />
                )}
                {playWindowEnd && (
                  <NeonRow label="Closes" value={playWindowEnd} />
                )}
                {/*
                  A COUNTDOWN FOR A PLAYER WHO HAS ALREADY JOINED, which this lobby did not
                  have. The hero's fourth tile counts down only for someone who has NOT
                  entered - once they do, it is replaced by their score, so the player with
                  the most reason to watch the clock was the one shown no clock at all.

                  It is the same `InlineCountdown` the trading lobby and the hero tile use.
                  A third implementation of "2d 4h" would be a third place for the wording to
                  drift, which is the shape behind several defects here.
                */}
                {countdownTarget && !isCompleted && !isCancelled && (
                  <NeonRow
                    label={isActive ? "Closes in" : "Opens in"}
                    accent="score"
                    value={
                      <InlineCountdown
                        targetDate={new Date(countdownTarget).toISOString()}
                        type={isActive ? "end" : "start"}
                      />
                    }
                  />
                )}
                {/*
                  THE SECOND DEADLINE, AND THE ONE PLAYERS MISS. Under `reserve_full_round` the
                  last attempt has to begin a full round before the window shuts, so a player
                  watching "Closes in 4m" on a game whose rounds run five minutes has in fact
                  already missed it. Stating the contest's close and staying silent about this
                  one is how a player arrives at the play screen to find Play disabled with
                  time visibly left on the clock they were shown.

                  `zeroLabel` is "Passed" rather than "Ended", because the contest has not
                  ended - only the chance to open a new round has, and a player with a round
                  already running may still finish it.
                */}
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
              {/*
                THIS NOTE USED TO SAY THE PLAY WINDOW COULD BE NARROWER THAN THE COMPETITION,
                and it was true when an operator set four separate dates. Since the window is
                derived from the contest clock (`12` s2.3) it is false, and a player-facing
                caution that has become false is worse than none - it sends somebody looking
                for a second pair of times that no longer exists. Replaced rather than deleted,
                because the fact players actually need is what happens to a round still open
                when the clock runs out.
              */}
              {/*
                THE SECOND HALF OF THE SENTENCE DEPENDS ON THE POLICY, and getting it wrong is
                not harmless in either direction.

                Under `reserve_full_round` a round cannot still be running at the close - that
                is the entire point of holding time back - so promising that it would be closed
                and scored describes a situation the contest has made impossible, and a player
                reading it concludes they may start whenever they like. Under
                `until_window_closes` the opposite is true and must be said, because it is the
                fact that makes a shortened attempt worth taking at all.

                It defaults to the reserving wording for a player with no seat, matching the
                schema default rather than the wizard's.
              */}
              <NeonNote>
                Every player gets the same window.{" "}
                {reservesFullRound
                  ? "An attempt has to begin early enough to finish inside it, so the last one starts before the window shuts."
                  : "You can start an attempt at any time until it shuts, and anything still running then is closed with the competition and scored on what you managed."}
              </NeonNote>
            </NeonPanel>
          )}

          {state && (
            <NeonPanel icon={RotateCcw} accent="score" title="Your attempts">
              <NeonRow
                label="Remaining"
                accent="score"
                value={`${state.attemptsRemaining} of ${state.attemptsPermitted}`}
              />
              {attemptsCopy && <NeonNote>{attemptsCopy}</NeonNote>}
              <NeonNote>
                An attempt is used the moment a round opens, even if you leave
                before finishing.
              </NeonNote>
            </NeonPanel>
          )}

          {unresolvedCopy && (
            <NeonPanel
              icon={Info}
              accent="waiting"
              title="If a round does not finish"
            >
              <NeonNote>{unresolvedCopy}</NeonNote>
            </NeonPanel>
          )}
        </div>
      </div>

      {/*
        The sheet's footer help strip. It points at `/help/competitions`, which really exists and
        is where the trading lobby's help link already goes - the mock's "View Rules" button does
        NOT have a destination yet, because a provider title has no rules surface: the catalogue
        stores a `description` and no rules summary or how-to-play. Building one is real
        outstanding work rather than a styling gap, so this offers the honest destination instead
        of a button that opens nothing.
      */}
      <div
        className={`${NEON_PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
      >
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-4 w-4 text-sky-300" />
          <p className="text-xs text-gray-400">
            Need help? Read how competitions work, or contact support.
          </p>
        </div>
        <NeonPill href="/help/competitions" icon={LifeBuoy} label="Help centre" />
      </div>
    </div>
  );
}
