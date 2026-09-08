/**
 * Does everybody play at one appointed moment, or whenever they like?
 *
 * ONE definition, resolved once, and every consequence derived from it here rather than by the
 * screens and services that need it. Chapter `22` and open question 18.
 *
 * WHY A NEW PROPERTY WAS NEEDED, when two fields already looked like they answered this.
 *
 * `provider_game.family` is the closest thing that existed, and its comment used to claim it
 * drove which contest formats the panel offers. It does not, and it could not answer this
 * question anyway: `family` describes whether a game needs an OPPONENT, and **a race is
 * `independent`** - every runner runs their own track and gets their own time. Branching on it
 * would have put every race in the same bucket as chess.
 *
 * `GameCapabilities.requiresSyncPlay` looked like the answer and was worse, because it is
 * MODULE-level. One provider module backs the whole catalogue, so a module-level flag can only
 * ever give one answer for a race, a puzzle and a quiz at once - the same reason
 * `scoreDirection` travels on the data rather than living in the module (X5's ranking work).
 * It was declared, set to `false` twice, read by nothing, and it is deleted with this change so
 * that the next person needing this does not branch on it and get one answer for every title.
 *
 * WHY IT FAILS TOWARDS `anytime`, which is the opposite of this codebase's usual instinct.
 * Almost every gate here fails closed. This one fails towards the LESS constrained shape, and
 * deliberately: a race wrongly treated as `anytime` runs a staggered contest whose scores are
 * still comparable and still payable - `supportsContentSeed` guarantees every player the same
 * content - whereas a puzzle wrongly treated as `scheduled` shuts entry at the start and
 * refuses players who could have played and paid. The first is recoverable and visible; the
 * second turns paying customers away. Neither is silent.
 *
 * WHAT IT MUST NEVER BE. It is a property of the TITLE, resolved from the stored catalogue row,
 * and never taken from caller input - the same rule as the market-hours gate and
 * `maxRoundSeconds`. An operator- or client-supplied shape is a way to turn off whichever half
 * of the rule is inconvenient: declare a race `anytime` and entry stays open after the gun.
 *
 * MIRRORED, matching `entry-deadline.ts`, `config-schema.ts`, `contest-preflight.ts` and
 * `round-types.ts`, because the writers are in `apps/admin` and the readers are in the main app.
 */

import type { AttemptsPolicy, RoundStartPolicy } from "./round-types";

/** The declared shape. `anytime` is the default and the whole live catalogue is one. */
export type PlayMode = "anytime" | "scheduled";

export const PLAY_MODES: PlayMode[] = ["anytime", "scheduled"];

/**
 * What the catalogue row has to carry for the shape to be resolvable.
 *
 * `playMode` is optional because a title synced before the field existed has none, and
 * `family` because the resolver must survive a partially-loaded projection rather than
 * throwing on a screen.
 */
export interface PlayShapeInput {
  playMode?: string | null;
  family?: string | null;
}

/**
 * The shape of one title.
 *
 * `head_to_head` is FORCED to `scheduled` rather than trusted, because an opponent implies a
 * shared moment - two people cannot play each other at different times - so a provider
 * declaring `head_to_head` + `anytime` has declared a combination that cannot work, and the
 * resolver corrects it instead of letting the wizard offer a staggered chess match.
 */
export function resolvePlayMode(title: PlayShapeInput | null | undefined): PlayMode {
  if (title?.family === "head_to_head") return "scheduled";
  return title?.playMode === "scheduled" ? "scheduled" : "anytime";
}

/**
 * Everything the shape decides, in one object.
 *
 * The reason this is a record of consequences rather than a set of `if (shape === ...)` tests
 * scattered across the wizard, the entry deadline and the pre-flight is the same reason
 * `UNSCORED_CONTEST_POLICY_COPY` is one map: the operator-facing explanation and the rule that
 * enforces it must come from one place, or a screen ends up promising something no gate does.
 */
export interface PlayShapeRules {
  mode: PlayMode;
  /**
   * Entry closes at the contest's start rather than at the last playable moment.
   *
   * `12` s2.10 opened entry for as long as playing is still possible, on the explicit grounds
   * that a game score is not actionable intelligence. That reasoning does not survive a
   * simultaneous contest for a simpler reason than information: **you cannot join a race that
   * has already begun.** Everyone runs the same clock from the same instant, so a seat sold
   * after the gun is a seat that can only ever record a worse result than the field.
   */
  entryClosesAtStart: boolean;
  /**
   * Only one attempt is meaningful.
   *
   * You cannot re-run a race. `best_of_n` over a simultaneous contest is not a harder version
   * of the same thing, it is a contest whose second attempt has no field to run against.
   */
  requiresSingleAttempt: boolean;
  /** The attempts policy a contest of this shape must use, when it is forced. */
  forcedAttemptsPolicy?: AttemptsPolicy;
  /**
   * Whether the operator is asked how late a player may start an attempt.
   *
   * Under `scheduled` the question is already answered by the gun, so the control is withheld
   * and the policy is forced - see below.
   */
  offersRoundStartPolicy: boolean;
  /**
   * The round start policy a contest of this shape must be STORED with.
   *
   * `until_window_closes` for a scheduled contest, which reads backwards until you follow it
   * through: entry has already closed at the gun, so the only person this affects is somebody
   * who entered in time and pressed Play late, and `resolveExpiry` already clamps their round
   * to the window end. They get a shortened round, which in a race is visibly and honestly
   * worse than turning up on time. Refusing them instead buys nothing and loses the entry fee
   * they already paid.
   *
   * Forcing it at WRITE time is the load-bearing part. Every runtime gate - `roundFitsInWindow`,
   * `RoundPreflight`'s `tooLateToStart`, `fullRoundCutoffMs` - already reads the stored policy,
   * so writing the right value means not one of them needs to learn about play modes. A branch
   * added to each of those instead would be five places to forget.
   */
  forcedRoundStartPolicy?: RoundStartPolicy;
  /**
   * Operator-facing wording, in the same object as the rules it describes.
   *
   * Same reasoning as `UNSCORED_CONTEST_POLICY_COPY`: the sentence an operator reads and the
   * gate that enforces it must come from one definition, or a screen promises a window no
   * service grants. That is not hypothetical here - the wizard's start-date hint said
   * "Registration closes at this moment" for a month after `12` s2.10 moved entry to the last
   * playable moment, because the sentence lived in the component and the rule lived in
   * `entry-deadline.ts`.
   */
  copy: {
    startLabel: string;
    startHint: string;
    endLabel: string;
    endHint: string;
    /**
     * Why the round-start control is not being offered, shown in its place.
     *
     * Present only when `offersRoundStartPolicy` is false. A withheld control that says
     * nothing teaches an operator that the setting does not exist; one that names the reason
     * is the feature - the same rule as refusing to enable a provider with no adapter.
     */
    roundStartWithheld?: string;
  };
}

const ANYTIME: PlayShapeRules = {
  mode: "anytime",
  entryClosesAtStart: false,
  requiresSingleAttempt: false,
  offersRoundStartPolicy: true,
  copy: {
    startLabel: "Contest starts",
    startHint: "Play opens at this moment.",
    endLabel: "Contest ends",
    endHint: "Everything still running is closed here.",
  },
};

const SCHEDULED: PlayShapeRules = {
  mode: "scheduled",
  entryClosesAtStart: true,
  requiresSingleAttempt: true,
  forcedAttemptsPolicy: "single",
  offersRoundStartPolicy: false,
  forcedRoundStartPolicy: "until_window_closes",
  copy: {
    startLabel: "Everyone starts at",
    startHint: "Entry closes here. Every player's board opens at this moment.",
    endLabel: "Everyone finishes by",
    endHint: "Long enough for one run, plus a margin.",
    roundStartWithheld:
      "This game is played by everyone at once, so there is nothing to decide here: entry closes at the start, and a player who opens their board late gets whatever is left of the clock rather than being turned away.",
  },
};

export function playShapeRules(mode: PlayMode): PlayShapeRules {
  return mode === "scheduled" ? SCHEDULED : ANYTIME;
}

/** The two steps together, which is what almost every caller wants. */
export function resolvePlayShape(
  title: PlayShapeInput | null | undefined,
): PlayShapeRules {
  return playShapeRules(resolvePlayMode(title));
}
