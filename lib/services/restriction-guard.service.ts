import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/better-auth/auth";
import { canUserPerformAction } from "@/lib/services/user-restriction.service";
import type { BlockedAction } from "@/lib/services/account-review.service";

/**
 * Server-component guard that redirects the user to /account/review when
 * their active restriction blocks the supplied action.
 *
 * Intended call sites are the `page.tsx` (or `layout.tsx`) of routes whose
 * entire purpose is a blocked action:
 *   - /wallet           → "withdraw"   (deposit-only pages can use "deposit")
 *   - /challenges       → "enterCompetition"
 *   - /competitions     → "enterCompetition"
 *   - /championship     → "enterCompetition"
 *   - /arena            → "trade"
 *
 * // Reason: We don't use Next.js middleware for this because middleware
 * runs on the Edge runtime where Mongoose is unavailable. Calling this
 * helper from a server component achieves the same UX ("bounce to
 * /account/review") with full Node runtime access and no HTTP hop.
 *
 * The helper silently no-ops for signed-out users — auth middleware or
 * upstream session checks handle the unauthenticated case separately.
 */
export async function redirectIfRestricted(
  action: BlockedAction,
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return;

  const result = await canUserPerformAction(userId, action);
  if (!result.allowed) {
    redirect("/account/review");
  }
}
