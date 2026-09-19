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

/**
 * How many rows the arena band's card draws.
 *
 * THREE, MATCHING THE OTHER TWO CARDS' ARITHMETIC - a dense heading strip and three 22px
 * rows in a 96px card. `getContestActivity` already returns newest first, so the cap takes
 * the three most recent rather than an arbitrary three, and a fourth would fall off the
 * bottom of a card that cannot grow.
 *
 * IT IS NOT A CAP ON WHAT HAPPENED. Every round is still on `game_round`, the standings rail
 * beside this card lists every player, and the results screen lists every attempt. This is
 * the three most recent things, which is what `RECENT PLAYERS` says.
 */
const FEED_LIMIT = 3;

export function ArenaActivityFeed({ entries, currentUserId }: Props) {
  if (entries.length === 0) return null;

  return (
    <NeonHeadedPanel
      icon={Activity}
      title="Recent players"
      dense
      action={
        <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden
          />
          Live
        </span>
      }
    >
      <div className={`divide-y ${NEON_DIVIDER}`}>
        {entries.slice(0, FEED_LIMIT).map((entry) => {
          const phrase = describeRoundActivity(entry.activity);
          const isYou = entry.userId === currentUserId;
          const name = entry.username || "Anonymous";

          return (
            /*
              ONE ROW, NOT TWO, and that is the owner's "do not make each row 60px high". The
              name sat above the activity phrase, which is 44px of stacked text per player
              before padding; side by side they are 22, and the phrase is the thing that can
              give up width because the name is what a player scans for.

              The metrics are dropped from this card for the same reason - `describeRoundActivity`
              returns them for the results screen, where there is a column for them, and
              appending them here is what pushed the phrase onto a second line.
            */
            <div
              key={`${entry.userId}-${entry.activity.attemptNumber}`}
              /*
                `py-0.5` IS THE ROW HEIGHT AND IT IS ARITHMETIC. A 20px avatar plus 2px above
                and below is 24, so three rows and their two hairlines are 74 - exactly the
                band's body once its 30px heading is taken off its 104. At `py-1` the third
                row is pushed under the card's `overflow-hidden` and disappears with nothing
                on screen to say so, which is the owner's "3 compact rows" silently becoming 2.
              */
              className="flex items-center gap-2 px-2.5 py-0.5"
            >
              <NeonAvatar name={name} size="xs" />

              <span
                className={`shrink-0 max-w-[42%] truncate text-[10px] font-semibold ${
                  isYou ? "text-sky-200" : "text-gray-100"
                }`}
              >
                {name}
              </span>
              {isYou && (
                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-sky-400">
                  you
                </span>
              )}

              <span
                className={`min-w-0 flex-1 truncate text-[9px] leading-tight ${roundActivityToneClass(
                  phrase.tone,
                )}`}
              >
                {phrase.headline}
              </span>

              {/*
                An absent score renders nothing at all here rather than a dash. In the
                standings a dash is meaningful - it marks a ranked row with no result yet - but
                in a feed of things that happened, a column of dashes beside "Playing now" is
                noise where the row already says what is going on.
              */}
              {typeof entry.activity.score === "number" && (
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-amber-300">
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
