import { Flag } from "lucide-react";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";

/**
 * Battle plan — separate full-width vertical timeline (Complobyymobile §10).
 * Never a four-column strip; steps come from production overview copy.
 */

export function MobileLobbyBattlePlan({
  overview,
}: {
  overview: TradingOverviewCopy;
}) {
  if (overview.steps.length === 0) return null;

  return (
    <section className="min-w-0 rounded-2xl border border-sky-400/40 bg-[#060A18]/85 p-4 shadow-[0_0_26px_rgba(56,189,248,0.14)]">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Flag className="h-6 w-6 shrink-0 text-cyan-300" aria-hidden />
        <span>
          Battle <span className="text-cyan-300">plan</span>
        </span>
      </h2>
      <ol className="relative mt-5">
        <span
          aria-hidden
          className="absolute bottom-4 left-[15px] top-4 w-px bg-sky-400/40"
        />
        {overview.steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-sky-400 bg-[#060A18] text-sm font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold leading-8 text-white break-words">
                {step.title}
              </p>
              <p className="text-[14px] leading-relaxed text-gray-400 break-words">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
