import { Flag, Gamepad2, TrendingUp, Trophy, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import {
  contestHowItWorks,
  contestHowTitle,
  type ContestLobbyKind,
} from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Four large how-it-works steps. Kind picks wording; chrome stays identical.
 */

const STEP_ICONS = new Map<string, LucideIcon>([
  ["Jump in", UserPlus],
  ["Play your round", Gamepad2],
  ["Climb the board", TrendingUp],
  ["Trade live", TrendingUp],
  ["Climb the ranks", Flag],
  ["Take the pot", Trophy],
]);

function StepList({ kind }: { kind: ContestLobbyKind }) {
  const steps = contestHowItWorks(kind);
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, index) => {
        const Icon = STEP_ICONS.get(step.title) ?? Flag;
        return (
          <li
            key={step.title}
            className="relative flex gap-3 rounded-xl border border-[#1B2540] bg-[#080C18]/55 p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/15 text-base font-bold text-violet-200">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-base font-semibold text-gray-100">
                <Icon className="h-4 w-4 shrink-0 text-sky-300" />
                {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Numbered steps joined by a rail — the trading Overview tab's right column. */
function StepTimeline({ kind }: { kind: ContestLobbyKind }) {
  const steps = contestHowItWorks(kind);
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-gradient-to-b before:from-sky-400/60 before:via-violet-400/50 before:to-amber-400/60">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/60 bg-[#0A1228] text-base font-bold text-sky-200 shadow-[0_0_14px_rgba(56,189,248,0.35)]">
            {index + 1}
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-base font-semibold text-gray-100">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ContestHowItWorks({
  kind,
  embedded = false,
  layout = "grid",
}: {
  kind: ContestLobbyKind;
  /** Skip the outer panel when nested inside another card (e.g. trading Overview tab). */
  embedded?: boolean;
  /** `timeline` stacks the steps vertically; only used embedded beside another column. */
  layout?: "grid" | "timeline";
}) {
  if (embedded) {
    return (
      <div>
        <h3 className="mb-4 flex items-center gap-2.5 text-xl font-bold text-gray-100">
          <Flag className="h-5 w-5 text-sky-300" />
          {contestHowTitle(kind)}
        </h3>
        {layout === "timeline" ? (
          <StepTimeline kind={kind} />
        ) : (
          <StepList kind={kind} />
        )}
      </div>
    );
  }

  return (
    <NeonPanel
      icon={Flag}
      accent="score"
      title={contestHowTitle(kind)}
      size="lg"
    >
      <StepList kind={kind} />
    </NeonPanel>
  );
}
