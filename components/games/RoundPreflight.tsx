"use client";

import { AlertCircle, Clock, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayState } from "./play-state";

/**
 * What a player is told before they commit an attempt.
 *
 * THE SCREEN EXISTS BECAUSE THE DECISION IS IRREVERSIBLE. An attempt is consumed when the round
 * is created, not when it completes, so pressing Play spends something the player paid for. A
 * button that launches straight into a game gives them no chance to notice they are on their
 * last attempt, or that the play window shuts in four minutes.
 *
 * A LIVE ROUND OFFERS RESUME, NOT PLAY, and the distinction is not cosmetic. Launching again
 * returns the SAME round with a fresh launch URL, because `createRound` is idempotent on a live
 * round - so resuming costs nothing. Labelling it "Play" would tell a player they were spending
 * a second attempt on an action that spends none, and some would decline it and leave a round
 * to expire instead.
 */

interface RoundPreflightProps {
  gameName: string;
  state: PlayState;
  launching: boolean;
  refusal: string | null;
  onLaunch: () => void;
}

function describeAttempts(state: PlayState): string {
  if (state.attemptsPolicy === "single") {
    return state.attemptsUsed > 0
      ? "You have used your one attempt."
      : "You have one attempt.";
  }

  const verb = state.attemptsPolicy === "sum_of_n" ? "added together" : "your best counts";
  return `${state.attemptsRemaining} of ${state.attemptsPermitted} attempts left — ${verb}.`;
}

export function RoundPreflight({
  gameName,
  state,
  launching,
  refusal,
  onLaunch,
}: RoundPreflightProps) {
  const resuming = state.liveRound !== null;
  const exhausted = state.attemptsRemaining <= 0 && !resuming;
  const windowClosed = state.playWindowEnd
    ? new Date(state.playWindowEnd) <= new Date()
    : false;

  /*
    THE CONTEST'S OWN STATE, which this screen used to ignore entirely - it read attempts and
    the play window and offered a fully enabled Play button on a contest that had not started.
    Pressing it was safe, because `startRound` refuses anything but `active` and consumes no
    attempt, but the player got a red error where they should have got an explanation. That is
    a control which appears to work and does nothing: the same shape as a provider enabled with
    no adapter, or a `rankingMethod` a provider game ignores.

    It mirrors the launch service's gate rather than inventing its own rule - `PLAYABLE_STATUSES`
    is exactly `active`, so everything else is either not-yet or over. `draft` is grouped with
    `upcoming` because an unpublished contest is reachable by URL.

    RESUME IS BLOCKED TOO, and that is the easy thing to get wrong here. The status gate in the
    launch service runs BEFORE the idempotent-resume path, so a live round in a contest that has
    ended cannot be reopened however harmless it looks. Letting the button through would put the
    refusal back on the server and the red box back in front of the player.
  */
  const notStartedYet =
    state.contestStatus === "upcoming" || state.contestStatus === "draft";
  const noLongerOpen = !notStartedYet && state.contestStatus !== "active";
  const windowNotOpen = state.playWindowStart
    ? new Date(state.playWindowStart) > new Date()
    : false;

  const blocked =
    notStartedYet || noLongerOpen || windowNotOpen || windowClosed || exhausted;

  // Reason the order matters: a contest that has not started AND has a closed window should say
  // it has not started, because that is the fact the player can act on - they can come back.
  const blockedReason = notStartedYet
    ? "This competition has not started yet. Your seat is reserved - come back when it opens."
    : noLongerOpen
      ? "This competition is no longer accepting rounds."
      : windowNotOpen
        ? "Play has not opened for this competition yet."
        : windowClosed
          ? "The play window for this competition has closed."
          : exhausted
            ? "You have used all of your attempts for this competition."
            : null;

  const buttonLabel = launching
    ? "Opening the game…"
    : notStartedYet
      ? "Not started yet"
      : noLongerOpen
        ? "Closed"
        : windowNotOpen
          ? "Play has not opened"
          : windowClosed
            ? "Play has closed"
            : exhausted
              ? "No attempts left"
              : resuming
                ? "Resume your round"
                : "Play";

  return (
    <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">{gameName}</h2>
        <p className="mt-1 text-sm text-gray-400">{describeAttempts(state)}</p>
      </div>

      {/*
        Why the contest's own state gets its own panel rather than reusing the refusal box
        below: that box is red and reports a rejected action. Not having started is not a
        rejection, it is the normal state of a contest a player has just joined, and colouring
        it as an error teaches them something is broken.
      */}
      {blockedReason && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-300">{blockedReason}</p>
        </div>
      )}

      {state.playWindowEnd && !windowClosed && !noLongerOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <Clock className="h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-300">
            Play closes {new Date(state.playWindowEnd).toUTCString()}
          </p>
        </div>
      )}

      {resuming && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-300">
            You have a round in progress (attempt {state.liveRound?.attemptNumber}).
            Reopening it does not use another attempt.
          </p>
        </div>
      )}

      {refusal && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-300">{refusal}</p>
        </div>
      )}

      {/*
        Reason the attempt cost is stated on the button's own line rather than in a tooltip or a
        confirmation dialog: a dialog trains players to dismiss it, and by the second contest
        nobody reads it. Saying it beside the control keeps it visible without adding a step to
        the path they take every time.
      */}
      {!resuming && !blocked && (
        <p className="text-xs text-gray-500">
          Starting uses one attempt, even if you leave before finishing.
        </p>
      )}

      <Button
        onClick={onLaunch}
        disabled={launching || blocked}
        className="w-full bg-blue-500 hover:bg-blue-600"
      >
        {launching ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : resuming ? (
          <RotateCcw className="mr-2 h-4 w-4" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {buttonLabel}
      </Button>

      {state.rounds.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your rounds
          </p>
          <ul className="space-y-1">
            {state.rounds.map((round) => (
              <li
                key={round.roundId}
                className="flex items-center justify-between text-xs text-gray-400"
              >
                <span>Attempt {round.attemptNumber}</span>
                <span className="capitalize">{round.status}</span>
                {/* Absent is not zero. A round with no score yet shows a dash. */}
                <span className="text-gray-300">
                  {typeof round.score === "number" ? round.score : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
