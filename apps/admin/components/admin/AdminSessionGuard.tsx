"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Signs an employee out of the admin app when the server says their session is no longer
 * valid - suspended, locked out, force-logged-out or password changed.
 *
 * // Reason: this used to live inside AdminDashboard, so the kick only happened on
 * `/dashboard`. An employee sitting on a standalone page (competition view/edit/create,
 * challenge view) was never told and kept working until they navigated. Mounted once in the
 * root layout, it covers every admin page, desktop and mobile alike.
 */

const CHECK_INTERVAL_MS = 30_000;

const REASON_MESSAGES = new Map<string, string>([
  ["account_disabled", "Your account has been suspended"],
  ["locked_out", "Your account has been locked by an administrator"],
  ["force_logout", "You have been logged out by an administrator"],
  ["password_changed", "Your password was changed. Please log in again."],
]);

// Reason: "error" means the check itself failed on the server. Kicking on it would sign
// everybody out during a database blip, so it is treated like a network error.
const NON_FATAL_REASONS = new Set(["error"]);

export default function AdminSessionGuard() {
  const pathname = usePathname();
  const kickedRef = useRef(false);
  const onLoginPage = pathname === "/login" || pathname?.startsWith("/login/");

  useEffect(() => {
    if (onLoginPage) {
      kickedRef.current = false;
      return;
    }

    let cancelled = false;

    const checkSession = async () => {
      if (kickedRef.current) return;
      try {
        const response = await fetch("/api/auth/check-session", { cache: "no-store" });
        const data = (await response.json()) as { valid?: boolean; reason?: string };
        if (cancelled || data.valid !== false) return;
        if (data.reason && NON_FATAL_REASONS.has(data.reason)) return;

        kickedRef.current = true;
        toast.error(
          REASON_MESSAGES.get(data.reason ?? "") ?? "Session expired. Please log in again.",
        );

        // Reason: clear the cookie before leaving, or a page that only checks for the
        // token's presence can bounce the employee straight back in.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        // Reason: a hard navigation, not router.push - it drops every client-side cache and
        // in-flight request belonging to the session that has just been revoked.
        window.location.replace("/login");
      } catch {
        // Network error: let the employee keep working; the next check will decide.
      }
    };

    checkSession();
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);
    // Reason: a phone or a backgrounded tab throttles timers, so check the moment the
    // screen comes back rather than waiting up to a full interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") checkSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [onLoginPage, pathname]);

  return null;
}
