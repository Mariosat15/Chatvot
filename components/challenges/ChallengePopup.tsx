"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Swords,
  Check,
  X,
  Clock,
  Trophy,
  Coins,
  Timer,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import useWebSocket from "@/hooks/useWebSocket";
import NotificationPopupCard, {
  popupHref,
  type PushedNotification,
} from "@/components/notifications/NotificationPopupCard";
import { broadcastNotificationPush } from "@/lib/utils/notification-events";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingChallenge {
  _id: string;
  slug: string;
  challengerName: string;
  entryFee: number;
  duration: number;
  winnerPrize: number;
  startingCapital: number;
  rankingMethod: string;
  acceptDeadline: string;
  createdAt: string;
}

interface ChallengePopupProps {
  userId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ANIMATION_DURATION_MS = 400;

/**
 * How long a lifecycle card stays on screen.
 *
 * Reason: an incoming challenge card persists until its accept deadline because
 * it is asking a question. A card reporting something that has already happened
 * is not, so it clears itself — but slowly enough to be read and clicked, since
 * the click is the whole point of it.
 */
const EVENT_CARD_LIFETIME_MS = 15_000;

/**
 * Which pushed notifications become a banner.
 *
 * Reason: every notification is now pushed over the socket, and most must not
 * pop up — `position_closed` and `order_filled` fire continuously while somebody
 * trades, so showing all of them would bury the ones a player has to act on.
 * The bell still receives all of them.
 */
const POPUP_CATEGORIES = new Set(["challenge"]);

/**
 * A challenge invitation already has its own card, with Accept and Decline on
 * it. Reason: without this the same event would appear twice, once as a banner
 * that can only be read and once as one that can be answered.
 */
const SUPPRESSED_TEMPLATE_IDS = new Set(["challenge_received"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function rankLabel(method: string): string {
  // Map, never object index — method arrives from the challenge payload.
  const labels = new Map<string, string>([
    ["pnl", "P&L"],
    ["roi", "ROI %"],
    ["total_capital", "Capital"],
    ["win_rate", "Win Rate"],
    ["total_wins", "Total Wins"],
    ["profit_factor", "Profit Factor"],
  ]);
  return labels.get(method) || "P&L";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChallengePopup({ userId }: ChallengePopupProps) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [events, setEvents] = useState<PushedNotification[]>([]);
  const [exitingEventIds, setExitingEventIds] = useState<Set<string>>(
    new Set(),
  );
  const eventTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0); // Force re-render for countdown
  const initialFetchDone = useRef(false);

  // ─── WebSocket: listen for instant challenge pushes ──────────────────────

  const handleWsMessage = useCallback(
    (message: { type: string; data: unknown }) => {
      // A stored notification, pushed the instant it was created. One case
      // covers every template, so a new one needs no change here.
      if (message.type === "notification") {
        const n = message.data as PushedNotification;
        if (!n?._id) return;

        // Reason: relayed before the popup filter, so the bell's badge updates
        // for every category while only some become banners.
        broadcastNotificationPush(n);

        if (!n.category || !POPUP_CATEGORIES.has(n.category)) return;
        if (n.templateId && SUPPRESSED_TEMPLATE_IDS.has(n.templateId)) return;

        setEvents((prev) => {
          if (prev.some((existing) => existing._id === n._id)) return prev;
          return [n, ...prev];
        });
        return;
      }

      if (message.type !== "challenge_received") return;

      const c = message.data as PendingChallenge;
      if (!c?._id) return;

      // Add to the list if not already present
      setChallenges((prev) => {
        if (prev.some((existing) => existing._id === c._id)) return prev;
        return [c, ...prev]; // Newest first
      });
    },
    [],
  );

  // Reason: The WS server authenticates using the raw userId as token.
  // This mirrors how messaging, friend requests, and presence work.
  useWebSocket({
    token: userId,
    onMessage: handleWsMessage,
  });

  // ─── Initial fetch: catch challenges that arrived while offline ──────────

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    (async () => {
      try {
        const res = await fetch("/api/challenges/pending-popup");
        if (!res.ok) return;

        const data = await res.json();
        setPopupEnabled(data.popupEnabled !== false);
        if (data.challenges?.length) {
          setChallenges(data.challenges);
        }
      } catch {
        // Silent fail — WS push is the primary delivery mechanism
      }
    })();
  }, []);

  // ─── localStorage: persist dismissed IDs ─────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem("challenge_popup_dismissed");
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setDismissedIds(new Set(parsed));
      }
    } catch {
      // Silent - localStorage might be unavailable
    }
  }, []);

  useEffect(() => {
    if (dismissedIds.size > 0) {
      try {
        // Keep only the last 50 dismissed IDs to prevent localStorage bloat
        const arr = Array.from(dismissedIds).slice(-50);
        localStorage.setItem("challenge_popup_dismissed", JSON.stringify(arr));
      } catch {
        // Silent
      }
    }
  }, [dismissedIds]);

  // ─── Countdown timer for deadline display (1s tick) ──────────────────────

  useEffect(() => {
    if (challenges.length === 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    countdownRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [challenges.length]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const dismissChallenge = useCallback((id: string) => {
    setExitingId(id);
    setTimeout(() => {
      setDismissedIds((prev) => new Set([...prev, id]));
      setExitingId(null);
    }, ANIMATION_DURATION_MS);
  }, []);

  const dismissEvent = useCallback((id: string) => {
    setExitingEventIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e._id !== id));
      setExitingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, ANIMATION_DURATION_MS);
  }, []);

  const openEvent = useCallback(
    (notification: PushedNotification) => {
      // Reason: the destination is the notification's own actionUrl, resolved by
      // the same helper the fallback lives in, so the banner and the bell cannot
      // send a player to two different places for one event.
      const href = popupHref(notification);
      dismissEvent(notification._id);
      router.push(href);
    },
    [dismissEvent, router],
  );

  // ─── Lifecycle cards clear themselves ────────────────────────────────────

  useEffect(() => {
    // Reason: a card is scheduled once and remembered, because this effect
    // re-runs whenever another notification arrives — rescheduling every card
    // on each run would let a steady trickle keep the oldest one on screen for
    // ever. The timers are cleared on unmount only, in the effect below.
    const timers = eventTimers.current;
    for (const event of events) {
      if (timers.has(event._id)) continue;
      timers.set(
        event._id,
        setTimeout(() => {
          timers.delete(event._id);
          dismissEvent(event._id);
        }, EVENT_CARD_LIFETIME_MS),
      );
    }
  }, [events, dismissEvent]);

  useEffect(() => {
    const timers = eventTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const handleAccept = useCallback(
    async (challengeId: string) => {
      setAcceptingId(challengeId);
      try {
        const res = await fetch(`/api/challenges/${challengeId}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();

        if (res.ok && data.success) {
          toast.success("⚔️ Challenge accepted! Battle begins now!");
          dismissChallenge(challengeId);
          // Reason: `/play` is the dispatcher for every challenge; `/trade` only redirects in.
          router.push(`/challenges/${challengeId}/play`);
        } else {
          toast.error(data.error || "Failed to accept challenge");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setAcceptingId(null);
      }
    },
    [dismissChallenge, router],
  );

  const handleDecline = useCallback(
    async (challengeId: string) => {
      setDecliningId(challengeId);
      try {
        const res = await fetch(`/api/challenges/${challengeId}/decline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();

        if (res.ok && data.success) {
          toast.info("Challenge declined");
          dismissChallenge(challengeId);
        } else {
          toast.error(data.error || "Failed to decline challenge");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setDecliningId(null);
      }
    },
    [dismissChallenge],
  );

  const handleDisablePopups = useCallback(async () => {
    try {
      await fetch("/api/challenges/pending-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      setPopupEnabled(false);
      toast.info(
        "Challenge popups disabled. Re-enable in Notification Settings.",
      );
    } catch {
      toast.error("Failed to update preference");
    }
  }, []);

  // ─── Filter visible challenges ───────────────────────────────────────────

  const visibleChallenges = challenges.filter(
    (c) =>
      !dismissedIds.has(c._id) &&
      new Date(c.acceptDeadline).getTime() > Date.now(),
  );

  // Reason: `popupEnabled` gates the lifecycle cards as well as the invitation
  // cards. Both are challenge popups, and a player who switched them off did
  // not ask to keep half of them.
  if (!popupEnabled) return null;
  if (visibleChallenges.length === 0 && events.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      style={{ maxHeight: "calc(100vh - 2rem)" }}
    >
      {events.map((event) => (
        <NotificationPopupCard
          key={event._id}
          notification={event}
          exiting={exitingEventIds.has(event._id)}
          animationMs={ANIMATION_DURATION_MS}
          onOpen={() => openEvent(event)}
          onDismiss={() => dismissEvent(event._id)}
        />
      ))}

      {visibleChallenges.map((challenge) => {
        const isExiting = exitingId === challenge._id;
        const isAccepting = acceptingId === challenge._id;
        const isDeclining = decliningId === challenge._id;
        const remaining = timeLeft(challenge.acceptDeadline);
        const isExpired = remaining === "Expired";

        return (
          <div
            key={challenge._id}
            className="pointer-events-auto"
            style={{
              animation: isExiting
                ? `challengePopupExit ${ANIMATION_DURATION_MS}ms ease-in forwards`
                : `challengePopupEnter ${ANIMATION_DURATION_MS}ms ease-out`,
            }}
          >
            <div className="relative overflow-hidden rounded-xl border border-orange-500/40 bg-gray-950/95 backdrop-blur-xl shadow-2xl shadow-orange-500/10">
              {/* Top glow bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, #f97316, #eab308, #f97316, transparent)",
                  animation: "challengeGlowSlide 2s linear infinite",
                }}
              />

              {/* Header */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <div className="relative">
                  <Swords className="h-5 w-5 text-orange-400" />
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"
                    style={{
                      animation:
                        "challengePulseDot 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
                  Challenge!
                </span>
                <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isExpired ? (
                    <span className="text-red-400">Expired</span>
                  ) : (
                    <span className="text-yellow-400 font-mono">
                      {remaining}
                    </span>
                  )}
                </span>
              </div>

              {/* Body */}
              <div className="px-4 pb-2">
                <p className="text-white text-sm font-medium">
                  <span className="text-orange-300">
                    {challenge.challengerName}
                  </span>{" "}
                  has challenged you!
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Coins className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {challenge.entryFee} credits
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <Trophy className="h-3.5 w-3.5" />
                    <span className="font-medium">{challenge.winnerPrize}</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-400">
                    <Timer className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {formatDuration(challenge.duration)}
                    </span>
                  </div>
                  <span className="text-gray-500 text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80">
                    {rankLabel(challenge.rankingMethod)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                {!isExpired && (
                  <>
                    <button
                      onClick={() => handleAccept(challenge._id)}
                      disabled={isAccepting || isDeclining}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAccepting ? (
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-black/30 border-t-black rounded-full" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(challenge._id)}
                      disabled={isAccepting || isDeclining}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold text-white bg-red-600/80 hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeclining ? (
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Decline
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    dismissChallenge(challenge._id);
                    router.push(`/challenges/${challenge._id}`);
                  }}
                  className="h-8 px-3 rounded-lg text-xs font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
                >
                  View
                </button>
              </div>

              {/* Don't show popups toggle - only on first card */}
              {visibleChallenges[0]?._id === challenge._id && (
                <div className="border-t border-gray-800/50 px-4 py-1.5">
                  <button
                    onClick={handleDisablePopups}
                    className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <EyeOff className="h-3 w-3" />
                    Don&apos;t show challenge popups
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
