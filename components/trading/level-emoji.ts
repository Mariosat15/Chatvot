/*
  R90 - the emoji shown beside a level REQUIREMENT, and nothing else.

  This exists because `CompetitionEntryButton` and `CompetitionCard` each carried their own
  ten-entry `LEVEL_NAMES` map holding BOTH an emoji and a name, and nine of the ten names
  disagreed with the twenty-rung ladder in `lib/constants/levels.ts` - not by being absent,
  but by naming a real rung from the wrong position. A contest gated at level 4 told the
  player it required "Expert Trader", which is rung 9; the gate admitted "Junior Trader",
  which is rung 4. Nothing threw and nothing logged.

  The names now come from `resolveLevelName`, which reads the OPERATOR'S ladder. Only the
  decoration is left here, and it is deliberately NOT merged back into `TitleLevel.icon`:
  that field is a `GameIconName` naming a committed SVG asset, rendered through `<GameIcon>`,
  whereas these two lines are plain text with an emoji in it. Two art systems, one of which
  the operator cannot break.

  DECORATION ONLY. It must never carry a name, because a name here is a claim about which
  rung a paying player needs and there is exactly one place that may answer that.

  An unlisted rung renders NO emoji rather than a stand-in. The ladder has twenty rungs and
  this has ten, so rungs 11-20 fall through - and the previous code's answer to that was to
  reuse rung one's sprout beside rung fifteen's name, which reads as a deliberate pairing.
*/
const LEVEL_EMOJI: ReadonlyMap<number, string> = new Map([
  [1, "🌱"],
  [2, "📚"],
  [3, "⚔️"],
  [4, "🎯"],
  [5, "💎"],
  [6, "👑"],
  [7, "🔥"],
  [8, "⚡"],
  [9, "🌟"],
  [10, "👑"],
]);

/**
 * The decorative emoji for a level, or an empty string.
 *
 * A `Map` rather than an object because the key is a number off a stored contest document:
 * an object lookup walks the prototype chain, so a `levelRequirement.minLevel` of
 * `"constructor"` returns something truthy that survives a `!emoji` test.
 */
export function levelEmoji(level: number): string {
  return LEVEL_EMOJI.get(level) ?? "";
}
