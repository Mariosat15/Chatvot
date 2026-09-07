"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfigSchemaFields, defaultConfigValues } from "./ConfigSchemaFields";
import { PrizeDistributionEditor } from "./PrizeDistributionEditor";
import { UnscoredPolicyField } from "./UnscoredPolicyField";
import { RoundClockNote } from "./RoundClockNote";
import { RoundStartPolicyField } from "./RoundStartPolicyField";
import type { ContestableTitle } from "./contest-types";
import {
  type ContestDraft,
  emptyDraft,
  toRequestBody,
} from "./contest-draft";

/**
 * Creating a competition on a provider game.
 *
 * FOUR STEPS, NOT THE TRADING FORM'S SEVEN, because three of those seven are trading
 * instruments, starting capital and leverage - none of which a provider game has. The
 * acceptance criterion in chapter 12 is that a provider contest is creatable "without a
 * single trading field appearing", and the honest way to meet it is a form that has none.
 *
 * IT SAVES A DRAFT. Players cannot see drafts, and that is required rather than cautious -
 * the player-facing side of a provider contest is X7, and the entry path still copies
 * trading starting capital onto a participant. Publishing waits for X5.
 */

interface ProviderContestWizardProps {
  titles: ContestableTitle[];
}

const STEPS = ["Game", "Settings", "Timing & prizes", "Review"] as const;

export function ProviderContestWizard({ titles }: ProviderContestWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ContestDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const selected = titles.find(
    (t) => t.providerKey === draft.providerKey && t.gameCode === draft.gameCode,
  );

  function patch(changes: Partial<ContestDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function selectTitle(title: ContestableTitle) {
    // The previous game's answers are discarded, never merged. Reason: they are keyed by
    // that schema's field names, so carrying them over would submit settings the new game
    // does not declare - which the validator drops silently, leaving the review step
    // showing values that will not be stored.
    patch({
      providerKey: title.providerKey,
      gameCode: title.gameCode,
      settings: title.schema.ok ? defaultConfigValues(title.schema.fields) : {},
    });
    setErrors([]);
    setWarnings([]);
  }

  async function runPreflight() {
    if (!selected) return;
    setSubmitting(true);
    setErrors([]);
    setWarnings([]);
    try {
      const response = await fetch("/api/games/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preflight", ...toRequestBody(draft) }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "The check could not be run.");
        return;
      }
      setErrors(data.errors ?? []);
      setWarnings(data.warnings ?? []);
      setStep(3);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Publishes the contest that was just created, and reports honestly if it cannot.
   *
   * A SECOND REQUEST, NOT A FLAG ON THE FIRST, and that is the load-bearing part. The publish
   * route re-runs the whole pre-flight against the STORED record - which asks the question
   * creation could not, namely whether the settings actually persisted, and catches a draft
   * whose title or provider was switched off between the two steps. A `publish: true`
   * parameter on create would have skipped that and published on the strength of the check
   * the caller's own input had already passed.
   *
   * A REFUSAL HERE LEAVES A DRAFT, NOT A FAILURE. The contest exists and is correct; only its
   * visibility is outstanding, and the list screen's own publish button is the way to retry.
   * Saying "created but not published" is the whole message - a bare error would send an
   * operator back to the wizard to create a second copy of a contest that already exists.
   */
  async function publishCreated(competitionId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/games/contests/${competitionId}/publish`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        const refusals: string[] = data.errors ?? [];
        setErrors(
          refusals.length > 0
            ? refusals
            : [data.error ?? "The contest could not be published."],
        );
        toast.warning(
          "Contest created, but it could not be published yet. It is saved as a draft - publish it from the competitions list once the problems below are fixed.",
        );
        return false;
      }

      toast.success("Contest created and published. Players can enter it now.");
      for (const warning of (data.warnings ?? []) as string[]) {
        toast.warning(warning);
      }
      return true;
    } catch {
      toast.warning(
        "Contest created, but publishing failed. It is saved as a draft - publish it from the competitions list.",
      );
      return false;
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/games/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...toRequestBody(draft) }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrors(data.errors ?? []);
        toast.error(data.error ?? "The contest could not be created.");
        return;
      }

      if (draft.publishOnSave && data.competitionId) {
        const published = await publishCreated(String(data.competitionId));
        if (!published) return;
      } else {
        toast.success("Draft contest created. Players cannot see it yet.");
      }

      router.push("/?activeTab=competitions");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-2 ${
              index === step ? "text-yellow-400" : "text-gray-500"
            }`}
          >
            <span
              className={`h-6 w-6 rounded-full grid place-items-center text-xs ${
                index < step
                  ? "bg-green-600 text-white"
                  : index === step
                    ? "bg-yellow-500 text-gray-900"
                    : "bg-gray-700"
              }`}
            >
              {index < step ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {label}
            {index < STEPS.length - 1 && (
              <span className="text-gray-700 ml-1">/</span>
            )}
          </li>
        ))}
      </ol>

      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        {step === 0 && (
          <StepGame titles={titles} selected={selected} onSelect={selectTitle} />
        )}

        {step === 1 && selected && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-white">
              {selected.displayName} settings
            </h3>
            <RoundClockNote
              variant="settings"
              startTime={draft.startTime}
              endTime={draft.endTime}
              maxDurationSeconds={selected.maxDurationSeconds}
              roundStartPolicy={draft.roundStartPolicy}
            />
            {selected.schema.ok ? (
              <ConfigSchemaFields
                fields={selected.schema.fields}
                values={draft.settings}
                onChange={(name, value) =>
                  patch({ settings: { ...draft.settings, [name]: value } })
                }
              />
            ) : (
              <Problem
                title="This game's settings cannot be read"
                lines={[selected.schema.error]}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <StepTiming
            draft={draft}
            patch={patch}
            maxDurationSeconds={selected?.maxDurationSeconds}
          />
        )}

        {step === 3 && (
          <StepReview
            draft={draft}
            patch={patch}
            title={selected}
            errors={errors}
            warnings={warnings}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {step < 2 && (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!selected || (step === 1 && !selected.schema.ok)}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {step === 2 && (
          <Button onClick={runPreflight} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Check and review
          </Button>
        )}

        {step === 3 && (
          <Button
            onClick={submit}
            disabled={submitting || errors.length > 0}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {draft.publishOnSave ? "Create and publish" : "Create draft"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepGame({
  titles,
  selected,
  onSelect,
}: {
  titles: ContestableTitle[];
  selected?: ContestableTitle;
  onSelect: (title: ContestableTitle) => void;
}) {
  if (titles.length === 0) {
    return (
      <Problem
        title="No games are available yet"
        lines={[
          "A game appears here once its provider is enabled, its catalogue is synced, and the title is switched on in the provider's game list.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">Choose the game</h3>
      {titles.map((title) => {
        const isSelected =
          selected?.providerKey === title.providerKey &&
          selected?.gameCode === title.gameCode;
        return (
          <button
            key={`${title.providerKey}:${title.gameCode}`}
            onClick={() => onSelect(title)}
            disabled={!title.supportsCompetition}
            className={`w-full text-left p-4 rounded-xl border transition ${
              isSelected
                ? "border-yellow-500 bg-yellow-500/10"
                : "border-gray-700 hover:border-gray-600"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{title.displayName}</span>
              <span className="text-xs text-gray-400">{title.providerName}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {title.scoreDirection === "lower_is_better"
                ? "Lower score wins"
                : "Higher score wins"}
              {title.maxDurationSeconds
                ? ` / up to ${title.maxDurationSeconds}s a round`
                : ""}
              {!title.supportsCompetition && " / does not support competitions"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function StepTiming({
  draft,
  patch,
  maxDurationSeconds,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  maxDurationSeconds?: number;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-white">Timing, entry and prizes</h3>

      <div className="space-y-2">
        <Label className="text-gray-200">Name</Label>
        <Input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="bg-gray-900 border-gray-700 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-gray-200">Description</Label>
        <Textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          className="bg-gray-900 border-gray-700 text-white"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DateField
          label="Contest starts"
          value={draft.startTime}
          onChange={(v) => patch({ startTime: v })}
        />
        <DateField
          label="Contest ends"
          value={draft.endTime}
          onChange={(v) => patch({ endTime: v })}
        />
      </div>
      {/*
        THE PLAY WINDOW USED TO BE TWO MORE DATE FIELDS HERE, AND IT IS NOT A SIMPLIFICATION TO
        REMOVE THEM - it is the fix for a contest that could not do what a contest is for.

        Four dates let an operator open play at a different moment from the contest, which
        sounds like flexibility and is really a way to build a contest nobody can win fairly:
        players who started earlier got a longer run at it, and the field named "ends" gated
        nothing a player played inside. The owner's requirement is one clock for everybody -
        the contest opens, every player has exactly the same window, it closes, every round
        closes with it and settlement runs.

        So the window is now DERIVED from the contest, in `contest-draft.ts`, and there is
        nothing to set. Entry is not squeezed by this: registration closes at `startTime`, so
        an operator who wants five minutes of sign-up time creates the contest five minutes
        before it starts. That is what the trading wizard already does.

        THE PARAGRAPH THAT USED TO SIT HERE said most of this and stopped short of the fact the
        owner was missing - that an attempt cannot be started in the final stretch, because the
        platform reserves the game's longest possible round. It is now `RoundClockNote`, shared
        with the editor, so the two screens cannot describe the clock differently.
      */}
      <RoundClockNote
        variant="timing"
        startTime={draft.startTime}
        endTime={draft.endTime}
        maxDurationSeconds={maxDurationSeconds}
        roundStartPolicy={draft.roundStartPolicy}
      />

      {/*
        Placed with the dates rather than with the round settings, because the question it
        answers is about the contest's clock - "when can people actually play?" - and it
        changes what the note directly above says. Two screens apart, an operator would read
        a cut-off, scroll, change the policy, and never see the note stop mentioning one.
      */}
      <RoundStartPolicyField
        value={draft.roundStartPolicy}
        onChange={(value) => patch({ roundStartPolicy: value })}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <NumberField
          label="Entry fee"
          value={draft.entryFee}
          onChange={(v) => patch({ entryFee: v })}
        />
        <NumberField
          label="Min players"
          value={draft.minParticipants}
          onChange={(v) => patch({ minParticipants: v })}
        />
        <NumberField
          label="Max players"
          value={draft.maxParticipants}
          onChange={(v) => patch({ maxParticipants: v })}
        />
        {/*
          Missing until now, and silently: the draft carried `platformFeePercentage: 10` and
          the wizard never rendered it, so every provider contest took ten per cent whatever
          the operator wanted. The editor has always exposed it, which is the worse version of
          the bug - the setting appears once the contest exists, so it reads as a field the
          operator forgot rather than one they were never offered.
        */}
        <NumberField
          label="Platform fee %"
          value={draft.platformFeePercentage}
          onChange={(v) => patch({ platformFeePercentage: v })}
        />
      </div>
      <p className="text-xs text-gray-500">
        Below the minimum the contest auto-cancels and every entry fee is
        refunded in full.
      </p>

      <div className="space-y-2">
        <Label className="text-gray-200">Prize distribution</Label>
        <PrizeDistributionEditor
          value={draft.prizeDistribution}
          onChange={(v) => patch({ prizeDistribution: v })}
          platformFeePercentage={draft.platformFeePercentage}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-200">Attempts</Label>
          <Select
            value={draft.attemptsPolicy}
            onValueChange={(v) =>
              patch({ attemptsPolicy: v as ContestDraft["attemptsPolicy"] })
            }
          >
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
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
          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score_zero">Score it zero and settle on time</SelectItem>
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
      />

      <UnscoredPolicyField
        value={draft.unscoredContestPolicy}
        onChange={(value) => patch({ unscoredContestPolicy: value })}
      />
    </div>
  );
}

function StepReview({
  draft,
  patch,
  title,
  errors,
  warnings,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  title?: ContestableTitle;
  errors: string[];
  warnings: string[];
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-white">Review</h3>

      {errors.length > 0 && (
        <Problem title="This contest cannot be created yet" lines={errors} />
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-600/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            Worth knowing
          </div>
          <ul className="text-sm text-amber-200/90 space-y-1 list-disc list-inside">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length === 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300 space-y-1">
          <p>
            <span className="text-gray-500">Game:</span>{" "}
            {title?.displayName ?? "-"} ({title?.providerName})
          </p>
          <p>
            <span className="text-gray-500">Name:</span> {draft.name || "-"}
          </p>
          <p>
            <span className="text-gray-500">Entry fee:</span> {draft.entryFee}
          </p>
          <p>
            <span className="text-gray-500">Players:</span>{" "}
            {draft.minParticipants} to {draft.maxParticipants}
          </p>
          {/*
            CORRECTED 7 SEP 2026, TWICE. It first ended "Publishing arrives with the
            player-facing game screens", which was true when written and false from 5
            September. It then described an unconditional draft, which stopped being true the
            moment publishing became a checkbox - and a review step that describes the wrong
            outcome is worse than one that describes none, because it is read as confirmation.
          */}
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-700 bg-gray-800/60 p-3">
            <input
              type="checkbox"
              checked={draft.publishOnSave}
              onChange={(e) => patch({ publishOnSave: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-yellow-500"
            />
            <span className="text-xs text-gray-300">
              <strong className="text-white">
                Publish immediately, so players can enter it
              </strong>
              <span className="mt-1 block text-gray-400">
                {draft.publishOnSave
                  ? "The contest is checked once more against what was actually saved, then made visible. If that second check refuses it, the contest is kept as a draft and the reasons are shown here."
                  : "The contest is saved as a draft. Players cannot see or join a draft - press Publish on the contest list when you are ready."}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function Problem({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-red-600/50 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-red-300 font-semibold text-sm mb-2">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <ul className="text-sm text-red-200/90 space-y-1 list-disc list-inside">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-200">{label}</Label>
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-900 border-gray-700 text-white"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-200">{label}</Label>
      <Input
        type="number"
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-gray-900 border-gray-700 text-white"
      />
    </div>
  );
}
