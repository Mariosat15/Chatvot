import Image from "next/image";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import {
  formatCatalogueCount,
  formatPositiveRate,
} from "./format-catalogue-stat";

/**
 * Players / contests / positive strip on a catalogue card.
 *
 * Reason (8 Oct 2026): Image 1 shows three coloured metrics; a missing real figure is
 * omitted rather than inventing a placeholder (owner plan §21).
 */

interface GameStatisticsProps {
  stats?: CatalogueCardStats | null;
}

interface StatItem {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: string;
}

export function GameStatistics({ stats }: GameStatisticsProps) {
  if (!stats) return null;

  const items: StatItem[] = [];

  const players = formatCatalogueCount(stats.playerCount);
  if (players) {
    items.push({
      key: "players",
      label: "Players",
      value: players,
      icon: NEON_ICON("users"),
      tone: "text-[#78f3ff]",
    });
  }

  const contests = formatCatalogueCount(stats.contestCount);
  if (contests) {
    items.push({
      key: "contests",
      label: "Contests",
      value: contests,
      icon: NEON_ICON("trophy-blue"),
      tone: "text-[#ffd447]",
    });
  }

  if (typeof stats.positiveRate === "number") {
    const positive = formatPositiveRate(stats.positiveRate);
    if (positive) {
      items.push({
        key: "positive",
        label: "Positive",
        value: positive,
        icon: NEON_ICON("bolt-blue"),
        tone: "text-[#5dffb0]",
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-wrap items-end gap-x-6 gap-y-2 p-0" aria-label="Game statistics">
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-2">
          <span className="relative h-7 w-7 shrink-0" aria-hidden>
            <Image src={item.icon} alt="" fill sizes="28px" className="object-contain" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className={`text-[17px] font-extrabold tabular-nums ${item.tone}`}>
              {item.value}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-gray-400">
              {item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
