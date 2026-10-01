import { REFERRAL_KIND_LABELS, REFERRAL_SURFACE_LABELS } from "@/lib/services/gamemaster/referral-kind";
import {
  CONTACT_HIDDEN_NOTE,
  type GmReferralView,
} from "@/lib/services/gamemaster/gm-referral-view";

/**
 * The badges a Game Master sees on each referred player (`External game plans/24` task 5),
 * shared by the dashboard tab and the full referrals page so the two cannot word a player
 * differently.
 *
 * Reason: the kind label comes from REFERRAL_KIND_LABELS, the same map the admin report
 * uses, so "Own referral" here and in the admin screen are one decision rather than two.
 */

const KIND_TONE = new Map<GmReferralView["kind"], string>([
  ["own", "bg-yellow-900/40 text-yellow-300 border-yellow-700/50"],
  ["external", "bg-sky-900/40 text-sky-300 border-sky-700/50"],
  ["unclassified", "bg-gray-800 text-gray-400 border-gray-700"],
]);

export function ReferralKindBadge({ referral }: { referral: Pick<GmReferralView, "kind" | "surface"> }) {
  const surface = referral.surface ? REFERRAL_SURFACE_LABELS[referral.surface] : null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`px-2 py-0.5 rounded border text-[11px] font-medium ${KIND_TONE.get(referral.kind) ?? KIND_TONE.get("unclassified")}`}
      >
        {REFERRAL_KIND_LABELS[referral.kind]}
      </span>
      {surface && <span className="text-[11px] text-gray-500">{surface}</span>}
    </span>
  );
}

/** Ended beats active: a player whose affiliation ended is not "inactive", they are gone. */
export function ReferralStateLabel({ referral }: { referral: Pick<GmReferralView, "isCurrent" | "isActive"> }) {
  if (!referral.isCurrent) return <span className="text-xs text-gray-500">Ended</span>;
  return referral.isActive ? (
    <span className="text-xs text-emerald-400">Active</span>
  ) : (
    <span className="text-xs text-gray-400">Inactive</span>
  );
}

/** The email when the player consented (D6), otherwise the reason it is missing. */
export function ReferralContact({ referral }: { referral: Pick<GmReferralView, "userEmail" | "contactHidden"> }) {
  if (referral.contactHidden || !referral.userEmail) {
    return (
      <span className="text-xs text-gray-500 italic" title={CONTACT_HIDDEN_NOTE}>
        Contact hidden - terms not accepted
      </span>
    );
  }
  return <span className="text-xs text-gray-400 truncate">{referral.userEmail}</span>;
}
