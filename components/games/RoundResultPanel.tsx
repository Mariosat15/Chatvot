"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Loader2, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import { NEON_INSET, NEON_STAGE_PANEL } from "@/components/neon/tokens";
import { humanizeMetric } from "@/lib/utils/humanize-metric";
import type { PlayState, PlayerRoundView } from "./play-state";

/**
 * What happened, once our own servers can say so.
 *
 * THE PANEL NEVER SHOWS A SCORE THE FRAME REPORTED. Everything here comes from
 * `GET /api/competitions/[id]/rounds`, which reads the round the signed provider callback
 * wrote. That is the whole reason for the confirming state: the game has stopped, the player
 * wants a number, and we do not have one yet.
 *
 * AN UNCONFIRMED ROUND IS NOT AN ERROR, and saying so plainly is the point. A provider can
 * genuinely fail to report - the reconciliation net and the three unresolved-round policies
 * exist for exactly that - so the honest message is that the result is still being confirmed and
 * the contest's own rule will apply. A round silently scored zero is indistinguishable, from the
 * player's seat, from being cheated, which is why they are always told.
 */

interface RoundResultPanelProps {
  competitionId: string;
  competitionName: string;
  confirming: boolean;
  /** Why we are waiting. `null` when not confirming. See `ConfirmReason` on the host. */
  confirmReason?: "finished" | "left" | null;
  round: PlayerRoundView | null;
  state: PlayState;
  onPlayAgain: () => void;
}

/**
 * What to say while the signed result is still outstanding.
 *
 * TWO ROUTES REACH THIS STATE AND THEY ARE NOT THE SAME SITUATION. A game that ended has a score
 * on its way. A player who pressed "Leave the game" mostly did so because the game never
 * started - that button is the only affordance the stall panel offers - so promising to confirm
 * "your score" describes something that does not exist, and the wait then reads as the site
 * being broken rather than as the round being settled by rule.
 */
function confirmingCopy(reason: "finished" | "left" | null | undefined): {
  heading: string;
  detail: string;
} {
  if (reason === "left") {
    return {
      heading: "Checking how your round ended",
      detail:
        "You have left the game. Your attempt was already open, so the round stays open and this competition's rules decide the outcome - you do not need to wait here for it.",
    };
  }
  return {
    heading: "Confirming your result",
    detail:
      "We are waiting for the game to confirm your score with us. This usually takes a few seconds, and you do not need to wait here for it.",
  };
}

/** The player-facing meaning of each terminal status. */
function describe(round: PlayerRoundView): {
  icon: typeof CheckCircle2;
  tone: string;
  heading: string;
  detail: string;
} {
  switch (round.status) {
    case "completed":
      return {
        icon: Trophy,
        tone: "text-emerald-400",
        heading: "Round complete",
        detail: "Your score has been added to this competition.",
      };
    case "voided":
      // Reason this is stated rather than glossed: a voided round returns the attempt, which is
      // materially good news and the player would otherwise assume the opposite.
      return {
        icon: CheckCircle2,
        tone: "text-blue-400",
        heading: "Round cancelled",
        detail:
          "This round was cancelled and does not count against your attempts. You can play again.",
      };
    case "abandoned":
      return {
        icon: XCircle,
        tone: "text-amber-400",
        heading: "Round not finished",
        detail: "This round was not completed, so it scores nothing. The attempt has been used.",
      };
    case "expired":
      return {
        icon: Clock3,
        tone: "text-amber-400",
        heading: "Round ran out of time",
        detail: "This round expired before it was finished, so it scores nothing.",
      };
    case "unresolved":
      return {
        icon: Clock3,
        tone: "text-amber-400",
        heading: "Result not received",
        detail:
          "The game did not report your result. This competition's rules decide what happens next, and you will be told the outcome.",
      };
    default:
      return {
        icon: Clock3,
        tone: "text-gray-400",
        heading: "Round in progress",
        detail: "This round has not finished yet.",
      };
  }
}

export function RoundResultPanel({
  competitionId,
  competitionName,
  confirming,
  confirmReason,
  round,
  state,
  onPlayAgain,
}: RoundResultPanelProps) {
  if (confirming) {
    const { heading, detail } = confirmingCopy(confirmReason);
    return (
      <div className={`space-y-3 p-8 text-center ${NEON_STAGE_PANEL}`}>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-100">{heading}</h2>
        <p className="text-sm text-gray-400">{detail}</p>
        {/*
          THIS LINK IS THE FIX FOR A DEAD END, and the poll budget is why it is needed rather
          than merely nice. Polling runs for sixty seconds before the panel below replaces this
          one, so a player who pressed "Leave the game" was held on a spinner with no control of
          any kind for a full minute - and they pressed it precisely because they had decided the
          game was not working. Leaving early costs them nothing: the result is delivered by the
          provider's signed callback into our own database, read back by the contest screens, and
          settled by the unresolved-round policy if it never arrives. Nothing about it depends on
          this page staying open, which is exactly what the copy above now says.
        */}
        <Link href={`/competitions/${competitionId}`} className="inline-block pt-2">
          <Button variant="outline">Back to {competitionName}</Button>
        </Link>
      </div>
    );
  }

  // No round means the poll budget ran out while the round was still live. Truthful, not
  // reassuring - it genuinely has not resolved.
  if (!round) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="font-semibold text-amber-300">
              Your result is still being confirmed
            </h2>
            <p className="mt-1 text-sm text-amber-200/80">
              The game has not reported your score to us yet. You do not need to do
              anything — we keep checking, and this competition&apos;s rules cover what
              happens if it never arrives. Your standing will update automatically.
            </p>
          </div>
        </div>
        <Link href={`/competitions/${competitionId}`}>
          <Button variant="outline" className="w-full">
            Back to {competitionName}
          </Button>
        </Link>
      </div>
    );
  }

  const { icon: Icon, tone, heading, detail } = describe(round);
  const canPlayAgain = state.attemptsRemaining > 0;

  return (
    <div className={`space-y-5 p-6 ${NEON_STAGE_PANEL}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${tone}`} />
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{heading}</h2>
          <p className="mt-1 text-sm text-gray-400">{detail}</p>
        </div>
      </div>

      {typeof round.score === "number" && (
        <div className={`p-4 ${NEON_INSET}`}>
          <p className="text-xs uppercase tracking-wide text-gray-500">This round</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">{round.score}</p>
          {/*
            A dash rather than a blank when the contest score is absent. This block only renders
            for a round that scored, so the two normally agree - but a round whose score was
            later voided leaves the participant with none, and "Your competition score: " with
            nothing after it reads as a broken page rather than as an answer.
          */}
          <p className="mt-2 text-xs text-gray-400">
            Your competition score:{" "}
            {typeof state.participantScore === "number"
              ? state.participantScore.toLocaleString()
              : "-"}
          </p>
        </div>
      )}

      {/*
        The breakdown is rendered generically - key and value, whatever the game sent - because
        a renderer that knows a game's field names is a renderer that has to change for every
        new game, which is exactly the "no additional coding" property this platform is built
        around. It is display only and never reaches ranking.

        The keys used to be printed VERBATIM, so a player read "penaltyMs 2400". `humanizeMetric`
        keeps the generic property - it knows no game's field names, and a test pins that - while
        splitting the identifier and reading a unit off the suffix. The alternative, a table of
        nice labels per metric, is what would have broken the property above.
      */}
      {round.scoreBreakdown && Object.keys(round.scoreBreakdown).length > 0 && (
        <div className={`p-4 ${NEON_INSET}`}>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            How you played
          </p>
          <dl className="space-y-1">
            {Object.entries(round.scoreBreakdown).map(([key, value]) => {
              const metric = humanizeMetric(key, value);
              return (
                <div key={key} className="flex justify-between text-xs">
                  <dt className="text-gray-400">{metric.label}</dt>
                  <dd className="text-gray-200">{metric.value}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canPlayAgain && (
          <Button onClick={onPlayAgain} className={`flex-1 ${neonButtonClasses("action")}`}>
            Play another round
          </Button>
        )}
        <Link href={`/competitions/${competitionId}`} className="flex-1">
          <Button variant="outline" className="w-full">
            Back to {competitionName}
          </Button>
        </Link>
      </div>
    </div>
  );
}
