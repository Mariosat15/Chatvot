"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CompetitionStatusMonitorProps {
  competitionId: string;
  initialStatus: string;
  startTime: string; // ISO string — used for adaptive polling
  userId: string; // Current user's ID to check their ranking
}

// Polling thresholds (ms)
const POLL_FAST = 5_000; // 5s — when start time is imminent (within 2 min)
const POLL_NORMAL = 15_000; // 15s — when start time is within 10 min
const POLL_SLOW = 30_000; // 30s — default, far from transitions

/**
 * Monitors competition status and refreshes/redirects when status changes.
 *
 * Adaptive polling: polls faster as the start time approaches so the
 * "Start Trading" button appears within seconds of the transition, then
 * backs off to 30s for active/far-future competitions.
 *
 * Visibility-aware: pauses polling when the tab is hidden.
 */
export default function CompetitionStatusMonitor({
  competitionId,
  initialStatus,
  startTime,
  userId,
}: CompetitionStatusMonitorProps) {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const lastStatusRef = useRef(initialStatus);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  // Reason: Compute the appropriate poll interval based on how close we are
  // to the competition start time. Faster polling near transitions means the
  // user sees changes within seconds instead of waiting 30s.
  const getPollInterval = useCallback(() => {
    const msUntilStart =
      new Date(startTime).getTime() - Date.now();

    if (msUntilStart <= 0) return POLL_FAST; // Already past start — check rapidly
    if (msUntilStart <= 2 * 60 * 1000) return POLL_FAST; // Within 2 min
    if (msUntilStart <= 10 * 60 * 1000) return POLL_NORMAL; // Within 10 min
    return POLL_SLOW;
  }, [startTime]);

  const checkCompetitionStatus = useCallback(async () => {
    if (!isVisibleRef.current || hasRedirectedRef.current) return;

    try {
      const response = await fetch(
        `/api/competitions/${competitionId}/status?userId=${userId}`,
      );
      if (!response.ok) {
        if (response.status === 404) return;
        return;
      }

      const data = await response.json();

      // If status changed, handle it
      if (
        data.status !== lastStatusRef.current &&
        !hasRedirectedRef.current
      ) {
        // Reason: Capture the OLD status BEFORE updating the ref so that
        // the transition-specific checks below can compare old → new.
        const previousStatus = lastStatusRef.current;
        lastStatusRef.current = data.status;

        // Handle cancelled competitions
        if (data.status === "cancelled") {
          hasRedirectedRef.current = true;
          clearScheduledPoll();

          toast.error("🚫 Competition Cancelled!", {
            description:
              data.cancellationReason ||
              "The competition did not meet minimum participants. Your entry fee has been refunded.",
            duration: 8000,
          });

          router.refresh();
          return;
        }

        // Handle started competitions (upcoming → active)
        if (data.status === "active" && previousStatus === "upcoming") {
          toast.success("🚀 Competition Started!", {
            description: "The competition is now live. Good luck!",
            duration: 5000,
          });
          router.refresh();
          return;
        }

        // Handle completed competitions (active → completed)
        if (data.status === "completed") {
          hasRedirectedRef.current = true;
          clearScheduledPoll();

          // Show personalized notification based on user's ranking
          const userRank = data.userRank;
          const totalParticipants = data.totalParticipants || 0;
          const prizeWon = data.prizeWon || 0;

          if (userRank === 1) {
            toast.success("🏆 You Won!", {
              description:
                prizeWon > 0
                  ? `Congratulations! You finished 1st and won ${prizeWon} credits!`
                  : "Congratulations! You finished in 1st place!",
              duration: 6000,
            });
          } else if (userRank === 2) {
            toast.success("🥈 2nd Place!", {
              description:
                prizeWon > 0
                  ? `Great job! You finished 2nd and won ${prizeWon} credits!`
                  : "Great job! You finished in 2nd place!",
              duration: 6000,
            });
          } else if (userRank === 3) {
            toast.success("🥉 3rd Place!", {
              description:
                prizeWon > 0
                  ? `Well done! You finished 3rd and won ${prizeWon} credits!`
                  : "Well done! You finished in 3rd place!",
              duration: 6000,
            });
          } else if (userRank && userRank <= 10) {
            toast.info(`📊 Competition Ended - ${userRank}th Place`, {
              description: `You finished ${userRank}/${totalParticipants}. View the full results.`,
              duration: 5000,
            });
          } else if (userRank) {
            toast("⚔️ Competition Ended", {
              description: `You finished ${userRank}/${totalParticipants}. Better luck next time!`,
              duration: 5000,
            });
          } else {
            toast("⚔️ Competition Ended", {
              description: "View the final results and rankings.",
              duration: 5000,
            });
          }

          // Reason: Send ALL users to results page on completion.
          // Non-participants are handled by the results page itself
          // (it redirects them back to the detail page).
          setTimeout(() => {
            router.push(`/competitions/${competitionId}/results`);
            router.refresh();
          }, 2000);
          return;
        }

        // Any other status change — just refresh
        router.refresh();
      }
    } catch {
      // Fail silently
    }
   
  }, [competitionId, userId, router]);

  // Reason: Schedule the next poll with the current adaptive interval.
  // Using setTimeout (not setInterval) lets us re-calculate the interval
  // each cycle — it naturally speeds up as start time approaches.
  const scheduleNextPoll = useCallback(() => {
    if (hasRedirectedRef.current) return;
    const interval = getPollInterval();
    pollTimerRef.current = setTimeout(async () => {
      await checkCompetitionStatus();
      scheduleNextPoll(); // chain next poll
    }, interval);
  }, [getPollInterval, checkCompetitionStatus]);

  const clearScheduledPoll = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    // Only poll for competitions that can still change
    if (!["upcoming", "active"].includes(initialStatus)) return;

    // Initial check after 2s, then start adaptive chain
    const initTimer = setTimeout(() => {
      checkCompetitionStatus();
      scheduleNextPoll();
    }, 2000);

    // Visibility-aware: pause when hidden, resume + immediate check when visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        isVisibleRef.current = true;
        checkCompetitionStatus();
        scheduleNextPoll();
      } else {
        isVisibleRef.current = false;
        clearScheduledPoll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initTimer);
      clearScheduledPoll();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialStatus, checkCompetitionStatus, scheduleNextPoll]);

  return null;
}
