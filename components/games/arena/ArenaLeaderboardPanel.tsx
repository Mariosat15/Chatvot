"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Trophy, Users } from "lucide-react";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import { NeonButton } from "@/components/neon/Buttons";
import { NeonScopeStrip } from "@/components/neon/Cards";
import { NeonAvatar, NeonPlayerName } from "@/components/neon/LeaderboardRow";
import {
  NEON_DIVIDE,
  NEON_DIVIDER,
  NEON_PANEL_SIDE,
  NEON_TABS_STRIP,
  NEON_TAB_ACTIVE,
  NEON_TAB_IDLE,
  NEON_TAB_SHAPE,
} from "@/components/neon/tokens";
import {
  describeRoundActivity,
  roundActivityToneClass,
} from "@/lib/utils/round-activity";
import {
  filterRowsForScope,
  type ArenaBoardScope,
} from "@/lib/utils/arena-scope";
import { useTerms } from "@/contexts/TerminologyContext";
import { useArenaLive } from "./ArenaLiveStandings";

/**
 * The arena's leaderboard rail: two heading tabs, three scope pills, a four-column ranking
 * table, and the way out at the bottom.
 *
 * ALL THREE SCOPES ARE WIRED. Global is the ranked board as the server sent it. Friends
 * filters against ids loaded once with the page (`listFriendUserIds`). Country filters
 * against a side map of normalised country codes that travels with every standings poll —
 * never printed as a column (publishing where players live as a field is a different
 * product decision from "show me people from my country").
 *
 * Filtering on the client keeps the standings poll as the single producer so switching
 * scopes cannot produce two disagreeing answers.
 *
 * WHY IT IS ONE COMPONENT RATHER THAN CHROME COMPOSED IN THE LAYOUT, which is where it lived
 * until 11 September 2026. The owner rejected that version as "structurally wrong… a small
 * player status card" rather than a competitive board, and the structural half of that is
 * exactly the split: the layout owned the heading, the scope strip and the button, while a
 * separate consumer owned the rows, so nothing owned the panel's HEIGHT.
 *
 * THE HEIGHT RULE: the panel is `h-full` with a column body, the rows area is the only
 * `flex-1`, and everything else is its natural height. `min-h` on the rows is room for about
 * ten compact rows, never a cap.
 */

type Tab = "ranking" | "players";

// Reason: Map lookup avoids security/detect-object-injection on a Record index.
const SCOPE_LABEL = new Map<ArenaBoardScope, string>([
  ["global", "Global"],
  ["friends", "Friends"],
  ["country", "Country"],
]);

function scopeFromLabel(label: string): ArenaBoardScope {
  if (label === "Friends") return "friends";
  if (label === "Country") return "country";
  return "global";
}

function labelForScope(scope: ArenaBoardScope): string {
  return SCOPE_LABEL.get(scope) ?? "Global";
}

function emptyCopy(
  scope: ArenaBoardScope,
  terms: ReturnType<typeof useTerms>,
  kind: "ranking" | "players",
): string {
  if (scope === "friends") {
    return kind === "ranking"
      ? `None of your friends have entered this ${terms.contest.toLowerCase()} yet.`
      : "None of your friends have entered yet.";
  }
  if (scope === "country") {
    return kind === "ranking"
      ? `Nobody from your country has entered this ${terms.contest.toLowerCase()} yet. Add a country on your profile to match others.`
      : "Nobody from your country has entered yet. Add a country on your profile to match others.";
  }
  return kind === "ranking"
    ? `No ${terms.score.toLowerCase()}s yet. Be the first.`
    : "Nobody has entered yet.";
}

export default function ArenaLeaderboardPanel({
  competitionId,
  scoreLabel = "Score",
}: {
  competitionId: string;
  /** Beside the score column, so a time trial does not say "Score". */
  scoreLabel?: string;
}) {
  const terms = useTerms();
  const { rows, friendIds, countries, currentUserId } = useArenaLive();
  const [tab, setTab] = useState<Tab>("ranking");
  const [scope, setScope] = useState<ArenaBoardScope>("global");

  const visibleRows = useMemo(
    () =>
      filterRowsForScope(rows, scope, currentUserId, friendIds, countries),
    [rows, scope, currentUserId, friendIds, countries],
  );

  return (
    <div className={`${NEON_PANEL_SIDE} flex h-full flex-col overflow-hidden`}>
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
          {terms.leaderboard}
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
          {terms.players} ({visibleRows.length})
        </button>
      </div>

      {/*
        All three scopes are selectable. Filtering is client-side against friend
        ids (page load) and country codes (standings payload).
      */}
      <NeonScopeStrip
        scopes={["Global", "Friends", "Country"]}
        value={labelForScope(scope)}
        onChange={(label) => setScope(scopeFromLabel(label))}
      />

      {/*
        THE ONLY `flex-1`, and the only scroller. `min-h` is room for about ten rows at the
        reference's height; the panel grows past it to fill the row and the overflow scrolls.

        Horizontal padding must leave room for each row's full border + gold glow (owner
        26 Sep: right edge was clipped when this was only `px-1.5`).
      */}
      <div className="min-h-[400px] flex-1 overflow-y-auto px-2.5 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(64,150,240,0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(64,150,240,0.4)]">
        {tab === "ranking" ? (
          <BoardTab scoreLabel={scoreLabel} rows={visibleRows} scope={scope} />
        ) : (
          <PlayersTab rows={visibleRows} scope={scope} />
        )}
      </div>

      <div className={`border-t p-3 ${NEON_DIVIDER}`}>
        <NeonButton
          href={`/competitions/${competitionId}?view=details`}
          tone="outline"
          label={`View Full ${terms.leaderboard}`}
          trailingIcon={ArrowRight}
        />
      </div>
    </div>
  );
}

function BoardTab({
  scoreLabel,
  rows,
  scope,
}: {
  scoreLabel: string;
  rows: ReturnType<typeof useArenaLive>["rows"];
  scope: ArenaBoardScope;
}) {
  const terms = useTerms();
  const { currentUserId } = useArenaLive();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-gray-500">
        {emptyCopy(scope, terms, "ranking")}
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
 * The roster: everybody with a seat (or friends / country peers, when scoped),
 * and what they have been doing.
 *
 * ORDERED BY THE SERVER'S RANK, NOT BY NAME. Same people in the same order as the board.
 */
function PlayersTab({
  rows,
  scope,
}: {
  rows: ReturnType<typeof useArenaLive>["rows"];
  scope: ArenaBoardScope;
}) {
  const terms = useTerms();
  const { activity, currentUserId } = useArenaLive();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-gray-500">
        {emptyCopy(scope, terms, "players")}
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
