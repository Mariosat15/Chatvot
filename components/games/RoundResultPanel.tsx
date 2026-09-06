"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Loader2, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  round: PlayerRoundView | null;
  state: PlayState;
  onPlayAgain: () => void;
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
  round,
  state,
  onPlayAgain,
}: RoundResultPanelProps) {
  if (confirming) {
    return (
      <div className="space-y-3 rounded-xl border border-gray-700 bg-gray-800/50 p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-100">Confirming your result</h2>
        <p className="text-sm text-gray-400">
          We are waiting for the game to confirm your score with us. This usually takes a
          few seconds.
        </p>
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
    <div className="space-y-5 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${tone}`} />
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{heading}</h2>
          <p className="mt-1 text-sm text-gray-400">{detail}</p>
        </div>
      </div>

      {typeof round.score === "number" && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">This round</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">{round.score}</p>
          <p className="mt-2 text-xs text-gray-400">
            Your competition score: {state.participantScore}
          </p>
        </div>
      )}

      {/*
        The breakdown is rendered generically - key and value, whatever the game sent - because
        a renderer that knows a game's field names is a renderer that has to change for every
        new game, which is exactly the "no additional coding" property this platform is built
        around. It is display only and never reaches ranking.
      */}
      {round.scoreBreakdown && Object.keys(round.scoreBreakdown).length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            How you played
          </p>
          <dl className="space-y-1">
            {Object.entries(round.scoreBreakdown).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <dt className="text-gray-400">{key}</dt>
                <dd className="text-gray-200">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canPlayAgain && (
          <Button onClick={onPlayAgain} className="flex-1 bg-blue-500 hover:bg-blue-600">
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
