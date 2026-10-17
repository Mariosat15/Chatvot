"use client";

import { Calendar } from "lucide-react";
import type { GmAwaitingClaimView } from "@/lib/services/gamemaster/gm-referral-view";
import { ReferralConsentBadge } from "@/components/gamemaster/GmReferralBadges";
import SendTermsButton from "@/components/gamemaster/SendTermsButton";

/**
 * Players who signed up with the Game Master's link and have not accepted the Affiliate Terms
 * (`External game plans/24` s5.6).
 *
 * Reason: a separate section, never rows in the referrals table. "Referred" and "assigned" are
 * two different states - these players are not the Game Master's, earn them nothing and are
 * not in any assigned count - so mixing them into the assigned list would make every total on
 * the page wrong while reading correctly. No contact details are on the row at all: the server
 * sends none, because nobody here has consented.
 */
export default function AwaitingTermsList({
  rows,
  pending,
  declined,
}: {
  rows: GmAwaitingClaimView[];
  pending: number;
  declined: number;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-gray-800/50 rounded-2xl border border-amber-700/30 overflow-hidden mb-6">
      <div className="px-4 sm:px-6 py-3 border-b border-gray-700/50 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-white font-semibold text-sm">Waiting for terms</h2>
        <span className="text-xs text-gray-400">
          {pending} pending · {declined} declined - not assigned to you until they accept
        </span>
      </div>
      <ul className="divide-y divide-gray-700/50">
        {rows.map((row) => (
          <li key={row.claimId} className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
            <span className="text-white font-medium text-sm">{row.userName || "Player"}</span>
            <ReferralConsentBadge consent={row.consent} />
            <span className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {row.referredAt ? new Date(row.referredAt).toLocaleDateString() : "-"}
            </span>
            {row.consent === "declined" && row.declinedAt && (
              <span className="text-xs text-gray-500">
                Declined {new Date(row.declinedAt).toLocaleDateString()}
              </span>
            )}
            {(row.canSendTerms || row.termsSent) && (
              <SendTermsButton
                target={{ claimId: row.claimId }}
                playerName={row.userName}
                alreadySent={row.termsSent}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
