"use client";

import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
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
    <div className="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--gp-border)] pb-px">
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
                ? "-mb-px shrink-0 border-b-2 border-[var(--gp-accent)] px-3 py-2.5 text-xs font-semibold text-white"
                : "shrink-0 px-3 py-2.5 text-xs font-medium text-[var(--gp-muted)] hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
