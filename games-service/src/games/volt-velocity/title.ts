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
 * own here - the race server's fixed 300-second limit after a 5-second countdown is the clock.
 *
 * PRACTICE IS OFF, DELIBERATELY (deviation from chapter 23)
 * ---------------------------------------------------------
 * A practice round has no content seed, so it would be a race room of one - and the race server
 * will not start a room with fewer than two connected pilots. Offering practice would therefore
 * offer a lobby that never starts. Recorded in `External game plans/23`.
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

/** The race server's fixed race limit, and the countdown before it. Not configurable there. */
export const VELOCITY_RACE_SECONDS = 300;
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
  scoreRange: { min: 0, max: VELOCITY_RACE_SECONDS * 1000 },
  typicalDurationSeconds: 180,
  maxDurationSeconds: VELOCITY_RACE_SECONDS + VELOCITY_COUNTDOWN_SECONDS,
  configSchema: {
    type: "object",
    properties: {
      trackId: {
        type: "string",
        enum: [AUTO_TRACK, ...VELOCITY_TRACK_IDS],
        default: AUTO_TRACK,
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
  const value = raw.trackId;
  if (value === undefined || value === AUTO_TRACK) {
    return { config: { kind: "volt-velocity", trackId: AUTO_TRACK }, corrected: [] };
  }
  if (isVelocityTrackId(value)) {
    return { config: { kind: "volt-velocity", trackId: value }, corrected: [] };
  }
  return { config: { kind: "volt-velocity", trackId: AUTO_TRACK }, corrected: ["trackId"] };
}
