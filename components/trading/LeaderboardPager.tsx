"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Page controls under the trading leaderboard (owner, 12 Oct 2026): "Showing 1-5 of 12",
 * previous/next arrows and numbered pages. Rendered only when there is more than one page.
 */
export const PAGE_SIZE = 5;

export function LeaderboardPager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, first + PAGE_SIZE - 1);
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-sky-500/10";

  return (
    <nav
      aria-label="Leaderboard pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-gray-400">
        Showing{" "}
        <span className="font-semibold text-gray-200">
          {first}-{last}
        </span>{" "}
        of <span className="font-semibold text-gray-200">{total}</span> traders
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className={arrow}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {visiblePages(page, pageCount).map((i, slot, all) => (
          <span key={i} className="flex items-center gap-1.5">
            {slot > 0 && i - all[slot - 1] > 1 && (
              <span className="px-1 text-gray-500" aria-hidden>
                &hellip;
              </span>
            )}
            <button
              type="button"
              aria-label={`Page ${i + 1}`}
              aria-current={i === page ? "page" : undefined}
              onClick={() => onPage(i)}
              className={`h-9 min-w-9 rounded-lg border px-2.5 text-sm font-semibold transition ${
                i === page
                  ? "border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.3)]"
                  : "border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              {i + 1}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={page === pageCount - 1}
          onClick={() => onPage(page + 1)}
          className={arrow}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/** First, last and two either side of the current page, so a big board keeps a short pager. */
function visiblePages(page: number, pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, i) => i).filter(
    (i) => i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 2,
  );
}
