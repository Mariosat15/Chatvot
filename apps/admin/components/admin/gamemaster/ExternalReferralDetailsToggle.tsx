"use client";

/**
 * The Game Master package switch for EXTERNAL referrals' contact details (players who came to
 * the Game Master through ChartVolt, not through the Game Master's own link).
 *
 * Off (the default for every package): the Game Master sees the full client id, the first
 * name and `**********` in place of the email and last name. On: full details, still only
 * for players who accepted the affiliation terms (D6). Own referrals are never affected.
 */
import { Label } from "@/components/ui/label";

interface Props {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
}

export function ExternalReferralDetailsToggle({ value, onChange }: Props) {
  // Reason: absent reads as off, the same `=== true` rule the Game Master routes apply.
  const on = value === true;
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-white font-semibold">Show external referral details</Label>
          <p className="text-xs text-gray-500 mt-1">
            {on
              ? "On: the Game Master sees external referrals' full name and email (when the player accepted the terms)."
              : "Off: external referrals show only the full client id, the first name and ********** for email and last name."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show external referral details"
          onClick={() => onChange(!on)}
          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors ${
            on ? "bg-yellow-500" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
              on ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
