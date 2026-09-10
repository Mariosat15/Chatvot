"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Lock, Save } from "lucide-react";
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
import type { ConfigField } from "@/lib/services/games/config-schema";
import { ConfigSchemaFields } from "./ConfigSchemaFields";
import { RoundClockNote } from "./RoundClockNote";
import { PrizeDistributionEditor } from "./PrizeDistributionEditor";
import { UnscoredPolicyField } from "./UnscoredPolicyField";
import { RoundStartPolicyField } from "./RoundStartPolicyField";
import {
  type ContestDraft,
  emptyDraft,
  isoToLocal,
  toEditRequestBody,
} from "./contest-draft";
import { isClosedToEdits } from "@/lib/admin/provider-contest-edit-policy";
import { DEFAULT_CREDIT_SYMBOL } from "@/lib/utils/format-volts";
import { playShapeRules, type PlayMode } from "@/lib/services/games/play-shape";

/**
 * Editing a provider-game contest.
 *
 * WHY THERE IS A SECOND EDITOR AT ALL: `/competitions/edit/[id]` renders the trading editor,
 * whose fourteen fields include starting capital and leverage. A provider game has neither,
 * and chapter 12's acceptance criterion is that no trading field appears on a provider
 * contest screen. The trading route now refuses a provider contest outright, so this is the
 * only way to change one.
 *
 * THE INTERESTING BEHAVIOUR IS THE FREEZE, and it turns on participants rather than on
 * status. A contest with no entrants is a document; one somebody has paid into is a promise.
 * So `currentParticipants > 0` locks everything except the name, the description and raising
 * the cap - each disabled input carries the reason, because a greyed-out control with no
 * explanation is how an operator concludes the screen is broken and asks a developer.
 *
 * The client's idea of "entered" can go stale while the form is open, which is fine: the
 * server holds the same rule and refuses with the frozen fields named. The policy list lives
 * in `provider-contest-edit-policy.ts` precisely so the two cannot drift.
 *
 * IT ADAPTS TO THE CONTEST'S PLAY SHAPE SINCE TASK DOCUMENT 12, and until then it did not -
 * this screen never imported `play-shape.ts` at all. The wizard had withheld the attempts and
 * round-start controls on a simultaneous contest since `22` s8; the editor offered both, and
 * `applyEdit` forces both unconditionally, so an operator could pick "Best of several" on a
 * race, save it, be told the edit succeeded, and have it stored as `single`. The dates said
 * "Contest starts" with no hint, on a shape where the start is also the moment entry closes.
 *
 * // Reason: the same failure this codebase keeps finding - a control that appears to work
 * and does nothing - and the same sibling-screen shape as Edit routing, which the list learned
 * in `12` s2.2 and this page did not until s2.4. The shape is RESOLVED BY THE ROUTE and passed
 * in, never derived here, because deriving it needs the catalogue row and a second
 * implementation of that rule is how the screen and the service come to disagree.
 */

interface StoredContest {
  _id: string;
  name: string;
  description: string;
  status: string;
  currentParticipants?: number;
  entryFee?: number;
  minParticipants?: number;
  maxParticipants?: number;
  platformFeePercentage?: number;
  prizeDistribution?: { rank: number; percentage: number }[];
  startTime?: string;
  endTime?: string;
  attemptsPolicy?: "single" | "best_of_n" | "sum_of_n";
  attemptsAllowed?: number;
  unresolvedRoundPolicy?: "score_zero" | "exclude" | "hold_and_alert";
  unscoredContestPolicy?: "unclaimed_pool" | "refund_entry_fees";
  roundStartPolicy?: "reserve_full_round" | "until_window_closes";
  resultGracePeriodSeconds?: number;
  gameConfig?: {
    providerKey?: string;
    gameCode?: string;
    settings?: Record<string, unknown>;
  };
}

type SchemaState =
  | { ok: true; fields: ConfigField[] }
  | { ok: false; error: string };

export function ProviderContestEditor({
  competitionId,
  creditSymbol,
}: {
  competitionId: string;
  /** `AppSettings.credits.symbol`, resolved by the page. An entry fee is a credit amount. */
  creditSymbol?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState<StoredContest | null>(null);
  const [schema, setSchema] = useState<SchemaState | null>(null);
  const [titleName, setTitleName] = useState<string>();
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>();
  /**
   * The contest's shape, as the route resolved it.
   *
   * Undefined while loading and when the title has left the catalogue. Both fall back to
   * `anytime`, which is the shape that OFFERS every control - correct in the second case
   * because `applyEdit` forces nothing without a title, so withholding a control the save
   * would have honoured is the one error that loses an operator's work.
   */
  const [playMode, setPlayMode] = useState<PlayMode>();
  const [draft, setDraft] = useState<ContestDraft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/contests/${competitionId}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "That contest could not be loaded.");
        return;
      }
      setStored(data.contest);
      setSchema(data.schema);
      setTitleName(data.titleName);
      setMaxDurationSeconds(data.maxDurationSeconds);
      setPlayMode(data.playMode);
      setDraft(draftFromStored(data.contest));
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Declared before `save` closes over it rather than beside the JSX that reads it. A
  // `const` after the early returns still works, because `save` only runs from a render
  // where `stored` is set - but it reads as use-before-define and one reordered early
  // return would turn it into a real temporal-dead-zone throw.
  const entered = (stored?.currentParticipants ?? 0) > 0;

  // `anytime` while loading and when the title has gone, for the reason beside `playMode`.
  // Same call the wizard's two steps make, on the same module the edit service forces from.
  const shape = playShapeRules(playMode ?? "anytime");

  function patch(changes: Partial<ContestDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function save() {
    if (!stored) return;
    setSaving(true);
    setErrors([]);
    try {
      const response = await fetch(`/api/games/contests/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          toEditRequestBody(draft, {
            entered,
            schemaFields: schema?.ok ? schema.fields : undefined,
            maxDurationSeconds,
          }),
        ),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrors(data.errors ?? []);
        toast.error(data.error ?? "The contest could not be saved.");
        return;
      }

      if (data.warnings?.length) {
        toast.warning(data.warnings[0]);
      }
      toast.success("Contest saved.");
      router.push("/?activeTab=competitions");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 p-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading contest...
      </div>
    );
  }

  if (!stored) {
    return (
      <div className="p-8 text-gray-300">
        That contest could not be loaded.{" "}
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  if (isClosedToEdits(stored.status)) {
    return (
      <div className="max-w-2xl p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" />
          This contest is {stored.status.replace("_", " ")} and cannot be edited.
        </div>
        <p className="text-sm text-red-200/80">
          Its results and payouts are settled or void. Create a new contest
          instead.
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Edit game contest</h1>
        <p className="text-sm text-gray-400 mt-1">
          {titleName ?? "Provider game"} &middot;{" "}
          <span className="uppercase">{stored.status}</span>
        </p>
      </div>

      {entered && (
        <div
          data-testid="entered-freeze-notice"
          className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm space-y-1"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" />
            {stored.currentParticipants} player(s) have already entered
          </div>
          <p className="text-amber-200/80">
            The entry fee, prize split, timings and game settings are locked -
            changing them now would mean players in one contest paid different
            amounts or played different games. You can still fix the name and
            description, and raise the cap. To change anything else, cancel the
            contest so entrants are refunded, then create it again.
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-4 rounded-lg border border-red-500/40 bg-red-500/10 space-y-2">
          <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            This contest cannot be saved yet
          </div>
          <ul className="list-disc pl-5 text-sm text-red-200/90 space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Details
        </h2>
        <div>
          <Label htmlFor="name" className="text-gray-200">
            Name
          </Label>
          <Input
            id="name"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
          />
        </div>
        <div>
          <Label htmlFor="description" className="text-gray-200">
            Description
          </Label>
          <Textarea
            id="description"
            rows={3}
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
          />
        </div>
        <div>
          <Label htmlFor="maxParticipants" className="text-gray-200">
            Maximum players
          </Label>
          <Input
            id="maxParticipants"
            type="number"
            min={entered ? stored.currentParticipants : 2}
            value={draft.maxParticipants}
            onChange={(e) =>
              patch({ maxParticipants: Number(e.target.value) })
            }
            className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
          />
          {entered && (
            <p className="text-xs text-gray-500 mt-1">
              Can only be raised - it cannot drop below the{" "}
              {stored.currentParticipants} already entered.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Game settings
        </h2>
        <RoundClockNote
          variant="settings"
          startTime={draft.startTime}
          endTime={draft.endTime}
          schemaFields={schema?.ok ? schema.fields : undefined}
          settings={draft.settings}
          maxDurationSeconds={maxDurationSeconds}
          roundStartPolicy={draft.roundStartPolicy}
        />
        {schema?.ok === false ? (
          <p className="text-sm text-red-300">{schema.error}</p>
        ) : schema?.ok ? (
          <ConfigSchemaFields
            fields={schema.fields}
            values={draft.settings}
            onChange={(name, value) =>
              patch({ settings: { ...draft.settings, [name]: value } })
            }
            disabled={entered}
          />
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Entry and prizes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField
            id="entryFee"
            // Reason: the wizard's matching field names its unit. An unlabelled number here
            // left an operator editing a fee with no statement of what it is denominated in.
            label={`Entry fee (${creditSymbol?.trim() || DEFAULT_CREDIT_SYMBOL})`}
            value={draft.entryFee}
            min={0}
            step="0.01"
            disabled={entered}
            onChange={(v) => patch({ entryFee: v })}
          />
          <NumberField
            id="minParticipants"
            label="Minimum players"
            value={draft.minParticipants}
            min={2}
            disabled={entered}
            onChange={(v) => patch({ minParticipants: v })}
          />
          <NumberField
            id="platformFeePercentage"
            label="Platform fee %"
            value={draft.platformFeePercentage}
            min={0}
            max={100}
            disabled={entered}
            onChange={(v) => patch({ platformFeePercentage: v })}
          />
        </div>
        {/*
          Was a local `PrizeDistributionFields` that could edit a percentage and nothing else -
          no way to add a rank, remove one, or change which position a share belonged to. So an
          operator could reweight three winners but never make it five, or two. The wizard could
          not reach the setting at all, which is why every provider contest shipped with the
          same 50/30/20. One component now, shared with the wizard, because the pair of them
          disagreeing about what a prize split IS was the whole problem.
        */}
        <PrizeDistributionEditor
          value={draft.prizeDistribution}
          disabled={entered}
          platformFeePercentage={draft.platformFeePercentage}
          onChange={(prizeDistribution) => patch({ prizeDistribution })}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Timing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/*
            THE LABELS AND HINTS COME FROM THE SHAPE, not from this file. On a simultaneous
            contest the start is the gun and also the moment entry closes, which "Contest
            starts" with no hint does not say - and the operator most needs to know it here,
            because moving the start moves the entry deadline with it.
          */}
          <DateField
            id="startTime"
            label={shape.copy.startLabel}
            hint={shape.copy.startHint}
            value={draft.startTime}
            disabled={entered}
            onChange={(v) => patch({ startTime: v })}
          />
          <DateField
            id="endTime"
            label={shape.copy.endLabel}
            hint={shape.copy.endHint}
            value={draft.endTime}
            disabled={entered}
            onChange={(v) => patch({ endTime: v })}
          />
        </div>
        {/*
          The two play-window fields were here and are gone; the window is derived from the
          contest clock in `contest-draft.ts`. Removing them from the wizard alone would not
          have been enough - this form sends the window too, so an operator moving the end time
          here would have left `playWindowEnd` behind and shortened play without touching any
          field named "play".

          The paragraph that replaced them said most of the rule and stopped short of the part
          the owner found confusing - that an attempt cannot start in the final stretch. Now
          `RoundClockNote`, shared with the wizard so the two cannot describe the clock
          differently.
        */}
        <RoundClockNote
          variant="timing"
          startTime={draft.startTime}
          endTime={draft.endTime}
          schemaFields={schema?.ok ? schema.fields : undefined}
          settings={draft.settings}
          maxDurationSeconds={maxDurationSeconds}
          roundStartPolicy={draft.roundStartPolicy}
        />
        {/*
          Beside the dates, as in the wizard, because it changes what the note above says.
          Frozen once anyone has entered: it is not on `EDITABLE_ONCE_ENTERED`, so the server
          would refuse it anyway - the `disabled` here is so an operator finds that out
          before submitting rather than as a refusal naming a field they did not mean to send.

          WITHHELD ENTIRELY on a simultaneous contest, matching the wizard. `applyEdit` writes
          `forcedRoundStartPolicy` unconditionally - outside the "did the operator send this"
          branch - so this control could only ever be overridden, and `disabled` is not the
          same thing: a greyed-out control still says the setting applies to this contest.
        */}
        {shape.offersRoundStartPolicy ? (
          <RoundStartPolicyField
            value={draft.roundStartPolicy}
            disabled={entered}
            onChange={(value) => patch({ roundStartPolicy: value })}
          />
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            {shape.copy.roundStartWithheld}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Rounds
        </h2>
        {/*
          WITHHELD WITH ITS REASON on a simultaneous contest, matching the wizard, and this is
          the control the omission cost most: `applyEdit` reads `forcedAttemptsPolicy` FIRST
          and only falls through to the operator's choice when the shape forces nothing, so
          picking "Best of several" on a race was saved as `single` with a success toast.

          The sentence is `play-shape.ts`'s, shared with the wizard - see `copy.attemptsWithheld`.
        */}
        {shape.requiresSingleAttempt ? (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            {shape.copy.attemptsWithheld}
          </p>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/*
            ONE GUARD OVER BOTH CONTROLS, in a fragment, rather than the same condition
            written twice. A grid lays out a fragment's children as its own, so nothing moves
            - and the alternative is the shape a structural test cannot hold: with two
            conditionals, deleting the second leaves the first satisfying any check that looks
            backwards from the attempts count for a guard, which is how a half-removed guard
            hides behind the half that remains.
          */}
          {!shape.requiresSingleAttempt && (
            <>
              <div>
                <Label className="text-gray-200">Attempts</Label>
                <Select
                  value={draft.attemptsPolicy}
                  disabled={entered}
                  onValueChange={(value) =>
                    patch({
                      attemptsPolicy: value as ContestDraft["attemptsPolicy"],
                    })
                  }
                >
                  <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">One attempt</SelectItem>
                    <SelectItem value="best_of_n">Best of several</SelectItem>
                    <SelectItem value="sum_of_n">Sum of several</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.attemptsPolicy !== "single" && (
                <NumberField
                  id="attemptsAllowed"
                  label="Attempts allowed"
                  value={draft.attemptsAllowed ?? 3}
                  min={1}
                  disabled={entered}
                  onChange={(v) => patch({ attemptsAllowed: v })}
                />
              )}
            </>
          )}
          <div>
            <Label className="text-gray-200">
              If a round never reports a result
            </Label>
            <Select
              value={draft.unresolvedRoundPolicy}
              disabled={entered}
              onValueChange={(value) =>
                patch({
                  unresolvedRoundPolicy:
                    value as ContestDraft["unresolvedRoundPolicy"],
                })
              }
            >
              <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score_zero">Score it zero</SelectItem>
                <SelectItem value="exclude">
                  Remove the player and refund
                </SelectItem>
                <SelectItem value="hold_and_alert">
                  Hold settlement and alert
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberField
            id="resultGracePeriodSeconds"
            label="Result grace period (seconds)"
            value={draft.resultGracePeriodSeconds}
            min={0}
            disabled={entered}
            onChange={(v) => patch({ resultGracePeriodSeconds: v })}
          />
          <UnscoredPolicyField
            value={draft.unscoredContestPolicy}
            disabled={entered}
            onChange={(value) => patch({ unscoredContestPolicy: value })}
          />
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save changes
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function draftFromStored(contest: StoredContest): ContestDraft {
  return {
    ...emptyDraft,
    providerKey: contest.gameConfig?.providerKey ?? "",
    gameCode: contest.gameConfig?.gameCode ?? "",
    settings: contest.gameConfig?.settings ?? {},
    name: contest.name ?? "",
    description: contest.description ?? "",
    startTime: isoToLocal(contest.startTime),
    endTime: isoToLocal(contest.endTime),
    entryFee: contest.entryFee ?? 0,
    minParticipants: contest.minParticipants ?? 2,
    maxParticipants: contest.maxParticipants ?? 100,
    platformFeePercentage: contest.platformFeePercentage ?? 10,
    prizeDistribution: contest.prizeDistribution ?? emptyDraft.prizeDistribution,
    attemptsPolicy: contest.attemptsPolicy ?? "single",
    attemptsAllowed: contest.attemptsAllowed,
    unresolvedRoundPolicy: contest.unresolvedRoundPolicy ?? "score_zero",
    // Falls back to the SCHEMA default, not the wizard's. A contest created before the field
    // existed really will settle to the unclaimed pool, so showing the operator a refund here
    // would misreport what the stored contest does.
    unscoredContestPolicy: contest.unscoredContestPolicy ?? "unclaimed_pool",
    // Same reasoning as the line above: the SCHEMA default, so a contest created before the
    // field existed is shown the gate it really enforces rather than the wizard's answer.
    roundStartPolicy: contest.roundStartPolicy ?? "reserve_full_round",
    resultGracePeriodSeconds: contest.resultGracePeriodSeconds ?? 900,
    perRoundCostAcknowledged: false,
    // Not an edit concept: the contest already exists, and publishing is its own control.
    publishOnSave: false,
  };
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-gray-200">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 bg-gray-700 border-gray-600 text-gray-100 disabled:opacity-50"
      />
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  disabled,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  /** What this moment means under the contest's shape. From `play-shape.ts`, never local. */
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-gray-200">
        {label}
      </Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 bg-gray-700 border-gray-600 text-gray-100 disabled:opacity-50"
      />
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

