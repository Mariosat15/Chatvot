"use client";

import { GameIcon } from "@/components/ui/GameIcon";
import { useGameMasterIds } from "@/hooks/useGameMasterIds";

interface GameMasterBadgeProps {
  /** The player's user id. Absent renders nothing. */
  userId?: string | null;
  /** Crown only, for rows where the name line has no room for a word. */
  compact?: boolean;
  className?: string;
}

/**
 * The badge beside a Game Master's name, everywhere a name is shown. Same crown and
 * colours as the one on the Game Master's own profile header, so it reads as one mark.
 */
export function GameMasterBadge({ userId, compact = false, className = "" }: GameMasterBadgeProps) {
  const ids = useGameMasterIds();
  if (!userId || !ids.has(String(userId))) return null;

  return (
    <span
      title="Game Master"
      aria-label="Game Master"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 font-semibold text-yellow-400 ${
        compact ? "px-1 py-0.5" : "px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
      } ${className}`}
    >
      <GameIcon name="crown" size={12} />
      {!compact && <span>GM</span>}
    </span>
  );
}

export default GameMasterBadge;
