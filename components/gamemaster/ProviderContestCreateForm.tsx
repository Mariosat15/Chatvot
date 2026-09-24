"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  SlidersHorizontal,
  Trophy,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { defaultConfigValues } from "@/lib/services/games/config-schema";
import type { ConfigField } from "@/lib/services/games/config-schema";
import type { PlayMode } from "@/lib/services/games/play-shape";
import {
  joinUtcDraft,
  utcDraftToIso,
} from "@/components/gamemaster/UtcScheduleFields";
import {
  BasicsStep,
  GameSettingsStep,
  PrizesStep,
  ReviewStep,
  ScheduleStep,
} from "@/components/gamemaster/provider-contest-wizard-steps";

export interface ContestableTitleOption {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  category?: string;
  playMode: PlayMode;
  supportedPlayModes: PlayMode[];
  maxDurationSeconds?: number;
  schema:
    | { ok: true; fields: ConfigField[] }
    | { ok: false; error: string };
}

interface PrizeShare {
  rank: number;
  percentage: number;
}

interface Props {
  title: ContestableTitleOption;
  maxUsersPerCompetition: number;
  /** Admin-controlled fee from Challenge Settings — display only; create ignores body. */
  platformFeePercentage: number;
  /** Package daily cap — banner + Launch gate only; earlier steps stay editable. */
  maxCompetitionsPerDay: number;
  competitionsCreatedToday: number;
  /** Concurrent draft/upcoming/active cap from the package. */
  maxActiveCompetitions: number;
  activeCompetitions: number;
  onBack: () => void;
}

const STEPS = [
  { number: 1, title: "Basic Info", description: "Name and description", icon: FileText },
  { number: 2, title: "Game Settings", description: "How the game plays", icon: SlidersHorizontal },
  { number: 3, title: "Schedule & Entry", description: "Clock, players and fee", icon: Calendar },
  { number: 4, title: "Prizes", description: "Who gets how much", icon: Trophy },
  { number: 5, title: "Launch", description: "Review and create", icon: Zap },
] as const;

const DEFAULT_PRIZES: PrizeShare[] = [
  { rank: 1, percentage: 70 },
  { rank: 2, percentage: 20 },
  { rank: 3, percentage: 10 },
];

function defaultUtcDraft(daysFromNow: number, time: string): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return joinUtcDraft(ymd, time);
}

/**
 * Game Master wizard for creating a provider contest.
 *
 * Mirrors the trading GM multi-step chrome. Platform fee is locked to admin
 * Challenge Settings — never editable; create route ignores any body fee.
 */
export default function ProviderContestCreateForm({
  title,
  maxUsersPerCompetition,
  platformFeePercentage,
  maxCompetitionsPerDay,
  competitionsCreatedToday,
  maxActiveCompetitions,
  activeCompetitions,
  onBack,
}: Props) {
  const router = useRouter();
  const fields = title.schema.ok ? title.schema.fields : [];
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<Record<string, unknown>>(() =>
    defaultConfigValues(fields),
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [maxParticipants, setMaxParticipants] = useState(
    String(Math.min(20, maxUsersPerCompetition)),
  );
  // Reason: seed tomorrow/day-after UTC so the white calendar opens on a usable day and
  // start is after server time without forcing an empty datetime-local.
  const [startTime, setStartTime] = useState(() =>
    defaultUtcDraft(1, "12:00"),
  );
  const [endTime, setEndTime] = useState(() => defaultUtcDraft(1, "18:00"));
  const [playMode, setPlayMode] = useState<PlayMode>(title.playMode);
  const [prizes, setPrizes] = useState<PrizeShare[]>(DEFAULT_PRIZES);
  const [submitting, setSubmitting] = useState(false);

  const canPickMode = title.supportedPlayModes.length > 1;
  const fee = Number.isFinite(platformFeePercentage)
    ? platformFeePercentage
    : 10;

  const remainingToday = Math.max(
    0,
    maxCompetitionsPerDay - competitionsCreatedToday,
  );
  const remainingActive = Math.max(
    0,
    maxActiveCompetitions - activeCompetitions,
  );
  const canCreate = remainingToday > 0 && remainingActive > 0;
  const blockedByActive = remainingActive <= 0;
  const blockedByDaily = remainingToday <= 0 && !blockedByActive;

  const prizeTotal = prizes.reduce((s, p) => s + Number(p.percentage || 0), 0);
  const entryNum = Number(entryFee) || 0;
  const maxNum = Number(maxParticipants) || 0;
  const estimatedPool =
    entryNum * maxNum * (1 - Math.min(100, Math.max(0, fee)) / 100);

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!name.trim()) return "Give the competition a name.";
      if (!description.trim()) return "Add a short description.";
    }
    if (n === 2 && !title.schema.ok) {
      return "This game cannot be configured yet.";
    }
    if (n === 3) {
      if (!startTime || !endTime) return "Set start and end times.";
      // Reason: drafts are UTC wall-clock (`YYYY-MM-DDTHH:mm`); bare `new Date(draft)` is local.
      const startMs = new Date(utcDraftToIso(startTime)).getTime();
      const endMs = new Date(utcDraftToIso(endTime)).getTime();
      if (!(endMs > startMs)) {
        return "End must be after start (UTC).";
      }
      if (entryNum < 0) return "Entry fee cannot be negative.";
      if (maxNum < 2) return "At least 2 players are required.";
      if (maxNum > maxUsersPerCompetition) {
        return `Max players cannot exceed ${maxUsersPerCompetition}.`;
      }
    }
    if (n === 4 && Math.abs(prizeTotal - 100) > 0.01) {
      return "Prize shares must add up to 100%.";
    }
    return null;
  }

  function goNext() {
    // Reason: either package cap blocks the whole wizard from step 1 — same as trading GM.
    if (!canCreate) {
      toast.error(
        blockedByActive
          ? "Active competition limit reached"
          : "Daily competition limit reached",
      );
      return;
    }
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  }

  async function handleCreate() {
    if (!canCreate) {
      toast.error(
        blockedByActive
          ? "Active competition limit reached"
          : "Daily competition limit reached",
      );
      return;
    }
    for (let n = 1; n <= 4; n++) {
      const err = validateStep(n);
      if (err) {
        toast.error(err);
        setStep(n);
        return;
      }
    }
    if (!title.schema.ok) {
      toast.error("This game cannot be configured yet.");
      return;
    }

    setSubmitting(true);
    try {
      // Reason: append :00Z so the instant matches the UTC clock on the schedule step.
      const startIso = utcDraftToIso(startTime);
      const endIso = utcDraftToIso(endTime);
      const res = await fetch("/api/gamemaster/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "provider",
          name: name.trim(),
          description: description.trim(),
          providerKey: title.providerKey,
          gameCode: title.gameCode,
          settings,
          entryFee: entryNum,
          maxParticipants: maxNum,
          // Fee omitted — server stamps Challenge Settings.
          startTime: startIso,
          endTime: endIso,
          playWindowStart: startIso,
          playWindowEnd: endIso,
          playMode,
          attemptsPolicy: "single",
          unresolvedRoundPolicy: "score_zero",
          unscoredContestPolicy: "refund_entry_fees",
          resultGracePeriodSeconds: 900,
          perRoundCostAcknowledged: true,
          prizeDistribution: prizes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not create the contest.");
        if (Array.isArray(data.errors)) {
          data.errors.forEach((msg: string) => toast.error(msg));
        }
        return;
      }
      toast.success("Competition created successfully!");
      router.push(`/competitions/${data.competition?.id ?? data.competitionId}`);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose a different game
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{title.displayName}</h1>
          <p className="text-sm text-gray-400">
            {title.providerName}
            {title.category ? ` · ${title.category}` : ""}
            {" · "}
            {remainingToday} / {maxCompetitionsPerDay} remaining today
            {" · "}
            {remainingActive} / {maxActiveCompetitions} active slots
          </p>
        </div>

        {blockedByActive && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-400">
                Active Competition Limit Reached
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                You already have {activeCompetitions} active competition(s)
                (limit {maxActiveCompetitions}). Wait for one to finish or
                cancel a draft before creating another.
              </p>
            </div>
          </div>
        )}

        {blockedByDaily && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-400">Daily Limit Reached</h3>
              <p className="mt-1 text-sm text-gray-400">
                You&apos;ve created {competitionsCreatedToday} competition(s)
                today (limit {maxCompetitionsPerDay}). Come back tomorrow to
                create more!
              </p>
            </div>
          </div>
        )}

        {!title.schema.ok ? (
          <p className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            This game cannot be configured: {title.schema.error}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <aside className="lg:col-span-1">
              <div className="sticky top-20 rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800 to-gray-900 p-4 shadow-2xl sm:p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Creation Progress
                </h3>
                <div className="space-y-3">
                  {STEPS.map((s) => {
                    const Icon = s.icon;
                    const active = step === s.number;
                    const done = step > s.number;
                    return (
                      <button
                        key={s.number}
                        type="button"
                        disabled={!done && !active}
                        onClick={() => done && setStep(s.number)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                          active && "bg-cyan-600/80 shadow-lg",
                          done && !active && "bg-gray-700/50 hover:bg-gray-700",
                          !done && !active && "bg-gray-800/50 opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            active
                              ? "bg-white/20"
                              : done
                                ? "bg-green-500/20"
                                : "bg-gray-700/50",
                          )}
                        >
                          {done ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                active ? "text-white" : "text-gray-400",
                              )}
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block text-sm font-semibold",
                              active ? "text-white" : "text-gray-300",
                            )}
                          >
                            {s.title}
                          </span>
                          <span
                            className={cn(
                              "block text-xs",
                              active ? "text-white/80" : "text-gray-500",
                            )}
                          >
                            {s.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl">
                {step === 1 && (
                  <BasicsStep
                    name={name}
                    description={description}
                    onName={setName}
                    onDescription={setDescription}
                  />
                )}
                {step === 2 && (
                  <GameSettingsStep
                    canPickMode={canPickMode}
                    playMode={playMode}
                    supportedPlayModes={title.supportedPlayModes}
                    onPlayMode={setPlayMode}
                    fields={fields}
                    settings={settings}
                    onSetting={(fieldName, value) =>
                      setSettings((prev) => ({ ...prev, [fieldName]: value }))
                    }
                    disabled={submitting}
                  />
                )}
                {step === 3 && (
                  <ScheduleStep
                    startTime={startTime}
                    endTime={endTime}
                    entryFee={entryFee}
                    maxParticipants={maxParticipants}
                    maxUsersPerCompetition={maxUsersPerCompetition}
                    fee={fee}
                    estimatedPool={estimatedPool}
                    onStart={setStartTime}
                    onEnd={setEndTime}
                    onEntryFee={setEntryFee}
                    onMaxParticipants={setMaxParticipants}
                    disabled={submitting}
                  />
                )}
                {step === 4 && (
                  <PrizesStep
                    prizes={prizes}
                    prizeTotal={prizeTotal}
                    fee={fee}
                    onChange={setPrizes}
                  />
                )}
                {step === 5 && (
                  <ReviewStep
                    name={name}
                    displayName={title.displayName}
                    startTime={startTime}
                    endTime={endTime}
                    entryFee={entryFee}
                    maxParticipants={maxParticipants}
                    fee={fee}
                    prizes={prizes}
                    canPickMode={canPickMode}
                    playMode={playMode}
                  />
                )}

                <div className="flex items-center justify-between gap-4 border-t border-gray-700/50 px-6 py-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                  ) : (
                    <Link
                      href="/gamemaster"
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Cancel
                    </Link>
                  )}
                  {step < 5 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canCreate}
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting || !canCreate}
                      onClick={handleCreate}
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {canCreate
                        ? "Create competition"
                        : "Daily limit reached"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
