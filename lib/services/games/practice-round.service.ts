import { connectToDatabase } from "@/database/mongoose";
import GameRound, {
  canTransitionRound,
  LIVE_ROUND_STATUSES,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { createRound } from "./round.service";
import { applyResult } from "./result-ingestion.service";
import {
  defaultConfigValues,
  parseConfigSchema,
  resolveAttemptSecondsFromSchema,
} from "./config-schema";
import { publicBaseUrl } from "./public-base-url";
import { getBrowsableGameBySlug } from "./player-catalogue.service";
import {
  SCORE_PRODUCING_ROUND_STATUSES,
  type CreateRoundRefusal,
} from "./round-types";
import type { PracticeRoundView } from "@/components/games/practice-state";

/**
 * Practice for EVERY game in the catalogue - free, solo, unranked and prize-less.
 *
 * NOTHING HERE NAMES A GAME. A title is practisable when the catalogue says so
 * (`supportsPractice`, declared by the provider on the catalogue row) and it is enabled and
 * active; the settings come from the title's own `configSchema` defaults and the length from
 * its own ceiling. So a new title added to the catalogue gets a practice area with no code.
 *
 * WHY THERE IS NO CONTEST. A practice round has `contestId: null` and `contestType:
 * "practice"`, which is what keeps it out of every money and ranking path: ingestion writes
 * no participant score for it, settlement never sees it, and stats/XP are only awarded at
 * settlement. That is also why it cannot improve a paid score - it is not attached to one.
 *
 * WHY THE WINDOW IS SYNTHETIC. `createRound` bounds every round by a play window. Practice
 * has none, so it passes one that is just long enough for the title's own ceiling plus the
 * expiry headroom, with `until_window_closes` so no reservation arithmetic can refuse it.
 *
 * LAUNCHING IS A POST, NEVER A GET. Creating a round asks the provider to open one; a page
 * render or a prefetch must never do that. The page reads availability, the button launches.
 */

/** Longer than `round.service.ts`'s 120s expiry headroom, so the window never clips expiry. */
const PRACTICE_WINDOW_SLACK_SECONDS = 300;
/** Used only when a title declares no ceiling at all. */
const FALLBACK_PRACTICE_SECONDS = 600;
/** Cap how many live practice rounds one pull pass will ask the provider about. */
const PRACTICE_PULL_LIMIT = 3;
/** Recent practice history shown on the practice page. */
export const PRACTICE_HISTORY_LIMIT = 5;

export type PracticeRefusal =
  | "not_found"
  | "practice_unsupported"
  | "title_unavailable"
  | "misconfigured"
  | CreateRoundRefusal
  | "failed";

export type PracticeLaunchOutcome =
  | { success: true; roundId: string; launchUrl: string; resumed: boolean }
  | { success: false; refusal: PracticeRefusal; error: string };

export interface PracticeActor {
  userId: string;
  /** Shown to the provider. Never an email - a provider receives no identifying data. */
  displayName?: string;
}

interface PracticeTitle {
  providerKey: string;
  gameCode: string;
  gameKey: string;
  displayName?: string;
  maxDurationSeconds?: number;
  configSchema?: unknown;
  scoreType?: string;
  chartvoltEnabled?: boolean;
  providerStatus?: string;
  supportsPractice?: boolean;
}

export type PracticeAvailability =
  | { available: true; gameName: string; scoreType?: string }
  | { available: false; gameName: string; reason: string };

type TitleLookup =
  | { ok: true; title: PracticeTitle; gameName: string }
  | { ok: false; refusal: PracticeRefusal; error: string; gameName: string };

const TRADING_UNSUPPORTED =
  "Trading does not have a practice area yet. Trading is only played inside competitions.";

/** The game often finishes a beat before the host asks to void it. That is success, not a fault. */
function practiceAlreadyClosedAtProvider(error: string | undefined): boolean {
  return typeof error === "string" && /already finished as .+ and cannot be voided/i.test(error);
}

async function lookUpPracticeTitle(slug: string): Promise<TitleLookup> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) {
    return { ok: false, refusal: "not_found", error: "Game not found.", gameName: slug };
  }
  const gameName = card.displayName;

  if (card.kind === "trading" || !card.providerKey || !card.gameCode) {
    return { ok: false, refusal: "practice_unsupported", error: TRADING_UNSUPPORTED, gameName };
  }
  if (card.comingSoon) {
    return {
      ok: false,
      refusal: "title_unavailable",
      error: "This game is coming soon. Practice opens when it launches.",
      gameName,
    };
  }

  await connectToDatabase();
  const title = await ProviderGame.findOne({ gameKey: card.gameKey })
    .select(
      "providerKey gameCode gameKey displayName maxDurationSeconds configSchema scoreType chartvoltEnabled providerStatus supportsPractice",
    )
    .lean<PracticeTitle | null>();

  if (!title || !title.chartvoltEnabled || title.providerStatus !== "active") {
    return {
      ok: false,
      refusal: "title_unavailable",
      error: "This game is paused right now. Please try again later.",
      gameName,
    };
  }
  if (!title.supportsPractice) {
    return {
      ok: false,
      refusal: "practice_unsupported",
      error: `The provider of ${gameName} does not offer practice rounds.`,
      gameName,
    };
  }
  return { ok: true, title, gameName };
}

/**
 * Pulls the provider's result for the caller's live practice rounds of one game.
 *
 * A provider never pushes a practice result (requirements v1.10, `01` s4.2), so the host asks
 * when the frame posts `finished`. It goes through `applyResult`, the single ingestion door.
 * A round still in play reports a live status, which gate 8 refuses without writing.
 *
 * Owner reversed the 28 Sep "keep no result" rule on 6 Oct 2026: practice must show the score
 * and keep the last five rounds. Failures are swallowed - this only refreshes a practice screen.
 */
export async function pullLivePracticeResults(
  userId: string,
  gameKey: string,
  roundId?: string,
): Promise<void> {
  const live = await GameRound.find({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey,
    status: { $in: LIVE_ROUND_STATUSES },
    ...(roundId ? { roundId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(roundId ? 1 : PRACTICE_PULL_LIMIT)
    .select("roundId providerKey")
    .lean<Array<{ roundId: string; providerKey: string }>>();

  for (const round of live) {
    try {
      const adapter = getProviderAdapter(round.providerKey);
      if (!adapter) continue;
      const pulled = await adapter.fetchRound(round.roundId);
      if (!pulled.success) continue;
      await applyResult({
        providerKey: round.providerKey,
        normalised: pulled.data,
        source: "poll",
      });
    } catch (error) {
      console.warn(`⚠️ Could not refresh practice round ${round.roundId}:`, error);
    }
  }
}

/**
 * Closes the caller's still-live practice rounds of one game, here and at the provider.
 *
 * Used when the player leaves mid-round (or closes the tab) BEFORE a result is pulled.
 * A finished practice round is scored by `pullLivePracticeResults` and must NOT be voided -
 * voiding would wipe the score the practice page exists to show (owner, 6 Oct 2026).
 *
 * It writes a STATUS, never a score, so it is not a second ingestion door. Every Start also
 * calls this first, because `createRound` is idempotent on the live round: a round left open
 * by a closed tab would otherwise be RESUMED instead of a new one opened.
 *
 * Scoped by `userId`, `gameKey`, `contestType: "practice"` and `contestId: null`. The provider
 * call is not awaited: the platform status is the answer.
 */
export async function endLivePracticeRounds(
  userId: string,
  gameKey: string,
  roundId?: string,
): Promise<number> {
  // Reason: only LIVE statuses. A completed practice row is history the player can delete
  // deliberately; rewriting it to voided on leave was the defect that emptied the list.
  const live = await GameRound.find({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey,
    status: { $in: LIVE_ROUND_STATUSES },
    ...(roundId ? { roundId } : {}),
  });

  let ended = 0;
  for (const round of live) {
    if (!canTransitionRound(round.status as RoundStatus, "voided")) continue;
    round.status = "voided";
    round.resultReceivedAt = new Date();
    await round.save();
    ended += 1;

    const adapter = getProviderAdapter(round.providerKey);
    if (adapter) {
      void adapter
        .voidRound(round.roundId)
        .then((outcome) => {
          if (!outcome.success && !practiceAlreadyClosedAtProvider(outcome.error)) {
            console.warn(
              `⚠️ Provider did not void practice round ${round.roundId}: ${outcome.error}`,
            );
          }
        })
        .catch((error) =>
          console.warn(`⚠️ Could not void practice round ${round.roundId}:`, error),
        );
    }
  }
  return ended;
}

/** The player left a practice round mid-play. Idempotent: an already-closed round ends nothing. */
export async function endPracticeRound(
  slug: string,
  userId: string,
  roundId: string,
): Promise<{ found: boolean; ended: number }> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return { found: false, ended: 0 };
  await connectToDatabase();
  return { found: true, ended: await endLivePracticeRounds(userId, card.gameKey, roundId) };
}

/**
 * The frame posted `finished`: pull the provider score for this one practice round.
 * Returns the updated view so the host can refresh the recent list without a second GET.
 */
export async function finishPracticeRound(
  slug: string,
  userId: string,
  roundId: string,
): Promise<{ found: boolean; round: PracticeRoundView | null }> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return { found: false, round: null };
  await connectToDatabase();
  await pullLivePracticeResults(userId, card.gameKey, roundId);
  const stored = await GameRound.findOne({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey: card.gameKey,
    roundId,
  })
    .select("roundId status rawScore scoreBreakdown completedAt")
    .lean<StoredPracticeRound | null>();
  return { found: true, round: stored ? toView(stored) : null };
}

/**
 * Deletes one of the caller's own practice history rows. Refuses a still-live round - end it
 * first - so a mid-play DELETE cannot erase an open attempt without voiding it.
 */
export async function deletePracticeRound(
  slug: string,
  userId: string,
  roundId: string,
): Promise<{ found: boolean; deleted: boolean; reason?: string }> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return { found: false, deleted: false };
  await connectToDatabase();
  const round = await GameRound.findOne({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey: card.gameKey,
    roundId,
  }).select("status");
  if (!round) return { found: true, deleted: false, reason: "Round not found." };
  if ((LIVE_ROUND_STATUSES as readonly string[]).includes(round.status)) {
    return {
      found: true,
      deleted: false,
      reason: "Leave the round before deleting it from your history.",
    };
  }
  await GameRound.deleteOne({ _id: round._id });
  return { found: true, deleted: true };
}

/** Clears every non-live practice history row for this game and player. Live rounds stay. */
export async function clearPracticeRounds(
  slug: string,
  userId: string,
): Promise<{ found: boolean; deleted: number }> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return { found: false, deleted: 0 };
  await connectToDatabase();
  const result = await GameRound.deleteMany({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey: card.gameKey,
    status: { $nin: LIVE_ROUND_STATUSES },
  });
  return { found: true, deleted: result.deletedCount ?? 0 };
}

/** Read-only: whether the practice area can start a round. Safe to call from a page render. */
export async function getPracticeAvailability(slug: string): Promise<PracticeAvailability | null> {
  const lookup = await lookUpPracticeTitle(slug);
  if (!lookup.ok) {
    if (lookup.refusal === "not_found") return null;
    return { available: false, gameName: lookup.gameName, reason: lookup.error };
  }
  return { available: true, gameName: lookup.gameName, scoreType: lookup.title.scoreType };
}

export async function launchPracticeRound(
  slug: string,
  actor: PracticeActor,
): Promise<PracticeLaunchOutcome> {
  const baseUrl = publicBaseUrl();
  if (!baseUrl) {
    console.error(
      `❌ NEXT_PUBLIC_BASE_URL is unusable as a provider result callback, so no practice round can be launched. ` +
        `Current value: ${process.env.NEXT_PUBLIC_BASE_URL ?? "(unset)"}`,
    );
    return {
      success: false,
      refusal: "misconfigured",
      error: "This game is temporarily unavailable. Please try again later.",
    };
  }

  try {
    const lookup = await lookUpPracticeTitle(slug);
    if (!lookup.ok) return { success: false, refusal: lookup.refusal, error: lookup.error };
    const { title } = lookup;
    // Reason: settle a finished leftover first, then void anything still live, or
    // `createRound` would resume a stale launched round from a closed tab.
    await pullLivePracticeResults(actor.userId, title.gameKey);
    await endLivePracticeRounds(actor.userId, title.gameKey);

    const parsed = parseConfigSchema(title.configSchema);
    const settings = parsed.ok ? defaultConfigValues(parsed.fields) : {};
    const attemptSeconds = resolveAttemptSecondsFromSchema(
      title.configSchema,
      settings,
      title.maxDurationSeconds,
    );
    const ceiling = title.maxDurationSeconds ?? attemptSeconds ?? FALLBACK_PRACTICE_SECONDS;
    const playWindowEnd = new Date(
      Date.now() + (ceiling + PRACTICE_WINDOW_SLACK_SECONDS) * 1000,
    );

    const outcome = await createRound({
      providerKey: title.providerKey,
      gameCode: title.gameCode,
      gameKey: title.gameKey,
      userId: actor.userId,
      contestType: "practice",
      contestId: null,
      participantId: null,
      config: {
        attemptsPolicy: "single",
        playWindowEnd,
        roundStartPolicy: "until_window_closes",
        maxDurationSeconds: title.maxDurationSeconds,
        attemptSeconds,
        settings,
      },
      returnUrl: `${baseUrl}/games/${encodeURIComponent(slug)}/practice`,
      parentOrigin: new URL(baseUrl).origin,
      resultCallbackUrl: `${baseUrl}/api/games/providers/${title.providerKey}/events`,
      progressCallbackUrl: `${baseUrl}/api/games/providers/${title.providerKey}/progress`,
      displayName: actor.displayName,
    });

    if (!outcome.success) {
      return { success: false, refusal: outcome.refusal, error: outcome.error };
    }
    return {
      success: true,
      roundId: outcome.roundId,
      launchUrl: outcome.launchUrl,
      resumed: outcome.idempotent,
    };
  } catch (error) {
    console.error("❌ Failed to launch practice round:", error);
    return {
      success: false,
      refusal: "failed",
      error: "Something went wrong. Please contact support.",
    };
  }
}

export type { PracticeRoundView };

interface StoredPracticeRound {
  roundId: string;
  status: string;
  rawScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  completedAt?: Date;
}

const SCORING = new Set<string>(SCORE_PRODUCING_ROUND_STATUSES);

function toView(round: StoredPracticeRound): PracticeRoundView {
  return {
    roundId: round.roundId,
    status: round.status,
    isLive: (LIVE_ROUND_STATUSES as readonly string[]).includes(round.status),
    score:
      SCORING.has(round.status) && typeof round.rawScore === "number"
        ? round.rawScore
        : undefined,
    scoreBreakdown: round.scoreBreakdown,
    completedAt: round.completedAt?.toISOString(),
  };
}

/**
 * The caller's own recent practice rounds of one game, newest first.
 *
 * Scoped by `userId` from the session and by `gameKey`, so a player can never read another
 * player's rounds and a round of one game never appears in another game's practice area.
 */
export async function listPracticeRounds(
  slug: string,
  userId: string,
  limit = PRACTICE_HISTORY_LIMIT,
): Promise<PracticeRoundView[] | null> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return null;
  await connectToDatabase();
  // Reason: pull before reading so a finished round the host has not yet PATCHed still
  // shows a score when the player reloads the practice page.
  await pullLivePracticeResults(userId, card.gameKey);
  const rounds = await GameRound.find({
    contestType: "practice",
    contestId: null,
    userId,
    gameKey: card.gameKey,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("roundId status rawScore scoreBreakdown completedAt")
    .lean<StoredPracticeRound[]>();
  return rounds.map(toView);
}
