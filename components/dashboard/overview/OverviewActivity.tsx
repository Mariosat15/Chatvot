"use client";

import Link from "next/link";
import type { OverviewActivityItem } from "@/lib/services/games/overview-types";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewActivityProps {
  items: OverviewActivityItem[];
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Recent contest finishes for Overview. Trading trade feed stays on Performance
 * when the player has trades — Overview stays game-agnostic.
 */
export default function OverviewActivity({ items }: OverviewActivityProps) {
  return (
    <section className={`${NEON_PANEL} p-4 sm:p-5`} aria-labelledby="activity-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="activity-heading" className={`${NEON_HEADING} text-sm uppercase tracking-[0.14em]`}>
          Recent activity
        </h2>
        <Link
          href="/dashboard?tab=contests"
          className="text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          Contests
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Finish a contest and your results will land here.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-100">
                  {item.title}
                </p>
                <p className="truncate text-xs text-gray-500">{item.detail}</p>
              </div>
              <span className={`${NEON_LABEL} shrink-0`}>
                {relativeTime(item.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
