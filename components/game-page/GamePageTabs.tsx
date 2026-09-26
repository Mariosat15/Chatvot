"use client";

import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "competitions", label: "Competitions" },
  { id: "leaderboards", label: "Leaderboard" },
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
    // Reason: `overflow-x-auto` alone forces `overflow-y` to `auto` per CSS
    // (one non-visible axis makes the other auto), which is why a horizontal
    // tab strip showed a vertical scrollbar. Pin y to hidden.
    <div className="flex max-w-full items-stretch gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-[12px] border border-[var(--gp-card-border,rgba(40,130,255,.35))] bg-[var(--gp-panel,#07152c)]/90 px-2">
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
                ? "min-h-11 shrink-0 border-b-[3px] border-[var(--gp-accent)] px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--gp-glow)]"
                : "min-h-11 shrink-0 border-b-[3px] border-transparent px-4 py-3.5 text-[14px] font-medium text-[var(--gp-muted)] transition hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
