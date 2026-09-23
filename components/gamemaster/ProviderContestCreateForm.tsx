"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import ChallengeSettingsFields from "@/components/challenges/ChallengeSettingsFields";
import { defaultConfigValues } from "@/lib/services/games/config-schema";
import type { ConfigField } from "@/lib/services/games/config-schema";
import type { PlayMode } from "@/lib/services/games/play-shape";

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

interface Props {
  title: ContestableTitleOption;
  maxUsersPerCompetition: number;
  onBack: () => void;
}

/**
 * Game Master form for creating a provider contest.
 *
 * Reuses ChallengeSettingsFields (schema-driven, no game-code branches) rather than the
 * admin ConfigSchemaFields, which lives under apps/admin and cannot be imported here.
 * Trading fields stay off this path entirely.
 */
export default function ProviderContestCreateForm({
  title,
  maxUsersPerCompetition,
  onBack,
}: Props) {
  const router = useRouter();
  const fields = title.schema.ok ? title.schema.fields : [];
  const [settings, setSettings] = useState<Record<string, unknown>>(() =>
    defaultConfigValues(fields),
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [maxParticipants, setMaxParticipants] = useState(
    String(Math.min(20, maxUsersPerCompetition)),
  );
  const [platformFeePercentage, setPlatformFeePercentage] = useState("10");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [playMode, setPlayMode] = useState<PlayMode>(title.playMode);
  const [submitting, setSubmitting] = useState(false);

  const canPickMode = title.supportedPlayModes.length > 1;

  const startIsoHint = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.schema.ok) {
      toast.error("This game cannot be configured yet.");
      return;
    }
    if (!name.trim() || !description.trim() || !startTime || !endTime) {
      toast.error("Name, description, start and end are required.");
      return;
    }

    setSubmitting(true);
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
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
          entryFee: Number(entryFee),
          maxParticipants: Number(maxParticipants),
          platformFeePercentage: Number(platformFeePercentage),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          // One contest clock — play window matches the contest dates (12 s2.3).
          playWindowStart: start.toISOString(),
          playWindowEnd: end.toISOString(),
          playMode: canPickMode ? playMode : undefined,
          attemptsPolicy: "single",
          unresolvedRoundPolicy: "score_zero",
          unscoredContestPolicy: "refund_entry_fees",
          resultGracePeriodSeconds: 900,
          perRoundCostAcknowledged: true,
          prizeDistribution: [
            { rank: 1, percentage: 70 },
            { rank: 2, percentage: 20 },
            { rank: 3, percentage: 10 },
          ],
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
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose a different game
        </button>

        <div className="mb-8 flex items-start gap-3">
          <Trophy className="mt-1 h-8 w-8 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold">{title.displayName}</h1>
            <p className="text-sm text-gray-400">
              {title.providerName}
              {title.category ? ` · ${title.category}` : ""}
            </p>
          </div>
        </div>

        {!title.schema.ok ? (
          <p className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            This game cannot be configured: {title.schema.error}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Competition name">
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Entry fee (credits)">
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  required
                />
              </Field>
              <Field label="Platform fee %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={platformFeePercentage}
                  onChange={(e) => setPlatformFeePercentage(e.target.value)}
                  required
                />
              </Field>
              <Field label="Max players">
                <input
                  type="number"
                  min={2}
                  max={maxUsersPerCompetition}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Starts">
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={startTime}
                  min={startIsoHint}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </Field>
            </div>

            {canPickMode && (
              <Field label="Play style">
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
                  value={playMode}
                  onChange={(e) => setPlayMode(e.target.value as PlayMode)}
                >
                  {title.supportedPlayModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode === "scheduled"
                        ? "Everyone plays at once"
                        : "Play any time in the window"}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-cyan-400">
                Game settings
              </h2>
              <ChallengeSettingsFields
                fields={fields}
                values={settings}
                onChange={(fieldName, value) =>
                  setSettings((prev) => ({ ...prev, [fieldName]: value }))
                }
                disabled={submitting}
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <Link
                href="/gamemaster"
                className="text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium hover:bg-cyan-500 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create competition
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      {children}
    </label>
  );
}
