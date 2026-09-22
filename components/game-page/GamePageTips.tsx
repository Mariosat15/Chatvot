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
    <GamePagePanel>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
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
          {tips.length > 0 ? (
            <ul className="mt-6 space-y-4">
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
        {/*
          Reason: tips artwork is a full designed banner (logo + headline baked
          in). object-cover inside a fixed aspect cropped the left of ChartVolt
          / TRADING TIPS. Let the upload set the height so any ratio works.
        */}
        <div className="overflow-hidden rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]">
          {game.gameTipsImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.gameTipsImageUrl}
              alt={`${game.title} tips`}
              className="block h-auto w-full object-contain"
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center text-[var(--gp-muted)]">
              Tips artwork
            </div>
          )}
        </div>
      </div>
    </GamePagePanel>
  );
}
