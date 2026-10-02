"use client";

import { Gift } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Whether a Game Master package may create Free Private (GM-funded) competitions.
 *
 * Withheld with its reason, never merely greyed out, while the package does not allow private
 * visibility: a funded contest is always private, and the marketplace route refuses the
 * combination anyway. Unticking private visibility also clears the switch here, so the editor
 * never submits a pair the route refuses.
 */
export function PackageFreePrivateField({
  value,
  privateAllowed,
  onChange,
}: {
  value: boolean | undefined;
  privateAllowed: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 col-span-2">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="h-5 w-5 text-emerald-400" />
        <div>
          <Label className="text-white font-semibold">Free Private competitions</Label>
          <p className="text-xs text-gray-500 mt-1">
            Lets this Game Master fund the entry fees of a private competition from their own
            Volts, so their players join free. The full reserve (entry fee × places) is held when
            the competition is created. Also needs the platform switch on Game Masters → Program
            switches.
          </p>
        </div>
      </div>
      {privateAllowed ? (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-sm text-white">Allow Free Private competitions</span>
        </label>
      ) : (
        <p className="text-sm text-amber-300">
          Unavailable: this package does not allow Private competitions. Choose “Private only” or
          “Public and private” above first.
        </p>
      )}
    </div>
  );
}
