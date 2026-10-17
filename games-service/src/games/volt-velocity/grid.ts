import { signOutbound } from "../../http/inbound-auth";
import { Round } from "../../store/round.model";
import { requireVelocityConfig } from "./launch";
import { pushGridOrder } from "./race-server";

/**
 * Starting grid for a shared Volt Velocity race (owner, 13 Oct 2026, after the legal opinion).
 *
 * A paid race's grid used to be a seeded shuffle, which made a skill contest's starting position
 * a matter of luck. It is now set by the platform's own leaderboard: highest settled Volt Velocity
 * points on pole, then everyone without points by when they joined, earliest first.
 *
 * Only the PLATFORM knows a player's points, so the game asks it: a signed POST of the seated
 * round ids to the round's `standingsUrl`, with the same credentials the result callback uses. The
 * points are settled results only, so a race in progress can never move anybody up its own grid.
 *
 * Everything here is best effort. If the platform does not answer, the room keeps the order the
 * pilots registered in, which is join order - the documented fallback - and the failure is logged.
 */

const STANDINGS_TIMEOUT_MS = 3_000;

export interface Standing {
  roundId: string;
  points: number;
  /** ISO time the player joined the contest; absent when the platform does not know it. */
  joinedAt?: string;
}

export interface SeatedRound {
  roundId: string;
  providerRoundId: string;
}

/**
 * Pure: the race ids in grid order. Points descending, then joinedAt ascending, then the order the
 * pilots registered with the race (the stable tie-break, and the whole order when nobody answers).
 * A round the platform did not mention is treated as 0 points, unknown join time.
 */
export function orderGrid(seated: SeatedRound[], standings: Standing[]): string[] {
  const byRound = new Map(standings.map((s) => [s.roundId, s]));
  const keyed = seated.map((round, index) => {
    const s = byRound.get(round.roundId);
    const points = s && Number.isFinite(s.points) && s.points > 0 ? s.points : 0;
    const joined = s?.joinedAt ? Date.parse(s.joinedAt) : NaN;
    return { id: round.providerRoundId, points, joined: Number.isFinite(joined) ? joined : Infinity, index };
  });
  keyed.sort((a, b) => b.points - a.points || a.joined - b.joined || a.index - b.index);
  return keyed.map((k) => k.id);
}

/** Parse the platform's reply, keeping only well-formed lines. */
export function parseStandings(body: unknown): Standing[] {
  const list = (body as { standings?: unknown } | null)?.standings;
  if (!Array.isArray(list)) return [];
  const out: Standing[] = [];
  for (const line of list) {
    if (!line || typeof line !== "object") continue;
    const { roundId, points, joinedAt } = line as Record<string, unknown>;
    if (typeof roundId !== "string" || typeof points !== "number" || !Number.isFinite(points)) continue;
    out.push({ roundId, points, ...(typeof joinedAt === "string" ? { joinedAt } : {}) });
  }
  return out;
}

async function fetchStandings(url: string, roundIds: string[]): Promise<Standing[] | null> {
  const { body, headers } = signOutbound({ roundIds });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      // The exact string that was signed - re-serialising breaks the signature.
      body,
      signal: AbortSignal.timeout(STANDINGS_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`⚠️ [velocity] standings refused (HTTP ${response.status}); grid falls back to join order`);
      return null;
    }
    return parseStandings(await response.json());
  } catch (error) {
    console.warn(
      `⚠️ [velocity] standings unreachable (${error instanceof Error ? error.message : "failed"}); grid falls back to join order`,
    );
    return null;
  }
}

/**
 * Re-order one race's grid from the platform's standings. Called, never awaited, after every new
 * seat in a shared race. Returns the order pushed (for tests), or null when nothing was pushed.
 */
export async function refreshGrid(raceId: string, standingsUrl: string | undefined): Promise<string[] | null> {
  try {
    const rounds = await Round.find({ "race.raceId": raceId, mode: "ranked" })
      .sort({ createdAt: 1, _id: 1 })
      .select({ roundId: 1, providerRoundId: 1 })
      .lean<SeatedRound[]>();
    if (rounds.length < 2) return null;
    if (!standingsUrl) return null; // the platform did not offer standings: join order stands
    const standings = await fetchStandings(standingsUrl, rounds.map((r) => r.roundId));
    if (!standings) return null;
    const order = orderGrid(rounds, standings);
    const accepted = await pushGridOrder(requireVelocityConfig(), raceId, order);
    if (!accepted) {
      console.warn(`⚠️ [velocity] race ${raceId} did not accept the grid order (already started, or a newer order won)`);
      return null;
    }
    return order;
  } catch (error) {
    console.warn(`⚠️ [velocity] grid refresh for ${raceId} failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
