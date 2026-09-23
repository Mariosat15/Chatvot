"use client";

import ChallengeSettingsFields from "@/components/challenges/ChallengeSettingsFields";
import type { ConfigField } from "@/lib/services/games/config-schema";
import type { PlayMode } from "@/lib/services/games/play-shape";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder:text-gray-600 focus:border-cyan-600 focus:outline-none";

export function StepPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-gray-700/50 bg-gradient-to-r from-cyan-700/40 to-transparent px-6 py-5">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-cyan-100/80">{subtitle}</p>
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </div>
  );
}

export function Field({
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

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-800 pb-2 sm:flex-row sm:justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-200 sm:text-right">{value || "—"}</dd>
    </div>
  );
}

export function LockedPlatformFee({ fee }: { fee: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-600 bg-gray-700/50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gray-600 p-2">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-300">Platform Fee</h4>
          <p className="text-xs text-gray-500">
            Set by platform administrators — you cannot change this
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-gray-300">{fee}%</div>
        <div className="text-xs text-gray-500">of prize pool</div>
      </div>
    </div>
  );
}

export function BasicsStep({
  name,
  description,
  onName,
  onDescription,
}: {
  name: string;
  description: string;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  return (
    <StepPanel title="Basic Info" subtitle="Name and describe the contest">
      <Field label="Competition name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Friday Night Sprint"
        />
      </Field>
      <Field label="Description">
        <textarea
          className={inputClass}
          rows={4}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="What players need to know before they enter"
        />
      </Field>
    </StepPanel>
  );
}

export function GameSettingsStep({
  canPickMode,
  playMode,
  supportedPlayModes,
  onPlayMode,
  fields,
  settings,
  onSetting,
  disabled,
}: {
  canPickMode: boolean;
  playMode: PlayMode;
  supportedPlayModes: PlayMode[];
  onPlayMode: (m: PlayMode) => void;
  fields: ConfigField[];
  settings: Record<string, unknown>;
  onSetting: (name: string, value: unknown) => void;
  disabled: boolean;
}) {
  return (
    <StepPanel title="Game Settings" subtitle="Options for this title">
      {canPickMode && (
        <Field label="Play style">
          <select
            className={inputClass}
            value={playMode}
            onChange={(e) => onPlayMode(e.target.value as PlayMode)}
          >
            {supportedPlayModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "scheduled"
                  ? "Everyone plays at once"
                  : "Play any time in the window"}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
        <ChallengeSettingsFields
          fields={fields}
          values={settings}
          onChange={onSetting}
          disabled={disabled}
        />
      </div>
    </StepPanel>
  );
}

export function ScheduleStep({
  startTime,
  endTime,
  startIsoHint,
  entryFee,
  maxParticipants,
  maxUsersPerCompetition,
  fee,
  estimatedPool,
  onStart,
  onEnd,
  onEntryFee,
  onMaxParticipants,
}: {
  startTime: string;
  endTime: string;
  startIsoHint: string;
  entryFee: string;
  maxParticipants: string;
  maxUsersPerCompetition: number;
  fee: number;
  estimatedPool: number;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onEntryFee: (v: string) => void;
  onMaxParticipants: (v: string) => void;
}) {
  return (
    <StepPanel title="Schedule & Entry" subtitle="When it runs and what it costs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Starts">
          <input
            type="datetime-local"
            className={inputClass}
            value={startTime}
            min={startIsoHint}
            onChange={(e) => onStart(e.target.value)}
          />
        </Field>
        <Field label="Ends">
          <input
            type="datetime-local"
            className={inputClass}
            value={endTime}
            onChange={(e) => onEnd(e.target.value)}
          />
        </Field>
        <Field label="Entry fee (credits)">
          <input
            type="number"
            min={0}
            step="1"
            className={inputClass}
            value={entryFee}
            onChange={(e) => onEntryFee(e.target.value)}
          />
        </Field>
        <Field label={`Max players (up to ${maxUsersPerCompetition})`}>
          <input
            type="number"
            min={2}
            max={maxUsersPerCompetition}
            className={inputClass}
            value={maxParticipants}
            onChange={(e) => onMaxParticipants(e.target.value)}
          />
        </Field>
      </div>
      <LockedPlatformFee fee={fee} />
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
        <div className="text-xs text-gray-400">Estimated prize pool at full entry</div>
        <div className="mt-1 text-lg font-bold text-yellow-400">
          {estimatedPool.toFixed(0)} credits
        </div>
        <div className="text-xs text-gray-500">
          After {fee}% platform fee · based on max players
        </div>
      </div>
    </StepPanel>
  );
}

export function PrizesStep({
  prizes,
  prizeTotal,
  fee,
  onChange,
}: {
  prizes: { rank: number; percentage: number }[];
  prizeTotal: number;
  fee: number;
  onChange: (next: { rank: number; percentage: number }[]) => void;
}) {
  return (
    <StepPanel title="Prizes" subtitle="How the pool is split">
      <div className="space-y-3">
        {prizes.map((row, idx) => (
          <div key={row.rank} className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-400">#{row.rank}</span>
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              className={cn(inputClass, "max-w-[8rem]")}
              value={row.percentage}
              onChange={(e) => {
                const percentage = Number(e.target.value);
                onChange(
                  prizes.map((p, i) =>
                    i === idx ? { ...p, percentage } : p,
                  ),
                );
              }}
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
        ))}
      </div>
      <p
        className={cn(
          "text-sm",
          Math.abs(prizeTotal - 100) < 0.01 ? "text-green-400" : "text-amber-400",
        )}
      >
        Total: {prizeTotal}% (must be 100%)
      </p>
      <p className="text-xs text-gray-500">
        Winners receive net of the {fee}% platform fee.
      </p>
    </StepPanel>
  );
}

export function ReviewStep({
  name,
  displayName,
  startTime,
  endTime,
  entryFee,
  maxParticipants,
  fee,
  prizes,
  canPickMode,
  playMode,
}: {
  name: string;
  displayName: string;
  startTime: string;
  endTime: string;
  entryFee: string;
  maxParticipants: string;
  fee: number;
  prizes: { rank: number; percentage: number }[];
  canPickMode: boolean;
  playMode: PlayMode;
}) {
  return (
    <StepPanel title="Review & Launch" subtitle="Confirm before creating">
      <dl className="space-y-3 text-sm">
        <ReviewRow label="Name" value={name} />
        <ReviewRow label="Game" value={displayName} />
        <ReviewRow
          label="Window"
          value={
            startTime && endTime
              ? `${new Date(startTime).toLocaleString()} → ${new Date(endTime).toLocaleString()}`
              : "—"
          }
        />
        <ReviewRow label="Entry fee" value={`${entryFee} credits`} />
        <ReviewRow label="Max players" value={String(maxParticipants)} />
        <ReviewRow label="Platform fee" value={`${fee}% (admin)`} />
        <ReviewRow
          label="Prizes"
          value={prizes.map((p) => `#${p.rank} ${p.percentage}%`).join(" · ")}
        />
        {canPickMode && (
          <ReviewRow
            label="Play style"
            value={
              playMode === "scheduled" ? "Everyone plays at once" : "Play any time"
            }
          />
        )}
      </dl>
    </StepPanel>
  );
}
