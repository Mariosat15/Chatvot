"use client";

import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";

// Reason: a Map, not an object - the key travelled through JSON, and an object lookup walks
// the prototype chain.
const OPTIONS: ReadonlyMap<
  CompetitionVisibility,
  { label: string; hint: string; icon: typeof Globe }
> = new Map([
  [
    "public",
    { label: "Public", hint: "Listed for every player on the platform.", icon: Globe },
  ],
  [
    "gm_private",
    {
      label: "Private",
      hint: "Only players affiliated to you can see and join it.",
      icon: Lock,
    },
  ],
]);

/**
 * Public / Private choice on the Game Master create screen.
 *
 * `options` is the server's `creatableVisibilities`, computed by asking the create route's
 * own gate about each value, so this component never decides what a package allows.
 * Renders nothing when public is the only choice - the common case - so every existing
 * package sees an unchanged screen.
 */
export default function ContestVisibilityPicker({
  options,
  value,
  onChange,
}: {
  options: readonly CompetitionVisibility[];
  value: CompetitionVisibility | undefined;
  onChange: (next: CompetitionVisibility) => void;
}) {
  if (options.length === 0) return null;
  if (options.length === 1 && options[0] === "public") return null;

  return (
    <div className="border-b border-gray-800 bg-gray-950 px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-300">Who can join</span>
        {options.map((id) => {
          const option = OPTIONS.get(id);
          if (!option) return null;
          const Icon = option.icon;
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              title={option.hint}
              onClick={() => onChange(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                selected
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-500",
              )}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
        <span className="text-xs text-gray-500">
          {value ? (OPTIONS.get(value)?.hint ?? "") : ""}
        </span>
      </div>
    </div>
  );
}
