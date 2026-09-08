"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import {
  ROUND_START_POLICIES,
  ROUND_START_POLICY_COPY,
  type RoundStartPolicy,
} from "@/lib/services/games/round-types";

/**
 * How late in the contest a player may still start a round.
 *
 * WHY THIS CONTROL EXISTS AT ALL, because it is a rule the platform used to enforce
 * unconditionally. Chapter 03 section 1.2 refused any round the contest end could cut short,
 * reserving the title's CATALOGUE maximum - 300 seconds for Circuit Sprint, whatever length
 * the operator configured. A contest shorter than that maximum therefore refused every round
 * from the instant it opened, telling players "there is not enough time left in this
 * competition" beside a countdown showing minutes remaining. The owner reported exactly that,
 * and it is not a wording problem.
 *
 * THAT ARITHMETIC WAS FIXED ON 8 SEPTEMBER 2026 and the control stayed, which is the part
 * worth understanding. The gate now reserves the playing time the operator chose rather than
 * a catalogue ceiling, so reserving is once again a reasonable default and is once again the
 * default. What remains genuinely optional is the trade the two policies make: equal playing
 * time for everybody, or entry right up to the final whistle. A contest too short to fit one
 * full session can only have the second.
 *
 * `RoundStartPolicy` in `round-types.ts` carries the full reasoning, including why the
 * fairness argument the old rule rested on was suspended and then restored.
 *
 * ONE COMPONENT SHARED BY THE WIZARD AND THE EDITOR, and the option ids and consequence
 * sentences come from `round-types.ts` - which the gate in `round.service.ts` reads too, so
 * this screen cannot describe a rule the server does not enforce. Same reasoning as
 * `UnscoredPolicyField`.
 */
export function RoundStartPolicyField({
  value,
  disabled,
  onChange,
}: {
  value: RoundStartPolicy;
  /**
   * True once a player has paid to enter.
   *
   * Frozen then for the same reason as the unscored-contest policy: it is part of the deal a
   * player accepted. Loosening it mid-contest is arguably harmless, but tightening it would
   * withdraw play time somebody paid for, and a control that is editable in only one
   * direction is a control nobody can reason about.
   */
  disabled?: boolean;
  onChange: (value: RoundStartPolicy) => void;
}) {
  const copy = ROUND_START_POLICY_COPY.get(value);

  return (
    <div className="md:col-span-2">
      <Label className="text-gray-200">When players may start a round</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as RoundStartPolicy)}
      >
        <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-gray-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROUND_START_POLICIES.map((policy) => (
            <SelectItem key={policy} value={policy}>
              {ROUND_START_POLICY_COPY.get(policy)?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="mt-2 text-xs text-gray-400">{copy?.consequence}</p>

      {/*
        Stated on the reserving branch only, because it is the branch that surprises people.
        An operator picks it expecting "no unfair short rounds" and does not expect entry to
        close before the contest does.

        IT NO LONGER CLAIMS THE RESERVE IS A HIDDEN CATALOGUE MAXIMUM, which it said until the
        gate was fixed on 8 September 2026. That sentence was true of the defect and is now
        false, and a caution that has become false is worse than none - an operator who reads
        it goes looking for a number that is not on any screen. The consequence it existed to
        warn about is real and stayed: reserving closes entry early, and a contest shorter
        than one session admits nobody.
      */}
      {value === "reserve_full_round" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200/90">
            Entry to play closes <strong>one full playing time</strong> before the contest
            ends, so a player arriving after that cannot take part even though the contest
            is still running. The contest must be longer than one playing time or nobody can
            start at all.
          </p>
        </div>
      )}
    </div>
  );
}
