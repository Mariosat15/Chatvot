"use client";

import { AlertCircle, Clock, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neonButtonClasses } from "@/components/neon/Buttons";
import CountdownPanel from "@/components/competitions/CountdownPanel";
import { NEON_INSET, NEON_STAGE_PANEL } from "@/components/neon/tokens";
import { formatRemaining, useServerClock } from "@/hooks/useServerClock";
import type { PlayState } from "./play-state";
import { describeAttempts, formatShortUtc, PreflightRoundList } from "./preflight-parts";
import { contestReservesFullRound, fullRoundCutoffMs } from "./round-window";
import { playModePlayerRule, LATE_ENTRY_NOTICE } from "@/lib/services/games/play-shape";

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
  /**
   * A challenge has no gun - both players share one room that starts when both are in - so
   * the start gate below is a competition rule only, and the play-mode sentence differs.
   */
  format?: "competition" | "challenge";
}

export function RoundPreflight({
  gameName,
  state,
  launching,
  refusal,
  onLaunch,
  format = "competition",
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
  /*
    EVERYONE PLAYS TOGETHER: there is no personal round clock to shorten. The game runs one
    shared race for everybody, so "less than a full round is left" was a false warning shown the
    moment a competition or challenge began - the owner's report. None of the shortening or
    reservation arithmetic applies to this shape.
  */
  const playsTogether = state.playMode === "scheduled";
  const fullRoundNoLongerFits =
    !playsTogether && !resuming && cutoffMs !== null && !windowClosed && now > cutoffMs;
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
  /*
    THE LOBBY of a scheduled race (`23` s9 decision 1). The server sends `lobbyOpensAt` only for
    a contest stored as `scheduled`, and admits an `upcoming` contest from that moment - the same
    rule as the launch service, never a second one. `draft` is excluded because the launch
    service admits only `upcoming` and `active`.
  */
  const startWaitEndsParsed = state.startWaitEndsAt
    ? new Date(state.startWaitEndsAt).getTime()
    : NaN;
  const startWaitEndsMs = Number.isFinite(startWaitEndsParsed) ? startWaitEndsParsed : null;
  const lobbyOpensMs = state.lobbyOpensAt
    ? new Date(state.lobbyOpensAt).getTime()
    : null;
  const lobbyOpen =
    lobbyOpensMs !== null &&
    now >= lobbyOpensMs &&
    (state.contestStatus === "upcoming" || state.contestStatus === "active");
  const beforeTheGun =
    lobbyOpen && windowStartMs !== null && windowStartMs > now;

  const notStartedYet =
    (state.contestStatus === "upcoming" || state.contestStatus === "draft") &&
    !lobbyOpen;
  const noLongerOpen =
    !notStartedYet && !lobbyOpen && state.contestStatus !== "active";
  const windowNotOpen =
    windowStartMs !== null ? windowStartMs > now && !lobbyOpen : false;

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

  // The same rule as `startHasPassed`. Since 28 Sep 2026 it does NOT block: a late player may
  // still join a race that is running. It only changes what the screen says, so the player
  // knows the time already raced counts against them before they press Play.
  const startPassed =
    format === "competition" &&
    playsTogether &&
    !resuming &&
    windowStartMs !== null &&
    now >= windowStartMs;

  const blocked =
    notStartedYet ||
    noLongerOpen ||
    paused ||
    windowNotOpen ||
    windowClosed ||
    tooLateToStart ||
    exhausted;

  /*
    ONE BIG CLOCK, the competition page's own card (owner, 2 Oct 2026: "make the clocks more
    prominent like the competition area"). Only the clock that answers the player's question
    right now is shown, so the screen never carries two countdowns to read and compare.
  */
  const startsInLabel =
    format === "challenge" ? "Challenge starts in" : "Competition starts in";
  const clock: { label: string; targetMs: number; note: string } | null = noLongerOpen ||
    paused ||
    exhausted ||
    windowClosed
    ? null
    : // Reason two clocks with two jobs (owner, 2 Oct 2026): the big clock always counts to the
      // START of the competition, while the button counts to the lobby opening - so the player
      // reads "when does it begin" at a glance and "when can I go in" where they would press.
      notStartedYet && lobbyOpensMs !== null && lobbyOpensMs > now && windowStartMs !== null
      ? {
          label: startsInLabel,
          targetMs: windowStartMs,
          note: "Your spot is saved! 🎮 Hop into the lobby when it opens and get ready - everyone starts together.",
        }
      : beforeTheGun && windowStartMs !== null
        ? {
            label: startsInLabel,
            targetMs: windowStartMs,
            note: "The lobby is open! 🎉 Jump in now and wait for the start.",
          }
        : (notStartedYet || windowNotOpen) && windowStartMs !== null && windowStartMs > now
          ? {
              label: "Play opens in",
              targetMs: windowStartMs,
              note: "Your spot is saved. Play unlocks by itself - no need to refresh.",
            }
          : !windowNotOpen && windowEndMs !== null
            ? { label: "Play closes in", targetMs: windowEndMs, note: "" }
            : null;
  // The clock's own line says why Play is not open yet, so a second panel would repeat it.
  const clockExplainsWait = clock !== null && (notStartedYet || windowNotOpen);
  const showRoundNote =
    roundNeedsMs !== null && !playsTogether && !tooLateToStart && !resuming;
  const showWaitNote = playsTogether && startWaitEndsMs !== null;

  // Reason the order matters: a contest that has not started AND has a closed window should say
  // it has not started, because that is the fact the player can act on - they can come back.
  const blockedReason = notStartedYet
    ? lobbyOpensMs !== null
      ? "The lobby has not opened yet. Your spot is saved."
      : "This has not started yet. Your spot is saved - come back when it opens."
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
      ? lobbyOpensMs !== null
        ? lobbyOpensMs > now
          ? `Lobby opens in ${formatRemaining(lobbyOpensMs - now)}`
          : "Lobby opens soon"
        : "Not started yet"
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
                    ? beforeTheGun
                      ? "Back to the lobby"
                      : "Resume your round"
                    : beforeTheGun
                      ? "Enter the lobby"
                    : startPassed
                      ? "Join late"
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
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
            {describeAttempts(state)}
          </span>
          {state.playMode && (
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              {playModePlayerRule(state.playMode, format).label}
            </span>
          )}
        </div>
        {state.playMode && (
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {playModePlayerRule(state.playMode, format).detail}
          </p>
        )}
      </div>

      {clock && (
        <CountdownPanel
          remainingMs={clock.targetMs - now}
          label={clock.label}
          variant={clock.label === "Play closes in" ? "end" : "start"}
          details={
            <div className="space-y-1">
              {clock.note && (
                <p className="text-sm font-medium text-gray-100">{clock.note}</p>
              )}
              <p className="text-xs tabular-nums text-gray-500">
                {formatShortUtc(clock.targetMs)}
              </p>
            </div>
          }
        />
      )}

      {/*
        Why the contest's own state gets its own panel rather than reusing the refusal box
        below: that box is red and reports a rejected action. Not having started is not a
        rejection, it is the normal state of a contest a player has just joined, and colouring
        it as an error teaches them something is broken.
      */}
      {blockedReason && !clockExplainsWait && (
        <div className={`flex items-start gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-300">{blockedReason}</p>
        </div>
      )}

      {startPassed && !blocked && (
        <div className={`flex items-start gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-300/90">{LATE_ENTRY_NOTICE}</p>
        </div>
      )}

      {/*
        A COUNTDOWN, NOT A TIMESTAMP, and the owner's report is the reason. This used to read
        "Play closes Mon, 07 Sep 2026 05:46:00 GMT", which is precise and asks the player to
        subtract two times in their head - one of them in a zone they do not live in. The
        absolute time is kept underneath, because a player planning when to come back needs it,
        but the figure that decides whether to press Play now is the remaining one.

        The big clock above now carries the countdown (lobby open, game start, play open or
        play close - whichever matters now), anchored to the server's clock so the number
        agrees with the gate that will judge the click. What remains here is the small print.
      */}
      {!windowNotOpen &&
        windowEndMs !== null &&
        !windowClosed &&
        !noLongerOpen &&
        (showRoundNote || showWaitNote) && (
        <div className={`flex items-start gap-2 p-3 ${NEON_INSET}`}>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="space-y-1">
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
            {showRoundNote &&
              roundNeedsMs !== null &&
              (shortenedMs !== null ? (
                <p className="text-xs text-amber-300/90">
                  Less than a full round is left. You get{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRemaining(shortenedMs)}
                  </span>{" "}
                  and score what you reach.
                </p>
              ) : reservesFullRound && cutoffMs !== null ? (
                <p className="text-xs text-gray-500">
                  Each round takes up to {Math.max(1, Math.round(roundNeedsMs / 60000))}{" "}
                  min. Last start in{" "}
                  <span className="tabular-nums">
                    {formatRemaining(cutoffMs - now)}
                  </span>
                  .
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Each round takes up to {Math.max(1, Math.round(roundNeedsMs / 60000))}{" "}
                  min. Start any time before the end.
                </p>
              ))}
            {/*
              THE WAITING LIMIT (owner rule, 28 Sep 2026). A together-start contest waits for two
              ready players, but not for ever: past this moment with play never begun, it is
              cancelled and every entry fee returned in full. Stated only when the server sends
              the deadline, which it does for a stored `scheduled` contest alone.
            */}
            {showWaitNote && startWaitEndsMs !== null && (
              <p className="text-xs text-gray-500">
                Fewer than two players ready by{" "}
                <span className="tabular-nums text-gray-300">
                  {formatShortUtc(startWaitEndsMs)}
                </span>
                ? It is cancelled and everyone gets their full entry fee back.
              </p>
            )}
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

      <PreflightRoundList rounds={state.rounds} />
    </div>
  );
}
