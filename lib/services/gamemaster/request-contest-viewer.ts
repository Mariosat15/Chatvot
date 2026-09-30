import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { resolveContestViewer } from "./contest-viewer.service";
import type { ContestViewer } from "./visible-contests";

/**
 * The contest viewer for the current request, from the session cookie. Server components and
 * server actions only. Never throws: an unreadable session is an anonymous viewer, which sees
 * public contests only (R117).
 *
 * Reason: kept apart from `contest-viewer.service.ts` so services that already hold a user id
 * do not pull the auth module (and its request context) in with the resolver.
 */
export async function resolveRequestContestViewer(): Promise<ContestViewer | null> {
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  return resolveContestViewer(userId);
}
