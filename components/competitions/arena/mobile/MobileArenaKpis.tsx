"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ARENA_KPI_CARDS } from "../ArenaKpiCards";

type KpiKey = (typeof ARENA_KPI_CARDS)[number]["key"];

/**
 * Phone KPI strip: one tile per screen width, swiped sideways with snap, dots
 * underneath. Same palette, wording and status-filter clicks as desktop.
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
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const values = new Map<KpiKey, string>([
    ["live", String(liveNow)],
    ["soon", String(startingSoon)],
    ["prize", prizePoolLabel],
  ]);

  const handleScroll = () => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollTo = (index: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section aria-label="Arena summary">
      <div
        ref={scroller}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ARENA_KPI_CARDS.map((card) => {
          const c = card.rgb;
          const clickable = card.key !== "prize";
          return (
            <div key={card.key} className="w-full shrink-0 snap-center px-0.5">
              <button
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => onSelect(card.key) : undefined}
                className="relative flex h-[76px] w-full items-center gap-3 overflow-hidden rounded-xl border-[1.5px] px-4 text-left disabled:cursor-default"
                style={{
                  borderColor: `rgba(${c},.85)`,
                  background: `linear-gradient(100deg, rgba(${c},.22) 0%, rgba(${c},.10) 45%, rgba(6,10,28,.92) 100%), #060a1c`,
                  boxShadow: `0 0 14px rgba(${c},.4), inset 0 0 18px rgba(${c},.16)`,
                }}
              >
                <span
                  className="flex size-[44px] shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: `rgba(${c},.9)`,
                    background: `radial-gradient(circle, rgba(${c},.25), rgba(0,0,0,.55) 70%)`,
                    boxShadow: `0 0 12px rgba(${c},.65)`,
                  }}
                >
                  <Image
                    src={card.icon}
                    alt=""
                    width={28}
                    height={28}
                    className="size-[26px] object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[12px] font-black uppercase leading-none tracking-wide ${card.labelClass}`}
                  >
                    {card.label}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="truncate text-[24px] font-black leading-none text-white tabular-nums">
                      {values.get(card.key) ?? ""}
                    </span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-white/80">
                      {card.description}
                    </span>
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        {ARENA_KPI_CARDS.map((card, i) => (
          <button
            key={card.key}
            type="button"
            aria-label={`Show ${card.label}`}
            onClick={() => scrollTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-5 bg-cyan-300" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
