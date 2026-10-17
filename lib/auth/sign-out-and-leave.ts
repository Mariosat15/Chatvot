import { signOut } from "@/lib/actions/auth.actions";

export const SIGN_IN_PATH = "/sign-in";

/**
 * Ends the session and leaves with a full page load.
 *
 * // Reason: deleting the session cookie inside a server action makes Next.js re-render the
 * CURRENT route, and every `(root)` page then redirects itself to /sign-in while the caller's
 * own `router.push("/sign-in")` races it - so sign-out worked on some pages and silently did
 * nothing on others. A hard navigation cannot lose that race, and it also drops the client
 * router cache and live sockets that belonged to the session that just ended.
 * `replace` so Back does not return to a page the player can no longer open.
 */
export async function signOutAndLeave(): Promise<void> {
  try {
    await signOut();
  } catch (error) {
    // Reason: leave anyway - the sign-in page re-checks the session and is the safe place to land.
    console.warn("⚠️ Sign out request failed:", error);
  }
  window.location.replace(SIGN_IN_PATH);
}
