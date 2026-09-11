import { Activity } from "lucide-react";
import { NeonHeadedPanel } from "@/components/neon/Cards";
import { NeonAvatar } from "@/components/neon/LeaderboardRow";
import { NEON_DIVIDER } from "@/components/neon/tokens";
import {
  describeRoundActivity,
  roundActivityToneClass,
  type RoundActivitySummary,
} from "@/lib/utils/round-activity";

/**
 * What has just happened in this contest - the owner's `RECENT PLAYERS` panel.
 *
 * IT IS REAL, AND THAT IS THE POINT. `13` s4.1d listed a live activity feed among the things
 * the reference showed and the platform had no source for. That was true of a *ticker* of
 * arbitrary events; it is not true of this, because every round a player takes is written to
 * `game_round` with a status, an attempt number, the game's own `scoreBreakdown` and a
 * timestamp. The feed is those rows, newest first. Nothing here is invented and nothing is
 * sampled.
 *
 * IT RENDERS NOTHING WHEN NOBODY HAS PLAYED, rather than an empty panel with a heading. A
 * contest that has just opened legitimately has no activity, and a headed box containing one
 * grey sentence is how a screen teaches a player to stop reading panels. Same rule as
 * `GameRulesPanel` and `ArenaHighlights`.
 *
 * THE SCORE IS PRINTED PLAIN, WITHOUT A PLUS SIGN, and that is not a style choice. The
 * reference reads `+240`, which is right for a game where points accumulate upward - and
 * exactly backwards for a time trial, where the number is a duration and lower wins. The
 * direction is resolved once, server-side, in `calculateRankings`; a decoration applied here
 * would be a second place it is decided, which is the shape of R37.
 *
 * IT SHOWS THE PLAYERS ON THE BOARD, which is the set `getContestActivity` was asked about.
 * A feed naming somebody who is not in the standings beside it sends a player looking for a
 * row that is not there.
 */

export interface ArenaActivityEntry {
  userId: string;
  username?: string;
  activity: RoundActivitySummary;
}

interface Props {
  entries: ArenaActivityEntry[];
  currentUserId: string;
}

export function ArenaActivityFeed({ entries, currentUserId }: Props) {
  if (entries.length === 0) return null;

  return (
    <NeonHeadedPanel
      icon={Activity}
      title="Recent players"
      action={
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden
          />
          Live activity
        </span>
      }
    >
      <div className={`divide-y ${NEON_DIVIDER}`}>
        {entries.map((entry) => {
          const phrase = describeRoundActivity(entry.activity);
          const isYou = entry.userId === currentUserId;
          const name = entry.username || "Anonymous";

          return (
            <div
              key={`${entry.userId}-${entry.activity.attemptNumber}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <NeonAvatar name={name} />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`truncate text-sm font-semibold ${
                      isYou ? "text-sky-200" : "text-gray-100"
                    }`}
                  >
                    {name}
                  </span>
                  {isYou && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                      you
                    </span>
                  )}
                </div>

                <div className="mt-0.5 truncate text-[11px] leading-tight">
                  <span className={roundActivityToneClass(phrase.tone)}>
                    {phrase.headline}
                  </span>
                  {phrase.metrics.length > 0 && (
                    <span className="text-gray-500">
                      {" · "}
                      {phrase.metrics
                        .map((metric) => `${metric.label} ${metric.value}`)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>

              {/*
                An absent score renders nothing at all here rather than a dash. In the
                standings a dash is meaningful - it marks a ranked row with no result yet - but
                in a feed of things that happened, a column of dashes beside "Playing now" is
                noise where the row already says what is going on.
              */}
              {typeof entry.activity.score === "number" && (
                <span className="shrink-0 text-sm font-bold tabular-nums text-amber-300">
                  {entry.activity.score.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </NeonHeadedPanel>
  );
}
