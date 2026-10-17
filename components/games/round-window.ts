/**
 * The player-facing "last moment to start an attempt", and the policy question beside it.
 *
 * WHY IT IS A MODULE RATHER THAN TWO EXPRESSIONS. `RoundPreflight` needs it to decide whether
 * Play is still offered, and the contest lobby needs it to count down to it - and the lobby is
 * the screen a player reads *before* deciding to travel to the play screen, so the two
 * disagreeing by even a rounding is a player being told they have time and then refused. That
 * is the "one rule, two copies" shape behind five defects here already, none of which
 * `check:mirrors` can see, because it compares models.
 *
 * SINCE 8 SEPTEMBER 2026 THE ARITHMETIC ITSELF LIVES IN `lib/services/games/entry-deadline.ts`
 * and this file delegates. It used to say that the admin side "has its own producer and cannot
 * share this one", which was true of a file under `components/` and stopped being a good reason
 * the moment the contest's own `registrationDeadline` needed the same moment - three producers
 * of one fact, one of them writing to the database. The shared module is mirrored, so admin can
 * reach it; this wrapper survives because both consumers here hold milliseconds and because the
 * paragraph below is about the player's screens rather than about the sum.
 *
 * IT DELIBERATELY DOES NOT KNOW THE POLICY. `roundStartPolicy` decides what the cut-off *means*
 * - a refusal under `reserve_full_round`, a shortened round under `until_window_closes` - and
 * folding that in would make the function answer `null` in the permissive case, which is
 * precisely when the play screen still needs the number in order to say how much time is left.
 * The arithmetic is one fact; what each screen does with it is two.
 */

import { entryDeadlineMs } from "@/lib/services/games/entry-deadline";

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
  return entryDeadlineMs(playWindowEndMs, maxRoundSeconds);
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
