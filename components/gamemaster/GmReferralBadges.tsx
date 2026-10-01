import {
  describeAffiliationState,
  REFERRAL_KIND_LABELS,
  REFERRAL_SURFACE_LABELS,
} from "@/lib/services/gamemaster/referral-kind";
import {
  CONTACT_HIDDEN_NOTE,
  CONTACT_MASKED_NOTE,
  REFERRAL_CONSENT_LABELS,
  type GmReferralView,
  type ReferralConsent,
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
  const tone = !referral.isCurrent ? "text-gray-500" : referral.isActive ? "text-emerald-400" : "text-gray-400";
  return <span className={`text-xs ${tone}`}>{describeAffiliationState(referral)}</span>;
}

/**
 * The email when the player consented (D6), otherwise the reason it is missing. An external
 * referral on a package without the details switch arrives already masked by the server.
 */
export function ReferralContact({
  referral,
}: {
  referral: Pick<GmReferralView, "userEmail" | "contactHidden" | "contactMasked">;
}) {
  if (referral.contactHidden || !referral.userEmail) {
    return (
      <span className="text-xs text-gray-500 italic" title={CONTACT_HIDDEN_NOTE}>
        Contact hidden - terms not accepted
      </span>
    );
  }
  if (referral.contactMasked) {
    return (
      <span className="text-xs text-gray-500 font-mono" title={CONTACT_MASKED_NOTE}>
        {referral.userEmail}
      </span>
    );
  }
  return <span className="text-xs text-gray-400 truncate">{referral.userEmail}</span>;
}

/**
 * The player's country. Reason: not contact data, so it is shown whatever the consent and the
 * package switch say - and "Country not set" rather than nothing, so an absent value never
 * reads as one the screen forgot to load.
 */
export function ReferralCountry({ referral }: { referral: Pick<GmReferralView, "country"> }) {
  return (
    <span className="text-[11px] text-gray-500" title="Country">
      {referral.country ? `Country: ${referral.country}` : "Country not set"}
    </span>
  );
}

const CONSENT_TONE = new Map<ReferralConsent, string>([
  ["accepted", "bg-emerald-900/40 text-emerald-300 border-emerald-700/50"],
  ["pending", "bg-amber-900/40 text-amber-300 border-amber-700/50"],
  ["declined", "bg-red-900/40 text-red-300 border-red-700/50"],
]);

/**
 * Accepted / Pending Terms / Declined (`External game plans/24` s5.6). Reason: the label comes
 * from REFERRAL_CONSENT_LABELS (the admin app's ADMIN_CONSENT_LABELS is pinned to the same
 * entries by a test), and the value is decided on the server - the screen never infers consent
 * from a missing email.
 */
export function ReferralConsentBadge({ consent }: { consent: ReferralConsent }) {
  return (
    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${CONSENT_TONE.get(consent) ?? ""}`}>
      {REFERRAL_CONSENT_LABELS.get(consent) ?? ""}
    </span>
  );
}

/** The full client id - the one identifier every package shows, so a masked row stays traceable. */
export function ReferralClientId({ referral }: { referral: Pick<GmReferralView, "userId"> }) {
  return (
    <span className="text-[11px] text-gray-500 font-mono break-all" title="Client id">
      ID: {referral.userId}
    </span>
  );
}
