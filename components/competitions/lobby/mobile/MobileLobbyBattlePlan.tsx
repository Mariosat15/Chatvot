import { Flag } from "lucide-react";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { MOBILE_CARD_COMPACT } from "./MobileLobbyCard";

/**
 * Battle plan - the right half of the Overview tab (mobile fix guide, 13 Oct 2026).
 * A numbered vertical timeline sized for a half-width column; never a four-column strip.
 * Steps come from the production overview copy.
 */

export function MobileLobbyBattlePlan({ overview }: { overview: TradingOverviewCopy }) {
  if (overview.steps.length === 0) return null;

  return (
    <section className={`h-full ${MOBILE_CARD_COMPACT}`}>
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold leading-tight text-white">
        <Flag className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
        <span>
          Battle <span className="text-cyan-300">plan</span>
        </span>
      </h2>
      <ol className="relative mt-3">
        <span aria-hidden className="absolute bottom-3 left-[10px] top-3 w-px bg-sky-400/30" />
        {overview.steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0"
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-sky-400/70 bg-[#0A1024] text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold leading-[22px] text-white break-words">{step.title}</p>
              <p className="text-[11px] leading-snug text-gray-400 break-words">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
