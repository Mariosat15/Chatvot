"use client";

import CountdownPanel from "@/components/competitions/CountdownPanel";
import { useServerClock } from "@/hooks/useServerClock";

/**
 * THE GAME LOBBY'S LARGE CONTEST COUNTDOWN - the owner's "the timer must be the same graphics
 * as the counter in trading competition countdown".
 *
 * The appearance is `CountdownPanel`, shared character for character with the trading lobby's
 * `LiveCountdown`. What differs, and the only reason this is a separate component rather than
 * `LiveCountdown` rendered on a second screen, is the two things trading's copy owns:
 *
 *   1. IT RUNS ON THE SERVER'S CLOCK. Every rule about when a game contest opens, when an
 *      attempt may start and when entry shuts is enforced on our servers against our time, so
 *      a clock reading the visitor's own computer disagrees with the gate that will judge the
 *      click. `useServerClock` re-anchors on each fresh `serverNow`, and the lobby is re-read
 *      every fifteen seconds, so the error stays bounded to one round trip instead of
 *      accumulating. Trading has always used the browser's clock and is deliberately left
 *      alone: changing it is a behaviour change to trading dressed up as a shared component.
 *
 *   2. IT HAS NO `status` GATE. `LiveCountdown` renders `null` for any `type`/`status` pair it
 *      does not recognise, which is a silent no-render - the countdown simply is not there and
 *      nothing reports it. Here the caller decides whether a countdown belongs on the screen
 *      at all, and this component's only job once mounted is to draw one.
 *
 * Reason `serverNow` is optional: it arrives on the play state, which exists only for a player
 * holding a seat. A visitor browsing the contest has none, and `useServerClock` fails open to
 * the browser's clock - the same clock trading uses, so a visitor is never worse off than on
 * the trading lobby, while the player with money in the contest gets the authoritative one.
 */
interface ContestCountdownProps {
  /**
   * The moment being counted down to.
   *
   * Reason it is not narrowed to an ISO string: the contest's dates reach this screen as
   * whatever Mongo handed back, and `new Date(x).toISOString()` THROWS on an unparseable
   * value. Converting at the call site would put that throw inside the lobby's render, where
   * one bad stored date takes the whole page down rather than one panel.
   */
  target: string | number | Date;
  /** The server's own time when this page was rendered, if the viewer holds a seat. */
  serverNow?: string;
  label: string;
  /** `start` counts down to the contest opening, `end` to it closing. */
  variant: "start" | "end";
  /**
   * The contest's schedule, rendered inside the same card beneath the cells.
   *
   * The lobby used to put this in a card of its own headed "Play window", which counted down to
   * the same instant as the cells above it - `playWindowEnd` is `endTime` since `12` s2.3. Passed
   * through rather than built here, because this component has no contest to read.
   */
  details?: React.ReactNode;
}

export default function ContestCountdown({
  target,
  serverNow,
  label,
  variant,
  details,
}: ContestCountdownProps) {
  const now = useServerClock(serverNow);
  const targetMs = new Date(target).getTime();

  /*
    Reason this refuses rather than clamping: `splitDuration` treats a non-finite duration as
    zero, and zero is the FINISHED state - so an unparseable target would render "Competition
    has ended!" over a contest that is running. A missing clock is recoverable by looking at
    the schedule panel; a confident wrong one is not.
  */
  if (Number.isNaN(targetMs)) return null;

  return (
    <CountdownPanel
      remainingMs={targetMs - now}
      label={label}
      variant={variant}
      details={details}
    />
  );
}
