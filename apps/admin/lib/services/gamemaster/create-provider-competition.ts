/**
 * Game Master provider-contest construction (23 Sep 2026).
 *
 * Shared by both POST /api/gamemaster/competitions copies so the two routes cannot
 * disagree about which fields are required or how gameMasterId is stamped. Reuses the
 * admin create + publish services rather than a third insert path.
 */
import mongoose from "mongoose";
import type { CreateProviderContestResult } from "@/lib/services/game-providers/provider-contest.service";
import { createAndPublishProviderContest } from "@/lib/services/game-providers/provider-contest.service";
import { clampMinParticipants } from "@/lib/services/gamemaster/game-permissions";
import {
  gameMasterScheduleError,
  START_IN_PAST_TOLERANCE_MS,
} from "@/lib/services/gamemaster/contest-start-guard";
import { resolveGameMasterPlatformFeePercentage } from "@/lib/services/gamemaster/platform-fee";
import { notifyGmContestCreated } from "@/lib/services/gamemaster/gm-contest-notifications";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";
import {
  releaseUnusedFreePrivateReserve,
  reserveFreePrivateFunds,
  type ReserveResult,
} from "@/lib/services/gamemaster/free-private-reserve";
import type { GameTieRule } from "@/lib/services/games/game-tie-rule";
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
  // Intentionally not read — fee comes from resolveGameMasterPlatformFeePercentage.
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
  tieRule?: unknown;
  resultGracePeriodSeconds?: unknown;
  perRoundCostAcknowledged?: unknown;
}

export type GameMasterProviderCreateResult =
  | {
      ok: true;
      competitionId: string;
      slug?: string;
      warnings: string[];
      /** Credits moved into the reserve, when the contest is Game Master-funded. */
      fundingReserve?: number;
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
  /** Already checked against the package by the route (checkVisibilityAllowed). */
  visibility: "public" | "gm_private";
  /** Option keys that hold the admin's default rather than the Game Master's own choice. */
  adminFilled?: readonly string[];
  /** Already checked by the route (checkFundingAllowed). Absent = player-paid. */
  fundingMode?: FundingMode;
}): Promise<GameMasterProviderCreateResult> {
  const { body, userId, gameMasterName, maxUsersPerCompetition, visibility } = args;

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

  // Reason: a start behind the clock is a listed contest nobody can ever enter.
  const scheduleError = gameMasterScheduleError(
    startTime,
    endTime,
    new Date(),
    START_IN_PAST_TOLERANCE_MS,
  );
  if (scheduleError) return { ok: false, error: scheduleError };

  const effectiveMaxParticipants = Math.min(
    Math.floor(maxParticipantsRaw),
    maxUsersPerCompetition,
  );

  const playWindowStart =
    asDate(body.playWindowStart) ?? startTime;
  const playWindowEnd = asDate(body.playWindowEnd) ?? endTime;

  // Reason: never trust body.platformFeePercentage — a GM must not set platform fee.
  const platformFeePercentage = await resolveGameMasterPlatformFeePercentage();

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

  const funded = args.fundingMode === "gm_funded";
  let fundingReserve: number | undefined;

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
        // Reason: owner, 1 Oct 2026 - when nobody scores, the pot goes to the unclaimed pool.
        "unclaimed_pool",
      roundStartPolicy:
        (body.roundStartPolicy as RoundStartPolicy | undefined) ?? undefined,
      playMode: (body.playMode as PlayMode | undefined) ?? undefined,
      // Reason: the admin's play-style default covers every game, so a game that cannot be
      // run that way uses its own style instead of refusing a contest the GM never misconfigured.
      playModeIsPreference: args.adminFilled?.includes("playMode") ?? false,
      // The create service refuses anything that is not a game tie rule.
      tieRule: (body.tieRule as GameTieRule | undefined) ?? undefined,
      resultGracePeriodSeconds,
      perRoundCostAcknowledged: body.perRoundCostAcknowledged !== false,
      createdBy: userId,
      gameMasterId: userId,
      gameMasterName,
      visibility,
      fundingMode: funded ? "gm_funded" : "player_paid",
    }, funded
      ? {
          // Reason: the reserve is taken while the contest is still a draft, so no player
          // can ever see a funded contest whose places are not yet paid for.
          beforePublish: async (competitionId) => {
            const db = mongoose.connection.db;
            if (!db) return "Database connection failed";
            const session = await mongoose.startSession();
            try {
              let result: ReserveResult | undefined;
              await session.withTransaction(async () => {
                result = await reserveFreePrivateFunds(
                  db,
                  {
                    competitionId,
                    competitionName: name,
                    gameMasterUserId: userId,
                    entryFee,
                    maxParticipants: effectiveMaxParticipants,
                  },
                  session,
                );
              });
              if (!result?.ok) return result?.message ?? "Could not reserve the funds.";
              fundingReserve = result.reserve;
              return null;
            } finally {
              await session.endSession();
            }
          },
          onPublishFailed: async (competitionId) => {
            const db = mongoose.connection.db;
            if (!db) return;
            const session = await mongoose.startSession();
            try {
              await session.withTransaction(async () => {
                await releaseUnusedFreePrivateReserve(
                  db,
                  { competitionId, outcome: "cancelled" },
                  session,
                );
              });
            } finally {
              await session.endSession();
            }
          },
        }
      : undefined,
    );

  if (!created.success || !created.competitionId) {
    return {
      ok: false,
      error: created.error ?? "Could not create the contest.",
      errors: created.errors,
      warnings: created.warnings,
      competitionId: created.competitionId,
    };
  }

  void notifyGmContestCreated(
    {
      _id: created.competitionId,
      name,
      entryFee,
      startTime,
      visibility,
      fundingMode: funded ? "gm_funded" : "player_paid",
      gameMasterId: userId,
    },
    { reserve: fundingReserve },
  );

  return {
    ok: true,
    competitionId: created.competitionId,
    slug: created.slug,
    warnings: created.warnings ?? [],
    ...(fundingReserve !== undefined ? { fundingReserve } : {}),
  };
}
