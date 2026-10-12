import { Flag, Gamepad2, TrendingUp, Trophy, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import {
  contestHowItWorks,
  contestHowTitle,
  type ContestHowItStep,
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

function StepList({ steps }: { steps: ContestHowItStep[] }) {
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

/**
 * The timeline's circle colours, one per step and cycling (owner reference, 12 Oct 2026: each
 * step glows in its own colour). Whole class strings so Tailwind sees them literally.
 */
const TIMELINE_TONES = [
  "border-cyan-400/70 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.45)]",
  "border-violet-400/70 text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.45)]",
  "border-pink-400/70 text-pink-200 shadow-[0_0_18px_rgba(244,114,182,0.45)]",
  "border-amber-400/70 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.45)]",
] as const;

/** Numbered steps joined by a rail ? the trading Overview tab's right column. */
function StepTimeline({ steps }: { steps: ContestHowItStep[] }) {
  return (
    <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-cyan-400/70 before:via-violet-400/60 before:to-amber-400/70">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          <span
            className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-[#0A1228] text-lg font-black ${TIMELINE_TONES[index % TIMELINE_TONES.length]}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-1.5">
            <p className="text-base font-bold text-white">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "Battle plan" -> "Battle " + "plan", the last word lit in cyan as in the reference. */
function AccentTitle({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  if (cut < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut + 1)}
      <span className="text-cyan-300">{text.slice(cut + 1)}</span>
    </>
  );
}

export function ContestHowItWorks({
  kind,
  embedded = false,
  layout = "grid",
  steps,
  iconSrc,
}: {
  kind: ContestLobbyKind;
  /**
   * Steps written from this competition's own facts (`buildTradingOverviewCopy`). Absent means
   * the kind's generic copy - only the game lobby still relies on that.
   */
  steps?: ContestHowItStep[];
  /** Skip the outer panel when nested inside another card (e.g. trading Overview tab). */
  embedded?: boolean;
  /** `timeline` stacks the steps vertically; only used embedded beside another column. */
  layout?: "grid" | "timeline";
  /** Embedded only: a neon picture beside the heading in place of the flag glyph. */
  iconSrc?: string;
}) {
  const shown = steps?.length ? steps : contestHowItWorks(kind);
  if (embedded) {
    return (
      <div>
        <h3 className="mb-5 flex items-center gap-3 text-xl font-bold text-gray-100">
          {iconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
            <img
              src={iconSrc}
              alt=""
              draggable={false}
              className="h-10 w-10 shrink-0 object-contain"
            />
          ) : (
            <Flag className="h-5 w-5 text-sky-300" />
          )}
          <AccentTitle text={contestHowTitle(kind)} />
        </h3>
        {layout === "timeline" ? (
          <StepTimeline steps={shown} />
        ) : (
          <StepList steps={shown} />
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
      <StepList steps={shown} />
    </NeonPanel>
  );
}
