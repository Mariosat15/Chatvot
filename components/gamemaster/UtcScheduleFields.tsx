"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Trading-style contest clock for Game Master provider contests: date + 24h UTC time,
 * with a live server clock.
 *
 * Same answers as admin `UtcScheduleFields` and the trading GM schedule step —
 * `datetime-local` paints AM/PM with no zone and shifts the instant the platform stores.
 *
 * VALUE SHAPE. `YYYY-MM-DDTHH:mm` as UTC wall-clock. Convert with `utcDraftToIso` before
 * POSTing so the server receives an absolute instant (`…:00Z`).
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

const DURATION_PRESETS_MINUTES = [15, 30, 60, 120, 240] as const;

/** Native date picker glyph — white on dark fields (WebKit / Chromium). */
export const WHITE_DATE_PICKER_CLASS =
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-100 " +
  "[&::-webkit-calendar-picker-indicator]:brightness-0 " +
  "[&::-webkit-calendar-picker-indicator]:invert";

const DATE_PICKER_CLASS =
  `bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-cyan-500 ${WHITE_DATE_PICKER_CLASS}`;

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

/**
 * Turn a UTC draft (`YYYY-MM-DDTHH:mm`) into an ISO string the create API can store.
 * A bare `new Date("…T13:00")` is local in every browser — that is the shift this avoids.
 */
export function utcDraftToIso(value: string): string {
  if (!value) return value;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const absolute = new Date(value);
    return Number.isNaN(absolute.getTime()) ? value : absolute.toISOString();
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? value : fallback.toISOString();
  }
  const instant = new Date(`${match[1]}T${match[2]}:00Z`);
  return Number.isNaN(instant.getTime()) ? value : instant.toISOString();
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
            className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-cyan-500 font-mono text-center disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-cyan-500 font-mono text-center disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                ? "bg-cyan-500 text-white"
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
        <Calendar className="h-4 w-4 text-cyan-400" />
        {title}
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor={`${id}-date`} className="text-gray-400 text-xs">
            Date *
          </Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            disabled={disabled}
            onChange={(e) => onChange(joinUtcDraft(e.target.value, time))}
            className={DATE_PICKER_CLASS}
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
  startLabel = "Start Time",
  endLabel = "End Time",
  startHint,
  endHint,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  disabled,
}: {
  startLabel?: string;
  endLabel?: string;
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
    new Date(`${startTime}:00Z`).getTime() >=
      new Date(`${endTime}:00Z`).getTime();

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
          All times below are UTC — the same clock the platform uses to open and close
          play.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScheduleHalf
          id="gm-contest-start"
          title={startLabel}
          hint={startHint}
          value={startTime}
          disabled={disabled}
          nowLabel={nowLabel}
          onChange={onStartChange}
        />
        <ScheduleHalf
          id="gm-contest-end"
          title={endLabel}
          hint={endHint}
          value={endTime}
          disabled={disabled}
          nowLabel={nowLabel}
          onChange={onEndChange}
        />
      </div>

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
