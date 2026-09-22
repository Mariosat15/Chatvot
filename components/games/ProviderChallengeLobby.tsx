import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Clock3,
  Gamepad2,
  Info,
  LifeBuoy,
  RotateCcw,
  Swords,
  TriangleAlert,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { connectToDatabase } from "@/database/mongoose";
import UTCClock from "@/components/trading/UTCClock";
import InlineCountdown from "@/components/trading/InlineCountdown";
import ChallengeEntryActions from "@/components/trading/ChallengeEntryActions";
import ContestCountdown from "@/components/games/ContestCountdown";
import GameRulesPanel from "@/components/games/GameRulesPanel";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { resolveProviderBanner } from "@/components/neon/banners";
import { NeonPill } from "@/components/neon/Buttons";
import {
  NeonCountPill,
  NeonNote,
  NeonPanel,
  NeonRow,
  StatCard,
  StatusCard,
} from "@/components/neon/Cards";
import { NEON_LABEL, NEON_PANEL, NEON_TABLE_HEAD, accentClasses } from "@/components/neon/tokens";
import { formatVolts } from "@/lib/utils/format-volts";
import { getTerms } from "@/lib/services/terminology.service";
import { getChallengePlayState } from "@/lib/services/games/challenge-round-status.service";
import { isProviderChallenge } from "@/lib/services/games/challenge-round-config";
import {
  challengeOpponentLabel,
  isUnclaimedOpenChallenge,
} from "@/lib/utils/open-challenge";
import {
  getGamePresentation,
  UNKNOWN_GAME_NAME,
} from "@/lib/services/games/game-presentation.service";
import { getChallengeRoundHistory } from "@/lib/services/games/challenge-results.service";
import {
  contestReservesFullRound,
  fullRoundCutoffMs,
} from "@/components/games/round-window";

/**
 * The provider-challenge branch of `/challenges/[id]`, the 1v1 sibling of
 * `ProviderContestLobby.tsx`.
 *
 * WHY A SEPARATE COMPONENT RATHER THAN A `variant` ON THE CONTEST LOBBY. A challenge has no
 * leaderboard, no participant list to page through, and exactly two named seats whose
 * relationship to the viewer (challenger or challenged, winner or loser) is the thing every
 * panel needs to know - a competition lobby has no such concept and forcing one component to
 * answer both questions would mean a `isChallenge` branch on nearly every panel inside it. The
 * two share styling (the Neon kit) and several read paths (`getGamePresentation`,
 * `getChallengePlayState`, `round-window.ts`), which is what is actually reused.
 *
 * SELF-CONTAINED DATA FETCHING, matching `ProviderContestLobby`: the page passes down only the
 * `challenge` and `participants` documents it already had to read to decide which lobby to
 * render, and this component reads its own `gamePresentation` and `playState` rather than
 * asking the page to know what a provider challenge lobby needs.
 *
 * `getChallengePlayState` IS GATED ON `participants.length > 0`, because that service's own
 * `not_a_participant` refusal exists for exactly the case this avoids calling it for: a
 * `pending` challenge has no `ChallengeParticipant` rows yet (they are created on accept), so
 * calling it before acceptance would be a guaranteed refusal on every single page view.
 */

interface ProviderChallengeLobbyProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  challenge: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participants: any[];
  userId: string;
}

/*
  Mirrored from `ProviderContestLobby.tsx` rather than extracted, on the same call that file's
  own header makes about `ATTEMPTS_POLICY_COPY`: this is a three-entry, one-line-each constant
  map, and pulling it into a shared module for two callers is a refactor outside this slice's
  scope. If a third caller ever needs it, that is the point to extract it.
*/
const ATTEMPTS_POLICY_COPY: Record<string, string> = {
  single: "One attempt, and the score from it is final.",
  best_of_n: "Your best attempt counts.",
  sum_of_n: "Every attempt is added together.",
};

function formatUTC(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

/*
  Mirrored from `ProviderResultsScreen.tsx` rather than exported and shared, for the same
  reason as `ATTEMPTS_POLICY_COPY` above: these are presentation-only label lookups (never a
  money or eligibility rule, which is the class of duplication this codebase's documentation
  repeatedly warns against), small enough that extracting a shared module for two call sites is
  a refactor outside this slice's scope.
*/
const ROUND_STATUS: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  completed: { label: "Scored", className: "text-emerald-400", icon: CheckCircle2 },
  unresolved: { label: "No result received", className: "text-amber-400", icon: Clock3 },
  expired: { label: "Ran out of time", className: "text-amber-400", icon: Clock3 },
  abandoned: { label: "Left unfinished", className: "text-gray-400", icon: XCircle },
  voided: { label: "Voided by an admin", className: "text-gray-400", icon: XCircle },
  launched: { label: "Never finished", className: "text-gray-400", icon: XCircle },
  pending: { label: "Never started", className: "text-gray-400", icon: XCircle },
};

function formatRoundDuration(ms?: number): string {
  if (!Number.isFinite(ms)) return "-";
  const seconds = (ms as number) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/** The score, or a dash. Never a zero standing in for an absence - R45's read side. */
function roundScoreText(score?: number): string {
  return Number.isFinite(score) ? String(score) : "-";
}

export default async function ProviderChallengeLobby({
  challenge,
  participants,
  userId,
}: ProviderChallengeLobbyProps) {
  await connectToDatabase();
  // Reason: X8 pass 3 — one getTerms() per lobby render.
  const terms = await getTerms();

  const presentation = await getGamePresentation(
    challenge?.gameConfig?.providerKey,
    challenge?.gameConfig?.gameCode,
  );

  const [playState, roundHistory] = await Promise.all([
    participants.length > 0
      ? getChallengePlayState(String(challenge._id), userId)
      : Promise.resolve(null),
    /*
      Gated on `participants.length > 0` exactly like `playState`: a pending challenge has no
      `ChallengeParticipant` row yet, and no `GameRound` can exist for a challenge nobody has
      accepted, so the query would only ever return an empty history - fetched anyway, it
      matters to distinguish "did not play" (a real absence) from a lookup that never ran.
    */
    participants.length > 0
      ? getChallengeRoundHistory(challenge, userId)
      : Promise.resolve(null),
  ]);
  const state = playState?.success ? playState.state : null;

  /*
    Two names for two questions, exactly as `ProviderContestLobby` draws the line between
    `hasProviderGameLabel` and `isProviderContest`: the page above already used the looser
    label check to decide which lobby to render, so this component can be reached by a
    challenge that is labelled "provider" but is missing the keys a round needs. `canLaunch`
    is the strict answer, and the warning card below is what a keyless challenge gets instead
    of a broken Play button.
  */
  const canLaunch = isProviderChallenge(challenge);

  const isChallenger = challenge.challengerId === userId;
  /*
    `isChallenged` was `!isChallenger`, which is only the same question while a challenge
    names two players. On an OPEN challenge a browsing player satisfies it and was shown
    "Challenge Received!" with a Decline button the route refuses - so the seat is resolved
    here, from the same predicate the accept route's atomic claim uses.
  */
  const openSeat = isUnclaimedOpenChallenge(challenge);
  const isChallenged =
    !isChallenger && String(challenge.challengedId ?? "") === String(userId);
  const opponentName = isChallenger
    ? challengeOpponentLabel(challenge.challengedName, challenge)
    : challenge.challengerName;
  const isWinner = challenge.winnerId === userId;
  const isLoser = challenge.loserId === userId;
  const isNoWinner = challenge.noWinner === true;
  const isTie = challenge.isTie === true;

  const myParticipant = participants.find(
    (p) => String(p.userId) === String(userId),
  );
  const opponentParticipant = participants.find(
    (p) => String(p.userId) !== String(userId),
  );

  const status = String(challenge.status ?? "");
  const isPending = status === "pending";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isDeclined = status === "declined";
  const isExpired = status === "expired";
  const isCancelled = status === "cancelled";

  const gameName =
    presentation.gameName === UNKNOWN_GAME_NAME ? terms.game : presentation.gameName;
  const scoreLabel = presentation.scoreType === "duration_ms" ? "Time" : "Score";

  const countdownTarget = isActive
    ? challenge.endTime
    : isPending
      ? challenge.acceptDeadline
      : null;
  const showCountdown = Boolean(countdownTarget) && (isPending || isActive);

  const playWindowStart = formatUTC(challenge.startTime);
  const playWindowEnd = formatUTC(challenge.endTime);
  const attemptsCopy = challenge.attemptsPolicy
    ? ATTEMPTS_POLICY_COPY[challenge.attemptsPolicy as string]
    : undefined;

  const playWindowEndMs = state?.playWindowEnd
    ? new Date(state.playWindowEnd).getTime()
    : null;
  const attemptCutoffMs = state
    ? fullRoundCutoffMs(playWindowEndMs, state.maxRoundSeconds)
    : null;
  const reservesFullRound = state
    ? contestReservesFullRound(state.roundStartPolicy)
    : true;

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
          Both players get the same window.{" "}
          {reservesFullRound
            ? "An attempt has to begin early enough to finish inside it, so the last one starts before the window shuts."
            : "You can start an attempt at any time until it shuts, and anything still running then is closed with the challenge and scored on what you managed."}
        </NeonNote>
      </>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col gap-4 overflow-x-hidden p-3 sm:gap-6 sm:p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <NeonPill
          href="/challenges"
          icon={ArrowLeft}
          label={`Back to ${terms.challenges}`}
        />
        <div className="hidden sm:block">
          <UTCClock />
        </div>
      </div>

      <NeonHero
        banner={resolveProviderBanner({
          bannerUrl: presentation?.bannerUrl,
          gameName: presentation?.gameName ?? gameName,
          gameCode: challenge?.gameConfig?.gameCode,
        })}
        badge={{ icon: Gamepad2, label: gameName }}
        title={`${terms.challenge} vs ${opponentName ?? terms.opponent}`}
        subtitle={
          isChallenger
            ? openSeat
              ? "You opened this to anyone"
              : `You challenged`
            : openSeat
              ? "Open to anyone"
              : `Challenged you`
        }
        status={<NeonStatusBadge status={status} />}
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <StatCard
            icon={Trophy}
            accent="prize"
            label="Winner prize"
            value={formatVolts(challenge.winnerPrize ?? 0)}
          />
          <StatCard
            icon={Swords}
            accent="entry"
            label="Entry fee"
            value={
              challenge.entryFee ? formatVolts(challenge.entryFee) : "Free"
            }
          />
          <StatCard
            icon={Users}
            accent="players"
            label="Opponent"
            value={opponentName ?? "-"}
          />
          {participants.length > 0 ? (
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
              accent={
                isCancelled || isDeclined || isExpired
                  ? "ended"
                  : isActive
                    ? "entry"
                    : "waiting"
              }
              label={
                isCancelled || isCompleted || isDeclined || isExpired
                  ? "Status"
                  : isActive
                    ? "Time remaining"
                    : "Accept by"
              }
              value={
                isCancelled
                  ? "Cancelled"
                  : isDeclined
                    ? "Declined"
                    : isExpired
                      ? "Expired"
                      : isCompleted
                        ? "Completed"
                        : countdownTarget
                          ? (
                              <InlineCountdown
                                targetDate={new Date(countdownTarget).toISOString()}
                                type={isActive ? "end" : "start"}
                              />
                            )
                          : "-"
              }
            />
          )}
        </div>
      </NeonHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <GameRulesPanel presentation={presentation} layout="wide" />

          {/*
            Only drawn once the challenge is completed - matching the trading page's own "Final
            Results" card, which is likewise gated on `isCompleted`. A challenge in progress has
            no outcome to report and a `-` badge on both blocks would just be noise.
          */}
          {isCompleted && (myParticipant || opponentParticipant) && (
            <NeonPanel icon={Swords} accent="score" title="Head-to-head">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    key: "me",
                    name: "You",
                    participant: myParticipant,
                    isWinnerBlock: isWinner,
                  },
                  {
                    key: "opponent",
                    name: opponentName ?? "Opponent",
                    participant: opponentParticipant,
                    isWinnerBlock: isLoser,
                  },
                ].map((block) => {
                  const badgeAccent = isNoWinner
                    ? "ended"
                    : isTie
                      ? "waiting"
                      : block.isWinnerBlock
                        ? "entry"
                        : "ended";
                  const badgeLabel = isNoWinner
                    ? "DISQUALIFIED"
                    : isTie
                      ? "TIE"
                      : block.isWinnerBlock
                        ? "WINNER"
                        : "LOST";
                  const classes = accentClasses(badgeAccent);
                  const score = block.participant?.score;
                  const disqualificationReason =
                    block.participant?.disqualificationReason;

                  return (
                    <div
                      key={block.key}
                      className={`${NEON_PANEL} p-3 sm:p-4 ${
                        block.isWinnerBlock && !isNoWinner && !isTie
                          ? accentClasses("entry").surface
                          : !block.isWinnerBlock && !isNoWinner && !isTie
                            ? accentClasses("ended").surface
                            : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-200">
                          {block.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${classes.surface} ${classes.text}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      <div className="mt-3">
                        <p className={NEON_LABEL}>{scoreLabel}</p>
                        <p className="text-lg font-bold text-gray-100">
                          {typeof score === "number" ? score.toLocaleString() : "-"}
                        </p>
                      </div>
                      {disqualificationReason && (
                        <p className="mt-2 text-xs text-rose-400">
                          Disqualified: {disqualificationReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </NeonPanel>
          )}

          {/*
            YOUR OWN ROUND HISTORY ONLY, DELIBERATELY - the same scope the trading challenge
            page keeps: both players' AGGREGATE stats are shown above (in the head-to-head
            panel, or as `challengerFinalStats` / `challengedFinalStats` on the trading path),
            but a trade-by-trade or round-by-round breakdown is only ever a player's own to
            read. `getChallengeRoundHistory` is called with the viewer's `userId`, so this is
            already scoped correctly - there is no `myParticipant` / `opponentParticipant`
            choice to make here.

            Shown whenever any round exists, not gated to `isCompleted`: a player partway
            through a `best_of_n` or `sum_of_n` challenge benefits from seeing which attempts
            they have already spent at least as much as one who has finished.
          */}
          {roundHistory && roundHistory.rounds.length > 0 && (
            <NeonPanel
              icon={Clock3}
              accent="waiting"
              title="Your round history"
              action={
                <NeonCountPill>
                  {roundHistory.rounds.length}{" "}
                  {roundHistory.rounds.length === 1 ? "round" : "rounds"}
                </NeonCountPill>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className={NEON_TABLE_HEAD}>
                      <th className="px-3 py-2 text-left">Attempt</th>
                      <th className="px-3 py-2 text-left">Outcome</th>
                      <th className="px-3 py-2 text-right">{scoreLabel}</th>
                      <th className="px-3 py-2 text-right">Time taken</th>
                      <th className="px-3 py-2 text-right">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundHistory.rounds.map((round) => {
                      const roundStatus =
                        ROUND_STATUS[round.status] ?? {
                          label: round.status,
                          className: "text-gray-400",
                          icon: Info,
                        };
                      const StatusIcon = roundStatus.icon;

                      return (
                        <tr
                          key={round.attemptNumber}
                          className="border-t border-[#161E36]"
                        >
                          <td className="px-3 py-2.5 text-sm text-gray-200">
                            #{round.attemptNumber}
                            {round.isCounted && (
                              <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                                Counted
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`flex items-center gap-1.5 text-xs ${roundStatus.className}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {roundStatus.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-100">
                            {roundScoreText(round.score)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                            {formatRoundDuration(round.durationMs)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                            {round.completedAt
                              ? new Date(round.completedAt).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {roundHistory.attemptsPolicy !== "single" && (
                <p className="mt-3 text-xs text-gray-500">
                  {roundHistory.attemptsPolicy === "sum_of_n"
                    ? `Every scored round is added together (up to ${roundHistory.attemptsAllowed} attempts).`
                    : `Your ${roundHistory.scoreDirection === "lower_is_better" ? "lowest" : "highest"} single round counts, out of up to ${roundHistory.attemptsAllowed} attempts.`}
                </p>
              )}
            </NeonPanel>
          )}
        </div>

        <div className="space-y-6">
          <ChallengeEntryActions
            challengeId={String(challenge._id)}
            status={challenge.status}
            isChallenger={isChallenger}
            isChallenged={isChallenged}
            openSeat={openSeat}
            isProviderGame
          />

          {/*
            Gated the same way `ProviderContestLobby` gates its own warning: only once the
            viewer holds a seat (`participants.length > 0`, the challenge equivalent of
            `isUserIn`) and only when the strict check fails despite the loose label passing.
            Nothing has been charged for an attempt at this point - the entry fee was already
            taken on accept, which is unrelated to whether a round can be launched.
          */}
          {participants.length > 0 && !canLaunch && (
            <StatusCard
              icon={TriangleAlert}
              accent="waiting"
              title="This challenge cannot start a round yet"
              detail="The game details needed to start a round are missing. Nothing has been charged for an attempt. Please contact support."
            />
          )}

          {showCountdown && (
            <ContestCountdown
              target={countdownTarget}
              serverNow={state?.serverNow}
              label={isActive ? "Time remaining" : "Accept deadline"}
              variant={isActive ? "end" : "start"}
              details={scheduleDetails}
            />
          )}

          {!showCountdown && scheduleDetails && (
            <NeonPanel icon={Clock} accent="players" title="Schedule">
              {scheduleDetails}
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

          <NeonPanel icon={Trophy} accent="prize" title="Prize breakdown">
            <NeonRow label="Total pool" value={formatVolts(challenge.prizePool ?? 0)} />
            <NeonRow
              label={`Platform fee (${challenge.platformFeePercentage ?? 0}%)`}
              value={`-${formatVolts(challenge.platformFeeAmount ?? 0)}`}
            />
            <NeonRow
              label="Winner takes"
              accent="prize"
              value={formatVolts(challenge.winnerPrize ?? 0)}
            />
          </NeonPanel>
        </div>
      </div>

      <div
        className={`${NEON_PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
      >
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-4 w-4 text-sky-300" />
          <p className="text-xs text-gray-400">
            Need help? Read how challenges work, or contact support.
          </p>
        </div>
        <NeonPill href="/help" icon={LifeBuoy} label="Help centre" />
      </div>
    </div>
  );
}
