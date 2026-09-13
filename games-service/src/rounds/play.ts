import { generateForPlayer } from "../engine/generate";
import { toClientPuzzle, type ClientPuzzle } from "../engine/puzzle";
import { REFUSAL_MESSAGES, verifyAttempt, type AttemptRefusal } from "../engine/verify";
import { BOARD_RULES } from "../games/instructions";
import {
  findTitle,
  roundDurationMs,
  shapeFor,
  type PerfectConfig,
  type RoundConfig,
} from "../games/titles";
import { Round, isTerminal, type RoundDocument } from "../store/round.model";
import { ApiError, unknownRound } from "../http/errors";
import { finishRound, hardDeadline, playability, playableSeconds } from "./lifecycle";
import { sendProgress } from "../callback/progress";

/**
 * The play surface, used by the game in the iframe rather than by the platform.
 *
 * THE CLIENT IS AN INPUT DEVICE, NOT A SOURCE OF TRUTH
 * ---------------------------------------------------
 * The specification says it plainly - "never send us a score this way", "we will ignore any score
 * arriving from the browser" - and the reason is that the player owns the browser. So nothing
 * here accepts a score, a time, a board or a puzzle from the client. The client sends the paths
 * it drew; the server regenerates the board from the seed, verifies the paths against the rules,
 * and takes the timestamps from its own clock.
 *
 * That the boards are never stored is a consequence of the same design rather than an
 * optimisation: a board is a pure function of the seed and its index, so there is nothing the
 * client could tamper with that the server would not simply regenerate correctly.
 */

/**
 * The seed the content comes from.
 *
 * A ranked round always carries a contest `contentSeed` - `createRound` refuses one that does
 * not - so this fallback only ever applies to practice, where there is no contest to be fair
 * within and variety is worth more than reproducibility.
 */
function contentSeedFor(round: { contentSeed?: string; providerRoundId: string }): string {
  return round.contentSeed ?? round.providerRoundId;
}

export interface PlayState {
  roundId: string;
  gameCode: string;
  mode: "ranked" | "practice";
  status: RoundDocument["status"];
  /**
   * The title's own name, its rules and how it scores - the three things the pre-round panel
   * needs and used to invent.
   *
   * WHY THEY TRAVEL WITH THE STATE. The frame kept its own map of display names, and the page
   * hard-coded its own wording of the rules, so a title added to the catalogue would have
   * appeared in the game as "Circuit" and a corrected rule would have been corrected in one
   * place. `scoring` is the more valuable of the three and was missing outright: a player in a
   * paid contest had no way to find out from inside the game whether a fast board was worth more
   * than a finished one.
   *
   * NOTE WHAT IS STILL ABSENT, and must stay absent: a score, a rank and a prize. The client is
   * an input device. See the header of this file.
   */
  title: string;
  boardRules: readonly string[];
  scoring: string;
  /** Absent once the round is terminal. */
  board?: ClientPuzzle;
  boardsSolved: number;
  /** Present for Circuit Perfect, which has a fixed set. Absent for Sprint, which has no limit. */
  boardTarget?: number;
  /**
   * The round's own length by its title's rules - the sprint clock, or Perfect's declared maximum.
   *
   * `endsAt` cannot answer that question, because it does not exist until the clock has started -
   * and the one moment the player needs to know the length is before they start it.
   *
   * IT IS NOT WHAT THE PLAYER IS PROMISED. See `playableSeconds` below, which is; this is here
   * only so the client can tell the two apart and say WHY the round is short when it is.
   */
  durationSeconds?: number;
  /**
   * How long the player will actually get, which is at or below `durationSeconds`.
   *
   * The contest's window can be nearer than the title's clock, and when it is, this is the figure
   * the server will honour. `lifecycle.playableSeconds` carries the full reasoning.
   */
  playableSeconds?: number;
  /**
   * When play stops, so the client can render a countdown it does not own.
   *
   * THE EARLIEST OF THE THREE DEADLINES, not the gameplay clock alone. It read
   * `gameplayEndsAt(round)` until 10 September 2026, so a player who started a ten-minute sprint
   * with five minutes of contest left watched a clock counting from 10:00 and was cut off with it
   * still reading 5:00. `hardDeadline` already weighed all three correctly and was called by
   * nothing.
   */
  endsAt?: string;
  /** Where to send the player when they leave. */
  returnUrl?: string;
  /** Set once terminal, so the frame can show a result without asking for the score. */
  finished?: {
    status: RoundDocument["status"];
    boardsSolved: number;
  };
}

/** Loads a round by its launch token, which is the only credential the browser holds. */
export async function roundForToken(token: string): Promise<RoundDocument> {
  if (!token || token.length < 16) throw new ApiError(401, "UNAUTHENTICATED", "Invalid session.");
  const round = await Round.findOne({ launchToken: token });
  // Reason for a 401 rather than a 404: a 404 confirms that a token was well-formed but unknown,
  // which turns this endpoint into an oracle for guessing tokens.
  if (!round) throw new ApiError(401, "UNAUTHENTICATED", "Invalid session.");
  return round;
}

function boardTargetFor(config: RoundConfig): number | undefined {
  return config.kind === "perfect" ? (config as PerfectConfig).boardCount : undefined;
}

function puzzleFor(round: RoundDocument, index: number): ClientPuzzle {
  const config = round.config as unknown as RoundConfig;
  const generated = generateForPlayer(
    contentSeedFor(round),
    round.presentationSeed,
    index,
    shapeFor(config.gridSize),
  );
  return toClientPuzzle(generated, index);
}

function solvedCount(round: RoundDocument): number {
  return round.boards.filter((board) => board.solvedAt).length;
}

/**
 * Whether the player is owed another board.
 *
 * Sprint has no board limit: the clock is the limit, so there is always another board. Perfect
 * has a fixed set, and running out of boards is what completes the round.
 */
function needsAnotherBoard(round: RoundDocument): boolean {
  const config = round.config as unknown as RoundConfig;
  const target = boardTargetFor(config);
  if (target === undefined) return true;
  return round.boards.length < target;
}

function stateFor(round: RoundDocument, board?: ClientPuzzle): PlayState {
  const config = round.config as unknown as RoundConfig;
  // Absent until the clock is running, deliberately - see `durationSeconds` on `PlayState`. The
  // presence test is `startedAt` rather than a null from the deadline helper, because
  // `hardDeadline` answers for an unstarted round too and its answer there is the contest's
  // expiry, which is not a countdown this round is running against yet.
  const endsAt = round.startedAt ? hardDeadline(round) : null;

  /*
   * A round whose title has vanished from the catalogue still has to render something. It is
   * already being voided by `finishRound`, which is the outcome that matters, but the frame
   * reaches here first and a thrown error would show the player a broken game instead of the
   * cancellation notice that explains their attempt has been returned.
   */
  const title = findTitle(round.gameCode);

  const state: PlayState = {
    roundId: round.roundId,
    gameCode: round.gameCode,
    mode: round.mode,
    status: round.status,
    title: title?.displayName ?? "Circuit",
    boardRules: BOARD_RULES,
    scoring: title?.rulesSummary ?? "",
    boardsSolved: solvedCount(round),
    boardTarget: boardTargetFor(config),
    returnUrl: round.returnUrl,
  };

  /*
   * Both titles, not just Sprint. Perfect has no clock in its rules, so `roundDurationMs` gives
   * its declared maximum - which is its hard stop and is therefore the honest answer - and the
   * client needs it in order to notice that a Perfect round is being cut short too. The intro
   * copy for Perfect leads on its board count either way, so nothing about that screen changes
   * unless the contest is genuinely shortening the round.
   */
  state.durationSeconds = Math.floor(roundDurationMs(config) / 1000);
  state.playableSeconds = playableSeconds(round);
  if (board) state.board = board;
  if (endsAt) state.endsAt = endsAt.toISOString();

  /*
   * `finished` means the round is over. It is deliberately NOT "there is no board to show".
   *
   * The first version of this line was `if (!board)`, and a round that has not started yet has no
   * board either - so `GET /play/api/state` on a freshly created round answered
   * `finished: { status: "created" }`, which is a result screen for a round nobody has played.
   * Nothing caught it because every other caller reaches here after starting, and it only became
   * visible when a client existed that reads the state before offering the player a Start button.
   *
   * The second case takes the OWED status rather than the stored one: a deadline that has passed is
   * over from the player's seat, but only `finishRound` and the sweeper write a terminal status, so
   * the stored value is still `in_progress` for as long as a minute. Reporting that would leave the
   * frame rendering a live board against a dead clock.
   */
  const status = playability(round, new Date());
  const over = isTerminal(round.status)
    ? round.status
    : (!status.playable && status.owes) || null;

  if (over) state.finished = { status: over, boardsSolved: solvedCount(round) };

  return state;
}

/**
 * Starts the round, or resumes one already in progress.
 *
 * WHY STARTING IS SEPARATE FROM CREATING, AND WHY IT IS NOT A GET
 * --------------------------------------------------------------
 * `POST /v1/rounds` creates the round and consumes the player's attempt. This starts the clock,
 * and it is deliberately a POST the client makes after the frame has loaded and rendered, rather
 * than something the launch URL does on its way in.
 *
 * The reason is the same trap the platform hit on its own play screen: a browser issues a GET for
 * reasons that have nothing to do with intent - prefetch on hover, a crawler, a poll, a
 * refresh - so a side effect behind a GET fires without anybody clicking. Here the side effect is
 * starting a timed round, and a sprint clock started by a link prefetch is a player's paid attempt
 * spent while they were still reading the rules.
 *
 * Resuming is the same call, which is what makes a dropped connection survivable. The clock is
 * not restarted, because it belongs to the round rather than to the session.
 */
export async function startOrResume(token: string): Promise<PlayState> {
  const round = await roundForToken(token);
  const now = new Date();

  const status = playability(round, now);
  if (!status.playable) {
    if (status.owes) await finishRound(round.roundId, { status: status.owes, at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return stateFor(settled ?? round);
  }

  if (round.status === "created") {
    round.status = "in_progress";
    round.startedAt = now;
    round.boards = [{ index: 0, issuedAt: now, attempts: 0 }];
    await round.save();
    return stateFor(round, puzzleFor(round, 0));
  }

  // Resuming. The board to show is the first unsolved one; if every issued board is solved, the
  // player disconnected between solving and being handed the next, so issue it now.
  const unsolved = round.boards.find((board) => !board.solvedAt);
  if (unsolved) return stateFor(round, puzzleFor(round, unsolved.index));

  if (!needsAnotherBoard(round)) {
    await finishRound(round.roundId, { status: "completed", at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return stateFor(settled ?? round);
  }

  const index = round.boards.length;
  round.boards.push({ index, issuedAt: now, attempts: 0 });
  await round.save();
  return stateFor(round, puzzleFor(round, index));
}

export interface SubmitOutcome {
  accepted: boolean;
  /** Present when refused, and always one of the engine's named rules. */
  refusal?: AttemptRefusal;
  message?: string;
  state: PlayState;
}

/**
 * Verifies a submitted board.
 *
 * The refusal is named rather than reduced to "wrong", because the client shows it to the player
 * and "your paths cross" and "one square is unused" require different corrections. A generic
 * refusal on a puzzle the player believes is finished is the shape of complaint that turns into a
 * support ticket about the game being broken.
 */
export async function submitBoard(
  token: string,
  boardIndex: unknown,
  paths: unknown,
): Promise<SubmitOutcome> {
  const round = await roundForToken(token);
  const now = new Date();

  const status = playability(round, now);
  if (!status.playable) {
    if (status.owes) await finishRound(round.roundId, { status: status.owes, at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return {
      accepted: false,
      message: "This round is closed.",
      state: stateFor(settled ?? round),
    };
  }

  if (typeof boardIndex !== "number" || !Number.isInteger(boardIndex)) {
    throw new ApiError(400, "INVALID_REQUEST", "'boardIndex' must be an integer.");
  }

  const board = round.boards.find((entry) => entry.index === boardIndex);
  // A submission for a board we never issued is either a bug or a probe. Either way the answer is
  // the same: we only score boards this server handed out, at the time it handed them out.
  if (!board) throw new ApiError(400, "INVALID_REQUEST", "That board was not issued.");
  if (board.solvedAt) {
    throw new ApiError(400, "ROUND_NOT_PLAYABLE", "That board is already solved.");
  }

  board.attempts += 1;

  const config = round.config as unknown as RoundConfig;
  const generated = generateForPlayer(
    contentSeedFor(round),
    round.presentationSeed,
    boardIndex,
    shapeFor(config.gridSize),
  );

  const verdict = verifyAttempt(generated, paths);
  if (!verdict.solved) {
    await round.save();
    return {
      accepted: false,
      refusal: verdict.reason,
      message: REFUSAL_MESSAGES[verdict.reason],
      state: stateFor(round, toClientPuzzle(generated, boardIndex)),
    };
  }

  // The solve time is taken here, from the server's clock, and never from the client. The whole
  // score rests on it.
  board.solvedAt = now;

  if (!needsAnotherBoard(round)) {
    await round.save();
    await finishRound(round.roundId, { status: "completed", at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return { accepted: true, state: stateFor(settled ?? round) };
  }

  const nextIndex = round.boards.length;
  round.boards.push({ index: nextIndex, issuedAt: now, attempts: 0 });
  await round.save();

  /*
   * TELL THE PLATFORM, AND DO NOT WAIT FOR IT.
   *
   * No `await`, and that is the whole rule rather than a micro-optimisation: this sits between
   * a player solving a board and being handed the next one, in a round they PAID for, so an
   * `await` on a slow or unreachable platform is a visible stall at the worst possible moment.
   * `sendProgress` cannot reject, so there is no unhandled rejection to guard against - and
   * `void` is what says the omission is deliberate rather than forgotten.
   *
   * Deliberately NOT sent on the finishing branch above. That round is already being delivered
   * as a result with the same figures and a score beside them, and the platform refuses
   * progress for a round that is no longer live - so a send there would be a guaranteed
   * refusal, logged as a warning, on every single completed round.
   */
  void sendProgress(round);

  return { accepted: true, state: stateFor(round, puzzleFor(round, nextIndex)) };
}

/**
 * The player leaves before the round ends.
 *
 * Reported as `abandoned` with whatever they earned, which is exactly what section 13 asks for -
 * "please send a partial score if you can compute one" - and note the round still counts as an
 * attempt. A player who quits has used their entry; what they have not done is forfeited the
 * boards they already solved.
 */
export async function leaveRound(token: string): Promise<PlayState> {
  const round = await roundForToken(token);
  await finishRound(round.roundId, { status: "abandoned" });
  const settled = await Round.findOne({ roundId: round.roundId });
  return stateFor(settled ?? round);
}

export async function currentState(token: string): Promise<PlayState> {
  const round = await roundForToken(token);
  const now = new Date();

  const status = playability(round, now);
  if (!status.playable) return stateFor(round);

  const unsolved = round.boards.find((board) => !board.solvedAt);
  return unsolved ? stateFor(round, puzzleFor(round, unsolved.index)) : stateFor(round);
}

export function assertKnownRound(round: RoundDocument | null, roundId: string): RoundDocument {
  if (!round) throw unknownRound(roundId);
  const title = findTitle(round.gameCode);
  if (!title) throw unknownRound(roundId);
  return round;
}
