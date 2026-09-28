/**
 * Volt Velocity as the catalogue reports it, and its resolved round settings.
 *
 * THE ONE TITLE THAT IS `scheduled`
 * ---------------------------------
 * Every other title here is `anytime`: a player launches a round and plays alone against a
 * clock. Volt Velocity is a live race - up to 16 pilots in one room, one start - so the platform
 * forces its contests to single attempt, `until_window_closes`, and entry closing at the start
 * (`lib/services/games/play-shape.ts` on the platform side). This service does not re-enforce
 * those; it only has to put every round of one contest into the same race room.
 *
 * THE RACE SERVER IS THE SCORER
 * -----------------------------
 * Unlike the puzzle titles, no gameplay reaches this service. The authoritative race server in
 * `velocity-server/` simulates every ship and signs the result; this service verifies that
 * signature and reports each pilot's finishing time. So the round has no gameplay clock of its
 * own here - the race server's limit of 100 seconds per lap (so 1-10 laps is 100-1000 seconds)
 * after a 5-second countdown is the clock.
 *
 * TWO WAYS TO RUN A COMPETITION, ONE FOR A CHALLENGE (owner rule)
 * ----------------------------------------------------------------
 * A scheduled competition puts every player in one room that goes green at `scheduledStartAt`.
 * An anytime competition ("each plays alone") gives every round its OWN room with no other ships.
 * A challenge always shares one room between its two players and always races 3 laps.
 *
 * PRACTICE IS OFF, DELIBERATELY (deviation from chapter 23)
 * ---------------------------------------------------------
 * A practice round has no content seed, so it would be a race room of one - and a shared room
 * will not start with fewer than two connected pilots. Offering practice would therefore offer a
 * lobby that never starts. Recorded in `External game plans/23`. (A SOLO room does start with
 * one pilot, but only an "each plays alone" competition asks for one; practice is unchanged.)
 */

import { copyFor, howToPlayFor, TITLE_LOCALES } from "../content";
import { VOLT_VELOCITY_CODE } from "../titles-codes";
import type { TitleDefinition } from "../titles";
import {
  AUTO_TRACK,
  VELOCITY_TRACK_IDS,
  isVelocityTrackId,
  type VelocityTrackChoice,
} from "./tracks";

/**
 * Laps per race, chosen by the operator per competition (owner rule). A challenge is always
 * `VELOCITY_CHALLENGE_LAPS`, declared to the platform as the setting's `challengeValue`.
 * These must match `MIN_LAPS` / `MAX_LAPS` / `SECONDS_PER_LAP` in
 * `velocity-server/server/race-room.mjs`, which is the enforcing side.
 */
export const VELOCITY_MIN_LAPS = 1;
export const VELOCITY_MAX_LAPS = 10;
export const DEFAULT_VELOCITY_LAPS = 3;
export const VELOCITY_CHALLENGE_LAPS = 3;
/** The race's time limit is a total: laps x this. A racer still out at the limit is a DNF. */
export const VELOCITY_SECONDS_PER_LAP = 100;
/** The longest race any setting allows. The race server applies laps x 100 per room. */
export const VELOCITY_RACE_SECONDS = VELOCITY_MAX_LAPS * VELOCITY_SECONDS_PER_LAP;
export const VELOCITY_COUNTDOWN_SECONDS = 5;

/** Most pilots one race room holds. The race server refuses a seventeenth. */
export const VELOCITY_MAX_PILOTS = 16;

const en = copyFor(VOLT_VELOCITY_CODE, "en");

export const VOLT_VELOCITY: TitleDefinition = {
  gameCode: VOLT_VELOCITY_CODE,
  displayName: en.displayName,
  tagline: en.tagline,
  description: en.description,
  rulesSummary: en.rulesSummary,
  howToPlay: howToPlayFor(VOLT_VELOCITY_CODE, "en"),
  category: "racing",
  tags: ["racing", "multiplayer", "live", "skill"],
  family: "independent",
  playMode: "scheduled",
  supportsCompetition: true,
  supportsOneVsOne: true,
  supportsPractice: false,
  supportsContentSeed: true,
  scoreDirection: "lower_is_better",
  scoreType: "duration_ms",
  // The score is the finishing time with the points tie-break folded in below the millisecond,
  // so it never exceeds the longest race any lap setting allows.
  scoreRange: { min: 0, max: VELOCITY_RACE_SECONDS * 1000 },
  typicalDurationSeconds: 180,
  maxDurationSeconds: VELOCITY_RACE_SECONDS + VELOCITY_COUNTDOWN_SECONDS,
  maxPlayers: VELOCITY_MAX_PILOTS,
  configSchema: {
    type: "object",
    properties: {
      trackId: {
        type: "string",
        enum: [AUTO_TRACK, ...VELOCITY_TRACK_IDS],
        default: AUTO_TRACK,
      },
      laps: {
        type: "integer",
        title: "Laps",
        description: `Laps per race. The time limit is ${VELOCITY_SECONDS_PER_LAP} seconds per lap; a racer who has not finished by then scores nothing.`,
        minimum: VELOCITY_MIN_LAPS,
        maximum: VELOCITY_MAX_LAPS,
        default: DEFAULT_VELOCITY_LAPS,
        challengeValue: VELOCITY_CHALLENGE_LAPS,
        // Reason: tells the platform how long ONE race really is (laps x 100 s + the 5 s
        // countdown), so its contest clock checks use the operator's lap count rather than
        // the 10-lap ceiling, and it can refuse a contest shorter than a single race.
        format: "duration-units",
        secondsPerUnit: VELOCITY_SECONDS_PER_LAP,
        secondsExtra: VELOCITY_COUNTDOWN_SECONDS,
      },
    },
    required: ["trackId"],
  },
  locales: [...TITLE_LOCALES],
  platforms: ["desktop"],
  status: "active",
};

export interface VoltVelocityConfig {
  kind: "volt-velocity";
  /** What the operator chose. "auto" is resolved to a real track per race, from its seed. */
  trackId: VelocityTrackChoice;
  /** Laps per race, 1-10. Absent on a round created before laps existed, which means 3. */
  laps?: number;
}

/** The lap count a resolved config races, with the pre-laps default for an old round. */
export function lapsOf(config: VoltVelocityConfig): number {
  return config.laps ?? DEFAULT_VELOCITY_LAPS;
}

/**
 * Resolve the operator's track choice. An unknown value falls back to "auto" and is reported,
 * for the same reason `clampInteger` corrects rather than refuses in `titles.ts`: the platform
 * validated the value against our schema, so a disagreement is a schema drift worth logging,
 * not a reason to refuse a paid round.
 */
export function resolveVelocityConfig(raw: Record<string, unknown>): {
  config: VoltVelocityConfig;
  corrected: string[];
} {
  const corrected: string[] = [];
  const value = raw.trackId;
  let trackId: VelocityTrackChoice = AUTO_TRACK;
  if (value !== undefined && value !== AUTO_TRACK) {
    if (isVelocityTrackId(value)) trackId = value;
    else corrected.push("trackId");
  }

  let laps = DEFAULT_VELOCITY_LAPS;
  if (raw.laps !== undefined) {
    const n = typeof raw.laps === "number" ? raw.laps : Number(raw.laps);
    if (Number.isFinite(n)) {
      laps = Math.min(VELOCITY_MAX_LAPS, Math.max(VELOCITY_MIN_LAPS, Math.round(n)));
      if (laps !== n) corrected.push("laps");
    } else {
      corrected.push("laps");
    }
  }

  return { config: { kind: "volt-velocity", trackId, laps }, corrected };
}
