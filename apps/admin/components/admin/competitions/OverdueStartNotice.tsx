import { AlertTriangle } from "lucide-react";

/**
 * A contest still stored `upcoming` after its start time means the automatic
 * start-or-cancel step has not run for it (or failed). It should be `active`, or - below
 * its minimum players - cancelled with every entry fee refunded.
 *
 * Reason: the old screen showed "Starting..." and a "Starts In" tile counting down to the
 * END time, which read as a contest about to begin rather than one the system had missed.
 */
export function isStartOverdue(
  status: string | undefined,
  startTime: string | Date | undefined,
  now: number = Date.now(),
): boolean {
  if (status !== "upcoming" || !startTime) return false;
  const start = new Date(startTime).getTime();
  return Number.isFinite(start) && start <= now;
}

export default function OverdueStartNotice({
  startLabel,
  players,
  minPlayers,
}: {
  startLabel: string;
  players: number;
  minPlayers: number;
}) {
  const shouldCancel = players < minPlayers;
  return (
    <div className="flex gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
      <div className="space-y-1">
        <p className="font-semibold text-red-300">
          Start overdue - this contest should already have{" "}
          {shouldCancel ? "been cancelled and refunded" : "started"}
        </p>
        <p>
          It was due to start at {startLabel} with {players}/{minPlayers} required players,
          but it is still waiting. The automatic step runs every minute; refresh in a minute.
          If this warning stays, cancel and refund it from Incident Management.
        </p>
      </div>
    </div>
  );
}
