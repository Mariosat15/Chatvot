/**
 * The arithmetic and wording behind the game arena's chrome.
 *
 * PURE AND MODEL-FREE, for two reasons. The layout is rendered by client components, so a
 * module reaching a Mongoose model could not be imported by them. And every decision here is
 * one that would otherwise be made inline in JSX, where it cannot be tested and where the
 * one rule that matters - that NOTHING branches on which game this is - cannot be asserted.
 *
 * THAT RULE IS THE POINT OF THE FILE. The owner's requirement is that a new game enters every
 * screen with no additional coding. There is exactly one way to lose it: something that
 * enumerates games. So every descriptive chip below is derived from a field the catalogue
 * DECLARES - `family`, the participant range, the score type - and a test asserts that no
 * game code, provider key or game key appears anywhere in this folder. The moment one does,
 * the next title silently renders as a slightly wrong version of the last one.
 */

export interface ArenaChip {
  label: string;
  detail: string;
}

/**
 * How players relate to each other in this title.
 *
 * `family` is the provider's declaration of whether the game needs an opponent. It is NOT a
 * statement about whether everyone plays at the same moment - a race is `independent` - so
 * the wording deliberately says nothing about simultaneity. Getting that wrong would promise
 * a starting gun the platform does not yet fire (open question 18).
 */
export function interactionChip(family: string | undefined): ArenaChip | null {
  if (family === "head_to_head") {
    return { label: "Head to head", detail: "Played against an opponent" };
  }
  if (family === "independent") {
    return { label: "Solo run", detail: "Everyone plays their own attempt" };
  }
  // An undeclared family says nothing rather than guessing. A chip asserting the wrong shape
  // of game is worse than one chip fewer.
  return null;
}

/**
 * The player range, from the CONTEST rather than the title.
 *
 * A game's own limits are not what a player is joining - this contest's are. `min` is never
 * below two, because no paid format is ever single-player, but it is read rather than assumed
 * so that a contest configured higher reads correctly.
 */
export function playersChip(
  minParticipants: number | undefined,
  maxParticipants: number | undefined,
): ArenaChip | null {
  const min = typeof minParticipants === "number" && minParticipants > 0 ? minParticipants : null;
  const max = typeof maxParticipants === "number" && maxParticipants > 0 ? maxParticipants : null;

  if (min && max) {
    return {
      label: min === max ? `${min} players` : `${min}–${max} players`,
      detail: "This contest's size",
    };
  }
  if (max) return { label: `Up to ${max} players`, detail: "This contest's size" };
  if (min) return { label: `${min}+ players`, detail: "This contest's size" };
  return null;
}

/**
 * Skill, not chance - and this one is a platform constant rather than a per-game fact.
 *
 * Only skill-based games are in scope at all: a chance-determined outcome would invert the
 * regulatory position in `legal/ChartVolt-Regulatory-Defence-Pack.html`. So this is true of
 * every title that can ever appear here, and making it a catalogue field would invite an
 * operator to set it to false, which is not a state the platform supports.
 */
export const SKILL_CHIP: ArenaChip = {
  label: "Skill based",
  detail: "Outcomes are earned, never drawn",
};

/**
 * What the score column means, in the player's words.
 *
 * Derived from the declared score type and direction together, because either alone is
 * misleading: a `duration_ms` title scoring higher-is-better is measuring endurance, so
 * calling it "fastest time" would be exactly backwards. The same pairing rule as the AI
 * prompt vocabulary.
 */
export function scoringSummary(
  scoreType: string | undefined,
  scoreDirection: string | undefined,
): string | null {
  const lower = scoreDirection === "lower_is_better";

  if (scoreType === "duration_ms") {
    return lower ? "Fastest time wins" : "Longest time wins";
  }
  if (scoreType === "integer" || scoreType === "decimal") {
    return lower ? "Lowest score wins" : "Highest score wins";
  }
  return null;
}

/** A whole-number money figure with the platform's symbol, or a dash when there is none. */
export function money(amount: number | undefined, symbol: string): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  const rounded = Math.round(amount * 100) / 100;
  return `${symbol}${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** `mm:ss` for a duration in seconds, used for the round clock. */
export function clock(totalSeconds: number | undefined): string | null {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }
  const whole = Math.floor(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "Attempt 2 of 3", the reference screen's round stepper.
 *
 * Returns null for a single-attempt contest: "Attempt 1 of 1" is a stepper with one step,
 * which takes up the space of information without being any.
 */
export function attemptProgress(
  attemptsUsed: number,
  attemptsPermitted: number,
): { current: number; total: number } | null {
  if (!Number.isFinite(attemptsPermitted) || attemptsPermitted <= 1) return null;
  // The attempt a player is ABOUT to take, capped so an exhausted player reads "3 of 3"
  // rather than "4 of 3".
  const current = Math.min(attemptsUsed + 1, attemptsPermitted);
  return { current, total: attemptsPermitted };
}

/**
 * An absent score is a DASH, never a nought.
 *
 * The read-side form of R50: a zero is a real score somebody could have earned, so printing
 * it for a player who has not played yet tells them they scored nothing. Every other screen
 * that renders a provider score follows this rule.
 */
export function scoreText(score: number | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? String(score) : "—";
}
