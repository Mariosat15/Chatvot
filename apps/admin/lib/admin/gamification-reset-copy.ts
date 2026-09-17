/**
 * Operator-facing wording and identifiers for the wizard's two modes.
 *
 * Reason: this module is MODEL-FREE by requirement, not by preference. The
 * wizard panel is a `"use client"` component, so anything it imports is bundled
 * for the browser — and `gamification-reset.service.ts` reaches Mongoose models
 * (R58). Writing the scope ids and the confirmation phrase a second time inside
 * the component is the "one rule, two copies" shape: a button offering a scope
 * id the server has renamed fails with a 400 that reads like a permissions
 * problem, and a confirmation phrase that drifts refuses every reset while the
 * screen insists the operator typed it correctly.
 */

export const GAMIFICATION_RESET_CONFIRMATION = "RESET GAMIFICATION";

export type GamificationResetScope = "badges" | "milestones" | "levels";

export const ALL_GAMIFICATION_RESET_SCOPES: readonly GamificationResetScope[] = [
  "badges",
  "milestones",
  "levels",
];

export interface GamificationResetScopeCopy {
  id: GamificationResetScope;
  label: string;
  /** What an operator loses. Stated as a consequence, never as a field list. */
  consequence: string;
}

export const GAMIFICATION_RESET_SCOPE_COPY: readonly GamificationResetScopeCopy[] =
  [
    {
      id: "badges",
      label: "Badges",
      consequence:
        "Every badge definition is deleted, including the shipped catalogue and any you have written. Badges players already earned are kept unless you also clear player progress.",
    },
    {
      id: "milestones",
      label: "Milestones & journey maps",
      consequence:
        "Every journey map and its milestones are deleted. Players' recorded progress through them is kept unless you also clear player progress.",
    },
    {
      id: "levels",
      label: "Levels & XP",
      consequence:
        "The level ladder, its titles and the badge XP values are deleted. Players keep their earned XP and level rows unless you also clear player progress.",
    },
  ];

export const GAMIFICATION_RESET_PROGRESS_WARNING =
  "Also delete what players have already earned — badges, levels and journey progress. This cannot be undone and is not covered by any backup the wizard takes.";

export const GAMIFICATION_REBUILD_WARNING =
  "Rebuild deletes the selected content and then builds a fresh system in the same run. The shipped defaults will NOT come back on their own afterwards — restoring them is a separate action on the Badges & XP screen.";
