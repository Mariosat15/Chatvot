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
import { useTerms } from "@/contexts/TerminologyContext";
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
  const terms = useTerms();
  const copy = UNSCORED_CONTEST_POLICY_COPY.get(value);

  return (
    <div className="md:col-span-2">
      {/*
        "the" became "this" so the token can be inserted verbatim. A determiner is the one
        mid-phrase position that works: "this" is invariant, where "a" or "an" would have to
        agree with a first letter the operator chooses. Leading with the token instead
        ("Competition finishes and nobody scored") would have turned the condition this label
        states into a heading.

        `copy.consequence`, the option labels and the amber paragraph stay untokenised: they
        live in `round-types.ts`, which is mirrored and read by settlement, so the screen
        cannot promise an outcome the server does not deliver. Rewording them here would put
        player-facing and server-shared copy inside an admin wording commit.
      */}
      <Label className="text-gray-200">
        If this {terms.contest} finishes and nobody scored
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

        TOKENISED SINCE 15 SEPTEMBER 2026, and the sentence this replaces is worth keeping
        visible because it was believed: it said the paragraph was "untokenised on purpose",
        every noun in it being mid-sentence behind an article or a possessive, "which is the
        position a Title Case token cannot occupy". The owner settled that question the other
        way - the token goes in mid-sentence and Title Case is accepted - so the reason has
        gone and only the caution's wording survives. It is still never case-folded: a
        `.toLowerCase()` here would destroy the operator's own capitalisation.

        The one phrase that was changed earlier is the comparison: it read "the same as a trading
        competition", which is the generic noun spelled out for trading and nothing else,
        and reads as though the platform keeps one vocabulary for trading and another for
        games. The noun is dropped rather than tokenised - "trading" carries it alone.
        "trader" below is deliberately literal: it names who is liquidated, and only a
        trading account can be.
      */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/90">
          This applies only when{" "}
          <strong>
            no {terms.player} recorded a {terms.score} at all
          </strong>
          {" "}&mdash; the usual cause is the {terms.game} provider failing to report. It does
          not apply to {terms.players} who were disqualified: their {terms.entryFee} stays
          with the {terms.contest} and goes to the unclaimed pool, the same as trading does.
          It also does not apply to a {terms.contest} cancelled for too few {terms.players},
          which always refunds every {terms.entryFee} in full with no platform fee.
        </p>
      </div>
    </div>
  );
}
