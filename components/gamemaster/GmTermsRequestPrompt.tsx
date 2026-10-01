"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ActionTermsDialog, { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";
import { NOTIFICATION_PUSH_EVENT } from "@/lib/utils/notification-events";

const GENERIC_ERROR = "Something went wrong. Please contact support.";
const REQUEST_URL = "/api/gamemaster/terms-request";

/**
 * The window a player sees when their Game Master presses "Send T&C"
 * (`External game plans/24` s5.5).
 *
 * It opens in three ways, all through the same server read: on page load (the email link and
 * the bell both land on a page with this mounted), and the moment the request arrives on an
 * open tab, because the notification push carries `templateId: "gm_terms_request"`.
 * Reason: the server decides whether to show it - a request already answered, or about an
 * affiliation that has since ended, returns `show: false`, so pressing an old email does nothing.
 */
export default function GmTermsRequestPrompt() {
  const router = useRouter();
  const [gm, setGm] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(REQUEST_URL, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.show || typeof data.gameMasterId !== "string") return;
      setGm({ id: data.gameMasterId, name: data.gameMasterName || "your Game Master" });
    } catch {
      // Reason: fail quiet - the request stays pending and is asked on the next visit.
    }
  }, []);

  useEffect(() => {
    void load();
    const onPush = (event: Event) => {
      const detail = (event as CustomEvent<{ templateId?: unknown }>).detail;
      if (detail?.templateId === "gm_terms_request") void load();
    };
    window.addEventListener(NOTIFICATION_PUSH_EVENT, onPush);
    return () => window.removeEventListener(NOTIFICATION_PUSH_EVENT, onPush);
  }, [load]);

  const answer = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data?.success === true, data };
    } catch {
      return { ok: false, data: { error: GENERIC_ERROR } };
    }
  };

  const handleAccepted = async (acceptanceId?: string) => {
    if (!acceptanceId) {
      toast.error(GENERIC_ERROR);
      return;
    }
    const { ok, data } = await answer({ action: "accept", termsAcceptanceId: acceptanceId });
    if (!ok) {
      // Reason: the request stays pending on a refusal, so the window stays open to retry.
      toast.error(data?.error || GENERIC_ERROR);
      return;
    }
    setGm(null);
    toast.success(`You accepted ${gm?.name}'s Game Master terms.`);
    router.refresh();
  };

  const handleDeclined = async () => {
    const { ok, data } = await answer({ action: "decline" });
    setGm(null);
    if (ok) toast.message("You declined the Game Master terms. Nothing else changed.");
    else toast.error(data?.error || GENERIC_ERROR);
  };

  if (!gm) return null;

  return (
    <ActionTermsDialog
      slug={ACTION_TERM_SLUGS.GM_AFFILIATION}
      open
      recordedContext={{ gameMasterId: gm.id, affiliationSource: "gm_terms_request" }}
      variables={{ gameMasterName: gm.name }}
      onAccept={(id) => void handleAccepted(id)}
      onDecline={() => void handleDeclined()}
    />
  );
}
