/**
 * The words the content assistant is allowed to use about a contest.
 *
 * WHY THIS EXISTS. The assistant's system prompt was one hard-coded string: "a creative
 * marketing expert for a trading competition platform... content that attracts traders". On a
 * puzzle contest that produces copy about traders, markets and profit for a game that has
 * none of those things - and it produces it confidently, with no error and nothing in a log,
 * which is this codebase's recurring failure shape. It is `05` s10's rule one layer out: no
 * platform-wide text may silently mean "trading only".
 *
 * THE VOCABULARY IS DERIVED SERVER-SIDE FROM THE STORED CATALOGUE ROW, NEVER FROM THE REQUEST
 * BODY. The body carries a `gameKey`, which is a lookup key and nothing else. A caller-supplied
 * game name or genre would be a way to put arbitrary text into a system prompt - and, more
 * mundanely, a way for the wizard's own state to drift from the catalogue, so the copy
 * describes a game whose name an operator has since edited.
 *
 * NOTHING HERE ENUMERATES GAMES. Every sentence is composed from fields the provider declared
 * (`displayName`, `category`, `scoreDirection`, `scoreType`, `typicalDurationSeconds`), because
 * a `switch` on game code is the one failure mode of the "no additional coding" claim - the
 * first title needing a special case makes the claim quietly false while every existing test
 * still passes. Same shape as `12` s2's schema-driven settings form.
 */

import { resolveGameCategory } from "@/lib/services/games/game-categories";

export type ScoreDirection = "higher_is_better" | "lower_is_better";
export type ScoreType = "integer" | "decimal" | "duration_ms";

/** Exactly the catalogue fields the copy is composed from. Deliberately not the model type. */
export interface CatalogueVocabularySource {
  displayName: string;
  category?: string;
  description?: string;
  scoreDirection: ScoreDirection;
  scoreType: ScoreType;
  typicalDurationSeconds?: number;
  /** The provider's own account of how the game scores. Context only - see `describeGameFacts`. */
  rulesSummary?: string;
  /** The provider's own account of how the game is played. Context only. */
  howToPlay?: string;
  /** "points", "seconds", "lines". Display only, never parsed - see `provider-game.model.ts`. */
  scoreUnit?: string;
  supportsOneVsOne?: boolean;
}

/**
 * The Mongoose projection that fills a {@link CatalogueVocabularySource}, in one place.
 *
 * BOTH ROUTES USED TO SPELL THIS OUT, along with a hand-written `.lean<{...}>` type each. Two
 * failures follow from that and neither announces itself. A field added to the interface and
 * to one projection leaves the other assistant describing the same game from a smaller set of
 * facts - no error, no log line, just blander copy on one screen. And an explicitly-typed
 * `.lean<{...}>()` is a place a field that does not exist looks real: the compiler checks the
 * hand-written generic and not the schema, which is how the missing `scoreDirection` read in
 * R32/R33 survived two typechecks.
 *
 * A test reads the field names out of the interface above and requires each to appear here,
 * so adding one to the type and forgetting the projection fails rather than degrading.
 */
export const VOCABULARY_SELECT =
  "displayName category description scoreDirection scoreType typicalDurationSeconds rulesSummary howToPlay scoreUnit supportsOneVsOne";

export interface ContestVocabulary {
  /** For the caller's own UI copy, so the wizard and the prompt cannot disagree. */
  subject: string;
  audience: string;
  winningRule: string;
  /** The system message sent to the model. */
  systemPrompt: string;
}

/**
 * The one rule both prompts carry, and the only thing ever appended to trading's.
 *
 * A contest is denominated in credits. The model has no way of knowing that, and asked for
 * "exciting" copy about a prize it will reach for a currency symbol - which is how a generated
 * description came to promise euros for a pot the ledger pays in credits. The rule is written
 * as a prohibition rather than by naming the unit, because the unit is operator-configurable
 * and a prompt that hard-codes "Volts" is wrong the day somebody renames it.
 */
export const NO_FIAT_RULE = `
- Never name a currency or use a currency symbol - prizes are denominated in platform credits, not in any national currency`;

/**
 * Trading's prompt, character for character as it was before this module existed.
 *
 * KEPT VERBATIM ON PURPOSE. The trading wizard is the screen operators use daily, and the only
 * evidence this change does not alter what it produces is that its prompt did not change.
 * Improving it in the same edit would destroy that, which is the reasoning that kept the Game
 * Master `||` intact while settlement was extracted.
 *
 * `TRADING_SYSTEM_PROMPT` below is this string plus {@link NO_FIAT_RULE} and nothing else, so
 * the guarantee is now "the historical prompt plus one shared rule" rather than "unchanged" -
 * stated here rather than left for a reader to infer from a test that still passes.
 */
export const TRADING_SYSTEM_PROMPT_HISTORICAL = `You are a creative marketing expert for a trading competition platform. 
Generate engaging, exciting competition content that attracts traders.

IMPORTANT RULES:
- Keep the title catchy, max 60 characters
- Keep the description concise, max 50 words
- Match the theme/style requested by the user
- Use exciting language that creates urgency and excitement
- Make it sound professional yet fun
- Include relevant emojis in the title if it fits the theme
- Focus on the competitive/gaming aspect`;

export const TRADING_SYSTEM_PROMPT =
  TRADING_SYSTEM_PROMPT_HISTORICAL + NO_FIAT_RULE;

export const TRADING_VOCABULARY: ContestVocabulary = {
  subject: "trading",
  audience: "traders",
  winningRule: "the best trading performance wins",
  systemPrompt: TRADING_SYSTEM_PROMPT,
};

/**
 * Words that describe trading and describe nothing about a game.
 *
 * Stated as a ban rather than hoped for. A model told it is writing about "Circuit Sprint, a
 * puzzle game" will still reach for "traders" and "markets", because almost every other
 * sentence on this platform uses them - and copy in front of paying players saying they are
 * about to trade a puzzle is worse than plain copy.
 */
export const TRADING_WORDS = [
  "trade",
  "trades",
  "trading",
  "trader",
  "traders",
  "forex",
  "market",
  "markets",
  "pips",
  "leverage",
  "portfolio",
  "profit",
  "P&L",
  "broker",
  "currency pair",
  "buy",
  "sell",
];

/**
 * How this game decides a winner, in words, from the two fields that declare it.
 *
 * `duration_ms` is read together with the direction rather than instead of it: a title that
 * reports milliseconds and scores higher-is-better is measuring endurance, not speed, and
 * calling that "the fastest time wins" would be exactly backwards.
 */
export function describeWinningRule(
  scoreDirection: ScoreDirection,
  scoreType: ScoreType,
): string {
  if (scoreType === "duration_ms") {
    return scoreDirection === "lower_is_better"
      ? "the fastest time wins"
      : "the longest time survived wins";
  }
  return scoreDirection === "lower_is_better"
    ? "the lowest score wins"
    : "the highest score wins";
}

/**
 * A short human phrase for the game, used by the prompt and by the wizard's own preview.
 *
 * The genre goes in as its LABEL, never as the stored slug (task document 9). The stored
 * value is a grouping key, so a custom genre is held as `sci-fi` - and a model handed
 * "Circuit Sprint (sci-fi)" is being shown our database rather than being told what the game
 * is. `resolveGameCategory` returns `undefined` for an absent genre, which is why the phrase
 * degrades to the bare title rather than printing empty brackets.
 */
export function describeSubject(title: CatalogueVocabularySource): string {
  const category = resolveGameCategory(title.category);
  return category ? `${title.displayName} (${category.label})` : title.displayName;
}

/**
 * Everything the model is told about the game, composed once and used by both assistants.
 *
 * ONE DEFINITION, TWO CONSUMERS. The contest assistant and the game-page assistant were each
 * building this block, character for character, which is the "one rule, two copies" shape
 * behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`. The drift it
 * invites here is quiet: one screen learns a new catalogue field and the other keeps writing
 * copy from a smaller picture of the same game, with nothing failing.
 *
 * THE PROVIDER'S RULES ARE GIVEN, AND STILL MAY NOT BE RESTATED, and the two are not in
 * tension - which is worth saying plainly, because the next reader will see rules text in a
 * prompt that forbids rules claims and try to "fix" one of them. Handing the model the real
 * rules is the STRONGEST form of "do not invent them": a model that knows the game is about
 * clearing filled rows writes copy about stacking and surviving instead of reaching for race
 * laps, which is exactly task 20's Tetris example. What it must not do is reproduce or
 * paraphrase them, because `rulesSummary` is the authoritative text support quotes back in a
 * prize dispute (`01` s3.1) and a paraphrase beside it is a second, disagreeing account.
 *
 * AN ABSENT FIELD STATES NOTHING. No default duration, no assumed unit, no "rules to follow"
 * heading over an empty block - the recurring rule, and the reason every line here is
 * conditional.
 *
 * THIRD-PARTY TEXT REACHES THE MODEL HERE, in `description`, `rulesSummary` and `howToPlay`.
 * That is not new in kind - `description` always did - and all three are catalogue content an
 * operator can read and edit on the games screen, so none is trusted more than the rest of
 * the row.
 */
export function describeGameFacts(title: CatalogueVocabularySource): string {
  const winningRule = describeWinningRule(
    title.scoreDirection,
    title.scoreType,
  );

  const lines = [
    title.description?.trim()
      ? `- ${title.description.trim()}`
      : `- A skill game called ${title.displayName}.`,
    `- Players compete on skill, and ${winningRule}.`,
  ];

  // Read as a word and never as a number. `scoreUnit` is display-only by declaration, so the
  // model is told what a score is measured in - "points", "seconds", "lines" - and nothing
  // invites it to do arithmetic with one.
  const unit = title.scoreUnit?.trim();
  if (unit) lines.push(`- A score is measured in ${unit}.`);

  if (title.typicalDurationSeconds) {
    lines.push(`- A round takes about ${title.typicalDurationSeconds} seconds.`);
  }

  // A capability, not a contest setting: it says the game CAN be played one against one, which
  // is a fact about the game worth knowing when describing it. Whether a given contest is one
  // is not decided here and must not be implied.
  if (title.supportsOneVsOne) {
    lines.push(`- It can also be played one player against one other.`);
  }

  const rules = [title.rulesSummary?.trim(), title.howToPlay?.trim()].filter(
    (text): text is string => Boolean(text),
  );

  const context = rules.length
    ? `

THE PROVIDER'S OWN ACCOUNT OF THE GAME. Use it so the copy is accurate about what players actually do. Do not reproduce it, paraphrase it, or turn it into instructions - it is published to players separately and a second version of it would disagree with the first:
${rules.map((text) => `"""${text}"""`).join("\n")}`
    : "";

  return `WHAT THE GAME IS:
${lines.join("\n")}${context}`;
}

export function providerVocabulary(
  title: CatalogueVocabularySource,
): ContestVocabulary {
  const subject = describeSubject(title);
  const winningRule = describeWinningRule(
    title.scoreDirection,
    title.scoreType,
  );

  const systemPrompt = `You are a creative marketing expert for a skill-game competition platform.
Generate engaging, exciting competition content for a competition played on ${subject}.

${describeGameFacts(title)}

IMPORTANT RULES:
- Keep the title catchy, max 60 characters
- Keep the description concise, max 50 words
- Match the theme/style requested by the user
- Use exciting language that creates urgency and excitement
- Make it sound professional yet fun
- Include relevant emojis in the title if it fits the theme
- Write about playing ${title.displayName}, never about trading, investing or financial markets
- Never use these words: ${TRADING_WORDS.join(", ")}
- Do not claim a prize amount, a player count or a start time - the operator sets those${NO_FIAT_RULE}`;

  return {
    subject,
    audience: "players",
    winningRule,
    systemPrompt,
  };
}
