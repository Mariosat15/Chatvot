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
 * The game's name split into a title and a subtitle at its first colon.
 *
 * THE REFERENCE SHOWS TWO LINES AND THE CATALOGUE STORES ONE FIELD. `displayName` is free
 * text an operator types, and the live one is `Circuit Sprint: Fast and Fun Spatial Puzzles` -
 * a name with its own subtitle inside it. Rendered whole at heading size it runs the width of
 * the page, which is the same fault that made the rules panel's heading unreadable.
 *
 * A COLON IS THE ONLY THING THIS LOOKS FOR, and that is why it is not per-game code. Any
 * title punctuated that way splits; any title without one is a single heading and shows no
 * subtitle. Nothing is dropped either way - the two halves are both rendered, one above the
 * other, so a player reads the same words in a shape that fits.
 *
 * An empty half on either side means the colon was decorative, so the whole name is the title.
 */
export function splitGameTitle(gameName: string): {
  title: string;
  subtitle: string | null;
} {
  const at = gameName.indexOf(":");
  if (at <= 0) return { title: gameName.trim(), subtitle: null };

  const title = gameName.slice(0, at).trim();
  const subtitle = gameName.slice(at + 1).trim();
  if (!title || !subtitle) return { title: gameName.trim(), subtitle: null };

  return { title, subtitle };
}

/** A round ceiling at or below this reads as "fast" rather than as a figure. */
const FAST_ROUND_SECONDS = 300;

/**
 * How long an attempt can run, in the fewest words that are still true.
 *
 * `maxDurationSeconds` IS A CEILING, NOT A LENGTH, which is why the long form says "up to".
 * The contest's own configured round can be shorter, so stating the catalogue figure as the
 * round length would be a number no player's clock agrees with. Under five minutes the
 * ceiling makes every round short, so the claim holds without a figure at all.
 *
 * An undeclared ceiling returns nothing. A guessed length here would be a deadline the
 * platform never set, and the round's own clock is the authority on it.
 */
export function roundLengthLabel(
  maxDurationSeconds: number | undefined,
): string | null {
  if (
    typeof maxDurationSeconds !== "number" ||
    !Number.isFinite(maxDurationSeconds) ||
    maxDurationSeconds <= 0
  ) {
    return null;
  }

  if (maxDurationSeconds <= FAST_ROUND_SECONDS) return "Fast rounds";
  return `Up to ${Math.round(maxDurationSeconds / 60)} min`;
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

/** One of the four small items across the middle of the hero. */
export interface ArenaFeature {
  label: string;
  /** Which glyph to draw. A name rather than a component, so this module stays pure. */
  icon: "speed" | "players" | "skill" | "ranking";
}

/**
 * The hero's four features, in the reference's order.
 *
 * THE REFERENCE'S FOUR LABELS ARE MARKETING AND THREE OF THEM ARE SAFE. "Fast rounds",
 * "Real players" and "Global leaderboard" are either derived from a declared field or true of
 * every contest this platform will ever run - no paid format is single-player, and every
 * contest has exactly one board, which is on this screen. **The fourth, "Big rewards", is
 * deliberately not here**: what a contest pays depends on its prize pool, so the phrase is a
 * promise the hero cannot check, and a free contest would carry it too. The trophy position
 * holds the platform's skill guarantee instead, which is the strongest claim that is always
 * true.
 *
 * THE PLAYER COUNT PREFERS THE REAL RANGE over the reference's wording. "2-100 players" is
 * the same feature with the contest's own figures in it, and a figure cannot be a promise.
 *
 * FOUR IS NOT PADDED TO. Every entry is either a fact or a platform constant, so a title
 * declaring nothing renders three rather than inventing a fourth.
 */
export function heroFeatures(
  maxDurationSeconds: number | undefined,
  family: string | undefined,
  minParticipants: number | undefined,
  maxParticipants: number | undefined,
): ArenaFeature[] {
  const features: ArenaFeature[] = [];

  // The speed slot falls back to HOW players relate, which is the other thing a declared
  // field can say about the shape of an attempt.
  const rounds = roundLengthLabel(maxDurationSeconds);
  const interaction = rounds ? null : interactionChip(family);
  if (rounds) features.push({ label: rounds, icon: "speed" });
  else if (interaction) features.push({ label: interaction.label, icon: "speed" });

  const players = playersChip(minParticipants, maxParticipants);
  features.push({
    label: players ? players.label : "Real players",
    icon: "players",
  });

  features.push({ label: SKILL_CHIP.label, icon: "skill" });
  features.push({ label: "Global leaderboard", icon: "ranking" });

  return features;
}

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

/*
  `money(amount, symbol)` used to live here. It is gone rather than reworded: it was a second
  implementation of `lib/utils/format-volts.ts` - same whole-number rule, same dash for a
  non-finite amount - differing only in that it took a symbol and was handed the fiat one, so
  the arena's prize pool read `€30`. Two copies of one rule is the shape behind `referenceId`,
  `failedReason`, `challengeId` and the Game Master `||`, and a formatter is no exception: the
  copies drift in the direction of one screen quoting a different figure from the next.
*/

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
