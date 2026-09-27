"use client";

import { Lightbulb } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { resolveFeatureLucideIcon } from "@/components/games/resolve-feature-icon";
import { GamePagePanel } from "./GamePageChrome";

const TRADING_DEFAULT_TIPS = [
  { title: "Plan your entries", description: "", icon: "target" },
  { title: "Manage risk", description: "", icon: "skill" },
  { title: "Watch momentum", description: "", icon: "speed" },
  { title: "Stay disciplined", description: "", icon: "spark" },
];

function tipRows(game: GamePageData) {
  const fromHighlights = (game.highlights ?? []).filter((h) => h.title.trim());
  if (fromHighlights.length > 0) return fromHighlights.slice(0, 6);
  if (game.kind === "trading") return TRADING_DEFAULT_TIPS;
  return [];
}

export function GamePageTips({ game }: { game: GamePageData }) {
  const tips = tipRows(game);
  if (tips.length === 0 && !game.gameTipsImageUrl) return null;

  return (
    <GamePagePanel className="overflow-hidden !p-0">
      {/*
        Reason: tips text is content-width; the image column takes leftover
        width and row height. object-cover fills left→right with no letterbox
        bars and no aspect distortion (cover scales uniformly; may crop a
        little top/bottom). object-contain left black side gaps (owner).
      */}
      <div className="flex flex-col lg:min-h-[220px] lg:flex-row lg:items-stretch">
        <div className="shrink-0 space-y-4 p-5 lg:w-[min(100%,300px)] lg:max-w-[34%] lg:py-6 lg:pl-6 lg:pr-4">
          <div>
            <h2 className="flex items-center gap-2 text-[24px] font-bold uppercase tracking-wide text-white md:text-[28px]">
              <Lightbulb className="h-6 w-6 text-[var(--gp-gold,#ffd33d)]" />
              {game.kind === "trading" ? "Trading Tips" : "Game Tips"}
            </h2>
            <p className="mt-2 text-[17px] text-[var(--gp-muted)] md:text-[18px]">
              {game.kind === "trading"
                ? "Trade smarter. Win more."
                : "Play smarter. Climb higher."}
            </p>
          </div>
          {tips.length > 0 ? (
            <ul className="space-y-4">
              {tips.map((tip, index) => {
                const Icon = resolveFeatureLucideIcon(tip.icon, index);
                return (
                  <li
                    key={`${tip.title}-${index}`}
                    className="flex items-start gap-3 text-[17px] font-medium text-[var(--gp-text)] md:text-[19px]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--gp-gold,#ffd33d)]/45 bg-[var(--gp-gold,#ffd33d)]/15 text-[var(--gp-gold,#ffd33d)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block">{tip.title}</span>
                      {tip.description ? (
                        <span className="mt-0.5 block text-[14px] font-normal leading-snug text-[var(--gp-muted)]">
                          {tip.description}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="relative min-h-[180px] flex-1 overflow-hidden bg-black lg:min-h-0">
          {game.gameTipsImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.gameTipsImageUrl}
              alt={`${game.title} tips`}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center text-[var(--gp-muted)] lg:min-h-full">
              Tips artwork
            </div>
          )}
        </div>
      </div>
    </GamePagePanel>
  );
}
