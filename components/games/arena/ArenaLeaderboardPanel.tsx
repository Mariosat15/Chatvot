"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
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
import { LOBBY_DESKTOP_MQ } from "@/components/competitions/lobby/LobbyViewportSwitch";

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
 * THE HEIGHT RULE (desktop / xl rail): the panel is `h-full` with a column body, the rows
 * area is the only `flex-1`, and everything else is its natural height. `min-h` on the rows
 * is room for about ten compact rows, never a cap.
 *
 * ON A PHONE (16 Oct 2026): the same panel used to keep `min-h-[400px]` under three players
 * and leave a tall empty gap. Below the desktop cut it grows with its rows (1–5), then pages
 * of five — same rule as the phone lobby board.
 */

/** Pages of five on a stacked (phone) arena — matches MobileGameLobbyLeaderboard. */
export const ARENA_LEADERBOARD_PAGE_SIZE = 5;

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
  const [page, setPage] = useState(0);
  // Reason: null until matchMedia runs — treat as phone so we never flash a 400px gap.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(LOBBY_DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const visibleRows = useMemo(
    () =>
      filterRowsForScope(rows, scope, currentUserId, friendIds, countries),
    [rows, scope, currentUserId, friendIds, countries],
  );

  // Phone: pages of five. Desktop rail: show everyone and scroll inside the tall cell.
  const paginate = isDesktop !== true;
  const pageCount = paginate
    ? Math.max(1, Math.ceil(visibleRows.length / ARENA_LEADERBOARD_PAGE_SIZE))
    : 1;
  const current = Math.min(page, pageCount - 1);
  const start = current * ARENA_LEADERBOARD_PAGE_SIZE;
  const pagedRows = paginate
    ? visibleRows.slice(start, start + ARENA_LEADERBOARD_PAGE_SIZE)
    : visibleRows;

  useEffect(() => {
    setPage(0);
  }, [scope, tab]);

  return (
    <div
      className={`${NEON_PANEL_SIDE} flex flex-col overflow-hidden ${
        isDesktop ? "h-full" : "h-auto"
      }`}
    >
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
        Desktop: THE ONLY `flex-1`, and the only scroller. `min-h` is room for about ten rows.
        Phone: height follows the rows (no empty gap); pages of five above five players.
        Horizontal padding must leave room for each row's full border + gold glow (owner
        26 Sep: right edge was clipped when this was only `px-1.5`).
      */}
      <div
        className={
          isDesktop
            ? "min-h-[400px] flex-1 overflow-y-auto px-2.5 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(64,150,240,0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(64,150,240,0.4)]"
            : "min-h-0 px-2.5 py-2"
        }
      >
        {tab === "ranking" ? (
          <BoardTab scoreLabel={scoreLabel} rows={pagedRows} scope={scope} />
        ) : (
          <PlayersTab rows={pagedRows} scope={scope} />
        )}
        {paginate && pageCount > 1 ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <PagerButton
              label="Previous"
              disabled={current === 0}
              onPress={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </PagerButton>
            <span className="text-center text-[12px] font-semibold text-gray-200">
              {start + 1}–{start + pagedRows.length} of {visibleRows.length}
            </span>
            <PagerButton
              label="Next"
              disabled={current >= pageCount - 1}
              onPress={() => setPage(current + 1)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </PagerButton>
          </div>
        ) : null}
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

function PagerButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-[12px] font-semibold ${
        disabled
          ? "border-white/[0.05] text-gray-600 opacity-50"
          : "border-cyan-300/30 bg-cyan-500/10 text-cyan-200"
      }`}
    >
      {children}
    </button>
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
  const { currentUserId, scoreType } = useArenaLive();

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
      scoreType={scoreType}
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
                wrap
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
