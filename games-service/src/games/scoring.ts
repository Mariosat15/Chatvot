/**
 * Turning a played round into the one number that decides prize money.
 *
 * THE INPUT IS A LIST OF SERVER-VERIFIED SOLVES, NOT A CLIENT REPORT
 * -----------------------------------------------------------------
 * Nothing in this file takes a score, a total or a "solved" boolean from the browser. It takes
 * the boards this service generated and the solve times this service observed, and computes the
 * result itself. The specification is explicit that the platform will ignore any score arriving
 * from a browser, and this is the other half of that promise: there is no path by which a
 * client-supplied number could become the reported score, because no function here accepts one.
 *
 * TIMING IS MEASURED SERVER-SIDE, AND THAT IS NOT A DETAIL
 * -------------------------------------------------------
 * A duration reported by the client is a duration the player chose - and for `circuit-perfect`
 * the duration IS the score, so trusting it would hand the contest to whoever edited a number.
 * Each board's solve time is the interval between two server events: the board being issued and
 * its solution being accepted.
 *
 * The honest cost of that choice is that a player's time includes their network latency, and a
 * player on a slow connection is genuinely disadvantaged by a few hundred milliseconds. That is
 * a real unfairness and it is the lesser one: the alternative is a contest decided by whoever
 * is willing to edit a timestamp.
 */

import {
  PERFECT,
  PERFECT_CODE,
  RoundConfig,
  SPRINT,
  SPRINT_CODE,
  TitleDefinition,
} from "./titles";

/** One board the player was issued, and what became of it. */
export interface BoardOutcome {
  index: number;
  /** When this service issued the board. */
  issuedAt: Date;
  /** When this service accepted a correct solution. Absent means never solved. */
  solvedAt?: Date;
}

export interface ScoreResult {
  /** The single number the platform ranks on. */
  score: number;
  /** Display only. The specification is explicit that we are never ranked on this. */
  breakdown: Record<string, unknown>;
  /** Reported alongside the score; the platform uses it as a tie-break. */
  durationMs: number;
}

/** Points for finishing a board, before any speed bonus. */
const SPRINT_BOARD_POINTS = 1000;
/** The most a single board's speed bonus can be worth. */
const SPRINT_MAX_SPEED_BONUS = 200;
/**
 * The solve time at which the speed bonus reaches zero.
 *
 * Chosen so that the bonus rewards fluency without ever outweighing a completed board: two
 * boards solved slowly (2,000) always beats one solved instantly (1,200). Reason: a scoring
 * curve where speed can beat completion turns a puzzle into a gamble about which board to
 * abandon, which is the opposite of the skill the contest claims to measure.
 */
const SPRINT_BONUS_ZERO_AT_MS = 30_000;

function solveMs(board: BoardOutcome): number | null {
  if (!board.solvedAt) return null;
  return Math.max(0, board.solvedAt.getTime() - board.issuedAt.getTime());
}

function scoreSprint(boards: BoardOutcome[]): ScoreResult {
  let score = 0;
  let speedBonusTotal = 0;
  let solved = 0;
  let fastestMs: number | null = null;
  let lastSolveAt: Date | null = null;
  const solveTimes: number[] = [];

  for (const board of boards) {
    const elapsed = solveMs(board);
    if (elapsed === null) continue;

    solved++;
    solveTimes.push(elapsed);
    if (fastestMs === null || elapsed < fastestMs) fastestMs = elapsed;
    if (!lastSolveAt || board.solvedAt! > lastSolveAt) lastSolveAt = board.solvedAt!;

    const bonus = Math.max(
      0,
      Math.round(SPRINT_MAX_SPEED_BONUS * (1 - elapsed / SPRINT_BONUS_ZERO_AT_MS)),
    );
    speedBonusTotal += bonus;
    score += SPRINT_BOARD_POINTS + bonus;
  }

  // Duration is reported as the time to the LAST COMPLETED BOARD, not the length of the
  // session.
  //
  // Reason: the specification says duration is used as a tie-break and that "ties are common",
  // which is true here - two players who each solve nine boards will often land within a few
  // points. Every Sprint session lasts exactly the configured clock, so reporting the session
  // length would make the tie-break identical for the whole field and therefore useless.
  // Reporting time-to-last-solve makes it meaningful: of two equal scores, the player who got
  // there sooner is ahead.
  const firstIssuedAt = boards.length > 0 ? boards[0].issuedAt.getTime() : 0;
  const durationMs = lastSolveAt ? lastSolveAt.getTime() - firstIssuedAt : 0;

  return {
    score,
    durationMs,
    breakdown: {
      boardsCompleted: solved,
      boardsAttempted: boards.length,
      basePoints: solved * SPRINT_BOARD_POINTS,
      speedBonus: speedBonusTotal,
      fastestBoardMs: fastestMs,
      averageBoardMs:
        solveTimes.length > 0
          ? Math.round(solveTimes.reduce((a, b) => a + b, 0) / solveTimes.length)
          : null,
    },
  };
}

function scorePerfect(boards: BoardOutcome[], penaltyMs: number): ScoreResult {
  let solvedMs = 0;
  let solved = 0;
  let unfinished = 0;

  for (const board of boards) {
    const elapsed = solveMs(board);
    if (elapsed === null) {
      unfinished++;
      continue;
    }
    solved++;
    solvedMs += elapsed;
  }

  // The penalty is what stops the lower-is-better rule being nonsense.
  //
  // Without it, a player who solved two boards quickly and quit would have a lower total time
  // than one who solved all five - so giving up would be the winning strategy, and the game
  // would reward abandoning a paid contest. This is stated in the title's `rulesSummary`
  // because it is precisely the kind of thing a player disputes a prize over.
  const penaltyTotal = unfinished * penaltyMs;
  const raw = solvedMs + penaltyTotal;

  // Clamp into the declared range. The specification says the platform rejects a score outside
  // `scoreRange`, and a rejected score becomes an unresolved round rather than a wrong payout -
  // so a player who somehow lands outside it would be excluded from a contest they played.
  // Reporting the boundary is the lesser wrong, and the clamp is reported in the breakdown so
  // it is visible rather than silent.
  const score = Math.min(
    PERFECT.scoreRange.max,
    Math.max(PERFECT.scoreRange.min, raw),
  );

  return {
    score,
    // For a lower-is-better title the score IS the duration, so they agree by construction.
    durationMs: raw,
    breakdown: {
      boardsCompleted: solved,
      boardsUnfinished: unfinished,
      timeOnSolvedBoardsMs: solvedMs,
      penaltyMs: penaltyTotal,
      penaltyPerUnfinishedBoardMs: unfinished > 0 ? penaltyMs : null,
      clamped: score !== raw ? { raw, reported: score } : null,
    },
  };
}

export function scoreRound(
  title: TitleDefinition,
  config: RoundConfig,
  boards: BoardOutcome[],
): ScoreResult {
  if (title.gameCode === SPRINT_CODE && config.kind === "sprint") {
    const result = scoreSprint(boards);
    return {
      ...result,
      score: Math.min(SPRINT.scoreRange.max, Math.max(SPRINT.scoreRange.min, result.score)),
    };
  }

  if (title.gameCode === PERFECT_CODE && config.kind === "perfect") {
    return scorePerfect(boards, config.unfinishedPenaltyMs);
  }

  // Fail closed rather than guessing a scoring rule.
  //
  // Reaching here means the title and the resolved config disagree, which is our own bug. A
  // guessed score is a wrong payout that nobody can trace; a thrown error becomes a voided
  // round, which returns the player's attempt and costs nobody anything.
  throw new Error(
    `Circuit: cannot score '${title.gameCode}' with a '${config.kind}' configuration`,
  );
}

/**
 * The score for a round that produced nothing at all.
 *
 * Used for `expired` and for `abandoned` where the player never completed a board. The
 * specification asks for a partial score where one can be computed and says plainly why: "a
 * dropped mobile signal should not cost someone a paid entry". Both titles can always compute
 * one, so this is only ever reached when there is genuinely nothing to report - and note the
 * two titles' "nothing" are at opposite ends of their ranges.
 */
export function zeroScore(title: TitleDefinition, config: RoundConfig): ScoreResult {
  const boards: BoardOutcome[] = [];
  if (title.gameCode === PERFECT_CODE && config.kind === "perfect") {
    // Every board unfinished: the worst possible time, not the best. A literal zero here would
    // make a player who never loaded the game the winner of every lower-is-better contest.
    return scorePerfect(
      Array.from({ length: config.boardCount }, (_, index) => ({
        index,
        issuedAt: new Date(0),
      })),
      config.unfinishedPenaltyMs,
    );
  }
  return scoreRound(title, config, boards);
}
