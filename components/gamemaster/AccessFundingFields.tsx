"use client";

import { cn } from "@/lib/utils";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import { VISIBILITY_OPTION_COPY } from "@/components/gamemaster/ContestVisibilityPicker";
import FundingModePicker from "@/components/gamemaster/FundingModePicker";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";

/**
 * "Who can join" and "Who pays the entry fee" - the two choices both Game Master wizards
 * (trading and provider) render as a step, never as a strip above the wizard.
 *
 * Neither choice is pre-selected when there is a real choice to make: the wizard refuses
 * Next until both are picked (`accessFundingStepError`). With public as the only option the
 * visibility is shown as a fact; funding appears only for a private contest the server says
 * this Game Master may fund.
 */
export default function AccessFundingFields({
  visibilityOptions,
  visibility,
  onVisibility,
  fundingOffered,
  fundingMode,
  onFundingMode,
  disabled = false,
}: {
  visibilityOptions: readonly CompetitionVisibility[];
  visibility: CompetitionVisibility | undefined;
  onVisibility: (next: CompetitionVisibility) => void;
  fundingOffered: boolean;
  fundingMode: FundingMode | undefined;
  onFundingMode?: (next: FundingMode) => void;
  disabled?: boolean;
}) {
  const canPickVisibility = visibilityOptions.length > 1;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-sm text-gray-300">Who can join</span>
        {visibilityOptions.length === 0 ? (
          <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            Your package does not allow creating a competition. Please contact support.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibilityOptions.map((id) => {
              const option = VISIBILITY_OPTION_COPY.get(id);
              if (!option) return null;
              const Icon = option.icon;
              const selected = visibility === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled || !canPickVisibility}
                  onClick={() => onVisibility(id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                    selected
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-gray-700 bg-gray-900/50 hover:border-gray-500",
                    !canPickVisibility && "cursor-default",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      selected ? "text-cyan-300" : "text-gray-400",
                    )}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="block text-xs text-gray-400">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <FundingModePicker
        visible={fundingOffered && !!onFundingMode}
        value={fundingMode}
        onChange={(m) => onFundingMode?.(m)}
        disabled={disabled}
      />
    </div>
  );
}
