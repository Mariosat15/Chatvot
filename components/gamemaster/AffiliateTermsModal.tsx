"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ActionTermsDialog, { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AFFILIATE_TERMS_OPEN_EVENT,
  NOTIFICATION_PUSH_EVENT,
  isAffiliateTermsTemplate,
} from "@/lib/utils/notification-events";
import {
  CONSENT_AFFILIATION_SOURCE,
  isAffiliateConsentKind,
  type AffiliateConsentKind,
} from "@/lib/utils/affiliate-consent-kind";

const GENERIC_ERROR = "Something went wrong. Please contact support.";
const CONSENT_URL = "/api/affiliate/consent";

type Stage = "idle" | "terms" | "confirm-decline";
type Pending = { kind: AffiliateConsentKind; gmId: string; gmName: string };

/** What declining means differs by kind, and the confirm step must say which. */
const DECLINE_COPY: Readonly<Record<AffiliateConsentKind, (gm: string) => string>> = {
  claim: (gm) =>
    `You signed up through ${gm}'s invitation link. If you decline, you will not be added to ${gm} and this will not be asked again.`,
  request: (gm) =>
    `${gm} asked you to review the affiliate terms. If you decline, nothing about your account changes and this will not be asked again.`,
};

/**
 * THE Game Master terms modal (`External game plans/24` s5.6). One component for both
 * questions a player can be asked - a pending referral-link sign-up and a Game Master's
 * terms request - answered through one route, `/api/affiliate/consent`.
 *
 * Reason it opens from the stored state, never from first-login or localStorage: an
 * unanswered question must come back on every app entry until the player answers it, and a
 * browser flag would forget on another device and remember after the question is gone.
 * It re-reads the server on mount, on a pushed reminder, and when the bell's "Review Terms"
 * asks it to - so a reminder sent while the player is on the page opens it without a reload.
 *
 * Closing the terms never silently counts as an answer: it opens a confirm step that can be
 * left by Decline, by reading again, or by "Decide later", which leaves everything pending.
 */
export default function AffiliateTermsModal() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(CONSENT_URL, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.show || !isAffiliateConsentKind(data.kind) || typeof data.gameMasterId !== "string") {
        return;
      }
      setPending({ kind: data.kind, gmId: data.gameMasterId, gmName: data.gameMasterName || "your Game Master" });
      setStage((current) => (current === "idle" ? "terms" : current));
    } catch {
      // Reason: fail quiet - nothing changes server side, so it is asked on the next visit.
    }
  }, []);

  useEffect(() => {
    void load();
    const onOpen = () => void load();
    const onPush = (event: Event) => {
      const detail = (event as CustomEvent).detail as { templateId?: unknown } | undefined;
      if (isAffiliateTermsTemplate(detail?.templateId)) void load();
    };
    window.addEventListener(AFFILIATE_TERMS_OPEN_EVENT, onOpen);
    window.addEventListener(NOTIFICATION_PUSH_EVENT, onPush);
    return () => {
      window.removeEventListener(AFFILIATE_TERMS_OPEN_EVENT, onOpen);
      window.removeEventListener(NOTIFICATION_PUSH_EVENT, onPush);
    };
  }, [load]);

  const answer = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(CONSENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data?.success === true, data };
    } catch {
      return { ok: false, data: { error: GENERIC_ERROR, retryable: true } };
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    setStage("idle");
    setPending(null);
    // Reason: the dashboard, bell and Game Master badge are server-rendered - refresh them
    // without asking the player to sign in again.
    router.refresh();
  };

  const handleAccepted = async (acceptanceId?: string) => {
    if (!acceptanceId) {
      toast.error(GENERIC_ERROR);
      return;
    }
    const { ok, data } = await answer({ decision: "accept", termsAcceptanceId: acceptanceId });
    if (ok) {
      toast.success(`You now play under ${pending?.gmName}.`);
      finish();
      return;
    }
    // Reason: a retryable failure left the question open server side, so the modal stays
    // for another try rather than vanishing until the next visit.
    toast.error(data?.error || GENERIC_ERROR);
    if (!data?.retryable) finish();
  };

  const handleDecline = async () => {
    const { ok, data } = await answer({ decision: "decline" });
    if (ok) toast.message("You declined the affiliate terms.");
    else toast.error(data?.error || GENERIC_ERROR);
    finish();
  };

  if (!pending || stage === "idle") return null;

  return (
    <>
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.GM_AFFILIATION}
        open={stage === "terms"}
        recordedContext={{
          gameMasterId: pending.gmId,
          affiliationSource: CONSENT_AFFILIATION_SOURCE[pending.kind],
        }}
        variables={{ gameMasterName: pending.gmName }}
        onAccept={(id) => void handleAccepted(id)}
        onDecline={() => setStage("confirm-decline")}
      />
      <Dialog open={stage === "confirm-decline"}>
        <DialogContent
          className="bg-gray-900 border-gray-700 max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-gray-100">Not accepting the terms?</DialogTitle>
            <DialogDescription className="text-gray-400">
              {DECLINE_COPY[pending.kind](pending.gmName)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setStage("terms")}
                className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
              >
                Read the terms again
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleDecline()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setStage("idle")}
              className="text-gray-400 hover:text-gray-200"
            >
              Decide later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
