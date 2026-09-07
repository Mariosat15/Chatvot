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
import { PrizeDistributionEditor } from "./PrizeDistributionEditor";
import {
  type ContestDraft,
  emptyDraft,
  isoToLocal,
  toEditRequestBody,
} from "./contest-draft";
import { isClosedToEdits } from "@/lib/admin/provider-contest-edit-policy";

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
}: {
  competitionId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState<StoredContest | null>(null);
  const [schema, setSchema] = useState<SchemaState | null>(null);
  const [titleName, setTitleName] = useState<string>();
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
        body: JSON.stringify(toEditRequestBody(draft, { entered })),
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
            label="Entry fee"
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
          <DateField
            id="startTime"
            label="Contest starts"
            value={draft.startTime}
            disabled={entered}
            onChange={(v) => patch({ startTime: v })}
          />
          <DateField
            id="endTime"
            label="Contest ends"
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
        */}
        <p className="text-xs text-gray-500">
          Every player gets the same window. Any round still open at the end
          time is closed with the contest.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Rounds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    resultGracePeriodSeconds: contest.resultGracePeriodSeconds ?? 900,
    perRoundCostAcknowledged: false,
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
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
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
    </div>
  );
}

