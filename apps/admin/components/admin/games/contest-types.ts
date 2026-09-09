import type { ConfigField } from "@/lib/services/games/config-schema";
import type { PlayMode } from "@/lib/services/games/play-shape";

/**
 * What the wizard needs to know about a title it can run a contest on.
 *
 * Mirrors `ProviderContestOption` from the service, declared separately because this one
 * crosses to the browser: the service type is free to grow server-only fields, and a
 * client component importing it would drag them along.
 */
export interface ContestableTitle {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  /**
   * The genre, as a LABEL a human reads - "Puzzle", never the stored `puzzle` (task 9).
   *
   * Resolved by the service for the same reason `playMode` is: a screen that re-derives it is
   * a second copy of the vocabulary, and two spellings of one genre then depend on which
   * screen you are looking at. `undefined` when the title has no genre, so the badge is
   * omitted rather than reading "Uncategorised" - a genre nobody chose.
   */
  category?: string;
  family: string;
  /**
   * The RESOLVED play shape, not the raw `playMode` off the catalogue row.
   *
   * A `head_to_head` title is scheduled whatever it declares, so the wizard must be handed the
   * corrected answer - otherwise it offers schedule controls the create service is about to
   * override, which is a control that appears to work and does nothing.
   */
  playMode: PlayMode;
  scoreDirection: string;
  scoreType: string;
  maxDurationSeconds?: number;
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsContentSeed: boolean;
  schema: { ok: true; fields: ConfigField[] } | { ok: false; error: string };
}
