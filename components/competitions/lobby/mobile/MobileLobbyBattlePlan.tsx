import { Flag } from "lucide-react";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { MOBILE_CARD } from "./MobileLobbyCard";

/**
 * Battle plan - the whole Overview tab on a phone (owner, 13 Oct 2026: "About this
 * competition" removed, so this is now full width). A numbered vertical timeline under a
 * centred heading; never a four-column strip. Steps come from the production overview copy.
 */

export function MobileLobbyBattlePlan({ overview }: { overview: TradingOverviewCopy }) {
  if (overview.steps.length === 0) return null;

  return (
    <section className={MOBILE_CARD}>
      <h2 className="mb-4 flex items-center justify-center gap-2 text-[15px] font-bold leading-tight text-white">
        <Flag className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
        <span>
          Battle <span className="text-cyan-300">plan</span>
        </span>
      </h2>
      <ol className="relative">
        <span aria-hidden className="absolute bottom-4 left-[14px] top-4 w-px bg-sky-400/30" />
        {overview.steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/70 bg-[#0A1024] text-[12px] font-black text-cyan-200 shadow-[0_0_10px_-3px_rgba(56,189,248,0.8)]">
              {index + 1}
            </span>
            <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[13px] font-bold leading-snug text-white break-words">{step.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-gray-400 break-words">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
