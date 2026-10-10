/**
 * The single producer of a challenge's play window.
 *
 * UNLIKE `Competition`, a `Challenge` stores no `playWindowStart`/`playWindowEnd` - see the
 * model's own comment on why. The window is `[startTime, endTime]`, both already stored and
 * both set once, at acceptance. This function is the one place that turns those two dates
 * into the pair every round-related consumer expects, so that a screen or a service reading
 * `startTime`/`endTime` directly cannot quietly diverge from one that reads this function -
 * the "one rule, two copies" shape this codebase keeps finding, one derivation away from the
 * fields themselves rather than a second reservoir of them.
 *
 * BEFORE ACCEPTANCE THERE IS NO WINDOW, and this returns `null` rather than guessing one. A
 * `pending` challenge has neither field set, so a caller offered `null` must refuse to launch
 * a round or derive a round config - not invent a window from `acceptDeadline` or `duration`,
 * both of which describe what the window WILL be once accepted, not what it is now.
 *
 * MIRRORED FROM THE MAIN APP, byte-identical. It is model-free by construction, so a pinning
 * test can compare the two files as text rather than needing a shared import the two Next.js
 * apps cannot make.
 */

export interface ChallengeWindowFields {
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}

export interface ChallengeWindow {
  playWindowStart: Date;
  playWindowEnd: Date;
}

export function deriveChallengeWindow(
  challenge: ChallengeWindowFields | null | undefined,
): ChallengeWindow | null {
  if (!challenge?.startTime || !challenge?.endTime) return null;

  return {
    playWindowStart: new Date(challenge.startTime),
    playWindowEnd: new Date(challenge.endTime),
  };
}
