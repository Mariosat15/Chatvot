import { Crown, Medal, Trophy } from "lucide-react";
import {
  NEON_ROW,
  NEON_ROW_PODIUM,
  NEON_ROW_YOU,
} from "@/components/neon/tokens";

/**
 * The leaderboard row pieces from the sheet's `TABLE ROW` block - the rank marker, the initials
 * avatar and the row shell itself.
 *
 * ONLY THE PIECES ARE SHARED, NOT THE ROW. The two boards genuinely differ: a game board shows
 * rank, player and one score, and a trading board shows account value, profit and loss, win
 * rate and a trade count. One component taking both column sets would need a flag saying which
 * game it is, which is the shape that makes a new game silently render as trading. Each board
 * owns its own grid and borrows the marker, the avatar and the shell from here.
 *
 * THE ROW SHELL IS A FUNCTION OF THREE FACTS and the order they are tested in is the design.
 * "This is you" wins over "this is the podium", because a player scanning a long board is
 * looking for themselves first and the highlight is what they scan for; a podium tint that
 * overrode it would hide the one row they came to read.
 */

export function neonRowClasses({
  rank,
  isCurrentUser,
}: {
  rank: number;
  isCurrentUser: boolean;
}): string {
  if (isCurrentUser) return NEON_ROW_YOU;
  if (rank >= 1 && rank <= 3) return NEON_ROW_PODIUM;
  return NEON_ROW;
}

/**
 * A medal for the top three and a plain number below that.
 *
 * The rank is rendered as given and is never derived from the row's position in the array.
 * Ranking is decided once, server-side, by `calculateRankings` - which knows whether the game
 * scores upward or downward - so a component that numbered its own rows would quietly disagree
 * with the payout for every lower-is-better game.
 */
export function NeonRankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15">
        <Trophy className="h-4 w-4 text-amber-300" />
      </span>
    );
  }

  if (rank === 2) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-400/40 bg-slate-400/15">
        <Medal className="h-4 w-4 text-slate-300" />
      </span>
    );
  }

  if (rank === 3) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15">
        <Medal className="h-4 w-4 text-orange-300" />
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1B2540] bg-[#080C18] text-xs font-bold text-gray-400">
      {rank > 0 ? rank : "-"}
    </span>
  );
}

/**
 * The initials chip beside a player's name.
 *
 * Initials rather than a profile photo, deliberately. A board renders up to fifty of these, and
 * fifty remote avatars is fifty requests plus fifty layout shifts as they arrive, on the screen
 * a player refreshes most often. The chip is also the only version that cannot leak a face into
 * a public leaderboard for someone who never chose to publish one.
 */
export function NeonAvatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/15 text-[11px] font-bold text-sky-200">
      {initials}
    </span>
  );
}

/** The player's name, with the "you" marker and the leader's crown the sheet draws. */
export function NeonPlayerName({
  name,
  isCurrentUser,
  isLeader = false,
}: {
  name: string;
  isCurrentUser: boolean;
  isLeader?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={`truncate text-sm font-medium ${
          isCurrentUser ? "text-sky-200" : "text-gray-200"
        }`}
      >
        {name}
      </span>
      {isLeader && (
        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />
      )}
      {isCurrentUser && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
          you
        </span>
      )}
    </span>
  );
}
