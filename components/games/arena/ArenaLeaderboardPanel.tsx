"use client";

import { useState } from "react";
import { ArrowRight, Trophy, Users } from "lucide-react";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import { NeonButton } from "@/components/neon/Buttons";
import { NeonScopeStrip } from "@/components/neon/Cards";
import { NeonAvatar, NeonPlayerName } from "@/components/neon/LeaderboardRow";
import {
  NEON_DIVIDE,
  NEON_DIVIDER,
  NEON_PANEL_LIT,
  NEON_TABS_STRIP,
  NEON_TAB_ACTIVE,
  NEON_TAB_IDLE,
  NEON_TAB_SHAPE,
} from "@/components/neon/tokens";
import {
  describeRoundActivity,
  roundActivityToneClass,
} from "@/lib/utils/round-activity";
import { useArenaLive } from "./ArenaLiveStandings";

/**
 * The arena's leaderboard rail: two heading tabs, three scope pills, a four-column ranking
 * table, and the way out at the bottom.
 *
 * WHY IT IS ONE COMPONENT RATHER THAN CHROME COMPOSED IN THE LAYOUT, which is where it lived
 * until 11 September 2026. The owner rejected that version as "structurally wrong… a small
 * player status card" rather than a competitive board, and the structural half of that is
 * exactly the split: the layout owned the heading, the scope strip and the button, while a
 * separate consumer owned the rows, so nothing owned the panel's HEIGHT. A heading strip sized
 * to its text, a rows box capped at 460px and a footer stacked to a content height, all inside
 * a grid cell as tall as the game board - which draws a short card beside a tall board with the
 * arena's backdrop showing beneath it. That gap is the "oversized empty dark area".
 *
 * THE HEIGHT RULE, WHICH IS THE PART MOST LIKELY TO BE UNDONE. The panel is `h-full` with a
 * column body, the rows area is the only `flex-1`, and everything else is its natural height.
 * So the ROW decides how tall this is - the layout's grid cell stretches, the cell's child
 * stretches, and the rows area absorbs the difference with the footer pinned under it. There is
 * no `max-h` here and there must not be one: a fixed cap is what made the old panel end early,
 * and it reads as a sensible precaution in a diff.
 *
 * `min-h` ON THE ROWS AREA IS THE OTHER HALF, and it is not the same thing as a cap. The owner
 * asked for "around 10 compact rows"; how many players a contest actually has is not ours to
 * decide, so what is guaranteed is the ROOM for ten. Without it a two-player contest draws a
 * two-row table and the panel collapses again on the one screen the complaint came from.
 *
 * TWO TABS, AND THE SECOND ONE IS WHERE THE REMOVED FURNITURE WENT. The reference's board has
 * no "Playing now" or "Not played yet" under a name, and removing them from the ranking table
 * would have thrown away the one thing that says whether a rival is still at the board. So the
 * table is `variant="ranking"` and the roster tab carries the activity - the same figures, in
 * the place where a list of people rather than a list of scores is what is being read. Nothing
 * was deleted; it moved somewhere it fits.
 *
 * IT IS THE ROWS THE BOARD IS DRAWING, IN BOTH TABS AND IN THE COUNT. The count used to be a
 * server-rendered figure passed into the layout, and a figure rendered once disagrees with the
 * list beneath it the moment somebody joins. One consumer, one answer.
 */

/*
  `"ranking"`, NOT `"board"`, AND THE GUARD IS RIGHT EVEN THOUGH NOBODY READS THIS STRING. The
  arena's agnostic test matches game-shaped nouns inside quoted strings, and it cannot tell a
  state identifier from a sentence - which is the correct trade, because the alternative is a
  guard that has to understand JSX to know whether "board" reaches a player. A Tetris contest
  has a ranking and no board, so the honest word costs nothing here.
*/
type Tab = "ranking" | "players";

export default function ArenaLeaderboardPanel({
  competitionId,
  scoreLabel = "Score",
}: {
  competitionId: string;
  /** Beside the score column, so a time trial does not say "Score". */
  scoreLabel?: string;
}) {
  const { rows } = useArenaLive();
  const [tab, setTab] = useState<Tab>("ranking");

  return (
    <div className={`${NEON_PANEL_LIT} flex h-full flex-col overflow-hidden`}>
      <div className={NEON_TABS_STRIP}>
        {/*
          A real pair of tabs, not a title and a pill. `aria-pressed` rather than a tablist
          role: these switch the body of one panel, and the two views are not separate
          documents a screen reader should announce as pages.
        */}
        <button
          type="button"
          onClick={() => setTab("ranking")}
          aria-pressed={tab === "ranking"}
          className={`${NEON_TAB_SHAPE} px-3 py-2 text-[13px] font-bold uppercase tracking-wide ${
            tab === "ranking" ? NEON_TAB_ACTIVE : NEON_TAB_IDLE
          }`}
        >
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          Leaderboard
        </button>
        <button
          type="button"
          onClick={() => setTab("players")}
          aria-pressed={tab === "players"}
          className={`${NEON_TAB_SHAPE} px-3 py-2 text-[13px] font-bold uppercase tracking-wide ${
            tab === "players" ? NEON_TAB_ACTIVE : NEON_TAB_IDLE
          }`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          Players ({rows.length})
        </button>
      </div>

      {tab === "ranking" && (
        /*
          `GLOBAL` is what this board is; the other two are drawn because the reference draws
          them and are visibly not offering anything - see `NeonScopeStrip`. There is no friends
          graph, and a contest board carries no player's country, which is also a disclosure
          decision rather than a missing column.
        */
        <NeonScopeStrip
          scopes={["Global"]}
          unavailable={["Friends", "Country"]}
          unavailableTitle="Everyone in this competition is shown"
        />
      )}

      {/*
        THE ONLY `flex-1`, and the only scroller. `min-h` is room for about ten rows at the
        reference's height; the panel grows past it to fill the row and the overflow scrolls.
      */}
      <div className="min-h-[400px] flex-1 overflow-y-auto px-1.5 py-2">
        {tab === "ranking" ? (
          <BoardTab scoreLabel={scoreLabel} />
        ) : (
          <PlayersTab />
        )}
      </div>

      <div className={`border-t p-3 ${NEON_DIVIDER}`}>
        <NeonButton
          href={`/competitions/${competitionId}?view=details`}
          tone="outline"
          label="View Full Leaderboard"
          trailingIcon={ArrowRight}
        />
      </div>
    </div>
  );
}

function BoardTab({ scoreLabel }: { scoreLabel: string }) {
  const { rows, currentUserId } = useArenaLive();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-gray-500">
        No scores yet. Be the first.
      </p>
    );
  }

  return (
    <ProviderLeaderboard
      rows={rows}
      currentUserId={currentUserId}
      scoreLabel={scoreLabel}
      variant="ranking"
    />
  );
}

/**
 * The roster: everybody with a seat, and what they have been doing.
 *
 * ORDERED BY THE SERVER'S RANK, NOT BY NAME. It is the same people in the same order as the
 * board, which is what stops the two tabs reading as two different contests - and a player
 * looking for somebody scrolls the same distance in both.
 */
function PlayersTab() {
  const { rows, activity, currentUserId } = useArenaLive();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-gray-500">
        Nobody has entered yet.
      </p>
    );
  }

  return (
    <div className={NEON_DIVIDE}>
      {rows.map((row) => {
        const isYou = row.userId === currentUserId;
        // An absent entry here IS an answer - this player holds a seat and has not played.
        const phrase = describeRoundActivity(activity[row.userId]);

        return (
          <div
            key={row.userId}
            className="flex items-center gap-2 px-1.5 py-2"
          >
            <NeonAvatar
              name={row.username || "Anonymous"}
              size="sm"
              src={row.profileImage}
            />
            <div className="min-w-0 flex-1">
              <NeonPlayerName
                name={row.username || "Anonymous"}
                isCurrentUser={isYou}
              />
              <div
                className={`mt-0.5 truncate text-[11px] leading-tight ${roundActivityToneClass(
                  phrase.tone,
                )}`}
              >
                {phrase.headline}
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
          </div>
        );
      })}
    </div>
  );
}
