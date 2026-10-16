import { Clock, Timer, CheckCircle, AlertCircle } from "lucide-react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";

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

/**
 * `showcase` — trading lobby (arena backdrop, Menuitems clock).
 * `arena` — provider game lobby center (clean cyan neon, no blur; owner image 1, 15 Oct 2026).
 */
export type CountdownSize = "default" | "showcase" | "arena";

function Cell({
  value,
  caption,
  valueClassName,
  size = "default",
}: {
  value: number;
  caption: string;
  valueClassName: string;
  size?: CountdownSize;
}) {
  if (size === "arena") {
    const secondsTint = caption.toLowerCase() === "secs";
    return (
      // Reason (16 Oct 2026): on a phone-width column, text-4xl / sm:text-5xl overflowed
      // the cell boxes (owner screenshots). Digits stay inside the box; desktop keeps the
      // large arena look from lg up.
      <div
        className={`text-center rounded-xl border bg-[#040914]/90 px-1.5 py-2.5 sm:px-2 sm:py-3 lg:py-4 ${
          secondsTint
            ? "border-amber-400/55 shadow-[inset_0_0_18px_rgba(251,191,36,0.12)]"
            : "border-cyan-400/50 shadow-[inset_0_0_16px_rgba(34,211,238,0.08)]"
        }`}
      >
        <div
          className={`text-[1.625rem] font-black tabular-nums leading-none tracking-tight sm:text-3xl lg:text-4xl xl:text-5xl ${valueClassName}`}
        >
          {value.toString().padStart(2, "0")}
        </div>
        <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-300 sm:mt-2 sm:text-[11px] sm:tracking-[0.18em]">
          {caption}
        </div>
      </div>
    );
  }

  if (size === "showcase") {
    return (
      <div className="text-center rounded-xl border border-white/10 bg-black/45 px-2 py-3 backdrop-blur-sm">
        <div className={`text-4xl font-black tabular-nums leading-none ${valueClassName}`}>
          {value.toString().padStart(2, "0")}
        </div>
        <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
          {caption}
        </div>
      </div>
    );
  }

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

/**
 * The four cells on their own.
 *
 * Exported for the challenge dialog's fixed-length clocks, which show a duration that is not
 * counting down and therefore cannot use the panel around them: that panel reads a length under
 * an hour as "ENDING SOON" and a length of zero as "Competition has ended!", both of which are
 * correct for a contest clock and nonsense for "this challenge runs for 30 minutes".
 *
 * Reason for sharing the cells rather than restyling them there: this is the one definition of
 * what a clock on this platform looks like, and the whole point of the extraction above was that
 * a second copy drifts on the first edit with nobody able to see it.
 */
export function CountdownCells({
  parts,
  secondsClassName,
  size = "default",
}: {
  parts: CountdownParts;
  secondsClassName: string;
  size?: CountdownSize;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Cell value={parts.days} caption="Days" valueClassName="text-white" size={size} />
      <Cell value={parts.hours} caption="Hours" valueClassName="text-white" size={size} />
      <Cell value={parts.minutes} caption="Mins" valueClassName="text-white" size={size} />
      <Cell
        value={parts.seconds}
        caption="Secs"
        valueClassName={secondsClassName}
        size={size}
      />
    </div>
  );
}

/**
 * The schedule folded in underneath the cells, hairline-separated.
 *
 * WHY THE CLOCK AND THE SCHEDULE ARE ONE CARD (owner instruction, 11 September 2026). The game
 * lobby carried a second card headed "Play window" holding the window's open and close and a
 * countdown to the close - and since `12` s2.3 derived the window from the contest clock,
 * `playWindowEnd` IS `endTime`, so that countdown and this panel's cells were counting down to
 * the same instant in two sizes, one above the other. **That is a duplicate statement of one
 * clock, not merely clutter**, and the same class of error as the dashboard card that could
 * disagree with the page that drew it.
 *
 * It is an optional slot rather than fixed content, because the trading lobby renders this panel
 * too and has its own schedule accordion. A caller that passes nothing gets exactly the card it
 * got before.
 */
function PanelDetails({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-white/10 pt-3">{children}</div>
  );
}

/**
 * The showcase frame: a dark card over the arena artwork, the trophy sitting top-right behind
 * the cells. Reason it is a wrapper and not a fifth branch: the schedule slot is counted per
 * branch by a test, and a frame is appearance, not a state.
 */
function ShowcaseFrame({
  borderClassName,
  children,
  details,
}: {
  borderClassName: string;
  children: React.ReactNode;
  /**
   * The game arena's note under its clock (15 Oct 2026: the arena took the trading showcase
   * clock). Trading passes none, so its card is unchanged.
   */
  details?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-[#060B18] p-5 ${borderClassName}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop, sized by CSS */}
      <img
        src={COMPETITIONS_ARENA_BG}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-top opacity-35"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#060B18] via-[#060B18]/80 to-transparent" />
      <div className="relative">
        {children}
        {details ? <PanelDetails>{details}</PanelDetails> : null}
      </div>
    </div>
  );
}

/**
 * Clean cyan neon frame for the game lobby center — no arena photograph.
 * Target image 1 (15 Oct 2026) deliberately dropped the blur backdrop from image 2.
 */
function ArenaFrame({
  borderClassName,
  children,
}: {
  borderClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-[#060B18]/95 p-5 ${borderClassName}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_65%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * The showcase headings' clock, from the owner's Menuitems set rather than a line glyph.
 * `clockbox` since 15 Oct 2026 - the owner's chosen clock for the trading lobby AND the game
 * arena/lobby, so every large countdown wears the same picture.
 */
function ShowcaseClock() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
    <img
      src="/assets/neon/icons/clockbox.webp"
      alt=""
      draggable={false}
      className="h-10 w-10 object-contain"
    />
  );
}

function ShowcaseHeading({
  icon,
  label,
  className,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  className: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className={`text-lg font-bold ${className}`}>{label}</span>
      {extra}
    </div>
  );
}

interface CountdownPanelProps {
  /** Milliseconds until the target. At or below zero the finished panel is shown instead. */
  remainingMs: number;
  label: string;
  /** `start` counts down to a contest opening, `end` to it closing. */
  variant: "start" | "end";
  /**
   * The contest's schedule, rendered inside this card beneath the cells.
   *
   * Reason it appears in the finished branches too: the window's open and close are still facts
   * once the clock reaches zero, and a card that silently sheds half its content at the moment
   * it changes state is how a player concludes the page is broken.
   */
  details?: React.ReactNode;
  /** Defaults to the compact card. Game lobby center uses `arena`; trading uses `showcase`. */
  size?: CountdownSize;
}

export default function CountdownPanel({
  remainingMs,
  label,
  variant,
  details,
  size = "default",
}: CountdownPanelProps) {
  const showcase = size === "showcase";
  const arena = size === "arena";
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
          {details && <PanelDetails>{details}</PanelDetails>}
        </div>
      );
    }

    const startCells = (
      <CountdownCells
        parts={parts}
        secondsClassName={
          arena || showcase
            ? "text-amber-300"
            : "text-yellow-400 animate-pulse"
        }
        size={size}
      />
    );

    if (arena) {
      return (
        <ArenaFrame borderClassName="border-cyan-400/55 shadow-[0_0_28px_rgba(34,211,238,0.22)]">
          <ShowcaseHeading
            icon={<ShowcaseClock />}
            label={label}
            className="text-cyan-200"
          />
          {startCells}
        </ArenaFrame>
      );
    }

    if (showcase) {
      return (
        <ShowcaseFrame
          borderClassName="border-amber-400/40 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
          details={details}
        >
          <ShowcaseHeading
            icon={<ShowcaseClock />}
            label={label}
            className="text-white"
          />
          {startCells}
        </ShowcaseFrame>
      );
    }

    return (
      <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-5 w-5 text-yellow-400 animate-pulse" />
          <span className="text-sm font-semibold text-yellow-400">{label}</span>
        </div>
        {startCells}
        {details && <PanelDetails>{details}</PanelDetails>}
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
        {details && <PanelDetails>{details}</PanelDetails>}
      </div>
    );
  }

  const isWarning = parts.total < COUNTDOWN_WARNING_MS;
  const endingBadge = isWarning && (
    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
      ENDING SOON!
    </span>
  );
  const endCells = (
    <CountdownCells
      parts={parts}
      secondsClassName={
        isWarning
          ? "text-red-400 animate-pulse"
          : arena || showcase
            ? "text-amber-300"
            : "text-blue-400"
      }
      size={size}
    />
  );

  if (arena) {
    return (
      <ArenaFrame
        borderClassName={
          isWarning
            ? "border-red-500/50 shadow-[0_0_28px_rgba(239,68,68,0.18)]"
            : "border-cyan-400/55 shadow-[0_0_28px_rgba(34,211,238,0.22)]"
        }
      >
        <ShowcaseHeading
          icon={<ShowcaseClock />}
          label={label}
          className={isWarning ? "text-red-200" : "text-cyan-200"}
          extra={endingBadge}
        />
        {endCells}
      </ArenaFrame>
    );
  }

  if (showcase) {
    return (
      <ShowcaseFrame
        details={details}
        borderClassName={
          isWarning
            ? "border-red-500/50 shadow-[0_0_24px_rgba(239,68,68,0.15)]"
            : "border-sky-400/40 shadow-[0_0_24px_rgba(56,189,248,0.12)]"
        }
      >
        <ShowcaseHeading
          icon={<ShowcaseClock />}
          label={label}
          className="text-white"
          extra={endingBadge}
        />
        {endCells}
      </ShowcaseFrame>
    );
  }

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
        {endingBadge}
      </div>
      {endCells}
      {details && <PanelDetails>{details}</PanelDetails>}
    </div>
  );
}
