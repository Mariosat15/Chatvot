/**
 * Game Master provider-contest construction (23 Sep 2026).
 *
 * Shared by both POST /api/gamemaster/competitions copies so the two routes cannot
 * disagree about which fields are required or how gameMasterId is stamped. Reuses the
 * admin create + publish services rather than a third insert path.
 */
import type { CreateProviderContestResult } from "@/lib/services/game-providers/provider-contest.service";
import { createAndPublishProviderContest } from "@/lib/services/game-providers/provider-contest.service";
import { clampMinParticipants } from "@/lib/services/gamemaster/game-permissions";
import type { PlayMode } from "@/lib/services/games/play-shape";
import type {
  AttemptsPolicy,
  RoundStartPolicy,
  UnresolvedRoundPolicy,
  UnscoredContestPolicy,
} from "@/lib/services/games/round-types";

export interface GameMasterProviderCreateBody {
  name?: unknown;
  description?: unknown;
  providerKey?: unknown;
  gameCode?: unknown;
  settings?: unknown;
  entryFee?: unknown;
  minParticipants?: unknown;
  maxParticipants?: unknown;
  platformFeePercentage?: unknown;
  prizeDistribution?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  playWindowStart?: unknown;
  playWindowEnd?: unknown;
  attemptsPolicy?: unknown;
  attemptsAllowed?: unknown;
  unresolvedRoundPolicy?: unknown;
  unscoredContestPolicy?: unknown;
  roundStartPolicy?: unknown;
  playMode?: unknown;
  resultGracePeriodSeconds?: unknown;
  perRoundCostAcknowledged?: unknown;
}

export type GameMasterProviderCreateResult =
  | {
      ok: true;
      competitionId: string;
      slug?: string;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      errors?: string[];
      warnings?: string[];
      /** Present when a draft was saved but publish failed. */
      competitionId?: string;
    };

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Build and publish a provider contest for a Game Master.
 *
 * `playWindowStart` / `playWindowEnd` default to the contest clock when omitted - the same
 * one-clock rule as the admin wizard (`deriveWindow`), so a GM who only sets start/end still
 * gets a playable window.
 */
export async function createGameMasterProviderCompetition(args: {
  body: GameMasterProviderCreateBody;
  userId: string;
  gameMasterName: string;
  maxUsersPerCompetition: number;
}): Promise<GameMasterProviderCreateResult> {
  const { body, userId, gameMasterName, maxUsersPerCompetition } = args;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const providerKey =
    typeof body.providerKey === "string" ? body.providerKey.trim() : "";
  const gameCode =
    typeof body.gameCode === "string" ? body.gameCode.trim() : "";

  if (!name || !description || !providerKey || !gameCode) {
    return {
      ok: false,
      error:
        "Name, description, provider and game are required for a game contest.",
    };
  }

  const entryFee = asNumber(body.entryFee);
  const maxParticipantsRaw = asNumber(body.maxParticipants);
  const startTime = asDate(body.startTime);
  const endTime = asDate(body.endTime);

  if (
    entryFee === null ||
    entryFee < 0 ||
    maxParticipantsRaw === null ||
    !startTime ||
    !endTime
  ) {
    return {
      ok: false,
      error: "Entry fee, participant limit, start time and end time are required.",
    };
  }

  const effectiveMaxParticipants = Math.min(
    Math.floor(maxParticipantsRaw),
    maxUsersPerCompetition,
  );

  const playWindowStart =
    asDate(body.playWindowStart) ?? startTime;
  const playWindowEnd = asDate(body.playWindowEnd) ?? endTime;

  const platformFeePercentage = asNumber(body.platformFeePercentage) ?? 10;

  const prizeDistribution = Array.isArray(body.prizeDistribution)
    ? (body.prizeDistribution as { rank: number; percentage: number }[])
    : [
        { rank: 1, percentage: 70 },
        { rank: 2, percentage: 20 },
        { rank: 3, percentage: 10 },
      ];

  const attemptsPolicy =
    (body.attemptsPolicy as AttemptsPolicy | undefined) ?? "single";
  const unresolvedRoundPolicy =
    (body.unresolvedRoundPolicy as UnresolvedRoundPolicy | undefined) ??
    "score_zero";
  const resultGracePeriodSeconds =
    asNumber(body.resultGracePeriodSeconds) ?? 900;

  const created: CreateProviderContestResult =
    await createAndPublishProviderContest({
      name,
      description,
      providerKey,
      gameCode,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as Record<string, unknown>)
          : {},
      entryFee,
      minParticipants: clampMinParticipants(body.minParticipants),
      maxParticipants: effectiveMaxParticipants,
      platformFeePercentage,
      prizeDistribution,
      startTime,
      endTime,
      playWindowStart,
      playWindowEnd,
      attemptsPolicy,
      attemptsAllowed:
        asNumber(body.attemptsAllowed) ?? undefined,
      unresolvedRoundPolicy,
      unscoredContestPolicy:
        (body.unscoredContestPolicy as UnscoredContestPolicy | undefined) ??
        "refund_entry_fees",
      roundStartPolicy:
        (body.roundStartPolicy as RoundStartPolicy | undefined) ?? undefined,
      playMode: (body.playMode as PlayMode | undefined) ?? undefined,
      resultGracePeriodSeconds,
      perRoundCostAcknowledged: body.perRoundCostAcknowledged !== false,
      createdBy: userId,
      gameMasterId: userId,
      gameMasterName,
    });

  if (!created.success || !created.competitionId) {
    return {
      ok: false,
      error: created.error ?? "Could not create the contest.",
      errors: created.errors,
      warnings: created.warnings,
      competitionId: created.competitionId,
    };
  }

  return {
    ok: true,
    competitionId: created.competitionId,
    slug: created.slug,
    warnings: created.warnings ?? [],
  };
}
