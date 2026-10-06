"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON } from "./performance-assets";
import { type GameCardView } from "./performance-game-cards";
import { TRADING_KEY } from "./performance-model";

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
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        live
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
          : "border-slate-400/40 bg-slate-500/15 text-slate-300"
      }`}
    >
      {live ? "Playing now" : "Retired"}
    </span>
  );
}

/**
 * One title — Overview Play-by-game layout, larger, with Performance numbers.
 *
 * Text left / art right (image 2). Numbers: activity count, contests, best
 * score, avg play, plus period + last played. Titles/taglines/art come from
 * the payload (R29).
 */
export function GamePerformanceCard({ card }: { card: GameCardView }) {
  const artSrc =
    card.artSrc ??
    (card.gameKey === TRADING_KEY ? PERF_SECTION_ICON.trading : PERF_METRIC_ICON.gameFallback);

  return (
    <Link
      href={card.href}
      className="group relative flex h-full min-h-[200px] overflow-hidden rounded-xl border border-sky-400/45 bg-[#0A0F1F]/80 shadow-[0_0_12px_-2px_rgba(56,189,248,0.45)] backdrop-blur-sm transition hover:border-sky-300/80 hover:shadow-[0_0_18px_0_rgba(56,189,248,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 sm:min-h-[220px]"
      aria-label={`Open ${card.title}`}
      data-game-card={card.gameKey}
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-4 pr-28 sm:p-5 sm:pr-36">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-black uppercase tracking-wide text-sky-300 sm:text-xl">
              {card.title}
            </p>
            <StatusPill status={card.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-gray-300">
            {card.tagline || "Open the game page to play."}
          </p>
          {card.category ? (
            <p className="mt-1 text-xs font-medium text-[#8ea4c5]">{card.category}</p>
          ) : null}
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-gray-300">
            <span>
              <span className="text-lg font-black tabular-nums text-white sm:text-xl">
                {card.scoredRounds.toLocaleString()}
              </span>{" "}
              <span className="text-gray-500">{card.activityLabel}</span>
            </span>
            <span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                Contests
              </span>{" "}
              <span className="font-bold tabular-nums text-white">
                {card.contests.toLocaleString()}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
            <span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                Best score
              </span>{" "}
              <span className="text-base font-black tabular-nums text-white sm:text-lg">
                {card.bestScore}
              </span>
            </span>
            <span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                Avg play
              </span>{" "}
              <span className="font-bold tabular-nums text-white">{card.avgPlayTime}</span>
            </span>
          </div>
          <p className="text-xs text-[#8ea4c5]">
            {card.periodRounds.toLocaleString()} this period · Last played{" "}
            {lastPlayed(card.lastPlayedAt)}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[44%] sm:w-[42%]">
        <Image
          src={artSrc}
          alt=""
          fill
          sizes="280px"
          className="object-cover object-center opacity-90 transition duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#050B18]/25 to-[#050B18]" />
      </div>
      <span className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40 transition group-hover:bg-sky-500/35">
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

/**
 * Play-by-game strip for Performance — same shape as Overview, larger cards,
 * Performance numbers. Two-up on desktop so each card stays readable.
 */
export default function GamePerformanceSection({ cards }: { cards: GameCardView[] }) {
  return (
    <PerfSection
      title="Game Performance"
      subtitle="Every game you have played, including trading — same layout as Play by game, with your numbers."
      icon={PERF_SECTION_ICON.games}
      testId="games"
    >
      {cards.length === 0 ? (
        <PerfEmpty>No ranked game rounds yet. Play a game contest to see it here.</PerfEmpty>
      ) : (
        <div className="rounded-2xl border border-sky-400/35 bg-[#050B18]/40 p-3 shadow-[0_0_18px_-6px_rgba(56,189,248,0.45),inset_0_0_14px_rgba(56,189,248,0.06)] sm:p-4">
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {cards.map((card) => (
              <li key={card.gameKey}>
                <GamePerformanceCard card={card} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </PerfSection>
  );
}
