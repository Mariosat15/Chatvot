/**
 * The words the content assistant is allowed to use about a GAME, as opposed to a contest.
 *
 * A SEPARATE MODULE FROM `ai-contest-vocabulary.ts`, AND A SEPARATE PROMPT, because the two
 * are writing about different things. That module writes copy for one competition - a thing
 * with a start time, a pot and an entry fee. This one writes the game's own page copy, which
 * outlives every contest run on it. A prompt that conflates them produces a game description
 * promising a prize, which is wrong on the page and wrong again the next time the game is run
 * with a different one.
 *
 * WHAT IS SHARED IS THE FACTS, NOT THE PROMPT. `describeGameFacts`, `describeSubject`,
 * `describeWinningRule` and `TRADING_WORDS` are imported rather than restated: how a catalogue
 * row becomes words is one rule, and a second copy of it is the shape behind `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||`, none of which `check:mirrors` can
 * see. This module writes the sentences AROUND the block and never the block itself - a screen
 * that composed its own would describe the same game from a smaller set of facts, silently.
 *
 * THE VOCABULARY IS DERIVED SERVER-SIDE FROM THE STORED CATALOGUE ROW, NEVER FROM THE REQUEST
 * BODY - the same rule as the contest assistant. The body carries a `gameKey`, which is a
 * lookup key and nothing else.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only.
 */

// Reason: RELATIVE, not `@/lib/admin/...`. Vitest aliases `@` to the repository ROOT rather
// than the admin root, so the aliased form resolves under `next build` and fails in the suite
// - `apps/admin/lib/admin/` is admin-only and has no counterpart at the root. See R58.
import {
  TRADING_WORDS,
  NO_FIAT_RULE,
  describeSubject,
  describeWinningRule,
  describeGameFacts,
  type CatalogueVocabularySource,
} from "./ai-contest-vocabulary";
import { CONTENT_LIMITS } from "./game-content-fields";

export interface GameContentVocabulary {
  /** For the panel's own wording, so what the operator is told and what the model is told agree. */
  subject: string;
  winningRule: string;
  systemPrompt: string;
}

/**
 * The rule that carries the owner's decision into the prompt itself.
 *
 * The route already refuses to return `rulesSummary` or `howToPlay`, and that refusal is the
 * guarantee. This is the second half of the same decision and it is not redundant: without
 * it the model happily writes "solve each board before the timer expires" INSIDE the
 * description, which is a rules claim wearing marketing clothes, and it lands in a field the
 * operator is expected to accept at a glance.
 *
 * Written as "do not state" rather than "do not invent", deliberately. A model told not to
 * invent rules will state the ones it has assumed and consider itself obedient.
 */
export const NO_RULES_CLAIMS_RULE = `
- Never state how the game is played, what the controls are, how points are earned, how long a round lasts or how ties are broken - that text comes from the game's provider and is written elsewhere
- Never describe a specific level, board, track, obstacle or opponent, because you have not seen the game`;

/**
 * The system prompt for a game's page copy.
 *
 * NOTHING HERE ENUMERATES GAMES. Every sentence is composed from fields the provider declared,
 * because a `switch` on game code is the one failure mode of the "no additional coding" claim.
 * Same rule as the contest assistant and as `12` s2's schema-driven settings form.
 *
 * THE LENGTHS ARE IMPORTED, NEVER TYPED IN. A prompt asking for 200 characters into a field
 * the form caps at 120 produces a suggestion that is silently cut - the same reasoning that
 * keeps the dialog's counters reading from `CONTENT_LIMITS` rather than from a literal.
 */
export function gameContentVocabulary(
  title: CatalogueVocabularySource,
): GameContentVocabulary {
  const subject = describeSubject(title);
  const winningRule = describeWinningRule(title.scoreDirection, title.scoreType);

  const systemPrompt = `You are a creative marketing expert for a skill-game competition platform.
Write the page copy for one game: ${subject}. This is the game's own page, not a single competition.

${describeGameFacts(title)}

IMPORTANT RULES:
- Write about playing ${title.displayName}, never about trading, investing or financial markets
- Never use these words: ${TRADING_WORDS.join(", ")}
- Do not mention a prize, an entry fee, a player count, a start time or a specific competition - those belong to a contest and change every time one is run
- Make it sound professional yet fun, and do not pad${NO_RULES_CLAIMS_RULE}${NO_FIAT_RULE}

WHAT TO RETURN. JSON only, with exactly these four keys:
{
  "displayName": "the game's name as players should see it, max ${CONTENT_LIMITS.displayName} characters",
  "tagline": "one short line under the name, max ${CONTENT_LIMITS.tagline} characters",
  "description": "what the game is and why it is fun, about 60 words",
  "highlights": [{ "title": "max ${CONTENT_LIMITS.highlightTitle} characters", "detail": "max ${CONTENT_LIMITS.highlightDetail} characters" }]
}
Return 3 highlights. Return nothing outside the JSON.`;

  return { subject, winningRule, systemPrompt };
}
