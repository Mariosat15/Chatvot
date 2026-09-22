"use client";

import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "competitions", label: "Competitions" },
  { id: "leaderboards", label: "Leaderboard" },
  { id: "prizes", label: "Prizes" },
  { id: "challenges", label: "Challenges" },
  { id: "rules", label: "Rules" },
  { id: "gallery", label: "Gallery" },
] as const;

export function GamePageTabs({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  const current = active || "overview";
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-[12px] border border-[var(--gp-card-border,rgba(40,130,255,.35))] bg-[var(--gp-panel,#07152c)]/90 px-2 pt-1">
      {TABS.map((tab) => {
        const isActive = current === tab.id;
        const href =
          tab.id === "overview"
            ? `/games/${slug}`
            : `/games/${slug}?tab=${tab.id}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={
              isActive
                ? "-mb-px shrink-0 border-b-[3px] border-[var(--gp-accent)] px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--gp-glow)]"
                : "shrink-0 px-4 py-3.5 text-[14px] font-medium text-[var(--gp-muted)] transition hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
