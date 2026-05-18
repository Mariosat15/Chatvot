"use client";

import { useState } from "react";
import { toast } from "sonner";
import { notifyGmSubscriptionChanged } from "@/lib/events/gm-subscription";

interface SubscriptionState {
  autoRenew?: boolean;
  isPaused?: boolean;
  scheduledForDeletion?: boolean;
  endDate?: string;
}

/**
 * Custom hook encapsulating GM subscription toggle operations.
 * Reason: Extracted from page-content.tsx to keep the main component under 500 lines.
 */
export function useGmSubscription(
  getSubscription: () => SubscriptionState | null,
  updateSubscription: (partial: Partial<SubscriptionState>) => void,
  // Reason: a successful renewal extends the endDate, resets the period
  // counters and may swap the package limits. Partial updates aren't enough;
  // the page must refetch the dashboard. Optional so non-renewal callers
  // don't have to wire it up.
  onRefresh?: () => Promise<void> | void,
) {
  const [togglingRenewal, setTogglingRenewal] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [schedulingCancel, setSchedulingCancel] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [renewingNow, setRenewingNow] = useState(false);

  const toggleAutoRenew = async () => {
    const sub = getSubscription();
    if (!sub) return;
    try {
      setTogglingRenewal(true);
      const res = await fetch("/api/gamemaster/toggle-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !sub.autoRenew }),
      });
      const result = await res.json();
      if (result.success) {
        updateSubscription({ autoRenew: !sub.autoRenew });
        toast.success(
          `Auto-renewal ${!sub.autoRenew ? "enabled" : "disabled"}`,
        );
      } else {
        toast.error(result.error || "Failed to update auto-renewal");
      }
    } catch {
      toast.error("Failed to update auto-renewal");
    } finally {
      setTogglingRenewal(false);
    }
  };

  const togglePause = async () => {
    const sub = getSubscription();
    if (!sub) return;
    const action = sub.isPaused ? "resume" : "pause";
    try {
      setTogglingPause(true);
      const res = await fetch("/api/gamemaster/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (result.success) {
        updateSubscription({ isPaused: !sub.isPaused });
        toast[action === "pause" ? "warning" : "success"](
          action === "pause"
            ? "Subscription paused. You will NOT receive referral fees while paused."
            : "Subscription resumed! Referral fees are active again.",
        );
      } else {
        toast.error(result.error || `Failed to ${action} subscription`);
      }
    } catch {
      toast.error(`Failed to ${action} subscription`);
    } finally {
      setTogglingPause(false);
    }
  };

  const toggleScheduledCancellation = async () => {
    const sub = getSubscription();
    if (!sub) return;
    const isScheduled = sub.scheduledForDeletion;
    const action = isScheduled ? "unschedule" : "schedule";
    try {
      setSchedulingCancel(true);
      const res = await fetch("/api/gamemaster/schedule-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (result.success) {
        updateSubscription({
          scheduledForDeletion: !isScheduled,
          autoRenew: isScheduled ? sub.autoRenew : false,
        });
        if (action === "schedule") {
          const days = sub.endDate
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(sub.endDate).getTime() - Date.now()) / 86400000,
                ),
              )
            : 0;
          toast.info(
            `Scheduled for deletion after ${days} days. You will continue earning until then.`,
          );
        } else {
          toast.success(
            "Cancellation cancelled. Your subscription will not be deleted.",
          );
        }
        setShowCancelConfirm(false);
      } else {
        toast.error(result.error || `Failed to ${action} cancellation`);
      }
    } catch {
      toast.error(`Failed to ${action} cancellation`);
    } finally {
      setSchedulingCancel(false);
    }
  };

  const renewNow = async () => {
    try {
      setRenewingNow(true);
      const res = await fetch("/api/gamemaster/renew", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        notifyGmSubscriptionChanged();
        toast.success(result.message || "Subscription renewed", {
          description: result.subscription?.endDate
            ? `Active until ${new Date(result.subscription.endDate).toLocaleDateString()}`
            : undefined,
          duration: 6000,
        });
        if (onRefresh) {
          await onRefresh();
        }
      } else if (
        result.details?.required !== undefined &&
        result.details?.available !== undefined
      ) {
        toast.error("Insufficient credits", {
          description: `Need ⚡ ${result.details.required}, you have ⚡ ${result.details.available}.`,
        });
      } else {
        toast.error(result.error || "Failed to renew subscription");
      }
    } catch {
      toast.error("Failed to renew subscription");
    } finally {
      setRenewingNow(false);
    }
  };

  return {
    togglingRenewal,
    togglingPause,
    schedulingCancel,
    showCancelConfirm,
    setShowCancelConfirm,
    toggleAutoRenew,
    togglePause,
    toggleScheduledCancellation,
    renewNow,
    renewingNow,
  };
}
