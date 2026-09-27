import { loadConfig } from "../config";
import { signTicket } from "../games/volt-velocity/race-server";
import { clientUrlFor } from "../http/volt-velocity-client";
import { ApiError } from "../http/errors";
import { Round, isTerminal, type RoundDocument } from "../store/round.model";
import { finishRound } from "./lifecycle";

/**
 * The Volt Velocity play session.
 *
 * WHAT "STARTING" MEANS HERE
 * --------------------------
 * For Circuit and Volt Stack, starting a round starts its clock. A race has no per-player clock:
 * the gun fires at `race.scheduledStartAt` for everybody, and the race server - not this
 * service - decides who finished and in what time. So this call only marks the round as opened
 * (`in_progress`, `startedAt` = when the player entered the lobby) and hands the browser what it
 * needs to take its seat: the room id, a signed ticket and where the client lives.
 *
 * The ticket is minted on every call rather than stored. It is a bearer credential for a seat,
 * so a stored copy is one more thing to leak; the race server accepts any ticket signed with
 * the shared secret, so a fresh one on a reconnect costs nothing.
 *
 * NO SCORE COMES BACK THROUGH HERE
 * -------------------------------
 * The result is read server-side from the race server's signed receipt by the result sweeper.
 * Nothing the browser sends can finish this round with a score.
 */

export interface VelocitySession {
  roundId: string;
  gameCode: string;
  status: RoundDocument["status"];
  parentOrigin?: string;
  returnUrl?: string;
  finished?: { status: RoundDocument["status"] };
  raceId?: string;
  trackId?: string;
  ticket?: string;
  scheduledStartAt?: string;
  /** Absent in production, where the page connects to `/race` on its own origin. */
  raceUrl?: string;
  clientUrl?: string;
}

function baseState(round: RoundDocument): VelocitySession {
  return {
    roundId: round.roundId,
    gameCode: round.gameCode,
    status: round.status,
    parentOrigin: round.parentOrigin,
    returnUrl: round.returnUrl,
  };
}

export async function startVelocitySession(
  round: RoundDocument,
  now: Date = new Date(),
): Promise<VelocitySession> {
  const velocity = loadConfig().velocity;
  if (!velocity) {
    throw new ApiError(503, "GAME_UNAVAILABLE", "Volt Velocity is not available right now.", false);
  }
  if (!round.race) {
    // Every velocity round is seated at creation; one without a room was created before this
    // wiring existed, or by hand, and there is no race for it to join.
    throw new ApiError(409, "ROUND_NOT_PLAYABLE", "This round has no race to join.");
  }

  if (isTerminal(round.status)) {
    return { ...baseState(round), finished: { status: round.status } };
  }

  if (round.expiresAt.getTime() <= now.getTime() && round.status === "created") {
    // Never opened, and the contest has closed: nothing was raced, so nothing is owed a score.
    await finishRound(round.roundId, { status: "expired", at: now });
    const settled = await Round.findOne({ roundId: round.roundId });
    const final = settled ?? round;
    return { ...baseState(final), finished: { status: final.status } };
  }

  if (round.status === "created") {
    // Conditional so two tabs opening at once record one `startedAt`, not the later one.
    await Round.updateOne(
      { roundId: round.roundId, status: "created" },
      { $set: { status: "in_progress", startedAt: now } },
    );
    round.status = "in_progress";
    round.startedAt = round.startedAt ?? now;
  }

  const clientUrl = clientUrlFor(velocity);
  if (!clientUrl) {
    throw new ApiError(
      503,
      "GAME_UNAVAILABLE",
      "The Volt Velocity race client is not installed on this server.",
      false,
    );
  }

  return {
    ...baseState(round),
    raceId: round.race.raceId,
    trackId: round.race.trackId,
    ticket: signTicket(velocity.ticketSecret, round.race.raceId, round.providerRoundId, now.getTime()),
    scheduledStartAt: round.race.scheduledStartAt?.toISOString(),
    raceUrl: velocity.publicRaceUrl,
    clientUrl,
  };
}
