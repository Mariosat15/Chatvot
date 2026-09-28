import { connectToDatabase } from "@/database/mongoose";
import GameRound, {
  canTransitionRound,
  LIVE_ROUND_STATUSES,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { createRound } from "./round.service";
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
 * Closes the caller's live practice rounds of one game, here and at the provider.
 *
 * PRACTICE KEEPS NO RESULT (owner, 28 Sep 2026: "no need to calculate any results just exit
 * ... after leave the practice game close the round"). So a round the player leaves is
 * `voided` - the status that means "this attempt produced nothing" - rather than scored, and
 * the provider is asked to void it too so it stops running there.
 *
 * It writes a STATUS, never a score, so it is not a second ingestion door - the same argument
 * as `endLiveRoundsForContest`. `resultSource` is left unset: no result came from anywhere.
 *
 * Every Start calls this first as well, because `createRound` is idempotent on the live round:
 * a round left open by a closed tab would otherwise be RESUMED instead of a new one opened.
 *
 * Scoped by `userId` (from the session), `gameKey`, `contestType: "practice"` and
 * `contestId: null`, so it can never touch another player's round or a paid contest's round.
 * The provider call is not awaited: the platform status is the answer, and a provider that is
 * slow or down must not hold the player on a spinner.
 */
export async function endLivePracticeRounds(
  userId: string,
  gameKey: string,
  roundId?: string,
): Promise<number> {
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
          if (!outcome.success) {
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

/** The player left a practice round. Idempotent: an already-closed round ends nothing. */
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
    // Reason: close any round left open (a closed tab), or `createRound` would resume it.
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
  limit = 5,
): Promise<PracticeRoundView[] | null> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return null;
  await connectToDatabase();
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
