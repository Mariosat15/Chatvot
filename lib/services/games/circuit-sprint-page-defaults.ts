/**
 * Fallback chrome for Circuit Sprint when the operator has not authored Page theme fields.
 *
 * WHY READ-TIME DEFAULTS RATHER THAN A DB MIGRATION. The live title may already have
 * operator edits on other fields; a blind write of theme/quote/steps would overwrite
 * an intentional blank. Filling only when the field is absent keeps the admin editor
 * truthful (empty stays empty until they save) while the player page stops looking bare.
 *
 * Scoped to `circuit-sprint` by gameCode — never by display name — so a renamed title
 * still gets the mock chrome and a different puzzle does not.
 */

export const CIRCUIT_SPRINT_GAME_CODE = "circuit-sprint";

export const CIRCUIT_SPRINT_PAGE_DEFAULTS = {
  pageThemeId: "circuit-neon",
  stylizedQuote: "Connect the paths, beat the clock!",
  howItWorksSteps: [
    {
      title: "Connect",
      detail: "Match identical numbers with paths.",
    },
    {
      title: "No Crossings",
      detail: "Paths cannot cross each other.",
    },
    {
      title: "Complete & Score",
      detail: "Fill the board and submit your score.",
    },
  ],
} as const;

export function isCircuitSprintGameCode(
  gameCode: string | null | undefined,
): boolean {
  return (
    typeof gameCode === "string" &&
    gameCode.trim().toLowerCase() === CIRCUIT_SPRINT_GAME_CODE
  );
}
