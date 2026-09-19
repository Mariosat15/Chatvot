/**
 * What is running right now, per game, for the admin front page.
 *
 * WHY THIS EXISTS. `12` s5 asks the overview dashboard for "active contests and participants per
 * game". Its row is easy to misread as a trading-shaped aggregate needing a game dimension added
 * - and that is not what was there. **The overview counted no contests at all**, of any game: no
 * competition model, no participant model and no game field appears anywhere in
 * `AdminOverviewDashboard.tsx` or `/api/dashboard/stats`. So this is **additive**, and none of
 * the usual "a trading-shaped aggregate keeps computing and keeps being wrong" hazard applies -
 * there was no wrong number on the screen, there was no number. Worth stating rather than
 * letting a summary imply a defect was fixed.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY: money. Not the prize pool, not entry-fee volume, not
 * revenue. The overview is granted by the `overview` section while revenue lives behind
 * `analytics` and `financial`, so a money figure here is a **silent widening of who can read the
 * platform's earnings** - and it reviews as a helpful addition. Same RBAC reasoning that keeps
 * the Game Performance screen free of revenue.
 *
 * NOT MIRRORED. `apps/admin/lib/services/` for games is admin-only, so `check:mirrors` says
 * nothing about it.
 */

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";
/*
  Reason this one import is relative where the rest are `@`-aliased: `@` maps to `apps/admin` in
  the app and to the REPO ROOT under vitest, so an admin-only module reached through it resolves
  to a path that does not exist in the test run and the whole suite fails to collect. The models
  above are mirrored, so both spellings find a file; `lib/admin/` is admin-only, so this one
  cannot be. A relative path is the same file either way - and it keeps the label rule in one
  place rather than growing a second copy to make the alias work.
*/
import {
  resolveGameBadge,
  TRADING_GAME_KEY,
} from "../../admin/contest-analytics-presentation";
import {
  isTradingSurfaceRelevant,
  TRADING_SURFACE_VISIBLE_BY_DEFAULT,
  type TradingSurfaceFacts,
} from "../../admin/trading-surface";
import { getEnabledGameTypes } from "@/lib/games";

/**
 * The two statuses that mean "an operator's attention may be needed today".
 *
 * `draft` is excluded because an unpublished contest is not running and counting it would tell
 * an operator work is live that nobody can enter. `finalizing` is excluded because it is a
 * transient state a cron holds for seconds. Everything terminal belongs to analytics.
 */
export const LIVE_CONTEST_STATUSES = ["active", "upcoming"] as const;

export interface LiveContestGameRow {
  /**
   * The grouping key, and it is **`gameKey`, never the display name**. `gameKey` is immutable
   * and is the join key for every historical figure; a display name is catalogue content an
   * operator can edit. Group by the name and renaming a title silently splits one game into two
   * rows that each look complete.
   */
  key: string;
  label: string;
  provider: string | null;
  isProviderGame: boolean;
  active: number;
  upcoming: number;
  /** Seats sold across this game's live and upcoming contests. */
  participants: number;
}

export interface LiveContestOverview {
  /** One row per game with something live, busiest first. Empty when nothing is running. */
  rows: LiveContestGameRow[];
  totals: { active: number; upcoming: number; participants: number };
  /**
   * Whether trading is switched on at all, and whether it has anything live.
   *
   * Two facts rather than one, because the price-feed panel needs both - see
   * `shouldShowPriceFeed`.
   */
  tradingEnabled: boolean;
  tradingHasLiveContests: boolean;
}

interface LiveContestDoc {
  _id: unknown;
  status?: string | null;
  gameType?: string | null;
  gameKey?: string | null;
  gameConfig?: { providerKey?: string | null; gameCode?: string | null } | null;
}

/**
 * Whether the price-feed status tile belongs on the overview.
 *
 * The rule itself lives in `lib/admin/trading-surface.ts`, because the sidebar asks the same
 * question about the whole TRADING group and two copies of it would disagree only in the state
 * nobody tests - trading switched off with a contest still running. This function survives as
 * the name the overview reads, and a test asserts the two answers can never differ.
 *
 * The reasoning for the rule being an OR rather than `tradingEnabled` alone is in that module.
 * Recorded as a deviation in `12` s5.1b rather than silently widened.
 */
export function shouldShowPriceFeed(overview: TradingSurfaceFacts): boolean {
  return isTradingSurfaceRelevant(overview);
}

export interface TradingSurfaceVisibility extends TradingSurfaceFacts {
  /** What the sidebar acts on. Derived, never stored. */
  visible: boolean;
}

/**
 * The same two facts, resolved cheaply enough to run on every dashboard page load.
 *
 * WHY NOT REUSE `getLiveContestOverview()`: it fetches every live contest, resolves catalogue
 * titles and providers, and aggregates seats. The sidebar needs one boolean, and a nav
 * decoration must not put five queries in front of the admin's landing page.
 *
 * WHY THE LIVENESS TEST IS `gameType: { $ne: "provider" }` RATHER THAN `gameKey: "trading"`:
 * `$ne` matches a document that lacks the field, and **invariant 5 resolves an absent label to
 * trading**. Written the other way, a contest predating the game label - which is every trading
 * contest the platform ran before X1, and any the X1 backfill has not reached - reads as though
 * it were not a trading contest, and the surfaces vanish while it is still being played.
 *
 * IT FAILS OPEN, and that direction is the point. See `TRADING_SURFACE_VISIBLE_BY_DEFAULT`:
 * losing six screens because a settings read timed out is far worse than an untidy menu.
 */
export async function getTradingSurfaceVisibility(): Promise<TradingSurfaceVisibility> {
  try {
    await connectToDatabase();

    const [enabledTypes, liveTradingContest] = await Promise.all([
      getEnabledGameTypes(),
      Competition.exists({
        status: { $in: [...LIVE_CONTEST_STATUSES] },
        gameType: { $ne: "provider" },
      }),
    ]);

    const facts: TradingSurfaceFacts = {
      tradingEnabled: enabledTypes.includes(TRADING_GAME_KEY),
      tradingHasLiveContests: liveTradingContest !== null,
    };

    return { ...facts, visible: isTradingSurfaceRelevant(facts) };
  } catch (error) {
    console.warn(
      "⚠️ Could not resolve trading surface visibility, showing the trading screens:",
      error,
    );
    return {
      tradingEnabled: TRADING_SURFACE_VISIBLE_BY_DEFAULT,
      tradingHasLiveContests: false,
      visible: TRADING_SURFACE_VISIBLE_BY_DEFAULT,
    };
  }
}

export async function getLiveContestOverview(): Promise<LiveContestOverview> {
  await connectToDatabase();

  const contests = await Competition.find({
    status: { $in: [...LIVE_CONTEST_STATUSES] },
  })
    .select("_id status gameType gameKey gameConfig.providerKey gameConfig.gameCode")
    .lean<LiveContestDoc[]>();

  /*
    Reason the enabled set is read here and nowhere near the counts: `getEnabledGameTypes()` is
    banned from every stats and leaderboard read path (R29, invariant 9), because summing over
    the currently-enabled games means disabling one retroactively erases what was earned in it.
    This is not such a path - it decides whether one status tile is drawn - and the counts above
    are grouped by whatever `gameKey` values the data actually holds, so a game an operator has
    just switched off with a contest still running is still counted and still shown. That is the
    case where hiding it would be most harmful.
  */
  const enabledTypes = await getEnabledGameTypes();

  const providerGameKeys = Array.from(
    new Set(
      contests
        .filter((c) => typeof c.gameKey === "string" && c.gameKey !== TRADING_GAME_KEY)
        .map((c) => c.gameKey as string),
    ),
  );

  const [titles, providers, seatsByContest] = await Promise.all([
    providerGameKeys.length > 0
      ? ProviderGame.find({ gameKey: { $in: providerGameKeys } })
          .select("gameKey displayName")
          .lean<{ gameKey?: string; displayName?: string }[]>()
      : Promise.resolve([]),
    providerGameKeys.length > 0
      ? GameProvider.find()
          .select("providerKey displayName")
          .lean<{ providerKey?: string; displayName?: string }[]>()
      : Promise.resolve([]),
    countSeatsByContest(contests),
  ]);

  const titleNameByKey = new Map(
    titles
      .filter((t): t is { gameKey: string; displayName?: string } =>
        typeof t.gameKey === "string",
      )
      .map((t) => [t.gameKey, t.displayName ?? null] as const),
  );
  const providerNameByKey = new Map(
    providers
      .filter((p): p is { providerKey: string; displayName?: string } =>
        typeof p.providerKey === "string",
      )
      .map((p) => [p.providerKey, p.displayName ?? null] as const),
  );

  /*
    Reason a Map keyed on the badge key rather than an object: the key comes from stored
    documents, and an object index walks the prototype chain - a `gameKey` of `"__proto__"`
    returns a truthy `Object.prototype` that survives a `!row` test. Fourth instance after the
    round-inspector action list, `competition-update-fields.ts` and the unscored-policy copy.
  */
  const byGame = new Map<string, LiveContestGameRow>();

  for (const contest of contests) {
    const badge = resolveGameBadge({
      gameType: contest.gameType,
      gameKey: contest.gameKey,
      providerKey: contest.gameConfig?.providerKey ?? null,
      gameCode: contest.gameConfig?.gameCode ?? null,
      gameDisplayName: contest.gameKey
        ? titleNameByKey.get(contest.gameKey) ?? null
        : null,
      providerDisplayName: contest.gameConfig?.providerKey
        ? providerNameByKey.get(contest.gameConfig.providerKey) ?? null
        : null,
    });

    const row =
      byGame.get(badge.key) ??
      ({
        key: badge.key,
        label: badge.label,
        provider: badge.provider,
        isProviderGame: badge.isProviderGame,
        active: 0,
        upcoming: 0,
        participants: 0,
      } satisfies LiveContestGameRow);

    if (contest.status === "active") row.active += 1;
    if (contest.status === "upcoming") row.upcoming += 1;
    row.participants += seatsByContest.get(String(contest._id)) ?? 0;

    byGame.set(badge.key, row);
  }

  const rows = Array.from(byGame.values()).sort(
    (a, b) =>
      b.active - a.active ||
      b.upcoming - a.upcoming ||
      a.label.localeCompare(b.label),
  );

  const tradingRow = rows.find((row) => !row.isProviderGame);

  return {
    rows,
    totals: {
      active: rows.reduce((sum, row) => sum + row.active, 0),
      upcoming: rows.reduce((sum, row) => sum + row.upcoming, 0),
      participants: rows.reduce((sum, row) => sum + row.participants, 0),
    },
    tradingEnabled: enabledTypes.includes(TRADING_GAME_KEY),
    tradingHasLiveContests:
      (tradingRow?.active ?? 0) + (tradingRow?.upcoming ?? 0) > 0,
  };
}

/**
 * Seats per contest, keyed by the contest id as a string.
 *
 * TWO TRAPS HERE, AND BOTH PRODUCE A PLAUSIBLE NUMBER RATHER THAN AN ERROR.
 *
 * **It groups by contest, never by the participant's own `gameKey`** - which is the obvious
 * one-query version and is wrong. That field is denormalised onto the seat with a schema default
 * of `"trading"`, the Game Master route inserts with the raw driver and so bypasses defaults at
 * all (R7), and the X1 backfill has never been applied to production. So a provider contest's
 * seats can be stored labelled `trading`, and grouping on them files real game entrants under
 * trading while every total still adds up. **The contest is the authority on its own game.**
 *
 * **`competition_participant.competitionId` is declared `String` while `Competition._id` is an
 * ObjectId**, and the aggregation pipeline does no casting, so an unconverted `$in` matches
 * nothing and reports every contest as empty. Third instance after the R42 fixture and the
 * analytics participation funnel.
 */
async function countSeatsByContest(
  contests: LiveContestDoc[],
): Promise<Map<string, number>> {
  if (contests.length === 0) return new Map();

  const contestIds = contests.map((contest) => String(contest._id));

  const grouped = await CompetitionParticipant.aggregate<{
    _id: string;
    seats: number;
  }>([
    { $match: { competitionId: { $in: contestIds } } },
    { $group: { _id: "$competitionId", seats: { $sum: 1 } } },
  ]);

  return new Map(grouped.map((row) => [String(row._id), row.seats] as const));
}
