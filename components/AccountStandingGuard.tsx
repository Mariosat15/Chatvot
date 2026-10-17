"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/actions/auth.actions";

/**
 * Ends a signed-in player's visit when an operator locks, deactivates, bans or suspends them.
 *
 * // Reason: those decisions were only checked at sign-in, and the dashboard merely DISPLAYED
 * a lockout. A player on any other page - or on a phone with the tab left open - kept playing
 * until their session expired. Mounted once in `(root)/layout.tsx`, this covers every page.
 *
 * A lock or deactivation signs the player out. A ban or full suspension sends them to
 * `/account/review` instead, because that policy still lets them sign in to read why.
 */

const CHECK_INTERVAL_MS = 30_000;
const REVIEW_PATH = "/account/review";

type StandingResponse = {
  ok?: boolean;
  action?: "sign_out" | "review";
  message?: string;
};

export default function AccountStandingGuard() {
  const pathname = usePathname();
  const actedRef = useRef(false);
  const onReviewPage = pathname?.startsWith(REVIEW_PATH) ?? false;

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (actedRef.current) return;
      try {
        const response = await fetch("/api/user/account-standing", { cache: "no-store" });
        // Reason: 5xx means the CHECK failed, not the account - never kick on it.
        if (response.status >= 500) return;
        const data = (await response.json()) as StandingResponse;
        if (cancelled || data.ok !== false) return;

        if (data.action === "review") {
          if (onReviewPage) return;
          actedRef.current = true;
          toast.error(data.message ?? "Your account is under review.");
          window.location.replace(REVIEW_PATH);
          return;
        }

        actedRef.current = true;
        toast.error(data.message ?? "You have been signed out.");
        await signOut().catch(() => undefined);
        // Reason: a hard navigation drops every client cache and live socket that belonged
        // to the session that has just ended.
        window.location.replace("/sign-in");
      } catch {
        // Network error: keep the player where they are; the next check decides.
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // Reason: phones and background tabs throttle timers, so check as the screen returns.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [onReviewPage]);

  return null;
}
