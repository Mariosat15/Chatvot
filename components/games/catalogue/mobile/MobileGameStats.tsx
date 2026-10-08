import Image from "next/image";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import {
  formatCatalogueCount,
  formatPositiveRate,
} from "../format-catalogue-stat";

/**
 * Mobile metrics row — icon + stacked value/label in up to three columns.
 * Real data only; zeros / missing rates omitted (spec §19–20).
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
      className="m-0 grid list-none grid-cols-3 gap-2 p-0"
      aria-label="Game statistics"
    >
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 flex-col items-start gap-1">
          <span className="relative h-7 w-7 shrink-0" aria-hidden>
            <Image src={item.icon} alt="" fill sizes="28px" className="object-contain" />
          </span>
          <span className={`text-[16px] font-extrabold tabular-nums leading-none ${item.tone}`}>
            {item.value}
          </span>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-gray-400">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
