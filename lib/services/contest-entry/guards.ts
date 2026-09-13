/**
 * The contest-entry guards that do not need the transaction.
 *
 * Split out of `contest-entry.service.ts` to keep the transaction body readable. Both
 * functions return a failure to propagate, or null to continue - they never throw, because
 * the service's caller may be a server action that cannot surface a thrown message.
 */

import type { ContestEntryActor, ContestEntryFailure } from "./types";
import { fail } from "./types";

/**
 * The two account-standing gates: is this account restricted, and does the fraud gate
 * allow it to enter a paid contest right now.
 *
 * Separate from `checkActor` so that the challenge accept route can use exactly these two
 * without inheriting competition wording or a duplicate email check it already performs.
 * Sub-defect 1b was that the accept route had neither, while competition entry had both -
 * and a challenge is the easiest shape for coordinated entry, being exactly two players
 * with the pot returning to the pair minus the platform fee. Proven and then fixed on
 * 1 September 2026; see `__tests__/services/challenge-accept-guards.test.ts`.
 *
 * `action` decides which restriction flag is consulted, and the two are NOT
 * interchangeable: `enterCompetition` blocks unless `canEnterCompetitions` is truthy,
 * whereas `enterChallenge` blocks only on an explicit `false`, because restrictions
 * created before that field existed have it undefined and must stay allowed. Passing the
 * wrong one would silently change who is admitted.
 */
export async function checkAccountStanding(
  actor: ContestEntryActor,
  action: "enterCompetition" | "enterChallenge",
  refusalMessage: string,
): Promise<ContestEntryFailure | null> {
  const { canUserPerformAction } = await import(
    "@/lib/services/user-restriction.service"
  );
  const restriction = await canUserPerformAction(actor.userId, action);
  if (!restriction.allowed) {
    return fail("restricted", restriction.reason || refusalMessage);
  }

  // Enforces the VPN/proxy/Tor/datacenter blocks, device-risk and suspicion-score
  // thresholds, and the per-hour entry throttle. Admin-configurable, and fails OPEN so a
  // detection outage never blocks a legitimate player.
  const { assertEntryFraudGate } = await import(
    "@/lib/services/fraud/entry-fraud-gate.service"
  );
  const fraud = await assertEntryFraudGate({
    userId: actor.userId,
    ip: actor.ip || undefined,
  });
  if (!fraud.allowed) {
    return fail(
      "fraud_blocked",
      fraud.reason || "Entry is not allowed at this time.",
    );
  }

  return null;
}

/**
 * The person-level gates for competition entry. These depend on the account rather than
 * the contest, so they run once before the transaction rather than inside every retry.
 */
export async function checkActor(
  actor: ContestEntryActor,
): Promise<ContestEntryFailure | null> {
  if (actor.trusted) return null;

  // Reason: unverified accounts were occupying seats and skewing matchmaking.
  if (actor.emailVerified !== true) {
    return fail(
      "email_unverified",
      "Please verify your email address before entering competitions.",
    );
  }

  return checkAccountStanding(
    actor,
    "enterCompetition",
    "You are not allowed to enter competitions",
  );
}

/** The level requirement, if the contest sets one. Kept out of the transaction body. */
export async function checkLevelRequirement(
  userId: string,
  requirement: { enabled?: boolean; minLevel?: number; maxLevel?: number },
): Promise<ContestEntryFailure | null> {
  if (!requirement?.enabled) return null;

  const { getUserLevel } = await import("@/lib/services/xp-level.service");
  const { getTitleByXP, TITLE_LEVELS } = await import("@/lib/constants/levels");

  const level = await getUserLevel(userId);
  const current = getTitleByXP((level as { currentXP?: number })?.currentXP || 0);

  if (requirement.minLevel && current.level < requirement.minLevel) {
    const required = TITLE_LEVELS[requirement.minLevel - 1];
    return fail(
      "level_requirement",
      `This competition requires ${required.title} (Level ${required.level}) or higher. You are currently ${current.title} (Level ${current.level}).`,
    );
  }

  if (requirement.maxLevel && current.level > requirement.maxLevel) {
    const max = TITLE_LEVELS[requirement.maxLevel - 1];
    return fail(
      "level_requirement",
      `This competition is only for traders up to ${max.title} (Level ${max.level}). You are ${current.title} (Level ${current.level}).`,
    );
  }

  return null;
}
