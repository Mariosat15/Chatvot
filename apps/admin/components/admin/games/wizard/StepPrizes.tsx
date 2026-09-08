"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrizeDistributionEditor } from "../PrizeDistributionEditor";
import { UnscoredPolicyField } from "../UnscoredPolicyField";
import type { ContestDraft } from "../contest-draft";
import { NumberField } from "./fields";

/**
 * Step five: who gets paid, how many attempts they get, and what happens when a result never
 * arrives or nobody scores at all.
 *
 * THE THREE POLICIES BELOW ARE NOT SETTINGS AN OPERATOR CAN SKIP. A contest saved without
 * them is refused rather than defaulted: the contest would run, players would play, and the
 * settings governing their money would be ones nobody chose. Every control here therefore
 * carries the consequence in words next to it, from the same module the server reads.
 */
export function StepPrizes({
  draft,
  patch,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-gray-200">Prize distribution</Label>
        <PrizeDistributionEditor
          value={draft.prizeDistribution}
          onChange={(v) => patch({ prizeDistribution: v })}
          platformFeePercentage={draft.platformFeePercentage}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-gray-200">Attempts</Label>
          <Select
            value={draft.attemptsPolicy}
            onValueChange={(v) =>
              patch({ attemptsPolicy: v as ContestDraft["attemptsPolicy"] })
            }
          >
            <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">One attempt each</SelectItem>
              <SelectItem value="best_of_n">Best of several</SelectItem>
              <SelectItem value="sum_of_n">Total of several</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {draft.attemptsPolicy !== "single" && (
          <NumberField
            label="How many attempts"
            value={draft.attemptsAllowed}
            onChange={(v) => patch({ attemptsAllowed: v })}
            min={2}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-gray-200">
          If a player&apos;s result never arrives
        </Label>
        <Select
          value={draft.unresolvedRoundPolicy}
          onValueChange={(v) =>
            patch({
              unresolvedRoundPolicy: v as ContestDraft["unresolvedRoundPolicy"],
            })
          }
        >
          <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score_zero">
              Score it zero and settle on time
            </SelectItem>
            <SelectItem value="hold_and_alert">
              Hold settlement and alert an admin
            </SelectItem>
            {/*
              The parenthetical used to read "refund not automatic yet" and was TRUE when it
              was written. `exclusion-refund.ts` shipped with X5 and R44 gave it the input it
              needed, so the caution became a false statement about the operator's own
              platform - which is worse than no caution: it either scares an operator off a
              policy that works, or has them refund by hand on top of the automatic payment.
            */}
            <SelectItem value="exclude">
              Remove the player and refund their entry fee
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <NumberField
        label="Result grace period (seconds)"
        value={draft.resultGracePeriodSeconds}
        onChange={(v) => patch({ resultGracePeriodSeconds: v })}
        hint="How long after the contest ends a late result is still accepted."
        min={0}
      />

      <UnscoredPolicyField
        value={draft.unscoredContestPolicy}
        onChange={(value) => patch({ unscoredContestPolicy: value })}
      />
    </>
  );
}
