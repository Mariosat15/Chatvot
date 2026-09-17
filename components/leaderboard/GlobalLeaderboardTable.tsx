"use client";

import Image from "next/image";
import { RankIcon } from "@/components/ui/GameIcon";
import { cn } from "@/lib/utils";
import type { GlobalScoreComponentId } from "@/lib/services/leaderboard/global-score";

export interface GlobalBoardRow {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied: boolean;
  score: number;
  tradingScore: number;
  tradingTrades: number;
  gamePoints: number;
  gamesPlayed: number;
  competitionsWon: number;
  challengesWon: number;
  level: number;
  levelTitle?: string;
  totalBadges: number;
  milestones: number;
  applied: { id: GlobalScoreComponentId; weight: number; position: number }[];
  userTitle?: string;
}

const COLUMNS =
  "70px minmax(160px,1fr) 90px 90px 80px 90px 80px 80px 90px 90px";

/**
 * Whether a figure counted towards this player's rank.
 *
 * Reason: a component the player does not take part in renders a dash, never a
 * zero — the read-side form of R45/R50. A zero in the Games column is a claim
 * that they played and scored nothing, which is a different fact from never
 * having played, and it is the one that makes a games-only player look like a
 * failed trader.
 */
function countedIds(row: GlobalBoardRow): Set<string> {
  return new Set(row.applied.map((a) => a.id));
}

function Cell({
  counted,
  children,
  className,
}: {
  counted: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-right font-mono text-sm tabular-nums", className)}>
      {counted ? children : <span className="text-gray-600">-</span>}
    </div>
  );
}

export default function GlobalLeaderboardTable({
  entries,
  viewerUserId,
}: {
  entries: GlobalBoardRow[];
  viewerUserId?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-10 text-center text-sm text-gray-500">
        Nobody is ranked yet. Play a game or place a trade to appear here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Desktop */}
      <div className="hidden lg:block">
        <div
          className="grid gap-3 px-5 py-3 border-b border-gray-800 bg-gray-900/80"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Rank
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Player
          </span>
          {[
            "Trading",
            "Games",
            "Comps",
            "Challenges",
            "Level",
            "Badges",
            "Milestones",
            "Score",
          ].map((label) => (
            <span
              key={label}
              className="text-right text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              {label}
            </span>
          ))}
        </div>

        {entries.map((row) => {
          const counted = countedIds(row);
          const isMe = row.userId === viewerUserId;
          return (
            <div
              key={row.userId}
              className={cn(
                "grid gap-3 items-center px-5 py-3 border-b border-gray-800/60 last:border-0 transition-colors",
                isMe ? "bg-primary-500/10" : "hover:bg-gray-800/30",
              )}
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <div className="flex items-center gap-2">
                {row.rank <= 3 ? (
                  <RankIcon rank={row.rank} size={26} />
                ) : (
                  <span className="font-mono text-sm font-bold text-gray-400">
                    #{row.rank}
                  </span>
                )}
                {row.isTied && (
                  <span
                    className="text-[10px] font-semibold text-gray-500"
                    title="Tied on score"
                  >
                    =
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-0">
                {row.profileImage ? (
                  <Image
                    src={row.profileImage}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 shrink-0 rounded-full bg-gray-700 text-xs font-bold text-gray-300 flex items-center justify-center">
                    {row.username.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      isMe ? "text-primary-300" : "text-white",
                    )}
                  >
                    {row.username}
                  </span>
                  {row.userTitle && (
                    <span className="block truncate text-[11px] text-gray-500">
                      {row.userTitle}
                    </span>
                  )}
                </span>
              </div>

              <Cell counted={counted.has("trading")} className="text-gray-300">
                {Math.round(row.tradingScore).toLocaleString()}
              </Cell>
              <Cell counted={counted.has("games")} className="text-gray-300">
                {Math.round(row.gamePoints).toLocaleString()}
              </Cell>
              <Cell
                counted={counted.has("competitions")}
                className="text-gray-300"
              >
                {row.competitionsWon}
              </Cell>
              <Cell
                counted={counted.has("challenges")}
                className="text-gray-300"
              >
                {row.challengesWon}
              </Cell>
              <Cell counted={counted.has("level")} className="text-gray-300">
                {row.level}
              </Cell>
              <Cell counted={counted.has("badges")} className="text-gray-300">
                {row.totalBadges}
              </Cell>
              <Cell
                counted={counted.has("milestones")}
                className="text-gray-300"
              >
                {row.milestones}
              </Cell>
              <div className="text-right font-mono text-sm font-bold tabular-nums text-primary-400">
                {row.score.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="lg:hidden divide-y divide-gray-800/60">
        {entries.map((row) => {
          const counted = countedIds(row);
          const isMe = row.userId === viewerUserId;
          return (
            <div
              key={row.userId}
              className={cn("p-4", isMe && "bg-primary-500/10")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {row.rank <= 3 ? (
                    <RankIcon rank={row.rank} size={24} />
                  ) : (
                    <span className="font-mono text-sm font-bold text-gray-400">
                      #{row.rank}
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold text-white">
                    {row.username}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-primary-400">
                  {row.score.toFixed(1)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ["trading", "Trading", Math.round(row.tradingScore)],
                    ["games", "Games", Math.round(row.gamePoints)],
                    ["competitions", "Comps", row.competitionsWon],
                    ["challenges", "1v1", row.challengesWon],
                    ["level", "Level", row.level],
                    ["badges", "Badges", row.totalBadges],
                    ["milestones", "Miles", row.milestones],
                  ] as const
                ).map(([id, label, value]) => (
                  <div key={id} className="rounded-lg bg-gray-800/40 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">
                      {label}
                    </dt>
                    <dd className="font-mono text-xs text-gray-300">
                      {counted.has(id) ? (
                        value.toLocaleString()
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
