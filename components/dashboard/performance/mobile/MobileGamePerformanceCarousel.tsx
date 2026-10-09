"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sparkline } from "@/components/dashboard/wallet/AnalyticsCard";
import { overviewPlayCardArt } from "@/lib/services/games/overview-assets";
import { NeonIcon, TrendDelta, accentHex } from "../PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON } from "../performance-assets";
import type { GameCardView } from "../performance-game-cards";
import { TRADING_KEY } from "../performance-model";
import { MobilePerfHeading, MobilePerfPlate } from "./mobile-perf-shell";

/**
 * One game at a time. Desktop Image-1 two-up cards stay on md+.
 */
export default function MobileGamePerformanceCarousel({ cards }: { cards: GameCardView[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const syncIndex = () => {
    const el = scroller.current;
    if (!el || el.clientWidth < 1) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const go = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  if (cards.length === 0) return null;

  return (
    <section data-perf-section="games">
      <MobilePerfHeading
        title="Game Performance"
        subtitle="Every game you have played, including trading."
        icon={PERF_SECTION_ICON.games}
        controls={
          cards.length > 1 ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous game"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next game"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white active:scale-95"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null
        }
      />
      <div
        ref={scroller}
        onScroll={syncIndex}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <div key={card.gameKey} className="w-full shrink-0 snap-center px-0.5">
            <MobileGameCard card={card} />
          </div>
        ))}
      </div>
      {cards.length > 1 ? (
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
          {cards.map((card, i) => (
            <span
              key={card.gameKey}
              className={`h-1.5 rounded-full ${i === index ? "w-5 bg-cyan-300" : "w-1.5 bg-white/25"}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MobileGameCard({ card }: { card: GameCardView }) {
  const hex = accentHex(card.accent);
  // Reason: same as desktop — always show game art, never a lone neon icon.
  const artSrc =
    card.artSrc || overviewPlayCardArt(null, card.gameKey === TRADING_KEY);
  return (
    <MobilePerfPlate accent={card.accent} className="p-0">
      <div className="flex min-h-[196px] flex-col">
        <div className="relative h-[72px] w-full overflow-hidden bg-[#041025]">
          <Image
            src={artSrc}
            alt=""
            fill
            sizes="430px"
            className="object-cover object-[center_top]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041025] to-transparent" />
          <span
            className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: `${hex}33`, color: hex }}
          >
            {card.status}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{card.title}</p>
              {card.tagline ? (
                <p className="truncate text-[11px] text-[#8ea4c5]">{card.tagline}</p>
              ) : null}
            </div>
            <Sparkline points={card.spark} color={hex} width={64} height={22} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              icon={PERF_METRIC_ICON.rounds}
              label={card.activityLabel}
              value={String(card.periodRounds)}
              trend={card.roundsTrend}
            />
            <MiniStat
              icon={PERF_METRIC_ICON.contests}
              label="Contests"
              value={String(card.contests)}
              trend={card.contestsTrend}
            />
            <MiniStat
              icon={PERF_METRIC_ICON.bestScore}
              label="Best score"
              value={card.bestScore}
              trend={card.bestScoreTrend}
            />
            <MiniStat
              icon={PERF_METRIC_ICON.playTime}
              label="Avg time"
              value={card.avgPlayTime}
              trend={card.avgPlayTrend}
            />
          </div>
          <Link
            href={card.href}
            className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10 text-sm font-semibold text-cyan-100 active:scale-[0.99]"
          >
            View details
          </Link>
        </div>
      </div>
    </MobilePerfPlate>
  );
}

function MiniStat({
  icon,
  label,
  value,
  trend,
}: {
  icon: string;
  label: string;
  value: string;
  trend: number | null;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 text-[10px] uppercase tracking-wide text-[#8ea4c5]">
          <NeonIcon src={icon} size={14} />
          <span className="truncate">{label}</span>
        </span>
        <TrendDelta value={trend} />
      </div>
      <div className="truncate text-[13px] font-black tabular-nums text-white">{value}</div>
    </div>
  );
}
