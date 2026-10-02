/**
 * Volt Stack play path: start a timed round, accept verified locks, never a client score.
 */

import { stackRulesFor, copyFor } from "../games/content";
import { resolvePlayerLocale } from "../games/locale";
import {
  findTitle,
  roundDurationMs,
  VOLT_STACK_CODE,
  type RoundConfig,
} from "../games/titles";
import { parseStackLockInput } from "../games/scoring";
import { applyLock, createStackEngine, derivePieceSeed } from "../games/volt-stack/engine";
import type { StackLockInput } from "../games/volt-stack/scoring";
import { Round, isTerminal, type RoundDocument } from "../store/round.model";
import { ApiError } from "../http/errors";
import {
  finishRound,
  hardDeadline,
  heldUntil,
  holdFields,
  playability,
  playableSeconds,
  startAnchor,
} from "./lifecycle";
import { sendProgress } from "../callback/progress";
import type { PlayState } from "./play";

function contentSeedFor(round: { contentSeed?: string; providerRoundId: string }): string {
  return round.contentSeed ?? round.providerRoundId;
}

function pieceSeedFor(round: RoundDocument): string {
  return derivePieceSeed(contentSeedFor(round));
}

function isVoltStack(round: RoundDocument): boolean {
  return round.gameCode === VOLT_STACK_CODE;
}

function clientLocks(
  round: RoundDocument,
): NonNullable<PlayState["stackLocks"]> {
  const locks = round.stackLocks ?? [];
  if (locks.length === 0) return [];
  return locks.map((lock) => ({
    piece: lock.piece,
    rotation: lock.rotation,
    x: lock.x,
    y: lock.y,
    hardDropCells: lock.hardDropCells ?? 0,
    ...(lock.claimedSpin
      ? { claimedSpin: { tspin: Boolean(lock.claimedSpin.tspin), mini: Boolean(lock.claimedSpin.mini) } }
      : {}),
  }));
}

export function voltStackStateFor(round: RoundDocument): PlayState {
  const config = round.config as unknown as RoundConfig;
  const endsAt = round.startedAt ? hardDeadline(round) : null;
  const title = findTitle(round.gameCode);
  const locale = resolvePlayerLocale(round.locale, title?.locales ?? ["en"]);
  const copy = copyFor(round.gameCode, locale);
  const locks = clientLocks(round);

  const state: PlayState = {
    roundId: round.roundId,
    gameCode: round.gameCode,
    mode: round.mode,
    status: round.status,
    title: copy.displayName || title?.displayName || "Volt Stack",
    boardRules: stackRulesFor(locale),
    scoring: copy.rulesSummary || title?.rulesSummary || "",
    boardsSolved: locks.length,
    returnUrl: round.returnUrl,
    parentOrigin: round.parentOrigin,
    pieceSeed: pieceSeedFor(round),
    // Hold never changes the shared bag; the engine accepts the next or the held piece.
    holdDisabled: false,
    locksAccepted: locks.length,
    stackLocks: locks,
  };
  // Already in progress: the client rebuilds from locks and skips the fresh-start countdown.
  if (round.status === "in_progress") {
    state.resuming = true;
  }

  if (config.kind === "volt-stack") {
    state.durationSeconds = Math.floor(roundDurationMs(config) / 1000);
  }
  state.playableSeconds = playableSeconds(round);
  Object.assign(state, holdFields(round, new Date()));
  if (endsAt) state.endsAt = endsAt.toISOString();

  const status = playability(round, new Date());
  const over = isTerminal(round.status)
    ? round.status
    : (!status.playable && status.owes) || null;
  if (over) {
    state.finished = {
      status: over,
      boardsSolved: round.stackLocks?.length ?? 0,
    };
  }

  return state;
}

export async function startOrResumeVoltStack(
  round: RoundDocument,
  now: Date,
): Promise<PlayState> {
  const status = playability(round, now);
  if (!status.playable) {
    if (status.owes) await finishRound(round.roundId, { status: status.owes, at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return voltStackStateFor(settled ?? round);
  }

  // "Everyone at once": held until the gun, exactly as Circuit is (see `startOrResume`).
  if (heldUntil(round, now)) return voltStackStateFor(round);

  if (round.status === "created") {
    round.status = "in_progress";
    round.startedAt = startAnchor(round, now);
    round.boards = [];
    round.stackLocks = [];
    await round.save();
    const late = playability(round, now);
    if (!late.playable) {
      if (late.owes) await finishRound(round.roundId, { status: late.owes, at: now });
      const settled = await Round.findOne({ roundId: round.roundId });
      return voltStackStateFor(settled ?? round);
    }
  }

  return voltStackStateFor(round);
}

export interface StackLockOutcome {
  accepted: boolean;
  reason?: string;
  /** Server score so far — display only; settlement recomputes from stored locks. */
  provisionalScore?: number;
  state: PlayState;
}

/**
 * Record one lock. Reconstructs the engine from all prior locks + this one so a
 * tampered placement is refused before it is stored.
 */
export async function recordStackLock(
  token: string,
  body: unknown,
): Promise<StackLockOutcome> {
  const round = await Round.findOne({ launchToken: token });
  if (!round || token.length < 16) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid session.");
  }
  if (!isVoltStack(round)) {
    throw new ApiError(400, "INVALID_REQUEST", "This round is not a Volt Stack round.");
  }

  const now = new Date();
  const status = playability(round, now);
  if (!status.playable) {
    if (status.owes) await finishRound(round.roundId, { status: status.owes, at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    return {
      accepted: false,
      reason: "round_closed",
      state: voltStackStateFor(settled ?? round),
    };
  }

  // A lock sent before the gun is refused rather than starting the clock early: a client that
  // skipped the lobby must not be able to begin before everyone else.
  if (heldUntil(round, now)) {
    return { accepted: false, reason: "not_started", state: voltStackStateFor(round) };
  }

  if (round.status === "created") {
    round.status = "in_progress";
    round.startedAt = startAnchor(round, now);
    round.boards = [];
    round.stackLocks = [];
  }

  const parsed = parseStackLockInput(body);
  if (!parsed) {
    return {
      accepted: false,
      reason: "invalid_lock",
      state: voltStackStateFor(round),
    };
  }

  // Refuse an explicit client score if present — soft defence; we never read it anyway.
  if (body && typeof body === "object" && "score" in (body as object)) {
    return {
      accepted: false,
      reason: "client_score_refused",
      state: voltStackStateFor(round),
    };
  }

  const seed = pieceSeedFor(round);
  const engine = createStackEngine(seed);
  const prior = round.stackLocks ?? [];
  for (const lock of prior) {
    if (!isPieceTypeSafe(lock.piece)) {
      return {
        accepted: false,
        reason: "corrupt_history",
        state: voltStackStateFor(round),
      };
    }
    const priorInput: StackLockInput = {
      piece: lock.piece as StackLockInput["piece"],
      rotation: lock.rotation,
      x: lock.x,
      y: lock.y,
      hardDropCells: lock.hardDropCells,
      claimedSpin: lock.claimedSpin,
    };
    const step = applyLock(engine, priorInput);
    if (!step.ok) {
      return {
        accepted: false,
        reason: "corrupt_history",
        state: voltStackStateFor(round),
      };
    }
  }

  const next = applyLock(engine, parsed);
  if (!next.ok) {
    return {
      accepted: false,
      reason: next.reason,
      state: voltStackStateFor(round),
    };
  }

  round.stackLocks = [
    ...prior,
    {
      piece: parsed.piece,
      rotation: parsed.rotation,
      x: parsed.x,
      y: parsed.y,
      hardDropCells: parsed.hardDropCells ?? 0,
      claimedSpin: parsed.claimedSpin,
      at: now,
    },
  ];
  await round.save();

  void sendProgress(round);

  return {
    accepted: true,
    provisionalScore: engine.score,
    state: voltStackStateFor(round),
  };
}

function isPieceTypeSafe(value: string): boolean {
  return ["I", "J", "L", "O", "S", "T", "Z"].includes(value);
}

export { isVoltStack, pieceSeedFor };
