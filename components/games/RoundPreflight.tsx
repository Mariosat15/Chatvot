"use client";

import { AlertCircle, Clock, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import {
  NEON_DIVIDER,
  NEON_INSET,
  NEON_STAGE_PANEL,
} from "@/components/neon/tokens";
import { formatRemaining, useServerClock } from "@/hooks/useServerClock";
import type { PlayState } from "./play-state";
import { contestReservesFullRound, fullRoundCutoffMs } from "./round-window";

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
  /*
    THE SERVER'S CLOCK, NOT THE BROWSER'S, and every comparison below uses it.

    Each of these gates mirrors one the launch service enforces against the server's
    `new Date()`. Computed from `Date.now()` they disagree on any machine whose clock is off,
    in both of the directions that matter: a Play button offered against a closed window
    produces a refusal the player cannot act on, and one withheld against an open window hides
    a paid attempt. Neither logs anything, because neither is an error.

    It also makes this component re-render every second, which is what closes the second half
    of the owner's report - the button used to need a page reload to notice that the window had
    opened. The host polls for the facts the clock cannot know (a status change, an operator's
    pause); the clock handles everything that is purely the passage of time.
  */
  const now = useServerClock(state.serverNow);

  const resuming = state.liveRound !== null;
  const exhausted = state.attemptsRemaining <= 0 && !resuming;
  const windowEndMs = state.playWindowEnd
    ? new Date(state.playWindowEnd).getTime()
    : null;
  const windowStartMs = state.playWindowStart
    ? new Date(state.playWindowStart).getTime()
    : null;
  const windowClosed = windowEndMs !== null ? windowEndMs <= now : false;

  /*
    NO ROOM LEFT FOR A ROUND, which is now the CONTEST'S RULE rather than the platform's.

    `createRound` refuses when `now + maxDurationSeconds > playWindowEnd`, but only while the
    contest is on `reserve_full_round`. See `RoundStartPolicy` in `round-types.ts` for why that
    stopped being unconditional; the part that matters here is that the number being reserved
    is the CATALOGUE ceiling, so this used to disable Play for the entire life of any contest
    shorter than it - beside a countdown saying minutes remained. That was the owner's report.

    Under `until_window_closes` the round is permitted and SHORTENED, so this screen owes the
    player the length they will actually get before they spend an attempt on it. That
    disclosure is the whole reason the permissive branch is defensible, so it is not optional
    decoration - see `shortenedMs` below.

    Only when we know the duration. An absent `maxRoundSeconds` applies no gate rather than
    guessing, because a guess that disables the button is worse than leaving the server's
    refusal to name the real reason.
  */
  const roundNeedsMs =
    typeof state.maxRoundSeconds === "number"
      ? state.maxRoundSeconds * 1000
      : null;
  /*
    THE CUT-OFF COMES FROM `round-window.ts`, WHICH IS ALSO WHAT THE LOBBY COUNTS DOWN TO.

    It used to be computed here as `now + roundNeedsMs > windowEndMs`. Identical arithmetic, but
    the lobby now shows a player how long they have left to start, and a lobby that promises
    time this screen then refuses is worse than a lobby that says nothing. One producer, two
    readers.
  */
  const cutoffMs = fullRoundCutoffMs(windowEndMs, state.maxRoundSeconds);
  const fullRoundNoLongerFits =
    !resuming && cutoffMs !== null && !windowClosed && now > cutoffMs;
  const reservesFullRound = contestReservesFullRound(state.roundStartPolicy);
  const tooLateToStart = fullRoundNoLongerFits && reservesFullRound;
  /*
    How much play time is actually left, stated only when it is less than a full round.

    Reason it is derived from the window rather than from the round: `resolveExpiry` clamps
    `expiresAt` to `playWindowEnd`, so this IS the length the player will get, not an estimate
    of it. A figure that merely approximated the server's clamp would drift from it the first
    time either side changed.
  */
  const shortenedMs =
    fullRoundNoLongerFits && !reservesFullRound && windowEndMs !== null
      ? windowEndMs - now
      : null;

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
  const windowNotOpen = windowStartMs !== null ? windowStartMs > now : false;

  /*
    A PAUSE IS NOT A STATUS, which is the whole reason it needs its own line here. A paused
    contest is still `active`, so every check above passes and this screen would offer a fully
    enabled Play button that the launch service now refuses.

    It blocks RESUME as well, deliberately. The launch service's pause gate sits before the
    idempotent-resume path, for the same reason the status gate does - and more importantly, an
    operator pauses a contest to stop play, so letting a player carry on inside a round they
    already have open defeats the control while appearing to honour it.
  */
  const paused = state.isPaused === true;

  const blocked =
    notStartedYet ||
    noLongerOpen ||
    paused ||
    windowNotOpen ||
    windowClosed ||
    tooLateToStart ||
    exhausted;

  // Reason the order matters: a contest that has not started AND has a closed window should say
  // it has not started, because that is the fact the player can act on - they can come back.
  const blockedReason = notStartedYet
    ? "This competition has not started yet. Your seat is reserved - come back when it opens."
    : noLongerOpen
      ? "This competition is no longer accepting rounds."
      : paused
        ? // The operator's reason is shown when there is one. A pause with no explanation is
          // what makes players assume the platform is broken rather than being worked on.
          state.pauseReason
          ? `Play is paused: ${state.pauseReason} Your attempts are safe - come back shortly.`
          : "Play is paused while we sort something out. Your attempts are safe - come back shortly."
        : windowNotOpen
          ? "Play has not opened for this competition yet."
          : windowClosed
            ? "The play window for this competition has closed."
            : // Ordered above `exhausted` because it is the more urgent fact and the one the
              // player can still act on next time: there is time left, just not enough of it.
              tooLateToStart
              ? "There is not enough time left in this competition to finish a round, so no new round can be started."
              : exhausted
                ? "You have used all of your attempts for this competition."
                : null;

  const buttonLabel = launching
    ? "Opening the game…"
    : notStartedYet
      ? "Not started yet"
      : noLongerOpen
        ? "Closed"
        : paused
          ? "Paused"
          : windowNotOpen
            ? "Play has not opened"
            : windowClosed
              ? "Play has closed"
              : tooLateToStart
                ? "Too late to start a round"
                : exhausted
                  ? "No attempts left"
                  : resuming
                    ? "Resume your round"
                    : // Reason the shortening reaches the button and not only the panel above:
                      // the button is the thing being pressed, and a player who has skimmed
                      // the panel should still not be able to spend an attempt without having
                      // seen that this round is not a full one.
                      shortenedMs !== null
                      ? "Play a shortened round"
                      : "Play";

  return (
    <div className={`space-y-4 p-6 ${NEON_STAGE_PANEL}`}>
      <div>
        <h2 className="text-xl font-bold uppercase tracking-wide text-white">
          {gameName}
        </h2>
        <p className="mt-1 text-sm text-gray-400">{describeAttempts(state)}</p>
      </div>

      {/*
        Why the contest's own state gets its own panel rather than reusing the refusal box
        below: that box is red and reports a rejected action. Not having started is not a
        rejection, it is the normal state of a contest a player has just joined, and colouring
        it as an error teaches them something is broken.
      */}
      {blockedReason && (
        <div className={`flex items-start gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-300">{blockedReason}</p>
        </div>
      )}

      {/*
        A COUNTDOWN, NOT A TIMESTAMP, and the owner's report is the reason. This used to read
        "Play closes Mon, 07 Sep 2026 05:46:00 GMT", which is precise and asks the player to
        subtract two times in their head - one of them in a zone they do not live in. The
        absolute time is kept underneath, because a player planning when to come back needs it,
        but the figure that decides whether to press Play now is the remaining one.

        It counts down to the window's OPEN while play has not started, and to its CLOSE once
        it has, because those are the two questions in the two states. Both are anchored to the
        server's clock, so the number agrees with the gate that will judge the click.
      */}
      {windowNotOpen && windowStartMs !== null && !noLongerOpen && (
        <div className={`flex items-center gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-300">
            Play opens in{" "}
            <span className="font-semibold tabular-nums text-gray-100">
              {formatRemaining(windowStartMs - now)}
            </span>
            <span className="ml-1 text-gray-500">
              ({new Date(windowStartMs).toUTCString()})
            </span>
          </p>
        </div>
      )}

      {!windowNotOpen && windowEndMs !== null && !windowClosed && !noLongerOpen && (
        <div className={`flex items-start gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="space-y-1">
            <p className="text-xs text-gray-300">
              Play closes in{" "}
              <span className="font-semibold tabular-nums text-gray-100">
                {formatRemaining(windowEndMs - now)}
              </span>
              <span className="ml-1 text-gray-500">
                ({new Date(windowEndMs).toUTCString()})
              </span>
            </p>
            {/*
              THREE SENTENCES FOR THREE SITUATIONS, and they must not be collapsed into one.

              A cut-off that exists is a deadline the player can plan around; a cut-off that
              does not exist must not be implied, or a player leaves and comes back to find
              they could have played all along. And once a round no longer fits, the honest
              thing is the length they will actually get - see `shortenedMs`.

              Nothing is said while `tooLateToStart`, because the blocked panel above already
              states it outright and two panels about the same clock contradict each other in
              tone.
            */}
            {roundNeedsMs !== null &&
              !tooLateToStart &&
              !resuming &&
              (shortenedMs !== null ? (
                <p className="text-xs text-amber-300/90">
                  Less than a full round is left. Start now and you get{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRemaining(shortenedMs)}
                  </span>{" "}
                  of play before the contest closes your round and scores what you
                  managed.
                </p>
              ) : reservesFullRound && cutoffMs !== null ? (
                <p className="text-xs text-gray-500">
                  A round needs up to{" "}
                  {Math.max(1, Math.round(roundNeedsMs / 60000))} min, so the last one
                  can start{" "}
                  <span className="tabular-nums">
                    {formatRemaining(cutoffMs - now)}
                  </span>{" "}
                  from now.
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  A round runs up to{" "}
                  {Math.max(1, Math.round(roundNeedsMs / 60000))} min. You can start one
                  at any time until the contest ends - anything still running then is
                  closed and scored on what you managed.
                </p>
              ))}
          </div>
        </div>
      )}

      {/*
        Suppressed while blocked, because the sentence is an offer. Telling a player their round
        can be reopened for free, beside a disabled button, is worse than saying nothing - it
        reads as the control being broken rather than deliberately withheld. The pause case is
        the one that made this necessary: a live round plus a pause is exactly the combination
        where both panels would otherwise render and contradict each other.
      */}
      {resuming && !blocked && (
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
        className={`w-full ${neonButtonClasses("action")}`}
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
        <div className={`border-t ${NEON_DIVIDER} pt-4`}>
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
