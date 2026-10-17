"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/** Exactly one of the two: an assigned referral, or a link sign-up still waiting for terms. */
export type SendTermsTarget = { referralId: string } | { claimId: string };

/**
 * The small "Send terms" button beside a referral's name (`External game plans/24` s5.5/s5.6).
 *
 * Reason: once per referral (s5.6). The caller renders it when the row's `canSendTerms` or
 * `termsSent` is true, both decided on the server; `alreadySent` turns it into the "TERMS
 * SENT ✓" state so a reload never offers a second send. The route re-checks everything
 * (own, live, not accepted, not declined, not already sent), so this never decides who may
 * be asked - it only reports what the server said.
 */
export default function SendTermsButton({
  target,
  playerName,
  alreadySent = false,
}: {
  target: SendTermsTarget;
  playerName?: string | null;
  alreadySent?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(alreadySent);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gamemaster/referrals/send-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSent(true);
        toast.success(`Terms sent to ${playerName || "your referral"}.`);
      } else {
        // Reason: a refusal for "already sent" means the button is out of date, not that
        // nothing happened - show the sent state so it cannot be pressed again.
        if (data?.code === "limit_reached") setSent(true);
        toast.error(data?.error || GENERIC_ERROR);
      }
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void send()}
      disabled={busy || sent}
      title={sent ? "You have sent this player the terms" : "Send this player the Game Master terms to accept or decline"}
      className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSignature className="h-3 w-3" />}
      {sent ? "TERMS SENT ✓" : "SEND TERMS"}
    </button>
  );
}
