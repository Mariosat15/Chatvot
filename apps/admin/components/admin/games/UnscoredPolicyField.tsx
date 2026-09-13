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
  UNSCORED_CONTEST_POLICIES,
  UNSCORED_CONTEST_POLICY_COPY,
  type UnscoredContestPolicy,
} from "@/lib/services/games/round-types";

/**
 * The operator's choice of where the pot goes when NOBODY scores.
 *
 * ONE COMPONENT SHARED BY THE WIZARD AND THE EDITOR, for the reason
 * `provider-contest-edit-policy.ts` is model-free: this decides the destination of a whole
 * prize pool, and two copies of the control would eventually offer two different sets of
 * options. The option ids and the sentence describing each consequence both come from
 * `round-types.ts`, which the server also reads, so the screen cannot promise an outcome the
 * settlement code does not deliver.
 *
 * THE CONSEQUENCE IS ALWAYS ON SCREEN, not behind a tooltip or a help link. The two choices
 * are not self-explanatory from their labels - "unclaimed pool" in particular sounds like
 * money in escrow that somebody might still collect, when it is in fact platform income - and
 * an operator picking the wrong one finds out only after a contest has already failed.
 */
export function UnscoredPolicyField({
  value,
  disabled,
  onChange,
}: {
  value: UnscoredContestPolicy;
  /**
   * True once a player has paid to enter.
   *
   * Frozen at that point deliberately, and it is not an oversight that this field is absent
   * from `EDITABLE_ONCE_ENTERED`. The policy is part of the deal a player accepted when they
   * paid, so moving it afterwards changes where their money can go without their knowing. An
   * operator facing a provider outage mid-contest is not stuck: cancelling refunds every
   * entry fee in FULL with no platform fee, which is strictly better for the player than any
   * version of this setting.
   */
  disabled?: boolean;
  onChange: (value: UnscoredContestPolicy) => void;
}) {
  const copy = UNSCORED_CONTEST_POLICY_COPY.get(value);

  return (
    <div className="md:col-span-2">
      <Label className="text-gray-200">
        If the contest finishes and nobody scored
      </Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as UnscoredContestPolicy)}
      >
        <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-gray-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNSCORED_CONTEST_POLICIES.map((policy) => (
            <SelectItem key={policy} value={policy}>
              {UNSCORED_CONTEST_POLICY_COPY.get(policy)?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="mt-2 text-xs text-gray-400">{copy?.consequence}</p>

      {/*
        Spelled out because the two situations look identical from the operator's chair - no
        prizes were paid either way - and they are the two the owner separated by hand. A
        player who broke a rule has a result; a player the provider never reported for does
        not. Only the second is refundable, and an operator who assumes otherwise will file a
        bug against settlement the first time a liquidated trader is not paid back.
      */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/90">
          This applies only when <strong>no player recorded a score at all</strong>
          {" "}&mdash; the usual cause is the game provider failing to report. It does not
          apply to players who were disqualified: their entry fees stay with the contest and
          go to the unclaimed pool, the same as a trading competition. It also does not apply
          to a contest cancelled for too few players, which always refunds every entry fee in
          full with no platform fee.
        </p>
      </div>
    </div>
  );
}
