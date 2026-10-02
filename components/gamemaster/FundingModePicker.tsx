"use client";

import { Gift, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";

// Reason: a Map, not an object - the key is a stored value, and an object lookup walks the
// prototype chain (the round-inspector rule).
export const FUNDING_MODE_COPY: ReadonlyMap<
  FundingMode,
  { label: string; hint: string; icon: typeof Gift }
> = new Map([
  [
    "player_paid",
    {
      label: "Normal",
      hint: "Each player pays the entry fee from their own wallet.",
      icon: Users,
    },
  ],
  [
    "gm_funded",
    {
      label: "Funded by you",
      hint: "You pay every seat from your wallet. Players enter free and never receive the credits.",
      icon: Gift,
    },
  ],
]);

/**
 * Private competition funding choice (Free Private Competitions, 2 Oct 2026).
 *
 * Renders nothing unless the contest is private and the server says this Game Master may
 * fund one (`canCreateFreePrivate` from creation-options, which already folds in the package
 * flag and the platform switch). The create route re-checks every condition.
 */
export default function FundingModePicker({
  visible,
  value,
  onChange,
  disabled,
}: {
  visible: boolean;
  value: FundingMode;
  onChange: (next: FundingMode) => void;
  disabled?: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-gray-300">Who pays the entry fee</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {[...FUNDING_MODE_COPY.entries()].map(([id, option]) => {
          const Icon = option.icon;
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                selected
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-gray-700 bg-gray-900/50 hover:border-gray-500",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  selected ? "text-cyan-300" : "text-gray-400",
                )}
              />
              <span>
                <span className="block text-sm font-semibold text-white">{option.label}</span>
                <span className="block text-xs text-gray-400">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
