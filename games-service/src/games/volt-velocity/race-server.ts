/**
 * The games-service half of the Volt Velocity race-server protocol (chapter 23).
 *
 * Everything here talks to the race server's ADMIN surface on loopback, holding the admin key
 * and the ticket secret, neither of which ever reaches a browser. The browser receives exactly
 * one thing from this module: a ticket, via the play session endpoint, in a response body -
 * never in a URL, because a URL is logged by every proxy between the player and us.
 *
 * Nothing here scores anything. The race server simulates the race authoritatively and signs a
 * receipt; `verifyReceipt` checks that signature and the result sweeper reads the finishing
 * times out of the SIGNED payload only, because the unsigned fields beside it are a copy anybody
 * who could reach the archive file could edit.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { VelocityConfig } from "../../config";
import { DEFAULT_VELOCITY_LAPS } from "./title";
import { AUTO_TRACK, trackForSeed, type VelocityTrackChoice } from "./tracks";

/** The race server refuses a room scheduled further ahead than this. */
export const MAX_SCHEDULE_AHEAD_MS = 6 * 60 * 60 * 1000;
/** A ticket is valid for this long. The race server refuses anything over 24 hours. */
export const TICKET_LIFETIME_SECONDS = 6 * 60 * 60;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_NAME_LENGTH = 40;

export interface RaceIdentity {
  raceId: string;
  trackId: string;
  seed: number;
}

/**
 * Every player in one contest must land in ONE room, and nothing is shared between their launch
 * requests except the contest's content seed, the chosen track and the scheduled start. So the
 * room id is a pure function of those three - derived, never stored first and looked up, which
 * would need a lock across concurrent launches for no gain.
 *
 * `trackChoice` "auto" resolves from the seed, so every player of one contest gets the same
 * track without anybody having to decide first.
 */
export function raceIdentity(
  gameCode: string,
  contentSeed: string,
  trackChoice: VelocityTrackChoice,
  scheduledStartAt: Date | undefined,
  laps: number,
  soloRoundId?: string,
): RaceIdentity {
  const seed = createHash("sha256").update(`velocity-seed|${contentSeed}`).digest().readUInt32BE(0);
  const trackId = trackChoice === AUTO_TRACK ? trackForSeed(seed) : trackChoice;
  // Reason: laps are part of what the room IS - two rounds that agree on everything but the lap
  // count must never share a room, or one of them races a distance its contest did not set.
  // A solo room is keyed on the platform's round id, so a retried launch reuses it and no
  // other player's launch can ever land in it. The 3-lap shared key is the pre-laps key
  // unchanged, so a room created before this release is still found by the same id.
  const key = [gameCode, contentSeed, trackId, scheduledStartAt?.toISOString() ?? "unscheduled"];
  if (laps !== DEFAULT_VELOCITY_LAPS) key.push(`laps:${laps}`);
  if (soloRoundId) key.push(`solo:${soloRoundId}`);
  const digest = createHash("sha256").update(key.join("|")).digest("hex").slice(0, 32);
  return { raceId: `vv_${digest}`, trackId, seed };
}

/** Same format as `velocity-server/server/tickets.mjs` `issueTicket`, byte for byte. */
export function signTicket(
  secret: string,
  raceId: string,
  playerId: string,
  nowMs: number = Date.now(),
): string {
  const claims = {
    aud: "volt-velocity",
    raceId,
    playerId,
    exp: Math.floor(nowMs / 1000) + TICKET_LIFETIME_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

export function racerName(displayName: string | undefined): string {
  const trimmed = (displayName ?? "").trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : "Racer";
}

/** Why a player could not be seated. Each maps to a distinct API error - see `create.ts`. */
export type SeatRefusal = "race_full" | "race_closed" | "unreachable" | "rejected";

export type SeatOutcome = { ok: true } | { ok: false; reason: SeatRefusal; detail: string };

interface AdminResponse {
  status: number;
  body: Record<string, unknown>;
}

async function admin(
  config: VelocityConfig,
  method: "GET" | "POST",
  path: string,
  payload?: unknown,
): Promise<AdminResponse> {
  const response = await fetch(`${config.raceUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.adminKey}`,
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // A non-JSON body is reported by status alone.
  }
  return { status: response.status, body };
}

function refusalFrom(response: AdminResponse): SeatOutcome {
  const detail = typeof response.body.error === "string" ? response.body.error : `HTTP ${response.status}`;
  if (/race is full/i.test(detail)) return { ok: false, reason: "race_full", detail };
  if (/entry has closed/i.test(detail)) return { ok: false, reason: "race_closed", detail };
  return { ok: false, reason: "rejected", detail };
}

/**
 * Create the room with this player in it, or add them to the room another player created.
 *
 * Called BEFORE the round is written, so a race server that refuses or is down costs the player
 * no attempt. Registration is idempotent per player id on the race server, so a retried launch
 * for the same round is harmless.
 *
 * A 409 on create followed by a 404 on join means the room exists only as an ARCHIVED result -
 * the race has already been run - which is "entry has closed", not an error.
 */
export async function seatPlayer(
  config: VelocityConfig,
  identity: RaceIdentity,
  player: { id: string; name: string },
  scheduledStartAt: Date | undefined,
  room: { laps: number; solo: boolean; latestStartAt?: Date },
): Promise<SeatOutcome> {
  const scheduled = scheduledStartAt && !room.solo;
  try {
    // A solo room is frozen at its one pilot and unscheduled; the race server refuses an open
    // roster or a schedule on it, so neither is sent. It starts when that pilot is Ready.
    const created = await admin(config, "POST", "/v1/races", {
      id: identity.raceId,
      trackId: identity.trackId,
      seed: identity.seed,
      players: [player],
      laps: room.laps,
      ...(room.solo ? { solo: true } : { openRoster: true }),
      ...(scheduled ? { scheduledStartAt: scheduledStartAt.getTime() } : {}),
      // Reason: only the player who CREATES the room sets it; it is not part of the room id, so
      // every round of one contest (same play window) computes the same value anyway.
      ...(scheduled && room.latestStartAt ? { latestStartAt: room.latestStartAt.getTime() } : {}),
    });
    if (created.status === 201) return { ok: true };
    if (created.status !== 409) return refusalFrom(created);

    const joined = await admin(config, "POST", `/v1/races/${identity.raceId}/players`, {
      players: [player],
    });
    if (joined.status === 200) return { ok: true };
    if (joined.status === 404) {
      return { ok: false, reason: "race_closed", detail: "The race has already been run." };
    }
    return refusalFrom(joined);
  } catch (error) {
    return {
      ok: false,
      reason: "unreachable",
      detail: error instanceof Error ? error.message : "Race server did not respond.",
    };
  }
}

/** One racer's line from the SIGNED payload. */
export interface RaceResultEntry {
  playerId: string;
  dnf: boolean;
  finished: boolean;
  timeMs: number | null;
  bestLapMs: number | null;
  lapsCompleted: number;
  /** Points earned in the race - the tie-break between equal times. 0 when absent. */
  skillScore: number;
  shipId?: string;
}

export interface VerifiedReceipt {
  raceId: string;
  final: boolean;
  status: string;
  cancelReason: string | null;
  registered: string[];
  results: RaceResultEntry[];
}

export type ResultPoll =
  | { kind: "running" }
  | { kind: "missing" }
  | { kind: "final"; receipt: VerifiedReceipt }
  | { kind: "invalid"; detail: string }
  | { kind: "error"; detail: string };

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Check the receipt's HMAC and parse ONLY the signed payload.
 *
 * Exported for tests. Refuses rather than repairing: a receipt with a bad signature is either a
 * rotated secret or a tampered file, and in neither case may its finishing times be paid on.
 */
export function verifyReceipt(secret: string, receipt: Record<string, unknown>): VerifiedReceipt {
  const { signature, signedPayload } = receipt;
  if (typeof signature !== "string" || typeof signedPayload !== "string") {
    throw new Error("Receipt carries no signature");
  }
  const expected = createHmac("sha256", secret).update(signedPayload).digest();
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Receipt signature does not verify");
  }
  const parsed = JSON.parse(signedPayload) as Record<string, unknown>;
  const rows = Array.isArray(parsed.results) ? parsed.results : [];
  return {
    raceId: String(parsed.raceId ?? ""),
    final: parsed.final === true,
    status: String(parsed.status ?? ""),
    cancelReason: typeof parsed.cancelReason === "string" ? parsed.cancelReason : null,
    registered: Array.isArray(parsed.registered) ? parsed.registered.map(String) : [],
    results: rows
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => ({
        playerId: String(row.playerId ?? ""),
        dnf: row.dnf === true,
        finished: row.finished === true,
        timeMs: finiteOrNull(row.timeMs),
        bestLapMs: finiteOrNull(row.bestLapMs),
        lapsCompleted: finiteOrNull(row.lapsCompleted) ?? 0,
        skillScore: Math.max(0, finiteOrNull(row.skillScore) ?? 0),
        ...(typeof row.shipId === "string" ? { shipId: row.shipId } : {}),
      })),
  };
}

export async function pollResult(config: VelocityConfig, raceId: string): Promise<ResultPoll> {
  try {
    const response = await admin(config, "GET", `/v1/races/${raceId}/result`);
    if (response.status === 202) return { kind: "running" };
    if (response.status === 404) return { kind: "missing" };
    if (response.status !== 200) return { kind: "error", detail: `HTTP ${response.status}` };
    try {
      const receipt = verifyReceipt(config.ticketSecret, response.body);
      if (receipt.raceId !== raceId) return { kind: "invalid", detail: "Receipt is for another race" };
      return { kind: "final", receipt };
    } catch (error) {
      return { kind: "invalid", detail: error instanceof Error ? error.message : "Unreadable receipt" };
    }
  } catch (error) {
    return { kind: "error", detail: error instanceof Error ? error.message : "Race server did not respond" };
  }
}

/** Points above this cannot move the score by a whole millisecond. */
export const MAX_TIE_BREAK_POINTS = 999_999;

/**
 * Fastest time wins; on an EQUAL time, more points win (owner rule).
 *
 * The platform ranks one number, lower-is-better, so the points are folded in below the
 * millisecond: `timeMs - points / 1e6`. Capped so they can never be worth a whole millisecond -
 * a slower racer must never beat a faster one on points. Both inputs come from the SIGNED
 * receipt, so a racer cannot raise their own points.
 */
export function tieBrokenScore(timeMs: number, points: number): number {
  const bonus = Math.min(Math.max(0, points), MAX_TIE_BREAK_POINTS);
  return timeMs - bonus / 1_000_000;
}

/**
 * What one racer scored. Chapter 23: the score is the finishing time, and only a racer who
 * crossed the line without a DNF has one. Everybody else records NO score - never zero, which on
 * a lower-is-better title would be the best time on the board (R50's shape).
 */
export function scoreForEntry(entry: RaceResultEntry | undefined): {
  score?: number;
  breakdown: Record<string, number | string | boolean>;
} {
  if (!entry) return { breakdown: { finished: false, connected: false } };
  const breakdown: Record<string, number | string | boolean> = {
    finished: entry.finished && !entry.dnf,
    lapsCompleted: entry.lapsCompleted,
  };
  if (entry.bestLapMs !== null) breakdown.bestLapMs = entry.bestLapMs;
  if (entry.shipId) breakdown.ship = entry.shipId;
  breakdown.points = entry.skillScore;
  if (entry.finished && !entry.dnf && entry.timeMs !== null) {
    breakdown.timeMs = entry.timeMs;
    return { score: tieBrokenScore(entry.timeMs, entry.skillScore), breakdown };
  }
  return { breakdown };
}
