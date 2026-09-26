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
 * So the list is defined here (via `content.ts`), the catalogue composes its prose from it, and
 * the play surface is handed it in the round state. A player and a game page can no longer be
 * told different rules.
 *
 * Localised variants live in `content.ts` (A11 / X4a). This module re-exports the English
 * defaults and the composer so existing imports keep working.
 */

export {
  BOARD_RULES,
  boardRulesFor,
  howToPlayProse,
  howToPlayFor,
} from "./content";
