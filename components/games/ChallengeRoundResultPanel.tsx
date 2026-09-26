"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Loader2, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import { NEON_INSET, NEON_STAGE_PANEL } from "@/components/neon/tokens";
import { humanizeMetric } from "@/lib/utils/humanize-metric";
import type { PlayState, PlayerRoundView } from "./play-state";

/**
 * The challenge-side sibling of `RoundResultPanel.tsx`.
 *
 * WHY A SEPARATE FILE RATHER THAN A `basePath` PROP ON THE COMPETITION ONE. The competition
 * version's back-link destination is pinned character-for-character by
 * `__tests__/games/provider-play-ui.test.ts` ("the confirming panel offers a way back to the
 * contest"), which asserts the literal string `/competitions/${competitionId}` inside that
 * file's own source. Generalising the component would mean rewriting a passing, already-shipped
 * test alongside a change to competitions that has nothing to do with challenges - exactly the
 * risk `challenge-round-config.ts`'s own header warns against ("a competition-only assumption
 * ends up inside challenge code" runs both directions). The two files therefore share the
 * PLAYER-FACING COPY verbatim (deliberately duplicated below, not imported, for the same
 * reason) and differ only in the one thing that is actually different: where "back" goes.
 */

interface ChallengeRoundResultPanelProps {
  challengeId: string;
  challengeName: string;
  confirming: boolean;
  /** Why we are waiting. `null` when not confirming. See `ConfirmReason` on the host. */
  confirmReason?: "finished" | "left" | null;
  round: PlayerRoundView | null;
  state: PlayState;
  onPlayAgain: () => void;
}

/** See `RoundResultPanel.tsx`'s `confirmingCopy` - identical copy, deliberately duplicated. */
function confirmingCopy(reason: "finished" | "left" | null | undefined): {
  heading: string;
  detail: string;
} {
  if (reason === "left") {
    return {
      heading: "Checking how your round ended",
      detail:
        "You have left the game. Your attempt was already open, so the round stays open and this challenge's rules decide the outcome - you do not need to wait here for it.",
    };
  }
  return {
    heading: "Confirming your result",
    detail:
      "We are waiting for the game to confirm your score with us. This usually takes a few seconds, and you do not need to wait here for it.",
  };
}

/** See `RoundResultPanel.tsx`'s `describe` - identical status copy, deliberately duplicated. */
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
        detail: "Your score has been recorded for this challenge.",
      };
    case "voided":
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
          "The game did not report your result. This challenge's rules decide what happens next, and you will be told the outcome.",
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

export function ChallengeRoundResultPanel({
  challengeId,
  challengeName,
  confirming,
  confirmReason,
  round,
  state,
  onPlayAgain,
}: ChallengeRoundResultPanelProps) {
  if (confirming) {
    const { heading, detail } = confirmingCopy(confirmReason);
    return (
      <div className={`space-y-3 p-8 text-center ${NEON_STAGE_PANEL}`}>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-100">{heading}</h2>
        <p className="text-sm text-gray-400">{detail}</p>
        <Link href={`/challenges/${challengeId}`} className="inline-block pt-2">
          <Button variant="outline">Back to {challengeName}</Button>
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
              anything — we keep checking, and this challenge&apos;s rules cover what
              happens if it never arrives. Your standing will update automatically.
            </p>
          </div>
        </div>
        <Link href={`/challenges/${challengeId}`}>
          <Button variant="outline" className="w-full">
            Back to {challengeName}
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
          <p className="mt-2 text-xs text-gray-400">
            Your challenge score:{" "}
            {typeof state.participantScore === "number"
              ? state.participantScore.toLocaleString()
              : "-"}
          </p>
        </div>
      )}

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
        <Link href={`/challenges/${challengeId}`} className="flex-1">
          <Button variant="outline" className="w-full">
            Back to {challengeName}
          </Button>
        </Link>
      </div>
    </div>
  );
}
