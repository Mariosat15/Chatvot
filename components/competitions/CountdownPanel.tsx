import { Clock, Timer, CheckCircle, AlertCircle } from "lucide-react";

/**
 * THE LARGE FOUR-CELL CONTEST COUNTDOWN - days, hours, minutes, seconds - and the one
 * definition of what it looks like.
 *
 * It was the trading competition lobby's, written inline inside `LiveCountdown`, and the game
 * lobby had nothing equivalent: three lines of small text where trading has a clock you can
 * read across a room. The owner asked for the two to match, so the appearance was lifted out
 * here rather than copied, because a second copy of a panel this detailed drifts on the first
 * edit and the drift is invisible until somebody holds the two screens side by side.
 *
 * WHY THE CLOCK IS NOT IN THIS FILE, which is the whole reason an extraction was needed rather
 * than simply rendering `LiveCountdown` on the game lobby. The two callers disagree about what
 * time it is, on purpose:
 *
 *   - Trading reads the browser's clock. That is what it has always done.
 *   - The game screens run on the SERVER's clock (`useServerClock`), because every rule about
 *     when a round may start is enforced on our servers against our time. A countdown working
 *     from a visitor's own clock is wrong in both of the directions that cost something - a
 *     button offered when the window has shut, or withheld while it is genuinely open - and
 *     neither records an error, because neither is one.
 *
 * So this component is handed a number of milliseconds and knows nothing about clocks at all.
 * Both callers own their own time source and share exactly the appearance.
 *
 * Reason: one inert class was dropped in the move rather than carried. The start variant's
 * seconds cell carried `relative` with no absolutely-positioned child, so it had no visual
 * effect; it is recorded here rather than silently preserved or silently removed.
 */

/** Reason: the end variant turns red under this much time. Shared so the two callers cannot
 *  disagree about when a contest is "ending soon" - a threshold defined twice is a screen
 *  that goes red at a different moment from the one beside it. */
export const COUNTDOWN_WARNING_MS = 60 * 60 * 1000;

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/**
 * Split a duration into the four cells.
 *
 * Reason: a past target clamps to zero rather than counting upwards. Negative values would
 * render as "-1" in a cell captioned "Days", and the callers already branch on the complete
 * state - but a formatter that can emit a negative is one that eventually does.
 */
export function splitDuration(ms: number): CountdownParts {
  if (!Number.isFinite(ms) || ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(ms / (1000 * 60 * 60 * 24)),
    hours: Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((ms % (1000 * 60)) / 1000),
    total: ms,
  };
}

function Cell({
  value,
  caption,
  valueClassName,
}: {
  value: number;
  caption: string;
  valueClassName: string;
}) {
  return (
    <div className="text-center p-3 bg-gray-900/50 rounded-lg">
      <div className={`text-3xl font-black tabular-nums ${valueClassName}`}>
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
        {caption}
      </div>
    </div>
  );
}

function Cells({
  parts,
  secondsClassName,
}: {
  parts: CountdownParts;
  secondsClassName: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Cell value={parts.days} caption="Days" valueClassName="text-white" />
      <Cell value={parts.hours} caption="Hours" valueClassName="text-white" />
      <Cell value={parts.minutes} caption="Mins" valueClassName="text-white" />
      <Cell
        value={parts.seconds}
        caption="Secs"
        valueClassName={secondsClassName}
      />
    </div>
  );
}

interface CountdownPanelProps {
  /** Milliseconds until the target. At or below zero the finished panel is shown instead. */
  remainingMs: number;
  label: string;
  /** `start` counts down to a contest opening, `end` to it closing. */
  variant: "start" | "end";
}

export default function CountdownPanel({
  remainingMs,
  label,
  variant,
}: CountdownPanelProps) {
  const parts = splitDuration(remainingMs);
  const isComplete = parts.total <= 0;

  if (variant === "start") {
    if (isComplete) {
      return (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-bold">Competition has started!</span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-5 w-5 text-yellow-400 animate-pulse" />
          <span className="text-sm font-semibold text-yellow-400">{label}</span>
        </div>
        <Cells
          parts={parts}
          secondsClassName="text-yellow-400 animate-pulse"
        />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="font-bold">Competition has ended!</span>
        </div>
      </div>
    );
  }

  const isWarning = parts.total < COUNTDOWN_WARNING_MS;

  return (
    <div
      className={`p-4 rounded-xl ${
        isWarning
          ? "bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/50"
          : "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock
          className={`h-5 w-5 ${isWarning ? "text-red-400 animate-pulse" : "text-blue-400"}`}
        />
        <span
          className={`text-sm font-semibold ${isWarning ? "text-red-400" : "text-blue-400"}`}
        >
          {label}
        </span>
        {isWarning && (
          <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
            ENDING SOON!
          </span>
        )}
      </div>
      <Cells
        parts={parts}
        secondsClassName={
          isWarning ? "text-red-400 animate-pulse" : "text-blue-400"
        }
      />
    </div>
  );
}
