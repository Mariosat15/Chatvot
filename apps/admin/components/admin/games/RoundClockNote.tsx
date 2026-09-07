"use client";

import { Clock, TriangleAlert } from "lucide-react";
import type { RoundStartPolicy } from "@/lib/services/games/round-types";
import { describeRoundFit } from "./contest-draft";

/**
 * Explains, on the screens where an operator sets them, how a game's own round length relates
 * to the contest's start and end.
 *
 * WHY THIS EXISTS. The owner reported the Circuit Sprint duration as confusing: "it lets you
 * set the duration like 120 but then you specify also time in the window play, and the two
 * don't obviously relate." They do relate, and nothing said how. See `describeRoundFit` for
 * the full mechanism; the short version is that the settings step configures how long ONE
 * attempt lasts, the timing step decides when attempts may be started at all, and the gate
 * between them reserves the title's MAXIMUM round length so no attempt can be cut short by
 * the contest ending.
 *
 * ONE COMPONENT FOR THE WIZARD AND THE EDITOR, for the same reason as `UnscoredPolicyField`
 * and `contest-control-copy.ts`: an explanation that exists twice is an explanation that will
 * eventually describe two different rules, and the operator has no way to tell which screen is
 * lying. This one is also the only place that renders the derived deadline, so the wizard and
 * the editor cannot disagree about when the last attempt can start.
 *
 * IT STATES A WALL-CLOCK MOMENT, NOT A FORMULA. "Reserves 300 seconds" is the rule; "the last
 * attempt can start at 13:55" is the thing an operator can act on. The number that confused
 * the owner is the one the platform reserves, so it is named explicitly and separated from
 * whatever the game's own settings say.
 *
 * NO GAME IS NAMED HERE AND NONE MAY BE. It reads `maxDurationSeconds` from the catalogue row,
 * which every title carries, so a title we have never seen gets the same explanation with its
 * own number. A `switch` on game code here would break the "no developer needed for a new
 * title" claim exactly as it would in `ConfigSchemaFields`.
 */
export function RoundClockNote({
  startTime,
  endTime,
  maxDurationSeconds,
  roundStartPolicy,
  variant,
}: {
  startTime: string;
  endTime: string;
  maxDurationSeconds?: number;
  /**
   * Which of the two cut-off rules this contest is on.
   *
   * IT CHANGES WHAT IS TRUE HERE, not merely what is emphasised. Under
   * `until_window_closes` there is no "last attempt can start at" moment at all, and a note
   * that kept printing one would be describing the other setting - which is worse than the
   * silence this component was written to fix.
   */
  roundStartPolicy?: RoundStartPolicy;
  /**
   * `settings` is shown beside the game's own fields and answers "what are these for?";
   * `timing` is shown beside the contest dates and answers "when can people actually play?".
   *
   * Two wordings rather than one because the operator is asking a different question in each
   * place, and a single generic paragraph in both is the kind of copy people learn to skip.
   */
  variant: "settings" | "timing";
}) {
  const fit = describeRoundFit({
    startTime,
    endTime,
    maxDurationSeconds,
    roundStartPolicy,
  });

  if (variant === "settings") {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="space-y-1 text-xs text-gray-400">
            <p>
              These are the <strong className="text-gray-200">game&apos;s own settings</strong>,
              passed straight to the game. Anything here describing a length or a timer applies
              to <strong className="text-gray-200">one attempt</strong>, not to the contest.
            </p>
            <p>
              When players may start an attempt is set separately, by the contest&apos;s start
              and end times on the next step.
            </p>
            {fit &&
              (fit.reservesFullRound ? (
                <p>
                  Whatever you choose here, the contest reserves the last{" "}
                  <strong className="text-gray-200">
                    {fit.reservedSeconds} seconds
                  </strong>{" "}
                  before it ends, so no attempt can be cut short. That is this
                  game&apos;s longest possible round.
                </p>
              ) : (
                <p>
                  This contest lets players start an attempt at any time, so a length set
                  here is the most an attempt can run - one started near the end is closed
                  when the contest closes and scored on what the player managed.
                </p>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="space-y-1 text-xs text-gray-400">
            <p>
              Players can join from the moment you save until the{" "}
              <strong className="text-gray-200">start</strong> time, and play between start and{" "}
              <strong className="text-gray-200">end</strong>. To give a five-minute sign-up
              window, set the start five minutes from now.
            </p>
            {fit && fit.reservesFullRound && fit.lastAttemptStart ? (
              <p>
                An attempt may be started up to{" "}
                <strong className="text-gray-200">{fit.reservedSeconds} seconds</strong> before
                the end - this game&apos;s longest possible round - so the last attempt can
                start at{" "}
                <strong className="text-gray-200">
                  {fit.lastAttemptStart.toLocaleString()}
                </strong>
                . Everything still running is closed at the end time.
              </p>
            ) : (
              <p>
                Everything still running is closed at the end time, so play never outlives the
                contest.
              </p>
            )}
          </div>
        </div>
      </div>

      {/*
        THE SAME FACT, TWO CONSEQUENCES, and saying only one of them is how an operator
        concludes the platform is broken.

        Reserving, the server refuses this outright in `contest-preflight.ts`: nobody could
        start an attempt for the whole contest, and every player would settle on zero. That
        is the state the owner hit - the contest saved, opened, and refused every round.

        Until-close, the contest is perfectly valid and this is only worth knowing. Both are
        surfaced while the operator is editing the dates rather than on the review step.
      */}
      {fit?.windowTooShort && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          {fit.reservesFullRound ? (
            <p className="text-xs text-amber-200/90">
              This contest is shorter than this game&apos;s longest possible round (
              {fit.reservedSeconds} seconds), and it stops new rounds one full round
              before the end - so <strong>nobody could start an attempt at all</strong>.
              Lengthen the contest, pick a game with shorter rounds, or let players start
              at any time.
            </p>
          ) : (
            <p className="text-xs text-amber-200/90">
              This contest is shorter than this game&apos;s longest possible round (
              {fit.reservedSeconds} seconds), so every attempt will be cut short at the
              end time and scored on what the player managed. Players are told how long
              they have before they start.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
