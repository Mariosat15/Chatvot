import Link from "next/link";
import { Users } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import { NeonButton } from "@/components/neon/Buttons";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";
import { formatVolts } from "@/lib/utils/format-volts";
import type { CatalogueContestSummary } from "@/lib/services/games/player-catalogue.service";

/**
 * Live + upcoming contests on a game page.
 *
 * Each row links to the existing lobby (`/competitions/[id]`), never to a round-launch
 * route, so hover prefetch cannot consume an attempt.
 */

export function GameContestList({
  contests,
}: {
  contests: CatalogueContestSummary[];
}) {
  if (contests.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className={`${NEON_HEADING} text-lg`}>Live & upcoming contests</h2>
      <ul className="space-y-3">
        {contests.map((c) => (
          <li key={c.id}>
            <NeonPanel className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/competitions/${c.id}`}
                      className={`${NEON_HEADING} text-base hover:text-sky-300 truncate`}
                    >
                      {c.name}
                    </Link>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        c.status === "active"
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-sky-500/40 text-sky-300"
                      } ${NEON_LABEL}`}
                    >
                      {c.status === "active" ? "Live" : "Upcoming"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Entry {formatVolts(c.entryFee)}</span>
                    <span>Pool {formatVolts(c.prizePool)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.currentParticipants}/{c.maxParticipants}
                    </span>
                  </p>
                </div>
                <div className="sm:w-44 shrink-0">
                  <NeonButton
                    href={`/competitions/${c.id}`}
                    tone="action"
                    label="View lobby"
                    sublabel={
                      c.status === "active" ? "Join or play" : "Opens soon"
                    }
                  />
                </div>
              </div>
            </NeonPanel>
          </li>
        ))}
      </ul>
    </div>
  );
}
