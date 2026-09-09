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
 * WHAT IT MUST NEVER BE, AMENDED 9 SEPTEMBER 2026 BY TASK 11 - and the amendment is recorded
 * here rather than by rewriting the sentence it replaces, because a reversed design rule is
 * exactly the fact a new reader needs.
 *
 * This used to say the shape is a property of the TITLE and never taken from caller input, full
 * stop. The second half of that is still absolute and the first half is now wrong. Task 11's
 * own example is a multiplayer racing game supporting a synchronous race AND an async time
 * trial, and a title that supports both cannot answer the question by itself - something has
 * to choose per contest.
 *
 * WHAT SURVIVES, WHICH IS THE PART THAT MATTERED. The stated fear was an operator declaring a
 * race `anytime` so that entry stays open after the gun. `resolveSupportedPlayModes` is
 * precisely what prevents that: an operator may only pick a shape the TITLE says it supports,
 * so a race can be run staggered only if somebody has declared that this race has a legitimate
 * time-trial form. The three properties that made the old rule safe are all intact:
 *
 *   - the choice is validated against a STORED set, never against caller input
 *   - the consequences are still stamped onto the contest at WRITE time, so not one runtime
 *     gate reads a mode - they read the policies this module forced
 *   - no PLAYER-facing path supplies a shape at all, which was always the absolute half
 *
 * The one thing the change breaks if it is missed: `resolvePlayShape(title)` is the wrong
 * question for an existing contest the moment a title supports two shapes, because the title's
 * default is not necessarily what that contest was created as. A contest therefore stores its
 * own `playMode`, and the edit path reads THAT. See `04`/`22` s10.
 *
 * MIRRORED, matching `entry-deadline.ts`, `config-schema.ts`, `contest-preflight.ts` and
 * `round-types.ts`, because the writers are in `apps/admin` and the readers are in the main app.
 */

import type { AttemptsPolicy, RoundStartPolicy } from "./round-types";

/** The declared shape. `anytime` is the default and the whole live catalogue is one. */
export type PlayMode = "anytime" | "scheduled";

export const PLAY_MODES: PlayMode[] = ["anytime", "scheduled"];

/**
 * Operator-facing names for the two shapes.
 *
 * A `ReadonlyMap` rather than a `Record`, and it must not be "simplified" back: the key
 * reaching this comes off a stored document, so an object lookup walks the prototype chain
 * and `"__proto__"` returns a truthy `Object.prototype` that survives a `!copy` test before
 * failing somewhere unrelated. Fourth instance of that trap after the round-inspector action
 * map, `competition-update-fields.ts` and `UNSCORED_CONTEST_POLICY_COPY`.
 *
 * It lives beside the rules for the same reason `PlayShapeRules.copy` does: the sentence an
 * operator picks from and the gate that enforces it must come from one definition.
 */
export const PLAY_MODE_COPY: ReadonlyMap<
  PlayMode,
  { label: string; detail: string }
> = new Map([
  [
    "anytime",
    {
      label: "Join any time",
      detail:
        "Players enter and play whenever they like while the contest is open, and their scores are compared at the end. Right for a puzzle, a high-score board or a time trial.",
    },
  ],
  [
    "scheduled",
    {
      label: "Everyone at once",
      detail:
        "Every player's board opens at the same moment, so entry closes when the contest starts and each player gets one attempt. Right for a race or anything where players are up against each other live.",
    },
  ],
]);

/**
 * What the catalogue row has to carry for the shape to be resolvable.
 *
 * `playMode` is optional because a title synced before the field existed has none, and
 * `family` because the resolver must survive a partially-loaded projection rather than
 * throwing on a screen.
 *
 * `playModeOverride` is OUR answer, and the reason it is a second field rather than a write
 * to `playMode` is the catalogue sync: `playMode` is in `providerOwnedFields`, so a control
 * writing there would be reverted on the next sync with no error and nothing in a log - the
 * "control that appears to work and does nothing" shape this codebase keeps finding. It is
 * still resolved from the STORED row rather than taken from caller input, which is the rule
 * this module opened by stating; a per-contest shape would be a way to turn off whichever
 * half of the rule was inconvenient, and this is not that.
 */
export interface PlayShapeInput {
  playMode?: string | null;
  playModeOverride?: string | null;
  /**
   * Which shapes this title can legitimately be run as (task 11).
   *
   * OPERATOR-OWNED, in no sync list, and deliberately NOT part of the provider contract - so
   * this needs no change to `01` and no version bump on
   * `ChartVolt-Game-API-Requirements.html`, which providers may already be building against.
   * Task 11 asks for it as an admin control, and that is the cheaper answer in the honest
   * sense: a provider declares what their game *is* (`playMode`), we declare what we are
   * willing to run it as.
   *
   * Absent and `[]` both read as "nobody has said", which is the `allowedGameTypes` rule
   * rather than the `entryBlockThreshold` one, and the direction matters: an empty array is
   * what a bad edit, a half-run migration or a form submitting no checkboxes leaves behind,
   * and nothing anywhere offers "this game supports no competitions at all". Taken literally
   * it would make every title in the catalogue unrunnable.
   */
  supportedPlayModes?: (string | null)[] | null;
  family?: string | null;
}

/**
 * A stored string to a mode, or nothing.
 *
 * "Missing" has three shapes and only one is obvious: absent, `null` and `""`. The empty
 * string is the one that matters here, because it is what a half-run migration or a form
 * submitting a blank leaves behind - and read literally it would mask a provider's
 * `scheduled` declaration behind an override nobody chose.
 */
function storedMode(value: string | null | undefined): PlayMode | undefined {
  if (value === "anytime" || value === "scheduled") return value;
  return undefined;
}

/**
 * The shape of one title.
 *
 * `head_to_head` is FORCED to `scheduled` rather than trusted, because an opponent implies a
 * shared moment - two people cannot play each other at different times - so a provider
 * declaring `head_to_head` + `anytime` has declared a combination that cannot work, and the
 * resolver corrects it instead of letting the wizard offer a staggered chess match.
 *
 * THE ORDER IS LOAD-BEARING, and the interesting part is that `head_to_head` beats the
 * operator rather than the other way round. An override cannot make two people play each
 * other at different times, so honouring one there would store a value nothing ever reads -
 * the `requiresSyncPlay` / `isPaused` / `lastSuccessfulRoundAt` / `family` class of declared,
 * written, dead field this codebase has now found four times. `canOverridePlayMode` below is
 * the same question asked ahead of time, so the control is withheld rather than offered and
 * silently discarded.
 *
 * An override the other way - a provider's `scheduled` run as `anytime` - IS honoured. It is
 * the direction this module already fails towards: `supportsContentSeed` guarantees every
 * player identical content, so a staggered race still produces comparable, payable scores,
 * whereas the reverse shuts entry at the start and turns paying players away.
 */
export function resolvePlayMode(title: PlayShapeInput | null | undefined): PlayMode {
  if (title?.family === "head_to_head") return "scheduled";
  return (
    storedMode(title?.playModeOverride) ??
    storedMode(title?.playMode) ??
    "anytime"
  );
}

/**
 * May an operator choose this title's shape, or does the title already answer it?
 *
 * One definition, read by the service that refuses the write and by the control that
 * withholds itself, because the alternative is a form offering a choice the server rejects
 * with a 400 that reads to the operator like a permissions problem.
 */
export function canOverridePlayMode(
  title: PlayShapeInput | null | undefined,
): boolean {
  return title?.family !== "head_to_head";
}

/**
 * Which shapes a contest on this title may be created as (task 11).
 *
 * Always at least one, and always in `PLAY_MODES` order so two screens cannot present the same
 * pair of choices the other way round.
 *
 * THE RESOLVED DEFAULT IS ALWAYS IN THE SET, and that union is the rule most likely to be read
 * as a bug and "simplified" away. The reasoning: `resolvePlayMode` is what the title-level Play
 * style control says this game IS, and it is what every contest already created on this title
 * was created as. A supported set that excluded it would make a title's own declared style
 * unselectable - two controls on one screen contradicting each other - and would strand every
 * live contest on a shape the platform now calls unsupported. An operator narrowing a title to
 * one shape does it by setting the style, which is task 10's control; this one only ever WIDENS.
 *
 * `head_to_head` is `scheduled` and nothing else, for the same reason `resolvePlayMode` forces
 * it: two people cannot play each other at different times, so an async form of a chess match
 * is not a shape somebody may enable. It beats the operator here exactly as it does there.
 */
export function resolveSupportedPlayModes(
  title: PlayShapeInput | null | undefined,
): PlayMode[] {
  const fallback = resolvePlayMode(title);
  if (title?.family === "head_to_head") return [fallback];

  const declared = new Set<PlayMode>([fallback]);
  for (const entry of title?.supportedPlayModes ?? []) {
    const mode = storedMode(entry);
    if (mode) declared.add(mode);
  }

  return PLAY_MODES.filter((mode) => declared.has(mode));
}

/**
 * May a contest on this title be created as this shape?
 *
 * One definition, read by the create service, the edit service and the wizard, because the
 * alternative is a picker offering a shape the server refuses with a 400 that reads to an
 * operator like a permissions problem - and, worse in this direction, a server accepting one
 * the picker never offered.
 */
export function isPlayModeSupported(
  title: PlayShapeInput | null | undefined,
  mode: string | null | undefined,
): boolean {
  const requested = storedMode(mode);
  if (!requested) return false;
  return resolveSupportedPlayModes(title).includes(requested);
}

/**
 * The shape of one CONTEST, which is not the same question as the shape of its title.
 *
 * THE WHOLE REASON THIS EXISTS. Once a title supports two shapes, `resolvePlayMode(title)` is
 * the title's *default* rather than a fact about any particular contest - so an edit that
 * re-derived it would silently re-force the attempts policy and the entry deadline of a
 * contest created as the other shape, under people who have already paid to enter. The stored
 * value is the only thing that can answer it.
 *
 * Falls back to the title for a contest created before the field existed, which is correct
 * rather than defensive: those contests were all created when the title had exactly one shape,
 * so the title's answer IS what they were created as.
 *
 * ON CREATE this is also how the operator's choice becomes the contest's shape - the first
 * argument is what they picked. It does NOT check whether the pick is allowed, deliberately:
 * that is `isPlayModeSupported`, called before anything is written, so a refusal leaves no
 * contest behind. Two functions because they answer two questions, and folding the check in
 * here would mean every read of an existing contest re-litigating a decision already taken -
 * so narrowing a title's supported set would retroactively change the shape of contests
 * already running under it.
 */
export function resolveContestPlayMode(
  storedContestMode: string | null | undefined,
  title: PlayShapeInput | null | undefined,
): PlayMode {
  return storedMode(storedContestMode) ?? resolvePlayMode(title);
}

/** The two steps together, which is what every reader of an existing contest wants. */
export function resolveContestPlayShape(
  storedContestMode: string | null | undefined,
  title: PlayShapeInput | null | undefined,
): PlayShapeRules {
  return playShapeRules(resolveContestPlayMode(storedContestMode, title));
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
