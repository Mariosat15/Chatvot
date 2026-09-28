/**
 * The race tracks Volt Velocity can run, and how "auto" picks one.
 *
 * WHY THIS LIST IS A COPY, AND WHAT KEEPS IT HONEST
 * -------------------------------------------------
 * The authoritative list lives in `velocity-server/src/tracks.js`, which this service may not
 * import (`npm run check:isolation` - games-service shares no code with anything). So the ids
 * are restated here, and `tools/test-velocity.ts` reads the race server's file as TEXT and
 * fails if the two lists differ. Reading a file is not importing it, so the guard stays inside
 * the isolation rule.
 *
 * The drift it prevents is silent: a track id the race server does not know is refused when
 * the room is created, so every round of that contest fails to launch with a 502 that names
 * the race server rather than the stale list.
 */

export const VELOCITY_TRACK_IDS = [
  "orbital",
  "skyline",
  "asteroid",
  "reactor",
  "solar",
  "frozen",
  "canyon",
  "foundry",
  "eclipse",
  "jungle",
  "volcano",
  "alpine",
  "coast",
  "desert",
  "grandprix",
  "aurora",
  "harbor",
  "nebula",
] as const;

export type VelocityTrackId = (typeof VELOCITY_TRACK_IDS)[number];

/** The operator's "let the contest pick" choice. Never sent to the race server. */
export const AUTO_TRACK = "auto";

export type VelocityTrackChoice = VelocityTrackId | typeof AUTO_TRACK;

export function isVelocityTrackId(value: unknown): value is VelocityTrackId {
  return typeof value === "string" && (VELOCITY_TRACK_IDS as readonly string[]).includes(value);
}

/**
 * The tracks "auto" chooses between: the original fifteen, frozen and never extended.
 *
 * Reason: `trackForSeed` is a modulo over this list's length, and the rounds of one contest are
 * created by separate requests across its whole life. Growing the list would move an "auto"
 * contest that is already running onto a different track part-way through, splitting its players
 * across rooms. Tracks added later are offered by name only.
 */
export const AUTO_TRACK_POOL: readonly VelocityTrackId[] = Object.freeze(
  VELOCITY_TRACK_IDS.slice(0, 15),
);

/**
 * The track an "auto" contest races on, chosen from the contest's race seed.
 *
 * Derived from the seed rather than drawn at random so every round of one contest - created
 * by separate requests, possibly on separate processes - lands on the same track without any
 * of them having to ask the others.
 */
export function trackForSeed(seed: number): VelocityTrackId {
  const index = (seed >>> 0) % AUTO_TRACK_POOL.length;
  // `index` is bounded by the array length on the line above.
  // eslint-disable-next-line security/detect-object-injection
  return AUTO_TRACK_POOL[index];
}
