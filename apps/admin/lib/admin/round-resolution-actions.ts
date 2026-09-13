/**
 * The manual round-resolution actions, shared by the server service and the client dialog.
 *
 * WHY IT IS ITS OWN MODULE. The first version defined this list twice - once in
 * `round-resolution.service.ts` and once inside `ResolveRoundDialog.tsx` - because the service
 * imports Mongoose models and a client component cannot pull those into the browser. That is a
 * real constraint and a bad answer: it is the **"one rule, two copies"** shape that has produced
 * four separate defects here already (`referenceId`, `failedReason`, `challengeId`, and the
 * Game Master `||` versus `??`), and `check:mirrors` sees none of them because it compares
 * models.
 *
 * The specific drift it invites: the dialog offers an action id the server has since renamed, so
 * every click returns a 400 that reads like a permissions problem. And the consequence wording -
 * the sentence telling an operator that a player will score nothing - could say one thing on
 * screen while the server does another.
 *
 * So the ids, the resulting round status and the operator-facing consequence live here, with no
 * imports at all, and both sides read them.
 */

/** The status each action moves a round to. None of them is `completed`. */
export const RESOLUTION_ACTIONS = new Map<
  string,
  { status: "voided" | "abandoned" | "expired"; label: string; consequence: string }
>([
  [
    "void",
    {
      status: "voided",
      label: "Void",
      consequence:
        "The attempt produced nothing usable. It scores nothing for the player, and settlement stops waiting for it.",
    },
  ],
  [
    "abandon",
    {
      status: "abandoned",
      label: "Abandoned",
      consequence:
        "The player started and did not finish. It scores nothing, and settlement stops waiting for it.",
    },
  ],
  [
    "expire",
    {
      status: "expired",
      label: "Expired",
      consequence:
        "The play window closed before a result arrived. It scores nothing, and settlement stops waiting for it.",
    },
  ],
]);

export type ResolutionAction = "void" | "abandon" | "expire";

/**
 * Narrow a caller-supplied value to an action the Map actually holds.
 *
 * A `Map`, not an object literal, because the key arrives in a request body. `in` and object
 * indexing both reach the prototype chain, so `"toString"` and `"__proto__"` pass - and
 * `ACTIONS["__proto__"]` returns `Object.prototype`, which is truthy, survives a `!target`
 * check, and only fails later on a missing `.status`. Safe by accident is not safe.
 */
export function isResolutionAction(value: unknown): value is ResolutionAction {
  return typeof value === "string" && RESOLUTION_ACTIONS.has(value);
}

/** The action names, for a route's error message and the dialog's buttons. */
export function resolutionActionNames(): string[] {
  return [...RESOLUTION_ACTIONS.keys()];
}

/** The shortest reason worth storing. Matches the manual-deposit and emergency-cancel gates. */
export const MIN_REASON_LENGTH = 10;
