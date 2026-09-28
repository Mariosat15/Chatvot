/**
 * Seating a Volt Velocity player at round creation - the one place `create.ts` learns anything
 * about racing, kept here so that file stays about the protocol rather than about one title.
 *
 * ERROR MAPPING, AND WHY THERE ARE NO NEW ERROR CODES
 * ---------------------------------------------------
 * Chapter 23's first sketch returned `RACE_FULL` / `RACE_CLOSED`. The provider specification's
 * error table is a closed set the platform branches on, so a new code is a protocol change and a
 * version bump, not a local choice. The existing codes already say the right thing:
 *
 *  - full, or entry closed -> 400 `INVALID_REQUEST`. Permanent for this round, and section 11
 *    says a failed creation consumes no attempt, which is exactly the promise a full race needs.
 *  - race server unreachable -> 503 `GAME_UNAVAILABLE`, retryable. The request is fine; the
 *    dependency is not. A retry a few seconds later is the right answer.
 *  - race server refused the spec for another reason -> 500 `INTERNAL`, not retryable, because
 *    that is our bug and retrying it produces the same refusal.
 */

import { loadConfig, type VelocityConfig } from "../../config";
import { ApiError, badRequest } from "../../http/errors";
import { lapsOf, VELOCITY_SECONDS_PER_LAP, type VoltVelocityConfig } from "./title";
import {
  MAX_SCHEDULE_AHEAD_MS,
  raceIdentity,
  racerName,
  seatPlayer,
  type RaceIdentity,
} from "./race-server";

export interface VelocitySeat {
  identity: RaceIdentity;
  scheduledStartAt?: Date;
}

/** The race server's configuration, or the refusal a deployment without it must give. */
export function requireVelocityConfig(): VelocityConfig {
  const velocity = loadConfig().velocity;
  if (!velocity) {
    throw new ApiError(
      503,
      "GAME_UNAVAILABLE",
      "Volt Velocity is not available on this deployment (no race server is configured).",
      false,
    );
  }
  return velocity;
}

/**
 * `scheduledStartAt` is optional on the create request.
 *
 * Present on a scheduled competition: every player's round carries the same instant. From that
 * instant the race server starts a 10 s countdown as soon as at least two pilots have pressed
 * Launch, and a pilot who arrives later may still join the running race (owner, 28 Sep 2026;
 * the earlier "green at the instant whether or not anybody is Ready" rule is gone). Absent on a
 * challenge, which has no clock of its own and starts when both players are Ready.
 *
 * It must fall before the round's `expiresAt` - a race that starts after the round has expired
 * could never be scored - and within the race server's six-hour horizon, which it enforces too;
 * checking here turns its bare 400 into a message that names the field.
 */
export function parseScheduledStart(value: unknown, expiresAt: Date, now: Date): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest("'scheduledStartAt' must be an ISO 8601 timestamp when present.");
  }
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest("'scheduledStartAt' is not a valid ISO 8601 timestamp.");
  }
  if (parsed.getTime() >= expiresAt.getTime()) {
    throw badRequest("'scheduledStartAt' must be before 'expiresAt'.");
  }
  if (parsed.getTime() > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    throw badRequest("'scheduledStartAt' may be at most six hours ahead.");
  }
  return parsed;
}

/** The race server's 10 s gun countdown on a scheduled race, plus a margin for the result to arrive. */
const START_COUNTDOWN_AND_MARGIN_MS = 10_000 + 30_000;

/**
 * The last moment a scheduled room may still go green (owner rule, 28 Sep 2026).
 *
 * A scheduled race no longer fires at the start time regardless: it waits until at least two
 * pilots have picked a ship and pressed Launch. It cannot wait for ever, though - the race must
 * still END before this round expires, or the round can never be scored. So the room is told
 * the latest start that leaves a full-length race (laps x 100 s) and the countdown inside the
 * round. Never before the scheduled start itself, and never past the race server's horizon.
 *
 * `startWaitSeconds` is the platform's waiting limit for the contest (HTML v1.24): past it with
 * fewer than two pilots Ready, the platform cancels the competition and refunds everyone, so
 * the room must give up at the same moment rather than keep a lone pilot waiting for a race
 * that has already been refunded. Absent means no limit beyond the round itself.
 */
export function latestRaceStart(
  scheduledStartAt: Date,
  expiresAt: Date,
  laps: number,
  startWaitSeconds?: number,
): Date {
  const raceMs = laps * VELOCITY_SECONDS_PER_LAP * 1000;
  const latest = expiresAt.getTime() - raceMs - START_COUNTDOWN_AND_MARGIN_MS;
  const waitCap =
    startWaitSeconds === undefined
      ? Number.POSITIVE_INFINITY
      : scheduledStartAt.getTime() + startWaitSeconds * 1000;
  const bounded = Math.min(latest, scheduledStartAt.getTime() + MAX_SCHEDULE_AHEAD_MS, waitCap);
  return new Date(Math.max(scheduledStartAt.getTime(), bounded));
}

/** The platform's permitted waiting limits, in seconds (HTML v1.24). */
export const MIN_START_WAIT_SECONDS = 60;
export const MAX_START_WAIT_SECONDS = 900;

/**
 * `startWaitSeconds` is optional, and meaningful only beside `scheduledStartAt`. A value outside
 * the permitted range is refused rather than clamped: a clamped limit is a deadline the platform
 * never chose, and the two sides would then cancel at different moments.
 */
export function parseStartWait(value: unknown, scheduledStartAt: Date | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_START_WAIT_SECONDS ||
    value > MAX_START_WAIT_SECONDS
  ) {
    throw badRequest("'startWaitSeconds' must be a whole number of seconds from 60 to 900.");
  }
  if (!scheduledStartAt) {
    throw badRequest("'startWaitSeconds' is only valid with 'scheduledStartAt'.");
  }
  return value;
}

/**
 * Register this player with the race room BEFORE the round is written.
 *
 * The player's race id is the `providerRoundId`, never the platform's `playerId`: the race
 * server's result lines are keyed by it, and a round is the thing being scored. It also keeps a
 * platform user id out of a second process's archive files.
 */
export async function seatVelocityPlayer(
  gameCode: string,
  contentSeed: string,
  config: VoltVelocityConfig,
  scheduledStartAt: Date | undefined,
  providerRoundId: string,
  displayName: string | undefined,
  expiresAt: Date,
  soloRoundId?: string,
  startWaitSeconds?: number,
): Promise<VelocitySeat> {
  const velocity = requireVelocityConfig();
  const laps = lapsOf(config);
  const latestStartAt = scheduledStartAt
    ? latestRaceStart(scheduledStartAt, expiresAt, laps, startWaitSeconds)
    : undefined;
  const identity = raceIdentity(
    gameCode,
    contentSeed,
    config.trackId,
    scheduledStartAt,
    laps,
    soloRoundId,
  );
  const outcome = await seatPlayer(
    velocity,
    identity,
    { id: providerRoundId, name: racerName(displayName) },
    scheduledStartAt,
    { laps, solo: soloRoundId !== undefined, latestStartAt },
  );
  if (outcome.ok) return { identity, scheduledStartAt };

  switch (outcome.reason) {
    case "race_full":
      throw badRequest("This race is full (16 pilots).");
    case "race_closed":
      throw badRequest("Entry to this race has closed.");
    case "unreachable":
      console.warn(`⚠️ [velocity] race server unreachable: ${outcome.detail}`);
      throw new ApiError(503, "GAME_UNAVAILABLE", "The race server is not responding.", true);
    default:
      console.error(`❌ [velocity] race server refused room ${identity.raceId}: ${outcome.detail}`);
      throw new ApiError(500, "INTERNAL", "The race server refused the race.", false);
  }
}
