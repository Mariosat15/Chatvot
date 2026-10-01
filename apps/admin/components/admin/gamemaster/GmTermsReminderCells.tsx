"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_CONSENT_LABELS,
  canAdminSendTerms,
  type AdminAwaitingClaimRow,
  type AdminConsent,
  type AdminTermsReminderState,
} from "@/lib/admin/admin-terms-reminder-view";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

const CONSENT_TONE: ReadonlyMap<AdminConsent, string> = new Map([
  ["accepted", "text-emerald-300"],
  ["pending", "text-amber-300"],
  ["declined", "text-red-300"],
]);

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export function ConsentCell({ state }: { state: AdminTermsReminderState | null }) {
  if (!state) return <span className="text-gray-500 text-xs">-</span>;
  return (
    <span className={`text-xs ${CONSENT_TONE.get(state.consent) ?? "text-gray-300"}`}>
      {ADMIN_CONSENT_LABELS.get(state.consent) ?? state.consent}
    </span>
  );
}

/** What the Game Master and the admins have already sent - the "Terms Reminder Status" column. */
export function ReminderStatusCell({ state }: { state: AdminTermsReminderState | null }) {
  if (!state) return <span className="text-gray-500 text-xs">-</span>;
  return (
    <div className="text-xs space-y-0.5">
      <div className={state.gmReminderSent ? "text-emerald-300" : "text-gray-500"}>
        {state.gmReminderSent ? "GM sent ✓" : "GM not sent"}
        {state.gmReminderSent && state.gmReminderSentAt && (
          <span className="text-gray-500"> · {formatDateTime(state.gmReminderSentAt)}</span>
        )}
      </div>
      <div className="text-gray-400">
        Admin: {state.adminReminderCount}
        {state.lastAdminReminderAt && <span className="text-gray-500"> · last {formatDateTime(state.lastAdminReminderAt)}</span>}
      </div>
    </div>
  );
}

/**
 * Admin "Send terms". Unlimited - after a send the button stays usable and the count goes up -
 * but withheld once the player has answered, with the server refusing it either way.
 */
export function AdminSendTermsButton({
  subscriptionId,
  userId,
  state,
  onSent,
}: {
  subscriptionId: string;
  userId: string;
  state: AdminTermsReminderState | null;
  onSent: (count: number, at: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!canAdminSendTerms(state)) return null;

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/gamemasters/${encodeURIComponent(subscriptionId)}/referrals/${encodeURIComponent(userId)}/send-terms`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; adminTermsReminderCount?: number };
      if (res.ok && body.success) {
        toast.success("Terms reminder sent");
        onSent(body.adminTermsReminderCount ?? (state?.adminReminderCount ?? 0) + 1, new Date().toISOString());
      } else {
        toast.error(body.error || GENERIC_ERROR);
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
      onClick={send}
      disabled={busy}
      className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 disabled:opacity-50"
    >
      <Send className="h-3 w-3" />
      {busy ? "Sending..." : "Send Terms"}
    </button>
  );
}

/** Link sign-ups still waiting on the terms. Referred, NOT assigned - so a separate table. */
export function AdminAwaitingTermsTable({
  rows,
  subscriptionId,
}: {
  rows: AdminAwaitingClaimRow[];
  subscriptionId: string;
}) {
  const [local, setLocal] = useState(rows);
  if (local.length === 0) return null;
  const pending = local.filter((r) => r.consent === "pending").length;
  return (
    <div className="bg-gray-800 rounded-lg border border-amber-700/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 text-sm">
        <span className="text-white font-medium">Waiting for terms</span>
        <span className="text-gray-400">
          {" "}
          · {pending} pending · {local.length - pending} declined - referred, not assigned
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Referral Date</th>
              <th className="px-4 py-3">Consent Status</th>
              <th className="px-4 py-3">Assigned Status</th>
              <th className="px-4 py-3">Terms Reminder Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {local.map((row) => (
              <tr key={row.claimId} className="border-b border-gray-700/50 align-top">
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{row.userName || "-"}</p>
                  <span className="text-gray-500 text-xs">{row.userEmail || row.userId}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{formatDateTime(row.referredAt) || "-"}</td>
                <td className="px-4 py-3">
                  <ConsentCell state={row} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">Not assigned</td>
                <td className="px-4 py-3">
                  <ReminderStatusCell state={row} />
                </td>
                <td className="px-4 py-3">
                  <AdminSendTermsButton
                    subscriptionId={subscriptionId}
                    userId={row.userId}
                    state={row}
                    onSent={(count, at) =>
                      setLocal((prev) =>
                        prev.map((r) =>
                          r.claimId === row.claimId ? { ...r, adminReminderCount: count, lastAdminReminderAt: at } : r,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
