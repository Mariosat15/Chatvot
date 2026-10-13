import GameRound from "@/database/models/games/game-round.model";
import UserGameStats from "@/database/models/games/user-game-stats.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import {
  loadProviderSecrets,
  normaliseHeaders,
  checkTimestamp,
  verifyCallbackSignature,
  safeEqual,
} from "./callback-verification";

/**
 * Where each seated player stands on THIS game's leaderboard, so a race can order its grid.
 *
 * Added 13 October 2026 with skill-only Volt Velocity: the grid used to be a seeded shuffle, and
 * the owner asked for the players with the most points in that game at the front, then whoever
 * joined first. The game server asks, the platform answers, and the game server orders.
 *
 * READ-ONLY, and the points are SETTLED points: `UserGameStats.totalPoints` accumulates at
 * settlement (invariant 8), so a race still in progress cannot move anybody up its own grid.
 * Nothing here writes anything.
 *
 * WHAT A CALLER MAY LEARN, and why it is narrow. Only rounds this provider launched, only rounds
 * in ONE contest, and only players actually seated in it - so a provider holding valid
 * credentials cannot use this to read an arbitrary player's points. The reply carries round ids,
 * never user ids or names.
 *
 * NOT MIRRORED, for the same reason as `round-progress.service.ts`: the admin app launches no
 * rounds and would only ever be a second copy agreeing with the first while nothing called it.
 */

/** The most rounds one request may ask about. Matches the largest race (16 pilots). */
export const MAX_STANDINGS_ROUNDS = 16;

export type StandingsResult =
  | "answered"
  | "provider_unknown"
  | "signature_invalid"
  | "timestamp_rejected"
  | "unparseable"
  | "rounds_invalid";

export interface StandingLine {
  roundId: string;
  points: number;
  /** 1-based place on this game's board among the asked players; absent with no points. */
  rank?: number;
  joinedAt?: string;
}

export interface StandingsOutcome {
  accepted: boolean;
  result: StandingsResult;
  message: string;
  standings?: StandingLine[];
}

function refuse(result: StandingsResult, message: string): StandingsOutcome {
  return { accepted: false, result, message };
}

/**
 * The pure half: one line per round, in the order asked.
 *
 * Points that are not a positive finite number read as 0 and carry no rank - a player who has
 * never scored is not "last place", they are unranked, and the game orders them by join time.
 * Ties share a rank, so two pilots on equal points are told the same place.
 */
export function buildStandings(
  rounds: { roundId: string; userId: string }[],
  pointsByUser: Map<string, number>,
  joinedByUser: Map<string, Date>,
): StandingLine[] {
  const pointsOf = (userId: string) => {
    const p = pointsByUser.get(userId);
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : 0;
  };
  const scored = [...new Set(rounds.map((r) => pointsOf(r.userId)).filter((p) => p > 0))].sort(
    (a, b) => b - a,
  );
  return rounds.map((r) => {
    const points = pointsOf(r.userId);
    const joined = joinedByUser.get(r.userId);
    const line: StandingLine = { roundId: r.roundId, points };
    if (points > 0) line.rank = scored.indexOf(points) + 1;
    if (joined instanceof Date && !Number.isNaN(joined.getTime())) line.joinedAt = joined.toISOString();
    return line;
  });
}

/** Reads the asked ids, refusing anything that is not a short list of distinct strings. */
export function parseRoundIds(body: unknown): string[] | null {
  const ids = (body as { roundIds?: unknown } | null)?.roundIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_STANDINGS_ROUNDS) return null;
  if (!ids.every((id) => typeof id === "string" && id.trim().length > 0 && id.length <= 128)) return null;
  const trimmed = (ids as string[]).map((id) => id.trim());
  return new Set(trimmed).size === trimmed.length ? trimmed : null;
}

export async function answerRoundStandings(input: {
  providerKey: string;
  rawBody: string;
  headers: Record<string, string>;
}): Promise<StandingsOutcome> {
  const { providerKey, rawBody } = input;
  const headers = normaliseHeaders(input.headers);

  // The same four gates, in the same order, as the result and progress callbacks.
  const secrets = await loadProviderSecrets(providerKey);
  if (!secrets?.callbackToken) return refuse("provider_unknown", "Unknown provider.");

  const offered = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!offered || !safeEqual(offered, secrets.callbackToken)) {
    return refuse("signature_invalid", "Callback credentials were refused.");
  }

  const timestamp = checkTimestamp(headers.get("x-timestamp"));
  if (!timestamp.valid) return refuse("timestamp_rejected", timestamp.reason);

  const signature = headers.get("x-signature") ?? "";
  if (!signature || !verifyCallbackSignature(rawBody, signature, secrets)) {
    return refuse("signature_invalid", "Callback credentials were refused.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return refuse("unparseable", "Body was not valid JSON.");
  }
  const roundIds = parseRoundIds(parsed);
  if (!roundIds) {
    return refuse("rounds_invalid", `roundIds must be 1-${MAX_STANDINGS_ROUNDS} distinct round ids.`);
  }

  const rounds = await GameRound.find({ roundId: { $in: roundIds }, providerKey })
    .select("roundId userId gameKey contestType contestId")
    .lean<{ roundId: string; userId: string; gameKey: string; contestType: string; contestId?: unknown }[]>();

  // Every asked round must exist, belong to this provider, and share ONE contest and ONE game.
  // Reason this is all-or-nothing: a partial answer would let a caller mix a round from another
  // contest into an otherwise legitimate request and read that player's points.
  if (rounds.length !== roundIds.length) return refuse("rounds_invalid", "Unknown round.");
  const first = rounds[0];
  const contestId = first.contestId ? String(first.contestId) : "";
  if (
    !contestId ||
    (first.contestType !== "competition" && first.contestType !== "challenge") ||
    rounds.some(
      (r) =>
        String(r.contestId ?? "") !== contestId ||
        r.gameKey !== first.gameKey ||
        r.contestType !== first.contestType,
    )
  ) {
    return refuse("rounds_invalid", "Rounds must belong to one contest and one game.");
  }

  const userIds = [...new Set(rounds.map((r) => r.userId))];
  const joinedByUser = new Map<string, Date>();
  if (first.contestType === "competition") {
    const seats = await CompetitionParticipant.find({ competitionId: contestId, userId: { $in: userIds } })
      .select("userId enteredAt")
      .lean<{ userId: string; enteredAt?: Date }[]>();
    for (const s of seats) if (s.enteredAt) joinedByUser.set(String(s.userId), new Date(s.enteredAt));
    if (new Set(seats.map((s) => String(s.userId))).size !== userIds.length) {
      return refuse("rounds_invalid", "A round belongs to a player with no seat in this contest.");
    }
  } else {
    const seats = await ChallengeParticipant.find({ challengeId: contestId, userId: { $in: userIds } })
      .select("userId joinedAt")
      .lean<{ userId: string; joinedAt?: Date }[]>();
    for (const s of seats) if (s.joinedAt) joinedByUser.set(String(s.userId), new Date(s.joinedAt));
    if (new Set(seats.map((s) => String(s.userId))).size !== userIds.length) {
      return refuse("rounds_invalid", "A round belongs to a player with no seat in this contest.");
    }
  }

  const stats = await UserGameStats.find({ gameKey: first.gameKey, userId: { $in: userIds } })
    .select("userId totalPoints")
    .lean<{ userId: string; totalPoints?: number }[]>();
  const pointsByUser = new Map<string, number>();
  for (const s of stats) pointsByUser.set(String(s.userId), Number(s.totalPoints ?? 0));

  const byId = new Map(rounds.map((r) => [r.roundId, r]));
  const ordered = roundIds.map((id) => byId.get(id)!).map((r) => ({ roundId: r.roundId, userId: r.userId }));

  return {
    accepted: true,
    result: "answered",
    message: "Standings answered.",
    standings: buildStandings(ordered, pointsByUser, joinedByUser),
  };
}
