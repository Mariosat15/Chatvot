import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

/**
 * Per-game operational metrics: the "New: Game Performance" screen of `12` s5.
 *
 * WHAT IT IS FOR, AND WHY IT IS NOT THE ANALYTICS SCREEN. `CompetitionAnalytics` answers "what
 * did we earn"; this answers "is the game working for the people playing it". They are different
 * questions with different answers, and one of them can be healthy while the other is not: a
 * title whose rounds are abandoned half the time still books its entry fees, so the money screen
 * shows a profitable game and nothing anywhere shows the problem.
 *
 * DELIBERATELY NO MONEY ON IT, and that is an RBAC decision rather than a layout one. This
 * screen is granted by a games section, and entry-fee volume and platform revenue are granted
 * today by `analytics` and `financial`. Putting revenue here would widen who can read it while
 * looking like a helpful addition - the same shape as merging six admin sections into one tabbed
 * destination, which `12` s1.1 warned would be a silent privilege widening that reviews as
 * correct. Revenue by game and by provider lives on the analytics screen, where the grant
 * already covers it.
 *
 * DERIVED ON REQUEST, NOT STORED, following `provider-health.service.ts` for the reason recorded
 * there: `game_provider.healthStatus` was declared, written by nothing, and defaulted to `down`,
 * so a screen rendering a stored verdict would have reported every provider permanently broken.
 * Nothing here is cached or persisted, so nothing here can be stale in that way.
 *
 * NOT MIRRORED. Admin-only, so `check:mirrors` says nothing about it - the same as
 * `provider-health.service.ts` and `round-resolution.service.ts`.
 */

/**
 * The windows an operator may ask for.
 *
 * An allow-list rather than a number from the query string. Reason: the deciding value of a
 * database scan must never come from caller input - an unbounded `days` is a full collection
 * scan anybody holding the grant can trigger by editing a URL. Same rule as deriving the game
 * type for the market-hours gate from the stored label rather than from the request.
 */
export const PERFORMANCE_WINDOWS = [7, 30, 90] as const;
export type PerformanceWindow = (typeof PERFORMANCE_WINDOWS)[number];
export const DEFAULT_PERFORMANCE_WINDOW: PerformanceWindow = 30;

/** Parses the requested window, falling back rather than refusing. */
export function resolveWindow(raw: string | null): PerformanceWindow {
  const parsed = Number(raw);
  return (
    PERFORMANCE_WINDOWS.find((days) => days === parsed) ??
    DEFAULT_PERFORMANCE_WINDOW
  );
}

/**
 * Rounds that ran to their own natural end - the game's clock reaching zero, or every board
 * solved. NOT "rounds that produced a score", which this list used to claim.
 *
 * R48 is why the distinction matters. A round that ended any of the three ways below still
 * contributes whatever the player achieved to their score and their prize; only `voided` and
 * `unresolved` do not. So a count of `completed` answers "how many players got to play the
 * game out", which is a real question, and does not answer "how many results this game
 * produced", which is a different one.
 */
const RAN_FULL_COURSE = ["completed"] as const;
/**
 * Rounds the player left. `leaveRound` in the game service, or an operator resolving one by
 * hand. This is the abandonment signal, and it is the only status that is the player's doing.
 */
const LEFT_EARLY = ["abandoned"] as const;
/**
 * Rounds the CONTEST closed over while the player was still in them.
 *
 * Held apart from `abandoned` because it is not the player's doing and, on a busy contest, not
 * a fault at all: `createRound` clamps a round's `expiresAt` to `playWindowEnd`, so under the
 * universal cut-off every round still open at the final whistle ends this way. Counting these
 * as abandonment - which this screen did until 7 September 2026 - meant the better a contest
 * was attended right to its end, the less popular its game appeared. That is the number an
 * operator uses to decide whether to keep a game running.
 *
 * A high share here is a SCHEDULING signal: the play window is too short for the round length
 * an operator configured, or players are starting too late in it.
 */
const CUT_OFF = ["expired"] as const;
/** Rounds an operator or the platform ended. Not the player's doing and not the provider's. */
const CANCELLED = ["voided"] as const;
/** Rounds nobody ever reported. The provider's failure, and the one that costs money. */
const NEVER_REPORTED = ["unresolved"] as const;
/** Still in play, or should be. */
const LIVE = ["pending", "launched"] as const;

export interface GamePerformanceRow {
  gameKey: string;
  gameCode: string;
  providerKey: string;
  /** The catalogue name, falling back to the code and then the key - never "Unknown". */
  title: string;
  providerName: string;
  /** False when the title has been removed from the catalogue but still has history. */
  inCatalogue: boolean;
  rounds: {
    started: number;
    /** Ran to the game's own end. See `RAN_FULL_COURSE` - not the same as "scored". */
    ranFullCourse: number;
    /** The player left. */
    leftEarly: number;
    /** The contest window closed over them. Still scores what they achieved. */
    cutOff: number;
    cancelled: number;
    neverReported: number;
    live: number;
  };
  /**
   * Rounds carrying a score that ranking counts - `RAN_FULL_COURSE`, `LEFT_EARLY` or `CUT_OFF`
   * with a stored number. `null` is impossible; zero is meaningful.
   *
   * Counted from the score rather than from the status, because the status cannot answer it: a
   * player who abandoned before solving anything ends `abandoned` with nothing to rank, and a
   * player cut off after two boards ends `expired` with two boards' worth of score that pays.
   */
  scoreProducing: number;
  /**
   * Share of finished rounds the player walked out of. `null` when none finished.
   *
   * A share and not a count, for the reason `provider-health.service.ts` gives about its own
   * threshold: two abandoned out of four is a game people cannot get on with, and two out of
   * four hundred is a phone call. A count calls the first fine.
   *
   * `expired` is deliberately NOT in here - see `CUT_OFF`.
   */
  abandonmentRate: number | null;
  /**
   * Share of finished rounds the contest window closed over. `null` when none finished.
   *
   * Reported beside the abandonment rate rather than merged into it because the two have
   * different remedies: this one is answered by lengthening the play window or by the
   * `until_window_closes` round-start policy, not by changing the game.
   */
  cutOffRate: number | null;
  /**
   * Median-free mean of `durationMs`, in seconds, over rounds that ran their full course.
   *
   * Scoped that way on purpose: mixing in a round the contest cut off after twenty seconds
   * would drag the figure towards how the schedule was set rather than how long the game takes
   * to play, which is the question this column is here to answer.
   */
  averagePlaySeconds: number | null;
  /**
   * Mean delay between the provider saying a round finished and us receiving the result.
   *
   * **This is the number R44's grace window exists for.** A latency approaching the window
   * means results are about to start being refused as late, and a player who finished inside
   * the contest gets ranked on nothing. It is the earliest warning available for that, and
   * nothing was measuring it.
   */
  averageResultLatencySeconds: number | null;
  /**
   * Results that arrived with a completion time LATER than our receipt time.
   *
   * Held apart rather than averaged in, for the same reason a signature failure is held apart
   * from other event failures: it means the two clocks disagree, which is a different problem
   * from a slow provider, and averaging a negative into a mean hides both. It is reported
   * because `completedAt` is the provider's clock and `resultReceivedAt` is ours - the only
   * cross-clock figure on this screen.
   */
  clockSkewedResults: number;
  players: number;
  contests: number;
  /**
   * Entrants who never started a single round, across the contests in the window.
   *
   * The participation funnel `12` s5 asks for, reduced to the number that matters. A paid
   * entrant who never played is either a player who could not find the button or a launch that
   * refused, and both are invisible on every other screen - they simply rank last.
   */
  entrantsWhoNeverPlayed: number | null;
  windowDays: number;
  verdict: PerformanceVerdict;
  /** One sentence naming what the verdict is based on. Never a bare status word. */
  summary: string;
}

export type PerformanceVerdict =
  | "healthy"
  | "watch"
  | "problem"
  | "no_traffic";

/**
 * Above this share of finished rounds abandoned, the title needs looking at.
 *
 * Not a failure on its own - some games are hard - which is why it is `watch` and not
 * `problem`. A round nobody ever reported IS a fault, so that has its own lower threshold.
 */
const WATCH_ABANDONMENT_SHARE = 0.35;
/**
 * Share of finished rounds the contest window closed over before it is worth a mention.
 *
 * Higher than the abandonment threshold on purpose. Some rounds ending this way is normal and
 * expected - under the universal cut-off, anyone still playing at the final whistle ends here -
 * so it only says something once it is most of them.
 */
const WATCH_CUT_OFF_SHARE = 0.5;
const PROBLEM_UNREPORTED_SHARE = 0.1;

export async function getGamePerformance(
  windowDays: PerformanceWindow = DEFAULT_PERFORMANCE_WINDOW,
): Promise<GamePerformanceRow[]> {
  await connectToDatabase();

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Reason for aggregating rather than looping the catalogue: one query per title per status
  // would be a query count that grows with the catalogue, on a screen that refreshes.
  const [statusStats, scoredStats, titles, providers, competitionRounds] =
    await Promise.all([
      GameRound.aggregate<{
        _id: { gameKey: string; status: string };
        n: number;
        withScore: number;
        players: string[];
      }>([
        { $match: { createdAt: { $gte: since }, mode: "ranked" } },
        {
          $group: {
            _id: { gameKey: "$gameKey", status: "$status" },
            n: { $sum: 1 },
            // Reason this is counted per status rather than once: whether a score counts
            // depends on the status it arrived with, so the two facts have to stay together.
            withScore: { $sum: { $cond: [{ $isNumber: "$rawScore" }, 1, 0] } },
            players: { $addToSet: "$userId" },
          },
        },
      ]),
      // Duration and latency, over rounds that ran their full course only.
      //
      // Reason they are computed in the database rather than by pulling rounds back: a busy
      // title's rounds are the largest collection on this screen and the answer is two numbers.
      GameRound.aggregate<{
        _id: string;
        playMs: number | null;
        latencyMs: number | null;
        skewed: number;
        latencySamples: number;
      }>([
        {
          $match: {
            createdAt: { $gte: since },
            mode: "ranked",
            status: { $in: [...RAN_FULL_COURSE] },
          },
        },
        {
          $project: {
            gameKey: 1,
            durationMs: 1,
            // Reason `$subtract` on two dates rather than a stored field: nothing stores the
            // delay, and it is the only figure that can warn about R44 before it bites.
            latencyMs: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$resultReceivedAt", null] },
                    { $ne: ["$completedAt", null] },
                  ],
                },
                { $subtract: ["$resultReceivedAt", "$completedAt"] },
                null,
              ],
            },
          },
        },
        {
          $group: {
            _id: "$gameKey",
            playMs: { $avg: "$durationMs" },
            // Negative samples are excluded from the mean and counted separately. See
            // `clockSkewedResults`.
            latencyMs: {
              $avg: {
                $cond: [{ $gte: ["$latencyMs", 0] }, "$latencyMs", null],
              },
            },
            latencySamples: {
              $sum: { $cond: [{ $gte: ["$latencyMs", 0] }, 1, 0] },
            },
            skewed: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$latencyMs", null] },
                      { $lt: ["$latencyMs", 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      ProviderGame.find().select("gameKey gameCode providerKey displayName").lean(),
      GameProvider.find().select("providerKey displayName").lean(),
      // The competitions each game ran in the window, and who played in them.
      //
      // Reason the players are collected HERE and not reused from `statusStats`: that set
      // includes challenge rounds, and the funnel's denominator is competition seats. Counting
      // challenge players against competition entrants would produce a negative shortfall on a
      // busy game and a wrong one on any game, while still rendering a plausible number.
      GameRound.aggregate<{
        _id: string;
        contests: unknown[];
        players: string[];
      }>([
        {
          $match: {
            createdAt: { $gte: since },
            mode: "ranked",
            contestType: "competition",
            contestId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$gameKey",
            contests: { $addToSet: "$contestId" },
            players: { $addToSet: "$userId" },
          },
        },
      ]),
    ]);

  const gameKeys = [...new Set(statusStats.map((row) => row._id.gameKey))];
  if (gameKeys.length === 0) return [];

  // Entrants per game, scoped to the competitions that were actually played in the window.
  //
  // Two things are load-bearing. It is scoped to those contest ids rather than to `gameKey`
  // alone, because an unscoped count is every seat the title has ever sold and the shortfall
  // would grow for ever. And the ids are stringified: `game_round.contestId` is an ObjectId
  // while `competition_participant.competitionId` is declared `String`, and the raw driver does
  // no casting - an unconverted `$in` matches nothing, logs nothing and reports every entrant as
  // having played. Same trap as the R42 fixture.
  const contestIdsByGame = new Map(
    competitionRounds.map((row) => [
      row._id,
      row.contests.map((id) => String(id)),
    ]),
  );
  const allContestIds = [...new Set([...contestIdsByGame.values()].flat())];

  const entrantStats =
    allContestIds.length > 0
      ? await CompetitionParticipant.aggregate<{ _id: string; players: string[] }>([
          { $match: { competitionId: { $in: allContestIds } } },
          { $group: { _id: "$gameKey", players: { $addToSet: "$userId" } } },
        ])
      : [];

  const titleByKey = new Map(
    (titles as { gameKey: string; gameCode?: string; providerKey?: string; displayName?: string }[]).map(
      (title) => [title.gameKey, title],
    ),
  );
  const providerNameByKey = new Map(
    (providers as { providerKey: string; displayName?: string }[]).map((p) => [
      p.providerKey,
      p.displayName,
    ]),
  );
  const durationByKey = new Map(scoredStats.map((row) => [row._id, row]));
  const competitionPlayersByKey = new Map(
    competitionRounds.map((row) => [row._id, new Set(row.players)]),
  );
  const entrantsByKey = new Map(
    entrantStats.map((row) => [row._id, new Set(row.players)]),
  );

  return gameKeys
    .map((gameKey) => {
      const forKey = statusStats.filter((row) => row._id.gameKey === gameKey);
      const countOf = (statuses: readonly string[]) =>
        forKey
          .filter((row) => statuses.includes(row._id.status))
          .reduce((sum, row) => sum + row.n, 0);
      const scoresIn = (statuses: readonly string[]) =>
        forKey
          .filter((row) => statuses.includes(row._id.status))
          .reduce((sum, row) => sum + row.withScore, 0);

      const rounds = {
        started: forKey.reduce((sum, row) => sum + row.n, 0),
        ranFullCourse: countOf(RAN_FULL_COURSE),
        leftEarly: countOf(LEFT_EARLY),
        cutOff: countOf(CUT_OFF),
        cancelled: countOf(CANCELLED),
        neverReported: countOf(NEVER_REPORTED),
        live: countOf(LIVE),
      };

      const scoreProducing = scoresIn([
        ...RAN_FULL_COURSE,
        ...LEFT_EARLY,
        ...CUT_OFF,
      ]);

      const players = new Set(forKey.flatMap((row) => row.players)).size;
      const finished =
        rounds.ranFullCourse +
        rounds.leftEarly +
        rounds.cutOff +
        rounds.cancelled +
        rounds.neverReported;
      const duration = durationByKey.get(gameKey);
      // The funnel, computed as a SET DIFFERENCE rather than a subtraction of two counts.
      // Reason: the two sets are gathered from different collections, so a user present in one
      // and absent from the other is exactly the fact being measured - and a plain subtraction
      // silently returns a smaller number whenever anyone appears in the round set who is not a
      // seat (a seat deleted by a refund, say), which reads as better participation.
      const entrants = entrantsByKey.get(gameKey);
      const playedInContests = competitionPlayersByKey.get(gameKey);

      // `gameKey` is the only identifier guaranteed present, because a title can leave the
      // catalogue while its rounds stay (R29 retires rows, never deletes them). Everything
      // else falls back through it.
      const title = titleByKey.get(gameKey);
      const providerKey = title?.providerKey ?? gameKey.split(":")[1] ?? "unknown";
      const gameCode = title?.gameCode ?? gameKey.split(":")[2] ?? gameKey;

      const row: GamePerformanceRow = {
        gameKey,
        gameCode,
        providerKey,
        title: title?.displayName || gameCode,
        providerName: providerNameByKey.get(providerKey) || providerKey,
        inCatalogue: Boolean(title),
        rounds,
        scoreProducing,
        abandonmentRate: finished > 0 ? rounds.leftEarly / finished : null,
        cutOffRate: finished > 0 ? rounds.cutOff / finished : null,
        averagePlaySeconds:
          typeof duration?.playMs === "number" && Number.isFinite(duration.playMs)
            ? duration.playMs / 1000
            : null,
        averageResultLatencySeconds:
          typeof duration?.latencyMs === "number" &&
          Number.isFinite(duration.latencyMs) &&
          (duration.latencySamples ?? 0) > 0
            ? duration.latencyMs / 1000
            : null,
        clockSkewedResults: duration?.skewed ?? 0,
        players,
        contests: contestIdsByGame.get(gameKey)?.length ?? 0,
        // Reason `null` rather than `0` when there are no seats: nobody having entered and
        // everybody having played are different facts, and `0` reads as the second. Same
        // distinction as the score column's `-` and an unclaimed rank's `null` prize (R45).
        entrantsWhoNeverPlayed: entrants
          ? [...entrants].filter((userId) => !playedInContests?.has(userId)).length
          : null,
        windowDays,
        ...verdictFor({ rounds, scoreProducing, finished, windowDays }),
      };

      return row;
    })
    .sort((a, b) => b.rounds.started - a.rounds.started || a.title.localeCompare(b.title));
}

/**
 * The verdict and the sentence behind it, returned together.
 *
 * They are computed here rather than in the component so that they cannot disagree - a badge
 * reading "problem" beside a sentence describing healthy traffic is worse than either alone.
 * Same reasoning as `provider-health.service.ts`.
 */
function verdictFor(input: {
  rounds: GamePerformanceRow["rounds"];
  /** Rounds carrying a rankable score. Counted from the score, never inferred from a status. */
  scoreProducing: number;
  finished: number;
  windowDays: number;
}): { verdict: PerformanceVerdict; summary: string } {
  const { rounds, scoreProducing, finished, windowDays } = input;

  if (rounds.started === 0) {
    return {
      verdict: "no_traffic",
      summary: `Nobody played this game in the last ${windowDays} days, so there is nothing to judge it by.`,
    };
  }

  if (finished === 0) {
    // Every round still live. Not evidence of anything yet, in either direction.
    return {
      verdict: "no_traffic",
      summary: `${rounds.live} rounds are in play and none has finished, so there is nothing to judge this game by yet.`,
    };
  }

  const unreportedShare = rounds.neverReported / finished;
  if (unreportedShare > PROBLEM_UNREPORTED_SHARE) {
    return {
      verdict: "problem",
      summary: `${rounds.neverReported} of ${finished} finished rounds never reported a result (${Math.round(unreportedShare * 100)}%). Those are the rounds that hold settlement or score a player zero for a game they played.`,
    };
  }

  // Reason this reads the score count and not a status count: after R48 a round can end three
  // different ways and still be worth ranking, so "did this game produce results" is a question
  // only the stored score can answer. Judging it by `completed` alone called a contest whose
  // every round was cut off by its own window a total failure, when those players were paid.
  if (scoreProducing === 0) {
    return {
      verdict: "problem",
      summary: `${finished} rounds finished in the last ${windowDays} days and not one produced a score.`,
    };
  }

  const abandonShare = rounds.leftEarly / finished;
  if (abandonShare > WATCH_ABANDONMENT_SHARE) {
    return {
      verdict: "watch",
      summary: `${rounds.leftEarly} of ${finished} finished rounds were walked out of (${Math.round(abandonShare * 100)}%). That is players leaving the game rather than the game failing - worth reading the settings before the artwork.`,
    };
  }

  // A separate verdict from abandonment, because the remedy is separate: this is the contest
  // window being too short for the round length, not a game people cannot get on with.
  const cutOffShare = rounds.cutOff / finished;
  if (cutOffShare > WATCH_CUT_OFF_SHARE) {
    return {
      verdict: "watch",
      summary: `${rounds.cutOff} of ${finished} finished rounds were still being played when the contest closed (${Math.round(cutOffShare * 100)}%). They still scored what the player achieved, but the play window is short for this game's round length.`,
    };
  }

  if (rounds.neverReported > 0) {
    return {
      verdict: "watch",
      summary: `${scoreProducing} rounds scored normally, but ${rounds.neverReported} never reported a result at all.`,
    };
  }

  return {
    verdict: "healthy",
    summary: `${scoreProducing} of ${finished} finished rounds produced a score, with none unreported.`,
  };
}
