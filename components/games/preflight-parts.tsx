import { NEON_DIVIDER } from "@/components/neon/tokens";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { PlayState } from "./play-state";

/*
  Small pieces of the round pre-flight, kept out of `RoundPreflight.tsx` so that file stays
  about the gates and the one clock. Nothing here decides whether a player may play.
*/

/** Stage notice rows (owner, 15 Oct 2026: "better graphics, use the Menuitems icons"). */
export const STAGE_NOTICE =
  "flex items-center gap-3 rounded-xl border border-cyan-400/35 bg-gradient-to-r from-[#0B2242]/90 to-[#081429]/80 px-3 py-2.5 shadow-[0_0_16px_-4px_rgba(34,211,238,0.35)]";
export const STAGE_NOTICE_WARN =
  "flex items-center gap-3 rounded-xl border border-amber-400/45 bg-gradient-to-r from-amber-500/15 to-[#081429]/80 px-3 py-2.5 shadow-[0_0_16px_-4px_rgba(251,191,36,0.35)]";

/** One of the shipped neon icons (`public/assets/neon/icons`), drawn as a stage glyph. */
export function StageIcon({ slug, size = "md" }: { slug: string; size?: "md" | "lg" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
    <img
      src={NEON_ICON(slug)}
      alt=""
      aria-hidden
      draggable={false}
      className={`${size === "lg" ? "h-12 w-12" : "h-9 w-9"} shrink-0 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]`}
    />
  );
}

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
