import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Info,
  LayoutDashboard,
  ListOrdered,
  Repeat,
  Trophy,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  NeonPanel,
  NeonRow,
  NeonCountPill,
  StatCard,
} from "@/components/neon/Cards";
import { NeonButton } from "@/components/neon/Buttons";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { providerBanner } from "@/components/neon/banners";
import { NEON_TABLE_HEAD } from "@/components/neon/tokens";
import { humanizeMetric } from "@/lib/utils/humanize-metric";
import { competitionDetailsHref } from "@/lib/utils/competition-details-view";
import { formatVolts } from "@/lib/utils/format-volts";
import type { ProviderContestResults } from "@/lib/services/games/contest-results.service";

/**
 * A player's own record of a provider contest they entered, after it has finished.
 *
 * THE PROVIDER EQUIVALENT OF THE TRADING RESULTS SCREEN, which is the trading post-mortem and
 * only that: capital, ROI, win rate, profit factor and a trade-by-trade table. A puzzle has
 * none of those, which is why that page threw on every provider contest and why it now hands
 * off here rather than trying to generalise. Chapter 05 section 10's rule applies to a whole
 * screen as readily as to one figure: generalised, explicitly scoped, or absent.
 *
 * The mapping from the trading screen, so the two stay recognisably the same product:
 *
 *  | Trading                  | Here                                    |
 *  |--------------------------|-----------------------------------------|
 *  | Final Rank               | Final Rank (unchanged)                  |
 *  | Total P&L                | Final score                             |
 *  | Win Rate                 | Rounds played                           |
 *  | Total Trades             | Best round                              |
 *  | Account Summary          | How your score was worked out           |
 *  | Trading Statistics       | The counted round's own breakdown       |
 *  | Trade History            | Round history                           |
 *
 * IT RENDERS WHAT IT IS GIVEN AND COMPUTES NO MONEY. Rank, prize and eligibility are settled
 * facts read from the stored leaderboard. A screen that recomputed them could disagree with
 * what the player was actually paid, which is the reporting defect R46 was about.
 */

function formatDuration(ms?: number): string {
  if (!Number.isFinite(ms)) return "-";
  const seconds = (ms as number) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/** The score, or a dash. Never a zero standing in for an absence - that is R45's read side. */
function scoreText(score?: number): string {
  return Number.isFinite(score) ? String(score) : "-";
}

const ROUND_STATUS: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  completed: {
    label: "Scored",
    className: "text-emerald-400",
    icon: CheckCircle2,
  },
  unresolved: {
    label: "No result received",
    className: "text-amber-400",
    icon: Clock3,
  },
  expired: { label: "Ran out of time", className: "text-amber-400", icon: Clock3 },
  abandoned: { label: "Left unfinished", className: "text-gray-400", icon: XCircle },
  voided: { label: "Voided by an admin", className: "text-gray-400", icon: XCircle },
  launched: { label: "Never finished", className: "text-gray-400", icon: XCircle },
  pending: { label: "Never started", className: "text-gray-400", icon: XCircle },
};

export function ProviderResultsScreen({
  results,
  contestId,
  contestName,
  description,
  startTime,
  endTime,
  gameCode,
  creditSymbol,
  refundedAmount,
}: {
  results: ProviderContestResults;
  contestId: string;
  contestName: string;
  description?: string;
  startTime: string;
  endTime: string;
  gameCode?: string | null;
  /** `AppSettings.credits.symbol`. Replaced a `currencySymbol` prop handed the fiat symbol. */
  creditSymbol?: string;
  /**
   * What this player was actually returned, from the ledger row settlement wrote.
   *
   * A prop of its own rather than a field on `results`, because the read has to live beside
   * the writer: chapter 11 seam 4 bans money imports from `lib/services/games/`, where the
   * rest of this screen's data comes from. See `findUnscoredRefund`.
   */
  refundedAmount?: number;
}) {
  const scoredRounds = results.rounds.filter((r) =>
    Number.isFinite(r.score),
  );
  const lowerIsBetter = results.scoreDirection === "lower_is_better";

  const bestRound = scoredRounds.length
    ? scoredRounds.reduce((best, candidate) =>
        (lowerIsBetter
          ? (candidate.score as number) < (best.score as number)
          : (candidate.score as number) > (best.score as number))
          ? candidate
          : best,
      )
    : undefined;

  const counted = results.rounds.find((r) => r.isCounted);
  const won = results.prizeAmount > 0;
  const neverScored = scoredRounds.length === 0;

  /*
    How the contest score was reached, in the contest's own vocabulary. Written from the policy
    rather than hardcoded, because a player whose best attempt was their second needs to know
    the first was discarded on purpose - otherwise a lower number on screen than they remember
    scoring reads as the platform losing their result.
  */
  const policyExplanation =
    results.attemptsPolicy === "sum_of_n"
      ? `Every scored round added together (up to ${results.attemptsAllowed} attempts).`
      : results.attemptsPolicy === "best_of_n"
        ? `Your ${lowerIsBetter ? "lowest" : "highest"} single round counted, out of up to ${results.attemptsAllowed} attempts.`
        : "One attempt only - that round was your score.";

  return (
    <div className="space-y-4">
      {/*
        The hero, deliberately the same shape as the trading results header: the completed
        badge, the name, the schedule and the prize call-out. It reads from the neon kit's hero
        so a provider game's artwork appears here as it does on the lobby - a results screen
        that looks like a different product from the lobby the player just left is the kind of
        difference that gets reported as a broken page.
      */}
      <NeonHero
        banner={providerBanner(gameCode)}
        title={contestName}
        subtitle={description}
        status={<NeonStatusBadge status="completed" />}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-300">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(startTime).toLocaleString()} -{" "}
            {new Date(endTime).toLocaleString()}
          </span>
          {won && (
            <span className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/15 px-3 py-1.5 text-sm font-bold text-yellow-300">
              <Trophy className="h-4 w-4" />
              You won {formatVolts(results.prizeAmount, { symbol: creditSymbol })}
            </span>
          )}
        </div>
      </NeonHero>

      {/* ---------- The four headline figures ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          accent="prize"
          label="Final rank"
          value={results.rank ? `#${results.rank}` : "Unplaced"}
          note={
            <p className="mt-2 text-xs text-gray-500">
              {results.totalParticipants > 0
                ? `Out of ${results.totalParticipants} player${results.totalParticipants === 1 ? "" : "s"}`
                : "No other players"}
              {results.isTied ? " - rank shared" : ""}
            </p>
          }
        />
        <StatCard
          icon={BarChart3}
          accent="score"
          label="Final score"
          value={scoreText(results.finalScore)}
          note={
            <p className="mt-2 text-xs text-gray-500">
              {lowerIsBetter ? "Lower is better" : "Higher is better"}
            </p>
          }
        />
        <StatCard
          icon={Repeat}
          accent="players"
          label="Rounds played"
          value={`${results.rounds.length}`}
          note={
            <p className="mt-2 text-xs text-gray-500">
              {scoredRounds.length} scored
              {results.attemptsAllowed > 1
                ? ` of ${results.attemptsAllowed} allowed`
                : ""}
            </p>
          }
        />
        <StatCard
          icon={Award}
          accent={won ? "prize" : "players"}
          label="Prize won"
          value={
            won ? formatVolts(results.prizeAmount, { symbol: creditSymbol }) : "-"
          }
          valueAccent={won ? "prize" : undefined}
          note={
            <p className="mt-2 text-xs text-gray-500">
              {won ? "Paid to your wallet" : "No prize this time"}
            </p>
          }
        />
      </div>

      {/*
        THE REFUND EXPLANATION the owner asked for. It is driven by a ledger row, never by the
        contest's policy field - the policy says what was configured and the row says what
        actually happened to this player's money. A partial refund with no explanation reads as
        a billing error, and the amount being less than the entry fee is the part that needs
        saying out loud.
      */}
      {refundedAmount !== undefined && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
          <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div>
            <p className="text-sm font-semibold text-sky-200">
              {formatVolts(refundedAmount, { symbol: creditSymbol })} was returned to you
            </p>
            <p className="mt-1 text-xs text-sky-200/80">
              No player in this competition recorded a score, so there was no
              winner. Your entry fee has been returned less the platform fee.
              This is usually caused by the game provider failing to report
              results rather than by anything you did.
            </p>
          </div>
        </div>
      )}

      {/*
        The disqualification reason, shown only when the player was actually excluded. R45 made
        "no score recorded" a disqualification, so this is the sentence that stops a player
        concluding they were penalised for something.
      */}
      {results.qualificationStatus === "disqualified" &&
        results.disqualificationReason && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                You were not eligible for a prize
              </p>
              <p className="mt-1 text-xs text-amber-200/80">
                {results.disqualificationReason}
                {neverScored
                  ? ". Prizes go to players who finished at least one round with a score."
                  : "."}
              </p>
            </div>
          </div>
        )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------- How the score was worked out ---------- */}
        <NeonPanel icon={ListOrdered} accent="players" title="How your score was worked out">
          <div className="space-y-2">
            <NeonRow
              label="Scoring rule"
              value={
                results.attemptsPolicy === "sum_of_n"
                  ? "Sum of attempts"
                  : results.attemptsPolicy === "best_of_n"
                    ? "Best attempt"
                    : "Single attempt"
              }
            />
            <NeonRow
              label="Rounds that scored"
              value={`${scoredRounds.length} of ${results.rounds.length}`}
            />
            <NeonRow
              label={lowerIsBetter ? "Fastest round" : "Best round"}
              value={
                bestRound
                  ? `${scoreText(bestRound.score)} (attempt ${bestRound.attemptNumber})`
                  : "-"
              }
            />
            <NeonRow
              label="Counted toward the leaderboard"
              value={scoreText(results.finalScore)}
              accent="players"
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">{policyExplanation}</p>
        </NeonPanel>

        {/* ---------- The counted round's own breakdown ---------- */}
        <NeonPanel icon={Gamepad2} accent="score" title="Your best round in detail">
          {counted?.scoreBreakdown &&
          Object.keys(counted.scoreBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(counted.scoreBreakdown).map(([key, value]) => {
                const metric = humanizeMetric(key, value);
                return (
                  <NeonRow key={key} label={metric.label} value={metric.value} />
                );
              })}
            </div>
          ) : results.attemptsPolicy === "sum_of_n" && scoredRounds.length > 0 ? (
            /*
              `sum_of_n` marks no single round as counted, deliberately - every scored round
              contributed - so there is no one breakdown to show. Listing each round's score is
              the honest substitute rather than picking one arbitrarily.
            */
            <div className="space-y-2">
              {scoredRounds.map((round) => (
                <NeonRow
                  key={round.attemptNumber}
                  label={`Attempt ${round.attemptNumber}`}
                  value={scoreText(round.score)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {neverScored
                ? "None of your rounds finished with a score, so there is nothing to break down."
                : "The game did not send a detailed breakdown for this round."}
            </p>
          )}
        </NeonPanel>
      </div>

      {/* ---------- Round history ---------- */}
      <NeonPanel
        icon={Clock3}
        accent="waiting"
        title="Round history"
        action={
          <NeonCountPill>
            {results.rounds.length}{" "}
            {results.rounds.length === 1 ? "round" : "rounds"}
          </NeonCountPill>
        }
      >
        {results.rounds.length === 0 ? (
          <p className="text-sm text-gray-400">
            You did not start a round in this competition.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className={NEON_TABLE_HEAD}>
                  <th className="px-3 py-2 text-left">Attempt</th>
                  <th className="px-3 py-2 text-left">Outcome</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">Time taken</th>
                  <th className="px-3 py-2 text-right">Finished</th>
                </tr>
              </thead>
              <tbody>
                {results.rounds.map((round) => {
                  const status =
                    ROUND_STATUS[round.status] ?? {
                      label: round.status,
                      className: "text-gray-400",
                      icon: Info,
                    };
                  const StatusIcon = status.icon;

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
                          className={`flex items-center gap-1.5 text-xs ${status.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-100">
                        {scoreText(round.score)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                        {formatDuration(round.durationMs)}
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
        )}
      </NeonPanel>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <NeonButton
          // Same missing query string as the header link: without it the lobby sends a
          // participant of a finished contest back to this screen, so the button did nothing.
          href={competitionDetailsHref(contestId)}
          tone="outline"
          icon={ListOrdered}
          label="Full leaderboard"
          sublabel={contestName}
        />
        <NeonButton
          href="/competitions"
          tone="quiet"
          icon={Gamepad2}
          label="Browse competitions"
        />
        <NeonButton
          href="/dashboard"
          tone="quiet"
          icon={LayoutDashboard}
          label="Dashboard"
        />
      </div>
    </div>
  );
}
