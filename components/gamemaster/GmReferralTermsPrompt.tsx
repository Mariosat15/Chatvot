"use client";

import { useEffect, useState } from "react";
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

const GENERIC_ERROR = "Something went wrong. Please contact support.";
const CLAIM_URL = "/api/gamemaster/referral-claim";

type Stage = "idle" | "terms" | "confirm-decline";

/**
 * The one-time Gamemaster terms prompt for a player who signed up through a Game Master's
 * referral link (`External game plans/24` s5.3).
 *
 * Reason: sign-up attaches nobody. This asks once, on the player's first visit: accepting
 * stores the consent and only then attaches them (server side, through `affiliate()`);
 * declining - or closing the terms and confirming - means they are never placed under that
 * Game Master and never asked again. Closing the terms never silently counts as either
 * answer: it opens a confirm step that can only be left by Decline or by reading the terms
 * again, so an accidental Escape cannot cost the player or the Game Master anything.
 */
export default function GmReferralTermsPrompt() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [gm, setGm] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(CLAIM_URL, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data?.show || typeof data.gameMasterId !== "string") return;
        setGm({ id: data.gameMasterId, name: data.gameMasterName || "your Game Master" });
        setStage("terms");
      } catch {
        // Reason: fail quiet - the claim stays pending and is asked on the next visit.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const answer = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(CLAIM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data?.success === true, data };
    } catch {
      return { ok: false, data: { error: GENERIC_ERROR } };
    } finally {
      setBusy(false);
    }
  };

  const handleAccepted = async (acceptanceId?: string) => {
    if (!acceptanceId) {
      toast.error(GENERIC_ERROR);
      return;
    }
    const { ok, data } = await answer({ action: "accept", termsAcceptanceId: acceptanceId });
    if (ok) {
      setStage("idle");
      toast.success(`You have joined ${gm?.name}.`);
      router.refresh();
      return;
    }
    if (data?.retryable) {
      // Reason: the claim is back to pending on the server, so the prompt stays open for
      // another try rather than vanishing until the next visit.
      toast.error(data?.error || GENERIC_ERROR);
      return;
    }
    setStage("idle");
    toast.error(data?.error || GENERIC_ERROR);
  };

  const handleDecline = async () => {
    const { ok, data } = await answer({ action: "decline" });
    setStage("idle");
    if (ok) toast.message(`You were not added to ${gm?.name}.`);
    else toast.error(data?.error || GENERIC_ERROR);
  };

  if (!gm || stage === "idle") return null;

  return (
    <>
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.GM_AFFILIATION}
        open={stage === "terms"}
        recordedContext={{ gameMasterId: gm.id, affiliationSource: "gm_referral_link" }}
        variables={{ gameMasterName: gm.name }}
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
              You signed up through {gm.name}&apos;s invitation link. If you decline, you will not be
              added to {gm.name} and this will not be asked again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
