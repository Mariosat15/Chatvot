"use client";

import { Clock, TriangleAlert } from "lucide-react";
import { useTerms } from "@/contexts/TerminologyContext";
import {
  describeDurationSeconds,
  endTimeThatFits,
} from "@/lib/services/games/round-fit";
import {
  ROUND_START_POLICY_COPY,
} from "@/lib/services/games/round-types";
import type { AttemptsPolicy } from "@/lib/services/games/round-types";
import type { ProviderContestRules } from "@/components/gamemaster/use-provider-contest-rules";

/**
 * The Game Master wizard's round controls: the timing note with its one-click fix, the attempts
 * choice and the last-start rule.
 *
 * THE SAME RULES AND THE SAME WORDING AS THE ADMIN WIZARD'S `RoundClockNote`,
 * `StepPrizes` attempts block and `RoundStartPolicyField`, computed by the same shared
 * `round-fit.ts`. It is a second RENDERING rather than an import because the admin
 * components live in `apps/admin`, which the main app cannot import; the arithmetic, the
 * refusal and the forced values are not duplicated.
 *
 * NO GAME IS NAMED HERE. What changes between a race and a puzzle is the play shape's rules
 * (`rules.shape`), never a branch on which game this is.
 */

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none";

export function ProviderRoundFitNote({
  rules,
  startTime,
  onFitContest,
}: {
  rules: ProviderContestRules;
  startTime: string;
  onFitContest: (endTime: string) => void;
}) {
  const terms = useTerms();
  const { fit, playMode } = rules;
  const reserved = fit ? describeDurationSeconds(fit.reservedSeconds) : "";
  const contestLength = fit ? describeDurationSeconds(fit.windowSeconds) : "";
  const refuses = Boolean(fit && (fit.reservesFullRound || playMode === "scheduled"));
  const fitted = fit ? endTimeThatFits(startTime, fit.reservedSeconds) : undefined;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="space-y-1 text-xs text-gray-400">
            <p>
              {terms.players} can join from the moment you create it until the{" "}
              <strong className="text-gray-200">start</strong> time, and play between start and{" "}
              <strong className="text-gray-200">end</strong>.
            </p>
            {fit && fit.reservesFullRound && fit.lastAttemptStart ? (
              <p>
                Play lasts <strong className="text-gray-200">{reserved}</strong>, and everyone
                gets all of it, so the last {terms.attempt} can start at{" "}
                <strong className="text-gray-200">
                  {fit.lastAttemptStart.toLocaleString()}
                </strong>
                . Everything still running is closed at the end time.
              </p>
            ) : (
              <p>
                Everything still running is closed at the end time, so play never outlives the{" "}
                {terms.contest}.
              </p>
            )}
          </div>
        </div>
      </div>

      {fit?.windowTooShort && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 ${
            refuses ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          <TriangleAlert
            className={`mt-0.5 h-4 w-4 shrink-0 ${refuses ? "text-red-400" : "text-amber-400"}`}
          />
          <div className="space-y-2">
            {fit.reservesFullRound ? (
              <p className="text-xs text-red-200/90">
                Play is set to {reserved} but this {terms.contest} only runs for {contestLength},
                and every {terms.player} is promised the full {reserved} - so{" "}
                <strong>nobody could start an {terms.attempt} at all</strong>. Shorten the
                playing time, lengthen the {terms.contest}, or let {terms.players} start at any
                time.
              </p>
            ) : playMode === "scheduled" ? (
              <p className="text-xs text-red-200/90">
                One {terms.attempt} takes {reserved} but this {terms.contest} only runs for{" "}
                {contestLength}. Everybody starts together, so{" "}
                <strong>nobody could finish</strong> and it cannot be created like this.
                Lengthen the {terms.contest} or shorten the playing time.
              </p>
            ) : (
              <p className="text-xs text-amber-200/90">
                Play is set to {reserved} but this {terms.contest} only runs for {contestLength},
                so every {terms.attempt} will be cut short at the end time and scored on what
                the {terms.player} managed. {terms.players} are told how long they have before
                they start.
              </p>
            )}
            {fitted && (
              <button
                type="button"
                onClick={() => onFitContest(fitted)}
                className="rounded-md border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-100 hover:bg-gray-700"
              >
                Make the {terms.contest} long enough ({reserved} + 1 min)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Attempts per player and when the last attempt may start. Withheld, with the reason, where the shape forces them. */
export function ProviderRoundPolicyFields({
  rules,
  disabled,
}: {
  rules: ProviderContestRules;
  disabled?: boolean;
}) {
  const terms = useTerms();
  const { shape } = rules;
  const attempt = terms.attempt.toLowerCase();
  const attempts = terms.attempts.toLowerCase();

  // Reason: the admin locked both attempts settings, so there is nothing to choose. A locked
  // policy with an open count still offers the count; a locked count hides only its input.
  const attemptsHidden =
    rules.attemptsPolicyLocked &&
    (rules.attemptsPolicy === "single" || rules.attemptsAllowedLocked);

  return (
    <div className="space-y-4">
      {!attemptsHidden && (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          {terms.attempts} per {terms.player.toLowerCase()}
        </label>
        {shape.requiresSingleAttempt ? (
          <p className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-400">
            {shape.copy.attemptsWithheld}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {!rules.attemptsPolicyLocked && (
              <select
                value={rules.attemptsPolicy}
                disabled={disabled}
                onChange={(e) => rules.setAttemptsPolicy(e.target.value as AttemptsPolicy)}
                className={inputClass}
              >
                <option value="single">One {attempt} each</option>
                <option value="best_of_n">Best of several</option>
                <option value="sum_of_n">Total of several</option>
              </select>
            )}
            {rules.attemptsPolicy !== "single" && !rules.attemptsAllowedLocked && (
              <input
                type="number"
                min={2}
                aria-label={`How many ${attempts}`}
                value={rules.attemptsAllowed ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  rules.setAttemptsAllowed(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
                className={inputClass}
              />
            )}
          </div>
        )}
      </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          When can the last {attempt} start?
        </label>
        {shape.offersRoundStartPolicy ? (
          <>
            <select
              value={rules.roundStartPolicy}
              disabled={disabled || rules.allowedRoundStartPolicies.length <= 1}
              onChange={(e) =>
                rules.setRoundStartPolicy(e.target.value as typeof rules.roundStartPolicy)
              }
              className={inputClass}
            >
              {rules.allowedRoundStartPolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {ROUND_START_POLICY_COPY.get(policy)?.label ?? policy}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {ROUND_START_POLICY_COPY.get(rules.roundStartPolicy)?.consequence}
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-400">
            {shape.copy.roundStartWithheld}
          </p>
        )}
      </div>
    </div>
  );
}
