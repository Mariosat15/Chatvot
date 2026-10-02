import { NEON_DIVIDER } from "@/components/neon/tokens";
import type { PlayState } from "./play-state";

/*
  Small pieces of the round pre-flight, kept out of `RoundPreflight.tsx` so that file stays
  about the gates and the one clock. Nothing here decides whether a player may play.
*/

export function describeAttempts(state: PlayState): string {
  if (state.attemptsPolicy === "single") {
    return state.attemptsUsed > 0
      ? "You have used your one attempt."
      : "You have one attempt.";
  }

  const verb = state.attemptsPolicy === "sum_of_n" ? "added together" : "your best counts";
  return `${state.attemptsRemaining} of ${state.attemptsPermitted} attempts left — ${verb}.`;
}

// Reason UTC with a fixed format: the server and the browser must print the same text, and a
// short "Fri 02 Oct, 07:50 UTC" reads at a glance where `toUTCString()` reads like a log line.
export function formatShortUtc(ms: number): string {
  return `${new Date(ms).toLocaleString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} UTC`;
}

export function PreflightRoundList({ rounds }: { rounds: PlayState["rounds"] }) {
  if (rounds.length === 0) return null;

  return (
    <div className={`border-t ${NEON_DIVIDER} pt-4`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Your rounds
      </p>
      <ul className="space-y-1">
        {rounds.map((round) => (
          <li
            key={round.roundId}
            className="flex items-center justify-between text-xs text-gray-400"
          >
            <span>Attempt {round.attemptNumber}</span>
            <span className="capitalize">{round.status}</span>
            {/* Absent is not zero. A round with no score yet shows a dash. */}
            <span className="text-gray-300">
              {typeof round.score === "number" ? round.score : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
