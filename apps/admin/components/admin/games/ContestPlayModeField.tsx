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
import { PLAY_MODE_COPY, type PlayMode } from "@/lib/services/games/play-shape";

/**
 * Which shape THIS contest is run as, when the title supports more than one.
 *
 * WHY THIS CONTROL EXISTS, AND WHY IT DID NOT BEFORE. Until 9 September 2026 the shape was a
 * property of the title and nothing else: `play-shape.ts` said in as many words that it must
 * never come from caller input, because a race wrongly run as staggered keeps entry open
 * after the gun. Task document 11 reverses that, and the reversal is safe for one reason -
 * the create service validates the choice against the set the title declares and refuses an
 * unsupported one by name. The shape is still decided by a stored value; the operator is
 * choosing between values the title has already agreed to.
 *
 * WITHHELD, NOT DISABLED, WHEN THERE IS NO CHOICE. `StepSchedule` renders this only when the
 * title supports two or more shapes. A greyed-out picker on a puzzle teaches an operator
 * there is a decision to make about a game that has never had one, and this codebase has
 * found the same shape three times over - a provider with no adapter, a `rankingMethod` a
 * provider game ignores, and `isPaused` on a provider contest.
 *
 * FROZEN AFTER CREATION, which is why this appears in the wizard and not in the editor. It
 * decides when entry closes and how many attempts a paying entrant gets, so moving it on a
 * live contest changes the rules under people who have bought in. `toEditRequestBody` omits
 * it and `NEVER_EDITABLE_FIELDS` names it.
 *
 * The labels and consequence sentences come from `PLAY_MODE_COPY` in `play-shape.ts`, which
 * the create service reads too, so this screen cannot describe a rule the server does not
 * enforce. Same reasoning as `RoundStartPolicyField` and `UnscoredPolicyField`.
 */
export function ContestPlayModeField({
  value,
  options,
  onChange,
}: {
  value: PlayMode;
  /**
   * The title's supported set, already resolved by `resolveSupportedPlayModes`.
   *
   * Passed in rather than derived here, and that is the load-bearing half: a `head_to_head`
   * title is scheduled whatever its supported list says, so a component deriving its own
   * options would offer a choice the create service is about to refuse. Same rule as the
   * genre label and the play style - the screen is handed the answer.
   */
  options: PlayMode[];
  onChange: (value: PlayMode) => void;
}) {
  const copy = PLAY_MODE_COPY.get(value);

  return (
    <div className="md:col-span-2">
      <Label className="text-gray-200">How this contest is played</Label>
      <Select value={value} onValueChange={(next) => onChange(next as PlayMode)}>
        <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-gray-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {PLAY_MODE_COPY.get(mode)?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="mt-2 text-xs text-gray-400">{copy?.detail}</p>

      {/*
        Stated on the scheduled branch only, because it is the branch that takes controls away
        and closes entry early. An operator picking it to get "everybody races together" does
        not expect the attempts setting to vanish or sign-ups to stop at the start time, and
        those two are the whole cost of the choice.

        A warning rather than a note: both consequences are irreversible on this contest once
        it is created.
      */}
      {value === "scheduled" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200/90">
            Everybody plays at once, so entry closes when the contest{" "}
            <strong>starts</strong> and every player gets <strong>one attempt</strong>. Those
            two settings are withheld rather than editable, and this choice cannot be changed
            once the contest exists.
          </p>
        </div>
      )}
    </div>
  );
}
