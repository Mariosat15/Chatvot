"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrowseCompetitionsResult } from "@/lib/competitions/browse-types";
import type { CompetitionListItem } from "@/lib/competitions/types";

/**
 * Phone-only "load ten more" state, kept beside — never inside — the desktop
 * pagination.
 *
 * Reason: both trees are mounted at once (`hidden md:block` / `md:hidden`), so
 * appending into the shared `items` would make desktop page 1 grow to 20, 30…
 * rows. The phone list is the current page plus whatever this hook appended;
 * a change of filters or page (`resetKey`) throws the appended pages away.
 */
export function useMobileArenaPages<T extends CompetitionListItem>({
  baseItems,
  page,
  totalPages,
  resetKey,
  queryForPage,
}: {
  baseItems: T[];
  page: number;
  totalPages: number;
  /** Changes whenever the filters or the desktop page change. */
  resetKey: string;
  queryForPage: (page: number) => string;
}) {
  const [extraItems, setExtraItems] = useState<T[]>([]);
  const [extraRegisteredIds, setExtraRegisteredIds] = useState<string[]>([]);
  const [lastPage, setLastPage] = useState(page);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Reason: a request started under old filters must not append into the new list.
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    setExtraItems([]);
    setExtraRegisteredIds([]);
    setLastPage(page);
    setIsLoadingMore(false);
    setLoadMoreError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const hasMore = lastPage < totalPages;

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore) return;
    inFlight.current = true;
    const myGeneration = generation.current;
    const nextPage = lastPage + 1;
    setIsLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await fetch(`/api/competitions?${queryForPage(nextPage)}`);
      if (myGeneration !== generation.current) return;
      if (!res.ok) {
        setLoadMoreError(true);
        return;
      }
      const data = (await res.json()) as BrowseCompetitionsResult;
      if (myGeneration !== generation.current) return;
      setExtraItems((prev) => [...prev, ...((data.items as T[]) || [])]);
      setExtraRegisteredIds((prev) => [
        ...prev,
        ...(data.userInCompetitionIds || []).map(String),
      ]);
      setLastPage(data.page || nextPage);
    } catch (error) {
      console.warn("⚠️ Could not load more competitions:", error);
      if (myGeneration === generation.current) setLoadMoreError(true);
    } finally {
      if (myGeneration === generation.current) {
        inFlight.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, lastPage, queryForPage]);

  const items = useMemo(() => {
    // Reason: the 20s poll can shift rows between pages; never show one twice.
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of [...baseItems, ...extraItems]) {
      const id = String(item._id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
    return out;
  }, [baseItems, extraItems]);

  return {
    items,
    extraRegisteredIds,
    hasMore,
    isLoadingMore,
    loadMoreError,
    loadMore,
  };
}
