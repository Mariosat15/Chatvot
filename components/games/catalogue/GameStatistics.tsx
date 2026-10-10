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
 * Reason (polish): owner neon players plate; value + label on one line at a larger size
 * so the footer does not read as empty space under tiny type.
 *
 * Positive % = share of scored seats with score > 0 or pnl > 0 (not a star rating).
 */

/** Owner glass-neon three-person plate (8 Oct 2026 polish). */
const PLAYERS_ICON = "/assets/neon/catalogue-stat-players-r1.png";

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
      icon: PLAYERS_ICON,
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
    <ul
      className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0"
      aria-label="Game statistics"
    >
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-2">
          <span className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10" aria-hidden>
            <Image src={item.icon} alt="" fill sizes="40px" className="object-contain" />
          </span>
          <span className={`flex min-w-0 items-baseline gap-1.5 leading-none ${item.tone}`}>
            <span className="text-[18px] font-extrabold tabular-nums sm:text-[20px]">
              {item.value}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-300 sm:text-[12px]">
              {item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
