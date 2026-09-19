/**
 * The rules of the puzzle, written once.
 *
 * WHY THIS IS ITS OWN MODULE RATHER THAN TEXT IN TWO PLACES
 * -------------------------------------------------------
 * These four sentences had two homes: hard-coded as list items in `public/play/index.html`, and
 * again as prose inside each title's `howToPlay`. Nothing connected them, and they had already
 * drifted - the page said "the two circles that share a number", the catalogue said "one terminal
 * to its matching pair", and the page never mentioned that a path can be redrawn at all. That is
 * the "one rule, two copies" shape behind five defects in the platform beside this service, and
 * no mirror check or typecheck can see a copy that lives in markup.
 *
 * So the list is defined here, the catalogue composes its prose from it, and the play surface is
 * handed it in the round state. A player and a game page can no longer be told different rules.
 *
 * WHY THE RULES BELONG TO THE ENGINE AND NOT TO A TITLE
 * ---------------------------------------------------
 * Both titles are the same puzzle - they differ only in how a session is framed and how the
 * number at the end is computed. The pacing sentence is the part that genuinely differs, so it is
 * the only part a title supplies. A per-title copy of the four shared rules would mean a fix to
 * the puzzle's wording had to be made twice, which is how they drifted the first time.
 */

/**
 * The four things a player has to know to play a board, in the order they need them.
 *
 * Each one is a complete sentence, because they are read as list items before a round AND joined
 * into a paragraph for the catalogue. A fragment would work in one place and read badly in the
 * other, which is how a shared list quietly acquires a second version.
 *
 * No jargon and no brand words, deliberately. Section 12 of the specification requires the game
 * to be playable with no language at all - which is why every terminal carries a numeral - but a
 * player who *can* read English should not have to discover the coverage rule by failing a board
 * and being refused.
 */
export const BOARD_RULES: readonly string[] = [
  "Drag from one terminal to the terminal with the same number to draw a path.",
  "Paths cannot cross each other or themselves.",
  "Every square on the grid must be used.",
  "Drag a path again to redraw it.",
];

/**
 * The catalogue's `howToPlay`, composed from the shared rules plus a title's own pacing note.
 *
 * The pacing note is the sentence that cannot be shared: Sprint hands out the next board the
 * moment one is finished, and Perfect's clock runs across the whole set, so "a board you are
 * still thinking about is still costing you" is true of one title and meaningless for the other.
 */
export function howToPlayProse(pacingNote: string): string {
  return [...BOARD_RULES, pacingNote].join(" ");
}
