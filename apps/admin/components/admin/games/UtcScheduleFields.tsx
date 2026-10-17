"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Trading-style contest clock for provider games: date + 24h UTC time, with a live
 * server clock.
 *
 * WHY THIS EXISTS. The game wizard used `datetime-local`, which the browser paints as a
 * 12-hour AM/PM control with no zone. Operators set start at 11:56 PM and end at 12:10 PM
 * on the same day and got "play window must end after it starts" — the times were valid
 * as typed, just not what they meant. Trading already solves this with explicit 0–23 UTC
 * fields and a "Current Server Time (UTC)" banner. Same answers here, same vocabulary.
 *
 * VALUE SHAPE. `YYYY-MM-DDTHH:mm` interpreted as UTC wall-clock (not the operator's
 * browser zone). `contest-draft.ts` converts with a `Z` suffix so the server stores the
 * instant the operator saw on this screen.
 */

const TIME_PRESETS = [
  "00:00",
  "06:00",
  "09:00",
  "12:00",
  "15:00",
  "18:00",
  "21:00",
] as const;

/** How long to run after the chosen start — one click instead of re-typing the end. */
const DURATION_PRESETS_MINUTES = [15, 30, 60, 120, 240] as const;

/**
 * Light calendar popup. Same rule as the Game Master copy: dark fields make the native
 * Windows/Chrome calendar unreadable; white field + color-scheme:light is the fix.
 */
export const WHITE_DATE_PICKER_CLASS =
  "[color-scheme:light] " +
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-100";

export const WHITE_DATE_INPUT_CLASS =
  `h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 ` +
  `shadow-xs outline-none focus-visible:border-emerald-500 focus-visible:ring-[3px] ` +
  `focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 ` +
  WHITE_DATE_PICKER_CLASS;

export function splitUtcDraft(value: string): { date: string; time: string } {
  if (!value || !value.includes("T")) return { date: "", time: "12:00" };
  const [date, rest] = value.split("T");
  const time = (rest ?? "12:00").slice(0, 5);
  return { date: date ?? "", time: /^\d{2}:\d{2}$/.test(time) ? time : "12:00" };
}

export function joinUtcDraft(date: string, time: string): string {
  if (!date) return "";
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${safeTime}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcClock(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function clampHour(raw: string): number {
  let hour = parseInt(raw, 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour < 0) hour = 0;
  if (hour > 23) hour = 23;
  return hour;
}

function clampMinute(raw: string): number {
  let minute = parseInt(raw, 10);
  if (!Number.isFinite(minute)) minute = 0;
  if (minute < 0) minute = 0;
  if (minute > 59) minute = 59;
  return minute;
}

function addMinutesToUtcDraft(value: string, minutes: number): string {
  if (!value) return "";
  const instant = new Date(`${value}:00Z`);
  if (Number.isNaN(instant.getTime())) return "";
  instant.setUTCMinutes(instant.getUTCMinutes() + minutes);
  return joinUtcDraft(
    formatUtcDate(instant),
    `${pad2(instant.getUTCHours())}:${pad2(instant.getUTCMinutes())}`,
  );
}

function UtcTimeInputs({
  id,
  time,
  disabled,
  onTimeChange,
}: {
  id: string;
  time: string;
  disabled?: boolean;
  onTimeChange: (time: string) => void;
}) {
  const [hour = "12", minute = "00"] = time.split(":");

  const setHour = (raw: string) => {
    onTimeChange(`${pad2(clampHour(raw))}:${minute}`);
  };
  const setMinute = (raw: string) => {
    onTimeChange(`${hour}:${pad2(clampMinute(raw))}`);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            id={`${id}-hour`}
            min={0}
            max={23}
            disabled={disabled}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            onBlur={(e) => setHour(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-emerald-500 font-mono text-center disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">
            0-23
          </span>
        </div>
        <span className="text-gray-400 text-xl font-bold">:</span>
        <div className="relative">
          <input
            type="number"
            id={`${id}-minute`}
            min={0}
            max={59}
            disabled={disabled}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            onBlur={(e) => setMinute(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-emerald-500 font-mono text-center disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">
            0-59
          </span>
        </div>
        <span className="text-gray-500 text-sm ml-1">UTC</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-6">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onTimeChange(preset)}
            className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
              time === preset
                ? "bg-emerald-500 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScheduleHalf({
  id,
  title,
  hint,
  value,
  disabled,
  nowLabel,
  onChange,
}: {
  id: string;
  title: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  nowLabel: string;
  onChange: (value: string) => void;
}) {
  const { date, time } = splitUtcDraft(value);

  return (
    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-emerald-400" />
        {title}
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor={`${id}-date`} className="text-gray-400 text-xs">
            Date *
          </Label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            disabled={disabled}
            onChange={(e) => onChange(joinUtcDraft(e.target.value, time))}
            className={WHITE_DATE_INPUT_CLASS}
          />
        </div>
        <div>
          <Label
            htmlFor={`${id}-hour`}
            className="text-gray-400 text-xs flex items-center justify-between"
          >
            <span>Time (UTC) *</span>
            <span className="text-blue-400 font-mono text-xs" suppressHydrationWarning>
              Now: {nowLabel}
            </span>
          </Label>
          <UtcTimeInputs
            id={id}
            time={time}
            disabled={disabled}
            onTimeChange={(next) => onChange(joinUtcDraft(date, next))}
          />
        </div>
        {hint ? <p className="text-xs text-gray-500 pt-1">{hint}</p> : null}
      </div>
    </div>
  );
}

export function UtcScheduleFields({
  startLabel,
  endLabel,
  startHint,
  endHint,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  disabled,
}: {
  startLabel: string;
  endLabel: string;
  startHint?: string;
  endHint?: string;
  startTime: string;
  endTime: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [currentUtc, setCurrentUtc] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setCurrentUtc(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nowLabel = formatUtcClock(currentUtc);
  const windowBroken =
    Boolean(startTime) &&
    Boolean(endTime) &&
    new Date(`${startTime}:00Z`).getTime() >= new Date(`${endTime}:00Z`).getTime();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-xs text-blue-300 uppercase tracking-wide">
                Current Server Time (UTC)
              </p>
              <p
                className="text-2xl font-mono font-bold text-blue-100"
                suppressHydrationWarning
              >
                {nowLabel}
              </p>
            </div>
          </div>
          <p className="text-sm text-blue-200/80 font-mono" suppressHydrationWarning>
            {formatUtcDate(currentUtc)}
          </p>
        </div>
        <p className="mt-2 text-xs text-blue-200/70">
          All times below are UTC — the same clock the platform uses to open and close play.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScheduleHalf
          id="contest-start"
          title={startLabel}
          hint={startHint}
          value={startTime}
          disabled={disabled}
          nowLabel={nowLabel}
          onChange={onStartChange}
        />
        <ScheduleHalf
          id="contest-end"
          title={endLabel}
          hint={endHint}
          value={endTime}
          disabled={disabled}
          nowLabel={nowLabel}
          onChange={onEndChange}
        />
      </div>

      {/*
        Duration chips set the END from the start. An operator who only meant "run for an
        hour" should not have to re-enter the date and risk AM/PM again. Disabled until a
        start exists so the chip cannot invent an orphan end.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Run for:</span>
        {DURATION_PRESETS_MINUTES.map((mins) => {
          const label =
            mins < 60 ? `${mins}m` : mins === 60 ? "1h" : `${mins / 60}h`;
          return (
            <button
              key={mins}
              type="button"
              disabled={disabled || !startTime}
              onClick={() => onEndChange(addMinutesToUtcDraft(startTime, mins))}
              className="px-2.5 py-1 text-xs rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
            >
              {label}
            </button>
          );
        })}
      </div>

      {windowBroken ? (
        <div className="rounded-xl border border-red-600/50 bg-red-500/10 p-3 text-sm text-red-200">
          End must be after start. Both times are UTC — check the hour boxes (0–23), not
          AM/PM.
        </div>
      ) : null}
    </div>
  );
}
