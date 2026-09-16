"use client";

/**
 * Stats-backed leaderboard rows (UserGameStats). Separate from the legacy
 * trading-shaped LeaderboardContent so the parallel period (R14) cannot
 * silently mix column sets.
 */

import ProfileImage from "@/components/ui/ProfileImage";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameLeaderboardEntry } from "@/lib/services/games/game-leaderboard.service";

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

interface GameLeaderboardTableProps {
  entries: GameLeaderboardEntry[];
  myPosition: MyPosition | null;
  currentUserId: string;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  showRating: boolean;
  startsFromCaption: string;
}

export default function GameLeaderboardTable({
  entries,
  myPosition,
  currentUserId,
  totalCount,
  page,
  pageSize,
  onPageChange,
  loading = false,
  showRating,
  startsFromCaption,
}: GameLeaderboardTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground px-1">{startsFromCaption}</p>

      {myPosition && myPosition.rank > 0 && (
        <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-sm">
          Your rank:{" "}
          <span className="font-semibold text-foreground">#{myPosition.rank}</span>
          {" · "}
          {myPosition.totalUsers} players
          {myPosition.percentile > 0
            ? ` · top ${myPosition.percentile.toFixed(0)}%`
            : null}
        </div>
      )}

      {totalCount === 0 && !loading ? (
        <div className="rounded-lg border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No cross-game standings yet. Finish a contest after cross-game scoring
          began and you will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium text-right">Points</th>
                <th className="px-3 py-2 font-medium text-right">Wins</th>
                <th className="px-3 py-2 font-medium text-right">Podiums</th>
                <th className="px-3 py-2 font-medium text-right">Entered</th>
                {showRating ? (
                  <th className="px-3 py-2 font-medium text-right">Rating</th>
                ) : null}
                <th className="px-3 py-2 font-medium text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const isMe = row.userId === currentUserId;
                return (
                  <tr
                    key={row.userId}
                    className={cn(
                      "border-b border-border/40",
                      isMe && "bg-primary/5",
                    )}
                  >
                    <td className="px-3 py-2.5 tabular-nums">
                      #{row.rank}
                      {row.isTied ? (
                        <span className="ml-1 text-xs text-muted-foreground">=</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfileImage
                          src={row.profileImage}
                          alt={row.username}
                          fallbackLetter={(row.username || "?").charAt(0)}
                          size="sm"
                        />
                        <span className="truncate font-medium">
                          {row.username}
                          {isMe ? (
                            <span className="ml-1 text-xs text-primary">you</span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {Math.round(row.totalPoints)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.wins}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.podiums}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.contestsEntered}
                    </td>
                    {showRating ? (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {typeof row.rating === "number" ? Math.round(row.rating) : "—"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.currentStreak}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground flex items-center gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
