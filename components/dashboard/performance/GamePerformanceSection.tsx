"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sparkline } from "@/components/dashboard/wallet/AnalyticsCard";
import { NeonIcon, PerfCard, PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF, PERF_METRIC_ICON, PERF_SECTION_ICON } from "./performance-assets";
import type { GameCardView } from "./performance-model";

function lastPlayed(iso: string | null): string {
  if (!iso) return "-";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "-";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: GameCardView["status"] }) {
  if (status === "active") return null;
  const live = status === "live";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        live
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
          : "border-slate-400/40 bg-slate-500/15 text-slate-300"
      }`}
    >
      {live ? "Playing now" : "Retired"}
    </span>
  );
}

export function GamePerformanceCard({ card }: { card: GameCardView }) {
  const stats: { label: string; value: string }[] = [
    { label: "Scored rounds", value: card.scoredRounds.toLocaleString() },
    { label: "Contests", value: card.contests.toLocaleString() },
    { label: "Best score", value: card.bestScore },
    { label: "Avg play", value: card.avgPlayTime },
  ];
  return (
    <PerfCard accent="blue" className="h-full">
      <div className="flex h-full flex-col" data-game-card={card.gameKey}>
        <div className="relative h-40 overflow-hidden sm:h-44">
          {card.artSrc ? (
            <Image
              src={card.artSrc}
              alt=""
              fill
              sizes="560px"
              className="object-cover object-center"
              quality={90}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#07172c]">
              <NeonIcon src={PERF_METRIC_ICON.gameFallback} size={72} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#041025] via-[#041025]/35 to-transparent" />
          <div className="absolute right-3 top-3">
            <StatusPill status={card.status} />
          </div>
          <div className="absolute bottom-3 left-4 right-4 min-w-0">
            <h3 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
              {card.title}
            </h3>
            {card.category ? (
              <p className="truncate text-sm font-medium text-[#c5d4ee]">{card.category}</p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
                {s.label}
              </div>
              <div className="truncate text-lg font-black tabular-nums text-white">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
          <div className="text-xs text-[#8ea4c5]">
            <div className="font-medium text-[#c5d4ee]">
              {card.periodRounds.toLocaleString()} rounds this period
            </div>
            <div>Last played {lastPlayed(card.lastPlayedAt)}</div>
          </div>
          <Sparkline points={card.spark} color={PERF.orange} width={110} height={32} />
        </div>
      </div>
    </PerfCard>
  );
}

/**
 * One card per provider title the player has played — straight from the payload,
 * never a hard-coded list (R29). Trading has its own section below.
 *
 * Reason: two cards fill the row so the arrows actually move something. Three
 * fitted cards made scrollBy(clientWidth) a no-op.
 */
export default function GamePerformanceSection({ cards }: { cards: GameCardView[] }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 16 : Math.round(el.clientWidth * 0.55);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };
  const controls =
    cards.length > 1 ? (
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label="Previous games"
          onClick={() => scroll(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/35 bg-black/45 text-cyan-200 shadow-[0_0_12px_rgba(0,217,255,0.25)] hover:bg-cyan-500/15"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next games"
          onClick={() => scroll(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/35 bg-black/45 text-cyan-200 shadow-[0_0_12px_rgba(0,217,255,0.25)] hover:bg-cyan-500/15"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    ) : null;

  return (
    <PerfSection
      title="Game Performance"
      subtitle="Every game you have played in a ranked round."
      icon={PERF_SECTION_ICON.games}
      controls={controls}
      testId="games"
    >
      {cards.length === 0 ? (
        <PerfEmpty>No ranked game rounds yet. Play a game contest to see it here.</PerfEmpty>
      ) : (
        <div
          ref={track}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card) => (
            <div
              key={card.gameKey}
              className="w-[min(100%,28rem)] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)]"
            >
              <GamePerformanceCard card={card} />
            </div>
          ))}
        </div>
      )}
    </PerfSection>
  );
}
