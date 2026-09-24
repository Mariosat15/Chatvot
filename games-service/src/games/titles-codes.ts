/**
 * Game-code constants shared by `titles.ts` and `content.ts`.
 *
 * Kept tiny and import-cycle-free: content must not import the full title
 * definitions (which import content for English defaults), and titles must
 * not invent a second spelling of the codes.
 */

export const SPRINT_CODE = "circuit-sprint";
export const PERFECT_CODE = "circuit-perfect";
