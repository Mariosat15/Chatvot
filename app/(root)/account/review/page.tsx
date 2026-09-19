import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/better-auth/auth";
import { getUserRestrictions } from "@/lib/services/user-restriction.service";
import { toReviewPacket } from "@/lib/services/account-review.service";

import AccountReviewClient from "./AccountReviewClient";

/**
 * /account/review — shown to users whose account is under review.
 *
 * Server component that resolves the user's active restrictions, converts
 * them into the public "review packet" shape and hands them to the client
 * UI. If there is no active restriction we send the user back to their
 * dashboard so this page is never reachable for normal users.
 */
export const dynamic = "force-dynamic";

export default async function AccountReviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const restrictions = await getUserRestrictions(userId);
  if (restrictions.length === 0) {
    redirect("/dashboard");
  }

  const packets = restrictions.map((r) => toReviewPacket(r));

  return <AccountReviewClient restrictions={packets} />;
}
