"use client";

import { CheckCircle2, Lightbulb } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { GamePagePanel } from "./GamePageChrome";

const TRADING_DEFAULT_TIPS = [
  "Plan your entries",
  "Manage risk",
  "Watch momentum",
  "Stay disciplined",
];

function tipLines(game: GamePageData): string[] {
  const fromHighlights = (game.highlights ?? [])
    .map((h) => h.title.trim())
    .filter(Boolean);
  if (fromHighlights.length > 0) return fromHighlights.slice(0, 6);
  if (game.kind === "trading") return TRADING_DEFAULT_TIPS;
  return [];
}

export function GamePageTips({ game }: { game: GamePageData }) {
  const tips = tipLines(game);
  if (tips.length === 0 && !game.gameTipsImageUrl) return null;

  return (
    <GamePagePanel className="overflow-hidden !p-0">
      {/*
        Reason: a 50/50 grid left a dead band between short tip copy and the
        artwork. Text stays content-width; the image column takes the leftover
        and stretches to the row height so the banner fills the gap without a
        fixed aspect crop (object-contain — baked-in logos must stay readable).
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
              {tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-3 text-[17px] font-medium text-[var(--gp-text)] md:text-[19px]"
                >
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[var(--gp-green,#15e89d)]" />
                  {tip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative min-h-[160px] flex-1 overflow-hidden bg-black/40 lg:min-h-0">
          {game.gameTipsImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.gameTipsImageUrl}
              alt={`${game.title} tips`}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center text-[var(--gp-muted)] lg:min-h-full">
              Tips artwork
            </div>
          )}
        </div>
      </div>
    </GamePagePanel>
  );
}
