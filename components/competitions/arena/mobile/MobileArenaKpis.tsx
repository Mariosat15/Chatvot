"use client";

import Image from "next/image";
import { ARENA_KPI_CARDS } from "../ArenaKpiCards";

type KpiKey = (typeof ARENA_KPI_CARDS)[number]["key"];

/**
 * Short captions for a third of a phone. Reason: the desktop descriptions
 * ("Total value across all competitions") cannot fit ~110px without cutting.
 */
const PHONE_CAPTION = new Map<KpiKey, string>([
  ["live", "Active contests"],
  ["soon", "Reserve your spot"],
  ["prize", "Total in Volts"],
]);

/**
 * Phone KPI row from the Mobile UI Guide: Live Now / Starting Soon / Prize
 * Pool side by side. Same palette, labels and status-filter taps as desktop.
 */
export function MobileArenaKpis({
  liveNow,
  startingSoon,
  prizePoolLabel,
  onSelect,
}: {
  liveNow: number;
  startingSoon: number;
  prizePoolLabel: string;
  onSelect: (key: KpiKey) => void;
}) {
  const values = new Map<KpiKey, string>([
    ["live", String(liveNow)],
    ["soon", String(startingSoon)],
    ["prize", prizePoolLabel],
  ]);

  return (
    <section aria-label="Arena summary" className="grid grid-cols-3 gap-2">
      {ARENA_KPI_CARDS.map((card) => {
        const c = card.rgb;
        const clickable = card.key !== "prize";
        return (
          <button
            key={card.key}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onSelect(card.key) : undefined}
            className="flex min-h-[84px] min-w-0 flex-col justify-between gap-1 rounded-xl border-[1.5px] p-2 text-left disabled:cursor-default"
            style={{
              borderColor: `rgba(${c},.85)`,
              background: `linear-gradient(160deg, rgba(${c},.22) 0%, rgba(${c},.08) 55%, rgba(6,10,28,.92) 100%), #060a1c`,
              boxShadow: `0 0 12px rgba(${c},.35), inset 0 0 14px rgba(${c},.14)`,
            }}
          >
            <span className="flex items-center gap-1.5">
              <Image
                src={card.icon}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 object-contain"
              />
              <span
                className={`min-w-0 text-[9px] font-black uppercase leading-tight tracking-wide ${card.labelClass}`}
              >
                {card.label}
              </span>
            </span>
            <span className="break-words text-[20px] font-black leading-none text-white tabular-nums">
              {values.get(card.key) ?? ""}
            </span>
            <span className="text-[9.5px] font-semibold leading-tight text-white/70">
              {PHONE_CAPTION.get(card.key) ?? card.description}
            </span>
          </button>
        );
      })}
    </section>
  );
}
