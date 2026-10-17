import { loadConfig } from "../config";
import { pollResult, scoreForEntry } from "../games/volt-velocity/race-server";
import { VOLT_VELOCITY_CODE } from "../games/titles";
import { finishRound } from "../rounds/lifecycle";
import { Round, TERMINAL_STATUSES } from "../store/round.model";

/**
 * Volt Velocity's results: read from the race server, never from a browser.
 *
 * The race server simulates the race and signs a receipt when it ends. Each tick this asks it
 * about every room that still has an open round, verifies the signature (inside `pollResult`),
 * and closes each player's round with their own finishing time. From there the ordinary
 * delivery step reports it to the platform exactly as it reports a Circuit round.
 *
 * WHAT EACH ANSWER DOES
 * ---------------------
 *   running   - nothing; ask again next tick.
 *   final     - every open round in the room is closed. A finisher gets their time as the score;
 *               a DNF or a player who never connected closes with NO score (never zero - R50).
 *               A race the server CANCELLED is voided instead, which hands the attempt back:
 *               nobody raced, so nobody should lose an entry to it.
 *   missing   - the server has no such room. Rooms are created when the first player is seated,
 *               so after a short settling period this means the server lost it (a restart), and
 *               the rounds are voided with an error in the log for the operator.
 *   invalid   - a receipt that fails its signature is refused and logged; nothing is closed. The
 *               expiry fallback in `lifecycle.ts` ends those rounds, with no score, after the grace.
 *   error     - unreachable; retried next tick.
 */

/** How often one room is asked, however short the sweeper's own tick is. */
const POLL_EVERY_MS = 10_000;
/** A room younger than this that reads as missing is still being created, not lost. */
const MISSING_SETTLE_MS = 60_000;
/** Rooms handled per tick, so one tick stays bounded by the race server's 5 s timeout. */
const ROOMS_PER_TICK = 20;

export interface RaceSweepSummary {
  racesSettled: number;
  roundsClosed: number;
}

export async function sweepRaceResults(now = new Date()): Promise<RaceSweepSummary> {
  const summary: RaceSweepSummary = { racesSettled: 0, roundsClosed: 0 };
  const velocity = loadConfig().velocity;
  if (!velocity) return summary;

  const pollBefore = new Date(now.getTime() - POLL_EVERY_MS);
  const raceIds: string[] = await Round.distinct("race.raceId", {
    gameCode: VOLT_VELOCITY_CODE,
    status: { $nin: TERMINAL_STATUSES },
    "race.raceId": { $exists: true },
    $or: [{ "race.lastPolledAt": { $exists: false } }, { "race.lastPolledAt": { $lte: pollBefore } }],
  });

  for (const raceId of raceIds.slice(0, ROOMS_PER_TICK)) {
    const open = await Round.find({
      "race.raceId": raceId,
      status: { $nin: TERMINAL_STATUSES },
    });
    if (open.length === 0) continue;

    await Round.updateMany(
      { "race.raceId": raceId, status: { $nin: TERMINAL_STATUSES } },
      { $set: { "race.lastPolledAt": now } },
    );

    const poll = await pollResult(velocity, raceId);

    if (poll.kind === "running") continue;

    if (poll.kind === "error") {
      console.warn(`⚠️ [race-results] ${raceId}: race server unreachable - ${poll.detail}`);
      continue;
    }

    if (poll.kind === "invalid") {
      console.error(`❌ [race-results] ${raceId}: receipt refused - ${poll.detail}`);
      continue;
    }

    if (poll.kind === "missing") {
      const oldest = Math.min(...open.map((round) => round.createdAt.getTime()));
      if (now.getTime() - oldest < MISSING_SETTLE_MS) continue;
      console.error(
        `❌ [race-results] ${raceId}: the race server has no record of this room; ` +
          `voiding ${open.length} round(s) so their attempts are returned`,
      );
      for (const round of open) {
        const outcome = await finishRound(round.roundId, {
          status: "voided",
          reason: "The race server lost this race before it finished.",
          at: now,
        });
        if (outcome?.transitioned) summary.roundsClosed++;
      }
      continue;
    }

    const receipt = poll.receipt;
    const cancelled = receipt.status === "cancelled";
    for (const round of open) {
      const outcome = cancelled
        ? await finishRound(round.roundId, {
            status: "voided",
            reason: `The race was cancelled${receipt.cancelReason ? `: ${receipt.cancelReason}` : "."}`,
            at: now,
          })
        : await finishRound(round.roundId, {
            status: "completed",
            at: now,
            result: scoreForEntry(
              receipt.results.find((entry) => entry.playerId === round.providerRoundId),
            ),
          });
      if (outcome?.transitioned) summary.roundsClosed++;
    }
    summary.racesSettled++;
  }

  return summary;
}
