"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PRESS_EFFECT } from "@/components/ui/press-effect";

/*
 * The phone lobby's tab pages (mobile fix guide, 13 Oct 2026).
 *
 * One row of compact pills, one page visible at a time - the "small pages inside the section"
 * the owner asked for, replacing the scroll-jump chips that left every section stacked below.
 *
 * When the pills are wider than the phone the row scrolls sideways, and an arrow sits at each
 * end (beside the first and last tab) so it is obvious there is more to drag to; each arrow dims
 * once that end is reached, and both disappear when every tab already fits (owner, 13 Oct 2026).
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

/** One pixel of slack so sub-pixel layout never leaves an arrow lit at the very end. */
const EDGE_SLACK_PX = 1;

export function MobileLobbyPages({ pages }: { pages: MobileLobbyPage[] }) {
  const [active, setActive] = useState(pages.at(0)?.id ?? "");
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const barRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      overflow: max > EDGE_SLACK_PX,
      left: el.scrollLeft > EDGE_SLACK_PX,
      right: el.scrollLeft < max - EDGE_SLACK_PX,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

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

  // Reason: a tab opened from a hash or an arrow can sit off-screen in the row; bring it in.
  useEffect(() => {
    const tab = scrollerRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  const nudge = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.6), behavior: "smooth" });
  };

  if (pages.length === 0) return null;

  return (
    <div className="min-w-0">
      <div
        ref={barRef}
        className="flex min-w-0 scroll-mt-3 items-center gap-1 rounded-xl border border-white/[0.07] bg-[#0A1024]/85 p-1"
      >
        {edges.overflow ? (
          <ScrollArrow direction="left" enabled={edges.left} onPress={() => nudge(-1)} />
        ) : null}
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Competition details"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page) => {
            const selected = page.id === active;
            return (
              <button
                key={page.id}
                type="button"
                role="tab"
                data-tab={page.id}
                id={`lobby-tab-${page.id}`}
                aria-selected={selected}
                aria-controls={`lobby-panel-${page.id}`}
                onClick={() => setActive(page.id)}
                className={`min-h-9 flex-auto shrink-0 whitespace-nowrap rounded-lg px-3 text-center text-[12px] font-bold transition-colors ${
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
        {edges.overflow ? (
          <ScrollArrow direction="right" enabled={edges.right} onPress={() => nudge(1)} />
        ) : null}
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

function ScrollArrow({
  direction,
  enabled,
  onPress,
}: {
  direction: "left" | "right";
  enabled: boolean;
  onPress: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={!enabled}
      aria-label={direction === "left" ? "Show earlier tabs" : "Show more tabs"}
      className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-lg border transition-opacity ${
        enabled
          ? `border-cyan-300/30 bg-cyan-500/10 text-cyan-200 ${PRESS_EFFECT}`
          : "border-white/[0.05] text-gray-600 opacity-50"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
