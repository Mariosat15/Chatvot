"use client";

import {
  REFERRAL_KIND_LABELS,
  REFERRAL_SURFACE_LABELS,
  type ReferralKind,
} from "@/lib/services/gamemaster/referral-kind";
import type { AffiliationSurface } from "@/database/models/user-referral.model";

const KIND_TONE: ReadonlyMap<string, string> = new Map([
  ["own", "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"],
  ["external", "border-sky-500/40 bg-sky-500/10 text-sky-300"],
  ["unclassified", "border-gray-500/40 bg-gray-500/10 text-gray-300"],
]);
// Reason: the kind and surface arrive in a JSON response, so they are looked up in a Map,
// which has no prototype chain - an object lookup on "__proto__" returns something truthy
// that React then tries to render as a child.
const KIND_LABEL: ReadonlyMap<string, string> = new Map(Object.entries(REFERRAL_KIND_LABELS));
const SURFACE_LABEL: ReadonlyMap<string, string> = new Map(Object.entries(REFERRAL_SURFACE_LABELS));

/**
 * Own / external badge for one referred player, with the surface beneath it.
 *
 * Reason: the label comes from the shared `REFERRAL_KIND_LABELS`, never a string written
 * here, so this screen, the export and the Game Master's own screen cannot name one kind
 * three ways. "Unclassified" is shown rather than hidden - it is a legacy row the read
 * model could not attribute, and hiding it makes the two visible kinds look complete.
 */
export default function AffiliationSourceBadge({
  kind,
  surface,
}: {
  kind: ReferralKind;
  surface: AffiliationSurface | null;
}) {
  const surfaceLabel = surface ? SURFACE_LABEL.get(surface) : undefined;
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${KIND_TONE.get(kind) ?? KIND_TONE.get("unclassified")}`}
      >
        {KIND_LABEL.get(kind) ?? REFERRAL_KIND_LABELS.unclassified}
      </span>
      {surfaceLabel && <span className="text-[11px] text-gray-400">{surfaceLabel}</span>}
    </div>
  );
}
