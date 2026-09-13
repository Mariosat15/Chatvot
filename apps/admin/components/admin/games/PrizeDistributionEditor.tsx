"use client";

import { Minus, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Who gets paid, and how much, on a contest played through a game provider.
 *
 * IT EXISTS BECAUSE THE WIZARD SAID "PRIZES" AND HAD NONE. The provider wizard's third step has
 * been labelled "Timing & prizes" since it was built, and its heading reads "Timing, entry and
 * prizes" - but no prize control was ever rendered. `contest-draft.ts` seeded a fixed
 * 50/30/20 and there was no way to change it, so every provider contest ever created paid
 * those three shares whatever the operator intended. The create service has accepted and
 * validated `prizeDistribution` since it was written; only the operator could not reach it.
 *
 * That is the shape this codebase keeps producing: a control that appears to exist and does
 * nothing. It is worse than a missing step, because the step's own label promised the setting
 * was there and an operator reasonably concluded they had already set it.
 *
 * A SECOND IMPLEMENTATION OF THE UI, DELIBERATELY, AND NOT OF THE RULE. `CompetitionCreatorForm`
 * has a prize editor, but it is a few hundred lines inside a 2,900-line form that live trading
 * contests depend on, and extracting it would put a refactor of the trading create path in the
 * way of a provider fix. What must not be duplicated is the RULE, and it is not: the shares are
 * validated server-side in `provider-contest.service.ts`, which is the only place that decides
 * whether a distribution is acceptable. This component's total is an affordance, so an operator
 * sees the problem before submitting rather than after.
 */

export interface PrizeSlice {
  rank: number;
  percentage: number;
}

/** Two, because a paid contest is never single-player - see the platform's hard constraints. */
export const MIN_PRIZE_RANKS = 2;

export function prizeTotal(slices: PrizeSlice[]): number {
  return slices.reduce((sum, s) => sum + (s.percentage || 0), 0);
}

/**
 * The SERVER's rule, restated for the operator's benefit and nothing else.
 *
 * The 0.01 tolerance is not this component's opinion - it is what
 * `provider-contest.service.ts` enforces, and it exists because a three-way even split cannot
 * total exactly 100 in decimal. A stricter check here would show a red "must equal 100%" over
 * a distribution the server accepts, which teaches an operator to ignore the warning.
 */
export function prizeTotalIsValid(slices: PrizeSlice[]): boolean {
  return Math.abs(prizeTotal(slices) - 100) <= 0.01;
}

interface PrizeDistributionEditorProps {
  value: PrizeSlice[];
  onChange: (next: PrizeSlice[]) => void;
  /** The share of the pool the platform keeps, shown so the operator can see what is split. */
  platformFeePercentage?: number;
  /** Frozen once anyone has paid to enter. See the edit policy for why entry is the trigger. */
  disabled?: boolean;
}

export function PrizeDistributionEditor({
  value,
  onChange,
  platformFeePercentage,
  disabled,
}: PrizeDistributionEditorProps) {
  const total = prizeTotal(value);
  const balanced = prizeTotalIsValid(value);

  const setSlice = (index: number, field: keyof PrizeSlice, raw: number) => {
    // Reason: `Number("")` is 0 but `parseFloat("")` is NaN, and an NaN reaching the total
    // makes it read "NaN%" and never recover. Same class as the `|| 5` that hid R31 - when a
    // falsy guard is replaced, everything it was catching has to be enumerated.
    const next = Number.isFinite(raw) ? raw : 0;
    onChange(
      value.map((slice, i) =>
        i === index ? { ...slice, [field]: next } : slice,
      ),
    );
  };

  const addRank = () => {
    const highest = value.reduce((max, s) => Math.max(max, s.rank), 0);
    onChange([...value, { rank: highest + 1, percentage: 0 }]);
  };

  const removeRank = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div>
          <div className="text-sm text-gray-400">Total distribution</div>
          <div
            className={`mt-1 text-3xl font-bold ${balanced ? "text-green-400" : "text-red-400"}`}
          >
            {Math.round(total * 100) / 100}%
          </div>
          {!balanced && (
            <div className="mt-1 text-xs text-red-400">Must equal 100%</div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addRank}
          disabled={disabled}
          className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-gray-900"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add rank
        </Button>
      </div>

      <div className="space-y-3">
        {value.map((slice, index) => (
          <div
            key={index}
            className="group rounded-xl border border-gray-600 bg-gray-800/50 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-500/20">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-gray-400">
                    Rank position
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={slice.rank}
                    disabled={disabled}
                    onChange={(e) =>
                      setSlice(index, "rank", Number(e.target.value))
                    }
                    className="h-11 border-gray-600 bg-gray-900 text-lg font-bold text-gray-100"
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-gray-400">
                    Prize percentage
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={slice.percentage}
                      disabled={disabled}
                      onChange={(e) =>
                        setSlice(index, "percentage", Number(e.target.value))
                      }
                      className="h-11 border-gray-600 bg-gray-900 pr-8 text-lg font-bold text-gray-100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                      %
                    </span>
                  </div>
                </div>
              </div>
              {value.length > MIN_PRIZE_RANKS && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRank(index)}
                  className="flex-shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  title={`Remove rank (minimum ${MIN_PRIZE_RANKS})`}
                >
                  <Minus className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/*
        THE SENTENCE THAT STOPS AN OPERATOR RAISING A SUPPORT TICKET. A rank with nobody in it
        is the normal case - three shares configured, two players turn up - and the platform
        already redistributes that share among the players who did place. Without saying so,
        the figures an operator sets here never match the amounts they later see paid, and the
        obvious conclusion is that the payout is broken. It is the same gap the admin contest
        view has, one screen along.
      */}
      <p className="text-xs text-gray-500">
        Shares are taken from the prize pool
        {typeof platformFeePercentage === "number" && platformFeePercentage > 0
          ? ` after the ${platformFeePercentage}% platform fee`
          : ""}
        . A rank nobody finishes in is not kept by the platform - its share is
        split equally among the players who did place, so the amounts actually
        paid can be higher than the percentages here.
      </p>
    </div>
  );
}

export default PrizeDistributionEditor;
