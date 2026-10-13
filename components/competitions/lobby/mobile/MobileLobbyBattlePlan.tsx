import { Flag } from "lucide-react";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { MOBILE_CARD } from "./MobileLobbyCard";

/**
 * Battle plan - a numbered vertical timeline (Complobyymobile §10, mobile fix guide).
 * Never a four-column strip; steps come from production overview copy.
 */

export function MobileLobbyBattlePlan({
  id,
  overview,
}: {
  id?: string;
  overview: TradingOverviewCopy;
}) {
  if (overview.steps.length === 0) return null;

  return (
    <section id={id} className={`scroll-mt-4 ${MOBILE_CARD}`}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
        <Flag className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
        <span>
          Battle <span className="text-cyan-300">plan</span>
        </span>
      </h2>
      <ol className="relative mt-4">
        <span
          aria-hidden
          className="absolute bottom-4 left-[13px] top-4 w-px bg-sky-400/30"
        />
        {overview.steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/70 bg-[#0A1024] text-[13px] font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-7 text-white break-words">
                {step.title}
              </p>
              <p className="text-[13px] leading-relaxed text-gray-400 break-words">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
