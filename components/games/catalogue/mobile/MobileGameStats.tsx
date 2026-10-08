import Image from "next/image";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import {
  formatCatalogueCount,
  formatPositiveRate,
} from "../format-catalogue-stat";

/**
 * Mobile metrics row — icon + value and label on one line (e.g. "4 Players").
 * Real data only; zeros / missing rates omitted (spec §19–20).
 *
 * Reason (8 Oct polish): stacked value-over-label read as two rows; match desktop
 * GameStatistics inline layout.
 */

const PLAYERS_ICON = "/assets/neon/catalogue-stat-players-r1.png";

interface StatItem {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: string;
}

export function MobileGameStats({ stats }: { stats?: CatalogueCardStats | null }) {
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
      className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-2 p-0"
      aria-label="Game statistics"
    >
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-1.5">
          <span className="relative h-8 w-8 shrink-0" aria-hidden>
            <Image src={item.icon} alt="" fill sizes="32px" className="object-contain" />
          </span>
          <span className={`flex min-w-0 items-baseline gap-1 leading-none ${item.tone}`}>
            <span className="text-[17px] font-extrabold tabular-nums">{item.value}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-300">
              {item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
