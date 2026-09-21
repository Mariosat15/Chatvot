"use client";

import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "leaderboards", label: "Leaderboards" },
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
    <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
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
                ? "shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                : "shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-[var(--gp-muted)] hover:bg-white/5 hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
