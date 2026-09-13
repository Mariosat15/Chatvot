import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";
import { SCORE_PRODUCING_ROUND_STATUSES } from "@/lib/services/games/round-types";
import {
  resolveGameCategory,
  type ResolvedGameCategory,
} from "@/lib/services/games/game-categories";

/**
 * One player's performance in each game they have actually played - tasks 21-24.
 *
 * THE DEFECT THIS CLOSES, and it is not the one the task list names. Task 21 says the "Game
 * Performance" screen contains hardcoded assumptions. It does not: `game-performance.service.ts`
 * measures the round lifecycle, which every game has, and nothing on it names a game. The
 * premise is checkable and it was checked - the same duty that corrected R7 and R31 downward.
 *
 * What IS wrong sits one screen along, and it is worse than a wrong label. The admin's per-user
 * **Performance** tab reads `/api/users/[userId]/performance`, which computes eleven trading
 * figures from `TradeHistory` and nothing else, and the component then gates the whole tab on
 * `totalTrades === 0`. So an operator opening a player who has only ever played provider games
 * is told **"This client has no closed trades yet"** - a true sentence presented as the answer
 * to "how is this player doing", with every round they played, every score and every prize
 * invisible. No error, no empty column, nothing in a log. That is the binding rule of `05` s10
 * broken in its plainest form: **no performance figure may silently mean "trading only"** - it
 * is either generalised, or explicitly scoped and labelled to one game, or removed.
 *
 * WHY THE METRICS ARE NOT DECLARED ANYWHERE, which is a deliberate deviation from task 22.
 * That task asks the game's metadata to declare a performance schema, and groups its examples
 * by kind of game - best time and laps for racing, lines and level for Tetris, accuracy for
 * trivia. Implemented literally that is a table of metric names per category, which is the one
 * failure mode the whole platform is built to avoid: **anything that enumerates games means the
 * next game silently fails to appear**, while the query runs and the page renders. It is also
 * worse than useless in the other direction - a declared schema is a second source, so a title
 * claiming a metric it never sends shows a permanent blank row, and one sending a metric it
 * never declared has real data hidden.
 *
 * The result already carries the answer. A provider reports `scoreBreakdown` as free-form JSON
 * (`{ boardsCompleted: 7, penaltyMs: 2400 }`), `humanizeMetric` labels any camelCase identifier
 * in any language without knowing a single game's field names, and the player's own results
 * screen has rendered it that way since 7 September 2026. So the metrics rendered here are
 * exactly the metrics the game actually reported, which satisfies task 22's requirement - "only
 * show values actually supported by the game" - by construction rather than by configuration.
 * `category` earns its keep as the grouping and labelling key it already is, never as a metric
 * selector.
 *
 * NO MONEY ON IT, matching `game-performance.service.ts` for the same RBAC reason recorded
 * there: prizes and entry fees are granted by `analytics` and `financial`. This is granted by
 * `users`, so a prize figure here would widen who can read the platform's money while looking
 * like a convenience.
 *
 * NOT MIRRORED, deliberately. The player's own dashboard needs the same generalisation and does
 * not have it yet - that is the next slice - and a file mirrored before anything imports it is
 * R42 exactly: two copies that agree with each other while one of them runs.
 */

/**
 * What a player did in one game. Every field is a question any game can answer.
 *
 * There is no `pnl`, no `winRate` and no `trades`, and their absence is the point: those are
 * three questions about a trading account, and a puzzle has no answer to any of them. Trading
 * keeps its own block on the screen, labelled as trading.
 */
export interface PlayerGamePerformanceRow {
  /** Immutable, and the only safe join key. Never group or key anything on the title. */
  gameKey: string;
  gameCode: string;
  providerKey: string;
  /** Catalogue name, then the code, then the key - never "Unknown". */
  title: string;
  providerName: string;
  /**
   * Task 9's vocabulary, resolved ONCE here so no consumer re-derives it.
   *
   * `undefined` for a title with no genre renders nothing rather than a placeholder - a badge
   * reading "Uncategorised" is a decision no operator took.
   */
  category?: ResolvedGameCategory;
  /** False when the title has left the catalogue but the player's history remains (R29). */
  inCatalogue: boolean;
  rounds: {
    /** Ranked rounds only. Practice is free, unranked and not performance. */
    started: number;
    /** Rounds whose score ranking counts - `SCORE_PRODUCING_ROUND_STATUSES`, R48. */
    scored: number;
    live: number;
  };
  competitions: number;
  challenges: number;
  /**
   * Their best score, in the direction this title ranks, or `null` when nothing scored.
   *
   * `null` IS NOT ZERO, and the distinction is the read-side form of R45 and R50: a stored
   * nought is a real result on a points game, so a screen that renders absence as `0` reports
   * a player who never scored as one who scored nothing. Every consumer shows a dash.
   *
   * The RAW value, never negated. A time trial's best is the minimum and it is still stored
   * and shown as the positive number the player achieved.
   */
  bestScore: number | null;
  /** Display only, straight from the catalogue. Never parsed, never computed with. */
  scoreUnit?: string;
  scoreDirection: "higher_is_better" | "lower_is_better";
  averagePlaySeconds: number | null;
  lastPlayedAt: string | null;
  /**
   * The best round's own breakdown, verbatim, or `null` when the game sent none.
   *
   * WHY IT IS ONE ROUND'S AND NOT AN AGGREGATE. Averaging or summing free-form keys produces a
   * plausible wrong number, which is this codebase's worst failure mode: a mean of
   * `accuracyPercent` over three rounds is arguable, a sum of it is nonsense, and a sum of
   * `bestLapMs` is nonsense that renders perfectly. Nothing here knows what any key means, so
   * nothing here may combine them. The best round is the one an operator is asking about.
   */
  bestRoundBreakdown: Record<string, unknown> | null;
}

interface RoundAggregate {
  _id: string;
  started: number;
  scored: number;
  live: number;
  competitions: unknown[];
  challenges: unknown[];
  playMs: number | null;
  lastPlayedAt: Date | null;
}

const LIVE_ROUND_STATUSES = ["pending", "launched"];

/**
 * Every game this player has ranked rounds in, best first by recency.
 *
 * Returns `[]` for a player who has never played one, so a caller renders nothing at all
 * rather than an empty panel - task 23's first option, and the right one for a pure trader
 * whose tab should look exactly as it did before.
 */
export async function getPlayerGamePerformance(
  userId: string,
): Promise<PlayerGamePerformanceRow[]> {
  if (typeof userId !== "string" || userId.trim() === "") return [];

  await connectToDatabase();

  /*
    Reason for one aggregation rather than a query per game: the catalogue grows and this runs
    on an operator screen with a refresh button. `userId` is declared `String` on `game_round`,
    so it is matched as the string it arrives as - no ObjectId conversion, and adding one would
    match nothing while logging nothing, the boundary that has now bitten three times.
  */
  const aggregates = await GameRound.aggregate<RoundAggregate>([
    { $match: { userId: userId.trim(), mode: "ranked" } },
    {
      $group: {
        _id: "$gameKey",
        started: { $sum: 1 },
        // A round only counts as scored when BOTH hold: a score arrived, and it arrived with a
        // status ranking reads. A `voided` round is stored with `rawScore: 0` deliberately, so
        // testing for a number alone reports a support action as a result the player earned.
        scored: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $isNumber: "$rawScore" },
                  { $in: ["$status", SCORE_PRODUCING_ROUND_STATUSES] },
                ],
              },
              1,
              0,
            ],
          },
        },
        live: {
          $sum: { $cond: [{ $in: ["$status", LIVE_ROUND_STATUSES] }, 1, 0] },
        },
        // Held apart because they are different questions: a challenge is exactly two players
        // and a competition is many, so folding them into one count answers neither.
        competitions: {
          $addToSet: {
            $cond: [{ $eq: ["$contestType", "competition"] }, "$contestId", null],
          },
        },
        challenges: {
          $addToSet: {
            $cond: [{ $eq: ["$contestType", "challenge"] }, "$contestId", null],
          },
        },
        // Averaged over rounds that have a duration at all. A round still in play has none.
        playMs: { $avg: "$durationMs" },
        lastPlayedAt: { $max: "$createdAt" },
      },
    },
  ]);

  if (aggregates.length === 0) return [];

  const gameKeys = aggregates.map((row) => row._id).filter(Boolean);

  const titles = await ProviderGame.find({ gameKey: { $in: gameKeys } })
    .select(
      "gameKey gameCode providerKey displayName category scoreUnit scoreDirection",
    )
    .lean<
      {
        gameKey: string;
        gameCode: string;
        providerKey: string;
        displayName: string;
        category?: string;
        scoreUnit?: string;
        scoreDirection: "higher_is_better" | "lower_is_better";
      }[]
    >();

  const titleByKey = new Map(titles.map((title) => [title.gameKey, title]));

  const providers = await GameProvider.find({
    providerKey: { $in: [...new Set(titles.map((t) => t.providerKey))] },
  })
    .select("providerKey displayName")
    .lean<{ providerKey: string; displayName: string }[]>();

  const providerNameByKey = new Map(
    providers.map((provider) => [provider.providerKey, provider.displayName]),
  );

  const rows = await Promise.all(
    aggregates.map(async (aggregate) => {
      const gameKey = aggregate._id;
      const title = titleByKey.get(gameKey);

      /*
        The direction decides what "best" means, and getting it wrong is not a visible error -
        it is a screen that is exactly upside down, reporting a time trial's worst run as the
        player's best. A title that has left the catalogue cannot answer, so it falls back to
        the platform default, which is the same fallback settlement uses.
      */
      const scoreDirection = title?.scoreDirection ?? "higher_is_better";
      const best = await findBestRound(userId.trim(), gameKey, scoreDirection);

      /*
        The label chain ends at the code and then the key, NEVER at "Unknown". A row captioned
        "Unknown game" holding real rounds cannot be investigated, which is the same reason
        the analytics screen's chain ends the same way.
      */
      const derivedCode = gameKey.split(":")[2] ?? gameKey;

      return {
        gameKey,
        gameCode: title?.gameCode ?? derivedCode,
        providerKey: title?.providerKey ?? gameKey.split(":")[1] ?? "",
        title: title?.displayName ?? title?.gameCode ?? derivedCode,
        providerName:
          providerNameByKey.get(title?.providerKey ?? "") ??
          title?.providerKey ??
          "",
        category: resolveGameCategory(title?.category),
        inCatalogue: Boolean(title),
        rounds: {
          started: aggregate.started,
          scored: aggregate.scored,
          live: aggregate.live,
        },
        competitions: countDistinct(aggregate.competitions),
        challenges: countDistinct(aggregate.challenges),
        bestScore: best?.rawScore ?? null,
        scoreUnit: title?.scoreUnit,
        scoreDirection,
        averagePlaySeconds:
          typeof aggregate.playMs === "number" && aggregate.playMs > 0
            ? aggregate.playMs / 1000
            : null,
        lastPlayedAt: aggregate.lastPlayedAt
          ? new Date(aggregate.lastPlayedAt).toISOString()
          : null,
        bestRoundBreakdown: hasEntries(best?.scoreBreakdown)
          ? (best?.scoreBreakdown as Record<string, unknown>)
          : null,
      } satisfies PlayerGamePerformanceRow;
    }),
  );

  // Most recently played first. An operator opening a player is asking about now.
  return rows.sort((a, b) =>
    (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""),
  );
}

/**
 * The round holding this player's best score in one game.
 *
 * Sorted in the database rather than by pulling every round back, because a regular player of
 * one title accumulates them indefinitely and the answer is one document. The status filter is
 * the shared list, so a voided round can never be nominated as somebody's best - which would
 * show an operator a breakdown for a round the leaderboard ignored.
 */
async function findBestRound(
  userId: string,
  gameKey: string,
  direction: "higher_is_better" | "lower_is_better",
): Promise<{ rawScore: number; scoreBreakdown?: Record<string, unknown> } | null> {
  const round = await GameRound.findOne({
    userId,
    gameKey,
    mode: "ranked",
    status: { $in: SCORE_PRODUCING_ROUND_STATUSES },
    rawScore: { $type: "number" },
  })
    .sort({ rawScore: direction === "lower_is_better" ? 1 : -1 })
    .select("rawScore scoreBreakdown")
    .lean<{ rawScore: number; scoreBreakdown?: Record<string, unknown> }>();

  return round ?? null;
}

/** `$addToSet` with a conditional yields nulls for the rows that did not match. */
function countDistinct(values: unknown[] | undefined): number {
  if (!Array.isArray(values)) return 0;
  return values.filter((value) => value !== null && value !== undefined).length;
}

function hasEntries(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}
