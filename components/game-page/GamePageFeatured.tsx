"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { GamePagePanel } from "./GamePageChrome";

const TRADING_OVERLAYS = [
  "1v1 TRADING CHALLENGES",
  "HOW TRADING WORKS",
  "COMPETE. CLIMB. WIN.",
];

export function GamePageFeatured({ game }: { game: GamePageData }) {
  const featured = (game.gallery ?? []).slice(0, 3);
  const [lightbox, setLightbox] = useState<{
    url: string;
    title: string;
  } | null>(null);

  if (featured.length === 0) return null;

  return (
    <>
      <GamePagePanel>
        <h2 className="text-[20px] font-bold uppercase tracking-wide text-white md:text-[22px]">
          <span className="text-[var(--gp-accent)]">Featured</span>
          <span className="ml-2 text-[15px] font-medium normal-case tracking-normal text-[var(--gp-muted)]">
            Explore more
          </span>
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item, i) => {
            // Reason: i is the map index into a fixed 3-slot overlay list, not a
            // request-supplied key — eslint still flags bracket access.
            const tradingOverlay =
              i === 0
                ? TRADING_OVERLAYS[0]
                : i === 1
                  ? TRADING_OVERLAYS[1]
                  : i === 2
                    ? TRADING_OVERLAYS[2]
                    : undefined;
            const overlay =
              item.title?.trim() ||
              (game.kind === "trading"
                ? tradingOverlay ?? `Featured ${i + 1}`
                : `Featured ${i + 1}`);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setLightbox({ url: item.url, title: overlay })
                }
                className="group relative aspect-video overflow-hidden rounded-[12px] border border-[var(--gp-border)] shadow-[0_0_20px_rgba(0,217,255,.08)] transition hover:shadow-[0_0_28px_rgba(0,217,255,.25)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={overlay}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-left text-[14px] font-bold uppercase tracking-wide text-white drop-shadow md:text-[16px]">
                  {overlay}
                </span>
              </button>
            );
          })}
        </div>
      </GamePagePanel>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/50 p-2 text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.title}
            className="max-h-[90vh] max-w-[95vw] rounded-[12px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
