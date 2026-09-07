/**
 * The one place the player-facing "last moment to start an attempt" is derived.
 *
 * WHY IT IS A MODULE RATHER THAN TWO EXPRESSIONS. `RoundPreflight` needs it to decide whether
 * Play is still offered, and the contest lobby needs it to count down to it - and the lobby is
 * the screen a player reads *before* deciding to travel to the play screen, so the two
 * disagreeing by even a rounding is a player being told they have time and then refused. That
 * is the "one rule, two copies" shape behind five defects here already, none of which
 * `check:mirrors` can see, because it compares models. The admin side has its own producer in
 * `apps/admin/components/admin/games/contest-draft.ts` (`describeRoundFit`) and cannot share
 * this one, since nothing in `apps/admin` imports from the main app's `components/`.
 *
 * IT DELIBERATELY DOES NOT KNOW THE POLICY. `roundStartPolicy` decides what the cut-off *means*
 * - a refusal under `reserve_full_round`, a shortened round under `until_window_closes` - and
 * folding that in would make the function answer `null` in the permissive case, which is
 * precisely when the play screen still needs the number in order to say how much time is left.
 * The arithmetic is one fact; what each screen does with it is two.
 */

/**
 * The last instant at which a full round still fits inside the play window.
 *
 * `null` when the window end or the round length is unknown. An absent duration must produce no
 * cut-off rather than a guessed one: the server applies no gate it cannot compute either, and a
 * guessed deadline that disables Play is worse than letting the server name the real reason.
 */
export function fullRoundCutoffMs(
  playWindowEndMs: number | null,
  maxRoundSeconds: number | undefined,
): number | null {
  if (playWindowEndMs === null) return null;
  if (typeof maxRoundSeconds !== "number" || !Number.isFinite(maxRoundSeconds)) {
    return null;
  }

  return playWindowEndMs - maxRoundSeconds * 1000;
}

/**
 * Whether a contest holds back a full round rather than shortening the last one.
 *
 * Fails closed on anything unrecognised, matching both `contest-config.ts` copies. The value
 * arrives normalised from the server, so this is a second line rather than the first - but a
 * screen that read an unknown string as permissive would offer a button `round.service.ts`
 * refuses, and the refusal would name the clock rather than the mismatch.
 */
export function contestReservesFullRound(
  roundStartPolicy: string | undefined,
): boolean {
  return roundStartPolicy !== "until_window_closes";
}
