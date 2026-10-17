"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { CompetitionPresentation } from "@/lib/competitions/types";
import { COMPETITIONS_PAGE_SIZE } from "@/lib/competitions/browse-types";
import { MobileCompetitionCard } from "./MobileCompetitionCard";

function MobileCardSkeleton() {
  return (
    <div className="flex animate-pulse gap-2.5 rounded-2xl border border-white/10 bg-[#050b1c] p-2.5">
      <div className="aspect-[3/4] w-[34%] shrink-0 rounded-xl bg-white/10" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <div className="h-5 w-24 rounded-full bg-white/10" />
        <div className="h-4 w-4/5 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="mt-auto grid grid-cols-2 gap-1">
          <div className="h-6 rounded-lg bg-white/5" />
          <div className="h-6 rounded-lg bg-white/5" />
        </div>
        <div className="ml-auto h-10 w-[120px] rounded-full bg-white/10" />
      </div>
    </div>
  );
}

/**
 * One card per row with automatic loading of the next page.
 *
 * Reason: IntersectionObserver never reports an element inside `display:none`,
 * so the sentinel stays silent while desktop is showing.
 */
export function MobileArenaInfiniteList({
  presentations,
  isLoading,
  loadError,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onRetry,
  hasActiveFilters,
  onClear,
}: {
  presentations: CompetitionPresentation[];
  isLoading: boolean;
  loadError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasMore && !isLoadingMore && !loadMoreError && !isLoading;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoad, onLoadMore]);

  if (isLoading && presentations.length === 0) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <MobileCardSkeleton />
        <MobileCardSkeleton />
        <MobileCardSkeleton />
      </div>
    );
  }

  if (loadError && presentations.length === 0) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-black/50 px-5 py-10 text-center">
        <p className="text-base font-bold text-white">Could not load competitions</p>
        <p className="mt-1 text-[13px] text-white/60">
          Something went wrong. Please contact support if this keeps happening.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-10 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-5 text-[13px] font-bold text-cyan-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (presentations.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/45 px-5 py-12 text-center">
        <p className="text-base font-bold text-white">No competitions found</p>
        <p className="mt-1 text-[13px] text-white/55">
          Try clearing filters or searching a different keyword.
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 h-10 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-5 text-[13px] font-bold text-cyan-100"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {presentations.map((p) => (
        <MobileCompetitionCard key={p.id} presentation={p} />
      ))}

      <div ref={sentinel} aria-hidden className="h-px" />

      {isLoadingMore ? (
        <div className="flex flex-col items-center gap-1 py-3 text-center" role="status">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold text-cyan-100">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading more competitions...
          </span>
          <span className="text-[11px] text-white/50">
            Automatically loads {COMPETITIONS_PAGE_SIZE} more items
          </span>
        </div>
      ) : null}

      {loadMoreError ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <p className="text-[12px] text-white/70">Could not load more competitions.</p>
          <button
            type="button"
            onClick={onLoadMore}
            className="h-9 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 text-[12px] font-bold text-cyan-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!hasMore && !isLoadingMore ? (
        <p className="py-2 text-center text-[11px] text-white/45">
          You have reached the end of the list
        </p>
      ) : null}
    </div>
  );
}
