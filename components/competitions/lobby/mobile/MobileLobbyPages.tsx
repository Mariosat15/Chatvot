"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/*
 * The phone lobby's tab pages (mobile fix guide, 13 Oct 2026).
 *
 * One row of compact pills, one page visible at a time - the "small pages inside the section"
 * the owner asked for, replacing the scroll-jump chips that left every section stacked below.
 *
 * Inactive pages are kept in the DOM with `hidden` rather than unmounted, so client state inside
 * a page (the leaderboard's open profile card, an expanded list) survives switching tabs and the
 * server-rendered content is never refetched.
 */

export interface MobileLobbyPage {
  id: string;
  label: string;
  content: ReactNode;
}

/** `#lobby-page-<id>` opens that page from anywhere, e.g. the run panel's "View Leaderboard". */
const HASH_PREFIX = "#lobby-page-";

export function MobileLobbyPages({ pages }: { pages: MobileLobbyPage[] }) {
  const [active, setActive] = useState(pages.at(0)?.id ?? "");
  const barRef = useRef<HTMLDivElement>(null);

  const openFromHash = useCallback(
    (scroll: boolean) => {
      const hash = window.location.hash;
      if (!hash.startsWith(HASH_PREFIX)) return;
      const id = hash.slice(HASH_PREFIX.length);
      if (!pages.some((page) => page.id === id)) return;
      setActive(id);
      if (scroll) {
        requestAnimationFrame(() => barRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [pages]
  );

  useEffect(() => {
    openFromHash(false);
    const onHash = () => openFromHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openFromHash]);

  if (pages.length === 0) return null;

  return (
    <div className="min-w-0">
      <div
        ref={barRef}
        role="tablist"
        aria-label="Competition details"
        className="flex min-w-0 scroll-mt-3 gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0A1024]/85 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page) => {
          const selected = page.id === active;
          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              id={`lobby-tab-${page.id}`}
              aria-selected={selected}
              aria-controls={`lobby-panel-${page.id}`}
              onClick={() => setActive(page.id)}
              className={`min-h-9 flex-auto shrink-0 whitespace-nowrap rounded-lg px-2 text-[11px] font-bold transition-colors ${
                selected
                  ? "border border-cyan-300/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_-4px_rgba(34,211,238,0.8)]"
                  : "border border-transparent text-gray-400"
              }`}
            >
              {page.label}
            </button>
          );
        })}
      </div>

      {pages.map((page) => (
        <div
          key={page.id}
          role="tabpanel"
          id={`lobby-panel-${page.id}`}
          aria-labelledby={`lobby-tab-${page.id}`}
          hidden={page.id !== active}
          className="mt-3 flex min-w-0 flex-col gap-3"
        >
          {page.content}
        </div>
      ))}
    </div>
  );
}
