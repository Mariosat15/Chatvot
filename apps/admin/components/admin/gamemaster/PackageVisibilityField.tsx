"use client";

import { Lock, Globe } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Which competition visibilities a Game Master package may CREATE (GM Program v2 step 5,
 * `External game plans/24` s10).
 *
 * The editor offers exactly three combinations, so an empty list cannot be sent. The rule
 * itself (unknown refused, empty refused, order normalised) lives in
 * `parseAllowedVisibilityInput`, which the marketplace route runs on every save.
 */
export type PackageVisibility = "public" | "gm_private";

const OPTIONS: { id: "public" | "private" | "both"; label: string; value: PackageVisibility[] }[] = [
  { id: "public", label: "Public only", value: ["public"] },
  { id: "private", label: "Private only", value: ["gm_private"] },
  { id: "both", label: "Public and private", value: ["public", "gm_private"] },
];

/**
 * Reason an absent stored value reads as "Public only": `resolveAllowedVisibility` applies
 * public-only in code when the field was never set, so the editor must show what the creation
 * routes will actually enforce rather than an unselected control.
 */
function selectedId(value: readonly string[] | undefined): "public" | "private" | "both" {
  const hasPublic = !value?.length || value.includes("public");
  const hasPrivate = !!value?.includes("gm_private");
  if (hasPublic && hasPrivate) return "both";
  return hasPrivate ? "private" : "public";
}

export function PackageVisibilityField({
  value,
  onChange,
}: {
  value: readonly string[] | undefined;
  onChange: (next: PackageVisibility[]) => void;
}) {
  const current = selectedId(value);
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 col-span-2">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-5 w-5 text-purple-400" />
        <div>
          <Label className="text-white font-semibold">Competition visibility</Label>
          <p className="text-xs text-gray-500 mt-1">
            Private competitions can only be seen and entered by players affiliated to that Game
            Master. They also need the platform switch on Game Masters → Program switches.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-1" role="radiogroup" aria-label="Competition visibility">
        {OPTIONS.map((option) => (
          <label key={option.id} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="gm-package-visibility"
              checked={current === option.id}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-white flex items-center gap-1">
              {option.id === "private" ? null : <Globe className="h-3.5 w-3.5 text-gray-400" />}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
