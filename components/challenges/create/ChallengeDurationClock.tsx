"use client";

import { Clock } from "lucide-react";
import {
  CountdownCells,
  splitDuration,
} from "@/components/competitions/CountdownPanel";

/**
 * A FIXED LENGTH, SHOWN AS A CLOCK RATHER THAN OFFERED AS A CONTROL.
 *
 * OWNER INSTRUCTION, 14 SEPTEMBER 2026: "How long the Challenge runs and how long the game runs
 * must be shown in a clock like we have the countdown in competition page, not as an option, as
 * it will respect what the game providers specify in admin."
 *
 * WHY THIS IS NOT `CountdownPanel`, which is the component it borrows its cells from. That panel
 * is a countdown: it reads anything under an hour as "ENDING SOON" in red and zero as
 * "Competition has ended!". Both are right for a contest clock and wrong here - a 30-minute
 * challenge is not ending soon, it has not started. So the cells are shared and the chrome is
 * not, which is the same split `13` s4.1l made for the lobby's own clock.
 *
 * IT IS A STATEMENT, NOT AN INPUT, and that is the deliverable. The value comes from the
 * operator's per-title challenge defaults or from the provider's own `configSchema`, resolved
 * server-side - so a player reads what they will get instead of choosing a number the create
 * route may then override.
 */
export default function ChallengeDurationClock({
  label,
  seconds,
  note,
}: {
  label: string;
  /** The length in seconds. Absent or non-positive renders nothing - see below. */
  seconds: number | undefined;
  note?: string;
}) {
  // Reason: nothing rather than a clock reading 00:00:00:00. An absent length means the title
  // declares none, and a row of zeroes under "How long the game runs" is an invented deadline -
  // the same reading `RoundPreflight` and `RoundClockNote` give a missing duration.
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <Clock className="h-3.5 w-3.5 text-blue-400" />
        {label}
      </div>
      <div className="rounded-xl border border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-3">
        <CountdownCells
          parts={splitDuration(seconds * 1000)}
          secondsClassName="text-blue-400"
        />
      </div>
      {note && <p className="text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}
