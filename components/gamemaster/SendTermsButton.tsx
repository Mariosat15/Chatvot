"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The small "Send T&C" button beside an own referral's name (`External game plans/24` s5.5).
 *
 * Reason: the caller renders it only when the row's `canSendTerms` is true, and that flag is
 * decided by `canSendReferralTerms` on the server. The route re-checks everything (own,
 * current, not accepted, cooldown, cap), so this button never decides who may be asked.
 */
export default function SendTermsButton({ referralId, playerName }: { referralId: string; playerName?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gamemaster/referrals/send-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSent(true);
        toast.success(`Terms sent to ${playerName || "your referral"}.`);
      } else {
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
      title="Send this player the Game Master terms to accept or decline"
      className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSignature className="h-3 w-3" />}
      {sent ? "T&C sent" : "Send T&C"}
    </button>
  );
}
